import { Route } from "wouter";
import { Suspense } from "react";
import { ProtectedRoute } from "@/lib/protected-route";
import { useModules } from "@/hooks/use-modules";

// Import páginas que serão gradualmente migradas para módulos
import DashboardPage from "@/pages/dashboard-page";
import SchedulePage from "@/pages/schedule-page";

// Import páginas estáticas que ainda não foram modularizadas
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
      {/* Dashboard */}
      <ProtectedRoute path="/dashboard" component={DashboardPage} />
      
      {/* Agenda/Schedule */}
      <ProtectedRoute path="/schedule" component={SchedulePage} />
      <ProtectedRoute path="/agenda" component={SchedulePage} />
      
      {/* Rotas modularizadas existentes */}
      <Route path="/patients">
        <Suspense fallback={<LoadingFallback />}>
          <PatientsPage />
        </Suspense>
      </Route>
      
      <Route path="/financial">
        <Suspense fallback={<LoadingFallback />}>
          <FinancialPage />
        </Suspense>
      </Route>
      
      {/* Rotas estáticas temporárias (a serem modularizadas) */}
      <ProtectedRoute path="/odontogram-demo" component={OdontogramDemo} />
      
      {/* Rotas dinâmicas dos módulos */}
      {dynamicRoutes.map((route) => (
        <Route key={route.path} path={route.path} component={() => (
          <Suspense fallback={<LoadingFallback />}>
            <route.component />
          </Suspense>
        )} />
      ))}
    </>
  );
}