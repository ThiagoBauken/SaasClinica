// Sistema de Redirecionamento Inteligente Pós-Login
import { useLocation } from 'wouter';

export interface User {
  id: number;
  role: string;
  email: string;
  companyId: number;
}

export function useSmartRedirect() {
  const [, setLocation] = useLocation();

  const redirectAfterLogin = (user: User) => {
    // Redirecionamento baseado no role do usuário
    switch (user.role) {
      case 'superadmin':
        // Superadmin vai direto para o painel SaaS
        setLocation('/saas-admin');
        break;
        
      case 'admin':
        // Admin da empresa vai para administração da clínica
        setLocation('/company-admin');
        break;
        
      case 'dentist':
      case 'staff':
      case 'user':
      default:
        // Usuários normais vão para o dashboard com módulos habilitados
        setLocation('/dashboard');
        break;
    }
  };

  const redirectToModuleActivation = () => {
    // Para casos onde o admin precisa ativar módulos primeiro
    setLocation('/company-admin?tab=modules');
  };

  const redirectToDashboard = () => {
    setLocation('/dashboard');
  };

  return {
    redirectAfterLogin,
    redirectToModuleActivation,
    redirectToDashboard
  };
}