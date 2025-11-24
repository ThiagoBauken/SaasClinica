import { Router } from 'express';
import { storage } from '../storage';
import { authCheck, asyncHandler } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { z } from 'zod';
import { createWhatsAppService } from '../services/whatsapp.service';

const router = Router();

// Schema para atualização de configurações de integração
const updateIntegrationsSchema = z.object({
  // Wuzapi
  wuzapiInstanceId: z.string().optional(),
  wuzapiApiKey: z.string().optional(),
  wuzapiBaseUrl: z.string().url().optional(),
  wuzapiWebhookSecret: z.string().optional(),

  // Google Calendar
  defaultGoogleCalendarId: z.string().optional(),
  googleCalendarTimezone: z.string().optional(),

  // N8N
  n8nWebhookBaseUrl: z.string().url().optional(),
  n8nWebhookSecret: z.string().optional(),

  // Admin
  adminWhatsappPhone: z.string().optional(),

  // Preferências
  enableAppointmentReminders: z.boolean().optional(),
  reminderHoursBefore: z.number().int().min(1).max(72).optional(),
  enableBirthdayMessages: z.boolean().optional(),
  enableFeedbackRequests: z.boolean().optional(),
  feedbackHoursAfter: z.number().int().min(1).max(168).optional(),
});

/**
 * GET /api/v1/integrations
 * Busca configurações de integrações da empresa
 */
router.get(
  '/',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const settings = await storage.getClinicSettings(companyId);

    if (!settings) {
      // Retornar settings vazias se não existir
      return res.json({
        companyId,
        wuzapiInstanceId: null,
        wuzapiApiKey: null,
        wuzapiBaseUrl: 'https://wuzapi.cloud/api/v2',
        defaultGoogleCalendarId: null,
        googleCalendarTimezone: 'America/Sao_Paulo',
        n8nWebhookBaseUrl: null,
        adminWhatsappPhone: null,
        enableAppointmentReminders: true,
        reminderHoursBefore: 24,
        enableBirthdayMessages: true,
        enableFeedbackRequests: true,
        feedbackHoursAfter: 24,
        hasWuzapiConfig: false,
        hasGoogleCalendarConfig: false,
        hasN8nConfig: false,
      });
    }

    // Mascarar credenciais sensíveis
    const masked = {
      ...settings,
      wuzapiApiKey: settings.wuzapiApiKey ? `***${settings.wuzapiApiKey.slice(-4)}` : null,
      wuzapiWebhookSecret: settings.wuzapiWebhookSecret ? '***' : null,
      n8nWebhookSecret: settings.n8nWebhookSecret ? '***' : null,
      hasWuzapiConfig: !!(settings.wuzapiInstanceId && settings.wuzapiApiKey),
      hasGoogleCalendarConfig: !!settings.defaultGoogleCalendarId,
      hasN8nConfig: !!settings.n8nWebhookBaseUrl,
    };

    res.json(masked);
  })
);

/**
 * PATCH /api/v1/integrations
 * Atualiza configurações de integrações
 * Requer role: admin
 */
router.patch(
  '/',
  authCheck,
  validate({ body: updateIntegrationsSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    // Verificar se é admin
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Apenas administradores podem atualizar configurações',
      });
    }

    // Verificar se settings já existe
    const existing = await storage.getClinicSettings(companyId);

    let updated;
    if (existing) {
      // Atualizar
      updated = await storage.updateClinicSettings(companyId, req.body);
    } else {
      // Criar
      updated = await storage.createClinicSettings({
        ...req.body,
        companyId,
      });
    }

    // Mascarar credenciais na resposta
    const masked = {
      ...updated,
      wuzapiApiKey: updated.wuzapiApiKey ? `***${updated.wuzapiApiKey.slice(-4)}` : null,
      wuzapiWebhookSecret: updated.wuzapiWebhookSecret ? '***' : null,
      n8nWebhookSecret: updated.n8nWebhookSecret ? '***' : null,
      hasWuzapiConfig: !!(updated.wuzapiInstanceId && updated.wuzapiApiKey),
      hasGoogleCalendarConfig: !!updated.defaultGoogleCalendarId,
      hasN8nConfig: !!updated.n8nWebhookBaseUrl,
    };

    res.json({
      message: 'Configurações de integração atualizadas com sucesso',
      settings: masked,
    });
  })
);

/**
 * POST /api/v1/integrations/test-whatsapp
 * Testa conexão com Wuzapi
 */
router.post(
  '/test-whatsapp',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const settings = await storage.getClinicSettings(companyId);

    if (!settings?.wuzapiInstanceId || !settings?.wuzapiApiKey) {
      return res.status(400).json({
        error: 'Wuzapi not configured',
        message: 'Configure as credenciais do Wuzapi primeiro',
      });
    }

    const whatsappService = createWhatsAppService({
      instanceId: settings.wuzapiInstanceId,
      apiKey: settings.wuzapiApiKey,
      baseUrl: settings.wuzapiBaseUrl || 'https://wuzapi.cloud/api/v2',
    });

    const result = await whatsappService.checkConnection();

    if (result.connected) {
      res.json({
        success: true,
        message: 'Conexão com Wuzapi estabelecida com sucesso',
        connected: true,
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Falha ao conectar com Wuzapi',
        error: result.error,
        connected: false,
      });
    }
  })
);

/**
 * POST /api/v1/integrations/test-n8n
 * Testa conexão com N8N
 */
router.post(
  '/test-n8n',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const settings = await storage.getClinicSettings(companyId);

    if (!settings?.n8nWebhookBaseUrl) {
      return res.status(400).json({
        error: 'N8N not configured',
        message: 'Configure a URL do N8N primeiro',
      });
    }

    try {
      // Testar webhook de healthcheck
      const response = await fetch(`${settings.n8nWebhookBaseUrl}/webhook/healthcheck`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test: true,
          companyId,
        }),
      });

      if (response.ok) {
        res.json({
          success: true,
          message: 'Conexão com N8N estabelecida com sucesso',
          connected: true,
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'N8N retornou erro',
          status: response.status,
          connected: false,
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Falha ao conectar com N8N',
        error: error.message,
        connected: false,
      });
    }
  })
);

/**
 * POST /api/v1/integrations/send-test-whatsapp
 * Envia mensagem de teste via WhatsApp
 */
router.post(
  '/send-test-whatsapp',
  authCheck,
  validate({
    body: z.object({
      phone: z.string().min(10),
      message: z.string().min(1).max(500).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Apenas administradores podem enviar mensagens de teste',
      });
    }

    const settings = await storage.getClinicSettings(companyId);

    if (!settings?.wuzapiInstanceId || !settings?.wuzapiApiKey) {
      return res.status(400).json({
        error: 'Wuzapi not configured',
        message: 'Configure as credenciais do Wuzapi primeiro',
      });
    }

    const { phone, message } = req.body;

    const whatsappService = createWhatsAppService({
      instanceId: settings.wuzapiInstanceId,
      apiKey: settings.wuzapiApiKey,
      baseUrl: settings.wuzapiBaseUrl || 'https://wuzapi.cloud/api/v2',
    });

    const result = await whatsappService.sendMessage({
      phone,
      message: message || '🧪 Teste de integração Wuzapi - Sistema de Clínica Dental',
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'Mensagem de teste enviada com sucesso',
        messageId: result.messageId,
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Falha ao enviar mensagem',
        error: result.error,
      });
    }
  })
);

export default router;
