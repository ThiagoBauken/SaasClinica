/**
 * Field-Level Encryption for Sensitive Data (LGPD Art. 11 + Art. 46)
 *
 * Uses AES-256-GCM for authenticated encryption of PII and health data fields.
 * Key must be provided via FIELD_ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
 *
 * Encrypted format: iv(24hex):tag(32hex):ciphertext(hex)
 *
 * Fields that MUST be encrypted before storage:
 *   - CPF, RG (identification documents)
 *   - blood_type, allergies, medications, chronic_diseases (health data)
 *   - Google OAuth tokens
 *   - Third-party API keys (OpenAI, Anthropic)
 */

import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'crypto';
import { logger } from '../logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const TAG_LENGTH = 16;

let encryptionKey: Buffer | null = null;

/**
 * Lazily loads the encryption key from env.
 * Throws if not configured in production.
 */
function getKey(): Buffer {
  if (encryptionKey) return encryptionKey;

  const keyHex = process.env.FIELD_ENCRYPTION_KEY;
  if (!keyHex) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'FIELD_ENCRYPTION_KEY is required in production. Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }
    // Dev fallback — deterministic key so dev data stays readable across restarts
    logger.warn('FIELD_ENCRYPTION_KEY not set — using insecure dev key. DO NOT use in production.');
    encryptionKey = Buffer.from('0'.repeat(64), 'hex');
    return encryptionKey;
  }

  if (keyHex.length !== 64) {
    throw new Error('FIELD_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
  }

  encryptionKey = Buffer.from(keyHex, 'hex');
  return encryptionKey;
}

/**
 * Encrypts a plaintext string field.
 * Returns format: iv(hex):tag(hex):ciphertext(hex)
 *
 * Returns null if input is null/undefined (preserves nullable DB fields).
 */
export function encryptField(plaintext: string | null | undefined): string | null {
  if (plaintext == null || plaintext === '') return null;

  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a field encrypted by encryptField().
 * Returns null if input is null/undefined.
 * Returns the original string if it doesn't look encrypted (migration support).
 */
export function decryptField(stored: string | null | undefined): string | null {
  if (stored == null || stored === '') return null;

  // Check if the value looks like our encrypted format (hex:hex:hex)
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0].length !== IV_LENGTH * 2) {
    // Not encrypted — return as-is (supports gradual migration)
    return stored;
  }

  try {
    const key = getKey();
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const ciphertext = Buffer.from(parts[2], 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (err) {
    // If decryption fails, the value might be plaintext (pre-migration)
    logger.warn({ field: stored.substring(0, 10) + '...' }, 'Failed to decrypt field — returning as-is');
    return stored;
  }
}

/**
 * Generates a deterministic HMAC-based search index for encrypted fields.
 * Allows WHERE queries on encrypted data without decrypting all rows.
 *
 * Usage: Store hmacIndex(cpf) in a separate column `cpf_hash`,
 * then search with WHERE cpf_hash = hmacIndex(searchCpf).
 */
export function hmacIndex(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;

  const key = getKey();
  // Normalize: strip non-alphanumeric chars for consistent matching
  const normalized = value.replace(/\D/g, '').toLowerCase();
  return createHmac('sha256', key).update(normalized).digest('hex');
}

/**
 * Bulk encrypt multiple fields in an object.
 * Only encrypts fields listed in `fieldsToEncrypt`.
 */
export function encryptFields<T extends Record<string, any>>(
  data: T,
  fieldsToEncrypt: (keyof T)[]
): T {
  const result = { ...data };
  for (const field of fieldsToEncrypt) {
    if (result[field] != null && typeof result[field] === 'string') {
      (result as any)[field] = encryptField(result[field] as string);
    }
  }
  return result;
}

/**
 * Bulk decrypt multiple fields in an object.
 */
export function decryptFields<T extends Record<string, any>>(
  data: T,
  fieldsToDecrypt: (keyof T)[]
): T {
  const result = { ...data };
  for (const field of fieldsToDecrypt) {
    if (result[field] != null && typeof result[field] === 'string') {
      (result as any)[field] = decryptField(result[field] as string);
    }
  }
  return result;
}

/**
 * List of patient fields that must be encrypted at rest.
 */
export const PATIENT_ENCRYPTED_FIELDS = [
  'cpf',
  'rg',
  'bloodType',
  'allergies',
  'medications',
  'chronicDiseases',
] as const;

/**
 * List of user fields that must be encrypted at rest.
 */
export const USER_ENCRYPTED_FIELDS = [
  'googleAccessToken',
  'googleRefreshToken',
] as const;

/**
 * List of company fields that must be encrypted at rest.
 */
export const COMPANY_ENCRYPTED_FIELDS = [
  'openaiApiKey',
  'anthropicApiKey',
] as const;
