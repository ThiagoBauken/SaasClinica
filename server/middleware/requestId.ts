/**
 * Request ID Middleware
 * Adds a unique request ID to each request for tracing
 */
import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Use existing request ID from proxy/load balancer if valid, or generate new one
  const incoming = req.headers['x-request-id'] as string | undefined;
  const requestId = (incoming && /^[a-zA-Z0-9_\-]{1,64}$/.test(incoming))
    ? incoming
    : generateRequestId();

  // Set on request for logging
  req.headers['x-request-id'] = requestId;

  // Set on response for client correlation
  res.setHeader('x-request-id', requestId);

  next();
}

function generateRequestId(): string {
  return `req_${randomBytes(12).toString('hex')}`;
}
