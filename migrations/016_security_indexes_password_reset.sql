-- Migration 016: Security improvements, composite indexes, and password reset tokens
-- Date: 2026-04-02
-- Priority: P1 (Security + Performance)

-- ============================================================
-- 1. PASSWORD RESET TOKEN FIELDS
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP;

-- ============================================================
-- 2. COMPOSITE INDEXES FOR TENANT ISOLATION PERFORMANCE
-- These indexes dramatically improve query performance on
-- multi-tenant tables by covering the most common WHERE clauses.
-- ============================================================

-- Patients: most queries filter by company_id
CREATE INDEX IF NOT EXISTS idx_patients_company_id ON patients(company_id);
CREATE INDEX IF NOT EXISTS idx_patients_company_status ON patients(company_id, status);
CREATE INDEX IF NOT EXISTS idx_patients_company_name ON patients(company_id, full_name);
CREATE INDEX IF NOT EXISTS idx_patients_company_cpf ON patients(company_id, cpf);
CREATE INDEX IF NOT EXISTS idx_patients_company_whatsapp ON patients(company_id, whatsapp_phone);

-- Appointments: high-frequency queries by company + date range
CREATE INDEX IF NOT EXISTS idx_appointments_company_id ON appointments(company_id);
CREATE INDEX IF NOT EXISTS idx_appointments_company_start ON appointments(company_id, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_company_status ON appointments(company_id, status);
CREATE INDEX IF NOT EXISTS idx_appointments_company_professional ON appointments(company_id, professional_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);

-- Users: company isolation + authentication lookups
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_company_role ON users(company_id, role);

-- Payments: financial queries by company + date
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_company_date ON payments(company_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_company_status ON payments(company_id, status);

-- Audit logs: compliance queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_user ON audit_logs(company_id, user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_resource ON audit_logs(company_id, resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Chat sessions: WhatsApp lookups
CREATE INDEX IF NOT EXISTS idx_chat_sessions_company_phone ON chat_sessions(company_id, phone);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_company_status ON chat_sessions(company_id, status);

-- WhatsApp messages: conversation queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_company ON whatsapp_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_session ON whatsapp_messages(session_id);

-- CRM: sales pipeline queries
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_company ON sales_opportunities(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_stage ON sales_opportunities(company_id, stage_id);

-- Subscriptions: billing lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_company ON subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(company_id, status);

-- Anamnesis: clinical record lookups
CREATE INDEX IF NOT EXISTS idx_anamnesis_company_patient ON anamnesis(company_id, patient_id);

-- Treatment plans
CREATE INDEX IF NOT EXISTS idx_treatment_plans_company ON detailed_treatment_plans(company_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plans_patient ON detailed_treatment_plans(patient_id);

-- Inventory
CREATE INDEX IF NOT EXISTS idx_inventory_items_company ON inventory_items(company_id);

-- ============================================================
-- 3. PARTIAL INDEX for active records (soft delete optimization)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_patients_company_active ON patients(company_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_appointments_company_upcoming ON appointments(company_id, start_time) WHERE status IN ('scheduled', 'confirmed');
