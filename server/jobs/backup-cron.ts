import cron from 'node-cron';
import { spawn } from 'child_process';
import { createReadStream, createWriteStream, promises as fsp } from 'fs';
import { createCipheriv, randomBytes, createHash } from 'crypto';
import { tmpdir } from 'os';
import path from 'path';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';
import { withDistributedLock } from '../lib/distributed-lock';
import { logger } from '../logger';
import { db } from '../db';

const backupLogger = logger.child({ module: 'backup-cron' });

/**
 * Automated encrypted database backup cron job.
 *
 * Pipeline: pg_dump → gzip → AES-256-GCM → S3 (PutObject with SSE).
 * Runs daily at 2 AM (configurable via BACKUP_SCHEDULE env var).
 * Retention cleanup runs weekly (BACKUP_RETENTION_DAYS, default 30).
 *
 * Required env:
 *   BACKUP_ENABLED=true
 *   BACKUP_S3_BUCKET=<bucket>
 *   BACKUP_ENCRYPTION_KEY=<hex, 64 chars / 32 bytes>
 *   DATABASE_URL=postgresql://...
 *   S3_ENDPOINT / S3_REGION / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY
 */
export function startBackupCronJobs() {
  const schedule = process.env.BACKUP_SCHEDULE || '0 2 * * *';
  const backupEnabled = process.env.BACKUP_ENABLED === 'true';

  if (!backupEnabled) {
    backupLogger.info('Automated backups are disabled (BACKUP_ENABLED != true)');
    return;
  }

  // Daily backup
  cron.schedule(schedule, async () => {
    const ran = await withDistributedLock(
      'cron:automated-backup',
      async () => {
        await runAutomatedBackup();
      },
      3600 // 1h lock TTL (pg_dump can be slow)
    );
    if (!ran) backupLogger.debug('Backup skipped — another instance holds the lock');
  });

  // Weekly retention cleanup (Sunday 4 AM)
  cron.schedule('0 4 * * 0', async () => {
    const ran = await withDistributedLock(
      'cron:backup-retention',
      async () => {
        await enforceRetention();
      },
      600
    );
    if (!ran) backupLogger.debug('Retention cleanup skipped');
  });

  backupLogger.info({ schedule }, 'Automated backup cron configured');
}

async function runAutomatedBackup() {
  backupLogger.info('Starting automated database backup');

  const bucket = process.env.BACKUP_S3_BUCKET;
  const encKeyHex = process.env.BACKUP_ENCRYPTION_KEY;
  const databaseUrl = process.env.DATABASE_URL;

  if (!bucket) {
    backupLogger.error('BACKUP_S3_BUCKET not set — aborting');
    return;
  }
  if (!encKeyHex || encKeyHex.length !== 64) {
    backupLogger.error('BACKUP_ENCRYPTION_KEY must be a 64-char hex string (32 bytes) — aborting');
    return;
  }
  if (!databaseUrl) {
    backupLogger.error('DATABASE_URL not set — aborting');
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const tmpFile = path.join(tmpdir(), `db-backup-${timestamp}.sql.gz.enc`);
  const key = `backups/db-backup-${timestamp}.sql.gz.enc`;

  try {
    // 1) Capture pre-backup stats for the manifest
    const statsRes = await db.$client.query(`
      SELECT
        (SELECT COUNT(*) FROM companies) AS total_companies,
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM patients) AS total_patients,
        (SELECT COUNT(*) FROM appointments) AS total_appointments,
        pg_database_size(current_database()) AS db_size_bytes
    `);
    const stats = statsRes.rows[0];

    // 2) Run pg_dump → gzip → AES-256-GCM → file
    const iv = randomBytes(12);
    const encKey = Buffer.from(encKeyHex, 'hex');
    const cipher = createCipheriv('aes-256-gcm', encKey, iv);

    const pgDump = spawn(
      'pg_dump',
      ['--no-owner', '--no-privileges', '--format=plain', databaseUrl],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    let dumpStderr = '';
    pgDump.stderr.on('data', (d) => (dumpStderr += d.toString()));

    const outStream = createWriteStream(tmpFile);
    // Write IV at the start of the file so we can decrypt later
    outStream.write(iv);

    await pipeline(pgDump.stdout, createGzip(), cipher, outStream);

    const dumpExit: number = await new Promise((resolve) => pgDump.on('close', resolve));
    if (dumpExit !== 0) {
      throw new Error(`pg_dump exited with code ${dumpExit}: ${dumpStderr}`);
    }

    // Append GCM auth tag
    const authTag = cipher.getAuthTag();
    await fsp.appendFile(tmpFile, authTag);

    const fileStat = await fsp.stat(tmpFile);

    // Compute SHA-256 checksum for integrity verification
    const sha256 = await fileSha256(tmpFile);

    backupLogger.info(
      {
        timestamp,
        sizeBytes: fileStat.size,
        sha256,
        stats,
      },
      'Encrypted backup created'
    );

    // 3) Upload to S3 with SSE
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

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: createReadStream(tmpFile),
        ContentType: 'application/octet-stream',
        ServerSideEncryption: 'AES256',
        Metadata: {
          'sha256': sha256,
          'encryption': 'aes-256-gcm',
          'timestamp': timestamp,
          'companies': String(stats.total_companies),
          'users': String(stats.total_users),
          'patients': String(stats.total_patients),
          'db-size-bytes': String(stats.db_size_bytes),
        },
      })
    );

    // Upload plaintext manifest alongside the backup (easy audit)
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `backups/db-backup-${timestamp}.manifest.json`,
        Body: JSON.stringify(
          {
            timestamp,
            key,
            sizeBytes: fileStat.size,
            sha256,
            encryption: 'aes-256-gcm',
            stats,
          },
          null,
          2
        ),
        ContentType: 'application/json',
        ServerSideEncryption: 'AES256',
      })
    );

    backupLogger.info({ bucket, key, sizeBytes: fileStat.size }, 'Backup uploaded to S3');
  } catch (err) {
    backupLogger.error({ err }, 'Automated backup FAILED');
  } finally {
    // Always clean up the local temp file
    fsp.unlink(tmpFile).catch(() => undefined);
  }
}

async function fileSha256(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(filePath), hash as any);
  return hash.digest('hex');
}

/**
 * Delete S3 backup objects older than BACKUP_RETENTION_DAYS (default 30).
 */
async function enforceRetention() {
  const bucket = process.env.BACKUP_S3_BUCKET;
  if (!bucket) return;

  const days = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  backupLogger.info({ days }, 'Enforcing backup retention');

  try {
    const { S3Client, ListObjectsV2Command, DeleteObjectCommand } = await import(
      '@aws-sdk/client-s3'
    );
    const s3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      },
      forcePathStyle: true,
    });

    let continuationToken: string | undefined;
    let deleted = 0;
    do {
      const list = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: 'backups/',
          ContinuationToken: continuationToken,
        })
      );

      for (const obj of list.Contents || []) {
        if (obj.LastModified && obj.LastModified.getTime() < cutoff && obj.Key) {
          await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }));
          deleted++;
        }
      }
      continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (continuationToken);

    backupLogger.info({ deleted }, 'Retention cleanup complete');
  } catch (err) {
    backupLogger.error({ err }, 'Retention cleanup failed');
  }
}
