// Load environment variables from .env file FIRST
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import * as path from 'path';
import * as fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root - override existing env vars
config({ path: path.join(__dirname, '../../.env'), override: true });

console.log('🔍 DATABASE_URL:', process.env.DATABASE_URL);

/**
 * Script para executar migrations SQL
 *
 * Uso: npx tsx server/scripts/run-migrations.ts
 */

// Drizzle Kit baseline files that recreate already-existing schema must be skipped.
// They are added to schema_migrations as "already applied" so they never run.
//
// The renamed migrations (003a_, 004a_, etc.) replace the old duplicate-prefix
// files (003_, 004_). We skip the NEW names here so databases that already ran
// the OLD names won't re-execute them under their new filenames.
const SKIP_FILES = new Set<string>([
  '0000_dark_jean_grey.sql', // Drizzle baseline — schema already in place
]);

async function runMigrations() {
  // Dynamic import to ensure env is loaded first
  const { pool } = await import('../db.js');

  // Migrations live at the project root (../../migrations from server/scripts/).
  // This is the same folder Drizzle Kit writes to (drizzle.config.ts → out: "./migrations").
  const migrationsDir = path.join(__dirname, '../../migrations');

  console.log('🔄 Starting database migrations...');
  console.log('📁 Migrations dir:', migrationsDir);
  console.log('');

  try {
    // Criar tabela de migrations se não existir
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Mark skipped files as applied so they never show up as pending
    for (const f of SKIP_FILES) {
      await pool.query(
        `INSERT INTO schema_migrations (migration_name) VALUES ($1) ON CONFLICT DO NOTHING`,
        [f]
      );
    }

    // Migration renames: old duplicate-prefix files were renamed to a/b/c suffixes.
    // If the old name is already in schema_migrations, register the new name too
    // so the renamed file is not re-executed on existing databases.
    const RENAMES: [string, string][] = [
      ['003_add_integration_fields.sql', '003a_add_integration_fields.sql'],
      ['003_fix_multitenant_isolation.sql', '003b_fix_multitenant_isolation.sql'],
      ['004_billing_system.sql', '004a_billing_system.sql'],
      ['004_clinic_settings_and_automation_logs.sql', '004b_clinic_settings_and_automation_logs.sql'],
      ['010_add_missing_columns.sql', '010a_add_missing_columns.sql'],
      ['010_add_recurring_appointment_columns.sql', '010b_add_recurring_appointment_columns.sql'],
      ['014_ai_agent_integration.sql', '014a_ai_agent_integration.sql'],
      ['014_missing_tables.sql', '014b_missing_tables.sql'],
      ['015_add_missing_patient_columns.sql', '015a_add_missing_patient_columns.sql'],
      ['015_insurance_management.sql', '015b_insurance_management.sql'],
      ['022_phase0_critical_security.sql', '022a_phase0_critical_security.sql'],
      ['022_waitlist.sql', '022b_waitlist.sql'],
      ['023_executive_reports.sql', '023a_executive_reports.sql'],
      ['023_phase1_complete_rls.sql', '023b_phase1_complete_rls.sql'],
      ['023_quotes_and_invites.sql', '023c_quotes_and_invites.sql'],
    ];
    for (const [oldName, newName] of RENAMES) {
      await pool.query(
        `INSERT INTO schema_migrations (migration_name)
         SELECT $2 WHERE EXISTS (SELECT 1 FROM schema_migrations WHERE migration_name = $1)
         ON CONFLICT DO NOTHING`,
        [oldName, newName]
      );
    }

    // Ler todos os arquivos de migration (excluindo os skipped)
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql') && !SKIP_FILES.has(file))
      .sort(); // Executar em ordem alfabética

    if (migrationFiles.length === 0) {
      console.log('ℹ️  No migration files found');
      return;
    }

    for (const file of migrationFiles) {
      // Verificar se já foi executada
      const result = await pool.query(
        'SELECT 1 FROM schema_migrations WHERE migration_name = $1',
        [file]
      );

      if (result.rows.length > 0) {
        console.log(`⏭️  Skipping ${file} (already executed)`);
        continue;
      }

      console.log(`▶️  Running ${file}...`);

      // Ler e executar SQL
      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf8');

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`✅ Completed ${file}\n`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ Failed ${file}:`, error);
        throw error;
      } finally {
        client.release();
      }
    }

    console.log('✅ All migrations completed successfully!\n');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    const { pool } = await import('../db.js');
    await pool.end();
  }
}

runMigrations();
