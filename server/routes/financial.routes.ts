import { Router } from 'express';
import { storage } from '../storage';
import { authCheck, asyncHandler } from '../middleware/auth';
import { db } from '../db';
import {
  financialTransactions,
  payments,
  paymentPlans,
  boxes,
  boxTransactions,
  users,
  appointments,
  companies
} from '@shared/schema';
import { eq, and, gte, lte, desc, sum, sql } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

// ==========================================
// TRANSAÇÕES FINANCEIRAS
// ==========================================

/**
 * GET /api/v1/financial/transactions
 * Lista todas as transações financeiras
 */
router.get(
  '/transactions',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { startDate, endDate, type, category } = req.query as any;

    // Build where conditions
    const conditions = [eq(financialTransactions.companyId, companyId)];

    if (startDate) {
      conditions.push(gte(financialTransactions.date, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(financialTransactions.date, new Date(endDate)));
    }

    if (type) {
      conditions.push(eq(financialTransactions.type, type));
    }

    if (category) {
      conditions.push(eq(financialTransactions.category, category));
    }

    const transactions = await db
      .select()
      .from(financialTransactions)
      .where(and(...conditions))
      .orderBy(desc(financialTransactions.date));

    res.json(transactions);
  })
);

/**
 * POST /api/v1/financial/transactions
 * Cria nova transação financeira
 */
router.post(
  '/transactions',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { type, date, category, description, amount, paymentMethod, status } = req.body;

    // Validação básica
    if (!type || !date || !amount) {
      return res.status(400).json({ error: 'Type, date and amount are required' });
    }

    const [transaction] = await db
      .insert(financialTransactions)
      .values({
        companyId,
        type,
        date: new Date(date),
        category: category || 'other',
        description,
        amount: Math.round(amount * 100), // Converter para centavos
        paymentMethod: paymentMethod || 'cash',
        status: status || 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    res.status(201).json(transaction);
  })
);

/**
 * PATCH /api/v1/financial/transactions/:id
 * Atualiza transação financeira
 */
router.patch(
  '/transactions/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params;
    const updates = req.body;

    // Converter amount para centavos se fornecido
    if (updates.amount !== undefined) {
      updates.amount = Math.round(updates.amount * 100);
    }

    const [updated] = await db
      .update(financialTransactions)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(
        eq(financialTransactions.id, parseInt(id)),
        eq(financialTransactions.companyId, companyId)
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(updated);
  })
);

/**
 * DELETE /api/v1/financial/transactions/:id
 * Deleta transação financeira
 */
router.delete(
  '/transactions/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params;

    const result = await db
      .delete(financialTransactions)
      .where(and(
        eq(financialTransactions.id, parseInt(id)),
        eq(financialTransactions.companyId, companyId)
      ))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.status(204).send();
  })
);

// ==========================================
// PAGAMENTOS DE PACIENTES
// ==========================================

/**
 * GET /api/v1/patients/:patientId/payments
 * Lista pagamentos de um paciente
 */
router.get(
  '/patients/:patientId/payments',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { patientId } = req.params;

    const patientPayments = await db
      .select()
      .from(payments)
      .where(and(
        eq(payments.patientId, parseInt(patientId)),
        eq(payments.companyId, companyId)
      ))
      .orderBy(desc(payments.createdAt));

    res.json(patientPayments);
  })
);

/**
 * POST /api/v1/patients/:patientId/payments
 * Registra pagamento de paciente
 */
router.post(
  '/patients/:patientId/payments',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { patientId } = req.params;
    const { amount, paymentMethod, description, appointmentId } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    const [payment] = await db
      .insert(payments)
      .values({
        companyId,
        patientId: parseInt(patientId),
        appointmentId: appointmentId || null,
        amount: amount.toFixed(2), // decimal precisa ser string
        paymentMethod: paymentMethod || 'cash',
        paymentDate: new Date(),
        status: 'completed',
        description,
      })
      .returning();

    res.status(201).json(payment);
  })
);

// ==========================================
// RELATÓRIOS FINANCEIROS
// ==========================================

/**
 * GET /api/v1/financial/reports/daily
 * Relatório financeiro do dia
 */
router.get(
  '/reports/daily',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { date } = req.query as any;
    const targetDate = date ? new Date(date) : new Date();

    // Início e fim do dia
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Receitas do dia
    const revenues = await db
      .select({
        total: sql<number>`COALESCE(SUM(${financialTransactions.amount}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(financialTransactions)
      .where(and(
        eq(financialTransactions.companyId, companyId),
        eq(financialTransactions.type, 'revenue'),
        gte(financialTransactions.date, startOfDay),
        lte(financialTransactions.date, endOfDay)
      ));

    // Despesas do dia
    const expenses = await db
      .select({
        total: sql<number>`COALESCE(SUM(${financialTransactions.amount}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(financialTransactions)
      .where(and(
        eq(financialTransactions.companyId, companyId),
        eq(financialTransactions.type, 'expense'),
        gte(financialTransactions.date, startOfDay),
        lte(financialTransactions.date, endOfDay)
      ));

    const totalRevenue = revenues[0]?.total || 0;
    const totalExpense = expenses[0]?.total || 0;
    const balance = totalRevenue - totalExpense;

    res.json({
      date: targetDate.toISOString().split('T')[0],
      revenue: {
        total: totalRevenue / 100, // Converter de centavos
        count: revenues[0]?.count || 0,
      },
      expense: {
        total: totalExpense / 100,
        count: expenses[0]?.count || 0,
      },
      balance: balance / 100,
    });
  })
);

/**
 * GET /api/v1/financial/reports/monthly
 * Relatório financeiro mensal
 */
router.get(
  '/reports/monthly',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { year, month } = req.query as any;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;

    // Primeiro dia do mês
    const startOfMonth = new Date(targetYear, targetMonth - 1, 1);

    // Primeiro dia do mês seguinte
    const endOfMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    // Receitas do mês
    const revenues = await db
      .select({
        total: sql<number>`COALESCE(SUM(${financialTransactions.amount}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(financialTransactions)
      .where(and(
        eq(financialTransactions.companyId, companyId),
        eq(financialTransactions.type, 'revenue'),
        gte(financialTransactions.date, startOfMonth),
        lte(financialTransactions.date, endOfMonth)
      ));

    // Despesas do mês
    const expenses = await db
      .select({
        total: sql<number>`COALESCE(SUM(${financialTransactions.amount}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(financialTransactions)
      .where(and(
        eq(financialTransactions.companyId, companyId),
        eq(financialTransactions.type, 'expense'),
        gte(financialTransactions.date, startOfMonth),
        lte(financialTransactions.date, endOfMonth)
      ));

    const totalRevenue = revenues[0]?.total || 0;
    const totalExpense = expenses[0]?.total || 0;
    const balance = totalRevenue - totalExpense;

    res.json({
      period: `${targetYear}-${String(targetMonth).padStart(2, '0')}`,
      revenue: {
        total: totalRevenue / 100,
        count: revenues[0]?.count || 0,
      },
      expense: {
        total: totalExpense / 100,
        count: expenses[0]?.count || 0,
      },
      balance: balance / 100,
    });
  })
);

/**
 * GET /api/v1/financial/reports/summary
 * Resumo financeiro geral
 */
router.get(
  '/reports/summary',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { startDate, endDate } = req.query as any;

    const conditions = [eq(financialTransactions.companyId, companyId)];

    if (startDate) {
      conditions.push(gte(financialTransactions.date, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(financialTransactions.date, new Date(endDate)));
    }

    // Totais por tipo
    const summary = await db
      .select({
        type: financialTransactions.type,
        total: sql<number>`SUM(${financialTransactions.amount})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(financialTransactions)
      .where(and(...conditions))
      .groupBy(financialTransactions.type);

    // Por categoria
    const byCategory = await db
      .select({
        category: financialTransactions.category,
        type: financialTransactions.type,
        total: sql<number>`SUM(${financialTransactions.amount})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(financialTransactions)
      .where(and(...conditions))
      .groupBy(financialTransactions.category, financialTransactions.type);

    res.json({
      summary: summary.map((s: typeof summary[0]) => ({
        type: s.type,
        total: (s.total || 0) / 100,
        count: s.count,
      })),
      byCategory: byCategory.map((c: typeof byCategory[0]) => ({
        category: c.category,
        type: c.type,
        total: (c.total || 0) / 100,
        count: c.count,
      })),
    });
  })
);

// ==========================================
// DRE PROFISSIONAL (Demonstrativo de Resultado)
// ==========================================

/**
 * GET /api/v1/financial/dre/professional
 * DRE por profissional - mostra faturamento, comissão e resultado de cada dentista
 */
router.get(
  '/dre/professional',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { startDate, endDate, professionalId } = req.query as any;

    // Período padrão: mês atual
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const periodStart = startDate ? new Date(startDate) : defaultStart;
    const periodEnd = endDate ? new Date(endDate) : defaultEnd;

    // Buscar todos os profissionais (dentistas) da empresa
    const professionals = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        speciality: users.speciality,
        role: users.role,
      })
      .from(users)
      .where(and(
        eq(users.companyId, companyId),
        eq(users.active, true),
        sql`${users.role} IN ('dentist', 'admin')` // Apenas dentistas e admins
      ));

    // Se foi solicitado um profissional específico, filtrar
    type Professional = typeof professionals[0];
    const targetProfessionals = professionalId
      ? professionals.filter((p: Professional) => p.id === parseInt(professionalId))
      : professionals;

    // Buscar configurações de comissão da empresa (ou usar padrão 50%)
    const companySettings = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    // Configuração padrão: 50% para o profissional
    const defaultCommissionRate = 0.5;

    // Calcular DRE para cada profissional
    const dreResults = await Promise.all(
      targetProfessionals.map(async (professional: Professional) => {
        // Receitas do profissional (type = 'revenue' ou 'income')
        const revenues = await db
          .select({
            total: sql<number>`COALESCE(SUM(${financialTransactions.amount}), 0)`,
            count: sql<number>`COUNT(*)`,
            netTotal: sql<number>`COALESCE(SUM(COALESCE(${financialTransactions.netAmount}, ${financialTransactions.amount})), 0)`,
          })
          .from(financialTransactions)
          .where(and(
            eq(financialTransactions.companyId, companyId),
            eq(financialTransactions.professionalId, professional.id),
            sql`${financialTransactions.type} IN ('revenue', 'income')`,
            gte(financialTransactions.date, periodStart),
            lte(financialTransactions.date, periodEnd),
            sql`${financialTransactions.status} != 'cancelled'`
          ));

        // Despesas do profissional (se houver - materiais específicos, etc)
        const expenses = await db
          .select({
            total: sql<number>`COALESCE(SUM(${financialTransactions.amount}), 0)`,
            count: sql<number>`COUNT(*)`,
          })
          .from(financialTransactions)
          .where(and(
            eq(financialTransactions.companyId, companyId),
            eq(financialTransactions.professionalId, professional.id),
            eq(financialTransactions.type, 'expense'),
            gte(financialTransactions.date, periodStart),
            lte(financialTransactions.date, periodEnd),
            sql`${financialTransactions.status} != 'cancelled'`
          ));

        // Buscar detalhes por categoria/procedimento
        const byCategory = await db
          .select({
            category: financialTransactions.category,
            total: sql<number>`COALESCE(SUM(${financialTransactions.amount}), 0)`,
            count: sql<number>`COUNT(*)`,
          })
          .from(financialTransactions)
          .where(and(
            eq(financialTransactions.companyId, companyId),
            eq(financialTransactions.professionalId, professional.id),
            sql`${financialTransactions.type} IN ('revenue', 'income')`,
            gte(financialTransactions.date, periodStart),
            lte(financialTransactions.date, periodEnd),
            sql`${financialTransactions.status} != 'cancelled'`
          ))
          .groupBy(financialTransactions.category);

        // Buscar consultas completadas no período
        const completedAppointments = await db
          .select({
            count: sql<number>`COUNT(*)`,
          })
          .from(appointments)
          .where(and(
            eq(appointments.companyId, companyId),
            eq(appointments.professionalId, professional.id),
            eq(appointments.status, 'completed'),
            gte(appointments.startTime, periodStart),
            lte(appointments.startTime, periodEnd)
          ));

        const grossRevenue = (revenues[0]?.total || 0) / 100;
        const netRevenue = (revenues[0]?.netTotal || 0) / 100;
        const totalExpenses = (expenses[0]?.total || 0) / 100;

        // Calcular comissão (usando net se disponível, senão gross)
        const revenueForCommission = netRevenue > 0 ? netRevenue : grossRevenue;
        const professionalCommission = revenueForCommission * defaultCommissionRate;
        const clinicShare = revenueForCommission - professionalCommission;

        // Resultado líquido do profissional (comissão - despesas atribuídas)
        const professionalNetResult = professionalCommission - totalExpenses;

        return {
          professional: {
            id: professional.id,
            name: professional.fullName,
            speciality: professional.speciality,
          },
          period: {
            start: periodStart.toISOString().split('T')[0],
            end: periodEnd.toISOString().split('T')[0],
          },
          metrics: {
            completedAppointments: completedAppointments[0]?.count || 0,
            transactionCount: revenues[0]?.count || 0,
          },
          revenue: {
            gross: grossRevenue,
            net: netRevenue > 0 ? netRevenue : grossRevenue,
            fees: grossRevenue - (netRevenue > 0 ? netRevenue : grossRevenue),
          },
          expenses: {
            total: totalExpenses,
            count: expenses[0]?.count || 0,
          },
          split: {
            commissionRate: defaultCommissionRate,
            professionalShare: professionalCommission,
            clinicShare: clinicShare,
          },
          result: {
            professionalNet: professionalNetResult,
            clinicNet: clinicShare,
          },
          breakdown: byCategory.map((c: typeof byCategory[0]) => ({
            category: c.category,
            total: (c.total || 0) / 100,
            count: c.count,
          })),
        };
      })
    );

    // Totais gerais
    const totals = {
      grossRevenue: dreResults.reduce((sum, r) => sum + r.revenue.gross, 0),
      netRevenue: dreResults.reduce((sum, r) => sum + r.revenue.net, 0),
      totalExpenses: dreResults.reduce((sum, r) => sum + r.expenses.total, 0),
      professionalShares: dreResults.reduce((sum, r) => sum + r.split.professionalShare, 0),
      clinicShares: dreResults.reduce((sum, r) => sum + r.split.clinicShare, 0),
      completedAppointments: dreResults.reduce((sum, r) => sum + r.metrics.completedAppointments, 0),
    };

    res.json({
      period: {
        start: periodStart.toISOString().split('T')[0],
        end: periodEnd.toISOString().split('T')[0],
      },
      professionals: dreResults,
      totals,
      settings: {
        defaultCommissionRate: defaultCommissionRate * 100, // em porcentagem
      },
    });
  })
);

/**
 * GET /api/v1/financial/dre/professional/:id
 * DRE detalhado de um profissional específico
 */
router.get(
  '/dre/professional/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params;
    const { startDate, endDate } = req.query as any;

    // Período padrão: mês atual
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const periodStart = startDate ? new Date(startDate) : defaultStart;
    const periodEnd = endDate ? new Date(endDate) : defaultEnd;

    // Buscar profissional
    const [professional] = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        speciality: users.speciality,
        email: users.email,
        phone: users.phone,
      })
      .from(users)
      .where(and(
        eq(users.id, parseInt(id)),
        eq(users.companyId, companyId)
      ));

    if (!professional) {
      return res.status(404).json({ error: 'Professional not found' });
    }

    // Buscar todas as transações do profissional no período
    const allTransactions = await db
      .select()
      .from(financialTransactions)
      .where(and(
        eq(financialTransactions.companyId, companyId),
        eq(financialTransactions.professionalId, parseInt(id)),
        gte(financialTransactions.date, periodStart),
        lte(financialTransactions.date, periodEnd),
        sql`${financialTransactions.status} != 'cancelled'`
      ))
      .orderBy(desc(financialTransactions.date));

    // Agrupar por dia
    const dailyBreakdown: Record<string, { revenue: number; expense: number; net: number }> = {};
    type Transaction = typeof allTransactions[0];

    allTransactions.forEach((t: Transaction) => {
      const day = t.date!.toISOString().split('T')[0];
      if (!dailyBreakdown[day]) {
        dailyBreakdown[day] = { revenue: 0, expense: 0, net: 0 };
      }
      const amount = (t.amount || 0) / 100;
      if (t.type === 'revenue' || t.type === 'income') {
        dailyBreakdown[day].revenue += amount;
        dailyBreakdown[day].net += amount;
      } else {
        dailyBreakdown[day].expense += amount;
        dailyBreakdown[day].net -= amount;
      }
    });

    // Agrupar por método de pagamento
    const byPaymentMethod: Record<string, number> = {};
    allTransactions
      .filter((t: Transaction) => t.type === 'revenue' || t.type === 'income')
      .forEach((t: Transaction) => {
        const method = t.paymentMethod || 'other';
        byPaymentMethod[method] = (byPaymentMethod[method] || 0) + (t.amount || 0) / 100;
      });

    // Calcular totais
    const revenues = allTransactions.filter((t: Transaction) => t.type === 'revenue' || t.type === 'income');
    const expenses = allTransactions.filter((t: Transaction) => t.type === 'expense');

    const grossRevenue = revenues.reduce((sum: number, t: Transaction) => sum + (t.amount || 0), 0) / 100;
    const netRevenue = revenues.reduce((sum: number, t: Transaction) => sum + (t.netAmount || t.amount || 0), 0) / 100;
    const totalExpenses = expenses.reduce((sum: number, t: Transaction) => sum + (t.amount || 0), 0) / 100;

    const commissionRate = 0.5;
    const professionalShare = netRevenue * commissionRate;
    const clinicShare = netRevenue - professionalShare;

    res.json({
      professional,
      period: {
        start: periodStart.toISOString().split('T')[0],
        end: periodEnd.toISOString().split('T')[0],
      },
      summary: {
        grossRevenue,
        netRevenue,
        fees: grossRevenue - netRevenue,
        expenses: totalExpenses,
        commissionRate: commissionRate * 100,
        professionalShare,
        clinicShare,
        professionalNet: professionalShare - totalExpenses,
      },
      transactions: allTransactions.map((t: Transaction) => ({
        id: t.id,
        date: t.date,
        type: t.type,
        category: t.category,
        description: t.description,
        amount: (t.amount || 0) / 100,
        netAmount: (t.netAmount || t.amount || 0) / 100,
        paymentMethod: t.paymentMethod,
        status: t.status,
      })),
      dailyBreakdown: Object.entries(dailyBreakdown)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => b.date.localeCompare(a.date)),
      byPaymentMethod: Object.entries(byPaymentMethod)
        .map(([method, total]) => ({ method, total }))
        .sort((a, b) => b.total - a.total),
    });
  })
);

/**
 * GET /api/v1/financial/dre/ranking
 * Ranking de profissionais por faturamento
 */
router.get(
  '/dre/ranking',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { period } = req.query as any;

    // Calcular período baseado no parâmetro
    const now = new Date();
    let periodStart: Date;
    let periodEnd = new Date(now);
    periodEnd.setHours(23, 59, 59, 999);

    switch (period) {
      case 'week':
        periodStart = new Date(now);
        periodStart.setDate(now.getDate() - 7);
        break;
      case 'month':
      default:
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        periodStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        periodStart = new Date(now.getFullYear(), 0, 1);
        break;
    }

    // Buscar ranking por faturamento
    const ranking = await db
      .select({
        professionalId: financialTransactions.professionalId,
        professionalName: users.fullName,
        speciality: users.speciality,
        totalRevenue: sql<number>`COALESCE(SUM(${financialTransactions.amount}), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(financialTransactions)
      .innerJoin(users, eq(financialTransactions.professionalId, users.id))
      .where(and(
        eq(financialTransactions.companyId, companyId),
        sql`${financialTransactions.type} IN ('revenue', 'income')`,
        gte(financialTransactions.date, periodStart),
        lte(financialTransactions.date, periodEnd),
        sql`${financialTransactions.status} != 'cancelled'`
      ))
      .groupBy(financialTransactions.professionalId, users.fullName, users.speciality)
      .orderBy(sql`SUM(${financialTransactions.amount}) DESC`);

    // Calcular métricas adicionais
    type RankingItem = typeof ranking[0];
    const totalRevenue = ranking.reduce((sum: number, r: RankingItem) => sum + (r.totalRevenue || 0), 0);

    res.json({
      period: {
        type: period || 'month',
        start: periodStart.toISOString().split('T')[0],
        end: periodEnd.toISOString().split('T')[0],
      },
      ranking: ranking.map((r: RankingItem, index: number) => ({
        position: index + 1,
        professionalId: r.professionalId,
        name: r.professionalName,
        speciality: r.speciality,
        revenue: (r.totalRevenue || 0) / 100,
        transactionCount: r.transactionCount,
        percentOfTotal: totalRevenue > 0
          ? Math.round(((r.totalRevenue || 0) / totalRevenue) * 10000) / 100
          : 0,
      })),
      totals: {
        revenue: totalRevenue / 100,
        professionals: ranking.length,
      },
    });
  })
);

export default router;
