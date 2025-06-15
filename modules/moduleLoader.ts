// Sistema de Carregamento de Módulos
import { moduleRegistry } from './index';
import { initializeClinicaModule } from './clinica/index';

export class ModuleLoader {
  private static instance: ModuleLoader;
  private loadedModules: Set<string> = new Set();

  static getInstance(): ModuleLoader {
    if (!ModuleLoader.instance) {
      ModuleLoader.instance = new ModuleLoader();
    }
    return ModuleLoader.instance;
  }

  async loadAllModules(): Promise<void> {
    console.log('🚀 Iniciando carregamento dos módulos da clínica...');
    
    try {
      // Carregar módulo principal da clínica e submódulos
      await this.loadClinicaModules();
      
      console.log('✅ Todos os módulos foram carregados com sucesso!');
      this.logLoadedModules();
    } catch (error) {
      console.error('❌ Erro ao carregar módulos:', error);
      throw error;
    }
  }

  private async loadClinicaModules(): Promise<void> {
    // Inicializar módulo da clínica
    initializeClinicaModule();
    
    // Marcar módulos como carregados
    const clinicaModules = [
      'clinica',
      'agenda', 
      'pacientes', 
      'financeiro', 
      'estoque', 
      'proteses', 
      'odontograma', 
      'automacoes',
      'configuracoes',
      'cadastros',
      'laboratorio',
      'relatorios',
      'digitalizar'
    ];
    
    clinicaModules.forEach(moduleId => {
      this.loadedModules.add(moduleId);
    });
  }

  private logLoadedModules(): void {
    const modules = moduleRegistry.getAllModules();
    console.log('\n📋 Módulos registrados:');
    modules.forEach(module => {
      console.log(`  • ${module.definition.displayName} (${module.definition.id}) v${module.definition.version}`);
    });
    console.log(`\n📊 Total: ${modules.length} módulos carregados\n`);
  }

  getLoadedModules(): string[] {
    return Array.from(this.loadedModules);
  }

  isModuleLoaded(moduleId: string): boolean {
    return this.loadedModules.has(moduleId);
  }
}

export const moduleLoader = ModuleLoader.getInstance();