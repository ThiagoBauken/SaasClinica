-- Add JSONB settings columns to clinic_settings
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS notification_settings JSONB;
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS financial_settings JSONB;
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS printing_settings JSONB;
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS appearance_settings JSONB;
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS backup_settings JSONB;
