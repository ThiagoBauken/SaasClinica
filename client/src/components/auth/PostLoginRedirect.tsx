import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useUserModules } from '@/hooks/use-user-modules';

export function PostLoginRedirect() {
  const { user } = useAuth();
  const { activeModules, isLoading } = useUserModules();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user || isLoading) return;

    // Redirecionamento baseado no role do usuário
    if (user.role === 'superadmin') {
      // Superadmin vai para o painel SaaS
      setLocation('/saas-admin');
    } else if (user.role === 'admin') {
      // Admin da empresa vai para administração da clínica
      setLocation('/company-admin');
    } else {
      // Usuários normais vão para o dashboard
      // Se tem módulos ativos, vai para o primeiro módulo disponível
      if (activeModules.length > 0) {
        const firstModule = activeModules[0];
        if (firstModule.routes.length > 0) {
          setLocation(firstModule.routes[0].path);
        } else {
          setLocation('/dashboard');
        }
      } else {
        setLocation('/dashboard');
      }
    }
  }, [user, activeModules, isLoading, setLocation]);

  // Mostra loading enquanto determina o redirecionamento
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}