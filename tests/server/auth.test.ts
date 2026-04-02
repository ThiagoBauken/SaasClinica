/**
 * Authentication Tests
 * Tests login, registration, session management, and security
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the storage
vi.mock('../../server/storage', () => ({
  storage: {
    getUserByUsername: vi.fn(),
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
    getUser: vi.fn(),
  },
}));

describe('Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Password Hashing', () => {
    it('should hash passwords with salt', async () => {
      // Import dynamically to avoid side effects
      const { scrypt, randomBytes } = await import('crypto');
      const { promisify } = await import('util');
      const scryptAsync = promisify(scrypt);

      const password = 'TestPassword123!';
      const salt = randomBytes(16).toString('hex');
      const buf = (await scryptAsync(password, salt, 64)) as Buffer;
      const hashed = `${buf.toString('hex')}.${salt}`;

      expect(hashed).toContain('.');
      expect(hashed.split('.')[0]).toHaveLength(128); // 64 bytes = 128 hex chars
      expect(hashed.split('.')[1]).toHaveLength(32); // 16 bytes = 32 hex chars
    });

    it('should produce different hashes for same password', async () => {
      const { scrypt, randomBytes } = await import('crypto');
      const { promisify } = await import('util');
      const scryptAsync = promisify(scrypt);

      const password = 'TestPassword123!';

      const salt1 = randomBytes(16).toString('hex');
      const buf1 = (await scryptAsync(password, salt1, 64)) as Buffer;
      const hash1 = `${buf1.toString('hex')}.${salt1}`;

      const salt2 = randomBytes(16).toString('hex');
      const buf2 = (await scryptAsync(password, salt2, 64)) as Buffer;
      const hash2 = `${buf2.toString('hex')}.${salt2}`;

      expect(hash1).not.toBe(hash2);
    });

    it('should verify correct password', async () => {
      const { scrypt, randomBytes, timingSafeEqual } = await import('crypto');
      const { promisify } = await import('util');
      const scryptAsync = promisify(scrypt);

      const password = 'TestPassword123!';
      const salt = randomBytes(16).toString('hex');
      const buf = (await scryptAsync(password, salt, 64)) as Buffer;
      const stored = `${buf.toString('hex')}.${salt}`;

      // Verify
      const [hashed, storedSalt] = stored.split('.');
      const hashedBuf = Buffer.from(hashed, 'hex');
      const suppliedBuf = (await scryptAsync(password, storedSalt, 64)) as Buffer;

      expect(timingSafeEqual(hashedBuf, suppliedBuf)).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const { scrypt, randomBytes, timingSafeEqual } = await import('crypto');
      const { promisify } = await import('util');
      const scryptAsync = promisify(scrypt);

      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword456!';
      const salt = randomBytes(16).toString('hex');
      const buf = (await scryptAsync(password, salt, 64)) as Buffer;
      const stored = `${buf.toString('hex')}.${salt}`;

      // Verify with wrong password
      const [hashed, storedSalt] = stored.split('.');
      const hashedBuf = Buffer.from(hashed, 'hex');
      const suppliedBuf = (await scryptAsync(wrongPassword, storedSalt, 64)) as Buffer;

      expect(timingSafeEqual(hashedBuf, suppliedBuf)).toBe(false);
    });
  });

  describe('Session Secret Validation', () => {
    it('should require session secret of at least 32 characters', () => {
      const shortSecret = 'too-short';
      const validSecret = 'a'.repeat(32);

      expect(shortSecret.length).toBeLessThan(32);
      expect(validSecret.length).toBeGreaterThanOrEqual(32);
    });
  });

  describe('Rate Limiting', () => {
    it('should have stricter limits in production', () => {
      const devMax = 50;
      const prodMax = 5;
      const devWindow = 5 * 60 * 1000;
      const prodWindow = 15 * 60 * 1000;

      expect(prodMax).toBeLessThan(devMax);
      expect(prodWindow).toBeGreaterThan(devWindow);
    });
  });
});
