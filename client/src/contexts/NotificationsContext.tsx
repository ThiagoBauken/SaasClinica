import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/core/AuthProvider';
import { useToast } from '@/hooks/use-toast';

interface Notification {
  id: number;
  companyId: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  relatedResource?: string;
  relatedResourceId?: number;
  actionUrl?: string;
  priority: string;
  isRead: boolean;
  readAt?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  expiresAt?: string;
}

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  isConnected: boolean;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Fetch notificações via REST API
  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/v1/notifications?limit=50&unreadOnly=false', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.data || []);
      }
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
    }
  }, [user]);

  // Conectar ao WebSocket com retry e fallback
  useEffect(() => {
    if (!user?.id || !user?.companyId) return;

    let websocket: WebSocket | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 3;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let pingInterval: NodeJS.Timeout | null = null;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws/notifications?userId=${user.id}&companyId=${user.companyId}`;

      console.log('Conectando ao WebSocket:', wsUrl);

      try {
        websocket = new WebSocket(wsUrl);
      } catch (error) {
        console.error('Erro ao criar WebSocket:', error);
        setIsConnected(false);
        return;
      }

      websocket.onopen = () => {
        console.log('WebSocket conectado');
        setIsConnected(true);
        reconnectAttempts = 0; // Reset retry count on successful connection
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Mensagem WebSocket recebida:', data);

          switch (data.type) {
            case 'initial_notifications':
              setNotifications(data.notifications || []);
              break;

            case 'new_notification':
              const newNotification = data.notification;
              setNotifications(prev => [newNotification, ...prev]);

              // Mostrar toast para notificações de alta prioridade
              if (newNotification.priority === 'high' || newNotification.priority === 'urgent') {
                toast({
                  title: newNotification.title,
                  description: newNotification.message,
                  variant: newNotification.priority === 'urgent' ? 'destructive' : 'default',
                });
              }
              break;

            case 'pong':
              // Resposta ao ping
              break;

            default:
              console.log('Tipo de mensagem desconhecido:', data.type);
          }
        } catch (error) {
          console.error('Erro ao processar mensagem WebSocket:', error);
        }
      };

      websocket.onerror = (error) => {
        console.warn('Erro no WebSocket (modo REST fallback ativado):', error);
        setIsConnected(false);
      };

      websocket.onclose = () => {
        console.log('WebSocket desconectado');
        setIsConnected(false);

        // Tentar reconectar se não excedeu o limite
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000); // Exponential backoff
          console.log(`Tentando reconectar em ${delay}ms (tentativa ${reconnectAttempts}/${maxReconnectAttempts})`);
          reconnectTimeout = setTimeout(connect, delay);
        } else {
          console.log('WebSocket: limite de reconexões atingido, usando REST API');
        }
      };

      setWs(websocket);

      // Heartbeat
      pingInterval = setInterval(() => {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
          websocket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000); // 25 segundos
    };

    connect();

    // Cleanup
    return () => {
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (websocket) websocket.close();
    };
  }, [user, toast]);

  // Fetch inicial de notificações
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Marcar notificação como lida
  const markAsRead = useCallback(async (id: number) => {
    try {
      const response = await fetch(`/api/v1/notifications/${id}/read`, {
        method: 'PATCH',
        credentials: 'include',
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
        );

        // Notificar o servidor via WebSocket
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'mark_read', notificationId: id }));
        }
      }
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  }, [ws]);

  // Marcar todas como lidas
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/notifications/mark-all-read', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
        );

        toast({
          title: 'Sucesso',
          description: 'Todas as notificações foram marcadas como lidas',
        });
      }
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao marcar notificações como lidas',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Deletar notificação
  const deleteNotification = useCallback(async (id: number) => {
    try {
      const response = await fetch(`/api/v1/notifications/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
        toast({
          title: 'Sucesso',
          description: 'Notificação removida',
        });
      }
    } catch (error) {
      console.error('Erro ao deletar notificação:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao remover notificação',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const value = {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications: fetchNotifications,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return context;
}
