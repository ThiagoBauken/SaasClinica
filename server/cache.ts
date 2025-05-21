import Redis from 'ioredis';
import { log } from './vite';

// Configuração do client Redis
const redisUrl = process.env.REDIS_URL;
let redisClient: Redis | null = null;

// Cache em memória para desenvolvimento ou fallback
// Usando objeto simples para evitar problemas de iteração
const memoryCache: Record<string, { data: any; expiry: number }> = {};

// Tempo padrão de cache em segundos
const DEFAULT_CACHE_TTL = 300; // 5 minutos

// Só tentamos conectar ao Redis se tivermos uma URL e estivermos em produção
if (redisUrl && process.env.NODE_ENV === 'production') {
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
      log('Continuando com cache em memória como fallback');
      redisClient = null;
    });
  } catch (error) {
    console.error('Falha ao inicializar Redis:', error);
    redisClient = null;
  }
} else {
  if (process.env.NODE_ENV === 'development') {
    log('Modo de desenvolvimento: usando cache em memória');
  } else {
    log('Redis URL não configurada: usando cache em memória');
  }
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
      console.error(`Erro ao obter cache Redis para chave ${key}:`, error);
      // Continua para o fallback
    }
  }
  
  // Fallback para o cache em memória
  const now = Date.now();
  const cached = memoryCache[key];
  
  // Verifica se o cache existe e não expirou
  if (cached && cached.expiry > now) {
    return cached.data as T;
  }
  
  // Remove o cache expirado se existir
  if (cached) {
    delete memoryCache[key];
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
      console.error(`Erro ao definir cache Redis para chave ${key}:`, error);
      // Continua para o fallback
    }
  }
  
  // Fallback para o cache em memória
  try {
    memoryCache.set(key, { 
      data, 
      expiry: expiryTime 
    });
    
    // Limpeza periódica do cache em memória para evitar memory leaks
    if (memoryCache.size > 10000) { // Limita para 10.000 itens
      cleanupMemoryCache();
    }
    
    return true;
  } catch (error) {
    console.error(`Erro ao definir cache em memória para chave ${key}:`, error);
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
      console.error(`Erro ao remover cache Redis para chave ${key}:`, error);
      success = false;
    }
  }
  
  // Remove do cache em memória
  try {
    memoryCache.delete(key);
  } catch (error) {
    console.error(`Erro ao remover cache em memória para chave ${key}:`, error);
    success = false;
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
      console.error(`Erro ao invalidar cache Redis com prefixo ${prefix}:`, error);
      success = false;
    }
  }
  
  // Invalida no cache em memória
  try {
    // Usando Array.from para evitar problemas de iteração
    Array.from(memoryCache.keys()).forEach(key => {
      if (key.startsWith(prefix)) {
        memoryCache.delete(key);
      }
    });
  } catch (error) {
    console.error(`Erro ao invalidar cache em memória com prefixo ${prefix}:`, error);
    success = false;
  }
  
  return success;
}

/**
 * Limpa itens expirados do cache em memória
 */
function cleanupMemoryCache(): void {
  const now = Date.now();
  let cleanedCount = 0;
  
  // Usando Array.from para evitar problemas de iteração
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