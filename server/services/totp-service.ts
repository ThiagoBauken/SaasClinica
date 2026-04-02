/**
 * TOTP (Time-based One-Time Password) Service
 * Provides MFA functionality for healthcare compliance.
 */
import { generateSecret as otpGenerateSecret, generateURI, verifySync } from 'otplib';
import { createHash, randomBytes } from 'crypto';

/** Generate a new TOTP secret for a user */
export function generateTOTPSecret(username: string, clinicName: string = 'DentalSaaS'): {
  secret: string;
  otpauthUrl: string;
  qrCodeUrl: string;
} {
  const secret = otpGenerateSecret();
  const otpauthUrl = generateURI({ secret, issuer: clinicName, label: username });
  const qrCodeUrl = `https://chart.googleapis.com/chart?chs=200x200&chld=M|0&cht=qr&chl=${encodeURIComponent(otpauthUrl)}`;
  return { secret, otpauthUrl, qrCodeUrl };
}

/** Verify a TOTP token against a secret (±1 step tolerance = 30s window) */
export function verifyTOTP(token: string, secret: string): boolean {
  try {
    const result = verifySync({ secret, token });
    return result.valid;
  } catch {
    return false;
  }
}

/** Generate backup codes (10 codes, 8 chars each) */
export function generateBackupCodes(count: number = 10): { plain: string[]; hashed: string[] } {
  const plain: string[] = [];
  const hashed: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = randomBytes(4).toString('hex');
    plain.push(code);
    hashed.push(createHash('sha256').update(code).digest('hex'));
  }
  return { plain, hashed };
}

/** Verify and consume a backup code. Returns remaining hashed codes or null if invalid. */
export function verifyBackupCode(code: string, hashedCodes: string[]): string[] | null {
  const hashedInput = createHash('sha256').update(code).digest('hex');
  const index = hashedCodes.indexOf(hashedInput);
  if (index === -1) return null;
  return [...hashedCodes.slice(0, index), ...hashedCodes.slice(index + 1)];
}
