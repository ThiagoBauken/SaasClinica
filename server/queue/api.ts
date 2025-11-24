import { Request, Response } from 'express';
import { automationsQueue, emailsQueue, whatsappQueue, reportsQueue } from './queues';
import { checkQueuesHealth } from './config';

/**
 * APIs para monitoramento e gerenciamento das filas
 */

/**
 * GET /api/queue/health
 * Verifica saúde das filas e Redis
 */
export async function getQueueHealth(req: Request, res: Response) {
  try {
    const health = await checkQueuesHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/queue/stats
 * Retorna estatísticas de todas as filas
 */
export async function getQueueStats(req: Request, res: Response) {
  try {
    const [
      automationsStats,
      emailsStats,
      whatsappStats,
      reportsStats,
    ] = await Promise.all([
      getQueueInfo(automationsQueue),
      getQueueInfo(emailsQueue),
      getQueueInfo(whatsappQueue),
      getQueueInfo(reportsQueue),
    ]);

    res.json({
      automations: automationsStats,
      emails: emailsStats,
      whatsapp: whatsappStats,
      reports: reportsStats,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/queue/:queueName/jobs
 * Lista jobs de uma fila específica
 */
export async function getQueueJobs(req: Request, res: Response) {
  try {
    const { queueName } = req.params;
    const { status = 'waiting', limit = 50 } = req.query;

    const queue = getQueueByName(queueName);
    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    const jobs = await queue.getJobs(status as any, 0, parseInt(limit as string));

    res.json({
      queue: queueName,
      status,
      count: jobs.length,
      jobs: jobs.map(job => ({
        id: job.id,
        name: job.name,
        data: job.data,
        progress: job.progress,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
      })),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/queue/:queueName/retry/:jobId
 * Retry de um job específico
 */
export async function retryJob(req: Request, res: Response) {
  try {
    const { queueName, jobId } = req.params;

    const queue = getQueueByName(queueName);
    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    await job.retry();

    res.json({
      success: true,
      message: 'Job retried successfully',
      jobId,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/queue/:queueName/clean
 * Limpa jobs completados de uma fila
 */
export async function cleanQueue(req: Request, res: Response) {
  try {
    const { queueName } = req.params;
    const { status = 'completed', grace = 0 } = req.body;

    const queue = getQueueByName(queueName);
    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    await queue.clean(parseInt(grace as string), 1000, status);

    res.json({
      success: true,
      message: `Queue ${queueName} cleaned`,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Helpers
 */

async function getQueueInfo(queue: any) {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  };
}

function getQueueByName(name: string) {
  switch (name) {
    case 'automations':
      return automationsQueue;
    case 'emails':
      return emailsQueue;
    case 'whatsapp':
      return whatsappQueue;
    case 'reports':
      return reportsQueue;
    default:
      return null;
  }
}
