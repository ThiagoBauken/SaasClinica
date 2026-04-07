/**
 * Tool Executor Service
 *
 * Bridges Claude's tool calls to existing database queries and services.
 * All functions receive companyId for tenant isolation.
 * Reuses existing business logic from n8n-tools.routes.ts but as direct function calls.
 */

import { db } from '../../db';
import { eq, and, gte, lte, or, like, sql, desc } from 'drizzle-orm';
import {
  companies, clinicSettings, patients, appointments, procedures, users,
  chatSessions, chatMessages,
} from '@shared/schema';
import { normalizePhone } from '../../utils/phone';
import { logger } from '../../logger';
import {
  ensureOpportunityForSession,
  progressOpportunity,
  type AIStage,
} from '../crm-auto-progression';
import type { ToolName } from './dental-tools';

const log = logger.child({ module: 'tool-executor' });

/** Context passed to every tool execution */
export interface ToolContext {
  companyId: number;
  sessionId: number;
  phone: string;
}

/**
 * Dispatches a tool call to the appropriate handler.
 * Returns a JSON-serializable result that Claude will receive.
 */
export async function executeTool(
  toolName: string,
  input: Record<string, any>,
  ctx: ToolContext
): Promise<Record<string, any>> {
  const handler = TOOL_HANDLERS[toolName as ToolName];
  if (!handler) {
    throw new Error(`Tool não reconhecida: ${toolName}`);
  }

  log.info({ tool: toolName, companyId: ctx.companyId }, `Executing tool: ${toolName}`);
  const start = Date.now();

  try {
    const result = await handler(input, ctx);
    log.info({ tool: toolName, durationMs: Date.now() - start }, `Tool completed: ${toolName}`);
    return result;
  } catch (err) {
    log.error({ tool: toolName, err }, `Tool failed: ${toolName}`);
    throw err;
  }
}

// ============================================================
// Tool Handler Implementations
// ============================================================

const TOOL_HANDLERS: Record<ToolName, (input: any, ctx: ToolContext) => Promise<any>> = {
  lookup_patient: async (input, ctx) => {
    // SEGURANÇA: Forçar busca apenas pelo telefone da sessão atual
    // Impede que a IA busque dados de outros pacientes por manipulação de input
    const normalized = normalizePhone(ctx.phone);

    // Busca exata primeiro (usa índice), sem LIKE wildcard que causa full-table-scan
    const [patient] = await db
      .select()
      .from(patients)
      .where(
        and(
          eq(patients.companyId, ctx.companyId),
          or(
            eq(patients.phone, normalized),
            eq(patients.cellphone, normalized),
            eq(patients.whatsappPhone, normalized),
          )
        )
      )
      .limit(1);

    if (!patient) {
      return { found: false, message: 'Paciente não cadastrado (novo paciente)' };
    }

    return {
      found: true,
      patient: {
        id: patient.id,
        fullName: patient.fullName,
        phone: patient.whatsappPhone || patient.cellphone || patient.phone,
        email: patient.email,
        birthDate: patient.birthDate,
        lastVisit: patient.lastVisit,
        totalAppointments: patient.totalAppointments,
        tags: patient.tags,
        treatmentType: patient.treatmentType,
        isOrthodonticPatient: patient.isOrthodonticPatient,
        preferredDayOfWeek: patient.preferredDayOfWeek,
        preferredTimeSlot: patient.preferredTimeSlot,
        allergies: patient.allergies,
        chronicDiseases: patient.chronicDiseases,
      },
    };
  },

  get_patient_appointments: async (input, ctx) => {
    // SEGURANÇA: Forçar telefone da sessão para impedir vazamento de dados entre pacientes
    const normalized = normalizePhone(ctx.phone);

    // Resolve patient ID from phone
    const [patient] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(
        and(
          eq(patients.companyId, ctx.companyId),
          or(
            eq(patients.phone, normalized),
            eq(patients.cellphone, normalized),
            eq(patients.whatsappPhone, normalized),
            like(patients.phone, `%${normalized}%`),
            like(patients.cellphone, `%${normalized}%`),
            like(patients.whatsappPhone, `%${normalized}%`)
          )
        )
      )
      .limit(1);

    if (!patient) {
      return { found: false, appointments: [], message: 'Paciente não encontrado' };
    }

    const now = new Date();
    const limit = input.limit || 5;
    const includePast = input.include_past || false;

    let whereConditions = and(
      eq(appointments.companyId, ctx.companyId),
      eq(appointments.patientId, patient.id)
    );

    if (!includePast) {
      whereConditions = and(
        whereConditions,
        gte(appointments.startTime, now),
        or(eq(appointments.status, 'scheduled'), eq(appointments.status, 'confirmed'))
      );
    }

    // Single query with LEFT JOIN — eliminates N+1 professional name lookups
    const results = await db
      .select({
        id: appointments.id,
        title: appointments.title,
        startTime: appointments.startTime,
        endTime: appointments.endTime,
        status: appointments.status,
        notes: appointments.notes,
        professionalId: appointments.professionalId,
        professionalName: users.fullName,
      })
      .from(appointments)
      .leftJoin(users, eq(appointments.professionalId, users.id))
      .where(whereConditions)
      .orderBy(includePast ? desc(appointments.startTime) : appointments.startTime)
      .limit(limit);

    const enriched = results.map((apt: any) => ({
      id: apt.id,
      title: apt.title,
      startTime: apt.startTime,
      endTime: apt.endTime,
      status: apt.status,
      notes: apt.notes,
      professionalName: apt.professionalName || 'Não definido',
      dataFormatada: apt.startTime ? new Date(apt.startTime).toLocaleDateString('pt-BR') : '',
      horaFormatada: apt.startTime ? new Date(apt.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
    }));

    return { found: true, count: enriched.length, appointments: enriched };
  },

  check_availability: async (input, ctx) => {
    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, ctx.companyId))
      .limit(1);

    const slotDuration = settings?.slotDurationMinutes || 30;
    const bufferMinutes = settings?.appointmentBufferMinutes || 0;
    const workingHours = settings?.workingHoursJson as Record<string, { open: string; close: string }> | null;

    const startDate = new Date(input.date_from);
    startDate.setHours(0, 0, 0, 0);

    const endDateStr = input.date_to || input.date_from;
    const endDate = new Date(endDateStr);
    endDate.setHours(23, 59, 59, 999);

    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const allSlots: any[] = [];

    for (let d = 0; d < Math.min(days, 7); d++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + d);

      // Skip Sundays
      if (currentDate.getDay() === 0) continue;

      const dayName = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'][currentDate.getDay()];
      const dayHours = workingHours?.[dayName];

      const workStartHour = dayHours ? parseInt(dayHours.open.split(':')[0]) : parseInt(settings?.openingTime?.split(':')[0] || '8');
      const workEndHour = dayHours ? parseInt(dayHours.close.split(':')[0]) : parseInt(settings?.closingTime?.split(':')[0] || '18');

      const dayStart = new Date(currentDate);
      dayStart.setHours(workStartHour, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(workEndHour, 0, 0, 0);

      let appointmentWhere = and(
        eq(appointments.companyId, ctx.companyId),
        gte(appointments.startTime, dayStart),
        lte(appointments.startTime, dayEnd),
        or(eq(appointments.status, 'scheduled'), eq(appointments.status, 'confirmed'), eq(appointments.status, 'in_progress'))
      );

      if (input.professional_id) {
        appointmentWhere = and(appointmentWhere, eq(appointments.professionalId, input.professional_id));
      }

      const existing = await db
        .select({ startTime: appointments.startTime, endTime: appointments.endTime })
        .from(appointments)
        .where(appointmentWhere);

      const daySlots: string[] = [];
      let currentSlot = new Date(dayStart);
      const now = new Date();

      while (currentSlot < dayEnd) {
        const slotEnd = new Date(currentSlot);
        slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration + bufferMinutes);

        const isAvailable = !existing.some((apt: any) => {
          const aptStart = new Date(apt.startTime!);
          const aptEnd = new Date(apt.endTime!);
          return currentSlot < aptEnd && slotEnd > aptStart;
        });

        if (isAvailable && currentSlot > now) {
          daySlots.push(currentSlot.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        }

        currentSlot.setMinutes(currentSlot.getMinutes() + slotDuration);
      }

      if (daySlots.length > 0) {
        allSlots.push({
          date: currentDate.toISOString().split('T')[0],
          dateFormatted: currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }),
          slots: daySlots,
          count: daySlots.length,
        });
      }
    }

    return {
      slotDurationMinutes: slotDuration,
      workingHours: `${settings?.openingTime || '08:00'} - ${settings?.closingTime || '18:00'}`,
      days: allSlots,
      totalSlotsAvailable: allSlots.reduce((sum, d) => sum + d.count, 0),
    };
  },

  schedule_appointment: async (input, ctx) => {
    // Validate phone
    const phoneToUse = input.patient_phone || ctx.phone;
    if (!phoneToUse) {
      return { success: false, error: 'Telefone do paciente não fornecido.' };
    }
    const normalized = normalizePhone(phoneToUse);

    // Validate time format
    const timeParts = (input.time || '').split(':');
    if (timeParts.length !== 2) {
      return { success: false, error: 'Horário inválido (formato esperado: HH:MM).' };
    }
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return { success: false, error: `Horário inválido: ${input.time}. Use formato HH:MM.` };
    }

    // Validate date is in the future
    const startTime = new Date(input.date);
    if (isNaN(startTime.getTime())) {
      return { success: false, error: 'Data inválida.' };
    }
    startTime.setHours(hours, minutes, 0, 0);
    if (startTime <= new Date()) {
      return { success: false, error: 'A data/hora do agendamento deve ser no futuro.' };
    }

    // Resolve patient (exact match first, then partial)
    let [patient] = await db
      .select({ id: patients.id, fullName: patients.fullName })
      .from(patients)
      .where(
        and(
          eq(patients.companyId, ctx.companyId),
          or(
            eq(patients.phone, normalized),
            eq(patients.cellphone, normalized),
            eq(patients.whatsappPhone, normalized),
          )
        )
      )
      .limit(1);

    // Fallback: partial match
    if (!patient) {
      [patient] = await db
        .select({ id: patients.id, fullName: patients.fullName })
        .from(patients)
        .where(
          and(
            eq(patients.companyId, ctx.companyId),
            or(
              like(patients.phone, `%${normalized}%`),
              like(patients.cellphone, `%${normalized}%`),
              like(patients.whatsappPhone, `%${normalized}%`)
            )
          )
        )
        .limit(1);
    }

    if (!patient) {
      return { success: false, error: 'Paciente não cadastrado. Colete os dados primeiro com save_patient_intake.' };
    }

    // Get slot duration
    const [settings] = await db.select().from(clinicSettings).where(eq(clinicSettings.companyId, ctx.companyId)).limit(1);
    let appointmentDuration = settings?.slotDurationMinutes || 30;
    let appointmentTitle = input.title || `Consulta - ${patient.fullName}`;

    if (input.procedure_id) {
      const [proc] = await db.select().from(procedures).where(eq(procedures.id, input.procedure_id)).limit(1);
      if (proc) {
        appointmentDuration = proc.duration;
        appointmentTitle = input.title || `${proc.name} - ${patient.fullName}`;
      }
    }

    // Build endTime
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + appointmentDuration);

    // Check conflicts
    const conflicts = await db.select().from(appointments).where(
      and(
        eq(appointments.companyId, ctx.companyId),
        or(eq(appointments.status, 'scheduled'), eq(appointments.status, 'confirmed')),
        sql`${appointments.startTime} < ${endTime} AND ${appointments.endTime} > ${startTime}`
      )
    );

    if (conflicts.length > 0) {
      return { success: false, error: 'Horário já ocupado. Verifique disponibilidade novamente.' };
    }

    // Create appointment
    const [newApt] = await db.insert(appointments).values({
      companyId: ctx.companyId,
      patientId: patient.id,
      professionalId: input.professional_id,
      title: appointmentTitle,
      startTime,
      endTime,
      status: 'scheduled',
      type: 'appointment',
      notes: input.notes,
      automationEnabled: true,
      automationStatus: 'pending',
    }).returning();

    // Auto-progress CRM
    try {
      await progressOpportunity(ctx.companyId, 'scheduling', {
        sessionId: ctx.sessionId,
        metadata: { appointmentId: newApt.id },
      });
    } catch (err) {
      log.warn({ err }, 'CRM auto-progress (scheduling) failed');
    }

    return {
      success: true,
      message: 'Agendamento criado com sucesso',
      appointment: {
        id: newApt.id,
        title: newApt.title,
        startTime: newApt.startTime,
        endTime: newApt.endTime,
        dataFormatada: new Date(newApt.startTime!).toLocaleDateString('pt-BR'),
        horaFormatada: new Date(newApt.startTime!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      },
    };
  },

  confirm_appointment: async (input, ctx) => {
    const [apt] = await db.select().from(appointments).where(eq(appointments.id, input.appointment_id)).limit(1);
    if (!apt) return { success: false, error: 'Consulta não encontrada' };
    if (apt.companyId !== ctx.companyId) return { success: false, error: 'Acesso negado' };

    const [updated] = await db.update(appointments).set({
      status: 'confirmed',
      confirmedByPatient: true,
      confirmationDate: new Date(),
      confirmationMethod: 'whatsapp_ai',
      patientResponse: 'Confirmado via IA WhatsApp',
      updatedAt: new Date(),
    }).where(eq(appointments.id, input.appointment_id)).returning();

    // CRM progression
    try {
      await progressOpportunity(ctx.companyId, 'confirmation', {
        sessionId: ctx.sessionId,
        metadata: { appointmentId: updated.id },
      });
    } catch (err) {
      log.warn({ err }, 'CRM auto-progress (confirmation) failed');
    }

    return {
      success: true,
      message: 'Consulta confirmada',
      appointment: {
        id: updated.id,
        title: updated.title,
        status: updated.status,
        dataFormatada: updated.startTime ? new Date(updated.startTime).toLocaleDateString('pt-BR') : '',
        horaFormatada: updated.startTime ? new Date(updated.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
      },
    };
  },

  request_cancel_confirmation: async (input, ctx) => {
    const [apt] = await db.select().from(appointments).where(eq(appointments.id, input.appointment_id)).limit(1);
    if (!apt) return { success: false, error: 'Consulta não encontrada' };
    if (apt.companyId !== ctx.companyId) return { success: false, error: 'Acesso negado' };

    if (apt.status === 'cancelled') {
      return { success: false, error: 'Esta consulta já está cancelada.' };
    }

    // Marca pendência de confirmação no Redis (TTL 10 min)
    try {
      const { redisCacheClient, isRedisAvailable } = await import('../../redis');
      if (await isRedisAvailable()) {
        const key = `ai:pending_cancel:${ctx.companyId}:${ctx.sessionId}`;
        await redisCacheClient.set(key, String(input.appointment_id), 'EX', 600);
      }
    } catch (err) {
      log.warn({ err }, 'Failed to set pending cancel state');
    }

    return {
      success: true,
      pending: true,
      message: 'Cancelamento aguardando confirmação dupla. Pergunte ao paciente "Confirma cancelar a consulta de [data]?". Só chame cancel_appointment se ele responder SIM.',
      appointment: {
        id: apt.id,
        title: apt.title,
        dataFormatada: apt.startTime ? new Date(apt.startTime).toLocaleDateString('pt-BR') : '',
        horaFormatada: apt.startTime ? new Date(apt.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
      },
    };
  },

  cancel_appointment: async (input, ctx) => {
    const [apt] = await db.select().from(appointments).where(eq(appointments.id, input.appointment_id)).limit(1);
    if (!apt) return { success: false, error: 'Consulta não encontrada' };
    if (apt.companyId !== ctx.companyId) return { success: false, error: 'Acesso negado' };

    if (apt.status === 'cancelled') {
      return { success: false, error: 'Esta consulta já está cancelada.' };
    }

    // PROTEÇÃO ANTI-CANCELAMENTO ACIDENTAL:
    // Verifica que existe pendência ativa de confirmação para este appointment.
    // Se não existir, força a IA a chamar request_cancel_confirmation primeiro.
    try {
      const { redisCacheClient, isRedisAvailable } = await import('../../redis');
      if (await isRedisAvailable()) {
        const key = `ai:pending_cancel:${ctx.companyId}:${ctx.sessionId}`;
        const pendingId = await redisCacheClient.get(key);
        if (!pendingId || parseInt(pendingId, 10) !== input.appointment_id) {
          return {
            success: false,
            requires_confirmation: true,
            error: 'Confirmação dupla obrigatória. Chame request_cancel_confirmation primeiro e aguarde o paciente responder SIM antes de chamar cancel_appointment.',
          };
        }
        // Consume pending state — only allow once
        await redisCacheClient.del(key);
      }
    } catch (err) {
      log.warn({ err }, 'Failed to verify pending cancel state — refusing for safety');
      return {
        success: false,
        requires_confirmation: true,
        error: 'Não foi possível verificar a confirmação. Por segurança, peça ao paciente para confirmar novamente.',
      };
    }

    const [updated] = await db.update(appointments).set({
      status: 'cancelled',
      notes: apt.notes ? `${apt.notes}\nCancelado via IA: ${input.reason || 'Sem motivo informado'}` : `Cancelado via IA: ${input.reason || 'Sem motivo informado'}`,
      updatedAt: new Date(),
    }).where(eq(appointments.id, input.appointment_id)).returning();

    return {
      success: true,
      message: 'Consulta cancelada com sucesso',
      appointment: {
        id: updated.id,
        title: updated.title,
        status: 'cancelled',
        dataFormatada: apt.startTime ? new Date(apt.startTime).toLocaleDateString('pt-BR') : '',
        horaFormatada: apt.startTime ? new Date(apt.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
      },
      followup_suggestion: 'Ofereça reagendamento gentilmente: "Quando precisar voltar, é só me chamar 😊"',
    };
  },

  reschedule_appointment: async (input, ctx) => {
    const [apt] = await db.select().from(appointments).where(eq(appointments.id, input.appointment_id)).limit(1);
    if (!apt) return { success: false, error: 'Consulta não encontrada' };
    if (apt.companyId !== ctx.companyId) return { success: false, error: 'Acesso negado' };

    const [hours, minutes] = input.new_time.split(':').map(Number);
    const newStart = new Date(input.new_date);
    newStart.setHours(hours, minutes, 0, 0);

    // Keep same duration
    const originalDuration = apt.endTime && apt.startTime
      ? new Date(apt.endTime).getTime() - new Date(apt.startTime).getTime()
      : 30 * 60 * 1000;
    const newEnd = new Date(newStart.getTime() + originalDuration);

    // Check conflicts
    const conflicts = await db.select().from(appointments).where(
      and(
        eq(appointments.companyId, ctx.companyId),
        or(eq(appointments.status, 'scheduled'), eq(appointments.status, 'confirmed')),
        sql`${appointments.id} != ${input.appointment_id}`,
        sql`${appointments.startTime} < ${newEnd} AND ${appointments.endTime} > ${newStart}`
      )
    );

    if (conflicts.length > 0) {
      return { success: false, error: 'Novo horário já ocupado.' };
    }

    const [updated] = await db.update(appointments).set({
      startTime: newStart,
      endTime: newEnd,
      status: 'scheduled',
      confirmedByPatient: false,
      updatedAt: new Date(),
    }).where(eq(appointments.id, input.appointment_id)).returning();

    return {
      success: true,
      message: 'Consulta reagendada',
      appointment: {
        id: updated.id,
        title: updated.title,
        dataFormatada: new Date(updated.startTime!).toLocaleDateString('pt-BR'),
        horaFormatada: new Date(updated.startTime!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      },
    };
  },

  get_clinic_info: async (input, ctx) => {
    const [settings] = await db.select().from(clinicSettings).where(eq(clinicSettings.companyId, ctx.companyId)).limit(1);
    const [company] = await db.select().from(companies).where(eq(companies.id, ctx.companyId)).limit(1);

    if (!settings && !company) {
      return { error: 'Informações da clínica não configuradas' };
    }

    const infoType = input.info_type;
    const info: Record<string, any> = {};

    if (infoType === 'address' || infoType === 'all') {
      info.address = [settings?.address, settings?.number, settings?.complement, settings?.neighborhood, settings?.city, settings?.state].filter(Boolean).join(', ');
      info.googleMapsLink = settings?.googleMapsLink;
    }

    if (infoType === 'hours' || infoType === 'all') {
      info.openingTime = settings?.openingTime;
      info.closingTime = settings?.closingTime;
      info.workingHours = settings?.workingHoursJson;
    }

    if (infoType === 'phone' || infoType === 'all') {
      info.phone = settings?.phone || company?.phone;
      info.cellphone = settings?.cellphone;
    }

    if (infoType === 'services' || infoType === 'all') {
      const procs = await db.select({ id: procedures.id, name: procedures.name, duration: procedures.duration, price: procedures.price })
        .from(procedures)
        .where(eq(procedures.companyId, ctx.companyId))
        .limit(30);
      info.services = procs;
    }

    if (infoType === 'prices' || infoType === 'all') {
      const policy = settings?.priceDisclosurePolicy || 'always';
      if (policy === 'never_chat') {
        info.prices = 'Valores disponíveis somente presencialmente ou por telefone.';
      } else {
        const procs = await db.select({ name: procedures.name, price: procedures.price })
          .from(procedures)
          .where(eq(procedures.companyId, ctx.companyId))
          .limit(30);
        info.prices = procs;
        info.pricePolicy = policy;
      }
    }

    if (infoType === 'emergency' || infoType === 'all') {
      info.emergencyPhone = settings?.emergencyPhone || settings?.phone || company?.phone;
    }

    info.clinicName = settings?.name || company?.name;
    info.googleReviewLink = settings?.googleReviewLink;

    return info;
  },

  move_crm_stage: async (input, ctx) => {
    try {
      await ensureOpportunityForSession(ctx.companyId, ctx.sessionId, { phone: ctx.phone });
      await progressOpportunity(ctx.companyId, input.target_stage as AIStage, {
        sessionId: ctx.sessionId,
        metadata: { notes: input.notes, triggeredBy: 'ai_agent' },
      });
      return { success: true, stage: input.target_stage };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  transfer_to_human: async (input, ctx) => {
    // Update session status to waiting_human
    await db.update(chatSessions).set({
      status: 'waiting_human',
      context: sql`COALESCE(${chatSessions.context}, '{}'::jsonb) || ${JSON.stringify({
        humanTransferReason: input.reason,
        humanTransferSummary: input.summary,
        humanTransferAt: new Date().toISOString(),
      })}::jsonb`,
      updatedAt: new Date(),
    }).where(eq(chatSessions.id, ctx.sessionId));

    // Notificar admins/dentistas via WhatsApp e WebSocket
    try {
      const adminUsers = await db
        .select({ id: users.id, fullName: users.fullName, phone: users.phone, wuzapiPhone: users.wuzapiPhone })
        .from(users)
        .where(
          and(
            eq(users.companyId, ctx.companyId),
            eq(users.active, true),
            or(eq(users.role, 'admin'), eq(users.role, 'dentist'))
          )
        )
        .limit(5);

      const reasonText: Record<string, string> = {
        emergency: 'EMERGÊNCIA',
        patient_request: 'Solicitação do paciente',
        complaint: 'Reclamação',
        complex_query: 'Questão complexa',
        payment_issue: 'Problema de pagamento',
        agent_failed: 'IA não conseguiu resolver',
      };

      const { getWhatsAppProvider } = await import('../whatsapp-provider');
      const provider = await getWhatsAppProvider(ctx.companyId);

      if (provider) {
        const notificationMsg = `⚠️ *Transferência para atendente*\n\n📱 Paciente: ${ctx.phone}\n📋 Motivo: ${reasonText[input.reason] || input.reason}\n${input.summary ? `💬 Resumo: ${input.summary}` : ''}\n\nResponda diretamente no WhatsApp para assumir o atendimento.`;

        for (const admin of adminUsers) {
          const adminPhone = admin.wuzapiPhone || admin.phone;
          if (adminPhone) {
            try {
              await provider.sendTextMessage({ phone: adminPhone, message: notificationMsg });
            } catch (sendErr) {
              log.warn({ sendErr, adminId: admin.id }, 'Failed to notify admin via WhatsApp');
            }
          }
        }
      }

      // WebSocket broadcast for real-time dashboard notification
      const { broadcastToCompany } = await import('../../websocket-redis-adapter');
      broadcastToCompany(ctx.companyId, 'chat:human_transfer', {
        phone: ctx.phone,
        sessionId: ctx.sessionId,
        reason: input.reason,
        summary: input.summary,
        isEmergency: input.reason === 'emergency',
      });
    } catch (notifyErr) {
      log.warn({ notifyErr }, 'Failed to send handoff notifications (non-blocking)');
    }

    return {
      success: true,
      message: 'Conversa transferida para atendimento humano',
      reason: input.reason,
    };
  },

  save_patient_intake: async (input, ctx) => {
    const normalized = normalizePhone(input.phone || ctx.phone);

    // Check if patient already exists
    const [existing] = await db.select({ id: patients.id }).from(patients).where(
      and(
        eq(patients.companyId, ctx.companyId),
        or(
          eq(patients.phone, normalized),
          eq(patients.cellphone, normalized),
          eq(patients.whatsappPhone, normalized),
        )
      )
    ).limit(1);

    if (existing) {
      // Update existing patient with new info
      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (input.full_name) updateData.fullName = input.full_name;
      if (input.email) updateData.email = input.email;
      if (input.cpf) updateData.cpf = input.cpf;
      if (input.date_of_birth) updateData.birthDate = new Date(input.date_of_birth);
      if (input.health_plan) updateData.insuranceName = input.health_plan;
      if (input.allergies) updateData.allergies = input.allergies;
      if (input.chief_complaint) updateData.notes = input.chief_complaint;

      await db.update(patients).set(updateData).where(eq(patients.id, existing.id));

      // Link to session
      await db.update(chatSessions).set({ patientId: existing.id, userType: 'patient', updatedAt: new Date() }).where(eq(chatSessions.id, ctx.sessionId));

      return { success: true, patientId: existing.id, message: 'Dados do paciente atualizados' };
    }

    // Create new patient
    const [newPatient] = await db.insert(patients).values({
      companyId: ctx.companyId,
      fullName: input.full_name,
      phone: normalized,
      cellphone: normalized,
      whatsappPhone: normalized,
      email: input.email,
      cpf: input.cpf,
      birthDate: input.date_of_birth ? new Date(input.date_of_birth) : undefined,
      insuranceName: input.health_plan,
      allergies: input.allergies,
      notes: input.chief_complaint,
      whatsappConsent: false,          // LGPD: consentimento deve ser coletado explicitamente
      dataProcessingConsent: false,    // LGPD: consentimento deve ser coletado explicitamente
      consentMethod: 'pending_explicit',
      consentDate: undefined,
    }).returning();

    // Link to session and CRM opportunity
    await db.update(chatSessions).set({
      patientId: newPatient.id,
      userType: 'patient',
      updatedAt: new Date(),
    }).where(eq(chatSessions.id, ctx.sessionId));

    try {
      await ensureOpportunityForSession(ctx.companyId, ctx.sessionId, {
        patientId: newPatient.id,
        patientName: newPatient.fullName,
        phone: normalized,
      });
    } catch (err) {
      log.warn({ err }, 'Failed to link patient to CRM opportunity');
    }

    return { success: true, patientId: newPatient.id, message: 'Paciente cadastrado com sucesso' };
  },

  generate_payment_link: async (input, ctx) => {
    // This would integrate with Stripe/MercadoPago
    // For now, return a structured response the clinic can use
    return {
      success: true,
      message: 'Link de pagamento será enviado em breve',
      amount: input.amount,
      description: input.description,
      method: input.method || 'pix',
      note: 'Integração de pagamento automático em desenvolvimento. O atendente enviará o link manualmente.',
    };
  },

  list_procedures: async (input, ctx) => {
    let whereConditions = and(
      eq(procedures.companyId, ctx.companyId),
      eq(procedures.active, true)
    );

    if (input.category) {
      whereConditions = and(whereConditions, eq(procedures.category, input.category));
    }

    const list = await db.select({
      id: procedures.id,
      name: procedures.name,
      duration: procedures.duration,
      price: procedures.price,
      description: procedures.description,
      category: procedures.category,
    }).from(procedures).where(whereConditions);

    return {
      count: list.length,
      procedures: list.map((p: any) => ({
        ...p,
        priceFormatted: p.price ? `R$ ${(Number(p.price) / 100).toFixed(2)}` : 'Sob consulta',
        durationFormatted: `${p.duration} min`,
      })),
    };
  },

  list_professionals: async (input, ctx) => {
    let whereConditions = and(
      eq(users.companyId, ctx.companyId),
      eq(users.active, true),
      or(eq(users.role, 'dentist'), eq(users.role, 'admin'))
    );

    if (input.speciality) {
      whereConditions = and(whereConditions, like(users.speciality, `%${input.speciality}%`));
    }

    const list = await db.select({
      id: users.id,
      fullName: users.fullName,
      speciality: users.speciality,
      email: users.email,
    }).from(users).where(whereConditions);

    return { count: list.length, professionals: list };
  },

  update_patient_tags: async (input, ctx) => {
    const normalized = normalizePhone(input.phone || ctx.phone);

    const [patient] = await db.select().from(patients).where(
      and(
        eq(patients.companyId, ctx.companyId),
        or(
          eq(patients.phone, normalized),
          eq(patients.cellphone, normalized),
          eq(patients.whatsappPhone, normalized),
        )
      )
    ).limit(1);

    if (!patient) return { success: false, error: 'Paciente não encontrado' };

    let currentTags: string[] = (patient.tags as string[]) || [];

    if (input.add_tags && Array.isArray(input.add_tags)) {
      currentTags = [...new Set([...currentTags, ...input.add_tags])];
    }
    if (input.remove_tags && Array.isArray(input.remove_tags)) {
      currentTags = currentTags.filter((t: string) => !input.remove_tags.includes(t));
    }

    const updateData: Record<string, any> = { tags: currentTags, updatedAt: new Date() };

    if (input.is_orthodontic !== undefined) {
      updateData.isOrthodonticPatient = input.is_orthodontic;
      if (input.is_orthodontic && !currentTags.includes('ortodontia')) {
        currentTags.push('ortodontia');
        updateData.tags = currentTags;
      }
      if (input.is_orthodontic && !patient.orthodonticStartDate) {
        updateData.orthodonticStartDate = new Date();
      }
    }

    await db.update(patients).set(updateData).where(eq(patients.id, patient.id));

    return { success: true, tags: currentTags };
  },

  consultation_completed: async (input, ctx) => {
    // Mark appointment as completed
    if (input.appointment_id) {
      const [apt] = await db.select().from(appointments).where(eq(appointments.id, input.appointment_id)).limit(1);
      if (!apt) return { success: false, error: 'Consulta não encontrada' };
      if (apt.companyId !== ctx.companyId) return { success: false, error: 'Acesso negado' };

      await db.update(appointments).set({
        status: 'completed',
        updatedAt: new Date(),
      }).where(eq(appointments.id, input.appointment_id));
    }

    // Progress CRM
    try {
      await ensureOpportunityForSession(ctx.companyId, ctx.sessionId, { phone: ctx.phone });
      await progressOpportunity(ctx.companyId, 'consultation_done', {
        sessionId: ctx.sessionId,
        metadata: { appointmentId: input.appointment_id, triggeredBy: 'ai_agent' },
      });
    } catch (err) {
      log.warn({ err }, 'CRM auto-progress (consultation_done) failed');
    }

    return { success: true, message: 'Consulta marcada como realizada' };
  },

  payment_completed: async (input, ctx) => {
    // Progress CRM to payment_done
    try {
      await ensureOpportunityForSession(ctx.companyId, ctx.sessionId, { phone: ctx.phone });
      await progressOpportunity(ctx.companyId, 'payment_done', {
        sessionId: ctx.sessionId,
        metadata: {
          amount: input.amount,
          paymentMethod: input.payment_method,
          appointmentId: input.appointment_id,
          triggeredBy: 'ai_agent',
        },
      });
    } catch (err) {
      log.warn({ err }, 'CRM auto-progress (payment_done) failed');
    }

    return { success: true, message: 'Pagamento registrado e CRM atualizado' };
  },

  generate_confirmation_link: async (input, ctx) => {
    const [apt] = await db.select().from(appointments).where(eq(appointments.id, input.appointment_id)).limit(1);
    if (!apt) return { success: false, error: 'Consulta não encontrada' };
    if (apt.companyId !== ctx.companyId) return { success: false, error: 'Acesso negado' };

    try {
      const { randomBytes } = await import('crypto');
      const { appointmentConfirmationLinks } = await import('@shared/schema');

      const token = randomBytes(32).toString('hex');
      const expiresInHours = input.expires_in_hours || 48;
      const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

      await db.insert(appointmentConfirmationLinks).values({
        companyId: ctx.companyId,
        appointmentId: input.appointment_id,
        token,
        action: 'confirm',
        expiresAt,
        isActive: true,
      });

      const baseUrl = process.env.APP_URL || 'http://localhost:5000';
      const confirmUrl = `${baseUrl}/confirmar/${token}`;

      return { success: true, confirmUrl, token, expiresAt: expiresAt.toISOString() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};
