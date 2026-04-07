import { Router } from 'express';
import { db } from '../db';
import { authCheck, tenantAwareAuth, asyncHandler } from '../middleware/auth';

const router = Router();

/**
 * GET /api/v1/discount-limits
 * List all discount limits for the company
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

    const result = await db.$client.query(
      `SELECT * FROM discount_limits WHERE company_id = $1 ORDER BY role ASC`,
      [companyId]
    );

    res.json(result.rows);
  })
);

/**
 * POST /api/v1/discount-limits
 * Create or update a discount limit for a specific role (upsert)
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

    const { role, maxDiscountPercent, requiresApproval, approverId } = req.body;

    if (!role || maxDiscountPercent === undefined) {
      return res.status(400).json({ error: 'role and maxDiscountPercent are required' });
    }

    if (maxDiscountPercent < 0 || maxDiscountPercent > 100) {
      return res.status(400).json({ error: 'maxDiscountPercent must be between 0 and 100' });
    }

    // Upsert: update if exists for this role, otherwise insert
    const result = await db.$client.query(
      `INSERT INTO discount_limits
        (company_id, role, max_discount_percent, requires_approval, approver_id, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (company_id, role)
       DO UPDATE SET
         max_discount_percent = EXCLUDED.max_discount_percent,
         requires_approval = EXCLUDED.requires_approval,
         approver_id = EXCLUDED.approver_id,
         updated_at = NOW()
       RETURNING *`,
      [
        companyId,
        role,
        maxDiscountPercent,
        requiresApproval ?? false,
        approverId || null,
        user.id,
      ]
    );

    res.status(201).json(result.rows[0]);
  })
);

/**
 * DELETE /api/v1/discount-limits/:id
 * Remove a discount limit
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
      `DELETE FROM discount_limits WHERE id = $1 AND company_id = $2 RETURNING id`,
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Discount limit not found' });
    }

    res.status(204).send();
  })
);

/**
 * GET /api/v1/discount-limits/check
 * Check if the current user can apply a specific discount percentage
 * Query params: discountPercent (number)
 */
router.get(
  '/check',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { discountPercent } = req.query as any;

    if (discountPercent === undefined) {
      return res.status(400).json({ error: 'discountPercent query parameter is required' });
    }

    const requestedPercent = parseFloat(discountPercent);

    if (isNaN(requestedPercent) || requestedPercent < 0 || requestedPercent > 100) {
      return res.status(400).json({ error: 'discountPercent must be a number between 0 and 100' });
    }

    // Get the user's role
    const userResult = await db.$client.query(
      `SELECT role FROM users WHERE id = $1 AND company_id = $2`,
      [user.id, companyId]
    );

    const userRole = userResult.rows[0]?.role || user.role;

    // Find the discount limit for this role
    const limitResult = await db.$client.query(
      `SELECT max_discount_percent, requires_approval, approver_id
       FROM discount_limits
       WHERE company_id = $1 AND role = $2`,
      [companyId, userRole]
    );

    // If no limit is configured for this role, deny by default
    if (limitResult.rows.length === 0) {
      return res.json({
        allowed: requestedPercent === 0,
        maxPercent: 0,
        requiresApproval: false,
        role: userRole,
        message: 'No discount limit configured for this role. Only 0% discounts allowed.',
      });
    }

    const limit = limitResult.rows[0];
    const maxPercent = parseFloat(limit.max_discount_percent);
    const requiresApproval = limit.requires_approval;

    const allowed = requestedPercent <= maxPercent;

    res.json({
      allowed,
      maxPercent,
      requiresApproval: allowed && requiresApproval,
      role: userRole,
      approverId: requiresApproval ? limit.approver_id : null,
      message: allowed
        ? requiresApproval
          ? 'Discount allowed but requires approval'
          : 'Discount allowed'
        : `Discount exceeds maximum allowed (${maxPercent}%) for role "${userRole}"`,
    });
  })
);

export default router;
