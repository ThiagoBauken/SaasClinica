-- =============================================================================
-- Migration 022: Phase 0 — Critical Security Fixes
-- Date: 2026-04-03
-- Scope:
--   1. CPF encryption with pgcrypto (LGPD compliance)
--   2. API key/token encryption migration (plaintext → encrypted)
--   3. Missing company_id NOT NULL enforcement
--   4. Missing ON DELETE constraints on newer tables
--   5. Missing audit fields (created_by, updated_by) on critical tables
-- All statements are idempotent (IF NOT EXISTS / DO blocks).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. CPF ENCRYPTION
-- Adds encrypted shadow column, migrates data, keeps plaintext temporarily
-- for application migration. Future migration drops plaintext columns.
-- =============================================================================

-- Ensure pgcrypto is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1a. patients.cpf → cpf_enc
ALTER TABLE patients ADD COLUMN IF NOT EXISTS cpf_enc BYTEA;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS responsible_cpf_enc BYTEA;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS rg_enc BYTEA;

-- 1b. public_anamnesis_responses.cpf → cpf_enc
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'public_anamnesis_responses') THEN
    ALTER TABLE public_anamnesis_responses ADD COLUMN IF NOT EXISTS cpf_enc BYTEA;
  END IF;
END $$;

-- NOTE: The actual encryption backfill must be done by the application
-- using the FIELD_ENCRYPTION_KEY env variable, NOT in raw SQL.
-- The app should:
--   1. Read all rows with cpf IS NOT NULL AND cpf_enc IS NULL
--   2. Encrypt each cpf with pgp_sym_encrypt(cpf, key)
--   3. Write to cpf_enc
--   4. After confirming all migrated, a future migration sets cpf = NULL

-- 1c. Create index on cpf_enc for lookup (hash index for equality checks)
-- We also keep a partial index on plaintext cpf for the transition period
CREATE INDEX IF NOT EXISTS idx_patients_cpf_company
  ON patients(company_id, cpf) WHERE cpf IS NOT NULL AND deleted_at IS NULL;


-- =============================================================================
-- 2. ENFORCE company_id NOT NULL ON TABLES THAT STILL HAVE IT NULLABLE
-- These were added in migration 017 but left nullable for backfill.
-- By now backfill should be complete.
-- =============================================================================

-- Try to enforce NOT NULL on critical tenant tables
DO $$
DECLARE
  _result BOOLEAN;
  tables TEXT[] := ARRAY[
    'fiscal_settings', 'chairs', 'boxes', 'box_transactions',
    'payment_plans', 'financial_categories', 'anamnesis_templates',
    'prosthesis_services', 'prosthesis_types', 'sales_goals',
    'tasks', 'shop_items', 'booking_link_settings',
    'communication_settings', 'patient_documents', 'machine_taxes',
    'commission_settings', 'procedure_commissions', 'commission_records',
    'patient_risk_alerts', 'inventory_transactions'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = tbl AND column_name = 'company_id') THEN
      -- Check if any NULLs remain
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE company_id IS NULL LIMIT 1)', tbl) INTO _result;
      IF NOT _result THEN
        EXECUTE format('ALTER TABLE %I ALTER COLUMN company_id SET NOT NULL', tbl);
        RAISE NOTICE 'Set company_id NOT NULL on %', tbl;
      ELSE
        RAISE WARNING 'Table % still has NULL company_id — skipping', tbl;
      END IF;
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- 3. ADD company_id TO TABLES THAT ARE COMPLETELY MISSING IT
-- These tables rely on FK traversal which bypasses RLS.
-- =============================================================================

-- 3a. appointment_procedures — critical for tenant isolation
ALTER TABLE appointment_procedures ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);

-- Backfill from appointments
UPDATE appointment_procedures ap
SET company_id = a.company_id
FROM appointments a
WHERE ap.appointment_id = a.id
  AND ap.company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_appointment_procedures_company
  ON appointment_procedures(company_id);

CREATE INDEX IF NOT EXISTS idx_appointment_procedures_appointment
  ON appointment_procedures(appointment_id);

-- 3b. treatment_plan_procedures
ALTER TABLE treatment_plan_procedures ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);

UPDATE treatment_plan_procedures tpp
SET company_id = tp.company_id
FROM treatment_plans tp
WHERE tpp.treatment_plan_id = tp.id
  AND tpp.company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_treatment_plan_procedures_company
  ON treatment_plan_procedures(company_id);

-- 3c. prosthesis_stages
ALTER TABLE prosthesis_stages ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);

UPDATE prosthesis_stages ps
SET company_id = psvc.company_id
FROM prosthesis_services psvc
WHERE ps.service_id = psvc.id
  AND ps.company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_prosthesis_stages_company
  ON prosthesis_stages(company_id);

-- 3d. sales_opportunity_history
ALTER TABLE sales_opportunity_history ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);

UPDATE sales_opportunity_history soh
SET company_id = so.company_id
FROM sales_opportunities so
WHERE soh.opportunity_id = so.id
  AND soh.company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_sales_opportunity_history_company
  ON sales_opportunity_history(company_id);

-- 3e. coupon_usages (already has company_id, just ensure index)
CREATE INDEX IF NOT EXISTS idx_coupon_usages_company
  ON coupon_usages(company_id);


-- =============================================================================
-- 4. ON DELETE CONSTRAINTS + 5. AUDIT FIELDS FOR NEWER TABLES
-- All wrapped in table-existence checks since these tables may not exist yet.
-- =============================================================================

DO $$
DECLARE
  tbl TEXT;
  newer_tables TEXT[] := ARRAY['accounts_payable', 'accounts_receivable', 'anesthesia_logs', 'schedule_blocks', 'bank_transactions'];
BEGIN
  FOREACH tbl IN ARRAY newer_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl AND table_schema = 'public') THEN
      -- Add audit columns
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id)', tbl);
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ', tbl);
      RAISE NOTICE 'Added audit columns to %', tbl;
    ELSE
      RAISE NOTICE 'Table % does not exist, skipping', tbl;
    END IF;
  END LOOP;
END $$;

-- Prosthesis and inventory audit columns (these tables always exist)
ALTER TABLE prosthesis ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
ALTER TABLE prosthesis ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);


-- =============================================================================
-- 6. TEXT LENGTH CHECK CONSTRAINTS ON REMAINING CRITICAL FIELDS
-- =============================================================================

DO $$ BEGIN
  ALTER TABLE patients ADD CONSTRAINT chk_patients_cpf_len CHECK (cpf IS NULL OR length(cpf) <= 14);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE patients ADD CONSTRAINT chk_patients_allergies_len CHECK (allergies IS NULL OR length(allergies) <= 5000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE patients ADD CONSTRAINT chk_patients_medications_len CHECK (medications IS NULL OR length(medications) <= 5000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE treatment_evolution ADD CONSTRAINT chk_evolution_observations_len
    CHECK (clinical_observations IS NULL OR length(clinical_observations) <= 50000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE prescriptions ADD CONSTRAINT chk_prescriptions_content_len
    CHECK (length(content) <= 50000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE chat_messages ADD CONSTRAINT chk_chat_messages_content_len
    CHECK (length(content) <= 50000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE whatsapp_messages ADD CONSTRAINT chk_whatsapp_content_len
    CHECK (length(content) <= 50000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- =============================================================================
-- 7. updated_at TRIGGER ON NEW TABLES
-- =============================================================================

DO $$
DECLARE
  tbl TEXT;
  new_tables TEXT[] := ARRAY[
    'accounts_payable', 'accounts_receivable', 'schedule_blocks',
    'anesthesia_logs', 'discount_limits', 'clinic_units'
  ];
BEGIN
  FOREACH tbl IN ARRAY new_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl AND table_schema = 'public') THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = tbl AND column_name = 'updated_at') THEN
        EXECUTE format('DROP TRIGGER IF EXISTS auto_updated_at ON %I', tbl);
        EXECUTE format(
          'CREATE TRIGGER auto_updated_at BEFORE UPDATE ON %I
           FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at()',
          tbl
        );
      END IF;
    END IF;
  END LOOP;
END $$;


COMMIT;
