-- CRM WhatsApp Integration: Create proper CRM tables + AI stage tracking
-- Ensures all tables expected by the Drizzle schema exist

-- =====================================================
-- 1. Create sales_opportunities table (matches Drizzle schema)
-- =====================================================
CREATE TABLE IF NOT EXISTS sales_opportunities (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER REFERENCES patients(id),
  stage_id INTEGER NOT NULL REFERENCES sales_funnel_stages(id),
  -- WhatsApp / AI link
  chat_session_id INTEGER REFERENCES chat_sessions(id),
  ai_stage TEXT,
  ai_stage_updated_at TIMESTAMP,
  -- Lead data
  lead_name TEXT,
  lead_phone TEXT,
  lead_email TEXT,
  lead_source TEXT,
  -- Opportunity data
  title TEXT NOT NULL,
  description TEXT,
  treatment_type TEXT,
  estimated_value DECIMAL(10,2),
  probability INTEGER DEFAULT 50,
  expected_close_date DATE,
  -- Assignment
  assigned_to INTEGER REFERENCES users(id),
  -- Movement dates
  stage_entered_at TIMESTAMP DEFAULT NOW(),
  last_contact_at TIMESTAMP,
  next_follow_up_at TIMESTAMP,
  -- Result
  won_at TIMESTAMP,
  lost_at TIMESTAMP,
  lost_reason TEXT,
  -- Metadata
  notes TEXT,
  tags JSONB DEFAULT '[]',
  custom_fields JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 2. Create sales_opportunity_history table
-- =====================================================
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

-- =====================================================
-- 3. Create sales_tasks table
-- =====================================================
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

-- =====================================================
-- 4. Add automation_trigger column to sales_funnel_stages
-- =====================================================
ALTER TABLE sales_funnel_stages
  ADD COLUMN IF NOT EXISTS automation_trigger TEXT;

-- =====================================================
-- 5. Indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_company
  ON sales_opportunities(company_id);

CREATE INDEX IF NOT EXISTS idx_sales_opportunities_stage
  ON sales_opportunities(stage_id);

CREATE INDEX IF NOT EXISTS idx_sales_opportunities_chat_session
  ON sales_opportunities(chat_session_id) WHERE chat_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_opportunities_ai_stage
  ON sales_opportunities(company_id, ai_stage) WHERE ai_stage IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_opportunity_history_opp
  ON sales_opportunity_history(opportunity_id);

CREATE INDEX IF NOT EXISTS idx_sales_tasks_company
  ON sales_tasks(company_id);

CREATE INDEX IF NOT EXISTS idx_sales_tasks_opportunity
  ON sales_tasks(opportunity_id);

-- =====================================================
-- 6. Seed default WhatsApp pipeline stages
-- =====================================================
DO $$
DECLARE
  comp RECORD;
BEGIN
  FOR comp IN SELECT id FROM companies LOOP
    -- Only seed if company has no stages with automation triggers yet
    IF NOT EXISTS (SELECT 1 FROM sales_funnel_stages WHERE company_id = comp.id AND automation_trigger IS NOT NULL) THEN
      -- Update existing stages with automation triggers if they match by code
      UPDATE sales_funnel_stages SET automation_trigger = 'first_contact' WHERE company_id = comp.id AND code = 'first_contact' AND automation_trigger IS NULL;
      UPDATE sales_funnel_stages SET automation_trigger = 'scheduling' WHERE company_id = comp.id AND code = 'scheduling' AND automation_trigger IS NULL;
      UPDATE sales_funnel_stages SET automation_trigger = 'confirmation' WHERE company_id = comp.id AND code = 'confirmation' AND automation_trigger IS NULL;
      UPDATE sales_funnel_stages SET automation_trigger = 'consultation_done' WHERE company_id = comp.id AND code = 'consultation_done' AND automation_trigger IS NULL;
      UPDATE sales_funnel_stages SET automation_trigger = 'payment_done' WHERE company_id = comp.id AND code = 'payment' AND automation_trigger IS NULL;

      -- If no stages exist at all, create the default pipeline
      IF NOT EXISTS (SELECT 1 FROM sales_funnel_stages WHERE company_id = comp.id) THEN
        INSERT INTO sales_funnel_stages (company_id, name, code, color, "order", is_default, is_won, is_lost, automation_trigger)
        VALUES
          (comp.id, 'Primeiro Contato',     'first_contact',     '#6366F1', 1, true,  false, false, 'first_contact'),
          (comp.id, 'Agendamento',          'scheduling',        '#3B82F6', 2, false, false, false, 'scheduling'),
          (comp.id, 'Confirmado',           'confirmation',      '#F59E0B', 3, false, false, false, 'confirmation'),
          (comp.id, 'Consulta Realizada',   'consultation_done', '#10B981', 4, false, false, false, 'consultation_done'),
          (comp.id, 'Pagamento',            'payment',           '#8B5CF6', 5, false, false, false, 'payment_done'),
          (comp.id, 'Concluido',            'won',               '#22C55E', 6, false, true,  false, NULL),
          (comp.id, 'Perdido',              'lost',              '#EF4444', 7, false, false, true,  NULL);
      END IF;
    END IF;
  END LOOP;
END $$;
