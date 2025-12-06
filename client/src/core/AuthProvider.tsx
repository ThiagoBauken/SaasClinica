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
  rememberMe?: boolean;
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
    queryKey: ['/api/user'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/user', {
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

      // Tentar salvar credenciais no navegador usando Credential Management API
      if (window.PasswordCredential && credentials.rememberMe !== false) {
        try {
          const passwordCredential = new window.PasswordCredential({
            id: credentials.username,
            password: credentials.password,
            name: data.fullName || credentials.username,
          });
          await navigator.credentials.store(passwordCredential);
        } catch (credError) {
          // Silenciar erros da API de credenciais - não é crítico
          console.debug('Credential API not available or failed:', credError);
        }
      }

      // Invalidate and refetch the user query
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });

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
      const response = await fetch('/api/register', {
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
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
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

// ProtectedRoute component para uso no DynamicRouter
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'superadmin' | 'admin' | 'dentist' | 'receptionist' | 'assistant';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // Mostrar loading enquanto verifica autenticação
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirecionar para login se não autenticado
  if (!isAuthenticated) {
    setLocation('/login');
    return null;
  }

  // Verificar role se especificado
  if (requiredRole && user?.role !== requiredRole && user?.role !== 'superadmin') {
    setLocation('/unauthorized');
    return null;
  }

  return <>{children}</>;
}