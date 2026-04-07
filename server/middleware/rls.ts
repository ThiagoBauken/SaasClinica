import { Request, Response, NextFunction } from "express";
import { db, pool } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../logger";

const rlsLogger = logger.child({ module: "rls" });

/**
 * Express middleware that sets the PostgreSQL session variable
 * `app.current_company_id` for Row-Level Security (RLS) enforcement at the
 * database level.
 *
 * IMPORTANT: Uses `set_config(..., false)` which is `SET` (session-scoped).
 * `SET LOCAL` (is_local=true) only persists within an explicit transaction
 * and gets lost immediately for standalone queries (which is how Drizzle
 * works by default). Session-scoped is correct here because:
 *   1. We clear the variable at the END of the request via res.on('finish')
 *   2. This ensures pooled connections don't leak tenant context
 *   3. All queries within the request see the correct company_id
 *
 * Placement requirement: must be registered AFTER `setupAuth` (Passport
 * session middleware) so that `req.user` is already populated, and BEFORE
 * any route handlers that execute database queries.
 *
 * RLS policies on tables reference this value via:
 *   `current_setting('app.current_company_id', true)::integer`
 */
export function rlsMiddleware(
  req: Request,
  res: Response,
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
  //   is_local = false →  SET (session-scoped, persists for all queries in this request)
  //   is_local = true  →  SET LOCAL (transaction-scoped only — useless without BEGIN/COMMIT)
  //
  // We use `false` so standalone (auto-commit) queries also see the variable.
  // The cleanup handler below resets it when the response finishes, preventing
  // cross-request leakage on the same pooled connection.
  db.execute(
    sql`SELECT set_config('app.current_company_id', ${companyIdStr}, false)`,
  )
    .then(() => {
      // Register cleanup handler to clear the session variable when the
      // response finishes, BEFORE the connection returns to the pool.
      res.on("finish", () => {
        db.execute(
          sql`SELECT set_config('app.current_company_id', '', false)`,
        ).catch((cleanupErr: unknown) => {
          rlsLogger.warn(
            { err: cleanupErr, companyId: user.companyId },
            "Failed to clear app.current_company_id on response finish",
          );
        });
      });
      next();
    })
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
