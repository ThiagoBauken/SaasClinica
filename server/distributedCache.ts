import { Cluster } from 'ioredis';
import { log } from './vite';

interface CacheConfig {
  ttl: number;
  compress: boolean;
  serialize: boolean;
}

class DistributedCache {
  private cluster: Cluster | null = null;
  private localCache = new Map<string, { data: any; expiry: number; hits: number }>();
  private readonly maxLocalCacheSize = 1000;
  private readonly defaultTTL = 300; // 5 minutes

  constructor() {
    this.initializeCluster();
    this.startCacheCleanup();
  }

  private initializeCluster() {
    const redisNodes = process.env.REDIS_CLUSTER_NODES;
    
    if (redisNodes && process.env.NODE_ENV === 'production') {
      try {
        const nodes = redisNodes.split(',').map(node => {
          const [host, port] = node.trim().split(':');
          return { host, port: parseInt(port) || 6379 };
        });

        this.cluster = new Cluster(nodes, {
          redisOptions: {
            password: process.env.REDIS_PASSWORD,
            maxRetriesPerRequest: 3
          },
          scaleReads: 'slave',
          enableOfflineQueue: false,
          retryDelayOnFailover: 100
        });

        this.cluster.on('connect', () => {
          log('Redis cluster connected successfully');
        });

        this.cluster.on('error', (err) => {
          console.error('Redis cluster error:', err);
          log('Falling back to local cache');
        });

      } catch (error) {
        console.error('Failed to initialize Redis cluster:', error);
        this.cluster = null;
      }
    } else {
      log('Using local cache only (development mode)');
    }
  }

  private generateKey(companyId: number, resource: string, id?: string): string {
    const baseKey = `c:${companyId}:${resource}`;
    return id ? `${baseKey}:${id}` : baseKey;
  }

  private async setLocal(key: string, data: any, ttl: number) {
    // Remove oldest entries if cache is full
    if (this.localCache.size >= this.maxLocalCacheSize) {
      const oldestKey = this.localCache.keys().next().value;
      if (oldestKey) {
        this.localCache.delete(oldestKey);
      }
    }

    this.localCache.set(key, {
      data,
      expiry: Date.now() + (ttl * 1000),
      hits: 0
    });
  }

  private getLocal(key: string): any | null {
    const cached = this.localCache.get(key);
    
    if (!cached) return null;
    
    if (Date.now() > cached.expiry) {
      this.localCache.delete(key);
      return null;
    }

    cached.hits++;
    return cached.data;
  }

  async get<T>(companyId: number, resource: string, id?: string): Promise<T | null> {
    const key = this.generateKey(companyId, resource, id);
    
    // Try L1 cache first (local memory)
    const localValue = this.getLocal(key);
    if (localValue !== null) {
      return localValue as T;
    }

    // Try L2 cache (Redis cluster)
    if (this.cluster) {
      try {
        const clusterValue = await this.cluster.get(key);
        if (clusterValue) {
          const parsed = JSON.parse(clusterValue);
          // Populate L1 cache for future requests
          this.setLocal(key, parsed, this.defaultTTL);
          return parsed as T;
        }
      } catch (error) {
        console.error('Redis get error:', error);
      }
    }

    return null;
  }

  async set<T>(
    companyId: number, 
    resource: string, 
    data: T, 
    options: Partial<CacheConfig> = {},
    id?: string
  ): Promise<boolean> {
    const key = this.generateKey(companyId, resource, id);
    const ttl = options.ttl || this.defaultTTL;
    
    try {
      // Set in L1 cache
      this.setLocal(key, data, ttl);

      // Set in L2 cache (Redis cluster)
      if (this.cluster) {
        const serialized = JSON.stringify(data);
        await this.cluster.setex(key, ttl, serialized);
        
        // Invalidate across cluster for consistency
        await this.invalidatePattern(companyId, resource);
      }

      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  async invalidate(companyId: number, resource: string, id?: string): Promise<boolean> {
    const key = this.generateKey(companyId, resource, id);
    
    try {
      // Remove from L1 cache
      this.localCache.delete(key);

      // Remove from L2 cache
      if (this.cluster) {
        await this.cluster.del(key);
      }

      return true;
    } catch (error) {
      console.error('Cache invalidation error:', error);
      return false;
    }
  }

  async invalidatePattern(companyId: number, pattern: string): Promise<boolean> {
    const keyPattern = this.generateKey(companyId, pattern) + '*';
    
    try {
      // Clear matching keys from L1 cache
      for (const key of this.localCache.keys()) {
        if (key.startsWith(keyPattern.replace('*', ''))) {
          this.localCache.delete(key);
        }
      }

      // Clear from Redis cluster
      if (this.cluster) {
        const keys = await this.cluster.keys(keyPattern);
        if (keys.length > 0) {
          await this.cluster.del(...keys);
        }
      }

      return true;
    } catch (error) {
      console.error('Pattern invalidation error:', error);
      return false;
    }
  }

  private startCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.localCache.entries()) {
        if (now > value.expiry) {
          this.localCache.delete(key);
        }
      }
    }, 60000); // Clean every minute
  }

  // Utility methods for common cache patterns
  async cacheQuery<T>(
    companyId: number,
    resource: string,
    queryFn: () => Promise<T>,
    ttl: number = this.defaultTTL
  ): Promise<T> {
    const cached = await this.get<T>(companyId, resource);
    
    if (cached !== null) {
      return cached;
    }

    const result = await queryFn();
    await this.set(companyId, resource, result, { ttl });
    
    return result;
  }

  getStats() {
    const localStats = {
      size: this.localCache.size,
      hitRatio: this.calculateHitRatio(),
      maxSize: this.maxLocalCacheSize
    };

    return {
      local: localStats,
      cluster: this.cluster ? 'connected' : 'disconnected'
    };
  }

  private calculateHitRatio(): number {
    let totalHits = 0;
    let totalEntries = 0;

    for (const value of this.localCache.values()) {
      totalHits += value.hits;
      totalEntries++;
    }

    return totalEntries > 0 ? totalHits / totalEntries : 0;
  }
}

export const distributedCache = new DistributedCache();

// Middleware for automatic caching
export function cacheMiddleware(resource: string, ttl: number = 300) {
  return async (req: any, res: any, next: any) => {
    const companyId = req.user?.companyId;
    
    if (!companyId) {
      return next();
    }

    const cacheKey = `${req.method}:${req.path}:${JSON.stringify(req.query)}`;
    const cached = await distributedCache.get(companyId, resource, cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = function(data: any) {
      distributedCache.set(companyId, resource, data, { ttl }, cacheKey);
      return originalJson.call(this, data);
    };

    next();
  };
}