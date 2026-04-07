/**
 * Pre-flight check: validates critical environment, DB connectivity, and
 * optional integrations before a production deploy. Exits with non-zero
 * status if any critical check fails so CI/CD can block the deploy.
 *
 * Usage:
 *   npx tsx server/scripts/preflight.ts
 *
 * Exit codes:
 *   0 — all critical checks passed (warnings may still be shown)
 *   1 — one or more critical checks failed
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import * as path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.join(__dirname, '../../.env') });

type Severity = 'critical' | 'warning' | 'info';

interface CheckResult {
  name: string;
  severity: Severity;
  ok: boolean;
  message: string;
}

const results: CheckResult[] = [];

function record(name: string, severity: Severity, ok: boolean, message: string) {
  results.push({ name, severity, ok, message });
}

function requireEnv(name: string, severity: Severity = 'critical') {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    record(name, severity, false, 'not set');
  } else {
    record(name, severity, true, `set (${v.length} chars)`);
  }
}

function optionalEnv(name: string) {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    record(name, 'info', true, 'not set (optional)');
  } else {
    record(name, 'info', true, 'set');
  }
}

async function checkDb() {
  try {
    const pg = await import('pg');
    const client = new pg.default.Client({
      connectionString: process.env.DATABASE_URL,
    });
    await client.connect();

    // Verify critical tables exist
    const tables = [
      'users',
      'patients',
      'appointments',
      'waitlist',
      'executive_reports',
      'anamnesis_versions',
    ];
    let missing: string[] = [];
    for (const t of tables) {
      const r = await client.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name=$1) as e`,
        [t]
      );
      if (!r.rows[0].e) missing.push(t);
    }

    // Count applied migrations
    const mig = await client.query('SELECT COUNT(*) FROM schema_migrations');
    await client.end();

    if (missing.length > 0) {
      record('DB_TABLES', 'critical', false, `missing tables: ${missing.join(', ')}`);
    } else {
      record(
        'DB_CONNECTIVITY',
        'critical',
        true,
        `connected, ${mig.rows[0].count} migrations applied, all critical tables present`
      );
    }
  } catch (err: any) {
    record('DB_CONNECTIVITY', 'critical', false, `failed: ${err.message}`);
  }
}

async function checkRedis() {
  const host = process.env.REDIS_HOST;
  if (!host || host === 'localhost') {
    record(
      'REDIS',
      'warning',
      false,
      'REDIS_HOST not set or localhost — sessions and queues will use in-memory fallback (single-instance only, data lost on restart)'
    );
    return;
  }
  record('REDIS_HOST', 'info', true, `configured: ${host}`);
}

async function run() {
  console.log('\n=== PRE-FLIGHT CHECK ===\n');

  // --- Critical env vars ---
  requireEnv('DATABASE_URL', 'critical');
  requireEnv('SESSION_SECRET', 'critical');
  requireEnv('NODE_ENV', 'warning');

  // --- Security (strongly recommended) ---
  requireEnv('ENCRYPTION_KEY', 'warning');
  requireEnv('FIELD_ENCRYPTION_KEY', 'warning');

  // --- Database ---
  await checkDb();

  // --- Redis ---
  await checkRedis();

  // --- Optional integrations ---
  console.log('--- Optional integrations ---');
  optionalEnv('SMS_PROVIDER');
  optionalEnv('TWILIO_ACCOUNT_SID');
  optionalEnv('SENTRY_DSN');
  optionalEnv('OLLAMA_BASE_URL');
  optionalEnv('WUZAPI_BASE_URL');
  optionalEnv('STRIPE_SECRET_KEY');
  optionalEnv('MERCADOPAGO_ACCESS_TOKEN');

  // --- Report ---
  console.log('\n=== RESULTS ===\n');

  const critFails = results.filter((r) => r.severity === 'critical' && !r.ok);
  const warnFails = results.filter((r) => r.severity === 'warning' && !r.ok);
  const passed = results.filter((r) => r.ok && r.severity !== 'info');

  for (const r of results) {
    const icon = r.ok ? '✅' : r.severity === 'critical' ? '❌' : '⚠️';
    const tag =
      r.severity === 'critical'
        ? '[CRIT]'
        : r.severity === 'warning'
          ? '[WARN]'
          : '[INFO]';
    console.log(`  ${icon} ${tag} ${r.name}: ${r.message}`);
  }

  console.log(
    `\n${passed.length} passed, ${warnFails.length} warnings, ${critFails.length} critical failures`
  );

  if (critFails.length > 0) {
    console.log('\n❌ Pre-flight FAILED. Fix critical issues before deploying.\n');
    process.exit(1);
  } else if (warnFails.length > 0) {
    console.log(
      '\n⚠️  Pre-flight passed with warnings. Review before deploying to production.\n'
    );
    process.exit(0);
  } else {
    console.log('\n✅ Pre-flight passed.\n');
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Pre-flight crashed:', err);
  process.exit(2);
});
