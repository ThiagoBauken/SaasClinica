/**
 * Feature Gate Tests
 *
 * Validates the fail-closed behavior introduced in the billing audit fix:
 *   - getCompanyFeatures() catches DB errors internally and returns free-tier
 *     features (so paid features are denied when we can't verify subscription).
 *   - requireFeature() additionally has a 503 fallback for unexpected throws.
 *   - Superadmin bypass and NOT-in-plan denial work as expected.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module BEFORE importing feature-gate so the mock is applied.
vi.mock('../../server/db', () => {
  const limit = vi.fn();
  return {
    db: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit,
    },
  };
});

import { requireFeature } from '../../server/billing/feature-gate';
import { db } from '../../server/db';

describe('Feature Gate', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Each test uses a fresh companyId to bypass the module-level plan cache.
    mockReq = { user: { id: 1, companyId: Math.floor(Math.random() * 1_000_000) + 1000, role: 'admin' } };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  it('should allow superadmin to bypass feature gate entirely', async () => {
    mockReq.user.role = 'superadmin';
    const middleware = requireFeature('automation.ai' as any);
    await middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    // db should not even be queried for superadmin
    expect(db.limit as any).not.toHaveBeenCalled();
  });

  it('should reject with 401 when user has no companyId', async () => {
    mockReq.user = { id: 1, role: 'staff' };
    const middleware = requireFeature('automation.ai' as any);
    await middleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should allow access when subscription plan includes the feature', async () => {
    // Mock an active "professional" subscription — professional plan
    // includes automation.ai in PLAN_FEATURES.
    (db.limit as any).mockResolvedValue([{ planName: 'professional', status: 'active' }]);

    const middleware = requireFeature('automation.ai' as any);
    await middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should reject with 403 when subscription plan does NOT include the feature', async () => {
    // No subscription → treated as free tier → ai_agent not available.
    (db.limit as any).mockResolvedValue([]);

    const middleware = requireFeature('automation.ai' as any);
    await middleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'FEATURE_NOT_AVAILABLE' }),
      }),
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should fail-closed to free tier on DB error (denying paid features)', async () => {
    // getCompanyFeatures catches DB errors and returns free-tier features,
    // so paid features get a 403 (not a 200 that would leak access).
    (db.limit as any).mockRejectedValue(new Error('DB connection lost'));

    const middleware = requireFeature('automation.ai' as any);
    await middleware(mockReq, mockRes, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(403);
  });
});
