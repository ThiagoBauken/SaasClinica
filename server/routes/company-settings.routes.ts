import { Router } from 'express';
import { db } from '../db';
import { companies } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { authCheck, asyncHandler } from '../middleware/auth';
import { z } from 'zod';
import { validate } from '../middleware/validation';

const router = Router();

// Schema para atualização de configurações
const updateSettingsSchema = z.object({
  openaiApiKey: z.string().optional(),
});

/**
 * GET /api/v1/company/settings
 * Busca as configurações da empresa (OpenAI, etc)
 */
router.get(
  '/settings',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const [company] = await db
      .select({
        id: companies.id,
        name: companies.name,
        email: companies.email,
        phone: companies.phone,
        openaiApiKey: companies.openaiApiKey,
      })
      .from(companies)
      .where(eq(companies.id, companyId));

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Mascarar a chave OpenAI para segurança (mostrar apenas os últimos 4 caracteres)
    const maskedApiKey = company.openaiApiKey
      ? `sk-...${company.openaiApiKey.slice(-4)}`
      : null;

    res.json({
      ...company,
      openaiApiKey: maskedApiKey,
      hasOpenaiApiKey: !!company.openaiApiKey,
    });
  })
);

/**
 * PATCH /api/v1/company/settings
 * Atualiza as configurações da empresa
 * Requer role: admin
 */
router.patch(
  '/settings',
  authCheck,
  validate({ body: updateSettingsSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    // Verificar se o usuário é admin
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Apenas administradores podem atualizar configurações da empresa',
      });
    }

    const { openaiApiKey } = req.body;

    // Construir objeto de atualização
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (openaiApiKey !== undefined) {
      // Validar formato da chave OpenAI
      if (openaiApiKey && !openaiApiKey.startsWith('sk-')) {
        return res.status(400).json({
          error: 'Invalid OpenAI API key format',
          message: 'A chave da OpenAI deve começar com "sk-"',
        });
      }
      updateData.openaiApiKey = openaiApiKey || null;
    }

    // Atualizar no banco
    const [updated] = await db
      .update(companies)
      .set(updateData)
      .where(eq(companies.id, companyId))
      .returning({
        id: companies.id,
        name: companies.name,
        openaiApiKey: companies.openaiApiKey,
      });

    // Mascarar a chave na resposta
    const maskedApiKey = updated.openaiApiKey
      ? `sk-...${updated.openaiApiKey.slice(-4)}`
      : null;

    res.json({
      message: 'Configurações atualizadas com sucesso',
      company: {
        ...updated,
        openaiApiKey: maskedApiKey,
        hasOpenaiApiKey: !!updated.openaiApiKey,
      },
    });
  })
);

/**
 * POST /api/v1/company/openai-key
 * Endpoint para integrações externas buscarem a chave OpenAI
 *
 * Security:
 * - Requires WEBHOOK_SECRET header
 * - Validates companyId matches the API key's company
 * - Uses per-company apiKey for additional verification
 */
router.post(
  '/openai-key',
  asyncHandler(async (req, res) => {
    const { companyId } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'companyId is required' });
    }

    // SECURITY: Always require webhook secret — never skip
    const headerWebhookSecret = req.headers['x-webhook-secret'] as string;
    const serverSecret = process.env.N8N_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET;
    if (!serverSecret) {
      return res.status(503).json({ error: 'WEBHOOK_SECRET not configured on server' });
    }
    if (headerWebhookSecret !== serverSecret) {
      return res.status(403).json({ error: 'Invalid webhook secret' });
    }

    // SECURITY: Also verify per-company API key if provided
    const headerApiKey = req.headers['x-api-key'] as string;
    if (headerApiKey) {
      const [companyByKey] = await db
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.apiKey, headerApiKey));

      if (!companyByKey || companyByKey.id !== companyId) {
        return res.status(403).json({ error: 'API key does not match companyId' });
      }
    }

    const [company] = await db
      .select({
        openaiApiKey: companies.openaiApiKey,
      })
      .from(companies)
      .where(eq(companies.id, companyId));

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    if (!company.openaiApiKey) {
      return res.status(404).json({
        error: 'OpenAI API key not configured',
        message: 'Esta empresa ainda não configurou uma chave da OpenAI',
      });
    }

    res.json({
      companyId,
      openaiApiKey: company.openaiApiKey,
    });
  })
);

export default router;
