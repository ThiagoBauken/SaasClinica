/**
 * Patient Payments Routes
 * PIX, Boleto e Cartao para pagamentos de pacientes (tratamentos/procedimentos)
 * Usa MercadoPago como gateway
 */

import { Router } from 'express';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { z } from 'zod';
import { authCheck, asyncHandler } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { db } from '../db';
import { payments, patients, treatmentPlans } from '@shared/schema';
import { eq, and, desc, gte, lte } from 'drizzle-orm';

import { logger } from '../logger';
const router = Router();

// MercadoPago client
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
});
const mpPayment = new Payment(mpClient);

// Schemas
const createPaymentSchema = z.object({
  patientId: z.number().int().positive(),
  amount: z.number().positive(), // em centavos
  description: z.string().min(1),
  paymentMethod: z.enum(['pix', 'boleto', 'credit_card']),
  treatmentPlanId: z.number().int().positive().optional(),
  installments: z.number().int().min(1).max(12).optional(),
});

const paymentIdSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

/**
 * POST /api/v1/patient-payments/create
 * Gera cobranca PIX, Boleto ou Cartao para um paciente
 */
router.post(
  '/create',
  authCheck,
  validate({ body: createPaymentSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;
    if (!companyId) return res.status(403).json({ error: 'Empresa nao identificada' });

    const { patientId, amount, description, paymentMethod, treatmentPlanId, installments } = req.body;

    // Buscar paciente
    const [patient] = await db
      .select()
      .from(patients)
      .where(and(eq(patients.id, patientId), eq(patients.companyId, companyId)))
      .limit(1);

    if (!patient) return res.status(404).json({ error: 'Paciente nao encontrado' });

    const amountDecimal = amount / 100;

    // Criar pagamento no MercadoPago
    const paymentBody: any = {
      transaction_amount: amountDecimal,
      description,
      payment_method_id: paymentMethod === 'pix' ? 'pix' : paymentMethod === 'boleto' ? 'boleto' : undefined,
      installments: paymentMethod === 'credit_card' ? (installments || 1) : 1,
      payer: {
        email: patient.email || `paciente${patient.id}@clinica.local`,
        first_name: patient.fullName.split(' ')[0],
        last_name: patient.fullName.split(' ').slice(1).join(' ') || '',
        identification: patient.cpf ? { type: 'CPF', number: patient.cpf.replace(/\D/g, '') } : undefined,
      },
      external_reference: `patient-${patientId}-company-${companyId}-${Date.now()}`,
      notification_url: `${process.env.BASE_URL || 'https://app.example.com'}/api/webhooks/mercadopago`,
    };

    try {
      const mpResponse = await mpPayment.create({ body: paymentBody });

      // Salvar no banco
      const [savedPayment] = await db
        .insert(payments)
        .values({
          companyId,
          patientId,
          amount,
          method: paymentMethod,
          status: 'pending',
          mercadoPagoId: String(mpResponse.id),
          appointmentId: null,
        })
        .returning();

      const mpAny = mpResponse as any;

      // Atualizar tratamento se vinculado
      if (treatmentPlanId) {
        const [plan] = await db
          .select()
          .from(treatmentPlans)
          .where(and(eq(treatmentPlans.id, treatmentPlanId), eq(treatmentPlans.companyId, companyId)))
          .limit(1);
        if (plan) {
          await db
            .update(treatmentPlans)
            .set({ paidAmount: (plan.paidAmount || 0) + amount })
            .where(eq(treatmentPlans.id, treatmentPlanId));
        }
      }

      res.status(201).json({
        success: true,
        payment: savedPayment,
        pixQrCode: mpAny.point_of_interaction?.transaction_data?.qr_code,
        pixQrCodeBase64: mpAny.point_of_interaction?.transaction_data?.qr_code_base64,
        boletoUrl: mpAny.transaction_details?.external_resource_url,
        paymentLink: mpAny.init_point,
        mpPaymentId: mpResponse.id,
      });
    } catch (error: any) {
      logger.error({ err: error }, '[PatientPayments] MercadoPago error:');
      res.status(500).json({ error: 'Erro ao gerar cobranca', details: error.message });
    }
  }),
);

/**
 * GET /api/v1/patient-payments
 * Lista todos os pagamentos de pacientes da empresa (tenant isolated).
 *
 * Query params (all optional):
 *   patientId  - filter by a specific patient (integer)
 *   status     - filter by status: pending | confirmed | failed
 *   dateFrom   - ISO date string, inclusive lower bound on paymentDate
 *   dateTo     - ISO date string, inclusive upper bound on paymentDate
 */
router.get(
  '/',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;
    if (!companyId) return res.status(403).json({ error: 'Empresa nao identificada' });

    const { patientId, status, dateFrom, dateTo } = req.query as Record<string, string | undefined>;

    // Build filter conditions incrementally
    const conditions = [eq(payments.companyId, companyId)];

    if (patientId) {
      const pid = parseInt(patientId, 10);
      if (isNaN(pid)) return res.status(400).json({ error: 'patientId deve ser um numero inteiro' });
      conditions.push(eq(payments.patientId, pid));
    }

    if (status) {
      if (!['pending', 'confirmed', 'failed'].includes(status)) {
        return res.status(400).json({ error: 'status invalido. Use: pending, confirmed ou failed' });
      }
      conditions.push(eq(payments.status, status));
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      if (isNaN(from.getTime())) return res.status(400).json({ error: 'dateFrom invalido' });
      conditions.push(gte(payments.paymentDate, from));
    }

    if (dateTo) {
      const to = new Date(dateTo);
      if (isNaN(to.getTime())) return res.status(400).json({ error: 'dateTo invalido' });
      // End of the day for the upper bound so the full date is included
      to.setHours(23, 59, 59, 999);
      conditions.push(lte(payments.paymentDate, to));
    }

    const rows = await db
      .select({
        id: payments.id,
        companyId: payments.companyId,
        patientId: payments.patientId,
        patientName: patients.fullName,
        appointmentId: payments.appointmentId,
        amount: payments.amount,
        status: payments.status,
        paymentDate: payments.paymentDate,
        paymentMethod: payments.paymentMethod,
        mercadoPagoId: payments.mercadoPagoId,
        description: payments.description,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .leftJoin(patients, eq(payments.patientId, patients.id))
      .where(and(...conditions))
      .orderBy(desc(payments.createdAt));

    res.json({ data: rows });
  }),
);

/**
 * GET /api/v1/patient-payments/:patientId
 * Lista pagamentos de um paciente
 */
router.get(
  '/:patientId',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;
    if (!companyId) return res.status(403).json({ error: 'Empresa nao identificada' });

    const patientId = parseInt(req.params.patientId);

    const patientPayments = await db
      .select()
      .from(payments)
      .where(and(eq(payments.companyId, companyId), eq(payments.patientId, patientId)))
      .orderBy(desc(payments.createdAt));

    res.json({ data: patientPayments });
  }),
);

/**
 * GET /api/v1/patient-payments/status/:transactionId
 * Verifica status de um pagamento no MercadoPago
 */
router.get(
  '/status/:transactionId',
  authCheck,
  asyncHandler(async (req, res) => {
    const { transactionId } = req.params;

    try {
      const mpResponse = await mpPayment.get({ id: transactionId });

      // Atualizar status no banco
      const newStatus = mpResponse.status === 'approved' ? 'completed'
        : mpResponse.status === 'rejected' ? 'failed'
        : mpResponse.status === 'cancelled' ? 'failed'
        : 'pending';

      await db
        .update(payments)
        .set({ status: newStatus })
        .where(eq(payments.mercadoPagoId, transactionId));

      res.json({
        status: newStatus,
        mpStatus: mpResponse.status,
        mpStatusDetail: mpResponse.status_detail,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Erro ao verificar status', details: error.message });
    }
  }),
);

export default router;
