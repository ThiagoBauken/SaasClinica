/**
 * Insurance / Convenios Management Routes
 * Gestao de convenios odontologicos com suporte TISS
 */

import { Router } from 'express';
import { z } from 'zod';
import { authCheck, asyncHandler } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { db } from '../db';
import { sql, eq, and } from 'drizzle-orm';

const router = Router();

function getCompanyId(req: any): number {
  return (req.user as any)?.companyId;
}

// ============================================================
// Insurance Plans (Convenios)
// ============================================================

const planSchema = z.object({
  name: z.string().min(1),
  ansCode: z.string().optional(),
  planType: z.enum(['dental', 'medical', 'both']).optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
  tissVersion: z.string().optional(),
  paymentDeadlineDays: z.number().int().optional(),
  notes: z.string().optional(),
});

router.get('/plans', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const result = await db.execute(sql`
    SELECT ip.*,
      (SELECT COUNT(*) FROM patient_insurance pi WHERE pi.insurance_plan_id = ip.id AND pi.active = true) as patient_count,
      (SELECT COUNT(*) FROM insurance_claims ic WHERE ic.insurance_plan_id = ip.id AND ic.status = 'pending') as pending_claims
    FROM insurance_plans ip
    WHERE ip.company_id = ${companyId} AND ip.active = true
    ORDER BY ip.name
  `);
  res.json({ data: result.rows });
}));

router.post('/plans', authCheck, validate({ body: planSchema }), asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const result = await db.execute(sql`
    INSERT INTO insurance_plans (company_id, name, ans_code, plan_type, contact_phone, contact_email, tiss_version, payment_deadline_days, notes)
    VALUES (${companyId}, ${req.body.name}, ${req.body.ansCode || null}, ${req.body.planType || 'dental'}, ${req.body.contactPhone || null}, ${req.body.contactEmail || null}, ${req.body.tissVersion || '3.05.00'}, ${req.body.paymentDeadlineDays || 30}, ${req.body.notes || null})
    RETURNING *
  `);
  res.status(201).json({ data: result.rows[0] });
}));

router.put('/plans/:id', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const id = parseInt(req.params.id);
  const { name, ansCode, contactPhone, contactEmail, tissVersion, paymentDeadlineDays, notes } = req.body;
  const result = await db.execute(sql`
    UPDATE insurance_plans SET name = COALESCE(${name}, name), ans_code = COALESCE(${ansCode}, ans_code),
      contact_phone = COALESCE(${contactPhone}, contact_phone), contact_email = COALESCE(${contactEmail}, contact_email),
      tiss_version = COALESCE(${tissVersion}, tiss_version), payment_deadline_days = COALESCE(${paymentDeadlineDays}, payment_deadline_days),
      notes = COALESCE(${notes}, notes), updated_at = NOW()
    WHERE id = ${id} AND company_id = ${companyId} RETURNING *
  `);
  res.json({ data: result.rows[0] });
}));

router.delete('/plans/:id', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  await db.execute(sql`UPDATE insurance_plans SET active = false WHERE id = ${parseInt(req.params.id)} AND company_id = ${companyId}`);
  res.json({ success: true });
}));

// ============================================================
// Insurance Procedures (Tabela TUSS por convenio)
// ============================================================

const procedureSchema = z.object({
  insurancePlanId: z.number().int().positive(),
  tussCode: z.string().min(1),
  description: z.string().min(1),
  coveredValue: z.number().int().optional(),
  patientCopay: z.number().int().optional(),
  requiresAuthorization: z.boolean().optional(),
});

router.get('/procedures/:planId', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const planId = parseInt(req.params.planId);
  const result = await db.execute(sql`
    SELECT * FROM insurance_procedures
    WHERE company_id = ${companyId} AND insurance_plan_id = ${planId} AND active = true
    ORDER BY tuss_code
  `);
  res.json({ data: result.rows });
}));

router.post('/procedures', authCheck, validate({ body: procedureSchema }), asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const { insurancePlanId, tussCode, description, coveredValue, patientCopay, requiresAuthorization } = req.body;
  const result = await db.execute(sql`
    INSERT INTO insurance_procedures (company_id, insurance_plan_id, tuss_code, description, covered_value, patient_copay, requires_authorization)
    VALUES (${companyId}, ${insurancePlanId}, ${tussCode}, ${description}, ${coveredValue || 0}, ${patientCopay || 0}, ${requiresAuthorization || false})
    RETURNING *
  `);
  res.status(201).json({ data: result.rows[0] });
}));

// ============================================================
// Patient Insurance (Vinculo paciente-convenio)
// ============================================================

const patientInsuranceSchema = z.object({
  patientId: z.number().int().positive(),
  insurancePlanId: z.number().int().positive(),
  cardNumber: z.string().min(1),
  holderName: z.string().optional(),
  holderCpf: z.string().optional(),
  planName: z.string().optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
});

router.get('/patient/:patientId', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const patientId = parseInt(req.params.patientId);
  const result = await db.execute(sql`
    SELECT pi.*, ip.name as plan_name_display
    FROM patient_insurance pi
    JOIN insurance_plans ip ON pi.insurance_plan_id = ip.id
    WHERE pi.company_id = ${companyId} AND pi.patient_id = ${patientId} AND pi.active = true
  `);
  res.json({ data: result.rows });
}));

router.post('/patient-insurance', authCheck, validate({ body: patientInsuranceSchema }), asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const { patientId, insurancePlanId, cardNumber, holderName, holderCpf, planName, validFrom, validUntil } = req.body;
  const result = await db.execute(sql`
    INSERT INTO patient_insurance (company_id, patient_id, insurance_plan_id, card_number, holder_name, holder_cpf, plan_name, valid_from, valid_until)
    VALUES (${companyId}, ${patientId}, ${insurancePlanId}, ${cardNumber}, ${holderName || null}, ${holderCpf || null}, ${planName || null}, ${validFrom ? sql`${validFrom}::date` : sql`null`}, ${validUntil ? sql`${validUntil}::date` : sql`null`})
    RETURNING *
  `);
  res.status(201).json({ data: result.rows[0] });
}));

// ============================================================
// Insurance Claims (Guias TISS)
// ============================================================

const claimSchema = z.object({
  patientId: z.number().int().positive(),
  insurancePlanId: z.number().int().positive(),
  claimType: z.enum(['consultation', 'sp_sadt', 'summary']).optional(),
  tussCode: z.string().optional(),
  procedureDescription: z.string().optional(),
  toothNumber: z.string().optional(),
  toothFace: z.string().optional(),
  quantity: z.number().int().optional(),
  claimedValue: z.number().int().optional(),
  serviceDate: z.string().optional(),
});

router.get('/claims', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const status = req.query.status as string;
  const planId = req.query.planId ? parseInt(req.query.planId as string) : null;

  // Parameterized query — safe from SQL injection
  const params: any[] = [companyId];
  let query = `SELECT ic.*, pt.full_name as patient_name, ip.name as plan_name
    FROM insurance_claims ic
    JOIN patients pt ON ic.patient_id = pt.id
    JOIN insurance_plans ip ON ic.insurance_plan_id = ip.id
    WHERE ic.company_id = $1`;
  if (status) {
    params.push(status);
    query += ` AND ic.status = $${params.length}`;
  }
  if (planId) {
    params.push(planId);
    query += ` AND ic.insurance_plan_id = $${params.length}`;
  }
  query += ` ORDER BY ic.created_at DESC LIMIT 100`;

  const result = await db.$client.query(query, params);
  res.json({ data: result.rows });
}));

router.post('/claims', authCheck, validate({ body: claimSchema }), asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const user = req.user as any;
  const { patientId, insurancePlanId, claimType, tussCode, procedureDescription, toothNumber, toothFace, quantity, claimedValue, serviceDate } = req.body;

  const guideNumber = `G${companyId}-${Date.now()}`;

  const result = await db.execute(sql`
    INSERT INTO insurance_claims (company_id, patient_id, insurance_plan_id, professional_id, claim_type, guide_number, tuss_code, procedure_description, tooth_number, tooth_face, quantity, claimed_value, service_date)
    VALUES (${companyId}, ${patientId}, ${insurancePlanId}, ${user.id}, ${claimType || 'consultation'}, ${guideNumber}, ${tussCode || null}, ${procedureDescription || null}, ${toothNumber || null}, ${toothFace || null}, ${quantity || 1}, ${claimedValue || 0}, ${serviceDate ? sql`${serviceDate}::date` : sql`CURRENT_DATE`})
    RETURNING *
  `);
  res.status(201).json({ data: result.rows[0] });
}));

router.put('/claims/:id/status', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);
  const id = parseInt(req.params.id);
  const { status, approvedValue, glosaValue, glosaReason, authorizationNumber } = req.body;

  await db.execute(sql`
    UPDATE insurance_claims SET
      status = ${status}, approved_value = COALESCE(${approvedValue}, approved_value),
      glosa_value = COALESCE(${glosaValue}, glosa_value), glosa_reason = COALESCE(${glosaReason}, glosa_reason),
      authorization_number = COALESCE(${authorizationNumber}, authorization_number),
      response_at = CASE WHEN ${status} IN ('authorized', 'denied', 'paid') THEN NOW() ELSE response_at END,
      updated_at = NOW()
    WHERE id = ${id} AND company_id = ${companyId}
  `);
  res.json({ success: true });
}));

// ============================================================
// Insurance Dashboard / Faturamento
// ============================================================

router.get('/dashboard', authCheck, asyncHandler(async (req, res) => {
  const companyId = getCompanyId(req);

  const result = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM insurance_plans WHERE company_id = ${companyId} AND active = true) as total_plans,
      (SELECT COUNT(*) FROM patient_insurance WHERE company_id = ${companyId} AND active = true) as total_patients_with_insurance,
      (SELECT COUNT(*) FROM insurance_claims WHERE company_id = ${companyId} AND status = 'pending') as pending_claims,
      (SELECT COALESCE(SUM(claimed_value), 0) FROM insurance_claims WHERE company_id = ${companyId} AND status = 'pending') as pending_value,
      (SELECT COALESCE(SUM(approved_value), 0) FROM insurance_claims WHERE company_id = ${companyId} AND status = 'paid' AND response_at >= date_trunc('month', NOW())) as paid_this_month,
      (SELECT COALESCE(SUM(glosa_value), 0) FROM insurance_claims WHERE company_id = ${companyId} AND response_at >= date_trunc('month', NOW())) as glosa_this_month
  `);
  res.json({ data: result.rows[0] });
}));

export default router;
