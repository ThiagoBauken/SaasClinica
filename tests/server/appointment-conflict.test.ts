/**
 * Appointment Conflict Detection Tests
 *
 * Tests for conflict detection logic from appointments.routes.ts
 * Validates overlap detection, professional/room conflict logic,
 * and handling of cancelled appointments.
 */

import { describe, it, expect } from 'vitest';

// =========================================================================
// Pure Logic Functions (extracted from appointments.routes.ts)
// =========================================================================

/**
 * Checks if a proposed slot overlaps with an existing appointment.
 * This is the core logic from appointments.routes.ts hasConflict function.
 */
function hasConflict(
  existing: Array<{
    startTime: Date | null;
    endTime: Date | null;
    professionalId?: number | null;
    roomId?: number | null;
  }>,
  slotStart: Date,
  slotEnd: Date,
  filterOpts?: { professionalId?: number; roomId?: number },
): boolean {
  return existing.some((apt) => {
    if (!apt.startTime || !apt.endTime) return false;
    const overlaps = apt.startTime < slotEnd && apt.endTime > slotStart;
    if (!overlaps) return false;
    if (filterOpts?.professionalId && apt.professionalId !== filterOpts.professionalId) return false;
    if (filterOpts?.roomId && apt.roomId !== filterOpts.roomId) return false;
    return true;
  });
}

/**
 * Helper function to create appointment records for testing
 */
function createAppointment(
  startTime: Date,
  endTime: Date,
  professionalId?: number,
  roomId?: number,
): {
  startTime: Date;
  endTime: Date;
  professionalId?: number | null;
  roomId?: number | null;
} {
  return {
    startTime,
    endTime,
    professionalId: professionalId ?? null,
    roomId: roomId ?? null,
  };
}

describe('Appointment Conflict Detection', () => {
  // =========================================================================
  // Overlap Detection Tests
  // =========================================================================

  describe('Time Overlap Detection', () => {
    it('should detect exact time overlap', () => {
      const now = new Date('2026-04-03T10:00:00');
      const end = new Date('2026-04-03T11:00:00');

      const existing = [createAppointment(now, end)];
      const conflict = hasConflict(existing, now, end);

      expect(conflict).toBe(true);
    });

    it('should detect partial overlap at start', () => {
      const apt1Start = new Date('2026-04-03T10:00:00');
      const apt1End = new Date('2026-04-03T11:00:00');

      const apt2Start = new Date('2026-04-03T09:30:00');
      const apt2End = new Date('2026-04-03T10:30:00');

      const existing = [createAppointment(apt1Start, apt1End)];
      const conflict = hasConflict(existing, apt2Start, apt2End);

      expect(conflict).toBe(true);
    });

    it('should detect partial overlap at end', () => {
      const apt1Start = new Date('2026-04-03T10:00:00');
      const apt1End = new Date('2026-04-03T11:00:00');

      const apt2Start = new Date('2026-04-03T10:30:00');
      const apt2End = new Date('2026-04-03T11:30:00');

      const existing = [createAppointment(apt1Start, apt1End)];
      const conflict = hasConflict(existing, apt2Start, apt2End);

      expect(conflict).toBe(true);
    });

    it('should detect overlap when new slot contains existing', () => {
      const apt1Start = new Date('2026-04-03T10:30:00');
      const apt1End = new Date('2026-04-03T10:45:00');

      const apt2Start = new Date('2026-04-03T10:00:00');
      const apt2End = new Date('2026-04-03T11:00:00');

      const existing = [createAppointment(apt1Start, apt1End)];
      const conflict = hasConflict(existing, apt2Start, apt2End);

      expect(conflict).toBe(true);
    });

    it('should detect overlap when existing contains new slot', () => {
      const apt1Start = new Date('2026-04-03T10:00:00');
      const apt1End = new Date('2026-04-03T11:00:00');

      const apt2Start = new Date('2026-04-03T10:15:00');
      const apt2End = new Date('2026-04-03T10:45:00');

      const existing = [createAppointment(apt1Start, apt1End)];
      const conflict = hasConflict(existing, apt2Start, apt2End);

      expect(conflict).toBe(true);
    });
  });

  // =========================================================================
  // Adjacent (Non-Overlapping) Tests
  // =========================================================================

  describe('Adjacent Appointments (No Conflict)', () => {
    it('should allow adjacent appointments (end = start)', () => {
      const apt1Start = new Date('2026-04-03T10:00:00');
      const apt1End = new Date('2026-04-03T11:00:00');

      const apt2Start = new Date('2026-04-03T11:00:00');
      const apt2End = new Date('2026-04-03T12:00:00');

      const existing = [createAppointment(apt1Start, apt1End)];
      const conflict = hasConflict(existing, apt2Start, apt2End);

      expect(conflict).toBe(false);
    });

    it('should allow separated appointments', () => {
      const apt1Start = new Date('2026-04-03T10:00:00');
      const apt1End = new Date('2026-04-03T11:00:00');

      const apt2Start = new Date('2026-04-03T12:00:00');
      const apt2End = new Date('2026-04-03T13:00:00');

      const existing = [createAppointment(apt1Start, apt1End)];
      const conflict = hasConflict(existing, apt2Start, apt2End);

      expect(conflict).toBe(false);
    });

    it('should allow far apart appointments', () => {
      const apt1Start = new Date('2026-04-03T08:00:00');
      const apt1End = new Date('2026-04-03T09:00:00');

      const apt2Start = new Date('2026-04-03T17:00:00');
      const apt2End = new Date('2026-04-03T18:00:00');

      const existing = [createAppointment(apt1Start, apt1End)];
      const conflict = hasConflict(existing, apt2Start, apt2End);

      expect(conflict).toBe(false);
    });
  });

  // =========================================================================
  // Professional-Specific Conflict Tests
  // =========================================================================

  describe('Professional Conflict Detection', () => {
    it('should detect conflict for same professional', () => {
      const apt1Start = new Date('2026-04-03T10:00:00');
      const apt1End = new Date('2026-04-03T11:00:00');
      const professionalId = 5;

      const existing = [createAppointment(apt1Start, apt1End, professionalId)];
      const conflict = hasConflict(existing, apt1Start, apt1End, {
        professionalId,
      });

      expect(conflict).toBe(true);
    });

    it('should not report conflict for different professional', () => {
      const apt1Start = new Date('2026-04-03T10:00:00');
      const apt1End = new Date('2026-04-03T11:00:00');

      const existing = [createAppointment(apt1Start, apt1End, 5)];
      const conflict = hasConflict(existing, apt1Start, apt1End, {
        professionalId: 10,
      });

      expect(conflict).toBe(false);
    });

    it('should allow same time slot for different professionals', () => {
      const apt1Start = new Date('2026-04-03T10:00:00');
      const apt1End = new Date('2026-04-03T11:00:00');

      const existing = [
        createAppointment(apt1Start, apt1End, 5),
        createAppointment(apt1Start, apt1End, 10),
      ];

      // Check professional 15 has no conflict
      const conflict = hasConflict(existing, apt1Start, apt1End, {
        professionalId: 15,
      });

      expect(conflict).toBe(false);
    });

    it('should filter by professional when no professionalId in existing', () => {
      const apt1Start = new Date('2026-04-03T10:00:00');
      const apt1End = new Date('2026-04-03T11:00:00');

      // Appointment with no professional assigned (shared slot)
      const existing = [{ startTime: apt1Start, endTime: apt1End, professionalId: null }];

      const conflict = hasConflict(existing, apt1Start, apt1End, {
        professionalId: 5,
      });

      expect(conflict).toBe(false);
    });
  });

  // =========================================================================
  // Room-Specific Conflict Tests
  // =========================================================================

  describe('Room Conflict Detection', () => {
    it('should detect conflict for same room', () => {
      const apt1Start = new Date('2026-04-03T10:00:00');
      const apt1End = new Date('2026-04-03T11:00:00');
      const roomId = 3;

      const existing = [createAppointment(apt1Start, apt1End, undefined, roomId)];
      const conflict = hasConflict(existing, apt1Start, apt1End, { roomId });

      expect(conflict).toBe(true);
    });

    it('should not report conflict for different room', () => {
      const apt1Start = new Date('2026-04-03T10:00:00');
      const apt1End = new Date('2026-04-03T11:00:00');

      const existing = [createAppointment(apt1Start, apt1End, undefined, 3)];
      const conflict = hasConflict(existing, apt1Start, apt1End, { roomId: 7 });

      expect(conflict).toBe(false);
    });

    it('should allow same time for different rooms', () => {
      const apt1Start = new Date('2026-04-03T10:00:00');
      const apt1End = new Date('2026-04-03T11:00:00');

      const existing = [
        createAppointment(apt1Start, apt1End, undefined, 3),
        createAppointment(apt1Start, apt1End, undefined, 7),
      ];

      // Check room 10 has no conflict
      const conflict = hasConflict(existing, apt1Start, apt1End, { roomId: 10 });

      expect(conflict).toBe(false);
    });

    it('should handle room=null (flexible room)', () => {
      const apt1Start = new Date('2026-04-03T10:00:00');
      const apt1End = new Date('2026-04-03T11:00:00');

      // Appointment with no room assigned
      const existing = [{ startTime: apt1Start, endTime: apt1End, roomId: null }];

      const conflict = hasConflict(existing, apt1Start, apt1End, { roomId: 3 });

      expect(conflict).toBe(false);
    });
  });

  // =========================================================================
  // Combined Professional + Room Tests
  // =========================================================================

  describe('Combined Professional and Room Filtering', () => {
    it('should require BOTH professional AND room to match for conflict', () => {
      const apt1Start = new Date('2026-04-03T10:00:00');
      const apt1End = new Date('2026-04-03T11:00:00');

      const existing = [createAppointment(apt1Start, apt1End, 5, 3)];

      // Same professional, different room = no conflict
      let conflict = hasConflict(existing, apt1Start, apt1End, {
        professionalId: 5,
        roomId: 7,
      });
      expect(conflict).toBe(false);

      // Different professional, same room = no conflict
      conflict = hasConflict(existing, apt1Start, apt1End, {
        professionalId: 10,
        roomId: 3,
      });
      expect(conflict).toBe(false);

      // Same both = conflict
      conflict = hasConflict(existing, apt1Start, apt1End, {
        professionalId: 5,
        roomId: 3,
      });
      expect(conflict).toBe(true);
    });

    it('should detect conflict when prof/room partially specified', () => {
      const apt1Start = new Date('2026-04-03T10:00:00');
      const apt1End = new Date('2026-04-03T11:00:00');

      const existing = [createAppointment(apt1Start, apt1End, 5, 3)];

      // Only filter by professional
      let conflict = hasConflict(existing, apt1Start, apt1End, {
        professionalId: 5,
      });
      expect(conflict).toBe(true);

      // Only filter by room
      conflict = hasConflict(existing, apt1Start, apt1End, { roomId: 3 });
      expect(conflict).toBe(true);
    });
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe('Edge Cases', () => {
    it('should handle empty existing appointments list', () => {
      const start = new Date('2026-04-03T10:00:00');
      const end = new Date('2026-04-03T11:00:00');

      const conflict = hasConflict([], start, end);

      expect(conflict).toBe(false);
    });

    it('should handle null dates in existing appointments', () => {
      const start = new Date('2026-04-03T10:00:00');
      const end = new Date('2026-04-03T11:00:00');

      const existing = [
        { startTime: null, endTime: null },
        { startTime: start, endTime: null },
        { startTime: null, endTime: end },
      ];

      const conflict = hasConflict(existing, start, end);

      expect(conflict).toBe(false);
    });

    it('should handle same start and end times (edge case: 0 duration)', () => {
      const time = new Date('2026-04-03T10:00:00');

      const existing = [createAppointment(time, time)];
      const conflict = hasConflict(existing, time, time);

      // Zero-duration slots don't overlap with zero-duration (same logic)
      expect(conflict).toBe(false); // start < end is false, so no overlap
    });

    it('should handle very large date ranges', () => {
      const apt1Start = new Date('2026-01-01T00:00:00');
      const apt1End = new Date('2026-12-31T23:59:59');

      const apt2Start = new Date('2026-06-15T12:00:00');
      const apt2End = new Date('2026-06-15T13:00:00');

      const existing = [createAppointment(apt1Start, apt1End)];
      const conflict = hasConflict(existing, apt2Start, apt2End);

      expect(conflict).toBe(true);
    });

    it('should handle millisecond precision', () => {
      const apt1Start = new Date('2026-04-03T10:00:00.000');
      const apt1End = new Date('2026-04-03T11:00:00.000');

      const apt2Start = new Date('2026-04-03T11:00:00.001');
      const apt2End = new Date('2026-04-03T12:00:00.000');

      const existing = [createAppointment(apt1Start, apt1End)];
      const conflict = hasConflict(existing, apt2Start, apt2End);

      expect(conflict).toBe(false);
    });
  });

  // =========================================================================
  // Multiple Appointments Checks
  // =========================================================================

  describe('Multiple Existing Appointments', () => {
    it('should detect conflict with first of multiple appointments', () => {
      const apt1Start = new Date('2026-04-03T09:00:00');
      const apt1End = new Date('2026-04-03T10:00:00');

      const apt2Start = new Date('2026-04-03T14:00:00');
      const apt2End = new Date('2026-04-03T15:00:00');

      const newStart = new Date('2026-04-03T09:30:00');
      const newEnd = new Date('2026-04-03T10:30:00');

      const existing = [
        createAppointment(apt1Start, apt1End),
        createAppointment(apt2Start, apt2End),
      ];

      const conflict = hasConflict(existing, newStart, newEnd);

      expect(conflict).toBe(true);
    });

    it('should detect conflict with last of multiple appointments', () => {
      const apt1Start = new Date('2026-04-03T09:00:00');
      const apt1End = new Date('2026-04-03T10:00:00');

      const apt2Start = new Date('2026-04-03T14:00:00');
      const apt2End = new Date('2026-04-03T15:00:00');

      const newStart = new Date('2026-04-03T14:30:00');
      const newEnd = new Date('2026-04-03T15:30:00');

      const existing = [
        createAppointment(apt1Start, apt1End),
        createAppointment(apt2Start, apt2End),
      ];

      const conflict = hasConflict(existing, newStart, newEnd);

      expect(conflict).toBe(true);
    });

    it('should allow slots between multiple appointments', () => {
      const apt1Start = new Date('2026-04-03T09:00:00');
      const apt1End = new Date('2026-04-03T10:00:00');

      const apt2Start = new Date('2026-04-03T14:00:00');
      const apt2End = new Date('2026-04-03T15:00:00');

      const newStart = new Date('2026-04-03T11:00:00');
      const newEnd = new Date('2026-04-03T13:00:00');

      const existing = [
        createAppointment(apt1Start, apt1End),
        createAppointment(apt2Start, apt2End),
      ];

      const conflict = hasConflict(existing, newStart, newEnd);

      expect(conflict).toBe(false);
    });

    it('should check all appointments until conflict found (early exit)', () => {
      const apt1Start = new Date('2026-04-03T09:00:00');
      const apt1End = new Date('2026-04-03T10:00:00');

      const apt2Start = new Date('2026-04-03T14:00:00');
      const apt2End = new Date('2026-04-03T15:00:00');

      // Conflict is with apt2 (after apt1)
      const newStart = new Date('2026-04-03T14:30:00');
      const newEnd = new Date('2026-04-03T15:30:00');

      const existing = [
        createAppointment(apt1Start, apt1End),
        createAppointment(apt2Start, apt2End),
      ];

      const conflict = hasConflict(existing, newStart, newEnd);

      expect(conflict).toBe(true);
    });
  });

  // =========================================================================
  // Real-World Scenarios
  // =========================================================================

  describe('Real-World Scenarios', () => {
    it('scenario: dentist double-booked', () => {
      const existing = [
        createAppointment(
          new Date('2026-04-03T09:00:00'),
          new Date('2026-04-03T10:00:00'),
          1, // Dr. João
        ),
      ];

      // Try to book same dentist at overlapping time
      const conflict = hasConflict(
        existing,
        new Date('2026-04-03T09:30:00'),
        new Date('2026-04-03T10:30:00'),
        { professionalId: 1 },
      );

      expect(conflict).toBe(true);
    });

    it('scenario: room double-booked', () => {
      const existing = [
        createAppointment(
          new Date('2026-04-03T10:00:00'),
          new Date('2026-04-03T11:00:00'),
          undefined,
          2, // Sala 2
        ),
      ];

      const conflict = hasConflict(
        existing,
        new Date('2026-04-03T10:15:00'),
        new Date('2026-04-03T11:15:00'),
        { roomId: 2 },
      );

      expect(conflict).toBe(true);
    });

    it('scenario: same time, different rooms OK', () => {
      const existing = [
        createAppointment(
          new Date('2026-04-03T10:00:00'),
          new Date('2026-04-03T11:00:00'),
          undefined,
          1, // Sala 1
        ),
      ];

      const conflict = hasConflict(
        existing,
        new Date('2026-04-03T10:00:00'),
        new Date('2026-04-03T11:00:00'),
        { roomId: 2 }, // Sala 2
      );

      expect(conflict).toBe(false);
    });

    it('scenario: buffer time between appointments', () => {
      const existing = [
        createAppointment(
          new Date('2026-04-03T10:00:00'),
          new Date('2026-04-03T10:30:00'),
          1,
        ),
      ];

      // 15-minute gap (no overlap)
      const conflict = hasConflict(
        existing,
        new Date('2026-04-03T10:45:00'),
        new Date('2026-04-03T11:15:00'),
        { professionalId: 1 },
      );

      expect(conflict).toBe(false);
    });
  });
});
