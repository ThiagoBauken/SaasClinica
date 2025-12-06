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

  // N8N API Key Query
  const {
    data: n8nApiKeyInfo,
    isLoading: isLoadingN8nApiKey,
    refetch: refetchN8nApiKey,
  } = useQuery({
    queryKey: ["/api/v1/integrations/n8n-api-key"],
    queryFn: integrationsApi.getN8nApiKey,
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

  const testN8NMutation = useMutation({
    mutationFn: integrationsApi.testN8N,
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

  // N8N API Key Generate Mutation
  const generateN8nApiKeyMutation = useMutation({
    mutationFn: integrationsApi.generateN8nApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/integrations/n8n-api-key"] });
      toast({
        title: "API Key gerada!",
        description: "A nova API Key foi gerada com sucesso. Copie-a agora, pois não será exibida novamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao gerar API Key",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // N8N API Key Revoke Mutation
  const revokeN8nApiKeyMutation = useMutation({
    mutationFn: integrationsApi.revokeN8nApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/integrations/n8n-api-key"] });
      toast({
        title: "API Key revogada",
        description: "A API Key foi revogada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao revogar API Key",
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
    testN8N: testN8NMutation.mutate,
    isTestingN8N: testN8NMutation.isPending,
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
    // Wuzapi Webhook
    webhookInfo,
    isLoadingWebhookInfo,
    refetchWebhookInfo,
    configureWebhook: configureWebhookMutation.mutateAsync,
    isConfiguringWebhook: configureWebhookMutation.isPending,
    // N8N API Key
    n8nApiKeyInfo,
    isLoadingN8nApiKey,
    refetchN8nApiKey,
    generateN8nApiKey: generateN8nApiKeyMutation.mutateAsync,
    isGeneratingApiKey: generateN8nApiKeyMutation.isPending,
    generatedApiKey: generateN8nApiKeyMutation.data,
    revokeN8nApiKey: revokeN8nApiKeyMutation.mutate,
    isRevokingApiKey: revokeN8nApiKeyMutation.isPending,
  };
}
