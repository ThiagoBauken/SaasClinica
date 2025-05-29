// Hook para gerenciar módulos dinâmicos
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { 
  frontendModules, 
  getActiveModulesForUser, 
  generateDynamicRoutes, 
  generateDynamicMenuItems,
  type FrontendModuleConfig,
  type ModuleRoute,
  type MenuItem
} from '@/modules/clinica';

export function useModules() {
  const { user } = useAuth();
  const [activeModules, setActiveModules] = useState<FrontendModuleConfig[]>([]);
  const [dynamicRoutes, setDynamicRoutes] = useState<ModuleRoute[]>([]);
  const [dynamicMenuItems, setDynamicMenuItems] = useState<MenuItem[]>([]);

  // Buscar permissões do usuário
  const { data: userPermissions = [] } = useQuery({
    queryKey: ['/api/user/modules'],
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Buscar módulos ativos do backend
  const { data: backendModules } = useQuery({
    queryKey: ['/api/clinic/modules'],
    enabled: !!user,
    staleTime: 30000
  });

  useEffect(() => {
    if (!user || !userPermissions.length) {
      setActiveModules([]);
      setDynamicRoutes([]);
      setDynamicMenuItems([]);
      return;
    }

    // Extrair permissões do usuário
    const permissions = userPermissions.flatMap((perm: any) => 
      perm.moduleEnabled ? perm.permissions : []
    );

    // Filtrar módulos frontend baseado nas permissões
    const userActiveModules = getActiveModulesForUser(permissions);
    
    // Filtrar apenas módulos que estão ativos no backend
    const activeBackendModules = backendModules?.byCategory ? 
      Object.values(backendModules.byCategory).flat().filter((mod: any) => mod.isActive) : [];
    
    const finalActiveModules = userActiveModules.filter(frontendModule =>
      activeBackendModules.some((backendModule: any) => 
        backendModule.definition.id === frontendModule.id
      )
    );

    setActiveModules(finalActiveModules);
    setDynamicRoutes(generateDynamicRoutes(finalActiveModules));
    setDynamicMenuItems(generateDynamicMenuItems(finalActiveModules));
  }, [user, userPermissions, backendModules]);

  return {
    activeModules,
    dynamicRoutes,
    dynamicMenuItems,
    allModules: frontendModules,
    isLoading: !user || userPermissions === undefined
  };
}