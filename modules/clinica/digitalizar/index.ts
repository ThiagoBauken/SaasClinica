export { default as DigitalizarPageComplete } from './DigitalizarPageComplete';

export const digitalizarModuleDefinition = {
  id: 'digitalizar',
  name: 'Digitalização de Fichas',
  displayName: 'Digitalizar Fichas',
  version: '1.0.0',
  description: 'Sistema de digitalização inteligente que converte fichas odontológicas físicas em dados estruturados usando OCR + IA',
  dependencies: [],
  routes: [
    { path: '/digitalizar', component: 'DigitalizarPageComplete' }
  ],
  components: ['DigitalizarPageComplete'],
  permissions: ['read', 'write'],
  icon: 'FileText',
  frontendRoutes: [
    { path: '/clinica/digitalizar', component: 'DigitalizarPageComplete', title: 'Digitalizar Fichas' }
  ]
};