import { db } from '../db';
import { logger } from '../logger';
import { sendEmail } from '../services/email-service';

const log = logger.child({ module: 'monthly-executive-report' });

/**
 * Renders an HTML email body for the executive report.
 */
function renderReportEmailHtml(
  companyName: string,
  monthLabel: string,
  kpis: Record<string, any>
): string {
  const brl = (cents: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
      (cents || 0) / 100
    );

  const procedureRows = (kpis.topProcedures || [])
    .map(
      (p: any) =>
        `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${p.name}</td><td style="padding:6px 10px;text-align:right;border-bottom:1px solid #e5e7eb;">${p.count}</td></tr>`
    )
    .join('');

  const profRows = (kpis.topProfessionals || [])
    .map(
      (p: any) =>
        `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${p.full_name}</td><td style="padding:6px 10px;text-align:right;border-bottom:1px solid #e5e7eb;">${brl(parseInt(p.revenue || '0'))}</td></tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111827;">
  <div style="border-bottom:2px solid #2563eb;padding-bottom:16px;margin-bottom:24px;">
    <h1 style="margin:0;font-size:22px;">📊 Relatório Executivo — ${monthLabel}</h1>
    <p style="color:#6b7280;margin:4px 0 0;">${companyName}</p>
  </div>

  <h2 style="font-size:16px;color:#374151;margin-bottom:12px;">Indicadores do mês</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <tr><td style="padding:8px 10px;background:#f9fafb;">Agendamentos totais</td><td style="padding:8px 10px;background:#f9fafb;text-align:right;font-weight:600;">${kpis.totalAppointments}</td></tr>
    <tr><td style="padding:8px 10px;">Consultas realizadas</td><td style="padding:8px 10px;text-align:right;font-weight:600;">${kpis.completedAppointments}</td></tr>
    <tr><td style="padding:8px 10px;background:#f9fafb;">Cancelamentos/faltas</td><td style="padding:8px 10px;background:#f9fafb;text-align:right;font-weight:600;">${kpis.cancelledAppointments}</td></tr>
    <tr><td style="padding:8px 10px;">Novos pacientes</td><td style="padding:8px 10px;text-align:right;font-weight:600;">${kpis.newPatients}</td></tr>
    <tr><td style="padding:8px 10px;background:#f9fafb;">Taxa de no-show</td><td style="padding:8px 10px;background:#f9fafb;text-align:right;font-weight:600;">${kpis.noShowRate}%</td></tr>
    <tr><td style="padding:8px 10px;">Receita total</td><td style="padding:8px 10px;text-align:right;font-weight:600;color:#059669;">${brl(kpis.totalRevenue)}</td></tr>
    <tr><td style="padding:8px 10px;background:#f9fafb;">Receita recebida</td><td style="padding:8px 10px;background:#f9fafb;text-align:right;font-weight:600;color:#059669;">${brl(kpis.collectedRevenue)}</td></tr>
  </table>

  ${
    procedureRows
      ? `<h2 style="font-size:16px;color:#374151;margin-bottom:12px;">Top procedimentos</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">${procedureRows}</table>`
      : ''
  }

  ${
    profRows
      ? `<h2 style="font-size:16px;color:#374151;margin-bottom:12px;">Top profissionais (por receita)</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">${profRows}</table>`
      : ''
  }

  <p style="color:#9ca3af;font-size:11px;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:24px;">
    Relatório gerado automaticamente pelo sistema em ${new Date().toLocaleDateString('pt-BR')}.
  </p>
</body>
</html>`;
}

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

  // Send by email (non-blocking — if it fails, the report is still saved in DB)
  if (companyEmail) {
    try {
      const html = renderReportEmailHtml(companyName, monthLabel, kpis);
      const result = await sendEmail({
        to: companyEmail,
        subject: `Relatório Executivo — ${monthLabel}`,
        html,
      });

      if (result.success) {
        await db.$client.query(
          `UPDATE executive_reports SET emailed_at = NOW()
           WHERE company_id = $1 AND month = $2`,
          [companyId, monthLabel]
        );
        log.info({ companyId, month: monthLabel, to: companyEmail }, 'Executive report emailed');
      } else {
        log.warn(
          { companyId, month: monthLabel, error: result.error },
          'Failed to email executive report'
        );
      }
    } catch (err) {
      log.error({ err, companyId, month: monthLabel }, 'Error emailing executive report');
    }
  } else {
    log.warn({ companyId, month: monthLabel }, 'Company has no email; skipping report delivery');
  }

  return kpis;
}

export { generateReportForCompany };
