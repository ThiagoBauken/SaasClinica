// Módulo de Próteses
import { ModuleDefinition } from '../../index';
import { lazy } from 'react';

// Dynamic import for the prosthesis component
export const ProtesesComponent = lazy(() => import('./ProtesesPage').then(module => ({ default: module.default })));

export const protesesModule: ModuleDefinition = {
  id: 'proteses',
  name: 'proteses',
  displayName: 'Controle de Próteses',
  version: '1.0.0',
  description: 'Gestão de próteses e laboratórios parceiros',
  icon: 'Scissors',
  dependencies: ['clinica', 'pacientes'],
  permissions: ['proteses:read', 'proteses:write', 'proteses:delete', 'proteses:admin'],
  routes: [
    '/api/proteses/prosthesis',
    '/api/proteses/laboratories',
    '/api/proteses/orders'
  ],
  components: [
    'ProsthesisList',
    'ProsthesisForm',
    'LaboratoryManager',
    'OrderTracking'
  ],
  frontendRoutes: [
    {
      path: '/proteses',
      component: ProtesesComponent,
      title: 'Controle de Próteses',
      permissions: ['proteses:read']
    },
    {
      path: '/prosthesis-control',
      component: ProtesesComponent,
      title: 'Controle de Próteses',
      permissions: ['proteses:read']
    }
  ]
};

export interface Prosthesis {
  id: number;
  patientId: number;
  type: string;
  laboratoryId: number;
  status: 'requested' | 'in_production' | 'ready' | 'delivered';
  orderDate: Date;
  expectedDate: Date;
  deliveredDate?: Date;
  cost: number;
  notes?: string;
}