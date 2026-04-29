/**
 * WebSocket Redis Adapter
 * Enables WebSocket messages to be broadcast across multiple server instances
 * using Redis Pub/Sub as the message broker.
 *
 * Without this adapter, WebSocket messages only reach clients connected
 * to the same server instance. With it, all instances receive broadcasts.
 */
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { logger } from './logger';

interface AuthenticatedSocket extends WebSocket {
  userId?: number;
  companyId?: number;
  isAlive?: boolean;
}

interface BroadcastMessage {
  type: string;
  data: any;
  companyId?: number;
  excludeUserId?: number;
  /**
   * Explicit opt-in for cross-tenant broadcasts. MUST be set to true for
   * system-wide messages (e.g. maintenance notices). If companyId is omitted
   * AND allTenants is not true, the message is rejected to prevent
   * accidental cross-tenant data leaks.
   */
  allTenants?: boolean;
  timestamp: string;
}

const CHANNEL = 'dental:ws:broadcast';

// Map of company connections (local to this instance)
const companyConnections = new Map<number, Set<AuthenticatedSocket>>();
let wss: WebSocketServer | null = null;

/**
 * Initialize WebSocket server with Redis adapter for cross-instance broadcasting
 */
export async function initializeScalableWebSocket(server: Server): Promise<void> {
  wss = new WebSocketServer({ server, path: '/ws' });
  logger.info('WebSocket Server initialized on /ws');

  // Try to setup Redis pub/sub for cross-instance communication
  let pubClient: any = null;
  let subClient: any = null;

  try {
    const { redisClient, redisCacheClient } = await import('./redis');
    const { isRedisAvailable } = await import('./redis');

    if (await isRedisAvailable()) {
      pubClient = redisClient.duplicate();
      subClient = redisCacheClient.duplicate();

      // Subscribe to broadcast channel
      await subClient.subscribe(CHANNEL);
      subClient.on('message', (channel: string, message: string) => {
        if (channel === CHANNEL) {
          try {
            const parsed: BroadcastMessage = JSON.parse(message);
            localBroadcast(parsed);
          } catch (err) {
            logger.error({ err }, 'Error parsing Redis WS message');
          }
        }
      });

      logger.info('WebSocket Redis adapter enabled (multi-instance support)');
    } else {
      logger.warn('Redis not available, WebSocket broadcasting is local-only');
    }
  } catch (err) {
    logger.warn({ err }, 'Redis adapter not available, using local-only WebSocket');
  }

  // Handle new connections
  wss.on('connection', (ws: AuthenticatedSocket, request) => {
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message.toString());

        // Auth message to register company
        if (data.type === 'auth' && data.companyId) {
          ws.companyId = data.companyId;
          ws.userId = data.userId;

          // Add to company connections map
          if (!companyConnections.has(data.companyId)) {
            companyConnections.set(data.companyId, new Set());
          }
          companyConnections.get(data.companyId)!.add(ws);

          ws.send(JSON.stringify({ type: 'auth_success', companyId: data.companyId }));
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      // Remove from company connections
      if (ws.companyId) {
        const connections = companyConnections.get(ws.companyId);
        if (connections) {
          connections.delete(ws);
          if (connections.size === 0) {
            companyConnections.delete(ws.companyId);
          }
        }
      }
    });

    ws.on('error', (err) => {
      logger.debug({ err }, 'WebSocket client error');
    });
  });

  // Heartbeat to detect dead connections
  const heartbeatInterval = setInterval(() => {
    wss?.clients.forEach((ws: WebSocket) => {
      const authWs = ws as AuthenticatedSocket;
      if (authWs.isAlive === false) {
        return ws.terminate();
      }
      authWs.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  /**
   * Broadcast to this instance's connections only.
   *
   * SECURITY: Requires either msg.companyId (tenant-scoped) or
   * msg.allTenants === true (explicit cross-tenant opt-in). Messages missing
   * both are dropped with a warning to prevent accidental cross-tenant leaks.
   */
  function localBroadcast(msg: BroadcastMessage): void {
    if (!msg.companyId && msg.allTenants !== true) {
      logger.warn(
        { type: msg.type },
        'WS broadcast rejected: missing companyId and allTenants flag',
      );
      return;
    }

    if (msg.allTenants === true) {
      // Explicit cross-tenant broadcast (maintenance notices, etc).
      wss?.clients.forEach((ws: WebSocket) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(msg));
        }
      });
      return;
    }

    // Broadcast to specific company's connections only.
    const connections = companyConnections.get(msg.companyId!);
    if (!connections) return;

    connections.forEach((ws) => {
      // Defensive: verify socket is bound to the same company before sending.
      if (
        ws.readyState === WebSocket.OPEN &&
        ws.companyId === msg.companyId &&
        ws.userId !== msg.excludeUserId
      ) {
        ws.send(JSON.stringify(msg));
      }
    });
  }

  /**
   * Export broadcast function that uses Redis if available
   */
  (globalThis as any).__wsBroadcast = async (msg: BroadcastMessage) => {
    msg.timestamp = msg.timestamp || new Date().toISOString();

    if (pubClient) {
      // Publish to Redis so all instances receive it
      await pubClient.publish(CHANNEL, JSON.stringify(msg));
    } else {
      // Local-only broadcast
      localBroadcast(msg);
    }
  };
}

/**
 * Broadcast a message to all WebSocket clients in a company
 */
export function broadcastToCompany(
  companyId: number,
  type: string,
  data: any,
  excludeUserId?: number,
): void {
  const broadcast = (globalThis as any).__wsBroadcast;
  if (broadcast) {
    broadcast({
      type,
      data,
      companyId,
      excludeUserId,
      timestamp: new Date().toISOString(),
    }).catch((err: any) => {
      logger.error({ err }, 'WebSocket broadcast error');
    });
  }
}

/**
 * Broadcast a message to all connected clients across ALL tenants.
 *
 * Use only for true system-wide events (maintenance, platform-wide notices).
 * For tenant-scoped events, use broadcastToCompany().
 */
export function broadcastToAll(type: string, data: any): void {
  const broadcast = (globalThis as any).__wsBroadcast;
  if (broadcast) {
    broadcast({
      type,
      data,
      allTenants: true,
      timestamp: new Date().toISOString(),
    }).catch((err: any) => {
      logger.error({ err }, 'WebSocket broadcast error');
    });
  }
}
