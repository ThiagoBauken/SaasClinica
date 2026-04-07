/**
 * Reports Routes - 30 relatorios gerenciais
 * Endpoints para relatorios financeiros, clinicos e operacionais
 */

import { Router } from 'express';
import { authCheck, asyncHandler } from '../middleware/auth';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import {
  reportExportService,
  type ReportColumn,
  type ReportData,
} from '../services/report-export.service';
import {
  generateReportHtml,
  type PdfReportColumn,
  type PdfSummaryItem,
} from '../services/pdf-generator.service';
import { reportCacheMiddleware } from '../middleware/report-cache';

const router = Router();

// ---------------------------------------------------------------------------
// Apply a 5-minute cache to all report GET requests.
// Cache is scoped per (companyId + URL) so tenants never share data.
// Cache is skipped for non-GET methods and non-2xx responses automatically.
//
// INDEX RECOMMENDATIONS (for DBA review):
//   payments(company_id, status, created_at)   — revenue-by-period, revenue-by-professional
//   appointments(company_id, status, start_time, deleted_at) — appointments-by-professional, recall-effectiveness
//   patients(company_id, active, deleted_at, created_at)     — new-patients, patients-status
//   appointment_procedures(appointment_id)     — revenue-by-procedure
// ---------------------------------------------------------------------------
router.use(reportCacheMiddleware(300));

// Helper: parse and validate date range from query.
// Returns an object on success or throws a 400-compatible error when the
// range exceeds the hard cap of 366 days.
const MAX_RANGE_DAYS = 366;

function getDateRange(
  query: any,
  res?: any,
): { start: string; end: string } | null {
  const end = query.endDate || new Date().toISOString().split('T')[0];
  const start = query.startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  const diffDays = (endMs - startMs) / 86400000;

  if (diffDays > MAX_RANGE_DAYS) {
    if (res) {
      res.status(400).json({
        error: `O intervalo de datas nao pode exceder ${MAX_RANGE_DAYS} dias. Intervalo solicitado: ${Math.ceil(diffDays)} dias.`,
      });
    }
    return null;
  }

  return { start, end };
}

function getCompanyId(req: any): number {
  const user = req.user!;
  return user.companyId;
}

// ============================================================
// 1. Receita por Periodo
// ============================================================
router.get('/revenue-by-period', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const dateRange = getDateRange(req.query, res);
  if (!dateRange) return;
  const { start, end } = dateRange;
  const groupBy = (req.query.groupBy as string) || 'day'; // day, week, month

  const dateFormat = groupBy === 'month' ? 'YYYY-MM' : groupBy === 'week' ? 'IYYY-IW' : 'YYYY-MM-DD';

  const result = await db.execute(sql`
    SELECT to_char(created_at, ${dateFormat}) as period,
           SUM(amount) as total, COUNT(*) as count
    FROM payments
    WHERE company_id = ${companyId} AND status = 'completed'
      AND created_at >= ${start}::date AND created_at <= ${end}::date + interval '1 day'
    GROUP BY period ORDER BY period
  `);
  res.json({ data: result.rows });
}));

// ============================================================
// 2. Receita por Profissional
// ============================================================
router.get('/revenue-by-professional', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const dateRange = getDateRange(req.query, res);
  if (!dateRange) return;
  const { start, end } = dateRange;

  const result = await db.execute(sql`
    SELECT u.full_name as professional, u.id as professional_id,
           SUM(p.amount) as total, COUNT(*) as count
    FROM payments p
    JOIN appointments a ON p.appointment_id = a.id
    JOIN users u ON a.professional_id = u.id
    WHERE p.company_id = ${companyId} AND p.status = 'completed'
      AND a.deleted_at IS NULL
      AND u.deleted_at IS NULL
      AND p.created_at >= ${start}::date AND p.created_at <= ${end}::date + interval '1 day'
    GROUP BY u.id, u.full_name ORDER BY total DESC
  `);
  res.json({ data: result.rows });
}));

// ============================================================
// 3. Receita por Procedimento
// ============================================================
router.get('/revenue-by-procedure', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const dateRange = getDateRange(req.query, res);
  if (!dateRange) return;
  const { start, end } = dateRange;

  const result = await db.execute(sql`
    SELECT pr.name as procedure_name, pr.category,
           SUM(ap.price) as total, COUNT(*) as count
    FROM appointment_procedures ap
    JOIN procedures pr ON ap.procedure_id = pr.id
    JOIN appointments a ON ap.appointment_id = a.id
    WHERE a.company_id = ${companyId} AND a.status = 'completed'
      AND a.deleted_at IS NULL
      AND a.start_time >= ${start}::date AND a.start_time <= ${end}::date + interval '1 day'
    GROUP BY pr.id, pr.name, pr.category ORDER BY total DESC
  `);
  res.json({ data: result.rows });
}));

// ============================================================
// 4. Receita Convenio vs Particular
// ============================================================
router.get('/revenue-insurance-vs-private', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const dateRange = getDateRange(req.query, res);
  if (!dateRange) return;
  const { start, end } = dateRange;

  const result = await db.execute(sql`
    SELECT
      CASE WHEN pt.health_insurance IS NOT NULL AND pt.health_insurance != '' THEN 'Convenio' ELSE 'Particular' END as type,
      SUM(p.amount) as total, COUNT(*) as count
    FROM payments p
    LEFT JOIN patients pt ON p.patient_id = pt.id AND pt.deleted_at IS NULL
    WHERE p.company_id = ${companyId} AND p.status = 'completed'
      AND p.created_at >= ${start}::date AND p.created_at <= ${end}::date + interval '1 day'
    GROUP BY type
  `);
  res.json({ data: result.rows });
}));

// ============================================================
// 5. Pacientes Novos por Periodo
// ============================================================
router.get('/new-patients', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const dateRange = getDateRange(req.query, res);
  if (!dateRange) return;
  const { start, end } = dateRange;

  const result = await db.execute(sql`
    SELECT to_char(created_at, 'YYYY-MM-DD') as date, COUNT(*) as count
    FROM patients
    WHERE company_id = ${companyId} AND active = true
      AND deleted_at IS NULL
      AND created_at >= ${start}::date AND created_at <= ${end}::date + interval '1 day'
    GROUP BY date ORDER BY date
  `);
  res.json({ data: result.rows });
}));

// ============================================================
// 6. Pacientes Ativos vs Inativos
// ============================================================
router.get('/patients-status', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);

  const result = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE active = true) as active,
      COUNT(*) FILTER (WHERE active = false) as inactive,
      COUNT(*) FILTER (WHERE last_visit >= NOW() - interval '6 months') as recent,
      COUNT(*) FILTER (WHERE last_visit < NOW() - interval '6 months' OR last_visit IS NULL) as dormant,
      COUNT(*) as total
    FROM patients WHERE company_id = ${companyId} AND deleted_at IS NULL
  `);
  res.json({ data: result.rows[0] });
}));

// ============================================================
// 7. Taxa de Retorno (Recall Effectiveness)
// ============================================================
router.get('/recall-effectiveness', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);

  const result = await db.execute(sql`
    SELECT
      COUNT(DISTINCT patient_id) FILTER (WHERE total_appointments >= 2) as returning_patients,
      COUNT(DISTINCT patient_id) as total_patients,
      ROUND(
        COUNT(DISTINCT patient_id) FILTER (WHERE total_appointments >= 2)::numeric /
        NULLIF(COUNT(DISTINCT patient_id), 0) * 100, 1
      ) as return_rate
    FROM (
      SELECT patient_id, COUNT(*) as total_appointments
      FROM appointments
      WHERE company_id = ${companyId} AND status = 'completed'
        AND deleted_at IS NULL
      GROUP BY patient_id
    ) sub
  `);
  res.json({ data: result.rows[0] });
}));

// ============================================================
// 8. Taxa de Aceitacao de Orcamentos (Case Acceptance)
// ============================================================
router.get('/case-acceptance', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const dateRange = getDateRange(req.query, res);
  if (!dateRange) return;
  const { start, end } = dateRange;

  const result = await db.execute(sql`
    SELECT
      status,
      COUNT(*) as count,
      SUM(COALESCE(estimated_cost, 0)) as total_value
    FROM detailed_treatment_plans
    WHERE company_id = ${companyId}
      AND deleted_at IS NULL
      AND created_at >= ${start}::date AND created_at <= ${end}::date + interval '1 day'
    GROUP BY status
  `);

  const rows = result.rows as any[];
  const proposed = rows.reduce((sum: number, r: any) => sum + parseInt(r.count || '0'), 0);
  const accepted = rows.filter((r: any) => ['approved', 'in_progress', 'completed'].includes(r.status))
    .reduce((sum: number, r: any) => sum + parseInt(r.count || '0'), 0);

  res.json({
    data: {
      byStatus: rows,
      total: proposed,
      accepted,
      rate: proposed > 0 ? Math.round((accepted / proposed) * 100) : 0,
    },
  });
}));

// ============================================================
// 9. Agendamentos por Profissional
// ============================================================
router.get('/appointments-by-professional', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const dateRange = getDateRange(req.query, res);
  if (!dateRange) return;
  const { start, end } = dateRange;

  const result = await db.execute(sql`
    SELECT u.full_name as professional,
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE a.status = 'completed') as completed,
           COUNT(*) FILTER (WHERE a.status = 'cancelled') as cancelled,
           COUNT(*) FILTER (WHERE a.status = 'no_show') as no_show
    FROM appointments a
    JOIN users u ON a.professional_id = u.id
    WHERE a.company_id = ${companyId}
      AND a.deleted_at IS NULL
      AND u.deleted_at IS NULL
      AND a.start_time >= ${start}::date AND a.start_time <= ${end}::date + interval '1 day'
    GROUP BY u.id, u.full_name ORDER BY total DESC
  `);
  res.json({ data: result.rows });
}));

// ============================================================
// 10. Taxa de Faltas (No-Show Rate)
// ============================================================
router.get('/no-show-rate', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const dateRange = getDateRange(req.query, res);
  if (!dateRange) return;
  const { start, end } = dateRange;

  const result = await db.execute(sql`
    SELECT
      to_char(start_time, 'YYYY-MM') as month,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'no_show') as no_shows,
      ROUND(COUNT(*) FILTER (WHERE status = 'no_show')::numeric / NULLIF(COUNT(*), 0) * 100, 1) as rate
    FROM appointments
    WHERE company_id = ${companyId}
      AND deleted_at IS NULL
      AND start_time >= ${start}::date AND start_time <= ${end}::date + interval '1 day'
    GROUP BY month ORDER BY month
  `);
  res.json({ data: result.rows });
}));

// ============================================================
// 11. Tempo Medio de Atendimento
// ============================================================
router.get('/avg-appointment-duration', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const dateRange = getDateRange(req.query, res);
  if (!dateRange) return;
  const { start, end } = dateRange;

  const result = await db.execute(sql`
    SELECT
      u.full_name as professional,
      ROUND(AVG(EXTRACT(EPOCH FROM (end_time - start_time)) / 60)) as avg_minutes,
      COUNT(*) as total_appointments
    FROM appointments a
    JOIN users u ON a.professional_id = u.id
    WHERE a.company_id = ${companyId} AND a.status = 'completed'
      AND a.deleted_at IS NULL
      AND u.deleted_at IS NULL
      AND a.start_time >= ${start}::date AND a.start_time <= ${end}::date + interval '1 day'
    GROUP BY u.id, u.full_name ORDER BY avg_minutes DESC
  `);
  res.json({ data: result.rows });
}));

// ============================================================
// 12. Procedimentos Mais Realizados
// ============================================================
router.get('/top-procedures', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const dateRange = getDateRange(req.query, res);
  if (!dateRange) return;
  const { start, end } = dateRange;

  const result = await db.execute(sql`
    SELECT pr.name, pr.category, COUNT(*) as count,
           SUM(ap.price) as total_revenue
    FROM appointment_procedures ap
    JOIN procedures pr ON ap.procedure_id = pr.id
    JOIN appointments a ON ap.appointment_id = a.id
    WHERE a.company_id = ${companyId} AND a.status = 'completed'
      AND a.deleted_at IS NULL
      AND a.start_time >= ${start}::date AND a.start_time <= ${end}::date + interval '1 day'
    GROUP BY pr.id, pr.name, pr.category ORDER BY count DESC LIMIT 20
  `);
  res.json({ data: result.rows });
}));

// ============================================================
// 13. Comissoes por Profissional
// ============================================================
router.get('/commissions', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const dateRange = getDateRange(req.query, res);
  if (!dateRange) return;
  const { start, end } = dateRange;

  const result = await db.execute(sql`
    SELECT u.full_name as professional,
           SUM(cr.amount) as total_commission,
           COUNT(*) as procedures_count,
           AVG(cr.percentage) as avg_percentage
    FROM commission_records cr
    JOIN users u ON cr.professional_id = u.id
    WHERE cr.company_id = ${companyId}
      AND cr.created_at >= ${start}::date AND cr.created_at <= ${end}::date + interval '1 day'
    GROUP BY u.id, u.full_name ORDER BY total_commission DESC
  `);
  res.json({ data: result.rows });
}));

// ============================================================
// 14. Inadimplencia (Pagamentos Pendentes)
// ============================================================
router.get('/overdue-payments', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);

  const result = await db.execute(sql`
    SELECT pt.full_name as patient, pt.id as patient_id, pt.cellphone,
           tp.name as treatment, tp.total_amount,
           tp.paid_amount, (tp.total_amount - tp.paid_amount) as balance,
           tp.created_at
    FROM treatment_plans tp
    JOIN patients pt ON tp.patient_id = pt.id
    WHERE tp.company_id = ${companyId}
      AND tp.deleted_at IS NULL
      AND pt.deleted_at IS NULL
      AND tp.status IN ('approved', 'in_progress')
      AND tp.total_amount > tp.paid_amount
    ORDER BY balance DESC LIMIT 50
  `);
  res.json({ data: result.rows });
}));

// ============================================================
// 15. Fluxo de Caixa Projetado
// ============================================================
router.get('/cashflow-projection', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);

  const result = await db.execute(sql`
    SELECT
      to_char(created_at, 'YYYY-MM') as month,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses,
      SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as net
    FROM financial_transactions
    WHERE company_id = ${companyId} AND status = 'completed'
      AND deleted_at IS NULL
      AND created_at >= NOW() - interval '12 months'
    GROUP BY month ORDER BY month
  `);
  res.json({ data: result.rows });
}));

// ============================================================
// 16. Estoque Abaixo do Minimo
// ============================================================
router.get('/low-stock', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);

  const result = await db.execute(sql`
    SELECT i.name, i.quantity, i.min_stock, i.unit,
           c.name as category,
           (i.min_stock - i.quantity) as deficit
    FROM inventory_items i
    LEFT JOIN inventory_categories c ON i.category_id = c.id
    WHERE i.company_id = ${companyId} AND i.active = true
      AND i.deleted_at IS NULL
      AND i.quantity <= i.min_stock
    ORDER BY deficit DESC
  `);
  res.json({ data: result.rows });
}));

// ============================================================
// 17. Consumo de Materiais por Periodo
// ============================================================
router.get('/material-consumption', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const dateRange = getDateRange(req.query, res);
  if (!dateRange) return;
  const { start, end } = dateRange;

  const result = await db.execute(sql`
    SELECT i.name as item, SUM(t.quantity) as consumed, i.unit,
           SUM(t.quantity * i.unit_price) as total_cost
    FROM inventory_transactions t
    JOIN inventory_items i ON t.item_id = i.id
    WHERE t.company_id = ${companyId} AND t.type = 'out'
      AND i.deleted_at IS NULL
      AND t.created_at >= ${start}::date AND t.created_at <= ${end}::date + interval '1 day'
    GROUP BY i.id, i.name, i.unit ORDER BY consumed DESC
  `);
  res.json({ data: result.rows });
}));

// ============================================================
// 18. Producao por Sala
// ============================================================
router.get('/production-by-room', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const dateRange = getDateRange(req.query, res);
  if (!dateRange) return;
  const { start, end } = dateRange;

  const result = await db.execute(sql`
    SELECT r.name as room,
           COUNT(*) as appointments,
           COUNT(*) FILTER (WHERE a.status = 'completed') as completed,
           ROUND(COUNT(*) FILTER (WHERE a.status = 'completed')::numeric / NULLIF(COUNT(*), 0) * 100, 1) as utilization
    FROM appointments a
    JOIN rooms r ON a.room_id = r.id
    WHERE a.company_id = ${companyId}
      AND a.deleted_at IS NULL
      AND a.start_time >= ${start}::date AND a.start_time <= ${end}::date + interval '1 day'
    GROUP BY r.id, r.name ORDER BY appointments DESC
  `);
  res.json({ data: result.rows });
}));

// ============================================================
// 19. Aniversariantes do Mes
// ============================================================
router.get('/birthdays', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;

  const result = await db.execute(sql`
    SELECT id, full_name, birth_date, cellphone, email
    FROM patients
    WHERE company_id = ${companyId} AND active = true
      AND deleted_at IS NULL
      AND birth_date IS NOT NULL
      AND EXTRACT(MONTH FROM birth_date) = ${month}
    ORDER BY EXTRACT(DAY FROM birth_date)
  `);
  res.json({ data: result.rows });
}));

// ============================================================
// 20. Pacientes sem Retorno
// ============================================================
router.get('/patients-without-return', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);

  const result = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE last_visit < NOW() - interval '3 months' AND last_visit >= NOW() - interval '6 months') as "3_to_6_months",
      COUNT(*) FILTER (WHERE last_visit < NOW() - interval '6 months' AND last_visit >= NOW() - interval '12 months') as "6_to_12_months",
      COUNT(*) FILTER (WHERE last_visit < NOW() - interval '12 months') as "over_12_months",
      COUNT(*) FILTER (WHERE last_visit IS NULL) as never_visited
    FROM patients
    WHERE company_id = ${companyId} AND active = true
      AND deleted_at IS NULL
  `);
  res.json({ data: result.rows[0] });
}));

// ============================================================
// 21. Orcamentos Pendentes (Aging)
// ============================================================
router.get('/pending-budgets', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);

  const result = await db.execute(sql`
    SELECT pt.full_name as patient, dtp.title, dtp.estimated_cost,
           dtp.status, dtp.proposed_date,
           EXTRACT(DAY FROM NOW() - dtp.proposed_date) as days_pending
    FROM detailed_treatment_plans dtp
    JOIN patients pt ON dtp.patient_id = pt.id
    WHERE dtp.company_id = ${companyId} AND dtp.status = 'proposed'
      AND dtp.deleted_at IS NULL
      AND pt.deleted_at IS NULL
    ORDER BY days_pending DESC LIMIT 50
  `);
  res.json({ data: result.rows });
}));

// ============================================================
// 22. Horarios Ociosos (Ociosidade da Agenda)
// ============================================================
router.get('/idle-slots', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const dateRange = getDateRange(req.query, res);
  if (!dateRange) return;
  const { start, end } = dateRange;

  const result = await db.execute(sql`
    SELECT
      u.full_name as professional,
      COUNT(*) as total_slots,
      COUNT(*) FILTER (WHERE a.id IS NOT NULL) as booked_slots,
      ROUND(COUNT(*) FILTER (WHERE a.id IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as occupancy_rate
    FROM users u
    LEFT JOIN appointments a ON a.professional_id = u.id
      AND a.start_time >= ${start}::date AND a.start_time <= ${end}::date + interval '1 day'
      AND a.status NOT IN ('cancelled')
      AND a.deleted_at IS NULL
    WHERE u.company_id = ${companyId} AND u.active = true AND u.role IN ('admin', 'dentist', 'professional')
      AND u.deleted_at IS NULL
    GROUP BY u.id, u.full_name
  `);
  res.json({ data: result.rows });
}));

// ============================================================
// 23. Origem dos Pacientes (Referral Source)
// ============================================================
router.get('/referral-sources', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const dateRange = getDateRange(req.query, res);
  if (!dateRange) return;
  const { start, end } = dateRange;

  const result = await db.execute(sql`
    SELECT
      COALESCE(referral_source, 'Nao informado') as source,
      COUNT(*) as count
    FROM patients
    WHERE company_id = ${companyId}
      AND deleted_at IS NULL
      AND created_at >= ${start}::date AND created_at <= ${end}::date + interval '1 day'
    GROUP BY source ORDER BY count DESC
  `);
  res.json({ data: result.rows });
}));

// ============================================================
// 24. Dashboard Resumo Geral
// ============================================================
router.get('/dashboard-summary', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const today = new Date().toISOString().split('T')[0];
  const monthStart = `${today.substring(0, 7)}-01`;

  const result = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM patients WHERE company_id = ${companyId} AND active = true AND deleted_at IS NULL) as total_patients,
      (SELECT COUNT(*) FROM patients WHERE company_id = ${companyId} AND deleted_at IS NULL AND created_at >= ${monthStart}::date) as new_patients_month,
      (SELECT COUNT(*) FROM appointments WHERE company_id = ${companyId} AND deleted_at IS NULL AND start_time::date = ${today}::date AND status NOT IN ('cancelled')) as appointments_today,
      (SELECT COUNT(*) FROM appointments WHERE company_id = ${companyId} AND deleted_at IS NULL AND start_time >= ${monthStart}::date AND status = 'completed') as completed_month,
      (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE company_id = ${companyId} AND status = 'completed' AND created_at >= ${monthStart}::date) as revenue_month,
      (SELECT COUNT(*) FROM appointments WHERE company_id = ${companyId} AND deleted_at IS NULL AND start_time >= ${monthStart}::date AND status = 'no_show') as no_shows_month
  `);
  res.json({ data: result.rows[0] });
}));

// ============================================================
// 25. Cohort Retention
// ============================================================
router.get('/cohort-retention', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const dateRange = getDateRange(req.query, res);
  if (!dateRange) return;
  const { start, end } = dateRange;

  // Group patients by the month of their first appointment.
  // For each cohort, count how many returned within 3, 6 and 12 months.
  const result = await db.execute(sql`
    WITH first_visits AS (
      SELECT
        patient_id,
        MIN(start_time) AS first_visit,
        to_char(MIN(start_time), 'YYYY-MM') AS cohort_month
      FROM appointments
      WHERE company_id = ${companyId}
        AND status = 'completed'
        AND deleted_at IS NULL
        AND start_time >= ${start}::date
        AND start_time <= ${end}::date + interval '1 day'
      GROUP BY patient_id
    ),
    return_flags AS (
      SELECT
        fv.patient_id,
        fv.cohort_month,
        MAX(CASE WHEN a.start_time > fv.first_visit
                      AND a.start_time <= fv.first_visit + interval '3 months' THEN 1 ELSE 0 END) AS returned_3m,
        MAX(CASE WHEN a.start_time > fv.first_visit
                      AND a.start_time <= fv.first_visit + interval '6 months' THEN 1 ELSE 0 END) AS returned_6m,
        MAX(CASE WHEN a.start_time > fv.first_visit
                      AND a.start_time <= fv.first_visit + interval '12 months' THEN 1 ELSE 0 END) AS returned_12m
      FROM first_visits fv
      LEFT JOIN appointments a
        ON a.patient_id = fv.patient_id
       AND a.company_id = ${companyId}
       AND a.status = 'completed'
       AND a.deleted_at IS NULL
      GROUP BY fv.patient_id, fv.cohort_month
    )
    SELECT
      cohort_month,
      COUNT(*) AS cohort_size,
      SUM(returned_3m) AS returned_3m,
      SUM(returned_6m) AS returned_6m,
      SUM(returned_12m) AS returned_12m,
      ROUND(SUM(returned_3m)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS retention_3m_pct,
      ROUND(SUM(returned_6m)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS retention_6m_pct,
      ROUND(SUM(returned_12m)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS retention_12m_pct
    FROM return_flags
    GROUP BY cohort_month
    ORDER BY cohort_month
  `);

  const format = req.query.format as string | undefined;
  if (format === 'pdf' || format === 'xlsx') {
    const columns: ReportColumn[] = [
      { header: 'Cohort (Mes)', key: 'cohort_month', width: 14 },
      { header: 'Pacientes', key: 'cohort_size', format: 'number', width: 12 },
      { header: 'Retorno 3m', key: 'returned_3m', format: 'number', width: 12 },
      { header: 'Retencao 3m %', key: 'retention_3m_pct', width: 14 },
      { header: 'Retorno 6m', key: 'returned_6m', format: 'number', width: 12 },
      { header: 'Retencao 6m %', key: 'retention_6m_pct', width: 14 },
      { header: 'Retorno 12m', key: 'returned_12m', format: 'number', width: 12 },
      { header: 'Retencao 12m %', key: 'retention_12m_pct', width: 14 },
    ];
    const reportData: ReportData = {
      title: 'Retencao por Cohort',
      subtitle: `Periodo: ${start} a ${end}`,
      columns,
      rows: result.rows as Record<string, any>[],
      generatedAt: new Date(),
    };
    if (format === 'pdf') return reportExportService.exportPDF(reportData, res);
    return reportExportService.exportExcel(reportData, res);
  }

  res.json({ data: result.rows });
}));

// ============================================================
// 26. Average Ticket
// ============================================================
router.get('/avg-ticket', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const dateRange = getDateRange(req.query, res);
  if (!dateRange) return;
  const { start, end } = dateRange;
  const professionalId = req.query.professionalId as string | undefined;

  const professionalFilter = professionalId
    ? sql`AND a.professional_id = ${parseInt(professionalId, 10)}`
    : sql``;

  // Average ticket per patient
  const byPatient = await db.execute(sql`
    SELECT
      pt.full_name AS patient,
      pt.id AS patient_id,
      COUNT(DISTINCT p.id) AS payments_count,
      SUM(p.amount) AS total_paid,
      ROUND(AVG(p.amount)) AS avg_ticket
    FROM payments p
    JOIN patients pt ON p.patient_id = pt.id AND pt.deleted_at IS NULL
    WHERE p.company_id = ${companyId}
      AND p.status = 'completed'
      AND p.created_at >= ${start}::date
      AND p.created_at <= ${end}::date + interval '1 day'
    GROUP BY pt.id, pt.full_name
    ORDER BY avg_ticket DESC
    LIMIT 50
  `);

  // Average ticket per dentist
  const byProfessional = await db.execute(sql`
    SELECT
      u.full_name AS professional,
      u.id AS professional_id,
      COUNT(DISTINCT p.id) AS payments_count,
      SUM(p.amount) AS total_revenue,
      ROUND(AVG(p.amount)) AS avg_ticket
    FROM payments p
    JOIN appointments a ON p.appointment_id = a.id AND a.deleted_at IS NULL
    JOIN users u ON a.professional_id = u.id AND u.deleted_at IS NULL
    WHERE p.company_id = ${companyId}
      AND p.status = 'completed'
      AND p.created_at >= ${start}::date
      AND p.created_at <= ${end}::date + interval '1 day'
      ${professionalFilter}
    GROUP BY u.id, u.full_name
    ORDER BY avg_ticket DESC
  `);

  const format = req.query.format as string | undefined;
  if (format === 'pdf' || format === 'xlsx') {
    const columns: ReportColumn[] = [
      { header: 'Profissional', key: 'professional', width: 25 },
      { header: 'Qtd Pagamentos', key: 'payments_count', format: 'number', width: 16 },
      { header: 'Receita Total', key: 'total_revenue', format: 'currency', width: 16 },
      { header: 'Ticket Medio', key: 'avg_ticket', format: 'currency', width: 16 },
    ];
    const reportData: ReportData = {
      title: 'Ticket Medio por Profissional',
      subtitle: `Periodo: ${start} a ${end}`,
      columns,
      rows: byProfessional.rows as Record<string, any>[],
      generatedAt: new Date(),
    };
    if (format === 'pdf') return reportExportService.exportPDF(reportData, res);
    return reportExportService.exportExcel(reportData, res);
  }

  res.json({
    data: {
      byPatient: byPatient.rows,
      byProfessional: byProfessional.rows,
    },
  });
}));

// ============================================================
// 27. Delinquency Aging (Inadimplencia por Faixa)
// ============================================================
router.get('/delinquency-aging', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);

  // Group overdue receivables (treatment_plans with balance > 0) into aging brackets.
  const result = await db.execute(sql`
    SELECT
      pt.full_name AS patient,
      pt.id AS patient_id,
      pt.cellphone,
      tp.name AS treatment,
      (tp.total_amount - COALESCE(tp.paid_amount, 0)) AS balance,
      tp.updated_at AS last_activity,
      EXTRACT(DAY FROM NOW() - tp.updated_at) AS days_overdue,
      CASE
        WHEN EXTRACT(DAY FROM NOW() - tp.updated_at) <= 30  THEN '0-30'
        WHEN EXTRACT(DAY FROM NOW() - tp.updated_at) <= 60  THEN '31-60'
        WHEN EXTRACT(DAY FROM NOW() - tp.updated_at) <= 90  THEN '61-90'
        ELSE '90+'
      END AS aging_bracket
    FROM treatment_plans tp
    JOIN patients pt ON tp.patient_id = pt.id AND pt.deleted_at IS NULL
    WHERE tp.company_id = ${companyId}
      AND tp.deleted_at IS NULL
      AND tp.status IN ('approved', 'in_progress')
      AND tp.total_amount > COALESCE(tp.paid_amount, 0)
    ORDER BY days_overdue DESC
  `);

  // Aggregate summary by bracket
  const rows = result.rows as Array<{
    aging_bracket: string;
    balance: string | number;
    [key: string]: any;
  }>;

  const summary: Record<string, { count: number; totalBalance: number }> = {
    '0-30': { count: 0, totalBalance: 0 },
    '31-60': { count: 0, totalBalance: 0 },
    '61-90': { count: 0, totalBalance: 0 },
    '90+': { count: 0, totalBalance: 0 },
  };

  rows.forEach((r) => {
    const bracket = r.aging_bracket as string;
    if (summary[bracket]) {
      summary[bracket].count += 1;
      summary[bracket].totalBalance += parseFloat(String(r.balance || '0'));
    }
  });

  const format = req.query.format as string | undefined;
  if (format === 'pdf' || format === 'xlsx') {
    const columns: ReportColumn[] = [
      { header: 'Paciente', key: 'patient', width: 25 },
      { header: 'Tratamento', key: 'treatment', width: 25 },
      { header: 'Saldo Devedor', key: 'balance', format: 'currency', width: 16 },
      { header: 'Dias em Atraso', key: 'days_overdue', format: 'number', width: 16 },
      { header: 'Faixa', key: 'aging_bracket', width: 10 },
      { header: 'Telefone', key: 'cellphone', width: 16 },
    ];
    const reportData: ReportData = {
      title: 'Inadimplencia por Faixa de Atraso',
      columns,
      rows: rows as Record<string, any>[],
      summary: {
        '0-30 dias': `${summary['0-30'].count} pacientes — R$ ${(summary['0-30'].totalBalance / 100).toFixed(2)}`,
        '31-60 dias': `${summary['31-60'].count} pacientes — R$ ${(summary['31-60'].totalBalance / 100).toFixed(2)}`,
        '61-90 dias': `${summary['61-90'].count} pacientes — R$ ${(summary['61-90'].totalBalance / 100).toFixed(2)}`,
        'Acima de 90 dias': `${summary['90+'].count} pacientes — R$ ${(summary['90+'].totalBalance / 100).toFixed(2)}`,
      },
      generatedAt: new Date(),
    };
    if (format === 'pdf') return reportExportService.exportPDF(reportData, res);
    return reportExportService.exportExcel(reportData, res);
  }

  res.json({ data: rows, summary });
}));

// ============================================================
// 28. Revenue Split: Recurring vs One-Time
// ============================================================
router.get('/revenue-split', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const dateRange = getDateRange(req.query, res);
  if (!dateRange) return;
  const { start, end } = dateRange;
  const professionalId = req.query.professionalId as string | undefined;

  const professionalFilter = professionalId
    ? sql`AND a.professional_id = ${parseInt(professionalId, 10)}`
    : sql``;

  // Classify payments as "recurring" (patient had a prior payment) or "one-time"
  const result = await db.execute(sql`
    WITH patient_payment_rank AS (
      SELECT
        p.id,
        p.patient_id,
        p.amount,
        p.created_at,
        p.payment_method,
        ROW_NUMBER() OVER (PARTITION BY p.patient_id ORDER BY p.created_at) AS payment_rank
      FROM payments p
      LEFT JOIN appointments a ON p.appointment_id = a.id AND a.deleted_at IS NULL
      WHERE p.company_id = ${companyId}
        AND p.status = 'completed'
        ${professionalFilter}
    )
    SELECT
      to_char(created_at, 'YYYY-MM') AS month,
      SUM(CASE WHEN payment_rank = 1 THEN amount ELSE 0 END) AS one_time_revenue,
      COUNT(CASE WHEN payment_rank = 1 THEN 1 END) AS one_time_count,
      SUM(CASE WHEN payment_rank > 1 THEN amount ELSE 0 END) AS recurring_revenue,
      COUNT(CASE WHEN payment_rank > 1 THEN 1 END) AS recurring_count,
      SUM(amount) AS total_revenue
    FROM patient_payment_rank
    WHERE created_at >= ${start}::date
      AND created_at <= ${end}::date + interval '1 day'
    GROUP BY month
    ORDER BY month
  `);

  const format = req.query.format as string | undefined;
  if (format === 'pdf' || format === 'xlsx') {
    const columns: ReportColumn[] = [
      { header: 'Mes', key: 'month', width: 12 },
      { header: 'Receita Recorrente', key: 'recurring_revenue', format: 'currency', width: 20 },
      { header: 'Qtd Recorrente', key: 'recurring_count', format: 'number', width: 16 },
      { header: 'Receita Unica', key: 'one_time_revenue', format: 'currency', width: 18 },
      { header: 'Qtd Unica', key: 'one_time_count', format: 'number', width: 14 },
      { header: 'Total', key: 'total_revenue', format: 'currency', width: 16 },
    ];
    const reportData: ReportData = {
      title: 'Receita Recorrente vs Avulsa',
      subtitle: `Periodo: ${start} a ${end}`,
      columns,
      rows: result.rows as Record<string, any>[],
      generatedAt: new Date(),
    };
    if (format === 'pdf') return reportExportService.exportPDF(reportData, res);
    return reportExportService.exportExcel(reportData, res);
  }

  res.json({ data: result.rows });
}));

// ============================================================
// 29. Insurance by Operator
// ============================================================
router.get('/insurance-by-operator', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const dateRange = getDateRange(req.query, res);
  if (!dateRange) return;
  const { start, end } = dateRange;

  const result = await db.execute(sql`
    SELECT
      COALESCE(NULLIF(pt.health_insurance, ''), 'Particular') AS operator,
      COUNT(DISTINCT pt.id) AS patient_count,
      COUNT(DISTINCT a.id) AS appointment_count,
      SUM(p.amount) AS total_revenue,
      ROUND(AVG(p.amount)) AS avg_ticket
    FROM payments p
    JOIN patients pt ON p.patient_id = pt.id AND pt.deleted_at IS NULL
    LEFT JOIN appointments a
      ON p.appointment_id = a.id
     AND a.deleted_at IS NULL
     AND a.start_time >= ${start}::date
     AND a.start_time <= ${end}::date + interval '1 day'
    WHERE p.company_id = ${companyId}
      AND p.status = 'completed'
      AND p.created_at >= ${start}::date
      AND p.created_at <= ${end}::date + interval '1 day'
    GROUP BY operator
    ORDER BY total_revenue DESC
  `);

  const format = req.query.format as string | undefined;
  if (format === 'pdf' || format === 'xlsx') {
    const columns: ReportColumn[] = [
      { header: 'Operadora / Tipo', key: 'operator', width: 25 },
      { header: 'Pacientes', key: 'patient_count', format: 'number', width: 12 },
      { header: 'Consultas', key: 'appointment_count', format: 'number', width: 12 },
      { header: 'Receita Total', key: 'total_revenue', format: 'currency', width: 18 },
      { header: 'Ticket Medio', key: 'avg_ticket', format: 'currency', width: 16 },
    ];
    const reportData: ReportData = {
      title: 'Receita por Operadora de Convenio',
      subtitle: `Periodo: ${start} a ${end}`,
      columns,
      rows: result.rows as Record<string, any>[],
      generatedAt: new Date(),
    };
    if (format === 'pdf') return reportExportService.exportPDF(reportData, res);
    return reportExportService.exportExcel(reportData, res);
  }

  res.json({ data: result.rows });
}));

// ============================================================
// 30. Generic Export Endpoint
// Wraps any existing report endpoint and returns PDF or XLSX
// ============================================================
router.get('/export/:reportType', authCheck, asyncHandler(async (req, res) => {
  const { reportType } = req.params;
  const format = req.query.format as string;
  const companyId = getCompanyId(req);
  const dateRange = getDateRange(req.query, res);
  if (!dateRange) return;
  const { start, end } = dateRange;
  const professionalId = req.query.professionalId as string | undefined;

  if (!format || !['pdf', 'xlsx'].includes(format)) {
    return res.status(400).json({ error: 'Query param format must be "pdf" or "xlsx"' });
  }

  // Fetch company name for report header
  const companyResult = await db.execute(sql`
    SELECT name FROM companies WHERE id = ${companyId} LIMIT 1
  `);
  const companyName = (companyResult.rows[0] as any)?.name ?? '';

  type ReportConfig = {
    title: string;
    columns: ReportColumn[];
    fetchData: () => Promise<any[]>;
  };

  const reportConfigs: Record<string, ReportConfig> = {
    'revenue-by-period': {
      title: 'Receita por Periodo',
      columns: [
        { header: 'Periodo', key: 'period', width: 14 },
        { header: 'Receita Total', key: 'total', format: 'currency', width: 18 },
        { header: 'Qtd Pagamentos', key: 'count', format: 'number', width: 16 },
      ],
      fetchData: async () => {
        const r = await db.execute(sql`
          SELECT to_char(created_at, 'YYYY-MM-DD') AS period,
                 SUM(amount) AS total, COUNT(*) AS count
          FROM payments
          WHERE company_id = ${companyId} AND status = 'completed'
            AND created_at >= ${start}::date AND created_at <= ${end}::date + interval '1 day'
          GROUP BY period ORDER BY period
        `);
        return r.rows as any[];
      },
    },

    'revenue-by-professional': {
      title: 'Receita por Profissional',
      columns: [
        { header: 'Profissional', key: 'professional', width: 25 },
        { header: 'Receita Bruta', key: 'total', format: 'currency', width: 18 },
        { header: 'Procedimentos', key: 'count', format: 'number', width: 16 },
      ],
      fetchData: async () => {
        const profFilter = professionalId
          ? sql`AND a.professional_id = ${parseInt(professionalId, 10)}`
          : sql``;
        const r = await db.execute(sql`
          SELECT u.full_name AS professional,
                 SUM(p.amount) AS total, COUNT(*) AS count
          FROM payments p
          JOIN appointments a ON p.appointment_id = a.id AND a.deleted_at IS NULL
          JOIN users u ON a.professional_id = u.id AND u.deleted_at IS NULL
          WHERE p.company_id = ${companyId} AND p.status = 'completed'
            AND p.created_at >= ${start}::date AND p.created_at <= ${end}::date + interval '1 day'
            ${profFilter}
          GROUP BY u.id, u.full_name ORDER BY total DESC
        `);
        return r.rows as any[];
      },
    },

    'revenue-by-procedure': {
      title: 'Receita por Procedimento',
      columns: [
        { header: 'Procedimento', key: 'procedure_name', width: 30 },
        { header: 'Categoria', key: 'category', width: 18 },
        { header: 'Total', key: 'total', format: 'currency', width: 16 },
        { header: 'Qtd', key: 'count', format: 'number', width: 10 },
      ],
      fetchData: async () => {
        const r = await db.execute(sql`
          SELECT pr.name AS procedure_name, pr.category,
                 SUM(ap.price) AS total, COUNT(*) AS count
          FROM appointment_procedures ap
          JOIN procedures pr ON ap.procedure_id = pr.id
          JOIN appointments a ON ap.appointment_id = a.id
          WHERE a.company_id = ${companyId} AND a.status = 'completed'
            AND a.deleted_at IS NULL
            AND a.start_time >= ${start}::date AND a.start_time <= ${end}::date + interval '1 day'
          GROUP BY pr.id, pr.name, pr.category ORDER BY total DESC
        `);
        return r.rows as any[];
      },
    },

    'no-show-rate': {
      title: 'Taxa de Faltas por Mes',
      columns: [
        { header: 'Mes', key: 'month', width: 12 },
        { header: 'Total Agendamentos', key: 'total', format: 'number', width: 20 },
        { header: 'Faltas', key: 'no_shows', format: 'number', width: 12 },
        { header: 'Taxa de Falta %', key: 'rate', width: 16 },
      ],
      fetchData: async () => {
        const r = await db.execute(sql`
          SELECT to_char(start_time, 'YYYY-MM') AS month,
                 COUNT(*) AS total,
                 COUNT(*) FILTER (WHERE status = 'no_show') AS no_shows,
                 ROUND(COUNT(*) FILTER (WHERE status = 'no_show')::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS rate
          FROM appointments
          WHERE company_id = ${companyId} AND deleted_at IS NULL
            AND start_time >= ${start}::date AND start_time <= ${end}::date + interval '1 day'
          GROUP BY month ORDER BY month
        `);
        return r.rows as any[];
      },
    },

    'top-procedures': {
      title: 'Procedimentos Mais Realizados',
      columns: [
        { header: 'Procedimento', key: 'name', width: 30 },
        { header: 'Categoria', key: 'category', width: 18 },
        { header: 'Qtd Realizados', key: 'count', format: 'number', width: 16 },
        { header: 'Receita Total', key: 'total_revenue', format: 'currency', width: 18 },
      ],
      fetchData: async () => {
        const r = await db.execute(sql`
          SELECT pr.name, pr.category, COUNT(*) AS count, SUM(ap.price) AS total_revenue
          FROM appointment_procedures ap
          JOIN procedures pr ON ap.procedure_id = pr.id
          JOIN appointments a ON ap.appointment_id = a.id
          WHERE a.company_id = ${companyId} AND a.status = 'completed'
            AND a.deleted_at IS NULL
            AND a.start_time >= ${start}::date AND a.start_time <= ${end}::date + interval '1 day'
          GROUP BY pr.id, pr.name, pr.category ORDER BY count DESC LIMIT 20
        `);
        return r.rows as any[];
      },
    },

    'avg-ticket': {
      title: 'Ticket Medio por Profissional',
      columns: [
        { header: 'Profissional', key: 'professional', width: 25 },
        { header: 'Pagamentos', key: 'payments_count', format: 'number', width: 14 },
        { header: 'Receita Total', key: 'total_revenue', format: 'currency', width: 18 },
        { header: 'Ticket Medio', key: 'avg_ticket', format: 'currency', width: 16 },
      ],
      fetchData: async () => {
        const profFilter = professionalId
          ? sql`AND a.professional_id = ${parseInt(professionalId, 10)}`
          : sql``;
        const r = await db.execute(sql`
          SELECT u.full_name AS professional,
                 COUNT(DISTINCT p.id) AS payments_count,
                 SUM(p.amount) AS total_revenue,
                 ROUND(AVG(p.amount)) AS avg_ticket
          FROM payments p
          JOIN appointments a ON p.appointment_id = a.id AND a.deleted_at IS NULL
          JOIN users u ON a.professional_id = u.id AND u.deleted_at IS NULL
          WHERE p.company_id = ${companyId} AND p.status = 'completed'
            AND p.created_at >= ${start}::date AND p.created_at <= ${end}::date + interval '1 day'
            ${profFilter}
          GROUP BY u.id, u.full_name ORDER BY avg_ticket DESC
        `);
        return r.rows as any[];
      },
    },

    'delinquency-aging': {
      title: 'Inadimplencia por Faixa de Atraso',
      columns: [
        { header: 'Paciente', key: 'patient', width: 25 },
        { header: 'Tratamento', key: 'treatment', width: 25 },
        { header: 'Saldo Devedor', key: 'balance', format: 'currency', width: 16 },
        { header: 'Dias Atraso', key: 'days_overdue', format: 'number', width: 14 },
        { header: 'Faixa', key: 'aging_bracket', width: 10 },
      ],
      fetchData: async () => {
        const r = await db.execute(sql`
          SELECT pt.full_name AS patient, tp.name AS treatment,
                 (tp.total_amount - COALESCE(tp.paid_amount, 0)) AS balance,
                 EXTRACT(DAY FROM NOW() - tp.updated_at) AS days_overdue,
                 CASE
                   WHEN EXTRACT(DAY FROM NOW() - tp.updated_at) <= 30  THEN '0-30'
                   WHEN EXTRACT(DAY FROM NOW() - tp.updated_at) <= 60  THEN '31-60'
                   WHEN EXTRACT(DAY FROM NOW() - tp.updated_at) <= 90  THEN '61-90'
                   ELSE '90+'
                 END AS aging_bracket
          FROM treatment_plans tp
          JOIN patients pt ON tp.patient_id = pt.id AND pt.deleted_at IS NULL
          WHERE tp.company_id = ${companyId} AND tp.deleted_at IS NULL
            AND tp.status IN ('approved', 'in_progress')
            AND tp.total_amount > COALESCE(tp.paid_amount, 0)
          ORDER BY days_overdue DESC
        `);
        return r.rows as any[];
      },
    },

    'revenue-split': {
      title: 'Receita Recorrente vs Avulsa',
      columns: [
        { header: 'Mes', key: 'month', width: 12 },
        { header: 'Recorrente', key: 'recurring_revenue', format: 'currency', width: 18 },
        { header: 'Qtd Recorrente', key: 'recurring_count', format: 'number', width: 16 },
        { header: 'Avulsa', key: 'one_time_revenue', format: 'currency', width: 16 },
        { header: 'Qtd Avulsa', key: 'one_time_count', format: 'number', width: 14 },
        { header: 'Total', key: 'total_revenue', format: 'currency', width: 16 },
      ],
      fetchData: async () => {
        const profFilter = professionalId
          ? sql`AND a.professional_id = ${parseInt(professionalId, 10)}`
          : sql``;
        const r = await db.execute(sql`
          WITH ranked AS (
            SELECT p.id, p.patient_id, p.amount, p.created_at,
                   ROW_NUMBER() OVER (PARTITION BY p.patient_id ORDER BY p.created_at) AS rn
            FROM payments p
            LEFT JOIN appointments a ON p.appointment_id = a.id AND a.deleted_at IS NULL
            WHERE p.company_id = ${companyId} AND p.status = 'completed'
              ${profFilter}
          )
          SELECT to_char(created_at, 'YYYY-MM') AS month,
                 SUM(CASE WHEN rn = 1 THEN amount ELSE 0 END) AS one_time_revenue,
                 COUNT(CASE WHEN rn = 1 THEN 1 END) AS one_time_count,
                 SUM(CASE WHEN rn > 1 THEN amount ELSE 0 END) AS recurring_revenue,
                 COUNT(CASE WHEN rn > 1 THEN 1 END) AS recurring_count,
                 SUM(amount) AS total_revenue
          FROM ranked
          WHERE created_at >= ${start}::date AND created_at <= ${end}::date + interval '1 day'
          GROUP BY month ORDER BY month
        `);
        return r.rows as any[];
      },
    },

    'insurance-by-operator': {
      title: 'Receita por Operadora de Convenio',
      columns: [
        { header: 'Operadora', key: 'operator', width: 25 },
        { header: 'Pacientes', key: 'patient_count', format: 'number', width: 12 },
        { header: 'Consultas', key: 'appointment_count', format: 'number', width: 12 },
        { header: 'Receita Total', key: 'total_revenue', format: 'currency', width: 18 },
        { header: 'Ticket Medio', key: 'avg_ticket', format: 'currency', width: 16 },
      ],
      fetchData: async () => {
        const r = await db.execute(sql`
          SELECT COALESCE(NULLIF(pt.health_insurance, ''), 'Particular') AS operator,
                 COUNT(DISTINCT pt.id) AS patient_count,
                 COUNT(DISTINCT a.id) AS appointment_count,
                 SUM(p.amount) AS total_revenue,
                 ROUND(AVG(p.amount)) AS avg_ticket
          FROM payments p
          JOIN patients pt ON p.patient_id = pt.id AND pt.deleted_at IS NULL
          LEFT JOIN appointments a ON p.appointment_id = a.id AND a.deleted_at IS NULL
            AND a.start_time >= ${start}::date AND a.start_time <= ${end}::date + interval '1 day'
          WHERE p.company_id = ${companyId} AND p.status = 'completed'
            AND p.created_at >= ${start}::date AND p.created_at <= ${end}::date + interval '1 day'
          GROUP BY operator ORDER BY total_revenue DESC
        `);
        return r.rows as any[];
      },
    },

    'cohort-retention': {
      title: 'Retencao por Cohort',
      columns: [
        { header: 'Cohort (Mes)', key: 'cohort_month', width: 14 },
        { header: 'Pacientes', key: 'cohort_size', format: 'number', width: 12 },
        { header: 'Retencao 3m %', key: 'retention_3m_pct', width: 14 },
        { header: 'Retencao 6m %', key: 'retention_6m_pct', width: 14 },
        { header: 'Retencao 12m %', key: 'retention_12m_pct', width: 16 },
      ],
      fetchData: async () => {
        const r = await db.execute(sql`
          WITH first_visits AS (
            SELECT patient_id, MIN(start_time) AS first_visit,
                   to_char(MIN(start_time), 'YYYY-MM') AS cohort_month
            FROM appointments
            WHERE company_id = ${companyId} AND status = 'completed' AND deleted_at IS NULL
              AND start_time >= ${start}::date AND start_time <= ${end}::date + interval '1 day'
            GROUP BY patient_id
          ),
          return_flags AS (
            SELECT fv.patient_id, fv.cohort_month,
                   MAX(CASE WHEN a.start_time > fv.first_visit AND a.start_time <= fv.first_visit + interval '3 months' THEN 1 ELSE 0 END) AS r3,
                   MAX(CASE WHEN a.start_time > fv.first_visit AND a.start_time <= fv.first_visit + interval '6 months' THEN 1 ELSE 0 END) AS r6,
                   MAX(CASE WHEN a.start_time > fv.first_visit AND a.start_time <= fv.first_visit + interval '12 months' THEN 1 ELSE 0 END) AS r12
            FROM first_visits fv
            LEFT JOIN appointments a ON a.patient_id = fv.patient_id AND a.company_id = ${companyId}
              AND a.status = 'completed' AND a.deleted_at IS NULL
            GROUP BY fv.patient_id, fv.cohort_month
          )
          SELECT cohort_month, COUNT(*) AS cohort_size,
                 ROUND(SUM(r3)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS retention_3m_pct,
                 ROUND(SUM(r6)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS retention_6m_pct,
                 ROUND(SUM(r12)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS retention_12m_pct
          FROM return_flags GROUP BY cohort_month ORDER BY cohort_month
        `);
        return r.rows as any[];
      },
    },
  };

  const config = reportConfigs[reportType];
  if (!config) {
    return res.status(404).json({
      error: `Report type "${reportType}" not found`,
      available: Object.keys(reportConfigs),
    });
  }

  const rows = await config.fetchData();

  const reportData: ReportData = {
    title: config.title,
    subtitle: `Periodo: ${start} a ${end}`,
    columns: config.columns,
    rows,
    companyName,
    generatedAt: new Date(),
  };

  if (format === 'pdf') {
    return reportExportService.exportPDF(reportData, res);
  }

  return reportExportService.exportExcel(reportData, res);
}));

// ============================================================
// POST /export-pdf
// Accepts arbitrary tabular data from the frontend and returns a
// self-contained, print-ready HTML page. The client opens it in a
// new tab; the user then uses the browser's Print dialog to save as PDF.
//
// This avoids any server-side native binary dependency (Puppeteer /
// wkhtmltopdf) while still producing a branded, paginated output.
// ============================================================
router.post('/export-pdf', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);

  // Fetch the clinic name for the report header
  let clinicName = '';
  try {
    const clinicResult = await db.execute(
      sql`SELECT name FROM companies WHERE id = ${companyId}`,
    );
    clinicName = (clinicResult.rows[0] as any)?.name ?? '';
  } catch {
    // Non-fatal — header will simply omit the clinic name
  }

  const {
    title,
    subtitle,
    dateRange,
    columns,
    data,
    summary,
  } = req.body as {
    title?: string;
    subtitle?: string;
    dateRange?: string;
    columns?: PdfReportColumn[];
    data?: Record<string, unknown>[];
    summary?: PdfSummaryItem[];
  };

  const html = generateReportHtml({
    title: title || 'Relatorio',
    subtitle,
    clinicName,
    dateRange,
    columns: columns || [],
    data: data || [],
    summary,
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

// ============================================================
// Executive Report — monthly KPI summary (on-demand + cron)
// ============================================================

// GET /api/v1/reports/executive/:month
// Returns the stored executive report for the given YYYY-MM month.
// If no report exists yet it is generated on-demand synchronously.
router.get('/executive/:month', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const { month } = req.params;

  // Basic format guard: YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'month must be in YYYY-MM format' });
  }

  // Check if report already exists
  let report = await db.$client.query(
    `SELECT * FROM executive_reports WHERE company_id = $1 AND month = $2`,
    [companyId, month]
  );

  if (report.rows.length === 0) {
    // Generate on demand and re-fetch
    const { generateReportForCompany } = await import('../jobs/monthly-executive-report');
    const company = await db.$client.query(
      `SELECT name, email FROM companies WHERE id = $1`,
      [companyId]
    );
    await generateReportForCompany(
      companyId,
      company.rows[0]?.name ?? '',
      company.rows[0]?.email ?? ''
    );

    report = await db.$client.query(
      `SELECT * FROM executive_reports WHERE company_id = $1 AND month = $2`,
      [companyId, month]
    );
  }

  res.json(report.rows[0] ?? { kpis: {}, month });
}));

export default router;

