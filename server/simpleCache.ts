import { log } from './vite';

// Cache simples em memória
interface CacheItem {
  data: any;
  expiry: number;
}

class SimpleCache {
  private cache: Record<string, CacheItem> = {};
  private defaultTTL: number;
  private maxItems: number;
  private lastCleanup: number = Date.now();
  private cleanupInterval: number = 60 * 1000; // 1 minuto

  constructor(defaultTTL: number = 300, maxItems: number = 10000) {
    this.defaultTTL = defaultTTL;
    this.maxItems = maxItems;
  }

  get<T>(key: string): T | null {
    const now = Date.now();
    const item = this.cache[key];

    // Executa limpeza periódica
    if (now - this.lastCleanup > this.cleanupInterval) {
      this.cleanup();
    }

    if (!item) return null;
    
    if (item.expiry < now) {
      delete this.cache[key];
      return null;
    }

    return item.data as T;
  }

  set<T>(key: string, data: T, ttl: number = this.defaultTTL): boolean {
    try {
      this.cache[key] = {
        data,
        expiry: Date.now() + (ttl * 1000)
      };

      // Se o cache exceder o limite, força uma limpeza
      if (Object.keys(this.cache).length > this.maxItems) {
        this.cleanup();
      }

      return true;
    } catch (error) {
      console.error(`Erro ao definir cache para ${key}:`, error);
      return false;
    }
  }

  remove(key: string): boolean {
    if (this.cache[key]) {
      delete this.cache[key];
      return true;
    }
    return false;
  }

  removeByPrefix(prefix: string): number {
    let count = 0;
    Object.keys(this.cache).forEach(key => {
      if (key.startsWith(prefix)) {
        delete this.cache[key];
        count++;
      }
    });
    return count;
  }

  clear(): void {
    this.cache = {};
  }

  size(): number {
    return Object.keys(this.cache).length;
  }

  // Remove itens expirados e mantém o tamanho do cache sob controle
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    // Remover itens expirados
    Object.keys(this.cache).forEach(key => {
      if (this.cache[key].expiry < now) {
        delete this.cache[key];
        cleanedCount++;
      }
    });

    // Se ainda estiver acima do limite, remove os itens mais antigos
    let keys = Object.keys(this.cache);
    if (keys.length > this.maxItems) {
      // Ordenar pelo tempo de expiração (mais próximo de expirar primeiro)
      keys.sort((a, b) => this.cache[a].expiry - this.cache[b].expiry);
      
      // Remover os 20% mais antigos para reduzir a frequência de limpezas
      const removeCount = Math.ceil(keys.length * 0.2);
      for (let i = 0; i < removeCount && i < keys.length; i++) {
        delete this.cache[keys[i]];
        cleanedCount++;
      }
    }

    this.lastCleanup = now;
    
    if (cleanedCount > 0) {
      log(`Cache: removidos ${cleanedCount} itens expirados ou antigos`);
    }
  }
}

// Cache global
export const memoryCache = new SimpleCache();

// Middleware para cache de rotas API
export function cacheMiddleware(ttl: number = 300) {
  return async (req: any, res: any, next: any) => {
    // Não cachear em métodos que não sejam GET
    if (req.method !== 'GET') {
      return next();
    }
    
    // Não cachear para usuários não autenticados (segurança)
    if (!req.isAuthenticated()) {
      return next();
    }
    
    const cacheKey = generateCacheKey(req.originalUrl, { userId: req.user?.id });
    
    try {
      const cachedData = memoryCache.get(cacheKey);
      
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
          memoryCache.set(cacheKey, data, ttl);
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

// Função para invalidade cache por prefixo
export function invalidateCache(prefix: string): number {
  return memoryCache.removeByPrefix(prefix);
}

// Gera uma chave de cache consistente
export function generateCacheKey(path: string, params?: Record<string, any>): string {
  let key = `api:${path}`;
  
  if (params && Object.keys(params).length > 0) {
    const sortedParams = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
    key += `:${sortedParams}`;
  }
  
  return key;
}