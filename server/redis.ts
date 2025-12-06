import Redis from 'ioredis';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy(times: number) {
    // Limita tentativas de reconexão
    if (times > 3) {
      console.warn('❌ Erro no Redis: Máximo de tentativas atingido');
      return null; // Para de tentar reconectar
    }
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 1,
  enableReadyCheck: false,
  lazyConnect: true, // Não conecta automaticamente
  showFriendlyErrorStack: false,
};

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
    await redisClient.connect();
    await redisClient.ping();
    return true;
  } catch (error) {
    console.warn('Redis not available, falling back to memory store');
    // Desconecta para evitar tentativas de reconexão
    try {
      await redisClient.disconnect();
    } catch (e) {
      // Ignora erros ao desconectar
    }
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
