-- Migration 017: MFA/TOTP support for healthcare compliance
-- Date: 2026-04-02
-- Priority: P1 (Security - CFO compliance)

ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_backup_codes TEXT; -- JSON array of SHA-256 hashed backup codes

-- Index for quick lookup of MFA-enabled users
CREATE INDEX IF NOT EXISTS idx_users_totp_enabled ON users(totp_enabled) WHERE totp_enabled = true;
