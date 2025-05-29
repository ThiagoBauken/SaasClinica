// Sistema de Registro e Gerenciamento de Módulos da Clínica
export interface ModuleDefinition {
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
}

export interface ModuleInstance {
  definition: ModuleDefinition;
  isActive: boolean;
  config: Record<string, any>;
}

class ModuleRegistry {
  private modules = new Map<string, ModuleInstance>();

  register(definition: ModuleDefinition): void {
    this.modules.set(definition.id, {
      definition,
      isActive: false,
      config: {}
    });
  }

  activate(moduleId: string): boolean {
    const module = this.modules.get(moduleId);
    if (module) {
      module.isActive = true;
      return true;
    }
    return false;
  }

  deactivate(moduleId: string): boolean {
    const module = this.modules.get(moduleId);
    if (module) {
      module.isActive = false;
      return true;
    }
    return false;
  }

  getActiveModules(): ModuleInstance[] {
    return Array.from(this.modules.values()).filter(m => m.isActive);
  }

  getAllModules(): ModuleInstance[] {
    return Array.from(this.modules.values());
  }

  getModule(moduleId: string): ModuleInstance | undefined {
    return this.modules.get(moduleId);
  }

  getModulesByCategory(): Record<string, ModuleInstance[]> {
    const categories: Record<string, ModuleInstance[]> = {
      'clinico': [],
      'administrativo': [],
      'integracao': []
    };

    this.modules.forEach(module => {
      const category = this.getCategoryByModuleId(module.definition.id);
      if (categories[category]) {
        categories[category].push(module);
      }
    });

    return categories;
  }

  private getCategoryByModuleId(moduleId: string): string {
    if (['agenda', 'pacientes', 'odontograma'].includes(moduleId)) return 'clinico';
    if (['financeiro', 'estoque', 'proteses'].includes(moduleId)) return 'administrativo';
    if (['automacoes'].includes(moduleId)) return 'integracao';
    return 'clinico';
  }
}

export const moduleRegistry = new ModuleRegistry();