import session from 'express-session';
import ConnectPgSimple from 'connect-pg-simple';
import { Pool } from '@neondatabase/serverless';
import { log } from './vite';

const PgSession = ConnectPgSimple(session);

class SessionManager {
  private sessionPool: Pool;
  private sessionStore: any;

  constructor() {
    this.initializeSessionStore();
  }

  private initializeSessionStore() {
    // Use dedicated connection pool for sessions
    const sessionUrl = process.env.DATABASE_SESSION_URL || process.env.DATABASE_URL;
    
    this.sessionPool = new Pool({
      connectionString: sessionUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.sessionStore = new PgSession({
      pool: this.sessionPool,
      tableName: 'user_sessions',
      createTableIfMissing: true,
      ttl: 24 * 60 * 60, // 24 hours
      schemaName: 'public'
    });

    log('Distributed session manager initialized');
  }

  getSessionConfig() {
    return {
      store: this.sessionStore,
      secret: process.env.SESSION_SECRET || 'dental-system-secret-key',
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        sameSite: 'lax' as const
      },
      name: 'dentcare.sid'
    };
  }

  async cleanupExpiredSessions() {
    try {
      const result = await this.sessionPool.query(
        'DELETE FROM user_sessions WHERE expire < NOW()'
      );
      log(`Cleaned up ${result.rowCount} expired sessions`);
    } catch (error) {
      console.error('Session cleanup error:', error);
    }
  }

  startSessionCleanup() {
    // Clean expired sessions every hour
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 60 * 1000);
  }

  async getSessionStats() {
    try {
      const result = await this.sessionPool.query(`
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN expire > NOW() THEN 1 END) as active_sessions,
          COUNT(CASE WHEN expire <= NOW() THEN 1 END) as expired_sessions
        FROM user_sessions
      `);
      
      return result.rows[0];
    } catch (error) {
      console.error('Session stats error:', error);
      return { total_sessions: 0, active_sessions: 0, expired_sessions: 0 };
    }
  }

  async shutdown() {
    await this.sessionPool.end();
    log('Session manager shutdown complete');
  }
}

export const sessionManager = new SessionManager();

// Start cleanup process
sessionManager.startSessionCleanup();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await sessionManager.shutdown();
});

process.on('SIGINT', async () => {
  await sessionManager.shutdown();
});