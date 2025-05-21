import cluster from 'cluster';
import { log } from './vite';
import { memoryCache } from './simpleCache';

/**
 * Sistema de compartilhamento de cache entre workers em cluster
 * Implementa uma estratégia de broadcast para invalidação de cache entre processos
 */

// Mensagens relacionadas ao cache
interface CacheInvalidationMessage {
  type: 'CACHE_INVALIDATE';
  prefix: string;
  source: number; // ID do processo que enviou
}

// Identificador único do processo
const PROCESS_ID = process.pid;

/**
 * Inicializa o sistema de cache compartilhado entre workers
 */
export function initializeClusterCache() {
  if (cluster.isPrimary) {
    // O processo principal atua como um hub para mensagens entre workers
    log(`Inicializando sistema de cache compartilhado no master`);
    
    // Quando um worker enviar uma mensagem, encaminha para todos os outros workers
    cluster.on('message', (worker, message: CacheInvalidationMessage) => {
      if (message.type === 'CACHE_INVALIDATE') {
        // Encaminha a mensagem para todos os outros workers, exceto o remetente
        for (const id in cluster.workers) {
          const w = cluster.workers[id];
          if (w && w.id !== worker.id) {
            w.send(message);
          }
        }
      }
    });
  } else {
    // Workers escutam por mensagens de invalidação de cache
    log(`Inicializando receptor de cache no worker ${process.pid}`);
    
    process.on('message', (message: CacheInvalidationMessage) => {
      if (message.type === 'CACHE_INVALIDATE' && message.source !== PROCESS_ID) {
        const count = invalidateLocalCache(message.prefix);
        if (count > 0) {
          log(`Worker ${process.pid} invalidou ${count} itens de cache com prefixo '${message.prefix}' devido à solicitação do worker ${message.source}`);
        }
      }
    });
  }
}

/**
 * Invalida o cache local (dentro de um único worker)
 */
function invalidateLocalCache(prefix: string): number {
  return memoryCache.removeByPrefix(prefix);
}

/**
 * Invalida o cache em todos os workers
 */
export function invalidateClusterCache(prefix: string): void {
  // Primeiro invalida localmente
  const count = invalidateLocalCache(prefix);
  if (count > 0) {
    log(`Worker ${process.pid} invalidou ${count} itens de cache com prefixo '${prefix}'`);
  }
  
  // Depois envia a mensagem para os outros workers através do master
  if (process.send) {
    process.send({
      type: 'CACHE_INVALIDATE',
      prefix,
      source: PROCESS_ID
    });
  }
}