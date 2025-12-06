import { Suspense, lazy } from 'react';
import { Route, Switch, useLocation } from 'wouter';
import { useAuth, ProtectedRoute } from './AuthProvider';
import { useActiveModules } from './ModuleLoader';
import type { ModuleRoute as ModuleRouteType } from '@/types';
import LoadingFallback from '@/components/LoadingFallback';

// Páginas estáticas do core
const LoginPage = lazy(() => import('@/pages/login-page'));
const DashboardPage = lazy(() => import('@/pages/dashboard-page'));
const SuperAdminPage = lazy(() => import('@/pages/SuperAdminPage'));
const CompanyAdminPage = lazy(() => import('@/pages/CompanyAdminPage'));
const UnauthorizedPage = lazy(() => import('@/pages/UnauthorizedPage'));
const PublicAnamnesisPage = lazy(() => import('@/pages/public-anamnesis-page'));
const CRMPage = lazy(() => import('@/pages/crm-page'));

// Lazy load de módulos específicos (fallback)
const AgendaPage = lazy(() => import('@/pages/agenda-page'));
const SchedulePage = lazy(() => import('@/pages/schedule-page'));
const ScheduleModularPage = lazy(() => import('@/pages/schedule-modular-page'));
const PatientsPage = lazy(() => import('@/pages/patients-page'));
const PatientImportPage = lazy(() => import('@/pages/patient-import-page'));
const PatientDigitizationPage = lazy(() => import('@/pages/patient-digitization-page'));
const FinancialPage = lazy(() => import('@/pages/financial-page'));
const InventoryPage = lazy(() => import('@/pages/inventory-page'));
const AutomationsPage = lazy(() => import('@/pages/automation-page'));
const OdontogramPage = lazy(() => import('@/pages/odontogram-page'));
const OdontogramDemoPage = lazy(() => import('@/pages/odontogram-demo'));
const PermissionsPage = lazy(() => import('@/pages/permissions-page'));
const IntegrationsConfigPage = lazy(() => import('@/pages/integrations-config-page'));
const ChatInboxPage = lazy(() => import('@/pages/chat-inbox-page'));
const SetupPage = lazy(() => import('@/pages/setup-page'));
const CadastrosPage = lazy(() => import('@/pages/cadastros-page'));
const ConfiguracoesPage = lazy(() => import('@/pages/configuracoes-page'));
const ConfiguracoesChatPage = lazy(() => import('@/pages/configuracoes-chat'));
const ConfiguracoesHorariosPage = lazy(() => import('@/pages/configuracoes-horarios'));
const BillingPage = lazy(() => import('@/pages/billing-page'));
const SaasAdminPage = lazy(() => import('@/pages/SaasAdminPage'));
const ProsthesisControlPage = lazy(() => import('@/pages/prosthesis-control-page'));
const LaboratoryManagementPage = lazy(() => import('@/pages/laboratory-management'));
const AnalyticsPage = lazy(() => import('@/pages/analytics-page'));
const CheckoutSuccessPage = lazy(() => import('@/pages/checkout-success-page'));
const CheckoutCanceledPage = lazy(() => import('@/pages/checkout-canceled-page'));
const CouponsAdminPage = lazy(() => import('@/pages/coupons-admin-page'));

export default function DynamicRouter() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { modules, isLoading: modulesLoading } = useActiveModules();
  const [location] = useLocation();

  // Mostrar loading enquanto carrega autenticação
  if (isLoading) {
    return <LoadingFallback message="Autenticando..." fullScreen={true} />;
  }

  // Rotas públicas que não precisam de autenticação
  const publicRoutes = ['/login', '/unauthorized'];
  const isPublicRoute = publicRoutes.some(route => location.startsWith(route)) || location.startsWith('/anamnese/');

  // Redirecionamento para login se não autenticado (exceto rotas públicas)
  if (!isAuthenticated && !isPublicRoute) {
    return (
      <Suspense fallback={<LoadingFallback message="Carregando login..." fullScreen={true} />}>
        <LoginPage />
      </Suspense>
    );
  }

  // Redirecionamento baseado no role após login
  if (isAuthenticated && location === '/') {
    if (user?.role === 'superadmin') {
      window.location.href = '/superadmin';
      return null;
    } else if (user?.role === 'admin') {
      window.location.href = '/admin';
      return null;
    } else {
      window.location.href = '/dashboard';
      return null;
    }
  }

  return (
    <Suspense fallback={<LoadingFallback message="Carregando..." />}>
      <Switch>
        {/* Rota pública de anamnese (sem autenticação) */}
        <Route path="/anamnese/:token">
          <PublicAnamnesisPage />
        </Route>

        {/* Rota de login */}
        <Route path="/login">
          <LoginPage />
        </Route>

        {/* Rota de não autorizado */}
        <Route path="/unauthorized">
          <UnauthorizedPage />
        </Route>

        {/* Rotas do SuperAdmin */}
        <Route path="/superadmin">
          <ProtectedRoute requiredRole="superadmin">
            <SuperAdminPage />
          </ProtectedRoute>
        </Route>

        {/* Rotas do Admin da Empresa */}
        <Route path="/admin">
          <ProtectedRoute requiredRole="admin">
            <CompanyAdminPage />
          </ProtectedRoute>
        </Route>

        {/* Gerenciamento de Permissões - Apenas Admin */}
        <Route path="/permissions">
          <ProtectedRoute requiredRole="admin">
            <PermissionsPage />
          </ProtectedRoute>
        </Route>

        {/* Dashboard principal */}
        <Route path="/dashboard">
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        </Route>

        {/* Rotas dinâmicas dos módulos */}
        {!modulesLoading && modules.map(module =>
          module.definition.routes?.map((route: any) => (
            <Route key={route.path} path={route.path}>
              <ProtectedRoute>
                <ModuleRoute 
                  component={route.component} 
                  permissions={route.permissions}
                />
              </ProtectedRoute>
            </Route>
          ))
        )}

        {/* Rotas estáticas (fallback) para módulos não modularizados ainda */}
        <Route path="/agenda">
          <ProtectedRoute>
            <AgendaPage />
          </ProtectedRoute>
        </Route>

        <Route path="/schedule">
          <ProtectedRoute>
            <SchedulePage />
          </ProtectedRoute>
        </Route>

        <Route path="/schedule-modular">
          <ProtectedRoute>
            <ScheduleModularPage />
          </ProtectedRoute>
        </Route>

        <Route path="/pacientes">
          <ProtectedRoute>
            <PatientsPage />
          </ProtectedRoute>
        </Route>

        <Route path="/patients">
          <ProtectedRoute>
            <PatientsPage />
          </ProtectedRoute>
        </Route>

        <Route path="/pacientes/importar">
          <ProtectedRoute>
            <PatientImportPage />
          </ProtectedRoute>
        </Route>

        <Route path="/pacientes/digitalizar">
          <ProtectedRoute>
            <PatientDigitizationPage />
          </ProtectedRoute>
        </Route>

        <Route path="/financeiro">
          <ProtectedRoute>
            <FinancialPage />
          </ProtectedRoute>
        </Route>

        <Route path="/financial">
          <ProtectedRoute>
            <FinancialPage />
          </ProtectedRoute>
        </Route>

        <Route path="/estoque">
          <ProtectedRoute>
            <InventoryPage />
          </ProtectedRoute>
        </Route>

        <Route path="/inventory">
          <ProtectedRoute>
            <InventoryPage />
          </ProtectedRoute>
        </Route>

        <Route path="/automacoes">
          <ProtectedRoute>
            <AutomationsPage />
          </ProtectedRoute>
        </Route>

        <Route path="/automation">
          <ProtectedRoute>
            <AutomationsPage />
          </ProtectedRoute>
        </Route>

        <Route path="/integracoes">
          <ProtectedRoute requiredRole="admin">
            <IntegrationsConfigPage />
          </ProtectedRoute>
        </Route>

        {/* Página de Setup Inicial - Apenas Admin */}
        <Route path="/setup">
          <ProtectedRoute requiredRole="admin">
            <SetupPage />
          </ProtectedRoute>
        </Route>

        <Route path="/atendimento">
          <ProtectedRoute>
            <ChatInboxPage />
          </ProtectedRoute>
        </Route>

        <Route path="/crm">
          <ProtectedRoute>
            <CRMPage />
          </ProtectedRoute>
        </Route>

        <Route path="/odontograma">
          <ProtectedRoute>
            <OdontogramPage />
          </ProtectedRoute>
        </Route>

        <Route path="/odontogram-demo">
          <ProtectedRoute>
            <OdontogramDemoPage />
          </ProtectedRoute>
        </Route>

        {/* Cadastros e Configurações */}
        <Route path="/cadastros">
          <ProtectedRoute>
            <CadastrosPage />
          </ProtectedRoute>
        </Route>

        <Route path="/configuracoes">
          <ProtectedRoute>
            <ConfiguracoesPage />
          </ProtectedRoute>
        </Route>

        <Route path="/configuracoes/chat">
          <ProtectedRoute requiredRole="admin">
            <ConfiguracoesChatPage />
          </ProtectedRoute>
        </Route>

        <Route path="/configuracoes/horarios">
          <ProtectedRoute requiredRole="admin">
            <ConfiguracoesHorariosPage />
          </ProtectedRoute>
        </Route>

        {/* Billing e Checkout */}
        <Route path="/billing">
          <ProtectedRoute>
            <BillingPage />
          </ProtectedRoute>
        </Route>

        <Route path="/checkout-success">
          <ProtectedRoute>
            <CheckoutSuccessPage />
          </ProtectedRoute>
        </Route>

        <Route path="/checkout-canceled">
          <ProtectedRoute>
            <CheckoutCanceledPage />
          </ProtectedRoute>
        </Route>

        {/* Próteses e Laboratório */}
        <Route path="/prosthesis">
          <ProtectedRoute>
            <ProsthesisControlPage />
          </ProtectedRoute>
        </Route>

        <Route path="/proteses">
          <ProtectedRoute>
            <ProsthesisControlPage />
          </ProtectedRoute>
        </Route>

        <Route path="/laboratorio">
          <ProtectedRoute>
            <LaboratoryManagementPage />
          </ProtectedRoute>
        </Route>

        {/* Analytics */}
        <Route path="/analytics">
          <ProtectedRoute requiredRole="admin">
            <AnalyticsPage />
          </ProtectedRoute>
        </Route>

        {/* Admin SaaS - Apenas Superadmin */}
        <Route path="/saas-admin">
          <ProtectedRoute requiredRole="superadmin">
            <SaasAdminPage />
          </ProtectedRoute>
        </Route>

        {/* Admin de Cupons */}
        <Route path="/coupons-admin">
          <ProtectedRoute requiredRole="superadmin">
            <CouponsAdminPage />
          </ProtectedRoute>
        </Route>

        {/* Company Admin (alias) */}
        <Route path="/company-admin">
          <ProtectedRoute requiredRole="admin">
            <CompanyAdminPage />
          </ProtectedRoute>
        </Route>

        {/* Rota padrão - redirecionamento */}
        <Route>
          <DefaultRedirect />
        </Route>
      </Switch>
    </Suspense>
  );
}

// Componente para rotas de módulos com verificação de permissões
function ModuleRoute({ 
  component: Component, 
  permissions 
}: { 
  component: React.LazyExoticComponent<any>;
  permissions?: string[];
}) {
  // TODO: Implementar verificação de permissões específicas
  // Por enquanto, permite acesso se o usuário está autenticado
  
  return (
    <Suspense fallback={<LoadingFallback message="Carregando..." />}>
      <Component />
    </Suspense>
  );
}

// Componente para redirecionamento padrão baseado no role
function DefaultRedirect() {
  const { user } = useAuth();
  
  if (user?.role === 'superadmin') {
    window.location.href = '/superadmin';
  } else if (user?.role === 'admin') {
    window.location.href = '/admin';
  } else {
    window.location.href = '/dashboard';
  }
  
  return <LoadingFallback />;
}