// Load environment variables from .env file FIRST
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import * as path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root - override existing env vars
config({ path: path.join(__dirname, '../../.env'), override: true });

async function markMigrationsDone() {
  // Dynamic import to ensure env is loaded first
  const { pool } = await import('../db.js');

  try {
    console.log('🔄 Marking old migrations as done...\n');

    const migrations = [
      '001_add_performance_indexes.sql',
      '002_n8n_integration.sql',
      '003_fix_multitenant_isolation.sql',
      '004_billing_system.sql',
      '004_clinic_settings_and_automation_logs.sql',
      '005_add_openai_to_companies.sql',
      'add_google_calendar_tokens.sql'
    ];

    for (const migration of migrations) {
      await pool.query(
        'INSERT INTO schema_migrations (migration_name) VALUES ($1) ON CONFLICT (migration_name) DO NOTHING',
        [migration]
      );
      console.log(`✅ Marked ${migration} as done`);
    }

    console.log('\n✅ All migrations marked!');
  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

markMigrationsDone();
