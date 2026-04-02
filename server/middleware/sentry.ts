/**
 * Sentry Error Monitoring Integration
 * Only initializes if SENTRY_DSN is set
 */
import { logger } from '../logger';

let Sentry: any = null;

/**
 * Initialize Sentry if DSN is configured
 */
export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    logger.info('Sentry DSN not configured, error monitoring disabled');
    return;
  }

  try {
    Sentry = await import('@sentry/node');

    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.APP_VERSION || '1.0.0',

      // Performance monitoring
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

      // Filter out non-critical errors
      beforeSend(event: any, hint: any) {
        const error = hint?.originalException;

        // Don't send 4xx errors to Sentry
        if (error?.statusCode && error.statusCode < 500) {
          return null;
        }

        // Don't send rate limit errors
        if (error?.message?.includes('Too many requests')) {
          return null;
        }

        return event;
      },

      // Scrub sensitive data
      beforeBreadcrumb(breadcrumb: any) {
        if (breadcrumb.category === 'http') {
          // Remove auth headers from breadcrumbs
          if (breadcrumb.data?.headers) {
            delete breadcrumb.data.headers.authorization;
            delete breadcrumb.data.headers.cookie;
          }
        }
        return breadcrumb;
      },
    });

    logger.info('Sentry error monitoring initialized');
  } catch (error) {
    logger.warn({ err: error }, 'Failed to initialize Sentry');
  }
}

/**
 * Capture an exception in Sentry
 */
export function captureException(error: Error, context?: Record<string, any>): void {
  if (Sentry) {
    Sentry.captureException(error, {
      extra: context,
    });
  }
}

/**
 * Capture a message in Sentry
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (Sentry) {
    Sentry.captureMessage(message, level);
  }
}

/**
 * Set user context for Sentry
 */
export function setUser(user: { id: number; email?: string; companyId?: number }): void {
  if (Sentry) {
    Sentry.setUser({
      id: String(user.id),
      email: user.email,
      companyId: user.companyId,
    });
  }
}

/**
 * Get Sentry Express error handler (if initialized)
 */
export function getSentryErrorHandler(): any {
  if (Sentry) {
    return Sentry.expressErrorHandler();
  }
  return null;
}
