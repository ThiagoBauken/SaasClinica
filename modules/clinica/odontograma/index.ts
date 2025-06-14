// Módulo de Odontograma
import { ModuleDefinition } from '../../index';
import { lazy } from 'react';

// Dynamic import for the odontogram component
export const OdontogramaComponent = lazy(() => import('./OdontogramaPage').then(module => ({ default: module.default })));

export const odontogramaModule: ModuleDefinition = {
  id: 'odontograma',
  name: 'odontograma',
  displayName: 'Odontograma Digital',
  version: '1.0.0',
  description: 'Sistema digital de odontograma e diagnósticos',
  icon: 'Activity',
  dependencies: ['clinica', 'pacientes'],
  permissions: ['odontograma:read', 'odontograma:write', 'odontograma:delete', 'odontograma:admin'],
  routes: [
    '/api/odontograma/charts',
    '/api/odontograma/procedures',
    '/api/odontograma/diagnosis'
  ],
  components: [
    'OdontogramChart',
    'ToothStatus',
    'ProcedureMarker',
    'DiagnosisForm'
  ],
  frontendRoutes: [
    {
      path: '/odontograma',
      component: OdontogramaComponent,
      title: 'Odontograma Digital',
      permissions: ['odontograma:read']
    },
    {
      path: '/odontogram-demo',
      component: OdontogramaComponent,
      title: 'Odontograma Digital',
      permissions: ['odontograma:read']
    }
  ]
};

export interface ToothRecord {
  id: number;
  patientId: number;
  toothNumber: number;
  status: 'healthy' | 'cavity' | 'filled' | 'crown' | 'missing' | 'implant';
  procedures: string[];
  lastUpdate: Date;
  notes?: string;
}