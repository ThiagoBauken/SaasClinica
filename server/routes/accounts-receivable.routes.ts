import { Router } from 'express';
import { db } from '../db';
import { authCheck, tenantAwareAuth, asyncHandler } from '../middleware/auth';

const router = Router();

/**
 * GET /api/v1/accounts-receivable
 * List patient receivables with optional filters and pagination
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

    const { patientId, status, startDate, endDate, page = 1, limit = 20 } = req.query as any;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const params: any[] = [companyId];
    let whereClause = 'WHERE ar.company_id = $1 AND ar.deleted_at IS NULL';
    let paramIdx = 2;

    if (patientId) {
      whereClause += ` AND ar.patient_id = $${paramIdx}`;
      params.push(patientId);
      paramIdx++;
    }

    if (status) {
      whereClause += ` AND ar.status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }

    if (startDate) {
      whereClause += ` AND ar.due_date >= $${paramIdx}`;
      params.push(startDate);
      paramIdx++;
    }

    if (endDate) {
      whereClause += ` AND ar.due_date <= $${paramIdx}`;
      params.push(endDate);
      paramIdx++;
    }

    const countResult = await db.$client.query(
      `SELECT COUNT(*) FROM accounts_receivable ar ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await db.$client.query(
      `SELECT ar.*, p.full_name as patient_name
       FROM accounts_receivable ar
       LEFT JOIN patients p ON p.id = ar.patient_id
       ${whereClause}
       ORDER BY ar.due_date ASC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, parseInt(limit, 10), offset]
    );

    res.json({
      data: dataResult.rows,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  })
);

/**
 * GET /api/v1/accounts-receivable/aging
 * Aging report grouped by overdue brackets
 */
router.get(
  '/aging',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const result = await db.$client.query(
      `SELECT
        CASE
          WHEN due_date >= CURRENT_DATE THEN 'current'
          WHEN due_date >= CURRENT_DATE - INTERVAL '30 days' THEN 'overdue_1_30'
          WHEN due_date >= CURRENT_DATE - INTERVAL '60 days' THEN 'overdue_31_60'
          WHEN due_date >= CURRENT_DATE - INTERVAL '90 days' THEN 'overdue_61_90'
          ELSE 'overdue_90_plus'
        END as bracket,
        COUNT(*) as count,
        COALESCE(SUM(amount - COALESCE(amount_paid, 0)), 0) as total
       FROM accounts_receivable
       WHERE company_id = $1
         AND deleted_at IS NULL
         AND status NOT IN ('paid', 'cancelled')
       GROUP BY bracket`,
      [companyId]
    );

    const brackets: Record<string, { count: number; total: number }> = {
      current: { count: 0, total: 0 },
      overdue_1_30: { count: 0, total: 0 },
      overdue_31_60: { count: 0, total: 0 },
      overdue_61_90: { count: 0, total: 0 },
      overdue_90_plus: { count: 0, total: 0 },
    };

    for (const row of result.rows) {
      brackets[row.bracket] = {
        count: parseInt(row.count, 10),
        total: parseFloat(row.total),
      };
    }

    const totalOverdue =
      brackets.overdue_1_30.total +
      brackets.overdue_31_60.total +
      brackets.overdue_61_90.total +
      brackets.overdue_90_plus.total;

    const totalAll = totalOverdue + brackets.current.total;

    res.json({
      ...brackets,
      total_overdue: totalOverdue,
      total_all: totalAll,
    });
  })
);

/**
 * GET /api/v1/accounts-receivable/patient/:patientId
 * List receivables for a specific patient
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
    let whereClause = 'WHERE ar.company_id = $1 AND ar.patient_id = $2 AND ar.deleted_at IS NULL';

    if (status) {
      whereClause += ` AND ar.status = $3`;
      params.push(status);
    }

    const result = await db.$client.query(
      `SELECT ar.*, p.full_name as patient_name
       FROM accounts_receivable ar
       LEFT JOIN patients p ON p.id = ar.patient_id
       ${whereClause}
       ORDER BY ar.due_date ASC`,
      params
    );

    res.json(result.rows);
  })
);

/**
 * POST /api/v1/accounts-receivable
 * Create a new receivable entry
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
      description,
      amount,
      dueDate,
      installmentNumber,
      totalInstallments,
      treatmentPlanId,
      appointmentId,
      notes,
    } = req.body;

    if (!patientId || !amount || !dueDate) {
      return res.status(400).json({ error: 'patientId, amount and dueDate are required' });
    }

    const result = await db.$client.query(
      `INSERT INTO accounts_receivable
        (company_id, patient_id, description, amount, amount_paid, due_date, status,
         installment_number, total_installments, treatment_plan_id, appointment_id, notes, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 0, $5, 'pending', $6, $7, $8, $9, $10, $11, NOW(), NOW())
       RETURNING *`,
      [
        companyId,
        patientId,
        description || null,
        amount,
        dueDate,
        installmentNumber || null,
        totalInstallments || null,
        treatmentPlanId || null,
        appointmentId || null,
        notes || null,
        user.id,
      ]
    );

    res.status(201).json(result.rows[0]);
  })
);

/**
 * PATCH /api/v1/accounts-receivable/:id
 * Update a receivable entry
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

    const existing = await db.$client.query(
      `SELECT id FROM accounts_receivable WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [id, companyId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Accounts receivable entry not found' });
    }

    const { description, amount, dueDate, status, notes } = req.body;

    const fields: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (description !== undefined) { fields.push(`description = $${paramIdx++}`); params.push(description); }
    if (amount !== undefined) { fields.push(`amount = $${paramIdx++}`); params.push(amount); }
    if (dueDate !== undefined) { fields.push(`due_date = $${paramIdx++}`); params.push(dueDate); }
    if (status !== undefined) { fields.push(`status = $${paramIdx++}`); params.push(status); }
    if (notes !== undefined) { fields.push(`notes = $${paramIdx++}`); params.push(notes); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push(`updated_at = NOW()`);
    params.push(id, companyId);

    const result = await db.$client.query(
      `UPDATE accounts_receivable SET ${fields.join(', ')} WHERE id = $${paramIdx++} AND company_id = $${paramIdx++} RETURNING *`,
      params
    );

    res.json(result.rows[0]);
  })
);

/**
 * POST /api/v1/accounts-receivable/:id/pay
 * Record a payment against a receivable
 */
router.post(
  '/:id/pay',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params;
    const { amountPaid, paymentMethod, paymentNote } = req.body;

    if (!amountPaid) {
      return res.status(400).json({ error: 'amountPaid is required' });
    }

    const existing = await db.$client.query(
      `SELECT id, amount, amount_paid, status FROM accounts_receivable WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [id, companyId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Accounts receivable entry not found' });
    }

    const entry = existing.rows[0];

    if (entry.status === 'paid') {
      return res.status(409).json({ error: 'Entry is already fully paid' });
    }

    if (entry.status === 'cancelled') {
      return res.status(409).json({ error: 'Cannot record payment for a cancelled entry' });
    }

    const newAmountPaid = parseFloat(entry.amount_paid) + parseFloat(amountPaid);
    const newStatus = newAmountPaid >= parseFloat(entry.amount) ? 'paid' : 'partial';

    const result = await db.$client.query(
      `UPDATE accounts_receivable
       SET amount_paid = $3, status = $4, payment_date = NOW(), payment_method = $5, payment_note = $6, collected_by = $7, updated_at = NOW()
       WHERE id = $1 AND company_id = $2
       RETURNING *`,
      [id, companyId, newAmountPaid, newStatus, paymentMethod || null, paymentNote || null, user.id]
    );

    res.json(result.rows[0]);
  })
);

/**
 * POST /api/v1/accounts-receivable/generate-from-plan/:planId
 * Generate installment receivables from a treatment plan
 */
router.post(
  '/generate-from-plan/:planId',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { planId } = req.params;
    const { totalAmount, installments = 1, firstDueDate, description } = req.body;

    if (!totalAmount || !firstDueDate) {
      return res.status(400).json({ error: 'totalAmount and firstDueDate are required' });
    }

    // Verify plan belongs to this company
    const planResult = await db.$client.query(
      `SELECT id, patient_id FROM treatment_plans WHERE id = $1 AND company_id = $2`,
      [planId, companyId]
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({ error: 'Treatment plan not found' });
    }

    const { patient_id: patientId } = planResult.rows[0];
    const installmentAmount = parseFloat(totalAmount) / parseInt(installments, 10);
    const created = [];

    for (let i = 0; i < parseInt(installments, 10); i++) {
      const dueDate = new Date(firstDueDate);
      dueDate.setMonth(dueDate.getMonth() + i);

      const result = await db.$client.query(
        `INSERT INTO accounts_receivable
          (company_id, patient_id, description, amount, amount_paid, due_date, status,
           installment_number, total_installments, treatment_plan_id, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 0, $5, 'pending', $6, $7, $8, $9, NOW(), NOW())
         RETURNING *`,
        [
          companyId,
          patientId,
          description || `Parcela ${i + 1}/${installments}`,
          installmentAmount.toFixed(2),
          dueDate.toISOString().split('T')[0],
          i + 1,
          parseInt(installments, 10),
          planId,
          user.id,
        ]
      );

      created.push(result.rows[0]);
    }

    res.status(201).json({ created, count: created.length, totalAmount });
  })
);

export default router;
