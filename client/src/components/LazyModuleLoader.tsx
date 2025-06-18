import { Suspense, lazy } from 'react';

// Lazy loading dos módulos principais
const LazySchedulePage = lazy(() => import('@/pages/schedule-page'));
const LazyPatientsPage = lazy(() => import('@/pages/patients-page'));
const LazyFinancialPage = lazy(() => import('@/pages/financial-page'));
const LazyAutomationPage = lazy(() => import('@/pages/automation-page'));
const LazyProsthesisPage = lazy(() => import('@/pages/prosthesis-control-page'));
const LazyInventoryPage = lazy(() => import('@/pages/inventory-page'));
const LazyOdontogramPage = lazy(() => import('@/pages/odontogram-demo'));

// Componente de loading
const ModuleLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="text-lg">Carregando módulo...</div>
  </div>
);

// Map de módulos lazy
export const lazyModules = {
  schedule: LazySchedulePage,
  patients: LazyPatientsPage,
  financial: LazyFinancialPage,
  automation: LazyAutomationPage,
  prosthesis: LazyProsthesisPage,
  inventory: LazyInventoryPage,
  odontogram: LazyOdontogramPage,
};

// Wrapper simples para carregar módulos com segurança
export function LazyModuleWrapper({ 
  moduleName, 
  fallback 
}: { 
  moduleName: keyof typeof lazyModules;
  fallback?: React.ComponentType;
}) {
  const LazyComponent = lazyModules[moduleName];
  const FallbackComponent = fallback;

  if (!LazyComponent && FallbackComponent) {
    return <FallbackComponent />;
  }

  if (!LazyComponent) {
    return <div>Módulo não encontrado</div>;
  }

  return (
    <Suspense fallback={<ModuleLoader />}>
      <LazyComponent />
    </Suspense>
  );
}