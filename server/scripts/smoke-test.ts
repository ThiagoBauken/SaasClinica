/**
 * Smoke test — hits a handful of critical endpoints to verify the app is
 * serving traffic and the recent audit features are accessible.
 *
 * Usage:
 *   BASE_URL=https://your-app.example.com npx tsx server/scripts/smoke-test.ts
 *   (defaults to http://localhost:5000)
 *
 * Exit codes:
 *   0 — all critical endpoints responded with expected status codes
 *   1 — one or more critical endpoints failed
 *
 * This is a read-only probe: it does not mutate any data.
 */

import { config } from 'dotenv';
config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

interface Check {
  label: string;
  url: string;
  expect: number[]; // acceptable status codes
  critical: boolean;
}

const checks: Check[] = [
  // Core infrastructure
  { label: 'Health endpoint', url: '/health', expect: [200], critical: true },

  // Public endpoints (no auth required — they should all respond with
  // either 200, 400 (bad args), or 404 (clinic not found) — never 5xx)
  {
    label: 'Public chatbot info endpoint',
    url: '/api/public/chatbot/999999/info',
    expect: [200, 404],
    critical: true,
  },

  // Authenticated endpoints (should return 401 when unauthenticated —
  // proves the route is wired up but also that auth middleware works)
  {
    label: 'Waitlist API (auth required)',
    url: '/api/v1/waitlist',
    expect: [401, 403],
    critical: true,
  },
  {
    label: 'Holidays API (auth required)',
    url: '/api/v1/holidays',
    expect: [401, 403],
    critical: true,
  },
  {
    label: 'Schedule blocks API (auth required)',
    url: '/api/v1/schedule-blocks',
    expect: [401, 403],
    critical: true,
  },
  {
    label: 'Cohort analytics (auth required)',
    url: '/api/v1/analytics/cohort',
    expect: [401, 403],
    critical: true,
  },
  {
    label: 'Executive report (auth required)',
    url: '/api/v1/reports/executive/2026-04',
    expect: [401, 403],
    critical: true,
  },

  // Static/SPA
  {
    label: 'SPA root',
    url: '/',
    expect: [200, 304],
    critical: true,
  },
];

async function run() {
  console.log(`\n=== SMOKE TEST ===`);
  console.log(`Target: ${BASE_URL}\n`);

  const results: { label: string; ok: boolean; actual: number | string; expected: string; critical: boolean }[] =
    [];

  for (const c of checks) {
    const url = `${BASE_URL}${c.url}`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      const ok = c.expect.includes(res.status);
      results.push({
        label: c.label,
        ok,
        actual: res.status,
        expected: c.expect.join(' or '),
        critical: c.critical,
      });
    } catch (err: any) {
      results.push({
        label: c.label,
        ok: false,
        actual: `ERROR: ${err.message}`,
        expected: c.expect.join(' or '),
        critical: c.critical,
      });
    }
  }

  for (const r of results) {
    const icon = r.ok ? '✅' : r.critical ? '❌' : '⚠️';
    console.log(`  ${icon} ${r.label}`);
    console.log(`       ${r.actual} (expected: ${r.expected})`);
  }

  const failed = results.filter((r) => !r.ok);
  const critFailed = failed.filter((r) => r.critical);

  console.log(
    `\n${results.length - failed.length}/${results.length} passed, ${critFailed.length} critical failures\n`
  );

  if (critFailed.length > 0) {
    console.log('❌ Smoke test FAILED.\n');
    process.exit(1);
  } else {
    console.log('✅ Smoke test passed.\n');
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(2);
});
