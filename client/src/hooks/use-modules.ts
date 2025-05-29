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
  const { data: userPermissions = [], error: permissionsError } = useQuery({
    queryKey: ['/api/user/modules'],
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutos
    retry: false
  });

  // Buscar módulos ativos do backend
  const { data: backendModules, error: modulesError } = useQuery({
    queryKey: ['/api/clinic/modules'],
    enabled: !!user,
    staleTime: 30000,
    retry: false
  });

  useEffect(() => {
    // Menu padrão para evitar loops infinitos
    const defaultMenu = [
      { label: 'Agenda', path: '/schedule-modular', icon: 'Calendar' },
      { label: 'Pacientes', path: '/patients-modular', icon: 'Users' },
      { label: 'Financeiro', path: '/financial-modular', icon: 'DollarSign' },
      { label: 'Estoque', path: '/inventory-modular', icon: 'Package' }
    ];
    
    setDynamicMenuItems(defaultMenu);
    setActiveModules(frontendModules);
    setDynamicRoutes(generateDynamicRoutes(frontendModules));
  }, []); // Dependências vazias para executar apenas uma vez

  return {
    activeModules,
    dynamicRoutes,
    dynamicMenuItems,
    allModules: frontendModules,
    isLoading: !user || userPermissions === undefined
  };
}