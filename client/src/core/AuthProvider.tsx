import { createContext, useContext, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';

interface User {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
  companyId: number;
  active: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
}

interface LoginCredentials {
  username: string;
  password: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [, setLocation] = useLocation();

  // Verificar se usuário está autenticado
  const { data: currentUser, isLoading, error } = useQuery({
    queryKey: ['/api/user/me'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/user/me', {
          credentials: 'include'
        });
        if (!response.ok) {
          throw new Error('Not authenticated');
        }
        return await response.json();
      } catch (error) {
        throw error;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  useEffect(() => {
    if (currentUser && !error) {
      setUser(currentUser);
    } else if (error) {
      setUser(null);
    }
  }, [currentUser, error]);

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Login failed');
      }
      
      const data = await response.json();
      setUser(data.user || data);
      
      // Redirecionamento baseado no role
      const userRole = data.user?.role || data.role;
      if (userRole === 'superadmin') {
        setLocation('/superadmin');
      } else if (userRole === 'admin') {
        setLocation('/admin');
      } else {
        setLocation('/dashboard');
      }
    } catch (error) {
      console.error('Erro no login:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', 'POST');
    } catch (error) {
      console.error('Erro no logout:', error);
    } finally {
      setUser(null);
      setLocation('/login');
    }
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isSuperAdmin: user?.role === 'superadmin',
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}

// Componente para proteger rotas
export function ProtectedRoute({ 
  children, 
  requiredRole,
  requiredPermission 
}: { 
  children: React.ReactNode;
  requiredRole?: string;
  requiredPermission?: string;
}) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        setLocation('/login');
        return;
      }

      if (requiredRole && user?.role !== requiredRole) {
        setLocation('/unauthorized');
        return;
      }
    }
  }, [isAuthenticated, isLoading, user, requiredRole, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Verificando autenticação...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return null;
  }

  return <>{children}</>;
}

// Hook para verificar permissões
export function usePermissions() {
  const { user } = useAuth();

  const hasRole = (role: string) => {
    return user?.role === role;
  };

  const isSuperAdmin = () => {
    return user?.role === 'superadmin';
  };

  const isAdmin = () => {
    return user?.role === 'admin' || user?.role === 'superadmin';
  };

  const canAccessModule = (moduleId: string) => {
    // Implementar verificação de acesso ao módulo baseado na empresa do usuário
    return true; // Placeholder
  };

  return {
    hasRole,
    isSuperAdmin,
    isAdmin,
    canAccessModule,
    user
  };
}