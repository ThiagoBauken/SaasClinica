/**
 * AI Agent Integration Routes
 *
 * Health checks for LLM providers (Anthropic, OpenAI, Ollama), activation
 * status, and enable/disable toggles. Extracted from integrations.routes.ts.
 *
 * Mounted at /api/v1/integrations/ai-agent via integrations.routes.ts.
 */
import { Router } from 'express';
import { authCheck, asyncHandler } from '../middleware/auth';
import { db } from '../db';
import { clinicSettings, companies } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * GET /health
 * Returns the health status of each configured AI provider.
 * Tests connectivity and returns latency for each provider.
 */
router.get(
  '/health',
  authCheck,
  asyncHandler(async (req: any, res) => {
    const user = req.user;
    if (!user.companyId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, user.companyId))
      .limit(1);

    const [company] = await db
      .select({ anthropicApiKey: companies.anthropicApiKey })
      .from(companies)
      .where(eq(companies.id, user.companyId))
      .limit(1);

    const activeProvider = (settings as any)?.aiProvider || 'anthropic';

    const anthropicKey = (settings as any)?.anthropicApiKey || company?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    const openaiKey = (settings as any)?.openaiApiKey || process.env.OPENAI_API_KEY;
    const ollamaUrl = (settings as any)?.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const ollamaModel = (settings as any)?.localAiModel || 'llama3.1:8b';
    const anthropicModel = (settings as any)?.aiAgentModel || 'claude-haiku-4-5-20251001';
    const openaiModel = (settings as any)?.openaiModel || 'gpt-4o-mini';

    async function checkAnthropic(): Promise<{ status: 'healthy' | 'offline' | 'no_key'; latency: number; error?: string }> {
      if (!anthropicKey) {
        return { status: 'no_key', latency: 0, error: 'API key not configured' };
      }
      const start = Date.now();
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: anthropicModel,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'ping' }],
          }),
          signal: AbortSignal.timeout(8000),
        });
        const latency = Date.now() - start;
        if (response.status === 200 || response.status === 400) {
          return { status: 'healthy', latency };
        }
        const body = await response.text();
        return { status: 'offline', latency, error: `HTTP ${response.status}: ${body.slice(0, 100)}` };
      } catch (err: any) {
        return { status: 'offline', latency: Date.now() - start, error: err.message };
      }
    }

    async function checkOpenAI(): Promise<{ status: 'healthy' | 'offline' | 'no_key'; latency: number; error?: string }> {
      if (!openaiKey) {
        return { status: 'no_key', latency: 0, error: 'API key not configured' };
      }
      const start = Date.now();
      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${openaiKey}` },
          signal: AbortSignal.timeout(8000),
        });
        const latency = Date.now() - start;
        if (response.ok) {
          return { status: 'healthy', latency };
        }
        const body = await response.text();
        return { status: 'offline', latency, error: `HTTP ${response.status}: ${body.slice(0, 100)}` };
      } catch (err: any) {
        return { status: 'offline', latency: Date.now() - start, error: err.message };
      }
    }

    async function checkOllama(): Promise<{ status: 'healthy' | 'offline' | 'no_key'; latency: number; error?: string }> {
      const start = Date.now();
      try {
        const response = await fetch(`${ollamaUrl}/api/tags`, {
          signal: AbortSignal.timeout(5000),
        });
        const latency = Date.now() - start;
        if (response.ok) {
          return { status: 'healthy', latency };
        }
        return { status: 'offline', latency, error: `HTTP ${response.status}` };
      } catch (err: any) {
        return { status: 'offline', latency: Date.now() - start, error: err.message };
      }
    }

    const [anthropicResult, openaiResult, ollamaResult] = await Promise.all([
      checkAnthropic(),
      checkOpenAI(),
      checkOllama(),
    ]);

    const providers = [
      {
        name: 'anthropic',
        label: 'Anthropic Claude',
        status: anthropicResult.status,
        model: anthropicModel,
        latency: anthropicResult.latency,
        ...(anthropicResult.error ? { error: anthropicResult.error } : {}),
      },
      {
        name: 'openai',
        label: 'OpenAI ChatGPT',
        status: openaiResult.status,
        model: openaiModel,
        latency: openaiResult.latency,
        ...(openaiResult.error ? { error: openaiResult.error } : {}),
      },
      {
        name: 'ollama',
        label: 'LLM Local (Ollama)',
        status: ollamaResult.status,
        model: ollamaModel,
        latency: ollamaResult.latency,
        ...(ollamaResult.error ? { error: ollamaResult.error } : {}),
      },
    ];

    const activeProviderInfo = providers.find((p) => p.name === activeProvider);
    const isReady = activeProviderInfo?.status === 'healthy';

    res.json({ providers, activeProvider, isReady });
  }),
);

/**
 * GET /status
 * Returns the activation status of the AI Agent for this company.
 */
router.get(
  '/status',
  authCheck,
  asyncHandler(async (req: any, res) => {
    const user = req.user;
    if (!user.companyId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { checkActivation } = await import('../services/ai-agent/activation-check');
    const status = await checkActivation(user.companyId);

    res.json({ success: true, ...status });
  }),
);

/**
 * POST /toggle
 * Enable or disable the AI agent for this company.
 */
router.post(
  '/toggle',
  authCheck,
  asyncHandler(async (req: any, res) => {
    const user = req.user;
    if (!user.companyId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { enabled } = req.body;

    if (enabled) {
      const { checkActivation, invalidateActivationCache } = await import(
        '../services/ai-agent/activation-check'
      );
      const status = await checkActivation(user.companyId);

      if (!status.canActivate) {
        return res.status(400).json({
          success: false,
          error: 'Preencha todos os campos obrigatórios antes de ativar a IA',
          missingRequired: status.missingRequired,
        });
      }

      await db
        .update(clinicSettings)
        .set({ chatEnabled: true, updatedAt: new Date() })
        .where(eq(clinicSettings.companyId, user.companyId));

      invalidateActivationCache(user.companyId);

      return res.json({ success: true, message: 'IA ativada com sucesso' });
    }

    await db
      .update(clinicSettings)
      .set({ chatEnabled: false, updatedAt: new Date() })
      .where(eq(clinicSettings.companyId, user.companyId));

    const { invalidateActivationCache } = await import('../services/ai-agent/activation-check');
    invalidateActivationCache(user.companyId);

    res.json({ success: true, message: 'IA desativada' });
  }),
);

export default router;
