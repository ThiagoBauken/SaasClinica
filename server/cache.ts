import Redis from 'ioredis';
import { log } from './vite';
import { logger } from './logger';

// Configuração do client Redis
const redisUrl = process.env.REDIS_URL;
let redisClient: Redis | null = null;

// Cache em memória — APENAS para desenvolvimento.
// Em produção, a ausência de Redis faz o cache virar no-op (fail-open leitura, fail-closed escrita
// distribuída), evitando inconsistências entre instâncias em cluster/horizontal scaling.
const isProduction = process.env.NODE_ENV === 'production';
const ALLOW_MEMORY_FALLBACK = !isProduction;
const memoryCache: Map<string, { data: any; expiry: number }> | null =
  ALLOW_MEMORY_FALLBACK ? new Map() : null;

// Tempo padrão de cache em segundos
const DEFAULT_CACHE_TTL = 300; // 5 minutos

// Tenta conectar ao Redis sempre que houver configuração (URL ou HOST),
// independentemente do NODE_ENV. Em produção, a ausência de Redis é fatal
// para consistência multi-instância — loga aviso crítico.
const hasRedisConfig = !!(redisUrl || process.env.REDIS_HOST);
if (hasRedisConfig) {
  try {
    const connectionString =
      redisUrl ||
      `redis://${process.env.REDIS_PASSWORD ? `:${process.env.REDIS_PASSWORD}@` : ''}${process.env.REDIS_HOST}:${process.env.REDIS_PORT || '6379'}`;

    redisClient = new Redis(connectionString, {
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectionName: 'dental-app-cache',
    });

    redisClient.on('connect', () => log('Redis client conectado com sucesso'));
    redisClient.on('error', (err) => {
      logger.error({ err }, 'Error connecting to Redis');
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize Redis');
    redisClient = null;
  }
} else if (isProduction) {
  logger.error(
    'CRITICAL: REDIS_URL/REDIS_HOST not set in production — cache will be a no-op. ' +
    'Horizontal scaling is UNSAFE without Redis. Configure Redis immediately.'
  );
} else {
  log('Dev mode: Redis não configurado — usando cache em memória local');
}

/**
 * Obtém dados do cache
 * @param key Chave do cache
 * @returns Dados do cache ou null se não encontrado
 */
export async function getCache<T>(key: string): Promise<T | null> {
  // Tenta obter do Redis primeiro
  if (redisClient) {
    try {
      const cachedData = await redisClient.get(key);
      if (cachedData) {
        return JSON.parse(cachedData) as T;
      }
    } catch (error) {
      logger.error({ err: error, key }, 'Error getting Redis cache');
      // Continua para o fallback
    }
  }
  
  // Fallback em memória (apenas dev)
  if (!memoryCache) return null;
  const now = Date.now();
  const cached = memoryCache.get(key);

  if (cached && cached.expiry > now) {
    return cached.data as T;
  }

  if (cached) {
    memoryCache.delete(key);
  }

  return null;
}

/**
 * Salva dados no cache
 * @param key Chave do cache
 * @param data Dados a serem armazenados
 * @param ttl Tempo de vida em segundos (opcional)
 */
export async function setCache<T>(key: string, data: T, ttl: number = DEFAULT_CACHE_TTL): Promise<boolean> {
  const expiryTime = Date.now() + (ttl * 1000);
  
  // Tenta salvar no Redis primeiro
  if (redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(data), 'EX', ttl);
      return true;
    } catch (error) {
      logger.error({ err: error, key }, 'Error setting Redis cache');
      // Continua para o fallback
    }
  }
  
  // Fallback em memória (apenas dev) — em produção vira no-op para não
  // criar inconsistência entre instâncias
  if (!memoryCache) return false;
  try {
    memoryCache.set(key, { data, expiry: expiryTime });
    if (memoryCache.size > 10000) {
      cleanupMemoryCache();
    }
    return true;
  } catch (error) {
    logger.error({ err: error, key }, 'Error setting memory cache');
    return false;
  }
}

/**
 * Remove item do cache
 * @param key Chave do cache
 */
export async function removeCache(key: string): Promise<boolean> {
  let success = true;
  
  // Remove do Redis
  if (redisClient) {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error({ err: error, key }, 'Error removing Redis cache');
      success = false;
    }
  }
  
  // Remove do cache em memória (apenas dev)
  if (memoryCache) {
    try {
      memoryCache.delete(key);
    } catch (error) {
      logger.error({ err: error, key }, 'Error removing memory cache');
      success = false;
    }
  }

  return success;
}

/**
 * Invalida todas as chaves de cache que começam com um determinado prefixo
 * @param prefix Prefixo para invalidar
 */
export async function invalidateCacheByPrefix(prefix: string): Promise<boolean> {
  let success = true;
  
  // Invalida no Redis
  if (redisClient) {
    try {
      const keys = await redisClient.keys(`${prefix}*`);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } catch (error) {
      logger.error({ err: error, prefix }, 'Error invalidating Redis cache by prefix');
      success = false;
    }
  }
  
  // Invalida no cache em memória (apenas dev)
  try {
    if (memoryCache) {
      Array.from(memoryCache.keys()).forEach(key => {
        if (key.startsWith(prefix)) {
          memoryCache.delete(key);
        }
      });
    }
  } catch (error) {
    logger.error({ err: error, prefix }, 'Error invalidating memory cache by prefix');
    success = false;
  }
  
  return success;
}

/**
 * Limpa itens expirados do cache em memória
 */
function cleanupMemoryCache(): void {
  if (!memoryCache) return;
  const now = Date.now();
  let cleanedCount = 0;

  Array.from(memoryCache.entries()).forEach(([key, value]) => {
    if (value.expiry <= now) {
      memoryCache.delete(key);
      cleanedCount++;
    }
  });
  
  if (cleanedCount > 0) {
    log(`Limpo ${cleanedCount} itens expirados do cache em memória`);
  }
}

/**
 * Gera uma chave de cache consistente para uma rota API com parâmetros
 * @param path Caminho da API
 * @param params Parâmetros (opcionais)
 */
export function generateCacheKey(path: string, params?: Record<string, any>): string {
  let key = `api:${path}`;
  
  if (params && Object.keys(params).length > 0) {
    const sortedParams = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
    key += `:${sortedParams}`;
  }
  
  return key;
}

// Middleware para cache de rotas
export function cacheMiddleware(ttl: number = DEFAULT_CACHE_TTL) {
  return async (req: any, res: any, next: any) => {
    // Não cachear em métodos que não sejam GET ou se não temos Redis
    if (req.method !== 'GET' || !redisClient) {
      return next();
    }
    
    // Não cachear para usuários não autenticados, pois pode expor dados
    if (!req.isAuthenticated()) {
      return next();
    }
    
    const cacheKey = generateCacheKey(req.originalUrl, {
      userId: req.user?.id
    });
    
    try {
      const cachedData = await getCache(cacheKey);
      
      if (cachedData) {
        return res.json(cachedData);
      }
      
      // Armazena a função json original
      const originalJson = res.json;
      
      // Sobrescreve a função json
      res.json = function(data: any) {
        // Restaura o comportamento original
        res.json = originalJson;
        
        // Armazena em cache apenas se for sucesso
        if (res.statusCode >= 200 && res.statusCode < 300) {
          setCache(cacheKey, data, ttl).catch(err => logger.error({ err }, 'Cache error'))
        }
        
        // Continua com o comportamento normal
        return originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      logger.error({ err: error }, 'Cache middleware error');
      next();
    }
  };
}

/**
 * Get-or-compute with distributed mutex to prevent thundering herd.
 * Only one caller computes on cache miss; others wait and read.
 */
const inflightRequests = new Map<string, Promise<any>>();

export async function getCacheOrCompute<T>(
  key: string,
  compute: () => Promise<T>,
  ttl: number = DEFAULT_CACHE_TTL
): Promise<T> {
  // Check cache first
  const cached = await getCache<T>(key);
  if (cached !== null) return cached;

  // Coalesce in-flight requests (same process)
  const inflight = inflightRequests.get(key);
  if (inflight) return inflight as Promise<T>;

  // Acquire distributed lock if Redis available
  const lockKey = `lock:${key}`;
  let hasLock = false;

  if (redisClient) {
    try {
      const result = await redisClient.set(lockKey, '1', 'EX', 10, 'NX');
      hasLock = result === 'OK';
    } catch {
      // If lock acquisition fails, proceed without lock
      hasLock = true;
    }
  } else {
    hasLock = true; // No Redis = no contention
  }

  if (!hasLock) {
    // Another instance is computing — wait briefly then read cache
    await new Promise((r) => setTimeout(r, 150));
    const retried = await getCache<T>(key);
    if (retried !== null) return retried;
    // If still no cache, compute anyway (stale lock scenario)
  }

  const promise = compute().then(async (value) => {
    await setCache(key, value, ttl);
    inflightRequests.delete(key);
    // Release lock
    if (redisClient) {
      await redisClient.del(lockKey).catch(() => {});
    }
    return value;
  }).catch((err) => {
    inflightRequests.delete(key);
    if (redisClient) {
      redisClient.del(lockKey).catch(() => {});
    }
    throw err;
  });

  inflightRequests.set(key, promise);
  return promise;
}

export function getRedisClient(): Redis | null {
  return redisClient;
}

export default {
  getCache,
  setCache,
  removeCache,
  invalidateCacheByPrefix,
  generateCacheKey,
  cacheMiddleware,
  getCacheOrCompute,
  getRedisClient
};