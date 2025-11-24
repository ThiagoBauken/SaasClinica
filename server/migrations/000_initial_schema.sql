-- ============================================
-- INITIAL DATABASE SCHEMA
-- ============================================
-- This script creates all tables from scratch in the correct dependency order
-- Idempotent: Safe to run multiple times (uses IF NOT EXISTS)
-- ============================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CORE TABLES (No dependencies)
-- ============================================

-- Companies/Organizations
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  cnpj TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  trial_ends_at TIMESTAMP,
  openai_api_key TEXT,
  n8n_webhook_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Modules available in the system
CREATE TABLE IF NOT EXISTS modules (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  version TEXT NOT NULL DEFAULT '1.0.0',
  is_active BOOLEAN NOT NULL DEFAULT true,
  required_permissions JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Permissions system
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Roles
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- SaaS Plans
CREATE TABLE IF NOT EXISTS plans (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  monthly_price DECIMAL(10, 2) NOT NULL,
  yearly_price DECIMAL(10, 2),
  trial_days INTEGER NOT NULL DEFAULT 14,
  max_users INTEGER NOT NULL DEFAULT 5,
  max_patients INTEGER NOT NULL DEFAULT 100,
  max_appointments_per_month INTEGER NOT NULL DEFAULT 500,
  max_automations INTEGER NOT NULL DEFAULT 5,
  max_storage_gb INTEGER NOT NULL DEFAULT 5,
  features JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Prosthesis Types (predefined)
CREATE TABLE IF NOT EXISTS prosthesis_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  default_stages JSONB,
  default_price DECIMAL(10, 2),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Standard Dental Products
CREATE TABLE IF NOT EXISTS standard_dental_products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  brand TEXT,
  unit_of_measure TEXT NOT NULL,
  estimated_price INTEGER,
  tags JSONB DEFAULT '[]',
  is_popular BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Payment Plans (general)
CREATE TABLE IF NOT EXISTS payment_plans (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  installments INTEGER DEFAULT 1,
  interval TEXT DEFAULT 'month',
  interest DECIMAL(5, 2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Financial Categories
CREATE TABLE IF NOT EXISTS financial_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  color TEXT,
  parent_id INTEGER REFERENCES financial_categories(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Fiscal Settings
CREATE TABLE IF NOT EXISTS fiscal_settings (
  id SERIAL PRIMARY KEY,
  nfse_provider TEXT,
  nfse_token TEXT,
  nfse_url TEXT,
  emit_receipt_for TEXT DEFAULT 'all',
  receipt_type TEXT DEFAULT 'standard',
  default_tax_rate DECIMAL(5, 2),
  default_service_code TEXT,
  terms_and_conditions TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Communication Settings
CREATE TABLE IF NOT EXISTS communication_settings (
  id SERIAL PRIMARY KEY,
  whatsapp_integration_enabled BOOLEAN DEFAULT false,
  whatsapp_provider TEXT,
  whatsapp_api_key TEXT,
  whatsapp_number TEXT,
  email_integration_enabled BOOLEAN DEFAULT false,
  email_provider TEXT,
  email_api_key TEXT,
  email_sender TEXT,
  sms_integration_enabled BOOLEAN DEFAULT false,
  sms_provider TEXT,
  sms_api_key TEXT,
  sms_number TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- COMPANY-DEPENDENT TABLES
-- ============================================

-- Company-Module relationship
CREATE TABLE IF NOT EXISTS company_modules (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  module_id INTEGER NOT NULL REFERENCES modules(id),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  settings JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Users and Authentication
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  email TEXT NOT NULL,
  phone TEXT,
  profile_image_url TEXT,
  speciality TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  google_id TEXT UNIQUE,
  google_calendar_id TEXT,
  google_access_token TEXT,
  google_refresh_token TEXT,
  google_token_expiry TIMESTAMP,
  wuzapi_phone TEXT,
  cfo_registration_number TEXT,
  cfo_state TEXT,
  digital_certificate_path TEXT,
  trial_ends_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Clinic Settings (one per company)
CREATE TABLE IF NOT EXISTS clinic_settings (
  id SERIAL PRIMARY KEY,
  company_id INTEGER UNIQUE REFERENCES companies(id),
  name TEXT NOT NULL,
  trading_name TEXT,
  cnpj TEXT,
  responsible TEXT,
  email TEXT,
  phone TEXT,
  cellphone TEXT,
  logo TEXT,
  opening_time TEXT NOT NULL,
  closing_time TEXT NOT NULL,
  address TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  complement TEXT,
  number TEXT,
  time_zone TEXT DEFAULT 'America/Sao_Paulo',
  receipt_print_enabled BOOLEAN DEFAULT false,
  receipt_header TEXT,
  receipt_footer TEXT,
  wuzapi_instance_id TEXT,
  wuzapi_api_key TEXT,
  default_google_calendar_id TEXT,
  n8n_webhook_base_url TEXT,
  admin_whatsapp_phone TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Rooms
CREATE TABLE IF NOT EXISTS rooms (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Chairs (equipment)
CREATE TABLE IF NOT EXISTS chairs (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  room_id INTEGER REFERENCES rooms(id),
  description TEXT,
  status TEXT DEFAULT 'active',
  serial_number TEXT,
  manufacturer TEXT,
  purchase_date DATE,
  warranty_until DATE,
  maintenance_schedule JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Procedures/Services
CREATE TABLE IF NOT EXISTS procedures (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  duration INTEGER NOT NULL,
  price INTEGER NOT NULL,
  description TEXT,
  color TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Patients
CREATE TABLE IF NOT EXISTS patients (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  full_name TEXT NOT NULL,
  birth_date TIMESTAMP,
  cpf TEXT,
  rg TEXT,
  gender TEXT,
  nationality TEXT,
  marital_status TEXT,
  profession TEXT,
  email TEXT,
  phone TEXT,
  cellphone TEXT,
  whatsapp_phone TEXT,
  address TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  cep TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relation TEXT,
  health_insurance TEXT,
  health_insurance_number TEXT,
  blood_type TEXT,
  allergies TEXT,
  medications TEXT,
  chronic_diseases TEXT,
  patient_number TEXT UNIQUE,
  status TEXT DEFAULT 'active',
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  profile_photo TEXT,
  last_visit TIMESTAMP,
  insurance_info JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Appointments
CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  title TEXT NOT NULL,
  patient_id INTEGER REFERENCES patients(id),
  professional_id INTEGER REFERENCES users(id),
  room_id INTEGER REFERENCES rooms(id),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  type TEXT NOT NULL DEFAULT 'appointment',
  notes TEXT,
  color TEXT,
  recurring BOOLEAN DEFAULT false,
  recurrence_pattern TEXT,
  automation_enabled BOOLEAN DEFAULT true,
  automation_params JSONB,
  google_calendar_event_id TEXT,
  wuzapi_message_id TEXT,
  automation_status TEXT DEFAULT 'pending',
  automation_sent_at TIMESTAMP,
  automation_error TEXT,
  last_reminder_sent TIMESTAMP,
  confirmation_method TEXT,
  confirmed_by_patient BOOLEAN DEFAULT false,
  confirmation_date TIMESTAMP,
  confirmation_message_id TEXT,
  patient_response TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Appointment-Procedures relationship
CREATE TABLE IF NOT EXISTS appointment_procedures (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER NOT NULL REFERENCES appointments(id),
  procedure_id INTEGER NOT NULL REFERENCES procedures(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  price INTEGER NOT NULL,
  notes TEXT
);

-- Working Hours
CREATE TABLE IF NOT EXISTS working_hours (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  day_of_week INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  is_working BOOLEAN NOT NULL DEFAULT true
);

-- Holidays
CREATE TABLE IF NOT EXISTS holidays (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id),
  name TEXT NOT NULL,
  date TIMESTAMP NOT NULL,
  is_recurring_yearly BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Automations (N8N)
CREATE TABLE IF NOT EXISTS automations (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  time_before_value INTEGER,
  time_before_unit TEXT,
  appointment_status TEXT,
  whatsapp_enabled BOOLEAN DEFAULT false,
  whatsapp_template_id TEXT,
  whatsapp_template_variables TEXT,
  email_enabled BOOLEAN DEFAULT false,
  email_sender TEXT,
  email_subject TEXT,
  email_body TEXT,
  sms_enabled BOOLEAN DEFAULT false,
  sms_text TEXT,
  webhook_url TEXT,
  custom_headers JSONB,
  response_actions JSONB,
  log_level TEXT DEFAULT 'complete',
  active BOOLEAN DEFAULT true,
  n8n_workflow_id TEXT,
  last_execution TIMESTAMP,
  execution_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Automation Logs
CREATE TABLE IF NOT EXISTS automation_logs (
  id SERIAL PRIMARY KEY,
  automation_id INTEGER REFERENCES automations(id) ON DELETE CASCADE,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  execution_status TEXT NOT NULL,
  execution_time INTEGER,
  error_message TEXT,
  payload JSONB,
  sent_to TEXT,
  message_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Patient Records
CREATE TABLE IF NOT EXISTS patient_records (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  record_type TEXT NOT NULL,
  content JSONB NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Patient Documents
CREATE TABLE IF NOT EXISTS patient_documents (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT,
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Anamnesis (digital medical history)
CREATE TABLE IF NOT EXISTS anamnesis (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  chief_complaint TEXT,
  current_illness_history TEXT,
  medical_history TEXT,
  current_medications TEXT,
  allergies_detail TEXT,
  previous_surgeries TEXT,
  hospitalizations TEXT,
  dental_history TEXT,
  previous_dental_treatments TEXT,
  orthodontic_treatment BOOLEAN DEFAULT false,
  oral_hygiene_frequency TEXT,
  smoking BOOLEAN DEFAULT false,
  smoking_frequency TEXT,
  alcohol BOOLEAN DEFAULT false,
  alcohol_frequency TEXT,
  bruxism BOOLEAN DEFAULT false,
  nail_biting BOOLEAN DEFAULT false,
  heart_disease BOOLEAN DEFAULT false,
  high_blood_pressure BOOLEAN DEFAULT false,
  diabetes BOOLEAN DEFAULT false,
  hepatitis BOOLEAN DEFAULT false,
  kidney_disease BOOLEAN DEFAULT false,
  pregnant BOOLEAN DEFAULT false,
  pregnancy_month INTEGER,
  additional_info TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Anamnesis Templates
CREATE TABLE IF NOT EXISTS anamnesis_templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  fields JSONB NOT NULL,
  active BOOLEAN DEFAULT true,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Patient Exams
CREATE TABLE IF NOT EXISTS patient_exams (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  exam_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  exam_date TIMESTAMP DEFAULT NOW(),
  file_url TEXT,
  file_type TEXT,
  results TEXT,
  observations TEXT,
  requested_by INTEGER NOT NULL REFERENCES users(id),
  performed_at TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Detailed Treatment Plans
CREATE TABLE IF NOT EXISTS detailed_treatment_plans (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  professional_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  diagnosis TEXT,
  objectives TEXT,
  phases JSONB,
  estimated_cost INTEGER,
  approved_cost INTEGER,
  status TEXT DEFAULT 'proposed',
  priority TEXT DEFAULT 'normal',
  proposed_date TIMESTAMP DEFAULT NOW(),
  approved_date TIMESTAMP,
  start_date TIMESTAMP,
  expected_end_date TIMESTAMP,
  completed_date TIMESTAMP,
  notes TEXT,
  patient_consent BOOLEAN DEFAULT false,
  consent_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Treatment Evolution
CREATE TABLE IF NOT EXISTS treatment_evolution (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  appointment_id INTEGER REFERENCES appointments(id),
  treatment_plan_id INTEGER REFERENCES detailed_treatment_plans(id),
  session_date TIMESTAMP NOT NULL,
  session_number INTEGER,
  procedures_performed TEXT,
  materials_used TEXT,
  clinical_observations TEXT,
  patient_response TEXT,
  complications TEXT,
  next_session TEXT,
  homecare_instructions TEXT,
  performed_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Treatment Plans (financial)
CREATE TABLE IF NOT EXISTS treatment_plans (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  professional_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  total_amount INTEGER NOT NULL,
  paid_amount INTEGER DEFAULT 0,
  discount_amount INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'proposed',
  payment_plan JSONB,
  start_date TIMESTAMP,
  completed_date TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Treatment Plan Procedures
CREATE TABLE IF NOT EXISTS treatment_plan_procedures (
  id SERIAL PRIMARY KEY,
  treatment_plan_id INTEGER NOT NULL REFERENCES treatment_plans(id),
  procedure_id INTEGER NOT NULL REFERENCES procedures(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL,
  total_price INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  appointment_id INTEGER REFERENCES appointments(id),
  completed_date TIMESTAMP,
  notes TEXT
);

-- Digital Signatures (CFO)
CREATE TABLE IF NOT EXISTS digital_signatures (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  professional_id INTEGER NOT NULL REFERENCES users(id),
  document_type TEXT NOT NULL,
  document_id INTEGER NOT NULL,
  certificate_serial_number TEXT,
  certificate_name TEXT,
  certificate_issuer TEXT,
  certificate_valid_from TIMESTAMP,
  certificate_valid_until TIMESTAMP,
  cfo_registration_number TEXT NOT NULL,
  cfo_state TEXT NOT NULL,
  signed_pdf_url TEXT NOT NULL,
  signature_hash TEXT,
  qr_code_data TEXT,
  cfo_validation_url TEXT,
  signed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'valid',
  revoked_at TIMESTAMP,
  revoked_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Prescriptions (includes prescriptions, attestations, certificates)
CREATE TABLE IF NOT EXISTS prescriptions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  medications JSONB,
  instructions TEXT,
  attestation_type TEXT,
  period TEXT,
  cid TEXT,
  valid_until TIMESTAMP,
  prescribed_by INTEGER NOT NULL REFERENCES users(id),
  issued BOOLEAN DEFAULT false,
  issued_at TIMESTAMP,
  signature_id INTEGER REFERENCES digital_signatures(id),
  digitally_signed BOOLEAN DEFAULT false,
  signed_pdf_url TEXT,
  validated_by_cfo BOOLEAN DEFAULT false,
  cfo_validation_url TEXT,
  qr_code_data TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Odontogram Entries
CREATE TABLE IF NOT EXISTS odontogram_entries (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  tooth_id TEXT NOT NULL,
  face_id TEXT,
  status TEXT NOT NULL,
  color TEXT,
  notes TEXT,
  procedure_id INTEGER REFERENCES procedures(id),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Periodontal Chart (Periodontograma)
CREATE TABLE IF NOT EXISTS periodontal_chart (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  professional_id INTEGER REFERENCES users(id),
  chart_date TIMESTAMP NOT NULL DEFAULT NOW(),
  teeth_data JSONB NOT NULL DEFAULT '[]',
  general_notes TEXT,
  diagnosis TEXT,
  treatment_plan TEXT,
  plaque_index DECIMAL(5, 2),
  bleeding_index DECIMAL(5, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Inventory Categories
CREATE TABLE IF NOT EXISTS inventory_categories (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Inventory Items
CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  description TEXT,
  category_id INTEGER REFERENCES inventory_categories(id),
  sku TEXT,
  barcode TEXT,
  brand TEXT,
  supplier TEXT,
  minimum_stock INTEGER DEFAULT 0,
  current_stock INTEGER DEFAULT 0,
  price INTEGER,
  unit_of_measure TEXT,
  expiration_date TIMESTAMP,
  location TEXT,
  last_purchase_date TIMESTAMP,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Inventory Transactions
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES inventory_items(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  reason TEXT,
  notes TEXT,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  appointment_id INTEGER REFERENCES appointments(id),
  patient_id INTEGER REFERENCES patients(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Prosthesis Control
CREATE TABLE IF NOT EXISTS prosthesis (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  professional_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  laboratory TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_date DATE,
  expected_return_date DATE,
  return_date DATE,
  observations TEXT,
  labels JSONB DEFAULT '[]',
  cost INTEGER DEFAULT 0,
  price INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Laboratories
CREATE TABLE IF NOT EXISTS laboratories (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  cnpj VARCHAR(20),
  specialties JSONB DEFAULT '[]',
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Prosthesis Labels
CREATE TABLE IF NOT EXISTS prosthesis_labels (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Prosthesis Services
CREATE TABLE IF NOT EXISTS prosthesis_services (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  professional_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  laboratory TEXT,
  status TEXT NOT NULL DEFAULT 'ordered',
  sent_date DATE,
  expected_return_date DATE,
  returned_date DATE,
  cost DECIMAL(10, 2),
  price DECIMAL(10, 2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Prosthesis Stages
CREATE TABLE IF NOT EXISTS prosthesis_stages (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES prosthesis_services(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  "order" INTEGER NOT NULL,
  completed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Financial Transactions
CREATE TABLE IF NOT EXISTS financial_transactions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount INTEGER NOT NULL,
  patient_id INTEGER REFERENCES patients(id),
  appointment_id INTEGER REFERENCES appointments(id),
  professional_id INTEGER REFERENCES users(id),
  date TIMESTAMP NOT NULL,
  due_date TIMESTAMP,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  installments INTEGER DEFAULT 1,
  installments_paid INTEGER DEFAULT 0,
  fee_amount INTEGER DEFAULT 0,
  net_amount INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Boxes (cash registers)
CREATE TABLE IF NOT EXISTS boxes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  opening_balance DECIMAL(10, 2) DEFAULT 0,
  current_balance DECIMAL(10, 2) DEFAULT 0,
  status TEXT DEFAULT 'open',
  responsible_id INTEGER REFERENCES users(id),
  last_opened_at TIMESTAMP DEFAULT NOW(),
  last_closed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Box Transactions
CREATE TABLE IF NOT EXISTS box_transactions (
  id SERIAL PRIMARY KEY,
  box_id INTEGER NOT NULL REFERENCES boxes(id),
  type TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  payment_method TEXT,
  reference_id INTEGER,
  reference_type TEXT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Machine Taxes (payment machine fees)
CREATE TABLE IF NOT EXISTS machine_taxes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT,
  credit_tax DECIMAL(5, 2) DEFAULT 0,
  debit_tax DECIMAL(5, 2) DEFAULT 0,
  credit_installment_taxes JSONB,
  pix_tax DECIMAL(5, 2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Legacy: MercadoPago Subscriptions (deprecated)
CREATE TABLE IF NOT EXISTS mercado_pago_subscriptions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  next_billing_date TIMESTAMP,
  mercado_pago_id TEXT,
  payment_method TEXT NOT NULL DEFAULT 'mercadopago',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Legacy: Payments
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  subscription_id INTEGER,
  appointment_id INTEGER REFERENCES appointments(id),
  patient_id INTEGER REFERENCES patients(id),
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL,
  payment_date TIMESTAMP NOT NULL,
  payment_method TEXT NOT NULL,
  mercado_pago_id TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User Permissions (many-to-many)
CREATE TABLE IF NOT EXISTS user_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  permission_id INTEGER NOT NULL REFERENCES permissions(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Role Permissions (many-to-many)
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  permission_id INTEGER NOT NULL REFERENCES permissions(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Commission Settings
CREATE TABLE IF NOT EXISTS commission_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  value DECIMAL(10, 2) NOT NULL,
  apply_to_all BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Procedure Commissions
CREATE TABLE IF NOT EXISTS procedure_commissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  procedure_id INTEGER NOT NULL REFERENCES procedures(id),
  type TEXT NOT NULL,
  value DECIMAL(10, 2) NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Commission Records
CREATE TABLE IF NOT EXISTS commission_records (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  appointment_id INTEGER REFERENCES appointments(id),
  procedure_id INTEGER REFERENCES procedures(id),
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL,
  payment_date TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sales Goals
CREATE TABLE IF NOT EXISTS sales_goals (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  user_id INTEGER REFERENCES users(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  target_value DECIMAL(10, 2) NOT NULL,
  target_type TEXT NOT NULL,
  current_value DECIMAL(10, 2) DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to INTEGER REFERENCES users(id),
  patient_id INTEGER REFERENCES patients(id),
  due_date TIMESTAMP,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  completed_at TIMESTAMP,
  completed_by INTEGER REFERENCES users(id),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Shop Items (online store)
CREATE TABLE IF NOT EXISTS shop_items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  sale_price DECIMAL(10, 2),
  inventory_item_id INTEGER REFERENCES inventory_items(id),
  category_id INTEGER REFERENCES inventory_categories(id),
  images JSONB,
  featured BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Booking Link Settings (external scheduling)
CREATE TABLE IF NOT EXISTS booking_link_settings (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  professional_id INTEGER REFERENCES users(id),
  services JSONB,
  time_slot_duration INTEGER DEFAULT 30,
  buffer_time INTEGER DEFAULT 0,
  max_days_in_advance INTEGER DEFAULT 30,
  min_hours_before_booking INTEGER DEFAULT 2,
  disabled_days JSONB,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- BILLING & SUBSCRIPTIONS (SaaS)
-- ============================================

-- Plan Features
CREATE TABLE IF NOT EXISTS plan_features (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES plans(id),
  feature_key TEXT NOT NULL,
  feature_name TEXT NOT NULL,
  feature_description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  "limit" INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id),
  plan_id INTEGER NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'trial',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  current_period_start TIMESTAMP NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMP NOT NULL,
  trial_ends_at TIMESTAMP,
  canceled_at TIMESTAMP,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  mercado_pago_subscription_id TEXT UNIQUE,
  mercado_pago_customer_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Subscription Invoices
CREATE TABLE IF NOT EXISTS subscription_invoices (
  id SERIAL PRIMARY KEY,
  subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),
  company_id INTEGER NOT NULL REFERENCES companies(id),
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  due_date TIMESTAMP NOT NULL,
  paid_at TIMESTAMP,
  stripe_invoice_id TEXT UNIQUE,
  mercado_pago_invoice_id TEXT UNIQUE,
  payment_method TEXT,
  invoice_url TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Usage Metrics (for plan limit enforcement)
CREATE TABLE IF NOT EXISTS usage_metrics (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  metric_type TEXT NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMP NOT NULL DEFAULT NOW(),
  period_end TIMESTAMP NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Subscription History
CREATE TABLE IF NOT EXISTS subscription_history (
  id SERIAL PRIMARY KEY,
  subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),
  company_id INTEGER NOT NULL REFERENCES companies(id),
  from_plan_id INTEGER REFERENCES plans(id),
  to_plan_id INTEGER NOT NULL REFERENCES plans(id),
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- DIGITALIZATION (OCR + AI)
-- ============================================

-- Digitalization Usage
CREATE TABLE IF NOT EXISTS digitalization_usage (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMP,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  current_cycle_start TIMESTAMP NOT NULL DEFAULT NOW(),
  current_cycle_end TIMESTAMP NOT NULL,
  current_cycle_count INTEGER NOT NULL DEFAULT 0,
  paid_units INTEGER NOT NULL DEFAULT 0,
  remaining_units INTEGER NOT NULL DEFAULT 0,
  price_per_thousand INTEGER NOT NULL DEFAULT 3000,
  total_spent INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Digitalization Logs
CREATE TABLE IF NOT EXISTS digitalization_logs (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  user_id INTEGER REFERENCES users(id),
  image_count INTEGER NOT NULL DEFAULT 1,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  ocr_confidence DECIMAL(5, 2),
  ai_model TEXT NOT NULL DEFAULT 'deepseek-chat',
  processing_time INTEGER,
  cost INTEGER NOT NULL DEFAULT 0,
  import_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Digitalization Invoices
CREATE TABLE IF NOT EXISTS digitalization_invoices (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  units_used INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMP,
  payment_method TEXT,
  invoice_url TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Companies
CREATE INDEX IF NOT EXISTS idx_companies_active ON companies(active);

-- Users
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);

-- Patients
CREATE INDEX IF NOT EXISTS idx_patients_company_id ON patients(company_id);
CREATE INDEX IF NOT EXISTS idx_patients_full_name ON patients(full_name);
CREATE INDEX IF NOT EXISTS idx_patients_cpf ON patients(cpf);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_patient_number ON patients(patient_number);
CREATE INDEX IF NOT EXISTS idx_patients_active ON patients(active);

-- Appointments
CREATE INDEX IF NOT EXISTS idx_appointments_company_id ON appointments(company_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_professional_id ON appointments(professional_id);
CREATE INDEX IF NOT EXISTS idx_appointments_room_id ON appointments(room_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_type ON appointments(type);

-- Procedures
CREATE INDEX IF NOT EXISTS idx_procedures_company_id ON procedures(company_id);
CREATE INDEX IF NOT EXISTS idx_procedures_active ON procedures(active);

-- Financial Transactions
CREATE INDEX IF NOT EXISTS idx_financial_transactions_company_id ON financial_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_patient_id ON financial_transactions(patient_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_date ON financial_transactions(date);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_status ON financial_transactions(status);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_type ON financial_transactions(type);

-- Inventory Items
CREATE INDEX IF NOT EXISTS idx_inventory_items_company_id ON inventory_items(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category_id ON inventory_items(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON inventory_items(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_items_barcode ON inventory_items(barcode);

-- Prescriptions
CREATE INDEX IF NOT EXISTS idx_prescriptions_company_id ON prescriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_prescribed_by ON prescriptions(prescribed_by);

-- Digital Signatures
CREATE INDEX IF NOT EXISTS idx_digital_signatures_company_id ON digital_signatures(company_id);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_professional_id ON digital_signatures(professional_id);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_document_type ON digital_signatures(document_type);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_status ON digital_signatures(status);

-- Automation Logs
CREATE INDEX IF NOT EXISTS idx_automation_logs_company_id ON automation_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_automation_id ON automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_appointment_id ON automation_logs(appointment_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created_at ON automation_logs(created_at);

-- Subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_company_id ON subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE companies IS 'Organizations/clinics using the system';
COMMENT ON TABLE modules IS 'Available system modules (clinic, inventory, financial, etc)';
COMMENT ON TABLE users IS 'System users (dentists, staff, admins)';
COMMENT ON TABLE patients IS 'Patient records with complete personal and health information';
COMMENT ON TABLE appointments IS 'Patient appointments with automation and confirmation tracking';
COMMENT ON TABLE procedures IS 'Dental procedures/services offered by the clinic';
COMMENT ON TABLE prescriptions IS 'Digital prescriptions, attestations, and certificates';
COMMENT ON TABLE digital_signatures IS 'CFO-compliant digital signatures for documents';
COMMENT ON TABLE periodontal_chart IS 'Periodontal examination data (periodontogram)';
COMMENT ON TABLE automations IS 'N8N automation workflows for WhatsApp, email, SMS';
COMMENT ON TABLE plans IS 'SaaS subscription plans with feature limits';
COMMENT ON TABLE subscriptions IS 'Company subscriptions to SaaS plans';
COMMENT ON TABLE digitalization_usage IS 'OCR + AI digitalization usage tracking and billing';

-- ============================================
-- INITIAL SCHEMA COMPLETE
-- ============================================
