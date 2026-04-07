-- =============================================================================
-- Migration 025: Fix duplicate migration numbering
-- Date: 2026-04-03
-- Renames tracked migration names in schema_migrations to match file renames.
-- This is idempotent — skips if old name doesn't exist.
-- =============================================================================

UPDATE schema_migrations SET migration_name = '012b_settings_jsonb_columns.sql'
WHERE migration_name = '012_settings_jsonb_columns.sql';

UPDATE schema_migrations SET migration_name = '014b_recall_waitlist_reviews_contracts_campaigns.sql'
WHERE migration_name = '014_recall_waitlist_reviews_contracts_campaigns.sql';

UPDATE schema_migrations SET migration_name = '015b_whatsapp_provider_meta_cloud.sql'
WHERE migration_name = '015_whatsapp_provider_meta_cloud.sql';

UPDATE schema_migrations SET migration_name = '017b_mfa_totp.sql'
WHERE migration_name = '017_mfa_totp.sql';

UPDATE schema_migrations SET migration_name = '018b_ai_usage_tracking.sql'
WHERE migration_name = '018_ai_usage_tracking.sql';
