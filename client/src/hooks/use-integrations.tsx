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
  };
}
