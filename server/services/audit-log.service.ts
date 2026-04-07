import { Request } from 'express';
import { db } from '../db';
import { logger } from '../logger';

const auditLogger = logger.child({ module: 'audit-log-service' });

/**
 * Supported audit actions.
 *
 * Maps to the `action` column of the `audit_logs` table.
 * Keep this list aligned with CHECK constraints if you add one to the DB.
 */
export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'view'
  | 'export'
  | 'login'
  | 'logout';

export interface AuditLogEntry {
  /** Tenant scope — must be a real company ID, never 0 or undefined */
  companyId: number;
  /** Authenticated user performing the action */
  userId: number;
  action: AuditAction;
  /** Domain object being acted upon: patient, appointment, financial, prescription, evolution, etc. */
  resourceType: string;
  /** Primary key of the affected row, when known */
  resourceId?: number;
  /** Free-form structured detail (before/after values, export params, etc.) */
  details?: Record<string, unknown>;
  /** Client IP address */
  ipAddress?: string;
  /** HTTP User-Agent header */
  userAgent?: string;
}

/**
 * Writes a single audit log entry using a raw SQL INSERT.
 *
 * The `audit_logs` table may not yet be reflected in Drizzle's schema, so we
 * use `db.$client.query()` directly — consistent with the pattern used
 * throughout this codebase for tables that pre-date ORM coverage.
 *
 * Failures are swallowed and logged: audit logging must never interrupt the
 * primary request path.
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  // Hard guard: never write an audit log without a real tenant context
  if (!entry.companyId || !entry.userId) {
    auditLogger.warn(
      { entry },
      'createAuditLog called without companyId or userId — skipping'
    );
    return;
  }

  try {
    await db.$client.query(
      `INSERT INTO audit_logs
         (company_id, user_id, action, resource, resource_id, changes, ip_address, user_agent)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        entry.companyId,
        entry.userId,
        entry.action,
        entry.resourceType,
        entry.resourceId ?? null,
        entry.details ? JSON.stringify(entry.details) : null,
        entry.ipAddress ?? null,
        entry.userAgent ?? null,
      ]
    );
  } catch (err) {
    // Never propagate — audit failures must not break the caller
    auditLogger.error({ err, entry }, 'Failed to write audit log entry');
  }
}

/**
 * Extracts the standard audit context fields from an Express request.
 *
 * Call this at the beginning of a route handler and pass the result to
 * `createAuditLog` alongside the domain-specific fields.
 *
 * @example
 * ```ts
 * const ctx = getAuditContext(req);
 * await createAuditLog({ ...ctx, action: 'export', resourceType: 'patient', resourceId: id });
 * ```
 */
export function getAuditContext(req: Request): {
  userId: number;
  companyId: number;
  ipAddress: string;
  userAgent: string;
} {
  const user = (req as any).user as Record<string, any> | undefined;

  return {
    userId: user?.id as number,
    companyId: user?.companyId as number,
    // Prefer the X-Forwarded-For header when behind a reverse proxy
    ipAddress:
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.ip ||
      '',
    userAgent: req.headers['user-agent'] || '',
  };
}
