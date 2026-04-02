// Módulo Frontend - Odontograma
import { lazy } from 'react';

// Lazy loading dos componentes do módulo
export const OdontogramPage = lazy(() => import('../../../pages/odontogram-page'));

// Configuração do módulo frontend
export const odontogramaModuleConfig = {
  id: 'odontograma',
  name: 'Odontograma Digital',
  routes: [
    {
      path: '/odontogram',
      component: OdontogramPage,
      title: 'Odontograma'
    }
  ],
  menuItems: [
    {
      label: 'Odontograma',
      path: '/odontogram',
      icon: 'Activity'
    }
  ],
  permissions: ['odontograma:read', 'odontograma:write', 'odontograma:delete', 'odontograma:admin']
};
