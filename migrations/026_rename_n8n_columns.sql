-- =============================================================================
-- Migration 026: Rename N8N columns to generic names
-- Date: 2026-04-04
-- N8N was fully replaced by the native AI Agent. This migration:
--   1. Renames active columns (api_key) to generic names
--   2. Drops deprecated columns that are no longer used
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. RENAME ACTIVE COLUMNS: companies.n8n_api_key → companies.api_key
-- =============================================================================

-- Rename the column
ALTER TABLE companies RENAME COLUMN n8n_api_key TO api_key;
ALTER TABLE companies RENAME COLUMN n8n_api_key_created_at TO api_key_created_at;

-- Rename the encrypted shadow column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'n8n_api_key_enc'
  ) THEN
    ALTER TABLE companies RENAME COLUMN n8n_api_key_enc TO api_key_enc;
  END IF;
END $$;

-- Rename the unique index
DROP INDEX IF EXISTS idx_companies_n8n_api_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_api_key ON companies(api_key) WHERE api_key IS NOT NULL;


-- =============================================================================
-- 2. DROP DEPRECATED COLUMNS (no longer used by any code)
-- =============================================================================

-- companies.n8n_webhook_url — was only used by N8N service (deleted)
ALTER TABLE companies DROP COLUMN IF EXISTS n8n_webhook_url;

-- automations.n8n_workflow_id — was only used by N8N service (deleted)
ALTER TABLE automations DROP COLUMN IF EXISTS n8n_workflow_id;

-- clinic_settings.n8n_webhook_base_url — was only used by N8N service (deleted)
ALTER TABLE clinic_settings DROP COLUMN IF EXISTS n8n_webhook_base_url;


COMMIT;
