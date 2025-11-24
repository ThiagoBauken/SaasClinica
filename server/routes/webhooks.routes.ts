import { Router } from 'express';
import { storage } from '../storage';
import { asyncHandler } from '../middleware/auth';
import { N8NService } from '../services/n8n.service';
import { db } from '../db';
import { or, and, eq, inArray, isNotNull, desc } from 'drizzle-orm';

const router = Router();

/**
 * POST /api/webhooks/n8n/appointment-created
 * Recebe notificação do n8n quando um agendamento é criado
 *
 * Este endpoint é chamado PELO N8N após o site criar um agendamento
 * N8N recebe: appointmentId, patientPhone, datetime, etc.
 * N8N processa: Envia WhatsApp, cria evento Google Calendar
 * N8N retorna: google_calendar_event_id, wuzapi_message_id
 */
router.post(
  '/n8n/appointment-created',
  asyncHandler(async (req, res) => {
    const {
      appointmentId,
      googleCalendarEventId,
      wuzapiMessageId,
      automationStatus,
      error,
    } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId is required' });
    }

    // Buscar companyId do appointment
    const appointments = await storage.getAppointments(1, {}); // TODO: Get proper companyId
    const appointment = appointments.find((a: any) => a.id === appointmentId);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Atualizar appointment com dados retornados pelo n8n
    const updateData: any = {
      automationStatus: automationStatus || (error ? 'error' : 'sent'),
      automationSentAt: new Date(),
    };

    if (googleCalendarEventId) {
      updateData.googleCalendarEventId = googleCalendarEventId;
    }

    if (wuzapiMessageId) {
      updateData.wuzapiMessageId = wuzapiMessageId;
    }

    if (error) {
      updateData.automationError = error;
    }

    await storage.updateAppointment(appointmentId, updateData, appointment.companyId);

    // Log da automação
    await storage.createAutomationLog({
      companyId: appointment.companyId,
      appointmentId,
      executionType: 'appointment_created',
      executionStatus: error ? 'error' : 'success',
      messageProvider: wuzapiMessageId ? 'wuzapi' : null,
      messageId: wuzapiMessageId,
      sentTo: appointment.patient?.whatsappPhone || appointment.patient?.cellphone,
      errorMessage: error,
      payload: {
        googleCalendarEventId,
        wuzapiMessageId,
        automationStatus,
      },
    });

    res.json({
      success: true,
      appointmentId,
      updated: updateData,
    });
  })
);

/**
 * POST /api/webhooks/n8n/appointment-updated
 * Recebe notificação quando agendamento é atualizado (reagendamento)
 */
router.post(
  '/n8n/appointment-updated',
  asyncHandler(async (req, res) => {
    const {
      appointmentId,
      googleCalendarEventId,
      wuzapiMessageId,
      automationStatus,
      error,
    } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId is required' });
    }

    const appointments = await storage.getAppointments(1, {});
    const appointment = appointments.find((a: any) => a.id === appointmentId);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const updateData: any = {
      automationStatus: automationStatus || (error ? 'error' : 'sent'),
      automationSentAt: new Date(),
    };

    if (googleCalendarEventId) {
      updateData.googleCalendarEventId = googleCalendarEventId;
    }

    if (wuzapiMessageId) {
      updateData.wuzapiMessageId = wuzapiMessageId;
    }

    if (error) {
      updateData.automationError = error;
    }

    await storage.updateAppointment(appointmentId, updateData, appointment.companyId);

    res.json({
      success: true,
      appointmentId,
      updated: updateData,
    });
  })
);

/**
 * POST /api/webhooks/n8n/appointment-cancelled
 * Recebe notificação quando agendamento é cancelado
 */
router.post(
  '/n8n/appointment-cancelled',
  asyncHandler(async (req, res) => {
    const {
      appointmentId,
      wuzapiMessageId,
      googleCalendarDeleted,
      error,
    } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId is required' });
    }

    const appointments = await storage.getAppointments(1, {});
    const appointment = appointments.find((a: any) => a.id === appointmentId);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const updateData: any = {
      automationStatus: error ? 'error' : 'cancelled',
      automationSentAt: new Date(),
    };

    if (wuzapiMessageId) {
      updateData.wuzapiMessageId = wuzapiMessageId;
    }

    if (error) {
      updateData.automationError = error;
    }

    if (googleCalendarDeleted) {
      updateData.googleCalendarEventId = null; // Evento foi deletado
    }

    await storage.updateAppointment(appointmentId, updateData, appointment.companyId);

    res.json({
      success: true,
      appointmentId,
      updated: updateData,
    });
  })
);

/**
 * POST /api/webhooks/n8n/confirmation-response
 * Recebe resposta do paciente sobre confirmação de agendamento
 *
 * Chamado quando paciente responde "SIM", "NÃO", "REAGENDAR", etc.
 */
router.post(
  '/n8n/confirmation-response',
  asyncHandler(async (req, res) => {
    const {
      appointmentId,
      patientResponse,
      confirmedByPatient,
      wuzapiMessageId,
    } = req.body;

    if (!appointmentId || !patientResponse) {
      return res.status(400).json({
        error: 'appointmentId and patientResponse are required',
      });
    }

    // Determinar se paciente confirmou baseado na resposta
    const confirmed = confirmedByPatient !== undefined
      ? confirmedByPatient
      : patientResponse.toUpperCase().includes('SIM');

    // Processar confirmação usando o serviço N8N
    const success = await N8NService.processConfirmation({
      appointmentId,
      confirmed,
      response: patientResponse,
      timestamp: new Date().toISOString(),
    });

    if (!success) {
      return res.status(404).json({ error: 'Failed to process confirmation' });
    }

    res.json({
      success: true,
      appointmentId,
      confirmed,
    });
  })
);

/**
 * POST /api/webhooks/wuzapi/incoming
 * Recebe mensagens WhatsApp do Wuzapi
 *
 * Wuzapi envia para este endpoint quando:
 * - Paciente envia mensagem
 * - Paciente responde confirmação
 * - Status de mensagem muda (entregue, lido, etc.)
 */
router.post(
  '/wuzapi/incoming',
  asyncHandler(async (req, res) => {
    const { type, data } = req.body;

    // Verificar webhook secret para segurança
    const webhookSecret = req.headers['x-webhook-secret'] as string;
    const expectedSecret = process.env.WUZAPI_WEBHOOK_SECRET;

    if (expectedSecret && webhookSecret !== expectedSecret) {
      console.warn('Invalid Wuzapi webhook secret received');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (type === 'message') {
      // Mensagem recebida do WhatsApp
      const { from, message, messageId, timestamp } = data;

      // Limpar número de telefone (remover caracteres especiais)
      const cleanPhone = from.replace(/[^\d+]/g, '');

      // Buscar paciente pelo número de WhatsApp
      const { patients } = await import('@shared/schema');
      const [patient] = await db
        .select()
        .from(patients)
        .where(
          or(
            eq(patients.whatsappPhone, cleanPhone),
            eq(patients.cellphone, cleanPhone),
            eq(patients.phone, cleanPhone)
          )
        )
        .limit(1);

      if (!patient) {
        console.log('Patient not found for phone:', cleanPhone);
        return res.json({ success: true, received: true, patientNotFound: true });
      }

      // Buscar agendamento pendente de confirmação do paciente
      const { appointments } = await import('@shared/schema');
      const [appointment] = await db
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.patientId, patient.id),
            eq(appointments.companyId, patient.companyId),
            inArray(appointments.status, ['scheduled', 'confirmed']),
            eq(appointments.confirmedByPatient, false),
            isNotNull(appointments.confirmationMessageId)
          )
        )
        .orderBy(desc(appointments.startTime))
        .limit(1);

      if (appointment) {
        // Detectar resposta de confirmação
        const messageLower = message.toLowerCase().trim();
        const isConfirmation = messageLower.includes('sim') ||
                              messageLower.includes('confirmo') ||
                              messageLower.includes('ok') ||
                              messageLower.includes('confirmar');
        const isRejection = messageLower.includes('não') ||
                           messageLower.includes('nao') ||
                           messageLower.includes('cancelar');

        if (isConfirmation || isRejection) {
          // Atualizar appointment com resposta do paciente
          await db
            .update(appointments)
            .set({
              patientResponse: message,
              confirmedByPatient: isConfirmation,
              confirmationDate: new Date(),
              confirmationMethod: 'whatsapp',
              status: isConfirmation ? 'confirmed' : 'scheduled',
              updatedAt: new Date(),
            })
            .where(eq(appointments.id, appointment.id));

          console.log('Patient confirmation processed:', {
            appointmentId: appointment.id,
            patientId: patient.id,
            confirmed: isConfirmation,
            response: message,
          });

          // Encaminhar para N8N se houver callback configurado
          const settings = await storage.getClinicSettings(patient.companyId);
          if (settings?.n8nWebhookBaseUrl) {
            try {
              await fetch(`${settings.n8nWebhookBaseUrl}/webhook/confirmation-response`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  appointmentId: appointment.id,
                  patientId: patient.id,
                  patientName: patient.fullName,
                  patientResponse: message,
                  confirmedByPatient: isConfirmation,
                  timestamp: new Date().toISOString(),
                }),
              });
            } catch (error) {
              console.error('Failed to send confirmation to N8N:', error);
            }
          }

          return res.json({
            success: true,
            processed: true,
            appointmentId: appointment.id,
            confirmed: isConfirmation,
          });
        }
      }

      // Mensagem não relacionada a confirmação - apenas log
      console.log('Received WhatsApp message (not a confirmation):', {
        from: cleanPhone,
        patientId: patient?.id,
        message,
        messageId,
      });

      res.json({ success: true, received: true });
    } else if (type === 'status') {
      // Status de mensagem (entregue, lido, etc.)
      const { messageId, status } = data;

      // Atualizar status no automation_logs (se existir)
      try {
        const { automationLogs } = await import('@shared/schema');
        await db
          .update(automationLogs)
          .set({
            executionStatus: status === 'read' ? 'success' : 'pending',
          })
          .where(eq(automationLogs.messageId, messageId));
      } catch (error) {
        console.error('Failed to update message status:', error);
      }

      console.log('Message status update:', { messageId, status });
      res.json({ success: true, statusUpdated: true });
    } else {
      res.status(400).json({ error: 'Unknown webhook type' });
    }
  })
);

export default router;
