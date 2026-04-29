/**
 * Webhook Idempotency Tests
 *
 * Validates that the dedup key extraction prefers stable IDs (like Stripe's
 * event.id) over per-delivery signatures, and that unknown payloads fall back
 * to a hash of the body.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';

// Mock Redis to force the in-memory fallback path — this lets us exercise
// the idempotency logic without a real Redis instance in CI.
vi.mock('../../server/redis', () => ({
  redisCacheClient: {
    status: 'end',
    set: vi.fn(),
  },
  isRedisAvailable: vi.fn().mockResolvedValue(false),
}));

import { webhookIdempotency } from '../../server/middleware/webhook-idempotency';

describe('Webhook Idempotency', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    mockReq = {
      headers: {},
      body: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('Stripe — event.id priority', () => {
    it('should dedupe Stripe webhooks by body.id (event ID) even if signature changes', async () => {
      const middleware = webhookIdempotency();
      const eventBody = { id: 'evt_test_123', object: 'event', type: 'invoice.paid' };

      // First delivery: different signature
      mockReq.body = eventBody;
      mockReq.headers = { 'stripe-signature': 't=1000000000,v1=abc123def456' };
      await middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Second delivery of SAME event.id but with a DIFFERENT signature timestamp
      // (Stripe retry with new signature). Must be recognized as duplicate.
      const mockReq2 = {
        body: eventBody,
        headers: { 'stripe-signature': 't=2000000000,v1=xyz789abc456' },
      };
      const mockRes2 = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      const mockNext2 = vi.fn();
      await middleware(mockReq2 as any, mockRes2 as any, mockNext2);

      expect(mockNext2).not.toHaveBeenCalled();
      expect(mockRes2.status).toHaveBeenCalledWith(200);
      expect(mockRes2.json).toHaveBeenCalledWith({ duplicate: true });
    });

    it('should not dedupe different Stripe events', async () => {
      const middleware = webhookIdempotency();

      mockReq.body = { id: 'evt_first', object: 'event', type: 'invoice.paid' };
      await middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      const mockReq2 = {
        body: { id: 'evt_second', object: 'event', type: 'invoice.paid' },
        headers: {},
      };
      const mockNext2 = vi.fn();
      await middleware(mockReq2 as any, mockRes as any, mockNext2);

      expect(mockNext2).toHaveBeenCalledTimes(1);
    });
  });

  describe('MercadoPago — x-request-id dedup', () => {
    it('should dedupe MercadoPago webhooks by x-request-id', async () => {
      const middleware = webhookIdempotency();

      mockReq.body = { type: 'payment', data: { id: '1234' } };
      mockReq.headers = { 'x-request-id': 'mp-unique-req-id' };
      await middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      const mockReq2 = {
        body: { type: 'payment', data: { id: '1234' } },
        headers: { 'x-request-id': 'mp-unique-req-id' },
      };
      const mockRes2 = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      const mockNext2 = vi.fn();
      await middleware(mockReq2 as any, mockRes2 as any, mockNext2);

      expect(mockNext2).not.toHaveBeenCalled();
      expect(mockRes2.status).toHaveBeenCalledWith(200);
    });
  });

  describe('NOWPayments — payment_id dedup', () => {
    it('should dedupe NOWPayments webhooks by payment_id', async () => {
      const middleware = webhookIdempotency();

      mockReq.body = { payment_id: 'np-payment-42', payment_status: 'confirmed' };
      await middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      const mockReq2 = {
        body: { payment_id: 'np-payment-42', payment_status: 'confirmed' },
        headers: {},
      };
      const mockRes2 = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      const mockNext2 = vi.fn();
      await middleware(mockReq2 as any, mockRes2 as any, mockNext2);

      expect(mockNext2).not.toHaveBeenCalled();
    });
  });

  describe('Fallback — hash of body', () => {
    it('should derive a stable hash key when no provider ID is found', async () => {
      const middleware = webhookIdempotency();

      mockReq.body = { arbitrary: 'data', value: 42 };
      await middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Same body → same hash → dedup
      const mockReq2 = { body: { arbitrary: 'data', value: 42 }, headers: {} };
      const mockRes2 = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      const mockNext2 = vi.fn();
      await middleware(mockReq2 as any, mockRes2 as any, mockNext2);

      expect(mockNext2).not.toHaveBeenCalled();
      expect(mockRes2.status).toHaveBeenCalledWith(200);
    });
  });
});
