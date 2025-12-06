import { Router } from 'express';
import { db } from '../db';
import {
  companies, clinicSettings, patients, appointments, procedures, users, rooms
} from '@shared/schema';
import { eq, and, gte, lte, or, like, sql, desc } from 'drizzle-orm';
import { asyncHandler } from '../middleware/auth';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import {
  ConversationStyleConfig,
  ConversationContext,
  getGreeting,
  generateGreetingResponse,
  generateScheduleResponse,
  generateAppointmentCreatedResponse,
  generateConfirmedResponse,
  generateGoodbyeResponse,
  generateEmergencyResponse,
  generateFallbackResponse,
  generateHumanizedAIPrompt,
  formatResponse,
} from '../services/conversation-style.service';
import {
  classifyIntent as smartClassifyIntent,
  extractEntities,
  generateSmartResponse,
  DEBOUNCE_MS,
  ExtendedConversationConfig,
} from '../services/smart-conversation.service';

const router = Router();

// ==========================================
// BUFFER DE MENSAGENS PARA DEBOUNCE
// ==========================================

interface MessageBufferItem {
  messages: Array<{ text: string; timestamp: Date }>;
  isFirstMessage: boolean;
  timeoutId?: ReturnType<typeof setTimeout>;
  resolveCallback?: (value: any) => void;
}

const messageBuffers = new Map<string, MessageBufferItem>();

/**
 * Middleware para autenticar requisições do N8N
 * Aceita:
 * 1. SAAS_MASTER_API_KEY (acesso global)
 * 2. Company-specific n8nApiKey (acesso por empresa)
 * 3. Wuzapi Token (identifica empresa automaticamente)
 */
async function n8nAuth(req: any, res: any, next: any) {
  const apiKey = req.headers['x-api-key'] as string;
  const wuzapiToken = req.headers['x-wuzapi-token'] as string;
  const masterKey = process.env.SAAS_MASTER_API_KEY;

  // 1. Master API Key - acesso global
  if (apiKey && apiKey === masterKey) {
    req.isMaster = true;
    return next();
  }

  // 2. Wuzapi Token - identifica empresa automaticamente
  if (wuzapiToken) {
    const allSettings = await db.select().from(clinicSettings);
    type ClinicSettingsRow = typeof clinicSettings.$inferSelect;
    const matchedSettings = allSettings.find((s: ClinicSettingsRow) => s.wuzapiApiKey === wuzapiToken);

    if (matchedSettings) {
      req.companyId = matchedSettings.companyId;
      req.companySettings = matchedSettings;
      return next();
    }
  }

  // 3. Company-specific API Key
  if (apiKey) {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.n8nApiKey, apiKey))
      .limit(1);

    if (company) {
      req.companyId = company.id;
      return next();
    }
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized',
    message: 'Forneça X-API-Key ou X-Wuzapi-Token válido',
  });
}

// Helper para obter companyId do request
function getCompanyId(req: any, body?: any): number | null {
  // Prioridade: body.companyId > req.companyId > query.companyId
  if (body?.companyId) return parseInt(body.companyId);
  if (req.companyId) return req.companyId;
  if (req.query.companyId) return parseInt(req.query.companyId);
  return null;
}

// ==========================================
// FERRAMENTA 1: BUSCAR PACIENTE POR TELEFONE
// ==========================================

/**
 * GET /api/v1/n8n/tools/patient-by-phone
 * Busca paciente pelo número de telefone
 *
 * Query params:
 * - phone: número do telefone (obrigatório)
 * - companyId: ID da empresa (opcional se usar wuzapi token)
 */
router.get(
  '/patient-by-phone',
  n8nAuth,
  asyncHandler(async (req, res) => {
    const phone = req.query.phone as string;
    const companyId = getCompanyId(req);

    if (!phone) {
      return res.status(400).json({ success: false, error: 'phone is required' });
    }

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'companyId is required' });
    }

    // Normalizar telefone (remover caracteres especiais)
    const normalizedPhone = phone.replace(/\D/g, '');

    // Buscar paciente por qualquer campo de telefone
    const [patient] = await db
      .select()
      .from(patients)
      .where(
        and(
          eq(patients.companyId, companyId),
          or(
            like(patients.phone, `%${normalizedPhone}%`),
            like(patients.cellphone, `%${normalizedPhone}%`),
            like(patients.whatsappPhone, `%${normalizedPhone}%`)
          )
        )
      )
      .limit(1);

    if (!patient) {
      return res.json({
        success: true,
        found: false,
        patient: null,
        message: 'Paciente não encontrado',
      });
    }

    res.json({
      success: true,
      found: true,
      patient: {
        id: patient.id,
        fullName: patient.fullName,
        phone: patient.phone,
        cellphone: patient.cellphone,
        whatsappPhone: patient.whatsappPhone,
        email: patient.email,
        birthDate: patient.birthDate,
        lastVisit: patient.lastVisit,
        totalAppointments: patient.totalAppointments,
        // Tags e Ortodontia
        tags: patient.tags,
        treatmentType: patient.treatmentType,
        isOrthodonticPatient: patient.isOrthodonticPatient,
        orthodonticStartDate: patient.orthodonticStartDate,
        nextRecurringAppointment: patient.nextRecurringAppointment,
        recurringIntervalDays: patient.recurringIntervalDays,
        preferredDayOfWeek: patient.preferredDayOfWeek,
        preferredTimeSlot: patient.preferredTimeSlot,
      },
    });
  })
);

// ==========================================
// FERRAMENTA 2: BUSCAR AGENDAMENTOS DO PACIENTE
// ==========================================

/**
 * GET /api/v1/n8n/tools/patient-appointments
 * Busca agendamentos de um paciente
 *
 * Query params:
 * - patientId: ID do paciente
 * - phone: telefone do paciente (alternativa ao patientId)
 * - status: filtrar por status (upcoming, past, all)
 * - limit: quantidade máxima (default: 5)
 */
router.get(
  '/patient-appointments',
  n8nAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const patientId = req.query.patientId ? parseInt(req.query.patientId as string) : null;
    const phone = req.query.phone as string;
    const status = req.query.status as string || 'upcoming';
    const limit = parseInt(req.query.limit as string) || 5;

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'companyId is required' });
    }

    // Se phone fornecido, buscar patientId
    let resolvedPatientId = patientId;
    if (!resolvedPatientId && phone) {
      const normalizedPhone = phone.replace(/\D/g, '');
      const [patient] = await db
        .select({ id: patients.id })
        .from(patients)
        .where(
          and(
            eq(patients.companyId, companyId),
            or(
              like(patients.phone, `%${normalizedPhone}%`),
              like(patients.cellphone, `%${normalizedPhone}%`),
              like(patients.whatsappPhone, `%${normalizedPhone}%`)
            )
          )
        )
        .limit(1);

      if (patient) {
        resolvedPatientId = patient.id;
      }
    }

    if (!resolvedPatientId) {
      return res.json({
        success: true,
        found: false,
        appointments: [],
        message: 'Paciente não encontrado',
      });
    }

    const now = new Date();
    let whereConditions = and(
      eq(appointments.companyId, companyId),
      eq(appointments.patientId, resolvedPatientId)
    );

    // Filtrar por status temporal
    if (status === 'upcoming') {
      whereConditions = and(
        whereConditions,
        gte(appointments.startTime, now),
        or(
          eq(appointments.status, 'scheduled'),
          eq(appointments.status, 'confirmed')
        )
      );
    } else if (status === 'past') {
      whereConditions = and(
        whereConditions,
        lte(appointments.startTime, now)
      );
    }

    const patientAppointments = await db
      .select({
        id: appointments.id,
        title: appointments.title,
        startTime: appointments.startTime,
        endTime: appointments.endTime,
        status: appointments.status,
        notes: appointments.notes,
        professionalId: appointments.professionalId,
        recurring: appointments.recurring,
      })
      .from(appointments)
      .where(whereConditions)
      .orderBy(status === 'past' ? desc(appointments.startTime) : appointments.startTime)
      .limit(limit);

    // Buscar nomes dos profissionais
    type AppointmentRow = typeof appointments.$inferSelect;
    const appointmentsWithProfessional = await Promise.all(
      patientAppointments.map(async (apt: AppointmentRow) => {
        let professionalName = 'Não definido';
        if (apt.professionalId) {
          const [prof] = await db
            .select({ fullName: users.fullName })
            .from(users)
            .where(eq(users.id, apt.professionalId))
            .limit(1);
          if (prof) professionalName = prof.fullName;
        }
        return {
          ...apt,
          professionalName,
          // Formatar datas para exibição
          dataFormatada: new Date(apt.startTime).toLocaleDateString('pt-BR'),
          horaFormatada: new Date(apt.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        };
      })
    );

    res.json({
      success: true,
      found: true,
      patientId: resolvedPatientId,
      count: appointmentsWithProfessional.length,
      appointments: appointmentsWithProfessional,
    });
  })
);

// ==========================================
// FERRAMENTA 3: HORÁRIOS DISPONÍVEIS
// ==========================================

/**
 * GET /api/v1/n8n/tools/available-slots
 * Busca horários disponíveis para agendamento
 *
 * Query params:
 * - date: data no formato YYYY-MM-DD (default: hoje)
 * - professionalId: ID do profissional (opcional)
 * - procedureId: ID do procedimento (para calcular duração)
 * - days: buscar nos próximos X dias (default: 1)
 */
router.get(
  '/available-slots',
  n8nAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const dateStr = req.query.date as string;
    const professionalId = req.query.professionalId ? parseInt(req.query.professionalId as string) : null;
    const procedureId = req.query.procedureId ? parseInt(req.query.procedureId as string) : null;
    const days = parseInt(req.query.days as string) || 1;

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'companyId is required' });
    }

    // Buscar configurações da clínica
    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    const slotDuration = settings?.slotDurationMinutes || 30;

    // Definir horário de funcionamento (pode vir das settings)
    const workStartHour = 8;
    const workEndHour = 18;

    // Data inicial
    const startDate = dateStr ? new Date(dateStr) : new Date();
    startDate.setHours(0, 0, 0, 0);

    const allSlots: any[] = [];

    for (let d = 0; d < days; d++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + d);

      // Pular domingos
      if (currentDate.getDay() === 0) continue;

      const dayStart = new Date(currentDate);
      dayStart.setHours(workStartHour, 0, 0, 0);

      const dayEnd = new Date(currentDate);
      dayEnd.setHours(workEndHour, 0, 0, 0);

      // Buscar agendamentos existentes no dia
      let appointmentWhere = and(
        eq(appointments.companyId, companyId),
        gte(appointments.startTime, dayStart),
        lte(appointments.startTime, dayEnd),
        or(
          eq(appointments.status, 'scheduled'),
          eq(appointments.status, 'confirmed'),
          eq(appointments.status, 'in_progress')
        )
      );

      if (professionalId) {
        appointmentWhere = and(
          appointmentWhere,
          eq(appointments.professionalId, professionalId)
        );
      }

      const existingAppointments = await db
        .select({
          startTime: appointments.startTime,
          endTime: appointments.endTime,
        })
        .from(appointments)
        .where(appointmentWhere);

      // Gerar slots disponíveis
      const daySlots: string[] = [];
      let currentSlot = new Date(dayStart);

      while (currentSlot < dayEnd) {
        const slotEnd = new Date(currentSlot);
        slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);

        // Verificar se slot está disponível
        type ExistingApt = typeof existingAppointments[0];
        const isAvailable = !existingAppointments.some((apt: ExistingApt) => {
          const aptStart = new Date(apt.startTime!);
          const aptEnd = new Date(apt.endTime!);
          return currentSlot < aptEnd && slotEnd > aptStart;
        });

        // Não mostrar horários passados para hoje
        const now = new Date();
        const isNotPast = currentSlot > now;

        if (isAvailable && isNotPast) {
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

    res.json({
      success: true,
      slotDurationMinutes: slotDuration,
      workingHours: `${workStartHour}:00 - ${workEndHour}:00`,
      days: allSlots,
      totalSlotsAvailable: allSlots.reduce((sum, d) => sum + d.count, 0),
    });
  })
);

// ==========================================
// FERRAMENTA 4: CRIAR AGENDAMENTO
// ==========================================

const createAppointmentSchema = z.object({
  companyId: z.number().optional(),
  patientId: z.number().optional(),
  patientPhone: z.string().optional(),
  professionalId: z.number().optional(),
  procedureId: z.number().optional(),
  date: z.string(), // YYYY-MM-DD
  time: z.string(), // HH:MM
  title: z.string().optional(),
  notes: z.string().optional(),
  recurring: z.boolean().optional(),
  isOrthodonticMaintenance: z.boolean().optional(),
});

/**
 * POST /api/v1/n8n/tools/create-appointment
 * Cria um novo agendamento
 */
router.post(
  '/create-appointment',
  n8nAuth,
  validate({ body: createAppointmentSchema }),
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req, req.body);
    const {
      patientId, patientPhone, professionalId, procedureId,
      date, time, title, notes, recurring, isOrthodonticMaintenance
    } = req.body;

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'companyId is required' });
    }

    // Resolver patientId se phone foi fornecido
    let resolvedPatientId = patientId;
    if (!resolvedPatientId && patientPhone) {
      const normalizedPhone = patientPhone.replace(/\D/g, '');
      const [patient] = await db
        .select({ id: patients.id })
        .from(patients)
        .where(
          and(
            eq(patients.companyId, companyId),
            or(
              like(patients.phone, `%${normalizedPhone}%`),
              like(patients.cellphone, `%${normalizedPhone}%`),
              like(patients.whatsappPhone, `%${normalizedPhone}%`)
            )
          )
        )
        .limit(1);

      if (patient) resolvedPatientId = patient.id;
    }

    if (!resolvedPatientId) {
      return res.status(400).json({
        success: false,
        error: 'Patient not found',
        message: 'Forneça patientId ou patientPhone válido',
      });
    }

    // Buscar dados do paciente para o título
    const [patient] = await db
      .select({ fullName: patients.fullName })
      .from(patients)
      .where(eq(patients.id, resolvedPatientId))
      .limit(1);

    // Buscar configurações para duração do slot
    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    const slotDuration = settings?.slotDurationMinutes || 30;

    // Se procedureId fornecido, usar duração do procedimento
    let appointmentDuration = slotDuration;
    let appointmentTitle = title || `Consulta - ${patient?.fullName || 'Paciente'}`;

    if (procedureId) {
      const [procedure] = await db
        .select()
        .from(procedures)
        .where(eq(procedures.id, procedureId))
        .limit(1);

      if (procedure) {
        appointmentDuration = procedure.duration;
        appointmentTitle = title || `${procedure.name} - ${patient?.fullName || 'Paciente'}`;
      }
    }

    if (isOrthodonticMaintenance) {
      appointmentTitle = title || `Manutenção Ortodôntica - ${patient?.fullName || 'Paciente'}`;
    }

    // Construir data/hora
    const [hours, minutes] = time.split(':').map(Number);
    const startTime = new Date(date);
    startTime.setHours(hours, minutes, 0, 0);

    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + appointmentDuration);

    // Verificar conflitos
    const conflicts = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.companyId, companyId),
          or(
            eq(appointments.status, 'scheduled'),
            eq(appointments.status, 'confirmed')
          ),
          // Verificar sobreposição
          sql`${appointments.startTime} < ${endTime} AND ${appointments.endTime} > ${startTime}`
        )
      );

    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Time slot conflict',
        message: 'Já existe um agendamento neste horário',
        conflictingAppointments: conflicts.map((c: typeof conflicts[0]) => ({
          id: c.id,
          title: c.title,
          startTime: c.startTime,
          endTime: c.endTime,
        })),
      });
    }

    // Criar agendamento
    const [newAppointment] = await db
      .insert(appointments)
      .values({
        companyId,
        patientId: resolvedPatientId,
        professionalId,
        title: appointmentTitle,
        startTime,
        endTime,
        status: 'scheduled',
        type: 'appointment',
        notes,
        recurring: recurring || isOrthodonticMaintenance || false,
        recurrencePattern: isOrthodonticMaintenance ? 'monthly' : null,
        automationEnabled: true,
        automationStatus: 'pending',
      })
      .returning();

    // Se é manutenção ortodôntica, atualizar nextRecurringAppointment do paciente
    if (isOrthodonticMaintenance) {
      await db
        .update(patients)
        .set({
          nextRecurringAppointment: startTime,
          updatedAt: new Date(),
        })
        .where(eq(patients.id, resolvedPatientId));
    }

    res.json({
      success: true,
      message: 'Agendamento criado com sucesso',
      appointment: {
        id: newAppointment.id,
        title: newAppointment.title,
        patientId: newAppointment.patientId,
        startTime: newAppointment.startTime,
        endTime: newAppointment.endTime,
        status: newAppointment.status,
        dataFormatada: new Date(newAppointment.startTime).toLocaleDateString('pt-BR'),
        horaFormatada: new Date(newAppointment.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      },
    });
  })
);

// ==========================================
// FERRAMENTA 5: CONFIRMAR AGENDAMENTO
// ==========================================

/**
 * POST /api/v1/n8n/tools/confirm-appointment
 * Confirma um agendamento existente
 */
router.post(
  '/confirm-appointment',
  n8nAuth,
  asyncHandler(async (req, res) => {
    const { appointmentId, patientResponse, confirmationMethod } = req.body;
    const companyId = getCompanyId(req, req.body);

    if (!appointmentId) {
      return res.status(400).json({ success: false, error: 'appointmentId is required' });
    }

    const [appointment] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);

    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }

    // Verificar se pertence à empresa (se companyId fornecido)
    if (companyId && appointment.companyId !== companyId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Atualizar para confirmado
    const [updated] = await db
      .update(appointments)
      .set({
        status: 'confirmed',
        confirmedByPatient: true,
        confirmationDate: new Date(),
        confirmationMethod: confirmationMethod || 'whatsapp',
        patientResponse: patientResponse || 'Confirmado via WhatsApp',
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, appointmentId))
      .returning();

    res.json({
      success: true,
      message: 'Agendamento confirmado com sucesso',
      appointment: {
        id: updated.id,
        title: updated.title,
        status: updated.status,
        startTime: updated.startTime,
        confirmationDate: updated.confirmationDate,
      },
    });
  })
);

// ==========================================
// FERRAMENTA 6: CANCELAR AGENDAMENTO
// ==========================================

/**
 * POST /api/v1/n8n/tools/cancel-appointment
 * Cancela um agendamento
 */
router.post(
  '/cancel-appointment',
  n8nAuth,
  asyncHandler(async (req, res) => {
    const { appointmentId, reason, requestReschedule } = req.body;
    const companyId = getCompanyId(req, req.body);

    if (!appointmentId) {
      return res.status(400).json({ success: false, error: 'appointmentId is required' });
    }

    const [appointment] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);

    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }

    if (companyId && appointment.companyId !== companyId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const [updated] = await db
      .update(appointments)
      .set({
        status: 'cancelled',
        notes: appointment.notes ? `${appointment.notes}\n\nMotivo cancelamento: ${reason || 'Não informado'}` : `Motivo cancelamento: ${reason || 'Não informado'}`,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, appointmentId))
      .returning();

    res.json({
      success: true,
      message: 'Agendamento cancelado',
      appointment: {
        id: updated.id,
        title: updated.title,
        status: updated.status,
        previousStartTime: updated.startTime,
      },
      requestReschedule: requestReschedule || false,
    });
  })
);

// ==========================================
// FERRAMENTA 7: BUSCAR PROCEDIMENTOS
// ==========================================

/**
 * GET /api/v1/n8n/tools/procedures
 * Lista procedimentos disponíveis da clínica
 */
router.get(
  '/procedures',
  n8nAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const category = req.query.category as string;
    const onlyRecurring = req.query.onlyRecurring === 'true';

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'companyId is required' });
    }

    let whereConditions = and(
      eq(procedures.companyId, companyId),
      eq(procedures.active, true)
    );

    if (category) {
      whereConditions = and(whereConditions, eq(procedures.category, category));
    }

    if (onlyRecurring) {
      whereConditions = and(whereConditions, eq(procedures.isRecurring, true));
    }

    const procedureList = await db
      .select({
        id: procedures.id,
        name: procedures.name,
        duration: procedures.duration,
        price: procedures.price,
        description: procedures.description,
        category: procedures.category,
        isRecurring: procedures.isRecurring,
        defaultRecurrenceIntervalDays: procedures.defaultRecurrenceIntervalDays,
      })
      .from(procedures)
      .where(whereConditions);

    res.json({
      success: true,
      count: procedureList.length,
      procedures: procedureList.map((p: typeof procedureList[0]) => ({
        ...p,
        priceFormatted: `R$ ${((p.price || 0) / 100).toFixed(2)}`,
        durationFormatted: `${p.duration} min`,
      })),
    });
  })
);

// ==========================================
// FERRAMENTA 8: BUSCAR PROFISSIONAIS
// ==========================================

/**
 * GET /api/v1/n8n/tools/professionals
 * Lista profissionais disponíveis da clínica
 */
router.get(
  '/professionals',
  n8nAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const speciality = req.query.speciality as string;

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'companyId is required' });
    }

    let whereConditions = and(
      eq(users.companyId, companyId),
      eq(users.active, true),
      or(
        eq(users.role, 'dentist'),
        eq(users.role, 'admin')
      )
    );

    if (speciality) {
      whereConditions = and(whereConditions, like(users.speciality, `%${speciality}%`));
    }

    const professionalList = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        speciality: users.speciality,
        email: users.email,
      })
      .from(users)
      .where(whereConditions);

    res.json({
      success: true,
      count: professionalList.length,
      professionals: professionalList,
    });
  })
);

// ==========================================
// FERRAMENTA 9: CONFIG DA CLÍNICA
// ==========================================

/**
 * GET /api/v1/n8n/tools/clinic-config
 * Retorna configurações básicas da clínica (horários, etc)
 */
router.get(
  '/clinic-config',
  n8nAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'companyId is required' });
    }

    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    res.json({
      success: true,
      config: {
        companyId,
        name: settings?.name || company?.name || 'Clínica',
        phone: settings?.phone || company?.phone || '',
        address: settings?.address || '',
        googleReviewLink: settings?.googleReviewLink || '',
        googleMapsLink: settings?.googleMapsLink || '',
        // Horários
        slotDurationMinutes: settings?.slotDurationMinutes || 30,
        workingHours: '08:00 - 18:00',
        workingDays: 'Segunda a Sábado',
        // Automação
        enableAppointmentReminders: settings?.enableAppointmentReminders ?? true,
        reminderHoursBefore: settings?.reminderHoursBefore || 24,
        enableBirthdayMessages: settings?.enableBirthdayMessages ?? true,
        enableFeedbackRequests: settings?.enableFeedbackRequests ?? true,
      },
    });
  })
);

// ==========================================
// FERRAMENTA 10: PACIENTES ORTODÔNTICOS
// ==========================================

/**
 * GET /api/v1/n8n/tools/orthodontic-patients
 * Lista pacientes de ortodontia que precisam de reagendamento
 */
router.get(
  '/orthodontic-patients',
  n8nAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const daysAhead = parseInt(req.query.daysAhead as string) || 7;

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'companyId is required' });
    }

    const now = new Date();
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysAhead);

    // Pacientes ortodônticos que precisam de reagendamento
    const orthodonticPatients = await db
      .select()
      .from(patients)
      .where(
        and(
          eq(patients.companyId, companyId),
          eq(patients.isOrthodonticPatient, true),
          eq(patients.active, true),
          or(
            // Próximo agendamento recorrente está no passado ou próximo
            lte(patients.nextRecurringAppointment, targetDate),
            // Ou não tem próximo agendamento definido
            sql`${patients.nextRecurringAppointment} IS NULL`
          )
        )
      );

    const patientsWithInfo = await Promise.all(
      orthodonticPatients.map(async (patient: typeof orthodonticPatients[0]) => {
        // Buscar último agendamento
        const [lastAppointment] = await db
          .select()
          .from(appointments)
          .where(
            and(
              eq(appointments.patientId, patient.id),
              eq(appointments.status, 'completed')
            )
          )
          .orderBy(desc(appointments.endTime))
          .limit(1);

        // Calcular quando deveria ser o próximo
        const intervalDays = patient.recurringIntervalDays || 30;
        let suggestedDate = null;

        if (lastAppointment) {
          suggestedDate = new Date(lastAppointment.endTime);
          suggestedDate.setDate(suggestedDate.getDate() + intervalDays);
        } else if (patient.orthodonticStartDate) {
          suggestedDate = new Date(patient.orthodonticStartDate);
          suggestedDate.setDate(suggestedDate.getDate() + intervalDays);
        }

        return {
          id: patient.id,
          fullName: patient.fullName,
          phone: patient.cellphone || patient.whatsappPhone || patient.phone,
          email: patient.email,
          orthodonticStartDate: patient.orthodonticStartDate,
          lastVisit: patient.lastVisit || lastAppointment?.endTime,
          nextRecurringAppointment: patient.nextRecurringAppointment,
          recurringIntervalDays: intervalDays,
          preferredDayOfWeek: patient.preferredDayOfWeek,
          preferredTimeSlot: patient.preferredTimeSlot,
          suggestedNextDate: suggestedDate,
          needsScheduling: !patient.nextRecurringAppointment || new Date(patient.nextRecurringAppointment) < now,
        };
      })
    );

    res.json({
      success: true,
      count: patientsWithInfo.length,
      patientsNeedingScheduling: patientsWithInfo.filter(p => p.needsScheduling).length,
      patients: patientsWithInfo,
    });
  })
);

// ==========================================
// FERRAMENTA 11: ATUALIZAR TAGS DO PACIENTE
// ==========================================

/**
 * PATCH /api/v1/n8n/tools/patient-tags
 * Atualiza tags de um paciente
 */
router.patch(
  '/patient-tags',
  n8nAuth,
  asyncHandler(async (req, res) => {
    const { patientId, patientPhone, tags, addTags, removeTags, isOrthodonticPatient } = req.body;
    const companyId = getCompanyId(req, req.body);

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'companyId is required' });
    }

    // Resolver patientId
    let resolvedPatientId = patientId;
    if (!resolvedPatientId && patientPhone) {
      const normalizedPhone = patientPhone.replace(/\D/g, '');
      const [patient] = await db
        .select({ id: patients.id })
        .from(patients)
        .where(
          and(
            eq(patients.companyId, companyId),
            or(
              like(patients.phone, `%${normalizedPhone}%`),
              like(patients.cellphone, `%${normalizedPhone}%`),
              like(patients.whatsappPhone, `%${normalizedPhone}%`)
            )
          )
        )
        .limit(1);

      if (patient) resolvedPatientId = patient.id;
    }

    if (!resolvedPatientId) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    // Buscar paciente atual
    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, resolvedPatientId))
      .limit(1);

    if (!patient || patient.companyId !== companyId) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    // Calcular novas tags
    let currentTags: string[] = (patient.tags as string[]) || [];

    if (tags) {
      currentTags = tags;
    } else {
      if (addTags && Array.isArray(addTags)) {
        currentTags = [...new Set([...currentTags, ...addTags])];
      }
      if (removeTags && Array.isArray(removeTags)) {
        currentTags = currentTags.filter(t => !removeTags.includes(t));
      }
    }

    // Preparar update
    const updateData: any = {
      tags: currentTags,
      updatedAt: new Date(),
    };

    // Se marcou como ortodôntico
    if (isOrthodonticPatient !== undefined) {
      updateData.isOrthodonticPatient = isOrthodonticPatient;
      if (isOrthodonticPatient && !currentTags.includes('ortodontia')) {
        currentTags.push('ortodontia');
        updateData.tags = currentTags;
      }
      if (isOrthodonticPatient && !patient.orthodonticStartDate) {
        updateData.orthodonticStartDate = new Date();
      }
    }

    const [updated] = await db
      .update(patients)
      .set(updateData)
      .where(eq(patients.id, resolvedPatientId))
      .returning();

    res.json({
      success: true,
      message: 'Tags atualizadas com sucesso',
      patient: {
        id: updated.id,
        fullName: updated.fullName,
        tags: updated.tags,
        isOrthodonticPatient: updated.isOrthodonticPatient,
      },
    });
  })
);

// ==========================================
// FERRAMENTA 12: HUMAN TAKEOVER
// ==========================================

/**
 * POST /api/v1/n8n/tools/human-takeover
 * Registra que a conversa precisa de atendimento humano
 */
router.post(
  '/human-takeover',
  n8nAuth,
  asyncHandler(async (req, res) => {
    const { phone, reason, patientName, conversationSummary, priority } = req.body;
    const companyId = getCompanyId(req, req.body);

    if (!companyId || !phone) {
      return res.status(400).json({
        success: false,
        error: 'companyId and phone are required'
      });
    }

    // Buscar config para notificar admin
    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    const adminPhone = settings?.adminWhatsappPhone;
    const clinicName = settings?.name || 'Clínica';

    // Log do human takeover (pode ser salvo em tabela específica)
    console.log(`[HUMAN TAKEOVER] Company ${companyId} - Phone: ${phone} - Reason: ${reason}`);

    res.json({
      success: true,
      message: 'Human takeover registrado',
      data: {
        companyId,
        phone,
        patientName,
        reason,
        priority: priority || 'normal',
        adminPhone: adminPhone || 'Não configurado',
        clinicName,
        timestamp: new Date().toISOString(),
        // Mensagem sugerida para o paciente
        patientMessage: `Obrigado pelo contato! Um de nossos atendentes da ${clinicName} irá responder em breve.`,
        // Mensagem sugerida para notificar admin
        adminNotification: `🚨 *Atendimento Humano Solicitado*\n\n📱 Paciente: ${patientName || 'Não identificado'}\n📞 Telefone: ${phone}\n📝 Motivo: ${reason || 'Não especificado'}\n⏰ ${new Date().toLocaleString('pt-BR')}`,
      },
    });
  })
);

// ==========================================
// FERRAMENTA 13: REAGENDAR ORTODONTIA
// ==========================================

/**
 * POST /api/v1/n8n/tools/reschedule-orthodontic
 * Reagenda automaticamente manutenção ortodôntica
 */
router.post(
  '/reschedule-orthodontic',
  n8nAuth,
  asyncHandler(async (req, res) => {
    const { patientId, patientPhone, preferredDate, preferredTime } = req.body;
    const companyId = getCompanyId(req, req.body);

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'companyId is required' });
    }

    // Resolver patientId
    let resolvedPatientId = patientId;
    if (!resolvedPatientId && patientPhone) {
      const normalizedPhone = patientPhone.replace(/\D/g, '');
      const [patient] = await db
        .select({ id: patients.id })
        .from(patients)
        .where(
          and(
            eq(patients.companyId, companyId),
            or(
              like(patients.phone, `%${normalizedPhone}%`),
              like(patients.cellphone, `%${normalizedPhone}%`),
              like(patients.whatsappPhone, `%${normalizedPhone}%`)
            )
          )
        )
        .limit(1);

      if (patient) resolvedPatientId = patient.id;
    }

    if (!resolvedPatientId) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    // Buscar paciente
    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, resolvedPatientId))
      .limit(1);

    if (!patient || !patient.isOrthodonticPatient) {
      return res.status(400).json({
        success: false,
        error: 'Patient is not marked as orthodontic'
      });
    }

    // Calcular data sugerida
    const intervalDays = patient.recurringIntervalDays || 30;
    let targetDate: Date;

    if (preferredDate) {
      targetDate = new Date(preferredDate);
    } else if (patient.lastVisit) {
      targetDate = new Date(patient.lastVisit);
      targetDate.setDate(targetDate.getDate() + intervalDays);
    } else {
      targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + intervalDays);
    }

    // Ajustar para dia preferido da semana se configurado
    if (patient.preferredDayOfWeek !== null) {
      while (targetDate.getDay() !== patient.preferredDayOfWeek) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
    }

    // Buscar horários disponíveis no dia
    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    const slotDuration = settings?.slotDurationMinutes || 30;

    // Determinar horário preferido
    let preferredHour = 9;
    if (preferredTime) {
      preferredHour = parseInt(preferredTime.split(':')[0]);
    } else if (patient.preferredTimeSlot === 'morning') {
      preferredHour = 9;
    } else if (patient.preferredTimeSlot === 'afternoon') {
      preferredHour = 14;
    } else if (patient.preferredTimeSlot === 'evening') {
      preferredHour = 17;
    }

    const startTime = new Date(targetDate);
    startTime.setHours(preferredHour, 0, 0, 0);

    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + slotDuration);

    // Verificar conflitos
    const conflicts = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.companyId, companyId),
          or(
            eq(appointments.status, 'scheduled'),
            eq(appointments.status, 'confirmed')
          ),
          sql`${appointments.startTime} < ${endTime} AND ${appointments.endTime} > ${startTime}`
        )
      );

    if (conflicts.length > 0) {
      // Tentar próximo slot
      startTime.setMinutes(startTime.getMinutes() + slotDuration);
      endTime.setMinutes(endTime.getMinutes() + slotDuration);
    }

    // Criar agendamento
    const [newAppointment] = await db
      .insert(appointments)
      .values({
        companyId,
        patientId: resolvedPatientId,
        title: `Manutenção Ortodôntica - ${patient.fullName}`,
        startTime,
        endTime,
        status: 'scheduled',
        type: 'appointment',
        recurring: true,
        recurrencePattern: 'monthly',
        automationEnabled: true,
        automationStatus: 'pending',
      })
      .returning();

    // Atualizar paciente
    await db
      .update(patients)
      .set({
        nextRecurringAppointment: startTime,
        updatedAt: new Date(),
      })
      .where(eq(patients.id, resolvedPatientId));

    res.json({
      success: true,
      message: 'Manutenção ortodôntica reagendada com sucesso',
      appointment: {
        id: newAppointment.id,
        title: newAppointment.title,
        startTime: newAppointment.startTime,
        endTime: newAppointment.endTime,
        dataFormatada: new Date(newAppointment.startTime).toLocaleDateString('pt-BR'),
        horaFormatada: new Date(newAppointment.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      },
      patient: {
        id: patient.id,
        fullName: patient.fullName,
        intervalDays,
      },
    });
  })
);

// ==========================================
// FERRAMENTA 14: CONFIG DE ESTILO DE CONVERSA
// ==========================================

/**
 * GET /api/v1/n8n/tools/conversation-style
 * Retorna configurações de estilo de conversa da clínica
 */
router.get(
  '/conversation-style',
  n8nAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'companyId is required' });
    }

    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    if (!settings) {
      return res.status(404).json({ success: false, error: 'Company settings not found' });
    }

    // Montar config de estilo
    const styleConfig: ConversationStyleConfig = {
      conversationStyle: (settings.conversationStyle as 'menu' | 'humanized') || 'menu',
      botPersonality: (settings.botPersonality as 'professional' | 'friendly' | 'casual') || 'professional',
      botName: settings.botName || 'Assistente',
      useEmojis: settings.useEmojis ?? true,
      greetingStyle: (settings.greetingStyle as 'time_based' | 'simple') || 'time_based',
      customGreetingMorning: settings.customGreetingMorning || undefined,
      customGreetingAfternoon: settings.customGreetingAfternoon || undefined,
      customGreetingEvening: settings.customGreetingEvening || undefined,
      companyName: settings.name || 'Clínica',
      humanizedPromptContext: settings.humanizedPromptContext || undefined,
    };

    res.json({
      success: true,
      styleConfig,
      currentGreeting: getGreeting(styleConfig),
    });
  })
);

// ==========================================
// FERRAMENTA 15: GERAR RESPOSTA FORMATADA
// ==========================================

const generateResponseSchema = z.object({
  companyId: z.number().optional(),
  intent: z.enum([
    'GREETING',
    'SCHEDULE',
    'APPOINTMENT_CREATED',
    'CONFIRMED',
    'GOODBYE',
    'EMERGENCY',
    'FALLBACK',
    'AI_PROMPT',
  ]),
  context: z.object({
    patientName: z.string().optional(),
    patientFound: z.boolean().default(false),
    isOrthodontic: z.boolean().optional(),
    lastIntent: z.string().optional(),
  }).optional(),
  data: z.record(z.any()).optional(), // Dados específicos por intent
});

/**
 * POST /api/v1/n8n/tools/generate-response
 * Gera resposta formatada baseada no estilo da clínica
 *
 * Intents:
 * - GREETING: Saudação inicial
 * - SCHEDULE: Mostrar horários disponíveis (data.slots)
 * - APPOINTMENT_CREATED: Agendamento criado (data.appointment)
 * - CONFIRMED: Agendamento confirmado
 * - GOODBYE: Despedida
 * - EMERGENCY: Emergência (data.clinicPhone)
 * - FALLBACK: Não entendeu
 * - AI_PROMPT: Gerar prompt para AI (data.message)
 */
router.post(
  '/generate-response',
  n8nAuth,
  validate({ body: generateResponseSchema }),
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req, req.body);
    const { intent, context, data } = req.body;

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'companyId is required' });
    }

    // Buscar configurações da clínica
    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    if (!settings) {
      return res.status(404).json({ success: false, error: 'Company settings not found' });
    }

    // Montar config de estilo
    const styleConfig: ConversationStyleConfig = {
      conversationStyle: (settings.conversationStyle as 'menu' | 'humanized') || 'menu',
      botPersonality: (settings.botPersonality as 'professional' | 'friendly' | 'casual') || 'professional',
      botName: settings.botName || 'Assistente',
      useEmojis: settings.useEmojis ?? true,
      greetingStyle: (settings.greetingStyle as 'time_based' | 'simple') || 'time_based',
      customGreetingMorning: settings.customGreetingMorning || undefined,
      customGreetingAfternoon: settings.customGreetingAfternoon || undefined,
      customGreetingEvening: settings.customGreetingEvening || undefined,
      companyName: settings.name || 'Clínica',
      humanizedPromptContext: settings.humanizedPromptContext || undefined,
    };

    // Contexto da conversa
    const conversationContext: ConversationContext = {
      patientName: context?.patientName,
      patientFound: context?.patientFound ?? false,
      isOrthodontic: context?.isOrthodontic,
      lastIntent: context?.lastIntent,
    };

    let response = '';

    switch (intent) {
      case 'GREETING':
        response = generateGreetingResponse(styleConfig, conversationContext);
        break;

      case 'SCHEDULE':
        if (!data?.slots || !Array.isArray(data.slots)) {
          return res.status(400).json({
            success: false,
            error: 'data.slots is required for SCHEDULE intent',
          });
        }
        response = generateScheduleResponse(styleConfig, conversationContext, data.slots);
        break;

      case 'APPOINTMENT_CREATED':
        if (!data?.appointment) {
          return res.status(400).json({
            success: false,
            error: 'data.appointment is required for APPOINTMENT_CREATED intent',
          });
        }
        response = generateAppointmentCreatedResponse(styleConfig, conversationContext, {
          dataFormatada: data.appointment.dataFormatada,
          horaFormatada: data.appointment.horaFormatada,
        });
        break;

      case 'CONFIRMED':
        response = generateConfirmedResponse(styleConfig, conversationContext);
        break;

      case 'GOODBYE':
        response = generateGoodbyeResponse(styleConfig, conversationContext);
        break;

      case 'EMERGENCY':
        response = generateEmergencyResponse(
          styleConfig,
          conversationContext,
          data?.clinicPhone || settings.phone
        );
        break;

      case 'FALLBACK':
        response = generateFallbackResponse(styleConfig, conversationContext);
        break;

      case 'AI_PROMPT':
        if (!data?.message) {
          return res.status(400).json({
            success: false,
            error: 'data.message is required for AI_PROMPT intent',
          });
        }
        response = generateHumanizedAIPrompt(styleConfig, conversationContext, data.message);
        break;

      default:
        response = generateFallbackResponse(styleConfig, conversationContext);
    }

    res.json({
      success: true,
      intent,
      styleUsed: styleConfig.conversationStyle,
      personality: styleConfig.botPersonality,
      response,
      // Meta info para debug
      meta: {
        companyId,
        patientName: conversationContext.patientName,
        usedEmojis: styleConfig.useEmojis,
        greetingStyle: styleConfig.greetingStyle,
      },
    });
  })
);

// ==========================================
// FERRAMENTA 16: CLASSIFICAR INTENT (REGEX)
// ==========================================

/**
 * POST /api/v1/n8n/tools/classify-intent
 * Classifica a mensagem do usuário usando regex (sem AI)
 */
router.post(
  '/classify-intent',
  n8nAuth,
  asyncHandler(async (req, res) => {
    const { message, currentAwaitingResponse } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'message is required' });
    }

    const text = message.toLowerCase().trim();

    // Se está aguardando resposta específica, verificar contexto
    if (currentAwaitingResponse) {
      // Respostas afirmativas
      if (/^(sim|s|yes|ok|confirmo?|isso|isso mesmo|perfeito|certo|fechado|blz|beleza|pode ser|positivo)$/i.test(text)) {
        return res.json({
          success: true,
          intent: 'CONFIRM_CONTEXT',
          confidence: 0.95,
          awaitingResponse: currentAwaitingResponse,
          message: text,
        });
      }
      // Respostas negativas
      if (/^(não|nao|n|no|cancela|outro|nope|negativo)$/i.test(text)) {
        return res.json({
          success: true,
          intent: 'CANCEL_CONTEXT',
          confidence: 0.95,
          awaitingResponse: currentAwaitingResponse,
          message: text,
        });
      }
    }

    // Padrões de intent
    const intentPatterns: Array<{
      intent: string;
      patterns: RegExp[];
      priority: number;
    }> = [
      // Emergência (alta prioridade)
      {
        intent: 'EMERGENCY',
        patterns: [
          /urgente|emergencia|emerge?ncia|dor\s*(forte|intensa|muita)|sangr(ando|amento)|inchaço|inchaco|acidente|quebr(ei|ou)|caiu?\s*(dente|obturaç)|abscess?o/i,
        ],
        priority: 100,
      },
      // Human takeover explícito
      {
        intent: 'HUMAN_TAKEOVER',
        patterns: [
          /falar\s*(com)?\s*(uma?\s*)?(pessoa|humano|atendente|funcionario|recepcionista)|atendimento\s*humano|quero\s*falar|preciso\s*falar/i,
        ],
        priority: 90,
      },
      // Feedback negativo
      {
        intent: 'FEEDBACK_NEGATIVE',
        patterns: [
          /reclamaç|reclamo|insatisf|problema|péssim|pessim|horr[íi]vel|muito\s*ruim|não\s*gostei|decep/i,
        ],
        priority: 85,
      },
      // Saudação
      {
        intent: 'GREETING',
        patterns: [
          /^(oi|olá|ola|hey|e\s*a[íi]|opa|bom\s*dia|boa\s*tarde|boa\s*noite|eae|fala|tudo\s*bem|td\s*bem|como\s*vai|salve|alou)[!?\s,.]*$/i,
        ],
        priority: 80,
      },
      // Despedida
      {
        intent: 'GOODBYE',
        patterns: [
          /^(tchau|xau|até|ate|adeus|vlw|valeu|falou|flw|brigad[oa]|obrigad[oa]|thanks|bye)[!?\s,.]*$/i,
        ],
        priority: 75,
      },
      // Confirmar
      {
        intent: 'CONFIRM',
        patterns: [
          /^(sim|s|yes|ok|confirmo?|isso|isso\s*mesmo|perfeito|certo|fechado|blz|beleza|pode\s*ser|positivo|tá\s*bom|ta\s*bom)[!?\s,.]*$/i,
          /confirm(ar|o|a)\s*(consulta|agendamento|horário|horario)?/i,
        ],
        priority: 70,
      },
      // Cancelar
      {
        intent: 'CANCEL',
        patterns: [
          /cancel(ar|o|ei|a)|desmarc(ar|o|a|uei)|não\s*(vou|posso|consigo)\s*(ir|comparecer)/i,
        ],
        priority: 70,
      },
      // Reagendar
      {
        intent: 'RESCHEDULE',
        patterns: [
          /reag(endar|endo)|remarc(ar|o|a)|mud(ar|o|a)\s*(horário|horario|data)|outro\s*(dia|horário|horario)|trocar\s*(horário|horario|data)/i,
        ],
        priority: 65,
      },
      // Agendar
      {
        intent: 'SCHEDULE',
        patterns: [
          /agend(ar|o|a|amento)|marc(ar|o|a)|horário|horario|disponível|disponivel|vag(a|as)|atend(er|imento)|consult(a|ar)|quero\s*marcar|preciso\s*(marcar|agendar)/i,
        ],
        priority: 60,
      },
      // Ortodontia
      {
        intent: 'ORTHODONTIC',
        patterns: [
          /orto(dontia|dontico)?|aparelho|manutenç|manutencao|ajust(e|ar)|trocar\s*(borracha|ligadura|elástico)/i,
        ],
        priority: 55,
      },
      // Ver agendamentos
      {
        intent: 'VIEW_APPOINTMENTS',
        patterns: [
          /meu(s)?\s*(agendamento|consulta|horário)|quando\s*(é|e|tenho)|próxim[oa]\s*consult|ver\s*(minha|meus)\s*(consulta|agendamento)/i,
        ],
        priority: 50,
      },
      // Info horários
      {
        intent: 'INFO_HOURS',
        patterns: [
          /horário\s*(de)?\s*funcionamento|que\s*horas?\s*(abre|fecha|funciona)|hora\s*de\s*(abrir|fechar)|aberto|fechado/i,
        ],
        priority: 45,
      },
      // Info endereço
      {
        intent: 'INFO_ADDRESS',
        patterns: [
          /endereço|endereco|onde\s*(fica|é|localiza)|localização|localizacao|como\s*(chego|chegar)|mapa/i,
        ],
        priority: 45,
      },
      // Info preço
      {
        intent: 'INFO_PRICE',
        patterns: [
          /preço|preco|valor|quanto\s*custa|custo|orçamento|orcamento|tabela\s*de\s*preços?/i,
        ],
        priority: 45,
      },
      // Info procedimentos
      {
        intent: 'INFO_PROCEDURES',
        patterns: [
          /procedimento|tratamento|serviço|servico|o\s*que\s*(vocês|voces)\s*fazem|especialidade/i,
        ],
        priority: 45,
      },
      // Feedback positivo
      {
        intent: 'FEEDBACK_POSITIVE',
        patterns: [
          /obrigad[oa]|muito\s*bom|excelente|ótimo|otimo|perfeito|adorei|amei|maravilh|parabéns|parabens|recomend/i,
        ],
        priority: 40,
      },
      // Seleção de número (menu)
      {
        intent: 'MENU_SELECTION',
        patterns: [
          /^[1-9]$/,
          /^opç[aã]o\s*[1-9]$/i,
        ],
        priority: 35,
      },
    ];

    // Buscar melhor match
    let bestMatch = {
      intent: 'UNKNOWN',
      confidence: 0,
      matchedPattern: '',
    };

    for (const { intent, patterns, priority } of intentPatterns) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          const confidence = priority / 100;
          if (confidence > bestMatch.confidence) {
            bestMatch = {
              intent,
              confidence,
              matchedPattern: pattern.source,
            };
          }
          break; // Pular para próximo intent após match
        }
      }
    }

    res.json({
      success: true,
      intent: bestMatch.intent,
      confidence: bestMatch.confidence,
      matchedPattern: bestMatch.matchedPattern,
      originalMessage: message,
      requiresAI: bestMatch.intent === 'UNKNOWN',
    });
  })
);

// ==========================================
// FERRAMENTA 17: PROCESSAMENTO INTELIGENTE COM DEBOUNCE
// ==========================================

/**
 * POST /api/v1/n8n/tools/smart-process
 *
 * Processa mensagem de forma inteligente:
 * 1. Adiciona ao buffer de mensagens
 * 2. Aguarda 5s para ver se vem mais mensagens
 * 3. Combina mensagens e classifica intent
 * 4. Gera resposta apropriada (menu só na primeira saudação)
 *
 * Body:
 * - companyId: ID da empresa
 * - phone: Telefone do cliente
 * - message: Texto da mensagem
 * - isFirstMessage: É a primeira mensagem da sessão?
 * - patientName: Nome do paciente (se conhecido)
 * - patientFound: Paciente foi encontrado no banco?
 * - isOrthodontic: É paciente de ortodontia?
 * - currentAwaitingResponse: Estado atual de espera (se houver)
 */
router.post(
  '/smart-process',
  n8nAuth,
  asyncHandler(async (req, res) => {
    const {
      phone,
      message,
      isFirstMessage,
      patientName,
      patientFound,
      isOrthodontic,
      currentAwaitingResponse,
    } = req.body;
    const companyId = getCompanyId(req, req.body);

    if (!companyId || !phone || !message) {
      return res.status(400).json({
        success: false,
        error: 'companyId, phone and message are required',
      });
    }

    const bufferKey = `${companyId}:${phone}`;

    // Buscar configurações da clínica
    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    if (!settings) {
      return res.status(404).json({ success: false, error: 'Company settings not found' });
    }

    // Montar config de estilo (estendida com regras de negócio)
    const styleConfig: ExtendedConversationConfig = {
      conversationStyle: (settings.conversationStyle as 'menu' | 'humanized') || 'menu',
      botPersonality: (settings.botPersonality as 'professional' | 'friendly' | 'casual') || 'professional',
      botName: settings.botName || 'Assistente',
      useEmojis: settings.useEmojis ?? true,
      greetingStyle: (settings.greetingStyle as 'time_based' | 'simple') || 'time_based',
      customGreetingMorning: settings.customGreetingMorning || undefined,
      customGreetingAfternoon: settings.customGreetingAfternoon || undefined,
      customGreetingEvening: settings.customGreetingEvening || undefined,
      companyName: settings.name || 'Clínica',
      humanizedPromptContext: settings.humanizedPromptContext || undefined,
      // Regras de negócio
      priceDisclosurePolicy: (settings.priceDisclosurePolicy as 'always' | 'never_chat' | 'only_general') || 'always',
      schedulingPolicy: (settings.schedulingPolicy as 'immediate' | 'appointment_required' | 'callback') || 'immediate',
      clinicPhone: settings.phone || undefined,
    };

    // Verificar se já existe buffer para esse telefone
    let buffer = messageBuffers.get(bufferKey);

    if (!buffer) {
      buffer = {
        messages: [],
        isFirstMessage: isFirstMessage ?? true,
      };
      messageBuffers.set(bufferKey, buffer);
    }

    // Adicionar mensagem ao buffer
    buffer.messages.push({
      text: message,
      timestamp: new Date(),
    });

    // Cancelar timeout anterior se existir
    if (buffer.timeoutId) {
      clearTimeout(buffer.timeoutId);
    }

    // Classificar intent imediatamente para decidir se precisa esperar
    const quickClassify = smartClassifyIntent(message);

    // Não esperar para mensagens urgentes ou específicas
    const noWaitIntents = ['EMERGENCY', 'HUMAN_TAKEOVER', 'COMPLAINT', 'CONFIRM', 'DENY', 'CANCEL'];

    if (noWaitIntents.includes(quickClassify.intent) || currentAwaitingResponse) {
      // Processar imediatamente
      const combinedText = buffer.messages.map(m => m.text).join(' ').trim();
      const classification = smartClassifyIntent(combinedText);

      // Determinar se deve mostrar menu
      // Menu só na PRIMEIRA saudação da sessão
      const shouldShowMenu = buffer.isFirstMessage && classification.intent === 'GREETING';

      const context: ConversationContext & { isFirstMessage?: boolean } = {
        patientName,
        patientFound: patientFound ?? false,
        isOrthodontic,
        lastIntent: currentAwaitingResponse,
        isFirstMessage: buffer.isFirstMessage,
      };

      const smartResponse = generateSmartResponse(styleConfig, context, {
        combinedText,
        messageCount: buffer.messages.length,
        shouldShowMenu,
        intent: classification.intent,
        confidence: classification.confidence,
      });

      // Limpar buffer
      messageBuffers.delete(bufferKey);

      return res.json({
        success: true,
        processed: true,
        waited: false,
        waitMs: 0,
        messageCount: buffer.messages.length,
        combinedText,
        intent: classification.intent,
        confidence: classification.confidence,
        entities: classification.entities,
        shouldShowMenu,
        response: smartResponse.text,
        awaitingResponse: smartResponse.awaitingResponse,
        requiresAI: classification.intent === 'UNKNOWN',
        styleUsed: styleConfig.conversationStyle,
        personality: styleConfig.botPersonality,
      });
    }

    // Para outros casos, retornar que deve esperar
    // O N8N deve chamar /smart-process-complete após o delay
    res.json({
      success: true,
      processed: false,
      waited: false,
      waitMs: DEBOUNCE_MS,
      messageCount: buffer.messages.length,
      message: `Aguardando ${DEBOUNCE_MS / 1000}s para mais mensagens`,
      hint: `Chame POST /smart-process-complete após ${DEBOUNCE_MS}ms`,
    });
  })
);

// ==========================================
// FERRAMENTA 18: COMPLETAR PROCESSAMENTO APÓS DEBOUNCE
// ==========================================

/**
 * POST /api/v1/n8n/tools/smart-process-complete
 *
 * Chamado pelo N8N após o delay de debounce
 * Processa todas as mensagens acumuladas no buffer
 */
router.post(
  '/smart-process-complete',
  n8nAuth,
  asyncHandler(async (req, res) => {
    const { phone, patientName, patientFound, isOrthodontic, currentAwaitingResponse } = req.body;
    const companyId = getCompanyId(req, req.body);

    if (!companyId || !phone) {
      return res.status(400).json({
        success: false,
        error: 'companyId and phone are required',
      });
    }

    const bufferKey = `${companyId}:${phone}`;
    const buffer = messageBuffers.get(bufferKey);

    if (!buffer || buffer.messages.length === 0) {
      return res.json({
        success: true,
        processed: false,
        message: 'Nenhuma mensagem no buffer',
      });
    }

    // Buscar configurações da clínica
    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    if (!settings) {
      messageBuffers.delete(bufferKey);
      return res.status(404).json({ success: false, error: 'Company settings not found' });
    }

    // Montar config de estilo (estendida com regras de negócio)
    const styleConfig: ExtendedConversationConfig = {
      conversationStyle: (settings.conversationStyle as 'menu' | 'humanized') || 'menu',
      botPersonality: (settings.botPersonality as 'professional' | 'friendly' | 'casual') || 'professional',
      botName: settings.botName || 'Assistente',
      useEmojis: settings.useEmojis ?? true,
      greetingStyle: (settings.greetingStyle as 'time_based' | 'simple') || 'time_based',
      customGreetingMorning: settings.customGreetingMorning || undefined,
      customGreetingAfternoon: settings.customGreetingAfternoon || undefined,
      customGreetingEvening: settings.customGreetingEvening || undefined,
      companyName: settings.name || 'Clínica',
      humanizedPromptContext: settings.humanizedPromptContext || undefined,
      // Regras de negócio
      priceDisclosurePolicy: (settings.priceDisclosurePolicy as 'always' | 'never_chat' | 'only_general') || 'always',
      schedulingPolicy: (settings.schedulingPolicy as 'immediate' | 'appointment_required' | 'callback') || 'immediate',
      clinicPhone: settings.phone || undefined,
    };

    // Combinar todas as mensagens
    const combinedText = buffer.messages.map(m => m.text).join(' ').trim();
    const messageCount = buffer.messages.length;
    const isFirstMessage = buffer.isFirstMessage;

    // Classificar intent
    const classification = smartClassifyIntent(combinedText);

    // Menu só na PRIMEIRA saudação da sessão
    const shouldShowMenu = isFirstMessage && classification.intent === 'GREETING';

    const context: ConversationContext & { isFirstMessage?: boolean } = {
      patientName,
      patientFound: patientFound ?? false,
      isOrthodontic,
      lastIntent: currentAwaitingResponse,
      isFirstMessage,
    };

    const smartResponse = generateSmartResponse(styleConfig, context, {
      combinedText,
      messageCount,
      shouldShowMenu,
      intent: classification.intent,
      confidence: classification.confidence,
    });

    // Limpar buffer
    messageBuffers.delete(bufferKey);

    res.json({
      success: true,
      processed: true,
      waited: true,
      waitMs: DEBOUNCE_MS,
      messageCount,
      combinedText,
      intent: classification.intent,
      confidence: classification.confidence,
      entities: classification.entities,
      shouldShowMenu,
      response: smartResponse.text,
      awaitingResponse: smartResponse.awaitingResponse,
      requiresAI: classification.intent === 'UNKNOWN',
      styleUsed: styleConfig.conversationStyle,
      personality: styleConfig.botPersonality,
    });
  })
);

// ==========================================
// FERRAMENTA 19: ADICIONAR MENSAGEM AO BUFFER
// ==========================================

/**
 * POST /api/v1/n8n/tools/smart-add-message
 *
 * Adiciona mensagem ao buffer sem processar
 * Útil quando chega uma mensagem enquanto o timer ainda está rodando
 */
router.post(
  '/smart-add-message',
  n8nAuth,
  asyncHandler(async (req, res) => {
    const { phone, message, isFirstMessage } = req.body;
    const companyId = getCompanyId(req, req.body);

    if (!companyId || !phone || !message) {
      return res.status(400).json({
        success: false,
        error: 'companyId, phone and message are required',
      });
    }

    const bufferKey = `${companyId}:${phone}`;
    let buffer = messageBuffers.get(bufferKey);

    if (!buffer) {
      buffer = {
        messages: [],
        isFirstMessage: isFirstMessage ?? true,
      };
      messageBuffers.set(bufferKey, buffer);
    }

    // Adicionar mensagem ao buffer
    buffer.messages.push({
      text: message,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      added: true,
      messageCount: buffer.messages.length,
      messages: buffer.messages.map(m => m.text),
    });
  })
);

// ==========================================
// FERRAMENTA 20: STATUS DO BUFFER
// ==========================================

/**
 * GET /api/v1/n8n/tools/smart-buffer-status
 *
 * Verifica status do buffer de mensagens
 */
router.get(
  '/smart-buffer-status',
  n8nAuth,
  asyncHandler(async (req, res) => {
    const phone = req.query.phone as string;
    const companyId = getCompanyId(req);

    if (!companyId || !phone) {
      return res.status(400).json({
        success: false,
        error: 'companyId and phone are required',
      });
    }

    const bufferKey = `${companyId}:${phone}`;
    const buffer = messageBuffers.get(bufferKey);

    res.json({
      success: true,
      hasBuffer: !!buffer,
      messageCount: buffer?.messages.length || 0,
      messages: buffer?.messages.map(m => m.text) || [],
      isFirstMessage: buffer?.isFirstMessage ?? null,
    });
  })
);

// ==========================================
// FERRAMENTA 21: LIMPAR BUFFER
// ==========================================

/**
 * DELETE /api/v1/n8n/tools/smart-buffer-clear
 *
 * Limpa buffer de mensagens
 */
router.delete(
  '/smart-buffer-clear',
  n8nAuth,
  asyncHandler(async (req, res) => {
    const phone = req.query.phone as string;
    const companyId = getCompanyId(req);

    if (!companyId || !phone) {
      return res.status(400).json({
        success: false,
        error: 'companyId and phone are required',
      });
    }

    const bufferKey = `${companyId}:${phone}`;
    const had = messageBuffers.has(bufferKey);
    messageBuffers.delete(bufferKey);

    res.json({
      success: true,
      cleared: had,
    });
  })
);

// ==========================================
// FERRAMENTA 22: CONTEXTO COMPLETO DA CLÍNICA
// ==========================================

/**
 * GET /api/v1/n8n/tools/clinic-context
 * Retorna contexto completo da clínica para o bot
 * Inclui: configurações, estilo, regras de negócio, especialidades
 */
router.get(
  '/clinic-context',
  n8nAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'companyId is required' });
    }

    // Buscar configurações completas
    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    if (!settings) {
      return res.status(404).json({ success: false, error: 'Company settings not found' });
    }

    // Buscar procedimentos disponíveis
    const procedureList = await db
      .select({
        id: procedures.id,
        name: procedures.name,
        category: procedures.category,
        price: procedures.price,
        duration: procedures.duration,
      })
      .from(procedures)
      .where(and(
        eq(procedures.companyId, companyId),
        eq(procedures.active, true)
      ));

    // Buscar profissionais
    const professionalList = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        speciality: users.speciality,
      })
      .from(users)
      .where(and(
        eq(users.companyId, companyId),
        eq(users.active, true),
        or(
          eq(users.role, 'dentist'),
          eq(users.role, 'admin')
        )
      ));

    // Buscar salas/consultórios
    const roomList = await db
      .select({
        id: rooms.id,
        name: rooms.name,
        active: rooms.active,
      })
      .from(rooms)
      .where(and(
        eq(rooms.companyId, companyId),
        eq(rooms.active, true)
      ));

    // Montar contexto completo
    const clinicContext = {
      // Informações básicas
      basicInfo: {
        companyId,
        name: settings.name,
        tradingName: settings.tradingName,
        phone: settings.phone,
        cellphone: settings.cellphone,
        address: settings.address ? `${settings.address}, ${settings.number || ''} - ${settings.neighborhood || ''}, ${settings.city || ''} - ${settings.state || ''}` : null,
        email: settings.email,
        googleMapsLink: settings.googleMapsLink,
        googleReviewLink: settings.googleReviewLink,
        emergencyPhone: settings.emergencyPhone,
      },

      // Estilo de conversa
      conversationStyle: {
        style: settings.conversationStyle || 'menu',
        personality: settings.botPersonality || 'professional',
        botName: settings.botName || 'Assistente',
        useEmojis: settings.useEmojis !== false,
        greetingStyle: settings.greetingStyle || 'time_based',
        customGreetingMorning: settings.customGreetingMorning,
        customGreetingAfternoon: settings.customGreetingAfternoon,
        customGreetingEvening: settings.customGreetingEvening,
        humanizedPromptContext: settings.humanizedPromptContext,
      },

      // Regras de negócio
      businessRules: {
        priceDisclosurePolicy: settings.priceDisclosurePolicy || 'always',
        schedulingPolicy: settings.schedulingPolicy || 'immediate',
        paymentMethods: settings.paymentMethods || ['pix', 'credit_card', 'debit_card', 'cash'],
        chatEnabled: settings.chatEnabled !== false,
      },

      // Estrutura da clínica
      clinicStructure: {
        clinicType: settings.clinicType || 'consultorio_individual',
        totalProfessionals: professionalList.length,
        totalRooms: roomList.length,
        servicesOffered: settings.servicesOffered || [],
        clinicContextForBot: settings.clinicContextForBot,
      },

      // Horários
      schedule: {
        openingTime: settings.openingTime,
        closingTime: settings.closingTime,
        timeZone: settings.timeZone || 'America/Sao_Paulo',
        slotDurationMinutes: settings.slotDurationMinutes || 30,
        appointmentBufferMinutes: settings.appointmentBufferMinutes || 0,
        workingHoursJson: settings.workingHoursJson,
      },

      // Mensagens automáticas
      messageTemplates: {
        welcome: settings.chatWelcomeMessage,
        fallback: settings.chatFallbackMessage,
        confirmation: settings.confirmationMessageTemplate,
        reminder: settings.reminderMessageTemplate,
        cancellation: settings.cancellationMessageTemplate,
        birthday: settings.birthdayMessageTemplate,
        reviewRequest: settings.reviewRequestTemplate,
      },

      // Dados para agendamento
      scheduling: {
        procedures: procedureList.map((p: typeof procedureList[0]) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          price: p.price,
          priceFormatted: `R$ ${((p.price || 0) / 100).toFixed(2)}`,
          duration: p.duration,
        })),
        professionals: professionalList,
        rooms: roomList,
      },

      // Meta informações
      meta: {
        timestamp: new Date().toISOString(),
        version: '2.0',
      },
    };

    // Gerar prompt de contexto para IA
    const aiContextPrompt = generateClinicContextPrompt(clinicContext);

    res.json({
      success: true,
      context: clinicContext,
      aiContextPrompt,
    });
  })
);

/**
 * Helper: Gera prompt de contexto da clínica para IA
 */
function generateClinicContextPrompt(context: any): string {
  const { basicInfo, conversationStyle, businessRules, clinicStructure, schedule, scheduling } = context;

  let prompt = `Você é ${conversationStyle.botName}, assistente virtual da clínica "${basicInfo.name}".

INFORMAÇÕES DA CLÍNICA:
- Nome: ${basicInfo.name}
- Telefone: ${basicInfo.phone || 'Não informado'}
- Endereço: ${basicInfo.address || 'Não informado'}
${basicInfo.googleMapsLink ? `- Google Maps: ${basicInfo.googleMapsLink}` : ''}

HORÁRIO DE FUNCIONAMENTO:
- ${schedule.openingTime || '08:00'} às ${schedule.closingTime || '18:00'}
- Consultas de ${schedule.slotDurationMinutes || 30} minutos

PERSONALIDADE: ${conversationStyle.personality === 'professional' ? 'Profissional e formal' : conversationStyle.personality === 'friendly' ? 'Amigável e simpático' : 'Casual e descontraído'}
${conversationStyle.useEmojis ? 'Use emojis moderadamente.' : 'NÃO use emojis.'}

REGRAS IMPORTANTES:`;

  // Regra de preços
  if (businessRules.priceDisclosurePolicy === 'never_chat') {
    prompt += `
- NÃO informe preços por mensagem. Diga que valores são informados presencialmente na clínica.`;
  } else if (businessRules.priceDisclosurePolicy === 'only_general') {
    prompt += `
- Pode informar faixas de valores gerais, mas detalhes só presencialmente.`;
  }

  // Procedimentos disponíveis
  if (scheduling.procedures.length > 0) {
    const categories = [...new Set(scheduling.procedures.map((p: any) => p.category))];
    prompt += `

SERVIÇOS OFERECIDOS:
${categories.map(cat => `- ${cat}`).join('\n')}`;
  }

  // Contexto personalizado
  if (conversationStyle.humanizedPromptContext) {
    prompt += `

CONTEXTO ADICIONAL:
${conversationStyle.humanizedPromptContext}`;
  }

  if (clinicStructure.clinicContextForBot) {
    prompt += `
${clinicStructure.clinicContextForBot}`;
  }

  prompt += `

INSTRUÇÕES:
1. Responda de forma curta e natural (máximo 3 frases)
2. Para agendamentos, pergunte preferência de data/horário
3. Se for urgência, demonstre empatia e priorize
4. Se não souber responder, passe para um atendente humano`;

  return prompt;
}

export default router;
