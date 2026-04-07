-- ============================================================
-- Migration 030: Humanization, prompt audit, FAQ cache, token-based limits
-- ============================================================
-- Adds infrastructure for the AI agent improvements:
--   1. Per-clinic configurable human takeover timeout
--   2. system_prompt_snapshots — versioned audit trail of every prompt
--      ever sent to the LLM (regulatory requirement for healthcare)
--   3. ai_faq_cache — cached responses for high-frequency FAQ queries
--      (cost reduction)
--   4. token-based limits in plans (instead of per-message), via
--      ai_token_limit_input / ai_token_limit_output columns on plans
--   5. ai_usage_logs gains prompt_snapshot_id FK so each call is
--      traceable to the exact prompt that was active.
--
-- All operations are idempotent — safe to re-run.
-- The runner wraps each file in BEGIN/COMMIT, so no transaction here.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. clinic_settings: configurable human takeover timeout
-- ─────────────────────────────────────────────────────────────
ALTER TABLE clinic_settings
  ADD COLUMN IF NOT EXISTS human_takeover_timeout_minutes INTEGER NOT NULL DEFAULT 120;

ALTER TABLE clinic_settings
  ADD COLUMN IF NOT EXISTS quiet_hours_start INTEGER;  -- e.g., 22 (10pm). NULL = no quiet hours.

ALTER TABLE clinic_settings
  ADD COLUMN IF NOT EXISTS quiet_hours_end INTEGER;    -- e.g., 7  (7am).  NULL = no quiet hours.

COMMENT ON COLUMN clinic_settings.human_takeover_timeout_minutes IS
  'Minutes the AI stays silent after a human attendant sends a message. Resets on every new human message.';

-- ─────────────────────────────────────────────────────────────
-- 2. system_prompt_snapshots — audit trail of every prompt version
-- ─────────────────────────────────────────────────────────────
-- Each unique (company_id, prompt_hash) pair is stored exactly once.
-- prompt_hash = SHA256(prompt_text) truncated to 32 hex chars.
-- This lets us answer the auditor question: "What prompt was the AI
-- using for clinic X on date Y?"
CREATE TABLE IF NOT EXISTS system_prompt_snapshots (
  id              BIGSERIAL PRIMARY KEY,
  company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  prompt_hash     VARCHAR(64) NOT NULL,
  prompt_text     TEXT NOT NULL,
  prompt_length   INTEGER NOT NULL,
  clinic_settings_snapshot JSONB,  -- relevant fields snapshot at creation time
  first_used_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  use_count       BIGINT NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_snapshots_company_hash
  ON system_prompt_snapshots (company_id, prompt_hash);

CREATE INDEX IF NOT EXISTS idx_prompt_snapshots_company_created
  ON system_prompt_snapshots (company_id, first_used_at DESC);

COMMENT ON TABLE system_prompt_snapshots IS
  'Versioned audit trail of every distinct system prompt sent to the LLM. Required for healthcare compliance (proving what guidance the AI received on date X).';

-- Add FK column to ai_usage_logs so each AI call is traceable to a prompt version
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_usage_logs' AND column_name = 'prompt_snapshot_id'
  ) THEN
    ALTER TABLE ai_usage_logs
      ADD COLUMN prompt_snapshot_id BIGINT REFERENCES system_prompt_snapshots(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_snapshot
      ON ai_usage_logs (prompt_snapshot_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 3. ai_faq_cache — high-hit response cache for cost reduction
-- ─────────────────────────────────────────────────────────────
-- Stores hand-curated and auto-learned FAQ responses keyed by
-- normalized query hash. Lookup happens BEFORE Claude is called.
--
-- Population strategies:
--   - Manual: clinic admin adds entries via UI
--   - Automatic: messages with very common normalized form get
--     auto-cached after their AI response is filtered as safe
--     (curation responsibility stays with the admin)
CREATE TABLE IF NOT EXISTS ai_faq_cache (
  id              BIGSERIAL PRIMARY KEY,
  company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- SHA256 of normalized query (lowercase, single-space, no punctuation)
  query_hash      VARCHAR(64) NOT NULL,
  -- Original query text (for auditing / admin curation UI)
  query_sample    TEXT NOT NULL,
  -- The response text. Stored verbatim — admin is responsible for content.
  response_text   TEXT NOT NULL,
  -- Source: 'manual' (admin curated) | 'auto' (learned from AI) | 'system' (default)
  source          VARCHAR(20) NOT NULL DEFAULT 'manual',
  -- Whether this entry is active (admin can disable without deleting)
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  hit_count       BIGINT NOT NULL DEFAULT 0,
  last_hit_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_faq_cache_company_hash
  ON ai_faq_cache (company_id, query_hash);

CREATE INDEX IF NOT EXISTS idx_faq_cache_enabled
  ON ai_faq_cache (company_id, enabled) WHERE enabled = TRUE;

COMMENT ON TABLE ai_faq_cache IS
  'Cached AI responses for high-frequency FAQ queries. Lookup happens before LLM call to reduce cost and latency.';

-- ─────────────────────────────────────────────────────────────
-- 4. plans: token-based limits (replaces per-message limits)
-- ─────────────────────────────────────────────────────────────
-- Per-message limits punish enterprise clients with long conversations.
-- Token-based limits accurately track cost.
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS ai_input_tokens_monthly  BIGINT;

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS ai_output_tokens_monthly BIGINT;

COMMENT ON COLUMN plans.ai_input_tokens_monthly IS
  'Monthly cap on AI input tokens. NULL = unlimited. 0 = AI disabled.';
COMMENT ON COLUMN plans.ai_output_tokens_monthly IS
  'Monthly cap on AI output tokens (output costs ~5x input for Sonnet).';

-- Default values for known plan tiers (only set if currently NULL)
-- Free / Starter: AI disabled
UPDATE plans
   SET ai_input_tokens_monthly  = 0,
       ai_output_tokens_monthly = 0
 WHERE LOWER(name) IN ('free', 'starter')
   AND ai_input_tokens_monthly IS NULL;

-- Professional: ~500k input + 150k output (≈ R$25/mes em Haiku, R$300 em Sonnet)
UPDATE plans
   SET ai_input_tokens_monthly  = 500000,
       ai_output_tokens_monthly = 150000
 WHERE LOWER(name) = 'professional'
   AND ai_input_tokens_monthly IS NULL;

-- Enterprise: ~2.5M input + 750k output
UPDATE plans
   SET ai_input_tokens_monthly  = 2500000,
       ai_output_tokens_monthly = 750000
 WHERE LOWER(name) = 'enterprise'
   AND ai_input_tokens_monthly IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 5. usage_metrics: ensure 'ai_tokens_input' and 'ai_tokens_output'
--    metric_types are documented (no schema change — they reuse the
--    existing structure created in migration 029)
-- ─────────────────────────────────────────────────────────────
-- Migration 029 already added the unique constraint on
-- (company_id, metric_type, period_start) which we rely on for
-- ON CONFLICT upserts of token usage by month.
