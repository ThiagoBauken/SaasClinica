import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { redisCacheClient } from '../redis';
import { logger } from '../logger';

const log = logger.child({ module: 'webhook-idempotency' });

const REDIS_KEY_PREFIX = 'webhook:seen:';
const DEFAULT_TTL_SECONDS = 86400; // 24 hours
const MEMORY_STORE_MAX_SIZE = 10000;

/**
 * Minimal LRU-like in-memory fallback store.
 *
 * Uses insertion order of a Map: when the size limit is exceeded, the oldest
 * entry (first inserted) is evicted.  This is O(1) for both get and set.
 */
class MemoryIdempotencyStore {
  private readonly store = new Map<string, number>(); // key → expiresAtMs

  has(id: string): boolean {
    const expiresAt = this.store.get(id);
    if (expiresAt === undefined) return false;

    if (Date.now() > expiresAt) {
      this.store.delete(id);
      return false;
    }

    return true;
  }

  set(id: string, ttlSeconds: number): void {
    // Evict oldest entry when at capacity
    if (this.store.size >= MEMORY_STORE_MAX_SIZE) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }

    this.store.set(id, Date.now() + ttlSeconds * 1000);
  }
}

const memoryStore = new MemoryIdempotencyStore();

/**
 * Derive a stable idempotency key from the incoming webhook request.
 *
 * Priority order per provider:
 *   Wuzapi   — data.Id | data.info.Id  (message ID)
 *   Stripe   — stripe-signature header | body.id
 *   MP       — x-request-id header
 *   NOWPay   — body.payment_id
 *   Fallback — SHA-256 of raw body string
 */
function extractWebhookId(req: Request): string {
  const body = req.body ?? {};

  // --- Wuzapi (companyId route and legacy incoming route) ---
  const data = body.data || body.Data;
  if (data) {
    const wuzapiId =
      data.Id ||
      data.id ||
      (data.info && (data.info.Id || data.info.id)) ||
      (data.Info && (data.Info.Id || data.Info.id));

    if (wuzapiId) return String(wuzapiId);
  }

  // --- Stripe ---
  const stripeSig = req.headers['stripe-signature'] as string | undefined;
  if (stripeSig) {
    // stripe-signature contains a timestamp prefix (t=...) that makes it
    // effectively unique per delivery attempt.
    return `stripe:${stripeSig.substring(0, 64)}`;
  }
  if (body.id && typeof body.id === 'string' && body.object) {
    // Stripe event object always has .id and .object fields
    return `stripe:${body.id}`;
  }

  // --- MercadoPago ---
  const mpRequestId = req.headers['x-request-id'] as string | undefined;
  if (mpRequestId) return `mp:${mpRequestId}`;

  // --- NOWPayments ---
  if (body.payment_id !== undefined && body.payment_id !== null) {
    return `nowpay:${String(body.payment_id)}`;
  }

  // --- Generic fallback: SHA-256 of request body ---
  const bodyString =
    typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
  return `hash:${createHash('sha256').update(bodyString).digest('hex')}`;
}

async function isRedisReady(): Promise<boolean> {
  try {
    return (redisCacheClient.status as string) === 'ready';
  } catch {
    return false;
  }
}

export interface WebhookIdempotencyOptions {
  /** Redis key TTL in seconds. Defaults to 86400 (24 hours). */
  ttlSeconds?: number;
}

/**
 * Express middleware that deduplicates webhook deliveries.
 *
 * If the derived webhook ID has been seen before (within the TTL window),
 * the request is short-circuited with HTTP 200 `{ duplicate: true }` so the
 * provider considers it acknowledged.  Otherwise the key is recorded and
 * `next()` is called.
 *
 * Redis is used as the primary store.  When Redis is unavailable the
 * middleware transparently falls back to a bounded in-memory LRU store so
 * webhook processing is never blocked by infrastructure issues.
 */
export function webhookIdempotency(options?: WebhookIdempotencyOptions) {
  const ttl = options?.ttlSeconds ?? DEFAULT_TTL_SECONDS;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let webhookId: string;

    try {
      webhookId = extractWebhookId(req);
    } catch (err) {
      // If ID extraction fails for any reason, pass through rather than
      // silently drop a legitimate webhook.
      log.warn({ err }, 'Failed to extract webhook ID — skipping idempotency check');
      return next();
    }

    const redisKey = `${REDIS_KEY_PREFIX}${webhookId}`;

    try {
      if (await isRedisReady()) {
        // SET key "1" EX <ttl> NX returns "OK" only when the key is new.
        const result = await redisCacheClient.set(redisKey, '1', 'EX', ttl, 'NX');

        if (result === null) {
          // Key already existed — duplicate delivery
          log.info({ webhookId }, 'Duplicate webhook detected (Redis) — skipping');
          res.status(200).json({ duplicate: true });
          return;
        }

        // Key was just set — first delivery, proceed
        return next();
      }
    } catch (err) {
      log.warn({ err, webhookId }, 'Redis error during idempotency check — falling back to memory store');
    }

    // --- In-memory fallback ---
    if (memoryStore.has(webhookId)) {
      log.info({ webhookId }, 'Duplicate webhook detected (memory) — skipping');
      res.status(200).json({ duplicate: true });
      return;
    }

    memoryStore.set(webhookId, ttl);
    return next();
  };
}
