/**
 * Application Route Registration
 *
 * This file is the top-level entry point for Express route setup.
 * All application logic has been migrated to the modular route files
 * under server/routes/. This file now only:
 *
 *  1. Initialises the database storage layer.
 *  2. Sets up Passport authentication (local + Google OAuth).
 *  3. Applies cross-cutting middleware (RLS, audit log).
 *  4. Delegates to registerModularRoutes() which owns all /api/* paths.
 *  5. Initialises the WebSocket notification service.
 *
 * Do not add new route handlers here — add them to an appropriate file
 * inside server/routes/ and register it in server/routes/index.ts.
 */
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, DatabaseStorage } from "./storage";
import { setupAuth } from "./auth";
import { rlsMiddleware } from "./middleware/rls";
import { auditLogMiddleware } from "./middleware/auditLog";
import { registerModularRoutes } from "./routes/index";
import { createDefaultCompany, migrateUsersToDefaultCompany } from "./seedCompany";
import { registerProtesesRoutes } from "./modules/clinica/proteses";
import { notificationService } from "./services/notificationService";
import { logger } from "./logger";

export async function registerRoutes(app: Express): Promise<Server> {
  // ── 1. Database initialisation ──────────────────────────────────────────
  if (storage instanceof DatabaseStorage) {
    await storage.seedInitialData();
    // Ensure a default company exists and all users are assigned to it.
    await migrateUsersToDefaultCompany();
  }

  // ── 2. Authentication (Passport.js — local + Google OAuth) ──────────────
  setupAuth(app);

  // ── 3. Cross-cutting middleware ──────────────────────────────────────────
  // RLS: sets app.current_company_id so PostgreSQL Row-Level Security
  // policies can enforce tenant isolation at the DB level.
  // Must come AFTER setupAuth so req.user is populated by Passport.
  app.use(rlsMiddleware);

  // LGPD Art. 37: Audit trail for ALL routes (legacy + modular).
  // Applied before route registration so every endpoint is covered.
  app.use('/api', auditLogMiddleware);

  // ── 4. Modular routes ────────────────────────────────────────────────────
  // All API route handlers live in server/routes/*.routes.ts and are
  // registered here via the central index.
  registerModularRoutes(app);

  // Legacy module registrations that still use the app.* callback style.
  // These will be converted to Router-based files in a future iteration.
  registerProtesesRoutes(app);

  const { registerLaboratoryRoutes } = await import('./routes/laboratories');
  registerLaboratoryRoutes(app);

  // ── 5. WebSocket notifications ───────────────────────────────────────────
  const httpServer = createServer(app);
  notificationService.initialize(httpServer);

  logger.info('Routes registered successfully');

  return httpServer;
}
