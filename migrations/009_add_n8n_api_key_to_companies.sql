-- Migration: Add n8n_api_key to companies table
-- Date: 2024-12-05
-- Description: Adds API key field for N8N external authentication

BEGIN;

-- Add n8n_api_key column to companies table
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS n8n_api_key TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS n8n_api_key_created_at TIMESTAMP;

-- Add comments
COMMENT ON COLUMN companies.n8n_api_key IS 'Unique API key for N8N authentication via X-API-Key header';
COMMENT ON COLUMN companies.n8n_api_key_created_at IS 'Timestamp when the API key was created/regenerated';

-- Create index for faster API key lookups
CREATE INDEX IF NOT EXISTS idx_companies_n8n_api_key ON companies(n8n_api_key) WHERE n8n_api_key IS NOT NULL;

COMMIT;
