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
        wuzapiBaseUrl: 'https://private-wuzapi.pbzgje.easypanel.host',
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
 * POST /api/v1/integrations/test-wuzapi
 * Testa conexão com Wuzapi API 3.0
 */
router.post(
  '/test-wuzapi',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId || 1;

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
    const user = req.user as any;
    const companyId = user?.companyId || 1;

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
 * GET /api/v1/integrations/n8n-workflows/download
 * Gera workflows N8N com configurações preenchidas
 */
router.get(
  '/n8n-workflows/download',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId || 1;

    // Buscar configurações
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

    if (!settings && !company) {
      return res.status(400).json({ error: 'Configure as integrações primeiro' });
    }

    const companyName = settings?.name || company?.name || 'Sua Clínica';
    const safeCompanyName = companyName.replace(/\s+/g, '_');

    // Template de workflow de confirmação
    const confirmationWorkflow = {
      name: `${safeCompanyName}_Confirmacao_Consulta`,
      nodes: [
        {
          parameters: {
            rule: { interval: [{ triggerAtHour: 8 }] }
          },
          name: 'Schedule Trigger',
          type: 'n8n-nodes-base.scheduleTrigger',
          typeVersion: 1.2,
          position: [200, 80]
        },
        {
          parameters: {
            assignments: {
              assignments: [
                { id: 'config-base-url', name: 'base_url', value: settings?.evolutionApiBaseUrl || '{{EVOLUTION_BASE_URL}}', type: 'string' },
                { id: 'config-instance', name: 'evo_name', value: settings?.evolutionInstanceName || '{{EVOLUTION_INSTANCE_NAME}}', type: 'string' },
                { id: 'config-api-key', name: 'api_key', value: settings?.evolutionApiKey || '{{EVOLUTION_API_KEY}}', type: 'string' },
                { id: 'config-company-name', name: 'company_name', value: companyName, type: 'string' },
                { id: 'config-google-review', name: 'google_review_link', value: settings?.googleReviewLink || '{{GOOGLE_REVIEW_LINK}}', type: 'string' }
              ]
            }
          },
          name: 'Configurações',
          type: 'n8n-nodes-base.set',
          typeVersion: 3.4,
          position: [400, 80]
        }
      ],
      connections: { 'Schedule Trigger': { main: [[{ node: 'Configurações', type: 'main', index: 0 }]] } },
      settings: { executionOrder: 'v1' },
      meta: { description: `Workflow de confirmação de consultas para ${companyName}` }
    };

    // Template de workflow de aniversário
    const birthdayWorkflow = {
      name: `${safeCompanyName}_Aniversario`,
      nodes: [
        {
          parameters: { rule: { interval: [{ triggerAtHour: 9 }] } },
          name: 'Schedule Trigger',
          type: 'n8n-nodes-base.scheduleTrigger',
          typeVersion: 1.2,
          position: [200, 80]
        },
        {
          parameters: {
            assignments: {
              assignments: [
                { id: 'config-base-url', name: 'base_url', value: settings?.evolutionApiBaseUrl || '{{EVOLUTION_BASE_URL}}', type: 'string' },
                { id: 'config-instance', name: 'evo_name', value: settings?.evolutionInstanceName || '{{EVOLUTION_INSTANCE_NAME}}', type: 'string' },
                { id: 'config-api-key', name: 'api_key', value: settings?.evolutionApiKey || '{{EVOLUTION_API_KEY}}', type: 'string' },
                { id: 'config-company-name', name: 'company_name', value: companyName, type: 'string' },
                {
                  id: 'config-birthday-message',
                  name: 'birthday_message',
                  value: settings?.birthdayMessageTemplate || `Hoje é um dia especial! 🎉 Estamos comemorando seu aniversário e queremos aproveitar para desejar um ano cheio de felicidade, saúde e muitos sorrisos.\n\nAgradecemos por fazer parte da nossa família ${companyName}. Que seu dia seja tão incrível quanto você! 🥳😁`,
                  type: 'string'
                }
              ]
            }
          },
          name: 'Configurações',
          type: 'n8n-nodes-base.set',
          typeVersion: 3.4,
          position: [400, 80]
        }
      ],
      connections: { 'Schedule Trigger': { main: [[{ node: 'Configurações', type: 'main', index: 0 }]] } },
      settings: { executionOrder: 'v1' },
      meta: { description: `Workflow de aniversário para ${companyName}` }
    };

    // Template de workflow de avaliação
    const reviewWorkflow = {
      name: `${safeCompanyName}_Avaliacao`,
      nodes: [
        {
          parameters: { rule: { interval: [{ triggerAtHour: 18 }] } },
          name: 'Schedule Trigger',
          type: 'n8n-nodes-base.scheduleTrigger',
          typeVersion: 1.2,
          position: [200, 80]
        },
        {
          parameters: {
            assignments: {
              assignments: [
                { id: 'config-base-url', name: 'base_url', value: settings?.evolutionApiBaseUrl || '{{EVOLUTION_BASE_URL}}', type: 'string' },
                { id: 'config-instance', name: 'evo_name', value: settings?.evolutionInstanceName || '{{EVOLUTION_INSTANCE_NAME}}', type: 'string' },
                { id: 'config-api-key', name: 'api_key', value: settings?.evolutionApiKey || '{{EVOLUTION_API_KEY}}', type: 'string' },
                { id: 'config-company-name', name: 'company_name', value: companyName, type: 'string' },
                { id: 'config-google-review', name: 'google_review_link', value: settings?.googleReviewLink || '{{GOOGLE_REVIEW_LINK}}', type: 'string' },
                {
                  id: 'config-review-message',
                  name: 'review_message',
                  value: settings?.reviewRequestTemplate || `Boa noite, {{patientName}}! Agradecemos por ter comparecido à sua consulta na ${companyName}! Foi um prazer cuidar do seu sorriso. 😁\n\nQueremos continuar melhorando, por isso, sua opinião é muito importante! Avalie clicando: ${settings?.googleReviewLink || '{{GOOGLE_REVIEW_LINK}}'}\n\nMuito obrigado! 💙`,
                  type: 'string'
                }
              ]
            }
          },
          name: 'Configurações',
          type: 'n8n-nodes-base.set',
          typeVersion: 3.4,
          position: [400, 80]
        }
      ],
      connections: { 'Schedule Trigger': { main: [[{ node: 'Configurações', type: 'main', index: 0 }]] } },
      settings: { executionOrder: 'v1' },
      meta: { description: `Workflow de solicitação de avaliação para ${companyName}` }
    };

    res.json({
      exportedAt: new Date().toISOString(),
      companyName,
      workflows: [confirmationWorkflow, birthdayWorkflow, reviewWorkflow],
      instructions: {
        pt: [
          '1. Importe cada workflow no N8N',
          '2. Configure as credenciais do Baserow e Google Calendar',
          '3. Ajuste os IDs das tabelas conforme sua configuração',
          '4. Ative os workflows',
          '5. Teste com dados de exemplo antes de usar em produção'
        ],
        placeholders: {
          '{{EVOLUTION_BASE_URL}}': 'URL da sua instância Evolution API',
          '{{EVOLUTION_INSTANCE_NAME}}': 'Nome da sua instância no Evolution',
          '{{EVOLUTION_API_KEY}}': 'API Key da Evolution',
          '{{GOOGLE_REVIEW_LINK}}': 'Link curto para avaliação no Google',
          '{{GOOGLE_CALENDAR_ID}}': 'ID do seu Google Calendar'
        }
      }
    });
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
    const user = req.user as any;
    const companyId = user?.companyId || 1;

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
    const user = req.user as any;
    const companyId = user?.companyId || 1;

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
    const user = req.user as any;
    const companyId = user?.companyId || 1;

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
    const user = req.user as any;
    const companyId = user?.companyId || 1;

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
    const user = req.user as any;
    const companyId = user?.companyId || 1;

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
 * GET /api/v1/integrations/n8n-api-key
 * Retorna a API Key do N8N para a empresa (mascarada)
 */
router.get(
  '/n8n-api-key',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const apiKey = (company as any).n8nApiKey;
    const createdAt = (company as any).n8nApiKeyCreatedAt;

    res.json({
      hasApiKey: !!apiKey,
      apiKeyPreview: apiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : null,
      createdAt: createdAt || null,
    });
  })
);

/**
 * POST /api/v1/integrations/n8n-api-key/generate
 * Gera ou regenera a API Key do N8N para a empresa
 */
router.post(
  '/n8n-api-key/generate',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Apenas administradores podem gerar API Keys',
      });
    }

    // Gerar nova API Key usando crypto
    const crypto = await import('crypto');
    const newApiKey = `n8n_${crypto.randomBytes(32).toString('hex')}`;

    // Atualizar no banco
    await db
      .update(companies)
      .set({
        n8nApiKey: newApiKey,
        n8nApiKeyCreatedAt: new Date(),
      } as any)
      .where(eq(companies.id, companyId));

    res.json({
      success: true,
      message: 'API Key gerada com sucesso',
      apiKey: newApiKey,
      apiKeyPreview: `${newApiKey.substring(0, 8)}...${newApiKey.substring(newApiKey.length - 4)}`,
      createdAt: new Date().toISOString(),
      usage: {
        header: 'X-API-Key',
        example: `curl -H "X-API-Key: ${newApiKey}" https://sua-api.com/api/n8n/...`,
      },
    });
  })
);

/**
 * DELETE /api/v1/integrations/n8n-api-key
 * Revoga a API Key do N8N
 */
router.delete(
  '/n8n-api-key',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Apenas administradores podem revogar API Keys',
      });
    }

    await db
      .update(companies)
      .set({
        n8nApiKey: null,
        n8nApiKeyCreatedAt: null,
      } as any)
      .where(eq(companies.id, companyId));

    res.json({
      success: true,
      message: 'API Key revogada com sucesso',
    });
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
    const user = req.user as any;
    const companyId = user?.companyId || 1;

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
    const user = req.user as any;
    const companyId = user?.companyId || 1;

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
    const user = req.user as any;
    const companyId = user?.companyId || 1;

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
    const user = req.user as any;
    const companyId = user?.companyId || 1;

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
    const user = req.user as any;
    const companyId = user?.companyId || 1;

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
      console.log(`[Wuzapi Reconfigure] Configurando webhook: ${webhookUrl}`);
      const webhookResponse = await fetch(`${baseUrl}/webhook`, {
        method: 'PUT',
        headers: {
          'Token': settings.wuzapiApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhook: webhookUrl,
          events: ['Message', 'ReadReceipt', 'Presence', 'ChatPresence', 'HistorySync', 'All'],
          Active: true,
        }),
      });

      const webhookData = await webhookResponse.json().catch(() => ({}));
      console.log(`[Wuzapi Reconfigure] Webhook response:`, webhookData);
      results.webhook = webhookResponse.ok;

      // 2. Configurar S3 se disponível (endpoint correto: /session/s3/config)
      if (S3_ENDPOINT && S3_ACCESS_KEY && S3_SECRET_KEY) {
        console.log(`[Wuzapi Reconfigure] Configurando S3: ${S3_ENDPOINT}/${S3_BUCKET}`);
        const s3Response = await fetch(`${baseUrl}/session/s3/config`, {
          method: 'POST',
          headers: {
            'Token': settings.wuzapiApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            enabled: true,
            endpoint: S3_ENDPOINT,
            region: S3_REGION,
            bucket: S3_BUCKET,
            access_key: S3_ACCESS_KEY,
            secret_key: S3_SECRET_KEY,
            path_style: true,
            media_delivery: 'proxy', // ou 'direct' se o S3 for público
            retention_days: 0, // 0 = sem limite
          }),
        });

        const s3Data = await s3Response.json().catch(() => ({}));
        console.log(`[Wuzapi Reconfigure] S3 response:`, s3Data);
        results.s3 = s3Response.ok;
      } else {
        console.log('[Wuzapi Reconfigure] S3 não configurado no .env');
        results.s3 = null; // não configurado
      }

      // 3. Configurar HMAC se disponível (endpoint correto: /session/hmac/config)
      if (WUZAPI_HMAC_KEY) {
        console.log('[Wuzapi Reconfigure] Configurando HMAC');
        const hmacResponse = await fetch(`${baseUrl}/session/hmac/config`, {
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
        console.log(`[Wuzapi Reconfigure] HMAC response:`, hmacData);
        results.hmac = hmacResponse.ok;
      } else {
        console.log('[Wuzapi Reconfigure] HMAC não configurado no .env');
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
      console.error('[Wuzapi Reconfigure] Erro:', error);
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
    const user = req.user as any;
    const companyId = user?.companyId || 1;

    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Apenas administradores podem resetar a instância',
      });
    }

    console.log(`[API Reset] Resetando instância Wuzapi para company ${companyId}`);
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

export default router;
