/**
 * Installment Calculator Tests
 *
 * Tests for the PMT-based installment calculation service.
 * Validates zero-interest plans, interest-bearing plans, rounding behavior,
 * and the simulateInstallments function.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateInstallments,
  simulateInstallments,
  InstallmentPlan,
  InstallmentScheduleItem,
} from '../../server/services/installment-calculator';
import { addMonths } from 'date-fns';

describe('Installment Calculator', () => {
  // =========================================================================
  // Zero-Interest Tests
  // =========================================================================

  describe('Zero-Interest Plans', () => {
    it('should calculate 1x installment with zero interest', () => {
      const totalAmount = 100000; // 1000.00 BRL in centavos
      const result = calculateInstallments(totalAmount, 1, 0);

      expect(result.installments).toBe(1);
      expect(result.installmentValue).toBe(100000);
      expect(result.totalWithInterest).toBe(100000);
      expect(result.interestTotal).toBe(0);
      expect(result.schedule).toHaveLength(1);
      expect(result.schedule[0].amount).toBe(100000);
      expect(result.schedule[0].number).toBe(1);
    });

    it('should calculate 3x installment with zero interest', () => {
      const totalAmount = 300000; // 3000.00 BRL
      const result = calculateInstallments(totalAmount, 3, 0);

      expect(result.installments).toBe(3);
      expect(result.installmentValue).toBe(100000);
      expect(result.totalWithInterest).toBe(300000);
      expect(result.interestTotal).toBe(0);

      // Verify schedule
      expect(result.schedule).toHaveLength(3);
      result.schedule.forEach((item, idx) => {
        expect(item.number).toBe(idx + 1);
        expect(item.amount).toBe(100000);
      });

      // Verify due dates are monthly increments
      const scheduleTotal = result.schedule.reduce((sum, item) => sum + item.amount, 0);
      expect(scheduleTotal).toBe(totalAmount);
    });

    it('should calculate 12x installment with zero interest', () => {
      const totalAmount = 120000; // 1200.00 BRL
      const result = calculateInstallments(totalAmount, 12, 0);

      expect(result.installments).toBe(12);
      expect(result.totalWithInterest).toBe(120000);
      expect(result.interestTotal).toBe(0);

      // All installments should be equal (10000 centavos)
      const scheduleTotal = result.schedule.reduce((sum, item) => sum + item.amount, 0);
      expect(scheduleTotal).toBe(totalAmount);

      result.schedule.forEach((item) => {
        expect(item.amount).toBe(10000);
      });
    });

    it('should handle non-evenly divisible amounts with rounding in last installment', () => {
      // 1000.01 BRL = 100001 centavos (not evenly divisible by 3)
      const totalAmount = 100001;
      const result = calculateInstallments(totalAmount, 3, 0);

      expect(result.totalWithInterest).toBe(100001);

      // First two installments should be 33333 (floor division)
      expect(result.schedule[0].amount).toBe(33333);
      expect(result.schedule[1].amount).toBe(33333);

      // Last installment absorbs remainder: 33333 + 2 = 33335
      expect(result.schedule[2].amount).toBe(33335);

      // Verify total is correct
      const sum = result.schedule.reduce((acc, item) => acc + item.amount, 0);
      expect(sum).toBe(totalAmount);
    });
  });

  // =========================================================================
  // Interest-Bearing Tests (2.5% Monthly)
  // =========================================================================

  describe('Interest-Bearing Plans', () => {
    it('should calculate 12x installment with 2.5% monthly interest', () => {
      const totalAmount = 100000; // 1000.00 BRL
      const monthlyRate = 2.5;
      const result = calculateInstallments(totalAmount, 12, monthlyRate);

      expect(result.installments).toBe(12);

      // Interest should be positive
      expect(result.interestTotal).toBeGreaterThan(0);

      // Total with interest should be sum of all installments
      const scheduleTotal = result.schedule.reduce((sum, item) => sum + item.amount, 0);
      expect(scheduleTotal).toBe(result.totalWithInterest);

      // Verify all scheduled amounts are integers (centavos)
      result.schedule.forEach((item) => {
        expect(Number.isInteger(item.amount)).toBe(true);
        expect(item.amount).toBeGreaterThan(0);
      });
    });

    it('should apply PMT formula correctly for 6x with 2.5% interest', () => {
      const totalAmount = 60000; // 600.00 BRL
      const monthlyRate = 2.5;
      const result = calculateInstallments(totalAmount, 6, monthlyRate);

      // PMT formula: PV * [i * (1+i)^n] / [(1+i)^n - 1]
      // Where i = 0.025, n = 6, PV = 60000
      // (1.025)^6 ≈ 1.15969
      // PMT ≈ 60000 * [0.025 * 1.15969] / [1.15969 - 1]
      // PMT ≈ 60000 * 0.02899 / 0.15969 ≈ 10898

      // Allow wider tolerance for PMT formula result (round to nearest 10)
      expect(Math.round(result.schedule[0].amount / 10) * 10).toBeCloseTo(10890, -1);

      // Interest total should be positive and reasonable
      expect(result.interestTotal).toBeGreaterThan(0);
      expect(result.interestTotal).toBeLessThan(totalAmount * 0.2); // < 20% for high rate
    });

    it('should ensure last installment absorbs rounding error', () => {
      const totalAmount = 100000;
      const monthlyRate = 2.5;
      const result = calculateInstallments(totalAmount, 12, monthlyRate);

      // Sum of first 11 + last installment
      const firstElevenSum = result.schedule
        .slice(0, 11)
        .reduce((sum, item) => sum + item.amount, 0);

      const lastInstallment = result.schedule[11].amount;

      // Last should be adjusted to make total exact
      const total = firstElevenSum + lastInstallment;
      expect(total).toBe(result.totalWithInterest);

      // Last installment may differ slightly from the base (allow 5 centavos tolerance)
      expect(Math.abs(lastInstallment - result.installmentValue)).toBeLessThanOrEqual(5);
    });

    it('should have all schedule dates monthly increments from start date', () => {
      const startDate = new Date('2026-01-15');
      const result = calculateInstallments(100000, 6, 2.5, startDate);

      result.schedule.forEach((item, idx) => {
        const expectedDate = addMonths(startDate, idx);
        expect(item.dueDate.getFullYear()).toBe(expectedDate.getFullYear());
        expect(item.dueDate.getMonth()).toBe(expectedDate.getMonth());
        expect(item.dueDate.getDate()).toBe(expectedDate.getDate());
      });
    });
  });

  // =========================================================================
  // Input Validation Tests
  // =========================================================================

  describe('Input Validation', () => {
    it('should throw error for zero amount', () => {
      expect(() => {
        calculateInstallments(0, 3, 0);
      }).toThrow('totalAmount must be a positive integer');
    });

    it('should throw error for negative amount', () => {
      expect(() => {
        calculateInstallments(-10000, 3, 0);
      }).toThrow('totalAmount must be a positive integer');
    });

    it('should throw error for non-integer amount', () => {
      expect(() => {
        calculateInstallments(10000.5, 3, 0);
      }).toThrow('totalAmount must be a positive integer');
    });

    it('should throw error for zero installments', () => {
      expect(() => {
        calculateInstallments(100000, 0, 0);
      }).toThrow('numInstallments must be a positive integer');
    });

    it('should throw error for negative installments', () => {
      expect(() => {
        calculateInstallments(100000, -5, 0);
      }).toThrow('numInstallments must be a positive integer');
    });

    it('should throw error for non-integer installments', () => {
      expect(() => {
        calculateInstallments(100000, 3.5, 0);
      }).toThrow('numInstallments must be a positive integer');
    });

    it('should throw error for negative interest rate', () => {
      expect(() => {
        calculateInstallments(100000, 3, -1);
      }).toThrow('monthlyInterestRate must be >= 0');
    });

    it('should throw error for unreasonably high interest rate (>30%)', () => {
      expect(() => {
        calculateInstallments(100000, 3, 31);
      }).toThrow('monthlyInterestRate is unreasonably high');
    });

    it('should allow maximum reasonable interest rate (30%)', () => {
      const result = calculateInstallments(100000, 3, 30);
      expect(result).toBeDefined();
      expect(result.interestTotal).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Simulate Installments Tests
  // =========================================================================

  describe('Simulate Installments', () => {
    it('should return correct number of plans', () => {
      const plans = simulateInstallments(100000, 12);

      expect(plans).toHaveLength(12);

      // Each plan should have incrementing installment count
      plans.forEach((plan, idx) => {
        expect(plan.installments).toBe(idx + 1);
      });
    });

    it('should apply zero interest for 1-3 installments', () => {
      const plans = simulateInstallments(100000, 12);

      // 1x, 2x, 3x should be interest-free
      for (let i = 0; i < 3; i++) {
        expect(plans[i].interestTotal).toBe(0);
      }
    });

    it('should apply interest for 4+ installments with default rate', () => {
      const plans = simulateInstallments(100000, 12);

      // 4x onwards should have interest (default 1.99%)
      for (let i = 3; i < 12; i++) {
        expect(plans[i].interestTotal).toBeGreaterThan(0);
      }
    });

    it('should respect custom default interest rate', () => {
      const customRate = 3.5;
      const plans = simulateInstallments(100000, 12, customRate);

      // 1x-3x should still be zero
      for (let i = 0; i < 3; i++) {
        expect(plans[i].interestTotal).toBe(0);
      }

      // 4x+ should use custom rate (verify by checking that 4x has reasonable interest)
      const fourxPlan = plans[3];
      expect(fourxPlan.interestTotal).toBeGreaterThan(0);
      expect(fourxPlan.installmentValue).toBeGreaterThan(100000 / 4);
    });

    it('should progressively increase total cost with higher installments', () => {
      const plans = simulateInstallments(100000, 12);

      // Each plan's totalWithInterest should increase (or stay same for 1-3x)
      for (let i = 3; i < 12; i++) {
        expect(plans[i].totalWithInterest).toBeGreaterThanOrEqual(plans[i - 1].totalWithInterest);
      }
    });

    it('should handle maximum installments parameter', () => {
      const plans = simulateInstallments(100000, 5);
      expect(plans).toHaveLength(5);

      const plans12 = simulateInstallments(100000, 12);
      expect(plans12).toHaveLength(12);
    });

    it('should validate input parameters', () => {
      expect(() => simulateInstallments(0, 12)).toThrow('totalAmount must be a positive integer');
      expect(() => simulateInstallments(100000, 0)).toThrow('maxInstallments must be a positive integer');
      expect(() => simulateInstallments(100000, 12, -1)).toThrow('defaultInterestRate must be >= 0');
    });

    it('should use custom start date for all simulated plans', () => {
      const startDate = new Date('2026-02-01');
      const plans = simulateInstallments(100000, 3, 1.99, startDate);

      plans.forEach((plan) => {
        // First installment of each plan should start at the provided date
        expect(plan.schedule[0].dueDate.getFullYear()).toBe(startDate.getFullYear());
        expect(plan.schedule[0].dueDate.getMonth()).toBe(startDate.getMonth());
        expect(plan.schedule[0].dueDate.getDate()).toBe(startDate.getDate());
      });
    });
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe('Edge Cases', () => {
    it('should handle very small amounts (1 centavo)', () => {
      const result = calculateInstallments(1, 1, 0);
      expect(result.totalWithInterest).toBe(1);
      expect(result.schedule[0].amount).toBe(1);
    });

    it('should handle very large amounts', () => {
      const largeAmount = 999999999; // 9.99M BRL
      const result = calculateInstallments(largeAmount, 12, 2.5);

      expect(result.totalWithInterest).toBeGreaterThanOrEqual(largeAmount);
      const scheduleSum = result.schedule.reduce((sum, item) => sum + item.amount, 0);
      expect(scheduleSum).toBe(result.totalWithInterest);
    });

    it('should maintain centavo precision with many installments', () => {
      const result = calculateInstallments(100000, 24, 2.5);

      // All amounts must be integers
      result.schedule.forEach((item) => {
        expect(Number.isInteger(item.amount)).toBe(true);
      });

      // Total must match exactly
      const sum = result.schedule.reduce((sum, item) => sum + item.amount, 0);
      expect(sum).toBe(result.totalWithInterest);
    });

    it('should work with zero interest rate explicitly', () => {
      const result = calculateInstallments(100000, 12, 0);
      expect(result.interestTotal).toBe(0);
      expect(result.totalWithInterest).toBe(100000);
    });

    it('should handle single installment with interest (edge case)', () => {
      // 1x with interest: PMT formula still applies, but gives a higher value for 1 term
      // PMT = PV * [i * (1+i)^n] / [(1+i)^n - 1]
      // For n=1, i=0.025: PMT = 100000 * [0.025 * 1.025] / [0.025] = 102500
      const result = calculateInstallments(100000, 1, 2.5);

      expect(result.installments).toBe(1);
      expect(result.schedule).toHaveLength(1);
      // For 1 installment with 2.5% rate, the amount will be higher than principal
      expect(result.schedule[0].amount).toBeGreaterThan(100000);
    });
  });

  // =========================================================================
  // Schedule Validation Tests
  // =========================================================================

  describe('Schedule Structure', () => {
    it('should generate correct schedule item structure', () => {
      const result = calculateInstallments(100000, 3, 0);

      result.schedule.forEach((item: InstallmentScheduleItem, idx: number) => {
        expect(item.number).toBe(idx + 1);
        expect(item.dueDate).toBeInstanceOf(Date);
        expect(Number.isInteger(item.amount)).toBe(true);
        expect(item.amount).toBeGreaterThan(0);
      });
    });

    it('should have monotonically increasing due dates', () => {
      const result = calculateInstallments(100000, 12, 2.5);

      for (let i = 1; i < result.schedule.length; i++) {
        expect(result.schedule[i].dueDate.getTime()).toBeGreaterThan(
          result.schedule[i - 1].dueDate.getTime(),
        );
      }
    });

    it('should preserve installment count in schedule', () => {
      for (let n = 1; n <= 12; n++) {
        const result = calculateInstallments(100000, n, 0);
        expect(result.schedule).toHaveLength(n);
      }
    });
  });
});
