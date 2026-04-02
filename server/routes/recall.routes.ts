/**
 * Recall System Routes
 * Gerencia regras de recall, fila de recall, lista de espera e auto-fill de cancelamentos
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

const recallRuleSchema = z.object({
  treatmentType: z.string().min(1, 'treatmentType is required'),
  intervalDays: z.number().int().positive('intervalDays must be a positive integer'),
  messageTemplate: z.string().min(1, 'messageTemplate is required'),
  sendVia: z.enum(['whatsapp', 'email', 'sms', 'both']),
  isActive: z.boolean().optional().default(true),
});

const recallRuleUpdateSchema = recallRuleSchema.partial();

const waitlistEntrySchema = z.object({
  patientId: z.number().int().positive('patientId must be a positive integer'),
  professionalId: z.number().int().positive().optional().nullable(),
  preferredDate: z.string().optional().nullable(),
  preferredPeriod: z.enum(['morning', 'afternoon', 'evening', 'any']).optional().default('any'),
  procedureId: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ============================================================
// RECALL RULES
// ============================================================

/**
 * GET /api/v1/recall/rules
 * Lista regras de recall da empresa
 */
router.get(
  '/rules',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);

    const result = await db.execute(sql`
      SELECT id, treatment_type, interval_days, message_template, send_via, is_active,
             created_at, updated_at
      FROM recall_rules
      WHERE company_id = ${companyId}
      ORDER BY treatment_type ASC
    `);

    res.json({ data: result.rows });
  })
);

/**
 * POST /api/v1/recall/rules
 * Cria nova regra de recall
 */
router.post(
  '/rules',
  authCheck,
  validate({ body: recallRuleSchema }),
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const { treatmentType, intervalDays, messageTemplate, sendVia, isActive } = req.body;

    const result = await db.execute(sql`
      INSERT INTO recall_rules (company_id, treatment_type, interval_days, message_template, send_via, is_active, created_at, updated_at)
      VALUES (${companyId}, ${treatmentType}, ${intervalDays}, ${messageTemplate}, ${sendVia}, ${isActive ?? true}, NOW(), NOW())
      RETURNING *
    `);

    res.status(201).json({ data: result.rows[0] });
  })
);

/**
 * PUT /api/v1/recall/rules/:id
 * Atualiza regra de recall
 */
router.put(
  '/rules/:id',
  authCheck,
  validate({ body: recallRuleUpdateSchema }),
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const ruleId = parseInt(req.params.id, 10);

    if (isNaN(ruleId)) {
      return res.status(400).json({ error: 'Invalid rule ID' });
    }

    // Verify ownership
    const existing = await db.execute(sql`
      SELECT id FROM recall_rules WHERE id = ${ruleId} AND company_id = ${companyId}
    `);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Recall rule not found' });
    }

    const { treatmentType, intervalDays, messageTemplate, sendVia, isActive } = req.body;

    const result = await db.execute(sql`
      UPDATE recall_rules
      SET
        treatment_type    = COALESCE(${treatmentType ?? null}, treatment_type),
        interval_days     = COALESCE(${intervalDays ?? null}, interval_days),
        message_template  = COALESCE(${messageTemplate ?? null}, message_template),
        send_via          = COALESCE(${sendVia ?? null}, send_via),
        is_active         = COALESCE(${isActive ?? null}, is_active),
        updated_at        = NOW()
      WHERE id = ${ruleId} AND company_id = ${companyId}
      RETURNING *
    `);

    res.json({ data: result.rows[0] });
  })
);

/**
 * DELETE /api/v1/recall/rules/:id
 * Remove regra de recall
 */
router.delete(
  '/rules/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const ruleId = parseInt(req.params.id, 10);

    if (isNaN(ruleId)) {
      return res.status(400).json({ error: 'Invalid rule ID' });
    }

    const result = await db.execute(sql`
      DELETE FROM recall_rules
      WHERE id = ${ruleId} AND company_id = ${companyId}
      RETURNING id
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recall rule not found' });
    }

    res.json({ success: true, message: 'Recall rule deleted' });
  })
);

// ============================================================
// RECALL QUEUE
// ============================================================

/**
 * GET /api/v1/recall/queue
 * Lista fila de recall com informações do paciente
 */
router.get(
  '/queue',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const status = (req.query.status as string) || 'pending';
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 100);
    const offset = parseInt((req.query.offset as string) || '0', 10);

    const result = await db.execute(sql`
      SELECT
        rq.id,
        rq.status,
        rq.due_date,
        rq.sent_at,
        rq.dismissed_at,
        rq.notes,
        rq.recall_rule_id,
        rr.treatment_type,
        rr.send_via,
        rr.message_template,
        p.id           AS patient_id,
        p.full_name    AS patient_name,
        p.phone        AS patient_phone,
        p.email        AS patient_email,
        p.whatsapp     AS patient_whatsapp,
        rq.created_at
      FROM recall_queue rq
      JOIN recall_rules rr ON rq.recall_rule_id = rr.id
      JOIN patients p ON rq.patient_id = p.id
      WHERE rq.company_id = ${companyId}
        AND (${status} = 'all' OR rq.status = ${status})
      ORDER BY rq.due_date ASC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countResult = await db.execute(sql`
      SELECT COUNT(*) AS total
      FROM recall_queue rq
      WHERE rq.company_id = ${companyId}
        AND (${status} = 'all' OR rq.status = ${status})
    `);

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0]?.total as string || '0', 10),
    });
  })
);

/**
 * POST /api/v1/recall/queue/dismiss/:id
 * Descarta um recall (marca como dispensado)
 */
router.post(
  '/queue/dismiss/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const queueId = parseInt(req.params.id, 10);

    if (isNaN(queueId)) {
      return res.status(400).json({ error: 'Invalid queue entry ID' });
    }

    const result = await db.execute(sql`
      UPDATE recall_queue
      SET status = 'dismissed', dismissed_at = NOW(), updated_at = NOW()
      WHERE id = ${queueId} AND company_id = ${companyId}
      RETURNING id, status, dismissed_at
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recall queue entry not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  })
);

// ============================================================
// WAITLIST
// ============================================================

/**
 * GET /api/v1/recall/waitlist
 * Lista entradas da lista de espera com informações do paciente
 */
router.get(
  '/waitlist',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 100);
    const offset = parseInt((req.query.offset as string) || '0', 10);

    const result = await db.execute(sql`
      SELECT
        wl.id,
        wl.preferred_date,
        wl.preferred_period,
        wl.notes,
        wl.status,
        wl.notified_at,
        wl.created_at,
        p.id           AS patient_id,
        p.full_name    AS patient_name,
        p.phone        AS patient_phone,
        p.whatsapp     AS patient_whatsapp,
        p.email        AS patient_email,
        u.id           AS professional_id,
        u.full_name    AS professional_name,
        pr.id          AS procedure_id,
        pr.name        AS procedure_name
      FROM waitlist wl
      JOIN patients p ON wl.patient_id = p.id
      LEFT JOIN users u ON wl.professional_id = u.id
      LEFT JOIN procedures pr ON wl.procedure_id = pr.id
      WHERE wl.company_id = ${companyId}
        AND wl.status != 'removed'
      ORDER BY wl.created_at ASC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countResult = await db.execute(sql`
      SELECT COUNT(*) AS total
      FROM waitlist
      WHERE company_id = ${companyId} AND status != 'removed'
    `);

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0]?.total as string || '0', 10),
    });
  })
);

/**
 * POST /api/v1/recall/waitlist
 * Adiciona paciente à lista de espera
 */
router.post(
  '/waitlist',
  authCheck,
  validate({ body: waitlistEntrySchema }),
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const { patientId, professionalId, preferredDate, preferredPeriod, procedureId, notes } =
      req.body;

    // Verify patient belongs to company
    const patientCheck = await db.execute(sql`
      SELECT id FROM patients WHERE id = ${patientId} AND company_id = ${companyId}
    `);

    if (patientCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const result = await db.execute(sql`
      INSERT INTO waitlist (
        company_id, patient_id, professional_id, preferred_date,
        preferred_period, procedure_id, notes, status, created_at, updated_at
      )
      VALUES (
        ${companyId}, ${patientId}, ${professionalId ?? null}, ${preferredDate ?? null},
        ${preferredPeriod ?? 'any'}, ${procedureId ?? null}, ${notes ?? null},
        'waiting', NOW(), NOW()
      )
      RETURNING *
    `);

    res.status(201).json({ data: result.rows[0] });
  })
);

/**
 * DELETE /api/v1/recall/waitlist/:id
 * Remove entrada da lista de espera
 */
router.delete(
  '/waitlist/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const waitlistId = parseInt(req.params.id, 10);

    if (isNaN(waitlistId)) {
      return res.status(400).json({ error: 'Invalid waitlist entry ID' });
    }

    const result = await db.execute(sql`
      UPDATE waitlist
      SET status = 'removed', updated_at = NOW()
      WHERE id = ${waitlistId} AND company_id = ${companyId}
      RETURNING id, status
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Waitlist entry not found' });
    }

    res.json({ success: true, message: 'Removed from waitlist' });
  })
);

/**
 * POST /api/v1/recall/waitlist/notify/:id
 * Marca como notificado e dispara notificação WhatsApp
 */
router.post(
  '/waitlist/notify/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const waitlistId = parseInt(req.params.id, 10);

    if (isNaN(waitlistId)) {
      return res.status(400).json({ error: 'Invalid waitlist entry ID' });
    }

    // Fetch entry with patient data for notification
    const entryResult = await db.execute(sql`
      SELECT wl.*, p.full_name AS patient_name, p.whatsapp AS patient_whatsapp, p.phone AS patient_phone
      FROM waitlist wl
      JOIN patients p ON wl.patient_id = p.id
      WHERE wl.id = ${waitlistId} AND wl.company_id = ${companyId} AND wl.status != 'removed'
    `);

    if (entryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Waitlist entry not found' });
    }

    const entry = entryResult.rows[0] as any;

    // Mark as notified
    await db.execute(sql`
      UPDATE waitlist
      SET status = 'notified', notified_at = NOW(), updated_at = NOW()
      WHERE id = ${waitlistId} AND company_id = ${companyId}
    `);

    res.json({
      success: true,
      message: 'Patient marked as notified',
      data: {
        waitlistId,
        patientName: entry.patient_name,
        patientWhatsapp: entry.patient_whatsapp || entry.patient_phone,
        notifiedAt: new Date().toISOString(),
      },
    });
  })
);

// ============================================================
// STATS
// ============================================================

/**
 * GET /api/v1/recall/stats
 * Estatísticas de recall (total pendentes, enviados, agendados, taxa de retorno)
 */
router.get(
  '/stats',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);

    const queueStats = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')   AS total_pending,
        COUNT(*) FILTER (WHERE status = 'sent')      AS total_sent,
        COUNT(*) FILTER (WHERE status = 'scheduled') AS total_scheduled,
        COUNT(*) FILTER (WHERE status = 'dismissed') AS total_dismissed,
        COUNT(*)                                      AS total_all
      FROM recall_queue
      WHERE company_id = ${companyId}
    `);

    // Return rate: scheduled / sent * 100
    const stats = queueStats.rows[0] as any;
    const sent = parseInt(stats?.total_sent || '0', 10);
    const scheduled = parseInt(stats?.total_scheduled || '0', 10);
    const returnRate = sent > 0 ? Math.round((scheduled / sent) * 100) : 0;

    const waitlistStats = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'waiting')  AS total_waiting,
        COUNT(*) FILTER (WHERE status = 'notified') AS total_notified,
        COUNT(*)                                     AS total_all
      FROM waitlist
      WHERE company_id = ${companyId} AND status != 'removed'
    `);

    res.json({
      data: {
        queue: {
          pending:    parseInt(stats?.total_pending || '0', 10),
          sent:       parseInt(stats?.total_sent || '0', 10),
          scheduled:  parseInt(stats?.total_scheduled || '0', 10),
          dismissed:  parseInt(stats?.total_dismissed || '0', 10),
          total:      parseInt(stats?.total_all || '0', 10),
          returnRate,
        },
        waitlist: {
          waiting:  parseInt((waitlistStats.rows[0] as any)?.total_waiting || '0', 10),
          notified: parseInt((waitlistStats.rows[0] as any)?.total_notified || '0', 10),
          total:    parseInt((waitlistStats.rows[0] as any)?.total_all || '0', 10),
        },
      },
    });
  })
);

export default router;
