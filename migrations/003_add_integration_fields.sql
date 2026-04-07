-- Migration: Add integration fields to clinic_settings
-- Date: 2024-12-04
-- Description: Adds Evolution API, Flowise, and Baserow integration fields

-- Evolution API fields
ALTER TABLE clinic_settings
ADD COLUMN IF NOT EXISTS evolution_api_base_url TEXT,
ADD COLUMN IF NOT EXISTS evolution_instance_name TEXT,
ADD COLUMN IF NOT EXISTS evolution_api_key TEXT;

-- Flowise AI fields
ALTER TABLE clinic_settings
ADD COLUMN IF NOT EXISTS flowise_base_url TEXT,
ADD COLUMN IF NOT EXISTS flowise_chatflow_id TEXT;

-- Baserow fields
ALTER TABLE clinic_settings
ADD COLUMN IF NOT EXISTS baserow_api_key TEXT,
ADD COLUMN IF NOT EXISTS baserow_database_id INTEGER,
ADD COLUMN IF NOT EXISTS baserow_patients_table_id INTEGER,
ADD COLUMN IF NOT EXISTS baserow_appointments_table_id INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN clinic_settings.evolution_api_base_url IS 'Base URL for Evolution WhatsApp API';
COMMENT ON COLUMN clinic_settings.evolution_instance_name IS 'Instance name in Evolution API';
COMMENT ON COLUMN clinic_settings.evolution_api_key IS 'API Key for Evolution API authentication';
COMMENT ON COLUMN clinic_settings.flowise_base_url IS 'Base URL for Flowise AI service';
COMMENT ON COLUMN clinic_settings.flowise_chatflow_id IS 'Chatflow ID in Flowise';
COMMENT ON COLUMN clinic_settings.baserow_api_key IS 'API Key for Baserow';
COMMENT ON COLUMN clinic_settings.baserow_database_id IS 'Database ID in Baserow';
COMMENT ON COLUMN clinic_settings.baserow_patients_table_id IS 'Patients table ID in Baserow';
COMMENT ON COLUMN clinic_settings.baserow_appointments_table_id IS 'Appointments table ID in Baserow';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_clinic_settings_company_id ON clinic_settings(company_id);
