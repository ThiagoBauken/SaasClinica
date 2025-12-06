import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/core/AuthProvider";

interface MenuPermission {
  id: number;
  companyId: number;
  role: string;
  menuItem: string;
  label: string;
  path: string;
  icon: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  order: number;
}

export function useMenuPermissions() {
  const { user } = useAuth();
  const userRole = user?.role || "staff";

  const { data: permissions, isLoading, error, refetch } = useQuery<MenuPermission[]>({
    queryKey: ["menu-permissions", userRole],
    queryFn: async () => {
      try {
        return await apiRequest<MenuPermission[]>(`/api/v1/menu-permissions/by-role/${userRole}`);
      } catch (error) {
        console.error("Erro ao buscar permissões:", error);
        // Retornar array vazio em caso de erro (permite fallback)
        return [];
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });

  return {
    permissions: permissions || [],
    isLoading,
    error,
    refetch,
  };
}
