/**
 * Webhook Signature Verification Tests
 *
 * Validates the constant-time HMAC comparison fix applied to MercadoPago and
 * NOWPayments webhook verification. Both previously used `===` which is
 * vulnerable to timing attacks.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';

describe('MercadoPago webhook signature — timing-safe', () => {
  const SECRET = 'test-mp-secret-32-bytes-long-abc';
  const ORIGINAL_ENV = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = ORIGINAL_ENV;
  });

  const buildSignature = (payload: any, xRequestId: string, ts: string) => {
    const manifest = `id:${payload.data?.id};request-id:${xRequestId};ts:${ts};`;
    const hmac = crypto.createHmac('sha256', SECRET);
    return hmac.update(manifest).digest('hex');
  };

  it('should accept a correctly signed webhook', async () => {
    const { mercadopagoService } = await import('../../server/billing/mercadopago-service');
    const payload = { data: { id: 'payment-123' } };
    const xRequestId = 'req-abc';
    const ts = '1700000000000';
    const validHash = buildSignature(payload, xRequestId, ts);
    const xSignature = `ts=${ts},v1=${validHash}`;

    const result = mercadopagoService.verifyWebhookSignature(payload, xSignature, xRequestId);
    expect(result).toBe(true);
  });

  it('should reject a webhook with wrong hash', async () => {
    const { mercadopagoService } = await import('../../server/billing/mercadopago-service');
    const payload = { data: { id: 'payment-123' } };
    const xSignature = 'ts=1700000000000,v1=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

    const result = mercadopagoService.verifyWebhookSignature(payload, xSignature, 'req-abc');
    expect(result).toBe(false);
  });

  it('should reject a webhook with missing ts/hash parts', async () => {
    const { mercadopagoService } = await import('../../server/billing/mercadopago-service');
    const result = mercadopagoService.verifyWebhookSignature(
      { data: { id: 'x' } },
      'invalid-format',
      'req',
    );
    expect(result).toBe(false);
  });

  it('should reject when secret is not configured', async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = '';
    const { mercadopagoService } = await import('../../server/billing/mercadopago-service');
    const result = mercadopagoService.verifyWebhookSignature(
      { data: { id: 'x' } },
      'ts=1,v1=abc',
      'req',
    );
    expect(result).toBe(false);
  });

  it('should reject mismatched-length hashes without throwing', async () => {
    const { mercadopagoService } = await import('../../server/billing/mercadopago-service');
    // A shorter hex string — our fix returns false on length mismatch instead
    // of throwing inside timingSafeEqual.
    const result = mercadopagoService.verifyWebhookSignature(
      { data: { id: 'x' } },
      'ts=1700000000000,v1=abc123',
      'req',
    );
    expect(result).toBe(false);
  });
});

// Vitest does not expose afterEach at top level when using describe; import it:
import { afterEach } from 'vitest';

describe('NOWPayments webhook signature — timing-safe', () => {
  const SECRET = 'test-np-secret-64-bytes-long-abcdefghij0123456789abcdefghij012345';

  const originalSecret = process.env.NOWPAYMENTS_IPN_SECRET;
  beforeEach(() => {
    process.env.NOWPAYMENTS_IPN_SECRET = SECRET;
  });
  afterEach(() => {
    process.env.NOWPAYMENTS_IPN_SECRET = originalSecret;
  });

  it('should accept a correctly signed payload', async () => {
    // Re-import so the service picks up the env var.
    // NOWPAYMENTS_IPN_SECRET is read at module load, so use a fresh import.
    vi.resetModules();
    process.env.NOWPAYMENTS_IPN_SECRET = SECRET;
    const { nowpaymentsService } = await import('../../server/billing/nowpayments-service');

    const payload = JSON.stringify({ payment_id: 42, status: 'confirmed' });
    const hmac = crypto.createHmac('sha512', SECRET);
    const validSignature = hmac.update(payload).digest('hex');

    const result = nowpaymentsService.verifyWebhookSignature(payload, validSignature);
    expect(result).toBe(true);
  });

  it('should reject a tampered payload', async () => {
    vi.resetModules();
    process.env.NOWPAYMENTS_IPN_SECRET = SECRET;
    const { nowpaymentsService } = await import('../../server/billing/nowpayments-service');

    const payload = JSON.stringify({ payment_id: 42, status: 'confirmed' });
    const hmac = crypto.createHmac('sha512', SECRET);
    const validSignature = hmac.update(payload).digest('hex');

    // Tamper with payload but keep old signature
    const tampered = JSON.stringify({ payment_id: 42, status: 'refunded' });
    const result = nowpaymentsService.verifyWebhookSignature(tampered, validSignature);
    expect(result).toBe(false);
  });

  it('should reject length-mismatched signatures without throwing', async () => {
    vi.resetModules();
    process.env.NOWPAYMENTS_IPN_SECRET = SECRET;
    const { nowpaymentsService } = await import('../../server/billing/nowpayments-service');

    const payload = JSON.stringify({ payment_id: 1 });
    const shortSig = 'deadbeef';
    expect(() =>
      nowpaymentsService.verifyWebhookSignature(payload, shortSig),
    ).not.toThrow();
    expect(nowpaymentsService.verifyWebhookSignature(payload, shortSig)).toBe(false);
  });
});

// vi import for resetModules
import { vi } from 'vitest';
