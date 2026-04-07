/**
 * CSRF Protection Middleware
 * Uses double-submit cookie pattern for SPA compatibility
 */
import { Request, Response, NextFunction } from 'express';
import { randomBytes, timingSafeEqual } from 'crypto';
import { logger } from '../logger';

const CSRF_COOKIE_NAME = '_csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const TOKEN_LENGTH = 32;

/**
 * Generate a random CSRF token
 */
function generateToken(): string {
  return randomBytes(TOKEN_LENGTH).toString('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks on CSRF tokens.
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

/**
 * CSRF middleware using double-submit cookie pattern
 * - Sets a CSRF token in a cookie (httpOnly: false so JS can read it)
 * - Validates that the token is sent back in a header on state-changing requests
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Skip CSRF for safe methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    // Ensure token cookie exists
    if (!req.cookies?.[CSRF_COOKIE_NAME]) {
      const token = generateToken();
      res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: false, // Must be readable by JavaScript
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });
    }
    return next();
  }

  // Skip CSRF for API key authenticated requests — ONLY if key is actually valid
  // (Previously skipped for ANY request with the header present, regardless of key validity)
  if (req.headers['x-api-key'] && process.env.SAAS_MASTER_API_KEY &&
      req.headers['x-api-key'] === process.env.SAAS_MASTER_API_KEY) {
    return next();
  }

  // Skip CSRF for webhook endpoints
  if (req.path.startsWith('/api/webhooks/') || req.path.startsWith('/api/stripe/webhook')) {
    return next();
  }

  // Skip CSRF for public endpoints
  if (req.path.startsWith('/api/public/')) {
    return next();
  }

  // Validate CSRF token on state-changing requests
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME] as string;

  if (!cookieToken || !headerToken || !constantTimeCompare(cookieToken, headerToken)) {
    logger.warn({
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      hasCookie: !!cookieToken,
      hasHeader: !!headerToken,
    }, 'CSRF token validation failed');

    res.status(403).json({
      error: {
        code: 'CSRF_ERROR',
        message: 'Invalid or missing CSRF token',
      },
    });
    return;
  }

  // Keep the same token (don't rotate - avoids desync between cookie and JS)
  next();
}

/**
 * Endpoint to get CSRF token (for SPAs that need to initialize)
 */
export function csrfTokenEndpoint(req: Request, res: Response): void {
  let token = req.cookies?.[CSRF_COOKIE_NAME];
  if (!token) {
    token = generateToken();
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
    });
  }
  res.json({ token });
}
