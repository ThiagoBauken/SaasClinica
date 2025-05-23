import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clinicSettingsApi } from "@/lib/api";
import { useToast } from "./use-toast";

export function useClinicSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: clinicSettings,
    isLoading,
    error
  } = useQuery({
    queryKey: ["/api/clinic-settings"],
    queryFn: clinicSettingsApi.getSettings,
  });

  const updateMutation = useMutation({
    mutationFn: clinicSettingsApi.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinic-settings"] });
      toast({
        title: "Configurações salvas",
        description: "As configurações da clínica foram atualizadas com sucesso.",
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
    clinicSettings,
    isLoading,
    error,
    updateClinicSettings: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}