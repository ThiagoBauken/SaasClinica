import { lazy } from 'react';

export const DigitalizarPage = lazy(() => import('./DigitalizarPageSimple'));

export default {
  id: 'digitalizar',
  name: 'Digitalizar',
  displayName: 'Digitalizar',
  version: '1.0.0',
  description: 'Digitalização de fichas odontológicas com IA',
  icon: 'Camera',
  permissions: ['read', 'write']
};