/**
 * Availability Service
 *
 * Provides real-time slot availability for the WhatsApp chatbot booking flow.
 * Replaces the naive 07:00–20:00 time-range check with a full schedule-aware
 * computation that respects:
 *   - Professional working hours (including lunch breaks)
 *   - Schedule blocks (vacations, maintenance, etc.)
 *   - Public and clinic-specific holidays
 *   - Existing appointments
 *   - Redis-based ephemeral slot holds (5-minute TTL) to prevent double-booking
 *     during the chatbot confirmation step
 *
 * Graceful degradation: when Redis is unavailable every operation that touches
 * Redis is silently skipped — availability queries still work, hold/release
 * operations return safe defaults.
 */

import { db } from '../db';
import {
  workingHours,
  scheduleBlocks,
  holidays,
  appointments,
  users,
} from '@shared/schema';
import { eq, and, gte, lte, ne, isNull, or, inArray } from 'drizzle-orm';
import { redisConnection } from '../queue/config';
import { logger } from '../logger';

const log = logger.child({ module: 'availability-service' });

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TimeSlot {
  startTime: Date;
  endTime: Date;
  professionalId: number;
  professionalName: string;
}

// Internal narrow type used during slot generation
interface ProfessionalWindow {
  professionalId: number;
  professionalName: string;
  dayStart: Date;   // absolute timestamp for work start
  dayEnd: Date;     // absolute timestamp for work end
  breakStart: Date | null;
  breakEnd: Date | null;
}

// Row shapes returned by the three main queries (keeps callbacks typed)
interface HolidayRow {
  id: number;
  name: string;
  isRecurringYearly: boolean;
  date: Date;
}

interface BlockRow {
  professionalId: number | null;
  startTime: Date;
  endTime: Date;
  allDay: boolean | null;
}

interface AppointmentRow {
  professionalId: number | null;
  startTime: Date;
  endTime: Date;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_DURATION_MINUTES = 30;
const MAX_SLOTS_RETURNED = 8;
const HOLD_TTL_SECONDS = 5 * 60; // 5 minutes

// Appointment statuses that occupy a slot
const ACTIVE_STATUSES = ['scheduled', 'confirmed', 'arrived', 'in_progress'];

// ---------------------------------------------------------------------------
// Helper: parse "HH:MM" into a Date on the given day (local-time semantics)
// ---------------------------------------------------------------------------

function parseTimeOnDay(day: Date, hhmm: string): Date {
  const [hh, mm] = hhmm.split(':').map(Number);
  const result = new Date(day);
  result.setHours(hh, mm, 0, 0);
  return result;
}

// ---------------------------------------------------------------------------
// Helper: build a Redis key for a slot hold
// ---------------------------------------------------------------------------

function holdKey(
  companyId: number,
  professionalId: number,
  startTime: Date,
): string {
  return `slot-hold:${companyId}:${professionalId}:${startTime.toISOString()}`;
}

// ---------------------------------------------------------------------------
// Helper: check whether two half-open intervals [as, ae) and [bs, be) overlap
// ---------------------------------------------------------------------------

function overlaps(as: Date, ae: Date, bs: Date, be: Date): boolean {
  return as < be && ae > bs;
}

// ---------------------------------------------------------------------------
// getAvailableSlots
// ---------------------------------------------------------------------------

/**
 * Returns up to MAX_SLOTS_RETURNED available time slots for a given day.
 *
 * @param companyId        Tenant identifier — all queries are scoped to it.
 * @param date             The calendar date to check (time component is ignored).
 * @param procedureDuration Duration in minutes for the procedure; defaults to 30.
 * @param professionalId   When provided, only that professional is considered.
 *                         When omitted, every active dentist with configured
 *                         working hours is evaluated and results are merged.
 */
export async function getAvailableSlots(
  companyId: number,
  date: Date,
  procedureDuration: number = DEFAULT_DURATION_MINUTES,
  professionalId?: number,
): Promise<TimeSlot[]> {
  // Normalise to midnight so all comparisons are calendar-day based
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const dayOfWeek = dayStart.getDay(); // 0 = Sunday … 6 = Saturday

  log.debug(
    { companyId, date: dayStart.toISOString(), procedureDuration, professionalId },
    'getAvailableSlots called',
  );

  // ------------------------------------------------------------------
  // Step 1 — Holiday check (national + clinic-specific)
  // ------------------------------------------------------------------
  const holidayRows = await db
    .select({ id: holidays.id, name: holidays.name, isRecurringYearly: holidays.isRecurringYearly, date: holidays.date })
    .from(holidays)
    .where(
      or(
        // clinic-specific holiday
        eq(holidays.companyId, companyId),
        // national holiday (companyId IS NULL)
        isNull(holidays.companyId),
      ),
    );

  const isHoliday = (holidayRows as HolidayRow[]).some((h) => {
    const hDate = new Date(h.date);
    if (h.isRecurringYearly) {
      // Match by day-of-month + month regardless of year
      return hDate.getDate() === dayStart.getDate() &&
             hDate.getMonth() === dayStart.getMonth();
    }
    // Exact date match
    return hDate.getFullYear() === dayStart.getFullYear() &&
           hDate.getMonth() === dayStart.getMonth() &&
           hDate.getDate() === dayStart.getDate();
  });

  if (isHoliday) {
    log.debug({ companyId, date: dayStart.toISOString() }, 'Day is a holiday — returning empty slots');
    return [];
  }

  // ------------------------------------------------------------------
  // Step 2 — Fetch working hours
  // ------------------------------------------------------------------
  const whQuery = db
    .select({
      userId: workingHours.userId,
      dayOfWeek: workingHours.dayOfWeek,
      startTime: workingHours.startTime,
      endTime: workingHours.endTime,
      isWorking: workingHours.isWorking,
      breakStart: workingHours.breakStart,
      breakEnd: workingHours.breakEnd,
    })
    .from(workingHours)
    .innerJoin(users, eq(users.id, workingHours.userId))
    .where(
      and(
        eq(users.companyId, companyId),
        eq(workingHours.dayOfWeek, dayOfWeek),
        eq(workingHours.isWorking, true),
        eq(users.active, true),
        // only dentists / professionals carry a schedule
        inArray(users.role, ['dentist', 'admin']),
        ...(professionalId !== undefined ? [eq(workingHours.userId, professionalId)] : []),
      ),
    );

  const workingHourRows = await whQuery;

  if (workingHourRows.length === 0) {
    log.debug({ companyId, dayOfWeek }, 'No working hours configured for this day');
    return [];
  }

  // ------------------------------------------------------------------
  // Step 3 — Fetch schedule blocks that cover this day
  // ------------------------------------------------------------------
  const blockRows = await db
    .select({
      professionalId: scheduleBlocks.professionalId,
      startTime: scheduleBlocks.startTime,
      endTime: scheduleBlocks.endTime,
      allDay: scheduleBlocks.allDay,
    })
    .from(scheduleBlocks)
    .where(
      and(
        eq(scheduleBlocks.companyId, companyId),
        // block starts before end of day AND ends after start of day
        lte(scheduleBlocks.startTime, dayEnd),
        gte(scheduleBlocks.endTime, dayStart),
        isNull(scheduleBlocks.deletedAt),
        ...(professionalId !== undefined
          ? [
              or(
                eq(scheduleBlocks.professionalId, professionalId),
                isNull(scheduleBlocks.professionalId), // company-wide blocks
              ),
            ]
          : []),
      ),
    );

  // ------------------------------------------------------------------
  // Step 4 — Fetch existing appointments for the day
  // ------------------------------------------------------------------
  const appointmentRows = await db
    .select({
      professionalId: appointments.professionalId,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.companyId, companyId),
        gte(appointments.startTime, dayStart),
        lte(appointments.startTime, dayEnd),
        inArray(appointments.status, ACTIVE_STATUSES),
        isNull(appointments.deletedAt),
        ...(professionalId !== undefined
          ? [eq(appointments.professionalId, professionalId)]
          : []),
      ),
    );

  // ------------------------------------------------------------------
  // Step 5 — Build professional windows
  // ------------------------------------------------------------------
  const windows: ProfessionalWindow[] = [];

  for (const wh of workingHourRows) {
    // Fetch professional name (already joined above but Drizzle select didn't
    // include fullName — we query it inline rather than bloating the join)
    const professionalRow = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(eq(users.id, wh.userId))
      .limit(1);

    if (professionalRow.length === 0) continue;

    const name = professionalRow[0].fullName;

    windows.push({
      professionalId: wh.userId,
      professionalName: name,
      dayStart: parseTimeOnDay(dayStart, wh.startTime),
      dayEnd: parseTimeOnDay(dayStart, wh.endTime),
      breakStart:
        wh.breakStart ? parseTimeOnDay(dayStart, wh.breakStart) : null,
      breakEnd:
        wh.breakEnd ? parseTimeOnDay(dayStart, wh.breakEnd) : null,
    });
  }

  if (windows.length === 0) {
    return [];
  }

  // ------------------------------------------------------------------
  // Step 6 — Generate raw candidate slots, exclude blocked/taken ones
  // ------------------------------------------------------------------
  const now = new Date();
  const durationMs = procedureDuration * 60 * 1000;
  const candidateSlots: TimeSlot[] = [];

  for (const window of windows) {
    // Iterate in procedureDuration increments across the working day
    let cursor = new Date(window.dayStart);

    while (cursor.getTime() + durationMs <= window.dayEnd.getTime()) {
      const slotStart = new Date(cursor);
      const slotEnd = new Date(cursor.getTime() + durationMs);

      // a) Skip slots in the past (only relevant when date === today)
      if (slotEnd <= now) {
        cursor = new Date(cursor.getTime() + durationMs);
        continue;
      }

      // b) Skip if slot overlaps the lunch break
      const inBreak =
        window.breakStart !== null &&
        window.breakEnd !== null &&
        overlaps(slotStart, slotEnd, window.breakStart, window.breakEnd);

      if (inBreak) {
        // Jump cursor to end of break to avoid iterating slot-by-slot through it
        cursor = new Date(window.breakEnd!.getTime());
        continue;
      }

      // c) Skip if slot overlaps any schedule block for this professional
      const blockedBySchedule = (blockRows as BlockRow[]).some((b) => {
        const blockProfId = b.professionalId;
        // Block applies if it has no professional (company-wide) OR targets this professional
        const appliesToPro =
          blockProfId === null || blockProfId === window.professionalId;
        if (!appliesToPro) return false;
        if (b.allDay) return true;
        return overlaps(slotStart, slotEnd, new Date(b.startTime), new Date(b.endTime));
      });

      if (blockedBySchedule) {
        cursor = new Date(cursor.getTime() + durationMs);
        continue;
      }

      // d) Skip if slot overlaps an existing appointment
      const takenByAppointment = (appointmentRows as AppointmentRow[]).some((a) => {
        if (
          a.professionalId !== null &&
          a.professionalId !== window.professionalId
        ) {
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
  }

  // ------------------------------------------------------------------
  // Step 7 — Remove any slot that is held in Redis by another session
  // ------------------------------------------------------------------
  const availableSlots = await filterHeldSlots(candidateSlots, companyId);

  // Sort chronologically, then by professional name as tiebreaker
  availableSlots.sort(
    (a, b) =>
      a.startTime.getTime() - b.startTime.getTime() ||
      a.professionalName.localeCompare(b.professionalName),
  );

  log.debug(
    {
      companyId,
      date: dayStart.toISOString(),
      candidates: candidateSlots.length,
      afterHoldFilter: availableSlots.length,
    },
    'Slot computation complete',
  );

  return availableSlots.slice(0, MAX_SLOTS_RETURNED);
}

// ---------------------------------------------------------------------------
// holdSlot
// ---------------------------------------------------------------------------

/**
 * Temporarily reserves a slot for a chat session while the patient confirms.
 *
 * Uses Redis SET NX EX so only the first caller wins; subsequent callers for
 * the same slot receive false.  If Redis is unavailable the function logs a
 * warning and returns true (optimistic: we allow the booking to proceed rather
 * than blocking the patient with a Redis-outage error).
 *
 * @returns true if the hold was acquired, false if already held by another.
 */
export async function holdSlot(
  companyId: number,
  professionalId: number,
  startTime: Date,
  holderId: string, // chat session ID
): Promise<boolean> {
  const redis = redisConnection;

  if (!redis) {
    log.warn('Redis unavailable — skipping slot hold (optimistic allow)');
    return true;
  }

  const key = holdKey(companyId, professionalId, startTime);

  try {
    // SET key value NX EX ttl — returns "OK" on success, null if key exists
    const result = await redis.set(key, holderId, 'EX', HOLD_TTL_SECONDS, 'NX');
    const acquired = result === 'OK';

    log.debug(
      { key, holderId, acquired },
      acquired ? 'Slot hold acquired' : 'Slot already held by another session',
    );

    return acquired;
  } catch (err) {
    log.error({ err, key }, 'Redis error during holdSlot — optimistic allow');
    return true;
  }
}

// ---------------------------------------------------------------------------
// releaseSlot
// ---------------------------------------------------------------------------

/**
 * Releases a hold only when the requesting session is the current holder.
 * Uses a Lua script for atomic read-then-delete to avoid releasing a hold
 * that was just acquired by a different session after TTL expiry.
 */
export async function releaseSlot(
  companyId: number,
  professionalId: number,
  startTime: Date,
  holderId: string,
): Promise<boolean> {
  const redis = redisConnection;

  if (!redis) {
    log.warn('Redis unavailable — cannot release slot hold');
    return false;
  }

  const key = holdKey(companyId, professionalId, startTime);

  // Lua script: delete only if value matches holderId
  const luaScript = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    else
      return 0
    end
  `;

  try {
    const result = await redis.eval(luaScript, 1, key, holderId) as number;
    const released = result === 1;

    log.debug({ key, holderId, released }, released ? 'Slot hold released' : 'Slot hold not owned by this session');
    return released;
  } catch (err) {
    log.error({ err, key }, 'Redis error during releaseSlot');
    return false;
  }
}

// ---------------------------------------------------------------------------
// filterHeldSlots
// ---------------------------------------------------------------------------

/**
 * Removes from the candidates array any slot that is currently held in Redis
 * by a session other than `excludeHolder`.
 *
 * When `excludeHolder` is provided the holder's own held slot is kept visible
 * so the chatbot can show it back to the patient during confirmation.
 *
 * Fails open: if Redis is down all slots pass through unchanged.
 */
export async function filterHeldSlots(
  slots: TimeSlot[],
  companyId: number,
  excludeHolder?: string,
): Promise<TimeSlot[]> {
  const redis = redisConnection;

  if (!redis || slots.length === 0) {
    return slots;
  }

  // Build keys for all slots and fetch in a single pipeline call
  const keys = slots.map((s) =>
    holdKey(companyId, s.professionalId, s.startTime),
  );

  let holdValues: (string | null)[];

  try {
    // MGET returns an array of values (null when key does not exist)
    holdValues = await redis.mget(...keys);
  } catch (err) {
    log.error({ err }, 'Redis error during filterHeldSlots — returning all slots');
    return slots;
  }

  return slots.filter((slot, index) => {
    const heldBy = holdValues[index];

    // Not held — slot is free
    if (heldBy === null) return true;

    // Held by the caller's own session — keep it visible for them
    if (excludeHolder && heldBy === excludeHolder) return true;

    // Held by someone else — remove from results
    log.debug(
      { key: keys[index], heldBy },
      'Slot filtered out (held by another session)',
    );
    return false;
  });
}
