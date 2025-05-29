// Módulo Frontend - Agenda
import { lazy } from 'react';

// Lazy loading dos componentes do módulo
export const AgendaPage = lazy(() => import('../../../pages/agenda-page'));
export const SchedulePage = lazy(() => import('../../../pages/schedule-page'));

// Configuração do módulo frontend
export const agendaModuleConfig = {
  id: 'agenda',
  name: 'Sistema de Agenda',
  routes: [
    {
      path: '/agenda',
      component: AgendaPage,
      title: 'Agenda'
    },
    {
      path: '/schedule',
      component: SchedulePage,
      title: 'Calendário'
    }
  ],
  menuItems: [
    {
      label: 'Agenda',
      path: '/agenda',
      icon: 'Calendar'
    },
    {
      label: 'Calendário',
      path: '/schedule',
      icon: 'CalendarDays'
    }
  ],
  permissions: ['agenda:read', 'agenda:write', 'agenda:delete', 'agenda:admin']
};