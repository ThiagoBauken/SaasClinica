/**
 * Automation Engine - Substitui N8N com lógica nativa
 *
 * Este serviço implementa todas as automações que antes eram feitas no N8N:
 * - Envio de WhatsApp (Wuzapi)
 * - Criação de eventos Google Calendar
 * - Disparos agendados (confirmação, lembrete, aniversário)
 * - Processamento de mensagens recebidas
 *
 * Vantagens sobre N8N:
 * - Sem dependência externa
 * - Menor latência
 * - Melhor error handling
 * - Logs unificados no banco
 * - Transações atômicas
 */

import { db } from '../db';
import { eq, and, gte, lte, lt, sql, desc, inArray, isNull } from 'drizzle-orm';
import {
  appointments,
  patients,
  users,
  companies,
  clinicSettings,
  automationLogs,
  adminPhones,
  reactivationLogs,
} from '@shared/schema';

// Tipos
export interface AutomationResult {
  success: boolean;
  action: string;
  whatsappMessageId?: string;
  googleCalendarEventId?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface WhatsAppMessage {
  phone: string;
  message: string;
  instanceId?: string;
}

export interface GoogleCalendarEvent {
  summary: string;
  description: string;
  startTime: string;
  endTime: string;
  calendarId?: string;
}

// Configuração
interface AutomationConfig {
  wuzapiBaseUrl: string;
  wuzapiApiKey: string;
  wuzapiInstanceId: string;
  googleCalendarEnabled: boolean;
  confirmationHoursBefore: number;
  reminderHoursBefore: number;
  feedbackHoursAfter: number;
}

/**
 * Classe principal do Automation Engine
 */
export class AutomationEngine {
  private companyId: number;
  private config: AutomationConfig | null = null;
  private company: any = null;

  constructor(companyId: number) {
    this.companyId = companyId;
  }

  /**
   * Inicializa o engine carregando configurações
   */
  async initialize(): Promise<void> {
    const [companyData] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, this.companyId))
      .limit(1);

    this.company = companyData;

    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, this.companyId))
      .limit(1);

    if (settings) {
      this.config = {
        wuzapiBaseUrl: settings.wuzapiBaseUrl || 'https://wuzapi.cloud/api/v2',
        wuzapiApiKey: settings.wuzapiApiKey || '',
        wuzapiInstanceId: settings.wuzapiInstanceId || '',
        googleCalendarEnabled: !!settings.defaultGoogleCalendarId,
        confirmationHoursBefore: settings.confirmationHoursBefore || 24,
        reminderHoursBefore: settings.reminderHoursBefore || 2,
        feedbackHoursAfter: settings.feedbackHoursAfter || 24,
      };
    }
  }

  /**
   * Log de automação no banco
   */
  private async log(
    action: string,
    status: 'success' | 'error' | 'pending',
    relatedId?: number,
    metadata?: Record<string, any>,
    errorMessage?: string
  ): Promise<void> {
    try {
      await db.insert(automationLogs).values({
        companyId: this.companyId,
        action,
        executionStatus: status,
        relatedId,
        payload: metadata,
        errorMessage,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('Erro ao salvar log de automação:', error);
    }
  }

  // ==================== WHATSAPP ====================

  /**
   * Envia mensagem WhatsApp via Wuzapi
   */
  async sendWhatsApp(message: WhatsAppMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.config?.wuzapiApiKey) {
      return { success: false, error: 'Wuzapi não configurado' };
    }

    try {
      const response = await fetch(`${this.config.wuzapiBaseUrl}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.wuzapiApiKey}`,
        },
        body: JSON.stringify({
          instance_id: message.instanceId || this.config.wuzapiInstanceId,
          phone: message.phone.replace(/[^\d]/g, ''),
          message: message.message,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Wuzapi error: ${response.status} - ${error}` };
      }

      const data = await response.json();
      return { success: true, messageId: data.messageId || data.id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Envia mensagem para múltiplos admin phones
   */
  async notifyAdmins(
    message: string,
    notificationType: string
  ): Promise<{ sent: number; failed: number }> {
    const admins = await db
      .select()
      .from(adminPhones)
      .where(
        and(
          eq(adminPhones.companyId, this.companyId),
          eq(adminPhones.isActive, true)
        )
      );

    // Filtrar por tipo de notificação usando campos booleanos
    type AdminPhone = typeof adminPhones.$inferSelect;
    const filtered = admins.filter((admin: AdminPhone) => {
      switch (notificationType) {
        case 'daily_report':
          return admin.receiveDailyReport;
        case 'urgency':
          return admin.receiveUrgencies;
        case 'new_appointment':
          return admin.receiveNewAppointments;
        case 'cancelled_appointment':
          return admin.receiveCancellations;
        default:
          return true; // Enviar para todos se tipo não reconhecido
      }
    });

    let sent = 0;
    let failed = 0;

    for (const admin of filtered) {
      const result = await this.sendWhatsApp({
        phone: admin.phone,
        message,
      });

      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    }

    return { sent, failed };
  }

  // ==================== TEMPLATES ====================

  /**
   * Interpola variáveis em um template
   */
  interpolateTemplate(template: string, variables: Record<string, any>): string {
    let result = template;

    // Variáveis padrão da empresa
    const defaultVars: Record<string, string> = {
      '{{company.name}}': this.company?.name || '',
      '{{company.phone}}': this.company?.phone || '',
      '{{company.address}}': this.company?.address || '',
      '{{company.email}}': this.company?.email || '',
    };

    // Mesclar com variáveis passadas
    const allVars = { ...defaultVars, ...variables };

    for (const [key, value] of Object.entries(allVars)) {
      const escapedKey = key.replace(/[{}]/g, '\\$&');
      result = result.replace(new RegExp(escapedKey, 'g'), String(value || ''));
    }

    return result;
  }

  /**
   * Formata data para exibição
   */
  formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }

  /**
   * Formata hora para exibição
   */
  formatTime(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // ==================== AUTOMAÇÕES DE AGENDAMENTO ====================

  /**
   * Processa criação de novo agendamento
   */
  async onAppointmentCreated(appointmentId: number): Promise<AutomationResult> {
    await this.initialize();

    try {
      // Buscar appointment com dados relacionados
      const [appointment] = await db
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.id, appointmentId),
            eq(appointments.companyId, this.companyId)
          )
        )
        .limit(1);

      if (!appointment) {
        return { success: false, action: 'appointment_created', error: 'Agendamento não encontrado' };
      }

      // Buscar paciente
      const [patient] = await db
        .select()
        .from(patients)
        .where(eq(patients.id, appointment.patientId!))
        .limit(1);

      // Buscar profissional
      const [professional] = await db
        .select()
        .from(users)
        .where(eq(users.id, appointment.professionalId!))
        .limit(1);

      // Gerar mensagem de confirmação
      const message = this.interpolateTemplate(
        `✅ *Agendamento Confirmado*

Olá {{patient.name}}!

Sua consulta foi agendada:

📅 *Data:* {{date}}
⏰ *Horário:* {{time}}
👨‍⚕️ *Profissional:* {{professional.name}}
🏥 *Procedimento:* {{procedure}}

📍 *Endereço:*
{{company.address}}

Responda *SIM* para confirmar ou *NÃO* para cancelar.

{{company.name}}`,
        {
          '{{patient.name}}': patient?.fullName || 'Paciente',
          '{{date}}': this.formatDate(appointment.startTime!),
          '{{time}}': this.formatTime(appointment.startTime!),
          '{{professional.name}}': professional?.fullName || '',
          '{{procedure}}': appointment.procedure || '',
        }
      );

      // Enviar WhatsApp
      const patientPhone = patient?.whatsappPhone || patient?.cellphone || patient?.phone;
      let whatsappResult: { success: boolean; messageId?: string; error?: string } = { success: false };

      if (patientPhone) {
        whatsappResult = await this.sendWhatsApp({
          phone: patientPhone,
          message,
        });
      }

      // Atualizar appointment com status de automação
      await db
        .update(appointments)
        .set({
          automationStatus: whatsappResult.success ? 'sent' : 'error',
          automationSentAt: new Date(),
          wuzapiMessageId: whatsappResult.messageId || null,
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, appointmentId));

      // Log
      await this.log(
        'appointment_created_automation',
        whatsappResult.success ? 'success' : 'error',
        appointmentId,
        {
          patientName: patient?.fullName,
          whatsappSent: whatsappResult.success,
          messageId: whatsappResult.messageId,
        },
        !whatsappResult.success ? whatsappResult.error : undefined
      );

      // Notificar admins
      await this.notifyAdmins(
        `📅 *Novo Agendamento*\n\nPaciente: ${patient?.fullName}\nData: ${this.formatDate(appointment.startTime!)} às ${this.formatTime(appointment.startTime!)}\nProcedimento: ${appointment.procedure}`,
        'new_appointment'
      );

      return {
        success: true,
        action: 'appointment_created',
        whatsappMessageId: whatsappResult.messageId,
        metadata: {
          patientName: patient?.fullName,
          appointmentDate: appointment.startTime,
        },
      };
    } catch (error: any) {
      await this.log('appointment_created_automation', 'error', appointmentId, {}, error.message);
      return { success: false, action: 'appointment_created', error: error.message };
    }
  }

  /**
   * Processa cancelamento de agendamento
   */
  async onAppointmentCancelled(
    appointmentId: number,
    reason?: string
  ): Promise<AutomationResult> {
    await this.initialize();

    try {
      const [appointment] = await db
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.id, appointmentId),
            eq(appointments.companyId, this.companyId)
          )
        )
        .limit(1);

      if (!appointment) {
        return { success: false, action: 'appointment_cancelled', error: 'Agendamento não encontrado' };
      }

      const [patient] = await db
        .select()
        .from(patients)
        .where(eq(patients.id, appointment.patientId!))
        .limit(1);

      const message = this.interpolateTemplate(
        `❌ *Consulta Cancelada*

Olá {{patient.name}},

Sua consulta foi cancelada:

📅 *Data:* {{date}}
⏰ *Horário:* {{time}}

*Motivo:* {{reason}}

Para reagendar, entre em contato:
📞 {{company.phone}}

{{company.name}}`,
        {
          '{{patient.name}}': patient?.fullName || 'Paciente',
          '{{date}}': this.formatDate(appointment.startTime!),
          '{{time}}': this.formatTime(appointment.startTime!),
          '{{reason}}': reason || 'Não informado',
        }
      );

      const patientPhone = patient?.whatsappPhone || patient?.cellphone || patient?.phone;
      let whatsappResult: { success: boolean; messageId?: string; error?: string } = { success: false };

      if (patientPhone) {
        whatsappResult = await this.sendWhatsApp({
          phone: patientPhone,
          message,
        });
      }

      await this.log(
        'appointment_cancelled_automation',
        whatsappResult.success ? 'success' : 'error',
        appointmentId,
        { patientName: patient?.fullName, reason },
        !whatsappResult.success ? whatsappResult.error : undefined
      );

      // Notificar admins
      await this.notifyAdmins(
        `❌ *Consulta Cancelada*\n\nPaciente: ${patient?.fullName}\nData: ${this.formatDate(appointment.startTime!)}\nMotivo: ${reason || 'Não informado'}`,
        'cancelled_appointment'
      );

      return {
        success: true,
        action: 'appointment_cancelled',
        whatsappMessageId: whatsappResult.messageId,
      };
    } catch (error: any) {
      await this.log('appointment_cancelled_automation', 'error', appointmentId, {}, error.message);
      return { success: false, action: 'appointment_cancelled', error: error.message };
    }
  }

  /**
   * Processa reagendamento
   */
  async onAppointmentRescheduled(
    appointmentId: number,
    oldStartTime: Date,
    newStartTime: Date
  ): Promise<AutomationResult> {
    await this.initialize();

    try {
      const [appointment] = await db
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.id, appointmentId),
            eq(appointments.companyId, this.companyId)
          )
        )
        .limit(1);

      if (!appointment) {
        return { success: false, action: 'appointment_rescheduled', error: 'Agendamento não encontrado' };
      }

      const [patient] = await db
        .select()
        .from(patients)
        .where(eq(patients.id, appointment.patientId!))
        .limit(1);

      const message = this.interpolateTemplate(
        `🔄 *Horário Alterado*

Olá {{patient.name}},

Sua consulta foi reagendada:

❌ *Horário anterior:*
📅 {{oldDate}}
⏰ {{oldTime}}

✅ *Novo horário:*
📅 {{newDate}}
⏰ {{newTime}}

Nos vemos no novo horário! 😊

{{company.name}}`,
        {
          '{{patient.name}}': patient?.fullName || 'Paciente',
          '{{oldDate}}': this.formatDate(oldStartTime),
          '{{oldTime}}': this.formatTime(oldStartTime),
          '{{newDate}}': this.formatDate(newStartTime),
          '{{newTime}}': this.formatTime(newStartTime),
        }
      );

      const patientPhone = patient?.whatsappPhone || patient?.cellphone || patient?.phone;
      let whatsappResult: { success: boolean; messageId?: string; error?: string } = { success: false };

      if (patientPhone) {
        whatsappResult = await this.sendWhatsApp({
          phone: patientPhone,
          message,
        });
      }

      await this.log(
        'appointment_rescheduled_automation',
        whatsappResult.success ? 'success' : 'error',
        appointmentId,
        {
          patientName: patient?.fullName,
          oldStartTime,
          newStartTime,
        },
        !whatsappResult.success ? whatsappResult.error : undefined
      );

      return {
        success: true,
        action: 'appointment_rescheduled',
        whatsappMessageId: whatsappResult.messageId,
      };
    } catch (error: any) {
      await this.log('appointment_rescheduled_automation', 'error', appointmentId, {}, error.message);
      return { success: false, action: 'appointment_rescheduled', error: error.message };
    }
  }

  // ==================== JOBS AGENDADOS ====================

  /**
   * Envia confirmações para agendamentos do próximo dia
   */
  async sendDailyConfirmations(): Promise<{ sent: number; failed: number }> {
    await this.initialize();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    // Buscar agendamentos de amanhã que ainda não foram confirmados
    const tomorrowAppointments = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.companyId, this.companyId),
          gte(appointments.startTime, tomorrow),
          lt(appointments.startTime, dayAfter),
          inArray(appointments.status, ['scheduled', 'pending']),
          eq(appointments.confirmedByPatient, false)
        )
      );

    let sent = 0;
    let failed = 0;

    for (const appointment of tomorrowAppointments) {
      try {
        const [patient] = await db
          .select()
          .from(patients)
          .where(eq(patients.id, appointment.patientId!))
          .limit(1);

        const message = this.interpolateTemplate(
          `📅 *Lembrete de Consulta*

Olá {{patient.name}}!

Sua consulta está marcada para *amanhã*:

📅 {{date}}
⏰ {{time}}
🏥 {{procedure}}

Você confirma sua presença?
Responda *SIM* ou *NÃO*

{{company.name}}`,
          {
            '{{patient.name}}': patient?.fullName || 'Paciente',
            '{{date}}': this.formatDate(appointment.startTime!),
            '{{time}}': this.formatTime(appointment.startTime!),
            '{{procedure}}': appointment.procedure || 'Consulta',
          }
        );

        const patientPhone = patient?.whatsappPhone || patient?.cellphone || patient?.phone;
        if (patientPhone) {
          const result = await this.sendWhatsApp({ phone: patientPhone, message });
          if (result.success) {
            sent++;
            await db
              .update(appointments)
              .set({
                confirmationMessageId: result.messageId,
                confirmationSentAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(appointments.id, appointment.id));
          } else {
            failed++;
          }
        }
      } catch (error) {
        failed++;
      }
    }

    await this.log('daily_confirmations', 'success', undefined, { sent, failed, total: tomorrowAppointments.length });

    return { sent, failed };
  }

  /**
   * Envia resumo diário para administradores
   */
  async sendDailySummary(): Promise<AutomationResult> {
    await this.initialize();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Buscar agendamentos do dia
    const todayAppointments = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.companyId, this.companyId),
          gte(appointments.startTime, today),
          lt(appointments.startTime, tomorrow)
        )
      )
      .orderBy(appointments.startTime);

    type Appointment = typeof appointments.$inferSelect;
    const total = todayAppointments.length;
    const confirmed = todayAppointments.filter((a: Appointment) => a.status === 'confirmed').length;
    const pending = todayAppointments.filter((a: Appointment) => a.status === 'scheduled').length;
    const cancelled = todayAppointments.filter((a: Appointment) => a.status === 'cancelled').length;

    // Montar lista de agendamentos
    let appointmentsList = '';
    const sorted = todayAppointments.slice(0, 10);

    for (let i = 0; i < sorted.length; i++) {
      const apt = sorted[i];
      const [patient] = await db
        .select()
        .from(patients)
        .where(eq(patients.id, apt.patientId!))
        .limit(1);

      const status = apt.status === 'confirmed' ? '✅' : apt.status === 'cancelled' ? '❌' : '⏳';
      appointmentsList += `${i + 1}. ${this.formatTime(apt.startTime!)} - ${patient?.fullName || 'Paciente'} ${status}\n`;
    }

    if (todayAppointments.length > 10) {
      appointmentsList += `\n... e mais ${todayAppointments.length - 10} agendamentos`;
    }

    const message = this.interpolateTemplate(
      `📋 *Resumo do Dia - {{company.name}}*

📅 ${this.formatDate(today)}

📊 *Totais:*
• Total: ${total} consultas
• Confirmadas: ${confirmed} ✅
• Pendentes: ${pending} ⏳
• Canceladas: ${cancelled} ❌

📝 *Agenda:*
${appointmentsList || 'Nenhum agendamento hoje'}

💙 Bom trabalho!`,
      {}
    );

    const { sent, failed } = await this.notifyAdmins(message, 'daily_summary');

    await this.log('daily_summary', 'success', undefined, { sent, failed, total });

    return {
      success: true,
      action: 'daily_summary',
      metadata: { sent, failed, totalAppointments: total },
    };
  }

  /**
   * Envia resumo diário individual para cada dentista com WhatsApp configurado
   * Cada dentista recebe apenas a SUA agenda do dia
   */
  async sendProfessionalDailySummaries(): Promise<{ sent: number; failed: number }> {
    await this.initialize();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Buscar todos os dentistas que têm WhatsApp configurado
    const professionals = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.companyId, this.companyId),
          eq(users.role, 'dentist'),
          eq(users.active, true)
        )
      );

    let sent = 0;
    let failed = 0;

    for (const professional of professionals) {
      // Só enviar se o dentista tem WhatsApp configurado
      if (!professional.wuzapiPhone) {
        continue;
      }

      // Buscar agendamentos do dia DESTE dentista
      const professionalAppointments = await db
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.companyId, this.companyId),
            eq(appointments.professionalId, professional.id),
            gte(appointments.startTime, today),
            lt(appointments.startTime, tomorrow)
          )
        )
        .orderBy(appointments.startTime);

      type Appointment = typeof appointments.$inferSelect;
      const total = professionalAppointments.length;
      const confirmed = professionalAppointments.filter((a: Appointment) => a.status === 'confirmed').length;
      const pending = professionalAppointments.filter((a: Appointment) => a.status === 'scheduled').length;

      // Se não tem agendamentos, não enviar
      if (total === 0) {
        continue;
      }

      // Montar lista de agendamentos
      let appointmentsList = '';
      for (let i = 0; i < professionalAppointments.length; i++) {
        const apt = professionalAppointments[i];
        const [patient] = await db
          .select()
          .from(patients)
          .where(eq(patients.id, apt.patientId!))
          .limit(1);

        const status = apt.status === 'confirmed' ? '✅' : apt.status === 'cancelled' ? '❌' : '⏳';
        appointmentsList += `${i + 1}. ${this.formatTime(apt.startTime!)} - ${patient?.fullName || 'Paciente'} (${apt.procedure || 'Consulta'}) ${status}\n`;
      }

      const message = this.interpolateTemplate(
        `☀️ *Bom dia, Dr(a). ${professional.fullName?.split(' ')[0]}!*

📋 *Sua agenda para hoje:*
📅 ${this.formatDate(today)}

📊 *Resumo:*
• Total: ${total} ${total === 1 ? 'paciente' : 'pacientes'}
• Confirmados: ${confirmed} ✅
• Pendentes: ${pending} ⏳

📝 *Horários:*
${appointmentsList}

💙 Tenha um ótimo dia de trabalho!
{{company.name}}`,
        {}
      );

      const result = await this.sendWhatsApp({
        phone: professional.wuzapiPhone,
        message,
      });

      if (result.success) {
        sent++;
      } else {
        failed++;
        console.error(`Erro ao enviar resumo para Dr(a). ${professional.fullName}:`, result.error);
      }
    }

    if (sent > 0 || failed > 0) {
      await this.log('professional_daily_summaries', 'success', undefined, { sent, failed });
    }

    return { sent, failed };
  }

  /**
   * Finaliza atendimentos do dia que já passaram
   */
  async finalizeCompletedAppointments(): Promise<{ finalized: number }> {
    await this.initialize();

    const now = new Date();

    // Buscar agendamentos confirmados que já passaram
    const pastAppointments = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.companyId, this.companyId),
          lt(appointments.endTime, now),
          inArray(appointments.status, ['confirmed', 'scheduled'])
        )
      );

    let finalized = 0;

    for (const appointment of pastAppointments) {
      await db
        .update(appointments)
        .set({
          status: 'completed',
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, appointment.id));
      finalized++;
    }

    if (finalized > 0) {
      await this.log('auto_finalize_appointments', 'success', undefined, { finalized });
    }

    return { finalized };
  }

  /**
   * Envia mensagens de aniversário
   */
  async sendBirthdayMessages(): Promise<{ sent: number }> {
    await this.initialize();

    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    // Buscar pacientes que fazem aniversário hoje
    const birthdayPatients = await db
      .select()
      .from(patients)
      .where(
        and(
          eq(patients.companyId, this.companyId),
          sql`EXTRACT(MONTH FROM ${patients.birthDate}) = ${month}`,
          sql`EXTRACT(DAY FROM ${patients.birthDate}) = ${day}`
        )
      );

    let sent = 0;

    for (const patient of birthdayPatients) {
      const message = this.interpolateTemplate(
        `🎂 *Feliz Aniversário!*

Olá {{patient.name}}!

A equipe da {{company.name}} deseja a você um dia muito especial e cheio de alegrias!

🎉 Parabéns pelo seu dia!

Com carinho,
{{company.name}}`,
        {
          '{{patient.name}}': patient.fullName || 'Paciente',
        }
      );

      const phone = patient.whatsappPhone || patient.cellphone || patient.phone;
      if (phone) {
        const result = await this.sendWhatsApp({ phone, message });
        if (result.success) sent++;
      }
    }

    if (sent > 0) {
      await this.log('birthday_messages', 'success', undefined, { sent, total: birthdayPatients.length });
    }

    return { sent };
  }

  /**
   * Envia mensagens de reativação para pacientes inativos
   * Períodos: 3, 6, 9 e 12 meses sem consulta
   */
  async sendReactivationMessages(): Promise<{ sent: number; byPeriod: Record<number, number> }> {
    await this.initialize();

    // Verificar se reativação está habilitada
    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, this.companyId))
      .limit(1);

    if (!settings?.reactivationEnabled) {
      return { sent: 0, byPeriod: {} };
    }

    const now = new Date();
    const byPeriod: Record<number, number> = { 3: 0, 6: 0, 9: 0, 12: 0 };
    let totalSent = 0;

    // Templates de mensagem por período (usa configurado ou default)
    const templates: Record<number, string> = {
      3: settings.reactivation3MonthsTemplate ||
        `Olá {{patient.name}}! 😊

Faz 3 meses que não nos vemos. Que tal agendar uma consulta de rotina?

A prevenção é o melhor tratamento! 🦷

Agende pelo WhatsApp ou ligue para {{company.phone}}

{{company.name}}`,

      6: settings.reactivation6MonthsTemplate ||
        `Olá {{patient.name}}!

Sua saúde bucal é muito importante para nós! Já se passaram 6 meses desde sua última visita.

🦷 Uma limpeza profissional é recomendada a cada 6 meses.

Vamos agendar sua consulta? Responda essa mensagem ou ligue para {{company.phone}}

{{company.name}}`,

      9: settings.reactivation9MonthsTemplate ||
        `Olá {{patient.name}}!

Sentimos sua falta! 💙 Já faz 9 meses desde seu último atendimento.

Lembre-se: cuidar dos dentes regularmente evita problemas maiores (e mais caros) no futuro.

Temos horários disponíveis! Quer que eu verifique a agenda?

{{company.name}}`,

      12: settings.reactivation12MonthsTemplate ||
        `Olá {{patient.name}}!

Faz 1 ano que não cuidamos do seu sorriso! 😊

⚠️ A prevenção é fundamental para evitar tratamentos complexos. Não deixe para depois!

Entre em contato conosco:
📞 {{company.phone}}

Esperamos você!
{{company.name}}`
    };

    // Processar cada período
    for (const period of [3, 6, 9, 12]) {
      const monthsAgo = new Date(now);
      monthsAgo.setMonth(monthsAgo.getMonth() - period);

      // Janela de 7 dias para cada período (não mandar exatamente no dia, mas na semana)
      const periodStart = new Date(monthsAgo);
      periodStart.setDate(periodStart.getDate() - 7);
      const periodEnd = new Date(monthsAgo);

      // Buscar pacientes que não consultam há X meses
      // E que têm consentimento de marketing/whatsapp
      // E que ainda não receberam mensagem para este período
      const inactivePatients = await db
        .select({
          patient: patients,
        })
        .from(patients)
        .leftJoin(
          reactivationLogs,
          and(
            eq(reactivationLogs.patientId, patients.id),
            eq(reactivationLogs.periodMonths, period),
            eq(reactivationLogs.companyId, this.companyId)
          )
        )
        .where(
          and(
            eq(patients.companyId, this.companyId),
            eq(patients.active, true),
            eq(patients.marketingConsent, true), // LGPD
            gte(patients.lastVisit, periodStart),
            lte(patients.lastVisit, periodEnd),
            isNull(reactivationLogs.id) // Ainda não enviou para este período
          )
        );

      for (const { patient } of inactivePatients) {
        const phone = patient.whatsappPhone || patient.cellphone || patient.phone;
        if (!phone) continue;

        const message = this.interpolateTemplate(templates[period], {
          '{{patient.name}}': patient.fullName?.split(' ')[0] || 'Paciente',
          '{{patient.fullname}}': patient.fullName || 'Paciente',
        });

        const result = await this.sendWhatsApp({ phone, message });

        // Registrar o envio (sucesso ou falha)
        await db.insert(reactivationLogs).values({
          companyId: this.companyId,
          patientId: patient.id,
          periodMonths: period,
          messageTemplate: templates[period],
          whatsappMessageId: result.messageId || null,
          status: result.success ? 'sent' : 'failed',
          errorMessage: !result.success ? 'Falha no envio' : null,
          patientLastVisit: patient.lastVisit,
        });

        if (result.success) {
          byPeriod[period]++;
          totalSent++;
        }
      }
    }

    if (totalSent > 0) {
      await this.log('reactivation_messages', 'success', undefined, {
        sent: totalSent,
        byPeriod
      });
    }

    return { sent: totalSent, byPeriod };
  }
}

// Factory
export function createAutomationEngine(companyId: number): AutomationEngine {
  return new AutomationEngine(companyId);
}

// ==================== JOB SCHEDULER ====================

import * as cron from 'node-cron';

const scheduledJobs: Map<string, cron.ScheduledTask> = new Map();

/**
 * Inicia os jobs agendados para uma empresa
 */
export async function startScheduledJobs(companyId: number): Promise<void> {
  const engine = createAutomationEngine(companyId);

  // Confirmações diárias - 18:00
  const confirmationJob = cron.schedule('0 18 * * *', async () => {
    console.log(`[${companyId}] Executando job de confirmações...`);
    await engine.sendDailyConfirmations();
  });
  scheduledJobs.set(`${companyId}-confirmations`, confirmationJob);

  // Resumo diário geral - 07:30
  const summaryJob = cron.schedule('30 7 * * *', async () => {
    console.log(`[${companyId}] Executando job de resumo diário...`);
    await engine.sendDailySummary();
  });
  scheduledJobs.set(`${companyId}-summary`, summaryJob);

  // Resumo diário individual para cada dentista - 07:00
  const professionalSummaryJob = cron.schedule('0 7 * * *', async () => {
    console.log(`[${companyId}] Executando job de resumo individual dos dentistas...`);
    const result = await engine.sendProfessionalDailySummaries();
    console.log(`[${companyId}] Resumos enviados: ${result.sent} sucesso, ${result.failed} falhas`);
  });
  scheduledJobs.set(`${companyId}-professional-summaries`, professionalSummaryJob);

  // Finalizar atendimentos - 23:00
  const finalizeJob = cron.schedule('0 23 * * *', async () => {
    console.log(`[${companyId}] Executando job de finalização...`);
    await engine.finalizeCompletedAppointments();
  });
  scheduledJobs.set(`${companyId}-finalize`, finalizeJob);

  // Aniversários - 09:00
  const birthdayJob = cron.schedule('0 9 * * *', async () => {
    console.log(`[${companyId}] Executando job de aniversários...`);
    await engine.sendBirthdayMessages();
  });
  scheduledJobs.set(`${companyId}-birthday`, birthdayJob);

  // Reativação de pacientes inativos - 10:00 (diário)
  const reactivationJob = cron.schedule('0 10 * * *', async () => {
    console.log(`[${companyId}] Executando job de reativação de pacientes...`);
    const result = await engine.sendReactivationMessages();
    console.log(`[${companyId}] Reativação: ${result.sent} mensagens enviadas`, result.byPeriod);
  });
  scheduledJobs.set(`${companyId}-reactivation`, reactivationJob);

  console.log(`✅ Jobs agendados iniciados para empresa ${companyId}`);
}

/**
 * Para os jobs de uma empresa
 */
export function stopScheduledJobs(companyId: number): void {
  const jobIds = [
    `${companyId}-confirmations`,
    `${companyId}-summary`,
    `${companyId}-professional-summaries`,
    `${companyId}-finalize`,
    `${companyId}-birthday`,
    `${companyId}-reactivation`,
  ];

  for (const jobId of jobIds) {
    const job = scheduledJobs.get(jobId);
    if (job) {
      job.stop();
      scheduledJobs.delete(jobId);
    }
  }

  console.log(`🛑 Jobs agendados parados para empresa ${companyId}`);
}

/**
 * Inicia jobs para todas as empresas ativas
 */
export async function startAllScheduledJobs(): Promise<void> {
  const activeCompanies = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.active, true));

  for (const company of activeCompanies) {
    await startScheduledJobs(company.id);
  }

  console.log(`✅ Jobs iniciados para ${activeCompanies.length} empresas`);
}
