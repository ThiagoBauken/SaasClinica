/**
 * Granular Permission Check Middleware
 *
 * Provides two exported helpers:
 *
 *   requirePermission(...names) — factory that returns Express middleware
 *     checking whether the authenticated user holds ALL of the named
 *     permissions (via user_permissions or role_permissions tables).
 *     Results are cached per (userId, companyId) for 5 minutes.
 *
 *   dentistIsolation — middleware that injects professionalId = user.id
 *     into req.query for dentist-role requests so they only see their
 *     own records. Admin / superadmin roles are unaffected.
 *
 * Bypass rules (no DB hit needed):
 *   - role === 'superadmin' → always allowed
 *   - role === 'admin'      → always allowed
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { logger } from '../logger';

const log = logger.child({ module: 'permission-check' });

// ---------------------------------------------------------------------------
// In-process permission cache (TTL = 5 minutes)
// ---------------------------------------------------------------------------

interface PermissionCacheEntry {
  permissions: string[];
  expiresAt: number;
}

const permissionCache = new Map<string, PermissionCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Invalidates the cached permissions for a user.
 * Call this after role or permission changes are persisted.
 */
export function invalidatePermissionCache(userId: number, companyId: number): void {
  const key = `${userId}_${companyId}`;
  permissionCache.delete(key);
}

/**
 * Evicts all stale entries from the cache.
 * Called automatically when the cache grows large.
 */
function evictExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of permissionCache) {
    if (entry.expiresAt < now) {
      permissionCache.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// requirePermission(...names)
// ---------------------------------------------------------------------------

/**
 * Returns Express middleware that ensures the authenticated user holds
 * ALL of the listed permission names.
 *
 * Usage:
 *   router.delete('/patient/:id', requirePermission('patients:delete'), handler);
 *   router.post('/payment',       requirePermission('payments:create', 'financial:write'), handler);
 */
export function requirePermission(...requiredPermissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as any;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Superadmin and admin bypass all granular checks
    if (user.role === 'superadmin' || user.role === 'admin') {
      return next();
    }

    const cacheKey = `${user.id}_${user.companyId}`;

    // --- cache lookup ---
    const cached = permissionCache.get(cacheKey);
    let userPermissions: string[];

    if (cached && cached.expiresAt > Date.now()) {
      userPermissions = cached.permissions;
    } else {
      try {
        // Union of permissions granted directly to the user OR via their role
        const result = await db.$client.query(
          `SELECT DISTINCT p.name
           FROM permissions p
           WHERE p.id IN (
             -- Direct user grants
             SELECT permission_id FROM user_permissions WHERE user_id = $1
             UNION ALL
             -- Role-based grants
             SELECT rp.permission_id
             FROM role_permissions rp
             JOIN roles r ON r.id = rp.role_id
             WHERE r.name = $2
           )`,
          [user.id, user.role],
        );

        userPermissions = result.rows.map((r: any) => r.name as string);

        // Prune cache if it is getting large before adding a new entry
        if (permissionCache.size >= 500) {
          evictExpiredEntries();
        }

        permissionCache.set(cacheKey, {
          permissions: userPermissions,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
      } catch (err) {
        log.error({ err, userId: user.id }, 'Failed to fetch permissions from DB');
        return res.status(500).json({ error: 'Erro ao verificar permissoes' });
      }
    }

    const hasAll = requiredPermissions.every((p) => userPermissions.includes(p));

    if (!hasAll) {
      log.warn(
        { userId: user.id, role: user.role, required: requiredPermissions },
        'Permission denied',
      );
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: requiredPermissions,
        message: 'Voce nao tem permissao para executar esta acao.',
      });
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// dentistIsolation
// ---------------------------------------------------------------------------

/**
 * Middleware that restricts dentist-role users to their own records by
 * injecting their user ID as the `professionalId` query parameter.
 *
 * Routes that support filtering by professionalId will automatically scope
 * the result to the authenticated dentist without any additional logic.
 *
 * Admin and superadmin roles are not affected.
 */
export function dentistIsolation(req: Request, res: Response, next: NextFunction): void {
  const user = req.user as any;

  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (user.role === 'admin' || user.role === 'superadmin') {
    // Full access — no filter injected
    return next();
  }

  if (user.role === 'dentist') {
    // Force-scope queries to the dentist's own records
    req.query.professionalId = String(user.id);
    log.debug({ userId: user.id }, 'Dentist isolation applied');
  }

  next();
}
