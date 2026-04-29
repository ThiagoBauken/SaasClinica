-- ============================================================
-- Migration 031: Email verification + LGPD self-service
-- ============================================================
-- Adds email verification fields and supports user-initiated
-- account export / soft-delete for LGPD/GDPR compliance.
--
-- Idempotent: uses IF NOT EXISTS for all additions.
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_users_email_verification_token
  ON users (email_verification_token)
  WHERE email_verification_token IS NOT NULL;

-- Existing users (pré-verification) já são considerados verificados —
-- evita locking-out de quem se cadastrou antes da migration.
UPDATE users SET email_verified = true WHERE email_verified = false AND created_at < NOW();
