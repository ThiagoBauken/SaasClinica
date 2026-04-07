-- Migration 022: Waitlist (Lista de Espera)
-- Tracks patients waiting for an appointment slot to open up.

CREATE TABLE IF NOT EXISTS waitlist (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  professional_id INTEGER REFERENCES users(id),
  procedure_id INTEGER REFERENCES procedures(id),
  preferred_date DATE,
  preferred_time_start VARCHAR(5),   -- HH:MM
  preferred_time_end   VARCHAR(5),   -- HH:MM
  preferred_days_of_week INTEGER[],  -- 0=Sun, 1=Mon ... 6=Sat
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting', -- waiting, notified, scheduled, cancelled, expired
  notified_at TIMESTAMP WITH TIME ZONE,
  scheduled_appointment_id INTEGER REFERENCES appointments(id),
  priority INTEGER NOT NULL DEFAULT 0, -- higher value = higher priority
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_company    ON waitlist(company_id, status);
CREATE INDEX IF NOT EXISTS idx_waitlist_professional ON waitlist(company_id, professional_id, status);
