/**
 * AI Usage Limiter — fail-closed tests
 *
 * Validates the billing audit fixes:
 *   1. Plans with inputLimit === 0 (AI disabled) must return allowed:false.
 *   2. Redis/infrastructure errors must return allowed:false (fail-closed),
 *      not allowed:true (the old behavior that leaked free tokens).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub the redis and db modules BEFORE importing usage-limiter.
vi.mock('../../server/redis', () => ({
  redisCacheClient: {
    get: vi.fn(),
    set: vi.fn(),
    incrby: vi.fn(),
    expire: vi.fn(),
    pipeline: vi.fn(),
  },
  isRedisAvailable: vi.fn(),
}));

vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { checkAIUsageLimit } from '../../server/services/ai-agent/usage-limiter';
import { isRedisAvailable, redisCacheClient } from '../../server/redis';

describe('AI Usage Limiter — fail-closed behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should deny when plan has inputLimit === 0 (AI disabled)', async () => {
    // db.limit() is the last call in getCompanyLimit — returns [] → free plan (0 limits)
    const result = await checkAIUsageLimit(999, '5511999999999');

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/IA n[ãa]o inclu[ií]da|upgrade/i);
    expect(result.inputLimit).toBe(0);
  });

  it('should deny when Redis error occurs during usage check (fail-closed)', async () => {
    // Force redis available but make the GET throw — simulates network/cluster failure.
    (isRedisAvailable as any).mockResolvedValue(true);
    (redisCacheClient.get as any).mockRejectedValue(new Error('Redis connection timeout'));

    // We need the plan lookup to succeed with non-zero limits so we reach the try/catch
    // around the counter reads. Mock the db chain to return a paid plan.
    const { db } = await import('../../server/db');
    (db.limit as any).mockResolvedValue([
      { planName: 'pro', status: 'active', inputLimit: 1000000, outputLimit: 500000 },
    ]);

    const result = await checkAIUsageLimit(1, '5511999999999');

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/verificar o limite de uso|tente novamente/i);
  });
});
