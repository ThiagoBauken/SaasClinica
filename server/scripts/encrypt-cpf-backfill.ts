/**
 * CPF Encryption Backfill Script
 *
 * Encrypts all plaintext CPF values into cpf_enc columns using pgcrypto.
 * Uses the FIELD_ENCRYPTION_KEY from .env.
 *
 * Run with: npx tsx server/scripts/encrypt-cpf-backfill.ts
 *
 * This is a ONE-TIME migration script. After confirming all CPFs are encrypted:
 *   1. Update application code to read from cpf_enc (decrypt on read)
 *   2. Stop writing to plaintext cpf column
 *   3. Run a final migration to DROP the plaintext columns
 */

import { config } from 'dotenv';
config({ override: true });

import { db, pool } from '../db';
import { sql } from 'drizzle-orm';

const ENCRYPTION_KEY = process.env.FIELD_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  console.error('ERROR: FIELD_ENCRYPTION_KEY or ENCRYPTION_KEY must be set in .env');
  process.exit(1);
}

async function encryptColumn(
  table: string,
  plaintextCol: string,
  encryptedCol: string,
) {
  console.log(`\nEncrypting ${table}.${plaintextCol} → ${table}.${encryptedCol}...`);

  // Count rows to encrypt
  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM ${table} WHERE ${plaintextCol} IS NOT NULL AND ${plaintextCol} != '' AND ${encryptedCol} IS NULL`
  );
  const total = parseInt(countResult.rows[0].total);
  console.log(`  Found ${total} rows to encrypt`);

  if (total === 0) {
    console.log('  Nothing to do.');
    return;
  }

  // Encrypt in batches of 500
  const batchSize = 500;
  let processed = 0;

  while (processed < total) {
    const result = await pool.query(
      `UPDATE ${table}
       SET ${encryptedCol} = pgp_sym_encrypt(${plaintextCol}, $1)
       WHERE id IN (
         SELECT id FROM ${table}
         WHERE ${plaintextCol} IS NOT NULL AND ${plaintextCol} != '' AND ${encryptedCol} IS NULL
         LIMIT $2
       )
       RETURNING id`,
      [ENCRYPTION_KEY, batchSize]
    );

    processed += result.rowCount || 0;
    console.log(`  Encrypted ${processed}/${total} rows...`);
  }

  console.log(`  Done. ${processed} rows encrypted in ${table}.${encryptedCol}`);
}

async function main() {
  console.log('=== CPF Encryption Backfill ===');
  console.log(`Using encryption key: ${(ENCRYPTION_KEY || '').substring(0, 4)}...`);

  try {
    // Ensure pgcrypto is available
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

    // 1. patients.cpf → cpf_enc
    await encryptColumn('patients', 'cpf', 'cpf_enc');

    // 2. patients.responsible_cpf → responsible_cpf_enc
    await encryptColumn('patients', 'responsible_cpf', 'responsible_cpf_enc');

    // 3. patients.rg → rg_enc
    await encryptColumn('patients', 'rg', 'rg_enc');

    // 4. public_anamnesis_responses.cpf → cpf_enc (if table exists)
    try {
      await encryptColumn('public_anamnesis_responses', 'cpf', 'cpf_enc');
    } catch (err: any) {
      if (err.message?.includes('does not exist')) {
        console.log('\n  public_anamnesis_responses table does not exist, skipping');
      } else {
        throw err;
      }
    }

    // Verification
    console.log('\n=== Verification ===');
    const verifyResult = await pool.query(
      `SELECT COUNT(*) as remaining FROM patients WHERE cpf IS NOT NULL AND cpf != '' AND cpf_enc IS NULL`
    );
    const remaining = parseInt(verifyResult.rows[0].remaining);

    if (remaining === 0) {
      console.log('All CPFs encrypted successfully!');
      console.log('\nNext steps:');
      console.log('  1. Update app code to use cpf_enc (decrypt with pgp_sym_decrypt)');
      console.log('  2. Test thoroughly');
      console.log('  3. Create migration to DROP plaintext cpf columns');
    } else {
      console.warn(`WARNING: ${remaining} rows still have unencrypted CPFs`);
    }
  } catch (error) {
    console.error('ERROR during backfill:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
