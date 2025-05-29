import { Route } from "wouter";
import { Suspense } from "react";
import { ProtectedRoute } from "@/lib/protected-route";
import { useModules } from "@/hooks/use-modules";

// Import páginas estáticas que ainda não foram modularizadas
import DashboardPage from "@/pages/dashboard-page";
import SchedulePage from "@/pages/schedule-page";
import AutomationPage from "@/pages/automation-page";
import ProsthesisControlPage from "@/pages/prosthesis-control-page";
import InventoryPage from "@/pages/inventory-page";
import OdontogramDemo from "@/pages/odontogram-demo";

// Import páginas modularizadas
import { PatientsPage } from "@/modules/clinica/pacientes";
import { FinancialPage } from "@/modules/clinica/financeiro";

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="text-lg">Carregando módulo...</div>
  </div>
);

export function DynamicRouter() {
  const { dynamicRoutes, isLoading } = useModules();

  if (isLoading) {
    return <LoadingFallback />;
  }

  return (
    <>
      {/* Dashboard sempre disponível */}
      <ProtectedRoute path="/dashboard" component={DashboardPage} />
      
      {/* Rotas modularizadas */}
      <ProtectedRoute path="/patients">
        <Suspense fallback={<LoadingFallback />}>
          <PatientsPage />
        </Suspense>
      </ProtectedRoute>
      
      <ProtectedRoute path="/financial">
        <Suspense fallback={<LoadingFallback />}>
          <FinancialPage />
        </Suspense>
      </ProtectedRoute>
      
      {/* Rotas estáticas temporárias (a serem modularizadas) */}
      <ProtectedRoute path="/schedule" component={SchedulePage} />
      <ProtectedRoute path="/automation" component={AutomationPage} />
      <ProtectedRoute path="/prosthesis" component={ProsthesisControlPage} />
      <ProtectedRoute path="/inventory" component={InventoryPage} />
      <ProtectedRoute path="/odontogram-demo" component={OdontogramDemo} />
      
      {/* Rotas dinâmicas dos módulos (futuro) */}
      {dynamicRoutes.map((route) => (
        <ProtectedRoute key={route.path} path={route.path}>
          <Suspense fallback={<LoadingFallback />}>
            <route.component />
          </Suspense>
        </ProtectedRoute>
      ))}
    </>
  );
}