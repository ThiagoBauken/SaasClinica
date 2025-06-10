import { Suspense } from 'react';
import { Route, Switch, useLocation } from 'wouter';
import { useAuth, ProtectedRoute } from './AuthProvider';

// Import pages directly to avoid module resolution issues
import AuthPage from '@/pages/auth-page';
import DashboardPage from '@/pages/dashboard-page';
import SuperAdminPage from '@/pages/SuperAdminPage';
import CompanyAdminPage from '@/pages/CompanyAdminPage';
import UnauthorizedPage from '@/pages/UnauthorizedPage';
import AgendaPage from '@/pages/agenda-page';
import PatientsPage from '@/pages/patients-page';
import FinancialPage from '@/pages/financial-page';
import InventoryPage from '@/pages/inventory-page';
import AutomationPage from '@/pages/automation-page';
import OdontogramDemo from '@/pages/odontogram-demo';

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-lg">Carregando...</div>
    </div>
  );
}

export default function DynamicRouter() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location] = useLocation();

  // Mostrar loading enquanto carrega autenticação
  if (isLoading) {
    return <LoadingFallback />;
  }

  // Redirecionamento para login se não autenticado
  if (!isAuthenticated && location !== '/auth') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <AuthPage />
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
        <Route path="/auth">
          <AuthPage />
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

        {/* Rotas estáticas para módulos */}
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
            <AutomationPage />
          </ProtectedRoute>
        </Route>

        <Route path="/odontograma">
          <ProtectedRoute>
            <OdontogramDemo />
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