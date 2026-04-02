/**
 * Sistema de Filas e Automacoes
 *
 * Exporta todas as funcionalidades do sistema de filas
 */
import { logger } from '../logger';

const queueLogger = logger.child({ module: 'queue-system' });

// Configuracao
export * from './config';

// Filas
export * from './queues';

// NAO exportar workers automaticamente - eles serao carregados condicionalmente
// export * from './workers';

// Triggers
export * from './triggers';

// API
export * as queueApi from './api';

/**
 * Inicializar sistema de filas
 * Retorna false se Redis nao estiver disponivel
 */
export async function initializeQueueSystem() {
  try {
    const redisEnabled = process.env.REDIS_HOST &&
                        process.env.REDIS_HOST !== '' &&
                        !process.env.DISABLE_REDIS;

    if (!redisEnabled) {
      queueLogger.warn('Queue system disabled (Redis not configured). Jobs will be processed synchronously');
      return { success: false, reason: 'redis_not_configured' };
    }

    queueLogger.info('Initializing queue system');

    // Importar workers (isso os inicia automaticamente)
    await import('./workers');

    queueLogger.info('Queue system initialized successfully');

    return { success: true };
  } catch (error) {
    queueLogger.error({ err: error }, 'Failed to initialize queue system. Jobs will be processed synchronously');
    return { success: false, error };
  }
}
