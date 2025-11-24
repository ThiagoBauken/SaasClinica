import { Router } from 'express';
import { storage } from '../storage';
import { authCheck, asyncHandler } from '../middleware/auth';
import { db } from '../db';
import { financialTransactions, payments, paymentPlans, boxes, boxTransactions } from '@shared/schema';
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
      summary: summary.map(s => ({
        type: s.type,
        total: (s.total || 0) / 100,
        count: s.count,
      })),
      byCategory: byCategory.map(c => ({
        category: c.category,
        type: c.type,
        total: (c.total || 0) / 100,
        count: c.count,
      })),
    });
  })
);

export default router;
