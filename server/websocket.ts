import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import type { IncomingMessage } from 'http';
import type { Session } from 'express-session';
import { logger } from './logger';

const wsLogger = logger.child({ module: 'websocket' });

interface AuthenticatedSocket extends WebSocket {
  userId?: number;
  companyId?: number;
  isAlive?: boolean;
}

interface WebSocketMessage {
  type: 'appointment_created' | 'appointment_updated' | 'appointment_deleted' | 'conflict_warning' | 'reminder';
  data: any;
  timestamp: string;
}

// Mapa de conexoes por empresa para broadcast direcionado
const companyConnections = new Map<number, Set<AuthenticatedSocket>>();

let wss: WebSocketServer | null = null;

/**
 * Inicializa o WebSocket Server
 */
export function initializeWebSocket(server: Server) {
  wss = new WebSocketServer({
    server,
    path: '/ws',
  });

  wsLogger.info('WebSocket server initialized on /ws');

  wss.on('connection', (ws: AuthenticatedSocket, request: IncomingMessage) => {
    wsLogger.debug('New WebSocket connection');

    ws.isAlive = true;

    const session = (request as any).session as Session & { passport?: { user?: number } };

    if (session?.passport?.user) {
      ws.userId = session.passport.user;
    }

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === 'auth' && data.companyId) {
          ws.companyId = data.companyId;

          if (!companyConnections.has(data.companyId)) {
            companyConnections.set(data.companyId, new Set());
          }
          companyConnections.get(data.companyId)?.add(ws);

          wsLogger.debug({ companyId: data.companyId }, 'Client authenticated');

          ws.send(JSON.stringify({
            type: 'auth_success',
            message: 'Conectado ao sistema de notificações',
            timestamp: new Date().toISOString(),
          }));
        }
      } catch (error) {
        wsLogger.error({ err: error }, 'Failed to process WebSocket message');
      }
    });

    ws.on('close', () => {
      wsLogger.debug({ companyId: ws.companyId }, 'WebSocket connection closed');

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

    ws.on('error', (error) => {
      wsLogger.error({ err: error }, 'WebSocket error');
    });
  });

  // Heartbeat interval para limpar conexoes mortas
  const heartbeatInterval = setInterval(() => {
    if (!wss) return;

    wss.clients.forEach((ws: WebSocket) => {
      const socket = ws as AuthenticatedSocket;

      if (socket.isAlive === false) {
        return socket.terminate();
      }

      socket.isAlive = false;
      socket.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });
}

/**
 * Envia notificacao para todos os clientes de uma empresa
 */
export function broadcastToCompany(companyId: number, message: WebSocketMessage) {
  const connections = companyConnections.get(companyId);

  if (!connections || connections.size === 0) {
    return;
  }

  const payload = JSON.stringify({
    ...message,
    timestamp: new Date().toISOString(),
  });

  let successCount = 0;
  connections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
      successCount++;
    }
  });

  wsLogger.debug({ companyId, clients: successCount }, 'Broadcast sent');
}

/**
 * Envia notificacao de novo agendamento
 */
export function notifyAppointmentCreated(companyId: number, appointment: any) {
  broadcastToCompany(companyId, {
    type: 'appointment_created',
    data: {
      id: appointment.id,
      patientName: appointment.patientName,
      professionalName: appointment.professionalName,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      status: appointment.status,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Envia notificacao de agendamento atualizado
 */
export function notifyAppointmentUpdated(companyId: number, appointment: any) {
  broadcastToCompany(companyId, {
    type: 'appointment_updated',
    data: {
      id: appointment.id,
      patientName: appointment.patientName,
      professionalName: appointment.professionalName,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      status: appointment.status,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Envia notificacao de agendamento deletado
 */
export function notifyAppointmentDeleted(companyId: number, appointmentId: number) {
  broadcastToCompany(companyId, {
    type: 'appointment_deleted',
    data: {
      id: appointmentId,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Envia alerta de conflito
 */
export function notifyConflictWarning(companyId: number, conflictDetails: any) {
  broadcastToCompany(companyId, {
    type: 'conflict_warning',
    data: conflictDetails,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Envia lembrete de consulta proxima
 */
export function notifyReminder(companyId: number, appointment: any) {
  broadcastToCompany(companyId, {
    type: 'reminder',
    data: {
      id: appointment.id,
      patientName: appointment.patientName,
      professionalName: appointment.professionalName,
      startTime: appointment.startTime,
      minutesUntil: appointment.minutesUntil,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Retorna estatisticas das conexoes WebSocket
 */
export function getWebSocketStats() {
  if (!wss) {
    return { clients: 0, companies: 0 };
  }

  return {
    clients: wss.clients.size,
    companies: companyConnections.size,
    connectionsByCompany: Array.from(companyConnections.entries()).map(([companyId, connections]) => ({
      companyId,
      connections: connections.size,
    })),
  };
}

// Mapa de conexoes por usuario para notificacoes individuais
const userConnections = new Map<number, Set<AuthenticatedSocket>>();

/**
 * Envia notificacao para um usuario especifico
 */
export function notifyUser(userId: number, message: any) {
  const connections = userConnections.get(userId);

  if (!connections || connections.size === 0) {
    return;
  }

  const payload = JSON.stringify({
    ...message,
    timestamp: new Date().toISOString(),
  });

  connections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

/**
 * Retorna o WebSocket Server para uso externo (automacoes)
 */
export function getWebSocketServer() {
  if (!wss) {
    return null;
  }

  return {
    notifyCompany: (companyId: number, message: any) => {
      broadcastToCompany(companyId, {
        type: message.type,
        data: message.data,
        timestamp: new Date().toISOString(),
      });
    },
    notifyUser,
    getStats: getWebSocketStats,
  };
}
