// Hook para gerenciar módulos dinâmicos
import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AuthContext } from '@/core/AuthProvider';

export type MenuItem = {
  label: string;
  path: string;
  icon: string;
};

// Menu padrão (fallback quando backend não responde)
const defaultMenuItems: MenuItem[] = [
  { label: 'Agenda', path: '/agenda', icon: 'Calendar' },
  { label: 'Pacientes', path: '/patients', icon: 'Users' },
  { label: 'Financeiro', path: '/financial', icon: 'DollarSign' },
  { label: 'Atendimento', path: '/atendimento', icon: 'MessageCircle' },
  { label: 'CRM', path: '/crm', icon: 'Target' },
  { label: 'Automações', path: '/automation', icon: 'Bot' },
  { label: 'Próteses', path: '/prosthesis', icon: 'Scissors' },
  { label: 'Estoque', path: '/inventory', icon: 'Package' },
  { label: 'Odontograma', path: '/odontogram', icon: 'Activity' },
  { label: 'Relatórios', path: '/analytics', icon: 'BarChart3' },
];

export function useModules() {
  let user = null;
  try {
    const authContext = useContext(AuthContext);
    user = authContext?.user || null;
  } catch {
    // AuthContext not available
  }

  // Buscar módulos ativos do backend
  const { data: backendModules, isLoading } = useQuery<{ all: any[]; byCategory: Record<string, any[]> }>({
    queryKey: ['/api/clinic/modules'],
    enabled: !!user,
    staleTime: 30000,
    retry: false
  });

  // Converter módulos do backend para menu items se disponíveis
  const dynamicMenuItems: MenuItem[] = backendModules?.all
    ? backendModules.all
        .filter((m: any) => m.isActive !== false)
        .map((m: any) => ({
          label: m.displayName || m.display_name || m.name,
          path: m.route || `/${m.id}`,
          icon: m.icon || 'Circle',
        }))
    : defaultMenuItems;

  return {
    activeModules: backendModules?.all?.filter((m: any) => m.isActive !== false) || [],
    dynamicRoutes: [],
    dynamicMenuItems: dynamicMenuItems.length > 0 ? dynamicMenuItems : defaultMenuItems,
    allModules: backendModules?.all || [],
    isLoading,
  };
}
