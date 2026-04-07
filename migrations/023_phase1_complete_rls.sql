-- =============================================================================
-- Migration 023: Phase 1 — Complete RLS Coverage
-- Date: 2026-04-03
-- Scope:
--   Complete Row-Level Security on ALL tenant-scoped tables that were missed
--   in migration 018. Also fixes the working_hours table (no company_id).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. COMPLETE RLS ON ALL MISSING TABLES WITH company_id
-- =============================================================================

DO $$
DECLARE
  tbl TEXT;
  -- All tables that have company_id but were NOT in migration 018
  missing_rls_tables TEXT[] := ARRAY[
    -- Clinical / Core
    'financial_transactions',
    'treatment_plans',
    'treatment_plan_procedures',
    'patient_records',
    'patient_documents',
    'commission_settings',
    'procedure_commissions',
    'commission_records',
    'professional_commissions',
    'appointment_procedures',

    -- Chat / AI
    'chat_messages',
    'ai_tool_calls',
    'canned_responses',
    'admin_phones',
    'intent_patterns',

    -- CRM / Sales extended
    'sales_opportunity_history',

    -- Patient features
    'reactivation_logs',
    'risk_alert_types',
    'patient_risk_alerts',
    'public_anamnesis_links',
    'public_anamnesis_responses',

    -- Digitalization
    'digitalization_usage',
    'digitalization_logs',
    'digitization_history',
    'digitalization_invoices',

    -- New modules
    'anesthesia_logs',
    'accounts_payable',
    'accounts_receivable',
    'schedule_blocks',
    'bank_transactions',
    'discount_limits',
    'clinic_units',

    -- Financial / Settings
    'machine_taxes',
    'fiscal_settings',
    'payment_plans',
    'financial_categories',
    'sales_goals',
    'tasks',
    'shop_items',
    'anamesis_templates',
    'prosthesis_services',
    'prosthesis_types',
    'prosthesis_stages',
    'chairs',

    -- Menu / Permissions
    'menu_permissions',
    'communication_settings',

    -- Billing (tenant-scoped)
    'subscription_invoices',
    'subscription_history',
    'usage_metrics',
    'coupon_usages',
    'mercado_pago_subscriptions',

    -- Website
    'websites'
  ];
BEGIN
  FOREACH tbl IN ARRAY missing_rls_tables LOOP
    -- Only process if table exists AND has company_id column
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = tbl AND column_name = 'company_id' AND table_schema = 'public'
    ) THEN
      -- Enable RLS
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);

      -- Drop existing policy if any (idempotent)
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);

      -- Create tenant isolation policy (same logic as migration 018)
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I
         FOR ALL
         USING (company_id = current_tenant_id() OR current_tenant_id() IS NULL)',
        tbl
      );

      RAISE NOTICE 'RLS enabled on table: %', tbl;
    ELSE
      RAISE NOTICE 'Table % missing or no company_id — skipping RLS', tbl;
    END IF;
  END LOOP;
END $$;


-- =============================================================================
-- 2. FIX: working_hours RLS
-- working_hours has user_id but NO company_id.
-- RLS policy must JOIN through users to get company_id.
-- =============================================================================

-- First, disable the broken policy from migration 018 (if it was applied)
ALTER TABLE working_hours DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON working_hours;

-- Add company_id to working_hours for proper RLS
ALTER TABLE working_hours ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);

-- Backfill from users
UPDATE working_hours wh
SET company_id = u.company_id
FROM users u
WHERE wh.user_id = u.id
  AND wh.company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_working_hours_company ON working_hours(company_id);

-- Re-enable RLS with standard policy
ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_hours FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON working_hours
  FOR ALL
  USING (company_id = current_tenant_id() OR current_tenant_id() IS NULL);


-- =============================================================================
-- 3. FIX: holidays table — company_id can be NULL (national holidays)
-- Need a policy that allows NULL company_id rows to be visible to everyone
-- =============================================================================

DROP POLICY IF EXISTS tenant_isolation ON holidays;

CREATE POLICY tenant_isolation ON holidays
  FOR ALL
  USING (
    company_id = current_tenant_id()
    OR company_id IS NULL  -- national holidays visible to all
    OR current_tenant_id() IS NULL  -- admin/migration mode
  );


-- =============================================================================
-- 4. SUBSCRIPTIONS TABLE — already has RLS? Ensure it does with correct policy
-- One subscription per company, keyed by company_id
-- =============================================================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON subscriptions;

CREATE POLICY tenant_isolation ON subscriptions
  FOR ALL
  USING (company_id = current_tenant_id() OR current_tenant_id() IS NULL);


-- =============================================================================
-- 5. COUPONS TABLE — may or may not have company_id
-- Coupons with NULL company_id are global (visible to all)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'coupons' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
    ALTER TABLE coupons FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON coupons;

    CREATE POLICY tenant_isolation ON coupons
      FOR ALL
      USING (
        company_id = current_tenant_id()
        OR company_id IS NULL  -- global coupons
        OR current_tenant_id() IS NULL
      );
  END IF;
END $$;


-- =============================================================================
-- 6. VERIFICATION QUERY (run after migration)
-- =============================================================================
-- SELECT t.tablename,
--        t.rowsecurity,
--        CASE WHEN c.column_name IS NOT NULL THEN 'has company_id' ELSE 'NO company_id' END
-- FROM pg_tables t
-- LEFT JOIN information_schema.columns c
--   ON c.table_name = t.tablename AND c.column_name = 'company_id' AND c.table_schema = 'public'
-- WHERE t.schemaname = 'public'
--   AND t.tablename NOT IN ('schema_migrations', 'drizzle_migrations', 'spatial_ref_sys')
-- ORDER BY t.rowsecurity, t.tablename;


COMMIT;
