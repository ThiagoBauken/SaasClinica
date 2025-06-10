import { createContext, useContext, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  loginMutation: {
    isPending: boolean;
    mutateAsync: (credentials: LoginCredentials) => Promise<void>;
    mutate: (credentials: LoginCredentials) => Promise<void>;
  };
  registerMutation: {
    isPending: boolean;
    mutateAsync: (data: any) => Promise<void>;
    mutate: (data: any) => Promise<void>;
  };
}

interface LoginCredentials {
  username: string;
  password: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoginPending, setIsLoginPending] = useState(false);
  const [isRegisterPending, setIsRegisterPending] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Verificar se usuário está autenticado
  const { data: currentUser, isLoading, error } = useQuery({
    queryKey: ['/api/user/me'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/user/me', {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        if (!response.ok) {
          if (response.status === 401) {
            return null;
          }
          throw new Error('Authentication check failed');
        }
        return await response.json();
      } catch (error) {
        return null;
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
    setIsLoginPending(true);
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
      setUser(data);
      
      // Invalidate and refetch the user query
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      
      // Redirecionamento baseado no role
      const userRole = data.role;
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
    } finally {
      setIsLoginPending(false);
    }
  };

  const register = async (data: any) => {
    setIsRegisterPending(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Registration failed');
      }
      
      const result = await response.json();
      setUser(result.user || result);
      setLocation('/dashboard');
    } catch (error) {
      console.error('Erro no registro:', error);
      throw error;
    } finally {
      setIsRegisterPending(false);
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
    logout,
    loginMutation: {
      isPending: isLoginPending,
      mutateAsync: login,
      mutate: login
    },
    registerMutation: {
      isPending: isRegisterPending,
      mutateAsync: register,
      mutate: register
    }
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