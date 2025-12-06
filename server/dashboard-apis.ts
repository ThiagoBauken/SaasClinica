import { Request, Response } from "express";
import { db } from "./db";
import { appointments, patients, payments, procedures, appointmentProcedures } from "@shared/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Dashboard APIs - Retorna estatísticas e métricas reais do banco de dados
 */

/**
 * GET /api/dashboard/stats
 * Retorna estatísticas gerais do mês atual
 */
export async function getDashboardStats(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const companyId = user.companyId;

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    // Total de agendamentos do mês atual
    const currentMonthAppointments = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(appointments)
      .where(
        and(
          eq(appointments.companyId, companyId),
          gte(appointments.startTime, monthStart),
          lte(appointments.startTime, monthEnd)
        )
      );

    // Total de agendamentos do mês anterior
    const lastMonthAppointments = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(appointments)
      .where(
        and(
          eq(appointments.companyId, companyId),
          gte(appointments.startTime, lastMonthStart),
          lte(appointments.startTime, lastMonthEnd)
        )
      );

    // Calcular variação percentual de agendamentos
    const currentAppCount = currentMonthAppointments[0]?.count || 0;
    const lastAppCount = lastMonthAppointments[0]?.count || 0;
    const appointmentGrowth = lastAppCount > 0
      ? ((currentAppCount - lastAppCount) / lastAppCount) * 100
      : 0;

    // Total de receita do mês atual (pagamentos confirmados)
    const currentMonthRevenue = await db
      .select({ total: sql<number>`COALESCE(SUM(amount), 0)::float` })
      .from(payments)
      .where(
        and(
          eq(payments.companyId, companyId),
          eq(payments.status, 'confirmed'),
          gte(payments.paymentDate, monthStart),
          lte(payments.paymentDate, monthEnd)
        )
      );

    // Total de receita do mês anterior
    const lastMonthRevenue = await db
      .select({ total: sql<number>`COALESCE(SUM(amount), 0)::float` })
      .from(payments)
      .where(
        and(
          eq(payments.companyId, companyId),
          eq(payments.status, 'confirmed'),
          gte(payments.paymentDate, lastMonthStart),
          lte(payments.paymentDate, lastMonthEnd)
        )
      );

    // Calcular variação percentual de receita
    const currentRevenue = currentMonthRevenue[0]?.total || 0;
    const lastRevenue = lastMonthRevenue[0]?.total || 0;
    const revenueGrowth = lastRevenue > 0
      ? ((currentRevenue - lastRevenue) / lastRevenue) * 100
      : 0;

    // Novos pacientes do mês
    const newPatients = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(patients)
      .where(
        and(
          eq(patients.companyId, companyId),
          gte(patients.createdAt, monthStart),
          lte(patients.createdAt, monthEnd)
        )
      );

    // Novos pacientes do mês anterior
    const lastMonthNewPatients = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(patients)
      .where(
        and(
          eq(patients.companyId, companyId),
          gte(patients.createdAt, lastMonthStart),
          lte(patients.createdAt, lastMonthEnd)
        )
      );

    // Calcular variação percentual de novos pacientes
    const currentNewPatients = newPatients[0]?.count || 0;
    const lastNewPatients = lastMonthNewPatients[0]?.count || 0;
    const patientsGrowth = lastNewPatients > 0
      ? ((currentNewPatients - lastNewPatients) / lastNewPatients) * 100
      : 0;

    res.json({
      appointments: {
        total: currentAppCount,
        growth: Math.round(appointmentGrowth * 10) / 10 // Arredondar para 1 casa decimal
      },
      revenue: {
        total: currentRevenue,
        growth: Math.round(revenueGrowth * 10) / 10
      },
      newPatients: {
        total: currentNewPatients,
        growth: Math.round(patientsGrowth * 10) / 10
      }
    });
  } catch (error) {
    console.error("Erro ao buscar estatísticas do dashboard:", error);
    res.status(500).json({ error: "Erro ao buscar estatísticas" });
  }
}

/**
 * GET /api/dashboard/appointments-week
 * Retorna agendamentos agrupados por dia da semana atual
 */
export async function getWeeklyAppointments(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const companyId = user.companyId;

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Segunda-feira
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 }); // Domingo

    const weeklyData = await db.execute(sql`
      SELECT
        EXTRACT(DOW FROM start_time) as day_of_week,
        COUNT(*)::int as count
      FROM ${appointments}
      WHERE company_id = ${companyId}
        AND start_time >= ${weekStart}
        AND start_time <= ${weekEnd}
      GROUP BY EXTRACT(DOW FROM start_time)
      ORDER BY day_of_week
    `);

    // Mapear resultados para dias da semana em português
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const dayMap: { [key: number]: number } = {};

    weeklyData.rows.forEach((row: any) => {
      dayMap[row.day_of_week] = row.count;
    });

    // Criar array com todos os dias da semana (começando na segunda)
    const result = [1, 2, 3, 4, 5, 6, 0].map(dayNum => ({
      name: dayNames[dayNum],
      agendamentos: dayMap[dayNum] || 0
    }));

    res.json(result);
  } catch (error) {
    console.error("Erro ao buscar agendamentos da semana:", error);
    res.status(500).json({ error: "Erro ao buscar agendamentos da semana" });
  }
}

/**
 * GET /api/dashboard/revenue-monthly
 * Retorna receita mensal dos últimos 7 meses
 */
export async function getMonthlyRevenue(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const companyId = user.companyId;

    const now = new Date();
    const results = [];

    // Buscar receita dos últimos 7 meses
    for (let i = 6; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const monthRevenue = await db
        .select({ total: sql<number>`COALESCE(SUM(amount), 0)::float` })
        .from(payments)
        .where(
          and(
            eq(payments.companyId, companyId),
            eq(payments.status, 'confirmed'),
            gte(payments.paymentDate, monthStart),
            lte(payments.paymentDate, monthEnd)
          )
        );

      results.push({
        name: format(monthDate, 'MMM', { locale: ptBR }),
        valor: monthRevenue[0]?.total || 0
      });
    }

    res.json(results);
  } catch (error) {
    console.error("Erro ao buscar receita mensal:", error);
    res.status(500).json({ error: "Erro ao buscar receita mensal" });
  }
}

/**
 * GET /api/dashboard/procedures-distribution
 * Retorna distribuição de procedimentos por tipo
 */
export async function getProceduresDistribution(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const companyId = user.companyId;

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Buscar procedimentos mais comuns do mês
    const proceduresData = await db.execute(sql`
      SELECT
        p.name,
        COUNT(ap.id)::int as count
      FROM ${procedures} p
      INNER JOIN ${appointmentProcedures} ap ON p.id = ap.procedure_id
      INNER JOIN ${appointments} a ON ap.appointment_id = a.id
      WHERE p.company_id = ${companyId}
        AND a.start_time >= ${monthStart}
        AND a.start_time <= ${monthEnd}
      GROUP BY p.id, p.name
      ORDER BY count DESC
      LIMIT 5
    `);

    const result = proceduresData.rows.map((row: any) => ({
      name: row.name,
      value: row.count
    }));

    // Se não houver dados, retornar array vazio ao invés de dados mockados
    res.json(result.length > 0 ? result : []);
  } catch (error) {
    console.error("Erro ao buscar distribuição de procedimentos:", error);
    res.status(500).json({ error: "Erro ao buscar distribuição de procedimentos" });
  }
}

/**
 * GET /api/recent-activities
 * Retorna atividades recentes do sistema
 */
export async function getRecentActivities(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const companyId = user.companyId;

    const limit = parseInt(req.query.limit as string) || 10;

    // Buscar últimos agendamentos criados
    const recentAppointments = await db
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        startTime: appointments.startTime,
        status: appointments.status,
        createdAt: appointments.createdAt,
      })
      .from(appointments)
      .where(eq(appointments.companyId, companyId))
      .orderBy(desc(appointments.createdAt))
      .limit(limit);

    // Buscar informações dos pacientes
    type Appointment = typeof appointments.$inferSelect;
    const activities = await Promise.all(
      recentAppointments.map(async (apt: Appointment) => {
        const [patient] = await db
          .select({ name: patients.fullName })
          .from(patients)
          .where(eq(patients.id, apt.patientId ? apt.patientId : 0))
          .limit(1);

        return {
          type: 'appointment',
          title: `Novo agendamento: ${patient?.name || 'Paciente'}`,
          description: `Agendamento ${apt.status} para ${format(new Date(apt.startTime), "dd/MM/yyyy 'às' HH:mm")}`,
          created_at: apt.createdAt
        };
      })
    );

    res.json(activities);
  } catch (error) {
    console.error("Erro ao buscar atividades recentes:", error);
    res.status(500).json({ error: "Erro ao buscar atividades recentes" });
  }
}
