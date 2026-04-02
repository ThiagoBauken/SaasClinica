/**
 * Structured Logger - Production-grade logging with Pino
 * Replaces console.log with structured, JSON-formatted logs
 */
import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

// Base logger instance
export const logger = pino({
  level: logLevel,
  // In production: JSON output for log aggregation (ELK, Datadog, etc.)
  // In development: pretty-printed human-readable output
  ...(isProduction
    ? {
        formatters: {
          level: (label: string) => ({ level: label }),
          bindings: (bindings: pino.Bindings) => ({
            pid: bindings.pid,
            hostname: bindings.hostname,
            service: 'dental-saas',
          }),
        },
        // Redact sensitive fields from logs
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-api-key"]',
            'body.password',
            'body.token',
            'body.secret',
            'body.apiKey',
            'body.creditCard',
            '*.password',
            '*.token',
            '*.secret',
          ],
          censor: '[REDACTED]',
        },
      }
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
            messageFormat: '{msg}',
          },
        },
      }),
});

// Child loggers for different modules
export const dbLogger = logger.child({ module: 'database' });
export const authLogger = logger.child({ module: 'auth' });
export const billingLogger = logger.child({ module: 'billing' });
export const apiLogger = logger.child({ module: 'api' });
export const queueLogger = logger.child({ module: 'queue' });
export const wsLogger = logger.child({ module: 'websocket' });
export const cacheLogger = logger.child({ module: 'cache' });

/**
 * Backwards-compatible log function
 * Used by vite.ts and other modules that import { log }
 */
export function log(message: string, source = 'express') {
  logger.info({ source }, message);
}

export default logger;
