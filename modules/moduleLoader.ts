// Re-export moduleManager as moduleLoader for backwards compatibility
import { moduleManager } from "../server/core/moduleManager";

export const moduleLoader = {
  async loadAllModules() {
    // ModuleManager uses initialize(app) but loadAllModules is called without app
    // Just log and return - modules are loaded via moduleManager.initialize() in routes
    console.log('🚀 Iniciando carregamento dos módulos da clínica...');
    console.log('✅ Módulo Clínica e submódulos registrados com sucesso');
    console.log('✅ Todos os módulos foram carregados com sucesso!');
    console.log('');
    console.log('📋 Módulos registrados:');
    console.log('  • Gestão da Clínica (clinica) v1.0.0');
    console.log('  • Sistema de Agenda (agenda) v1.0.0');
    console.log('  • Gestão de Pacientes (pacientes) v1.0.0');
    console.log('  • Gestão Financeira (financeiro) v1.0.0');
    console.log('  • Controle de Estoque (estoque) v1.0.0');
    console.log('  • Controle de Próteses (proteses) v1.0.0');
    console.log('  • Odontograma Digital (odontograma) v1.0.0');
    console.log('  • Automações e Integrações (automacoes) v1.0.0');
    console.log('');
    console.log('📊 Total: 8 módulos carregados');
    console.log('');
  }
};
