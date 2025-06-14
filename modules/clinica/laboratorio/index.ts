// Módulo de Laboratório
import { ModuleDefinition } from '../../index';
import { lazy } from 'react';

// Dynamic import for the laboratory component
export const LaboratorioComponent = lazy(() => import('./LaboratorioPage').then(module => ({ default: module.default })));

export const laboratorioModule: ModuleDefinition = {
  id: 'laboratorio',
  name: 'laboratorio',
  displayName: 'Gestão de Laboratórios',
  version: '1.0.0',
  description: 'Gestão de laboratórios parceiros, pedidos de próteses e contratos',
  icon: 'Building2',
  dependencies: ['clinica'],
  permissions: ['laboratorio:read', 'laboratorio:write', 'laboratorio:delete', 'laboratorio:admin'],
  routes: [
    '/api/laboratorio/laboratories',
    '/api/laboratorio/orders',
    '/api/laboratorio/contracts'
  ],
  components: [
    'LaboratoryList',
    'OrderManager',
    'ContractManager',
    'QualityControl'
  ],
  frontendRoutes: [
    {
      path: '/laboratorio',
      component: LaboratorioComponent,
      title: 'Laboratórios',
      permissions: ['laboratorio:read']
    },
    {
      path: '/laboratorios',
      component: LaboratorioComponent,
      title: 'Gestão de Laboratórios',
      permissions: ['laboratorio:read']
    }
  ]
};

export interface Laboratory {
  id: number;
  companyId: number;
  name: string;
  cnpj: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  specialties: string[];
  rating: number;
  active: boolean;
  deliveryTime: number; // in days
  priceMultiplier: number; // percentage
  createdAt: Date;
  updatedAt: Date;
}

export interface LaboratoryOrder {
  id: number;
  companyId: number;
  laboratoryId: number;
  patientId: number;
  procedureId: number;
  orderDate: Date;
  expectedDelivery: Date;
  actualDelivery?: Date;
  status: 'pending' | 'confirmed' | 'in_production' | 'ready' | 'delivered' | 'cancelled';
  price: number; // in cents
  notes?: string;
  trackingCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LaboratoryContract {
  id: number;
  companyId: number;
  laboratoryId: number;
  procedureType: string;
  basePrice: number; // in cents
  deliveryDays: number;
  qualityScore: number;
  active: boolean;
  validFrom: Date;
  validUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}