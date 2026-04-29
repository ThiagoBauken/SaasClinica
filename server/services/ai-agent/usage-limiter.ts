/**
 * AI Usage Limiter — TOKEN-BASED limits (since migration 030)
 *
 * Controls AI usage per tenant based on TOKENS consumed (not messages).
 * Per-message limits punished enterprise clients with long conversations
 * because Sonnet output costs ~5× input. Token limits price accurately.
 *
 * Storage:
 *   - Redis: hot counter `ai:tokens:<companyId>:<YYYY-MM>` → { input, output }
 *     (HASH or two keys, here we use INCRBY on two separate keys for simplicity)
 *   - PostgreSQL: durable monthly aggregates in `usage_metrics` (upsert via
 *     constraint added in migration 029) + per-call audit in `ai_usage_logs`
 *
 * Plan limits come from `plans.ai_input_tokens_monthly` / `ai_output_tokens_monthly`
 * (added in migration 030). Fallback defaults are wired here for plans without
 * the columns populated.
 */

import { redisCacheClient, isRedisAvailable } from '../../redis';
import { db } from '../../db';
import { eq, sql } from 'drizzle-orm';
import { subscriptions, plans } from '@shared/schema';
import { logger } from '../../logger';

const log = logger.child({ module: 'ai-usage-limiter' });

/** Default token limits per plan tier (used when plans table has NULL values) */
const DEFAULT_TOKEN_LIMITS: Record<string, { input: number; output: number }> = {
  free:         { input: 0,        output: 0 },
  starter:      { input: 0,        output: 0 },
  professional: { input: 500_000,  output: 150_000 },
  enterprise:   { input: 2_500_000, output: 750_000 },
};

/** Default fallback when plan name unknown (~R$5 in Haiku, R$50 in Sonnet) */
const DEFAULT_TOKEN_LIMIT = { input: 50_000, output: 15_000 };

/** Cache for plan lookups (5-minute TTL) */
interface PlanCacheEntry {
  planName: string;
  inputLimit: number;   // 0 = AI off, Number.MAX_SAFE_INTEGER = unlimited
  outputLimit: number;
  expiresAt: number;
}
const planCache = new Map<number, PlanCacheEntry>();
const CACHE_TTL = 5 * 60 * 1000;

/** In-memory counter fallback when Redis is unavailable */
const memoryCounters = new Map<string, { input: number; output: number; expiresAt: number }>();

export interface UsageLimitResult {
  allowed: boolean;
  reason?: string;
  currentInputTokens?: number;
  currentOutputTokens?: number;
  inputLimit?: number;
  outputLimit?: number;
}

/**
 * Gets the current month key for Redis counters (separate keys for input/output).
 */
function getMonthKey(companyId: number, kind: 'input' | 'output'): string {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `ai:tokens:${kind}:${companyId}:${yearMonth}`;
}

/**
 * Gets the monthly AI TOKEN limits for a company based on their plan.
 * Reads from `plans.ai_input_tokens_monthly` / `ai_output_tokens_monthly`
 * (NULL = use default for the plan name, 0 = AI disabled).
 */
async function getCompanyLimit(companyId: number): Promise<PlanCacheEntry> {
  const cached = planCache.get(companyId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  try {
    const result = await db
      .select({
        planName: plans.name,
        status: subscriptions.status,
        inputLimit: (plans as any).aiInputTokensMonthly,
        outputLimit: (plans as any).aiOutputTokensMonthly,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.companyId, companyId))
      .limit(1);

    if (!result.length || !['active', 'trial'].includes(result[0].status)) {
      const entry: PlanCacheEntry = {
        planName: 'free',
        inputLimit: 0,
        outputLimit: 0,
        expiresAt: Date.now() + CACHE_TTL,
      };
      planCache.set(companyId, entry);
      return entry;
    }

    const planName = (result[0].planName || '').toLowerCase();
    const dbInput = result[0].inputLimit;
    const dbOutput = result[0].outputLimit;
    const defaults = DEFAULT_TOKEN_LIMITS[planName] ?? DEFAULT_TOKEN_LIMIT;

    // NULL → use default. Number → use exact value (0 = AI disabled).
    const inputLimit = dbInput === null || dbInput === undefined ? defaults.input : Number(dbInput);
    const outputLimit = dbOutput === null || dbOutput === undefined ? defaults.output : Number(dbOutput);

    const entry: PlanCacheEntry = {
      planName,
      inputLimit,
      outputLimit,
      expiresAt: Date.now() + CACHE_TTL,
    };
    planCache.set(companyId, entry);
    return entry;
  } catch (err) {
    log.error({ err, companyId }, 'Failed to fetch plan for usage limit');
    // On error, allow with default limit to avoid blocking users
    return {
      planName: 'unknown',
      inputLimit: DEFAULT_TOKEN_LIMIT.input,
      outputLimit: DEFAULT_TOKEN_LIMIT.output,
      expiresAt: Date.now() + CACHE_TTL,
    };
  }
}

/** Max AI messages per phone number per day (anti-abuse, prevents single user draining quota) */
const PER_USER_DAILY_LIMIT = 50;

/**
 * Checks if a company has remaining AI TOKEN budget for the current month.
 * Plans com `inputLimit === 0` significam AI desabilitado (free/starter).
 * Plans com `Number.MAX_SAFE_INTEGER` significam ilimitado.
 *
 * Per-user daily limit ainda é por mensagem (anti-abuse/spam), não por token.
 */
export async function checkAIUsageLimit(companyId: number, phone?: string): Promise<UsageLimitResult> {
  const { planName, inputLimit, outputLimit } = await getCompanyLimit(companyId);

  // AI disabled for this plan tier — deny access (fail-closed).
  if (inputLimit === 0) {
    return {
      allowed: false,
      reason: `IA não incluída no plano ${planName}. Faça upgrade para usar este recurso.`,
      currentInputTokens: 0,
      currentOutputTokens: 0,
      inputLimit: 0,
      outputLimit: 0,
    };
  }

  const inputKey = getMonthKey(companyId, 'input');
  const outputKey = getMonthKey(companyId, 'output');
  let currentInput = 0;
  let currentOutput = 0;

  try {
    const redisAvailable = await isRedisAvailable();
    if (redisAvailable) {
      const [storedIn, storedOut] = await Promise.all([
        redisCacheClient.get(inputKey),
        redisCacheClient.get(outputKey),
      ]);
      currentInput = storedIn ? parseInt(storedIn, 10) : 0;
      currentOutput = storedOut ? parseInt(storedOut, 10) : 0;

      // Per-user daily anti-abuse cap (still by message count — protects against spam)
      if (phone) {
        const today = new Date().toISOString().split('T')[0];
        const userKey = `ai:user_daily:${companyId}:${phone}:${today}`;
        const userCount = await redisCacheClient.get(userKey);
        if (userCount && parseInt(userCount, 10) >= PER_USER_DAILY_LIMIT) {
          return {
            allowed: false,
            reason: `Limite diário de ${PER_USER_DAILY_LIMIT} mensagens por usuário atingido.`,
            currentInputTokens: currentInput,
            currentOutputTokens: currentOutput,
            inputLimit,
            outputLimit,
          };
        }
      }
    } else {
      const mem = memoryCounters.get(inputKey);
      if (mem && mem.expiresAt > Date.now()) {
        currentInput = mem.input;
        currentOutput = mem.output;
      }
    }
  } catch (err) {
    log.warn({ err }, 'Failed to check usage counter');
    // Fail-closed: deny access when we cannot verify usage, protecting revenue
    // from infrastructure failures (Redis outage, DB hiccup, etc).
    return {
      allowed: false,
      reason: 'Não foi possível verificar o limite de uso no momento. Tente novamente em instantes.',
    };
  }

  // Check both limits — exceed EITHER and you're cut off
  if (currentInput >= inputLimit) {
    return {
      allowed: false,
      reason: `Limite mensal de ${inputLimit.toLocaleString('pt-BR')} tokens de entrada atingido (plano ${planName}).`,
      currentInputTokens: currentInput,
      currentOutputTokens: currentOutput,
      inputLimit,
      outputLimit,
    };
  }

  if (currentOutput >= outputLimit) {
    return {
      allowed: false,
      reason: `Limite mensal de ${outputLimit.toLocaleString('pt-BR')} tokens de saída atingido (plano ${planName}).`,
      currentInputTokens: currentInput,
      currentOutputTokens: currentOutput,
      inputLimit,
      outputLimit,
    };
  }

  return {
    allowed: true,
    currentInputTokens: currentInput,
    currentOutputTokens: currentOutput,
    inputLimit,
    outputLimit,
  };
}

/**
 * Increments AI token counters and logs the request.
 *
 * Token-based since migration 030. Both input and output tokens are tracked
 * separately because output costs ~5× input on Sonnet — accurate billing
 * requires both.
 */
export async function trackAIUsage(
  companyId: number,
  data: {
    sessionId: number;
    inputTokens: number;
    outputTokens: number;
    model: string;
    toolsUsed: string[];
    latencyMs: number;
    isInjectionAttempt: boolean;
    phone?: string;
    /** ID do snapshot do system prompt (auditoria — opcional) */
    promptSnapshotId?: number | null;
  }
): Promise<void> {
  const inputKey = getMonthKey(companyId, 'input');
  const outputKey = getMonthKey(companyId, 'output');

  // Increment Redis token counters
  try {
    const redisAvailable = await isRedisAvailable();
    if (redisAvailable) {
      const newInput = await redisCacheClient.incrby(inputKey, data.inputTokens);
      const newOutput = await redisCacheClient.incrby(outputKey, data.outputTokens);

      // Set TTL on first increment (expire at end of month + 1 day buffer)
      if (newInput === data.inputTokens && data.inputTokens > 0) {
        const now = new Date();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const ttlSeconds = Math.ceil((endOfMonth.getTime() - now.getTime()) / 1000) + 86400;
        await redisCacheClient.expire(inputKey, ttlSeconds);
      }
      if (newOutput === data.outputTokens && data.outputTokens > 0) {
        const now = new Date();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const ttlSeconds = Math.ceil((endOfMonth.getTime() - now.getTime()) / 1000) + 86400;
        await redisCacheClient.expire(outputKey, ttlSeconds);
      }
    } else {
      // In-memory fallback
      const existing = memoryCounters.get(inputKey);
      const endOfMonth = new Date();
      endOfMonth.setMonth(endOfMonth.getMonth() + 1, 1);
      endOfMonth.setHours(0, 0, 0, 0);

      memoryCounters.set(inputKey, {
        input: (existing?.input || 0) + data.inputTokens,
        output: (existing?.output || 0) + data.outputTokens,
        expiresAt: endOfMonth.getTime(),
      });
    }

    // Per-user daily anti-abuse counter (still by message count)
    if (data.phone) {
      try {
        const redisOk = await isRedisAvailable();
        if (redisOk) {
          const today = new Date().toISOString().split('T')[0];
          const userKey = `ai:user_daily:${companyId}:${data.phone}:${today}`;
          const userCount = await redisCacheClient.incr(userKey);
          if (userCount === 1) {
            await redisCacheClient.expire(userKey, 86400);
          }
        }
      } catch (userErr) {
        log.debug({ userErr }, 'Failed to increment per-user daily counter');
      }
    }
  } catch (err) {
    log.warn({ err }, 'Failed to increment usage counter');
  }

  // Persist to ai_usage_logs table (async, non-blocking)
  try {
    const costCents = estimateCostCents(data.inputTokens, data.outputTokens, data.model);

    if (data.promptSnapshotId) {
      await db.execute(sql`
        INSERT INTO ai_usage_logs (
          company_id, session_id, input_tokens, output_tokens, model, tools_used,
          latency_ms, estimated_cost_cents, is_injection_attempt, prompt_snapshot_id, created_at
        ) VALUES (
          ${companyId}, ${data.sessionId}, ${data.inputTokens}, ${data.outputTokens},
          ${data.model}, ${data.toolsUsed}, ${data.latencyMs}, ${costCents},
          ${data.isInjectionAttempt}, ${data.promptSnapshotId}, NOW()
        )
      `);
    } else {
      await db.execute(sql`
        INSERT INTO ai_usage_logs (
          company_id, session_id, input_tokens, output_tokens, model, tools_used,
          latency_ms, estimated_cost_cents, is_injection_attempt, created_at
        ) VALUES (
          ${companyId}, ${data.sessionId}, ${data.inputTokens}, ${data.outputTokens},
          ${data.model}, ${data.toolsUsed}, ${data.latencyMs}, ${costCents},
          ${data.isInjectionAttempt}, NOW()
        )
      `);
    }
  } catch (err) {
    log.debug({ err }, 'Failed to persist AI usage log (migration may be pending)');
  }

  // Persist monthly aggregate to usage_metrics (durable, survives Redis flush)
  // Uses upsert via the unique constraint added in migration 029.
  try {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    await db.execute(sql`
      INSERT INTO usage_metrics (company_id, metric_type, period_start, period_end, current_value, updated_at)
      VALUES (${companyId}, 'ai_tokens_input', ${periodStart}, ${periodEnd}, ${data.inputTokens}, NOW())
      ON CONFLICT (company_id, metric_type, period_start)
      DO UPDATE SET current_value = usage_metrics.current_value + ${data.inputTokens}, updated_at = NOW()
    `);
    await db.execute(sql`
      INSERT INTO usage_metrics (company_id, metric_type, period_start, period_end, current_value, updated_at)
      VALUES (${companyId}, 'ai_tokens_output', ${periodStart}, ${periodEnd}, ${data.outputTokens}, NOW())
      ON CONFLICT (company_id, metric_type, period_start)
      DO UPDATE SET current_value = usage_metrics.current_value + ${data.outputTokens}, updated_at = NOW()
    `);
  } catch (err) {
    log.debug({ err }, 'Failed to upsert usage_metrics aggregate');
  }
}

/**
 * Estimates cost in BRL cents based on token usage and model.
 * Uses approximate pricing as of 2026.
 */
function estimateCostCents(inputTokens: number, outputTokens: number, model: string): number {
  // Pricing per 1M tokens (USD)
  const pricing: Record<string, { input: number; output: number }> = {
    'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
    'claude-sonnet-4-6-20250514': { input: 3.00, output: 15.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
  };

  const rate = pricing[model] || pricing['claude-haiku-4-5-20251001'];
  const costUSD = (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;

  // Convert USD to BRL cents (approximate rate: 1 USD = 5.2 BRL)
  const costBRLCents = Math.round(costUSD * 5.2 * 100);
  return costBRLCents;
}

/**
 * Clears the plan cache for a company (call when subscription changes).
 */
export function clearUsageLimitCache(companyId?: number): void {
  if (companyId) {
    planCache.delete(companyId);
  } else {
    planCache.clear();
  }
}
