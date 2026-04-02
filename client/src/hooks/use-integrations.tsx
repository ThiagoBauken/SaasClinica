import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { integrationsApi } from "@/lib/api";
import { useToast } from "./use-toast";

export function useIntegrations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: integrationSettings,
    isLoading,
    error
  } = useQuery({
    queryKey: ["/api/v1/integrations"],
    queryFn: integrationsApi.getSettings,
  });

  // Wuzapi Status Query
  const {
    data: wuzapiStatus,
    isLoading: isLoadingWuzapiStatus,
    refetch: refetchWuzapiStatus,
  } = useQuery({
    queryKey: ["/api/v1/integrations/wuzapi/status"],
    queryFn: integrationsApi.getWuzapiStatus,
    refetchInterval: 10000, // Atualiza a cada 10 segundos
  });

  const updateMutation = useMutation({
    mutationFn: integrationsApi.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/integrations"] });
      toast({
        title: "Configurações salvas",
        description: "As configurações de integração foram atualizadas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar",
        description: `Ocorreu um erro: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const testWhatsAppMutation = useMutation({
    mutationFn: integrationsApi.testWhatsApp,
    onSuccess: (data) => {
      toast({
        title: data.success ? "Conexão bem-sucedida!" : "Falha na conexão",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao testar conexão",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sendTestWhatsAppMutation = useMutation({
    mutationFn: integrationsApi.sendTestWhatsApp,
    onSuccess: (data) => {
      toast({
        title: data.success ? "Mensagem enviada!" : "Falha no envio",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Wuzapi QR Code Mutation
  const getQrCodeMutation = useMutation({
    mutationFn: integrationsApi.getWuzapiQrCode,
    onError: (error: Error) => {
      toast({
        title: "Erro ao obter QR Code",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Wuzapi Connect Mutation
  const connectWuzapiMutation = useMutation({
    mutationFn: integrationsApi.connectWuzapi,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/integrations/wuzapi/status"] });
      toast({
        title: data.success ? "Conexão iniciada!" : "Falha ao conectar",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao conectar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Wuzapi Disconnect Mutation
  const disconnectWuzapiMutation = useMutation({
    mutationFn: integrationsApi.disconnectWuzapi,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/integrations/wuzapi/status"] });
      toast({
        title: data.success ? "Desconectado!" : "Falha ao desconectar",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao desconectar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Wuzapi Logout Mutation (remove sessão permanentemente)
  const logoutWuzapiMutation = useMutation({
    mutationFn: integrationsApi.logoutWuzapi,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/integrations/wuzapi/status"] });
      toast({
        title: data.success ? "Logout realizado!" : "Falha ao fazer logout",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao fazer logout",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Wuzapi Reconnect Mutation (reconecta sem precisar de QR Code)
  const reconnectWuzapiMutation = useMutation({
    mutationFn: integrationsApi.reconnectWuzapi,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/integrations/wuzapi/status"] });
      toast({
        title: data.success ? "Reconectado!" : "Falha ao reconectar",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao reconectar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Wuzapi Reconfigure Mutation (força reconfiguração de webhook, S3, HMAC)
  const reconfigureWuzapiMutation = useMutation({
    mutationFn: integrationsApi.reconfigureWuzapi,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/integrations/wuzapi/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/integrations/wuzapi/webhook-info"] });
      toast({
        title: data.success ? "Reconfigurado!" : "Falha ao reconfigurar",
        description: data.success
          ? `Webhook: ${data.results?.webhook}, S3: ${data.results?.s3}, HMAC: ${data.results?.hmac}`
          : data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao reconfigurar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Wuzapi Reset Mutation (reseta completamente a instância)
  const resetWuzapiMutation = useMutation({
    mutationFn: integrationsApi.resetWuzapi,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/integrations/wuzapi/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/integrations/wuzapi/webhook-info"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/integrations"] });
      toast({
        title: data.success ? "Instância resetada!" : "Falha ao resetar",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao resetar instância",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Wuzapi Webhook Info Query
  const {
    data: webhookInfo,
    isLoading: isLoadingWebhookInfo,
    refetch: refetchWebhookInfo,
  } = useQuery({
    queryKey: ["/api/v1/integrations/wuzapi/webhook-info"],
    queryFn: integrationsApi.getWuzapiWebhookInfo,
  });

  // Wuzapi Configure Webhook Mutation
  const configureWebhookMutation = useMutation({
    mutationFn: integrationsApi.configureWuzapiWebhook,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/integrations/wuzapi/webhook-info"] });
      toast({
        title: data.success ? "Webhook configurado!" : "Falha ao configurar webhook",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao configurar webhook",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    integrationSettings,
    isLoading,
    error,
    updateIntegrations: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    testWhatsApp: testWhatsAppMutation.mutate,
    isTestingWhatsApp: testWhatsAppMutation.isPending,
    sendTestWhatsApp: sendTestWhatsAppMutation.mutate,
    isSendingTest: sendTestWhatsAppMutation.isPending,
    // Wuzapi Status e QR Code
    wuzapiStatus,
    isLoadingWuzapiStatus,
    refetchWuzapiStatus,
    getQrCode: getQrCodeMutation.mutateAsync,
    qrCodeData: getQrCodeMutation.data,
    isLoadingQrCode: getQrCodeMutation.isPending,
    // Wuzapi Connect/Disconnect/Logout
    connectWuzapi: connectWuzapiMutation.mutateAsync,
    isConnecting: connectWuzapiMutation.isPending,
    connectData: connectWuzapiMutation.data,
    disconnectWuzapi: disconnectWuzapiMutation.mutate,
    isDisconnecting: disconnectWuzapiMutation.isPending,
    logoutWuzapi: logoutWuzapiMutation.mutate,
    isLoggingOut: logoutWuzapiMutation.isPending,
    // Wuzapi Reconnect
    reconnectWuzapi: reconnectWuzapiMutation.mutateAsync,
    isReconnecting: reconnectWuzapiMutation.isPending,
    // Wuzapi Reconfigure (força reconfiguração de webhook, S3, HMAC)
    reconfigureWuzapi: reconfigureWuzapiMutation.mutateAsync,
    isReconfiguring: reconfigureWuzapiMutation.isPending,
    // Wuzapi Reset (reseta completamente a instância)
    resetWuzapi: resetWuzapiMutation.mutateAsync,
    isResetting: resetWuzapiMutation.isPending,
    // Wuzapi Webhook
    webhookInfo,
    isLoadingWebhookInfo,
    refetchWebhookInfo,
    configureWebhook: configureWebhookMutation.mutateAsync,
    isConfiguringWebhook: configureWebhookMutation.isPending,
  };
}
