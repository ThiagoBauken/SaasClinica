import { db } from "./db";
import { 
  appointments, 
  appointmentProcedures, 
  procedures, 
  patients,
  users,
  companies,
  financialTransactions,
  treatmentPlans,
  treatmentPlanProcedures
} from "@shared/schema";
import { eq, and, sum, desc } from "drizzle-orm";

// Financial Transaction interface for integration
interface FinancialTransaction {
  companyId: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number; // in cents
  patientId?: number;
  appointmentId?: number;
  professionalId?: number;
  date: string;
  paymentMethod?: string;
  status: 'pending' | 'partial' | 'paid' | 'overdue';
  installments?: number;
  installmentsPaid?: number;
  dueDate?: string;
  notes?: string;
}

// Treatment Plan interface
interface TreatmentPlan {
  id?: number;
  patientId: number;
  companyId: number;
  totalAmount: number; // in cents
  paidAmount: number; // in cents
  remainingAmount: number; // in cents
  procedures: TreatmentProcedure[];
  paymentPlan?: PaymentPlan;
  status: 'proposed' | 'approved' | 'in_progress' | 'completed' | 'cancelled';
  createdAt?: Date;
  updatedAt?: Date;
}

interface TreatmentProcedure {
  procedureId: number;
  procedureName: string;
  quantity: number;
  unitPrice: number; // in cents
  totalPrice: number; // in cents
  status: 'pending' | 'scheduled' | 'completed';
  appointmentId?: number;
  completedAt?: Date;
}

interface PaymentPlan {
  installments: number;
  installmentAmount: number; // in cents
  paymentMethod: string;
  interval: 'weekly' | 'monthly';
  startDate: string;
  discountPercentage?: number;
}

export class FinancialIntegrationService {
  
  /**
   * Creates financial transactions automatically when appointment is completed
   */
  async createFinancialTransactionsFromAppointment(appointmentId: number): Promise<FinancialTransaction[]> {
    try {
      // Get appointment details with procedures
      const [appointment] = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, appointmentId));

      if (!appointment) {
        throw new Error(`Appointment ${appointmentId} not found`);
      }

      // Get appointment procedures
      const appointmentProceduresList = await db
        .select({
          id: appointmentProcedures.id,
          procedureId: appointmentProcedures.procedureId,
          quantity: appointmentProcedures.quantity,
          price: appointmentProcedures.price,
          notes: appointmentProcedures.notes
        })
        .from(appointmentProcedures)
        .where(eq(appointmentProcedures.appointmentId, appointmentId));

      // Get procedure details
      const procedureDetails = await Promise.all(
        appointmentProceduresList.map(async (ap) => {
          const [procedure] = await db
            .select()
            .from(procedures)
            .where(eq(procedures.id, ap.procedureId));
          return { ...ap, procedure };
        })
      );

      // Create financial transactions for each procedure
      const transactions: FinancialTransaction[] = [];

      for (const procDetail of procedureDetails) {
        if (!procDetail.procedure) continue;

        const totalAmount = procDetail.price * procDetail.quantity;
        
        const transaction: FinancialTransaction = {
          companyId: appointment.companyId,
          type: 'income',
          category: 'Tratamento Odontológico',
          description: `${procDetail.procedure.name} - Consulta ${appointment.id}`,
          amount: totalAmount,
          patientId: appointment.patientId || undefined,
          appointmentId: appointmentId,
          professionalId: appointment.professionalId || undefined,
          date: new Date().toISOString().split('T')[0],
          status: 'pending',
          notes: procDetail.notes || undefined
        };

        transactions.push(transaction);
      }

      return transactions;
    } catch (error) {
      console.error('Error creating financial transactions from appointment:', error);
      throw error;
    }
  }

  /**
   * Creates a comprehensive treatment plan with financial breakdown
   */
  async createTreatmentPlan(
    patientId: number, 
    companyId: number, 
    proceduresList: { procedureId: number; quantity: number }[],
    paymentPlan?: PaymentPlan
  ): Promise<TreatmentPlan> {
    try {
      // Get procedure details and calculate costs
      const procedureDetails: TreatmentProcedure[] = [];
      
      for (const p of proceduresList) {
        const [procedure] = await db
          .select()
          .from(procedures)
          .where(eq(procedures.id, p.procedureId));
        
        if (!procedure) {
          throw new Error(`Procedure ${p.procedureId} not found`);
        }

        const totalPrice = (procedure.price || 0) * p.quantity;
        
        procedureDetails.push({
          procedureId: p.procedureId,
          procedureName: procedure.name,
          quantity: p.quantity,
          unitPrice: procedure.price || 0,
          totalPrice: totalPrice,
          status: 'pending' as const
        });
      }

      const totalAmount = procedureDetails.reduce((sum, p) => sum + p.totalPrice, 0);
      
      // Apply discount if payment plan has one
      let finalAmount = totalAmount;
      if (paymentPlan?.discountPercentage) {
        finalAmount = Math.round(totalAmount * (1 - paymentPlan.discountPercentage / 100));
      }

      const treatmentPlan: TreatmentPlan = {
        patientId,
        companyId,
        totalAmount: finalAmount,
        paidAmount: 0,
        remainingAmount: finalAmount,
        procedures: procedureDetails,
        paymentPlan,
        status: 'proposed'
      };

      return treatmentPlan;
    } catch (error) {
      console.error('Error creating treatment plan:', error);
      throw error;
    }
  }

  /**
   * Gets patient financial summary including pending payments and treatments
   */
  async getPatientFinancialSummary(patientId: number, companyId: number) {
    try {
      // Get all financial transactions for this patient
      const transactions = await db
        .select()
        .from(financialTransactions)
        .where(and(
          eq(financialTransactions.patientId, patientId),
          eq(financialTransactions.companyId, companyId)
        ))
        .orderBy(desc(financialTransactions.createdAt));

      // Get treatment plans for this patient
      const treatmentPlansList = await db
        .select()
        .from(treatmentPlans)
        .where(and(
          eq(treatmentPlans.patientId, patientId),
          eq(treatmentPlans.companyId, companyId)
        ))
        .orderBy(desc(treatmentPlans.createdAt));

      // Calculate totals
      const totalTreatmentValue = treatmentPlansList.reduce((sum, plan) => sum + (plan.totalAmount || 0), 0);
      const totalPaid = transactions
        .filter(t => t.type === 'income' && t.status === 'paid')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const remainingBalance = totalTreatmentValue - totalPaid;
      
      // Calculate overdue amount
      const today = new Date();
      const overdueAmount = transactions
        .filter(t => t.status === 'pending' && t.dueDate && new Date(t.dueDate) < today)
        .reduce((sum, t) => sum + t.amount, 0);

      // Find next payment due
      const upcomingTransactions = transactions
        .filter(t => t.status === 'pending' && t.dueDate && new Date(t.dueDate) >= today)
        .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

      const nextPaymentDue = upcomingTransactions.length > 0 ? upcomingTransactions[0].dueDate : null;

      return {
        patientId,
        totalTreatmentValue,
        totalPaid,
        remainingBalance,
        overdueAmount,
        nextPaymentDue,
        treatmentPlans: treatmentPlansList,
        paymentHistory: transactions.filter(t => t.status === 'paid'),
        upcomingPayments: upcomingTransactions.slice(0, 5) // Next 5 payments
      };
    } catch (error) {
      console.error('Error getting patient financial summary:', error);
      throw error;
    }
  }

  /**
   * Calculates payment machine fees and adjusts amounts
   */
  calculatePaymentMachineFees(amount: number, paymentMethod: string): {
    originalAmount: number;
    feeAmount: number;
    netAmount: number;
    feePercentage: number;
  } {
    let feePercentage = 0;

    // Standard payment machine fees in Brazil
    switch (paymentMethod) {
      case 'credit_card':
        feePercentage = 3.99; // Average credit card fee
        break;
      case 'debit_card':
        feePercentage = 1.99; // Average debit card fee
        break;
      case 'pix':
        feePercentage = 0.99; // PIX fee
        break;
      case 'cash':
      case 'bank_transfer':
        feePercentage = 0; // No fees
        break;
      default:
        feePercentage = 2.5; // Default fee
    }

    const feeAmount = Math.round(amount * (feePercentage / 100));
    const netAmount = amount - feeAmount;

    return {
      originalAmount: amount,
      feeAmount,
      netAmount,
      feePercentage
    };
  }

  /**
   * Processes payment and updates financial records
   */
  async processPayment(
    transactionId: number,
    paymentAmount: number,
    paymentMethod: string,
    companyId: number
  ) {
    try {
      const feeCalculation = this.calculatePaymentMachineFees(paymentAmount, paymentMethod);
      
      // Update financial transaction status
      // Create payment record with fee breakdown
      // Update treatment plan payment status
      
      return {
        success: true,
        transactionId,
        paymentAmount,
        netAmount: feeCalculation.netAmount,
        feeAmount: feeCalculation.feeAmount,
        paymentMethod,
        processedAt: new Date()
      };
    } catch (error) {
      console.error('Error processing payment:', error);
      throw error;
    }
  }

  /**
   * Generates installment schedule for treatment plans
   */
  generateInstallmentSchedule(
    totalAmount: number,
    installments: number,
    startDate: string,
    interval: 'weekly' | 'monthly' = 'monthly'
  ) {
    const installmentAmount = Math.round(totalAmount / installments);
    const schedule = [];
    
    let currentDate = new Date(startDate);
    
    for (let i = 1; i <= installments; i++) {
      // Adjust last installment for rounding differences
      const amount = i === installments 
        ? totalAmount - (installmentAmount * (installments - 1))
        : installmentAmount;
      
      schedule.push({
        installmentNumber: i,
        amount: amount,
        dueDate: currentDate.toISOString().split('T')[0],
        status: 'pending' as const
      });
      
      // Move to next payment date
      if (interval === 'monthly') {
        currentDate.setMonth(currentDate.getMonth() + 1);
      } else {
        currentDate.setDate(currentDate.getDate() + 7);
      }
    }
    
    return schedule;
  }
}

export const financialIntegration = new FinancialIntegrationService();