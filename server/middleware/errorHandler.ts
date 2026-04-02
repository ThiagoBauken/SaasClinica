/**
 * Global Error Handler Middleware
 * Catches all unhandled errors and returns standardized responses
 */
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../logger';

// Custom application error class
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// Common error factories
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ValidationError extends AppError {
  public readonly details: any;
  constructor(message: string = 'Validation failed', details?: any) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export class PaymentRequiredError extends AppError {
  constructor(message: string = 'Payment required') {
    super(message, 402, 'PAYMENT_REQUIRED');
  }
}

/**
 * Global error handler middleware - must be registered LAST
 */
export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Determine status code and error info
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details: any = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    if ('details' in err && (err as any).details) {
      details = (err as any).details;
    }
  } else if (err instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = err.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
  } else if (err.message?.includes('CORS')) {
    statusCode = 403;
    code = 'CORS_ERROR';
    message = 'Origin not allowed';
  }

  // Log the error
  const isServerError = statusCode >= 500;
  const logData = {
    err: isServerError ? err : undefined,
    statusCode,
    code,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: (req.user as any)?.id,
    companyId: (req.user as any)?.companyId,
  };

  if (isServerError) {
    logger.error(logData, `Unhandled error: ${err.message}`);
  } else {
    logger.warn(logData, `Client error: ${err.message}`);
  }

  // Send response
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    error: {
      code,
      message: isProduction && isServerError
        ? 'An internal server error occurred. Our team has been notified.'
        : message,
      ...(details && { details }),
      ...(!isProduction && isServerError && { stack: err.stack }),
    },
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || undefined,
  });
}

/**
 * 404 handler for unmatched routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Catch unhandled rejections and uncaught exceptions
 */
export function setupProcessErrorHandlers(): void {
  process.on('unhandledRejection', (reason: any) => {
    logger.fatal({ err: reason }, 'Unhandled Promise Rejection');
    // In production, gracefully shut down
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });

  process.on('uncaughtException', (error: Error) => {
    logger.fatal({ err: error }, 'Uncaught Exception');
    // Always exit on uncaught exceptions
    process.exit(1);
  });

  // Graceful shutdown signals
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  signals.forEach((signal) => {
    process.on(signal, () => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      // Give in-flight requests 10 seconds to complete
      setTimeout(() => {
        logger.warn('Forceful shutdown after timeout');
        process.exit(1);
      }, 10000);
    });
  });
}
