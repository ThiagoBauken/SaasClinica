-- Migration 014: Recall, Waitlist, Reviews, NPS, Contracts, Campaigns, Teleconsult, Office Chat
-- Covers Blocks 4-11 of the competitive gap implementation

BEGIN;

-- ============================================================
-- RECALL SYSTEM (Block 4.1)
-- ============================================================
CREATE TABLE IF NOT EXISTS recall_rules (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  treatment_type TEXT NOT NULL, -- limpeza, ortodontia, implante, geral
  interval_days INTEGER NOT NULL DEFAULT 180, -- 6 meses
  message_template TEXT,
  send_via TEXT DEFAULT 'whatsapp', -- whatsapp, email, both
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recall_queue (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  rule_id INTEGER REFERENCES recall_rules(id),
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, sent, scheduled, dismissed
  sent_at TIMESTAMP,
  response TEXT, -- agendou, ignorou, recusou
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- WAITLIST / LISTA DE ESPERA (Block 4.2)
-- ============================================================
CREATE TABLE IF NOT EXISTS waitlist (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  professional_id INTEGER REFERENCES users(id),
  preferred_date DATE,
  preferred_period TEXT, -- morning, afternoon, evening, any
  procedure_id INTEGER REFERENCES procedures(id),
  notes TEXT,
  status TEXT DEFAULT 'waiting', -- waiting, notified, scheduled, expired
  notified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- REVIEWS & NPS (Block 5)
-- ============================================================
CREATE TABLE IF NOT EXISTS review_requests (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  appointment_id INTEGER REFERENCES appointments(id),
  sent_at TIMESTAMP DEFAULT NOW(),
  sent_via TEXT DEFAULT 'whatsapp',
  clicked BOOLEAN DEFAULT FALSE,
  clicked_at TIMESTAMP,
  review_url TEXT,
  status TEXT DEFAULT 'sent' -- sent, clicked, reviewed
);

CREATE TABLE IF NOT EXISTS nps_surveys (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  score INTEGER CHECK (score >= 0 AND score <= 10),
  feedback TEXT,
  category TEXT, -- promoter (9-10), passive (7-8), detractor (0-6)
  sent_at TIMESTAMP DEFAULT NOW(),
  responded_at TIMESTAMP,
  sent_via TEXT DEFAULT 'whatsapp'
);

-- ============================================================
-- CONTRACTS (Block 6)
-- ============================================================
CREATE TABLE IF NOT EXISTS contract_templates (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL, -- Contrato Ortodontia, Contrato Implante, etc.
  content TEXT NOT NULL, -- Template com {{variaveis}}
  category TEXT DEFAULT 'treatment', -- treatment, orthodontics, implant, general
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_contracts (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  template_id INTEGER REFERENCES contract_templates(id),
  treatment_plan_id INTEGER REFERENCES treatment_plans(id),
  content TEXT NOT NULL, -- Conteudo gerado (variaveis substituidas)
  pdf_url TEXT,
  status TEXT DEFAULT 'draft', -- draft, sent, signed, cancelled
  signed_at TIMESTAMP,
  signature_id INTEGER REFERENCES digital_signatures(id),
  sent_via TEXT, -- whatsapp, email
  sent_at TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- CAMPAIGNS (Block 7)
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- whatsapp, email, both
  message_template TEXT NOT NULL,
  subject TEXT, -- email subject
  segment_filter JSONB DEFAULT '{}', -- filtros de segmentacao
  scheduled_at TIMESTAMP,
  sent_at TIMESTAMP,
  status TEXT DEFAULT 'draft', -- draft, scheduled, sending, completed, cancelled
  stats JSONB DEFAULT '{"total":0,"sent":0,"delivered":0,"read":0,"failed":0}',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  status TEXT DEFAULT 'pending', -- pending, sent, delivered, read, failed
  sent_at TIMESTAMP,
  error TEXT
);

-- ============================================================
-- TELECONSULTATION (Block 10)
-- ============================================================
CREATE TABLE IF NOT EXISTS teleconsultations (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  professional_id INTEGER NOT NULL REFERENCES users(id),
  room_name TEXT NOT NULL UNIQUE,
  room_url TEXT NOT NULL,
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_minutes INTEGER,
  notes TEXT,
  status TEXT DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- OFFICE CHAT (Block 11)
-- ============================================================
CREATE TABLE IF NOT EXISTS office_channels (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL, -- #geral, #recepcao, #dentistas
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS office_messages (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  channel_id INTEGER REFERENCES office_channels(id), -- null = DM
  sender_id INTEGER NOT NULL REFERENCES users(id),
  recipient_id INTEGER REFERENCES users(id), -- for DMs
  content TEXT NOT NULL,
  read_by JSONB DEFAULT '[]', -- array of user IDs
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- PROCEDURE-MATERIALS LINK (Block 9)
-- ============================================================
CREATE TABLE IF NOT EXISTS procedure_materials (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  procedure_id INTEGER NOT NULL REFERENCES procedures(id),
  item_id INTEGER NOT NULL REFERENCES inventory_items(id),
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add expiration_date to inventory_items
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS expiration_date DATE;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_recall_queue_company ON recall_queue(company_id, status);
CREATE INDEX IF NOT EXISTS idx_recall_queue_due ON recall_queue(due_date, status);
CREATE INDEX IF NOT EXISTS idx_waitlist_company ON waitlist(company_id, status);
CREATE INDEX IF NOT EXISTS idx_review_requests_company ON review_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_nps_company ON nps_surveys(company_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_company ON campaigns(company_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_office_messages_channel ON office_messages(channel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_office_messages_dm ON office_messages(sender_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_teleconsult_company ON teleconsultations(company_id);
CREATE INDEX IF NOT EXISTS idx_procedure_materials ON procedure_materials(procedure_id);

-- Seed default office channels for existing companies
INSERT INTO office_channels (company_id, name, description)
SELECT id, '#geral', 'Canal geral da clinica' FROM companies
ON CONFLICT DO NOTHING;

COMMIT;
