import { Router } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { authCheck, tenantAwareAuth, asyncHandler } from '../middleware/auth';
import { cacheMiddleware } from '../simpleCache';
import { invalidateClusterCache } from '../clusterCache';
import { validate, paginationSchema, idParamSchema, createPaginatedResponse, getOffset } from '../middleware/validation';
import { logger } from '../logger';
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
    const user = req.user!;
    const companyId = user.companyId;

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
    const user = req.user!;
    const companyId = user.companyId;

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
    const user = req.user!;
    const companyId = user.companyId;

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
    const user = req.user!;
    const companyId = user.companyId;

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
    const user = req.user!;
    const companyId = user.companyId;

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
    const user = req.user!;
    const companyId = user.companyId;

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
    const user = req.user!;
    const companyId = user.companyId;

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
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;
    const anamnesis = await storage.createPatientAnamnesis({
      ...req.body,
      patientId: parseInt(id),
      companyId,
      createdBy: user.id,
    });

    res.status(201).json(anamnesis);
  })
);

/**
 * PATCH /api/v1/patients/:id/anamnesis/:anamnesisId
 * Atualiza anamnese existente e cria snapshot de versão antes da alteração.
 * Aceita o campo opcional `changeReason` no body para registrar o motivo.
 */
router.patch(
  '/:id/anamnesis/:anamnesisId',
  authCheck,
  validate({ body: updateAnamnesisSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const anamnesisId = parseInt(req.params.anamnesisId, 10);
    if (isNaN(anamnesisId) || anamnesisId < 1) {
      return res.status(400).json({ error: 'ID de anamnese inválido' });
    }

    const { changeReason, ...updateData } = req.body;

    const updated = await storage.updatePatientAnamnesis(
      anamnesisId,
      updateData,
      companyId,
      {
        changedBy: user.id,
        changeReason: changeReason ?? undefined,
        ipAddress: req.ip,
      }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Anamnese não encontrada' });
    }

    res.json(updated);
  })
);

/**
 * GET /api/v1/patients/:id/anamnesis/:anamnesisId/history
 * Retorna o histórico completo de versões da anamnese (mais recente primeiro).
 */
router.get(
  '/:id/anamnesis/:anamnesisId/history',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const anamnesisId = parseInt(req.params.anamnesisId, 10);
    if (isNaN(anamnesisId)) {
      return res.status(400).json({ error: 'ID de anamnese inválido' });
    }

    const history = await storage.getAnamnesisVersionHistory(anamnesisId, companyId);
    res.json({ data: history });
  })
);

/**
 * GET /api/v1/patients/:id/anamnesis/:anamnesisId/version/:versionNumber
 * Retorna o snapshot de uma versão específica da anamnese.
 */
router.get(
  '/:id/anamnesis/:anamnesisId/version/:versionNumber',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const anamnesisId = parseInt(req.params.anamnesisId, 10);
    const versionNumber = parseInt(req.params.versionNumber, 10);

    if (isNaN(anamnesisId) || isNaN(versionNumber)) {
      return res.status(400).json({ error: 'Parâmetros inválidos' });
    }

    const version = await storage.getAnamnesisVersion(anamnesisId, versionNumber, companyId);

    if (!version) {
      return res.status(404).json({ error: 'Versão não encontrada' });
    }

    res.json(version);
  })
);

/**
 * GET /api/v1/patients/:id/anamnesis/:anamnesisId/diff/:v1/:v2
 * Compara dois snapshots de versões da anamnese.
 * Retorna a lista de campos que mudaram com os valores antes e depois.
 */
router.get(
  '/:id/anamnesis/:anamnesisId/diff/:v1/:v2',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const anamnesisId = parseInt(req.params.anamnesisId, 10);
    const v1 = parseInt(req.params.v1, 10);
    const v2 = parseInt(req.params.v2, 10);

    if (isNaN(anamnesisId) || isNaN(v1) || isNaN(v2)) {
      return res.status(400).json({ error: 'Parâmetros inválidos' });
    }

    const [version1, version2] = await Promise.all([
      storage.getAnamnesisVersion(anamnesisId, v1, companyId),
      storage.getAnamnesisVersion(anamnesisId, v2, companyId),
    ]);

    if (!version1 || !version2) {
      return res.status(404).json({ error: 'Uma ou ambas as versões não encontradas' });
    }

    const snap1: Record<string, unknown> = version1.snapshot as Record<string, unknown>;
    const snap2: Record<string, unknown> = version2.snapshot as Record<string, unknown>;

    const allKeys = new Set([...Object.keys(snap1), ...Object.keys(snap2)]);
    const changes: { field: string; old: unknown; new: unknown }[] = [];
    for (const key of allKeys) {
      if (JSON.stringify(snap1[key]) !== JSON.stringify(snap2[key])) {
        changes.push({ field: key, old: snap1[key], new: snap2[key] });
      }
    }

    res.json({
      anamnesisId,
      version1: v1,
      version2: v2,
      changes,
    });
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
    const user = req.user!;
    const companyId = user.companyId;

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
    const user = req.user!;
    const companyId = user.companyId;

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
    const user = req.user!;
    const companyId = user.companyId;

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
    const user = req.user!;
    const companyId = user.companyId;

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

/**
 * PATCH /api/v1/patients/:id/treatment-plans/:planId
 * Atualiza plano de tratamento. Quando o status muda para 'approved',
 * gera automaticamente entradas em contas a receber (accounts_receivable).
 */
router.patch(
  '/:id/treatment-plans/:planId',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const patientId = parseInt(req.params.id, 10);
    const planId = parseInt(req.params.planId, 10);

    if (isNaN(patientId) || isNaN(planId)) {
      return res.status(400).json({ error: 'Invalid patient or plan ID' });
    }

    // Fetch current plan to capture previousStatus before update
    const existing = await db.$client.query(
      `SELECT id, status, estimated_cost, approved_cost, patient_id
       FROM detailed_treatment_plans
       WHERE id = $1
         AND company_id = $2
         AND deleted_at IS NULL`,
      [planId, companyId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Treatment plan not found' });
    }

    const previousStatus: string = existing.rows[0].status;

    const updatedPlan = await storage.updatePatientTreatmentPlan(planId, req.body, companyId);

    if (!updatedPlan) {
      return res.status(404).json({ error: 'Treatment plan not found or update failed' });
    }

    // Auto-generate accounts_receivable when status transitions to 'approved'
    if (updatedPlan.status === 'approved' && previousStatus !== 'approved') {
      try {
        // Use approvedCost if set, otherwise estimatedCost; both stored in cents
        const totalCents: number =
          (updatedPlan.approvedCost ?? updatedPlan.estimatedCost) || 0;

        if (totalCents > 0) {
          // Default to a single installment; the caller may pass installments via body
          const installments: number = Math.max(1, parseInt(req.body.installments ?? '1', 10));
          const installmentValue = Math.floor(totalCents / installments);
          const remainder = totalCents - installmentValue * installments;

          const baseDate = new Date();

          const insertValues: string[] = [];
          const insertParams: unknown[] = [];
          let paramIdx = 1;

          for (let i = 0; i < installments; i++) {
            const dueDate = new Date(baseDate);
            dueDate.setMonth(dueDate.getMonth() + i);
            const amount = i === 0 ? installmentValue + remainder : installmentValue;

            insertValues.push(
              `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6}, $${paramIdx + 7}, $${paramIdx + 8})`
            );
            insertParams.push(
              companyId,
              updatedPlan.patientId,
              planId,
              `Plano de tratamento — parcela ${i + 1}/${installments}`,
              amount,
              dueDate.toISOString().split('T')[0],
              'pending',
              i + 1,
              installments
            );
            paramIdx += 9;
          }

          await db.$client.query(
            `INSERT INTO accounts_receivable
               (company_id, patient_id, treatment_plan_id, description, amount,
                due_date, status, installment_number, total_installments)
             VALUES ${insertValues.join(', ')}`,
            insertParams
          );
        }
      } catch (err) {
        logger.error({ err: err }, 'Auto-generate receivables error:');
        // Do not block the response — receivables generation is a side-effect
      }
    }

    res.json(updatedPlan);
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
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;
    const prescriptions = await storage.getPatientPrescriptions(parseInt(id), companyId);

    res.json(prescriptions);
  })
);

// =============== LGPD ROUTES ===============

/**
 * GET /api/v1/patients/:id/lgpd-export
 * Exporta TODOS os dados pessoais e de saúde do paciente em formato JSON.
 * Atende ao Art. 18, V da LGPD (portabilidade dos dados).
 *
 * A resposta é entregue como arquivo para download
 * (Content-Disposition: attachment).
 */
router.get(
  '/:id/lgpd-export',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const patientId = parseInt(req.params.id, 10);
    if (isNaN(patientId)) {
      return res.status(400).json({ error: 'Invalid patient ID' });
    }

    // Fetch all data in parallel — each query is tenant-scoped via company_id
    const [
      patientResult,
      appointmentsResult,
      anamnesisResult,
      prescriptionsResult,
      evolutionResult,
      paymentsResult,
    ] = await Promise.all([
      db.$client.query(
        `SELECT * FROM patients WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
        [patientId, companyId]
      ),
      db.$client.query(
        `SELECT * FROM appointments WHERE patient_id = $1 AND company_id = $2`,
        [patientId, companyId]
      ),
      db.$client.query(
        `SELECT * FROM anamnesis WHERE patient_id = $1 AND company_id = $2`,
        [patientId, companyId]
      ),
      db.$client.query(
        `SELECT * FROM prescriptions WHERE patient_id = $1 AND company_id = $2`,
        [patientId, companyId]
      ),
      db.$client.query(
        `SELECT * FROM treatment_evolution WHERE patient_id = $1 AND company_id = $2`,
        [patientId, companyId]
      ),
      // financial_transactions uses customer_id for patient reference
      db.$client.query(
        `SELECT * FROM financial_transactions WHERE customer_id = $1 AND company_id = $2`,
        [patientId, companyId]
      ),
    ]);

    if (!patientResult.rows.length) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      legalBasis: 'LGPD Art. 18, V — Portabilidade dos dados',
      requestedBy: {
        userId: user.id,
        userName: user.fullName || user.email,
      },
      patient: patientResult.rows[0],
      appointments: appointmentsResult.rows,
      healthRecords: {
        anamnesis: anamnesisResult.rows,
        evolution: evolutionResult.rows,
      },
      prescriptions: prescriptionsResult.rows,
      financialHistory: paymentsResult.rows,
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="dados_paciente_${patientId}_lgpd.json"`
    );
    res.json(exportData);
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
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;
    const evolution = await storage.getPatientEvolution(id, companyId);

    res.json(evolution);
  })
);

export default router;
