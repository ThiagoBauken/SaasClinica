/**
 * AppointmentRepository — pagination and filter tests
 *
 * Validates the SQL-level pagination refactor: getAppointments must call
 * .limit()/.offset() when filters include them, and countAppointments must
 * return a single integer from COALESCE(count(*)::int).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module. We build a chainable fake that records every method
// call so we can assert limit/offset were applied at the SQL layer.
const callLog: { method: string; args: any[] }[] = [];

const makeChainable = (finalValue: any) => {
  const chain: any = {};
  const methods = [
    'select', 'from', 'leftJoin', 'innerJoin', 'where',
    'orderBy', 'groupBy', '$dynamic',
  ];
  for (const m of methods) {
    chain[m] = vi.fn((...args: any[]) => {
      callLog.push({ method: m, args });
      return chain;
    });
  }
  chain.limit = vi.fn((n: number) => {
    callLog.push({ method: 'limit', args: [n] });
    return chain;
  });
  chain.offset = vi.fn((n: number) => {
    callLog.push({ method: 'offset', args: [n] });
    return chain;
  });
  // `then` allows `await chain` to resolve to finalValue
  chain.then = (resolve: any) => resolve(finalValue);
  return chain;
};

vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn(() => makeChainable([])),
  },
}));

// Also mock the logger to silence output during tests
vi.mock('../../server/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    child: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })),
  },
}));

import { getAppointments, countAppointments } from '../../server/repositories/AppointmentRepository';
import { db } from '../../server/db';

describe('AppointmentRepository — pagination', () => {
  beforeEach(() => {
    callLog.length = 0;
    vi.clearAllMocks();
  });

  it('should NOT call .limit() when no pagination filter is provided', async () => {
    (db.select as any).mockReturnValue(makeChainable([]));

    await getAppointments(1, {});

    const limitCalls = callLog.filter((c) => c.method === 'limit');
    expect(limitCalls).toHaveLength(0);
  });

  it('should call .limit() and .offset() when filters include them', async () => {
    (db.select as any).mockReturnValue(makeChainable([]));

    await getAppointments(1, { limit: 50, offset: 100 });

    const limitCalls = callLog.filter((c) => c.method === 'limit');
    const offsetCalls = callLog.filter((c) => c.method === 'offset');
    expect(limitCalls[0]?.args).toEqual([50]);
    expect(offsetCalls[0]?.args).toEqual([100]);
  });

  it('should call .limit() without .offset() when only limit is provided', async () => {
    (db.select as any).mockReturnValue(makeChainable([]));

    await getAppointments(1, { limit: 25 });

    const limitCalls = callLog.filter((c) => c.method === 'limit');
    const offsetCalls = callLog.filter((c) => c.method === 'offset');
    expect(limitCalls[0]?.args).toEqual([25]);
    expect(offsetCalls).toHaveLength(0);
  });
});

describe('AppointmentRepository — countAppointments', () => {
  beforeEach(() => {
    callLog.length = 0;
    vi.clearAllMocks();
  });

  it('should return the count integer from the first row', async () => {
    (db.select as any).mockReturnValue(makeChainable([{ count: 42 }]));

    const result = await countAppointments(1, {});

    expect(result).toBe(42);
  });

  it('should return 0 when no rows match', async () => {
    (db.select as any).mockReturnValue(makeChainable([]));

    const result = await countAppointments(1, {});

    expect(result).toBe(0);
  });
});
