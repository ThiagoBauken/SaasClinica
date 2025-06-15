// Módulo Principal da Clínica
import { ModuleDefinition, moduleRegistry } from '../index';

// Importar submódulos
import { agendaModule } from './agenda/index';
import { pacientesModule } from './pacientes/index';
import { financeiroModule } from './financeiro/index';
import { estoqueModule } from './estoque/index';
import { protesesModule } from './proteses/index';
import { odontogramaModule } from './odontograma/index';
import { automacoesModule } from './automacoes/index';
import digitalizarModule from './digitalizar/index';

export const clinicaModule: ModuleDefinition = {
  id: 'clinica',
  name: 'clinica',
  displayName: 'Gestão da Clínica',
  version: '1.0.0',
  description: 'Módulo principal para gestão completa da clínica odontológica',
  icon: 'Building2',
  dependencies: [],
  permissions: ['clinica:read', 'clinica:write', 'clinica:admin']
};

// Registrar módulo principal e submódulos
export function initializeClinicaModule() {
  // Registrar módulo principal
  moduleRegistry.register(clinicaModule);
  
  // Registrar submódulos
  moduleRegistry.register(agendaModule);
  moduleRegistry.register(pacientesModule);
  moduleRegistry.register(financeiroModule);
  moduleRegistry.register(estoqueModule);
  moduleRegistry.register(protesesModule);
  moduleRegistry.register(odontogramaModule);
  moduleRegistry.register(automacoesModule);
  moduleRegistry.register(digitalizarModule);
  
  console.log('✅ Módulo Clínica e submódulos registrados com sucesso');
}

export {
  agendaModule,
  pacientesModule,
  financeiroModule,
  estoqueModule,
  protesesModule,
  odontogramaModule,
  automacoesModule,
  digitalizarModule
};