import axios from 'axios';
import { db } from '../db';
import { automations, automationLogs, appointments, patients, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface N8NTriggerPayload {
  appointmentId: number;
  trigger: string;
  patient: {
    id: number;
    name: string;
    phone?: string;
    whatsappPhone?: string;
    email?: string;
  };
  appointment: {
    id: number;
    date: string;
    time: string;
    professional: string;
    title: string;
    status: string;
  };
  automation: {
    id: number;
    type: string; // whatsapp, email, sms
    template: string;
    webhookUrl: string;
  };
}

export interface N8NConfirmationResponse {
  appointmentId: number;
  confirmed: boolean;
  response: string;
  timestamp: string;
}

/**
 * Serviço de integração com N8N para automações
 */
export class N8NService {
  /**
   * Dispara automação via webhook N8N
   */
  static async triggerAutomation(
    appointmentId: number,
    companyId: number,
    trigger: string = 'appointment_created'
  ): Promise<boolean> {
    try {
      // Buscar agendamento
      const [appointment] = await db
        .select()
        .from(appointments)
        .where(and(
          eq(appointments.id, appointmentId),
          eq(appointments.companyId, companyId)
        ))
        .limit(1);

      if (!appointment) {
        console.error('Appointment not found:', appointmentId);
        return false;
      }

      // Buscar paciente
      let patient = null;
      if (appointment.patientId) {
        [patient] = await db
          .select()
          .from(patients)
          .where(eq(patients.id, appointment.patientId))
          .limit(1);
      }

      // Buscar profissional
      let professional = null;
      if (appointment.professionalId) {
        [professional] = await db
          .select()
          .from(users)
          .where(eq(users.id, appointment.professionalId))
          .limit(1);
      }

      // Buscar automações ativas para este trigger
      const activeAutomations = await db
        .select()
        .from(automations)
        .where(and(
          eq(automations.companyId, companyId),
          eq(automations.active, true),
          eq(automations.triggerType, trigger)
        ));

      if (activeAutomations.length === 0) {
        console.log('No active automations found for trigger:', trigger);
        return false;
      }

      // Processar cada automação
      for (const automation of activeAutomations) {
        try {
          await this.sendWebhook(automation, appointment, patient, professional);
        } catch (error) {
          console.error('Error sending webhook for automation:', automation.id, error);
          // Continuar com as próximas automações mesmo se uma falhar
        }
      }

      return true;
    } catch (error) {
      console.error('Error triggering N8N automation:', error);
      return false;
    }
  }

  /**
   * Envia webhook para N8N
   */
  private static async sendWebhook(
    automation: any,
    appointment: any,
    patient: any,
    professional: any
  ): Promise<void> {
    const webhookUrl = automation.webhookUrl;

    if (!webhookUrl) {
      console.warn('No webhook URL configured for automation:', automation.id);
      return;
    }

    // Formatar datas
    const appointmentDate = format(new Date(appointment.startTime), "dd/MM/yyyy", { locale: ptBR });
    const appointmentTime = format(new Date(appointment.startTime), "HH:mm", { locale: ptBR });

    // Preparar payload
    const payload: N8NTriggerPayload = {
      appointmentId: appointment.id,
      trigger: automation.trigger,
      patient: {
        id: patient?.id || 0,
        name: patient?.fullName || 'Paciente não identificado',
        phone: patient?.phone,
        whatsappPhone: patient?.whatsappPhone || patient?.cellphone,
        email: patient?.email,
      },
      appointment: {
        id: appointment.id,
        date: appointmentDate,
        time: appointmentTime,
        professional: professional?.fullName || 'Profissional não definido',
        title: appointment.title,
        status: appointment.status,
      },
      automation: {
        id: automation.id,
        type: automation.type, // whatsapp, email, sms
        template: automation.messageTemplate || '',
        webhookUrl: webhookUrl,
      },
    };

    // Headers customizados (se configurados)
    const headers: any = {
      'Content-Type': 'application/json',
    };

    if (automation.webhookHeaders) {
      Object.assign(headers, automation.webhookHeaders);
    }

    // Enviar webhook
    const startTime = Date.now();
    let success = false;
    let errorMessage = null;

    try {
      const response = await axios.post(webhookUrl, payload, {
        headers,
        timeout: 10000, // 10 segundos timeout
      });

      success = response.status >= 200 && response.status < 300;

      // Atualizar appointment com status de automação
      await db
        .update(appointments)
        .set({
          automationStatus: success ? 'sent' : 'error',
          automationSentAt: new Date(),
          wuzapiMessageId: response.data?.messageId || null,
        })
        .where(eq(appointments.id, appointment.id));

    } catch (error: any) {
      console.error('Webhook error:', error.message);
      errorMessage = error.message;

      // Atualizar appointment com erro
      await db
        .update(appointments)
        .set({
          automationStatus: 'error',
          automationError: errorMessage,
        })
        .where(eq(appointments.id, appointment.id));
    }

    // Registrar log
    await db.insert(automationLogs).values({
      automationId: automation.id,
      appointmentId: appointment.id,
      companyId: automation.companyId,
      trigger: automation.trigger,
      status: success ? 'success' : 'error',
      payload: payload as any,
      response: null,
      error: errorMessage,
      executionTime: Date.now() - startTime,
      createdAt: new Date(),
    });
  }

  /**
   * Processa confirmação de agendamento via webhook
   */
  static async processConfirmation(data: N8NConfirmationResponse): Promise<boolean> {
    try {
      const { appointmentId, confirmed, response, timestamp } = data;

      // Buscar agendamento
      const [appointment] = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, appointmentId))
        .limit(1);

      if (!appointment) {
        console.error('Appointment not found for confirmation:', appointmentId);
        return false;
      }

      // Atualizar status de confirmação
      await db
        .update(appointments)
        .set({
          confirmedByPatient: confirmed,
          confirmationDate: new Date(timestamp),
          confirmationMethod: 'whatsapp',
          patientResponse: response,
          status: confirmed ? 'confirmed' : appointment.status,
        })
        .where(eq(appointments.id, appointmentId));

      console.log(`Appointment ${appointmentId} confirmation processed: ${confirmed}`);
      return true;
    } catch (error) {
      console.error('Error processing confirmation:', error);
      return false;
    }
  }

  /**
   * Busca histórico de automações para um agendamento
   */
  static async getAutomationLogs(appointmentId: number): Promise<any[]> {
    const logs = await db
      .select()
      .from(automationLogs)
      .where(eq(automationLogs.appointmentId, appointmentId))
      .orderBy(automationLogs.createdAt);

    return logs;
  }

  /**
   * Testa conexão com webhook N8N
   */
  static async testWebhook(webhookUrl: string): Promise<boolean> {
    try {
      const response = await axios.post(
        webhookUrl,
        {
          test: true,
          message: 'Test webhook from dental clinic system',
          timestamp: new Date().toISOString(),
        },
        { timeout: 5000 }
      );

      return response.status >= 200 && response.status < 300;
    } catch (error) {
      console.error('Webhook test failed:', error);
      return false;
    }
  }
}
