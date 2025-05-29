// Módulo de Agenda
import { ModuleDefinition } from '../../index';

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