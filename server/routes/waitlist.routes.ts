/**
 * Waitlist (Lista de Espera) Routes
 * GET    /api/v1/waitlist            — list entries (filterable by status, professionalId)
 * POST   /api/v1/waitlist            — add patient to waitlist
 * PATCH  /api/v1/waitlist/:id        — update entry (status, notes, scheduledAppointmentId)
 * DELETE /api/v1/waitlist/:id        — remove entry
 * POST   /api/v1/waitlist/check-matches — find waitlist entries that match a freed slot
 */

import { Router } from 'express';
import { db } from '../db';
import { tenantAwareAuth, asyncHandler } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const waitlistSchema = z.object({
  patientId: z.number().int().positive(),
  professionalId: z.number().int().positive().optional(),
  procedureId: z.number().int().positive().optional(),
  preferredDate: z.string().optional(),
  preferredTimeStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  preferredTimeEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  preferredDaysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  notes: z.string().max(1000).optional(),
  priority: z.number().int().min(0).max(10).default(0),
});

/**
 * GET /api/v1/waitlist
 * List waitlist entries for the authenticated company.
 * Query params: status (default 'waiting' | 'all'), professionalId, limit, offset
 */
router.get(
  '/',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    if (!companyId) return res.status(403).json({ error: 'No company' });

    const { status = 'waiting', professionalId, limit = '50', offset = '0' } = req.query as Record<string, string>;

    let query = `
      SELECT w.*,
        p.full_name   AS patient_name,
        p.phone       AS patient_phone,
        u.full_name   AS professional_name,
        pr.name       AS procedure_name
      FROM waitlist w
      LEFT JOIN patients   p  ON w.patient_id      = p.id
      LEFT JOIN users      u  ON w.professional_id = u.id
      LEFT JOIN procedures pr ON w.procedure_id    = pr.id
      WHERE w.company_id = $1
    `;
    const params: any[] = [companyId];
    let idx = 2;

    if (status && status !== 'all') {
      query += ` AND w.status = $${idx++}`;
      params.push(status);
    }
    if (professionalId) {
      query += ` AND w.professional_id = $${idx++}`;
      params.push(parseInt(professionalId, 10));
    }

    query += ` ORDER BY w.priority DESC, w.created_at ASC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const [rows, countRow] = await Promise.all([
      db.$client.query(query, params),
      db.$client.query(
        `SELECT COUNT(*) FROM waitlist WHERE company_id = $1${status && status !== 'all' ? ' AND status = $2' : ''}`,
        status && status !== 'all' ? [companyId, status] : [companyId]
      ),
    ]);

    res.json({ data: rows.rows, total: parseInt(countRow.rows[0].count, 10) });
  })
);

/**
 * POST /api/v1/waitlist
 * Add a patient to the waitlist.
 */
router.post(
  '/',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    if (!companyId) return res.status(403).json({ error: 'No company' });

    const parsed = waitlistSchema.parse(req.body);

    const result = await db.$client.query(
      `INSERT INTO waitlist (
         company_id, patient_id, professional_id, procedure_id,
         preferred_date, preferred_time_start, preferred_time_end, preferred_days_of_week,
         notes, priority
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        companyId,
        parsed.patientId,
        parsed.professionalId ?? null,
        parsed.procedureId ?? null,
        parsed.preferredDate ?? null,
        parsed.preferredTimeStart ?? null,
        parsed.preferredTimeEnd ?? null,
        parsed.preferredDaysOfWeek ? JSON.stringify(parsed.preferredDaysOfWeek) : null,
        parsed.notes ?? null,
        parsed.priority,
      ]
    );

    res.status(201).json(result.rows[0]);
  })
);

/**
 * PATCH /api/v1/waitlist/:id
 * Update a waitlist entry. Accepted fields: status, scheduledAppointmentId, notes.
 * Setting status to 'notified' automatically records notified_at.
 */
router.patch(
  '/:id',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    if (!companyId) return res.status(403).json({ error: 'No company' });

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const { status, scheduledAppointmentId, notes } = req.body;

    const sets: string[] = ['updated_at = NOW()'];
    const params: any[] = [companyId, id];
    let idx = 3;

    if (status !== undefined) {
      sets.push(`status = $${idx++}`);
      params.push(status);
      if (status === 'notified') {
        sets.push('notified_at = NOW()');
      }
    }
    if (scheduledAppointmentId !== undefined) {
      sets.push(`scheduled_appointment_id = $${idx++}`);
      params.push(scheduledAppointmentId);
    }
    if (notes !== undefined) {
      sets.push(`notes = $${idx++}`);
      params.push(notes);
    }

    const result = await db.$client.query(
      `UPDATE waitlist SET ${sets.join(', ')} WHERE company_id = $1 AND id = $2 RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    res.json(result.rows[0]);
  })
);

/**
 * DELETE /api/v1/waitlist/:id
 * Remove an entry from the waitlist.
 */
router.delete(
  '/:id',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    if (!companyId) return res.status(403).json({ error: 'No company' });

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    await db.$client.query(
      `DELETE FROM waitlist WHERE company_id = $1 AND id = $2`,
      [companyId, id]
    );

    res.json({ message: 'Removed from waitlist' });
  })
);

/**
 * POST /api/v1/waitlist/check-matches
 * Given a freed slot (professionalId, date, startTime, endTime), return up to 5
 * waitlist entries whose preferences match, ordered by priority then age.
 *
 * Body: { professionalId: number, date: string (YYYY-MM-DD), startTime: string (HH:MM), endTime: string (HH:MM) }
 */
router.post(
  '/check-matches',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    if (!companyId) return res.status(403).json({ error: 'No company' });

    const checkSchema = z.object({
      professionalId: z.number().int().positive(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
    });

    const { professionalId, date, startTime, endTime } = checkSchema.parse(req.body);
    const dayOfWeek = new Date(date).getDay(); // 0=Sun … 6=Sat

    const result = await db.$client.query(
      `SELECT w.*, p.full_name AS patient_name, p.phone AS patient_phone
       FROM waitlist w
       LEFT JOIN patients p ON w.patient_id = p.id
       WHERE w.company_id = $1
         AND w.status = 'waiting'
         AND (w.professional_id IS NULL OR w.professional_id = $2)
         AND (w.preferred_date IS NULL OR w.preferred_date = $3)
         AND (w.preferred_time_start IS NULL OR w.preferred_time_start <= $4)
         AND (w.preferred_time_end   IS NULL OR w.preferred_time_end   >= $5)
         AND (w.preferred_days_of_week IS NULL OR $6 = ANY(
               ARRAY(SELECT jsonb_array_elements_text(w.preferred_days_of_week)::int)
             ))
       ORDER BY w.priority DESC, w.created_at ASC
       LIMIT 5`,
      [companyId, professionalId, date, startTime, endTime, dayOfWeek]
    );

    res.json({ matches: result.rows });
  })
);

export default router;
