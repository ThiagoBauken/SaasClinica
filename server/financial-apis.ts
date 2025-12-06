import { Request, Response } from "express";
import { db } from "./db";
import { payments, appointments, appointmentProcedures, procedures } from "@shared/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, format } from "date-fns";

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
          gte(payments.paymentDate, startDate),
          lte(payments.paymentDate, endDate)
        )
      )
      .orderBy(desc(payments.paymentDate));

    res.json(paymentsData);
  } catch (error) {
    console.error("Error fetching transactions:", error);
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
    console.error("Error fetching revenue by month:", error);
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
          eq(payments.status, "paid"),
          gte(payments.paymentDate, startDate),
          lte(payments.paymentDate, endDate)
        )
      )
      .groupBy(procedures.name)
      .limit(4);

    res.json(revenueByType);
  } catch (error) {
    console.error("Error fetching revenue by type:", error);
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
    console.error("Error creating transaction:", error);
    res.status(500).json({ error: "Failed to create transaction" });
  }
}
