import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

interface ModuleDefinition {
  id: string;
  name: string;
  displayName: string;
  version: string;
  description: string;
  dependencies?: string[];
  routes?: any[];
  components?: any[];
  permissions?: string[];
  icon?: string;
  frontendRoutes?: any[];
}

interface ModuleComponent {
  definition: ModuleDefinition;
  component?: React.ComponentType<any>;
  isLoaded: boolean;
  error?: string;
}

export function useActiveModules() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadedModules, setLoadedModules] = useState<ModuleComponent[]>([]);
  const loadedModulesRef = useRef<string[]>([]);

  // Carregar módulos ativos do usuário
  const { data: userModules = [], isLoading: userModulesLoading } = useQuery({
    queryKey: ['/api/user/modules'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/user/modules');
        if (!response.ok) return [];
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Erro ao carregar módulos do usuário:', error);
        return [];
      }
    }
  });

  // Carregar módulos da clínica
  const { data: clinicModules = [], isLoading: clinicModulesLoading } = useQuery({
    queryKey: ['/api/clinic/modules'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/clinic/modules');
        if (!response.ok) return [];
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Erro ao carregar módulos da clínica:', error);
        return [];
      }
    }
  });

  // Combinar e filtrar módulos únicos
  const allModules = useMemo(() => {
    const userArray = Array.isArray(userModules) ? userModules : [];
    const clinicArray = Array.isArray(clinicModules) ? clinicModules : [];
    const combined = [...userArray, ...clinicArray];
    return combined.filter((module, index, self) => 
      index === self.findIndex(m => m.id === module.id)
    );
  }, [userModules, clinicModules]);

  // Carregar módulos dinamicamente
  useEffect(() => {
    if (allModules.length > 0 && !loadedModulesRef.current.includes('clinic')) {
      loadModulesDynamically(allModules);
    }
  }, [allModules]);

  const loadModulesDynamically = async (modules: any[]) => {
    try {
      setIsLoading(true);
      
      const moduleComponents: ModuleComponent[] = [];
      
      for (const moduleData of modules) {
        if (!loadedModulesRef.current.includes(moduleData.name)) {
          try {
            const moduleComponent: ModuleComponent = {
              definition: {
                id: moduleData.name || moduleData.id,
                name: moduleData.name || moduleData.id,
                displayName: moduleData.displayName || moduleData.display_name || moduleData.name,
                version: moduleData.version || '1.0.0',
                description: moduleData.description || '',
                permissions: moduleData.permissions || []
              },
              isLoaded: true,
              component: undefined // Lazy loading será implementado depois
            };
            
            moduleComponents.push(moduleComponent);
            loadedModulesRef.current.push(moduleData.name || moduleData.id);
          } catch (error) {
            console.error(`Erro ao carregar módulo ${moduleData.name}:`, error);
          }
        }
      }
      
      setLoadedModules(moduleComponents);
    } catch (error) {
      console.error('Erro ao carregar módulos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    modules: loadedModules,
    isLoading: isLoading || userModulesLoading || clinicModulesLoading,
    userModules: allModules
  };
}

export function ModuleRenderer({ moduleId }: { moduleId: string }) {
  const { modules } = useActiveModules();
  const module = modules.find(m => m.definition.id === moduleId);

  if (!module) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted-foreground">Módulo não encontrado</div>
      </div>
    );
  }

  if (!module.isLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Carregando módulo...</div>
      </div>
    );
  }

  if (module.component) {
    const Component = module.component;
    return <Component />;
  }

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-lg text-muted-foreground">
        Módulo {module.definition.displayName} carregado
      </div>
    </div>
  );
}