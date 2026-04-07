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
