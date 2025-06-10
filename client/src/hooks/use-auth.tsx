import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Usuário temporário para desenvolvimento
const MOCK_ADMIN_USER: SelectUser = {
  id: 99999,
  username: "admin",
  password: "admin123", 
  fullName: "Administrador",
  email: "admin@dentalsys.com",
  role: "admin",
  phone: null,
  profileImageUrl: null,
  speciality: null,
  active: true,
  googleId: null,
  trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
  createdAt: new Date(),
  updatedAt: new Date()
};

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
};

type LoginData = Pick<InsertUser, "username" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  // Estado local para usuário mockado
  const [mockUser, setMockUser] = useState<SelectUser | null>(
    localStorage.getItem('mockUser') 
      ? JSON.parse(localStorage.getItem('mockUser')!) 
      : null
  );
  
  // Usar usuario real ou mockado para desenvolvimento
  const USE_MOCK_USER = true; // Defina como false para usar autenticação real
  
  const {
    data: serverUser,
    error,
    isLoading: serverLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !USE_MOCK_USER, // Só faz request se não estiver usando mock
  });
  
  // Define o usuário efetivo conforme a configuração
  const user = USE_MOCK_USER ? mockUser : serverUser ?? null;
  const isLoading = USE_MOCK_USER ? false : serverLoading;

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      if (USE_MOCK_USER) {
        // Verifica credenciais simuladas
        if (credentials.username === "admin" && credentials.password === "admin123") {
          return MOCK_ADMIN_USER;
        } else if (credentials.username === "dentista" && credentials.password === "dentista123") {
          const dentistUser = { 
            ...MOCK_ADMIN_USER, 
            id: 99998, 
            username: "dentista",
            fullName: "Dr. Dentista",
            role: "dentist",
            speciality: "Clínico Geral",
            trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 dias
          };
          return dentistUser;
        }
        throw new Error("Credenciais inválidas");
      } else {
        const res = await apiRequest("POST", "/api/login", credentials);
        return await res.json();
      }
    },
    onSuccess: (user: SelectUser) => {
      if (USE_MOCK_USER) {
        setMockUser(user);
        localStorage.setItem('mockUser', JSON.stringify(user));
      } else {
        queryClient.setQueryData(["/api/user"], user);
      }
      
      toast({
        title: "Bem-vindo de volta!",
        description: `Olá, ${user.fullName}! Você entrou com sucesso.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Falha ao entrar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      if (USE_MOCK_USER) {
        // Simular registro de novo usuário
        const newUser = {
          ...MOCK_ADMIN_USER,
          id: Math.floor(Math.random() * 1000) + 1000,
          username: credentials.username,
          fullName: credentials.fullName || "Novo Usuário",
          email: credentials.email || `${credentials.username}@example.com`,
          role: "dentist",
          createdAt: new Date(),
          updatedAt: new Date(),
          trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };
        return newUser;
      } else {
        const res = await apiRequest("POST", "/api/register", credentials);
        return await res.json();
      }
    },
    onSuccess: (user: SelectUser) => {
      if (USE_MOCK_USER) {
        setMockUser(user);
        localStorage.setItem('mockUser', JSON.stringify(user));
      } else {
        queryClient.setQueryData(["/api/user"], user);
      }
      
      toast({
        title: "Registro realizado com sucesso!",
        description: "Sua conta foi criada e você está conectado.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Falha no registro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (USE_MOCK_USER) {
        // Simular logout
        return;
      } else {
        await apiRequest("POST", "/api/logout");
      }
    },
    onSuccess: () => {
      if (USE_MOCK_USER) {
        setMockUser(null);
        localStorage.removeItem('mockUser');
      } else {
        queryClient.setQueryData(["/api/user"], null);
      }
      
      toast({
        title: "Desconectado",
        description: "Você saiu do sistema com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Falha ao sair",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}
