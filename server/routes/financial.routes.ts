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
    const user = req.user!;
    const companyId = user.companyId;

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
        notDeleted(users.deletedAt),
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
            notDeleted(financialTransactions.deletedAt),
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
            notDeleted(financialTransactions.deletedAt),
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
            notDeleted(financialTransactions.deletedAt),
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
            notDeleted(appointments.deletedAt),
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
 * DRE detalhado de um profissional específico.
 * Extras versus the list endpoint:
 *   - monthlyTarget / targetProgress: from query param or professional_targets table
 *   - previousPeriod: same metrics for the immediately preceding same-length period
 *     (for Month-over-Month comparison)
 */
router.get(
  '/dre/professional/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params;
    const { startDate, endDate, monthlyTarget: monthlyTargetParam } = req.query as any;

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
        eq(users.companyId, companyId),
        notDeleted(users.deletedAt)
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
        notDeleted(financialTransactions.deletedAt),
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

    // ─── Monthly target / progress ────────────────────────────────────────────
    // Resolve target: query param > professional_targets table > null
    let monthlyTarget: number | null = null;

    if (monthlyTargetParam) {
      monthlyTarget = parseFloat(monthlyTargetParam);
    } else {
      // Attempt to load from an optional professional_targets table (may not exist)
      try {
        const targetResult = await db.$client.query(
          `SELECT monthly_target FROM professional_targets
           WHERE company_id = $1 AND professional_id = $2 LIMIT 1`,
          [companyId, parseInt(id)]
        );
        if (targetResult.rows[0]?.monthly_target) {
          monthlyTarget = parseFloat(targetResult.rows[0].monthly_target);
        }
      } catch {
        // Table may not exist yet — silently ignore
      }
    }

    const targetProgress =
      monthlyTarget && monthlyTarget > 0
        ? Math.round((grossRevenue / monthlyTarget) * 10000) / 100 // percentage, 2 dp
        : null;

    // ─── Previous period (MoM comparison) ────────────────────────────────────
    // Compute a window of the same length immediately before periodStart
    const periodLengthMs = periodEnd.getTime() - periodStart.getTime();
    const prevPeriodEnd = new Date(periodStart.getTime() - 1); // 1 ms before start
    const prevPeriodStart = new Date(prevPeriodEnd.getTime() - periodLengthMs);

    const prevTransactions = await db
      .select()
      .from(financialTransactions)
      .where(and(
        eq(financialTransactions.companyId, companyId),
        notDeleted(financialTransactions.deletedAt),
        eq(financialTransactions.professionalId, parseInt(id)),
        gte(financialTransactions.date, prevPeriodStart),
        lte(financialTransactions.date, prevPeriodEnd),
        sql`${financialTransactions.status} != 'cancelled'`
      ));

    type PrevTransaction = typeof prevTransactions[0];
    const prevRevenues = prevTransactions.filter(
      (t: PrevTransaction) => t.type === 'revenue' || t.type === 'income'
    );
    const prevExpenses = prevTransactions.filter(
      (t: PrevTransaction) => t.type === 'expense'
    );

    const prevGrossRevenue =
      prevRevenues.reduce((s: number, t: PrevTransaction) => s + (t.amount || 0), 0) / 100;
    const prevNetRevenue =
      prevRevenues.reduce(
        (s: number, t: PrevTransaction) => s + (t.netAmount || t.amount || 0),
        0
      ) / 100;
    const prevTotalExpenses =
      prevExpenses.reduce((s: number, t: PrevTransaction) => s + (t.amount || 0), 0) / 100;
    const prevProfessionalShare = prevNetRevenue * commissionRate;

    const momChange =
      prevGrossRevenue > 0
        ? Math.round(((grossRevenue - prevGrossRevenue) / prevGrossRevenue) * 10000) / 100
        : null;

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
      target: {
        monthlyTarget,
        targetProgress,
        onTrack: targetProgress !== null ? targetProgress >= 100 : null,
      },
      previousPeriod: {
        start: prevPeriodStart.toISOString().split('T')[0],
        end: prevPeriodEnd.toISOString().split('T')[0],
        grossRevenue: prevGrossRevenue,
        netRevenue: prevNetRevenue,
        expenses: prevTotalExpenses,
        professionalShare: prevProfessionalShare,
        professionalNet: prevProfessionalShare - prevTotalExpenses,
        momChangePercent: momChange,
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
 * GET /api/v1/financial/dre/professional/:id/payslip
 * Gera um holerite (payslip) PDF para o profissional no período solicitado.
 * Inclui: receita bruta, deduções (ISS + materiais), comissão líquida e lista
 * de atendimentos realizados.
 */
router.get(
  '/dre/professional/:id/payslip',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params;
    const { startDate, endDate } = req.query as any;

    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const periodStart = startDate ? new Date(startDate) : defaultStart;
    const periodEnd = endDate ? new Date(endDate) : defaultEnd;

    // Fetch professional
    const [professional] = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        speciality: users.speciality,
        email: users.email,
      })
      .from(users)
      .where(and(
        eq(users.id, parseInt(id)),
        eq(users.companyId, companyId),
        notDeleted(users.deletedAt)
      ));

    if (!professional) {
      return res.status(404).json({ error: 'Professional not found' });
    }

    // Fetch company info
    const [company] = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, companyId));

    // Revenue transactions
    const revTransactions = await db
      .select()
      .from(financialTransactions)
      .where(and(
        eq(financialTransactions.companyId, companyId),
        notDeleted(financialTransactions.deletedAt),
        eq(financialTransactions.professionalId, parseInt(id)),
        sql`${financialTransactions.type} IN ('revenue', 'income')`,
        gte(financialTransactions.date, periodStart),
        lte(financialTransactions.date, periodEnd),
        sql`${financialTransactions.status} != 'cancelled'`
      ))
      .orderBy(desc(financialTransactions.date));

    // Expense transactions (materials attributed to this professional)
    const expTransactions = await db
      .select()
      .from(financialTransactions)
      .where(and(
        eq(financialTransactions.companyId, companyId),
        notDeleted(financialTransactions.deletedAt),
        eq(financialTransactions.professionalId, parseInt(id)),
        eq(financialTransactions.type, 'expense'),
        gte(financialTransactions.date, periodStart),
        lte(financialTransactions.date, periodEnd),
        sql`${financialTransactions.status} != 'cancelled'`
      ));

    // Completed appointments
    const completedApts = await db
      .select({
        id: appointments.id,
        startTime: appointments.startTime,
        status: appointments.status,
      })
      .from(appointments)
      .where(and(
        eq(appointments.companyId, companyId),
        notDeleted(appointments.deletedAt),
        eq(appointments.professionalId, parseInt(id)),
        eq(appointments.status, 'completed'),
        gte(appointments.startTime, periodStart),
        lte(appointments.startTime, periodEnd)
      ))
      .orderBy(desc(appointments.startTime));

    type RevTx = typeof revTransactions[0];
    type ExpTx = typeof expTransactions[0];

    const grossRevenue =
      revTransactions.reduce((s: number, t: RevTx) => s + (t.amount || 0), 0) / 100;
    const netRevenue =
      revTransactions.reduce(
        (s: number, t: RevTx) => s + (t.netAmount || t.amount || 0),
        0
      ) / 100;
    const processingFees = grossRevenue - netRevenue;
    const materialExpenses =
      expTransactions.reduce((s: number, t: ExpTx) => s + (t.amount || 0), 0) / 100;

    // ISS 5% on gross (configurable — using fixed rate here)
    const issRate = 0.05;
    const issDeduction = grossRevenue * issRate;

    const commissionRate = 0.5;
    const grossCommission = netRevenue * commissionRate;
    const netCommission = grossCommission - materialExpenses;

    // Generate PDF
    const PDFDocument = (await import('pdfkit')).default;
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    await new Promise<void>((resolve) => {
      doc.on('end', resolve);

      // Header
      doc.fontSize(18).font('Helvetica-Bold')
        .text('HOLERITE / DEMONSTRATIVO DE PAGAMENTO', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica')
        .text(company?.name ?? 'Clínica', { align: 'center' });
      doc.moveDown(1);

      // Professional & period
      doc.fontSize(11).font('Helvetica-Bold').text('Profissional');
      doc.fontSize(10).font('Helvetica')
        .text(`${professional.fullName}${professional.speciality ? ' — ' + professional.speciality : ''}`);
      doc.moveDown(0.3);
      doc.text(
        `Período: ${periodStart.toLocaleDateString('pt-BR')} a ${periodEnd.toLocaleDateString('pt-BR')}`
      );
      doc.moveDown(1);

      // Separator
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#333').lineWidth(0.5).stroke();
      doc.moveDown(0.8);

      const fmt = (v: number) =>
        v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

      // Revenue section
      doc.fontSize(11).font('Helvetica-Bold').text('RECEITAS');
      doc.fontSize(10).font('Helvetica');
      doc.text(`Receita Bruta:                          ${fmt(grossRevenue)}`, { continued: false });
      doc.text(`(-) Taxas de Processamento:             ${fmt(processingFees)}`);
      doc.text(`(-) ISS (${(issRate * 100).toFixed(0)}%):                            ${fmt(issDeduction)}`);
      doc.font('Helvetica-Bold')
        .text(`Receita Líquida:                        ${fmt(netRevenue - issDeduction)}`);
      doc.moveDown(1);

      // Split section
      doc.fontSize(11).font('Helvetica-Bold').text('COMISSÃO');
      doc.fontSize(10).font('Helvetica');
      doc.text(`Taxa do Profissional:                   ${(commissionRate * 100).toFixed(0)}%`);
      doc.text(`Comissão Bruta:                         ${fmt(grossCommission)}`);
      doc.text(`(-) Materiais / Despesas Atribuídas:    ${fmt(materialExpenses)}`);
      doc.font('Helvetica-Bold')
        .text(`Comissão Líquida a Receber:             ${fmt(netCommission)}`);
      doc.moveDown(1);

      // Appointments list
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#333').lineWidth(0.5).stroke();
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica-Bold')
        .text(`ATENDIMENTOS REALIZADOS (${completedApts.length})`);
      doc.fontSize(9).font('Helvetica');
      type AptRow = typeof completedApts[0];
      completedApts.slice(0, 50).forEach((apt: AptRow) => {
        doc.text(`• ${new Date(apt.startTime!).toLocaleDateString('pt-BR')} — ID #${apt.id}`);
      });
      if (completedApts.length > 50) {
        doc.text(`... e mais ${completedApts.length - 50} atendimentos`);
      }

      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#333').lineWidth(0.5).stroke();
      doc.moveDown(0.5);
      doc.fontSize(7).fillColor('#888')
        .text(
          `Documento gerado em ${new Date().toLocaleString('pt-BR')} por ${user.fullName || 'Sistema'}`,
          { align: 'center' }
        );

      doc.end();
    });

    const pdfBuffer = Buffer.concat(chunks);
    const filename = `holerite_${professional.id}_${periodStart.toISOString().slice(0, 7)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
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
    const user = req.user!;
    const companyId = user.companyId;

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
        notDeleted(financialTransactions.deletedAt),
        notDeleted(users.deletedAt),
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

// ==========================================
// NFS-e (NOTA FISCAL DE SERVICO ELETRONICA)
// ==========================================

/**
 * POST /api/v1/financial/nfse/emit
 * Emite NFS-e para um pagamento/servico prestado
 */
router.post(
  '/nfse/emit',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const { nfseService } = await import('../services/nfse-emission.service');
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const result = await nfseService.emit({ ...req.body, companyId });

    if (result.success) {
      await db.$client.query(
        `INSERT INTO audit_logs (company_id, user_id, action, resource_type, details)
         VALUES ($1, $2, 'create', 'nfse', $3)`,
        [companyId, user.id, JSON.stringify(result)]
      );
    }

    res.json(result);
  })
);

/**
 * POST /api/v1/financial/nfse/cancel
 * Cancela uma NFS-e emitida
 */
router.post(
  '/nfse/cancel',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const { nfseService } = await import('../services/nfse-emission.service');
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { nfseNumber, reason } = req.body;

    if (!nfseNumber) {
      return res.status(400).json({ error: 'nfseNumber is required' });
    }

    const result = await nfseService.cancel(companyId, nfseNumber, reason || 'Cancelamento solicitado pelo usuario');

    if (result.success) {
      await db.$client.query(
        `INSERT INTO audit_logs (company_id, user_id, action, resource_type, details)
         VALUES ($1, $2, 'delete', 'nfse', $3)`,
        [companyId, user.id, JSON.stringify({ nfseNumber, reason })]
      );
    }

    res.json(result);
  })
);

/**
 * GET /api/v1/financial/nfse/query/:nfseNumber
 * Consulta o status de uma NFS-e emitida
 */
router.get(
  '/nfse/query/:nfseNumber',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const { nfseService } = await import('../services/nfse-emission.service');
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const result = await nfseService.query(companyId, req.params.nfseNumber);
    res.json(result);
  })
);

export default router;

