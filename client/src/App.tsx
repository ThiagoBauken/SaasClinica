import { Route, Switch, Redirect } from "wouter";
import { Suspense, useContext } from "react";
import { AuthProvider, AuthContext } from "@/core/AuthProvider";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ProtectedRoute } from "@/lib/protected-route";
import { LazyModuleWrapper } from "@/components/LazyModuleLoader";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { CompanyProvider } from "@/contexts/CompanyContext";

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
import ConfiguracoesIntegracoesPage from "@/pages/configuracoes-integracoes";
import AuthPage from "@/pages/auth-page";
import LandingPage from "@/pages/landing-page";
import SaasAdminPage from "@/pages/SaasAdminPage";
import CompanyAdminPage from "@/pages/CompanyAdminPage";
import ClinicModulesPage from "@/pages/ClinicModulesPage";
import ScheduleModularPage from "@/pages/schedule-modular-page";
import PatientRecordPage from "@/pages/patient-record-page";
import NovoAgendamento from "@/pages/novo-agendamento";
import EditarAgendamento from "@/pages/editar-agendamento";
import ScheduleSettingsPage from "@/pages/settings/schedule-page";
import BillingPage from "@/pages/billing-page";
import CouponsAdminPage from "@/pages/coupons-admin-page";
import CheckoutSuccessPage from "@/pages/checkout-success-page";
import CheckoutCanceledPage from "@/pages/checkout-canceled-page";
import PatientDigitizationPage from "@/pages/patient-digitization-page";
import PatientImportPage from "@/pages/patient-import-page";
import AnalyticsPage from "@/pages/analytics-page";
import ChatInboxPage from "@/pages/chat-inbox-page";
import CRMPage from "@/pages/crm-page";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CompanyProvider>
          <NotificationsProvider>
            <Suspense fallback={<div className="flex items-center justify-center h-screen">Carregando...</div>}>
            <Switch>
            {/* Redirecionamento da raiz baseado em autenticação */}
            <Route path="/">
              {() => {
                const authContext = useContext(AuthContext);
                const user = authContext?.user;

                if (!user) {
                  return <Redirect to="/auth" />;
                }

                // Redirecionar baseado no role do usuário
                if (user.role === 'superadmin') {
                  return <Redirect to="/saas-admin" />;
                } else {
                  // Todos os outros usuários (admin, staff, dentist) vão para dashboard
                  return <Redirect to="/dashboard" />;
                }
              }}
            </Route>

            {/* Rotas públicas */}
            <Route path="/auth" component={AuthPage} />
            <Route path="/landing" component={LandingPage} />
            <Route path="/checkout-success" component={CheckoutSuccessPage} />
            <Route path="/checkout-canceled" component={CheckoutCanceledPage} />

            {/* Rotas protegidas */}
            <ProtectedRoute path="/dashboard" component={DashboardPage} />
            <ProtectedRoute path="/patients" component={PatientsPage} />
            <ProtectedRoute path="/pacientes/digitalizar" component={PatientDigitizationPage} />
            <ProtectedRoute path="/pacientes/importar" component={PatientImportPage} />
            <ProtectedRoute path="/patients/:id/record" component={PatientRecordPage} />
            <ProtectedRoute path="/analytics" component={AnalyticsPage} />
            <ProtectedRoute path="/schedule" component={SchedulePage} />
            <ProtectedRoute path="/schedule-modular" component={ScheduleModularPage} />
            <ProtectedRoute path="/agenda" component={AgendaPage} />
            <ProtectedRoute path="/agenda/novo" component={NovoAgendamento} />
            <ProtectedRoute path="/agenda/:id/editar" component={EditarAgendamento} />
            <ProtectedRoute path="/financial" component={FinancialPage} />
            <ProtectedRoute path="/automation" component={AutomationPage} />
            <ProtectedRoute path="/prosthesis" component={ProsthesisControlPage} />
            <ProtectedRoute path="/inventory" component={InventoryPage} />
            <ProtectedRoute path="/odontogram-demo" component={OdontogramDemo} />
            <ProtectedRoute path="/cadastros" component={CadastrosPage} />
            <ProtectedRoute path="/configuracoes" component={ConfiguracoesPage} />
            <ProtectedRoute path="/configuracoes/clinica" component={ConfiguracoesClinicaPage} />
            <ProtectedRoute path="/configuracoes/integracoes" component={ConfiguracoesIntegracoesPage} />
            <ProtectedRoute path="/settings/schedule" component={ScheduleSettingsPage} />
            <ProtectedRoute path="/billing" component={BillingPage} />
            <ProtectedRoute path="/coupons-admin" component={CouponsAdminPage} />
            <ProtectedRoute path="/saas-admin" component={SaasAdminPage} />
            <ProtectedRoute path="/company-admin" component={CompanyAdminPage} />
            <ProtectedRoute path="/clinic-modules" component={ClinicModulesPage} />
            <ProtectedRoute path="/atendimento" component={ChatInboxPage} />
            <ProtectedRoute path="/crm" component={CRMPage} />
            </Switch>
          </Suspense>
          <Toaster />
          </NotificationsProvider>
        </CompanyProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}