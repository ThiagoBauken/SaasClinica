-- Migration 010: Add missing columns for patients and procedures
-- Created: 2025-12-06

-- Add missing columns to patients table
ALTER TABLE patients ADD COLUMN IF NOT EXISTS treatment_type TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS is_orthodontic_patient BOOLEAN DEFAULT FALSE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS orthodontic_start_date TIMESTAMP;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS orthodontic_expected_end_date TIMESTAMP;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';

-- Add missing columns to procedures table
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS auto_schedule_next BOOLEAN DEFAULT FALSE;
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS send_reminder BOOLEAN DEFAULT TRUE;
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS reminder_hours_before INTEGER DEFAULT 24;
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS follow_up_interval_days INTEGER;

-- Add columns to CRM opportunities if table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'crm_opportunities') THEN
        ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS treatment_type TEXT;
    END IF;
END $$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_patients_treatment_type ON patients(treatment_type);
CREATE INDEX IF NOT EXISTS idx_patients_is_orthodontic ON patients(is_orthodontic_patient) WHERE is_orthodontic_patient = true;
