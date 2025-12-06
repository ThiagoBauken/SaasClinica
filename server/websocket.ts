import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import type { IncomingMessage } from 'http';
import type { Session } from 'express-session';

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

// Mapa de conexões por empresa para broadcast direcionado
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

  console.log('✅ WebSocket Server inicializado em /ws');

  wss.on('connection', (ws: AuthenticatedSocket, request: IncomingMessage) => {
    console.log('🔌 Nova conexão WebSocket estabelecida');

    ws.isAlive = true;

    // Extrair sessão do request para autenticação
    const session = (request as any).session as Session & { passport?: { user?: number } };

    if (session?.passport?.user) {
      ws.userId = session.passport.user;
      // Aqui você pode buscar o companyId do usuário do banco
      // Por simplicidade, vamos extrair do cookie ou header se disponível
    }

    // Heartbeat para detectar conexões mortas
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message.toString());

        // Mensagem de autenticação/registro
        if (data.type === 'auth' && data.companyId) {
          ws.companyId = data.companyId;

          // Adicionar ao mapa de conexões da empresa
          if (!companyConnections.has(data.companyId)) {
            companyConnections.set(data.companyId, new Set());
          }
          companyConnections.get(data.companyId)?.add(ws);

          console.log(`✅ Cliente autenticado - Company ID: ${data.companyId}`);

          ws.send(JSON.stringify({
            type: 'auth_success',
            message: 'Conectado ao sistema de notificações',
            timestamp: new Date().toISOString(),
          }));
        }
      } catch (error) {
        console.error('❌ Erro ao processar mensagem WebSocket:', error);
      }
    });

    ws.on('close', () => {
      console.log('🔌 Conexão WebSocket fechada');

      // Remover do mapa de conexões
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
      console.error('❌ Erro no WebSocket:', error);
    });
  });

  // Heartbeat interval para limpar conexões mortas
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
  }, 30000); // 30 segundos

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });
}

/**
 * Envia notificação para todos os clientes de uma empresa
 */
export function broadcastToCompany(companyId: number, message: WebSocketMessage) {
  const connections = companyConnections.get(companyId);

  if (!connections || connections.size === 0) {
    console.log(`ℹ️ Nenhuma conexão ativa para company ${companyId}`);
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

  console.log(`📢 Notificação enviada para ${successCount} cliente(s) da company ${companyId}`);
}

/**
 * Envia notificação de novo agendamento
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
 * Envia notificação de agendamento atualizado
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
 * Envia notificação de agendamento deletado
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
 * Envia lembrete de consulta próxima
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
 * Retorna estatísticas das conexões WebSocket
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

// Mapa de conexões por usuário para notificações individuais
const userConnections = new Map<number, Set<AuthenticatedSocket>>();

/**
 * Envia notificação para um usuário específico
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
 * Retorna o WebSocket Server para uso externo (automações)
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
