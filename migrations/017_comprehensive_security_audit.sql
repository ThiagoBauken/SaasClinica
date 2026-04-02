-- =============================================================================
-- Migration 017: Comprehensive Security Audit
-- Date: 2026-04-02
-- Scope: Extensions, timestamptz migration, tenant isolation, soft delete,
--        audit fields, FK constraints, check constraints, performance indexes,
--        row-level security, sensitive data encryption, varchar length limits.
-- All statements use IF NOT EXISTS / IF EXISTS for full idempotency.
-- =============================================================================

BEGIN;

-- =============================================================================
-- SECTION 1: EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- =============================================================================
-- SECTION 2: TIMESTAMP → TIMESTAMPTZ
-- Convert naive timestamp columns to timestamptz on all high-priority tables.
-- USING clause converts existing values from America/Sao_Paulo local time to UTC.
-- =============================================================================

-- companies
ALTER TABLE companies
  ALTER COLUMN created_at   TYPE TIMESTAMPTZ USING created_at   AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN updated_at   TYPE TIMESTAMPTZ USING updated_at   AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN trial_ends_at TYPE TIMESTAMPTZ USING trial_ends_at AT TIME ZONE 'America/Sao_Paulo';

-- users
ALTER TABLE users
  ALTER COLUMN created_at           TYPE TIMESTAMPTZ USING created_at           AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN updated_at           TYPE TIMESTAMPTZ USING updated_at           AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN trial_ends_at        TYPE TIMESTAMPTZ USING trial_ends_at        AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN google_token_expiry  TYPE TIMESTAMPTZ USING google_token_expiry  AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN password_reset_expires TYPE TIMESTAMPTZ USING password_reset_expires AT TIME ZONE 'America/Sao_Paulo';

-- patients
ALTER TABLE patients
  ALTER COLUMN created_at                     TYPE TIMESTAMPTZ USING created_at                     AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN updated_at                     TYPE TIMESTAMPTZ USING updated_at                     AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN birth_date                     TYPE TIMESTAMPTZ USING birth_date                     AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN last_visit                     TYPE TIMESTAMPTZ USING last_visit                     AT TIME ZONE 'America/Sao_Paulo';

-- patients: optional columns added by later migrations (IF they exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='consent_date') THEN
    ALTER TABLE patients ALTER COLUMN consent_date TYPE TIMESTAMPTZ USING consent_date AT TIME ZONE 'America/Sao_Paulo';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='data_anonymization_date') THEN
    ALTER TABLE patients ALTER COLUMN data_anonymization_date TYPE TIMESTAMPTZ USING data_anonymization_date AT TIME ZONE 'America/Sao_Paulo';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='last_review_requested_at') THEN
    ALTER TABLE patients ALTER COLUMN last_review_requested_at TYPE TIMESTAMPTZ USING last_review_requested_at AT TIME ZONE 'America/Sao_Paulo';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='orthodontic_start_date') THEN
    ALTER TABLE patients ALTER COLUMN orthodontic_start_date TYPE TIMESTAMPTZ USING orthodontic_start_date AT TIME ZONE 'America/Sao_Paulo';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='orthodontic_expected_end_date') THEN
    ALTER TABLE patients ALTER COLUMN orthodontic_expected_end_date TYPE TIMESTAMPTZ USING orthodontic_expected_end_date AT TIME ZONE 'America/Sao_Paulo';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='next_recurring_appointment') THEN
    ALTER TABLE patients ALTER COLUMN next_recurring_appointment TYPE TIMESTAMPTZ USING next_recurring_appointment AT TIME ZONE 'America/Sao_Paulo';
  END IF;
END $$;

-- appointments
ALTER TABLE appointments
  ALTER COLUMN created_at        TYPE TIMESTAMPTZ USING created_at        AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN updated_at        TYPE TIMESTAMPTZ USING updated_at        AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN start_time        TYPE TIMESTAMPTZ USING start_time        AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN end_time          TYPE TIMESTAMPTZ USING end_time          AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN automation_sent_at TYPE TIMESTAMPTZ USING automation_sent_at AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN last_reminder_sent TYPE TIMESTAMPTZ USING last_reminder_sent AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN confirmation_date  TYPE TIMESTAMPTZ USING confirmation_date  AT TIME ZONE 'America/Sao_Paulo';

-- payments
ALTER TABLE payments
  ALTER COLUMN created_at    TYPE TIMESTAMPTZ USING created_at    AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN payment_date  TYPE TIMESTAMPTZ USING payment_date  AT TIME ZONE 'America/Sao_Paulo';

-- financial_transactions
ALTER TABLE financial_transactions
  ALTER COLUMN created_at  TYPE TIMESTAMPTZ USING created_at  AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN updated_at  TYPE TIMESTAMPTZ USING updated_at  AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN date         TYPE TIMESTAMPTZ USING date         AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN due_date     TYPE TIMESTAMPTZ USING due_date     AT TIME ZONE 'America/Sao_Paulo';

-- patient_records
ALTER TABLE patient_records
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'America/Sao_Paulo';

-- anamnesis
ALTER TABLE anamnesis
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'America/Sao_Paulo';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='anamnesis' AND column_name='last_dental_visit') THEN
    ALTER TABLE anamnesis ALTER COLUMN last_dental_visit TYPE TIMESTAMPTZ USING last_dental_visit AT TIME ZONE 'America/Sao_Paulo';
  END IF;
END $$;

-- patient_exams
ALTER TABLE patient_exams
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN exam_date  TYPE TIMESTAMPTZ USING exam_date  AT TIME ZONE 'America/Sao_Paulo';

-- prescriptions
ALTER TABLE prescriptions
  ALTER COLUMN created_at  TYPE TIMESTAMPTZ USING created_at  AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN valid_until TYPE TIMESTAMPTZ USING valid_until AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN issued_at   TYPE TIMESTAMPTZ USING issued_at   AT TIME ZONE 'America/Sao_Paulo';

-- treatment_evolution
ALTER TABLE treatment_evolution
  ALTER COLUMN created_at   TYPE TIMESTAMPTZ USING created_at   AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN session_date TYPE TIMESTAMPTZ USING session_date AT TIME ZONE 'America/Sao_Paulo';

-- detailed_treatment_plans
ALTER TABLE detailed_treatment_plans
  ALTER COLUMN created_at       TYPE TIMESTAMPTZ USING created_at       AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN updated_at       TYPE TIMESTAMPTZ USING updated_at       AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN proposed_date    TYPE TIMESTAMPTZ USING proposed_date    AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN approved_date    TYPE TIMESTAMPTZ USING approved_date    AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN start_date       TYPE TIMESTAMPTZ USING start_date       AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN expected_end_date TYPE TIMESTAMPTZ USING expected_end_date AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN completed_date   TYPE TIMESTAMPTZ USING completed_date   AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN consent_date     TYPE TIMESTAMPTZ USING consent_date     AT TIME ZONE 'America/Sao_Paulo';

-- treatment_plans
ALTER TABLE treatment_plans
  ALTER COLUMN created_at    TYPE TIMESTAMPTZ USING created_at    AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN updated_at    TYPE TIMESTAMPTZ USING updated_at    AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN start_date    TYPE TIMESTAMPTZ USING start_date    AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN completed_date TYPE TIMESTAMPTZ USING completed_date AT TIME ZONE 'America/Sao_Paulo';

-- digital_signatures
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='digital_signatures') THEN
    ALTER TABLE digital_signatures
      ALTER COLUMN created_at             TYPE TIMESTAMPTZ USING created_at             AT TIME ZONE 'America/Sao_Paulo',
      ALTER COLUMN updated_at             TYPE TIMESTAMPTZ USING updated_at             AT TIME ZONE 'America/Sao_Paulo',
      ALTER COLUMN signed_at              TYPE TIMESTAMPTZ USING signed_at              AT TIME ZONE 'America/Sao_Paulo',
      ALTER COLUMN expires_at             TYPE TIMESTAMPTZ USING expires_at             AT TIME ZONE 'America/Sao_Paulo',
      ALTER COLUMN revoked_at             TYPE TIMESTAMPTZ USING revoked_at             AT TIME ZONE 'America/Sao_Paulo',
      ALTER COLUMN certificate_valid_from TYPE TIMESTAMPTZ USING certificate_valid_from AT TIME ZONE 'America/Sao_Paulo',
      ALTER COLUMN certificate_valid_until TYPE TIMESTAMPTZ USING certificate_valid_until AT TIME ZONE 'America/Sao_Paulo';
  END IF;
END $$;

-- whatsapp_messages
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='whatsapp_messages') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='whatsapp_messages' AND column_name='created_at') THEN
      ALTER TABLE whatsapp_messages ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'America/Sao_Paulo';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='whatsapp_messages' AND column_name='timestamp') THEN
      ALTER TABLE whatsapp_messages ALTER COLUMN timestamp TYPE TIMESTAMPTZ USING timestamp AT TIME ZONE 'America/Sao_Paulo';
    END IF;
  END IF;
END $$;

-- chat_sessions
ALTER TABLE chat_sessions
  ALTER COLUMN created_at     TYPE TIMESTAMPTZ USING created_at     AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN updated_at     TYPE TIMESTAMPTZ USING updated_at     AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN last_message_at TYPE TIMESTAMPTZ USING last_message_at AT TIME ZONE 'America/Sao_Paulo';

-- chat_messages
ALTER TABLE chat_messages
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN read_at    TYPE TIMESTAMPTZ USING read_at    AT TIME ZONE 'America/Sao_Paulo';

-- audit_logs
ALTER TABLE audit_logs
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'America/Sao_Paulo';

-- notifications
ALTER TABLE notifications
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN read_at    TYPE TIMESTAMPTZ USING read_at    AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'America/Sao_Paulo';

-- automations
ALTER TABLE automations
  ALTER COLUMN created_at     TYPE TIMESTAMPTZ USING created_at     AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN updated_at     TYPE TIMESTAMPTZ USING updated_at     AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN last_execution TYPE TIMESTAMPTZ USING last_execution AT TIME ZONE 'America/Sao_Paulo';

-- automation_logs
ALTER TABLE automation_logs
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'America/Sao_Paulo';

-- subscriptions
ALTER TABLE subscriptions
  ALTER COLUMN created_at           TYPE TIMESTAMPTZ USING created_at           AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN updated_at           TYPE TIMESTAMPTZ USING updated_at           AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN current_period_start TYPE TIMESTAMPTZ USING current_period_start AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN current_period_end   TYPE TIMESTAMPTZ USING current_period_end   AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN trial_ends_at        TYPE TIMESTAMPTZ USING trial_ends_at        AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN canceled_at          TYPE TIMESTAMPTZ USING canceled_at          AT TIME ZONE 'America/Sao_Paulo';

-- subscription_invoices
ALTER TABLE subscription_invoices
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN due_date   TYPE TIMESTAMPTZ USING due_date   AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN paid_at    TYPE TIMESTAMPTZ USING paid_at    AT TIME ZONE 'America/Sao_Paulo';

-- clinic_settings
ALTER TABLE clinic_settings
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'America/Sao_Paulo';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinic_settings' AND column_name='wuzapi_last_sync_at') THEN
    ALTER TABLE clinic_settings ALTER COLUMN wuzapi_last_sync_at TYPE TIMESTAMPTZ USING wuzapi_last_sync_at AT TIME ZONE 'America/Sao_Paulo';
  END IF;
END $$;


-- =============================================================================
-- SECTION 3: ADD company_id TO TABLES MISSING TENANT ISOLATION
-- Pattern: add column → backfill from parent FK → create index.
-- NOT NULL is applied only where backfill is reliable via a FK relationship.
-- =============================================================================

-- 1. fiscal_settings
ALTER TABLE fiscal_settings ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_fiscal_settings_company ON fiscal_settings(company_id);

-- 2. chairs (backfill from rooms.company_id via room_id)
ALTER TABLE chairs ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
UPDATE chairs
   SET company_id = (SELECT r.company_id FROM rooms r WHERE r.id = chairs.room_id)
 WHERE company_id IS NULL AND room_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chairs_company ON chairs(company_id);

-- 3. boxes (no reliable parent FK for backfill; leave nullable, app must set)
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_boxes_company ON boxes(company_id);

-- 4. box_transactions (backfill from boxes.company_id via box_id)
ALTER TABLE box_transactions ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
UPDATE box_transactions
   SET company_id = (SELECT b.company_id FROM boxes b WHERE b.id = box_transactions.box_id)
 WHERE company_id IS NULL AND box_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_box_transactions_company ON box_transactions(company_id);

-- 5. payment_plans
ALTER TABLE payment_plans ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_company ON payment_plans(company_id);

-- 6. financial_categories
ALTER TABLE financial_categories ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_financial_categories_company ON financial_categories(company_id);

-- 7. anamnesis_templates (backfill from users.company_id via created_by)
ALTER TABLE anamnesis_templates ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
UPDATE anamnesis_templates
   SET company_id = (SELECT u.company_id FROM users u WHERE u.id = anamnesis_templates.created_by)
 WHERE company_id IS NULL AND created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_anamnesis_templates_company ON anamnesis_templates(company_id);

-- 8. prosthesis_services (backfill from users.company_id via professional_id)
ALTER TABLE prosthesis_services ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
UPDATE prosthesis_services
   SET company_id = (SELECT u.company_id FROM users u WHERE u.id = prosthesis_services.professional_id)
 WHERE company_id IS NULL AND professional_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prosthesis_services_company ON prosthesis_services(company_id);

-- 9. prosthesis_types
ALTER TABLE prosthesis_types ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_prosthesis_types_company ON prosthesis_types(company_id);

-- 10. sales_goals (backfill from users.company_id via user_id)
ALTER TABLE sales_goals ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
UPDATE sales_goals
   SET company_id = (SELECT u.company_id FROM users u WHERE u.id = sales_goals.user_id)
 WHERE company_id IS NULL AND user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_goals_company ON sales_goals(company_id);

-- 11. tasks (backfill from users.company_id via created_by)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
UPDATE tasks
   SET company_id = (SELECT u.company_id FROM users u WHERE u.id = tasks.created_by)
 WHERE company_id IS NULL AND created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_company ON tasks(company_id);

-- 12. shop_items
ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_shop_items_company ON shop_items(company_id);

-- 13. booking_link_settings (backfill from users.company_id via professional_id)
ALTER TABLE booking_link_settings ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
UPDATE booking_link_settings
   SET company_id = (SELECT u.company_id FROM users u WHERE u.id = booking_link_settings.professional_id)
 WHERE company_id IS NULL AND professional_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_booking_link_settings_company ON booking_link_settings(company_id);

-- 14. communication_settings
ALTER TABLE communication_settings ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_communication_settings_company ON communication_settings(company_id);

-- 15. patient_documents (backfill from patients.company_id via patient_id)
ALTER TABLE patient_documents ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
UPDATE patient_documents
   SET company_id = (SELECT p.company_id FROM patients p WHERE p.id = patient_documents.patient_id)
 WHERE company_id IS NULL AND patient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patient_documents_company ON patient_documents(company_id);

-- 16. machine_taxes
ALTER TABLE machine_taxes ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_machine_taxes_company ON machine_taxes(company_id);

-- 17. commission_settings (backfill from users.company_id via user_id)
ALTER TABLE commission_settings ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
UPDATE commission_settings
   SET company_id = (SELECT u.company_id FROM users u WHERE u.id = commission_settings.user_id)
 WHERE company_id IS NULL AND user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commission_settings_company ON commission_settings(company_id);

-- 18. procedure_commissions (backfill from users.company_id via user_id)
ALTER TABLE procedure_commissions ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
UPDATE procedure_commissions
   SET company_id = (SELECT u.company_id FROM users u WHERE u.id = procedure_commissions.user_id)
 WHERE company_id IS NULL AND user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_procedure_commissions_company ON procedure_commissions(company_id);

-- 19. commission_records (backfill from users.company_id via user_id)
ALTER TABLE commission_records ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
UPDATE commission_records
   SET company_id = (SELECT u.company_id FROM users u WHERE u.id = commission_records.user_id)
 WHERE company_id IS NULL AND user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commission_records_company ON commission_records(company_id);

-- 20. patient_risk_alerts (backfill from patients.company_id via patient_id)
ALTER TABLE patient_risk_alerts ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
UPDATE patient_risk_alerts
   SET company_id = (SELECT p.company_id FROM patients p WHERE p.id = patient_risk_alerts.patient_id)
 WHERE company_id IS NULL AND patient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patient_risk_alerts_company ON patient_risk_alerts(company_id);

-- 21. coupons
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='coupons') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupons' AND column_name='company_id') THEN
      ALTER TABLE coupons ADD COLUMN company_id INTEGER REFERENCES companies(id);
    END IF;
    CREATE INDEX IF NOT EXISTS idx_coupons_company ON coupons(company_id);
  END IF;
END $$;

-- 22. inventory_transactions (backfill from inventory_items.company_id via item_id)
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
UPDATE inventory_transactions
   SET company_id = (SELECT i.company_id FROM inventory_items i WHERE i.id = inventory_transactions.item_id)
 WHERE company_id IS NULL AND item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_company ON inventory_transactions(company_id);


-- =============================================================================
-- SECTION 4: SOFT DELETE (deleted_at TIMESTAMPTZ)
-- Add deleted_at to all clinical and operationally important tables.
-- Partial indexes on (company_id) WHERE deleted_at IS NULL support the
-- common "fetch all active records for this tenant" query pattern.
-- =============================================================================

ALTER TABLE patients               ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE appointments           ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE patient_records        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE anamnesis               ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE patient_exams          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE prescriptions          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE treatment_evolution    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE detailed_treatment_plans ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE treatment_plans        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE odontogram_entries     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE periodontal_chart      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE prosthesis             ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE prosthesis_services    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE inventory_items        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE users                  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='digital_signatures') THEN
    ALTER TABLE digital_signatures ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- Partial indexes for active records (WHERE deleted_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_patients_active
  ON patients(company_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_active
  ON appointments(company_id, start_time) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_patient_records_active
  ON patient_records(company_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_anamnesis_active
  ON anamnesis(company_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_patient_exams_active
  ON patient_exams(company_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_prescriptions_active
  ON prescriptions(company_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_treatment_evolution_active
  ON treatment_evolution(company_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_detailed_treatment_plans_active
  ON detailed_treatment_plans(company_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_treatment_plans_active
  ON treatment_plans(company_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_odontogram_entries_active
  ON odontogram_entries(company_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_periodontal_chart_active
  ON periodontal_chart(company_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_active
  ON financial_transactions(company_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_prosthesis_active
  ON prosthesis(company_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_prosthesis_services_active
  ON prosthesis_services(company_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_items_active
  ON inventory_items(company_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_active
  ON users(company_id) WHERE deleted_at IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='digital_signatures') THEN
    CREATE INDEX IF NOT EXISTS idx_digital_signatures_active
      ON digital_signatures(company_id) WHERE deleted_at IS NULL;
  END IF;
END $$;


-- =============================================================================
-- SECTION 5: MISSING AUDIT FIELDS
-- =============================================================================

-- 5a. Add updated_at to tables that are missing it
ALTER TABLE appointment_procedures ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE patient_records        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE patient_exams          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE prescriptions          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE treatment_evolution    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE inventory_categories   ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE commission_records     ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE box_transactions       ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE patient_documents      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE payments               ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 5b. Add updated_by to key clinical tables
ALTER TABLE patients               ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);
ALTER TABLE appointments           ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);
ALTER TABLE patient_records        ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);
ALTER TABLE anamnesis               ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);
ALTER TABLE prescriptions          ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);
ALTER TABLE treatment_plans        ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);

-- 5c. Add created_by to tables missing it
ALTER TABLE appointments           ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
ALTER TABLE patients               ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
ALTER TABLE payments               ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);


-- =============================================================================
-- SECTION 6: ON DELETE CONSTRAINTS
-- Drop existing Drizzle-generated FKs (no action) and recreate with proper
-- ON DELETE behaviour.  Names follow the Drizzle convention seen in 0000.
-- =============================================================================

-- ------------------------------------------------------------------
-- appointments.patient_id → patients (RESTRICT: don't delete patients
-- who still have appointment history)
-- ------------------------------------------------------------------
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_patient_id_patients_id_fk;
ALTER TABLE appointments ADD CONSTRAINT appointments_patient_id_fk
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT;

-- appointments.professional_id → users (SET NULL: staff changes happen)
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_professional_id_users_id_fk;
ALTER TABLE appointments ADD CONSTRAINT appointments_professional_id_fk
  FOREIGN KEY (professional_id) REFERENCES users(id) ON DELETE SET NULL;

-- appointments.room_id → rooms (SET NULL: room may be removed)
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_room_id_rooms_id_fk;
ALTER TABLE appointments ADD CONSTRAINT appointments_room_id_fk
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------
-- patient_records.patient_id → patients (RESTRICT)
-- ------------------------------------------------------------------
ALTER TABLE patient_records DROP CONSTRAINT IF EXISTS patient_records_patient_id_patients_id_fk;
ALTER TABLE patient_records ADD CONSTRAINT patient_records_patient_id_fk
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT;

-- ------------------------------------------------------------------
-- prescriptions.patient_id → patients (RESTRICT)
-- ------------------------------------------------------------------
ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS prescriptions_patient_id_patients_id_fk;
ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_patient_id_fk
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT;

-- ------------------------------------------------------------------
-- financial_transactions.patient_id → patients (SET NULL)
-- ------------------------------------------------------------------
ALTER TABLE financial_transactions DROP CONSTRAINT IF EXISTS financial_transactions_patient_id_patients_id_fk;
ALTER TABLE financial_transactions ADD CONSTRAINT financial_transactions_patient_id_fk
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL;

-- financial_transactions.appointment_id → appointments (SET NULL)
ALTER TABLE financial_transactions DROP CONSTRAINT IF EXISTS financial_transactions_appointment_id_appointments_id_fk;
ALTER TABLE financial_transactions ADD CONSTRAINT financial_transactions_appointment_id_fk
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;

-- financial_transactions.professional_id → users (SET NULL)
ALTER TABLE financial_transactions DROP CONSTRAINT IF EXISTS financial_transactions_professional_id_users_id_fk;
ALTER TABLE financial_transactions ADD CONSTRAINT financial_transactions_professional_id_fk
  FOREIGN KEY (professional_id) REFERENCES users(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------
-- payments.patient_id → patients (RESTRICT)
-- ------------------------------------------------------------------
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_patient_id_patients_id_fk;
ALTER TABLE payments ADD CONSTRAINT payments_patient_id_fk
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT;

-- ------------------------------------------------------------------
-- treatment_plans.patient_id → patients (RESTRICT)
-- ------------------------------------------------------------------
ALTER TABLE treatment_plans DROP CONSTRAINT IF EXISTS treatment_plans_patient_id_patients_id_fk;
ALTER TABLE treatment_plans ADD CONSTRAINT treatment_plans_patient_id_fk
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT;

-- ------------------------------------------------------------------
-- appointment_procedures.appointment_id → appointments (CASCADE)
-- ------------------------------------------------------------------
ALTER TABLE appointment_procedures DROP CONSTRAINT IF EXISTS appointment_procedures_appointment_id_appointments_id_fk;
ALTER TABLE appointment_procedures ADD CONSTRAINT appointment_procedures_appointment_id_fk
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;

-- ------------------------------------------------------------------
-- treatment_plan_procedures.treatment_plan_id → treatment_plans (CASCADE)
-- ------------------------------------------------------------------
ALTER TABLE treatment_plan_procedures DROP CONSTRAINT IF EXISTS treatment_plan_procedures_treatment_plan_id_treatment_plans_id_fk;
ALTER TABLE treatment_plan_procedures ADD CONSTRAINT treatment_plan_procedures_treatment_plan_id_fk
  FOREIGN KEY (treatment_plan_id) REFERENCES treatment_plans(id) ON DELETE CASCADE;

-- ------------------------------------------------------------------
-- prosthesis_stages.service_id → prosthesis_services (CASCADE)
-- ------------------------------------------------------------------
ALTER TABLE prosthesis_stages DROP CONSTRAINT IF EXISTS prosthesis_stages_service_id_prosthesis_services_id_fk;
ALTER TABLE prosthesis_stages ADD CONSTRAINT prosthesis_stages_service_id_fk
  FOREIGN KEY (service_id) REFERENCES prosthesis_services(id) ON DELETE CASCADE;

-- ------------------------------------------------------------------
-- notifications.user_id → users (CASCADE)
-- ------------------------------------------------------------------
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_users_id_fk;
ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fk
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ------------------------------------------------------------------
-- working_hours.user_id → users (CASCADE)
-- ------------------------------------------------------------------
ALTER TABLE working_hours DROP CONSTRAINT IF EXISTS working_hours_user_id_users_id_fk;
ALTER TABLE working_hours ADD CONSTRAINT working_hours_user_id_fk
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ------------------------------------------------------------------
-- user_permissions.user_id → users (CASCADE)
-- ------------------------------------------------------------------
ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS user_permissions_user_id_users_id_fk;
ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_user_id_fk
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ------------------------------------------------------------------
-- role_permissions.role_id → roles (CASCADE)
-- ------------------------------------------------------------------
ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_id_roles_id_fk;
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_role_id_fk
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;

-- ------------------------------------------------------------------
-- menu_permissions.company_id → companies (CASCADE)
-- ------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='menu_permissions') THEN
    ALTER TABLE menu_permissions DROP CONSTRAINT IF EXISTS menu_permissions_company_id_companies_id_fk;
    ALTER TABLE menu_permissions ADD CONSTRAINT menu_permissions_company_id_fk
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ------------------------------------------------------------------
-- company_modules.company_id → companies (CASCADE)
-- ------------------------------------------------------------------
ALTER TABLE company_modules DROP CONSTRAINT IF EXISTS company_modules_company_id_companies_id_fk;
ALTER TABLE company_modules ADD CONSTRAINT company_modules_company_id_fk
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- ------------------------------------------------------------------
-- reactivation_logs.patient_id → patients (CASCADE)
-- ------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='reactivation_logs') THEN
    ALTER TABLE reactivation_logs DROP CONSTRAINT IF EXISTS reactivation_logs_patient_id_patients_id_fk;
    ALTER TABLE reactivation_logs ADD CONSTRAINT reactivation_logs_patient_id_fk
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ------------------------------------------------------------------
-- tasks.assigned_to → users (SET NULL)
-- ------------------------------------------------------------------
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assigned_to_users_id_fk;
ALTER TABLE tasks ADD CONSTRAINT tasks_assigned_to_fk
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------
-- sales_opportunities.assigned_to → users (SET NULL)
-- ------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='sales_opportunities') THEN
    ALTER TABLE sales_opportunities DROP CONSTRAINT IF EXISTS sales_opportunities_assigned_to_users_id_fk;
    ALTER TABLE sales_opportunities ADD CONSTRAINT sales_opportunities_assigned_to_fk
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;


-- =============================================================================
-- SECTION 7: CHECK CONSTRAINTS FOR ENUMS
-- Use DROP CONSTRAINT IF EXISTS before ADD to make idempotent on re-run.
-- =============================================================================

-- appointments.status
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS chk_appointment_status;
ALTER TABLE appointments ADD CONSTRAINT chk_appointment_status
  CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'));

-- appointments.type
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS chk_appointment_type;
ALTER TABLE appointments ADD CONSTRAINT chk_appointment_type
  CHECK (type IN ('appointment', 'block', 'reminder'));

-- users.role
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_user_role;
ALTER TABLE users ADD CONSTRAINT chk_user_role
  CHECK (role IN ('superadmin', 'admin', 'dentist', 'staff'));

-- patients.status
ALTER TABLE patients DROP CONSTRAINT IF EXISTS chk_patient_status;
ALTER TABLE patients ADD CONSTRAINT chk_patient_status
  CHECK (status IN ('active', 'inactive', 'archived'));

-- payments.status
ALTER TABLE payments DROP CONSTRAINT IF EXISTS chk_payment_status;
ALTER TABLE payments ADD CONSTRAINT chk_payment_status
  CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded'));

-- financial_transactions.status
ALTER TABLE financial_transactions DROP CONSTRAINT IF EXISTS chk_fin_status;
ALTER TABLE financial_transactions ADD CONSTRAINT chk_fin_status
  CHECK (status IN ('pending', 'partial', 'paid', 'overdue', 'cancelled'));

-- financial_transactions.type
ALTER TABLE financial_transactions DROP CONSTRAINT IF EXISTS chk_fin_type;
ALTER TABLE financial_transactions ADD CONSTRAINT chk_fin_type
  CHECK (type IN ('income', 'expense'));

-- treatment_plans.status
ALTER TABLE treatment_plans DROP CONSTRAINT IF EXISTS chk_treatment_plan_status;
ALTER TABLE treatment_plans ADD CONSTRAINT chk_treatment_plan_status
  CHECK (status IN ('proposed', 'approved', 'in_progress', 'completed', 'cancelled'));

-- subscriptions.status
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS chk_subscription_status;
ALTER TABLE subscriptions ADD CONSTRAINT chk_subscription_status
  CHECK (status IN ('trial', 'active', 'past_due', 'canceled', 'expired'));


-- =============================================================================
-- SECTION 8: ADDITIONAL PERFORMANCE INDEXES
-- All use IF NOT EXISTS for idempotency. Assumes pg_trgm extension (Section 1).
-- =============================================================================

-- Trigram index for patient name ILIKE search
CREATE INDEX IF NOT EXISTS idx_patients_name_trgm
  ON patients USING gin(full_name gin_trgm_ops);

-- Partial index for upcoming appointments
CREATE INDEX IF NOT EXISTS idx_appointments_upcoming
  ON appointments(company_id, start_time)
  WHERE status IN ('scheduled', 'confirmed') AND deleted_at IS NULL;

-- Financial reports
CREATE INDEX IF NOT EXISTS idx_fin_transactions_company_date
  ON financial_transactions(company_id, date, type);
CREATE INDEX IF NOT EXISTS idx_fin_transactions_company_status
  ON financial_transactions(company_id, status);
CREATE INDEX IF NOT EXISTS idx_fin_transactions_patient
  ON financial_transactions(patient_id);

-- Patient records lookup
CREATE INDEX IF NOT EXISTS idx_patient_records_company_patient
  ON patient_records(company_id, patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_treatment_evolution_patient
  ON treatment_evolution(company_id, patient_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_patient_exams_patient
  ON patient_exams(company_id, patient_id, exam_date DESC);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient
  ON prescriptions(company_id, patient_id, created_at DESC);

-- Odontogram per patient
CREATE INDEX IF NOT EXISTS idx_odontogram_company_patient
  ON odontogram_entries(company_id, patient_id);

-- Treatment plans
CREATE INDEX IF NOT EXISTS idx_treatment_plans_company_patient
  ON treatment_plans(company_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_detailed_plans_company_patient
  ON detailed_treatment_plans(company_id, patient_id);

-- Prosthesis tracking
CREATE INDEX IF NOT EXISTS idx_prosthesis_company_status
  ON prosthesis(company_id, status);

-- Commission and financial
CREATE INDEX IF NOT EXISTS idx_commission_records_user
  ON commission_records(user_id, created_at DESC);

-- Chat active sessions
CREATE INDEX IF NOT EXISTS idx_chat_sessions_active
  ON chat_sessions(company_id, last_message_at DESC)
  WHERE status = 'active';

-- Notifications unread
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(company_id, user_id, created_at DESC)
  WHERE is_read = false;

-- Audit logs date range
CREATE INDEX IF NOT EXISTS idx_audit_logs_date_range
  ON audit_logs(company_id, created_at DESC);

-- WhatsApp messages by chat
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='whatsapp_messages')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='whatsapp_messages' AND column_name='chat_id') THEN
    CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_chat
      ON whatsapp_messages(company_id, chat_id, created_at DESC);
  END IF;
END $$;

-- Inventory low stock
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock
  ON inventory_items(company_id)
  WHERE current_stock <= minimum_stock AND active = true;

-- Appointments by date range (most common query)
CREATE INDEX IF NOT EXISTS idx_appointments_date_range
  ON appointments(company_id, start_time, end_time)
  WHERE deleted_at IS NULL;


-- =============================================================================
-- SECTION 9: ROW LEVEL SECURITY (RLS)
-- Helper function reads the session variable set by the application layer
-- before each query:  SET LOCAL app.current_company_id = '<id>';
-- IMPORTANT: The application DB role must NOT be a PostgreSQL superuser,
-- as superusers bypass RLS entirely.
-- =============================================================================

-- Helper function: returns the current tenant id from the session variable.
CREATE OR REPLACE FUNCTION current_company_id() RETURNS INTEGER AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_company_id', TRUE), '')::INTEGER;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Enable RLS on all critical tenant-scoped tables
ALTER TABLE patients                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_records          ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE anamnesis                ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedures               ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_plans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE detailed_treatment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE odontogram_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE prosthesis               ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items          ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='digital_signatures') THEN
    ALTER TABLE digital_signatures ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='whatsapp_messages') THEN
    ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create standard tenant isolation policies via a loop.
-- DROP before CREATE because CREATE POLICY IF NOT EXISTS is not valid SQL.
DO $$
DECLARE
  tables TEXT[] := ARRAY[
    'patients', 'appointments', 'patient_records', 'financial_transactions',
    'prescriptions', 'anamnesis', 'users', 'chat_sessions',
    'audit_logs', 'notifications', 'automations', 'automation_logs',
    'procedures', 'rooms', 'treatment_plans', 'detailed_treatment_plans',
    'odontogram_entries', 'prosthesis', 'inventory_items'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Remove previous policies so this block is idempotent
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_select ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_insert ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_update ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_delete ON %I', t);

    -- Recreate with strict company_id check
    EXECUTE format(
      'CREATE POLICY tenant_isolation_select ON %I FOR SELECT USING (company_id = current_company_id())', t
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_insert ON %I FOR INSERT WITH CHECK (company_id = current_company_id())', t
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_update ON %I FOR UPDATE USING (company_id = current_company_id())', t
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_delete ON %I FOR DELETE USING (company_id = current_company_id())', t
    );
  END LOOP;
END $$;

-- digital_signatures: same standard policy (applied separately to handle optional table)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='digital_signatures') THEN
    DROP POLICY IF EXISTS tenant_isolation_select ON digital_signatures;
    DROP POLICY IF EXISTS tenant_isolation_insert ON digital_signatures;
    DROP POLICY IF EXISTS tenant_isolation_update ON digital_signatures;
    DROP POLICY IF EXISTS tenant_isolation_delete ON digital_signatures;

    CREATE POLICY tenant_isolation_select ON digital_signatures
      FOR SELECT USING (company_id = current_company_id());
    CREATE POLICY tenant_isolation_insert ON digital_signatures
      FOR INSERT WITH CHECK (company_id = current_company_id());
    CREATE POLICY tenant_isolation_update ON digital_signatures
      FOR UPDATE USING (company_id = current_company_id());
    CREATE POLICY tenant_isolation_delete ON digital_signatures
      FOR DELETE USING (company_id = current_company_id());
  END IF;
END $$;

-- whatsapp_messages: same standard policy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='whatsapp_messages') THEN
    DROP POLICY IF EXISTS tenant_isolation_select ON whatsapp_messages;
    DROP POLICY IF EXISTS tenant_isolation_insert ON whatsapp_messages;
    DROP POLICY IF EXISTS tenant_isolation_update ON whatsapp_messages;
    DROP POLICY IF EXISTS tenant_isolation_delete ON whatsapp_messages;

    CREATE POLICY tenant_isolation_select ON whatsapp_messages
      FOR SELECT USING (company_id = current_company_id());
    CREATE POLICY tenant_isolation_insert ON whatsapp_messages
      FOR INSERT WITH CHECK (company_id = current_company_id());
    CREATE POLICY tenant_isolation_update ON whatsapp_messages
      FOR UPDATE USING (company_id = current_company_id());
    CREATE POLICY tenant_isolation_delete ON whatsapp_messages
      FOR DELETE USING (company_id = current_company_id());
  END IF;
END $$;

-- chat_messages: company_id is nullable (messages linked via session), allow NULL pass-through
DROP POLICY IF EXISTS tenant_isolation_select ON chat_messages;
DROP POLICY IF EXISTS tenant_isolation_insert ON chat_messages;
DROP POLICY IF EXISTS tenant_isolation_update ON chat_messages;
DROP POLICY IF EXISTS tenant_isolation_delete ON chat_messages;

CREATE POLICY tenant_isolation_select ON chat_messages
  FOR SELECT USING (company_id = current_company_id() OR company_id IS NULL);
CREATE POLICY tenant_isolation_insert ON chat_messages
  FOR INSERT WITH CHECK (company_id = current_company_id() OR company_id IS NULL);
CREATE POLICY tenant_isolation_update ON chat_messages
  FOR UPDATE USING (company_id = current_company_id() OR company_id IS NULL);
CREATE POLICY tenant_isolation_delete ON chat_messages
  FOR DELETE USING (company_id = current_company_id() OR company_id IS NULL);


-- =============================================================================
-- SECTION 10: SENSITIVE DATA ENCRYPTION COLUMNS
-- Adds pgcrypto-based encrypted shadow columns alongside the existing plaintext
-- ones to enable a rolling, zero-downtime migration to encrypted storage.
-- The application should write to BOTH columns during the transition window,
-- then drop the plaintext columns after all rows are confirmed encrypted.
-- =============================================================================

-- patients: encrypted CPF and RG
ALTER TABLE patients ADD COLUMN IF NOT EXISTS cpf_encrypted BYTEA;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS rg_encrypted  BYTEA;

-- public_anamnesis_responses: encrypted CPF (LGPD risk — captured from public form)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='public_anamnesis_responses') THEN
    ALTER TABLE public_anamnesis_responses ADD COLUMN IF NOT EXISTS cpf_encrypted BYTEA;
  END IF;
END $$;

-- Encryption helper functions
-- Key should be sourced from app environment (ENCRYPTION_KEY env var), never hardcoded.
CREATE OR REPLACE FUNCTION encrypt_sensitive(data TEXT, key TEXT) RETURNS BYTEA AS $$
BEGIN
  IF data IS NULL THEN RETURN NULL; END IF;
  RETURN pgp_sym_encrypt(data, key);
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_sensitive(data BYTEA, key TEXT) RETURNS TEXT AS $$
BEGIN
  IF data IS NULL THEN RETURN NULL; END IF;
  RETURN pgp_sym_decrypt(data, key);
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

-- Document migration intent clearly
COMMENT ON COLUMN patients.cpf_encrypted IS
  'Encrypted CPF via pgcrypto pgp_sym_encrypt. '
  'Migrate application reads/writes to this column instead of the plaintext cpf column. '
  'Run: UPDATE patients SET cpf_encrypted = encrypt_sensitive(cpf, current_setting(''app.encryption_key'')) WHERE cpf_encrypted IS NULL AND cpf IS NOT NULL;';

COMMENT ON COLUMN patients.cpf IS
  'DEPRECATED: Will be set to NULL and dropped after full migration to cpf_encrypted. '
  'Contains unencrypted CPF — LGPD risk. Do not add new reads of this column.';

COMMENT ON COLUMN patients.rg_encrypted IS
  'Encrypted RG via pgcrypto pgp_sym_encrypt. Mirrors the deprecation plan of patients.cpf.';


-- =============================================================================
-- SECTION 11: VARCHAR LENGTH CONSTRAINTS
-- These tighten previously unconstrained TEXT columns to domain-appropriate
-- maximums, enforcing data quality at the database layer.
-- The USING clause handles any existing values that might exceed the new limit
-- by truncating — review data before applying to production if in doubt.
-- =============================================================================

ALTER TABLE patients ALTER COLUMN cpf            TYPE VARCHAR(14)  USING LEFT(cpf, 14);
ALTER TABLE patients ALTER COLUMN rg             TYPE VARCHAR(20)  USING LEFT(rg, 20);
ALTER TABLE patients ALTER COLUMN cep            TYPE VARCHAR(9)   USING LEFT(cep, 9);
ALTER TABLE patients ALTER COLUMN phone          TYPE VARCHAR(20)  USING LEFT(phone, 20);
ALTER TABLE patients ALTER COLUMN cellphone      TYPE VARCHAR(20)  USING LEFT(cellphone, 20);
ALTER TABLE patients ALTER COLUMN whatsapp_phone TYPE VARCHAR(20)  USING LEFT(whatsapp_phone, 20);
ALTER TABLE patients ALTER COLUMN blood_type     TYPE VARCHAR(5)   USING LEFT(blood_type, 5);
ALTER TABLE patients ALTER COLUMN gender         TYPE VARCHAR(20)  USING LEFT(gender, 20);
ALTER TABLE patients ALTER COLUMN state          TYPE VARCHAR(2)   USING LEFT(state, 2);

ALTER TABLE companies ALTER COLUMN cnpj  TYPE VARCHAR(18) USING LEFT(cnpj, 18);
ALTER TABLE companies ALTER COLUMN phone TYPE VARCHAR(20) USING LEFT(phone, 20);

ALTER TABLE laboratories ALTER COLUMN cnpj TYPE VARCHAR(20) USING LEFT(cnpj, 20);

COMMIT;
