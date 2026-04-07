import { Queue, QueueEvents } from 'bullmq';
import { redisConnection, QueueNames } from './config';
import { logger } from '../logger';
import { dlqJobs } from '../lib/metrics';

const dlqLogger = logger.child({ module: 'dlq' });

export const DLQ_NAME = 'dead-letter';

let dlq: Queue | null = null;

/**
 * Get (or lazily create) the Dead Letter Queue. Jobs pushed here have
 * exhausted their retries on their source queue and require manual
 * intervention. Retention is long (30 days) so we don't lose them.
 */
export function getDeadLetterQueue(): Queue | null {
  if (!redisConnection) return null;
  if (dlq) return dlq;
  dlq = new Queue(DLQ_NAME, {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: false, // keep for audit
      removeOnFail: { age: 90 * 24 * 3600 }, // 90 days
      attempts: 1, // no retries on the DLQ itself
    },
  });
  return dlq;
}

interface DeadLetterPayload {
  sourceQueue: string;
  originalJobId: string | undefined;
  originalName: string;
  data: unknown;
  failedReason: string;
  stacktrace?: string[];
  attemptsMade: number;
  timestamp: string;
}

/**
 * Attach QueueEvents listeners to every production queue and forward
 * permanently-failed jobs to the Dead Letter Queue. Should be called
 * once at worker startup.
 */
export function attachDeadLetterHandlers() {
  if (!redisConnection) {
    dlqLogger.warn('DLQ disabled — Redis not configured');
    return;
  }

  const queues = Object.values(QueueNames);
  for (const queueName of queues) {
    const events = new QueueEvents(queueName, { connection: redisConnection });

    events.on('failed', async ({ jobId, failedReason, prev }) => {
      try {
        // Load the actual Job to check if it has exhausted its retries
        const { Queue: Q } = await import('bullmq');
        const q = new Q(queueName, { connection: redisConnection! });
        const job = await q.getJob(jobId);
        if (!job) return;

        const attemptsMade = job.attemptsMade || 0;
        const maxAttempts = job.opts?.attempts ?? 1;

        // Only forward when ALL retry attempts are exhausted
        if (attemptsMade < maxAttempts) return;

        const dlqInstance = getDeadLetterQueue();
        if (!dlqInstance) return;

        const payload: DeadLetterPayload = {
          sourceQueue: queueName,
          originalJobId: job.id,
          originalName: job.name,
          data: job.data,
          failedReason: failedReason || 'unknown',
          stacktrace: job.stacktrace,
          attemptsMade,
          timestamp: new Date().toISOString(),
        };

        await dlqInstance.add(`dlq:${queueName}:${job.name}`, payload);

        dlqLogger.error(
          { sourceQueue: queueName, jobId, failedReason, attemptsMade },
          'Job moved to dead-letter queue'
        );

        try {
          dlqJobs.inc({ queue: queueName });
        } catch {
          /* metric not yet registered — non-fatal */
        }
      } catch (err) {
        dlqLogger.error({ err, queueName, jobId }, 'Failed to forward job to DLQ');
      }
    });

    dlqLogger.info({ queueName }, 'DLQ handler attached');
  }
}

/**
 * Manual replay: take a DLQ job and re-enqueue it on its original queue.
 * Used by admin tooling / runbook procedures.
 */
export async function replayDeadLetterJob(dlqJobId: string): Promise<boolean> {
  const dlqInstance = getDeadLetterQueue();
  if (!dlqInstance || !redisConnection) return false;

  const job = await dlqInstance.getJob(dlqJobId);
  if (!job) return false;

  const payload = job.data as DeadLetterPayload;
  const { Queue: Q } = await import('bullmq');
  const target = new Q(payload.sourceQueue, { connection: redisConnection });
  await target.add(payload.originalName, payload.data);

  dlqLogger.info({ dlqJobId, sourceQueue: payload.sourceQueue }, 'DLQ job replayed');
  return true;
}
