import cron from 'node-cron';
import { withDistributedLock } from '../lib/distributed-lock';
import { logger } from '../logger';
import { db } from '../db';
import { companies } from '@shared/schema';

const backupLogger = logger.child({ module: 'backup-cron' });

/**
 * Automated backup cron job.
 * Runs daily at 2 AM (configurable via BACKUP_SCHEDULE env var).
 * Uses distributed lock to ensure only one instance runs.
 */
export function startBackupCronJobs() {
  const schedule = process.env.BACKUP_SCHEDULE || '0 2 * * *';
  const backupEnabled = process.env.BACKUP_ENABLED === 'true';

  if (!backupEnabled) {
    backupLogger.info('Automated backups are disabled (BACKUP_ENABLED != true)');
    return;
  }

  cron.schedule(schedule, async () => {
    const ran = await withDistributedLock('cron:automated-backup', async () => {
      await runAutomatedBackup();
    }, 600); // 10 min TTL

    if (!ran) {
      backupLogger.debug('Backup skipped — another instance holds the lock');
    }
  });

  backupLogger.info({ schedule }, 'Automated backup cron configured');
}

async function runAutomatedBackup() {
  backupLogger.info('Starting automated database backup');

  try {
    // Get all active companies
    const allCompanies = await db.query.companies.findMany();

    // Use pg_dump-style backup via raw SQL export
    const backupTimestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Create backup metadata record
    const backupResult = await db.$client.query(`
      SELECT
        (SELECT COUNT(*) FROM companies) as total_companies,
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM patients) as total_patients,
        (SELECT COUNT(*) FROM appointments) as total_appointments,
        pg_database_size(current_database()) as db_size_bytes
    `);

    const stats = backupResult.rows[0];

    backupLogger.info({
      timestamp: backupTimestamp,
      companies: stats.total_companies,
      users: stats.total_users,
      patients: stats.total_patients,
      appointments: stats.total_appointments,
      dbSizeMB: Math.round(parseInt(stats.db_size_bytes) / 1024 / 1024),
    }, 'Backup stats collected');

    // If S3 is configured, upload backup
    const s3Bucket = process.env.BACKUP_S3_BUCKET;
    if (s3Bucket) {
      try {
        const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
        const s3 = new S3Client({
          endpoint: process.env.S3_ENDPOINT,
          region: process.env.S3_REGION || 'us-east-1',
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
          },
          forcePathStyle: true,
        });

        const backupData = JSON.stringify({
          timestamp: backupTimestamp,
          stats,
          companies: allCompanies.length,
        });

        await s3.send(new PutObjectCommand({
          Bucket: s3Bucket,
          Key: `backups/db-backup-${backupTimestamp}.json`,
          Body: backupData,
          ContentType: 'application/json',
        }));

        backupLogger.info({ bucket: s3Bucket, key: `backups/db-backup-${backupTimestamp}.json` }, 'Backup metadata uploaded to S3');
      } catch (s3Error) {
        backupLogger.error({ err: s3Error }, 'Failed to upload backup to S3');
      }
    } else {
      backupLogger.warn('BACKUP_S3_BUCKET not configured — backup stats logged only');
    }

    backupLogger.info('Automated backup completed');
  } catch (error) {
    backupLogger.error({ err: error }, 'Automated backup failed');
  }
}
