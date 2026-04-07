/**
 * Per-tenant WhatsApp rate limiting middleware.
 *
 * Protects WhatsApp numbers from bans by enforcing two sliding-window counters
 * per company:
 *   - Hourly  : max 200 outgoing messages
 *   - Daily   : max 1000 outgoing messages
 *
 * Primary store : Redis (INCR + EXPIRE, atomic and shared across instances)
 * Fallback store: In-memory Map (single-instance only, cleared on restart)
 *
 * Redis key pattern:
 *   wa_rate:{companyId}:hour  — TTL 3600 s
 *   wa_rate:{companyId}:day   — TTL 86400 s
 */

import { Request, Response, NextFunction } from 'express';
import { redisClient, isRedisAvailable } from '../redis';
import { logger } from '../logger';
import type { AuthenticatedUser } from '../types/express.d';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HOUR_LIMIT = 200;
const DAY_LIMIT = 1000;

/** Warn operator when a company reaches this fraction of either limit. */
const WARN_THRESHOLD = 0.8;

const HOUR_TTL_S = 60 * 60;       // 3 600 s
const DAY_TTL_S  = 60 * 60 * 24;  // 86 400 s

const rateLimitLogger = logger.child({ module: 'whatsapp-rate-limit' });

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  /** Whether the message is allowed to be sent. */
  allowed: boolean;
  /**
   * The lower of the two remaining budgets (hourly vs daily).
   * Negative values are clamped to 0.
   */
  remaining: number;
  /** The earliest window reset time (i.e. end of the current hour). */
  resetAt: Date;
}

// ---------------------------------------------------------------------------
// In-memory fallback
// ---------------------------------------------------------------------------

interface MemoryEntry {
  count: number;
  expiresAt: number; // Unix ms
}

/** Keyed by the same pattern used for Redis: `wa_rate:{companyId}:hour|day` */
const memoryStore = new Map<string, MemoryEntry>();

/** Remove expired entries every 5 minutes to prevent unbounded growth. */
const MEMORY_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  let pruned = 0;
  for (const [key, entry] of memoryStore) {
    if (entry.expiresAt <= now) {
      memoryStore.delete(key);
      pruned++;
    }
  }
  if (pruned > 0) {
    rateLimitLogger.debug({ pruned }, 'Pruned expired in-memory rate-limit entries');
  }
}, MEMORY_CLEANUP_INTERVAL_MS).unref(); // .unref() so the interval does not keep the process alive

/**
 * Increment an in-memory counter, initialising it with the given TTL if it
 * does not exist yet.  Returns the counter value after increment.
 */
function memoryIncr(key: string, ttlSeconds: number): number {
  const now = Date.now();
  const existing = memoryStore.get(key);

  if (!existing || existing.expiresAt <= now) {
    // First message in this window, or window has expired — reset.
    memoryStore.set(key, { count: 1, expiresAt: now + ttlSeconds * 1000 });
    return 1;
  }

  existing.count += 1;
  return existing.count;
}

function memoryTtlMs(key: string): number {
  const existing = memoryStore.get(key);
  if (!existing) return 0;
  return Math.max(0, existing.expiresAt - Date.now());
}

// ---------------------------------------------------------------------------
// Core rate-check logic
// ---------------------------------------------------------------------------

/**
 * Checks — and increments — the outgoing-message counters for a company.
 *
 * @param companyId  The tenant identifier.
 * @returns          A `RateLimitResult` describing whether the send is allowed.
 */
export async function whatsappRateLimit(companyId: number): Promise<RateLimitResult> {
  const hourKey = `wa_rate:${companyId}:hour`;
  const dayKey  = `wa_rate:${companyId}:day`;

  const nowMs    = Date.now();
  const resetAt  = new Date(nowMs + HOUR_TTL_S * 1000); // end of the current 1-h window

  let hourCount: number;
  let dayCount:  number;

  const redisUp = await isRedisAvailable();

  if (redisUp) {
    // -------------------------------------------------------------------
    // Redis path — use a pipeline so both INCRs are sent in a single
    // round-trip, then conditionally set TTL only on the first message
    // in each window (i.e. when the key was just created).
    // -------------------------------------------------------------------
    try {
      const pipeline = redisClient.pipeline();
      pipeline.incr(hourKey);
      pipeline.incr(dayKey);
      const results = await pipeline.exec();

      // pipeline.exec() returns [Error | null, value][] or null
      if (!results) {
        throw new Error('Redis pipeline returned null');
      }

      const [hourResult, dayResult] = results as [[Error | null, number], [Error | null, number]];

      if (hourResult[0]) throw hourResult[0];
      if (dayResult[0])  throw dayResult[0];

      hourCount = hourResult[1];
      dayCount  = dayResult[1];

      // Set TTL only when the counter was freshly created (count === 1).
      // This avoids overwriting the TTL on subsequent increments.
      const ttlPipeline = redisClient.pipeline();
      if (hourCount === 1) ttlPipeline.expire(hourKey, HOUR_TTL_S);
      if (dayCount  === 1) ttlPipeline.expire(dayKey,  DAY_TTL_S);
      // Fire-and-forget: TTL errors are non-critical
      ttlPipeline.exec().catch((err) => {
        rateLimitLogger.warn({ err, companyId }, 'Failed to set Redis TTL for rate-limit key');
      });
    } catch (err) {
      rateLimitLogger.error(
        { err, companyId },
        'Redis rate-limit check failed — falling back to in-memory store for this request',
      );
      // Fall through to in-memory path
      hourCount = memoryIncr(hourKey, HOUR_TTL_S);
      dayCount  = memoryIncr(dayKey,  DAY_TTL_S);
    }
  } else {
    // -------------------------------------------------------------------
    // In-memory fallback path
    // -------------------------------------------------------------------
    hourCount = memoryIncr(hourKey, HOUR_TTL_S);
    dayCount  = memoryIncr(dayKey,  DAY_TTL_S);

    rateLimitLogger.debug(
      { companyId, hourCount, dayCount },
      'Using in-memory rate-limit store (Redis unavailable)',
    );
  }

  // -------------------------------------------------------------------
  // Evaluate limits and emit warnings
  // -------------------------------------------------------------------
  const hourRemaining = Math.max(0, HOUR_LIMIT - hourCount);
  const dayRemaining  = Math.max(0, DAY_LIMIT  - dayCount);
  const remaining     = Math.min(hourRemaining, dayRemaining);
  const allowed       = hourCount <= HOUR_LIMIT && dayCount <= DAY_LIMIT;

  // Warn when approaching limit so operators can act before a ban occurs.
  if (hourCount >= Math.floor(HOUR_LIMIT * WARN_THRESHOLD) && hourCount <= HOUR_LIMIT) {
    rateLimitLogger.warn(
      { companyId, hourCount, hourLimit: HOUR_LIMIT, hourRemaining },
      'Company approaching hourly WhatsApp send limit',
    );
  }
  if (dayCount >= Math.floor(DAY_LIMIT * WARN_THRESHOLD) && dayCount <= DAY_LIMIT) {
    rateLimitLogger.warn(
      { companyId, dayCount, dayLimit: DAY_LIMIT, dayRemaining },
      'Company approaching daily WhatsApp send limit',
    );
  }

  if (!allowed) {
    rateLimitLogger.warn(
      { companyId, hourCount, dayCount, hourLimit: HOUR_LIMIT, dayLimit: DAY_LIMIT },
      'WhatsApp rate limit exceeded — message blocked',
    );
  }

  return { allowed, remaining, resetAt };
}

// ---------------------------------------------------------------------------
// Express middleware
// ---------------------------------------------------------------------------

/**
 * Express middleware that enforces per-company WhatsApp rate limits.
 *
 * Resolves `companyId` from (in order of preference):
 *   1. `req.user.companyId`  — set by Passport after authentication
 *   2. `req.params.companyId` — for public / webhook routes
 *
 * Responds with HTTP 429 and a JSON body when the limit is exceeded.
 * Attaches `req.whatsappRateLimit` so downstream handlers can read the
 * remaining budget without issuing a second Redis call.
 */
export async function checkWhatsappRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Resolve companyId from authenticated session or route param
  const user = req.user as AuthenticatedUser | undefined;
  const rawParam = req.params.companyId;

  const companyId: number | undefined =
    user?.companyId ??
    (rawParam !== undefined ? parseInt(rawParam, 10) : undefined);

  if (!companyId || isNaN(companyId)) {
    // Cannot identify tenant — skip rate limiting and let auth middleware
    // handle the missing identity with a proper 401/403.
    return next();
  }

  try {
    const result = await whatsappRateLimit(companyId);

    // Make result available to route handlers without a second lookup
    (req as any).whatsappRateLimit = result;

    if (!result.allowed) {
      res.setHeader('Retry-After', String(Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)));
      res.setHeader('X-RateLimit-Limit-Hour', String(HOUR_LIMIT));
      res.setHeader('X-RateLimit-Limit-Day',  String(DAY_LIMIT));
      res.setHeader('X-RateLimit-Remaining',   '0');
      res.setHeader('X-RateLimit-Reset',       String(Math.floor(result.resetAt.getTime() / 1000)));

      res.status(429).json({
        error: 'WhatsApp rate limit exceeded',
        message:
          'Your clinic has reached the maximum number of outgoing WhatsApp messages ' +
          'for the current window. Please wait before sending more messages.',
        resetAt: result.resetAt.toISOString(),
      });
      return;
    }

    // Attach informational headers even on successful requests
    res.setHeader('X-RateLimit-Limit-Hour', String(HOUR_LIMIT));
    res.setHeader('X-RateLimit-Limit-Day',  String(DAY_LIMIT));
    res.setHeader('X-RateLimit-Remaining',   String(result.remaining));
    res.setHeader('X-RateLimit-Reset',       String(Math.floor(result.resetAt.getTime() / 1000)));

    next();
  } catch (err) {
    // Rate-limit errors must never block the application — fail open and log.
    rateLimitLogger.error(
      { err, companyId },
      'Unhandled error in checkWhatsappRateLimit — failing open',
    );
    next();
  }
}
