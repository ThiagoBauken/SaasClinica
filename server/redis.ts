import Redis, { RedisOptions } from 'ioredis';

// Parse REDIS_URL if provided, otherwise use individual vars
function getRedisConfig(): RedisOptions {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    // Parse redis:// URL format
    try {
      const url = new URL(redisUrl);
      console.log(`[Redis] Usando REDIS_URL: ${url.host}`);
      return {
        host: url.hostname,
        port: parseInt(url.port) || 6379,
        password: url.password || undefined,
        username: url.username !== 'default' ? url.username : undefined,
        retryStrategy(times: number) {
          if (times > 3) {
            console.warn('❌ Erro no Redis: Máximo de tentativas atingido');
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
      console.error('[Redis] Erro ao parsear REDIS_URL:', e);
    }
  }

  // Fallback to individual variables
  console.log(`[Redis] Usando REDIS_HOST: ${process.env.REDIS_HOST || 'localhost'}`);
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    retryStrategy(times: number) {
      if (times > 3) {
        console.warn('❌ Erro no Redis: Máximo de tentativas atingido');
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

// Client para sessões
export const redisClient = new Redis(redisConfig);

// Client para cache (pode ser o mesmo ou separado)
export const redisCacheClient = new Redis(redisConfig);

// Silencia erros do Redis em desenvolvimento se não estiver conectado
let redisErrorLogged = false;

redisClient.on('error', (err) => {
  if (!redisErrorLogged && process.env.NODE_ENV === 'development') {
    // Em desenvolvimento, só loga o erro uma vez
    redisErrorLogged = true;
  } else if (process.env.NODE_ENV === 'production') {
    // Em produção, sempre loga para monitoramento
    console.error('Redis Client Error:', err);
  }
});

redisClient.on('connect', () => {
  console.log('✓ Redis connected for sessions');
  redisErrorLogged = false; // Reset flag quando conectar
});

redisCacheClient.on('error', () => {
  // Silencia erros do cache client, já que usamos o redisClient principal para verificação
});

redisCacheClient.on('connect', () => {
  console.log('✓ Redis connected for cache');
});

// Função para verificar se Redis está disponível
export async function isRedisAvailable(): Promise<boolean> {
  try {
    // Verifica se já está conectado
    if (redisClient.status === 'ready') {
      return true;
    }

    // Só conecta se não estiver conectado
    if (redisClient.status === 'wait' || redisClient.status === 'close') {
      await redisClient.connect();
    }

    // Aguarda conexão se estiver conectando
    if (redisClient.status === 'connecting') {
      await new Promise((resolve) => {
        redisClient.once('ready', resolve);
        redisClient.once('error', resolve);
      });
    }

    // Testa a conexão
    if (redisClient.status === 'ready') {
      await redisClient.ping();
      return true;
    }

    return false;
  } catch (error) {
    console.warn('Redis not available, falling back to memory store');
    return false;
  }
}

// Graceful shutdown
export async function closeRedisConnections() {
  await Promise.all([
    redisClient.quit(),
    redisCacheClient.quit()
  ]);
  console.log('✓ Redis connections closed');
}
