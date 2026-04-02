-- Migration 018: Row-Level Security (RLS) for multi-tenant isolation
-- Date: 2026-04-02
-- Priority: P1 (Security - defense in depth)
--
-- RLS ensures tenant isolation at the DATABASE level, complementing
-- application-level middleware. Even if app code omits a WHERE clause,
-- the database itself prevents cross-tenant data access.
--
-- Architecture:
--   1. App middleware calls: SELECT set_config('app.current_company_id', '42', true)
--   2. RLS policies check: company_id = current_setting('app.current_company_id')::int
--   3. When no tenant context is set (migrations, cron, superadmin), policies allow all rows

-- ============================================================
-- 1. HELPER FUNCTIONS
-- ============================================================

-- Function to get current tenant ID from session variable
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS INTEGER AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_company_id', true), '')::INTEGER;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION current_tenant_id() IS 'Returns the current tenant company_id from session variable, or NULL if not set';

-- ============================================================
-- 2. ENABLE RLS ON ALL TENANT-SCOPED TABLES
-- ============================================================

-- Helper: create RLS policy for a table
-- Policy logic: allow if company_id matches current tenant, OR no tenant is set (admin/migration mode)
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'patients',
    'appointments',
    'procedures',
    'payments',
    'anamnesis',
    'prescriptions',
    'treatment_evolution',
    'detailed_treatment_plans',
    'odontogram_entries',
    'periodontal_chart',
    'patient_exams',
    'rooms',
    'working_hours',
    'holidays',
    'inventory_items',
    'inventory_categories',
    'inventory_transactions',
    'prosthesis',
    'prosthesis_labels',
    'laboratories',
    'whatsapp_messages',
    'chat_sessions',
    'automations',
    'automation_logs',
    'sales_opportunities',
    'sales_funnel_stages',
    'sales_opportunity_history',
    'sales_tasks',
    'audit_logs',
    'notifications',
    'clinic_settings',
    'box',
    'box_transactions',
    'websites',
    'digital_signatures',
    'booking_link_settings',
    'appointment_confirmation_links'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Check if table exists before applying RLS
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl AND table_schema = 'public') THEN
      -- Enable RLS
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

      -- Force RLS even for table owner (critical for security)
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);

      -- Drop existing policy if any (idempotent)
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);

      -- Create tenant isolation policy
      -- Allows access when:
      --   a) company_id matches the current tenant context, OR
      --   b) No tenant context is set (NULL) — for migrations, cron jobs, superadmin
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I
         FOR ALL
         USING (company_id = current_tenant_id() OR current_tenant_id() IS NULL)',
        tbl
      );

      RAISE NOTICE 'RLS enabled on table: %', tbl;
    ELSE
      RAISE NOTICE 'Table % does not exist, skipping RLS', tbl;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 3. SPECIAL CASES
-- ============================================================

-- appointment_procedures: no company_id column, secured via FK to appointments
-- Users table: NOT secured with RLS (needed for cross-tenant auth lookups)
-- Companies table: NOT secured (superadmin needs access to all)
-- Modules/companyModules: NOT secured (module system needs cross-tenant access)
-- Plans/subscriptions: NOT secured (billing needs cross-tenant access)

-- ============================================================
-- 4. VERIFICATION QUERY (run after migration to confirm)
-- ============================================================
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public' AND rowsecurity = true
-- ORDER BY tablename;
