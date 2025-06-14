// Módulo de Agenda
import { ModuleDefinition } from '../../index';
import { lazy } from 'react';

// Dynamic import for the agenda component
export const AgendaComponent = lazy(() => import('./AgendaModule').then(module => ({ default: module.AgendaModule })));

export const agendaModule: ModuleDefinition = {
  id: 'agenda',
  name: 'agenda',
  displayName: 'Sistema de Agenda',
  version: '1.0.0',
  description: 'Gerenciamento completo de agendamentos e consultas',
  icon: 'Calendar',
  dependencies: ['clinica'],
  permissions: ['agenda:read', 'agenda:write', 'agenda:delete', 'agenda:admin'],
  routes: [
    '/api/agenda/appointments',
    '/api/agenda/schedule',
    '/api/agenda/availability'
  ],
  components: [
    'CalendarView',
    'AppointmentForm',
    'ScheduleManager'
  ],
  // Frontend routes for modular loading
  frontendRoutes: [
    {
      path: '/agenda',
      component: AgendaComponent,
      title: 'Agenda',
      permissions: ['agenda:read']
    },
    {
      path: '/schedule',
      component: AgendaComponent,
      title: 'Agenda',
      permissions: ['agenda:read']
    }
  ]
};

export interface Appointment {
  id: number;
  patientId: number;
  dentistId: number;
  roomId?: number;
  date: Date;
  startTime: string;
  endTime: string;
  procedure: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
}