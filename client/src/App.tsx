import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import SchedulePage from "@/pages/schedule-page";
import DashboardPage from "@/pages/dashboard-page";
import AuthPage from "@/pages/auth-page";
import PatientsPage from "@/pages/patients-page";
import FinancialPage from "@/pages/financial-page";
import AutomationPage from "@/pages/automation-page";
import ProstheticsPage from "@/pages/prosthetics-page";
import LandingPage from "@/pages/landing-page";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "./hooks/use-auth";
import { ThemeProvider } from "@/components/theme/theme-provider";

function Router() {
  return (
    <Switch>
      {/* Rota principal leva para landing page */}
      <Route path="/" component={LandingPage} />
      
      {/* Rotas do painel - todas acessíveis diretamente sem proteção */}
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/schedule" component={SchedulePage} />
      <Route path="/patients" component={PatientsPage} />
      <Route path="/financial" component={FinancialPage} />
      <Route path="/automation" component={AutomationPage} />
      <Route path="/prosthetics" component={ProstheticsPage} />
      
      {/* Rota de autenticação */}
      <Route path="/auth" component={AuthPage} />
      
      {/* Rota para casos não encontrados */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
