// Módulo Frontend - Financeiro
import { lazy } from 'react';

// Lazy loading dos componentes do módulo
export const FinancialPage = lazy(() => import('../../../pages/financial-page'));

// Configuração do módulo frontend
export const financeiroModuleConfig = {
  id: 'financeiro',
  name: 'Gestão Financeira',
  routes: [
    {
      path: '/financial',
      component: FinancialPage,
      title: 'Financeiro'
    }
  ],
  menuItems: [
    {
      label: 'Financeiro',
      path: '/financial',
      icon: 'DollarSign'
    }
  ],
  permissions: ['financeiro:read', 'financeiro:write', 'financeiro:delete', 'financeiro:admin']
};