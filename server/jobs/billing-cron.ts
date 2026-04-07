import cron from 'node-cron';
import { runDunningTasks } from '../services/dunning-service';
import { processOverduePatientPayments } from '../services/patient-dunning.service';
import { checkExpiredSignatures } from './signature-expiration';
import { generateMonthlyExecutiveReports } from './monthly-executive-report';
import { withDistributedLock } from '../lib/distributed-lock';
import { logger } from '../logger';

const cronLogger = logger.child({ module: 'billing-cron' });

/**
 * Configuracao de Cron Jobs para Billing
 * Uses distributed lock to ensure only one instance runs each job.
 */
export function startBillingCronJobs() {
  cronLogger.info('Starting billing cron jobs');

  // Dunning todos os dias as 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    const ran = await withDistributedLock('cron:billing-dunning-am', async () => {
      cronLogger.info('Running dunning cron job (9:00 AM)');
      await runDunningTasks();
    }, 300); // 5 min TTL

    if (!ran) {
      cronLogger.debug('Dunning AM skipped — another instance holds the lock');
    }
  });

  // Dunning as 18:00 PM como backup
  cron.schedule('0 18 * * *', async () => {
    const ran = await withDistributedLock('cron:billing-dunning-pm', async () => {
      cronLogger.info('Running dunning cron job (6:00 PM)');
      await runDunningTasks();
    }, 300);

    if (!ran) {
      cronLogger.debug('Dunning PM skipped — another instance holds the lock');
    }
  });

  // Patient payment dunning — daily at 08:00
  cron.schedule('0 8 * * *', async () => {
    const ran = await withDistributedLock('cron:patient-dunning', async () => {
      cronLogger.info('Running patient dunning cron job (8:00 AM)');
      await processOverduePatientPayments();
    }, 300);

    if (!ran) {
      cronLogger.debug('Patient dunning skipped — another instance holds the lock');
    }
  });

  // Digital signature expiration — daily at 02:00 (low-traffic window)
  cron.schedule('0 2 * * *', async () => {
    const ran = await withDistributedLock('cron:signature-expiration', async () => {
      cronLogger.info('Running signature expiration cron job (2:00 AM)');
      await checkExpiredSignatures();
    }, 120);

    if (!ran) {
      cronLogger.debug('Signature expiration skipped — another instance holds the lock');
    }
  });

  // Mark overdue accounts payable — daily at 06:00
  cron.schedule('0 6 * * *', async () => {
    const ran = await withDistributedLock('cron:payable-overdue', async () => {
      cronLogger.info('Running accounts payable overdue check (6:00 AM)');
      const { db } = await import('../db');
      const { sql } = await import('drizzle-orm');

      const result = await db.execute(sql`
        UPDATE accounts_payable
        SET status = 'overdue', updated_at = NOW()
        WHERE status = 'pending'
          AND due_date < NOW()::date
          AND deleted_at IS NULL
      `);
      cronLogger.info({ rowCount: (result as any).rowCount ?? 0 }, 'Marked accounts payable as overdue');
    }, 120);

    if (!ran) {
      cronLogger.debug('Payable overdue check skipped — another instance holds the lock');
    }
  });

  // Monthly executive reports — 1st of each month at 03:00
  cron.schedule('0 3 1 * *', async () => {
    const ran = await withDistributedLock('cron:monthly-executive-reports', async () => {
      cronLogger.info('Running monthly executive report generation (1st of month, 3:00 AM)');
      await generateMonthlyExecutiveReports();
    }, 600); // 10 min TTL — generation touches all companies

    if (!ran) {
      cronLogger.debug('Monthly executive reports skipped — another instance holds the lock');
    }
  });

  // Materialized views refresh — every hour at :15
  // Keeps analytics dashboards and reactivation queries fast
  cron.schedule('15 * * * *', async () => {
    const ran = await withDistributedLock('cron:refresh-matviews', async () => {
      cronLogger.info('Refreshing materialized views');
      const { db } = await import('../db');
      const { sql } = await import('drizzle-orm');

      const views = [
        'mv_daily_appointment_stats',
        'mv_daily_financial_stats',
        'mv_patient_last_visit',
      ];

      for (const view of views) {
        try {
          await db.execute(sql.raw(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`));
          cronLogger.debug({ view }, 'Materialized view refreshed');
        } catch (err: any) {
          // View may not exist yet if migration hasn't run
          if (err?.message?.includes('does not exist')) {
            cronLogger.debug({ view }, 'Materialized view does not exist yet, skipping');
          } else {
            cronLogger.error({ err, view }, 'Failed to refresh materialized view');
          }
        }
      }
    }, 300);

    if (!ran) {
      cronLogger.debug('Matview refresh skipped — another instance holds the lock');
    }
  });

  cronLogger.info(
    'Billing cron jobs configured: SaaS dunning at 09:00 & 18:00, patient dunning at 08:00, payable overdue at 06:00, signature expiration at 02:00, matview refresh hourly, monthly executive reports on 1st at 03:00'
  );

  // Em desenvolvimento, executar uma vez ao iniciar
  if (process.env.NODE_ENV === 'development') {
    cronLogger.debug('Dev mode: running dunning tasks once on startup');
    setTimeout(() => {
      runDunningTasks().catch((err) =>
        cronLogger.error({ err }, 'Dev startup dunning failed')
      );
    }, 5000);
  }
}
