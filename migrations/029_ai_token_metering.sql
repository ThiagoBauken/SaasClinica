-- Migration: 029 — AI token metering per tenant
-- Adds the unique constraint required by SubscriptionService.incrementAITokenUsage()
-- which uses ON CONFLICT (company_id, metric_type, period_start) DO UPDATE.
--
-- Without this constraint, the upsert in incrementAITokenUsage() will fail at runtime.
--
-- Note: the runner wraps each migration in its own transaction, so this file
-- should not contain its own BEGIN/COMMIT.

-- 1. Defensive cleanup of pre-existing duplicates (if any).
--    Keeps the row with the highest current_value, drops the rest.
DELETE FROM usage_metrics a
USING usage_metrics b
WHERE a.id < b.id
  AND a.company_id   = b.company_id
  AND a.metric_type  = b.metric_type
  AND a.period_start = b.period_start;

-- 2. Composite unique constraint required for upsert idempotency
--    Wrapped in DO block because PostgreSQL ADD CONSTRAINT does not support IF NOT EXISTS.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'usage_metrics_company_metric_period_uniq'
  ) THEN
    ALTER TABLE usage_metrics
      ADD CONSTRAINT usage_metrics_company_metric_period_uniq
      UNIQUE (company_id, metric_type, period_start);
  END IF;
END $$;

-- 3. Supporting index for the lookup pattern in getAITokenUsage()
--    (company_id + metric_type + period_start range scan)
CREATE INDEX IF NOT EXISTS idx_usage_metrics_company_metric_period
  ON usage_metrics (company_id, metric_type, period_start DESC);
