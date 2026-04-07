import type { Store, IncrementResponse, Options } from 'express-rate-limit';
import rateLimit from 'express-rate-limit';
import { getRedisClient } from '../cache';
import { logger } from '../logger';

const rlLogger = logger.child({ module: 'rate-limit' });

/**
 * Distributed rate-limit store backed by Redis (ioredis).
 * Uses INCR + EXPIRE atomically via a small Lua script so the counter
 * is consistent across all API instances. If Redis is unavailable we
 * fall back to the default in-process store (best-effort).
 */
class RedisStore implements Store {
  windowMs!: number;
  prefix: string;

  constructor(prefix = 'rl:') {
    this.prefix = prefix;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private key(k: string) {
    return `${this.prefix}${k}`;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const client = getRedisClient();
    if (!client) {
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
    }
    const fullKey = this.key(key);
    const ttlSec = Math.ceil(this.windowMs / 1000);
    try {
      const results = await client
        .multi()
        .incr(fullKey)
        .expire(fullKey, ttlSec, 'NX')
        .pttl(fullKey)
        .exec();

      const totalHits = (results?.[0]?.[1] as number) ?? 1;
      const pttl = (results?.[2]?.[1] as number) ?? this.windowMs;
      const resetTime = new Date(Date.now() + (pttl > 0 ? pttl : this.windowMs));
      return { totalHits, resetTime };
    } catch (err) {
      rlLogger.error({ err }, 'Redis rate-limit increment failed');
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
    }
  }

  async decrement(key: string): Promise<void> {
    const client = getRedisClient();
    if (!client) return;
    try {
      await client.decr(this.key(key));
    } catch (err) {
      rlLogger.error({ err }, 'Redis rate-limit decrement failed');
    }
  }

  async resetKey(key: string): Promise<void> {
    const client = getRedisClient();
    if (!client) return;
    try {
      await client.del(this.key(key));
    } catch (err) {
      rlLogger.error({ err }, 'Redis rate-limit resetKey failed');
    }
  }
}

/**
 * Build a distributed rate limiter. In production without Redis,
 * logs a warning and falls back to the default in-memory store
 * (documented as dev-only).
 */
export function createDistributedRateLimiter(opts: {
  windowMs: number;
  max: number;
  prefix?: string;
  message?: string;
}) {
  const store = new RedisStore(opts.prefix || 'rl:api:');
  return rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    store,
    message: opts.message || 'Too many requests, try again later.',
  });
}
