-- Migration 023: Executive reports table for monthly AI-generated KPI summaries
-- Stores one row per (company, month). Upserted by the monthly cron job.

CREATE TABLE IF NOT EXISTS executive_reports (
  id            SERIAL PRIMARY KEY,
  company_id    INTEGER NOT NULL REFERENCES companies(id),
  month         VARCHAR(7) NOT NULL,          -- YYYY-MM
  kpis          JSONB NOT NULL DEFAULT '{}',
  ai_summary    TEXT,
  generated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  emailed_at    TIMESTAMP WITH TIME ZONE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE (company_id, month)
);

CREATE INDEX IF NOT EXISTS idx_executive_reports_company
  ON executive_reports (company_id, month);
