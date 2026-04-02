/**
 * Rotas de Contratos - Templates e Contratos de Pacientes
 *
 * Gerencia templates de contrato reutilizáveis e contratos
 * gerados para pacientes, com suporte a variáveis dinâmicas,
 * assinatura e envio via WhatsApp/email.
 */

import { Router } from 'express';
import { authCheck, asyncHandler } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

// ==================== SCHEMAS ====================

const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  content: z.string().min(1),
  category: z.string().max(100).optional().default('general'),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
  category: z.string().max(100).optional(),
});

const generateContractSchema = z.object({
  templateId: z.number().int().positive(),
  patientId: z.number().int().positive(),
  treatmentPlanId: z.number().int().positive().optional(),
  customVariables: z.record(z.string()).optional(),
});

const sendContractSchema = z.object({
  method: z.enum(['whatsapp', 'email']).default('whatsapp'),
});

// ==================== HELPERS ====================

/**
 * Substitui variáveis no template com dados reais do paciente,
 * plano de tratamento e configurações da clínica.
 */
function replaceTemplateVariables(
  content: string,
  patient: Record<string, any>,
  treatmentPlan: Record<string, any> | null,
  clinicSettings: Record<string, any>,
  customVariables: Record<string, string> = {}
): string {
  const today = new Date().toLocaleDateString('pt-BR');

  const variables: Record<string, string> = {
    '{{paciente.nome}}': patient.full_name || patient.fullName || '',
    '{{paciente.cpf}}': patient.cpf || '',
    '{{paciente.email}}': patient.email || '',
    '{{paciente.telefone}}': patient.phone || '',
    '{{paciente.data_nascimento}}': patient.birth_date
      ? new Date(patient.birth_date).toLocaleDateString('pt-BR')
      : '',
    '{{data}}': today,
    '{{valor}}': treatmentPlan?.total_value
      ? Number(treatmentPlan.total_value).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })
      : '',
    '{{procedimentos}}': treatmentPlan?.description || treatmentPlan?.title || '',
    '{{clinica.nome}}': clinicSettings.clinic_name || clinicSettings.clinicName || '',
    '{{clinica.cnpj}}': clinicSettings.cnpj || '',
    '{{clinica.endereco}}': clinicSettings.address || '',
    '{{clinica.telefone}}': clinicSettings.phone || '',
    ...Object.fromEntries(
      Object.entries(customVariables).map(([k, v]) => [`{{${k}}}`, v])
    ),
  };

  let result = content;
  for (const [placeholder, value] of Object.entries(variables)) {
    result = result.split(placeholder).join(value);
  }
  return result;
}

// ==================== TEMPLATES ====================

/**
 * GET /api/v1/contracts/templates
 * Lista templates de contrato da empresa
 */
router.get(
  '/templates',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = (req.user as any)?.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const templates = await db.execute(sql`
      SELECT
        id,
        company_id,
        name,
        content,
        category,
        created_at,
        updated_at
      FROM contract_templates
      WHERE company_id = ${companyId}
        AND deleted_at IS NULL
      ORDER BY name ASC
    `);

    res.json(templates.rows);
  })
);

/**
 * POST /api/v1/contracts/templates
 * Cria um novo template de contrato
 */
router.post(
  '/templates',
  authCheck,
  validate({ body: createTemplateSchema }),
  asyncHandler(async (req, res) => {
    const companyId = (req.user as any)?.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { name, content, category } = req.body;

    const result = await db.execute(sql`
      INSERT INTO contract_templates (company_id, name, content, category, created_at, updated_at)
      VALUES (${companyId}, ${name}, ${content}, ${category}, NOW(), NOW())
      RETURNING *
    `);

    res.status(201).json(result.rows[0]);
  })
);

/**
 * PUT /api/v1/contracts/templates/:id
 * Atualiza um template existente
 */
router.put(
  '/templates/:id',
  authCheck,
  validate({ body: updateTemplateSchema }),
  asyncHandler(async (req, res) => {
    const companyId = (req.user as any)?.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const templateId = parseInt(req.params.id, 10);
    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    const { name, content, category } = req.body;

    // Build SET clause dynamically for only provided fields
    const setClauses: string[] = ['updated_at = NOW()'];
    if (name !== undefined) setClauses.push(`name = '${name.replace(/'/g, "''")}'`);
    if (content !== undefined) setClauses.push(`content = '${content.replace(/'/g, "''")}'`);
    if (category !== undefined) setClauses.push(`category = '${category.replace(/'/g, "''")}'`);

    const result = await db.execute(sql`
      UPDATE contract_templates
      SET
        name      = COALESCE(${name ?? null}, name),
        content   = COALESCE(${content ?? null}, content),
        category  = COALESCE(${category ?? null}, category),
        updated_at = NOW()
      WHERE id = ${templateId}
        AND company_id = ${companyId}
        AND deleted_at IS NULL
      RETURNING *
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(result.rows[0]);
  })
);

/**
 * DELETE /api/v1/contracts/templates/:id
 * Remove um template (soft delete)
 */
router.delete(
  '/templates/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = (req.user as any)?.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const templateId = parseInt(req.params.id, 10);
    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    const result = await db.execute(sql`
      UPDATE contract_templates
      SET deleted_at = NOW()
      WHERE id = ${templateId}
        AND company_id = ${companyId}
        AND deleted_at IS NULL
      RETURNING id
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ success: true, message: 'Template deleted successfully' });
  })
);

// ==================== PATIENT CONTRACTS ====================

/**
 * GET /api/v1/contracts/patient/:patientId
 * Lista contratos de um paciente
 */
router.get(
  '/patient/:patientId',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = (req.user as any)?.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const patientId = parseInt(req.params.patientId, 10);
    if (isNaN(patientId)) {
      return res.status(400).json({ error: 'Invalid patient ID' });
    }

    const contracts = await db.execute(sql`
      SELECT
        pc.*,
        ct.name AS template_name,
        ct.category AS template_category,
        p.full_name AS patient_name
      FROM patient_contracts pc
      LEFT JOIN contract_templates ct ON ct.id = pc.template_id
      LEFT JOIN patients p ON p.id = pc.patient_id
      WHERE pc.company_id = ${companyId}
        AND pc.patient_id = ${patientId}
      ORDER BY pc.created_at DESC
    `);

    res.json(contracts.rows);
  })
);

/**
 * POST /api/v1/contracts/generate
 * Gera um contrato a partir de um template, substituindo variáveis
 * com dados reais do paciente, plano de tratamento e clínica.
 */
router.post(
  '/generate',
  authCheck,
  validate({ body: generateContractSchema }),
  asyncHandler(async (req, res) => {
    const companyId = (req.user as any)?.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { templateId, patientId, treatmentPlanId, customVariables } = req.body;

    // Buscar template
    const templateResult = await db.execute(sql`
      SELECT * FROM contract_templates
      WHERE id = ${templateId}
        AND company_id = ${companyId}
        AND deleted_at IS NULL
    `);

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contract template not found' });
    }
    const template = templateResult.rows[0] as Record<string, any>;

    // Buscar paciente
    const patientResult = await db.execute(sql`
      SELECT * FROM patients
      WHERE id = ${patientId}
        AND company_id = ${companyId}
    `);

    if (patientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    const patient = patientResult.rows[0] as Record<string, any>;

    // Buscar plano de tratamento (opcional)
    let treatmentPlan: Record<string, any> | null = null;
    if (treatmentPlanId) {
      const planResult = await db.execute(sql`
        SELECT * FROM treatment_plans
        WHERE id = ${treatmentPlanId}
          AND patient_id = ${patientId}
          AND company_id = ${companyId}
      `);
      treatmentPlan = planResult.rows[0] as Record<string, any> ?? null;
    }

    // Buscar configurações da clínica
    const settingsResult = await db.execute(sql`
      SELECT * FROM company_settings
      WHERE company_id = ${companyId}
      LIMIT 1
    `);
    const clinicSettings = (settingsResult.rows[0] as Record<string, any>) ?? {};

    // Substituir variáveis no conteúdo do template
    const resolvedContent = replaceTemplateVariables(
      template.content as string,
      patient,
      treatmentPlan,
      clinicSettings,
      customVariables ?? {}
    );

    // Salvar contrato gerado
    const contractResult = await db.execute(sql`
      INSERT INTO patient_contracts (
        company_id,
        patient_id,
        template_id,
        treatment_plan_id,
        title,
        content,
        status,
        created_at,
        updated_at
      )
      VALUES (
        ${companyId},
        ${patientId},
        ${templateId},
        ${treatmentPlanId ?? null},
        ${template.name},
        ${resolvedContent},
        'draft',
        NOW(),
        NOW()
      )
      RETURNING *
    `);

    res.status(201).json(contractResult.rows[0]);
  })
);

/**
 * PUT /api/v1/contracts/:id/sign
 * Marca um contrato como assinado
 */
router.put(
  '/:id/sign',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = (req.user as any)?.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const contractId = parseInt(req.params.id, 10);
    if (isNaN(contractId)) {
      return res.status(400).json({ error: 'Invalid contract ID' });
    }

    const result = await db.execute(sql`
      UPDATE patient_contracts
      SET
        status     = 'signed',
        signed_at  = NOW(),
        updated_at = NOW()
      WHERE id = ${contractId}
        AND company_id = ${companyId}
        AND status != 'signed'
      RETURNING *
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found or already signed' });
    }

    res.json(result.rows[0]);
  })
);

/**
 * POST /api/v1/contracts/:id/send
 * Marca um contrato como enviado (via WhatsApp ou email)
 */
router.post(
  '/:id/send',
  authCheck,
  validate({ body: sendContractSchema }),
  asyncHandler(async (req, res) => {
    const companyId = (req.user as any)?.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const contractId = parseInt(req.params.id, 10);
    if (isNaN(contractId)) {
      return res.status(400).json({ error: 'Invalid contract ID' });
    }

    const { method } = req.body;

    const result = await db.execute(sql`
      UPDATE patient_contracts
      SET
        status      = 'sent',
        sent_at     = NOW(),
        sent_method = ${method},
        updated_at  = NOW()
      WHERE id = ${contractId}
        AND company_id = ${companyId}
      RETURNING *
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    res.json({
      success: true,
      message: `Contract marked as sent via ${method}`,
      contract: result.rows[0],
    });
  })
);

export default router;
