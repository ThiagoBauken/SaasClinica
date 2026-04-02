/**
 * Email Marketing + Mass Campaign Routes
 * Gerencia campanhas de marketing, segmentação de pacientes e disparos em massa
 */

import { Router } from 'express';
import { authCheck, asyncHandler } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

function getCompanyId(req: any): number {
  return (req.user as any)?.companyId;
}

// ============================================================
// Schemas de Validação
// ============================================================

const segmentFilterSchema = z
  .object({
    tags: z.array(z.string()).optional(),
    lastVisitBefore: z.string().optional().nullable(),
    lastVisitAfter: z.string().optional().nullable(),
    treatmentType: z.string().optional().nullable(),
    hasWhatsappConsent: z.boolean().optional(),
    hasEmailConsent: z.boolean().optional(),
    ageMin: z.number().int().positive().optional().nullable(),
    ageMax: z.number().int().positive().optional().nullable(),
    city: z.string().optional().nullable(),
  })
  .optional()
  .default({});

const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(255),
  type: z.enum(['whatsapp', 'email', 'both']),
  messageTemplate: z.string().min(1, 'messageTemplate is required'),
  subject: z.string().optional().nullable(),
  segmentFilter: segmentFilterSchema,
  scheduledAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const campaignUpdateSchema = campaignSchema.partial();

// ============================================================
// Helper: Build WHERE clause from segmentFilter
// ============================================================

/**
 * Builds parameterized WHERE conditions for campaign segmentation.
 * All user input is passed via $N bindings — NO string interpolation.
 */
function buildSegmentConditions(
  filter: Record<string, any>,
  companyId: number
): { whereClauses: string[]; params: any[] } {
  // Start param index at 1; companyId is always $1
  const params: any[] = [companyId];
  const whereClauses: string[] = [`p.company_id = $1`, `p.is_active = true`];

  if (!filter || Object.keys(filter).length === 0) {
    return { whereClauses, params };
  }

  if (filter.lastVisitBefore) {
    params.push(filter.lastVisitBefore);
    whereClauses.push(
      `(
         SELECT MAX(a.start_time) FROM appointments a
         WHERE a.patient_id = p.id AND a.status = 'completed'
       ) < $${params.length}::date`
    );
  }

  if (filter.lastVisitAfter) {
    params.push(filter.lastVisitAfter);
    whereClauses.push(
      `(
         SELECT MAX(a.start_time) FROM appointments a
         WHERE a.patient_id = p.id AND a.status = 'completed'
       ) > $${params.length}::date`
    );
  }

  if (filter.treatmentType) {
    params.push(filter.treatmentType);
    whereClauses.push(
      `EXISTS (
         SELECT 1 FROM appointments a
         JOIN appointment_procedures ap ON ap.appointment_id = a.id
         JOIN procedures pr ON ap.procedure_id = pr.id
         WHERE a.patient_id = p.id AND pr.category = $${params.length}
       )`
    );
  }

  if (filter.hasWhatsappConsent === true) {
    whereClauses.push(`(p.whatsapp IS NOT NULL AND p.whatsapp_consent = true)`);
  } else if (filter.hasWhatsappConsent === false) {
    whereClauses.push(`(p.whatsapp_consent = false OR p.whatsapp IS NULL)`);
  }

  if (filter.hasEmailConsent === true) {
    whereClauses.push(`(p.email IS NOT NULL AND p.email_consent = true)`);
  } else if (filter.hasEmailConsent === false) {
    whereClauses.push(`(p.email_consent = false OR p.email IS NULL)`);
  }

  if (filter.ageMin != null) {
    params.push(parseInt(filter.ageMin, 10));
    whereClauses.push(
      `DATE_PART('year', AGE(NOW(), p.birth_date)) >= $${params.length}`
    );
  }

  if (filter.ageMax != null) {
    params.push(parseInt(filter.ageMax, 10));
    whereClauses.push(
      `DATE_PART('year', AGE(NOW(), p.birth_date)) <= $${params.length}`
    );
  }

  if (filter.city) {
    params.push(filter.city);
    whereClauses.push(`LOWER(p.city) = LOWER($${params.length})`);
  }

  if (filter.tags && Array.isArray(filter.tags) && filter.tags.length > 0) {
    params.push(filter.tags);
    whereClauses.push(
      `EXISTS (
         SELECT 1 FROM patient_tags pt
         WHERE pt.patient_id = p.id AND pt.tag = ANY($${params.length}::text[])
       )`
    );
  }

  return { whereClauses, params };
}

// ============================================================
// CAMPAIGNS CRUD
// ============================================================

/**
 * GET /api/v1/campaigns
 * Lista todas as campanhas da empresa
 */
router.get(
  '/',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 100);
    const offset = parseInt((req.query.offset as string) || '0', 10);
    const status = req.query.status as string | undefined;

    const result = await db.execute(sql`
      SELECT
        c.id,
        c.name,
        c.type,
        c.status,
        c.subject,
        c.scheduled_at,
        c.sent_at,
        c.notes,
        c.segment_filter,
        c.created_at,
        c.updated_at,
        COUNT(cr.id)                                             AS total_recipients,
        COUNT(cr.id) FILTER (WHERE cr.status = 'sent')          AS sent_count,
        COUNT(cr.id) FILTER (WHERE cr.status = 'delivered')     AS delivered_count,
        COUNT(cr.id) FILTER (WHERE cr.status = 'opened')        AS opened_count,
        COUNT(cr.id) FILTER (WHERE cr.status = 'clicked')       AS clicked_count,
        COUNT(cr.id) FILTER (WHERE cr.status = 'failed')        AS failed_count
      FROM campaigns c
      LEFT JOIN campaign_recipients cr ON cr.campaign_id = c.id
      WHERE c.company_id = ${companyId}
        AND (${status ?? null} IS NULL OR c.status = ${status ?? null})
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countResult = await db.execute(sql`
      SELECT COUNT(*) AS total FROM campaigns
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
 * POST /api/v1/campaigns
 * Cria nova campanha
 */
router.post(
  '/',
  authCheck,
  validate({ body: campaignSchema }),
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const { name, type, messageTemplate, subject, segmentFilter, scheduledAt, notes } = req.body;

    const result = await db.execute(sql`
      INSERT INTO campaigns (
        company_id, name, type, message_template, subject,
        segment_filter, scheduled_at, notes, status,
        created_at, updated_at
      )
      VALUES (
        ${companyId}, ${name}, ${type}, ${messageTemplate}, ${subject ?? null},
        ${JSON.stringify(segmentFilter ?? {})}::jsonb, ${scheduledAt ?? null},
        ${notes ?? null}, 'draft',
        NOW(), NOW()
      )
      RETURNING *
    `);

    res.status(201).json({ data: result.rows[0] });
  })
);

/**
 * GET /api/v1/campaigns/:id
 * Detalhe da campanha com destinatários
 */
router.get(
  '/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const campaignId = parseInt(req.params.id, 10);

    if (isNaN(campaignId)) {
      return res.status(400).json({ error: 'Invalid campaign ID' });
    }

    const campaignResult = await db.execute(sql`
      SELECT * FROM campaigns
      WHERE id = ${campaignId} AND company_id = ${companyId}
    `);

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const recipientsResult = await db.execute(sql`
      SELECT
        cr.id,
        cr.status,
        cr.sent_at,
        cr.delivered_at,
        cr.opened_at,
        cr.clicked_at,
        cr.error_message,
        p.id         AS patient_id,
        p.full_name  AS patient_name,
        p.phone      AS patient_phone,
        p.whatsapp   AS patient_whatsapp,
        p.email      AS patient_email
      FROM campaign_recipients cr
      JOIN patients p ON cr.patient_id = p.id
      WHERE cr.campaign_id = ${campaignId}
      ORDER BY cr.created_at DESC
      LIMIT 200
    `);

    res.json({
      data: campaignResult.rows[0],
      recipients: recipientsResult.rows,
    });
  })
);

/**
 * PUT /api/v1/campaigns/:id
 * Atualiza campanha (somente drafts podem ser totalmente editadas)
 */
router.put(
  '/:id',
  authCheck,
  validate({ body: campaignUpdateSchema }),
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const campaignId = parseInt(req.params.id, 10);

    if (isNaN(campaignId)) {
      return res.status(400).json({ error: 'Invalid campaign ID' });
    }

    const existing = await db.execute(sql`
      SELECT id, status FROM campaigns
      WHERE id = ${campaignId} AND company_id = ${companyId}
    `);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const currentStatus = (existing.rows[0] as any).status;
    if (currentStatus === 'sending' || currentStatus === 'completed') {
      return res.status(409).json({
        error: `Cannot update a campaign with status '${currentStatus}'`,
      });
    }

    const { name, type, messageTemplate, subject, segmentFilter, scheduledAt, notes } = req.body;

    const result = await db.execute(sql`
      UPDATE campaigns
      SET
        name             = COALESCE(${name ?? null}, name),
        type             = COALESCE(${type ?? null}, type),
        message_template = COALESCE(${messageTemplate ?? null}, message_template),
        subject          = COALESCE(${subject ?? null}, subject),
        segment_filter   = COALESCE(${segmentFilter != null ? JSON.stringify(segmentFilter) + '::jsonb' : null}, segment_filter),
        scheduled_at     = COALESCE(${scheduledAt ?? null}, scheduled_at),
        notes            = COALESCE(${notes ?? null}, notes),
        updated_at       = NOW()
      WHERE id = ${campaignId} AND company_id = ${companyId}
      RETURNING *
    `);

    res.json({ data: result.rows[0] });
  })
);

/**
 * DELETE /api/v1/campaigns/:id
 * Remove campanha em rascunho
 */
router.delete(
  '/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const campaignId = parseInt(req.params.id, 10);

    if (isNaN(campaignId)) {
      return res.status(400).json({ error: 'Invalid campaign ID' });
    }

    const existing = await db.execute(sql`
      SELECT id, status FROM campaigns
      WHERE id = ${campaignId} AND company_id = ${companyId}
    `);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const currentStatus = (existing.rows[0] as any).status;
    if (currentStatus !== 'draft') {
      return res.status(409).json({
        error: `Only draft campaigns can be deleted. Current status: '${currentStatus}'`,
      });
    }

    // Delete recipients first (FK constraint)
    await db.execute(sql`
      DELETE FROM campaign_recipients WHERE campaign_id = ${campaignId}
    `);

    await db.execute(sql`
      DELETE FROM campaigns WHERE id = ${campaignId} AND company_id = ${companyId}
    `);

    res.json({ success: true, message: 'Campaign deleted' });
  })
);

// ============================================================
// CAMPAIGN SEND
// ============================================================

/**
 * POST /api/v1/campaigns/:id/send
 * Inicia o envio da campanha:
 * 1. Parse segmentFilter e monta WHERE clause
 * 2. Query pacientes correspondentes
 * 3. Insere campaign_recipients
 * 4. Atualiza status para 'sending'
 */
router.post(
  '/:id/send',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const campaignId = parseInt(req.params.id, 10);

    if (isNaN(campaignId)) {
      return res.status(400).json({ error: 'Invalid campaign ID' });
    }

    // Fetch campaign
    const campaignResult = await db.execute(sql`
      SELECT * FROM campaigns
      WHERE id = ${campaignId} AND company_id = ${companyId}
    `);

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const campaign = campaignResult.rows[0] as any;

    if (campaign.status === 'sending' || campaign.status === 'completed') {
      return res.status(409).json({
        error: `Campaign is already in status '${campaign.status}'`,
      });
    }

    // Parse segment filter
    let segmentFilter: Record<string, any> = {};
    try {
      segmentFilter =
        typeof campaign.segment_filter === 'string'
          ? JSON.parse(campaign.segment_filter)
          : campaign.segment_filter ?? {};
    } catch {
      segmentFilter = {};
    }

    // Build WHERE conditions (parameterized — safe from SQL injection)
    const { whereClauses, params } = buildSegmentConditions(segmentFilter, companyId);
    const whereSQL = whereClauses.join(' AND ');

    // Query matching patients using parameterized query
    const patientsResult = await db.$client.query(
      `SELECT p.id, p.full_name, p.phone, p.whatsapp, p.email
       FROM patients p
       WHERE ${whereSQL}
       ORDER BY p.id ASC`,
      params
    );

    const matchedPatients = patientsResult.rows as any[];
    const recipientCount = matchedPatients.length;

    if (recipientCount === 0) {
      return res.status(422).json({
        error: 'No patients match the segment filter',
        segmentFilter,
      });
    }

    // Remove any previously queued recipients (for re-send scenarios on paused campaigns)
    await db.execute(sql`
      DELETE FROM campaign_recipients
      WHERE campaign_id = ${campaignId} AND status = 'queued'
    `);

    // Bulk insert recipients in batches of 500
    const BATCH_SIZE = 500;
    let inserted = 0;

    for (let i = 0; i < matchedPatients.length; i += BATCH_SIZE) {
      const batch = matchedPatients.slice(i, i + BATCH_SIZE);

      // Build a VALUES list for the batch
      const valueParts = batch
        .map(
          (p: any) =>
            `(${campaignId}, ${p.id}, ${companyId}, 'queued', NOW(), NOW())`
        )
        .join(', ');

      await db.execute(
        sql.raw(`
          INSERT INTO campaign_recipients (campaign_id, patient_id, company_id, status, created_at, updated_at)
          VALUES ${valueParts}
          ON CONFLICT (campaign_id, patient_id) DO NOTHING
        `)
      );

      inserted += batch.length;
    }

    // Update campaign status to 'sending'
    await db.execute(sql`
      UPDATE campaigns
      SET status = 'sending', sent_at = NOW(), updated_at = NOW()
      WHERE id = ${campaignId} AND company_id = ${companyId}
    `);

    res.json({
      success: true,
      campaignId,
      recipientCount: inserted,
      message: `Campaign started. ${inserted} recipients queued for delivery.`,
    });
  })
);

// ============================================================
// CAMPAIGN STATS
// ============================================================

/**
 * GET /api/v1/campaigns/:id/stats
 * Estatísticas detalhadas de uma campanha
 */
router.get(
  '/:id/stats',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const campaignId = parseInt(req.params.id, 10);

    if (isNaN(campaignId)) {
      return res.status(400).json({ error: 'Invalid campaign ID' });
    }

    const campaignResult = await db.execute(sql`
      SELECT id, name, type, status, sent_at, created_at
      FROM campaigns
      WHERE id = ${campaignId} AND company_id = ${companyId}
    `);

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const statsResult = await db.execute(sql`
      SELECT
        COUNT(*)                                              AS total_recipients,
        COUNT(*) FILTER (WHERE status = 'queued')            AS queued,
        COUNT(*) FILTER (WHERE status = 'sent')              AS sent,
        COUNT(*) FILTER (WHERE status = 'delivered')         AS delivered,
        COUNT(*) FILTER (WHERE status = 'opened')            AS opened,
        COUNT(*) FILTER (WHERE status = 'clicked')           AS clicked,
        COUNT(*) FILTER (WHERE status = 'failed')            AS failed,
        COUNT(*) FILTER (WHERE status = 'unsubscribed')      AS unsubscribed,
        MIN(sent_at)                                          AS first_sent_at,
        MAX(sent_at)                                          AS last_sent_at
      FROM campaign_recipients
      WHERE campaign_id = ${campaignId}
    `);

    const stats = statsResult.rows[0] as any;
    const totalRecipients = parseInt(stats?.total_recipients || '0', 10);
    const sent = parseInt(stats?.sent || '0', 10);
    const delivered = parseInt(stats?.delivered || '0', 10);
    const opened = parseInt(stats?.opened || '0', 10);
    const clicked = parseInt(stats?.clicked || '0', 10);
    const failed = parseInt(stats?.failed || '0', 10);

    const deliveryRate = sent > 0 ? Math.round((delivered / sent) * 100) : 0;
    const openRate = delivered > 0 ? Math.round((opened / delivered) * 100) : 0;
    const clickRate = opened > 0 ? Math.round((clicked / opened) * 100) : 0;
    const failureRate = totalRecipients > 0 ? Math.round((failed / totalRecipients) * 100) : 0;

    // Status breakdown over time (hourly for last 48h)
    const timelineResult = await db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('hour', sent_at), 'YYYY-MM-DD"T"HH24:MI') AS hour,
        COUNT(*) FILTER (WHERE status IN ('sent', 'delivered', 'opened', 'clicked')) AS sent_count,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed_count
      FROM campaign_recipients
      WHERE campaign_id = ${campaignId}
        AND sent_at IS NOT NULL
        AND sent_at >= NOW() - INTERVAL '48 hours'
      GROUP BY hour
      ORDER BY hour ASC
    `);

    res.json({
      campaign: campaignResult.rows[0],
      stats: {
        totalRecipients,
        queued: parseInt(stats?.queued || '0', 10),
        sent,
        delivered,
        opened,
        clicked,
        failed,
        unsubscribed: parseInt(stats?.unsubscribed || '0', 10),
        deliveryRate,
        openRate,
        clickRate,
        failureRate,
        firstSentAt: stats?.first_sent_at || null,
        lastSentAt: stats?.last_sent_at || null,
      },
      timeline: timelineResult.rows,
    });
  })
);

export default router;
