import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from "@shared/schema";
import { log } from './vite';

interface DatabaseConfig {
  connectionString: string;
  maxConnections: number;
  role: 'master' | 'replica';
  weight: number;
}

class DistributedDatabase {
  private masterPool!: Pool;
  private readPools: Pool[] = [];
  private currentReadIndex = 0;

  constructor() {
    this.initializePools();
  }

  private initializePools() {
    // Master database for writes
    const masterUrl = process.env.DATABASE_WRITE_URL || process.env.DATABASE_URL;
    if (!masterUrl) {
      throw new Error('Master database URL is required');
    }

    this.masterPool = new Pool({
      connectionString: masterUrl,
      max: process.env.NODE_ENV === 'production' ? 30 : 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      maxUses: 7500
    });

    log('Master database pool initialized');

    // Read replica pools
    const replicaUrls = process.env.DATABASE_READ_URLS?.split(',') || [];
    
    for (const [index, url] of replicaUrls.entries()) {
      if (url.trim()) {
        const readPool = new Pool({
          connectionString: url.trim(),
          max: process.env.NODE_ENV === 'production' ? 50 : 15,
          idleTimeoutMillis: 45000,
          connectionTimeoutMillis: 5000,
          maxUses: 10000
        });
        
        this.readPools.push(readPool);
        log(`Read replica ${index + 1} pool initialized`);
      }
    }

    // If no replicas configured, use master for reads
    if (this.readPools.length === 0) {
      this.readPools.push(this.masterPool);
      log('No read replicas configured, using master for reads');
    }
  }

  // Get connection for write operations (always master)
  getWriteConnection() {
    return drizzle(this.masterPool, { schema });
  }

  // Get connection for read operations (round-robin replicas)
  getReadConnection() {
    const pool = this.readPools[this.currentReadIndex];
    this.currentReadIndex = (this.currentReadIndex + 1) % this.readPools.length;
    return drizzle(pool, { schema });
  }

  // Get connection based on operation type
  getConnection(operation: 'read' | 'write' = 'read') {
    return operation === 'write' ? this.getWriteConnection() : this.getReadConnection();
  }

  // Company-based sharding for future scalability
  getShardedConnection(companyId: number, operation: 'read' | 'write' = 'read') {
    // For now, use single database but prepare for sharding
    const shardKey = this.getShardKey(companyId);
    
    // Future: route to different databases based on shard
    // const shardUrl = this.getShardUrl(shardKey);
    
    return this.getConnection(operation);
  }

  private getShardKey(companyId: number): number {
    // Simple modulo sharding - can be enhanced with consistent hashing
    const shardCount = parseInt(process.env.DB_SHARD_COUNT || '1');
    return companyId % shardCount;
  }

  // Health check for all connections
  async checkHealth(): Promise<{ master: boolean; replicas: boolean[] }> {
    const results = {
      master: false,
      replicas: [] as boolean[]
    };

    try {
      // Check master
      const masterDb = this.getWriteConnection();
      await masterDb.execute('SELECT 1');
      results.master = true;
    } catch (error) {
      log('Master database health check failed');
    }

    // Check replicas
    for (let i = 0; i < this.readPools.length; i++) {
      try {
        const replicaDb = drizzle(this.readPools[i], { schema });
        await replicaDb.execute('SELECT 1');
        results.replicas[i] = true;
      } catch (error) {
        log(`Read replica ${i + 1} health check failed`);
        results.replicas[i] = false;
      }
    }

    return results;
  }

  // Get database statistics
  async getStats() {
    const health = await this.checkHealth();
    
    return {
      master: {
        healthy: health.master,
        maxConnections: (this.masterPool as any).options?.max || 0,
        totalConnections: this.masterPool.totalCount,
        idleConnections: this.masterPool.idleCount,
        waitingCount: this.masterPool.waitingCount
      },
      replicas: this.readPools.map((pool, index) => ({
        index: index + 1,
        healthy: health.replicas[index],
        maxConnections: (pool as any).options?.max || 0,
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingCount: pool.waitingCount
      }))
    };
  }

  // Graceful shutdown
  async shutdown() {
    log('Shutting down database connections...');
    
    try {
      await this.masterPool.end();
      
      for (const pool of this.readPools) {
        if (pool !== this.masterPool) {
          await pool.end();
        }
      }
      
      log('Database connections closed');
    } catch (error) {
      console.error('Error during database shutdown:', error);
    }
  }
}

// Singleton instance
export const distributedDb = new DistributedDatabase();

// Helper functions for common patterns
export function withTransaction<T>(
  fn: (db: ReturnType<typeof distributedDb.getWriteConnection>) => Promise<T>
): Promise<T> {
  return fn(distributedDb.getWriteConnection());
}

export function withReadQuery<T>(
  fn: (db: ReturnType<typeof distributedDb.getReadConnection>) => Promise<T>
): Promise<T> {
  return fn(distributedDb.getReadConnection());
}

export function withCompanyQuery<T>(
  companyId: number,
  operation: 'read' | 'write',
  fn: (db: ReturnType<typeof distributedDb.getConnection>) => Promise<T>
): Promise<T> {
  return fn(distributedDb.getShardedConnection(companyId, operation));
}

// Middleware to inject appropriate DB connection
export function dbMiddleware(operation: 'read' | 'write' = 'read') {
  return (req: any, res: any, next: any) => {
    const companyId = req.user?.companyId;
    
    if (companyId) {
      req.db = distributedDb.getShardedConnection(companyId, operation);
    } else {
      req.db = distributedDb.getConnection(operation);
    }
    
    next();
  };
}

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  await distributedDb.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await distributedDb.shutdown();
  process.exit(0);
});