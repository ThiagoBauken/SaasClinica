/**
 * 2FA Enforcement Middleware
 *
 * Adds advisory response headers when an admin-role user has not yet
 * enabled TOTP two-factor authentication.
 *
 * Design decision — warn, don't block:
 *   Blocking access unconditionally would lock out admins who have not
 *   gone through 2FA setup yet, which could break the onboarding flow.
 *   Instead the middleware attaches headers that the frontend can read
 *   to display a persistent banner or redirect to the 2FA setup page.
 *
 * Headers set when 2FA is absent:
 *   X-2FA-Required: true
 *   X-2FA-Message:  (human-readable Portuguese prompt)
 *
 * To fully enforce 2FA (blocking non-compliant admins) wrap the desired
 * routes with the stricter `enforce2FAStrict` export below.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

const log = logger.child({ module: 'enforce-2fa' });

// ---------------------------------------------------------------------------
// Advisory middleware (sets headers, does NOT block)
// ---------------------------------------------------------------------------

/**
 * Attaches 2FA advisory headers for admin users without TOTP enabled.
 * Safe to apply globally — non-admin requests are unaffected.
 */
export function enforce2FA(req: Request, res: Response, next: NextFunction): void {
  const user = req.user as any;

  if (!user) {
    return next();
  }

  if (user.role === 'admin' && !user.totpEnabled) {
    res.setHeader('X-2FA-Required', 'true');
    res.setHeader(
      'X-2FA-Message',
      'Autenticacao de dois fatores recomendada para administradores. Configure em Configuracoes > Seguranca.',
    );
    log.debug({ userId: user.id }, '2FA advisory header set for admin without TOTP');
  }

  next();
}

// ---------------------------------------------------------------------------
// Strict enforcement middleware (blocks access when 2FA absent)
// ---------------------------------------------------------------------------

/**
 * Returns 403 for admin-role users who have not enabled TOTP.
 *
 * Apply to specific sensitive routes only (e.g., bulk delete, billing,
 * superadmin actions) rather than globally.
 *
 * The frontend should redirect to `/settings/security` when it receives
 * this error code so the user can complete 2FA setup.
 *
 * Usage:
 *   router.delete('/bulk', enforce2FAStrict, asyncHandler(handler));
 */
export function enforce2FAStrict(req: Request, res: Response, next: NextFunction): void {
  const user = req.user as any;

  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Only applies to admin role; superadmin is assumed to manage 2FA separately
  if (user.role === 'admin' && !user.totpEnabled) {
    log.warn({ userId: user.id }, 'Admin attempted sensitive action without 2FA enabled');
    res.status(403).json({
      error: '2FA required',
      code: 'TWO_FACTOR_REQUIRED',
      message:
        'Esta acao requer autenticacao de dois fatores (2FA). Configure o 2FA em Configuracoes > Seguranca.',
      setupUrl: '/settings/security',
    });
    return;
  }

  next();
}
