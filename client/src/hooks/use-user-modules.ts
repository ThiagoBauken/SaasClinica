import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { frontendModules, getActiveModulesForUser, generateDynamicMenuItems } from "@/modules/clinica";

export function useUserModules() {
  const { user } = useAuth();

  // Buscar permissões do usuário
  const { data: userPermissions = [], isLoading } = useQuery({
    queryKey: ["/api/user/modules"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Extrair lista de permissões do formato da API
  const permissions = Array.isArray(userPermissions) 
    ? userPermissions.flatMap((module: any) => module.permissions || [])
    : [];

  // Filtrar módulos ativos baseado nas permissões
  const activeModules = getActiveModulesForUser(permissions);
  
  // Gerar itens do menu dinamicamente
  const menuItems = generateDynamicMenuItems(activeModules);

  // Verificar se usuário tem permissão para um módulo específico
  const hasModulePermission = (moduleId: string, permission: string = 'read') => {
    return permissions.includes(`${moduleId}:${permission}`);
  };

  // Verificar se módulo está ativo
  const isModuleActive = (moduleId: string) => {
    return activeModules.some(module => module.id === moduleId);
  };

  return {
    activeModules,
    menuItems,
    permissions,
    hasModulePermission,
    isModuleActive,
    isLoading,
    allModules: frontendModules
  };
}