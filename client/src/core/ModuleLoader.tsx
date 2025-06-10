import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ModuleComponent {
  id: string;
  name: string;
  component: React.LazyExoticComponent<any>;
  routes: RouteConfig[];
  menuItems: MenuItem[];
}

interface RouteConfig {
  path: string;
  component: React.LazyExoticComponent<any>;
  permissions?: string[];
}

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  permissions?: string[];
  children?: MenuItem[];
}

class ModuleRegistry {
  private modules = new Map<string, ModuleComponent>();
  private loadedModules = new Set<string>();

  async loadModule(moduleId: string): Promise<ModuleComponent | null> {
    if (this.loadedModules.has(moduleId)) {
      return this.modules.get(moduleId) || null;
    }

    try {
      const moduleConfig = await this.getModuleConfig(moduleId);
      
      if (!moduleConfig) {
        console.warn(`Módulo ${moduleId} não encontrado`);
        return null;
      }

      const module = await this.dynamicImport(moduleId);
      
      if (module) {
        this.modules.set(moduleId, module);
        this.loadedModules.add(moduleId);
        console.log(`✅ Módulo ${moduleId} carregado com sucesso`);
        return module;
      }
    } catch (error) {
      console.error(`❌ Erro ao carregar módulo ${moduleId}:`, error);
    }

    return null;
  }

  private async dynamicImport(moduleId: string): Promise<ModuleComponent | null> {
    const moduleMap: Record<string, () => Promise<any>> = {
      'agenda': () => import('@/modules/clinica/agenda'),
      'pacientes': () => import('@/modules/clinica/pacientes'),
      'financeiro': () => import('@/modules/clinica/financeiro'),
      'estoque': () => import('@/modules/clinica/estoque'),
      'proteses': () => import('@/modules/clinica/proteses'),
      'odontograma': () => import('@/modules/clinica/odontograma'),
      'automacoes': () => import('@/modules/clinica/automacoes'),
    };

    const moduleLoader = moduleMap[moduleId];
    if (!moduleLoader) {
      return null;
    }

    try {
      const moduleExports = await moduleLoader();
      return moduleExports.default || moduleExports;
    } catch (error) {
      console.error(`Erro ao importar módulo ${moduleId}:`, error);
      return null;
    }
  }

  private async getModuleConfig(moduleId: string): Promise<any> {
    try {
      const response = await apiRequest(`/api/clinic/modules/${moduleId}`, "GET");
      return response;
    } catch (error) {
      console.error(`Erro ao buscar config do módulo ${moduleId}:`, error);
      return null;
    }
  }

  getLoadedModules(): ModuleComponent[] {
    return Array.from(this.modules.values());
  }

  getModule(moduleId: string): ModuleComponent | undefined {
    return this.modules.get(moduleId);
  }

  getAllRoutes(): RouteConfig[] {
    const routes: RouteConfig[] = [];
    this.modules.forEach(module => {
      routes.push(...module.routes);
    });
    return routes;
  }

  getAllMenuItems(): MenuItem[] {
    const menuItems: MenuItem[] = [];
    this.modules.forEach(module => {
      menuItems.push(...module.menuItems);
    });
    return menuItems;
  }
}

export const moduleRegistry = new ModuleRegistry();

export function useActiveModules() {
  const { data: userModules = [], isLoading } = useQuery({
    queryKey: ['/api/user/modules'],
    queryFn: async () => {
      const response = await apiRequest('/api/user/modules', 'GET');
      return response;
    }
  });

  const { data: loadedModules = [], isLoading: modulesLoading } = useQuery({
    queryKey: ['loaded-modules', userModules],
    queryFn: async () => {
      const modules: ModuleComponent[] = [];
      
      // Ensure userModules is an array before iteration
      const moduleArray = Array.isArray(userModules) ? userModules : [];
      
      for (const userModule of moduleArray) {
        if (userModule && typeof userModule === 'object' && userModule.isActive) {
          const moduleId = userModule.definition?.id || userModule.id;
          if (moduleId) {
            const module = await moduleRegistry.loadModule(moduleId);
            if (module) {
              modules.push(module);
            }
          }
        }
      }
      
      return modules;
    },
    enabled: !isLoading && Array.isArray(userModules) && userModules.length > 0
  });

  return {
    modules: loadedModules,
    isLoading: isLoading || modulesLoading,
    userModules
  };
}

export function ModuleRenderer({ moduleId }: { moduleId: string }) {
  const module = moduleRegistry.getModule(moduleId);

  if (!module) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-lg font-medium">Módulo não carregado</div>
          <div className="text-sm text-muted-foreground">
            O módulo {moduleId} não está disponível
          </div>
        </div>
      </div>
    );
  }

  const ModuleComponent = module.component;

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Carregando módulo...</div>
      </div>
    }>
      <ModuleComponent />
    </Suspense>
  );
}

export function useModulePermissions(moduleId: string, permission?: string) {
  return useQuery({
    queryKey: [`/api/user/modules/${moduleId}/permissions`, permission],
    queryFn: async () => {
      const response = await apiRequest(`/api/user/modules/${moduleId}/permissions`, 'GET');
      if (permission) {
        return response.includes(permission);
      }
      return response;
    }
  });
}

export default moduleRegistry;