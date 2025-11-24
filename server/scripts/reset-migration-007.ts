// Load environment variables from .env file FIRST
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import * as path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root - override existing env vars
config({ path: path.join(__dirname, '../../.env'), override: true });

async function resetMigration() {
  // Dynamic import to ensure env is loaded first
  const { pool } = await import('../db.js');

  try {
    console.log('🔄 Resetting migration 007...\n');

    await pool.query(
      'DELETE FROM schema_migrations WHERE migration_name = $1',
      ['007_digital_signatures.sql']
    );

    console.log('✅ Migration 007 reset successfully!');
  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

resetMigration();
