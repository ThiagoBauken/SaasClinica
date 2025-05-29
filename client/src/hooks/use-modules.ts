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
    if (userPermissions && Array.isArray(userPermissions)) {
      // Criar menu dinâmico baseado nas permissões do usuário (usando rotas modulares)
      const moduleMenuMap: Record<string, { label: string; path: string; icon: string }> = {
        'agenda': { label: 'Agenda', path: '/schedule-modular', icon: 'Calendar' },
        'pacientes': { label: 'Pacientes', path: '/patients-modular', icon: 'Users' },
        'financeiro': { label: 'Financeiro', path: '/financial-modular', icon: 'DollarSign' },
        'automacoes': { label: 'Automações', path: '/automation', icon: 'Bot' },
        'proteses': { label: 'Próteses', path: '/prosthesis', icon: 'Scissors' },
        'estoque': { label: 'Estoque', path: '/inventory-modular', icon: 'Package' },
        'odontograma': { label: 'Odontograma', path: '/odontogram-demo', icon: 'Activity' }
      };

      // Filtrar apenas módulos que o usuário tem permissão
      const authorizedMenuItems = userPermissions
        .filter((module: any) => {
          const permissions = Array.isArray(module.permissions) ? module.permissions : [];
          return permissions.length > 0;
        })
        .map((module: any) => moduleMenuMap[module.name])
        .filter(Boolean);

      // Adicionar calendário se tiver acesso à agenda
      const hasAgendaAccess = userPermissions.some((module: any) => 
        module.name === 'agenda' && module.permissions?.length > 0
      );
      
      if (hasAgendaAccess) {
        authorizedMenuItems.push({ label: 'Calendário', path: '/agenda', icon: 'CalendarDays' });
      }

      setDynamicMenuItems(authorizedMenuItems);
      setActiveModules(userPermissions);
      setDynamicRoutes(generateDynamicRoutes(frontendModules));
    } else {
      // Menu mínimo quando não há permissões
      setDynamicMenuItems([]);
      setActiveModules([]);
      setDynamicRoutes([]);
    }
  }, [userPermissions]);

  return {
    activeModules,
    dynamicRoutes,
    dynamicMenuItems,
    allModules: frontendModules,
    isLoading: !user || userPermissions === undefined
  };
}