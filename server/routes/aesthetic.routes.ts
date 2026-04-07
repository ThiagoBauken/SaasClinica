/**
 * Aesthetic Features Routes
 * Before/After Photos + Aesthetic Packages API
 */

import { Router } from 'express';
import { db } from '../db';
import { authCheck, tenantAwareAuth, asyncHandler } from '../middleware/auth';
import { logger } from '../logger';
import { beforeAfterPhotos, aestheticPackages } from '../../shared/schema';
import { eq, and, desc, isNull, sql } from 'drizzle-orm';

const router = Router();

// ============================================
// BEFORE/AFTER PHOTOS
// ============================================

/**
 * GET /api/v1/aesthetic/patients/:patientId/photos
 * List before/after photos for a patient
 */
router.get(
  '/patients/:patientId/photos',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;
    const patientId = parseInt(req.params.patientId);

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const photos = await db
      .select()
      .from(beforeAfterPhotos)
      .where(
        and(
          eq(beforeAfterPhotos.companyId, companyId),
          eq(beforeAfterPhotos.patientId, patientId),
          isNull(beforeAfterPhotos.deletedAt)
        )
      )
      .orderBy(desc(beforeAfterPhotos.createdAt));

    res.json(photos);
  })
);

/**
 * POST /api/v1/aesthetic/patients/:patientId/photos
 * Create a before/after photo record
 */
router.post(
  '/patients/:patientId/photos',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;
    const patientId = parseInt(req.params.patientId);

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const {
      procedureType,
      title,
      description,
      beforePhotoUrl,
      afterPhotoUrl,
      beforeDate,
      afterDate,
      toothNumbers,
      notes,
      isPublic,
      patientConsent,
      treatmentPlanId,
    } = req.body;

    if (!procedureType || !title || !beforePhotoUrl || !beforeDate) {
      return res.status(400).json({ error: 'procedureType, title, beforePhotoUrl and beforeDate are required' });
    }

    const [photo] = await db
      .insert(beforeAfterPhotos)
      .values({
        companyId,
        patientId,
        treatmentPlanId: treatmentPlanId || null,
        procedureType,
        title,
        description: description || null,
        beforePhotoUrl,
        afterPhotoUrl: afterPhotoUrl || null,
        beforeDate: new Date(beforeDate),
        afterDate: afterDate ? new Date(afterDate) : null,
        toothNumbers: toothNumbers || null,
        notes: notes || null,
        isPublic: isPublic || false,
        patientConsent: patientConsent || false,
        createdBy: user.id,
      })
      .returning();

    logger.info({ photoId: photo.id, patientId, procedureType }, 'Before/after photo created');
    res.status(201).json(photo);
  })
);

/**
 * PATCH /api/v1/aesthetic/photos/:id
 * Update a before/after photo (e.g., add the "after" photo)
 */
router.patch(
  '/photos/:id',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;
    const photoId = parseInt(req.params.id);

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { afterPhotoUrl, afterDate, notes, isPublic, patientConsent, title, description } = req.body;

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (afterPhotoUrl !== undefined) updateData.afterPhotoUrl = afterPhotoUrl;
    if (afterDate !== undefined) updateData.afterDate = new Date(afterDate);
    if (notes !== undefined) updateData.notes = notes;
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    if (patientConsent !== undefined) updateData.patientConsent = patientConsent;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;

    const [updated] = await db
      .update(beforeAfterPhotos)
      .set(updateData)
      .where(
        and(
          eq(beforeAfterPhotos.id, photoId),
          eq(beforeAfterPhotos.companyId, companyId),
          isNull(beforeAfterPhotos.deletedAt)
        )
      )
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Photo record not found' });
    }

    res.json(updated);
  })
);

/**
 * DELETE /api/v1/aesthetic/photos/:id
 * Soft-delete a before/after photo
 */
router.delete(
  '/photos/:id',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;
    const photoId = parseInt(req.params.id);

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const [deleted] = await db
      .update(beforeAfterPhotos)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(beforeAfterPhotos.id, photoId),
          eq(beforeAfterPhotos.companyId, companyId),
          isNull(beforeAfterPhotos.deletedAt)
        )
      )
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: 'Photo record not found' });
    }

    res.json({ success: true });
  })
);

// ============================================
// AESTHETIC PACKAGES
// ============================================

/**
 * GET /api/v1/aesthetic/packages
 * List aesthetic packages for the company
 */
router.get(
  '/packages',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const category = req.query.category as string | undefined;

    let query = db
      .select()
      .from(aestheticPackages)
      .where(
        and(
          eq(aestheticPackages.companyId, companyId),
          isNull(aestheticPackages.deletedAt),
          ...(category ? [eq(aestheticPackages.category, category)] : [])
        )
      )
      .orderBy(desc(aestheticPackages.createdAt));

    const packages = await query;
    res.json(packages);
  })
);

/**
 * POST /api/v1/aesthetic/packages
 * Create an aesthetic package
 */
router.post(
  '/packages',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const {
      name,
      description,
      category,
      procedures,
      totalPrice,
      discountPercent,
      estimatedSessions,
      estimatedDurationDays,
      includedItems,
    } = req.body;

    if (!name || !category || !procedures || !totalPrice) {
      return res.status(400).json({ error: 'name, category, procedures and totalPrice are required' });
    }

    const [pkg] = await db
      .insert(aestheticPackages)
      .values({
        companyId,
        name,
        description: description || null,
        category,
        procedures,
        totalPrice: String(totalPrice),
        discountPercent: discountPercent ? String(discountPercent) : "0",
        estimatedSessions: estimatedSessions || null,
        estimatedDurationDays: estimatedDurationDays || null,
        includedItems: includedItems || null,
      })
      .returning();

    logger.info({ packageId: pkg.id, name, category }, 'Aesthetic package created');
    res.status(201).json(pkg);
  })
);

/**
 * PATCH /api/v1/aesthetic/packages/:id
 * Update an aesthetic package
 */
router.patch(
  '/packages/:id',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;
    const packageId = parseInt(req.params.id);

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };
    const fields = ['name', 'description', 'category', 'procedures', 'totalPrice', 'discountPercent', 'estimatedSessions', 'estimatedDurationDays', 'includedItems', 'active'];
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        if (field === 'totalPrice' || field === 'discountPercent') {
          updateData[field] = String(req.body[field]);
        } else {
          updateData[field] = req.body[field];
        }
      }
    }

    const [updated] = await db
      .update(aestheticPackages)
      .set(updateData)
      .where(
        and(
          eq(aestheticPackages.id, packageId),
          eq(aestheticPackages.companyId, companyId),
          isNull(aestheticPackages.deletedAt)
        )
      )
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Package not found' });
    }

    res.json(updated);
  })
);

/**
 * DELETE /api/v1/aesthetic/packages/:id
 * Soft-delete an aesthetic package
 */
router.delete(
  '/packages/:id',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;
    const packageId = parseInt(req.params.id);

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const [deleted] = await db
      .update(aestheticPackages)
      .set({ deletedAt: new Date(), active: false })
      .where(
        and(
          eq(aestheticPackages.id, packageId),
          eq(aestheticPackages.companyId, companyId),
          isNull(aestheticPackages.deletedAt)
        )
      )
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: 'Package not found' });
    }

    res.json({ success: true });
  })
);

export default router;
