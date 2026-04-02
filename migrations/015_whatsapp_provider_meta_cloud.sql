-- Migration 015: WhatsApp Provider Selection + Meta Cloud API
-- Adds provider selection and Meta official API fields to clinic_settings

-- Add provider selection field
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS whatsapp_provider TEXT;

-- Add Meta Cloud API fields
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS meta_phone_number_id TEXT;
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS meta_access_token TEXT;
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS meta_business_account_id TEXT;
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS meta_webhook_verify_token TEXT;

-- Index for webhook routing (find company by phone_number_id)
CREATE INDEX IF NOT EXISTS idx_clinic_settings_meta_phone_number_id
  ON clinic_settings(meta_phone_number_id) WHERE meta_phone_number_id IS NOT NULL;

COMMENT ON COLUMN clinic_settings.whatsapp_provider IS 'Active WhatsApp provider: wuzapi, evolution, or meta_cloud_api';
COMMENT ON COLUMN clinic_settings.meta_phone_number_id IS 'Meta Cloud API Phone Number ID';
COMMENT ON COLUMN clinic_settings.meta_access_token IS 'Meta Cloud API permanent access token';
COMMENT ON COLUMN clinic_settings.meta_business_account_id IS 'WhatsApp Business Account ID';
COMMENT ON COLUMN clinic_settings.meta_webhook_verify_token IS 'Verify token for Meta webhook setup';
