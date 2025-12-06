import { Router } from 'express';
import { db } from '../db';
import { companies, clinicSettings } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { asyncHandler } from '../middleware/auth';
import { apiKeyAuth, generateApiKey } from '../middleware/apiKeyAuth';

const router = Router();

/**
 * Middleware para autenticar requisições do N8N com API Key Master
 * A API Key Master tem acesso a dados de TODAS as empresas
 */
async function masterApiKeyAuth(req: any, res: any, next: any) {
  const apiKey = req.headers['x-api-key'] as string;
  const masterKey = process.env.SAAS_MASTER_API_KEY;

  if (!masterKey) {
    console.error('SAAS_MASTER_API_KEY não configurada no ambiente');
    return res.status(500).json({ error: 'Master API Key not configured' });
  }

  if (!apiKey || apiKey !== masterKey) {
    return res.status(401).json({
      error: 'Invalid Master API Key',
      message: 'Forneça a API Key Master via header X-API-Key',
    });
  }

  next();
}

/**
 * GET /api/v1/saas/companies/active
 * Retorna TODAS as empresas ativas com suas configurações de integração
 * Usado pelos workflows N8N multi-tenant
 *
 * Requer: Header X-API-Key com a SAAS_MASTER_API_KEY
 */
router.get(
  '/companies/active',
  masterApiKeyAuth,
  asyncHandler(async (req, res) => {
    // Buscar todas empresas ativas
    const activeCompanies = await db
      .select()
      .from(companies)
      .where(eq(companies.active, true));

    // Para cada empresa, buscar suas configurações
    type CompanyRow = typeof activeCompanies[0];
    const companiesWithSettings = await Promise.all(
      activeCompanies.map(async (company: CompanyRow) => {
        const [settings] = await db
          .select()
          .from(clinicSettings)
          .where(eq(clinicSettings.companyId, company.id))
          .limit(1);

        return {
          id: company.id,
          name: company.name,
          email: company.email,
          phone: company.phone,
          active: company.active,
          settings: settings ? {
            // Dados da empresa
            name: settings.name,
            phone: settings.phone,
            address: settings.address,
            // Wuzapi (WhatsApp) - API 3.0 usa token ao invés de instance_id
            wuzapiApiKey: settings.wuzapiApiKey, // Token do usuário Wuzapi
            wuzapiBaseUrl: settings.wuzapiBaseUrl || 'https://wuzapi.cloud',
            // WhatsApp Admin
            adminWhatsappPhone: settings.adminWhatsappPhone,
            // Google
            googleReviewLink: settings.googleReviewLink,
            googleMapsLink: settings.googleMapsLink,
            // Templates de mensagem
            confirmationMessageTemplate: settings.confirmationMessageTemplate,
            reminderMessageTemplate: settings.reminderMessageTemplate,
            birthdayMessageTemplate: settings.birthdayMessageTemplate,
            reviewRequestTemplate: settings.reviewRequestTemplate,
            cancellationMessageTemplate: settings.cancellationMessageTemplate,
            // Preferências
            enableAppointmentReminders: settings.enableAppointmentReminders,
            reminderHoursBefore: settings.reminderHoursBefore,
            enableBirthdayMessages: settings.enableBirthdayMessages,
            enableFeedbackRequests: settings.enableFeedbackRequests,
          } : null,
        };
      })
    );

    res.json({
      success: true,
      count: companiesWithSettings.length,
      data: companiesWithSettings,
    });
  })
);

/**
 * GET /api/v1/saas/company/:companyId/config
 * Retorna configurações de uma empresa específica
 *
 * Requer: Header X-API-Key com a SAAS_MASTER_API_KEY
 */
router.get(
  '/company/:companyId/config',
  masterApiKeyAuth,
  asyncHandler(async (req, res) => {
    const companyId = parseInt(req.params.companyId);

    if (isNaN(companyId)) {
      return res.status(400).json({ error: 'Invalid companyId' });
    }

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    res.json({
      success: true,
      company: {
        id: company.id,
        name: company.name,
        active: company.active,
      },
      settings: settings || null,
    });
  })
);

/**
 * POST /api/v1/saas/company/:companyId/generate-api-key
 * Gera uma nova API Key para uma empresa específica
 *
 * Requer: Autenticação de admin da empresa ou Master API Key
 */
router.post(
  '/company/:companyId/generate-api-key',
  masterApiKeyAuth,
  asyncHandler(async (req, res) => {
    const companyId = parseInt(req.params.companyId);

    if (isNaN(companyId)) {
      return res.status(400).json({ error: 'Invalid companyId' });
    }

    const newApiKey = generateApiKey();

    await db
      .update(companies)
      .set({
        n8nApiKey: newApiKey,
        n8nApiKeyCreatedAt: new Date(),
      })
      .where(eq(companies.id, companyId));

    res.json({
      success: true,
      message: 'API Key gerada com sucesso',
      apiKey: newApiKey,
      companyId,
    });
  })
);

/**
 * GET /api/v1/saas/company-by-wuzapi-token
 * Busca empresa pelo token Wuzapi (para identificar origem de mensagens)
 * Usado pelo workflow de Agente IA multi-tenant
 *
 * Requer: Header X-API-Key com a SAAS_MASTER_API_KEY
 */
router.get(
  '/company-by-wuzapi-token',
  masterApiKeyAuth,
  asyncHandler(async (req, res) => {
    const token = req.query.token as string;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token parameter required',
      });
    }

    // Buscar empresa pelo wuzapiApiKey
    const allSettings = await db.select().from(clinicSettings);
    type ClinicSettingsRow = typeof allSettings[0];
    const matchedSettings = allSettings.find((s: ClinicSettingsRow) => s.wuzapiApiKey === token);

    if (!matchedSettings) {
      return res.status(404).json({
        success: false,
        error: 'Company not found for this Wuzapi token',
      });
    }

    // Buscar dados da empresa
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, matchedSettings.companyId!))
      .limit(1);

    res.json({
      success: true,
      company: {
        id: company?.id || matchedSettings.companyId,
        name: company?.name,
        settings: {
          name: matchedSettings.name,
          phone: matchedSettings.phone,
          address: matchedSettings.address,
          wuzapiApiKey: matchedSettings.wuzapiApiKey,
          wuzapiBaseUrl: matchedSettings.wuzapiBaseUrl || 'https://wuzapi.cloud',
          adminWhatsappPhone: matchedSettings.adminWhatsappPhone,
          googleReviewLink: matchedSettings.googleReviewLink,
        },
      },
    });
  })
);

/**
 * GET /api/v1/saas/stats
 * Retorna estatísticas do SaaS
 */
router.get(
  '/stats',
  masterApiKeyAuth,
  asyncHandler(async (req, res) => {
    const allCompanies = await db.select().from(companies);
    type CompanyStatsRow = typeof allCompanies[0];
    const activeCount = allCompanies.filter((c: CompanyStatsRow) => c.active).length;

    // Buscar empresas com configuração Wuzapi
    const allSettings = await db.select().from(clinicSettings);
    type ClinicSettingsStatsRow = typeof allSettings[0];
    const withWuzapiConfig = allSettings.filter((s: ClinicSettingsStatsRow) => s.wuzapiApiKey && s.wuzapiApiKey.length > 0);

    res.json({
      success: true,
      stats: {
        totalCompanies: allCompanies.length,
        activeCompanies: activeCount,
        inactiveCompanies: allCompanies.length - activeCount,
        companiesWithWuzapiConfig: withWuzapiConfig.length,
      },
    });
  })
);

// ===========================================
// ONBOARDING - Configuração Automática SaaS
// ===========================================

/**
 * POST /api/v1/saas/onboard
 * Onboarding completo de uma nova empresa
 * - Cria configurações iniciais de integração
 * - Configura URL base do Wuzapi compartilhado
 * - Gera API Key para N8N
 *
 * Requer: Master API Key
 *
 * Body:
 * {
 *   companyId: number,
 *   clinicName: string,
 *   adminPhone: string,
 *   wuzapiToken?: string // Se fornecido, usa esse token. Se não, gera um novo
 * }
 */
router.post(
  '/onboard',
  masterApiKeyAuth,
  asyncHandler(async (req, res) => {
    const { companyId, clinicName, adminPhone, wuzapiToken } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'companyId is required',
      });
    }

    // Verificar se a empresa existe
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found',
      });
    }

    // URL base do Wuzapi compartilhado (configurado no env ou padrão)
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://private-wuzapi.pbzgje.easypanel.host';
    const systemBaseUrl = process.env.BASE_URL || 'https://seu-sistema.com';

    // Token do Wuzapi - pode ser fornecido ou gerado
    // Na Opção 1 (compartilhado), cada empresa usa o mesmo token admin
    // mas pode ter tokens individuais no futuro
    const finalWuzapiToken = wuzapiToken || process.env.WUZAPI_ADMIN_TOKEN || '';

    // Gerar API Key para N8N
    const n8nApiKey = generateApiKey();

    // Gerar webhook secret
    const crypto = await import('crypto');
    const webhookSecret = crypto.randomBytes(16).toString('hex');

    // URL do webhook para esta empresa
    const webhookUrl = `${systemBaseUrl}/api/webhooks/wuzapi/${companyId}`;

    // Verificar se já existe configuração
    const [existingSettings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    if (existingSettings) {
      // Atualizar configurações existentes
      await db
        .update(clinicSettings)
        .set({
          name: clinicName || existingSettings.name,
          adminWhatsappPhone: adminPhone || existingSettings.adminWhatsappPhone,
          wuzapiBaseUrl,
          wuzapiApiKey: finalWuzapiToken,
          wuzapiWebhookUrl: webhookUrl,
          wuzapiWebhookSecret: webhookSecret,
          wuzapiStatus: 'disconnected',
          updatedAt: new Date(),
        })
        .where(eq(clinicSettings.companyId, companyId));
    } else {
      // Criar novas configurações
      await db.insert(clinicSettings).values({
        companyId,
        name: clinicName || company.name,
        openingTime: '08:00',
        closingTime: '18:00',
        adminWhatsappPhone: adminPhone,
        wuzapiBaseUrl,
        wuzapiApiKey: finalWuzapiToken,
        wuzapiWebhookUrl: webhookUrl,
        wuzapiWebhookSecret: webhookSecret,
        wuzapiStatus: 'disconnected',
      });
    }

    // Atualizar N8N API Key na empresa
    await db
      .update(companies)
      .set({
        n8nApiKey,
        n8nApiKeyCreatedAt: new Date(),
      })
      .where(eq(companies.id, companyId));

    res.json({
      success: true,
      message: 'Empresa configurada com sucesso para o SaaS',
      data: {
        companyId,
        companyName: company.name,
        integrations: {
          wuzapi: {
            configured: true,
            baseUrl: wuzapiBaseUrl,
            webhookUrl,
            status: 'disconnected',
            nextStep: 'Acesse a página de integrações para conectar o WhatsApp via QR Code',
          },
          n8n: {
            configured: true,
            apiKey: n8nApiKey,
            apiKeyPreview: `${n8nApiKey.substring(0, 8)}...${n8nApiKey.substring(n8nApiKey.length - 4)}`,
          },
        },
        setupUrl: `${systemBaseUrl}/setup?companyId=${companyId}`,
      },
    });
  })
);

/**
 * POST /api/v1/saas/company/:companyId/configure-webhook
 * Configura o webhook do Wuzapi para a empresa
 * Este endpoint é chamado automaticamente após a conexão do WhatsApp
 *
 * Requer: Master API Key ou autenticação de admin da empresa
 */
router.post(
  '/company/:companyId/configure-webhook',
  masterApiKeyAuth,
  asyncHandler(async (req, res) => {
    const companyId = parseInt(req.params.companyId);

    if (isNaN(companyId)) {
      return res.status(400).json({ error: 'Invalid companyId' });
    }

    // Buscar configurações da empresa
    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    if (!settings) {
      return res.status(404).json({
        success: false,
        error: 'Configurações da empresa não encontradas',
      });
    }

    if (!settings.wuzapiApiKey) {
      return res.status(400).json({
        success: false,
        error: 'Token Wuzapi não configurado',
      });
    }

    const baseUrl = settings.wuzapiBaseUrl || 'https://private-wuzapi.pbzgje.easypanel.host';
    const systemBaseUrl = process.env.BASE_URL || 'https://seu-sistema.com';
    const webhookUrl = `${systemBaseUrl}/api/webhooks/wuzapi/${companyId}`;

    try {
      // Configurar webhook no Wuzapi 3.0
      const response = await fetch(`${baseUrl}/webhook`, {
        method: 'POST',
        headers: {
          'token': settings.wuzapiApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          WebhookURL: webhookUrl,
          Events: ['Message', 'ReadReceipt', 'Presence', 'ChatPresence', 'HistorySync', 'Call'],
        }),
      });

      const data = await response.json();

      if (data.success !== false && response.ok) {
        // Atualizar webhook URL nas configurações
        await db
          .update(clinicSettings)
          .set({
            wuzapiWebhookUrl: webhookUrl,
            updatedAt: new Date(),
          })
          .where(eq(clinicSettings.companyId, companyId));

        res.json({
          success: true,
          message: 'Webhook configurado com sucesso',
          webhookUrl,
          events: ['Message', 'ReadReceipt', 'Presence', 'ChatPresence', 'HistorySync', 'Call'],
        });
      } else {
        res.status(400).json({
          success: false,
          error: data.error || 'Erro ao configurar webhook no Wuzapi',
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Falha ao conectar com Wuzapi',
        details: error.message,
      });
    }
  })
);

/**
 * GET /api/v1/saas/company/:companyId/integration-status
 * Retorna o status completo das integrações da empresa
 */
router.get(
  '/company/:companyId/integration-status',
  masterApiKeyAuth,
  asyncHandler(async (req, res) => {
    const companyId = parseInt(req.params.companyId);

    if (isNaN(companyId)) {
      return res.status(400).json({ error: 'Invalid companyId' });
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

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Verificar status do WhatsApp via Wuzapi
    let whatsappStatus = {
      configured: false,
      connected: false,
      loggedIn: false,
      phoneNumber: null as string | null,
    };

    if (settings?.wuzapiApiKey) {
      whatsappStatus.configured = true;
      const baseUrl = settings.wuzapiBaseUrl || 'https://private-wuzapi.pbzgje.easypanel.host';

      try {
        const response = await fetch(`${baseUrl}/session/status`, {
          method: 'GET',
          headers: {
            'token': settings.wuzapiApiKey,
          },
        });

        if (response.ok) {
          const data = await response.json();
          whatsappStatus.connected = data.data?.Connected ?? false;
          whatsappStatus.loggedIn = data.data?.LoggedIn ?? false;
          whatsappStatus.phoneNumber = data.data?.PhoneNumber || null;
        }
      } catch (error) {
        // Erro ao verificar status - mantém como desconectado
      }
    }

    res.json({
      success: true,
      company: {
        id: company.id,
        name: company.name,
        active: company.active,
      },
      integrations: {
        whatsapp: whatsappStatus,
        n8n: {
          configured: !!company.n8nApiKey,
          apiKeyCreatedAt: company.n8nApiKeyCreatedAt,
        },
        googleCalendar: {
          configured: !!settings?.defaultGoogleCalendarId,
        },
        webhook: {
          configured: !!settings?.wuzapiWebhookUrl,
          url: settings?.wuzapiWebhookUrl || null,
        },
      },
      setupComplete: whatsappStatus.loggedIn && !!company.n8nApiKey,
    });
  })
);

/**
 * POST /api/v1/saas/company/:companyId/sync-status
 * Sincroniza o status do WhatsApp e atualiza no banco
 * Chamado periodicamente ou após operações de conexão
 */
router.post(
  '/company/:companyId/sync-status',
  masterApiKeyAuth,
  asyncHandler(async (req, res) => {
    const companyId = parseInt(req.params.companyId);

    if (isNaN(companyId)) {
      return res.status(400).json({ error: 'Invalid companyId' });
    }

    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    if (!settings?.wuzapiApiKey) {
      return res.status(400).json({
        success: false,
        error: 'Wuzapi não configurado para esta empresa',
      });
    }

    const baseUrl = settings.wuzapiBaseUrl || 'https://private-wuzapi.pbzgje.easypanel.host';

    try {
      const response = await fetch(`${baseUrl}/session/status`, {
        method: 'GET',
        headers: {
          'token': settings.wuzapiApiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const connected = data.data?.Connected ?? false;
      const loggedIn = data.data?.LoggedIn ?? false;
      const phoneNumber = data.data?.PhoneNumber || null;

      // Determinar status
      let status = 'disconnected';
      if (loggedIn) {
        status = 'connected';
      } else if (connected) {
        status = 'connecting';
      }

      // Atualizar no banco
      await db
        .update(clinicSettings)
        .set({
          wuzapiStatus: status,
          wuzapiConnectedPhone: phoneNumber,
          wuzapiLastSyncAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(clinicSettings.companyId, companyId));

      res.json({
        success: true,
        status,
        connected,
        loggedIn,
        phoneNumber,
        syncedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Falha ao sincronizar status',
        details: error.message,
      });
    }
  })
);

export default router;
