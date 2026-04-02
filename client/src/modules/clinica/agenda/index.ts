// Módulo Frontend - Agenda
import { lazy } from 'react';

// Lazy loading dos componentes do módulo
export const AgendaPage = lazy(() => import('../../../pages/agenda-page'));

// Configuração do módulo frontend
export const agendaModuleConfig = {
  id: 'agenda',
  name: 'Sistema de Agenda',
  routes: [
    {
      path: '/agenda',
      component: AgendaPage,
      title: 'Agenda'
    }
  ],
  menuItems: [
    {
      label: 'Agenda',
      path: '/agenda',
      icon: 'Calendar'
    }
  ],
  permissions: ['agenda:read', 'agenda:write', 'agenda:delete', 'agenda:admin']
};