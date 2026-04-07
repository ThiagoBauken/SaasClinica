/**
 * CSRF Protection Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { csrfProtection } from '../../server/middleware/csrf';

describe('CSRF Protection', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/api/test',
      cookies: {},
      headers: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      cookie: vi.fn(),
    };
    mockNext = vi.fn();
  });

  describe('Safe Methods (GET, HEAD, OPTIONS)', () => {
    it('should allow GET requests without token', () => {
      mockReq.method = 'GET';

      csrfProtection(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should set CSRF cookie on GET if not present', () => {
      mockReq.method = 'GET';

      csrfProtection(mockReq, mockRes, mockNext);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        '_csrf_token',
        expect.any(String),
        expect.objectContaining({
          httpOnly: false,
          path: '/',
        }),
      );
    });

    it('should not set cookie if already present', () => {
      mockReq.method = 'GET';
      mockReq.cookies = { _csrf_token: 'existing-token' };

      csrfProtection(mockReq, mockRes, mockNext);

      expect(mockRes.cookie).not.toHaveBeenCalled();
    });
  });

  describe('State-Changing Methods (POST, PUT, DELETE)', () => {
    it('should reject POST without CSRF token', () => {
      mockReq.method = 'POST';

      csrfProtection(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject POST with mismatched tokens', () => {
      mockReq.method = 'POST';
      mockReq.cookies = { _csrf_token: 'token-a' };
      mockReq.headers = { 'x-csrf-token': 'token-b' };

      csrfProtection(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow POST with matching tokens', () => {
      mockReq.method = 'POST';
      const token = 'valid-csrf-token-123';
      mockReq.cookies = { _csrf_token: token };
      mockReq.headers = { 'x-csrf-token': token };

      csrfProtection(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should not rotate token after successful validation (avoids desync)', () => {
      mockReq.method = 'POST';
      const token = 'valid-csrf-token-123';
      mockReq.cookies = { _csrf_token: token };
      mockReq.headers = { 'x-csrf-token': token };

      csrfProtection(mockReq, mockRes, mockNext);

      // Token is NOT rotated to avoid desync between cookie and JS in SPAs
      expect(mockRes.cookie).not.toHaveBeenCalled();
    });
  });

  describe('Bypass Rules', () => {
    it('should skip CSRF only for valid master API key (not any key)', () => {
      // Set the master key in env
      const originalKey = process.env.SAAS_MASTER_API_KEY;
      process.env.SAAS_MASTER_API_KEY = 'valid-master-key';

      mockReq.method = 'POST';
      mockReq.headers = { 'x-api-key': 'valid-master-key' };

      csrfProtection(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // Invalid key should NOT bypass CSRF
      const mockNext2 = vi.fn();
      const mockReq2 = { ...mockReq, headers: { 'x-api-key': 'invalid-key' }, cookies: {} };
      csrfProtection(mockReq2, mockRes, mockNext2);
      expect(mockNext2).not.toHaveBeenCalled();

      process.env.SAAS_MASTER_API_KEY = originalKey;
    });

    it('should skip CSRF for webhook endpoints', () => {
      mockReq.method = 'POST';
      mockReq.path = '/api/webhooks/stripe';

      csrfProtection(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip CSRF for Stripe webhook', () => {
      mockReq.method = 'POST';
      mockReq.path = '/api/stripe/webhook';

      csrfProtection(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip CSRF for public endpoints', () => {
      mockReq.method = 'POST';
      mockReq.path = '/api/public/anamnesis';

      csrfProtection(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
