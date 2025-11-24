import { Router } from 'express';
import { authCheck, asyncHandler } from '../middleware/auth';
import { createWhatsAppService, getWhatsAppConfig } from '../services/whatsapp.service';
import { storage } from '../storage';
import { db } from '../db';
import { patients } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const router = Router();

/**
 * POST /api/whatsapp/send
 * Envia mensagem WhatsApp genérica
 */
router.post(
  '/send',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: 'Phone and message are required' });
    }

    // Obter configuração WhatsApp
    const config = await getWhatsAppConfig(storage, companyId);

    if (!config || !config.instanceId || !config.apiKey) {
      return res.status(400).json({ error: 'WhatsApp not configured for this company' });
    }

    // Criar serviço e enviar mensagem
    const whatsappService = createWhatsAppService(config);
    const result = await whatsappService.sendMessage({ phone, message, companyId });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      messageId: result.messageId,
    });
  })
);

/**
 * POST /api/whatsapp/send-appointment-confirmation
 * Envia confirmação de agendamento
 */
router.post(
  '/send-appointment-confirmation',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { appointmentId } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId is required' });
    }

    // Buscar agendamento
    const appointment = await storage.getAppointment(appointmentId, companyId);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Buscar paciente
    let patient = null;
    if (appointment.patientId) {
      patient = await storage.getPatient(appointment.patientId, companyId);
    }

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Verificar se paciente tem WhatsApp
    const phone = patient.whatsappPhone || patient.cellphone;

    if (!phone) {
      return res.status(400).json({ error: 'Patient does not have WhatsApp phone' });
    }

    // Obter config WhatsApp
    const config = await getWhatsAppConfig(storage, companyId);

    if (!config || !config.instanceId || !config.apiKey) {
      return res.status(400).json({ error: 'WhatsApp not configured' });
    }

    // Formatar data/hora
    const datetime = format(
      new Date(appointment.startTime),
      "dd/MM/yyyy 'às' HH:mm",
      { locale: ptBR }
    );

    // Enviar mensagem
    const whatsappService = createWhatsAppService(config);
    const result = await whatsappService.sendAppointmentConfirmation({
      phone,
      patientName: patient.fullName,
      professionalName: appointment.professionalName || 'Profissional',
      datetime,
      appointmentId: appointment.id,
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    // Atualizar appointment com messageId
    await storage.updateAppointment(
      appointmentId,
      {
        wuzapiMessageId: result.messageId,
        automationStatus: 'sent',
        automationSentAt: new Date(),
      },
      companyId
    );

    res.json({
      success: true,
      messageId: result.messageId,
    });
  })
);

/**
 * POST /api/whatsapp/send-cancellation
 * Envia notificação de cancelamento
 */
router.post(
  '/send-cancellation',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { appointmentId, reason } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId is required' });
    }

    // Buscar agendamento
    const appointment = await storage.getAppointment(appointmentId, companyId);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Buscar paciente
    let patient = null;
    if (appointment.patientId) {
      patient = await storage.getPatient(appointment.patientId, companyId);
    }

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const phone = patient.whatsappPhone || patient.cellphone;

    if (!phone) {
      return res.status(400).json({ error: 'Patient does not have WhatsApp phone' });
    }

    // Config WhatsApp
    const config = await getWhatsAppConfig(storage, companyId);

    if (!config || !config.instanceId || !config.apiKey) {
      return res.status(400).json({ error: 'WhatsApp not configured' });
    }

    // Formatar data
    const datetime = format(
      new Date(appointment.startTime),
      "dd/MM/yyyy 'às' HH:mm",
      { locale: ptBR }
    );

    // Enviar mensagem
    const whatsappService = createWhatsAppService(config);
    const result = await whatsappService.sendCancellationNotice({
      phone,
      patientName: patient.fullName,
      datetime,
      reason,
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      messageId: result.messageId,
    });
  })
);

/**
 * POST /api/whatsapp/test-connection
 * Testa conexão com WhatsApp
 */
router.post(
  '/test-connection',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    // Obter config
    const config = await getWhatsAppConfig(storage, companyId);

    if (!config || !config.instanceId || !config.apiKey) {
      return res.status(400).json({ error: 'WhatsApp not configured' });
    }

    // Testar conexão
    const whatsappService = createWhatsAppService(config);
    const result = await whatsappService.checkConnection();

    res.json({
      connected: result.connected,
      error: result.error,
    });
  })
);

/**
 * GET /api/patients/:id/whatsapp-history
 * Obtém histórico de mensagens WhatsApp de um paciente
 */
router.get(
  '/patients/:id/history',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params;

    // TODO: Implementar quando tabela whatsapp_messages existir
    // const messages = await storage.getWhatsAppMessages(parseInt(id), companyId);

    // Por enquanto retornar vazio
    res.json([]);
  })
);

export default router;
