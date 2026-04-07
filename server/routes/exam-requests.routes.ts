import { Router } from 'express';
import { db } from '../db';
import { authCheck, tenantAwareAuth, asyncHandler } from '../middleware/auth';

const router = Router();

const VALID_STATUSES = ['requested', 'collected', 'completed', 'cancelled'] as const;

// Define allowed status transitions
const STATUS_TRANSITIONS: Record<string, string[]> = {
  requested: ['collected', 'cancelled'],
  collected: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

/**
 * GET /api/v1/exam-requests/patient/:patientId
 * List exam requests for a patient with optional status filter
 */
router.get(
  '/patient/:patientId',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { patientId } = req.params;
    const { status } = req.query as any;

    const params: any[] = [companyId, patientId];
    let whereClause = 'WHERE er.company_id = $1 AND er.patient_id = $2 AND er.deleted_at IS NULL';

    if (status) {
      whereClause += ` AND er.status = $3`;
      params.push(status);
    }

    const result = await db.$client.query(
      `SELECT er.*,
              p.full_name as patient_name,
              pr.name as requested_by_name
       FROM exam_requests er
       LEFT JOIN patients p ON p.id = er.patient_id
       LEFT JOIN professionals pr ON pr.id = er.requested_by
       ${whereClause}
       ORDER BY er.created_at DESC`,
      params
    );

    res.json(result.rows);
  })
);

/**
 * POST /api/v1/exam-requests
 * Create a new exam request (initial status: 'requested')
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
      patientId,
      appointmentId,
      examType,
      examName,
      clinicalIndication,
      urgency,
      laboratory,
      notes,
    } = req.body;

    if (!patientId || !examType || !examName) {
      return res.status(400).json({ error: 'patientId, examType and examName are required' });
    }

    const result = await db.$client.query(
      `INSERT INTO exam_requests
        (company_id, patient_id, appointment_id, exam_type, exam_name, clinical_indication,
         urgency, laboratory, notes, status, requested_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'requested', $10, NOW(), NOW())
       RETURNING *`,
      [
        companyId,
        patientId,
        appointmentId || null,
        examType,
        examName,
        clinicalIndication || null,
        urgency || 'routine',
        laboratory || null,
        notes || null,
        user.id,
      ]
    );

    res.status(201).json(result.rows[0]);
  })
);

/**
 * PATCH /api/v1/exam-requests/:id/status
 * Update exam request status (workflow: requested → collected → completed → cancelled)
 */
router.patch(
  '/:id/status',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const existing = await db.$client.query(
      `SELECT id, status FROM exam_requests WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [id, companyId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Exam request not found' });
    }

    const currentStatus = existing.rows[0].status;
    const allowedTransitions = STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowedTransitions.includes(status)) {
      return res.status(409).json({
        error: `Cannot transition from "${currentStatus}" to "${status}". Allowed transitions: ${allowedTransitions.join(', ') || 'none'}`,
        currentStatus,
        requestedStatus: status,
      });
    }

    const extraFields: string[] = [];
    const params: any[] = [status];
    let paramIdx = 2;

    if (status === 'collected') {
      extraFields.push(`collected_at = NOW()`);
      extraFields.push(`collected_by = $${paramIdx++}`);
      params.push(user.id);
    }

    if (status === 'completed') {
      extraFields.push(`completed_at = NOW()`);
    }

    if (status === 'cancelled') {
      extraFields.push(`cancelled_at = NOW()`);
      extraFields.push(`cancelled_by = $${paramIdx++}`);
      params.push(user.id);
    }

    if (notes !== undefined) {
      extraFields.push(`status_notes = $${paramIdx++}`);
      params.push(notes);
    }

    const extraSet = extraFields.length > 0 ? `, ${extraFields.join(', ')}` : '';
    params.push(id, companyId);

    const result = await db.$client.query(
      `UPDATE exam_requests SET status = $1, updated_at = NOW()${extraSet}
       WHERE id = $${paramIdx++} AND company_id = $${paramIdx++}
       RETURNING *`,
      params
    );

    res.json(result.rows[0]);
  })
);

/**
 * PATCH /api/v1/exam-requests/:id/results
 * Add or update results for an exam request
 */
router.patch(
  '/:id/results',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params;
    const { resultNotes, fileUrl, resultDate } = req.body;

    if (!resultNotes && !fileUrl) {
      return res.status(400).json({ error: 'At least one of resultNotes or fileUrl is required' });
    }

    const existing = await db.$client.query(
      `SELECT id, status FROM exam_requests WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [id, companyId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Exam request not found' });
    }

    if (existing.rows[0].status === 'cancelled') {
      return res.status(409).json({ error: 'Cannot add results to a cancelled exam request' });
    }

    const fields: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let paramIdx = 1;

    if (resultNotes !== undefined) { fields.push(`result_notes = $${paramIdx++}`); params.push(resultNotes); }
    if (fileUrl !== undefined) { fields.push(`file_url = $${paramIdx++}`); params.push(fileUrl); }
    if (resultDate !== undefined) { fields.push(`result_date = $${paramIdx++}`); params.push(resultDate); }

    // Auto-advance to 'completed' if results are being added and status is 'collected'
    if (existing.rows[0].status === 'collected') {
      fields.push(`status = 'completed'`);
      fields.push(`completed_at = NOW()`);
    }

    params.push(id, companyId);

    const result = await db.$client.query(
      `UPDATE exam_requests SET ${fields.join(', ')}
       WHERE id = $${paramIdx++} AND company_id = $${paramIdx++}
       RETURNING *`,
      params
    );

    res.json(result.rows[0]);
  })
);

export default router;
