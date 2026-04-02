-- ================================================================
-- Migration 014: Create all missing tables from schema.ts
-- These tables exist in the Drizzle schema but were never created
-- ================================================================

BEGIN;

-- =============================================
-- WHATSAPP MESSAGES
-- =============================================
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER REFERENCES patients(id),
  appointment_id INTEGER REFERENCES appointments(id),
  message_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  direction TEXT NOT NULL,
  "from" TEXT NOT NULL,
  "to" TEXT NOT NULL,
  "timestamp" TIMESTAMP NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  media_url TEXT,
  error TEXT,
  is_automated BOOLEAN DEFAULT false,
  automation_type TEXT,
  template_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- AUDIT LOGS (LGPD)
-- =============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id INTEGER,
  sensitive_data BOOLEAN DEFAULT false,
  data_category TEXT,
  description TEXT,
  changes JSONB,
  reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  method TEXT,
  url TEXT,
  status_code INTEGER,
  lgpd_justification TEXT,
  consent_given BOOLEAN,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- NOTIFICATIONS
-- =============================================
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_resource TEXT,
  related_resource_id INTEGER,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP,
  action_url TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- =============================================
-- MENU PERMISSIONS
-- =============================================
CREATE TABLE IF NOT EXISTS menu_permissions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  role TEXT NOT NULL,
  menu_item TEXT NOT NULL,
  label TEXT NOT NULL,
  path TEXT NOT NULL,
  icon TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT true,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  "order" INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- CHAT SESSIONS
-- =============================================
CREATE TABLE IF NOT EXISTS chat_sessions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  phone VARCHAR(20) NOT NULL,
  user_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
  patient_id INTEGER REFERENCES patients(id),
  professional_id INTEGER REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'active',
  current_state VARCHAR(50),
  state_data JSONB,
  context JSONB,
  last_message_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- CHAT MESSAGES
-- =============================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  company_id INTEGER REFERENCES companies(id),
  role VARCHAR(20),
  direction VARCHAR(20) DEFAULT 'incoming',
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text',
  media_url VARCHAR(500),
  mime_type VARCHAR(100),
  file_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending',
  read_at TIMESTAMP,
  intent VARCHAR(50),
  processed_by VARCHAR(20),
  tokens_used INTEGER DEFAULT 0,
  metadata JSONB,
  wuzapi_message_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- CANNED RESPONSES
-- =============================================
CREATE TABLE IF NOT EXISTS canned_responses (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  intent VARCHAR(50) NOT NULL,
  template TEXT NOT NULL,
  variables JSONB,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- ADMIN PHONES
-- =============================================
CREATE TABLE IF NOT EXISTS admin_phones (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  phone VARCHAR(20) NOT NULL,
  name VARCHAR(100),
  role VARCHAR(50) DEFAULT 'admin',
  receive_daily_report BOOLEAN DEFAULT true,
  receive_urgencies BOOLEAN DEFAULT true,
  receive_new_appointments BOOLEAN DEFAULT true,
  receive_cancellations BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- INTENT PATTERNS
-- =============================================
CREATE TABLE IF NOT EXISTS intent_patterns (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id),
  intent VARCHAR(50) NOT NULL,
  pattern TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- REACTIVATION LOGS
-- =============================================
CREATE TABLE IF NOT EXISTS reactivation_logs (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  period_months INTEGER NOT NULL,
  sent_at TIMESTAMP DEFAULT NOW(),
  message_template TEXT,
  whatsapp_message_id TEXT,
  status TEXT DEFAULT 'sent',
  error_message TEXT,
  patient_last_visit TIMESTAMP
);

-- =============================================
-- RISK ALERT TYPES
-- =============================================
CREATE TABLE IF NOT EXISTS risk_alert_types (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#EF4444',
  icon TEXT DEFAULT 'alert-triangle',
  severity TEXT NOT NULL DEFAULT 'high',
  description TEXT,
  clinical_warning TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- PATIENT RISK ALERTS
-- =============================================
CREATE TABLE IF NOT EXISTS patient_risk_alerts (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  alert_type_id INTEGER NOT NULL REFERENCES risk_alert_types(id),
  details TEXT,
  notes TEXT,
  detected_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- PUBLIC ANAMNESIS LINKS
-- =============================================
CREATE TABLE IF NOT EXISTS public_anamnesis_links (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER REFERENCES patients(id),
  appointment_id INTEGER REFERENCES appointments(id),
  template_id INTEGER REFERENCES anamnesis_templates(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP,
  used_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- PUBLIC ANAMNESIS RESPONSES
-- =============================================
CREATE TABLE IF NOT EXISTS public_anamnesis_responses (
  id SERIAL PRIMARY KEY,
  link_id INTEGER NOT NULL REFERENCES public_anamnesis_links(id),
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER REFERENCES patients(id),
  full_name TEXT,
  email TEXT,
  phone TEXT,
  cpf TEXT,
  date_of_birth DATE,
  responses JSONB NOT NULL,
  detected_alerts JSONB DEFAULT '[]'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  consent_given BOOLEAN DEFAULT false,
  consent_timestamp TIMESTAMP,
  processed_at TIMESTAMP,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- CRM - SALES FUNNEL STAGES
-- =============================================
CREATE TABLE IF NOT EXISTS sales_funnel_stages (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  "order" INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  is_won BOOLEAN DEFAULT false,
  is_lost BOOLEAN DEFAULT false,
  auto_move_after_days INTEGER,
  next_stage_id INTEGER,
  automation_trigger TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- CRM - SALES OPPORTUNITIES
-- =============================================
CREATE TABLE IF NOT EXISTS sales_opportunities (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER REFERENCES patients(id),
  stage_id INTEGER NOT NULL REFERENCES sales_funnel_stages(id),
  chat_session_id INTEGER REFERENCES chat_sessions(id),
  ai_stage TEXT,
  ai_stage_updated_at TIMESTAMP,
  lead_name TEXT,
  lead_phone TEXT,
  lead_email TEXT,
  lead_source TEXT,
  title TEXT NOT NULL,
  description TEXT,
  treatment_type TEXT,
  estimated_value DECIMAL(10, 2),
  probability INTEGER DEFAULT 50,
  expected_close_date DATE,
  assigned_to INTEGER REFERENCES users(id),
  stage_entered_at TIMESTAMP DEFAULT NOW(),
  last_contact_at TIMESTAMP,
  next_follow_up_at TIMESTAMP,
  won_at TIMESTAMP,
  lost_at TIMESTAMP,
  lost_reason TEXT,
  notes TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  custom_fields JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- CRM - SALES OPPORTUNITY HISTORY
-- =============================================
CREATE TABLE IF NOT EXISTS sales_opportunity_history (
  id SERIAL PRIMARY KEY,
  opportunity_id INTEGER NOT NULL REFERENCES sales_opportunities(id),
  from_stage_id INTEGER REFERENCES sales_funnel_stages(id),
  to_stage_id INTEGER REFERENCES sales_funnel_stages(id),
  action TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- CRM - SALES TASKS
-- =============================================
CREATE TABLE IF NOT EXISTS sales_tasks (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  opportunity_id INTEGER REFERENCES sales_opportunities(id),
  patient_id INTEGER REFERENCES patients(id),
  assigned_to INTEGER REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL DEFAULT 'follow_up',
  due_date TIMESTAMP,
  completed_at TIMESTAMP,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'pending',
  result TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- APPOINTMENT CONFIRMATION LINKS
-- =============================================
CREATE TABLE IF NOT EXISTS appointment_confirmation_links (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  appointment_id INTEGER NOT NULL REFERENCES appointments(id),
  token TEXT NOT NULL UNIQUE,
  action TEXT DEFAULT 'confirm',
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- COUPONS
-- =============================================
CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_value DECIMAL(10, 2) NOT NULL,
  max_uses INTEGER,
  current_uses INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMP DEFAULT NOW(),
  valid_until TIMESTAMP,
  applicable_plans JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- COUPON USAGES
-- =============================================
CREATE TABLE IF NOT EXISTS coupon_usages (
  id SERIAL PRIMARY KEY,
  coupon_id INTEGER NOT NULL REFERENCES coupons(id),
  company_id INTEGER NOT NULL REFERENCES companies(id),
  subscription_id INTEGER REFERENCES subscriptions(id),
  discount_applied DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- PROFESSIONAL COMMISSIONS
-- =============================================
CREATE TABLE IF NOT EXISTS professional_commissions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  professional_id INTEGER NOT NULL REFERENCES users(id),
  appointment_id INTEGER REFERENCES appointments(id),
  procedure_id INTEGER REFERENCES procedures(id),
  patient_id INTEGER REFERENCES patients(id),
  appointment_date TIMESTAMP,
  procedure_name TEXT,
  procedure_value DECIMAL(10, 2),
  commission_percentage DECIMAL(5, 2),
  commission_value DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMP,
  payment_reference TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- DIGITIZATION HISTORY
-- =============================================
CREATE TABLE IF NOT EXISTS digitization_history (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  user_id INTEGER REFERENCES users(id),
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  pages_count INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  extracted_data JSONB,
  error_message TEXT,
  processing_time_ms INTEGER,
  tokens_used INTEGER DEFAULT 0,
  cost_cents INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- =============================================
-- INDEXES for performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_company ON whatsapp_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_chat ON whatsapp_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_company ON chat_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_phone ON chat_sessions(phone);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_company ON sales_opportunities(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_stage ON sales_opportunities(stage_id);
CREATE INDEX IF NOT EXISTS idx_sales_funnel_stages_company ON sales_funnel_stages(company_id);
CREATE INDEX IF NOT EXISTS idx_patient_risk_alerts_patient ON patient_risk_alerts(patient_id);
CREATE INDEX IF NOT EXISTS idx_reactivation_logs_patient ON reactivation_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_professional_commissions_professional ON professional_commissions(professional_id);

COMMIT;
