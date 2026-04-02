-- Migration: AI Usage Tracking
-- Adds table for monitoring AI usage per tenant for billing, observability, and abuse detection.

BEGIN;

-- Table for per-request AI usage logging
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  session_id INTEGER REFERENCES chat_sessions(id) ON DELETE SET NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  model VARCHAR(100),
  tools_used TEXT[],
  latency_ms INTEGER,
  estimated_cost_cents INTEGER DEFAULT 0,
  is_injection_attempt BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for per-tenant monthly usage queries and billing
CREATE INDEX IF NOT EXISTS idx_ai_usage_company_date ON ai_usage_logs(company_id, created_at);

-- Index for anomaly detection (injection attempts)
CREATE INDEX IF NOT EXISTS idx_ai_usage_injection ON ai_usage_logs(is_injection_attempt) WHERE is_injection_attempt = TRUE;

-- Index for model-specific cost analysis
CREATE INDEX IF NOT EXISTS idx_ai_usage_model ON ai_usage_logs(model, created_at);

COMMIT;
