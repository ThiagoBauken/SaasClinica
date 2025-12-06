import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar } from "lucide-react";

interface GoogleCalendarSyncProps {
  professionalId: number;
  professionalName: string;
  isConnected?: boolean;
  onSyncComplete?: () => void;
}

export default function GoogleCalendarSync({
  professionalId,
  professionalName,
  isConnected = false,
  onSyncComplete
}: GoogleCalendarSyncProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'pending'>(
    isConnected ? 'connected' : 'disconnected'
  );
  const { toast } = useToast();

  const handleConnect = async () => {
    setIsSyncing(true);
    try {
      // Em um ambiente real, aqui seria feita a chamada para a API
      // que iniciaria o processo de autenticação OAuth com o Google
      const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${window.location.origin}/auth/google/callback&scope=https://www.googleapis.com/auth/calendar&response_type=code&access_type=offline&prompt=consent&state=${professionalId}`;
      
      // Simulação para demonstração
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Em produção, redirecionaríamos o usuário para a página de autenticação do Google
      // window.location.href = authUrl;
      
      toast({
        title: "Conectado ao Google Calendar",
        description: `A agenda de ${professionalName} agora será sincronizada automaticamente.`,
      });
      
      setConnectionStatus('connected');
      if (onSyncComplete) onSyncComplete();
    } catch (error) {
      toast({
        title: "Erro ao conectar com o Google Calendar",
        description: "Ocorreu um erro ao tentar conectar com o Google Calendar. Tente novamente.",
        variant: "destructive"
      });
      console.error("Erro ao conectar com Google Calendar:", error);
    } finally {
      setIsSyncing(false);
      setIsOpen(false);
    }
  };

  const handleDisconnect = async () => {
    setIsSyncing(true);
    try {
      // Em um ambiente real, aqui seria feita a chamada para a API
      // que revogaria o acesso do token OAuth
      
      // Simulação para demonstração
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Desconectado do Google Calendar",
        description: `A agenda de ${professionalName} não será mais sincronizada.`,
      });
      
      setConnectionStatus('disconnected');
      if (onSyncComplete) onSyncComplete();
    } catch (error) {
      toast({
        title: "Erro ao desconectar do Google Calendar",
        description: "Ocorreu um erro ao tentar desconectar do Google Calendar. Tente novamente.",
        variant: "destructive"
      });
      console.error("Erro ao desconectar do Google Calendar:", error);
    } finally {
      setIsSyncing(false);
      setIsOpen(false);
    }
  };

  return (
    <>
      <Button
        variant={connectionStatus === 'connected' ? "outline" : "default"}
        size="sm"
        className={`flex items-center gap-1 ${connectionStatus === 'connected' ? 'bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 border-green-200' : ''}`}
        onClick={() => setIsOpen(true)}
      >
        <Calendar className="h-4 w-4" />
        {connectionStatus === 'connected' ? 'Google conectado' : 'Google agenda'}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sincronização com Google Agenda</DialogTitle>
            <DialogDescription>
              {connectionStatus === 'connected' 
                ? `A agenda de ${professionalName} está sincronizada com o Google Calendar. Todos os agendamentos serão automaticamente atualizados.`
                : `Conecte a agenda de ${professionalName} ao Google Calendar para sincronizar automaticamente todos os agendamentos.`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            {connectionStatus === 'connected' ? (
              <div className="flex flex-col items-center justify-center space-y-2 bg-green-50 p-4 rounded-md">
                <div className="text-green-700 font-medium flex items-center">
                  <Calendar className="h-5 w-5 mr-2" />
                  Conectado ao Google Calendar
                </div>
                <p className="text-sm text-green-600">
                  Agenda sincronizando automaticamente
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-2 bg-blue-50 p-4 rounded-md">
                <div className="text-blue-700 font-medium flex items-center">
                  <Calendar className="h-5 w-5 mr-2" />
                  Conecte ao Google Calendar
                </div>
                <p className="text-sm text-blue-600">
                  Mantenha todos os agendamentos sincronizados
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            {connectionStatus === 'connected' ? (
              <Button 
                variant="destructive" 
                onClick={handleDisconnect}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Desconectando...
                  </>
                ) : (
                  'Desconectar'
                )}
              </Button>
            ) : (
              <Button 
                onClick={handleConnect}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  'Conectar ao Google Calendar'
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}