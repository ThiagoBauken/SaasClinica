-- Migration: Add recurring appointment columns to patients table
-- These columns were added to the schema but may be missing in existing databases

-- Add next_recurring_appointment column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patients' AND column_name = 'next_recurring_appointment'
    ) THEN
        ALTER TABLE patients ADD COLUMN next_recurring_appointment TIMESTAMP;
    END IF;
END $$;

-- Add recurring_interval_days column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patients' AND column_name = 'recurring_interval_days'
    ) THEN
        ALTER TABLE patients ADD COLUMN recurring_interval_days INTEGER DEFAULT 30;
    END IF;
END $$;

-- Add preferred_day_of_week column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patients' AND column_name = 'preferred_day_of_week'
    ) THEN
        ALTER TABLE patients ADD COLUMN preferred_day_of_week INTEGER;
    END IF;
END $$;

-- Add preferred_time_slot column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patients' AND column_name = 'preferred_time_slot'
    ) THEN
        ALTER TABLE patients ADD COLUMN preferred_time_slot TEXT;
    END IF;
END $$;

-- Add is_orthodontic_patient column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patients' AND column_name = 'is_orthodontic_patient'
    ) THEN
        ALTER TABLE patients ADD COLUMN is_orthodontic_patient BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add orthodontic_start_date column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patients' AND column_name = 'orthodontic_start_date'
    ) THEN
        ALTER TABLE patients ADD COLUMN orthodontic_start_date TIMESTAMP;
    END IF;
END $$;

-- Add orthodontic_expected_end_date column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patients' AND column_name = 'orthodontic_expected_end_date'
    ) THEN
        ALTER TABLE patients ADD COLUMN orthodontic_expected_end_date TIMESTAMP;
    END IF;
END $$;

SELECT 'Migration 010 completed - recurring appointment columns added' as status;
