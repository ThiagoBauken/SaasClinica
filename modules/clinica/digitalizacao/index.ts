import { lazy } from 'react';

export const DigitalizacaoPage = lazy(() => import('./DigitalizacaoBasica'));

export default {
  id: 'digitalizacao',
  name: 'Digitalização',
  displayName: 'Digitalização de Registros',
  version: '1.0.0',
  description: 'Sistema de digitalização e extração de dados de fichas odontológicas usando IA',
  dependencies: [],
  routes: [
    {
      path: '/clinica/digitalizacao',
      component: DigitalizacaoPage,
      exact: true
    }
  ],
  permissions: ['read', 'write'],
  icon: 'camera',
  frontendRoutes: [
    {
      path: '/clinica/digitalizacao',
      name: 'Digitalização',
      component: 'DigitalizacaoPage'
    }
  ]
};