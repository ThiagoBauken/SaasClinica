// Módulo de Cadastros
import { ModuleDefinition } from '../../index';
import { lazy } from 'react';

// Dynamic import for the cadastros component
export const CadastrosComponent = lazy(() => import('./CadastrosPage').then(module => ({ default: module.default })));

export const cadastrosModule: ModuleDefinition = {
  id: 'cadastros',
  name: 'cadastros',
  displayName: 'Cadastros Gerais',
  version: '1.0.0',
  description: 'Cadastro e gerenciamento de profissionais, salas e procedimentos',
  icon: 'UserPlus',
  dependencies: ['clinica'],
  permissions: ['cadastros:read', 'cadastros:write', 'cadastros:delete', 'cadastros:admin'],
  routes: [
    '/api/cadastros/professionals',
    '/api/cadastros/rooms',
    '/api/cadastros/procedures'
  ],
  components: [
    'ProfessionalForm',
    'RoomManager',
    'ProcedureList',
    'RegistrationWizard'
  ],
  frontendRoutes: [
    {
      path: '/cadastros',
      component: CadastrosComponent,
      title: 'Cadastros',
      permissions: ['cadastros:read']
    }
  ]
};

export interface Professional {
  id: number;
  companyId: number;
  name: string;
  speciality: string;
  cro: string;
  phone: string;
  email: string;
  active: boolean;
  userId?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Room {
  id: number;
  companyId: number;
  name: string;
  description?: string;
  capacity: number;
  equipment: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcedureDefinition {
  id: number;
  companyId: number;
  name: string;
  description?: string;
  category: string;
  duration: number; // in minutes
  price: number; // in cents
  requiresRoom: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}