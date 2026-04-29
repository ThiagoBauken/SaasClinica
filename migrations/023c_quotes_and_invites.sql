-- Migration 023: Quotes (Orcamentos) and Team Invites
-- Created: 2026-04-04

-- =============================================
-- QUOTES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS quotes (
  id                  SERIAL PRIMARY KEY,
  company_id          INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  treatment_plan_id   INTEGER REFERENCES treatment_plans(id) ON DELETE SET NULL,
  patient_id          INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  professional_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  items               JSONB NOT NULL,
  subtotal            INTEGER NOT NULL,
  discount_percent    DECIMAL(5,2) DEFAULT 0,
  discount_amount     INTEGER DEFAULT 0,
  total_amount        INTEGER NOT NULL,
  installments        INTEGER DEFAULT 1,
  installment_value   INTEGER,
  interest_rate       DECIMAL(5,2) DEFAULT 0,
  total_with_interest INTEGER,
  token               TEXT NOT NULL UNIQUE,
  status              TEXT NOT NULL DEFAULT 'pending',
  valid_until         TIMESTAMPTZ,
  approved_at         TIMESTAMPTZ,
  approval_ip_address TEXT,
  approval_method     TEXT,
  rejection_reason    TEXT,
  pdf_url             TEXT,
  sent_via            TEXT,
  sent_at             TIMESTAMPTZ,
  notes               TEXT,
  created_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotes_company ON quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_patient ON quotes(patient_id);
CREATE INDEX IF NOT EXISTS idx_quotes_token ON quotes(token);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);

-- =============================================
-- TEAM INVITES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS team_invites (
  id           SERIAL PRIMARY KEY,
  company_id   INTEGER NOT NULL REFERENCES companies(id),
  email        TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'staff',
  token        TEXT NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ NOT NULL,
  accepted_at  TIMESTAMPTZ,
  invited_by   INTEGER REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_invites_company ON team_invites(company_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_token ON team_invites(token);
