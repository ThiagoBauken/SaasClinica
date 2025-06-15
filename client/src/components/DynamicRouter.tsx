import { Route } from "wouter";
import { Suspense, lazy } from "react";
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

// Lazy imports for new modular pages
const ConfiguracoesPage = lazy(() => import("../../../modules/clinica/configuracoes/ConfiguracoesPage"));
const CadastrosPage = lazy(() => import("../../../modules/clinica/cadastros/CadastrosPage"));
const AutomacoesPage = lazy(() => import("../../../modules/clinica/automacoes/AutomacoesPage"));
const ProtesesPage = lazy(() => import("../../../modules/clinica/proteses/ProtesesPage"));
const EstoquePage = lazy(() => import("../../../modules/clinica/estoque/EstoquePage"));
const OdontogramaPage = lazy(() => import("../../../modules/clinica/odontograma/OdontogramaPage"));
const DigitalizacaoPage = lazy(() => import("../../../modules/clinica/digitalizacao/DigitalizacaoPage"));

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

      {/* Novas rotas modularizadas */}
      <Route path="/configuracoes">
        <Suspense fallback={<LoadingFallback />}>
          <ConfiguracoesPage />
        </Suspense>
      </Route>

      <Route path="/cadastros">
        <Suspense fallback={<LoadingFallback />}>
          <CadastrosPage />
        </Suspense>
      </Route>

      <Route path="/automacoes">
        <Suspense fallback={<LoadingFallback />}>
          <AutomacoesPage />
        </Suspense>
      </Route>

      <Route path="/proteses">
        <Suspense fallback={<LoadingFallback />}>
          <ProtesesPage />
        </Suspense>
      </Route>

      <Route path="/estoque">
        <Suspense fallback={<LoadingFallback />}>
          <EstoquePage />
        </Suspense>
      </Route>

      <Route path="/odontograma">
        <Suspense fallback={<LoadingFallback />}>
          <OdontogramaPage />
        </Suspense>
      </Route>
      
      {/* Rotas estáticas temporárias (a serem modularizadas) */}
      
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