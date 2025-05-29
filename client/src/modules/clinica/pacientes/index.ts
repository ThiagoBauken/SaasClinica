// Módulo Frontend - Pacientes
import { lazy } from 'react';

// Lazy loading dos componentes do módulo
export const PatientsPage = lazy(() => import('../../../pages/patients-page'));

// Configuração do módulo frontend
export const pacientesModuleConfig = {
  id: 'pacientes',
  name: 'Gestão de Pacientes',
  routes: [
    {
      path: '/patients',
      component: PatientsPage,
      title: 'Pacientes'
    }
  ],
  menuItems: [
    {
      label: 'Pacientes',
      path: '/patients',
      icon: 'Users'
    }
  ],
  permissions: ['pacientes:read', 'pacientes:write', 'pacientes:delete', 'pacientes:admin']
};