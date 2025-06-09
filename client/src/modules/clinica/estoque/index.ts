// Módulo Frontend - Estoque
import { lazy } from 'react';

// Lazy loading dos componentes do módulo
export const InventoryPage = lazy(() => import('./EstoquePage'));

// Configuração do módulo frontend
export const estoqueModuleConfig = {
  id: 'estoque',
  name: 'Controle de Estoque',
  routes: [
    {
      path: '/inventory',
      component: InventoryPage,
      title: 'Estoque'
    }
  ],
  menuItems: [
    {
      label: 'Estoque',
      path: '/inventory',
      icon: 'Package'
    }
  ],
  permissions: ['estoque:read', 'estoque:write', 'estoque:delete', 'estoque:admin']
};