/**
 * Sistema de Filas e Automações
 *
 * Exporta todas as funcionalidades do sistema de filas
 */

// Configuração
export * from './config';

// Filas
export * from './queues';

// NÃO exportar workers automaticamente - eles serão carregados condicionalmente
// export * from './workers';

// Triggers
export * from './triggers';

// API
export * as queueApi from './api';

/**
 * Inicializar sistema de filas
 * Retorna false se Redis não estiver disponível
 */
export async function initializeQueueSystem() {
  try {
    // Verificar se Redis está disponível
    const redisEnabled = process.env.REDIS_HOST &&
                        process.env.REDIS_HOST !== '' &&
                        !process.env.DISABLE_REDIS;

    if (!redisEnabled) {
      console.log('⚠️  Sistema de filas desabilitado (Redis não configurado)');
      console.log('   Jobs serão processados de forma síncrona');
      return { success: false, reason: 'redis_not_configured' };
    }

    console.log('\n🚀 Inicializando sistema de filas...');

    // Importar workers (isso os inicia automaticamente)
    await import('./workers');

    console.log('✅ Sistema de filas inicializado com sucesso\n');

    return { success: true };
  } catch (error) {
    console.error('❌ Erro ao inicializar sistema de filas:', error);
    console.log('   Jobs serão processados de forma síncrona');
    return { success: false, error };
  }
}
