/**
 * Review Management + NPS Routes
 * Gerencia solicitações de avaliação, pesquisas NPS e dashboard de reputação
 */

import { Router } from 'express';
import { authCheck, asyncHandler } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

function getCompanyId(req: any): number {
  return req.user!.companyId;
}

// ============================================================
// Schemas de Validação
// ============================================================

const reviewRequestSchema = z.object({
  patientId: z.number().int().positive('patientId must be a positive integer'),
  appointmentId: z.number().int().positive().optional().nullable(),
  channel: z.enum(['whatsapp', 'email', 'sms']).optional().default('whatsapp'),
  message: z.string().optional().nullable(),
});

const npsSendSchema = z.object({
  patientId: z.number().int().positive('patientId must be a positive integer'),
  channel: z.enum(['whatsapp', 'email']).optional().default('whatsapp'),
});

const npsRespondSchema = z.object({
  surveyId: z.number().int().positive('surveyId must be a positive integer'),
  score: z
    .number()
    .int()
    .min(0, 'NPS score must be between 0 and 10')
    .max(10, 'NPS score must be between 0 and 10'),
  feedback: z.string().optional().nullable(),
});

// ============================================================
// REVIEW REQUESTS
// ============================================================

/**
 * POST /api/v1/reviews/request
 * Envia solicitação de avaliação ao paciente
 */
router.post(
  '/request',
  authCheck,
  validate({ body: reviewRequestSchema }),
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const { patientId, appointmentId, channel, message } = req.body;

    // Verify patient belongs to company
    const patientCheck = await db.execute(sql`
      SELECT id, full_name, phone, whatsapp, email
      FROM patients
      WHERE id = ${patientId} AND company_id = ${companyId}
    `);

    if (patientCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Check if a recent review request was already sent (last 30 days)
    const recentCheck = await db.execute(sql`
      SELECT id FROM review_requests
      WHERE company_id = ${companyId}
        AND patient_id = ${patientId}
        AND created_at > NOW() - INTERVAL '30 days'
        AND status != 'cancelled'
      LIMIT 1
    `);

    if (recentCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'A review request was already sent to this patient in the last 30 days',
      });
    }

    const result = await db.execute(sql`
      INSERT INTO review_requests (
        company_id, patient_id, appointment_id, channel, message,
        status, created_at, updated_at
      )
      VALUES (
        ${companyId}, ${patientId}, ${appointmentId ?? null}, ${channel ?? 'whatsapp'},
        ${message ?? null}, 'sent', NOW(), NOW()
      )
      RETURNING *
    `);

    res.status(201).json({
      success: true,
      data: result.rows[0],
      patient: patientCheck.rows[0],
    });
  })
);

/**
 * GET /api/v1/reviews/requests
 * Lista solicitações de avaliação com estatísticas
 */
router.get(
  '/requests',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 100);
    const offset = parseInt((req.query.offset as string) || '0', 10);
    const status = req.query.status as string | undefined;

    const result = await db.execute(sql`
      SELECT
        rr.id,
        rr.channel,
        rr.status,
        rr.message,
        rr.clicked_at,
        rr.review_submitted_at,
        rr.rating,
        rr.review_text,
        rr.created_at,
        p.id         AS patient_id,
        p.full_name  AS patient_name,
        p.phone      AS patient_phone,
        p.whatsapp   AS patient_whatsapp,
        a.id         AS appointment_id,
        a.start_time AS appointment_date
      FROM review_requests rr
      JOIN patients p ON rr.patient_id = p.id
      LEFT JOIN appointments a ON rr.appointment_id = a.id
      WHERE rr.company_id = ${companyId}
        AND (${status ?? null} IS NULL OR rr.status = ${status ?? null})
      ORDER BY rr.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countResult = await db.execute(sql`
      SELECT COUNT(*) AS total
      FROM review_requests
      WHERE company_id = ${companyId}
        AND (${status ?? null} IS NULL OR status = ${status ?? null})
    `);

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0]?.total as string || '0', 10),
    });
  })
);

/**
 * GET /api/v1/reviews/stats
 * Estatísticas de avaliações (total enviadas, clicadas, taxa de conversão)
 */
router.get(
  '/stats',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);

    const result = await db.execute(sql`
      SELECT
        COUNT(*)                                                AS total_sent,
        COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)         AS total_clicked,
        COUNT(*) FILTER (WHERE review_submitted_at IS NOT NULL) AS total_submitted,
        COUNT(*) FILTER (WHERE status = 'cancelled')           AS total_cancelled,
        ROUND(AVG(rating) FILTER (WHERE rating IS NOT NULL), 2) AS average_rating,
        COUNT(*) FILTER (WHERE rating >= 4)                    AS positive_reviews,
        COUNT(*) FILTER (WHERE rating <= 2)                    AS negative_reviews
      FROM review_requests
      WHERE company_id = ${companyId}
    `);

    const stats = result.rows[0] as any;
    const totalSent = parseInt(stats?.total_sent || '0', 10);
    const totalClicked = parseInt(stats?.total_clicked || '0', 10);
    const totalSubmitted = parseInt(stats?.total_submitted || '0', 10);

    const clickRate = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0;
    const conversionRate = totalSent > 0 ? Math.round((totalSubmitted / totalSent) * 100) : 0;

    // Reviews by rating distribution
    const ratingDistribution = await db.execute(sql`
      SELECT rating, COUNT(*) AS count
      FROM review_requests
      WHERE company_id = ${companyId} AND rating IS NOT NULL
      GROUP BY rating
      ORDER BY rating DESC
    `);

    res.json({
      data: {
        totalSent,
        totalClicked,
        totalSubmitted,
        totalCancelled: parseInt(stats?.total_cancelled || '0', 10),
        averageRating: parseFloat(stats?.average_rating || '0'),
        positiveReviews: parseInt(stats?.positive_reviews || '0', 10),
        negativeReviews: parseInt(stats?.negative_reviews || '0', 10),
        clickRate,
        conversionRate,
        ratingDistribution: ratingDistribution.rows,
      },
    });
  })
);

// ============================================================
// NPS
// ============================================================

/**
 * POST /api/v1/reviews/nps/send
 * Envia pesquisa NPS ao paciente
 */
router.post(
  '/nps/send',
  authCheck,
  validate({ body: npsSendSchema }),
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const { patientId, channel } = req.body;

    // Verify patient belongs to company
    const patientCheck = await db.execute(sql`
      SELECT id, full_name, phone, whatsapp, email
      FROM patients
      WHERE id = ${patientId} AND company_id = ${companyId}
    `);

    if (patientCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Check for recent NPS survey (last 90 days)
    const recentCheck = await db.execute(sql`
      SELECT id FROM nps_surveys
      WHERE company_id = ${companyId}
        AND patient_id = ${patientId}
        AND sent_at > NOW() - INTERVAL '90 days'
      LIMIT 1
    `);

    if (recentCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'An NPS survey was already sent to this patient in the last 90 days',
      });
    }

    const result = await db.execute(sql`
      INSERT INTO nps_surveys (company_id, patient_id, channel, status, sent_at, created_at, updated_at)
      VALUES (${companyId}, ${patientId}, ${channel ?? 'whatsapp'}, 'sent', NOW(), NOW(), NOW())
      RETURNING *
    `);

    res.status(201).json({
      success: true,
      data: result.rows[0],
      patient: patientCheck.rows[0],
    });
  })
);

/**
 * POST /api/v1/reviews/nps/respond
 * Registra resposta NPS (também calcula categoria automaticamente)
 */
router.post(
  '/nps/respond',
  authCheck,
  validate({ body: npsRespondSchema }),
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const { surveyId, score, feedback } = req.body;

    // Determine NPS category
    let category: 'promoter' | 'passive' | 'detractor';
    if (score >= 9) {
      category = 'promoter';
    } else if (score >= 7) {
      category = 'passive';
    } else {
      category = 'detractor';
    }

    // Verify survey belongs to company and is pending
    const surveyCheck = await db.execute(sql`
      SELECT id, patient_id FROM nps_surveys
      WHERE id = ${surveyId} AND company_id = ${companyId}
    `);

    if (surveyCheck.rows.length === 0) {
      return res.status(404).json({ error: 'NPS survey not found' });
    }

    const result = await db.execute(sql`
      UPDATE nps_surveys
      SET
        score       = ${score},
        feedback    = ${feedback ?? null},
        category    = ${category},
        status      = 'responded',
        responded_at = NOW(),
        updated_at  = NOW()
      WHERE id = ${surveyId} AND company_id = ${companyId}
      RETURNING *
    `);

    res.json({
      success: true,
      data: result.rows[0],
      category,
    });
  })
);

/**
 * GET /api/v1/reviews/nps/dashboard
 * Dashboard NPS: score atual, promotores/passivos/detratores, histórico mensal
 */
router.get(
  '/nps/dashboard',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const months = Math.min(parseInt((req.query.months as string) || '12', 10), 24);

    // Overall NPS counts
    const overallResult = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE category = 'promoter')   AS promoters,
        COUNT(*) FILTER (WHERE category = 'passive')    AS passives,
        COUNT(*) FILTER (WHERE category = 'detractor')  AS detractors,
        COUNT(*) FILTER (WHERE status = 'responded')    AS total_responses,
        COUNT(*)                                         AS total_sent
      FROM nps_surveys
      WHERE company_id = ${companyId}
    `);

    const overall = overallResult.rows[0] as any;
    const promoters = parseInt(overall?.promoters || '0', 10);
    const passives = parseInt(overall?.passives || '0', 10);
    const detractors = parseInt(overall?.detractors || '0', 10);
    const totalResponses = parseInt(overall?.total_responses || '0', 10);
    const totalSent = parseInt(overall?.total_sent || '0', 10);

    // NPS score = % promoters - % detractors (from responded)
    let npsScore = 0;
    if (totalResponses > 0) {
      npsScore = Math.round(((promoters - detractors) / totalResponses) * 100);
    }

    const responseRate = totalSent > 0 ? Math.round((totalResponses / totalSent) * 100) : 0;

    // Monthly history
    const historyResult = await db.execute(sql`
      SELECT
        TO_CHAR(responded_at, 'YYYY-MM')                         AS month,
        COUNT(*) FILTER (WHERE category = 'promoter')            AS promoters,
        COUNT(*) FILTER (WHERE category = 'passive')             AS passives,
        COUNT(*) FILTER (WHERE category = 'detractor')           AS detractors,
        COUNT(*)                                                  AS total,
        ROUND(
          (
            COUNT(*) FILTER (WHERE category = 'promoter')::numeric
            - COUNT(*) FILTER (WHERE category = 'detractor')::numeric
          ) / NULLIF(COUNT(*), 0) * 100
        )                                                         AS nps_score
      FROM nps_surveys
      WHERE company_id = ${companyId}
        AND status = 'responded'
        AND responded_at >= NOW() - (${months} || ' months')::interval
      GROUP BY month
      ORDER BY month ASC
    `);

    // Recent feedback from promoters and detractors
    const recentFeedback = await db.execute(sql`
      SELECT
        ns.score,
        ns.category,
        ns.feedback,
        ns.responded_at,
        p.full_name AS patient_name
      FROM nps_surveys ns
      JOIN patients p ON ns.patient_id = p.id
      WHERE ns.company_id = ${companyId}
        AND ns.status = 'responded'
        AND ns.feedback IS NOT NULL
        AND ns.feedback != ''
      ORDER BY ns.responded_at DESC
      LIMIT 10
    `);

    res.json({
      data: {
        npsScore,
        promoters,
        passives,
        detractors,
        totalResponses,
        totalSent,
        responseRate,
        monthlyHistory: historyResult.rows,
        recentFeedback: recentFeedback.rows,
      },
    });
  })
);

export default router;
