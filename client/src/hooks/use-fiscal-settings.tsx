import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fiscalSettingsApi } from "@/lib/api";
import { useToast } from "./use-toast";

export function useFiscalSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: fiscalSettings,
    isLoading,
    error
  } = useQuery({
    queryKey: ["/api/fiscal-settings"],
    queryFn: fiscalSettingsApi.getSettings,
  });

  const updateMutation = useMutation({
    mutationFn: fiscalSettingsApi.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fiscal-settings"] });
      toast({
        title: "Configurações fiscais salvas",
        description: "As configurações fiscais foram atualizadas com sucesso.",
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

  return {
    fiscalSettings,
    isLoading,
    error,
    updateFiscalSettings: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}