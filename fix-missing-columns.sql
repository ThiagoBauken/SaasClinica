-- Script para corrigir colunas e tabelas faltantes no banco de dados
-- Execute este script diretamente no PostgreSQL

-- 1. Adicionar coluna metadata na tabela notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 2. Adicionar coluna user_type na tabela chat_sessions
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) NOT NULL DEFAULT 'unknown';

-- 3. Adicionar coluna is_recurring na tabela procedures
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS default_recurrence_interval_days INTEGER;
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS requires_follow_up BOOLEAN DEFAULT false;
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS follow_up_interval_days INTEGER;

-- 4. Adicionar coluna total_appointments na tabela patients
ALTER TABLE patients ADD COLUMN IF NOT EXISTS total_appointments INTEGER DEFAULT 0;

-- 5. Criar tabela sales_funnel_stages se não existir
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
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Criar tabela crm_opportunities se não existir
CREATE TABLE IF NOT EXISTS crm_opportunities (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER REFERENCES patients(id),
  stage_id INTEGER REFERENCES sales_funnel_stages(id),
  title TEXT NOT NULL,
  description TEXT,
  value INTEGER DEFAULT 0,
  probability INTEGER DEFAULT 50,
  expected_close_date DATE,
  assigned_to INTEGER REFERENCES users(id),
  source TEXT,
  tags JSONB DEFAULT '[]',
  notes TEXT,
  status TEXT DEFAULT 'open',
  won_at TIMESTAMP,
  lost_at TIMESTAMP,
  lost_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 7. Criar tabela crm_tasks se não existir
CREATE TABLE IF NOT EXISTS crm_tasks (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  opportunity_id INTEGER REFERENCES crm_opportunities(id),
  patient_id INTEGER REFERENCES patients(id),
  assigned_to INTEGER REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP,
  completed_at TIMESTAMP,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'normal',
  type TEXT DEFAULT 'task',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 8. Inserir etapas padrão do funil para empresas existentes
INSERT INTO sales_funnel_stages (company_id, name, code, color, "order", is_default, is_won, is_lost, is_active)
SELECT c.id, 'Lead Novo', 'new_lead', '#3B82F6', 0, true, false, false, true
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM sales_funnel_stages s WHERE s.company_id = c.id AND s.code = 'new_lead'
);

INSERT INTO sales_funnel_stages (company_id, name, code, color, "order", is_default, is_won, is_lost, is_active)
SELECT c.id, 'Primeiro Contato', 'first_contact', '#8B5CF6', 1, false, false, false, true
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM sales_funnel_stages s WHERE s.company_id = c.id AND s.code = 'first_contact'
);

INSERT INTO sales_funnel_stages (company_id, name, code, color, "order", is_default, is_won, is_lost, is_active)
SELECT c.id, 'Orçamento Enviado', 'quote_sent', '#F59E0B', 2, false, false, false, true
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM sales_funnel_stages s WHERE s.company_id = c.id AND s.code = 'quote_sent'
);

INSERT INTO sales_funnel_stages (company_id, name, code, color, "order", is_default, is_won, is_lost, is_active)
SELECT c.id, 'Negociação', 'negotiation', '#EC4899', 3, false, false, false, true
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM sales_funnel_stages s WHERE s.company_id = c.id AND s.code = 'negotiation'
);

INSERT INTO sales_funnel_stages (company_id, name, code, color, "order", is_default, is_won, is_lost, is_active)
SELECT c.id, 'Fechado Ganho', 'won', '#10B981', 4, false, true, false, true
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM sales_funnel_stages s WHERE s.company_id = c.id AND s.code = 'won'
);

INSERT INTO sales_funnel_stages (company_id, name, code, color, "order", is_default, is_won, is_lost, is_active)
SELECT c.id, 'Fechado Perdido', 'lost', '#EF4444', 5, false, false, true, true
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM sales_funnel_stages s WHERE s.company_id = c.id AND s.code = 'lost'
);

-- Pronto!
SELECT 'Migração concluída com sucesso!' as status;
