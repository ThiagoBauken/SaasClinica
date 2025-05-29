// Módulo Frontend - Odontograma
import { lazy } from 'react';

// Lazy loading dos componentes do módulo
export const OdontogramDemo = lazy(() => import('../../../pages/odontogram-demo'));

// Configuração do módulo frontend
export const odontogramaModuleConfig = {
  id: 'odontograma',
  name: 'Odontograma Digital',
  routes: [
    {
      path: '/odontogram-demo',
      component: OdontogramDemo,
      title: 'Odontograma'
    }
  ],
  menuItems: [
    {
      label: 'Odontograma',
      path: '/odontogram-demo',
      icon: 'Activity'
    }
  ],
  permissions: ['odontograma:read', 'odontograma:write', 'odontograma:delete', 'odontograma:admin']
};