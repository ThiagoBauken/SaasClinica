// CRÍTICO: Carregar .env PRIMEIRO antes de tudo
import { config } from 'dotenv';
config({ override: true });

import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

console.log('[DB] Usando DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 30) + '...');

// Detectar se deve usar Neon (WebSocket) ou PostgreSQL tradicional (TCP)
const isNeonDatabase = process.env.DATABASE_URL.includes('neon.tech');

let pool: any;
let db: any;

if (isNeonDatabase) {
  console.log('[DB] Usando driver Neon (WebSocket)');
  // Usar driver Neon para bancos Neon.tech
  const { Pool: NeonPool, neonConfig } = await import('@neondatabase/serverless');
  const ws = await import('ws');
  neonConfig.webSocketConstructor = ws.default;

  const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    max: process.env.NODE_ENV === 'production' ? 100 : 10,
    min: process.env.NODE_ENV === 'production' ? 10 : 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    maxUses: 7500,
    allowExitOnIdle: false,
  };

  pool = new NeonPool(poolConfig);

  const { drizzle } = await import('drizzle-orm/neon-serverless');
  db = drizzle(pool, { schema });
} else {
  console.log('[DB] Usando driver PostgreSQL nativo (TCP)');
  // Usar driver PostgreSQL tradicional para outros bancos
  const pgModule = await import('pg');
  const PgPool = pgModule.default.Pool;
  const { drizzle } = await import('drizzle-orm/node-postgres');

  const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    max: process.env.NODE_ENV === 'production' ? 100 : 10,
    min: process.env.NODE_ENV === 'production' ? 10 : 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: false,
  };

  pool = new PgPool(poolConfig);

  db = drizzle(pool, { schema });
}

// Logging de eventos do pool para monitoramento
pool.on('connect', () => {
  console.log('✓ Nova conexão estabelecida com o banco de dados');
});

pool.on('error', (err: Error) => {
  console.error('❌ Erro inesperado no pool do banco de dados:', err.message);
  // Não lance erro aqui, deixa o pool tentar recuperar
});

pool.on('remove', () => {
  // console.log('Connection removed from pool');
});

// Health check do pool
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Graceful shutdown do pool
export async function closeDatabasePool() {
  await pool.end();
  console.log('✓ Database pool closed');
}

export { pool, db };
