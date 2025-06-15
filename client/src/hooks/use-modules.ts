// Hook para gerenciar módulos dinâmicos
import { useState, useEffect, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AuthContext } from '@/core/AuthProvider';
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
  // Use a try-catch to safely access auth context
  let user = null;
  try {
    const authContext = useContext(AuthContext);
    user = authContext?.user || null;
  } catch (error) {
    // AuthContext not available, continue with null user
    console.log('AuthContext not available in useModules');
  }
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
    // Menu padrão sempre disponível
    const defaultMenuItems = [
      { label: 'Agenda', path: '/schedule', icon: 'Calendar' },
      { label: 'Calendário', path: '/agenda', icon: 'CalendarDays' },
      { label: 'Pacientes', path: '/patients', icon: 'Users' },
      { label: 'Financeiro', path: '/financial', icon: 'DollarSign' },
      { label: 'Automações', path: '/automation', icon: 'Bot' },
      { label: 'Próteses', path: '/prosthesis', icon: 'Scissors' },
      { label: 'Estoque', path: '/inventory', icon: 'Package' },
      { label: 'Odontograma', path: '/odontogram-demo', icon: 'Activity' },
      { label: 'Digitalização', path: '/digitalizacao', icon: 'Camera' }
    ];
    
    setDynamicMenuItems(defaultMenuItems);
    setActiveModules(frontendModules);
    setDynamicRoutes(generateDynamicRoutes(frontendModules));
  }, []); // Apenas executar uma vez na inicialização

  return {
    activeModules,
    dynamicRoutes,
    dynamicMenuItems,
    allModules: frontendModules,
    isLoading: !user || userPermissions === undefined
  };
}