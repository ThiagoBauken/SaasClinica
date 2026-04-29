import { Router } from 'express';
import { storage } from '../storage';
import { authCheck, tenantAwareAuth, asyncHandler } from '../middleware/auth';
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
import { notDeleted } from '../lib/soft-delete';
import { progressOpportunityByPhone } from '../services/crm-auto-progression';
import { z } from 'zod';

import { logger } from '../logger';
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
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { startDate, endDate, type, category } = req.query as any;

    // Pagination bounds: default limit 100, hard cap 1000
    const rawLimit = parseInt((req.query.limit as string) || '100', 10);
    const rawOffset = parseInt((req.query.offset as string) || '0', 10);
    const limit = Math.min(isNaN(rawLimit) || rawLimit < 1 ? 100 : rawLimit, 1000);
    const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

    // Build where conditions
    const conditions = [
      eq(financialTransactions.companyId, companyId),
      notDeleted(financialTransactions.deletedAt),
    ];

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
      .orderBy(desc(financialTransactions.date))
      .limit(limit)
      .offset(offset);

    res.json({ data: transactions, pagination: { limit, offset } });
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
    const user = req.user!;
    const companyId = user.companyId;

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
    const user = req.user!;
    const companyId = user.companyId;

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
    const user = req.user!;
    const companyId = user.companyId;

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
    const user = req.user!;
    const companyId = user.companyId;

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
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { patientId } = req.params;
    const { amount, paymentMethod, description, appointmentId } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    const payment = await db.transaction(async (tx: any) => {
      const [newPayment] = await tx
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
      return newPayment;
    });

    // CRM: Progride pipeline para payment_done quando pagamento é registrado
    const patient = await storage.getPatient(parseInt(patientId), companyId);
    const patientPhone = patient?.phone || (patient as any)?.whatsappPhone;
    if (patientPhone) {
      progressOpportunityByPhone(companyId, patientPhone, 'payment_done', {
        paymentId: payment.id,
        appointmentId: appointmentId || null,
        amount,
      }).catch(err => logger.error({ err: err }, 'CRM progression error (payment_done):'));
    }

    // Enviar recibo por WhatsApp (async, nao bloqueia resposta)
    if (patientPhone) {
      try {
        const { addWhatsAppJob } = await import('../queue/queues');
        await addWhatsAppJob({
          type: 'payment-receipt-whatsapp',
          patientId: parseInt(patientId),
          companyId,
          paymentId: payment.id,
          amount,
          paymentMethod: paymentMethod || 'cash',
        });
      } catch (receiptErr) {
        logger.error({ err: receiptErr }, 'Erro ao agendar recibo WhatsApp:');
      }
    }

    // Auto-emitir NFS-e se configurado (async, nao bloqueia resposta)
    try {
      const fiscalResult = await db.$client.query(
        `SELECT nfse_provider, nfse_token, auto_emit_nfse, default_service_code
         FROM fiscal_settings
         WHERE company_id = $1
         LIMIT 1`,
        [companyId]
      );

      if (fiscalResult.rows.length > 0) {
        const fiscalConfig = fiscalResult.rows[0];
        if (fiscalConfig.auto_emit_nfse && fiscalConfig.nfse_provider && fiscalConfig.nfse_token) {
          const { NfseEmissionService } = await import('../services/nfse-emission.service');
          const nfseService = new NfseEmissionService();

          const patientRecord = patient || await storage.getPatient(parseInt(patientId), companyId);
          const patientCpf = (patientRecord as any)?.cpf || '';
          const patientFullName = (patientRecord as any)?.fullName || (patientRecord as any)?.name || 'Paciente';

          logger.info({ paymentId: payment.id }, 'Auto-emitting NFS-e for confirmed payment');

          nfseService.emit({
            companyId,
            patientName: patientFullName,
            patientCpf,
            serviceDescription: description || 'Serviço odontológico',
            serviceCode: fiscalConfig.default_service_code || '14.01',
            amount: Math.round(amount * 100), // em centavos
            paymentId: payment.id,
            issDate: new Date(),
          }).then(result => {
            if (result.success) {
              logger.info({ paymentId: payment.id, nfseNumber: result.nfseNumber }, 'NFS-e emitida com sucesso');
            } else {
              logger.warn({ paymentId: payment.id, error: result.error }, 'NFS-e auto-emission returned failure');
            }
          }).catch(nfseErr => {
            logger.error({ err: nfseErr, paymentId: payment.id }, 'Failed to auto-emit NFS-e');
          });
        }
      }
    } catch (nfseError) {
      // Nao falha o pagamento se a emissao de NFS-e falhar
      logger.error({ err: nfseError, paymentId: payment.id }, 'Failed to check fiscal settings for NFS-e auto-emission');
    }

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
    const user = req.user!;
    const companyId = user.companyId;

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
        notDeleted(financialTransactions.deletedAt),
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
        notDeleted(financialTransactions.deletedAt),
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
    const user = req.user!;
    const companyId = user.companyId;

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
        notDeleted(financialTransactions.deletedAt),
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
        notDeleted(financialTransactions.deletedAt),
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
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { startDate, endDate } = req.query as any;

    const conditions = [
      eq(financialTransactions.companyId, companyId),
      notDeleted(financialTransactions.deletedAt),
    ];

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
// DRE & NFS-e: Extracted to sub-routers for maintainability
// ==========================================
import financialDreRouter from './financial-dre.routes';
import financialNfseRouter from './financial-nfse.routes';
router.use('/dre', financialDreRouter);
router.use('/nfse', financialNfseRouter);

export default router;
