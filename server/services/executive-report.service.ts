/**
 * Executive Report Service
 *
 * Generates a monthly executive summary with key performance indicators:
 *   - Revenue vs prior month (growth %)
 *   - Appointment volume, new patients, no-show rate
 *   - Top 5 procedures by count
 *   - Top 5 professionals by revenue
 *   - Average ticket per appointment
 *
 * Month/year parameters follow 1-indexed calendar convention (January = 1).
 * When omitted the service defaults to the previous calendar month so that
 * a scheduled cron job can call it without arguments at month start.
 *
 * All monetary values are integer cents (matching financial_transactions.amount).
 *
 * The occupancyRate KPI is left as 0 because computing it requires the
 * working-hours schedule per professional, which varies per clinic — that
 * can be wired up once working_hours or schedule_blocks tables are stable.
 */

import { db } from '../db';

export interface ExecutiveReport {
  period: string; // e.g. "março de 2026"
  kpis: {
    totalRevenue: number;        // cents
    revenueGrowth: number;       // percentage, one decimal place
    totalAppointments: number;
    newPatients: number;
    noShowRate: number;          // percentage, one decimal place
    occupancyRate: number;       // always 0 until working-hours data is available
    avgTicket: number;           // cents
    topProcedures: Array<{ name: string; count: number; revenue: number }>;
    topProfessionals: Array<{ name: string; revenue: number; appointments: number }>;
    churnRiskCount: number;      // populated by caller if desired
    delinquencyTotal: number;    // cents — populated by caller if desired
  };
}

/**
 * Generates an executive report for a given month/year.
 *
 * @param companyId - Tenant identifier
 * @param month     - 1-indexed month (1 = January … 12 = December).
 *                    Defaults to the previous calendar month.
 * @param year      - Full 4-digit year. Defaults to current year
 *                    (adjusted when month wraps to December of prior year).
 */
export async function generateExecutiveReport(
  companyId: number,
  month?: number,
  year?: number,
): Promise<ExecutiveReport> {
  const now = new Date();

  // Default: previous calendar month (1-indexed)
  const reportMonth = month ?? (now.getMonth() === 0 ? 12 : now.getMonth());
  const reportYear  = year  ?? (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());

  // Current period boundaries (month is 1-indexed → JS Date month is 0-indexed)
  const startDate    = new Date(reportYear, reportMonth - 1, 1);
  const endDate      = new Date(reportYear, reportMonth, 0, 23, 59, 59, 999);

  // Previous period boundaries
  const prevMonth    = reportMonth === 1 ? 12 : reportMonth - 1;
  const prevYear     = reportMonth === 1 ? reportYear - 1 : reportYear;
  const prevStart    = new Date(prevYear, prevMonth - 1, 1);
  const prevEnd      = new Date(prevYear, prevMonth, 0, 23, 59, 59, 999);

  const period = startDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // --- Revenue ---
  const revenueResult = await db.$client.query(
    `
    SELECT
      COALESCE(SUM(CASE WHEN date >= $2 AND date <= $3 THEN amount ELSE 0 END), 0) AS current_revenue,
      COALESCE(SUM(CASE WHEN date >= $4 AND date <= $5 THEN amount ELSE 0 END), 0) AS prev_revenue
    FROM financial_transactions
    WHERE company_id = $1
      AND type       = 'income'
      AND status     = 'completed'
      AND deleted_at IS NULL
    `,
    [companyId, startDate, endDate, prevStart, prevEnd],
  );

  const currentRevenue = parseInt(revenueResult.rows[0].current_revenue, 10) || 0;
  const prevRevenue    = parseInt(revenueResult.rows[0].prev_revenue,    10) || 0;
  const revenueGrowth  = prevRevenue > 0
    ? Math.round(((currentRevenue - prevRevenue) / prevRevenue) * 1000) / 10
    : 0;

  // --- Appointments ---
  const apptResult = await db.$client.query(
    `
    SELECT
      COUNT(*)                                             AS total,
      COUNT(CASE WHEN status = 'no_show' THEN 1 END)      AS no_shows
    FROM appointments
    WHERE company_id = $1
      AND start_time >= $2
      AND start_time <= $3
      AND deleted_at  IS NULL
    `,
    [companyId, startDate, endDate],
  );

  const totalAppts = parseInt(apptResult.rows[0].total,    10) || 0;
  const noShows    = parseInt(apptResult.rows[0].no_shows, 10) || 0;
  const noShowRate = totalAppts > 0
    ? Math.round((noShows / totalAppts) * 1000) / 10
    : 0;

  // --- New Patients ---
  const newPatientsResult = await db.$client.query(
    `
    SELECT COUNT(*) AS count
    FROM patients
    WHERE company_id = $1
      AND created_at >= $2
      AND created_at <= $3
      AND deleted_at  IS NULL
    `,
    [companyId, startDate, endDate],
  );

  const newPatients = parseInt(newPatientsResult.rows[0].count, 10) || 0;

  // --- Top Procedures ---
  const topProcsResult = await db.$client.query(
    `
    SELECT
      pr.name,
      COUNT(*)          AS count,
      COALESCE(SUM(ap.price), 0) AS revenue
    FROM appointment_procedures ap
    JOIN procedures pr ON pr.id     = ap.procedure_id
    JOIN appointments a ON a.id     = ap.appointment_id
    WHERE a.company_id  = $1
      AND a.start_time >= $2
      AND a.start_time <= $3
      AND a.status      = 'completed'
    GROUP BY pr.name
    ORDER BY count DESC
    LIMIT 5
    `,
    [companyId, startDate, endDate],
  );

  // --- Top Professionals ---
  // Revenue is approximated from financial_transactions linked by appointment id
  // embedded in the description. This is a best-effort join; a dedicated FK would
  // make this more reliable if added in a future migration.
  const topProfsResult = await db.$client.query(
    `
    SELECT
      u.full_name,
      COUNT(a.id)                          AS appointments,
      COALESCE(SUM(ft.amount), 0)          AS revenue
    FROM appointments a
    JOIN users u ON u.id = a.professional_id
    LEFT JOIN financial_transactions ft
      ON  ft.description LIKE '%' || a.id::text || '%'
      AND ft.type        = 'income'
      AND ft.company_id  = $1
    WHERE a.company_id  = $1
      AND a.start_time >= $2
      AND a.start_time <= $3
      AND a.status      = 'completed'
    GROUP BY u.full_name
    ORDER BY revenue DESC
    LIMIT 5
    `,
    [companyId, startDate, endDate],
  );

  return {
    period,
    kpis: {
      totalRevenue: currentRevenue,
      revenueGrowth,
      totalAppointments: totalAppts,
      newPatients,
      noShowRate,
      occupancyRate: 0,
      avgTicket: totalAppts > 0 ? Math.round(currentRevenue / totalAppts) : 0,
      topProcedures: topProcsResult.rows.map((r: any) => ({
        name: r.name,
        count: parseInt(r.count, 10),
        revenue: parseInt(r.revenue, 10) || 0,
      })),
      topProfessionals: topProfsResult.rows.map((r: any) => ({
        name: r.full_name,
        revenue: parseInt(r.revenue, 10) || 0,
        appointments: parseInt(r.appointments, 10),
      })),
      churnRiskCount: 0,
      delinquencyTotal: 0,
    },
  };
}
