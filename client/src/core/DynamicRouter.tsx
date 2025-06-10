import { Suspense, lazy } from 'react';
import { Route, Switch, useLocation } from 'wouter';
import { useAuth, ProtectedRoute } from './AuthProvider';
import { useActiveModules } from './ModuleLoader';

// Páginas estáticas do core
const LoginPage = lazy(() => import('@/pages/login-page'));
const DashboardPage = lazy(() => import('@/pages/dashboard-page'));
const SuperAdminPage = lazy(() => import('@/pages/SuperAdminPage'));
const CompanyAdminPage = lazy(() => import('@/pages/CompanyAdminPage'));
const UnauthorizedPage = lazy(() => import('@/pages/UnauthorizedPage'));

// Lazy load de módulos específicos (fallback)
const AgendaPage = lazy(() => import('@/pages/agenda-page'));
const PatientsPage = lazy(() => import('@/pages/patients-page'));
const FinancialPage = lazy(() => import('@/pages/financial-page'));
const InventoryPage = lazy(() => import('@/pages/inventory-page'));
const AutomationsPage = lazy(() => import('@/pages/automations-page'));
const OdontogramPage = lazy(() => import('@/pages/odontogram-page'));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-lg">Carregando...</div>
    </div>
  );
}

export default function DynamicRouter() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { modules, isLoading: modulesLoading } = useActiveModules();
  const [location] = useLocation();

  // Mostrar loading enquanto carrega autenticação
  if (isLoading) {
    return <LoadingFallback />;
  }

  // Redirecionamento para login se não autenticado
  if (!isAuthenticated && location !== '/login') {
    return (
      <Suspense fallback={<LoadingFallback />}>
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
    <Suspense fallback={<LoadingFallback />}>
      <Switch>
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

        {/* Dashboard principal */}
        <Route path="/dashboard">
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        </Route>

        {/* Rotas dinâmicas dos módulos */}
        {!modulesLoading && modules.map(module => 
          module.routes?.map(route => (
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

        <Route path="/pacientes">
          <ProtectedRoute>
            <PatientsPage />
          </ProtectedRoute>
        </Route>

        <Route path="/financeiro">
          <ProtectedRoute>
            <FinancialPage />
          </ProtectedRoute>
        </Route>

        <Route path="/estoque">
          <ProtectedRoute>
            <InventoryPage />
          </ProtectedRoute>
        </Route>

        <Route path="/automacoes">
          <ProtectedRoute>
            <AutomationsPage />
          </ProtectedRoute>
        </Route>

        <Route path="/odontograma">
          <ProtectedRoute>
            <OdontogramPage />
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
    <Suspense fallback={<LoadingFallback />}>
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