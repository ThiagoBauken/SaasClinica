-- ================================================================
-- Migration 015: Add missing columns to patients table
-- Columns exist in schema.ts but not in the database
-- ================================================================

BEGIN;

-- Identification
ALTER TABLE patients ADD COLUMN IF NOT EXISTS rg TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS nationality TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS marital_status TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS profession TEXT;

-- Contact
ALTER TABLE patients ADD COLUMN IF NOT EXISTS cellphone TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;

-- Address
ALTER TABLE patients ADD COLUMN IF NOT EXISTS neighborhood TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS cep TEXT;

-- Emergency Contact
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact_relation TEXT;

-- Health
ALTER TABLE patients ADD COLUMN IF NOT EXISTS health_insurance_number TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS blood_type TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS medications TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS chronic_diseases TEXT;

-- System
ALTER TABLE patients ADD COLUMN IF NOT EXISTS patient_number TEXT UNIQUE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS profile_photo TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_visit TIMESTAMP;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance_info JSONB;

-- LGPD Consent
ALTER TABLE patients ADD COLUMN IF NOT EXISTS data_processing_consent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS whatsapp_consent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS email_consent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS sms_consent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS consent_date TIMESTAMP;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS consent_ip_address TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS consent_method TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS data_retention_period INTEGER DEFAULT 730;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS data_anonymization_date TIMESTAMP;

-- Follow-up
ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_review_requested_at TIMESTAMP;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS total_appointments INTEGER DEFAULT 0;

-- Tags (from migration 010 but may be missing)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS treatment_type TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS is_orthodontic_patient BOOLEAN DEFAULT false;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS orthodontic_start_date TIMESTAMP;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS orthodontic_expected_end_date TIMESTAMP;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS next_recurring_appointment TIMESTAMP;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS recurring_interval_days INTEGER DEFAULT 30;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS preferred_day_of_week INTEGER;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS preferred_time_slot TEXT;

-- Social Name (required by Brazilian law)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS social_name TEXT;

-- Legal Guardian
ALTER TABLE patients ADD COLUMN IF NOT EXISTS responsible_name TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS responsible_cpf TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS responsible_relationship TEXT;

-- Marketing
ALTER TABLE patients ADD COLUMN IF NOT EXISTS referral_source TEXT;

-- Preferred Dentist
ALTER TABLE patients ADD COLUMN IF NOT EXISTS preferred_dentist_id INTEGER REFERENCES users(id);

COMMIT;
