-- Migration 015: Insurance/Convenios Management with TISS support
-- Gestao completa de convenios odontologicos

BEGIN;

-- ============================================================
-- INSURANCE PLANS (Convenios)
-- ============================================================
CREATE TABLE IF NOT EXISTS insurance_plans (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL, -- Amil Dental, Bradesco Dental, etc.
  ans_code TEXT, -- Codigo ANS da operadora
  plan_type TEXT DEFAULT 'dental', -- dental, medical, both
  contact_phone TEXT,
  contact_email TEXT,
  billing_address TEXT,
  website TEXT,
  tiss_version TEXT DEFAULT '3.05.00', -- Versao TISS
  tiss_login TEXT, -- Login portal TISS
  tiss_password TEXT, -- Senha portal TISS
  default_discount_percent DECIMAL(5,2) DEFAULT 0,
  payment_deadline_days INTEGER DEFAULT 30,
  active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- INSURANCE PROCEDURES (Tabela TUSS por convenio)
-- ============================================================
CREATE TABLE IF NOT EXISTS insurance_procedures (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  insurance_plan_id INTEGER NOT NULL REFERENCES insurance_plans(id),
  tuss_code TEXT NOT NULL, -- Codigo TUSS (ex: 81000065)
  description TEXT NOT NULL, -- Descricao do procedimento
  covered_value INTEGER DEFAULT 0, -- Valor coberto pelo convenio (centavos)
  patient_copay INTEGER DEFAULT 0, -- Coparticipacao do paciente (centavos)
  requires_authorization BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- PATIENT INSURANCE (Vinculo paciente-convenio)
-- ============================================================
CREATE TABLE IF NOT EXISTS patient_insurance (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  insurance_plan_id INTEGER NOT NULL REFERENCES insurance_plans(id),
  card_number TEXT NOT NULL, -- Numero da carteirinha
  holder_name TEXT, -- Nome do titular (se diferente)
  holder_cpf TEXT, -- CPF do titular
  plan_name TEXT, -- Nome do plano especifico
  valid_from DATE,
  valid_until DATE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- INSURANCE CLAIMS (Guias TISS)
-- ============================================================
CREATE TABLE IF NOT EXISTS insurance_claims (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  insurance_plan_id INTEGER NOT NULL REFERENCES insurance_plans(id),
  patient_insurance_id INTEGER REFERENCES patient_insurance(id),
  professional_id INTEGER REFERENCES users(id),
  claim_type TEXT NOT NULL DEFAULT 'consultation', -- consultation, sp_sadt, summary
  guide_number TEXT, -- Numero da guia
  authorization_number TEXT,
  tuss_code TEXT,
  procedure_description TEXT,
  tooth_number TEXT, -- Dente (FDI)
  tooth_face TEXT, -- Face do dente
  quantity INTEGER DEFAULT 1,
  claimed_value INTEGER DEFAULT 0, -- Valor cobrado (centavos)
  approved_value INTEGER, -- Valor aprovado (centavos)
  glosa_value INTEGER DEFAULT 0, -- Valor glosado (centavos)
  glosa_reason TEXT,
  service_date DATE,
  status TEXT DEFAULT 'pending', -- pending, sent, authorized, denied, paid, appealed
  batch_id TEXT, -- Lote de faturamento
  xml_content TEXT, -- XML TISS gerado
  response_xml TEXT, -- XML resposta do convenio
  notes TEXT,
  sent_at TIMESTAMP,
  response_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- INSURANCE AUTHORIZATIONS (Autorizacoes previas)
-- ============================================================
CREATE TABLE IF NOT EXISTS insurance_authorizations (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  insurance_plan_id INTEGER NOT NULL REFERENCES insurance_plans(id),
  tuss_code TEXT NOT NULL,
  procedure_description TEXT,
  authorization_number TEXT,
  requested_at TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'pending', -- pending, authorized, denied, expired
  authorized_at TIMESTAMP,
  valid_until DATE,
  denied_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_insurance_plans_company ON insurance_plans(company_id);
CREATE INDEX IF NOT EXISTS idx_insurance_procedures_plan ON insurance_procedures(insurance_plan_id);
CREATE INDEX IF NOT EXISTS idx_patient_insurance_patient ON patient_insurance(patient_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_company ON insurance_claims(company_id, status);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_patient ON insurance_claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_batch ON insurance_claims(batch_id);
CREATE INDEX IF NOT EXISTS idx_insurance_auth_company ON insurance_authorizations(company_id, status);

COMMIT;
