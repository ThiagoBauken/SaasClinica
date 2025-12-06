import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { useQueryClient } from '@tanstack/react-query';

export interface WebSocketMessage {
  type: 'appointment_created' | 'appointment_updated' | 'appointment_deleted' | 'conflict_warning' | 'reminder' | 'auth_success';
  data: any;
  timestamp: string;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  autoConnect?: boolean;
  showToasts?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { onMessage, autoConnect = true, showToasts = true } = options;
  const { toast } = useToast();
  const { company: currentCompany } = useCompany();
  const queryClient = useQueryClient();

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket já está conectado');
      return;
    }

    if (!currentCompany?.id) {
      console.log('Aguardando company ID para conectar WebSocket');
      return;
    }

    try {
      // Determinar protocolo correto (ws ou wss baseado em http/https)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      console.log('🔌 Conectando ao WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket conectado');
        setIsConnected(true);
        reconnectAttempts.current = 0;

        // Autenticar com companyId
        ws.send(JSON.stringify({
          type: 'auth',
          companyId: currentCompany.id,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('📩 Mensagem WebSocket recebida:', message);

          setLastMessage(message);

          // Callback customizado
          if (onMessage) {
            onMessage(message);
          }

          // Tratamento padrão de mensagens
          handleMessage(message);
        } catch (error) {
          console.error('❌ Erro ao processar mensagem WebSocket:', error);
        }
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket desconectado');
        setIsConnected(false);

        // Tentar reconectar com backoff exponencial
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`🔄 Tentando reconectar em ${delay}ms (tentativa ${reconnectAttempts.current + 1})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else {
          console.error('❌ Máximo de tentativas de reconexão atingido');
          if (showToasts) {
            toast({
              title: 'Conexão perdida',
              description: 'Não foi possível reconectar ao servidor. Recarregue a página.',
              variant: 'destructive',
            });
          }
        }
      };

      ws.onerror = (error) => {
        console.error('❌ Erro no WebSocket:', error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('❌ Erro ao criar WebSocket:', error);
    }
  }, [currentCompany?.id, onMessage, showToasts, toast]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'appointment_created':
        if (showToasts) {
          toast({
            title: '🆕 Novo Agendamento',
            description: `${message.data.patientName} agendado com ${message.data.professionalName}`,
          });
        }

        // Invalidar cache para atualizar a lista
        queryClient.invalidateQueries({ queryKey: ['/api/v1/appointments'] });
        break;

      case 'appointment_updated':
        if (showToasts) {
          toast({
            title: '✏️ Agendamento Atualizado',
            description: `${message.data.patientName} - ${message.data.professionalName}`,
          });
        }

        queryClient.invalidateQueries({ queryKey: ['/api/v1/appointments'] });
        break;

      case 'appointment_deleted':
        if (showToasts) {
          toast({
            title: '🗑️ Agendamento Removido',
            description: 'Um agendamento foi excluído',
          });
        }

        queryClient.invalidateQueries({ queryKey: ['/api/v1/appointments'] });
        break;

      case 'conflict_warning':
        if (showToasts) {
          toast({
            title: '⚠️ Conflito de Horário',
            description: message.data.message || 'Detectado conflito de agendamento',
            variant: 'destructive',
          });
        }
        break;

      case 'reminder':
        if (showToasts) {
          toast({
            title: '⏰ Lembrete',
            description: `${message.data.patientName} em ${message.data.minutesUntil} minutos`,
          });
        }
        break;

      case 'auth_success':
        console.log('✅ Autenticação WebSocket bem-sucedida');
        break;

      default:
        console.log('Tipo de mensagem desconhecido:', message.type);
    }
  }, [showToasts, toast, queryClient]);

  // Auto-conectar quando o hook é montado e company está disponível
  useEffect(() => {
    if (autoConnect && currentCompany?.id) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, currentCompany?.id, connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    connect,
    disconnect,
  };
}
