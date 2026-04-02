import { Router } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { authCheck, tenantAwareAuth, asyncHandler } from '../middleware/auth';
import { cacheMiddleware } from '../simpleCache';
import { invalidateClusterCache } from '../clusterCache';
import { validate, paginationSchema, idParamSchema, createPaginatedResponse, getOffset } from '../middleware/validation';
import {
  createPatientSchema,
  updatePatientSchema,
  searchPatientsSchema,
  createAnamnesisSchema,
  updateAnamnesisSchema,
} from '../schemas/patients.schema';

const router = Router();

/**
 * GET /api/v1/patients
 * Lista todos os pacientes da empresa (com paginação)
 */
router.get(
  '/',
  tenantAwareAuth,
  validate({ query: paginationSchema.merge(searchPatientsSchema) }),
  cacheMiddleware(300),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { page, limit, search, status } = req.query as any;
    const offset = getOffset(page, limit);

    // DB-level search and pagination
    const params: any[] = [companyId];
    let whereClause = 'WHERE company_id = $1 AND deleted_at IS NULL';
    let paramIdx = 2;

    if (search) {
      whereClause += ` AND (
        name ILIKE $${paramIdx}
        OR email ILIKE $${paramIdx}
        OR phone ILIKE $${paramIdx}
        OR cpf ILIKE $${paramIdx}
      )`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (status === 'active') {
      whereClause += ` AND active = true`;
    } else if (status === 'inactive') {
      whereClause += ` AND active = false`;
    }

    const countResult = await db.$client.query(
      `SELECT COUNT(*) FROM patients ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await db.$client.query(
      `SELECT * FROM patients ${whereClause} ORDER BY full_name ASC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    res.json(createPaginatedResponse(dataResult.rows, total, page, limit));
  })
);

/**
 * GET /api/v1/patients/:id
 * Busca um paciente específico
 */
router.get(
  '/:id',
  authCheck,
  validate({ params: idParamSchema }),
  cacheMiddleware(300),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;
    const patient = await storage.getPatient(id, companyId);

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json(patient);
  })
);

/**
 * POST /api/v1/patients
 * Cria um novo paciente
 */
router.post(
  '/',
  authCheck,
  validate({ body: createPatientSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const patient = await storage.createPatient(req.body, companyId);

    // Invalida cache
    invalidateClusterCache('api:/api/v1/patients');

    res.status(201).json(patient);
  })
);

/**
 * PATCH /api/v1/patients/:id
 * Atualiza um paciente existente
 */
router.patch(
  '/:id',
  authCheck,
  validate({
    params: idParamSchema,
    body: updatePatientSchema
  }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;
    const updatedPatient = await storage.updatePatient(id, req.body, companyId);

    // Invalida caches
    invalidateClusterCache(`api:/api/v1/patients/${id}`);
    invalidateClusterCache('api:/api/v1/patients');

    res.json(updatedPatient);
  })
);

/**
 * DELETE /api/v1/patients/:id
 * Remove um paciente (soft delete recomendado)
 */
router.delete(
  '/:id',
  authCheck,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;

    // Soft delete: mark patient as inactive
    await db.$client.query(
      `UPDATE patients SET active = false, updated_at = NOW() WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );

    invalidateClusterCache(`api:/api/v1/patients/${id}`);
    invalidateClusterCache('api:/api/v1/patients');

    res.status(204).send();
  })
);

/**
 * POST /api/v1/patients/:id/lgpd-erasure
 * LGPD Art. 18, III — Direito ao esquecimento
 *
 * Verifica retenção obrigatória (CFO Resolução 118/2012: 5 anos) antes de anonimizar.
 * Se dentro do prazo de retenção, retorna a data em que a exclusão será possível.
 * Se fora do prazo, anonimiza os dados identificáveis mantendo registros clínicos.
 */
router.post(
  '/:id/lgpd-erasure',
  authCheck,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;
    const patientId = parseInt(id, 10);

    // 1. Verificar se paciente existe
    const patientResult = await db.$client.query(
      `SELECT id, full_name, created_at FROM patients WHERE id = $1 AND company_id = $2`,
      [patientId, companyId]
    );
    if (patientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // 2. Verificar última consulta (CFO: 5 anos de retenção a partir do último atendimento)
    const lastAppointmentResult = await db.$client.query(
      `SELECT MAX(start_time) as last_visit FROM appointments
       WHERE patient_id = $1 AND company_id = $2 AND status = 'completed'`,
      [patientId, companyId]
    );

    const lastVisit = lastAppointmentResult.rows[0]?.last_visit;
    const referenceDate = lastVisit
      ? new Date(lastVisit)
      : new Date(patientResult.rows[0].created_at);

    const retentionEndDate = new Date(referenceDate);
    retentionEndDate.setFullYear(retentionEndDate.getFullYear() + 5);

    // 3. Se dentro do prazo de retenção, informar ao solicitante
    if (new Date() < retentionEndDate) {
      return res.status(409).json({
        error: 'retention_hold',
        message: `Dados sujeitos a retenção legal obrigatória (CFO Resolução 118/2012 — mínimo 5 anos). A anonimização será possível após ${retentionEndDate.toISOString().split('T')[0]}.`,
        retentionEndDate: retentionEndDate.toISOString(),
        lastVisit: lastVisit || null,
        legalBasis: 'CFO Resolução 118/2012, Art. 5 — Prontuários odontológicos devem ser mantidos por no mínimo 5 anos',
      });
    }

    // 4. Fora do prazo — anonimizar dados identificáveis
    await db.$client.query(
      `UPDATE patients SET
        full_name = '[ANONIMIZADO]',
        cpf = NULL,
        rg = NULL,
        email = NULL,
        phone = NULL,
        cellphone = NULL,
        whatsapp_phone = NULL,
        birth_date = NULL,
        address = NULL,
        neighborhood = NULL,
        city = NULL,
        state = NULL,
        cep = NULL,
        emergency_contact_name = NULL,
        emergency_contact_phone = NULL,
        profile_photo = NULL,
        notes = '[Dados anonimizados por solicitação LGPD Art. 18]',
        active = false,
        data_anonymization_date = NOW(),
        updated_at = NOW()
       WHERE id = $1 AND company_id = $2`,
      [patientId, companyId]
    );

    // 5. Registrar no audit log
    await db.$client.query(
      `INSERT INTO audit_logs (company_id, user_id, action, resource, resource_id, sensitive_data, data_category, description, lgpd_justification)
       VALUES ($1, $2, 'anonymize', 'patients', $3, true, 'health_data', 'LGPD Art. 18 - Patient data anonymized (right to erasure)', 'Solicitação de exclusão do titular dos dados — Art. 18, III da LGPD')`,
      [companyId, user.id, String(patientId)]
    );

    invalidateClusterCache(`api:/api/v1/patients/${id}`);
    invalidateClusterCache('api:/api/v1/patients');

    res.json({
      success: true,
      message: 'Dados do paciente anonimizados com sucesso conforme LGPD Art. 18.',
      patientId,
      anonymizedAt: new Date().toISOString(),
      note: 'Registros clínicos foram preservados de forma anônima para fins estatísticos.',
    });
  })
);

// =============== ANAMNESIS ROUTES ===============

/**
 * GET /api/v1/patients/:id/anamnesis
 * Busca anamnese do paciente
 */
router.get(
  '/:id/anamnesis',
  authCheck,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;
    const anamnesis = await storage.getPatientAnamnesis(id, companyId);

    res.json(anamnesis);
  })
);

/**
 * POST /api/v1/patients/:id/anamnesis
 * Cria anamnese para o paciente
 */
router.post(
  '/:id/anamnesis',
  authCheck,
  validate({
    params: idParamSchema,
    body: createAnamnesisSchema.omit({ patientId: true })
  }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;
    const anamnesis = await storage.createPatientAnamnesis({
      ...req.body,
      patientId: parseInt(id),
      companyId
    });

    res.status(201).json(anamnesis);
  })
);

// =============== EXAM ROUTES ===============

/**
 * GET /api/v1/patients/:id/exams
 * Busca exames do paciente
 */
router.get(
  '/:id/exams',
  authCheck,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;
    const exams = await storage.getPatientExams(id, companyId);

    res.json(exams);
  })
);

/**
 * POST /api/v1/patients/:id/exams
 * Cria novo exame para o paciente
 */
router.post(
  '/:id/exams',
  authCheck,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;
    const exam = await storage.createPatientExam({
      ...req.body,
      patientId: parseInt(id),
      companyId
    });

    res.status(201).json(exam);
  })
);

// =============== TREATMENT PLAN ROUTES ===============

/**
 * GET /api/v1/patients/:id/treatment-plans
 * Busca planos de tratamento do paciente
 */
router.get(
  '/:id/treatment-plans',
  authCheck,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;
    const plans = await storage.getPatientTreatmentPlans(id, companyId);

    res.json(plans);
  })
);

/**
 * POST /api/v1/patients/:id/treatment-plans
 * Cria novo plano de tratamento
 */
router.post(
  '/:id/treatment-plans',
  authCheck,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;
    const plan = await storage.createPatientTreatmentPlan({
      ...req.body,
      patientId: parseInt(id),
      companyId
    });

    res.status(201).json(plan);
  })
);

// =============== PRESCRIPTIONS ROUTES ===============

/**
 * GET /api/v1/patients/:id/prescriptions
 * Busca receitas e atestados do paciente
 */
router.get(
  '/:id/prescriptions',
  authCheck,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;
    const prescriptions = await storage.getPatientPrescriptions(parseInt(id), companyId);

    res.json(prescriptions);
  })
);

// =============== EVOLUTION ROUTES ===============

/**
 * GET /api/v1/patients/:id/evolution
 * Busca evolução do paciente
 */
router.get(
  '/:id/evolution',
  authCheck,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;
    const evolution = await storage.getPatientEvolution(id, companyId);

    res.json(evolution);
  })
);

export default router;
