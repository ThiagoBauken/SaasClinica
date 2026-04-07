/**
 * Circuit Breaker — lightweight, zero-dependency implementation.
 *
 * State machine:
 *   CLOSED   → normal operation; consecutive failures increment a counter.
 *   OPEN     → fast-fail; after resetTimeoutMs transitions to HALF_OPEN.
 *   HALF_OPEN → probe mode; up to halfOpenMaxCalls are allowed through.
 *               First success → CLOSED.  Any failure → OPEN again.
 */
import { logger } from '../logger';

type State = 'closed' | 'open' | 'half-open';

interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number;  // consecutive failures before tripping  (default 5)
  resetTimeoutMs?: number;    // ms to wait before entering HALF_OPEN   (default 30 000)
  halfOpenMaxCalls?: number;  // probe calls allowed in HALF_OPEN       (default 1)
}

interface CircuitStats {
  failures: number;
  successes: number;
  state: string;
  lastFailure?: Date;
}

const cb_logger = logger.child({ module: 'circuit-breaker' });

export class CircuitBreaker {
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMaxCalls: number;

  private state: State = 'closed';
  private failures = 0;
  private successes = 0;
  private halfOpenCalls = 0;
  private lastFailure?: Date;
  private openedAt?: Date;

  constructor(options: CircuitBreakerOptions) {
    this.name            = options.name;
    this.failureThreshold = options.failureThreshold  ?? 5;
    this.resetTimeoutMs  = options.resetTimeoutMs     ?? 30_000;
    this.halfOpenMaxCalls = options.halfOpenMaxCalls  ?? 1;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.maybeTransitionToHalfOpen();

    if (this.state === 'open') {
      throw new Error(
        `CircuitBreaker [${this.name}] is OPEN — request rejected. ` +
        `Retrying after ${this.resetTimeoutMs}ms.`
      );
    }

    if (this.state === 'half-open') {
      if (this.halfOpenCalls >= this.halfOpenMaxCalls) {
        throw new Error(
          `CircuitBreaker [${this.name}] is HALF_OPEN and probe quota exhausted.`
        );
      }
      this.halfOpenCalls++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  getState(): State {
    this.maybeTransitionToHalfOpen();
    return this.state;
  }

  getStats(): CircuitStats & { name: string } {
    return {
      name:        this.name,
      failures:    this.failures,
      successes:   this.successes,
      state:       this.getState(),
      lastFailure: this.lastFailure,
    };
  }

  reset(): void {
    cb_logger.info({ circuit: this.name }, 'Circuit manually reset → CLOSED');
    this.transitionTo('closed');
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private onSuccess(): void {
    this.successes++;
    if (this.state === 'half-open') {
      cb_logger.info({ circuit: this.name }, 'Probe succeeded — HALF_OPEN → CLOSED');
      this.transitionTo('closed');
    } else {
      // Reset the consecutive failure counter on any success while CLOSED.
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = new Date();

    if (this.state === 'half-open') {
      cb_logger.warn({ circuit: this.name }, 'Probe failed — HALF_OPEN → OPEN');
      this.transitionTo('open');
      return;
    }

    if (this.state === 'closed' && this.failures >= this.failureThreshold) {
      cb_logger.error(
        { circuit: this.name, failures: this.failures },
        'Failure threshold reached — CLOSED → OPEN'
      );
      this.transitionTo('open');
    }
  }

  private maybeTransitionToHalfOpen(): void {
    if (
      this.state === 'open' &&
      this.openedAt &&
      Date.now() - this.openedAt.getTime() >= this.resetTimeoutMs
    ) {
      cb_logger.info(
        { circuit: this.name, resetTimeoutMs: this.resetTimeoutMs },
        'Reset timeout elapsed — OPEN → HALF_OPEN'
      );
      this.transitionTo('half-open');
    }
  }

  private transitionTo(next: State): void {
    this.state = next;
    if (next === 'open')      { this.openedAt = new Date(); }
    if (next === 'closed')    { this.failures = 0; this.halfOpenCalls = 0; this.openedAt = undefined; }
    if (next === 'half-open') { this.halfOpenCalls = 0; }
  }
}

// ── Pre-configured instances ────────────────────────────────────────────────

export const stripeCircuit = new CircuitBreaker({
  name: 'stripe',
  failureThreshold: 3,
  resetTimeoutMs: 60_000,
});

export const whatsappCircuit = new CircuitBreaker({
  name: 'whatsapp',
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
});

export const googleCalendarCircuit = new CircuitBreaker({
  name: 'google-calendar',
  failureThreshold: 3,
  resetTimeoutMs: 45_000,
});

export const openaiCircuit = new CircuitBreaker({
  name: 'openai',
  failureThreshold: 3,
  resetTimeoutMs: 60_000,
});

// Registry so new instances can be added and the health endpoint stays current.
const registry: CircuitBreaker[] = [
  stripeCircuit,
  whatsappCircuit,
  googleCalendarCircuit,
  openaiCircuit,
];

// ── Health check helper ─────────────────────────────────────────────────────

/**
 * Returns a flat status map suitable for inclusion in a /health or
 * /api/admin/circuit-breakers response.
 */
export function getCircuitBreakerStatus(): Record<string, { state: string; failures: number }> {
  return Object.fromEntries(
    registry.map((cb) => {
      const stats = cb.getStats();
      return [stats.name, { state: stats.state, failures: stats.failures }];
    })
  );
}
