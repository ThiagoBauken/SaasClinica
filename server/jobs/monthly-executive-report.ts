import { db } from '../db';
import { logger } from '../logger';

const log = logger.child({ module: 'monthly-executive-report' });

/**
 * Generates a monthly executive report for each clinic.
 * Intended to be called by a cron job on the 1st of each month.
 */
export async function generateMonthlyExecutiveReports() {
  log.info('Starting monthly executive report generation');

  try {
    // Get all active companies
    const companies = await db.$client.query(
      `SELECT id, name, email FROM companies WHERE active = true`
    );

    for (const company of companies.rows) {
      try {
        await generateReportForCompany(company.id, company.name, company.email);
      } catch (err) {
        log.error({ err, companyId: company.id }, 'Failed to generate report for company');
      }
    }

    log.info({ count: companies.rows.length }, 'Monthly executive reports completed');
  } catch (err) {
    log.error({ err }, 'Fatal error in monthly executive report generation');
  }
}

async function generateReportForCompany(
  companyId: number,
  companyName: string,
  companyEmail: string
) {
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const year = lastMonth.getFullYear();
  const month = lastMonth.getMonth() + 1;
  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // last day of month

  // Gather KPIs in parallel
  const [
    appointmentsResult,
    revenueResult,
    newPatientsResult,
    noShowResult,
    topProceduresResult,
    topProfessionalsResult,
  ] = await Promise.all([
    // Total appointments
    db.$client.query(
      `SELECT COUNT(*) as total,
              COUNT(*) FILTER (WHERE status = 'completed') as completed,
              COUNT(*) FILTER (WHERE status IN ('cancelled', 'no_show')) as cancelled
       FROM appointments
       WHERE company_id = $1 AND start_time >= $2 AND start_time <= $3`,
      [companyId, startDate, endDate]
    ),
    // Revenue
    db.$client.query(
      `SELECT COALESCE(SUM(amount), 0) as total_revenue,
              COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as collected
       FROM financial_transactions
       WHERE company_id = $1 AND type = 'income' AND date >= $2 AND date <= $3`,
      [companyId, startDate, endDate]
    ),
    // New patients
    db.$client.query(
      `SELECT COUNT(*) as total FROM patients
       WHERE company_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [companyId, startDate, endDate]
    ),
    // No-show rate
    db.$client.query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'no_show') as no_shows,
        COUNT(*) as total
       FROM appointments
       WHERE company_id = $1 AND start_time >= $2 AND start_time <= $3
         AND status IN ('completed', 'no_show', 'cancelled')`,
      [companyId, startDate, endDate]
    ),
    // Top 5 procedures
    db.$client.query(
      `SELECT p.name, COUNT(*) as count
       FROM appointments a
       JOIN procedures p ON a.procedure_id = p.id
       WHERE a.company_id = $1 AND a.start_time >= $2 AND a.start_time <= $3
         AND a.status = 'completed'
       GROUP BY p.name ORDER BY count DESC LIMIT 5`,
      [companyId, startDate, endDate]
    ),
    // Top professionals by revenue
    db.$client.query(
      `SELECT u.full_name, COUNT(*) as appointments,
              COALESCE(SUM(ft.amount), 0) as revenue
       FROM appointments a
       JOIN users u ON a.professional_id = u.id
       LEFT JOIN financial_transactions ft ON ft.appointment_id = a.id AND ft.type = 'income'
       WHERE a.company_id = $1 AND a.start_time >= $2 AND a.start_time <= $3
         AND a.status = 'completed'
       GROUP BY u.full_name ORDER BY revenue DESC LIMIT 5`,
      [companyId, startDate, endDate]
    ),
  ]);

  const kpis = {
    totalAppointments: parseInt(appointmentsResult.rows[0]?.total || '0'),
    completedAppointments: parseInt(appointmentsResult.rows[0]?.completed || '0'),
    cancelledAppointments: parseInt(appointmentsResult.rows[0]?.cancelled || '0'),
    totalRevenue: parseInt(revenueResult.rows[0]?.total_revenue || '0'),
    collectedRevenue: parseInt(revenueResult.rows[0]?.collected || '0'),
    newPatients: parseInt(newPatientsResult.rows[0]?.total || '0'),
    noShowRate:
      noShowResult.rows[0]?.total > 0
        ? (
            (parseInt(noShowResult.rows[0].no_shows) /
              parseInt(noShowResult.rows[0].total)) *
            100
          ).toFixed(1)
        : '0',
    topProcedures: topProceduresResult.rows,
    topProfessionals: topProfessionalsResult.rows,
  };

  // Store the report
  const monthLabel = `${year}-${month.toString().padStart(2, '0')}`;

  await db.$client.query(
    `INSERT INTO executive_reports (company_id, month, kpis, generated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (company_id, month) DO UPDATE SET kpis = $3, generated_at = NOW()`,
    [companyId, monthLabel, JSON.stringify(kpis)]
  );

  log.info(
    {
      companyId,
      month: monthLabel,
      kpis: { revenue: kpis.totalRevenue, appointments: kpis.totalAppointments },
    },
    'Executive report generated'
  );

  return kpis;
}

export { generateReportForCompany };
