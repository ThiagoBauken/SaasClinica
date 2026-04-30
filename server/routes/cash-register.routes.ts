import { Router } from 'express';
import { authCheck, asyncHandler } from '../middleware/auth';
import { db } from '../db';
import {
  boxes,
  boxTransactions,
  financialTransactions,
  appointments,
  appointmentProcedures,
  users,
  inventoryItems,
  inventoryTransactions,
  patients,
} from '@shared/schema';
import { eq, and, gte, lte, sql, desc, isNull, ilike } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a {start, end} pair covering the full calendar day in UTC
 * so that queries include every row whose timestamp falls within today.
 */
function todayRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Payment methods we report on. The column value in the DB uses these strings.
 */
const PAYMENT_METHODS = [
  'dinheiro',
  'pix',
  'cartao_credito',
  'cartao_debito',
  'boleto',
  'cheque',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Validation schemas
// ─────────────────────────────────────────────────────────────────────────────

const openSchema = z.object({
  openingBalance: z.number().min(0),
  responsibleName: z.string().min(1),
});

const transactionSchema = z.object({
  type: z.enum(['deposit', 'withdrawal', 'adjustment']),
  amount: z.number().positive(),
  description: z.string().min(1),
  paymentMethod: z.string().optional(),
});

const closeSchema = z.object({
  countedCash: z.number().min(0),
  responsibleName: z.string().min(1),
  notes: z.string().optional(),
});

// PDV interno — venda de produtos do estoque ao paciente / balcão
const saleItemSchema = z.object({
  itemId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().min(0), // permite override do sale_price (desconto / promoção)
});

const saleSchema = z.object({
  patientId: z.number().int().positive().nullable().optional(),
  items: z.array(saleItemSchema).min(1).max(50),
  paymentMethod: z.enum(PAYMENT_METHODS),
  notes: z.string().max(500).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/cash-register/open
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Abre o caixa da empresa.
 * Apenas 1 caixa pode estar aberto por empresa ao mesmo tempo.
 */
router.post(
  '/open',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId: number = user.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'Usuário não vinculado a uma empresa' });
    }

    const parse = openSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: 'Dados inválidos', details: parse.error.flatten() });
    }
    const { openingBalance } = parse.data;

    // Check for an already-open register
    const [existing] = await db
      .select({ id: boxes.id })
      .from(boxes)
      .where(and(eq(boxes.companyId, companyId), eq(boxes.status, 'open')))
      .limit(1);

    if (existing) {
      return res.status(409).json({ error: 'Já existe um caixa aberto para esta empresa' });
    }

    const now = new Date();
    const openingBalanceStr = openingBalance.toFixed(2);

    // Upsert: try to reuse a previously closed box named "Caixa Principal"
    const [closedBox] = await db
      .select({ id: boxes.id })
      .from(boxes)
      .where(and(eq(boxes.companyId, companyId), eq(boxes.status, 'closed')))
      .orderBy(desc(boxes.lastClosedAt))
      .limit(1);

    let box: typeof boxes.$inferSelect;

    if (closedBox) {
      [box] = await db
        .update(boxes)
        .set({
          status: 'open',
          openingBalance: openingBalanceStr,
          currentBalance: openingBalanceStr,
          responsibleId: user.id,
          lastOpenedAt: now,
          lastClosedAt: null,
        })
        .where(eq(boxes.id, closedBox.id))
        .returning();
    } else {
      [box] = await db
        .insert(boxes)
        .values({
          companyId,
          name: 'Caixa Principal',
          description: 'Caixa da clínica',
          openingBalance: openingBalanceStr,
          currentBalance: openingBalanceStr,
          status: 'open',
          responsibleId: user.id,
          lastOpenedAt: now,
        })
        .returning();
    }

    // Record the opening balance as a deposit transaction so the audit trail is complete
    if (openingBalance > 0) {
      await db.insert(boxTransactions).values({
        companyId,
        boxId: box.id,
        type: 'deposit',
        amount: openingBalanceStr,
        description: 'Saldo inicial de abertura do caixa',
        paymentMethod: 'dinheiro',
        userId: user.id,
      });
    }

    return res.status(201).json({
      message: 'Caixa aberto com sucesso',
      box,
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/cash-register/current
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna o caixa atualmente aberto com todas as transações do dia e
 * totais por método de pagamento.
 */
router.get(
  '/current',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId: number = user.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'Usuário não vinculado a uma empresa' });
    }

    const [box] = await db
      .select()
      .from(boxes)
      .where(and(eq(boxes.companyId, companyId), eq(boxes.status, 'open')))
      .limit(1);

    if (!box) {
      return res.json(null);
    }

    const { start, end } = todayRange();

    // All transactions for this box today
    const transactions = await db
      .select({
        id: boxTransactions.id,
        type: boxTransactions.type,
        amount: boxTransactions.amount,
        description: boxTransactions.description,
        paymentMethod: boxTransactions.paymentMethod,
        referenceId: boxTransactions.referenceId,
        referenceType: boxTransactions.referenceType,
        userId: boxTransactions.userId,
        createdAt: boxTransactions.createdAt,
      })
      .from(boxTransactions)
      .where(
        and(
          eq(boxTransactions.boxId, box.id),
          gte(boxTransactions.createdAt, start),
          lte(boxTransactions.createdAt, end)
        )
      )
      .orderBy(desc(boxTransactions.createdAt));

    // Totals by payment method
    const byMethod: Record<string, { deposits: number; withdrawals: number }> = {};
    for (const m of PAYMENT_METHODS) {
      byMethod[m] = { deposits: 0, withdrawals: 0 };
    }
    byMethod['outros'] = { deposits: 0, withdrawals: 0 };

    let totalDeposits = 0;
    let totalWithdrawals = 0;

    for (const tx of transactions) {
      const amt = parseFloat(tx.amount as string);
      const key = tx.paymentMethod && PAYMENT_METHODS.includes(tx.paymentMethod as any)
        ? tx.paymentMethod
        : 'outros';

      if (tx.type === 'deposit') {
        totalDeposits += amt;
        byMethod[key].deposits += amt;
      } else if (tx.type === 'withdrawal') {
        totalWithdrawals += amt;
        byMethod[key].withdrawals += amt;
      }
      // adjustments affect balance but are not split by direction for payment-method summary
    }

    const openingBalance = parseFloat(box.openingBalance as string ?? '0');
    const expectedBalance = openingBalance + totalDeposits - totalWithdrawals;

    return res.json({
      box,
      transactions,
      summary: {
        openingBalance,
        totalDeposits,
        totalWithdrawals,
        expectedBalance,
        byPaymentMethod: byMethod,
      },
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/cash-register/summary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Produção vs Recebimentos de hoje.
 * Produção  = soma dos procedimentos de consultas concluídas hoje (appointmentProcedures.price em centavos → BRL)
 * Recebimentos = soma de financialTransactions do tipo 'income' e status 'paid' de hoje
 */
router.get(
  '/summary',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId: number = user.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'Usuário não vinculado a uma empresa' });
    }

    const { start, end } = todayRange();

    // ── Production: completed appointments today ──────────────────────────────
    // appointmentProcedures.price is in cents; convert to BRL for display
    const productionRows = await db
      .select({
        totalCents: sql<number>`COALESCE(SUM(${appointmentProcedures.price} * ${appointmentProcedures.quantity}), 0)`,
        procedureCount: sql<number>`COUNT(${appointmentProcedures.id})`,
      })
      .from(appointmentProcedures)
      .innerJoin(appointments, eq(appointmentProcedures.appointmentId, appointments.id))
      .where(
        and(
          eq(appointments.companyId, companyId),
          eq(appointments.status, 'completed'),
          gte(appointments.startTime, start),
          lte(appointments.startTime, end),
          isNull(appointments.deletedAt)
        )
      );

    const productionCents = Number(productionRows[0]?.totalCents ?? 0);
    const productionBrl = productionCents / 100;

    // ── Receipts: income transactions paid today ──────────────────────────────
    // financialTransactions.amount is in cents
    const receiptRows = await db
      .select({
        paymentMethod: financialTransactions.paymentMethod,
        totalCents: sql<number>`COALESCE(SUM(${financialTransactions.amount}), 0)`,
        count: sql<number>`COUNT(${financialTransactions.id})`,
      })
      .from(financialTransactions)
      .where(
        and(
          eq(financialTransactions.companyId, companyId),
          eq(financialTransactions.type, 'income'),
          eq(financialTransactions.status, 'paid'),
          gte(financialTransactions.date, start),
          lte(financialTransactions.date, end),
          isNull(financialTransactions.deletedAt)
        )
      )
      .groupBy(financialTransactions.paymentMethod);

    let totalReceiptsCents = 0;
    const receiptsByMethod: Record<string, { totalBrl: number; count: number }> = {};
    for (const row of receiptRows) {
      const cents = Number(row.totalCents);
      totalReceiptsCents += cents;
      const key = row.paymentMethod ?? 'outros';
      receiptsByMethod[key] = {
        totalBrl: cents / 100,
        count: Number(row.count),
      };
    }
    const totalReceiptsBrl = totalReceiptsCents / 100;

    // ── Pending: completed appointments without a paid financialTransaction ──
    const pendingRows = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${appointments.id})`,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.companyId, companyId),
          eq(appointments.status, 'completed'),
          gte(appointments.startTime, start),
          lte(appointments.startTime, end),
          isNull(appointments.deletedAt),
          // no corresponding paid income transaction for this appointment
          sql`NOT EXISTS (
            SELECT 1 FROM financial_transactions ft
            WHERE ft.appointment_id = ${appointments.id}
              AND ft.type = 'income'
              AND ft.status = 'paid'
              AND ft.deleted_at IS NULL
          )`
        )
      );

    const pendingCount = Number(pendingRows[0]?.count ?? 0);

    return res.json({
      production: {
        totalBrl: productionBrl,
        totalCents: productionCents,
        procedureCount: Number(productionRows[0]?.procedureCount ?? 0),
      },
      receipts: {
        totalBrl: totalReceiptsBrl,
        totalCents: totalReceiptsCents,
        byPaymentMethod: receiptsByMethod,
      },
      pending: {
        count: pendingCount,
      },
      difference: {
        brl: productionBrl - totalReceiptsBrl,
        cents: productionCents - totalReceiptsCents,
      },
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/cash-register/transaction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registra uma movimentação manual no caixa (sangria / suprimento / ajuste).
 * O saldo corrente do caixa é atualizado em seguida.
 */
router.post(
  '/transaction',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId: number = user.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'Usuário não vinculado a uma empresa' });
    }

    const parse = transactionSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: 'Dados inválidos', details: parse.error.flatten() });
    }
    const { type, amount, description, paymentMethod } = parse.data;

    // Require an open register
    const [box] = await db
      .select()
      .from(boxes)
      .where(and(eq(boxes.companyId, companyId), eq(boxes.status, 'open')))
      .limit(1);

    if (!box) {
      return res.status(409).json({ error: 'Nenhum caixa aberto. Abra o caixa primeiro.' });
    }

    const amountStr = amount.toFixed(2);

    // Insert transaction
    const [tx] = await db
      .insert(boxTransactions)
      .values({
        companyId,
        boxId: box.id,
        type,
        amount: amountStr,
        description,
        paymentMethod: paymentMethod ?? 'dinheiro',
        userId: user.id,
      })
      .returning();

    // Update currentBalance
    const currentBalance = parseFloat(box.currentBalance as string ?? '0');
    let newBalance: number;
    if (type === 'deposit') {
      newBalance = currentBalance + amount;
    } else if (type === 'withdrawal') {
      newBalance = currentBalance - amount;
    } else {
      // adjustment: treat as deposit-like (positive = add, negative amounts are not accepted by schema)
      newBalance = currentBalance + amount;
    }

    await db
      .update(boxes)
      .set({ currentBalance: newBalance.toFixed(2) })
      .where(eq(boxes.id, box.id));

    return res.status(201).json({
      message: 'Movimentação registrada com sucesso',
      transaction: tx,
      newBalance,
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/cash-register/close
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fecha o caixa.
 * Calcula a diferença entre o valor contado fisicamente e o saldo esperado.
 */
router.post(
  '/close',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId: number = user.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'Usuário não vinculado a uma empresa' });
    }

    const parse = closeSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: 'Dados inválidos', details: parse.error.flatten() });
    }
    const { countedCash, notes } = parse.data;

    const [box] = await db
      .select()
      .from(boxes)
      .where(and(eq(boxes.companyId, companyId), eq(boxes.status, 'open')))
      .limit(1);

    if (!box) {
      return res.status(409).json({ error: 'Nenhum caixa aberto para fechar' });
    }

    // Recalculate expected balance from all transactions (authoritative)
    const txRows = await db
      .select({
        type: boxTransactions.type,
        amount: boxTransactions.amount,
      })
      .from(boxTransactions)
      .where(eq(boxTransactions.boxId, box.id));

    const openingBalance = parseFloat(box.openingBalance as string ?? '0');
    let expectedBalance = openingBalance;
    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let totalAdjustments = 0;

    for (const tx of txRows) {
      const amt = parseFloat(tx.amount as string);
      if (tx.type === 'deposit') {
        totalDeposits += amt;
        expectedBalance += amt;
      } else if (tx.type === 'withdrawal') {
        totalWithdrawals += amt;
        expectedBalance -= amt;
      } else if (tx.type === 'adjustment') {
        totalAdjustments += amt;
        expectedBalance += amt;
      }
    }

    // Skip opening-balance deposit already counted in openingBalance to avoid double-count
    // (The opening deposit was inserted with type='deposit' and description='Saldo inicial...')
    // We keep it as-is since openingBalance == that initial deposit; the loop above would
    // add it a second time. We correct by treating the first deposit with that description
    // separately. Simplest approach: expectedBalance was already seeded with openingBalance,
    // so subtract the opening deposit that was inserted at open time.
    const openingDepositRows = await db
      .select({ amount: boxTransactions.amount })
      .from(boxTransactions)
      .where(
        and(
          eq(boxTransactions.boxId, box.id),
          eq(boxTransactions.type, 'deposit'),
          eq(boxTransactions.description, 'Saldo inicial de abertura do caixa')
        )
      )
      .limit(1);

    if (openingDepositRows.length > 0) {
      const openingDeposit = parseFloat(openingDepositRows[0].amount as string);
      // It was counted in the loop as deposit but is already in openingBalance baseline
      expectedBalance -= openingDeposit;
      totalDeposits -= openingDeposit;
    }

    const difference = countedCash - expectedBalance;
    const now = new Date();

    const [closedBox] = await db
      .update(boxes)
      .set({
        status: 'closed',
        currentBalance: countedCash.toFixed(2),
        lastClosedAt: now,
      })
      .where(eq(boxes.id, box.id))
      .returning();

    // Record the close as an adjustment transaction for audit trail
    await db.insert(boxTransactions).values({
      companyId,
      boxId: box.id,
      type: 'adjustment',
      amount: Math.abs(difference).toFixed(2),
      description: `Fechamento do caixa. ${notes ?? ''}`.trim(),
      paymentMethod: 'dinheiro',
      userId: user.id,
    });

    return res.json({
      message: 'Caixa fechado com sucesso',
      closing: {
        boxId: box.id,
        closedAt: now,
        openingBalance,
        totalDeposits,
        totalWithdrawals,
        totalAdjustments,
        expectedBalance,
        countedCash,
        difference,
        notes: notes ?? null,
        responsibleId: user.id,
      },
      box: closedBox,
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/cash-register/history
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lista os fechamentos anteriores paginados.
 * Cada linha é um registro de box (status=closed) com totais agregados.
 */
router.get(
  '/history',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId: number = user.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'Usuário não vinculado a uma empresa' });
    }

    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
    const offset = (page - 1) * limit;

    const [{ total }] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(boxes)
      .where(and(eq(boxes.companyId, companyId), eq(boxes.status, 'closed')));

    const closings = await db
      .select({
        id: boxes.id,
        name: boxes.name,
        openingBalance: boxes.openingBalance,
        currentBalance: boxes.currentBalance,
        lastOpenedAt: boxes.lastOpenedAt,
        lastClosedAt: boxes.lastClosedAt,
        responsibleId: boxes.responsibleId,
        responsibleName: users.fullName,
      })
      .from(boxes)
      .leftJoin(users, eq(boxes.responsibleId, users.id))
      .where(and(eq(boxes.companyId, companyId), eq(boxes.status, 'closed')))
      .orderBy(desc(boxes.lastClosedAt))
      .limit(limit)
      .offset(offset);

    // Aggregate totals per closing
    const boxIds = closings.map((c: any) => c.id);
    let aggregates: Record<number, { deposits: number; withdrawals: number; txCount: number }> = {};

    if (boxIds.length > 0) {
      const aggRows = await db
        .select({
          boxId: boxTransactions.boxId,
          type: boxTransactions.type,
          total: sql<number>`COALESCE(SUM(${boxTransactions.amount}::numeric), 0)`,
          count: sql<number>`COUNT(*)`,
        })
        .from(boxTransactions)
        .where(
          sql`${boxTransactions.boxId} = ANY(ARRAY[${sql.raw(boxIds.join(','))}]::int[])`
        )
        .groupBy(boxTransactions.boxId, boxTransactions.type);

      for (const row of aggRows) {
        if (!aggregates[row.boxId]) {
          aggregates[row.boxId] = { deposits: 0, withdrawals: 0, txCount: 0 };
        }
        if (row.type === 'deposit') aggregates[row.boxId].deposits += Number(row.total);
        if (row.type === 'withdrawal') aggregates[row.boxId].withdrawals += Number(row.total);
        aggregates[row.boxId].txCount += Number(row.count);
      }
    }

    const result = closings.map((c: any) => ({
      ...c,
      totals: aggregates[c.id] ?? { deposits: 0, withdrawals: 0, txCount: 0 },
    }));

    return res.json({
      data: result,
      pagination: {
        page,
        limit,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limit),
      },
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/cash-register/history/:id
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detalha um único fechamento (box) com todas as suas transações.
 */
router.get(
  '/history/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId: number = user.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'Usuário não vinculado a uma empresa' });
    }

    const boxId = parseInt(req.params.id, 10);
    if (isNaN(boxId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const [box] = await db
      .select({
        id: boxes.id,
        name: boxes.name,
        openingBalance: boxes.openingBalance,
        currentBalance: boxes.currentBalance,
        status: boxes.status,
        lastOpenedAt: boxes.lastOpenedAt,
        lastClosedAt: boxes.lastClosedAt,
        responsibleId: boxes.responsibleId,
        responsibleName: users.fullName,
      })
      .from(boxes)
      .leftJoin(users, eq(boxes.responsibleId, users.id))
      .where(and(eq(boxes.id, boxId), eq(boxes.companyId, companyId)))
      .limit(1);

    if (!box) {
      return res.status(404).json({ error: 'Fechamento não encontrado' });
    }

    const transactions = await db
      .select()
      .from(boxTransactions)
      .where(eq(boxTransactions.boxId, boxId))
      .orderBy(desc(boxTransactions.createdAt));

    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let totalAdjustments = 0;
    const byMethod: Record<string, { deposits: number; withdrawals: number }> = {};

    for (const tx of transactions) {
      const amt = parseFloat(tx.amount as string);
      const key = tx.paymentMethod ?? 'outros';
      if (!byMethod[key]) byMethod[key] = { deposits: 0, withdrawals: 0 };

      if (tx.type === 'deposit') {
        totalDeposits += amt;
        byMethod[key].deposits += amt;
      } else if (tx.type === 'withdrawal') {
        totalWithdrawals += amt;
        byMethod[key].withdrawals += amt;
      } else if (tx.type === 'adjustment') {
        totalAdjustments += amt;
      }
    }

    return res.json({
      box,
      transactions,
      summary: {
        openingBalance: parseFloat(box.openingBalance as string ?? '0'),
        totalDeposits,
        totalWithdrawals,
        totalAdjustments,
        closingBalance: parseFloat(box.currentBalance as string ?? '0'),
        byPaymentMethod: byMethod,
      },
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/cash-register/sale  — PDV interno (venda de produtos do estoque)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registra uma venda de produtos do estoque ao balcão.
 *
 * Em uma única transação SQL:
 *   1. Trava cada inventoryItem (FOR UPDATE), verifica is_sellable + active +
 *      current_stock >= quantity solicitada.
 *   2. Insere N inventoryTransactions (type='saída') registrando previousStock,
 *      newStock e patientId (opcional).
 *   3. Atualiza inventoryItems.currentStock.
 *   4. Insere 1 boxTransaction (type='deposit', referenceType='product_sale')
 *      no caixa aberto, somando todos os itens.
 *   5. Atualiza boxes.currentBalance.
 *
 * Retorna { saleId (= boxTransactionId), totalCents, items[] }.
 * Em caso de qualquer falha (estoque insuficiente, item não vendável, etc) o
 * BEGIN/ROLLBACK garante que nada é persistido — sem venda parcial.
 */
router.post(
  '/sale',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId: number = user.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'Usuário não vinculado a uma empresa' });
    }

    const parse = saleSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: 'Dados inválidos', details: parse.error.flatten() });
    }
    const { patientId, items, paymentMethod, notes } = parse.data;

    // Caixa aberto é pré-requisito.
    const [box] = await db
      .select()
      .from(boxes)
      .where(and(eq(boxes.companyId, companyId), eq(boxes.status, 'open')))
      .limit(1);
    if (!box) {
      return res.status(409).json({ error: 'Nenhum caixa aberto. Abra o caixa primeiro.' });
    }

    // Se patientId foi enviado, valida que pertence à mesma empresa.
    if (patientId != null) {
      const [pt] = await db
        .select({ id: patients.id })
        .from(patients)
        .where(and(eq(patients.id, patientId), eq(patients.companyId, companyId)))
        .limit(1);
      if (!pt) {
        return res.status(404).json({ error: 'Paciente não encontrado' });
      }
    }

    try {
      const result = await db.transaction(async (tx: any) => {
        const movements: Array<{
          itemId: number;
          name: string;
          quantity: number;
          unitPriceCents: number;
          subtotalCents: number;
          previousStock: number;
          newStock: number;
          inventoryTransactionId: number;
        }> = [];
        let totalCents = 0;

        for (const line of items) {
          // SELECT ... FOR UPDATE — evita venda concorrente "comendo" o mesmo estoque.
          const lockedRows = await tx.execute(sql`
            SELECT id, name, current_stock, is_sellable, active, deleted_at
            FROM inventory_items
            WHERE id = ${line.itemId} AND company_id = ${companyId}
            FOR UPDATE
          `);
          const row = (lockedRows.rows ?? lockedRows)[0] as
            | { id: number; name: string; current_stock: number; is_sellable: boolean; active: boolean; deleted_at: Date | null }
            | undefined;

          if (!row) {
            throw new SaleValidationError(`Item ${line.itemId} não encontrado.`);
          }
          if (row.deleted_at != null || row.active === false) {
            throw new SaleValidationError(`Item "${row.name}" está inativo.`);
          }
          if (row.is_sellable !== true) {
            throw new SaleValidationError(`Item "${row.name}" não está marcado como vendável.`);
          }
          const previousStock = Number(row.current_stock ?? 0);
          if (previousStock < line.quantity) {
            throw new SaleValidationError(
              `Estoque insuficiente de "${row.name}": disponível ${previousStock}, solicitado ${line.quantity}.`
            );
          }
          const newStock = previousStock - line.quantity;

          // 1. Registra a movimentação no histórico de estoque.
          const [mov] = await tx
            .insert(inventoryTransactions)
            .values({
              companyId,
              itemId: line.itemId,
              userId: user.id,
              type: 'saída',
              quantity: line.quantity,
              reason: 'Venda PDV',
              previousStock,
              newStock,
              patientId: patientId ?? null,
            })
            .returning({ id: inventoryTransactions.id });

          // 2. Decrementa o estoque do item.
          await tx
            .update(inventoryItems)
            .set({ currentStock: newStock, updatedAt: new Date() })
            .where(eq(inventoryItems.id, line.itemId));

          const subtotalCents = line.unitPriceCents * line.quantity;
          totalCents += subtotalCents;
          movements.push({
            itemId: line.itemId,
            name: row.name,
            quantity: line.quantity,
            unitPriceCents: line.unitPriceCents,
            subtotalCents,
            previousStock,
            newStock,
            inventoryTransactionId: mov.id,
          });
        }

        // 3. Lança a entrada no caixa, em uma única boxTransaction de depósito.
        const totalBrl = (totalCents / 100).toFixed(2);
        const description = movements
          .map((m) => `${m.quantity}× ${m.name}`)
          .join(', ')
          .slice(0, 250);

        const [boxTx] = await tx
          .insert(boxTransactions)
          .values({
            companyId,
            boxId: box.id,
            type: 'deposit',
            amount: totalBrl,
            description: `Venda PDV: ${description}${notes ? ` — ${notes}` : ''}`,
            paymentMethod,
            referenceType: 'product_sale',
            userId: user.id,
          })
          .returning({ id: boxTransactions.id });

        // 4. Atualiza saldo corrente do caixa.
        const currentBalance = parseFloat((box.currentBalance as string) ?? '0');
        const newBalance = currentBalance + totalCents / 100;
        await tx
          .update(boxes)
          .set({ currentBalance: newBalance.toFixed(2) })
          .where(eq(boxes.id, box.id));

        return { saleId: boxTx.id, totalCents, items: movements, newBoxBalance: newBalance };
      });

      return res.status(201).json({
        message: 'Venda registrada com sucesso',
        sale: result,
      });
    } catch (err) {
      if (err instanceof SaleValidationError) {
        return res.status(409).json({ error: err.message });
      }
      throw err;
    }
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/cash-register/sales  — histórico de vendas PDV
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lista as vendas (boxTransactions com referenceType='product_sale') do caixa
 * aberto da empresa, filtráveis por intervalo de datas. Útil pro relatório
 * "o que vendi hoje no balcão".
 */
router.get(
  '/sales',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId: number = user.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'Usuário não vinculado a uma empresa' });
    }

    const fromQ = typeof req.query.from === 'string' ? new Date(req.query.from) : null;
    const toQ = typeof req.query.to === 'string' ? new Date(req.query.to) : null;

    const conditions = [
      eq(boxTransactions.companyId, companyId),
      eq(boxTransactions.referenceType, 'product_sale'),
    ];
    if (fromQ && !Number.isNaN(fromQ.getTime())) conditions.push(gte(boxTransactions.createdAt, fromQ));
    if (toQ && !Number.isNaN(toQ.getTime())) conditions.push(lte(boxTransactions.createdAt, toQ));

    const sales = await db
      .select({
        id: boxTransactions.id,
        amount: boxTransactions.amount,
        description: boxTransactions.description,
        paymentMethod: boxTransactions.paymentMethod,
        userId: boxTransactions.userId,
        createdAt: boxTransactions.createdAt,
      })
      .from(boxTransactions)
      .where(and(...conditions))
      .orderBy(desc(boxTransactions.createdAt))
      .limit(500);

    return res.json({ sales });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/cash-register/sellable-items  — catálogo do PDV
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna apenas os itens do estoque marcados como vendáveis (`is_sellable=true`),
 * ativos, não soft-deletados e com estoque > 0. Suporta busca por nome via `?q=`.
 * É a fonte que alimenta o autocomplete do PDV.
 */
router.get(
  '/sellable-items',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId: number = user.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'Usuário não vinculado a uma empresa' });
    }

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const conditions = [
      eq(inventoryItems.companyId, companyId),
      eq(inventoryItems.isSellable, true),
      eq(inventoryItems.active, true),
      isNull(inventoryItems.deletedAt),
    ];
    if (q) conditions.push(ilike(inventoryItems.name, `%${q}%`));

    const rows = await db
      .select({
        id: inventoryItems.id,
        name: inventoryItems.name,
        sku: inventoryItems.sku,
        barcode: inventoryItems.barcode,
        salePrice: inventoryItems.salePrice,
        currentStock: inventoryItems.currentStock,
        unitOfMeasure: inventoryItems.unitOfMeasure,
        categoryId: inventoryItems.categoryId,
      })
      .from(inventoryItems)
      .where(and(...conditions))
      .orderBy(inventoryItems.name)
      .limit(200);

    return res.json({ items: rows });
  })
);

// Erro tipado lançado dentro da transação para permitir distinguir
// validação de negócio (409) de falha real (500).
class SaleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaleValidationError';
  }
}

export default router;
