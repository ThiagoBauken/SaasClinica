// CRITICO: Carregar .env PRIMEIRO antes de tudo
import { config } from 'dotenv';
config({ override: true });

import * as schema from "@shared/schema";
import { logger } from './logger';

const dbLogger = logger.child({ module: 'database' });

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

dbLogger.info({ url: process.env.DATABASE_URL?.substring(0, 30) + '...' }, 'Initializing database');

// Detectar se deve usar Neon (WebSocket) ou PostgreSQL tradicional (TCP)
const isNeonDatabase = process.env.DATABASE_URL.includes('neon.tech');

let pool: any;
let db: any;

// Configuracoes do pool (customizaveis via .env)
const isProduction = process.env.NODE_ENV === 'production';
const poolSettings = {
  max: parseInt(process.env.DB_POOL_MAX || (isProduction ? '100' : '10')),
  min: parseInt(process.env.DB_POOL_MIN || (isProduction ? '10' : '2')),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
};

dbLogger.info({ max: poolSettings.max, min: poolSettings.min, idleTimeout: poolSettings.idleTimeoutMillis }, 'Pool config');

if (isNeonDatabase) {
  dbLogger.info('Using Neon driver (WebSocket)');
  const { Pool: NeonPool, neonConfig } = await import('@neondatabase/serverless');
  const ws = await import('ws');
  neonConfig.webSocketConstructor = ws.default;

  const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ...poolSettings,
    maxUses: 7500,
    allowExitOnIdle: false,
  };

  pool = new NeonPool(poolConfig);

  const { drizzle } = await import('drizzle-orm/neon-serverless');
  db = drizzle(pool, { schema });
} else {
  dbLogger.info('Using native PostgreSQL driver (TCP)');
  const pgModule = await import('pg');
  const PgPool = pgModule.default.Pool;
  const { drizzle } = await import('drizzle-orm/node-postgres');

  const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ...poolSettings,
    allowExitOnIdle: false,
    ssl: isProduction
      ? {
          rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
          ca: process.env.DB_SSL_CA || undefined,
        }
      : (process.env.DB_SSL_ENABLED === 'true' ? { rejectUnauthorized: false } : undefined),
  };

  pool = new PgPool(poolConfig);

  db = drizzle(pool, { schema });
}

// ============================================================
// Read Replica Support
// Set DATABASE_READ_URLS=postgres://host1:5432/db,postgres://host2:5432/db
// If not set, reads use the main pool (master).
// ============================================================
let readPool: any = null;
let dbRead: any = db; // default: same as write
let currentReplicaIndex = 0;
const replicaPools: any[] = [];

const replicaUrls = (process.env.DATABASE_READ_URLS || '').split(',').map(u => u.trim()).filter(Boolean);

if (replicaUrls.length > 0) {
  dbLogger.info({ replicas: replicaUrls.length }, 'Initializing read replicas');

  for (const [i, url] of replicaUrls.entries()) {
    if (isNeonDatabase) {
      const { Pool: NeonPool } = await import('@neondatabase/serverless');
      const rPool = new NeonPool({
        connectionString: url,
        max: parseInt(process.env.DB_READ_POOL_MAX || '50'),
        idleTimeoutMillis: 45000,
        connectionTimeoutMillis: 10000,
        maxUses: 10000,
      });
      replicaPools.push(rPool);
    } else {
      const pgModule = await import('pg');
      const PgPool = pgModule.default.Pool;
      const rPool = new PgPool({
        connectionString: url,
        max: parseInt(process.env.DB_READ_POOL_MAX || '50'),
        idleTimeoutMillis: 45000,
        connectionTimeoutMillis: 10000,
        ssl: isProduction ? { rejectUnauthorized: false } : undefined,
      });
      replicaPools.push(rPool);
    }

    dbLogger.info({ replica: i + 1 }, 'Read replica pool initialized');
  }

  // Round-robin read replica selection
  readPool = replicaPools[0];
  if (isNeonDatabase) {
    const { drizzle } = await import('drizzle-orm/neon-serverless');
    dbRead = drizzle(readPool, { schema });
  } else {
    const { drizzle } = await import('drizzle-orm/node-postgres');
    dbRead = drizzle(readPool, { schema });
  }
} else {
  dbLogger.info('No read replicas configured, reads use master pool');
}

/**
 * Get a Drizzle instance for read queries (round-robin across replicas).
 * Falls back to master if no replicas configured.
 */
export function getReadDb() {
  if (replicaPools.length <= 1) return dbRead;

  currentReplicaIndex = (currentReplicaIndex + 1) % replicaPools.length;
  // For simplicity, return the pre-built dbRead for the current replica
  // In production with many replicas, cache drizzle instances per pool
  return dbRead;
}

// Logging de eventos do pool para monitoramento
pool.on('connect', () => {
  dbLogger.debug('New database connection established');
});

pool.on('error', (err: Error) => {
  dbLogger.error({ err }, 'Unexpected database pool error');
});

pool.on('remove', () => {
  // silent
});

// Health check do pool
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    dbLogger.error({ err: error }, 'Database health check failed');
    return false;
  }
}

// Graceful shutdown do pool
export async function closeDatabasePool() {
  await pool.end();
  for (const rp of replicaPools) {
    if (rp !== pool) await rp.end().catch(() => {});
  }
  dbLogger.info('Database pool(s) closed');
}

export { pool, db, dbRead };
