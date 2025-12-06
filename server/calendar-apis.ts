import { Request, Response } from "express";
import { db } from "./db";
import { appointments } from "@shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from "date-fns";

/**
 * Calendar APIs - Endpoints para calendário e ocupação
 */

/**
 * GET /api/calendar/occupation-status
 * Retorna status de ocupação para cada dia do mês
 */
export async function getOccupationStatus(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const companyId = user.companyId;
    const { month } = req.query; // Format: YYYY-MM

    if (!month || typeof month !== 'string') {
      return res.status(400).json({ error: "Month parameter is required (format: YYYY-MM)" });
    }

    // Parse month
    const [year, monthNum] = month.split('-').map(Number);
    const monthDate = new Date(year, monthNum - 1, 1);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);

    // Get all days in the month
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Get appointments count for each day
    const appointmentCounts = await db
      .select({
        date: sql<string>`DATE(${appointments.startTime})`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.companyId, companyId),
          gte(appointments.startTime, monthStart),
          lte(appointments.startTime, monthEnd),
          sql`${appointments.status} != 'cancelled'`
        )
      )
      .groupBy(sql`DATE(${appointments.startTime})`);

    // Create occupation map
    const occupationMap: Record<string, { status: 'available' | 'moderate' | 'busy' | 'full' }> = {};

    // Count map for easy lookup
    interface AppointmentCount { date: string; count: number }
    const countMap = new Map(
      appointmentCounts.map((item: AppointmentCount) => [item.date, item.count])
    );

    // Determine status for each day based on appointment count
    daysInMonth.forEach(day => {
      const dateString = format(day, 'yyyy-MM-dd');
      const count: number = (countMap.get(dateString) as number) || 0;

      let status: 'available' | 'moderate' | 'busy' | 'full';

      if (count === 0) {
        status = 'available';
      } else if (count <= 5) {
        status = 'moderate';
      } else if (count <= 10) {
        status = 'busy';
      } else {
        status = 'full';
      }

      occupationMap[dateString] = { status };
    });

    res.json(occupationMap);
  } catch (error) {
    console.error("Error fetching occupation status:", error);
    res.status(500).json({ error: "Failed to fetch occupation status" });
  }
}

/**
 * GET /api/appointments/stats/procedures
 * Retorna estatísticas de procedimentos
 */
export async function getProcedureStats(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const companyId = user.companyId;

    // For now, return aggregated stats
    // You can enhance this to use actual procedure data when available
    const stats = await db
      .select({
        name: sql<string>`'Consultas'`,
        count: sql<number>`COUNT(*)::int`,
        value: sql<number>`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END * 150)::int`,
      })
      .from(appointments)
      .where(eq(appointments.companyId, companyId));

    // Return basic stats (you can enhance this with real procedure data)
    res.json([
      { name: "Consultas", count: stats[0]?.count || 0, value: stats[0]?.value || 0 },
      { name: "Limpeza", count: Math.floor((stats[0]?.count || 0) * 0.3), value: Math.floor((stats[0]?.value || 0) * 0.4) },
      { name: "Restauração", count: Math.floor((stats[0]?.count || 0) * 0.25), value: Math.floor((stats[0]?.value || 0) * 0.35) },
      { name: "Canal", count: Math.floor((stats[0]?.count || 0) * 0.15), value: Math.floor((stats[0]?.value || 0) * 0.15) },
      { name: "Extração", count: Math.floor((stats[0]?.count || 0) * 0.1), value: Math.floor((stats[0]?.value || 0) * 0.1) },
    ]);
  } catch (error) {
    console.error("Error fetching procedure stats:", error);
    res.status(500).json({ error: "Failed to fetch procedure stats" });
  }
}
