import { Router } from 'express';
import { storage } from '../storage';
import { authCheck, asyncHandler } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { z } from 'zod';
import { createWhatsAppService } from '../services/whatsapp.service';
import { createEvolutionService, EvolutionApiService } from '../services/evolution-api.service';
import { db } from '../db';
import { clinicSettings, companies } from '@shared/schema';
import { eq } from 'drizzle-orm';
import * as WuzapiService from '../services/wuzapi-provisioning';
import { getWhatsAppProvider, getWhatsAppProviderInfo, type WhatsAppProviderType } from '../services/whatsapp-provider';

import { logger } from '../logger';
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
    const user = req.user!;
    const companyId = user.companyId;

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
        wuzapiBaseUrl: 'https://private-wuzapi.pbzgje.easypanel.host',
        defaultGoogleCalendarId: null,
        googleCalendarTimezone: 'America/Sao_Paulo',
        adminWhatsappPhone: null,
        enableAppointmentReminders: true,
        reminderHoursBefore: 24,
        enableBirthdayMessages: true,
        enableFeedbackRequests: true,
        feedbackHoursAfter: 24,
        hasWuzapiConfig: false,
        hasGoogleCalendarConfig: false,
      });
    }

    // Mascarar credenciais sensíveis
    const masked = {
      ...settings,
      wuzapiApiKey: settings.wuzapiApiKey ? `***${settings.wuzapiApiKey.slice(-4)}` : null,
      wuzapiWebhookSecret: settings.wuzapiWebhookSecret ? '***' : null,
      hasWuzapiConfig: !!(settings.wuzapiInstanceId && settings.wuzapiApiKey),
      hasGoogleCalendarConfig: !!settings.defaultGoogleCalendarId,
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
    const user = req.user!;
    const companyId = user.companyId;

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
      hasWuzapiConfig: !!(updated.wuzapiInstanceId && updated.wuzapiApiKey),
      hasGoogleCalendarConfig: !!updated.defaultGoogleCalendarId,
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
    const user = req.user!;
    const companyId = user.companyId;

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
      baseUrl: process.env.WUZAPI_BASE_URL || 'http://private_wuzapi:8080',
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
 * POST /api/v1/integrations/test-wuzapi
 * Testa conexão com Wuzapi API 3.0
 */
router.post(
  '/test-wuzapi',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.companyId) return res.status(403).json({ error: "User not associated with any company" });
    const companyId = user.companyId;

    const settings = await storage.getClinicSettings(companyId);

    if (!settings?.wuzapiApiKey) {
      return res.status(400).json({
        success: false,
        error: 'Wuzapi not configured',
        message: 'Configure o token Wuzapi primeiro',
        connected: false,
      });
    }

    const baseUrl = settings.wuzapiBaseUrl || 'https://private-wuzapi.pbzgje.easypanel.host';

    try {
      // Testar status da sessão via API Wuzapi 3.0
      const response = await fetch(`${baseUrl}/session/status`, {
        method: 'GET',
        headers: {
          'token': settings.wuzapiApiKey,
        },
      });

      if (!response.ok) {
        return res.status(500).json({
          success: false,
          message: `Erro HTTP ${response.status}`,
          connected: false,
        });
      }

      const data = await response.json();

      if (data.success !== false) {
        res.json({
          success: true,
          message: 'Conexão com Wuzapi estabelecida com sucesso',
          connected: data.data?.Connected ?? true,
          loggedIn: data.data?.LoggedIn ?? false,
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Wuzapi retornou erro',
          error: data.error || 'Erro desconhecido',
          connected: false,
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Falha ao conectar com Wuzapi',
        error: error.message,
        connected: false,
      });
    }
  })
);

/**
 * POST /api/v1/integrations/send-test-wuzapi
 * Envia mensagem de teste via Wuzapi API 3.0
 */
router.post(
  '/send-test-wuzapi',
  authCheck,
  validate({
    body: z.object({
      phone: z.string().min(10),
      message: z.string().min(1).max(500).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.companyId) return res.status(403).json({ error: "User not associated with any company" });
    const companyId = user.companyId;

    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Apenas administradores podem enviar mensagens de teste',
      });
    }

    const settings = await storage.getClinicSettings(companyId);

    if (!settings?.wuzapiApiKey) {
      return res.status(400).json({
        success: false,
        error: 'Wuzapi not configured',
        message: 'Configure o token Wuzapi primeiro',
      });
    }

    const { phone, message } = req.body;
    const baseUrl = settings.wuzapiBaseUrl || 'https://private-wuzapi.pbzgje.easypanel.host';

    try {
      // Enviar mensagem via API Wuzapi 3.0
      const response = await fetch(`${baseUrl}/chat/send/text`, {
        method: 'POST',
        headers: {
          'token': settings.wuzapiApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Phone: phone,
          Body: message || '🧪 Teste de integração Wuzapi - Sistema de Clínica Dental',
        }),
      });

      const data = await response.json();

      if (data.success !== false && response.ok) {
        res.json({
          success: true,
          message: 'Mensagem de teste enviada com sucesso via Wuzapi',
          messageId: data.data?.Id || null,
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Falha ao enviar mensagem',
          error: data.error || 'Erro desconhecido',
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Falha ao enviar mensagem',
        error: error.message,
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
    const user = req.user!;
    const companyId = user.companyId;

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
      baseUrl: process.env.WUZAPI_BASE_URL || 'http://private_wuzapi:8080',
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

/**
 * GET /api/v1/integrations/config
 * Retorna configurações completas de integrações para o formulário
 */
router.get(
  '/config',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.companyId) return res.status(403).json({ error: "User not associated with any company" });
    const companyId = user.companyId;

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
      company: {
        name: settings?.name || company?.name || '',
        phone: settings?.phone || company?.phone || '',
        address: settings?.address || '',
        googleReviewLink: settings?.googleReviewLink || '',
        googleMapsLink: settings?.googleMapsLink || '',
      },
      evolution: {
        baseUrl: settings?.evolutionApiBaseUrl || '',
        instanceName: settings?.evolutionInstanceName || '',
        apiKey: settings?.evolutionApiKey ? '***' + settings.evolutionApiKey.slice(-4) : '',
      },
      messages: {
        confirmation: settings?.confirmationMessageTemplate || '',
        reminder: settings?.reminderMessageTemplate || '',
        birthday: settings?.birthdayMessageTemplate || '',
        reviewRequest: settings?.reviewRequestTemplate || '',
        cancellation: settings?.cancellationMessageTemplate || '',
      },
    });
  })
);

/**
 * GET /api/v1/integrations/wuzapi/qrcode
 * Busca o QR Code do Wuzapi para conectar o WhatsApp
 * PROVISIONAMENTO AUTOMATICO: Token e configurado automaticamente
 */
router.get(
  '/wuzapi/qrcode',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.companyId) return res.status(403).json({ error: "User not associated with any company" });
    const companyId = user.companyId;

    // Usa o servico de provisionamento automatico
    const result = await WuzapiService.getWuzapiQrCode(companyId);

    if (result.success) {
      res.json({
        success: true,
        connected: result.connected ?? false,
        qrCode: result.qrCode || null,
        message: result.message,
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
        qrCode: null,
      });
    }
  })
);

/**
 * GET /api/v1/integrations/wuzapi/status
 * Verifica status da conexão WhatsApp
 * PROVISIONAMENTO AUTOMATICO: Cria instancia se nao existir
 */
router.get(
  '/wuzapi/status',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.companyId) return res.status(403).json({ error: "User not associated with any company" });
    const companyId = user.companyId;

    // Usa o servico de provisionamento automatico
    const status = await WuzapiService.getWuzapiStatus(companyId);
    res.json(status);
  })
);

/**
 * POST /api/v1/integrations/wuzapi/disconnect
 * Desconecta o WhatsApp (mantem sessao)
 */
router.post(
  '/wuzapi/disconnect',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.companyId) return res.status(403).json({ error: "User not associated with any company" });
    const companyId = user.companyId;

    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Apenas administradores podem desconectar o WhatsApp',
      });
    }

    const result = await WuzapiService.disconnectWuzapi(companyId);
    res.json(result);
  })
);

/**
 * POST /api/v1/integrations/wuzapi/reconnect
 * Inicia sessão do WhatsApp
 * Retorna se precisa escanear QR Code ou se já está autenticado
 */
router.post(
  '/wuzapi/reconnect',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.companyId) return res.status(403).json({ error: "User not associated with any company" });
    const companyId = user.companyId;

    const result = await WuzapiService.reconnectWuzapi(companyId);

    // Sempre retornar 200 se a sessão foi iniciada (mesmo que precise de QR code)
    // O frontend decide o que fazer baseado em loggedIn e needsQrCode
    if (result.success || result.connected) {
      res.json({
        success: true,
        connected: result.connected,
        loggedIn: result.loggedIn,
        needsQrCode: result.needsQrCode,
        message: result.message,
      });
    } else {
      res.status(500).json({
        success: false,
        connected: false,
        loggedIn: false,
        needsQrCode: result.needsQrCode,
        message: result.message,
      });
    }
  })
);

/**
 * POST /api/v1/integrations/wuzapi/connect
 * Inicia conexao com o WhatsApp via Wuzapi 3.0
 * PROVISIONAMENTO AUTOMATICO: Token configurado automaticamente
 */
router.post(
  '/wuzapi/connect',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.companyId) return res.status(403).json({ error: "User not associated with any company" });
    const companyId = user.companyId;

    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Apenas administradores podem conectar o WhatsApp',
      });
    }

    // Usa o servico de provisionamento automatico
    const result = await WuzapiService.connectWuzapi(companyId);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        qrCode: result.qrCode || null,
        connected: result.connected ?? false,
        loggedIn: result.loggedIn ?? false,
        phoneNumber: result.phoneNumber || null,
        webhook: {
          configured: result.webhookConfigured ?? false,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
      });
    }
  })
);

/**
 * POST /api/v1/integrations/wuzapi/webhook
 * Configura o webhook do Wuzapi para receber mensagens
 * IMPORTANTE: Este endpoint configura o Wuzapi para enviar mensagens recebidas para o sistema
 */
router.post(
  '/wuzapi/webhook',
  authCheck,
  validate({
    body: z.object({
      webhookUrl: z.string().url().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.companyId) return res.status(403).json({ error: "User not associated with any company" });
    const companyId = user.companyId;

    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Apenas administradores podem configurar webhooks',
      });
    }

    const settings = await storage.getClinicSettings(companyId);

    if (!settings?.wuzapiApiKey) {
      return res.status(400).json({
        success: false,
        message: 'Configure o token Wuzapi primeiro',
      });
    }

    const baseUrl = settings.wuzapiBaseUrl || 'https://private-wuzapi.pbzgje.easypanel.host';

    // URL do webhook - pode ser customizada ou usar a padrão do sistema
    // A URL padrão aponta para o endpoint de webhook do sistema
    const { webhookUrl } = req.body;
    const systemWebhookUrl = webhookUrl || `${process.env.BASE_URL || 'https://seu-sistema.com'}/api/v1/webhooks/wuzapi/${companyId}`;

    try {
      // Configurar webhook no Wuzapi 3.0
      const response = await fetch(`${baseUrl}/webhook`, {
        method: 'POST',
        headers: {
          'token': settings.wuzapiApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          WebhookURL: systemWebhookUrl,
          Events: ['Message', 'ReadReceipt', 'Presence', 'ChatPresence', 'HistorySync', 'Call'],
        }),
      });

      const data = await response.json();

      if (data.success !== false && response.ok) {
        // Salvar a URL do webhook nas configurações
        await storage.updateClinicSettings(companyId, {
          wuzapiWebhookUrl: systemWebhookUrl,
        });

        res.json({
          success: true,
          message: 'Webhook configurado com sucesso',
          webhookUrl: systemWebhookUrl,
          events: ['Message', 'ReadReceipt', 'Presence', 'ChatPresence', 'HistorySync', 'Call'],
        });
      } else {
        res.status(400).json({
          success: false,
          message: data.error || 'Erro ao configurar webhook',
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Falha ao configurar webhook',
        error: error.message,
      });
    }
  })
);

/**
 * POST /api/v1/integrations/wuzapi/logout
 * Faz logout do WhatsApp (remove sessao permanentemente)
 */
router.post(
  '/wuzapi/logout',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.companyId) return res.status(403).json({ error: "User not associated with any company" });
    const companyId = user.companyId;

    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Apenas administradores podem fazer logout do WhatsApp',
      });
    }

    const result = await WuzapiService.logoutWuzapi(companyId);
    res.json(result);
  })
);

/**
 * GET /api/v1/integrations/wuzapi/webhook-info
 * Retorna informações sobre o webhook configurado
 */
router.get(
  '/wuzapi/webhook-info',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.companyId) return res.status(403).json({ error: "User not associated with any company" });
    const companyId = user.companyId;

    const settings = await storage.getClinicSettings(companyId);

    res.json({
      configured: !!settings?.wuzapiWebhookUrl,
      webhookUrl: settings?.wuzapiWebhookUrl || null,
      expectedUrl: `${process.env.BASE_URL || 'https://seu-sistema.com'}/api/webhooks/wuzapi/${companyId}`,
      instructions: {
        pt: [
          '1. Configure a URL do webhook no Wuzapi para receber mensagens',
          '2. O webhook deve apontar para o endpoint do sistema',
          '3. Eventos suportados: Message, ReadReceipt, Presence, Call',
          '4. As mensagens recebidas serão processadas pelo chat integrado',
        ],
      },
    });
  })
);

/**
 * POST /api/v1/integrations/wuzapi/reconfigure
 * Força reconfiguração de todas as configurações (webhook, S3, HMAC)
 * Útil quando a instância já existe mas precisa atualizar configurações
 */
router.post(
  '/wuzapi/reconfigure',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.companyId) return res.status(403).json({ error: "User not associated with any company" });
    const companyId = user.companyId;

    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Apenas administradores podem reconfigurar o Wuzapi',
      });
    }

    // Usar a função centralizada de reconfiguração
    const result = await WuzapiService.reconfigureWuzapiAll(companyId);

    res.json({
      success: result.success,
      message: result.success
        ? 'Wuzapi reconfigurado com sucesso!'
        : 'Algumas configurações falharam. Verifique os detalhes.',
      results: {
        webhook: result.webhook.success ? 'OK' : result.webhook.message,
        s3: result.s3.success ? 'OK' : result.s3.message,
        hmac: result.hmac.success ? 'OK' : result.hmac.message,
      },
      details: result,
    });
  })
);

/**
 * POST /api/v1/integrations/wuzapi/configure-webhook-only
 * Configura apenas o webhook (para casos onde só precisa do webhook)
 */
router.post(
  '/wuzapi/configure-webhook-only',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.companyId) return res.status(403).json({ error: "User not associated with any company" });
    const companyId = user.companyId;

    const success = await WuzapiService.configureWuzapiWebhook(companyId);

    res.json({
      success,
      message: success ? 'Webhook configurado!' : 'Falha ao configurar webhook',
    });
  })
);

// Comentário para manter compatibilidade com código existente
// O código antigo foi substituído pela função centralizada acima
// Mantendo endpoint legado desabilitado:
/*
router.post(
  '/wuzapi/reconfigure-legacy',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.companyId) return res.status(403).json({ error: "User not associated with any company" });
    const companyId = user.companyId;

    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Apenas administradores podem reconfigurar o Wuzapi',
      });
    }

    const settings = await storage.getClinicSettings(companyId);

    if (!settings?.wuzapiApiKey) {
      return res.status(400).json({
        success: false,
        message: 'Wuzapi não configurado. Configure primeiro via QR Code.',
      });
    }

    const baseUrl = settings.wuzapiBaseUrl || process.env.WUZAPI_BASE_URL || 'http://private_wuzapi:8080';
    const webhookUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/api/webhooks/wuzapi/${companyId}`;

    // S3/MinIO para armazenamento de mídia
    const S3_ENDPOINT = process.env.S3_ENDPOINT || '';
    const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY || '';
    const S3_SECRET_KEY = process.env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY || '';
    const S3_BUCKET = process.env.S3_BUCKET || 'whatsapp-media';
    const S3_REGION = process.env.S3_REGION || 'us-east-1';

    // HMAC para segurança
    const WUZAPI_HMAC_KEY = process.env.WUZAPI_GLOBAL_HMAC_KEY || process.env.WUZAPI_WEBHOOK_SECRET || '';

    const results: any = { webhook: false, s3: false, hmac: false };

    try {
      // 1. Configurar Webhook (formato correto da API Wuzapi 3.0)
      logger.info({ webhookUrl: webhookUrl }, '[Wuzapi Reconfigure] Configurando webhook: {webhookUrl}')
      const webhookResponse = await fetch(`${baseUrl}/webhook`, {
          method: 'POST',
          headers: {
            'Token': settings.wuzapiApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            hmac_key: WUZAPI_HMAC_KEY,
          }),
        });

        const hmacData = await hmacResponse.json().catch(() => ({}));
        logger.info({ data: hmacData }, '[Wuzapi Reconfigure] HMAC response:')
        results.hmac = hmacResponse.ok;
      } else {
        logger.info('[Wuzapi Reconfigure] HMAC não configurado no .env');
        results.hmac = null;
      }

      // Salvar URL do webhook no banco
      await storage.updateClinicSettings(companyId, {
        wuzapiWebhookUrl: webhookUrl,
      });

      res.json({
        success: true,
        message: 'Configurações atualizadas',
        results: {
          webhook: results.webhook ? 'Configurado' : 'Falhou',
          s3: results.s3 === null ? 'Não configurado no .env' : (results.s3 ? 'Configurado' : 'Falhou'),
          hmac: results.hmac === null ? 'Não configurado no .env' : (results.hmac ? 'Configurado' : 'Falhou'),
        },
        webhookUrl,
      });
    } catch (error: any) {
      logger.error({ err: error }, '[Wuzapi Reconfigure] Erro:');
      res.status(500).json({
        success: false,
        message: 'Erro ao reconfigurar',
        error: error.message,
      });
    }
  })
);

/**
 * POST /api/v1/integrations/wuzapi/reset
 * Reseta completamente a instância Wuzapi
 * - Faz logout
 * - Deleta a instância do Wuzapi
 * - Limpa TODOS os campos do banco de dados
 * Usar quando: usuario deletou a instância no dashboard do Wuzapi
 */
router.post(
  '/wuzapi/reset',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.companyId) return res.status(403).json({ error: "User not associated with any company" });
    const companyId = user.companyId;

    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Apenas administradores podem resetar a instância',
      });
    }

    logger.info({ companyId: companyId }, '[API Reset] Resetando instância Wuzapi para company {companyId}')
    const result = await WuzapiService.resetWuzapiInstance(companyId);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
      });
    }
  })
);

// ==========================================
// WHATSAPP PROVIDER SELECTION
// ==========================================

/**
 * GET /api/v1/integrations/whatsapp-provider
 * Retorna info do provider ativo e quais estão configurados
 */
router.get(
  '/whatsapp-provider',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.companyId) return res.status(403).json({ error: 'User not associated with any company' });

    const info = await getWhatsAppProviderInfo(user.companyId);
    res.json(info);
  })
);

/**
 * PUT /api/v1/integrations/whatsapp-provider
 * Define qual provider de WhatsApp usar
 */
router.put(
  '/whatsapp-provider',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.companyId) return res.status(403).json({ error: 'User not associated with any company' });

    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Apenas administradores podem alterar o provider' });
    }

    const { provider } = req.body;
    const validProviders: WhatsAppProviderType[] = ['wuzapi', 'evolution', 'meta_cloud_api'];

    if (!validProviders.includes(provider)) {
      return res.status(400).json({ error: `Provider inválido. Use: ${validProviders.join(', ')}` });
    }

    await db
      .update(clinicSettings)
      .set({ whatsappProvider: provider, updatedAt: new Date() })
      .where(eq(clinicSettings.companyId, user.companyId));

    res.json({ success: true, activeProvider: provider });
  })
);

/**
 * POST /api/v1/integrations/whatsapp-provider/test
 * Testa o provider ativo enviando uma msg de teste
 */
router.post(
  '/whatsapp-provider/test',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.companyId) return res.status(403).json({ error: 'User not associated with any company' });

    const provider = await getWhatsAppProvider(user.companyId);
    if (!provider) {
      return res.status(503).json({ error: 'Nenhum provider WhatsApp configurado' });
    }

    const connection = await provider.checkConnection();
    if (!connection.connected) {
      return res.status(503).json({
        error: 'Provider não está conectado',
        provider: connection.provider,
        details: connection.error,
      });
    }

    const { phone } = req.body;
    if (!phone) {
      return res.json({ connected: true, provider: connection.provider, state: connection.state });
    }

    const result = await provider.sendTextMessage({
      phone,
      message: '✅ Teste de integração WhatsApp realizado com sucesso!',
    });

    res.json({
      success: result.success,
      provider: result.provider,
      messageId: result.messageId,
      error: result.error,
    });
  })
);

/**
 * PUT /api/v1/integrations/meta-cloud-api
 * Configura a API oficial do WhatsApp (Meta Cloud API)
 */
router.put(
  '/meta-cloud-api',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.companyId) return res.status(403).json({ error: 'User not associated with any company' });

    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Apenas administradores podem configurar integrações' });
    }

    const { metaPhoneNumberId, metaAccessToken, metaBusinessAccountId, metaWebhookVerifyToken } = req.body;

    if (!metaPhoneNumberId || !metaAccessToken) {
      return res.status(400).json({ error: 'Phone Number ID e Access Token são obrigatórios' });
    }

    await db
      .update(clinicSettings)
      .set({
        metaPhoneNumberId,
        metaAccessToken,
        metaBusinessAccountId: metaBusinessAccountId || null,
        metaWebhookVerifyToken: metaWebhookVerifyToken || null,
        updatedAt: new Date(),
      })
      .where(eq(clinicSettings.companyId, user.companyId));

    res.json({ success: true, message: 'Meta Cloud API configurada com sucesso' });
  })
);

/**
 * PUT /api/v1/integrations/evolution-api
 * Configura a Evolution API
 */
router.put(
  '/evolution-api',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.companyId) return res.status(403).json({ error: 'User not associated with any company' });

    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Apenas administradores podem configurar integrações' });
    }

    const { evolutionApiBaseUrl, evolutionInstanceName, evolutionApiKey } = req.body;

    if (!evolutionApiBaseUrl || !evolutionInstanceName || !evolutionApiKey) {
      return res.status(400).json({ error: 'URL, Instance Name e API Key são obrigatórios' });
    }

    await db
      .update(clinicSettings)
      .set({
        evolutionApiBaseUrl,
        evolutionInstanceName,
        evolutionApiKey,
        updatedAt: new Date(),
      })
      .where(eq(clinicSettings.companyId, user.companyId));

    res.json({ success: true, message: 'Evolution API configurada com sucesso' });
  })
);

// ==========================================
// AI AGENT: extracted to integrations-ai.routes.ts for maintainability
// ==========================================
import integrationsAiRouter from './integrations-ai.routes';
router.use('/ai-agent', integrationsAiRouter);

export default router;
