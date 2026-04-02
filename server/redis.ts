import Redis, { RedisOptions } from 'ioredis';
import { logger } from './logger';

const redisLogger = logger.child({ module: 'redis' });

// Parse REDIS_URL if provided, otherwise use individual vars
function getRedisConfig(): RedisOptions {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      const url = new URL(redisUrl);
      redisLogger.info({ host: url.host }, 'Using REDIS_URL');
      return {
        host: url.hostname,
        port: parseInt(url.port) || 6379,
        password: url.password || undefined,
        username: url.username !== 'default' ? url.username : undefined,
        retryStrategy(times: number) {
          if (times > 3) {
            redisLogger.warn('Redis max retries reached');
            return null;
          }
          return Math.min(times * 50, 2000);
        },
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
        lazyConnect: true,
        showFriendlyErrorStack: false,
      };
    } catch (e) {
      redisLogger.error({ err: e }, 'Failed to parse REDIS_URL');
    }
  }

  const host = process.env.REDIS_HOST || 'localhost';
  redisLogger.info({ host }, 'Using REDIS_HOST');
  return {
    host,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    retryStrategy(times: number) {
      if (times > 3) {
        redisLogger.warn('Redis max retries reached');
        return null;
      }
      return Math.min(times * 50, 2000);
    },
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true,
    showFriendlyErrorStack: false,
  };
}

const redisConfig = getRedisConfig();

// Client para sessoes
export const redisClient = new Redis(redisConfig);

// Client para cache (pode ser o mesmo ou separado)
export const redisCacheClient = new Redis(redisConfig);

// Silencia erros do Redis em desenvolvimento se nao estiver conectado
let redisErrorLogged = false;

redisClient.on('error', (err) => {
  if (!redisErrorLogged && process.env.NODE_ENV === 'development') {
    redisErrorLogged = true;
  } else if (process.env.NODE_ENV === 'production') {
    redisLogger.error({ err }, 'Redis client error');
  }
});

redisClient.on('connect', () => {
  redisLogger.info('Redis connected for sessions');
  redisErrorLogged = false;
});

redisCacheClient.on('error', () => {
  // Silencia erros do cache client
});

redisCacheClient.on('connect', () => {
  redisLogger.info('Redis connected for cache');
});

// Funcao para verificar se Redis esta disponivel
export async function isRedisAvailable(): Promise<boolean> {
  try {
    if ((redisClient.status as string) === 'ready') {
      return true;
    }

    if (redisClient.status === 'wait' || redisClient.status === 'close') {
      await redisClient.connect();
    }

    if (redisClient.status === 'connecting') {
      await new Promise((resolve) => {
        redisClient.once('ready', resolve);
        redisClient.once('error', resolve);
      });
    }

    if ((redisClient.status as string) === 'ready') {
      await redisClient.ping();
      return true;
    }

    return false;
  } catch (error) {
    redisLogger.warn('Redis not available, falling back to memory store');
    return false;
  }
}

// Graceful shutdown
export async function closeRedisConnections() {
  await Promise.all([
    redisClient.quit(),
    redisCacheClient.quit()
  ]);
  redisLogger.info('Redis connections closed');
}
