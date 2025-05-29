import { Route, Switch, Redirect } from "wouter";
import { Suspense } from "react";
import { AuthProvider } from "@/hooks/use-auth";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ProtectedRoute } from "@/lib/protected-route";

// Import pages diretamente em vez de lazy loading para evitar erros no desenvolvimento
import DashboardPage from "@/pages/dashboard-page";
import PatientsPage from "@/pages/patients-page";
import SchedulePage from "@/pages/schedule-page";
import AgendaPage from "@/pages/agenda-page";
import FinancialPage from "@/pages/financial-page";
import AutomationPage from "@/pages/automation-page";
import ProsthesisControlPage from "@/pages/prosthesis-control-page";
import InventoryPage from "@/pages/inventory-page";
import OdontogramDemo from "@/pages/odontogram-demo";
import CadastrosPage from "@/pages/cadastros-page";
import ConfiguracoesPage from "@/pages/configuracoes-page";
import ConfiguracoesClinicaPage from "@/pages/configuracoes-clinica";
import AuthPage from "@/pages/auth-page";
import LandingPage from "@/pages/landing-page";
import SaasAdminPage from "@/pages/SaasAdminPage";
import CompanyAdminPage from "@/pages/CompanyAdminPage";
import ClinicModulesPage from "@/pages/ClinicModulesPage";
import ClinicDashboard from "@/pages/ClinicDashboard";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Suspense fallback={<div className="flex items-center justify-center h-screen">Carregando...</div>}>
          <Switch>
            {/* Redirecionamento da raiz para o dashboard da clínica */}
            <Route path="/">
              <Redirect to="/clinic-dashboard" />
            </Route>
            
            {/* Rotas públicas */}
            <Route path="/auth" component={AuthPage} />
            <Route path="/landing" component={LandingPage} />
            
            {/* Rotas protegidas */}
            <ProtectedRoute path="/dashboard" component={DashboardPage} />
            <ProtectedRoute path="/patients" component={PatientsPage} />
            <ProtectedRoute path="/schedule" component={SchedulePage} />
            <ProtectedRoute path="/agenda" component={AgendaPage} />
            <ProtectedRoute path="/financial" component={FinancialPage} />
            <ProtectedRoute path="/automation" component={AutomationPage} />
            <ProtectedRoute path="/prosthesis" component={ProsthesisControlPage} />
            <ProtectedRoute path="/inventory" component={InventoryPage} />
            <ProtectedRoute path="/odontogram-demo" component={OdontogramDemo} />
            <ProtectedRoute path="/cadastros" component={CadastrosPage} />
            <ProtectedRoute path="/configuracoes" component={ConfiguracoesPage} />
            <ProtectedRoute path="/configuracoes/clinica" component={ConfiguracoesClinicaPage} />
            <ProtectedRoute path="/saas-admin" component={SaasAdminPage} />
            <ProtectedRoute path="/company-admin" component={CompanyAdminPage} />
            <ProtectedRoute path="/admin/saas" component={SaasAdminPage} />
            <ProtectedRoute path="/admin/company" component={CompanyAdminPage} />
            <ProtectedRoute path="/admin/company/modules" component={ClinicModulesPage} />
            <ProtectedRoute path="/clinic-dashboard" component={ClinicDashboard} />
            <ProtectedRoute path="/calendar" component={AgendaPage} />
          </Switch>
        </Suspense>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}