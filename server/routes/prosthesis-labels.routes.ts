/**
 * Prosthesis Labels Routes — /api/prosthesis-labels/*
 *
 * Manages colour-coded labels that can be applied to prosthesis records
 * to facilitate visual status tracking in the kanban board.
 */
import { Router } from 'express';
import { storage } from '../storage';
import { authCheck, asyncHandler } from '../middleware/auth';
import { tenantIsolationMiddleware } from '../tenantMiddleware';
import { logger } from '../logger';

const router = Router();

/**
 * GET /api/prosthesis-labels
 * Returns all prosthesis labels for the current tenant.
 */
router.get(
  '/',
  authCheck,
  tenantIsolationMiddleware,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const labels = await storage.getProsthesisLabels(user.companyId);
    res.json(labels);
  })
);

/**
 * POST /api/prosthesis-labels
 * Creates a new prosthesis label. Requires `name` and `color`.
 */
router.post(
  '/',
  authCheck,
  tenantIsolationMiddleware,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { name, color } = req.body;

    if (!name || !color) {
      return res.status(400).json({ error: 'Nome e cor são obrigatórios' });
    }

    const newLabel = await storage.createProsthesisLabel({
      companyId: user.companyId,
      name,
      color,
      active: true,
    });

    res.status(201).json(newLabel);
  })
);

/**
 * PATCH /api/prosthesis-labels/:id
 * Updates a prosthesis label.
 */
router.patch(
  '/:id',
  authCheck,
  tenantIsolationMiddleware,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const labelId = parseInt(req.params.id);

    if (!labelId || isNaN(labelId)) {
      return res.status(400).json({ error: 'ID da etiqueta inválido' });
    }

    const updatedLabel = await storage.updateProsthesisLabel(labelId, user.companyId, req.body);

    if (!updatedLabel) {
      return res.status(404).json({ error: 'Etiqueta não encontrada' });
    }

    res.json(updatedLabel);
  })
);

/**
 * DELETE /api/prosthesis-labels/:id
 * Removes a prosthesis label.
 */
router.delete(
  '/:id',
  authCheck,
  tenantIsolationMiddleware,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const labelId = parseInt(req.params.id);

    if (!labelId || isNaN(labelId)) {
      return res.status(400).json({ error: 'ID da etiqueta inválido' });
    }

    const deleted = await storage.deleteProsthesisLabel(labelId, user.companyId);

    if (!deleted) {
      return res.status(404).json({ error: 'Etiqueta não encontrada' });
    }

    res.status(204).send();
  })
);

export default router;
