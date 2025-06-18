import { createContext, useContext, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';

interface User {
  id: number;
  username: string;
  password: string;
  fullName: string;
  email: string;
  role: string;
  phone: string | null;
  profileImageUrl: string | null;
  speciality: string | null;
  active: boolean;
  googleId: string | null;
  companyId: number;
  trialEndsAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
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
  logoutMutation: {
    isPending: boolean;
    mutateAsync: () => Promise<void>;
    mutate: () => void;
  };
}

interface LoginCredentials {
  username: string;
  password: string;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
    } else if (error || currentUser === null) {
      setUser(null);
      // Auto-login para desenvolvimento
      if (!isLoading && !currentUser) {
        console.log("Tentando auto-login...");
        login({ username: "admin", password: "admin123" }).catch(console.error);
      }
    }
  }, [currentUser, error, isLoading]);

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
        setLocation('/saas-admin');
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
      setLocation('/saas-admin');
    } catch (error) {
      console.error('Erro no registro:', error);
      throw error;
    } finally {
      setIsRegisterPending(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Erro no logout:', error);
    } finally {
      setUser(null);
      queryClient.invalidateQueries({ queryKey: ['/api/user/me'] });
      setLocation('/auth');
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
    },
    logoutMutation: {
      isPending: false,
      mutateAsync: logout,
      mutate: () => { logout(); }
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