/**
 * Financial Integration Routes — /api/financial/* (legacy paths)
 *
 * Handles financial transactions created from appointments, treatment plan
 * creation, payment processing with fee calculation, and installment scheduling.
 *
 * These routes mount at /api/financial/ (not /api/v1/financial/) to preserve
 * existing frontend contracts. The modular /api/v1/financial routes handle
 * direct transaction CRUD.
 */
import { Router } from 'express';
import { storage } from '../storage';
import { authCheck, asyncHandler } from '../middleware/auth';
import { tenantIsolationMiddleware } from '../tenantMiddleware';
import { logger } from '../logger';

const router = Router();

/**
 * POST /api/financial/create-from-appointment/:appointmentId
 * Creates financial transactions from a completed appointment.
 */
router.post(
  '/create-from-appointment/:appointmentId',
  authCheck,
  tenantIsolationMiddleware,
  asyncHandler(async (req, res) => {
    const { financialIntegration } = await import('../financialIntegration');
    const appointmentId = parseInt(req.params.appointmentId);

    if (!appointmentId) {
      return res.status(400).json({ error: 'ID do agendamento é obrigatório' });
    }

    const transactions =
      await financialIntegration.createFinancialTransactionsFromAppointment(appointmentId);

    res.status(201).json({
      message: 'Transações financeiras criadas com sucesso',
      transactions,
    });
  })
);

/**
 * GET /api/financial/patient/:patientId/summary
 * Returns a financial summary for a specific patient.
 */
router.get(
  '/patient/:patientId/summary',
  authCheck,
  tenantIsolationMiddleware,
  asyncHandler(async (req, res) => {
    const { financialIntegration } = await import('../financialIntegration');
    const user = req.user!;
    const patientId = parseInt(req.params.patientId);

    if (!patientId) {
      return res.status(400).json({ error: 'ID do paciente é obrigatório' });
    }

    const summary = await financialIntegration.getPatientFinancialSummary(
      patientId,
      user.companyId
    );
    res.json(summary);
  })
);

/**
 * POST /api/financial/treatment-plans
 * Creates a treatment plan with its financial breakdown.
 */
router.post(
  '/treatment-plans',
  authCheck,
  tenantIsolationMiddleware,
  asyncHandler(async (req, res) => {
    const { financialIntegration } = await import('../financialIntegration');
    const user = req.user!;
    const { patientId, procedures, paymentPlan } = req.body;

    if (!patientId || !procedures || !Array.isArray(procedures)) {
      return res.status(400).json({ error: 'Dados inválidos para criar plano de tratamento' });
    }

    const treatmentPlan = await financialIntegration.createTreatmentPlan(
      patientId,
      user.companyId,
      procedures,
      paymentPlan
    );

    res.status(201).json({
      message: 'Plano de tratamento criado com sucesso',
      treatmentPlan,
    });
  })
);

/**
 * POST /api/financial/process-payment
 * Processes a payment with machine fee calculation.
 */
router.post(
  '/process-payment',
  authCheck,
  tenantIsolationMiddleware,
  asyncHandler(async (req, res) => {
    const { financialIntegration } = await import('../financialIntegration');
    const user = req.user!;
    const { transactionId, paymentAmount, paymentMethod } = req.body;

    if (!transactionId || !paymentAmount || !paymentMethod) {
      return res.status(400).json({ error: 'Dados de pagamento incompletos' });
    }

    const result = await financialIntegration.processPayment(
      transactionId,
      paymentAmount,
      paymentMethod,
      user.companyId
    );

    res.json({ message: 'Pagamento processado com sucesso', payment: result });
  })
);

/**
 * POST /api/financial/calculate-fees
 * Calculates payment machine fees for a given amount and payment method.
 */
router.post(
  '/calculate-fees',
  authCheck,
  asyncHandler(async (req, res) => {
    const { financialIntegration } = await import('../financialIntegration');
    const { amount, paymentMethod } = req.body;

    if (!amount || !paymentMethod) {
      return res.status(400).json({ error: 'Valor e método de pagamento são obrigatórios' });
    }

    const feeCalculation = financialIntegration.calculatePaymentMachineFees(amount, paymentMethod);
    res.json(feeCalculation);
  })
);

/**
 * POST /api/financial/generate-installments
 * Generates an installment payment schedule.
 */
router.post(
  '/generate-installments',
  authCheck,
  asyncHandler(async (req, res) => {
    const { financialIntegration } = await import('../financialIntegration');
    const { totalAmount, installments, startDate, interval = 'monthly' } = req.body;

    if (!totalAmount || !installments || !startDate) {
      return res.status(400).json({ error: 'Dados incompletos para gerar parcelas' });
    }

    const schedule = financialIntegration.generateInstallmentSchedule(
      totalAmount,
      installments,
      startDate,
      interval
    );

    res.json({
      message: 'Cronograma de parcelas gerado com sucesso',
      schedule,
    });
  })
);

export default router;
