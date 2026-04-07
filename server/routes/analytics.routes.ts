import { Router } from 'express';
import { storage } from '../storage';
import { authCheck, asyncHandler, tenantAwareAuth } from '../middleware/auth';
import { validate, dateRangeSchema } from '../middleware/validation';
import { z } from 'zod';
import { db } from '../db';
import { appointments, patients, procedures, users, appointmentProcedures, npsSurveys } from '@shared/schema';
import { sql, eq, and, gte, lte, count, desc, isNull } from 'drizzle-orm';
import { notDeleted } from '../lib/soft-delete';

const router = Router();

// Schema para query de analytics
const analyticsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  professionalId: z.string().transform(Number).optional(),
});

/**
 * GET /api/v1/analytics/overview
 * Retorna visão geral das métricas da clínica
 */
router.get(
  '/overview',
  authCheck,
  validate({ query: analyticsQuerySchema }),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { startDate, endDate, professionalId } = req.query as any;

    // Período padrão: últimos 30 dias
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    const previousStart = new Date(start.getTime() - (end.getTime() - start.getTime()));

    // SQL aggregation instead of loading all appointments into memory
    const conditions = [
      eq(appointments.companyId, companyId),
      notDeleted(appointments.deletedAt),
      gte(appointments.startTime, start),
      lte(appointments.startTime, end),
    ];
    if (professionalId) conditions.push(eq(appointments.professionalId, Number(professionalId)));

    // Single query: aggregate by status for current period
    const [stats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${appointments.status} = 'completed')::int`,
        cancelled: sql<number>`count(*) filter (where ${appointments.status} = 'cancelled')::int`,
        noShow: sql<number>`count(*) filter (where ${appointments.status} = 'no_show')::int`,
        scheduled: sql<number>`count(*) filter (where ${appointments.status} = 'scheduled')::int`,
        confirmed: sql<number>`count(*) filter (where ${appointments.status} = 'confirmed')::int`,
        inProgress: sql<number>`count(*) filter (where ${appointments.status} = 'in_progress')::int`,
      })
      .from(appointments)
      .where(and(...conditions));

    // Previous period count for growth calculation
    const [prevStats] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(appointments)
      .where(and(
        eq(appointments.companyId, companyId),
        notDeleted(appointments.deletedAt),
        gte(appointments.startTime, previousStart),
        lte(appointments.startTime, start),
        ...(professionalId ? [eq(appointments.professionalId, Number(professionalId))] : []),
      ));

    const totalAppointments = stats?.total || 0;
    const completedAppointments = stats?.completed || 0;
    const cancelledAppointments = stats?.cancelled || 0;
    const noShowAppointments = stats?.noShow || 0;

    const workingDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const availableSlots = workingDays * 8;
    const occupancyRate = availableSlots > 0 ? ((completedAppointments / availableSlots) * 100).toFixed(1) : '0';
    const cancellationRate = totalAppointments > 0 ? ((cancelledAppointments / totalAppointments) * 100).toFixed(1) : '0';
    const noShowRate = totalAppointments > 0 ? ((noShowAppointments / totalAppointments) * 100).toFixed(1) : '0';
    const prevTotal = prevStats?.total || 0;
    const growthRate = prevTotal > 0 ? (((totalAppointments - prevTotal) / prevTotal) * 100).toFixed(1) : '0';

    res.json({
      period: { startDate: start.toISOString(), endDate: end.toISOString(), days: workingDays },
      summary: {
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        noShowAppointments,
        occupancyRate: parseFloat(occupancyRate),
        cancellationRate: parseFloat(cancellationRate),
        noShowRate: parseFloat(noShowRate),
        growthRate: parseFloat(growthRate),
      },
      statusDistribution: [
        { status: 'completed', count: completedAppointments, label: 'Concluídos' },
        { status: 'scheduled', count: stats?.scheduled || 0, label: 'Agendados' },
        { status: 'confirmed', count: stats?.confirmed || 0, label: 'Confirmados' },
        { status: 'in_progress', count: stats?.inProgress || 0, label: 'Em Andamento' },
        { status: 'cancelled', count: cancelledAppointments, label: 'Cancelados' },
        { status: 'no_show', count: noShowAppointments, label: 'Faltou' },
      ],
    });
  })
);

/**
 * GET /api/v1/analytics/professionals
 * Retorna métricas por profissional
 */
router.get(
  '/professionals',
  authCheck,
  validate({ query: analyticsQuerySchema }),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { startDate, endDate } = req.query as any;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Single SQL query with GROUP BY instead of loading all appointments + O(n*m) JS filter
    const professionalMetrics = await db
      .select({
        professionalId: appointments.professionalId,
        professionalName: users.fullName,
        totalAppointments: sql<number>`count(*)::int`,
        completedAppointments: sql<number>`count(*) filter (where ${appointments.status} = 'completed')::int`,
        cancelledAppointments: sql<number>`count(*) filter (where ${appointments.status} = 'cancelled')::int`,
        noShowAppointments: sql<number>`count(*) filter (where ${appointments.status} = 'no_show')::int`,
      })
      .from(appointments)
      .leftJoin(users, eq(appointments.professionalId, users.id))
      .where(and(
        eq(appointments.companyId, companyId),
        notDeleted(appointments.deletedAt),
        gte(appointments.startTime, start),
        lte(appointments.startTime, end),
      ))
      .groupBy(appointments.professionalId, users.fullName)
      .orderBy(sql`count(*) DESC`);

    res.json({
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      professionals: professionalMetrics.map((m: any) => ({
        ...m,
        professionalName: m.professionalName || 'Sem profissional',
        completionRate: m.totalAppointments > 0
          ? ((m.completedAppointments / m.totalAppointments) * 100).toFixed(1)
          : '0',
      })),
    });
  })
);

/**
 * GET /api/v1/analytics/procedures
 * Retorna procedimentos mais agendados
 */
router.get(
  '/procedures',
  authCheck,
  validate({ query: analyticsQuerySchema }),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { startDate, endDate } = req.query as any;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // SQL aggregation with JOIN instead of loading all appointments
    const procedureStats = await db
      .select({
        procedureId: appointmentProcedures.procedureId,
        procedureName: procedures.name,
        count: sql<number>`count(*)::int`,
      })
      .from(appointmentProcedures)
      .innerJoin(appointments, eq(appointmentProcedures.appointmentId, appointments.id))
      .innerJoin(procedures, eq(appointmentProcedures.procedureId, procedures.id))
      .where(and(
        eq(appointments.companyId, companyId),
        notDeleted(appointments.deletedAt),
        gte(appointments.startTime, start),
        lte(appointments.startTime, end),
      ))
      .groupBy(appointmentProcedures.procedureId, procedures.name)
      .orderBy(sql`count(*) DESC`)
      .limit(10);

    const totalWithProcedure = procedureStats.reduce((sum: number, p: any) => sum + Number(p.count || 0), 0);

    res.json({
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      topProcedures: procedureStats.map((p: any) => ({
        ...p,
        procedureName: p.procedureName || 'Sem nome',
        percentage: totalWithProcedure > 0 ? ((p.count / totalWithProcedure) * 100).toFixed(1) : '0',
      })),
      totalWithProcedure,
    });
  })
);

/**
 * GET /api/v1/analytics/peak-hours
 * Retorna análise de horários de pico
 */
router.get(
  '/peak-hours',
  authCheck,
  validate({ query: analyticsQuerySchema }),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { startDate, endDate } = req.query as any;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // SQL aggregation by hour and day-of-week (2 queries instead of full table load)
    const [hourRows, dayRows] = await Promise.all([
      db.execute(sql`
        SELECT extract(hour from start_time)::int AS hour, count(*)::int AS count
        FROM appointments
        WHERE company_id = ${companyId} AND deleted_at IS NULL
          AND start_time >= ${start} AND start_time <= ${end}
        GROUP BY extract(hour from start_time)
        ORDER BY hour
      `),
      db.execute(sql`
        SELECT extract(dow from start_time)::int AS day_of_week, count(*)::int AS count
        FROM appointments
        WHERE company_id = ${companyId} AND deleted_at IS NULL
          AND start_time >= ${start} AND start_time <= ${end}
        GROUP BY extract(dow from start_time)
        ORDER BY day_of_week
      `),
    ]);

    const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const hours = (hourRows.rows || hourRows) as any[];
    const days = (dayRows.rows || dayRows) as any[];

    res.json({
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      peakHours: hours.map((r: any) => ({
        hour: `${r.hour.toString().padStart(2, '0')}:00`,
        count: r.count,
      })),
      peakDays: days.map((r: any) => ({
        day: daysOfWeek[r.day_of_week],
        dayOfWeek: r.day_of_week,
        count: r.count,
      })),
    });
  })
);

/**
 * GET /api/v1/analytics/trends
 * Retorna tendências ao longo do tempo (diário/semanal/mensal)
 */
router.get(
  '/trends',
  authCheck,
  validate({
    query: analyticsQuerySchema.extend({
      groupBy: z.enum(['day', 'week', 'month']).optional().default('day'),
    })
  }),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { startDate, endDate, groupBy } = req.query as any;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // SQL aggregation with date_trunc instead of loading all appointments into memory
    const truncFn = groupBy === 'week' ? 'week' : groupBy === 'month' ? 'month' : 'day';
    const trendsResult = await db.execute(sql`
      SELECT
        to_char(date_trunc(${truncFn}, start_time), ${truncFn === 'week' ? sql`'IYYY-"W"IW'` : truncFn === 'month' ? sql`'YYYY-MM'` : sql`'YYYY-MM-DD'`}) AS period,
        count(*)::int AS total,
        count(*) filter (where status = 'completed')::int AS completed,
        count(*) filter (where status = 'cancelled')::int AS cancelled,
        count(*) filter (where status = 'no_show')::int AS "noShow"
      FROM appointments
      WHERE company_id = ${companyId} AND deleted_at IS NULL
        AND start_time >= ${start} AND start_time <= ${end}
      GROUP BY date_trunc(${truncFn}, start_time)
      ORDER BY date_trunc(${truncFn}, start_time)
    `);

    const trends = (trendsResult.rows || trendsResult) as any[];

    res.json({
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      groupBy,
      trends,
    });
  })
);

/**
 * GET /api/v1/analytics/churn-risk
 * Retorna pacientes em risco de abandono, ordenados por score decrescente.
 * Usa tenant isolation via tenantAwareAuth.
 */
router.get(
  '/churn-risk',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const { analyzeChurnRisk } = await import('../services/ai-agent/churn-analysis');
    const user = req.user!;
    const results = await analyzeChurnRisk(user.companyId);
    res.json(results);
  }),
);

/**
 * GET /api/v1/analytics/delinquency-risk
 * Retorna pacientes com risco de inadimplência, ordenados por score.
 */
router.get(
  '/delinquency-risk',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const { predictDelinquency } = await import('../services/ai-agent/delinquency-prediction');
    const user = req.user!;
    const results = await predictDelinquency(user.companyId);
    res.json(results);
  }),
);

/**
 * GET /api/v1/analytics/schedule-gaps
 * Retorna lacunas na agenda dos profissionais com sugestões de pacientes para preenchimento.
 * Query params: startDate (YYYY-MM-DD), endDate (YYYY-MM-DD)
 */
router.get(
  '/schedule-gaps',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const { findScheduleGaps } = await import('../services/ai-agent/schedule-optimizer');
    const user = req.user!;
    const { startDate, endDate } = req.query as Record<string, string | undefined>;
    const start = startDate ?? new Date().toISOString().split('T')[0];
    const end   = endDate   ?? new Date(Date.now() + 7 * 86_400_000).toISOString().split('T')[0];
    const results = await findScheduleGaps(user.companyId, start, end);
    res.json(results);
  }),
);

/**
 * GET /api/v1/analytics/executive-report
 * Gera relatório executivo mensal com KPIs financeiros e operacionais.
 * Query params: month (1-12), year (4 digits)
 */
router.get(
  '/executive-report',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const { generateExecutiveReport } = await import('../services/executive-report.service');
    const user = req.user!;
    const { month, year } = req.query as Record<string, string | undefined>;
    const report = await generateExecutiveReport(
      user.companyId,
      month ? parseInt(month, 10) : undefined,
      year  ? parseInt(year,  10) : undefined,
    );
    res.json(report);
  }),
);

/**
 * GET /api/v1/analytics/lgpd-dashboard
 * Painel LGPD: resumo de consentimentos, validade, retenção e anonimizações.
 * Retorna métricas de conformidade com a LGPD para a empresa autenticada.
 */
router.get(
  '/lgpd-dashboard',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const [consentStats, retentionStats, anonymizedStats] = await Promise.all([
      db.$client.query(
        `SELECT
           COUNT(*)                                                          AS total_patients,
           COUNT(CASE WHEN data_processing_consent = true  THEN 1 END)      AS with_consent,
           COUNT(CASE WHEN data_processing_consent = false
                       OR  data_processing_consent IS NULL THEN 1 END)      AS without_consent,
           COUNT(CASE WHEN consent_date < NOW() - INTERVAL '2 years' THEN 1 END) AS expired_consent
         FROM patients
         WHERE company_id = $1
           AND active      = true
           AND deleted_at IS NULL`,
        [companyId]
      ),
      db.$client.query(
        `SELECT COUNT(*) AS due_for_review
         FROM patients
         WHERE company_id = $1
           AND active = true
           AND deleted_at IS NULL
           AND data_retention_period IS NOT NULL
           AND created_at + (data_retention_period || ' days')::interval < NOW()`,
        [companyId]
      ),
      db.$client.query(
        `SELECT COUNT(*) AS anonymized
         FROM patients
         WHERE company_id = $1
           AND data_anonymization_date IS NOT NULL`,
        [companyId]
      ),
    ]);

    const row = consentStats.rows[0];

    res.json({
      totalPatients: parseInt(row.total_patients, 10),
      withConsent: parseInt(row.with_consent, 10),
      withoutConsent: parseInt(row.without_consent, 10),
      expiredConsent: parseInt(row.expired_consent, 10),
      consentRate:
        parseInt(row.total_patients, 10) > 0
          ? Math.round(
              (parseInt(row.with_consent, 10) / parseInt(row.total_patients, 10)) * 10000
            ) / 100
          : 0,
      dueForRetentionReview: parseInt(retentionStats.rows[0].due_for_review, 10),
      anonymizedPatients: parseInt(anonymizedStats.rows[0].anonymized, 10),
      generatedAt: new Date().toISOString(),
    });
  })
);

/**
 * GET /api/v1/analytics/nps
 * NPS dashboard: average score, promoter/passive/detractor distribution,
 * calculated NPS value, 12-month trend, and the last 10 verbatim responses.
 *
 * Query params:
 *   days — lookback window in days; accepted values: 30 | 90 | 365 (default 30)
 */
router.get(
  '/nps',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const rawDays = parseInt((req.query.days as string) || '30', 10);
    const days = [30, 90, 365].includes(rawDays) ? rawDays : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // --- Summary: average + promoter/passive/detractor counts ---
    const [summary] = await db
      .select({
        totalResponses: sql<number>`count(*)::int`,
        avgScore: sql<number>`round(avg(${npsSurveys.score})::numeric, 2)`,
        promoters: sql<number>`count(*) filter (where ${npsSurveys.score} >= 9)::int`,
        passives: sql<number>`count(*) filter (where ${npsSurveys.score} between 7 and 8)::int`,
        detractors: sql<number>`count(*) filter (where ${npsSurveys.score} <= 6)::int`,
      })
      .from(npsSurveys)
      .where(
        and(
          eq(npsSurveys.companyId, companyId),
          sql`${npsSurveys.status} = 'responded'`,
          sql`${npsSurveys.score} is not null`,
          gte(npsSurveys.respondedAt, since),
        )
      );

    const total = summary?.totalResponses ?? 0;
    const promoters = summary?.promoters ?? 0;
    const passives = summary?.passives ?? 0;
    const detractors = summary?.detractors ?? 0;

    const promoterPct = total > 0 ? Math.round((promoters / total) * 100) : 0;
    const passivePct  = total > 0 ? Math.round((passives  / total) * 100) : 0;
    const detractorPct = total > 0 ? Math.round((detractors / total) * 100) : 0;
    const npsScore = promoterPct - detractorPct;

    // --- Monthly trend for the last 12 months ---
    const twelveMonthsAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const trendResult = await db.execute(sql`
      SELECT
        to_char(date_trunc('month', responded_at), 'YYYY-MM') AS month,
        count(*)::int                                          AS total,
        count(*) filter (where score >= 9)::int               AS promoters,
        count(*) filter (where score between 7 and 8)::int    AS passives,
        count(*) filter (where score <= 6)::int               AS detractors
      FROM nps_surveys
      WHERE company_id = ${companyId}
        AND status      = 'responded'
        AND score IS NOT NULL
        AND responded_at >= ${twelveMonthsAgo}
      GROUP BY date_trunc('month', responded_at)
      ORDER BY date_trunc('month', responded_at)
    `);

    const trend = (trendResult.rows as any[]).map((r) => {
      const t = r.total as number;
      const pp = t > 0 ? Math.round(((r.promoters as number) / t) * 100) : 0;
      const dp = t > 0 ? Math.round(((r.detractors as number) / t) * 100) : 0;
      return {
        month: r.month,
        totalResponses: t,
        promoters: r.promoters,
        passives: r.passives,
        detractors: r.detractors,
        npsScore: pp - dp,
      };
    });

    // --- Recent feedback: last 10 verbatim responses ---
    const recentFeedback = await db
      .select({
        id: npsSurveys.id,
        score: npsSurveys.score,
        feedback: npsSurveys.feedback,
        respondedAt: npsSurveys.respondedAt,
        channel: npsSurveys.channel,
      })
      .from(npsSurveys)
      .where(
        and(
          eq(npsSurveys.companyId, companyId),
          sql`${npsSurveys.status} = 'responded'`,
          sql`${npsSurveys.score} is not null`,
          sql`${npsSurveys.feedback} is not null`,
        )
      )
      .orderBy(desc(npsSurveys.respondedAt))
      .limit(10);

    res.json({
      period: { days, since: since.toISOString() },
      summary: {
        totalResponses: total,
        avgScore: summary?.avgScore ?? null,
        npsScore,
        promoters:  { count: promoters,  percentage: promoterPct },
        passives:   { count: passives,   percentage: passivePct  },
        detractors: { count: detractors, percentage: detractorPct },
      },
      trend,
      recentFeedback,
    });
  })
);

/**
 * GET /api/v1/analytics/cohort
 * Patient retention cohort analysis.
 * For each monthly cohort (first appointment month) tracks how many patients
 * returned at months 1, 2, 3, within 6 months, and within 12 months.
 *
 * Query params:
 *   months — lookback window in months (default 12, max 60)
 */
router.get(
  '/cohort',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    if (!companyId) return res.status(403).json({ error: 'User not associated with any company' });

    const rawMonths = parseInt((req.query.months as string) || '12', 10);
    // Clamp to a sensible range so we don't accidentally interpolate an arbitrary number
    const months = Math.min(Math.max(isNaN(rawMonths) ? 12 : rawMonths, 1), 60);

    const result = await db.$client.query(
      `WITH patient_first_visit AS (
        SELECT
          patient_id,
          DATE_TRUNC('month', MIN(start_time)) AS cohort_month
        FROM appointments
        WHERE company_id = $1
          AND status IN ('completed', 'confirmed', 'arrived', 'in_progress')
          AND start_time >= NOW() - ($2 || ' months')::interval
        GROUP BY patient_id
      ),
      patient_visits AS (
        SELECT
          a.patient_id,
          pf.cohort_month,
          DATE_TRUNC('month', a.start_time) AS visit_month
        FROM appointments a
        JOIN patient_first_visit pf ON a.patient_id = pf.patient_id
        WHERE a.company_id = $1
          AND a.status IN ('completed', 'confirmed', 'arrived', 'in_progress')
      ),
      cohort_data AS (
        SELECT
          pf.cohort_month,
          COUNT(DISTINCT pf.patient_id) AS cohort_size,
          COUNT(DISTINCT CASE WHEN pv.visit_month = pf.cohort_month + INTERVAL '1 month'  THEN pv.patient_id END) AS returned_month_1,
          COUNT(DISTINCT CASE WHEN pv.visit_month = pf.cohort_month + INTERVAL '2 months' THEN pv.patient_id END) AS returned_month_2,
          COUNT(DISTINCT CASE WHEN pv.visit_month = pf.cohort_month + INTERVAL '3 months' THEN pv.patient_id END) AS returned_month_3,
          COUNT(DISTINCT CASE WHEN pv.visit_month BETWEEN pf.cohort_month + INTERVAL '1 month'  AND pf.cohort_month + INTERVAL '6 months'  THEN pv.patient_id END) AS returned_within_6m,
          COUNT(DISTINCT CASE WHEN pv.visit_month BETWEEN pf.cohort_month + INTERVAL '1 month'  AND pf.cohort_month + INTERVAL '12 months' THEN pv.patient_id END) AS returned_within_12m
        FROM patient_first_visit pf
        LEFT JOIN patient_visits pv ON pf.patient_id = pv.patient_id
        GROUP BY pf.cohort_month
        ORDER BY pf.cohort_month DESC
      )
      SELECT
        TO_CHAR(cohort_month, 'YYYY-MM')                                                          AS cohort_month,
        cohort_size,
        returned_month_1,
        returned_month_2,
        returned_month_3,
        returned_within_6m,
        returned_within_12m,
        ROUND(returned_within_6m::numeric  / NULLIF(cohort_size, 0) * 100, 1) AS retention_6m_pct,
        ROUND(returned_within_12m::numeric / NULLIF(cohort_size, 0) * 100, 1) AS retention_12m_pct
      FROM cohort_data`,
      [companyId, months]
    );

    res.json({ months, data: result.rows });
  })
);

export default router;
