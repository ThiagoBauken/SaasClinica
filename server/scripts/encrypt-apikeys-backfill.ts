/**
 * API Keys Encryption Backfill Script
 *
 * Encrypts all plaintext API keys/tokens into *_enc BYTEA columns using pgcrypto.
 * Uses the ENCRYPTION_KEY from .env.
 *
 * Run with: npx tsx server/scripts/encrypt-apikeys-backfill.ts
 *
 * After all keys are migrated, a future migration should DROP the plaintext columns.
 */

import { config } from 'dotenv';
config({ override: true });

import { pool } from '../db';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  console.error('ERROR: ENCRYPTION_KEY must be set in .env');
  process.exit(1);
}

interface ColumnMapping {
  table: string;
  plaintext: string;
  encrypted: string;
}

const COLUMNS_TO_ENCRYPT: ColumnMapping[] = [
  // companies
  { table: 'companies', plaintext: 'openai_api_key', encrypted: 'openai_api_key_enc' },
  { table: 'companies', plaintext: 'anthropic_api_key', encrypted: 'anthropic_api_key_enc' },
  { table: 'companies', plaintext: 'api_key', encrypted: 'api_key_enc' },

  // users (Google OAuth tokens, TOTP)
  { table: 'users', plaintext: 'google_access_token', encrypted: 'google_access_token_enc' },
  { table: 'users', plaintext: 'google_refresh_token', encrypted: 'google_refresh_token_enc' },
  { table: 'users', plaintext: 'totp_secret', encrypted: 'totp_secret_enc' },

  // clinic_settings
  { table: 'clinic_settings', plaintext: 'wuzapi_api_key', encrypted: 'wuzapi_api_key_enc' },
  { table: 'clinic_settings', plaintext: 'evolution_api_key', encrypted: 'evolution_api_key_enc' },
  { table: 'clinic_settings', plaintext: 'meta_access_token', encrypted: 'meta_access_token_enc' },
  { table: 'clinic_settings', plaintext: 'baserow_api_key', encrypted: 'baserow_api_key_enc' },
];

async function encryptColumn(mapping: ColumnMapping) {
  const { table, plaintext, encrypted } = mapping;

  // Check if both columns exist
  const colCheck = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = $1 AND column_name IN ($2, $3) AND table_schema = 'public'`,
    [table, plaintext, encrypted]
  );

  const existingCols = colCheck.rows.map((r: any) => r.column_name);
  if (!existingCols.includes(plaintext) || !existingCols.includes(encrypted)) {
    console.log(`  SKIP ${table}.${plaintext} → ${encrypted} (columns missing)`);
    return 0;
  }

  const result = await pool.query(
    `UPDATE ${table}
     SET ${encrypted} = pgp_sym_encrypt(${plaintext}, $1)
     WHERE ${plaintext} IS NOT NULL AND ${plaintext} != '' AND ${encrypted} IS NULL
     RETURNING id`,
    [ENCRYPTION_KEY]
  );

  const count = result.rowCount || 0;
  if (count > 0) {
    console.log(`  Encrypted ${count} rows: ${table}.${plaintext} → ${encrypted}`);
  } else {
    console.log(`  ${table}.${plaintext}: nothing to encrypt`);
  }
  return count;
}

async function main() {
  console.log('=== API Keys Encryption Backfill ===');
  console.log(`Using encryption key: ${ENCRYPTION_KEY!.substring(0, 4)}...`);

  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

    let totalEncrypted = 0;

    for (const mapping of COLUMNS_TO_ENCRYPT) {
      totalEncrypted += await encryptColumn(mapping);
    }

    console.log(`\nDone. Total rows encrypted: ${totalEncrypted}`);

    if (totalEncrypted > 0) {
      console.log('\nNext steps:');
      console.log('  1. Update app to read from *_enc columns (decrypt with pgp_sym_decrypt)');
      console.log('  2. Update app to write to BOTH plaintext and _enc on create/update');
      console.log('  3. After full verification, create migration to NULL out plaintext columns');
      console.log('  4. Final migration: DROP plaintext columns');
    }
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
