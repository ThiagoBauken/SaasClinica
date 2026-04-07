-- Migration: Add deleted_at column to all tables that define it in the Drizzle schema
-- This enables soft-delete functionality across the application.

BEGIN;

-- Helper: Add deleted_at only if column doesn't already exist
DO $$
DECLARE
  tables TEXT[] := ARRAY[
    'users', 'patients', 'appointments', 'procedures',
    'patient_records', 'anamnesis', 'patient_exams',
    'treatment_evolution', 'detailed_treatment_plans',
    'prescriptions', 'digital_signatures', 'periodontal_chart',
    'inventory_items', 'payments',
    'financial_transactions', 'chat_sessions', 'chat_messages',
    'notifications', 'patient_documents', 'odontogram_entries',
    'sales_opportunities', 'commission_records',
    'treatment_plans', 'treatment_plan_procedures'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = tbl AND column_name = 'deleted_at'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN deleted_at TIMESTAMPTZ', tbl);
      RAISE NOTICE 'Added deleted_at to %', tbl;
    END IF;
  END LOOP;
END $$;

-- Also add updated_at where missing
DO $$
DECLARE
  upd_tables TEXT[] := ARRAY[
    'treatment_evolution', 'working_hours', 'patient_exams'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY upd_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_name = tbl
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = tbl AND column_name = 'updated_at'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW()', tbl);
      RAISE NOTICE 'Added updated_at to %', tbl;
    END IF;
  END LOOP;
END $$;

COMMIT;
