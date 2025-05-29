// Sistema Central de Módulos Frontend
import { agendaModuleConfig } from './agenda';
import { pacientesModuleConfig } from './pacientes';
import { financeiroModuleConfig } from './financeiro';
import { estoqueModuleConfig } from './estoque';
import { protesesModuleConfig } from './proteses';
import { odontogramaModuleConfig } from './odontograma';
import { automacoesModuleConfig } from './automacoes';

export interface ModuleRoute {
  path: string;
  component: React.ComponentType;
  title: string;
}

export interface MenuItem {
  label: string;
  path: string;
  icon: string;
}

export interface FrontendModuleConfig {
  id: string;
  name: string;
  routes: ModuleRoute[];
  menuItems: MenuItem[];
  permissions: string[];
}

// Registry de todos os módulos frontend
export const frontendModules: FrontendModuleConfig[] = [
  agendaModuleConfig,
  pacientesModuleConfig,
  financeiroModuleConfig,
  estoqueModuleConfig,
  protesesModuleConfig,
  odontogramaModuleConfig,
  automacoesModuleConfig
];

// Função para buscar módulo por ID
export function getFrontendModule(moduleId: string): FrontendModuleConfig | undefined {
  return frontendModules.find(module => module.id === moduleId);
}

// Função para filtrar módulos baseado em permissões do usuário
export function getActiveModulesForUser(userPermissions: string[]): FrontendModuleConfig[] {
  return frontendModules.filter(module => 
    module.permissions.some(permission => userPermissions.includes(permission))
  );
}

// Função para gerar rotas dinamicamente
export function generateDynamicRoutes(activeModules: FrontendModuleConfig[]): ModuleRoute[] {
  return activeModules.flatMap(module => module.routes);
}

// Função para gerar itens do menu dinamicamente
export function generateDynamicMenuItems(activeModules: FrontendModuleConfig[]): MenuItem[] {
  return activeModules.flatMap(module => module.menuItems);
}