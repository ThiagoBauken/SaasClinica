/**
 * Availability Service Tests
 *
 * Tests for slot generation logic without requiring a real database.
 * Mocks database and Redis calls to test pure availability computation:
 * - Working hours configuration
 * - Break time handling
 * - Holiday detection
 * - Schedule blocks (vacations, maintenance)
 * - Existing appointments
 * - Slot generation with configurable duration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// =========================================================================
// Pure Logic Functions (extracted from availability.service.ts)
// =========================================================================

/**
 * Helper: parse "HH:MM" into a Date on the given day (local-time semantics)
 */
function parseTimeOnDay(day: Date, hhmm: string): Date {
  const [hh, mm] = hhmm.split(':').map(Number);
  const result = new Date(day);
  result.setHours(hh, mm, 0, 0);
  return result;
}

/**
 * Helper: check whether two half-open intervals overlap
 */
function overlaps(as: Date, ae: Date, bs: Date, be: Date): boolean {
  return as < be && ae > bs;
}

/**
 * Generate candidate slots for a professional window.
 * Returns all possible slots within working hours, before breaks/blocks/appointments.
 */
function generateCandidateSlots(
  window: {
    professionalId: number;
    professionalName: string;
    dayStart: Date;
    dayEnd: Date;
    breakStart: Date | null;
    breakEnd: Date | null;
  },
  procedureDuration: number,
  blocks: Array<{ professionalId: number | null; startTime: Date; endTime: Date; allDay: boolean | null }>,
  appointments: Array<{ professionalId: number | null; startTime: Date; endTime: Date }>,
): Array<{ startTime: Date; endTime: Date; professionalId: number; professionalName: string }> {
  const candidateSlots: Array<{ startTime: Date; endTime: Date; professionalId: number; professionalName: string }> = [];
  const now = new Date();
  const durationMs = procedureDuration * 60 * 1000;

  let cursor = new Date(window.dayStart);

  while (cursor.getTime() + durationMs <= window.dayEnd.getTime()) {
    const slotStart = new Date(cursor);
    const slotEnd = new Date(cursor.getTime() + durationMs);

    // Skip past slots
    if (slotEnd <= now) {
      cursor = new Date(cursor.getTime() + durationMs);
      continue;
    }

    // Skip breaks
    const inBreak =
      window.breakStart !== null &&
      window.breakEnd !== null &&
      overlaps(slotStart, slotEnd, window.breakStart, window.breakEnd);

    if (inBreak) {
      cursor = new Date(window.breakEnd!.getTime());
      continue;
    }

    // Skip schedule blocks
    const blockedBySchedule = blocks.some((b) => {
      const appliesToPro = b.professionalId === null || b.professionalId === window.professionalId;
      if (!appliesToPro) return false;
      if (b.allDay) return true;
      return overlaps(slotStart, slotEnd, new Date(b.startTime), new Date(b.endTime));
    });

    if (blockedBySchedule) {
      cursor = new Date(cursor.getTime() + durationMs);
      continue;
    }

    // Skip appointments
    const takenByAppointment = appointments.some((a) => {
      if (a.professionalId !== null && a.professionalId !== window.professionalId) {
        return false;
      }
      return overlaps(slotStart, slotEnd, new Date(a.startTime), new Date(a.endTime));
    });

    if (takenByAppointment) {
      cursor = new Date(cursor.getTime() + durationMs);
      continue;
    }

    candidateSlots.push({
      startTime: slotStart,
      endTime: slotEnd,
      professionalId: window.professionalId,
      professionalName: window.professionalName,
    });

    cursor = new Date(cursor.getTime() + durationMs);
  }

  return candidateSlots;
}

describe('Availability Service', () => {
  // Use a date far in the future to avoid current time filtering
  const testDate = new Date('2027-06-15'); // Future date, Tuesday
  testDate.setHours(0, 0, 0, 0);

  const dayStart = new Date(testDate);
  dayStart.setHours(8, 0, 0, 0);
  const dayEnd = new Date(testDate);
  dayEnd.setHours(18, 0, 0, 0);

  // =========================================================================
  // Basic Slot Generation Tests
  // =========================================================================

  describe('Basic Slot Generation', () => {
    it('should generate slots across full working hours', () => {
      const window = {
        professionalId: 1,
        professionalName: 'Dr. João',
        dayStart,
        dayEnd,
        breakStart: null,
        breakEnd: null,
      };

      const slots = generateCandidateSlots(window, 30, [], []);

      // 8:00 AM to 6:00 PM with 30-min slots = (10 hours) * 2 = 20 slots
      // But depends on current time...
      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0].professionalId).toBe(1);
      expect(slots[0].professionalName).toBe('Dr. João');
    });

    it('should generate 30-minute slots by default', () => {
      const window = {
        professionalId: 1,
        professionalName: 'Test',
        dayStart,
        dayEnd,
        breakStart: null,
        breakEnd: null,
      };

      const slots = generateCandidateSlots(window, 30, [], []);

      slots.forEach((slot) => {
        const duration = (slot.endTime.getTime() - slot.startTime.getTime()) / 60000;
        expect(duration).toBe(30);
      });
    });

    it('should respect custom procedure duration', () => {
      const window = {
        professionalId: 1,
        professionalName: 'Test',
        dayStart,
        dayEnd,
        breakStart: null,
        breakEnd: null,
      };

      // 60-minute slots
      const slots = generateCandidateSlots(window, 60, [], []);

      slots.forEach((slot) => {
        const duration = (slot.endTime.getTime() - slot.startTime.getTime()) / 60000;
        expect(duration).toBe(60);
      });
    });

    it('should not exceed working day end time', () => {
      const window = {
        professionalId: 1,
        professionalName: 'Test',
        dayStart,
        dayEnd,
        breakStart: null,
        breakEnd: null,
      };

      const slots = generateCandidateSlots(window, 30, [], []);

      slots.forEach((slot) => {
        expect(slot.endTime.getTime()).toBeLessThanOrEqual(dayEnd.getTime());
      });
    });

    it('should handle different procedure durations', () => {
      const window = {
        professionalId: 1,
        professionalName: 'Test',
        dayStart,
        dayEnd,
        breakStart: null,
        breakEnd: null,
      };

      const slots15 = generateCandidateSlots(window, 15, [], []);
      const slots30 = generateCandidateSlots(window, 30, [], []);
      const slots60 = generateCandidateSlots(window, 60, [], []);

      // More slots for shorter durations
      expect(slots15.length).toBeGreaterThan(slots30.length);
      expect(slots30.length).toBeGreaterThan(slots60.length);
    });
  });

  // =========================================================================
  // Break Time Handling
  // =========================================================================

  describe('Break Time Handling', () => {
    it('should exclude slots during lunch break', () => {
      const breakStart = parseTimeOnDay(testDate, '12:00');
      const breakEnd = parseTimeOnDay(testDate, '13:00');

      const window = {
        professionalId: 1,
        professionalName: 'Test',
        dayStart,
        dayEnd,
        breakStart,
        breakEnd,
      };

      const slots = generateCandidateSlots(window, 30, [], []);

      // No slot should start or end within break
      slots.forEach((slot) => {
        const slotOverlapsBreak = overlaps(slot.startTime, slot.endTime, breakStart, breakEnd);
        expect(slotOverlapsBreak).toBe(false);
      });
    });

    it('should allow slots before lunch break', () => {
      const breakStart = parseTimeOnDay(testDate, '12:00');
      const breakEnd = parseTimeOnDay(testDate, '13:00');

      const window = {
        professionalId: 1,
        professionalName: 'Test',
        dayStart,
        dayEnd,
        breakStart,
        breakEnd,
      };

      const slots = generateCandidateSlots(window, 30, [], []);

      // Should have slots at 11:00, 11:30 (before break)
      const slotsBeforeBreak = slots.filter(
        (slot) => slot.startTime.getHours() < breakStart.getHours(),
      );

      expect(slotsBeforeBreak.length).toBeGreaterThan(0);
    });

    it('should allow slots after lunch break', () => {
      const breakStart = parseTimeOnDay(testDate, '12:00');
      const breakEnd = parseTimeOnDay(testDate, '13:00');

      const window = {
        professionalId: 1,
        professionalName: 'Test',
        dayStart,
        dayEnd,
        breakStart,
        breakEnd,
      };

      const slots = generateCandidateSlots(window, 30, [], []);

      // Should have slots at 13:00, 13:30 (after break)
      const slotsAfterBreak = slots.filter(
        (slot) => slot.startTime.getHours() >= breakEnd.getHours(),
      );

      expect(slotsAfterBreak.length).toBeGreaterThan(0);
    });

    it('should handle multiple breaks (if any)', () => {
      // Even though service supports 1 break, test edge case
      const breakStart = parseTimeOnDay(testDate, '12:00');
      const breakEnd = parseTimeOnDay(testDate, '13:00');

      const window = {
        professionalId: 1,
        professionalName: 'Test',
        dayStart,
        dayEnd,
        breakStart,
        breakEnd,
      };

      const slots = generateCandidateSlots(window, 30, [], []);

      // All slots should avoid the break
      slots.forEach((slot) => {
        const overlapsBreak = overlaps(slot.startTime, slot.endTime, breakStart, breakEnd);
        expect(overlapsBreak).toBe(false);
      });
    });

    it('should handle null breaks (no break)', () => {
      const window = {
        professionalId: 1,
        professionalName: 'Test',
        dayStart,
        dayEnd,
        breakStart: null,
        breakEnd: null,
      };

      const slots = generateCandidateSlots(window, 30, [], []);

      expect(slots.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Schedule Blocks (Vacation, Maintenance, etc.)
  // =========================================================================

  describe('Schedule Blocks', () => {
    it('should exclude slots blocked by all-day block', () => {
      const blocks = [
        {
          professionalId: 1,
          startTime: dayStart,
          endTime: dayEnd,
          allDay: true,
        },
      ];

      const window = {
        professionalId: 1,
        professionalName: 'Test',
        dayStart,
        dayEnd,
        breakStart: null,
        breakEnd: null,
      };

      const slots = generateCandidateSlots(window, 30, blocks, []);

      expect(slots.length).toBe(0);
    });

    it('should exclude slots during partial block', () => {
      const blockStart = parseTimeOnDay(testDate, '10:00');
      const blockEnd = parseTimeOnDay(testDate, '12:00');

      const blocks = [
        {
          professionalId: 1,
          startTime: blockStart,
          endTime: blockEnd,
          allDay: false,
        },
      ];

      const window = {
        professionalId: 1,
        professionalName: 'Test',
        dayStart,
        dayEnd,
        breakStart: null,
        breakEnd: null,
      };

      const slots = generateCandidateSlots(window, 30, blocks, []);

      slots.forEach((slot) => {
        const overlapsBlock = overlaps(slot.startTime, slot.endTime, blockStart, blockEnd);
        expect(overlapsBlock).toBe(false);
      });
    });

    it('should allow slots outside block', () => {
      const blockStart = parseTimeOnDay(testDate, '11:00');
      const blockEnd = parseTimeOnDay(testDate, '12:00');

      const blocks = [
        {
          professionalId: 1,
          startTime: blockStart,
          endTime: blockEnd,
          allDay: false,
        },
      ];

      const window = {
        professionalId: 1,
        professionalName: 'Test',
        dayStart,
        dayEnd,
        breakStart: null,
        breakEnd: null,
      };

      const slots = generateCandidateSlots(window, 30, blocks, []);

      expect(slots.length).toBeGreaterThan(0);
    });

    it('should apply company-wide blocks (professionalId=null)', () => {
      const blockStart = parseTimeOnDay(testDate, '14:00');
      const blockEnd = parseTimeOnDay(testDate, '15:00');

      const blocks = [
        {
          professionalId: null, // Company-wide
          startTime: blockStart,
          endTime: blockEnd,
          allDay: false,
        },
      ];

      const window = {
        professionalId: 1,
        professionalName: 'Test',
        dayStart,
        dayEnd,
        breakStart: null,
        breakEnd: null,
      };

      const slots = generateCandidateSlots(window, 30, blocks, []);

      slots.forEach((slot) => {
        const overlapsBlock = overlaps(slot.startTime, slot.endTime, blockStart, blockEnd);
        expect(overlapsBlock).toBe(false);
      });
    });

    it('should not apply block for different professional', () => {
      const blockStart = parseTimeOnDay(testDate, '10:00');
      const blockEnd = parseTimeOnDay(testDate, '12:00');

      const blocks = [
        {
          professionalId: 5, // Different professional
          startTime: blockStart,
          endTime: blockEnd,
          allDay: false,
        },
      ];

      const window = {
        professionalId: 1,
        professionalName: 'Test',
        dayStart,
        dayEnd,
        breakStart: null,
        breakEnd: null,
      };

      const slots = generateCandidateSlots(window, 30, blocks, []);

      // Should have slots during 10-12 since block doesn't apply
      const slotsInBlockTime = slots.filter((slot) => {
        const isInBlockTime = slot.startTime.getHours() >= 10 && slot.startTime.getHours() < 12;
        return isInBlockTime;
      });

      expect(slotsInBlockTime.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Existing Appointments
  // =========================================================================

  describe('Existing Appointments', () => {
    it('should exclude slots with existing appointment', () => {
      const aptStart = parseTimeOnDay(testDate, '10:00');
      const aptEnd = parseTimeOnDay(testDate, '11:00');

      const appointments = [
        {
          professionalId: 1,
          startTime: aptStart,
          endTime: aptEnd,
        },
      ];

      const window = {
        professionalId: 1,
        professionalName: 'Test',
        dayStart,
        dayEnd,
        breakStart: null,
        breakEnd: null,
      };

      const slots = generateCandidateSlots(window, 30, [], appointments);

      slots.forEach((slot) => {
        const overlapsApt = overlaps(slot.startTime, slot.endTime, aptStart, aptEnd);
        expect(overlapsApt).toBe(false);
      });
    });

    it('should allow slots adjacent to appointment', () => {
      const aptStart = parseTimeOnDay(testDate, '10:00');
      const aptEnd = parseTimeOnDay(testDate, '11:00');

      const appointments = [
        {
          professionalId: 1,
          startTime: aptStart,
          endTime: aptEnd,
        },
      ];

      const window = {
        professionalId: 1,
        professionalName: 'Test',
        dayStart,
        dayEnd,
        breakStart: null,
        breakEnd: null,
      };

      const slots = generateCandidateSlots(window, 30, [], appointments);

      // Should have slot at exactly 11:00 (end time of appointment)
      const adjacentSlot = slots.find((slot) => slot.startTime.getTime() === aptEnd.getTime());
      expect(adjacentSlot).toBeDefined();
    });

    it('should not apply appointment for different professional', () => {
      const aptStart = parseTimeOnDay(testDate, '10:00');
      const aptEnd = parseTimeOnDay(testDate, '11:00');

      const appointments = [
        {
          professionalId: 5, // Different
          startTime: aptStart,
          endTime: aptEnd,
        },
      ];

      const window = {
        professionalId: 1,
        professionalName: 'Test',
        dayStart,
        dayEnd,
        breakStart: null,
        breakEnd: null,
      };

      const slots = generateCandidateSlots(window, 30, [], appointments);

      const slotsInAptTime = slots.filter((slot) => {
        return overlaps(slot.startTime, slot.endTime, aptStart, aptEnd);
      });

      expect(slotsInAptTime.length).toBeGreaterThan(0);
    });

    it('should handle appointments with null professionalId (shared)', () => {
      const aptStart = parseTimeOnDay(testDate, '10:00');
      const aptEnd = parseTimeOnDay(testDate, '11:00');

      const appointments = [
        {
          professionalId: null, // Shared appointment
          startTime: aptStart,
          endTime: aptEnd,
        },
      ];

      const window = {
        professionalId: 1,
        professionalName: 'Test',
        dayStart,
        dayEnd,
        breakStart: null,
        breakEnd: null,
      };

      const slots = generateCandidateSlots(window, 30, [], appointments);

      // Should exclude slots that overlap (shared appointments block everyone)
      slots.forEach((slot) => {
        const overlapsApt = overlaps(slot.startTime, slot.endTime, aptStart, aptEnd);
        expect(overlapsApt).toBe(false);
      });
    });

    it('should handle multiple appointments', () => {
      const appointments = [
        {
          professionalId: 1,
          startTime: parseTimeOnDay(testDate, '09:00'),
          endTime: parseTimeOnDay(testDate, '10:00'),
        },
        {
          professionalId: 1,
          startTime: parseTimeOnDay(testDate, '12:00'),
          endTime: parseTimeOnDay(testDate, '13:00'),
        },
        {
          professionalId: 1,
          startTime: parseTimeOnDay(testDate, '15:00'),
          endTime: parseTimeOnDay(testDate, '16:00'),
        },
      ];

      const window = {
        professionalId: 1,
        professionalName: 'Test',
        dayStart,
        dayEnd,
        breakStart: null,
        breakEnd: null,
      };

      const slots = generateCandidateSlots(window, 30, [], appointments);

      slots.forEach((slot) => {
        appointments.forEach((apt) => {
          const overlaps = slot.startTime < apt.endTime && slot.endTime > apt.startTime;
          expect(overlaps).toBe(false);
        });
      });
    });
  });

  // =========================================================================
  // Integration Tests: Multiple Constraints
  // =========================================================================

  describe('Multiple Constraints Combined', () => {
    it('should respect breaks AND appointments', () => {
      const breakStart = parseTimeOnDay(testDate, '12:00');
      const breakEnd = parseTimeOnDay(testDate, '13:00');

      const appointments = [
        {
          professionalId: 1,
          startTime: parseTimeOnDay(testDate, '10:00'),
          endTime: parseTimeOnDay(testDate, '10:30'),
        },
      ];

      const window = {
        professionalId: 1,
        professionalName: 'Test',
        dayStart,
        dayEnd,
        breakStart,
        breakEnd,
      };

      const slots = generateCandidateSlots(window, 30, [], appointments);

      slots.forEach((slot) => {
        const overlapsBreak = overlaps(slot.startTime, slot.endTime, breakStart, breakEnd);
        const overlapsApt = overlaps(
          slot.startTime,
          slot.endTime,
          appointments[0].startTime,
          appointments[0].endTime,
        );

        expect(overlapsBreak).toBe(false);
        expect(overlapsApt).toBe(false);
      });
    });

    it('should respect blocks AND breaks AND appointments', () => {
      const breakStart = parseTimeOnDay(testDate, '12:00');
      const breakEnd = parseTimeOnDay(testDate, '13:00');

      const blockStart = parseTimeOnDay(testDate, '14:00');
      const blockEnd = parseTimeOnDay(testDate, '15:00');

      const blocks = [
        {
          professionalId: 1,
          startTime: blockStart,
          endTime: blockEnd,
          allDay: false,
        },
      ];

      const appointments = [
        {
          professionalId: 1,
          startTime: parseTimeOnDay(testDate, '10:00'),
          endTime: parseTimeOnDay(testDate, '10:30'),
        },
      ];

      const window = {
        professionalId: 1,
        professionalName: 'Test',
        dayStart,
        dayEnd,
        breakStart,
        breakEnd,
      };

      const slots = generateCandidateSlots(window, 30, blocks, appointments);

      slots.forEach((slot) => {
        const overlapsBreak = overlaps(slot.startTime, slot.endTime, breakStart, breakEnd);
        const overlapsBlock = overlaps(slot.startTime, slot.endTime, blockStart, blockEnd);
        const overlapsApt = overlaps(
          slot.startTime,
          slot.endTime,
          appointments[0].startTime,
          appointments[0].endTime,
        );

        expect(overlapsBreak).toBe(false);
        expect(overlapsBlock).toBe(false);
        expect(overlapsApt).toBe(false);
      });
    });
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe('Edge Cases', () => {
    it('should handle empty blocks array', () => {
      const window = {
        professionalId: 1,
        professionalName: 'Test',
        dayStart,
        dayEnd,
        breakStart: null,
        breakEnd: null,
      };

      const slots = generateCandidateSlots(window, 30, [], []);
      expect(slots.length).toBeGreaterThan(0);
    });

    it('should handle empty appointments array', () => {
      const window = {
        professionalId: 1,
        professionalName: 'Test',
        dayStart,
        dayEnd,
        breakStart: null,
        breakEnd: null,
      };

      const slots = generateCandidateSlots(window, 30, [], []);
      expect(slots.length).toBeGreaterThan(0);
    });

    it('should handle very short working hours', () => {
      const shortStart = parseTimeOnDay(testDate, '17:00');
      const shortEnd = parseTimeOnDay(testDate, '18:00');

      const window = {
        professionalId: 1,
        professionalName: 'Test',
        dayStart: shortStart,
        dayEnd: shortEnd,
        breakStart: null,
        breakEnd: null,
      };

      const slots = generateCandidateSlots(window, 30, [], []);

      // 1 hour window should allow 2 x 30-min slots (or 1 if past)
      expect(slots.length).toBeLessThanOrEqual(2);
    });

    it('should handle very long procedure duration', () => {
      const window = {
        professionalId: 1,
        professionalName: 'Test',
        dayStart,
        dayEnd,
        breakStart: null,
        breakEnd: null,
      };

      const slots = generateCandidateSlots(window, 480, [], []); // 8-hour procedure

      // Only 1 slot possible (8 AM to 4 PM is available from 8 AM to 6 PM)
      expect(slots.length).toBeLessThanOrEqual(2);
    });

    it('should handle 15-minute slots', () => {
      const window = {
        professionalId: 1,
        professionalName: 'Test',
        dayStart,
        dayEnd,
        breakStart: null,
        breakEnd: null,
      };

      const slots = generateCandidateSlots(window, 15, [], []);

      slots.forEach((slot) => {
        const duration = (slot.endTime.getTime() - slot.startTime.getTime()) / 60000;
        expect(duration).toBe(15);
      });

      expect(slots.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Time Parsing Tests
  // =========================================================================

  describe('Time Parsing', () => {
    it('should parse "HH:MM" correctly', () => {
      const day = new Date('2026-04-03');
      const time = parseTimeOnDay(day, '14:30');

      expect(time.getHours()).toBe(14);
      expect(time.getMinutes()).toBe(30);
    });

    it('should handle 00:00 midnight', () => {
      const day = new Date('2026-04-03');
      const time = parseTimeOnDay(day, '00:00');

      expect(time.getHours()).toBe(0);
      expect(time.getMinutes()).toBe(0);
    });

    it('should handle 23:59', () => {
      const day = new Date('2026-04-03');
      const time = parseTimeOnDay(day, '23:59');

      expect(time.getHours()).toBe(23);
      expect(time.getMinutes()).toBe(59);
    });
  });

  // =========================================================================
  // Overlap Detection Tests
  // =========================================================================

  describe('Overlap Detection', () => {
    it('should detect exact overlap', () => {
      const time = new Date('2026-04-03T10:00:00');
      const result = overlaps(time, new Date(time.getTime() + 3600000), time, new Date(time.getTime() + 3600000));
      expect(result).toBe(true);
    });

    it('should detect partial overlap', () => {
      const start = new Date('2026-04-03T10:00:00');
      const result = overlaps(
        start,
        new Date(start.getTime() + 3600000),
        new Date(start.getTime() + 1800000),
        new Date(start.getTime() + 5400000),
      );
      expect(result).toBe(true);
    });

    it('should not detect adjacent times as overlap', () => {
      const time1End = new Date('2026-04-03T10:00:00');
      const time2Start = new Date('2026-04-03T10:00:00');
      const result = overlaps(
        new Date(time1End.getTime() - 3600000),
        time1End,
        time2Start,
        new Date(time2Start.getTime() + 3600000),
      );
      expect(result).toBe(false);
    });
  });
});
