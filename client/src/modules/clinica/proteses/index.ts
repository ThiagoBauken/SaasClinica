// Módulo Frontend - Próteses
import { lazy } from 'react';

// Lazy loading dos componentes do módulo
export const ProsthesisControlPage = lazy(() => import('./ProtesesPage'));

// Configuração do módulo frontend
export const protesesModuleConfig = {
  id: 'proteses',
  name: 'Controle de Próteses',
  routes: [
    {
      path: '/prosthesis',
      component: ProsthesisControlPage,
      title: 'Próteses'
    }
  ],
  menuItems: [
    {
      label: 'Próteses',
      path: '/prosthesis',
      icon: 'Scissors'
    }
  ],
  permissions: ['proteses:read', 'proteses:write', 'proteses:delete', 'proteses:admin']
};