// Módulo Frontend - Automações
import { lazy } from 'react';

// Lazy loading dos componentes do módulo
export const AutomationPage = lazy(() => import('./AutomacoesPage'));

// Configuração do módulo frontend
export const automacoesModuleConfig = {
  id: 'automacoes',
  name: 'Automações e Integrações',
  routes: [
    {
      path: '/automation',
      component: AutomationPage,
      title: 'Automações'
    }
  ],
  menuItems: [
    {
      label: 'Automações',
      path: '/automation',
      icon: 'Bot'
    }
  ],
  permissions: ['automacoes:read', 'automacoes:write', 'automacoes:delete', 'automacoes:admin']
};