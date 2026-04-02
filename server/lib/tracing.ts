/**
 * Lightweight request tracing middleware.
 *
 * This provides basic tracing without the full OpenTelemetry SDK dependency.
 * It attaches timing data to each request and logs slow operations.
 *
 * When you're ready for full OTel, install @opentelemetry/sdk-node and
 * replace this with the SDK auto-instrumentation.
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

const traceLogger = logger.child({ module: 'tracing' });

// Threshold for slow request warning (ms)
const SLOW_REQUEST_MS = parseInt(process.env.SLOW_REQUEST_THRESHOLD || '2000');

// Threshold for slow DB query warning (ms)
const SLOW_QUERY_MS = parseInt(process.env.SLOW_QUERY_THRESHOLD || '500');

/**
 * Request tracing middleware.
 * Attaches a start time and logs slow requests with full context.
 */
export function requestTracingMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = process.hrtime.bigint();
  const requestId = req.headers['x-request-id'] as string || 'unknown';

  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - startTime) / 1e6; // ms

    if (duration > SLOW_REQUEST_MS && req.path.startsWith('/api')) {
      traceLogger.warn({
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Math.round(duration),
        userAgent: req.headers['user-agent']?.substring(0, 100),
      }, `Slow request: ${req.method} ${req.path} took ${Math.round(duration)}ms`);
    }
  });

  next();
}

/**
 * Wrap a database query with timing and slow query detection.
 *
 * Usage:
 *   const result = await traceDbQuery('get-patient-by-id', async () => {
 *     return db.query.patients.findFirst({ where: eq(patients.id, id) });
 *   });
 */
export async function traceDbQuery<T>(
  queryName: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const start = process.hrtime.bigint();

  try {
    const result = await fn();
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;

    if (durationMs > SLOW_QUERY_MS) {
      traceLogger.warn({
        query: queryName,
        durationMs: Math.round(durationMs),
        ...metadata,
      }, `Slow DB query: ${queryName} took ${Math.round(durationMs)}ms`);
    }

    return result;
  } catch (error) {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    traceLogger.error({
      query: queryName,
      durationMs: Math.round(durationMs),
      err: error,
      ...metadata,
    }, `DB query failed: ${queryName}`);
    throw error;
  }
}

/**
 * Wrap an external API call with timing.
 *
 * Usage:
 *   const result = await traceExternalCall('openai-chat', async () => {
 *     return openai.chat.completions.create(params);
 *   });
 */
export async function traceExternalCall<T>(
  serviceName: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const start = process.hrtime.bigint();

  try {
    const result = await fn();
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;

    traceLogger.info({
      service: serviceName,
      durationMs: Math.round(durationMs),
      ...metadata,
    }, `External call: ${serviceName} completed in ${Math.round(durationMs)}ms`);

    return result;
  } catch (error) {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    traceLogger.error({
      service: serviceName,
      durationMs: Math.round(durationMs),
      err: error,
      ...metadata,
    }, `External call failed: ${serviceName}`);
    throw error;
  }
}
