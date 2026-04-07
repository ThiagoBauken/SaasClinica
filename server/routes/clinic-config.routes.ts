/**
 * Clinic Configuration Routes — /api/clinic/settings, /api/clinic-settings,
 * /api/fiscal-settings, /api/admin/users, /api/permissions, /api/users/*
 *
 * Covers clinic-level settings (clinic & fiscal), role-based admin user
 * management within a tenant, and permission management.
 */
import { Router } from 'express';
import { db } from '../db';
import {
  clinicSettings,
  fiscalSettings,
  permissions,
  userPermissions,
  commissionSettings,
  procedureCommissions,
  machineTaxes,
} from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';
import { authCheck, asyncHandler } from '../middleware/auth';
import { tenantIsolationMiddleware } from '../tenantMiddleware';
import { invalidateClusterCache } from '../clusterCache';
import { getUserModulePermissions, grantModulePermission } from '../permissions';
import * as clinicHandlers from '../clinic-apis';

const router = Router();

// =====================================================
// CLINIC SETTINGS (legacy /api/clinic-settings path)
// =====================================================

/**
 * GET /api/clinic-settings
 * Returns the clinic-level settings record.
 */
router.get(
  '/clinic-settings',
  authCheck,
  asyncHandler(async (req, res) => {
    const settings = await db.query.clinicSettings.findFirst();
    res.json(settings || {});
  })
);

/**
 * POST /api/clinic-settings
 * Creates or updates the clinic settings record (upsert).
 */
router.post(
  '/clinic-settings',
  authCheck,
  asyncHandler(async (req, res) => {
    const existingSettings = await db.query.clinicSettings.findFirst();

    if (existingSettings) {
      const [updated] = await db
        .update(clinicSettings)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(clinicSettings.id, existingSettings.id))
        .returning();

      invalidateClusterCache('api:/api/clinic-settings');
      return res.json(updated);
    }

    const [newSettings] = await db
      .insert(clinicSettings)
      .values({ ...req.body, updatedAt: new Date() })
      .returning();

    invalidateClusterCache('api:/api/clinic-settings');
    res.status(201).json(newSettings);
  })
);

// =====================================================
// CLINIC API (handlers from clinic-apis module)
// =====================================================

/**
 * GET /api/clinic/settings
 * Returns clinic settings via the clinic-apis handler.
 */
router.get('/clinic/settings', authCheck, clinicHandlers.getClinicSettings);

/**
 * PATCH /api/clinic/settings
 * Updates clinic settings via the clinic-apis handler.
 */
router.patch('/clinic/settings', authCheck, clinicHandlers.updateClinicSettings);

// =====================================================
// FISCAL SETTINGS
// =====================================================

/**
 * GET /api/fiscal-settings
 * Returns fiscal configuration.
 */
router.get(
  '/fiscal-settings',
  authCheck,
  asyncHandler(async (req, res) => {
    const settings = await db.query.fiscalSettings.findFirst();
    res.json(settings || {});
  })
);

/**
 * POST /api/fiscal-settings
 * Creates or updates fiscal settings (upsert).
 */
router.post(
  '/fiscal-settings',
  authCheck,
  asyncHandler(async (req, res) => {
    const existingSettings = await db.query.fiscalSettings.findFirst();

    if (existingSettings) {
      const [updated] = await db
        .update(fiscalSettings)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(fiscalSettings.id, existingSettings.id))
        .returning();

      invalidateClusterCache('api:/api/fiscal-settings');
      return res.json(updated);
    }

    const [newSettings] = await db
      .insert(fiscalSettings)
      .values({ ...req.body, updatedAt: new Date() })
      .returning();

    invalidateClusterCache('api:/api/fiscal-settings');
    res.status(201).json(newSettings);
  })
);

// =====================================================
// ADMIN USER MANAGEMENT (within a tenant)
// =====================================================

/**
 * GET /api/admin/users
 * Lists all users belonging to the current tenant (admin only).
 */
router.get(
  '/admin/users',
  authCheck,
  tenantIsolationMiddleware,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const result = await db.$client.query(
      `SELECT id, username, full_name, email, phone, role, speciality, active, created_at
       FROM users
       WHERE company_id = $1 AND deleted_at IS NULL
       ORDER BY full_name`,
      [user.companyId]
    );

    res.json(result.rows);
  })
);

/**
 * GET /api/admin/users/:userId/permissions
 * Returns module permissions for a user within the current tenant.
 */
router.get(
  '/admin/users/:userId/permissions',
  authCheck,
  tenantIsolationMiddleware,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { userId } = req.params;
    const perms = await getUserModulePermissions(parseInt(userId), user.companyId);
    res.json(perms);
  })
);

/**
 * POST /api/admin/users/:userId/permissions
 * Grants module permissions to a user within the current tenant.
 */
router.post(
  '/admin/users/:userId/permissions',
  authCheck,
  tenantIsolationMiddleware,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { userId } = req.params;
    const { moduleName, permissions: modulePerms } = req.body;

    const success = await grantModulePermission(
      parseInt(userId),
      user.companyId,
      moduleName,
      modulePerms,
      user.id
    );

    if (success) {
      res.json({ message: 'Permissions updated successfully' });
    } else {
      res.status(500).json({ message: 'Failed to update permissions' });
    }
  })
);

// =====================================================
// PERMISSION MANAGEMENT
// =====================================================

/**
 * GET /api/permissions
 * Returns all available permissions.
 */
router.get(
  '/permissions',
  authCheck,
  asyncHandler(async (req, res) => {
    const allPermissions = await db.query.permissions.findMany();
    res.json(allPermissions);
  })
);

/**
 * GET /api/users/:id/permissions
 * Returns permissions for a specific user.
 */
router.get(
  '/users/:id/permissions',
  authCheck,
  asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.id);
    const userPerms = await db.query.userPermissions.findMany({
      where: eq(userPermissions.userId, userId),
    });

    type UserPermission = typeof userPermissions.$inferSelect;
    const permissionIds = userPerms.map((up: UserPermission) => up.permissionId);

    const permissionsDetails = await db.query.permissions.findMany({
      where: (perms: typeof permissions, { inArray: inArrayFn }: { inArray: typeof inArray }) =>
        inArrayFn(perms.id, permissionIds),
    });

    res.json(permissionsDetails);
  })
);

/**
 * POST /api/users/:id/permissions
 * Replaces all permissions for a specific user.
 */
router.post(
  '/users/:id/permissions',
  authCheck,
  asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.id);
    const { permissions: permissionIds } = req.body;

    await db.delete(userPermissions).where(eq(userPermissions.userId, userId));

    if (permissionIds && permissionIds.length > 0) {
      const newPermissions = permissionIds.map((permId: number) => ({
        userId,
        permissionId: permId,
        createdAt: new Date(),
      }));
      await db.insert(userPermissions).values(newPermissions);
    }

    const updatedUserPerms = await db.query.userPermissions.findMany({
      where: eq(userPermissions.userId, userId),
    });

    type UserPermission = typeof userPermissions.$inferSelect;
    const updatedPermissionIds = updatedUserPerms.map((up: UserPermission) => up.permissionId);

    const permissionsDetails = await db.query.permissions.findMany({
      where: (perms: typeof permissions, { inArray: inArrayFn }: { inArray: typeof inArray }) =>
        inArrayFn(perms.id, updatedPermissionIds),
    });

    invalidateClusterCache(`api:/api/users/${userId}/permissions`);
    res.json(permissionsDetails);
  })
);

// =====================================================
// USER MANAGEMENT (clinic-apis handlers)
// =====================================================

/**
 * GET /api/users
 * Lists users via the clinic-apis handler.
 */
router.get('/users', authCheck, clinicHandlers.getUsers);

/**
 * PATCH /api/users/:id
 * Updates a user via the clinic-apis handler.
 */
router.patch('/users/:id', authCheck, clinicHandlers.updateUser);

/**
 * DELETE /api/users/:id
 * Deletes a user via the clinic-apis handler.
 */
router.delete('/users/:id', authCheck, clinicHandlers.deleteUser);

// =====================================================
// MACHINE TAXES (Taxas de Maquininha)
// =====================================================

/**
 * GET /api/machine-taxes
 * Returns all payment machine tax records.
 */
router.get(
  '/machine-taxes',
  authCheck,
  asyncHandler(async (req, res) => {
    const taxes = await db.query.machineTaxes.findMany();
    res.json(taxes);
  })
);

/**
 * GET /api/machine-taxes/:id
 * Returns a single machine tax record.
 */
router.get(
  '/machine-taxes/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    const tax = await db.query.machineTaxes.findFirst({
      where: eq(machineTaxes.id, id),
    });

    if (!tax) {
      return res.status(404).json({ message: 'Taxa não encontrada' });
    }

    res.json(tax);
  })
);

/**
 * POST /api/machine-taxes
 * Creates a new machine tax record.
 */
router.post(
  '/machine-taxes',
  authCheck,
  asyncHandler(async (req, res) => {
    const [newTax] = await db
      .insert(machineTaxes)
      .values({ ...req.body, createdAt: new Date(), updatedAt: new Date() })
      .returning();

    invalidateClusterCache('api:/api/machine-taxes');
    res.status(201).json(newTax);
  })
);

/**
 * PATCH /api/machine-taxes/:id
 * Updates a machine tax record.
 */
router.patch(
  '/machine-taxes/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);

    const [updated] = await db
      .update(machineTaxes)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(machineTaxes.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ message: 'Taxa não encontrada' });
    }

    invalidateClusterCache(`api:/api/machine-taxes/${id}`);
    invalidateClusterCache('api:/api/machine-taxes');
    res.json(updated);
  })
);

/**
 * DELETE /api/machine-taxes/:id
 * Deletes a machine tax record.
 */
router.delete(
  '/machine-taxes/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);

    await db.delete(machineTaxes).where(eq(machineTaxes.id, id));

    invalidateClusterCache(`api:/api/machine-taxes/${id}`);
    invalidateClusterCache('api:/api/machine-taxes');
    res.status(204).end();
  })
);

// =====================================================
// COMMISSIONS
// =====================================================

/**
 * GET /api/commissions/settings
 * Returns all commission settings.
 */
router.get(
  '/commissions/settings',
  authCheck,
  asyncHandler(async (req, res) => {
    const settings = await db.query.commissionSettings.findMany();
    res.json(settings);
  })
);

/**
 * GET /api/commissions/settings/:userId
 * Returns commission settings for a specific user.
 */
router.get(
  '/commissions/settings/:userId',
  authCheck,
  asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.userId);
    const setting = await db.query.commissionSettings.findFirst({
      where: eq(commissionSettings.userId, userId),
    });
    res.json(setting || {});
  })
);

/**
 * POST /api/commissions/settings
 * Creates a new commission settings record.
 */
router.post(
  '/commissions/settings',
  authCheck,
  asyncHandler(async (req, res) => {
    const [newSetting] = await db
      .insert(commissionSettings)
      .values({ ...req.body, createdAt: new Date(), updatedAt: new Date() })
      .returning();

    invalidateClusterCache('api:/api/commissions/settings');
    res.status(201).json(newSetting);
  })
);

/**
 * POST /api/commissions/settings/:userId
 * Upserts commission settings for a specific user.
 */
router.post(
  '/commissions/settings/:userId',
  authCheck,
  asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.userId);
    const existingSetting = await db.query.commissionSettings.findFirst({
      where: eq(commissionSettings.userId, userId),
    });

    if (existingSetting) {
      const [updated] = await db
        .update(commissionSettings)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(commissionSettings.id, existingSetting.id))
        .returning();

      invalidateClusterCache(`api:/api/commissions/settings/${userId}`);
      invalidateClusterCache('api:/api/commissions/settings');
      return res.json(updated);
    }

    const [newSetting] = await db
      .insert(commissionSettings)
      .values({ ...req.body, userId, createdAt: new Date(), updatedAt: new Date() })
      .returning();

    invalidateClusterCache(`api:/api/commissions/settings/${userId}`);
    invalidateClusterCache('api:/api/commissions/settings');
    res.status(201).json(newSetting);
  })
);

/**
 * GET /api/commissions/procedures/:userId
 * Returns procedure-level commissions for a user.
 */
router.get(
  '/commissions/procedures/:userId',
  authCheck,
  asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.userId);
    const commissions = await db.query.procedureCommissions.findMany({
      where: eq(procedureCommissions.userId, userId),
    });
    res.json(commissions);
  })
);

/**
 * POST /api/commissions/procedures/:userId/:procedureId
 * Upserts a procedure commission for a specific user and procedure.
 */
router.post(
  '/commissions/procedures/:userId/:procedureId',
  authCheck,
  asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.userId);
    const procedureId = parseInt(req.params.procedureId);

    const existingCommission = await db.query.procedureCommissions.findFirst({
      where: (comms: typeof procedureCommissions, { and: andFn, eq: eqFn }: any) =>
        andFn(eqFn(comms.userId, userId), eqFn(comms.procedureId, procedureId)),
    });

    if (existingCommission) {
      const [updated] = await db
        .update(procedureCommissions)
        .set({ ...req.body })
        .where(eq(procedureCommissions.id, existingCommission.id))
        .returning();

      invalidateClusterCache(`api:/api/commissions/procedures/${userId}`);
      return res.json(updated);
    }

    const [newCommission] = await db
      .insert(procedureCommissions)
      .values({ ...req.body, userId, procedureId, createdAt: new Date() })
      .returning();

    invalidateClusterCache(`api:/api/commissions/procedures/${userId}`);
    res.status(201).json(newCommission);
  })
);

export default router;
