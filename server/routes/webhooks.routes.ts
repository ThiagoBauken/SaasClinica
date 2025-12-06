import { Router } from 'express';
import { storage } from '../storage';
import { asyncHandler } from '../middleware/auth';
import { N8NService } from '../services/n8n.service';
import { db } from '../db';
import { or, and, eq, inArray, isNotNull, desc } from 'drizzle-orm';
import { nowpaymentsService } from '../billing/nowpayments-service';
import { mercadopagoService } from '../billing/mercadopago-service';
import { stripeService } from '../billing/stripe-service';
import { appointments as appointmentsTable, patients } from '@shared/schema';

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

    // Buscar appointment diretamente pelo ID (sem precisar do companyId)
    const [appointment] = await db
      .select()
      .from(appointmentsTable)
      .leftJoin(patients, eq(appointmentsTable.patientId, patients.id))
      .where(eq(appointmentsTable.id, appointmentId))
      .limit(1);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const appointmentData = appointment.appointments;
    const patientData = appointment.patients;

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

    await storage.updateAppointment(appointmentId, updateData, appointmentData.companyId);

    // Log da automação
    await storage.createAutomationLog({
      companyId: appointmentData.companyId,
      appointmentId,
      executionType: 'appointment_created',
      executionStatus: error ? 'error' : 'success',
      messageProvider: wuzapiMessageId ? 'wuzapi' : null,
      messageId: wuzapiMessageId,
      sentTo: patientData?.whatsappPhone || patientData?.cellphone,
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

    // Buscar appointment diretamente pelo ID
    const [appointmentResult] = await db
      .select()
      .from(appointmentsTable)
      .where(eq(appointmentsTable.id, appointmentId))
      .limit(1);

    if (!appointmentResult) {
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

    await storage.updateAppointment(appointmentId, updateData, appointmentResult.companyId);

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

    // Buscar appointment diretamente pelo ID
    const [appointmentResult] = await db
      .select()
      .from(appointmentsTable)
      .where(eq(appointmentsTable.id, appointmentId))
      .limit(1);

    if (!appointmentResult) {
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

    await storage.updateAppointment(appointmentId, updateData, appointmentResult.companyId);

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

/**
 * POST /api/webhooks/n8n/chat-process
 * Processa mensagem de chat via N8N (Code-First Architecture)
 *
 * Este endpoint é chamado pelo N8N quando uma mensagem de WhatsApp é recebida.
 * Ele usa o ChatProcessor para classificar intenção e gerar resposta.
 * 80% regex + 15% state machine + 5% AI
 *
 * IMPORTANTE: fromMe=true indica que a mensagem foi enviada PELA clínica (secretária)
 * Nesse caso, a IA NÃO deve responder e marca a sessão como "humano assumiu"
 */
router.post(
  '/n8n/chat-process',
  asyncHandler(async (req, res) => {
    const { companyId, phone, message, wuzapiMessageId, instanceId, fromMe } = req.body;

    if (!companyId || !phone || !message) {
      return res.status(400).json({
        success: false,
        error: 'companyId, phone e message são obrigatórios',
      });
    }

    try {
      // Importar dinamicamente para evitar circular dependency
      const { createChatProcessor } = await import('../services/chat-processor');

      const processor = createChatProcessor(Number(companyId));
      // Passar fromMe para detectar se secretária enviou a mensagem
      const result = await processor.processMessage(phone, message, wuzapiMessageId, fromMe === true);

      // Se skipResponse=true, a IA não deve enviar resposta (humano assumiu)
      const shouldRespond = !result.skipResponse && !result.requiresHumanTransfer;

      // Retornar resposta para N8N enviar via Wuzapi
      res.json({
        success: true,
        shouldRespond,
        response: result.response,
        intent: result.intent,
        confidence: result.confidence,
        processedBy: result.processedBy,
        tokensUsed: result.tokensUsed,
        requiresHumanTransfer: result.requiresHumanTransfer,
        isUrgency: result.isUrgency,
        urgencyLevel: result.urgencyLevel,
        skipResponse: result.skipResponse,
        actions: result.actions,
      });
    } catch (error: any) {
      console.error('Erro ao processar mensagem no chat:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro interno ao processar mensagem',
        shouldRespond: false,
      });
    }
  })
);

/**
 * GET /api/webhooks/n8n/admin-phones/:companyId
 * Retorna telefones admin para notificações (usado pelo N8N)
 *
 * Query params:
 * - notificationType: 'urgency' | 'daily_report' | 'new_appointment' | 'cancellation'
 * - role: 'doctor' | 'receptionist' | 'manager' | 'owner' (opcional)
 */
router.get(
  '/n8n/admin-phones/:companyId',
  asyncHandler(async (req, res) => {
    const companyId = parseInt(req.params.companyId);
    const { notificationType, role } = req.query;

    const { adminPhones } = await import('@shared/schema');

    const phones = await db
      .select()
      .from(adminPhones)
      .where(
        and(
          eq(adminPhones.companyId, companyId),
          eq(adminPhones.isActive, true)
        )
      );

    // Filtrar por tipo de notificação
    type AdminPhoneRow = typeof phones[0];
    let filtered = phones;
    if (notificationType === 'urgency') {
      filtered = phones.filter((p: AdminPhoneRow) => p.receiveUrgencies);
    } else if (notificationType === 'daily_report') {
      filtered = phones.filter((p: AdminPhoneRow) => p.receiveDailyReport);
    } else if (notificationType === 'new_appointment') {
      filtered = phones.filter((p: AdminPhoneRow) => p.receiveNewAppointments);
    } else if (notificationType === 'cancellation') {
      filtered = phones.filter((p: AdminPhoneRow) => p.receiveCancellations);
    }

    // Filtrar por role se especificado
    if (role) {
      filtered = filtered.filter((p: AdminPhoneRow) => p.role === role);
    }

    res.json({
      success: true,
      data: filtered.map((p: AdminPhoneRow) => ({
        phone: p.phone,
        name: p.name,
        role: p.role,
      })),
    });
  })
);

/**
 * GET /api/webhooks/n8n/doctors-for-urgency/:companyId
 * Retorna telefones de DOUTORES para notificação de URGÊNCIA
 * Usado quando paciente relata emergência/dor/urgência
 */
router.get(
  '/n8n/doctors-for-urgency/:companyId',
  asyncHandler(async (req, res) => {
    const companyId = parseInt(req.params.companyId);
    const { urgencyLevel } = req.query; // 'low' | 'medium' | 'high' | 'critical'

    const { adminPhones, users } = await import('@shared/schema');

    // Buscar admins que recebem urgências
    const adminsWithUrgency = await db
      .select()
      .from(adminPhones)
      .where(
        and(
          eq(adminPhones.companyId, companyId),
          eq(adminPhones.isActive, true),
          eq(adminPhones.receiveUrgencies, true)
        )
      );

    // Buscar dentistas da empresa (role = 'dentist') que têm wuzapiPhone
    const dentists = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        phone: users.wuzapiPhone,
        role: users.role,
      })
      .from(users)
      .where(
        and(
          eq(users.companyId, companyId),
          eq(users.role, 'dentist'),
          eq(users.active, true)
        )
      );

    // Combinar admins e dentistas (sem duplicatas)
    const allPhones = new Map<string, { phone: string; name: string; role: string }>();

    // Adicionar admins
    for (const admin of adminsWithUrgency) {
      if (admin.phone) {
        allPhones.set(admin.phone, {
          phone: admin.phone,
          name: admin.name || 'Admin',
          role: admin.role || 'admin',
        });
      }
    }

    // Adicionar dentistas (prioridade para urgências críticas)
    for (const dentist of dentists) {
      if (dentist.phone) {
        allPhones.set(dentist.phone, {
          phone: dentist.phone,
          name: dentist.fullName,
          role: 'doctor',
        });
      }
    }

    // Se urgência é crítica ou alta, retorna todos
    // Se é média ou baixa, retorna apenas recepção/admin
    let result = Array.from(allPhones.values());

    if (urgencyLevel === 'low') {
      // Apenas secretária/admin
      result = result.filter(p => p.role !== 'doctor');
    }

    res.json({
      success: true,
      urgencyLevel: urgencyLevel || 'unknown',
      data: result,
    });
  })
);

/**
 * GET /api/webhooks/n8n/company-context/:companyId
 * Retorna contexto da empresa para uso no N8N (nome, telefone, links, etc.)
 */
router.get(
  '/n8n/company-context/:companyId',
  asyncHandler(async (req, res) => {
    const companyId = parseInt(req.params.companyId);

    const { companies, clinicSettings } = await import('@shared/schema');

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    res.json({
      success: true,
      data: {
        company: {
          id: company.id,
          name: company.name,
          phone: company.phone,
          email: company.email,
          address: company.address,
        },
        settings: settings ? {
          chatEnabled: settings.chatEnabled,
          emergencyPhone: settings.emergencyPhone,
          googleMapsLink: settings.googleMapsLink,
          googleReviewLink: settings.googleReviewLink,
          workingHours: settings.workingHoursJson,
          n8nWebhookBaseUrl: settings.n8nWebhookBaseUrl,
          wuzapiInstanceId: settings.wuzapiInstanceId,
          confirmationMessageTemplate: settings.confirmationMessageTemplate,
          reminderMessageTemplate: settings.reminderMessageTemplate,
          cancellationMessageTemplate: settings.cancellationMessageTemplate,
        } : null,
      },
    });
  })
);

/**
 * POST /api/webhooks/nowpayments
 * Webhook do NOWPayments para pagamentos crypto
 */
router.post('/nowpayments', async (req, res) => {
  try {
    const signature = req.headers['x-nowpayments-sig'] as string;
    const payload = JSON.stringify(req.body);

    // Verificar assinatura
    const isValid = nowpaymentsService.verifyWebhookSignature(payload, signature);

    if (!isValid) {
      console.warn('⚠️ Invalid NOWPayments webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Processar webhook
    await nowpaymentsService.handleWebhook(req.body);

    res.json({ received: true });
  } catch (error) {
    console.error('Erro ao processar webhook NOWPayments:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /api/webhooks/mercadopago
 * Webhook do MercadoPago para pagamentos Pix/Boleto/Cartão
 */
router.post('/mercadopago', async (req, res) => {
  try {
    const xSignature = req.headers['x-signature'] as string;
    const xRequestId = req.headers['x-request-id'] as string;

    // Verificar assinatura
    const isValid = mercadopagoService.verifyWebhookSignature(req.body, xSignature, xRequestId);

    if (!isValid) {
      console.warn('⚠️ Invalid MercadoPago webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Processar webhook
    await mercadopagoService.handleWebhook(req.body);

    res.status(200).send();
  } catch (error) {
    console.error('Erro ao processar webhook MercadoPago:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /api/webhooks/stripe
 * Webhook do Stripe (já existe no stripe-service, mas adicionamos aqui para centralizar)
 */
router.post('/stripe', async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    const payload = Buffer.from(JSON.stringify(req.body));

    await stripeService.handleWebhook(payload, signature);

    res.json({ received: true });
  } catch (error) {
    console.error('Erro ao processar webhook Stripe:', error);
    res.status(400).json({ error: 'Webhook error' });
  }
});

// =============================================
// ENDPOINTS PARA N8N - FOLLOW-UP
// =============================================

/**
 * GET /api/webhooks/n8n/patients-for-review/:companyId
 * Retorna pacientes elegíveis para receber pedido de avaliação
 * Lógica: Primeira consulta OU 90 dias desde último pedido
 */
router.get(
  '/n8n/patients-for-review/:companyId',
  asyncHandler(async (req, res) => {
    const companyId = parseInt(req.params.companyId);

    if (!companyId) {
      return res.status(400).json({ error: 'companyId é obrigatório' });
    }

    // Data de hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 90 dias atrás
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Buscar consultas "completed" de hoje
    const { sql, gte, lte, isNull } = await import('drizzle-orm');

    const completedToday = await db
      .select({
        appointmentId: appointmentsTable.id,
        patientId: appointmentsTable.patientId,
        patientName: patients.fullName,
        patientPhone: patients.whatsappPhone,
        patientCellphone: patients.cellphone,
        patientPhone2: patients.phone,
        lastReviewRequestedAt: patients.lastReviewRequestedAt,
        totalAppointments: patients.totalAppointments,
      })
      .from(appointmentsTable)
      .innerJoin(patients, eq(appointmentsTable.patientId, patients.id))
      .where(
        and(
          eq(appointmentsTable.companyId, companyId),
          eq(appointmentsTable.status, 'completed'),
          gte(appointmentsTable.endTime, today),
          lte(appointmentsTable.endTime, tomorrow)
        )
      );

    // Filtrar pacientes elegíveis para avaliação
    type ReviewRow = typeof completedToday[0];
    const eligiblePatients = completedToday.filter((row: ReviewRow) => {
      // Se nunca pediu avaliação → elegível (primeira consulta ou nunca pediu)
      if (!row.lastReviewRequestedAt) {
        return true;
      }

      // Se passou mais de 90 dias desde último pedido → elegível
      const lastRequest = new Date(row.lastReviewRequestedAt);
      return lastRequest < ninetyDaysAgo;
    });

    // Formatar resposta com telefone disponível
    const response = eligiblePatients.map((row: ReviewRow) => ({
      appointmentId: row.appointmentId,
      patientId: row.patientId,
      patientName: row.patientName,
      phone: row.patientPhone || row.patientCellphone || row.patientPhone2,
      isFirstAppointment: !row.lastReviewRequestedAt && (row.totalAppointments || 0) <= 1,
      daysSinceLastRequest: row.lastReviewRequestedAt
        ? Math.floor((Date.now() - new Date(row.lastReviewRequestedAt).getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }));

    // Filtrar apenas quem tem telefone
    type ResponseRow = typeof response[0];
    const patientsWithPhone = response.filter((p: ResponseRow) => p.phone);

    res.json({
      success: true,
      data: patientsWithPhone,
      total: patientsWithPhone.length,
      date: today.toISOString().split('T')[0],
    });
  })
);

/**
 * PATCH /api/webhooks/n8n/mark-review-requested/:patientId
 * Marca que pedido de avaliação foi enviado para o paciente
 */
router.patch(
  '/n8n/mark-review-requested/:patientId',
  asyncHandler(async (req, res) => {
    const patientId = parseInt(req.params.patientId);

    if (!patientId) {
      return res.status(400).json({ error: 'patientId é obrigatório' });
    }

    await db
      .update(patients)
      .set({
        lastReviewRequestedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(patients.id, patientId));

    res.json({
      success: true,
      message: 'Paciente marcado como avaliação solicitada',
      patientId,
      lastReviewRequestedAt: new Date().toISOString(),
    });
  })
);

/**
 * GET /api/webhooks/n8n/patients-birthday/:companyId
 * Retorna pacientes que fazem aniversário hoje
 */
router.get(
  '/n8n/patients-birthday/:companyId',
  asyncHandler(async (req, res) => {
    const companyId = parseInt(req.params.companyId);

    if (!companyId) {
      return res.status(400).json({ error: 'companyId é obrigatório' });
    }

    const today = new Date();
    const month = today.getMonth() + 1; // JavaScript months are 0-indexed
    const day = today.getDate();

    // Buscar pacientes com aniversário hoje usando SQL raw para extract
    const { sql } = await import('drizzle-orm');

    const birthdayPatients = await db
      .select({
        id: patients.id,
        fullName: patients.fullName,
        phone: patients.whatsappPhone,
        cellphone: patients.cellphone,
        phone2: patients.phone,
        birthDate: patients.birthDate,
      })
      .from(patients)
      .where(
        and(
          eq(patients.companyId, companyId),
          eq(patients.active, true),
          sql`EXTRACT(MONTH FROM ${patients.birthDate}) = ${month}`,
          sql`EXTRACT(DAY FROM ${patients.birthDate}) = ${day}`
        )
      );

    // Formatar resposta
    type BirthdayRow = typeof birthdayPatients[0];
    const response = birthdayPatients.map((p: BirthdayRow) => ({
      patientId: p.id,
      patientName: p.fullName,
      phone: p.phone || p.cellphone || p.phone2,
      birthDate: p.birthDate,
    }));

    // Filtrar apenas quem tem telefone
    type BirthdayResponseRow = typeof response[0];
    const patientsWithPhone = response.filter((p: BirthdayResponseRow) => p.phone);

    res.json({
      success: true,
      data: patientsWithPhone,
      total: patientsWithPhone.length,
      date: today.toISOString().split('T')[0],
      month,
      day,
    });
  })
);

// =============================================
// WEBHOOK WUZAPI 3.0 - COM SUPORTE A MÍDIA
// =============================================

/**
 * POST /api/webhooks/wuzapi/:companyId
 * Recebe TODOS os eventos do Wuzapi 3.0 para uma empresa específica
 *
 * Tipos de eventos suportados:
 * - Message: Mensagens de texto, imagem, áudio, vídeo, documento, sticker, location
 * - ReadReceipt: Status de leitura
 * - Presence: Status online/offline
 * - ChatPresence: Digitando, gravando áudio
 * - HistorySync: Sincronização de histórico
 * - Call: Chamadas de voz/vídeo
 */
router.post(
  '/wuzapi/:companyId',
  asyncHandler(async (req, res) => {
    const companyId = parseInt(req.params.companyId);
    const event = req.body;

    // Log do evento recebido
    console.log(`[Wuzapi Webhook] Company ${companyId}:`, JSON.stringify(event).substring(0, 500));

    // Importações dinâmicas
    const { chatMessages, chatSessions, clinicSettings } = await import('@shared/schema');
    const fs = await import('fs');
    const path = await import('path');

    // Buscar configurações da empresa para validar token
    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    if (!settings) {
      console.warn(`[Wuzapi Webhook] Company ${companyId} not found`);
      return res.status(404).json({ error: 'Company not found' });
    }

    // Processar diferentes tipos de evento
    const eventType = event.type || event.Type || 'unknown';

    switch (eventType.toLowerCase()) {
      case 'message': {
        // Extrair dados da mensagem (compatível com Wuzapi 3.0)
        const data = event.data || event.Data || event;
        const messageInfo = data.Info || data.info || {};
        const messageContent = data.Message || data.message || {};

        const from = messageInfo.RemoteJid || messageInfo.remoteJid || data.From || data.from || '';
        const fromMe = messageInfo.FromMe || messageInfo.fromMe || data.FromMe || data.fromMe || false;
        const messageId = messageInfo.Id || messageInfo.id || data.Id || data.id || '';
        const timestamp = messageInfo.Timestamp || messageInfo.timestamp || data.Timestamp || Date.now();

        // Limpar número de telefone
        const cleanPhone = from.replace('@s.whatsapp.net', '').replace(/[^\d+]/g, '');

        if (!cleanPhone) {
          return res.json({ success: true, skipped: true, reason: 'No phone number' });
        }

        // Determinar tipo de mensagem e conteúdo
        let messageType = 'text';
        let textContent = '';
        let mediaUrl = null;
        let mediaType = null;
        let mimeType = null;
        let fileName = null;

        // Texto
        if (messageContent.Conversation || messageContent.conversation) {
          textContent = messageContent.Conversation || messageContent.conversation;
          messageType = 'text';
        }
        // Texto estendido (com links, etc)
        else if (messageContent.ExtendedTextMessage || messageContent.extendedTextMessage) {
          const ext = messageContent.ExtendedTextMessage || messageContent.extendedTextMessage;
          textContent = ext.Text || ext.text || '';
          messageType = 'text';
        }
        // Imagem
        else if (messageContent.ImageMessage || messageContent.imageMessage) {
          const img = messageContent.ImageMessage || messageContent.imageMessage;
          textContent = img.Caption || img.caption || '[Imagem]';
          messageType = 'image';
          mimeType = img.Mimetype || img.mimetype || 'image/jpeg';
          mediaType = 'image';
        }
        // Áudio/Voice Note
        else if (messageContent.AudioMessage || messageContent.audioMessage) {
          const audio = messageContent.AudioMessage || messageContent.audioMessage;
          textContent = '[Áudio]';
          messageType = audio.Ptt || audio.ptt ? 'voice' : 'audio';
          mimeType = audio.Mimetype || audio.mimetype || 'audio/ogg';
          mediaType = 'audio';
        }
        // Vídeo
        else if (messageContent.VideoMessage || messageContent.videoMessage) {
          const video = messageContent.VideoMessage || messageContent.videoMessage;
          textContent = video.Caption || video.caption || '[Vídeo]';
          messageType = 'video';
          mimeType = video.Mimetype || video.mimetype || 'video/mp4';
          mediaType = 'video';
        }
        // Documento
        else if (messageContent.DocumentMessage || messageContent.documentMessage) {
          const doc = messageContent.DocumentMessage || messageContent.documentMessage;
          fileName = doc.FileName || doc.fileName || 'documento';
          textContent = `[Documento: ${fileName}]`;
          messageType = 'document';
          mimeType = doc.Mimetype || doc.mimetype || 'application/octet-stream';
          mediaType = 'document';
        }
        // Sticker
        else if (messageContent.StickerMessage || messageContent.stickerMessage) {
          textContent = '[Sticker]';
          messageType = 'sticker';
          mediaType = 'sticker';
        }
        // Localização
        else if (messageContent.LocationMessage || messageContent.locationMessage) {
          const loc = messageContent.LocationMessage || messageContent.locationMessage;
          const lat = loc.DegreesLatitude || loc.degreesLatitude;
          const lng = loc.DegreesLongitude || loc.degreesLongitude;
          textContent = `[Localização: ${lat}, ${lng}]`;
          messageType = 'location';
        }
        // Contato
        else if (messageContent.ContactMessage || messageContent.contactMessage) {
          const contact = messageContent.ContactMessage || messageContent.contactMessage;
          textContent = `[Contato: ${contact.DisplayName || contact.displayName || 'Contato'}]`;
          messageType = 'contact';
        }
        // Mensagem não suportada
        else {
          textContent = '[Tipo de mensagem não suportado]';
          messageType = 'unknown';
          console.log('[Wuzapi Webhook] Unknown message type:', JSON.stringify(messageContent).substring(0, 300));
        }

        // Se tem mídia, tentar baixar
        if (mediaType && messageId && settings.wuzapiApiKey) {
          try {
            const baseUrl = settings.wuzapiBaseUrl || 'https://wuzapi.cloud';
            const downloadResponse = await fetch(`${baseUrl}/chat/download/media`, {
              method: 'POST',
              headers: {
                'token': settings.wuzapiApiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                MessageId: messageId,
              }),
            });

            if (downloadResponse.ok) {
              const mediaData = await downloadResponse.json();
              if (mediaData.success !== false && mediaData.data?.Data) {
                // Salvar mídia no servidor
                const uploadsDir = path.join(process.cwd(), 'uploads', 'chat', String(companyId));
                if (!fs.existsSync(uploadsDir)) {
                  fs.mkdirSync(uploadsDir, { recursive: true });
                }

                const extension = mimeType?.split('/')[1] || 'bin';
                const mediaFileName = `${messageId}.${extension}`;
                const filePath = path.join(uploadsDir, mediaFileName);

                // Decodificar base64 e salvar
                const buffer = Buffer.from(mediaData.data.Data, 'base64');
                fs.writeFileSync(filePath, buffer);

                mediaUrl = `/uploads/chat/${companyId}/${mediaFileName}`;
                console.log(`[Wuzapi Webhook] Media saved: ${mediaUrl}`);
              }
            }
          } catch (mediaError) {
            console.error('[Wuzapi Webhook] Error downloading media:', mediaError);
          }
        }

        // Buscar ou criar sessão de chat
        let [session] = await db
          .select()
          .from(chatSessions)
          .where(
            and(
              eq(chatSessions.companyId, companyId),
              eq(chatSessions.phone, cleanPhone)
            )
          )
          .limit(1);

        if (!session) {
          // Criar nova sessão
          const [newSession] = await db
            .insert(chatSessions)
            .values({
              companyId,
              phone: cleanPhone,
              status: 'active',
              lastMessageAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();
          session = newSession;
        } else {
          // Atualizar última mensagem
          await db
            .update(chatSessions)
            .set({
              lastMessageAt: new Date(),
              updatedAt: new Date(),
              status: 'active',
            })
            .where(eq(chatSessions.id, session.id));
        }

        // Salvar mensagem no banco
        await db.insert(chatMessages).values({
          sessionId: session.id,
          companyId,
          direction: fromMe ? 'outgoing' : 'incoming',
          messageType,
          content: textContent,
          mediaUrl,
          mimeType,
          fileName,
          wuzapiMessageId: messageId,
          status: 'received',
          createdAt: new Date(timestamp * 1000 || Date.now()),
        });

        // Se não é mensagem enviada pela clínica, processar resposta automática
        if (!fromMe && messageType === 'text') {
          // Verificar se chat AI está habilitado
          if (settings.chatEnabled) {
            // Encaminhar para N8N processar
            if (settings.n8nWebhookBaseUrl) {
              try {
                await fetch(`${settings.n8nWebhookBaseUrl}/webhook/chat-incoming`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    companyId,
                    phone: cleanPhone,
                    message: textContent,
                    messageType,
                    mediaUrl,
                    wuzapiMessageId: messageId,
                    sessionId: session.id,
                  }),
                });
              } catch (n8nError) {
                console.error('[Wuzapi Webhook] Error forwarding to N8N:', n8nError);
              }
            }
          }
        }

        return res.json({
          success: true,
          processed: true,
          messageType,
          sessionId: session.id,
          hasMedia: !!mediaUrl,
        });
      }

      case 'readreceipt':
      case 'receipt': {
        // Status de leitura
        const data = event.data || event.Data || event;
        const messageIds = data.MessageIds || data.messageIds || [];
        const status = data.Type || data.type || 'read'; // read, delivered, played

        console.log(`[Wuzapi Webhook] Read receipt: ${messageIds.join(', ')} - ${status}`);

        // Atualizar status das mensagens
        if (messageIds.length > 0) {
          const { chatMessages } = await import('@shared/schema');
          for (const msgId of messageIds) {
            await db
              .update(chatMessages)
              .set({
                status: status === 'read' ? 'read' : 'delivered',
                readAt: status === 'read' ? new Date() : undefined,
              })
              .where(eq(chatMessages.wuzapiMessageId, msgId));
          }
        }

        return res.json({ success: true, statusUpdated: true });
      }

      case 'chatpresence':
      case 'presence': {
        // Digitando, gravando áudio, online/offline
        const data = event.data || event.Data || event;
        const from = data.Chat || data.chat || '';
        const state = data.State || data.state || ''; // composing, recording, available, unavailable

        console.log(`[Wuzapi Webhook] Presence: ${from} - ${state}`);

        // Pode ser usado para mostrar "digitando..." na UI
        // Por enquanto apenas log

        return res.json({ success: true, presenceReceived: true });
      }

      case 'call': {
        // Chamada de voz/vídeo
        const data = event.data || event.Data || event;
        const from = data.From || data.from || '';
        const callType = data.Type || data.type || 'voice'; // voice, video

        console.log(`[Wuzapi Webhook] Call from ${from}: ${callType}`);

        // Notificar admin sobre chamada perdida (opcional)

        return res.json({ success: true, callReceived: true });
      }

      default:
        console.log(`[Wuzapi Webhook] Unknown event type: ${eventType}`);
        return res.json({ success: true, skipped: true, reason: 'Unknown event type' });
    }
  })
);

export default router;
