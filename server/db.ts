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
      ? { rejectUnauthorized: false } // Set rejectUnauthorized: true if you have proper CA certs
      : undefined,
  };

  pool = new PgPool(poolConfig);

  db = drizzle(pool, { schema });
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
  dbLogger.info('Database pool closed');
}

export { pool, db };
