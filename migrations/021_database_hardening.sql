-- =============================================================================
-- Migration 021: Database Hardening
-- Date: 2026-04-03
-- Scope: CHECK constraints on enum fields, company_id NOT NULL enforcement,
--        API key encryption columns, performance indexes for N+1 fixes,
--        materialized view for analytics.
-- All statements use IF NOT EXISTS / DO blocks for idempotency.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. CHECK CONSTRAINTS ON CRITICAL ENUM FIELDS
-- Prevents invalid values from being inserted via raw SQL or ORM bypass.
-- =============================================================================

-- appointments.status
DO $$ BEGIN
  ALTER TABLE appointments ADD CONSTRAINT chk_appointments_status
    CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- appointments.type
DO $$ BEGIN
  ALTER TABLE appointments ADD CONSTRAINT chk_appointments_type
    CHECK (type IN ('appointment', 'block', 'reminder'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- users.role
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT chk_users_role
    CHECK (role IN ('superadmin', 'admin', 'dentist', 'staff'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- patients.gender
DO $$ BEGIN
  ALTER TABLE patients ADD CONSTRAINT chk_patients_gender
    CHECK (gender IS NULL OR gender IN ('masculino', 'feminino', 'outro'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- patients.blood_type
DO $$ BEGIN
  ALTER TABLE patients ADD CONSTRAINT chk_patients_blood_type
    CHECK (blood_type IS NULL OR blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- patients.status
DO $$ BEGIN
  ALTER TABLE patients ADD CONSTRAINT chk_patients_status
    CHECK (status IS NULL OR status IN ('active', 'inactive', 'archived'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- financial_transactions.type
DO $$ BEGIN
  ALTER TABLE financial_transactions ADD CONSTRAINT chk_fin_tx_type
    CHECK (type IN ('income', 'expense'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- financial_transactions.status
DO $$ BEGIN
  ALTER TABLE financial_transactions ADD CONSTRAINT chk_fin_tx_status
    CHECK (status IN ('pending', 'partial', 'paid', 'overdue', 'cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- financial_transactions.payment_method
DO $$ BEGIN
  ALTER TABLE financial_transactions ADD CONSTRAINT chk_fin_tx_payment_method
    CHECK (payment_method IS NULL OR payment_method IN ('cash', 'credit_card', 'debit_card', 'pix', 'bank_transfer', 'boleto'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- payments.status
DO $$ BEGIN
  ALTER TABLE payments ADD CONSTRAINT chk_payments_status
    CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- treatment_plans.status
DO $$ BEGIN
  ALTER TABLE treatment_plans ADD CONSTRAINT chk_treatment_plans_status
    CHECK (status IN ('proposed', 'approved', 'in_progress', 'completed', 'cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- subscriptions.status
DO $$ BEGIN
  ALTER TABLE subscriptions ADD CONSTRAINT chk_subscriptions_status
    CHECK (status IN ('trial', 'active', 'past_due', 'canceled', 'expired'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- chat_sessions.status
DO $$ BEGIN
  ALTER TABLE chat_sessions ADD CONSTRAINT chk_chat_sessions_status
    CHECK (status IS NULL OR status IN ('active', 'waiting_human', 'closed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- prosthesis.status
DO $$ BEGIN
  ALTER TABLE prosthesis ADD CONSTRAINT chk_prosthesis_status
    CHECK (status IN ('pending', 'sent', 'returned', 'completed', 'canceled', 'archived'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- digital_signatures.status
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'digital_signatures') THEN
    ALTER TABLE digital_signatures ADD CONSTRAINT chk_digital_signatures_status
      CHECK (status IN ('valid', 'revoked', 'expired'));
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- accounts_payable.status
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts_payable') THEN
    ALTER TABLE accounts_payable ADD CONSTRAINT chk_accounts_payable_status
      CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled'));
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- accounts_receivable.status
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts_receivable') THEN
    ALTER TABLE accounts_receivable ADD CONSTRAINT chk_accounts_receivable_status
      CHECK (status IN ('pending', 'paid', 'overdue', 'partial', 'cancelled'));
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- =============================================================================
-- 2. ENFORCE company_id NOT NULL ON CHAT TABLES
-- Backfill from parent session, then add NOT NULL constraint.
-- =============================================================================

-- 2a. chat_messages: backfill company_id from chat_sessions
UPDATE chat_messages cm
SET company_id = cs.company_id
FROM chat_sessions cs
WHERE cm.session_id = cs.id
  AND cm.company_id IS NULL;

-- Make NOT NULL (only if no NULLs remain)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM chat_messages WHERE company_id IS NULL) THEN
    ALTER TABLE chat_messages ALTER COLUMN company_id SET NOT NULL;
  ELSE
    RAISE NOTICE 'chat_messages still has NULL company_id rows — skipping NOT NULL';
  END IF;
END $$;

-- 2b. ai_tool_calls: ensure company_id column exists, then backfill
ALTER TABLE ai_tool_calls ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
ALTER TABLE ai_tool_calls ADD COLUMN IF NOT EXISTS is_error BOOLEAN DEFAULT false;
ALTER TABLE ai_tool_calls ADD COLUMN IF NOT EXISTS model VARCHAR(50);

UPDATE ai_tool_calls atc
SET company_id = cs.company_id
FROM chat_sessions cs
WHERE atc.session_id = cs.id
  AND atc.company_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ai_tool_calls WHERE company_id IS NULL) THEN
    ALTER TABLE ai_tool_calls ALTER COLUMN company_id SET NOT NULL;
  ELSE
    RAISE NOTICE 'ai_tool_calls still has NULL company_id rows — skipping NOT NULL';
  END IF;
END $$;


-- =============================================================================
-- 3. TEXT LENGTH CONSTRAINTS ON CRITICAL FIELDS
-- Prevents malicious mega-payloads without changing types.
-- =============================================================================

DO $$ BEGIN
  ALTER TABLE patients ADD CONSTRAINT chk_patients_fullname_len CHECK (length(full_name) <= 500);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE patients ADD CONSTRAINT chk_patients_email_len CHECK (email IS NULL OR length(email) <= 320);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT chk_users_fullname_len CHECK (length(full_name) <= 500);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT chk_users_email_len CHECK (length(email) <= 320);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE appointments ADD CONSTRAINT chk_appointments_title_len CHECK (length(title) <= 500);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE appointments ADD CONSTRAINT chk_appointments_notes_len CHECK (notes IS NULL OR length(notes) <= 10000);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- =============================================================================
-- 4. PERFORMANCE INDEXES FOR N+1 FIXES
-- Support the new JOIN-based queries in chat, appointments, and analytics.
-- =============================================================================

-- Chat sessions enrichment query (LATERAL joins)
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_latest
  ON chat_messages(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_unread
  ON chat_messages(session_id, role, created_at)
  WHERE role = 'user';

-- Appointments batch conflict check (batchLoadConflicts)
CREATE INDEX IF NOT EXISTS idx_appointments_conflict_check
  ON appointments(company_id, start_time, end_time)
  WHERE status != 'cancelled' AND deleted_at IS NULL;

-- Analytics: professional aggregation
CREATE INDEX IF NOT EXISTS idx_appointments_analytics_prof
  ON appointments(company_id, start_time, professional_id, status)
  WHERE deleted_at IS NULL;

-- Analytics: peak hours (extract hour/dow)
CREATE INDEX IF NOT EXISTS idx_appointments_start_time_brin
  ON appointments USING brin(start_time)
  WHERE deleted_at IS NULL;


-- =============================================================================
-- 5. ENCRYPTED SHADOW COLUMNS FOR API KEYS
-- Add encrypted columns alongside plaintext ones for future migration.
-- Application should write to both, then drop plaintext in a future migration.
-- =============================================================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS openai_api_key_enc BYTEA;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS anthropic_api_key_enc BYTEA;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS n8n_api_key_enc BYTEA;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clinic_settings') THEN
    ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS wuzapi_api_key_enc BYTEA;
    ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS evolution_api_key_enc BYTEA;
    ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS meta_access_token_enc BYTEA;
    ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS baserow_api_key_enc BYTEA;
  END IF;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_access_token_enc BYTEA;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token_enc BYTEA;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret_enc BYTEA;


-- =============================================================================
-- 6. MATERIALIZED VIEW FOR ANALYTICS
-- Pre-aggregated daily appointment stats per company/professional.
-- Refresh via cron (REFRESH MATERIALIZED VIEW CONCURRENTLY).
-- =============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_appointment_stats AS
SELECT
  company_id,
  date_trunc('day', start_time)::date AS day,
  professional_id,
  count(*)::int AS total,
  count(*) FILTER (WHERE status = 'completed')::int AS completed,
  count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
  count(*) FILTER (WHERE status = 'no_show')::int AS no_show,
  count(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
  count(*) FILTER (WHERE status = 'confirmed')::int AS confirmed
FROM appointments
WHERE deleted_at IS NULL
GROUP BY company_id, date_trunc('day', start_time)::date, professional_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_stats_pk
  ON mv_daily_appointment_stats(company_id, day, professional_id);


-- =============================================================================
-- 7. UPDATED_AT AUTO-UPDATE TRIGGER
-- Ensures updated_at is always current, even when application code forgets.
-- =============================================================================

CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'patients', 'appointments', 'users', 'procedures',
    'financial_transactions', 'treatment_plans', 'detailed_treatment_plans',
    'treatment_evolution', 'prescriptions', 'anamnesis',
    'prosthesis', 'inventory_items', 'clinic_settings'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl AND table_schema = 'public') THEN
      EXECUTE format('DROP TRIGGER IF EXISTS auto_updated_at ON %I', tbl);
      EXECUTE format(
        'CREATE TRIGGER auto_updated_at BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at()',
        tbl
      );
    END IF;
  END LOOP;
END $$;


COMMIT;
