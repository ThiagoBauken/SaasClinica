import { lazy } from 'react';
import { Calendar, Clock } from 'lucide-react';

// Componentes lazy-loaded do módulo
const AgendaPage = lazy(() => import('./AgendaPage'));
const NovoAgendamento = lazy(() => import('./NovoAgendamento'));
const EditarAgendamento = lazy(() => import('./EditarAgendamento'));

// Configuração do módulo
export default {
  id: 'agenda',
  name: 'Sistema de Agenda',
  component: AgendaPage,
  routes: [
    {
      path: '/agenda',
      component: AgendaPage,
      permissions: ['agenda:read']
    },
    {
      path: '/agenda/novo',
      component: NovoAgendamento,
      permissions: ['agenda:write']
    },
    {
      path: '/agenda/:id/editar',
      component: EditarAgendamento,
      permissions: ['agenda:write']
    }
  ],
  menuItems: [
    {
      id: 'agenda',
      label: 'Agenda',
      icon: 'Calendar',
      path: '/agenda',
      permissions: ['agenda:read'],
      children: [
        {
          id: 'agenda-calendario',
          label: 'Calendário',
          icon: 'Calendar',
          path: '/agenda',
          permissions: ['agenda:read']
        },
        {
          id: 'agenda-novo',
          label: 'Novo Agendamento',
          icon: 'Clock',
          path: '/agenda/novo',
          permissions: ['agenda:write']
        }
      ]
    }
  ]
};