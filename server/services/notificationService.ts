import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { db } from '../db';
import { notifications } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * Serviço de Notificações em Tempo Real
 *
 * Gerencia WebSockets para enviar notificações instantâneas aos clientes conectados
 */

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  companyId?: number;
  isAlive?: boolean;
}

class NotificationService {
  private wss: WebSocketServer | null = null;
  private clients: Map<number, Set<AuthenticatedWebSocket>> = new Map(); // userId -> Set of WebSockets

  /**
   * Inicializa o WebSocket server
   */
  initialize(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws/notifications'
    });

    this.wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
      console.log('Nova conexão WebSocket recebida');

      // Autenticação via query params ou cookie
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const userId = url.searchParams.get('userId');
      const companyId = url.searchParams.get('companyId');

      if (!userId || !companyId) {
        console.log('WebSocket rejeitado: falta userId ou companyId');
        ws.close(1008, 'Unauthorized - Missing credentials');
        return;
      }

      ws.userId = parseInt(userId);
      ws.companyId = parseInt(companyId);
      ws.isAlive = true;

      // Adicionar cliente à lista
      if (!this.clients.has(ws.userId)) {
        this.clients.set(ws.userId, new Set());
      }
      this.clients.get(ws.userId)!.add(ws);

      console.log(`Cliente conectado: userId=${ws.userId}, companyId=${ws.companyId}`);

      // Enviar notificações não lidas ao conectar
      this.sendUnreadNotifications(ws.userId, ws.companyId, ws);

      // Ping/Pong para manter conexão viva
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Mensagens do cliente
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
        } catch (error) {
          console.error('Erro ao processar mensagem do cliente:', error);
        }
      });

      // Desconexão
      ws.on('close', () => {
        console.log(`Cliente desconectado: userId=${ws.userId}`);
        if (ws.userId) {
          const userClients = this.clients.get(ws.userId);
          if (userClients) {
            userClients.delete(ws);
            if (userClients.size === 0) {
              this.clients.delete(ws.userId);
            }
          }
        }
      });

      // Erro
      ws.on('error', (error) => {
        console.error('Erro no WebSocket:', error);
      });
    });

    // Heartbeat para detectar conexões mortas
    const heartbeatInterval = setInterval(() => {
      this.wss?.clients.forEach((ws: WebSocket) => {
        const authWs = ws as AuthenticatedWebSocket;
        if (authWs.isAlive === false) {
          console.log(`Terminando conexão inativa: userId=${authWs.userId}`);
          return authWs.terminate();
        }
        authWs.isAlive = false;
        authWs.ping();
      });
    }, 30000); // 30 segundos

    this.wss.on('close', () => {
      clearInterval(heartbeatInterval);
    });

    console.log('✓ WebSocket Server initialized at /ws/notifications');
  }

  /**
   * Envia notificações não lidas ao conectar
   */
  private async sendUnreadNotifications(userId: number, companyId: number, ws: AuthenticatedWebSocket) {
    try {
      const unreadNotifications = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.companyId, companyId),
            eq(notifications.isRead, false)
          )
        )
        .orderBy(desc(notifications.createdAt))
        .limit(50);

      if (unreadNotifications.length > 0) {
        ws.send(JSON.stringify({
          type: 'initial_notifications',
          notifications: unreadNotifications,
          count: unreadNotifications.length
        }));
      }
    } catch (error) {
      console.error('Erro ao buscar notificações não lidas:', error);
    }
  }

  /**
   * Processa mensagens do cliente
   */
  private handleClientMessage(ws: AuthenticatedWebSocket, message: any) {
    switch (message.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;

      case 'mark_read':
        if (message.notificationId && ws.userId) {
          this.markAsRead(message.notificationId, ws.userId);
        }
        break;

      case 'subscribe':
        // Cliente pode se inscrever em eventos específicos
        console.log(`Cliente ${ws.userId} inscrito em: ${message.topics}`);
        break;

      default:
        console.log('Tipo de mensagem desconhecido:', message.type);
    }
  }

  /**
   * Marca notificação como lida
   */
  async markAsRead(notificationId: number, userId: number): Promise<void> {
    try {
      await db
        .update(notifications)
        .set({
          isRead: true,
          readAt: new Date()
        })
        .where(
          and(
            eq(notifications.id, notificationId),
            eq(notifications.userId, userId)
          )
        );
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  }

  /**
   * Cria e envia uma nova notificação
   */
  async createAndSend(notificationData: {
    companyId: number;
    userId: number | number[]; // Pode ser um usuário ou lista de usuários
    type: string;
    title: string;
    message: string;
    relatedResource?: string;
    relatedResourceId?: number;
    actionUrl?: string;
    priority?: string;
    metadata?: Record<string, any>;
    expiresAt?: Date;
  }): Promise<void> {
    try {
      const userIds = Array.isArray(notificationData.userId)
        ? notificationData.userId
        : [notificationData.userId];

      // Criar notificação para cada usuário
      for (const userId of userIds) {
        const [notification] = await db
          .insert(notifications)
          .values({
            companyId: notificationData.companyId,
            userId,
            type: notificationData.type,
            title: notificationData.title,
            message: notificationData.message,
            relatedResource: notificationData.relatedResource,
            relatedResourceId: notificationData.relatedResourceId,
            actionUrl: notificationData.actionUrl,
            priority: notificationData.priority || 'normal',
            metadata: notificationData.metadata,
            expiresAt: notificationData.expiresAt,
          })
          .returning();

        // Enviar via WebSocket se o usuário estiver conectado
        this.sendToUser(userId, {
          type: 'new_notification',
          notification
        });
      }
    } catch (error) {
      console.error('Erro ao criar e enviar notificação:', error);
      throw error;
    }
  }

  /**
   * Envia mensagem para um usuário específico
   */
  sendToUser(userId: number, data: any): void {
    const userClients = this.clients.get(userId);
    if (userClients && userClients.size > 0) {
      const message = JSON.stringify(data);
      userClients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  }

  /**
   * Envia mensagem para todos os usuários de uma empresa
   */
  sendToCompany(companyId: number, data: any): void {
    const message = JSON.stringify(data);
    this.wss?.clients.forEach((ws) => {
      const authWs = ws as AuthenticatedWebSocket;
      if (authWs.companyId === companyId && authWs.readyState === WebSocket.OPEN) {
        authWs.send(message);
      }
    });
  }

  /**
   * Broadcast para todos os clientes conectados
   */
  broadcast(data: any): void {
    const message = JSON.stringify(data);
    this.wss?.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  /**
   * Retorna estatísticas do servidor WebSocket
   */
  getStats() {
    return {
      totalConnections: this.wss?.clients.size || 0,
      uniqueUsers: this.clients.size,
      clientsPerUser: Array.from(this.clients.entries()).map(([userId, clients]) => ({
        userId,
        connections: clients.size
      }))
    };
  }
}

// Singleton instance
export const notificationService = new NotificationService();
