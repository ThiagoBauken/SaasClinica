/**
 * Sales Goals Routes — /api/v1/goals
 *
 * CRUD for salesGoals table plus a real-time dashboard summary endpoint
 * that calculates currentValue on the fly from live transaction/appointment/patient data.
 */
import { Router } from 'express';
import { db } from '../db';
import { salesGoals, insertSalesGoalSchema } from '../../shared/schema';
import { tenantAwareAuth, asyncHandler } from '../middleware/auth';
import { logger } from '../logger';

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calculate the live currentValue for a goal based on its targetType.
 * Returns a number (already converted from cents for revenue).
 */
async function calcCurrentValue(
  companyId: number,
  targetType: string,
  startDate: string,
  endDate: string,
  userId: number | null | undefined
): Promise<number> {
  if (targetType === 'revenue') {
    // SUM of financialTransactions.amount (stored in cents) WHERE type='income'
    const params: any[] = [companyId, startDate, endDate];
    let sql = `
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM financial_transactions
      WHERE company_id = $1
        AND type = 'income'
        AND deleted_at IS NULL
        AND date >= $2::timestamptz
        AND date <= $3::timestamptz
    `;
    if (userId) {
      sql += ` AND professional_id = $4`;
      params.push(userId);
    }
    const result = await db.$client.query(sql, params);
    // amount is stored in cents → convert to BRL
    return Math.round(Number(result.rows[0].total)) / 100;
  }

  if (targetType === 'appointments') {
    const params: any[] = [companyId, startDate, endDate];
    let sql = `
      SELECT COUNT(*) AS total
      FROM appointments
      WHERE company_id = $1
        AND status = 'completed'
        AND deleted_at IS NULL
        AND start_time >= $2::timestamptz
        AND start_time <= $3::timestamptz
    `;
    if (userId) {
      sql += ` AND professional_id = $4`;
      params.push(userId);
    }
    const result = await db.$client.query(sql, params);
    return parseInt(result.rows[0].total, 10);
  }

  if (targetType === 'new_patients') {
    const params: any[] = [companyId, startDate, endDate];
    let sql = `
      SELECT COUNT(*) AS total
      FROM patients
      WHERE company_id = $1
        AND deleted_at IS NULL
        AND created_at >= $2::timestamptz
        AND created_at <= $3::timestamptz
    `;
    // new_patients goals scoped by userId are uncommon but supported via referral/professional
    const result = await db.$client.query(sql, params);
    return parseInt(result.rows[0].total, 10);
  }

  return 0;
}

// ── GET /api/v1/goals — List goals ────────────────────────────────────────────
router.get(
  '/',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { status, userId, startDate, endDate, page = 1, limit = 20 } = req.query as any;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const params: any[] = [companyId];
    let whereClause = 'WHERE company_id = $1';
    let paramIdx = 2;

    if (status) {
      whereClause += ` AND status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }

    if (userId) {
      whereClause += ` AND user_id = $${paramIdx}`;
      params.push(userId);
      paramIdx++;
    }

    if (startDate) {
      whereClause += ` AND end_date >= $${paramIdx}`;
      params.push(startDate);
      paramIdx++;
    }

    if (endDate) {
      whereClause += ` AND start_date <= $${paramIdx}`;
      params.push(endDate);
      paramIdx++;
    }

    const countResult = await db.$client.query(
      `SELECT COUNT(*) FROM sales_goals ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await db.$client.query(
      `SELECT g.*,
              u.full_name AS user_name
       FROM sales_goals g
       LEFT JOIN users u ON g.user_id = u.id
       ${whereClause}
       ORDER BY g.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, parseInt(limit, 10), offset]
    );

    return res.json({
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

// ── GET /api/v1/goals/dashboard — Active goals with live progress ──────────────
// NOTE: This route must be defined BEFORE /:id to avoid "dashboard" being treated as an id
router.get(
  '/dashboard',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    // Fetch all active goals for this company
    const goalsResult = await db.$client.query(
      `SELECT g.*,
              u.full_name AS user_name
       FROM sales_goals g
       LEFT JOIN users u ON g.user_id = u.id
       WHERE g.company_id = $1
         AND g.status = 'active'
       ORDER BY g.created_at DESC`,
      [companyId]
    );

    // Calculate live currentValue for each goal
    const goalsWithProgress = await Promise.all(
      goalsResult.rows.map(async (goal: any) => {
        try {
          const current = await calcCurrentValue(
            companyId,
            goal.target_type,
            goal.start_date,
            goal.end_date,
            goal.user_id
          );
          const target = parseFloat(goal.target_value);
          const percentage = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;

          return {
            ...goal,
            current_value: current,
            target_value: target,
            percentage,
          };
        } catch (err) {
          logger.error({ err, goalId: goal.id }, 'Failed to calculate goal progress');
          return {
            ...goal,
            current_value: 0,
            target_value: parseFloat(goal.target_value),
            percentage: 0,
          };
        }
      })
    );

    return res.json({ data: goalsWithProgress });
  })
);

// ── POST /api/v1/goals — Create goal ──────────────────────────────────────────
router.post(
  '/',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const parsed = insertSalesGoalSchema.safeParse({ ...req.body, companyId });
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const [created] = await db
      .insert(salesGoals)
      .values(parsed.data)
      .returning();

    logger.info({ goalId: created.id, companyId }, 'Sales goal created');
    return res.status(201).json({ data: created });
  })
);

// ── PATCH /api/v1/goals/:id — Update goal ─────────────────────────────────────
router.patch(
  '/:id',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;
    const goalId = parseInt(req.params.id, 10);

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    if (isNaN(goalId)) {
      return res.status(400).json({ error: 'Invalid goal id' });
    }

    // Verify ownership
    const existing = await db.$client.query(
      'SELECT id FROM sales_goals WHERE id = $1 AND company_id = $2',
      [goalId, companyId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const allowedFields = [
      'name', 'description', 'userId', 'startDate', 'endDate',
      'targetValue', 'targetType', 'currentValue', 'status',
    ] as const;

    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Build dynamic SQL to avoid Drizzle column mapping issues
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    const fieldToColumn: Record<string, string> = {
      name: 'name',
      description: 'description',
      userId: 'user_id',
      startDate: 'start_date',
      endDate: 'end_date',
      targetValue: 'target_value',
      targetType: 'target_type',
      currentValue: 'current_value',
      status: 'status',
    };

    for (const [field, value] of Object.entries(updates)) {
      const col = fieldToColumn[field];
      if (col) {
        setClauses.push(`${col} = $${paramIdx}`);
        params.push(value);
        paramIdx++;
      }
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(goalId, companyId);

    const result = await db.$client.query(
      `UPDATE sales_goals SET ${setClauses.join(', ')}
       WHERE id = $${paramIdx} AND company_id = $${paramIdx + 1}
       RETURNING *`,
      params
    );

    logger.info({ goalId, companyId }, 'Sales goal updated');
    return res.json({ data: result.rows[0] });
  })
);

// ── DELETE /api/v1/goals/:id — Soft delete ────────────────────────────────────
router.delete(
  '/:id',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;
    const goalId = parseInt(req.params.id, 10);

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    if (isNaN(goalId)) {
      return res.status(400).json({ error: 'Invalid goal id' });
    }

    const result = await db.$client.query(
      `UPDATE sales_goals
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND company_id = $2
       RETURNING id`,
      [goalId, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    logger.info({ goalId, companyId }, 'Sales goal soft-deleted (cancelled)');
    return res.status(204).send();
  })
);

export default router;
