/**
 * AI Usage Limiter
 *
 * Controls AI usage per tenant based on subscription plan.
 * Uses Redis counters for fast rate limiting and PostgreSQL for persistent tracking.
 *
 * Limits:
 *   - professional: 1000 AI messages/month
 *   - enterprise: 5000 AI messages/month
 *   - free/starter: 0 (AI chatbot not available)
 */

import { redisCacheClient, isRedisAvailable } from '../../redis';
import { db } from '../../db';
import { eq, sql } from 'drizzle-orm';
import { subscriptions, plans } from '@shared/schema';
import { logger } from '../../logger';

const log = logger.child({ module: 'ai-usage-limiter' });

/** Monthly AI message limits by plan tier */
const PLAN_LIMITS: Record<string, number> = {
  free: 0,
  starter: 0,
  professional: 1000,
  enterprise: 5000,
};

/** Default limit if plan name doesn't match known tiers */
const DEFAULT_LIMIT = 100;

/** Cache for plan lookups (5-minute TTL) */
const planCache = new Map<number, { planName: string; limit: number; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

/** In-memory counter fallback when Redis is unavailable */
const memoryCounters = new Map<string, { count: number; expiresAt: number }>();

export interface UsageLimitResult {
  allowed: boolean;
  reason?: string;
  currentUsage?: number;
  monthlyLimit?: number;
}

/**
 * Gets the current month key for Redis counters.
 */
function getMonthKey(companyId: number): string {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `ai:usage:${companyId}:${yearMonth}`;
}

/**
 * Gets the monthly AI message limit for a company based on their plan.
 */
async function getCompanyLimit(companyId: number): Promise<{ planName: string; limit: number }> {
  const cached = planCache.get(companyId);
  if (cached && cached.expiresAt > Date.now()) {
    return { planName: cached.planName, limit: cached.limit };
  }

  try {
    const result = await db
      .select({ planName: plans.name, status: subscriptions.status })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.companyId, companyId))
      .limit(1);

    if (!result.length || !['active', 'trial'].includes(result[0].status)) {
      const entry = { planName: 'free', limit: PLAN_LIMITS.free, expiresAt: Date.now() + CACHE_TTL };
      planCache.set(companyId, entry);
      return { planName: entry.planName, limit: entry.limit };
    }

    const planName = result[0].planName.toLowerCase();
    const limit = PLAN_LIMITS[planName] ?? DEFAULT_LIMIT;

    planCache.set(companyId, { planName, limit, expiresAt: Date.now() + CACHE_TTL });
    return { planName, limit };
  } catch (err) {
    log.error({ err, companyId }, 'Failed to fetch plan for usage limit');
    // On error, allow with default limit to avoid blocking users
    return { planName: 'unknown', limit: DEFAULT_LIMIT };
  }
}

/** Max AI messages per phone number per day (prevents one user from draining the company quota) */
const PER_USER_DAILY_LIMIT = 50;

/**
 * Checks if a company has remaining AI usage for the current month
 * AND if the specific user (phone) hasn't exceeded their daily limit.
 * Returns { allowed: true } if within limits, { allowed: false, reason } if exceeded.
 */
export async function checkAIUsageLimit(companyId: number, phone?: string): Promise<UsageLimitResult> {
  const { planName, limit } = await getCompanyLimit(companyId);

  // Plans with 0 limit don't have AI chatbot access (gated by feature-gate.ts)
  if (limit === 0) {
    return { allowed: true, currentUsage: 0, monthlyLimit: 0 };
  }

  const key = getMonthKey(companyId);
  let currentUsage = 0;

  try {
    const redisAvailable = await isRedisAvailable();
    if (redisAvailable) {
      const stored = await redisCacheClient.get(key);
      currentUsage = stored ? parseInt(stored, 10) : 0;

      // Per-user daily limit: prevents one patient from draining the company quota
      if (phone) {
        const today = new Date().toISOString().split('T')[0];
        const userKey = `ai:user_daily:${companyId}:${phone}:${today}`;
        const userCount = await redisCacheClient.get(userKey);
        if (userCount && parseInt(userCount, 10) >= PER_USER_DAILY_LIMIT) {
          return {
            allowed: false,
            reason: `Limite diário de ${PER_USER_DAILY_LIMIT} mensagens por usuário atingido.`,
            currentUsage: parseInt(userCount, 10),
            monthlyLimit: PER_USER_DAILY_LIMIT,
          };
        }
      }
    } else {
      const mem = memoryCounters.get(key);
      if (mem && mem.expiresAt > Date.now()) {
        currentUsage = mem.count;
      }
    }
  } catch (err) {
    log.warn({ err }, 'Failed to check usage counter');
    return { allowed: true };
  }

  if (currentUsage >= limit) {
    return {
      allowed: false,
      reason: `Limite mensal de ${limit} mensagens IA atingido (plano ${planName}). Uso atual: ${currentUsage}.`,
      currentUsage,
      monthlyLimit: limit,
    };
  }

  return { allowed: true, currentUsage, monthlyLimit: limit };
}

/**
 * Increments the AI usage counter for a company and logs the request.
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
  }
): Promise<void> {
  const key = getMonthKey(companyId);

  // Increment Redis counter
  try {
    const redisAvailable = await isRedisAvailable();
    if (redisAvailable) {
      const newCount = await redisCacheClient.incr(key);
      // Set TTL on first increment (expire at end of month + 1 day buffer)
      if (newCount === 1) {
        const now = new Date();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const ttlSeconds = Math.ceil((endOfMonth.getTime() - now.getTime()) / 1000) + 86400;
        await redisCacheClient.expire(key, ttlSeconds);
      }
    } else {
      // In-memory fallback
      const existing = memoryCounters.get(key);
      const endOfMonth = new Date();
      endOfMonth.setMonth(endOfMonth.getMonth() + 1, 1);
      endOfMonth.setHours(0, 0, 0, 0);

      memoryCounters.set(key, {
        count: (existing?.count || 0) + 1,
        expiresAt: endOfMonth.getTime(),
      });
    }
    // Increment per-user daily counter
    if (data.phone) {
      try {
        const redisOk = await isRedisAvailable();
        if (redisOk) {
          const today = new Date().toISOString().split('T')[0];
          const userKey = `ai:user_daily:${companyId}:${data.phone}:${today}`;
          const userCount = await redisCacheClient.incr(userKey);
          if (userCount === 1) {
            await redisCacheClient.expire(userKey, 86400); // 24h TTL
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
    // Calculate estimated cost in cents (BRL)
    const costCents = estimateCostCents(data.inputTokens, data.outputTokens, data.model);

    await db.execute(sql`
      INSERT INTO ai_usage_logs (company_id, session_id, input_tokens, output_tokens, model, tools_used, latency_ms, estimated_cost_cents, is_injection_attempt, created_at)
      VALUES (${companyId}, ${data.sessionId}, ${data.inputTokens}, ${data.outputTokens}, ${data.model}, ${data.toolsUsed}, ${data.latencyMs}, ${costCents}, ${data.isInjectionAttempt}, NOW())
    `);
  } catch (err) {
    // Table might not exist yet if migration hasn't run — just log
    log.debug({ err }, 'Failed to persist AI usage log (migration may be pending)');
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
