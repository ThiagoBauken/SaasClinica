import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

interface Company {
  id: number;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  cnpj?: string;
  active: boolean;
  trialEndsAt?: string;
}

interface CompanyContextType {
  company: Company | null;
  companyId: number | null;
  isLoading: boolean;
  error: string | null;
  refreshCompany: () => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

interface CompanyProviderProps {
  children: ReactNode;
}

export function CompanyProvider({ children }: CompanyProviderProps) {
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Buscar informações da empresa do usuário logado
  const { data: userCompany, isLoading, refetch } = useQuery<Company>({
    queryKey: ['/api/user/company'],
    enabled: true,
    staleTime: 5 * 60 * 1000, // 5 minutos
    retry: 1,
  });

  useEffect(() => {
    if (userCompany) {
      setCompany(userCompany);
      setError(null);
    }
  }, [userCompany]);

  const refreshCompany = () => {
    refetch();
  };

  const value: CompanyContextType = {
    company,
    companyId: company?.id || null,
    isLoading,
    error,
    refreshCompany,
  };

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}

export function useCompanyId() {
  const { companyId } = useCompany();
  return companyId;
}