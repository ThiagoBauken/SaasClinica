-- =============================================================================
-- Migration 024: Phase 2 — Performance Optimization
-- Date: 2026-04-03
-- Scope:
--   1. Missing indexes on newer tables
--   2. Composite indexes for common query patterns
--   3. Partitioning preparation for high-volume tables
--   4. Materialized view for financial reports
--   5. Partial indexes for soft-deleted records on newer tables
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. MISSING INDEXES ON NEWER TABLES
-- =============================================================================

-- Indexes on newer tables (wrapped in existence checks)
DO $$
DECLARE
  tbl TEXT;
  newer_tables TEXT[] := ARRAY['accounts_payable', 'accounts_receivable', 'anesthesia_logs', 'schedule_blocks'];
BEGIN
  FOREACH tbl IN ARRAY newer_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl AND table_schema = 'public') THEN
      RAISE NOTICE 'Table % does not exist, skipping indexes', tbl;
    END IF;
  END LOOP;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts_payable') THEN
    CREATE INDEX IF NOT EXISTS idx_accounts_payable_company_status ON accounts_payable(company_id, status) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_accounts_payable_company_due_date ON accounts_payable(company_id, due_date) WHERE deleted_at IS NULL AND status != 'cancelled';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts_receivable') THEN
    CREATE INDEX IF NOT EXISTS idx_accounts_receivable_company_status ON accounts_receivable(company_id, status) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_accounts_receivable_company_due_date ON accounts_receivable(company_id, due_date) WHERE deleted_at IS NULL AND status != 'cancelled';
    CREATE INDEX IF NOT EXISTS idx_accounts_receivable_patient ON accounts_receivable(company_id, patient_id) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'anesthesia_logs') THEN
    CREATE INDEX IF NOT EXISTS idx_anesthesia_logs_company_patient ON anesthesia_logs(company_id, patient_id, created_at DESC) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_anesthesia_logs_appointment ON anesthesia_logs(appointment_id) WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schedule_blocks') THEN
    CREATE INDEX IF NOT EXISTS idx_schedule_blocks_company_range ON schedule_blocks(company_id, start_time, end_time) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_schedule_blocks_professional ON schedule_blocks(company_id, professional_id, start_time) WHERE deleted_at IS NULL;
  END IF;
END $$;

-- bank_transactions (may not exist yet)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bank_transactions') THEN
    CREATE INDEX IF NOT EXISTS idx_bank_transactions_company_date ON bank_transactions(company_id, transaction_date DESC);
    CREATE INDEX IF NOT EXISTS idx_bank_transactions_unreconciled ON bank_transactions(company_id) WHERE reconciled = false;
  END IF;
END $$;

-- discount_limits (may not exist yet)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'discount_limits') THEN
    CREATE INDEX IF NOT EXISTS idx_discount_limits_company_role ON discount_limits(company_id, role);
  END IF;
END $$;

-- clinic_units (may not exist yet)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clinic_units') THEN
    CREATE INDEX IF NOT EXISTS idx_clinic_units_company ON clinic_units(company_id) WHERE active = true;
  END IF;
END $$;


-- =============================================================================
-- 2. COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- =============================================================================

-- Appointment lookup by patient (patient timeline)
CREATE INDEX IF NOT EXISTS idx_appointments_patient_timeline
  ON appointments(company_id, patient_id, start_time DESC)
  WHERE deleted_at IS NULL;

-- Appointment lookup by professional + day (schedule view)
CREATE INDEX IF NOT EXISTS idx_appointments_professional_day
  ON appointments(company_id, professional_id, start_time, end_time)
  WHERE deleted_at IS NULL AND status != 'cancelled';

-- Financial: overdue payments (dunning queries)
CREATE INDEX IF NOT EXISTS idx_fin_transactions_overdue
  ON financial_transactions(company_id, due_date, status)
  WHERE deleted_at IS NULL AND status IN ('pending', 'overdue');

-- Patients: CPF lookup (for deduplication and search)
CREATE INDEX IF NOT EXISTS idx_patients_cpf_lookup
  ON patients(company_id, cpf)
  WHERE cpf IS NOT NULL AND deleted_at IS NULL;

-- Patients: phone lookup (WhatsApp matching)
CREATE INDEX IF NOT EXISTS idx_patients_phone_lookup
  ON patients(company_id, cellphone)
  WHERE cellphone IS NOT NULL AND deleted_at IS NULL;

-- Chat sessions: phone lookup (matching incoming WhatsApp)
CREATE INDEX IF NOT EXISTS idx_chat_sessions_phone
  ON chat_sessions(company_id, phone, last_message_at DESC);

-- Commission records: period aggregation
CREATE INDEX IF NOT EXISTS idx_commission_records_period
  ON commission_records(company_id, user_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Treatment plans: patient financial view
CREATE INDEX IF NOT EXISTS idx_treatment_plans_patient_status
  ON treatment_plans(company_id, patient_id, status)
  WHERE deleted_at IS NULL;

-- Prosthesis: laboratory tracking
CREATE INDEX IF NOT EXISTS idx_prosthesis_lab_status
  ON prosthesis(company_id, laboratory, status)
  WHERE deleted_at IS NULL;


-- =============================================================================
-- 3. PARTIAL INDEXES FOR ACTIVE RECORDS ON NEWER TABLES
-- =============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts_payable') THEN
    CREATE INDEX IF NOT EXISTS idx_accounts_payable_active ON accounts_payable(company_id) WHERE deleted_at IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts_receivable') THEN
    CREATE INDEX IF NOT EXISTS idx_accounts_receivable_active ON accounts_receivable(company_id) WHERE deleted_at IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'anesthesia_logs') THEN
    CREATE INDEX IF NOT EXISTS idx_anesthesia_logs_active ON anesthesia_logs(company_id) WHERE deleted_at IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schedule_blocks') THEN
    CREATE INDEX IF NOT EXISTS idx_schedule_blocks_active ON schedule_blocks(company_id) WHERE deleted_at IS NULL;
  END IF;
END $$;


-- =============================================================================
-- 4. MATERIALIZED VIEW FOR FINANCIAL REPORTS (DRE)
-- =============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_financial_stats AS
SELECT
  company_id,
  date_trunc('day', date)::date AS day,
  type,
  category,
  payment_method,
  SUM(amount)::bigint AS total_amount,
  SUM(net_amount)::bigint AS total_net_amount,
  SUM(fee_amount)::bigint AS total_fees,
  COUNT(*)::int AS tx_count
FROM financial_transactions
WHERE deleted_at IS NULL
GROUP BY company_id, date_trunc('day', date)::date, type, category, payment_method;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_financial_pk
  ON mv_daily_financial_stats(company_id, day, type, category, payment_method);


-- =============================================================================
-- 5. MATERIALIZED VIEW FOR PATIENT ACTIVITY (reactivation queries)
-- =============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_patient_last_visit AS
SELECT
  p.company_id,
  p.id AS patient_id,
  p.full_name,
  p.cellphone,
  p.whatsapp_phone,
  MAX(a.start_time) AS last_visit,
  COUNT(a.id)::int AS total_appointments,
  COUNT(a.id) FILTER (WHERE a.status = 'completed')::int AS completed_appointments,
  COUNT(a.id) FILTER (WHERE a.status = 'no_show')::int AS no_shows
FROM patients p
LEFT JOIN appointments a ON a.patient_id = p.id
  AND a.status IN ('completed', 'no_show')
  AND a.deleted_at IS NULL
WHERE p.deleted_at IS NULL
  AND p.active = true
GROUP BY p.company_id, p.id, p.full_name, p.cellphone, p.whatsapp_phone;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_patient_last_visit_pk
  ON mv_patient_last_visit(company_id, patient_id);

-- Index for reactivation queries (patients without recent visit)
CREATE INDEX IF NOT EXISTS idx_mv_patient_last_visit_reactivation
  ON mv_patient_last_visit(company_id, last_visit)
  WHERE last_visit IS NOT NULL;


-- =============================================================================
-- 6. CRON: REFRESH SCHEDULE FOR MATERIALIZED VIEWS
-- Application should call these periodically:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_appointment_stats;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_financial_stats;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_patient_last_visit;
-- Recommended: every hour via billing-cron.ts or a dedicated job.
-- =============================================================================


-- =============================================================================
-- 7. PARTITIONING PREPARATION FOR HIGH-VOLUME TABLES
-- NOTE: Full partitioning requires table recreation (not zero-downtime).
-- This section adds BRIN indexes as a lighter alternative for range queries.
-- =============================================================================

-- BRIN indexes for time-series-like tables (much smaller than B-tree)
CREATE INDEX IF NOT EXISTS idx_audit_logs_brin
  ON audit_logs USING brin(created_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_brin
  ON whatsapp_messages USING brin(created_at);

CREATE INDEX IF NOT EXISTS idx_chat_messages_brin
  ON chat_messages USING brin(created_at);

CREATE INDEX IF NOT EXISTS idx_automation_logs_brin
  ON automation_logs USING brin(created_at);

CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_brin
  ON ai_tool_calls USING brin(created_at);

-- Archive old audit logs (> 1 year) — application should move to cold storage
-- This is prep for future partitioning by created_at range
COMMENT ON TABLE audit_logs IS 'High-volume. Consider partitioning by created_at (monthly) when > 10M rows.';
COMMENT ON TABLE chat_messages IS 'High-volume. Consider partitioning by created_at (monthly) when > 5M rows.';
COMMENT ON TABLE whatsapp_messages IS 'High-volume. Consider partitioning by created_at (monthly) when > 5M rows.';


COMMIT;
