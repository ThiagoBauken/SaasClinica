import { Router } from 'express';
import { db } from '../db';
import { authCheck, tenantAwareAuth, asyncHandler } from '../middleware/auth';

const router = Router();

/**
 * GET /api/v1/clinic-units
 * List all units for the company
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
      `SELECT * FROM clinic_units
       WHERE company_id = $1 AND deleted_at IS NULL
       ORDER BY is_main DESC, name ASC`,
      [companyId]
    );

    res.json(result.rows);
  })
);

/**
 * POST /api/v1/clinic-units
 * Create a new clinic unit
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
      name,
      cnpj,
      phone,
      email,
      address,
      neighborhood,
      city,
      state,
      cep,
      managerName,
      managerPhone,
      notes,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    // Check if this is the first unit — make it main automatically
    const countResult = await db.$client.query(
      `SELECT COUNT(*) FROM clinic_units WHERE company_id = $1 AND deleted_at IS NULL`,
      [companyId]
    );
    const isFirst = parseInt(countResult.rows[0].count, 10) === 0;

    const result = await db.$client.query(
      `INSERT INTO clinic_units
        (company_id, name, cnpj, phone, email, address, neighborhood, city, state, cep,
         manager_name, manager_phone, notes, is_main, active, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true, $15, NOW(), NOW())
       RETURNING *`,
      [
        companyId,
        name,
        cnpj || null,
        phone || null,
        email || null,
        address || null,
        neighborhood || null,
        city || null,
        state || null,
        cep || null,
        managerName || null,
        managerPhone || null,
        notes || null,
        isFirst,
        user.id,
      ]
    );

    res.status(201).json(result.rows[0]);
  })
);

/**
 * PATCH /api/v1/clinic-units/:id
 * Update a clinic unit
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
      `SELECT id FROM clinic_units WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [id, companyId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Clinic unit not found' });
    }

    const {
      name,
      cnpj,
      phone,
      email,
      address,
      neighborhood,
      city,
      state,
      cep,
      managerName,
      managerPhone,
      notes,
      active,
    } = req.body;

    const fields: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (name !== undefined) { fields.push(`name = $${paramIdx++}`); params.push(name); }
    if (cnpj !== undefined) { fields.push(`cnpj = $${paramIdx++}`); params.push(cnpj); }
    if (phone !== undefined) { fields.push(`phone = $${paramIdx++}`); params.push(phone); }
    if (email !== undefined) { fields.push(`email = $${paramIdx++}`); params.push(email); }
    if (address !== undefined) { fields.push(`address = $${paramIdx++}`); params.push(address); }
    if (neighborhood !== undefined) { fields.push(`neighborhood = $${paramIdx++}`); params.push(neighborhood); }
    if (city !== undefined) { fields.push(`city = $${paramIdx++}`); params.push(city); }
    if (state !== undefined) { fields.push(`state = $${paramIdx++}`); params.push(state); }
    if (cep !== undefined) { fields.push(`cep = $${paramIdx++}`); params.push(cep); }
    if (managerName !== undefined) { fields.push(`manager_name = $${paramIdx++}`); params.push(managerName); }
    if (managerPhone !== undefined) { fields.push(`manager_phone = $${paramIdx++}`); params.push(managerPhone); }
    if (notes !== undefined) { fields.push(`notes = $${paramIdx++}`); params.push(notes); }
    if (active !== undefined) { fields.push(`active = $${paramIdx++}`); params.push(active); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push(`updated_at = NOW()`);
    params.push(id, companyId);

    const result = await db.$client.query(
      `UPDATE clinic_units SET ${fields.join(', ')} WHERE id = $${paramIdx++} AND company_id = $${paramIdx++} RETURNING *`,
      params
    );

    res.json(result.rows[0]);
  })
);

/**
 * DELETE /api/v1/clinic-units/:id
 * Deactivate (soft delete) a clinic unit
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

    const existing = await db.$client.query(
      `SELECT id, is_main FROM clinic_units WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [id, companyId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Clinic unit not found' });
    }

    if (existing.rows[0].is_main) {
      return res.status(409).json({
        error: 'Cannot deactivate the main unit. Set another unit as main first.',
      });
    }

    await db.$client.query(
      `UPDATE clinic_units SET active = false, deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );

    res.status(204).send();
  })
);

/**
 * POST /api/v1/clinic-units/:id/set-main
 * Set a unit as the main unit (unsets the previous main)
 */
router.post(
  '/:id/set-main',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params;

    const existing = await db.$client.query(
      `SELECT id FROM clinic_units WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL AND active = true`,
      [id, companyId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Active clinic unit not found' });
    }

    // Unset all main flags for the company, then set the requested one
    await db.$client.query(
      `UPDATE clinic_units SET is_main = false, updated_at = NOW() WHERE company_id = $1`,
      [companyId]
    );

    const result = await db.$client.query(
      `UPDATE clinic_units SET is_main = true, updated_at = NOW()
       WHERE id = $1 AND company_id = $2
       RETURNING *`,
      [id, companyId]
    );

    res.json(result.rows[0]);
  })
);

export default router;
