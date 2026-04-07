/**
 * Installment Calculation Routes
 *
 * Mounts under /api/v1/financial (registered via financial prefix in index.ts)
 *
 * POST /api/v1/financial/calculate-installments
 *   Calculate a single installment plan for the provided parameters.
 *
 * POST /api/v1/financial/simulate-installments
 *   Return a list of plans for every term from 1x up to maxInstallments,
 *   suitable for rendering a "choose your payment plan" UI.
 */

import { Router } from 'express';
import { z } from 'zod';
import { authCheck, asyncHandler } from '../middleware/auth';
import {
  calculateInstallments,
  simulateInstallments,
} from '../services/installment-calculator';

const router = Router();

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

/**
 * Schema for POST /calculate-installments
 *
 * totalAmount         — principal in centavos (integer, e.g. 150000 = R$ 1.500,00)
 * numInstallments     — number of installments (1–72)
 * monthlyInterestRate — monthly interest as a percentage (0–30), e.g. 2.5
 * startDate           — ISO 8601 date string for first due date (optional, defaults today)
 */
const calculateSchema = z.object({
  totalAmount: z
    .number({ required_error: 'totalAmount is required' })
    .int('totalAmount must be an integer (centavos)')
    .positive('totalAmount must be positive'),

  numInstallments: z
    .number({ required_error: 'numInstallments is required' })
    .int('numInstallments must be an integer')
    .min(1, 'numInstallments must be at least 1')
    .max(72, 'numInstallments cannot exceed 72'),

  monthlyInterestRate: z
    .number({ required_error: 'monthlyInterestRate is required' })
    .min(0, 'monthlyInterestRate must be >= 0')
    .max(30, 'monthlyInterestRate must be <= 30'),

  startDate: z
    .string()
    .datetime({ offset: true, message: 'startDate must be a valid ISO 8601 datetime' })
    .optional(),
});

/**
 * Schema for POST /simulate-installments
 *
 * totalAmount          — principal in centavos
 * maxInstallments      — upper bound for simulation (1–72, default 12)
 * defaultInterestRate  — monthly interest (%) applied from 4x onwards (default 1.99)
 * startDate            — ISO 8601 date string for first due date (optional)
 */
const simulateSchema = z.object({
  totalAmount: z
    .number({ required_error: 'totalAmount is required' })
    .int('totalAmount must be an integer (centavos)')
    .positive('totalAmount must be positive'),

  maxInstallments: z
    .number()
    .int('maxInstallments must be an integer')
    .min(1, 'maxInstallments must be at least 1')
    .max(72, 'maxInstallments cannot exceed 72')
    .optional()
    .default(12),

  defaultInterestRate: z
    .number()
    .min(0, 'defaultInterestRate must be >= 0')
    .max(30, 'defaultInterestRate must be <= 30')
    .optional()
    .default(1.99),

  startDate: z
    .string()
    .datetime({ offset: true, message: 'startDate must be a valid ISO 8601 datetime' })
    .optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/financial/calculate-installments
 *
 * Calculate a single installment plan.
 *
 * Request body:
 * {
 *   "totalAmount": 300000,          // R$ 3.000,00 in centavos
 *   "numInstallments": 6,
 *   "monthlyInterestRate": 1.99,    // 1.99% per month
 *   "startDate": "2026-05-01T00:00:00-03:00"  // optional
 * }
 *
 * Success 200:
 * {
 *   "installments": 6,
 *   "installmentValue": 52969,
 *   "totalWithInterest": 317814,
 *   "interestTotal": 17814,
 *   "schedule": [
 *     { "number": 1, "dueDate": "2026-05-01T00:00:00.000Z", "amount": 52969 },
 *     ...
 *   ]
 * }
 *
 * Error 400 — validation failure:
 * { "error": "Validation failed", "details": [...] }
 */
router.post(
  '/calculate-installments',
  authCheck,
  asyncHandler(async (req, res) => {
    const parsed = calculateSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    const { totalAmount, numInstallments, monthlyInterestRate, startDate } = parsed.data;

    const start = startDate ? new Date(startDate) : new Date();

    const plan = calculateInstallments(totalAmount, numInstallments, monthlyInterestRate, start);

    return res.status(200).json(plan);
  }),
);

/**
 * POST /api/v1/financial/simulate-installments
 *
 * Simulate all installment options from 1x to maxInstallments.
 * Installments 1–3 use 0% interest; 4+ use defaultInterestRate.
 *
 * Request body:
 * {
 *   "totalAmount": 300000,
 *   "maxInstallments": 12,          // optional, default 12
 *   "defaultInterestRate": 1.99,    // optional, default 1.99
 *   "startDate": "2026-05-01T00:00:00-03:00"  // optional
 * }
 *
 * Success 200:
 * [
 *   {
 *     "installments": 1,
 *     "installmentValue": 300000,
 *     "totalWithInterest": 300000,
 *     "interestTotal": 0,
 *     "schedule": [...]
 *   },
 *   {
 *     "installments": 2,
 *     ...
 *   },
 *   ...
 * ]
 *
 * Error 400 — validation failure:
 * { "error": "Validation failed", "details": [...] }
 */
router.post(
  '/simulate-installments',
  authCheck,
  asyncHandler(async (req, res) => {
    const parsed = simulateSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    const { totalAmount, maxInstallments, defaultInterestRate, startDate } = parsed.data;

    const start = startDate ? new Date(startDate) : new Date();

    const plans = simulateInstallments(totalAmount, maxInstallments, defaultInterestRate, start);

    return res.status(200).json(plans);
  }),
);

export default router;
