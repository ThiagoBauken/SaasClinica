// Módulo de Automações
import { ModuleDefinition } from '../../index';
import { lazy } from 'react';

// Dynamic import for the automation component
export const AutomacoesComponent = lazy(() => import('./AutomacoesPage').then(module => ({ default: module.default })));

export const automacoesModule: ModuleDefinition = {
  id: 'automacoes',
  name: 'automacoes',
  displayName: 'Automações e Integrações',
  version: '1.0.0',
  description: 'Integrações N8N, WhatsApp e automações de processos',
  icon: 'Bot',
  dependencies: ['clinica'],
  permissions: ['automacoes:read', 'automacoes:write', 'automacoes:delete', 'automacoes:admin'],
  routes: [
    '/api/automacoes/workflows',
    '/api/automacoes/integrations',
    '/api/automacoes/notifications'
  ],
  components: [
    'WorkflowBuilder',
    'IntegrationManager',
    'NotificationCenter',
    'AutomationRules'
  ],
  frontendRoutes: [
    {
      path: '/automacoes',
      component: AutomacoesComponent,
      title: 'Automações',
      permissions: ['automacoes:read']
    },
    {
      path: '/automation',
      component: AutomacoesComponent,
      title: 'Automações',
      permissions: ['automacoes:read']
    }
  ]
};

export interface Automation {
  id: number;
  name: string;
  trigger: string;
  actions: string[];
  isActive: boolean;
  lastRun?: Date;
  executionCount: number;
  errorCount: number;
}