import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

/**
 * Configuração centralizada para BullMQ e Redis
 */

// Verificar se Redis deve ser habilitado
const isRedisEnabled = process.env.REDIS_HOST &&
                       process.env.REDIS_HOST !== '' &&
                       !process.env.DISABLE_REDIS;

// Configuração do Redis
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true, // Não conecta automaticamente
};

// Cliente Redis compartilhado (só cria se Redis estiver habilitado)
export const redisConnection = isRedisEnabled ? new Redis(redisConfig) : null;

// Health check do Redis (só se estiver habilitado)
if (redisConnection) {
  redisConnection.on('connect', () => {
    console.log('✅ Redis conectado para filas');
  });

  redisConnection.on('error', (err) => {
    console.error('❌ Erro no Redis (filas):', err.message);
  });
}

// Nomes das filas
export const QueueNames = {
  AUTOMATIONS: 'automations',
  NOTIFICATIONS: 'notifications',
  EMAILS: 'emails',
  WHATSAPP: 'whatsapp',
  REPORTS: 'reports',
} as const;

/**
 * Factory para criar filas
 */
export function createQueue(queueName: string) {
  if (!redisConnection) {
    throw new Error('Redis não está configurado. Configure REDIS_HOST no .env para usar filas.');
  }

  return new Queue(queueName, {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 24 * 3600, // Manter por 24h
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // Manter por 7 dias
      },
    },
  });
}

/**
 * Factory para criar workers
 */
export function createWorker(
  queueName: string,
  processor: (job: any) => Promise<any>,
  concurrency = 5
) {
  if (!redisConnection) {
    throw new Error('Redis não está configurado. Configure REDIS_HOST no .env para usar workers.');
  }

  return new Worker(queueName, processor, {
    connection: redisConnection,
    concurrency,
  });
}

/**
 * Factory para criar event listeners
 */
export function createQueueEvents(queueName: string) {
  if (!redisConnection) {
    throw new Error('Redis não está configurado. Configure REDIS_HOST no .env para usar queue events.');
  }

  return new QueueEvents(queueName, {
    connection: redisConnection,
  });
}

/**
 * Health check de todas as filas
 */
export async function checkQueuesHealth() {
  try {
    if (!redisConnection) {
      return {
        status: 'disabled',
        redis: 'not configured',
        message: 'Redis is not configured',
      };
    }
    await redisConnection.ping();
    return {
      status: 'healthy',
      redis: 'connected',
      queues: Object.values(QueueNames),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      redis: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
