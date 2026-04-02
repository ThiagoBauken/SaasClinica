import { Route, Switch, Redirect } from "wouter";
import { Suspense, useContext, useEffect } from "react";
import { AuthProvider, AuthContext } from "@/core/AuthProvider";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ProtectedRoute } from "@/lib/protected-route";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { initCsrfToken } from "@/lib/csrf";

// Import pages diretamente em vez de lazy loading para evitar erros no desenvolvimento
import DashboardPage from "@/pages/dashboard-page";
import PatientsPage from "@/pages/patients-page";
import AgendaPage from "@/pages/agenda-page";
import FinancialPage from "@/pages/financial-page";
import AutomationPage from "@/pages/automation-page";
import ProsthesisControlPage from "@/pages/prosthesis-control-page";
import InventoryPage from "@/pages/inventory-page";
import OdontogramPage from "@/pages/odontogram-page";
import CadastrosPage from "@/pages/cadastros-page";
import ConfiguracoesPage from "@/pages/configuracoes-page";
import ConfiguracoesClinicaPage from "@/pages/configuracoes-clinica";
import ConfiguracoesIntegracoesPage from "@/pages/configuracoes-integracoes";
import AuthPage from "@/pages/auth-page";
import LandingPage from "@/pages/landing-page";
import SaasAdminPage from "@/pages/SaasAdminPage";
import SuperAdminPage from "@/pages/SuperAdminPage";
import CompanyAdminPage from "@/pages/CompanyAdminPage";
import ClinicModulesPage from "@/pages/ClinicModulesPage";
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
import PerfilPage from "@/pages/perfil-page";
import PermissionsPage from "@/pages/permissions-page";
import IntegrationsConfigPage from "@/pages/integrations-config-page";
import ConfiguracoesHorariosPage from "@/pages/configuracoes-horarios";
import ConfiguracoesChatPage from "@/pages/configuracoes-chat";
import PublicConfirmationPage from "@/pages/public-confirmation-page";
import ConfiguracoesUsuariosPage from "@/pages/configuracoes-usuarios";
import ConfiguracoesProcedimentosPage from "@/pages/configuracoes-procedimentos";
import ConfiguracoesSalasPage from "@/pages/configuracoes-salas";
import ConfiguracoesNotificacoesPage from "@/pages/configuracoes-notificacoes";
import ConfiguracoesFinanceiroPage from "@/pages/configuracoes-financeiro";
import ConfiguracoesImpressaoPage from "@/pages/configuracoes-impressao";
import ConfiguracoesAparenciaPage from "@/pages/configuracoes-aparencia";
import ConfiguracoesBackupPage from "@/pages/configuracoes-backup";
import ConfiguracoesIAPage from "@/pages/configuracoes-ia";
import LaboratoryManagementPage from "@/pages/laboratory-management";
import RelatoriosPage from "@/pages/relatorios-page";
import TeleconsultaPage from "@/pages/teleconsulta-page";
import OfficeChatPage from "@/pages/office-chat-page";
import PatientPaymentsPage from "@/pages/patient-payments-page";
import TermosDeUsoPage from "@/pages/termos-de-uso";
import PoliticaDePrivacidadePage from "@/pages/politica-de-privacidade";
import LGPDPage from "@/pages/lgpd-page";
import AjudaPage from "@/pages/ajuda-page";

export default function App() {
  // Initialize CSRF token on app startup
  useEffect(() => {
    initCsrfToken();
  }, []);

  return (
    <ErrorBoundary>
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
            <Route path="/termos-de-uso" component={TermosDeUsoPage} />
            <Route path="/politica-de-privacidade" component={PoliticaDePrivacidadePage} />
            <Route path="/lgpd" component={LGPDPage} />
            <Route path="/confirmar/:token" component={PublicConfirmationPage} />

            {/* Rotas protegidas */}
            <ProtectedRoute path="/dashboard" component={DashboardPage} />
            <ProtectedRoute path="/patients" component={PatientsPage} />
            <ProtectedRoute path="/pacientes/digitalizar" component={PatientDigitizationPage} />
            <ProtectedRoute path="/pacientes/importar" component={PatientImportPage} />
            <ProtectedRoute path="/patients/:id/record" component={PatientRecordPage} />
            <ProtectedRoute path="/analytics" component={AnalyticsPage} />
            <ProtectedRoute path="/agenda" component={AgendaPage} />
            <Route path="/schedule">{() => <Redirect to="/agenda" />}</Route>
            <ProtectedRoute path="/agenda/novo" component={NovoAgendamento} />
            <ProtectedRoute path="/agenda/:id/editar" component={EditarAgendamento} />
            <ProtectedRoute path="/financial" component={FinancialPage} />
            <ProtectedRoute path="/automation" component={AutomationPage} />
            <ProtectedRoute path="/prosthesis" component={ProsthesisControlPage} />
            <ProtectedRoute path="/inventory" component={InventoryPage} />
            <ProtectedRoute path="/odontogram" component={OdontogramPage} />
            <ProtectedRoute path="/cadastros" component={CadastrosPage} />
            <ProtectedRoute path="/configuracoes" component={ConfiguracoesPage} />
            <ProtectedRoute path="/configuracoes/clinica" component={ConfiguracoesClinicaPage} />
            <ProtectedRoute path="/configuracoes/integracoes" component={ConfiguracoesIntegracoesPage} />
            <ProtectedRoute path="/configuracoes/horarios" component={ConfiguracoesHorariosPage} />
            <ProtectedRoute path="/configuracoes/chat" component={ConfiguracoesChatPage} />
            <ProtectedRoute path="/configuracoes/usuarios" component={ConfiguracoesUsuariosPage} />
            <ProtectedRoute path="/configuracoes/procedimentos" component={ConfiguracoesProcedimentosPage} />
            <ProtectedRoute path="/configuracoes/salas" component={ConfiguracoesSalasPage} />
            <ProtectedRoute path="/configuracoes/notificacoes" component={ConfiguracoesNotificacoesPage} />
            <ProtectedRoute path="/configuracoes/financeiro" component={ConfiguracoesFinanceiroPage} />
            <ProtectedRoute path="/configuracoes/impressao" component={ConfiguracoesImpressaoPage} />
            <ProtectedRoute path="/configuracoes/aparencia" component={ConfiguracoesAparenciaPage} />
            <ProtectedRoute path="/configuracoes/backup" component={ConfiguracoesBackupPage} />
            <ProtectedRoute path="/configuracoes/ia" component={ConfiguracoesIAPage} />
            <ProtectedRoute path="/settings/schedule" component={ScheduleSettingsPage} />
            <ProtectedRoute path="/billing" component={BillingPage} />
            <ProtectedRoute path="/coupons-admin" component={CouponsAdminPage} />
            <ProtectedRoute path="/saas-admin" component={SaasAdminPage} />
            <ProtectedRoute path="/superadmin" component={SuperAdminPage} />
            <ProtectedRoute path="/company-admin" component={CompanyAdminPage} />
            <ProtectedRoute path="/clinic-modules" component={ClinicModulesPage} />
            <ProtectedRoute path="/atendimento" component={ChatInboxPage} />
            <ProtectedRoute path="/crm" component={CRMPage} />
            <ProtectedRoute path="/perfil" component={PerfilPage} />
            <ProtectedRoute path="/permissions" component={PermissionsPage} />
            <ProtectedRoute path="/integracoes" component={IntegrationsConfigPage} />
            <ProtectedRoute path="/laboratorio" component={LaboratoryManagementPage} />
            <ProtectedRoute path="/relatorios" component={RelatoriosPage} />
            <ProtectedRoute path="/teleconsulta" component={TeleconsultaPage} />
            <ProtectedRoute path="/chat-interno" component={OfficeChatPage} />
            <ProtectedRoute path="/pagamentos-paciente" component={PatientPaymentsPage} />
            <ProtectedRoute path="/ajuda" component={AjudaPage} />
            </Switch>
          </Suspense>
          <Toaster />
          </NotificationsProvider>
        </CompanyProvider>
      </AuthProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}