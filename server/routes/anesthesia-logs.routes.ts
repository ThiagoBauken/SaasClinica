import { Router } from 'express';
import { db } from '../db';
import { authCheck, tenantAwareAuth, asyncHandler } from '../middleware/auth';

const router = Router();

const EDIT_WINDOW_HOURS = 24;

function isWithin24Hours(createdAt: Date): boolean {
  const now = new Date();
  const diffMs = now.getTime() - new Date(createdAt).getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours <= EDIT_WINDOW_HOURS;
}

/**
 * GET /api/v1/anesthesia-logs/patient/:patientId
 * List anesthesia logs for a patient
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

    const result = await db.$client.query(
      `SELECT al.*, p.full_name as patient_name,
              pr.name as administered_by_name
       FROM anesthesia_logs al
       LEFT JOIN patients p ON p.id = al.patient_id
       LEFT JOIN professionals pr ON pr.id = al.administered_by
       WHERE al.company_id = $1 AND al.patient_id = $2 AND al.deleted_at IS NULL
       ORDER BY al.created_at DESC`,
      [companyId, patientId]
    );

    res.json(result.rows);
  })
);

/**
 * GET /api/v1/anesthesia-logs/appointment/:appointmentId
 * List anesthesia logs for a specific appointment
 */
router.get(
  '/appointment/:appointmentId',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { appointmentId } = req.params;

    const result = await db.$client.query(
      `SELECT al.*, p.full_name as patient_name,
              pr.name as administered_by_name
       FROM anesthesia_logs al
       LEFT JOIN patients p ON p.id = al.patient_id
       LEFT JOIN professionals pr ON pr.id = al.administered_by
       WHERE al.company_id = $1 AND al.appointment_id = $2 AND al.deleted_at IS NULL
       ORDER BY al.created_at ASC`,
      [companyId, appointmentId]
    );

    res.json(result.rows);
  })
);

/**
 * POST /api/v1/anesthesia-logs
 * Create a new anesthesia log
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
      anestheticType,
      anestheticName,
      concentration,
      vasoconstrictor,
      quantityMl,
      lotNumber,
      expirationDate,
      administeredBy,
      technique,
      toothRegion,
      adverseReaction,
      notes,
    } = req.body;

    if (!patientId || !anestheticType || !anestheticName || !quantityMl) {
      return res.status(400).json({
        error: 'patientId, anestheticType, anestheticName and quantityMl are required',
      });
    }

    const result = await db.$client.query(
      `INSERT INTO anesthesia_logs
        (company_id, patient_id, appointment_id, anesthetic_type, anesthetic_name, concentration,
         vasoconstrictor, quantity_ml, lot_number, expiration_date, administered_by, technique,
         tooth_region, adverse_reaction, notes, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
       RETURNING *`,
      [
        companyId,
        patientId,
        appointmentId || null,
        anestheticType,
        anestheticName,
        concentration || null,
        vasoconstrictor || null,
        quantityMl,
        lotNumber || null,
        expirationDate || null,
        administeredBy || user.id,
        technique || null,
        toothRegion || null,
        adverseReaction || null,
        notes || null,
        user.id,
      ]
    );

    res.status(201).json(result.rows[0]);
  })
);

/**
 * PATCH /api/v1/anesthesia-logs/:id
 * Update an anesthesia log (only within 24 hours of creation)
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
      `SELECT id, created_at FROM anesthesia_logs WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [id, companyId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Anesthesia log not found' });
    }

    if (!isWithin24Hours(existing.rows[0].created_at)) {
      return res.status(403).json({
        error: 'Anesthesia logs can only be edited within 24 hours of creation',
      });
    }

    const {
      anestheticType,
      anestheticName,
      concentration,
      vasoconstrictor,
      quantityMl,
      lotNumber,
      expirationDate,
      administeredBy,
      technique,
      toothRegion,
      adverseReaction,
      notes,
    } = req.body;

    const fields: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (anestheticType !== undefined) { fields.push(`anesthetic_type = $${paramIdx++}`); params.push(anestheticType); }
    if (anestheticName !== undefined) { fields.push(`anesthetic_name = $${paramIdx++}`); params.push(anestheticName); }
    if (concentration !== undefined) { fields.push(`concentration = $${paramIdx++}`); params.push(concentration); }
    if (vasoconstrictor !== undefined) { fields.push(`vasoconstrictor = $${paramIdx++}`); params.push(vasoconstrictor); }
    if (quantityMl !== undefined) { fields.push(`quantity_ml = $${paramIdx++}`); params.push(quantityMl); }
    if (lotNumber !== undefined) { fields.push(`lot_number = $${paramIdx++}`); params.push(lotNumber); }
    if (expirationDate !== undefined) { fields.push(`expiration_date = $${paramIdx++}`); params.push(expirationDate); }
    if (administeredBy !== undefined) { fields.push(`administered_by = $${paramIdx++}`); params.push(administeredBy); }
    if (technique !== undefined) { fields.push(`technique = $${paramIdx++}`); params.push(technique); }
    if (toothRegion !== undefined) { fields.push(`tooth_region = $${paramIdx++}`); params.push(toothRegion); }
    if (adverseReaction !== undefined) { fields.push(`adverse_reaction = $${paramIdx++}`); params.push(adverseReaction); }
    if (notes !== undefined) { fields.push(`notes = $${paramIdx++}`); params.push(notes); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push(`updated_at = NOW()`);
    params.push(id, companyId);

    const result = await db.$client.query(
      `UPDATE anesthesia_logs SET ${fields.join(', ')} WHERE id = $${paramIdx++} AND company_id = $${paramIdx++} RETURNING *`,
      params
    );

    res.json(result.rows[0]);
  })
);

/**
 * DELETE /api/v1/anesthesia-logs/:id
 * Soft delete an anesthesia log (only within 24 hours of creation)
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
      `SELECT id, created_at FROM anesthesia_logs WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [id, companyId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Anesthesia log not found' });
    }

    if (!isWithin24Hours(existing.rows[0].created_at)) {
      return res.status(403).json({
        error: 'Anesthesia logs can only be deleted within 24 hours of creation',
      });
    }

    await db.$client.query(
      `UPDATE anesthesia_logs SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );

    res.status(204).send();
  })
);

export default router;
