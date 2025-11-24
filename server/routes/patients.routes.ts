import { Router } from 'express';
import { storage } from '../storage';
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

    // TODO: Implementar busca e filtros no storage
    const patients = await storage.getPatients(companyId);

    // Filtragem básica (deve ser movida para o storage/query layer)
    let filteredPatients = patients;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredPatients = patients.filter((p: any) =>
        p.name?.toLowerCase().includes(searchLower) ||
        p.email?.toLowerCase().includes(searchLower) ||
        p.phone?.includes(searchLower)
      );
    }

    const total = filteredPatients.length;
    const paginatedData = filteredPatients.slice(offset, offset + limit);

    res.json(createPaginatedResponse(paginatedData, total, page, limit));
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

    // TODO: Implementar soft delete no storage
    // await storage.deletePatient(id, companyId);

    invalidateClusterCache(`api:/api/v1/patients/${id}`);
    invalidateClusterCache('api:/api/v1/patients');

    res.status(204).send();
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
