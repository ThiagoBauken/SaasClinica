/**
 * Slow Query Monitor
 *
 * Periodically reads pg_stat_statements (if available) and logs
 * queries exceeding the configured threshold.
 *
 * Also provides a migration script to enable pg_stat_statements
 * and set log_min_duration_statement on the database.
 */
import { logger } from '../logger';
import { withDistributedLock } from './distributed-lock';

const sqLogger = logger.child({ module: 'slow-query-monitor' });

/**
 * SQL to enable slow query infrastructure on PostgreSQL.
 * Run once as a superuser — safe to re-run (idempotent).
 */
export const ENABLE_SLOW_QUERY_SQL = `
-- Enable pg_stat_statements extension (requires superuser or rds_superuser)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Log queries taking longer than 1 second
ALTER DATABASE current_database() SET log_min_duration_statement = 1000;

-- Track query execution stats
ALTER DATABASE current_database() SET pg_stat_statements.track = 'all';
`;

/**
 * Check and log top slow queries from pg_stat_statements.
 * Safe to call even if pg_stat_statements is not installed.
 */
export async function logSlowQueries(pool: any, topN: number = 10): Promise<void> {
  try {
    // Check if pg_stat_statements is available
    const extCheck = await pool.query(
      `SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'`
    );

    if (extCheck.rows.length === 0) {
      sqLogger.debug('pg_stat_statements not installed — skipping slow query check');
      return;
    }

    const result = await pool.query(`
      SELECT
        queryid,
        LEFT(query, 200) as query_preview,
        calls,
        ROUND(total_exec_time::numeric, 2) as total_time_ms,
        ROUND(mean_exec_time::numeric, 2) as mean_time_ms,
        ROUND(max_exec_time::numeric, 2) as max_time_ms,
        rows
      FROM pg_stat_statements
      WHERE userid = (SELECT usesysid FROM pg_user WHERE usename = current_user)
        AND mean_exec_time > 100
      ORDER BY mean_exec_time DESC
      LIMIT $1
    `, [topN]);

    if (result.rows.length > 0) {
      sqLogger.warn({
        slowQueries: result.rows.map((r: any) => ({
          queryPreview: r.query_preview,
          calls: parseInt(r.calls),
          meanTimeMs: parseFloat(r.mean_time_ms),
          maxTimeMs: parseFloat(r.max_time_ms),
          totalTimeMs: parseFloat(r.total_time_ms),
          rows: parseInt(r.rows),
        })),
      }, `Found ${result.rows.length} slow queries (mean > 100ms)`);
    } else {
      sqLogger.info('No slow queries detected');
    }
  } catch (error: any) {
    // pg_stat_statements not available or permission denied — not critical
    if (error.code === '42P01' || error.code === '42501') {
      sqLogger.debug('pg_stat_statements not available (permission or not installed)');
    } else {
      sqLogger.error({ err: error }, 'Error checking slow queries');
    }
  }
}

/**
 * Start periodic slow query monitoring.
 * Runs every hour with a distributed lock.
 */
export function startSlowQueryMonitor(pool: any) {
  const enabled = process.env.SLOW_QUERY_MONITOR !== 'false';
  if (!enabled) {
    sqLogger.info('Slow query monitor disabled (SLOW_QUERY_MONITOR=false)');
    return;
  }

  const intervalMs = parseInt(process.env.SLOW_QUERY_INTERVAL || '3600000'); // 1 hour default

  sqLogger.info({ intervalMs }, 'Starting slow query monitor');

  // Run once after startup
  setTimeout(async () => {
    await withDistributedLock('cron:slow-query-check', async () => {
      await logSlowQueries(pool);
    }, 60);
  }, 30000); // 30s after startup

  // Then periodically
  setInterval(async () => {
    await withDistributedLock('cron:slow-query-check', async () => {
      await logSlowQueries(pool);
    }, 60);
  }, intervalMs);
}
