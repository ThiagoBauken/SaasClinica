// Módulo de Relatórios
import { ModuleDefinition } from '../../index';
import { lazy } from 'react';

// Dynamic import for the reports component
export const RelatoriosComponent = lazy(() => import('./RelatoriosPage').then(module => ({ default: module.default })));

export const relatoriosModule: ModuleDefinition = {
  id: 'relatorios',
  name: 'relatorios',
  displayName: 'Relatórios e Analytics',
  version: '1.0.0',
  description: 'Relatórios detalhados e análises de performance da clínica',
  icon: 'BarChart3',
  dependencies: ['clinica'],
  permissions: ['relatorios:read', 'relatorios:write', 'relatorios:export', 'relatorios:admin'],
  routes: [
    '/api/relatorios/revenue',
    '/api/relatorios/appointments',
    '/api/relatorios/procedures',
    '/api/relatorios/patients'
  ],
  components: [
    'RevenueChart',
    'AppointmentAnalytics',
    'ProcedureStats',
    'PatientDemographics',
    'ReportExporter'
  ],
  frontendRoutes: [
    {
      path: '/relatorios',
      component: RelatoriosComponent,
      title: 'Relatórios',
      permissions: ['relatorios:read']
    },
    {
      path: '/analytics',
      component: RelatoriosComponent,
      title: 'Analytics da Clínica',
      permissions: ['relatorios:read']
    }
  ]
};

export interface RevenueReport {
  id: number;
  companyId: number;
  period: string;
  revenue: number; // in cents
  procedures: number;
  patients: number;
  averageTicket: number;
  growth: number; // percentage
  createdAt: Date;
}

export interface AppointmentAnalytics {
  id: number;
  companyId: number;
  date: Date;
  totalScheduled: number;
  totalCompleted: number;
  totalCancelled: number;
  totalNoShow: number;
  averageDuration: number; // in minutes
  conversionRate: number; // percentage
}

export interface ProcedureStats {
  id: number;
  companyId: number;
  procedureId: number;
  procedureName: string;
  category: string;
  count: number;
  totalRevenue: number; // in cents
  averagePrice: number; // in cents
  averageDuration: number; // in minutes
  period: string;
}

export interface PatientDemographics {
  id: number;
  companyId: number;
  period: string;
  totalPatients: number;
  newPatients: number;
  returningPatients: number;
  averageAge: number;
  maleCount: number;
  femaleCount: number;
  otherCount: number;
  retentionRate: number; // percentage
}