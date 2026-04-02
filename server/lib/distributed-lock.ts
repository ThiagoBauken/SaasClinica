/**
 * Distributed Lock using Redis
 * Prevents duplicate cron job execution across multiple instances.
 * Uses Redis SET NX EX for atomic lock acquisition.
 */
import { redisClient } from '../redis';
import { logger } from '../logger';

const lockLogger = logger.child({ module: 'distributed-lock' });

/**
 * Acquire a distributed lock using Redis SET NX EX.
 * Returns true if lock was acquired, false if another instance holds it.
 */
export async function acquireLock(
  lockName: string,
  ttlSeconds: number = 60
): Promise<boolean> {
  try {
    if (redisClient.status !== 'ready') {
      lockLogger.warn({ lockName }, 'Redis not ready, skipping lock acquisition');
      return false;
    }

    const lockKey = `lock:${lockName}`;
    const lockValue = `${process.pid}:${Date.now()}`;

    // SET key value NX EX ttl — atomic acquire
    const result = await redisClient.set(lockKey, lockValue, 'EX', ttlSeconds, 'NX');
    const acquired = result === 'OK';

    if (acquired) {
      lockLogger.debug({ lockName, ttlSeconds }, 'Lock acquired');
    } else {
      lockLogger.debug({ lockName }, 'Lock already held by another instance');
    }

    return acquired;
  } catch (error) {
    lockLogger.error({ err: error, lockName }, 'Failed to acquire lock');
    return false;
  }
}

/**
 * Release a distributed lock.
 */
export async function releaseLock(lockName: string): Promise<void> {
  try {
    if (redisClient.status !== 'ready') return;
    await redisClient.del(`lock:${lockName}`);
    lockLogger.debug({ lockName }, 'Lock released');
  } catch (error) {
    lockLogger.error({ err: error, lockName }, 'Failed to release lock');
  }
}

/**
 * Execute a function only if the distributed lock can be acquired.
 * Ensures only one instance in the cluster runs the job.
 *
 * @param lockName - Unique name for the lock (e.g. 'cron:billing-dunning')
 * @param fn - The function to execute
 * @param ttlSeconds - Lock TTL in seconds (should be > expected job duration)
 */
export async function withDistributedLock(
  lockName: string,
  fn: () => Promise<void>,
  ttlSeconds: number = 120
): Promise<boolean> {
  const acquired = await acquireLock(lockName, ttlSeconds);
  if (!acquired) return false;

  try {
    await fn();
  } finally {
    await releaseLock(lockName);
  }

  return true;
}
