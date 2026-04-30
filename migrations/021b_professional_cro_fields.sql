-- Add CRO and specialty fields for dental professionals
-- Note: cfo_registration_number/cfo_state already exist for legacy digital-signature use.
-- These new columns are the general-purpose professional council fields exposed to the UI.

ALTER TABLE users ADD COLUMN IF NOT EXISTS cro_number VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS cro_state VARCHAR(2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS specialties JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS professional_council VARCHAR(50); -- CRO, CRM, CRN, etc.

CREATE INDEX IF NOT EXISTS idx_users_cro ON users(cro_number) WHERE cro_number IS NOT NULL;

-- Add auto_emit_nfse flag to fiscal_settings
ALTER TABLE fiscal_settings ADD COLUMN IF NOT EXISTS auto_emit_nfse BOOLEAN NOT NULL DEFAULT FALSE;
