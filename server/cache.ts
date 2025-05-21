import Redis from 'ioredis';
import { log } from './vite';

// Configuração do client Redis
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let redisClient: Redis | null = null;

// Tempo padrão de cache em segundos
const DEFAULT_CACHE_TTL = 300; // 5 minutos

try {
  redisClient = new Redis(redisUrl, {
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    connectionName: 'dental-app-cache',
  });
  
  redisClient.on('connect', () => {
    log('Redis client conectado com sucesso');
  });
  
  redisClient.on('error', (err) => {
    console.error('Erro ao conectar com Redis:', err);
    
    // Em produção, podemos continuar sem cache
    if (process.env.NODE_ENV === 'production') {
      log('Continuando sem cache Redis');
    }
  });
} catch (error) {
  console.error('Falha ao inicializar Redis:', error);
  redisClient = null;
}

/**
 * Obtém dados do cache
 * @param key Chave do cache
 * @returns Dados do cache ou null se não encontrado
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (!redisClient) return null;
  
  try {
    const cachedData = await redisClient.get(key);
    if (!cachedData) return null;
    
    return JSON.parse(cachedData) as T;
  } catch (error) {
    console.error(`Erro ao obter cache para chave ${key}:`, error);
    return null;
  }
}

/**
 * Salva dados no cache
 * @param key Chave do cache
 * @param data Dados a serem armazenados
 * @param ttl Tempo de vida em segundos (opcional)
 */
export async function setCache<T>(key: string, data: T, ttl: number = DEFAULT_CACHE_TTL): Promise<boolean> {
  if (!redisClient) return false;
  
  try {
    await redisClient.set(key, JSON.stringify(data), 'EX', ttl);
    return true;
  } catch (error) {
    console.error(`Erro ao definir cache para chave ${key}:`, error);
    return false;
  }
}

/**
 * Remove item do cache
 * @param key Chave do cache
 */
export async function removeCache(key: string): Promise<boolean> {
  if (!redisClient) return false;
  
  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error(`Erro ao remover cache para chave ${key}:`, error);
    return false;
  }
}

/**
 * Invalida todas as chaves de cache que começam com um determinado prefixo
 * @param prefix Prefixo para invalidar
 */
export async function invalidateCacheByPrefix(prefix: string): Promise<boolean> {
  if (!redisClient) return false;
  
  try {
    const keys = await redisClient.keys(`${prefix}*`);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
    return true;
  } catch (error) {
    console.error(`Erro ao invalidar cache com prefixo ${prefix}:`, error);
    return false;
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
          setCache(cacheKey, data, ttl).catch(console.error);
        }
        
        // Continua com o comportamento normal
        return originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      console.error('Erro no middleware de cache:', error);
      next();
    }
  };
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
  getRedisClient
};