import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { companySettingsApi } from "@/lib/api";
import { useToast } from "./use-toast";

export function useCompanySettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: companySettings,
    isLoading,
    error
  } = useQuery({
    queryKey: ["/api/v1/company/settings"],
    queryFn: companySettingsApi.getSettings,
  });

  const updateMutation = useMutation({
    mutationFn: companySettingsApi.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/company/settings"] });
      toast({
        title: "Configurações salvas",
        description: "As configurações de automação foram atualizadas com sucesso.",
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
    companySettings,
    isLoading,
    error,
    updateCompanySettings: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}
