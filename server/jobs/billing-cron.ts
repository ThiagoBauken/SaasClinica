import cron from 'node-cron';
import { runDunningTasks } from '../services/dunning-service';
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

  cronLogger.info('Billing cron jobs configured: dunning at 09:00 and 18:00');

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
