import { Router } from 'express';
import { checkDatabaseHealth } from '../db';
import { isRedisAvailable } from '../redis';

const router = Router();

/**
 * GET /health
 * Health check endpoint - verifica status do sistema
 */
router.get('/', async (req, res) => {
  const startTime = Date.now();

  try {
    // Verificar saúde do banco de dados
    const dbHealthy = await checkDatabaseHealth();

    // Verificar saúde do Redis
    const redisHealthy = await isRedisAvailable();

    // Coletar métricas do sistema
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    const health = {
      status: dbHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      services: {
        database: {
          status: dbHealthy ? 'up' : 'down',
        },
        redis: {
          status: redisHealthy ? 'up' : 'down',
          note: redisHealthy ? null : 'Using in-memory fallback',
        },
      },
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
      },
      responseTime: Date.now() - startTime,
    };

    const statusCode = dbHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /health/ready
 * Readiness check - verifica se o sistema está pronto para receber tráfego
 */
router.get('/ready', async (req, res) => {
  try {
    const dbHealthy = await checkDatabaseHealth();

    if (dbHealthy) {
      res.status(200).json({ status: 'ready' });
    } else {
      res.status(503).json({ status: 'not ready', reason: 'Database not available' });
    }
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: String(error) });
  }
});

/**
 * GET /health/live
 * Liveness check - verifica se o processo está vivo
 */
router.get('/live', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

export default router;
