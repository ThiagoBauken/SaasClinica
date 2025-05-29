// Módulo Financeiro
import { ModuleDefinition } from '../../index';

export const financeiroModule: ModuleDefinition = {
  id: 'financeiro',
  name: 'financeiro',
  displayName: 'Gestão Financeira',
  version: '1.0.0',
  description: 'Controle financeiro, faturamento e pagamentos',
  icon: 'DollarSign',
  dependencies: ['clinica', 'pacientes'],
  permissions: ['financeiro:read', 'financeiro:write', 'financeiro:delete', 'financeiro:admin'],
  routes: [
    '/api/financeiro/invoices',
    '/api/financeiro/payments',
    '/api/financeiro/reports'
  ],
  components: [
    'InvoiceManager',
    'PaymentForm',
    'FinancialReports',
    'CashFlow'
  ]
};

export interface Invoice {
  id: number;
  patientId: number;
  amount: number;
  description: string;
  dueDate: Date;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  paymentMethod?: string;
  paidAt?: Date;
}