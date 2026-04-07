/**
 * Installment Calculator Service
 *
 * Provides PMT-based installment calculations for dental treatment plans.
 * All monetary values are handled in centavos (integer) to avoid floating-point
 * drift. Rounding adjustments are absorbed by the final installment.
 *
 * Formula used (Price / Tabela Price):
 *   PMT = PV * [i * (1 + i)^n] / [(1 + i)^n - 1]
 *
 * Where:
 *   PV = present value (total amount in centavos)
 *   i  = monthly interest rate as a decimal (e.g. 0.025 for 2.5%)
 *   n  = number of installments
 */

import { addMonths } from 'date-fns';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export interface InstallmentScheduleItem {
  /** 1-based installment number */
  number: number;
  /** Due date for this installment */
  dueDate: Date;
  /** Amount in centavos */
  amount: number;
}

export interface InstallmentPlan {
  /** Number of installments */
  installments: number;
  /** Value of each installment in centavos (rounded down; last may differ) */
  installmentValue: number;
  /** Total amount with interest in centavos */
  totalWithInterest: number;
  /** Total interest charged in centavos (totalWithInterest - principal) */
  interestTotal: number;
  /** Full per-installment payment schedule */
  schedule: InstallmentScheduleItem[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Round a floating-point centavo amount to the nearest whole centavo.
 * We use Math.round (banker's rounding is not required here; the residual
 * is corrected in the final installment anyway).
 */
function roundCentavos(value: number): number {
  return Math.round(value);
}

/**
 * Apply the Price (PMT) formula and return the per-installment value in
 * centavos (as a float before rounding so the caller can decide rounding).
 *
 * @param pv - Present value in centavos
 * @param monthlyRate - Monthly interest rate as a decimal (e.g. 0.025)
 * @param n - Number of installments
 */
function pmt(pv: number, monthlyRate: number, n: number): number {
  // (1 + i)^n
  const factor = Math.pow(1 + monthlyRate, n);
  // PMT = PV * [i * factor] / [factor - 1]
  return (pv * monthlyRate * factor) / (factor - 1);
}

// ---------------------------------------------------------------------------
// Primary exported functions
// ---------------------------------------------------------------------------

/**
 * Calculate an installment plan for a given principal, term, and interest rate.
 *
 * @param totalAmount        - Principal in centavos (integer, > 0)
 * @param numInstallments    - Number of installments (integer, >= 1)
 * @param monthlyInterestRate - Monthly interest as a percentage (e.g. 2.5 for 2.5%).
 *                             Pass 0 for interest-free.
 * @param startDate          - Date of the first installment due date (default: today)
 * @returns InstallmentPlan
 *
 * @throws {Error} if inputs are out of acceptable ranges
 */
export function calculateInstallments(
  totalAmount: number,
  numInstallments: number,
  monthlyInterestRate: number,
  startDate: Date = new Date(),
): InstallmentPlan {
  if (!Number.isInteger(totalAmount) || totalAmount <= 0) {
    throw new Error('totalAmount must be a positive integer (centavos)');
  }
  if (!Number.isInteger(numInstallments) || numInstallments < 1) {
    throw new Error('numInstallments must be a positive integer');
  }
  if (monthlyInterestRate < 0) {
    throw new Error('monthlyInterestRate must be >= 0');
  }
  // Sanity cap: Brazilian consumer credit law (CDC) does not impose a hard
  // ceiling but anything above 30% monthly is almost certainly a data error.
  if (monthlyInterestRate > 30) {
    throw new Error('monthlyInterestRate is unreasonably high (> 30%). Check your input.');
  }

  const n = numInstallments;

  // --- Zero-interest path ---------------------------------------------------
  if (monthlyInterestRate === 0) {
    const baseInstallment = Math.floor(totalAmount / n);
    const remainder = totalAmount - baseInstallment * n;

    const schedule: InstallmentScheduleItem[] = [];

    for (let i = 0; i < n; i++) {
      // The last installment absorbs any rounding remainder
      const amount = i === n - 1 ? baseInstallment + remainder : baseInstallment;

      schedule.push({
        number: i + 1,
        dueDate: addMonths(startDate, i),
        amount,
      });
    }

    return {
      installments: n,
      installmentValue: baseInstallment,
      totalWithInterest: totalAmount,
      interestTotal: 0,
      schedule,
    };
  }

  // --- Interest-bearing path (Price / PMT table) ----------------------------
  const monthlyRate = monthlyInterestRate / 100;
  const rawPmt = pmt(totalAmount, monthlyRate, n);
  const baseInstallment = roundCentavos(rawPmt);

  // Build schedule and tally the rounded total
  const schedule: InstallmentScheduleItem[] = [];
  let runningTotal = 0;

  for (let i = 0; i < n - 1; i++) {
    schedule.push({
      number: i + 1,
      dueDate: addMonths(startDate, i),
      amount: baseInstallment,
    });
    runningTotal += baseInstallment;
  }

  // Last installment: calculated from exact PMT to avoid accumulated rounding error.
  // We compute the exact total using n * rawPmt, round that, then subtract the
  // sum of the first (n-1) installments.
  const exactTotal = roundCentavos(rawPmt * n);
  const lastInstallment = exactTotal - runningTotal;

  schedule.push({
    number: n,
    dueDate: addMonths(startDate, n - 1),
    amount: lastInstallment,
  });

  const totalWithInterest = runningTotal + lastInstallment;
  const interestTotal = totalWithInterest - totalAmount;

  return {
    installments: n,
    installmentValue: baseInstallment,
    totalWithInterest,
    interestTotal,
    schedule,
  };
}

// ---------------------------------------------------------------------------
// Simulation helper
// ---------------------------------------------------------------------------

/**
 * Default interest rate configuration.
 * 1–3 installments: 0% (interest-free for short terms is standard in Brazil)
 * 4+  installments: applies the provided defaultInterestRate
 */
const FREE_INTEREST_THRESHOLD = 3;

/**
 * Simulate all installment options from 1x up to maxInstallments.
 * Useful for showing a patient the full range of payment options before
 * they commit to a plan.
 *
 * @param totalAmount          - Principal in centavos
 * @param maxInstallments      - Upper bound for simulation (e.g. 12)
 * @param defaultInterestRate  - Monthly interest rate (%) applied for terms
 *                               beyond FREE_INTEREST_THRESHOLD. Defaults to 1.99.
 * @param startDate            - First due date for every simulated plan.
 * @returns Array of InstallmentPlan, one entry per term from 1 to maxInstallments
 */
export function simulateInstallments(
  totalAmount: number,
  maxInstallments: number = 12,
  defaultInterestRate: number = 1.99,
  startDate: Date = new Date(),
): InstallmentPlan[] {
  if (!Number.isInteger(totalAmount) || totalAmount <= 0) {
    throw new Error('totalAmount must be a positive integer (centavos)');
  }
  if (!Number.isInteger(maxInstallments) || maxInstallments < 1) {
    throw new Error('maxInstallments must be a positive integer');
  }
  if (defaultInterestRate < 0) {
    throw new Error('defaultInterestRate must be >= 0');
  }

  const plans: InstallmentPlan[] = [];

  for (let n = 1; n <= maxInstallments; n++) {
    const rate = n <= FREE_INTEREST_THRESHOLD ? 0 : defaultInterestRate;
    plans.push(calculateInstallments(totalAmount, n, rate, startDate));
  }

  return plans;
}
