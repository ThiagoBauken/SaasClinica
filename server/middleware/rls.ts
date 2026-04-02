import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../logger";

const rlsLogger = logger.child({ module: "rls" });

/**
 * Express middleware that sets the PostgreSQL session variable
 * `app.current_company_id` for Row-Level Security (RLS) enforcement at the
 * database level.
 *
 * Uses `set_config(..., true)` which is equivalent to `SET LOCAL` — the
 * variable is scoped to the current transaction and is automatically cleared
 * when the transaction ends, preventing cross-request leakage on pooled
 * connections.
 *
 * Placement requirement: must be registered AFTER `setupAuth` (Passport
 * session middleware) so that `req.user` is already populated, and BEFORE
 * any route handlers that execute database queries.
 *
 * RLS policies on tables reference this value via:
 *   `current_setting('app.current_company_id', true)::integer`
 *
 * @param req  - Express request object. `req.user.companyId` is read from the
 *               deserialized Passport session.
 * @param _res - Express response object (unused).
 * @param next - Express next function.
 */
export function rlsMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const user = req.user as { companyId?: number | null } | undefined;

  if (!user?.companyId) {
    // No authenticated user or companyId is absent (public / unauthenticated
    // routes). Skip RLS setup — app-level tenant filtering remains in effect
    // via tenantIsolationMiddleware on protected routes.
    return next();
  }

  const companyIdStr = String(user.companyId);

  // set_config(setting_name, new_value, is_local)
  //   is_local = true  →  equivalent to SET LOCAL (transaction-scoped)
  //   is_local = false →  equivalent to SET (session-scoped, leaks across
  //                        requests on the same pooled connection)
  //
  // Using `true` here is the safe default. If a route uses an explicit
  // BEGIN/COMMIT transaction the variable will be reset at COMMIT, which is
  // the desired behaviour — each statement bundle gets its own company scope.
  db.execute(
    sql`SELECT set_config('app.current_company_id', ${companyIdStr}, true)`,
  )
    .then(() => next())
    .catch((err: unknown) => {
      // Log but do not block the request. The app-level companyId checks in
      // route handlers and tenantIsolationMiddleware provide a secondary
      // safety net, so a transient RLS setup failure should not take down the
      // request entirely.
      rlsLogger.error(
        { err, companyId: user.companyId },
        "Failed to set app.current_company_id session variable",
      );
      next();
    });
}
