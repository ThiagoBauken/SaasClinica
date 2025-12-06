import { lazy, LazyExoticComponent, ComponentType } from 'react';

/**
 * Lazy-loaded components for code splitting and performance optimization
 * Each component is loaded only when needed, reducing initial bundle size
 */

// Type for components with preload capability
type PreloadableComponent<T extends ComponentType<unknown>> = LazyExoticComponent<T> & {
  preload?: () => Promise<{ default: T }>;
};

// Helper to create preloadable lazy components
function lazyWithPreload<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>
): PreloadableComponent<T> {
  const Component = lazy(factory) as PreloadableComponent<T>;
  Component.preload = factory;
  return Component;
}

// ===== Analytics & Reports =====
export const AnalyticsPage = lazyWithPreload(() => import('@/pages/analytics-page'));

// ===== Patient Management =====
export const PatientsPage = lazyWithPreload(() => import('@/pages/patients-page'));
export const PatientRecordPage = lazyWithPreload(() => import('@/pages/patient-record-page'));
export const PatientImportPage = lazyWithPreload(() => import('@/pages/patient-import-page'));
export const PatientDigitizationPage = lazyWithPreload(() => import('@/pages/patient-digitization-page'));

// ===== Scheduling/Agenda =====
export const AgendaPage = lazyWithPreload(() => import('@/pages/agenda-page'));
export const NovoAgendamento = lazyWithPreload(() => import('@/pages/novo-agendamento'));
export const EditarAgendamento = lazyWithPreload(() => import('@/pages/editar-agendamento'));

// ===== Financial =====
export const BillingPage = lazyWithPreload(() => import('@/pages/billing-page'));

// ===== Inventory =====
export const InventoryPage = lazyWithPreload(() => import('@/pages/inventory-page'));

// ===== Prosthesis Control =====
export const ProsthesisControlPage = lazyWithPreload(() => import('@/pages/prosthesis-control-page'));

// ===== Automation =====
export const AutomationPage = lazyWithPreload(() => import('@/pages/automation-page'));

// ===== Settings =====
export const ConfiguracoesPage = lazyWithPreload(() => import('@/pages/configuracoes-page'));
export const ConfiguracoesClinica = lazyWithPreload(() => import('@/pages/configuracoes-clinica'));
export const ConfiguracoesIntegracoes = lazyWithPreload(() => import('@/pages/configuracoes-integracoes'));

// ===== Admin Pages =====
export const SuperAdminPage = lazyWithPreload(() => import('@/pages/SuperAdminPage'));
export const CompanyAdminPage = lazyWithPreload(() => import('@/pages/CompanyAdminPage'));
export const ClinicModulesPage = lazyWithPreload(() => import('@/pages/ClinicModulesPage'));
export const SaasAdminPage = lazyWithPreload(() => import('@/pages/SaasAdminPage'));

// Map for type-safe preloading
const componentMap = {
  AnalyticsPage,
  PatientsPage,
  PatientRecordPage,
  PatientImportPage,
  PatientDigitizationPage,
  AgendaPage,
  NovoAgendamento,
  EditarAgendamento,
  BillingPage,
  InventoryPage,
  ProsthesisControlPage,
  AutomationPage,
  ConfiguracoesPage,
  ConfiguracoesClinica,
  ConfiguracoesIntegracoes,
  SuperAdminPage,
  CompanyAdminPage,
  ClinicModulesPage,
  SaasAdminPage,
} as const;

/**
 * Preload function to eager-load components on user interaction
 * Example: onMouseEnter={() => preloadComponent('AnalyticsPage')}
 */
export function preloadComponent(componentName: keyof typeof componentMap) {
  const component = componentMap[componentName];
  if (component && component.preload) {
    component.preload();
  }
}
