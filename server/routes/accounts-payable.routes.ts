import { Router } from 'express';
import { db } from '../db';
import { authCheck, tenantAwareAuth, asyncHandler } from '../middleware/auth';

const router = Router();

const VALID_CATEGORIES = [
  'aluguel',
  'materiais',
  'salarios',
  'laboratorio',
  'equipamentos',
  'marketing',
  'impostos',
  'outros',
] as const;

const VALID_STATUSES = ['pending', 'paid', 'overdue', 'cancelled'] as const;

/**
 * GET /api/v1/accounts-payable
 * List clinic expenses with optional filters and pagination
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

    const { startDate, endDate, status, category, page = 1, limit = 20 } = req.query as any;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const params: any[] = [companyId];
    let whereClause = 'WHERE company_id = $1 AND deleted_at IS NULL';
    let paramIdx = 2;

    if (startDate) {
      whereClause += ` AND due_date >= $${paramIdx}`;
      params.push(startDate);
      paramIdx++;
    }

    if (endDate) {
      whereClause += ` AND due_date <= $${paramIdx}`;
      params.push(endDate);
      paramIdx++;
    }

    if (status) {
      whereClause += ` AND status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }

    if (category) {
      whereClause += ` AND category = $${paramIdx}`;
      params.push(category);
      paramIdx++;
    }

    const countResult = await db.$client.query(
      `SELECT COUNT(*) FROM accounts_payable ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await db.$client.query(
      `SELECT * FROM accounts_payable ${whereClause} ORDER BY due_date ASC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
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
 * GET /api/v1/accounts-payable/summary
 * Summary totals by status and category for a period
 */
router.get(
  '/summary',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { startDate, endDate } = req.query as any;

    const params: any[] = [companyId];
    let whereClause = 'WHERE company_id = $1 AND deleted_at IS NULL';
    let paramIdx = 2;

    if (startDate) {
      whereClause += ` AND due_date >= $${paramIdx}`;
      params.push(startDate);
      paramIdx++;
    }

    if (endDate) {
      whereClause += ` AND due_date <= $${paramIdx}`;
      params.push(endDate);
      paramIdx++;
    }

    const [byStatus, byCategory] = await Promise.all([
      db.$client.query(
        `SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
         FROM accounts_payable ${whereClause}
         GROUP BY status`,
        params
      ),
      db.$client.query(
        `SELECT category, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
         FROM accounts_payable ${whereClause}
         GROUP BY category`,
        params
      ),
    ]);

    const statusSummary: Record<string, { count: number; total: number }> = {};
    for (const row of byStatus.rows) {
      statusSummary[row.status] = { count: parseInt(row.count, 10), total: parseFloat(row.total) };
    }

    const categorySummary: Record<string, { count: number; total: number }> = {};
    for (const row of byCategory.rows) {
      categorySummary[row.category] = { count: parseInt(row.count, 10), total: parseFloat(row.total) };
    }

    res.json({ by_status: statusSummary, by_category: categorySummary });
  })
);

/**
 * POST /api/v1/accounts-payable
 * Create a new expense entry
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

    const { title, description, amount, dueDate, category, supplierId, notes, recurrent, recurrencePattern } = req.body;

    if (!title || !amount || !dueDate || !category) {
      return res.status(400).json({ error: 'title, amount, dueDate and category are required' });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }

    const result = await db.$client.query(
      `INSERT INTO accounts_payable
        (company_id, title, description, amount, due_date, category, status, supplier_id, notes, recurrent, recurrence_pattern, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9, $10, $11, NOW(), NOW())
       RETURNING *`,
      [
        companyId,
        title,
        description || null,
        amount,
        dueDate,
        category,
        supplierId || null,
        notes || null,
        recurrent ?? false,
        recurrencePattern || null,
        user.id,
      ]
    );

    res.status(201).json(result.rows[0]);
  })
);

/**
 * PATCH /api/v1/accounts-payable/:id
 * Update an expense entry
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
      `SELECT id, status FROM accounts_payable WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [id, companyId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Accounts payable entry not found' });
    }

    const { title, description, amount, dueDate, category, status, supplierId, notes, recurrent, recurrencePattern } = req.body;

    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const fields: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (title !== undefined) { fields.push(`title = $${paramIdx++}`); params.push(title); }
    if (description !== undefined) { fields.push(`description = $${paramIdx++}`); params.push(description); }
    if (amount !== undefined) { fields.push(`amount = $${paramIdx++}`); params.push(amount); }
    if (dueDate !== undefined) { fields.push(`due_date = $${paramIdx++}`); params.push(dueDate); }
    if (category !== undefined) { fields.push(`category = $${paramIdx++}`); params.push(category); }
    if (status !== undefined) { fields.push(`status = $${paramIdx++}`); params.push(status); }
    if (supplierId !== undefined) { fields.push(`supplier_id = $${paramIdx++}`); params.push(supplierId); }
    if (notes !== undefined) { fields.push(`notes = $${paramIdx++}`); params.push(notes); }
    if (recurrent !== undefined) { fields.push(`recurrent = $${paramIdx++}`); params.push(recurrent); }
    if (recurrencePattern !== undefined) { fields.push(`recurrence_pattern = $${paramIdx++}`); params.push(recurrencePattern); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push(`updated_at = NOW()`);
    params.push(id, companyId);

    const result = await db.$client.query(
      `UPDATE accounts_payable SET ${fields.join(', ')} WHERE id = $${paramIdx++} AND company_id = $${paramIdx++} RETURNING *`,
      params
    );

    res.json(result.rows[0]);
  })
);

/**
 * DELETE /api/v1/accounts-payable/:id
 * Soft delete an expense entry
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
      `UPDATE accounts_payable SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Accounts payable entry not found' });
    }

    res.status(204).send();
  })
);

/**
 * POST /api/v1/accounts-payable/:id/pay
 * Mark an expense as paid
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
    const { paymentMethod, paymentNote } = req.body;

    const existing = await db.$client.query(
      `SELECT id, status FROM accounts_payable WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [id, companyId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Accounts payable entry not found' });
    }

    if (existing.rows[0].status === 'paid') {
      return res.status(409).json({ error: 'Entry is already marked as paid' });
    }

    if (existing.rows[0].status === 'cancelled') {
      return res.status(409).json({ error: 'Cannot pay a cancelled entry' });
    }

    const result = await db.$client.query(
      `UPDATE accounts_payable
       SET status = 'paid', payment_date = NOW(), payment_method = $3, payment_note = $4, paid_by = $5, updated_at = NOW()
       WHERE id = $1 AND company_id = $2
       RETURNING *`,
      [id, companyId, paymentMethod || null, paymentNote || null, user.id]
    );

    res.json(result.rows[0]);
  })
);

export default router;
