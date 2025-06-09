// Módulo Frontend - Agenda
import { lazy } from 'react';

// Lazy loading dos componentes do módulo
export const SchedulePage = lazy(() => import('./AgendaPage'));

// Configuração do módulo frontend
export const agendaModuleConfig = {
  id: 'agenda',
  name: 'Sistema de Agenda',
  routes: [
    {
      path: '/schedule',
      component: SchedulePage,
      title: 'Agenda'
    }
  ],
  menuItems: [
    {
      label: 'Agenda',
      path: '/schedule',
      icon: 'Calendar'
    }
  ],
  permissions: ['agenda:read', 'agenda:write', 'agenda:delete', 'agenda:admin']
};