/**
 * Reports Routes - 25 relatorios gerenciais
 * Endpoints para relatorios financeiros, clinicos e operacionais
 */

import { Router } from 'express';
import { authCheck, asyncHandler } from '../middleware/auth';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

// Helper: parse date range from query
function getDateRange(query: any): { start: string; end: string } {
  const end = query.endDate || new Date().toISOString().split('T')[0];
  const start = query.startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  return { start, end };
}

function getCompanyId(req: any): number {
  const user = req.user as any;
  return user?.companyId;
}

// ============================================================
// 1. Receita por Periodo
// ============================================================
router.get('/revenue-by-period', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const { start, end } = getDateRange(req.query);
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
  const { start, end } = getDateRange(req.query);

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
  const { start, end } = getDateRange(req.query);

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
  const { start, end } = getDateRange(req.query);

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
  const { start, end } = getDateRange(req.query);

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
  const { start, end } = getDateRange(req.query);

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
  const { start, end } = getDateRange(req.query);

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
  const { start, end } = getDateRange(req.query);

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
  const { start, end } = getDateRange(req.query);

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
  const { start, end } = getDateRange(req.query);

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
  const { start, end } = getDateRange(req.query);

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
  const { start, end } = getDateRange(req.query);

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
  const { start, end } = getDateRange(req.query);

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
  const { start, end } = getDateRange(req.query);

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
  const { start, end } = getDateRange(req.query);

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

export default router;
