import { Request, Response } from "express";
import { db } from "./db";
import { payments, appointments, appointmentProcedures, procedures } from "@shared/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { notDeleted } from "./lib/soft-delete";
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, format } from "date-fns";

import { logger } from './logger';
/**
 * Financial APIs - Endpoints para dados financeiros
 */

/**
 * GET /api/transactions
 * Retorna transações financeiras com filtro de data
 */
export async function getTransactions(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const companyId = user.companyId;
    const { filter = "this-month" } = req.query;

    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (filter) {
      case "this-month":
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case "last-month":
        startDate = startOfMonth(subMonths(now, 1));
        endDate = endOfMonth(subMonths(now, 1));
        break;
      case "this-year":
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
      default:
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
    }

    // Buscar pagamentos (receitas)
    const paymentsData = await db
      .select({
        id: payments.id,
        type: sql<string>`'revenue'`,
        date: payments.paymentDate,
        category: sql<string>`'Consulta'`,
        description: sql<string>`CONCAT('Pagamento - ', ${payments.id})`,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        status: payments.status,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .innerJoin(appointments, eq(payments.appointmentId, appointments.id))
      .where(
        and(
          eq(appointments.companyId, companyId),
          notDeleted(appointments.deletedAt),
          gte(payments.paymentDate, startDate),
          lte(payments.paymentDate, endDate)
        )
      )
      .orderBy(desc(payments.paymentDate));

    res.json(paymentsData);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching transactions:');
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
}

/**
 * GET /api/financial/revenue-by-month
 * Retorna receita agrupada por mês
 */
export async function getRevenueByMonth(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const companyId = user.companyId;

    const now = new Date();
    const startDate = subMonths(startOfMonth(now), 6); // Últimos 7 meses
    const endDate = endOfMonth(now);

    const revenueData = await db
      .select({
        month: sql<string>`TO_CHAR(${payments.paymentDate}, 'Mon')`,
        monthNum: sql<number>`EXTRACT(MONTH FROM ${payments.paymentDate})::int`,
        valor: sql<number>`SUM(${payments.amount})::int`,
      })
      .from(payments)
      .innerJoin(appointments, eq(payments.appointmentId, appointments.id))
      .where(
        and(
          eq(appointments.companyId, companyId),
          notDeleted(appointments.deletedAt),
          eq(payments.status, "paid"),
          gte(payments.paymentDate, startDate),
          lte(payments.paymentDate, endDate)
        )
      )
      .groupBy(sql`EXTRACT(MONTH FROM ${payments.paymentDate})`, sql`TO_CHAR(${payments.paymentDate}, 'Mon')`)
      .orderBy(sql`EXTRACT(MONTH FROM ${payments.paymentDate})`);

    // Converter centavos para reais
    interface RevenueItem { month: string; monthNum: number; valor: number }
    const formattedData = revenueData.map((item: RevenueItem) => ({
      month: item.month,
      valor: Math.round(item.valor / 100), // Converter de centavos para reais
    }));

    res.json(formattedData);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching revenue by month:');
    res.status(500).json({ error: "Failed to fetch revenue data" });
  }
}

/**
 * GET /api/financial/revenue-by-type
 * Retorna receita agrupada por tipo de procedimento
 */
export async function getRevenueByType(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const companyId = user.companyId;

    const now = new Date();
    const startDate = startOfYear(now);
    const endDate = endOfYear(now);

    const revenueByType = await db
      .select({
        name: procedures.name,
        value: sql<number>`COUNT(*)::int`,
        revenue: sql<number>`SUM(${procedures.price})::int`,
      })
      .from(appointmentProcedures)
      .innerJoin(procedures, eq(appointmentProcedures.procedureId, procedures.id))
      .innerJoin(appointments, eq(appointmentProcedures.appointmentId, appointments.id))
      .innerJoin(payments, eq(payments.appointmentId, appointments.id))
      .where(
        and(
          eq(appointments.companyId, companyId),
          notDeleted(appointments.deletedAt),
          eq(payments.status, "paid"),
          gte(payments.paymentDate, startDate),
          lte(payments.paymentDate, endDate)
        )
      )
      .groupBy(procedures.name)
      .limit(4);

    res.json(revenueByType);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching revenue by type:');
    res.status(500).json({ error: "Failed to fetch revenue by type" });
  }
}

/**
 * POST /api/transactions
 * Criar nova transação financeira
 */
export async function createTransaction(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const companyId = user.companyId;
    const transactionData = req.body;

    // Aqui você implementaria a lógica de criar transação
    // Por enquanto, retornamos sucesso
    res.status(201).json({
      id: Date.now(),
      ...transactionData,
      companyId,
      createdAt: new Date(),
    });
  } catch (error) {
    logger.error({ err: error }, 'Error creating transaction:');
    res.status(500).json({ error: "Failed to create transaction" });
  }
}

/**
 * PATCH /api/transactions/:id
 * Atualiza campos de uma transação (pagamento) garantindo isolamento por companyId
 */
export async function updateTransaction(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const companyId = user.companyId;
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid transaction id" });
    }

    const { status, amount, description, paymentMethod, paymentDate } = req.body;

    // Build only the fields that were actually provided
    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (amount !== undefined) updates.amount = amount;
    if (description !== undefined) updates.description = description;
    if (paymentMethod !== undefined) updates.payment_method = paymentMethod;
    if (paymentDate !== undefined) updates.payment_date = new Date(paymentDate);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No updatable fields provided" });
    }

    const result = await db.$client.query(
      `UPDATE payments
          SET ${Object.keys(updates)
            .map((col, i) => `${col} = $${i + 1}`)
            .join(", ")}
        WHERE id = $${Object.keys(updates).length + 1}
          AND company_id = $${Object.keys(updates).length + 2}
        RETURNING *`,
      [...Object.values(updates), id, companyId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    logger.error({ err: error }, 'Error updating transaction:');
    return res.status(500).json({ error: "Failed to update transaction" });
  }
}
