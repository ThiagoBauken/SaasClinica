// Módulo de Configurações
import { ModuleDefinition } from '../../index';
import { lazy } from 'react';

// Dynamic import for the configuration component
export const ConfiguracoesComponent = lazy(() => import('./ConfiguracoesPage').then(module => ({ default: module.default })));

export const configuracoesModule: ModuleDefinition = {
  id: 'configuracoes',
  name: 'configuracoes',
  displayName: 'Configurações da Clínica',
  version: '1.0.0',
  description: 'Configurações gerais da clínica, horários e preferências do sistema',
  icon: 'Settings',
  dependencies: ['clinica'],
  permissions: ['configuracoes:read', 'configuracoes:write', 'configuracoes:admin'],
  routes: [
    '/api/configuracoes/clinic',
    '/api/configuracoes/working-hours',
    '/api/configuracoes/notifications'
  ],
  components: [
    'ClinicSettings',
    'WorkingHoursManager',
    'NotificationSettings',
    'SystemPreferences'
  ],
  frontendRoutes: [
    {
      path: '/configuracoes',
      component: ConfiguracoesComponent,
      title: 'Configurações',
      permissions: ['configuracoes:read']
    },
    {
      path: '/configuracoes-clinica',
      component: ConfiguracoesComponent,
      title: 'Configurações da Clínica',
      permissions: ['configuracoes:read']
    }
  ]
};

export interface ClinicConfiguration {
  id: number;
  companyId: number;
  name: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  logo?: string;
  timezone: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkingHoursConfig {
  id: number;
  companyId: number;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string;
  endTime: string;
  isWorking: boolean;
  breakStartTime?: string;
  breakEndTime?: string;
}

export interface NotificationConfig {
  id: number;
  companyId: number;
  emailNotifications: boolean;
  smsNotifications: boolean;
  whatsappNotifications: boolean;
  appointmentReminders: boolean;
  paymentReminders: boolean;
  systemAlerts: boolean;
  reminderHours: number;
}