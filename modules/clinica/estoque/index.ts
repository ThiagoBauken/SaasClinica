// Módulo de Estoque
import { ModuleDefinition } from '../../index';
import { lazy } from 'react';

// Dynamic import for the inventory component
export const EstoqueComponent = lazy(() => import('./EstoquePage').then(module => ({ default: module.default })));

export const estoqueModule: ModuleDefinition = {
  id: 'estoque',
  name: 'estoque',
  displayName: 'Controle de Estoque',
  version: '1.0.0',
  description: 'Gestão de inventário e materiais odontológicos',
  icon: 'Package',
  dependencies: ['clinica'],
  permissions: ['estoque:read', 'estoque:write', 'estoque:delete', 'estoque:admin'],
  routes: [
    '/api/estoque/items',
    '/api/estoque/categories',
    '/api/estoque/movements'
  ],
  components: [
    'InventoryList',
    'ItemForm',
    'StockMovements',
    'LowStockAlerts'
  ],
  frontendRoutes: [
    {
      path: '/estoque',
      component: EstoqueComponent,
      title: 'Controle de Estoque',
      permissions: ['estoque:read']
    },
    {
      path: '/inventory',
      component: EstoqueComponent,
      title: 'Controle de Estoque',
      permissions: ['estoque:read']
    }
  ]
};

export interface InventoryItem {
  id: number;
  name: string;
  category: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unit: string;
  cost: number;
  supplier: string;
  expirationDate?: Date;
}