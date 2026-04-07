/**
 * Signature Expiration Job
 * Marks digital signatures whose expires_at timestamp has passed as 'expired'.
 * Should be scheduled via billing-cron.ts (recommended: once daily).
 */

import { logger } from '../logger';

const sigLogger = logger.child({ module: 'signature-expiration' });

/**
 * Query the digital_signatures table and flip status to 'expired' for all
 * valid signatures whose expires_at is in the past.
 */
export async function checkExpiredSignatures(): Promise<void> {
  sigLogger.info('Checking for expired digital signatures');

  let db: any;
  try {
    ({ db } = await import('../db'));
  } catch {
    const mod = await import('../db');
    db = (mod as any).db;
  }

  if (!db) {
    sigLogger.error('Could not import db — aborting signature expiration check');
    return;
  }

  try {
    const result = await db.$client.query(`
      UPDATE digital_signatures
      SET status = 'expired',
          updated_at = NOW()
      WHERE status = 'valid'
        AND expires_at IS NOT NULL
        AND expires_at < NOW()
    `);

    const affected: number = result.rowCount ?? 0;

    if (affected > 0) {
      sigLogger.info({ count: affected }, 'Digital signatures marked as expired');
    } else {
      sigLogger.debug('No expired signatures found');
    }
  } catch (err) {
    sigLogger.error({ err }, 'Error checking expired signatures');
  }
}
