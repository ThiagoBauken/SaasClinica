/**
 * Admin endpoints to inspect and operate the BullMQ Dead Letter Queue.
 *
 * Restricted to admin/superadmin. Used for the runbook procedure when
 * a job permanently fails on a worker queue and needs manual triage
 * or replay.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { logger } from '../logger';
import { getDeadLetterQueue, replayDeadLetterJob } from '../queue/dead-letter';

const dlqLogger = logger.child({ module: 'dlq-admin' });
const router = Router();

function ensureAdmin(req: any, res: any): boolean {
  const role = req.user?.role;
  if (role !== 'admin' && role !== 'superadmin') {
    res.status(403).json({ error: 'Apenas administradores' });
    return false;
  }
  return true;
}

/**
 * GET /api/v1/admin/dlq
 * List the latest dead-letter jobs (default 50, max 200).
 */
router.get('/dlq', requireAuth, async (req, res) => {
  if (!ensureAdmin(req, res)) return;

  const dlq = getDeadLetterQueue();
  if (!dlq) {
    return res.status(503).json({ error: 'DLQ unavailable (Redis not configured)' });
  }

  const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);

  try {
    const [waiting, failed, completed, counts] = await Promise.all([
      dlq.getJobs(['waiting'], 0, limit - 1),
      dlq.getJobs(['failed'], 0, limit - 1),
      dlq.getJobs(['completed'], 0, limit - 1),
      dlq.getJobCounts(),
    ]);

    const all = [...waiting, ...failed, ...completed]
      .filter((j): j is NonNullable<typeof j> => j !== null)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, limit)
      .map((job) => ({
        id: job.id,
        name: job.name,
        timestamp: job.timestamp,
        attemptsMade: job.attemptsMade,
        data: job.data,
        failedReason: job.failedReason,
      }));

    res.json({ counts, jobs: all });
  } catch (err) {
    dlqLogger.error({ err }, 'Failed to list DLQ jobs');
    res.status(500).json({ error: 'Failed to list DLQ jobs' });
  }
});

/**
 * POST /api/v1/admin/dlq/:jobId/replay
 * Re-enqueue a dead-letter job back on its original queue.
 */
router.post('/dlq/:jobId/replay', requireAuth, async (req, res) => {
  if (!ensureAdmin(req, res)) return;

  try {
    const ok = await replayDeadLetterJob(req.params.jobId);
    if (!ok) return res.status(404).json({ error: 'DLQ job not found' });

    dlqLogger.info(
      { jobId: req.params.jobId, userId: req.user?.id },
      'DLQ job replayed by admin'
    );
    res.json({ success: true });
  } catch (err) {
    dlqLogger.error({ err, jobId: req.params.jobId }, 'Replay failed');
    res.status(500).json({ error: 'Replay failed' });
  }
});

/**
 * DELETE /api/v1/admin/dlq/:jobId
 * Permanently discard a dead-letter job.
 */
router.delete('/dlq/:jobId', requireAuth, async (req, res) => {
  if (!ensureAdmin(req, res)) return;

  const dlq = getDeadLetterQueue();
  if (!dlq) return res.status(503).json({ error: 'DLQ unavailable' });

  try {
    const job = await dlq.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'DLQ job not found' });

    await job.remove();
    dlqLogger.warn(
      { jobId: req.params.jobId, userId: req.user?.id },
      'DLQ job discarded by admin'
    );
    res.json({ success: true });
  } catch (err) {
    dlqLogger.error({ err, jobId: req.params.jobId }, 'Discard failed');
    res.status(500).json({ error: 'Discard failed' });
  }
});

export default router;
