import { Router } from 'express';
import { db } from '../db';
import { authCheck, tenantAwareAuth, asyncHandler } from '../middleware/auth';

const router = Router();

/**
 * GET /api/v1/schedule-blocks
 * List schedule blocks with optional filters
 */
router.get(
  '/',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { startDate, endDate, professionalId, roomId } = req.query as any;

    const params: any[] = [companyId];
    let whereClause = 'WHERE company_id = $1 AND deleted_at IS NULL';
    let paramIdx = 2;

    if (startDate) {
      whereClause += ` AND end_time >= $${paramIdx}`;
      params.push(startDate);
      paramIdx++;
    }

    if (endDate) {
      whereClause += ` AND start_time <= $${paramIdx}`;
      params.push(endDate);
      paramIdx++;
    }

    if (professionalId) {
      whereClause += ` AND professional_id = $${paramIdx}`;
      params.push(professionalId);
      paramIdx++;
    }

    if (roomId) {
      whereClause += ` AND room_id = $${paramIdx}`;
      params.push(roomId);
      paramIdx++;
    }

    const result = await db.$client.query(
      `SELECT * FROM schedule_blocks ${whereClause} ORDER BY start_time ASC`,
      params
    );

    res.json(result.rows);
  })
);

/**
 * POST /api/v1/schedule-blocks
 * Create a new schedule block
 */
router.post(
  '/',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const {
      title,
      reason,
      professionalId,
      roomId,
      startTime,
      endTime,
      allDay,
      recurring,
      recurrencePattern,
    } = req.body;

    if (!title || !startTime || !endTime) {
      return res.status(400).json({ error: 'title, startTime and endTime are required' });
    }

    const result = await db.$client.query(
      `INSERT INTO schedule_blocks
        (company_id, title, reason, professional_id, room_id, start_time, end_time, all_day, recurring, recurrence_pattern, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
       RETURNING *`,
      [
        companyId,
        title,
        reason || null,
        professionalId || null,
        roomId || null,
        startTime,
        endTime,
        allDay ?? false,
        recurring ?? false,
        recurrencePattern || null,
        user.id,
      ]
    );

    res.status(201).json(result.rows[0]);
  })
);

/**
 * PATCH /api/v1/schedule-blocks/:id
 * Update a schedule block
 */
router.patch(
  '/:id',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params;
    const {
      title,
      reason,
      professionalId,
      roomId,
      startTime,
      endTime,
      allDay,
      recurring,
      recurrencePattern,
    } = req.body;

    const existing = await db.$client.query(
      `SELECT id FROM schedule_blocks WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [id, companyId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule block not found' });
    }

    const fields: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (title !== undefined) { fields.push(`title = $${paramIdx++}`); params.push(title); }
    if (reason !== undefined) { fields.push(`reason = $${paramIdx++}`); params.push(reason); }
    if (professionalId !== undefined) { fields.push(`professional_id = $${paramIdx++}`); params.push(professionalId); }
    if (roomId !== undefined) { fields.push(`room_id = $${paramIdx++}`); params.push(roomId); }
    if (startTime !== undefined) { fields.push(`start_time = $${paramIdx++}`); params.push(startTime); }
    if (endTime !== undefined) { fields.push(`end_time = $${paramIdx++}`); params.push(endTime); }
    if (allDay !== undefined) { fields.push(`all_day = $${paramIdx++}`); params.push(allDay); }
    if (recurring !== undefined) { fields.push(`recurring = $${paramIdx++}`); params.push(recurring); }
    if (recurrencePattern !== undefined) { fields.push(`recurrence_pattern = $${paramIdx++}`); params.push(recurrencePattern); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push(`updated_at = NOW()`);
    params.push(id, companyId);

    const result = await db.$client.query(
      `UPDATE schedule_blocks SET ${fields.join(', ')} WHERE id = $${paramIdx++} AND company_id = $${paramIdx++} RETURNING *`,
      params
    );

    res.json(result.rows[0]);
  })
);

/**
 * DELETE /api/v1/schedule-blocks/:id
 * Soft delete a schedule block
 */
router.delete(
  '/:id',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params;

    const result = await db.$client.query(
      `UPDATE schedule_blocks SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule block not found' });
    }

    res.status(204).send();
  })
);

export default router;
