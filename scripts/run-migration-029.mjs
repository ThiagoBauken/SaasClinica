// One-shot runner for migrations/029_ai_token_metering.sql
// Run with: node scripts/run-migration-029.mjs
import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import pg from 'pg';

const { Client } = pg;

const sqlPath = resolve(process.cwd(), 'migrations/029_ai_token_metering.sql');
const sql = readFileSync(sqlPath, 'utf8');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

console.log('Target DB:', url.replace(/:[^@]*@/, ':***@'));

const client = new Client({
  connectionString: url,
  ssl: url.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log('Connected.');

  // Pre-flight: count duplicates that would be deleted
  const dupCheck = await client.query(`
    SELECT company_id, metric_type, period_start, COUNT(*) as cnt
    FROM usage_metrics
    GROUP BY company_id, metric_type, period_start
    HAVING COUNT(*) > 1
  `);

  if (dupCheck.rows.length > 0) {
    console.log(`\nWARNING: ${dupCheck.rows.length} duplicate groups found that will be cleaned:`);
    for (const row of dupCheck.rows.slice(0, 10)) {
      console.log(`  company_id=${row.company_id} metric=${row.metric_type} period=${row.period_start.toISOString()} count=${row.cnt}`);
    }
  } else {
    console.log('No duplicates found.');
  }

  // Check if constraint already exists
  const conCheck = await client.query(`
    SELECT 1 FROM pg_constraint WHERE conname = 'usage_metrics_company_metric_period_uniq'
  `);
  if (conCheck.rows.length > 0) {
    console.log('Constraint already exists — migration already applied. Exiting.');
    await client.end();
    process.exit(0);
  }

  console.log('\nApplying migration...');
  await client.query(sql);
  console.log('Migration applied successfully.');

  // Verify
  const verify = await client.query(`
    SELECT conname FROM pg_constraint WHERE conname = 'usage_metrics_company_metric_period_uniq'
  `);
  console.log('Verification:', verify.rows.length === 1 ? 'OK — constraint present' : 'FAILED');

  await client.end();
} catch (err) {
  console.error('Migration failed:', err.message);
  try { await client.end(); } catch {}
  process.exit(1);
}
