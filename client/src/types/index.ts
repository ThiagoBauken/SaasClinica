/**
 * Tipos compartilhados da aplicação
 */

// Paciente
export type Patient = {
  id: number;
  name: string;
  fullName?: string;
  email?: string;
  phone?: string;
  cpf?: string;
  dateOfBirth?: string;
  birthDate?: string;
  address?: string;
  createdAt: string;
  lastVisit?: string;
  [key: string]: any;
};

// Transação Financeira
export type Transaction = {
  id: number;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category?: string;
  date: string;
  patientId?: number;
  [key: string]: any;
};

// Agendamento
export type Appointment = {
  id: number;
  patientId: number;
  professionalId: number;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  [key: string]: any;
};

// Profissional
export type Professional = {
  id: number;
  name: string;
  email?: string;
  specialty?: string;
  [key: string]: any;
};

// Sala
export type Room = {
  id: number;
  name: string;
  active: boolean;
  [key: string]: any;
};

// Procedimento
export type Procedure = {
  id: number;
  name: string;
  code?: string;
  price?: number;
  duration?: number;
  [key: string]: any;
};

// Automação
export type Automation = {
  id: number;
  name: string;
  type: string;
  status: 'active' | 'inactive';
  trigger?: string;
  action?: string;
  [key: string]: any;
};

// Item de Estoque
export type InventoryItem = {
  id: number;
  name: string;
  currentStock: number | null;
  minimumStock: number | null;
  unit: string;
  category: string;
  supplier?: string;
  lastPurchaseDate?: Date | string;
  expiryDate?: Date | string;
  [key: string]: any;
};

// Empresa
export type Company = {
  id: number;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  cnpj?: string;
  active: boolean;
  trialEndsAt?: string;
  [key: string]: any;
};

// Módulo
export type Module = {
  id: string;
  name: string;
  displayName: string;
  description: string;
  enabled: boolean;
  routes?: ModuleRoute[];
  [key: string]: any;
};

// Rota de Módulo
export type ModuleRoute = {
  path: string;
  component: React.ComponentType<any>;
  exact?: boolean;
  [key: string]: any;
};

// Módulo por Categoria
export type ModulesByCategory = {
  byCategory: {
    [category: string]: Module[];
  };
  loaded: boolean;
};

// Configuração
export type ConfigCard = {
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  path: string;
  badge?: string;
};
