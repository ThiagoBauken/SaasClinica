/**
 * Rotas de Teleconsulta - Jitsi Meet
 *
 * Gerencia salas de teleconsulta usando Jitsi Meet (open source, gratuito).
 * Salas são criadas no servidor público meet.jit.si sem custo.
 * Controla ciclo de vida: agendada → em andamento → concluída / cancelada.
 */

import { Router } from 'express';
import { authCheck, asyncHandler } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { treatmentEvolution } from '@shared/schema';

const router = Router();

// ==================== SCHEMAS ====================

const createTeleconsultationSchema = z.object({
  patientId: z.number().int().positive(),
  professionalId: z.number().int().positive(),
  scheduledAt: z.string().datetime(),
  notes: z.string().max(2000).optional(),
});

const endTeleconsultationSchema = z.object({
  notes: z.string().max(2000).optional(),
  clinicalNotes: z.string().max(5000).optional(),
  observations: z.string().max(2000).optional(),
});

// ==================== ROUTES ====================

/**
 * GET /api/v1/teleconsultations
 * Lista teleconsultas da empresa com dados de paciente e profissional
 */
router.get(
  '/',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = (req.user!)?.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { status, limit = '50', offset = '0' } = req.query as Record<string, string>;

    const statusFilter = status ? sql`AND t.status = ${status}` : sql``;

    const teleconsultations = await db.execute(sql`
      SELECT
        t.*,
        p.full_name  AS patient_name,
        p.phone      AS patient_phone,
        u.full_name  AS professional_name
      FROM teleconsultations t
      LEFT JOIN patients p ON p.id = t.patient_id
      LEFT JOIN users    u ON u.id = t.professional_id
      WHERE t.company_id = ${companyId}
        ${statusFilter}
      ORDER BY t.scheduled_at DESC
      LIMIT  ${parseInt(limit, 10)}
      OFFSET ${parseInt(offset, 10)}
    `);

    res.json(teleconsultations.rows);
  })
);

/**
 * POST /api/v1/teleconsultations
 * Alias for /create — accepts the root path used by the frontend client.
 * POST /api/v1/teleconsultations/create
 * Cria uma nova sala de teleconsulta no Jitsi Meet
 *
 * Gera um nome de sala único: clinic-{companyId}-{timestamp}
 * URL pública: https://meet.jit.si/{roomName}
 */
router.post(
  ['/', '/create'],
  authCheck,
  validate({ body: createTeleconsultationSchema }),
  asyncHandler(async (req, res) => {
    const companyId = (req.user!)?.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { patientId, professionalId, scheduledAt, notes } = req.body;

    // Verificar se paciente pertence à empresa
    const patientCheck = await db.execute(sql`
      SELECT id FROM patients
      WHERE id = ${patientId}
        AND company_id = ${companyId}
    `);
    if (patientCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Verificar se profissional pertence à empresa
    const professionalCheck = await db.execute(sql`
      SELECT id FROM users
      WHERE id = ${professionalId}
        AND company_id = ${companyId}
    `);
    if (professionalCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Professional not found' });
    }

    // Gerar nome único da sala e URL Jitsi
    const roomName = `clinic-${companyId}-${Date.now()}`;
    const roomUrl = `https://meet.jit.si/${roomName}`;

    const result = await db.execute(sql`
      INSERT INTO teleconsultations (
        company_id,
        patient_id,
        professional_id,
        room_name,
        room_url,
        scheduled_at,
        notes,
        status,
        created_at,
        updated_at
      )
      VALUES (
        ${companyId},
        ${patientId},
        ${professionalId},
        ${roomName},
        ${roomUrl},
        ${scheduledAt},
        ${notes ?? null},
        'scheduled',
        NOW(),
        NOW()
      )
      RETURNING *
    `);

    res.status(201).json(result.rows[0]);
  })
);

/**
 * GET /api/v1/teleconsultations/:id
 * Detalhe de uma teleconsulta com dados relacionados
 */
router.get(
  '/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = (req.user!)?.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const teleconsultationId = parseInt(req.params.id, 10);
    if (isNaN(teleconsultationId)) {
      return res.status(400).json({ error: 'Invalid teleconsultation ID' });
    }

    const result = await db.execute(sql`
      SELECT
        t.*,
        p.full_name  AS patient_name,
        p.phone      AS patient_phone,
        p.email      AS patient_email,
        u.full_name  AS professional_name,
        u.email      AS professional_email
      FROM teleconsultations t
      LEFT JOIN patients p ON p.id = t.patient_id
      LEFT JOIN users    u ON u.id = t.professional_id
      WHERE t.id = ${teleconsultationId}
        AND t.company_id = ${companyId}
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Teleconsultation not found' });
    }

    res.json(result.rows[0]);
  })
);

/**
 * PUT /api/v1/teleconsultations/:id/start  (also POST — alias used by frontend)
 * Marca uma teleconsulta como iniciada
 */
const startHandler = asyncHandler(async (req, res) => {
  const companyId = (req.user!)?.companyId;
  if (!companyId) {
    return res.status(403).json({ error: 'User not associated with any company' });
  }

  const teleconsultationId = parseInt(req.params.id, 10);
  if (isNaN(teleconsultationId)) {
    return res.status(400).json({ error: 'Invalid teleconsultation ID' });
  }

  const result = await db.execute(sql`
    UPDATE teleconsultations
    SET
      status     = 'in_progress',
      started_at = NOW(),
      updated_at = NOW()
    WHERE id = ${teleconsultationId}
      AND company_id = ${companyId}
      AND status = 'scheduled'
    RETURNING *
  `);

  if (result.rows.length === 0) {
    return res.status(404).json({
      error: 'Teleconsultation not found or cannot be started (must be in scheduled status)',
    });
  }

  res.json(result.rows[0]);
});

router.put('/:id/start', authCheck, startHandler);
router.post('/:id/start', authCheck, startHandler);

/**
 * PUT /api/v1/teleconsultations/:id/end  (also POST — alias used by frontend)
 * Marca uma teleconsulta como concluída e calcula duração em minutos
 */
const endHandler = asyncHandler(async (req, res) => {
  const companyId = (req.user!)?.companyId;
  if (!companyId) {
    return res.status(403).json({ error: 'User not associated with any company' });
  }

  const teleconsultationId = parseInt(req.params.id, 10);
  if (isNaN(teleconsultationId)) {
    return res.status(400).json({ error: 'Invalid teleconsultation ID' });
  }

  const { notes, clinicalNotes, observations } = req.body;

  // Buscar started_at e patient_id para calcular duração e criar evolução clínica
  const existing = await db.execute(sql`
    SELECT started_at, patient_id FROM teleconsultations
    WHERE id = ${teleconsultationId}
      AND company_id = ${companyId}
      AND status = 'in_progress'
  `);

  if (existing.rows.length === 0) {
    return res.status(404).json({
      error: 'Teleconsultation not found or not in progress',
    });
  }

  const startedAt = (existing.rows[0] as any).started_at;
  const patientId = (existing.rows[0] as any).patient_id;
  const durationMinutes = startedAt
    ? Math.round((Date.now() - new Date(startedAt).getTime()) / 60000)
    : null;

  const result = await db.execute(sql`
    UPDATE teleconsultations
    SET
      status             = 'completed',
      ended_at           = NOW(),
      duration_minutes   = ${durationMinutes},
      notes              = COALESCE(${notes ?? null}, notes),
      updated_at         = NOW()
    WHERE id = ${teleconsultationId}
      AND company_id = ${companyId}
    RETURNING *
  `);

  // If the dentist provided clinical notes, persist them as a treatment evolution record
  if (clinicalNotes && patientId) {
    const user = req.user!;
    await db.insert(treatmentEvolution).values({
      companyId,
      patientId,
      sessionDate: new Date(),
      proceduresPerformed: clinicalNotes,
      clinicalObservations: observations ?? '',
      performedBy: user.id,
    });
  }

  res.json(result.rows[0]);
});

router.put('/:id/end', authCheck, validate({ body: endTeleconsultationSchema }), endHandler);
router.post('/:id/end', authCheck, validate({ body: endTeleconsultationSchema }), endHandler);

/**
 * DELETE /api/v1/teleconsultations/:id
 * Cancela uma teleconsulta (só pode cancelar se não concluída)
 */
router.delete(
  '/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = (req.user!)?.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const teleconsultationId = parseInt(req.params.id, 10);
    if (isNaN(teleconsultationId)) {
      return res.status(400).json({ error: 'Invalid teleconsultation ID' });
    }

    const result = await db.execute(sql`
      UPDATE teleconsultations
      SET
        status     = 'cancelled',
        updated_at = NOW()
      WHERE id = ${teleconsultationId}
        AND company_id = ${companyId}
        AND status IN ('scheduled', 'in_progress')
      RETURNING id, status
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Teleconsultation not found or already completed/cancelled',
      });
    }

    res.json({ success: true, message: 'Teleconsultation cancelled successfully' });
  })
);

export default router;
