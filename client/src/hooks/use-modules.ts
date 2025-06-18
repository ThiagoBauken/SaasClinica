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
  }) as { data: any; error: any };

  useEffect(() => {
    // Menu dinâmico baseado nos módulos do backend
    if (backendModules?.all && Array.isArray(backendModules.all)) {
      const dynamicMenu = backendModules.all.map((module: any) => {
        // Mapear módulos para itens de menu
        const menuItemMap: Record<string, any> = {
          'agenda': { label: 'Agenda', path: '/schedule', icon: 'Calendar' },
          'pacientes': { label: 'Pacientes', path: '/patients', icon: 'Users' },
          'financeiro': { label: 'Financeiro', path: '/financial', icon: 'DollarSign' },
          'automacoes': { label: 'Automações', path: '/automation', icon: 'Bot' },
          'proteses': { label: 'Próteses', path: '/prosthesis', icon: 'Scissors' },
          'estoque': { label: 'Estoque', path: '/inventory', icon: 'Package' },
          'odontograma': { label: 'Odontograma', path: '/odontogram-demo', icon: 'Activity' },
          'digitalizar': { label: 'Digitalizar Fichas', path: '/digitalizar', icon: 'ScanText' },
          'configuracoes': { label: 'Configurações', path: '/configuracoes', icon: 'Settings' },
          'cadastros': { label: 'Cadastros', path: '/cadastros', icon: 'UserPlus' },
          'laboratorio': { label: 'Laboratório', path: '/laboratorio', icon: 'Beaker' },
          'relatorios': { label: 'Relatórios', path: '/relatorios', icon: 'BarChart3' }
        };
        
        return menuItemMap[module.definition.id] || {
          label: module.definition.displayName,
          path: `/${module.definition.id}`,
          icon: module.definition.icon || 'CircleDot'
        };
      }).filter(Boolean);
      
      setDynamicMenuItems(dynamicMenu);
    } else {
      // Menu padrão como fallback
      const defaultMenuItems = [
        { label: 'Agenda', path: '/schedule', icon: 'Calendar' },
        { label: 'Pacientes', path: '/patients', icon: 'Users' },
        { label: 'Financeiro', path: '/financial', icon: 'DollarSign' },
        { label: 'Automações', path: '/automation', icon: 'Bot' },
        { label: 'Próteses', path: '/prosthesis', icon: 'Scissors' },
        { label: 'Estoque', path: '/inventory', icon: 'Package' },
        { label: 'Odontograma', path: '/odontogram-demo', icon: 'Activity' },
        { label: 'Digitalizar Fichas', path: '/digitalizar', icon: 'ScanText' }
      ];
      
      setDynamicMenuItems(defaultMenuItems);
    }
    
    setActiveModules(frontendModules);
    setDynamicRoutes(generateDynamicRoutes(frontendModules));
  }, [backendModules]); // Reagir a mudanças nos módulos do backend

  return {
    activeModules,
    dynamicRoutes,
    dynamicMenuItems,
    allModules: frontendModules,
    isLoading: !user || userPermissions === undefined
  };
}