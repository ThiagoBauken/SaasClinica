-- Migration 020: Phase 1 Compliance & Feature Expansion
-- Covers: CFO evolution immutability, CPF uniqueness, structured allergies,
-- anamnesis expiration, patient reference/referral fields, appointment cancellation,
-- working hours breaks, TUSS codes, budget validity, new tables (anesthesia_logs,
-- schedule_blocks, accounts_payable, accounts_receivable, discount_limits,
-- clinic_units, audit_logs), insurance_claims enhancements, exam workflow,
-- and performance indexes.

BEGIN;

-- ============================================================
-- 1. EVOLUTION IMMUTABILITY AFTER 24h (CFO COMPLIANCE)
-- ============================================================

-- 1a. Add locked_at column to treatment_evolution
ALTER TABLE treatment_evolution
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- 1b. Backfill locked_at for all existing records (created_at + 24h)
UPDATE treatment_evolution
SET locked_at = created_at + INTERVAL '24 hours'
WHERE locked_at IS NULL;

-- 1c. Trigger function: auto-set locked_at on INSERT
CREATE OR REPLACE FUNCTION trg_set_evolution_locked_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.locked_at := NEW.created_at + INTERVAL '24 hours';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_evolution_locked_at ON treatment_evolution;
CREATE TRIGGER set_evolution_locked_at
  BEFORE INSERT ON treatment_evolution
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_evolution_locked_at();

-- 1d. Trigger function: block UPDATE/DELETE once locked
CREATE OR REPLACE FUNCTION trg_enforce_evolution_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow soft-delete (setting deleted_at) without restriction
  -- Block any other mutation once the lock period has passed
  IF OLD.locked_at IS NOT NULL AND NOW() > OLD.locked_at THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION
        'treatment_evolution record % is locked after 24h and cannot be deleted (CFO compliance)',
        OLD.id;
    END IF;
    -- For UPDATE: only allow setting deleted_at on already-locked records;
    -- all other field changes are forbidden.
    IF TG_OP = 'UPDATE' THEN
      IF NOT (
        NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
        AND NEW.id                      = OLD.id
        AND NEW.company_id              = OLD.company_id
        AND NEW.patient_id              = OLD.patient_id
        AND NEW.appointment_id          IS NOT DISTINCT FROM OLD.appointment_id
        AND NEW.treatment_plan_id       IS NOT DISTINCT FROM OLD.treatment_plan_id
        AND NEW.session_date            = OLD.session_date
        AND NEW.session_number          IS NOT DISTINCT FROM OLD.session_number
        AND NEW.procedures_performed    IS NOT DISTINCT FROM OLD.procedures_performed
        AND NEW.materials_used          IS NOT DISTINCT FROM OLD.materials_used
        AND NEW.clinical_observations   IS NOT DISTINCT FROM OLD.clinical_observations
        AND NEW.patient_response        IS NOT DISTINCT FROM OLD.patient_response
        AND NEW.complications           IS NOT DISTINCT FROM OLD.complications
        AND NEW.next_session            IS NOT DISTINCT FROM OLD.next_session
        AND NEW.homecare_instructions   IS NOT DISTINCT FROM OLD.homecare_instructions
        AND NEW.performed_by            = OLD.performed_by
        AND NEW.locked_at               IS NOT DISTINCT FROM OLD.locked_at
        AND NEW.created_at              = OLD.created_at
      ) THEN
        RAISE EXCEPTION
          'treatment_evolution record % is locked after 24h and cannot be modified (CFO compliance)',
          OLD.id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_evolution_immutability ON treatment_evolution;
CREATE TRIGGER enforce_evolution_immutability
  BEFORE UPDATE OR DELETE ON treatment_evolution
  FOR EACH ROW
  EXECUTE FUNCTION trg_enforce_evolution_immutability();

-- ============================================================
-- 2. UNIQUE CPF CONSTRAINT PER COMPANY
-- ============================================================

-- Partial unique index: one CPF per company among active (non-deleted) patients
-- with a non-empty CPF value. Works on the plaintext cpf column which remains
-- the searchable field even after cpf_encrypted was added in migration 017.
CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_company_cpf
  ON patients (company_id, cpf)
  WHERE cpf IS NOT NULL
    AND cpf != ''
    AND deleted_at IS NULL;

-- ============================================================
-- 3. STRUCTURED ALLERGIES (JSONB) ON PATIENTS
-- ============================================================

-- 3a. Add structured column
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS allergies_structured JSONB;

-- 3b. Migrate existing free-text allergies into the JSONB array format.
--     Only touch rows that have text in allergies but nothing yet in
--     allergies_structured.
UPDATE patients
SET allergies_structured = jsonb_build_array(
  jsonb_build_object(
    'name',     allergies,
    'severity', 'unknown',
    'notes',    ''
  )
)
WHERE allergies IS NOT NULL
  AND allergies <> ''
  AND allergies_structured IS NULL;

-- Old allergies TEXT column is intentionally kept for backwards compatibility.

-- ============================================================
-- 4. ANAMNESIS EXPIRATION
-- ============================================================

ALTER TABLE anamnesis
  ADD COLUMN IF NOT EXISTS next_review_date TIMESTAMPTZ;

-- Backfill: existing records expire 12 months after creation
UPDATE anamnesis
SET next_review_date = created_at + INTERVAL '12 months'
WHERE next_review_date IS NULL;

-- ============================================================
-- 5. REFERENCE DOCTOR FIELDS ON PATIENTS
-- ============================================================

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS reference_doctor_name TEXT;

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS reference_doctor_phone VARCHAR(20);

-- ============================================================
-- 6. PATIENT REFERRAL FK
-- ============================================================

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS referred_by_patient_id INTEGER
    REFERENCES patients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patients_referred_by
  ON patients(referred_by_patient_id)
  WHERE referred_by_patient_id IS NOT NULL;

-- ============================================================
-- 7. CANCELLATION REASON ON APPOINTMENTS
-- ============================================================

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS cancelled_by INTEGER
    REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================
-- 9. WORKING HOURS BREAKS
-- ============================================================

ALTER TABLE working_hours
  ADD COLUMN IF NOT EXISTS break_start TEXT; -- HH:MM format

ALTER TABLE working_hours
  ADD COLUMN IF NOT EXISTS break_end TEXT;   -- HH:MM format

-- ============================================================
-- 10. TUSS CODE ON PROCEDURES
-- ============================================================

ALTER TABLE procedures
  ADD COLUMN IF NOT EXISTS tuss_code VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_procedures_tuss_code
  ON procedures(tuss_code)
  WHERE tuss_code IS NOT NULL;

-- ============================================================
-- 11. BUDGET VALIDITY ON DETAILED TREATMENT PLANS
-- ============================================================

ALTER TABLE detailed_treatment_plans
  ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;

-- ============================================================
-- 12. ANESTHESIA LOGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS anesthesia_logs (
  id                SERIAL PRIMARY KEY,
  company_id        INTEGER NOT NULL REFERENCES companies(id),
  patient_id        INTEGER NOT NULL REFERENCES patients(id),
  appointment_id    INTEGER REFERENCES appointments(id),
  evolution_id      INTEGER REFERENCES treatment_evolution(id),
  -- Agent details
  anesthetic_type   TEXT NOT NULL,   -- local, regional, geral, sedacao
  anesthetic_name   TEXT NOT NULL,   -- lidocaina, mepivacaina, articaina, prilocaina
  concentration     TEXT,            -- 2%, 3%, etc.
  vasoconstrictor   TEXT,            -- epinefrina, felipressina, sem_vasoconstritor
  quantity_ml       DECIMAL(5,2),    -- quantity in ml
  lot_number        TEXT,
  expiration_date   DATE,
  administered_by   INTEGER NOT NULL REFERENCES users(id),
  technique         TEXT,            -- infiltrativa, bloqueio, topica
  tooth_region      TEXT,            -- region or tooth number
  adverse_reaction  TEXT,
  notes             TEXT,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anesthesia_logs_company
  ON anesthesia_logs(company_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_anesthesia_logs_patient
  ON anesthesia_logs(patient_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_anesthesia_logs_appointment
  ON anesthesia_logs(appointment_id)
  WHERE appointment_id IS NOT NULL AND deleted_at IS NULL;

-- ============================================================
-- 13. SCHEDULE BLOCKS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS schedule_blocks (
  id                  SERIAL PRIMARY KEY,
  company_id          INTEGER NOT NULL REFERENCES companies(id),
  professional_id     INTEGER REFERENCES users(id),
  room_id             INTEGER REFERENCES rooms(id),
  title               TEXT NOT NULL,
  reason              TEXT,        -- ferias, folga, compromisso, manutencao, feriado
  start_time          TIMESTAMPTZ NOT NULL,
  end_time            TIMESTAMPTZ NOT NULL,
  all_day             BOOLEAN DEFAULT false,
  recurring           BOOLEAN DEFAULT false,
  recurrence_pattern  TEXT,        -- weekly, monthly, yearly
  created_by          INTEGER REFERENCES users(id),
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_company_time
  ON schedule_blocks(company_id, start_time, end_time)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_professional
  ON schedule_blocks(professional_id, start_time)
  WHERE professional_id IS NOT NULL AND deleted_at IS NULL;

-- ============================================================
-- 14. ACCOUNTS PAYABLE TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS accounts_payable (
  id                  SERIAL PRIMARY KEY,
  company_id          INTEGER NOT NULL REFERENCES companies(id),
  description         TEXT NOT NULL,
  supplier_name       TEXT,
  category            TEXT,         -- aluguel, materiais, salarios, laboratorio, equipamentos, marketing, impostos, outros
  amount              INTEGER NOT NULL,  -- in cents
  due_date            DATE NOT NULL,
  payment_date        DATE,
  status              TEXT NOT NULL DEFAULT 'pending', -- pending, paid, overdue, cancelled
  payment_method      TEXT,         -- pix, boleto, transferencia, dinheiro, cartao
  document_number     TEXT,         -- nota fiscal or receipt number
  recurring           BOOLEAN DEFAULT false,
  recurrence_pattern  TEXT,         -- monthly, quarterly, yearly
  notes               TEXT,
  created_by          INTEGER REFERENCES users(id),
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_payable_company_due
  ON accounts_payable(company_id, due_date, status)
  WHERE deleted_at IS NULL;

-- ============================================================
-- 15. ACCOUNTS RECEIVABLE TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS accounts_receivable (
  id                  SERIAL PRIMARY KEY,
  company_id          INTEGER NOT NULL REFERENCES companies(id),
  patient_id          INTEGER REFERENCES patients(id),
  treatment_plan_id   INTEGER REFERENCES detailed_treatment_plans(id),
  description         TEXT NOT NULL,
  amount              INTEGER NOT NULL,  -- in cents
  due_date            DATE NOT NULL,
  payment_date        DATE,
  status              TEXT NOT NULL DEFAULT 'pending', -- pending, paid, overdue, partial, cancelled
  installment_number  INTEGER,      -- parcela X de Y
  total_installments  INTEGER,
  payment_method      TEXT,
  notes               TEXT,
  created_by          INTEGER REFERENCES users(id),
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_receivable_company_due
  ON accounts_receivable(company_id, due_date, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_receivable_patient
  ON accounts_receivable(patient_id)
  WHERE patient_id IS NOT NULL AND deleted_at IS NULL;

-- ============================================================
-- 16. DISCOUNT LIMITS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS discount_limits (
  id                    SERIAL PRIMARY KEY,
  company_id            INTEGER NOT NULL REFERENCES companies(id),
  role                  TEXT NOT NULL,              -- admin, dentist, staff
  max_discount_percent  DECIMAL(5,2) NOT NULL DEFAULT 0,
  requires_approval     BOOLEAN DEFAULT false,
  approval_role         TEXT,                       -- which role can approve beyond limit
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_discount_limits_company_role
  ON discount_limits(company_id, role);

-- ============================================================
-- 17. CLINIC UNITS TABLE (multi-unit clinics)
-- ============================================================

CREATE TABLE IF NOT EXISTS clinic_units (
  id          SERIAL PRIMARY KEY,
  company_id  INTEGER NOT NULL REFERENCES companies(id),
  name        TEXT NOT NULL,
  address     TEXT,
  phone       VARCHAR(20),
  cnpj        VARCHAR(18),
  cro         TEXT,           -- CRO da unidade
  is_main     BOOLEAN DEFAULT false,
  active      BOOLEAN DEFAULT true,
  settings    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinic_units_company
  ON clinic_units(company_id)
  WHERE active = true;

-- Only one main unit allowed per company
CREATE UNIQUE INDEX IF NOT EXISTS uq_clinic_units_main
  ON clinic_units(company_id)
  WHERE is_main = true;

-- ============================================================
-- 18. INSURANCE CLAIMS ENHANCEMENTS
--     (only when insurance_claims exists — created by migration 015)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'insurance_claims'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'insurance_claims' AND column_name = 'repaid_amount'
    ) THEN
      ALTER TABLE insurance_claims ADD COLUMN repaid_amount INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'insurance_claims' AND column_name = 'repaid_date'
    ) THEN
      ALTER TABLE insurance_claims ADD COLUMN repaid_date DATE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'insurance_claims' AND column_name = 'appeal_reason'
    ) THEN
      ALTER TABLE insurance_claims ADD COLUMN appeal_reason TEXT;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'insurance_claims' AND column_name = 'appeal_date'
    ) THEN
      ALTER TABLE insurance_claims ADD COLUMN appeal_date DATE;
    END IF;
  END IF;
END
$$;

-- ============================================================
-- 19. AUDIT LOGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id             SERIAL PRIMARY KEY,
  company_id     INTEGER NOT NULL REFERENCES companies(id),
  user_id        INTEGER REFERENCES users(id),
  action         TEXT NOT NULL,    -- create, update, delete, view, export, login, logout
  resource       TEXT NOT NULL,    -- patient, appointment, financial, prescription, etc.
  resource_id    INTEGER,
  details        JSONB,            -- additional context
  ip_address     TEXT,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_company_date
  ON audit_logs(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user
  ON audit_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
  ON audit_logs(resource, resource_id);

-- ============================================================
-- 20. EXAM REQUEST WORKFLOW — ADD STATUS COLUMNS TO patient_exams
-- ============================================================

ALTER TABLE patient_exams
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'requested';
  -- requested, collected, completed, cancelled

ALTER TABLE patient_exams
  ADD COLUMN IF NOT EXISTS requested_date TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE patient_exams
  ADD COLUMN IF NOT EXISTS completed_date TIMESTAMPTZ;

ALTER TABLE patient_exams
  ADD COLUMN IF NOT EXISTS result_notes TEXT;

-- Backfill: existing rows get status 'completed' since they predate this workflow
UPDATE patient_exams
SET status = 'completed'
WHERE status = 'requested'
  AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_patient_exams_company_status
  ON patient_exams(company_id, status)
  WHERE deleted_at IS NULL;

-- ============================================================
-- 21. PERFORMANCE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_appointments_company_time_prof
  ON appointments(company_id, start_time, professional_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_company_date
  ON financial_transactions(company_id, date, type)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_patients_company_active
  ON patients(company_id)
  WHERE active = true AND deleted_at IS NULL;

COMMIT;
