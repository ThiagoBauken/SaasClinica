/**
 * User Module & Clinic Module Routes — /api/user/* and /api/clinic/modules/*
 *
 * Handles per-user module permission queries and per-clinic module
 * registry introspection and lifecycle (activate/deactivate).
 */
import { Router } from 'express';
import { db } from '../db';
import { companies } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { authCheck, asyncHandler } from '../middleware/auth';
import { tenantIsolationMiddleware } from '../tenantMiddleware';
import { requireModulePermission } from '../permissions';
import { moduleRegistry } from '../../modules/index';

const router = Router();

// =====================================================
// USER MODULE ENDPOINTS
// =====================================================

/**
 * GET /api/user/modules
 * Returns the list of modules enabled for the current user's company.
 */
router.get(
  '/user/modules',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const companyId = user.companyId;
    const activeModules = await db.$client.query(
      `SELECT
         m.id, m.name, m.display_name, m.description,
         CASE WHEN cm.is_enabled = true THEN '["admin"]'::jsonb ELSE '[]'::jsonb END as permissions
       FROM modules m
       LEFT JOIN company_modules cm ON m.id = cm.module_id AND cm.company_id = $1
       WHERE cm.is_enabled = true
       ORDER BY m.display_name`,
      [companyId]
    );
    res.json(activeModules.rows);
  })
);

/**
 * GET /api/user/company
 * Returns the company record for the currently authenticated user.
 */
router.get(
  '/user/company',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.companyId) {
      return res.status(404).json({ message: 'User not associated with company' });
    }

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, user.companyId));

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    res.json(company);
  })
);

/**
 * GET /api/user/me
 * Returns the current authenticated user's profile.
 */
router.get(
  '/user/me',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    res.json({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      active: user.active,
    });
  })
);

// =====================================================
// CLINIC MODULE REGISTRY ENDPOINTS
// =====================================================

/**
 * GET /api/clinic/modules
 * Returns all registered modules in the module registry, grouped by category.
 */
router.get(
  '/clinic/modules',
  asyncHandler(async (req, res) => {
    const modules = moduleRegistry.getAllModules();
    const modulesByCategory = moduleRegistry.getModulesByCategory();
    res.json({
      all: modules,
      byCategory: modulesByCategory,
      loaded: modules.length,
    });
  })
);

/**
 * GET /api/clinic/modules/:moduleId
 * Returns a single module's registry entry.
 */
router.get(
  '/clinic/modules/:moduleId',
  authCheck,
  tenantIsolationMiddleware,
  asyncHandler(async (req, res) => {
    const { moduleId } = req.params;
    const module = moduleRegistry.getModule(moduleId);

    if (!module) {
      return res.status(404).json({ message: 'Módulo não encontrado' });
    }

    res.json(module);
  })
);

/**
 * POST /api/clinic/modules/:moduleId/activate
 * Activates a module in the registry.
 */
router.post(
  '/clinic/modules/:moduleId/activate',
  authCheck,
  tenantIsolationMiddleware,
  requireModulePermission('clinica', 'admin'),
  asyncHandler(async (req, res) => {
    const { moduleId } = req.params;
    const success = moduleRegistry.activate(moduleId);

    if (success) {
      res.json({ message: `Módulo ${moduleId} ativado com sucesso` });
    } else {
      res.status(404).json({ message: 'Módulo não encontrado' });
    }
  })
);

/**
 * POST /api/clinic/modules/:moduleId/deactivate
 * Deactivates a module in the registry.
 */
router.post(
  '/clinic/modules/:moduleId/deactivate',
  authCheck,
  tenantIsolationMiddleware,
  requireModulePermission('clinica', 'admin'),
  asyncHandler(async (req, res) => {
    const { moduleId } = req.params;
    const success = moduleRegistry.deactivate(moduleId);

    if (success) {
      res.json({ message: `Módulo ${moduleId} desativado com sucesso` });
    } else {
      res.status(404).json({ message: 'Módulo não encontrado' });
    }
  })
);

export default router;
