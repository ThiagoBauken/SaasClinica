// Módulo de Próteses
import { ModuleDefinition } from '../../index';

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