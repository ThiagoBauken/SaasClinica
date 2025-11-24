import { Router } from 'express';
import { storage } from '../storage';
import { authCheck, asyncHandler } from '../middleware/auth';
import { validate, idParamSchema } from '../middleware/validation';
import { createProcedureSchema, updateProcedureSchema, searchProceduresSchema } from '../schemas/procedures.schema';
import { cacheMiddleware } from '../simpleCache';

const router = Router();

/**
 * GET /api/v1/procedures
 * Lista todos os procedimentos da empresa (apenas ativos por padrão)
 */
router.get(
  '/',
  authCheck,
  validate({ query: searchProceduresSchema }),
  cacheMiddleware(60),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const procedures = await storage.getProcedures(companyId);

    // Se houver filtro de busca, aplicar
    const { search } = req.query as any;
    let filteredProcedures = procedures;

    if (search) {
      filteredProcedures = procedures.filter((procedure: any) =>
        procedure.name.toLowerCase().includes(search.toLowerCase()) ||
        procedure.description?.toLowerCase().includes(search.toLowerCase())
      );
    }

    res.json(filteredProcedures);
  })
);

/**
 * GET /api/v1/procedures/:id
 * Busca um procedimento específico da empresa
 */
router.get(
  '/:id',
  authCheck,
  validate({ params: idParamSchema }),
  cacheMiddleware(60),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;
    const procedure = await storage.getProcedure(parseInt(id), companyId);

    if (!procedure) {
      return res.status(404).json({ error: 'Procedure not found' });
    }

    res.json(procedure);
  })
);

/**
 * POST /api/v1/procedures
 * Cria um novo procedimento para a empresa
 */
router.post(
  '/',
  authCheck,
  validate({ body: createProcedureSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const procedure = await storage.createProcedure(req.body, companyId);
    res.status(201).json(procedure);
  })
);

/**
 * PATCH /api/v1/procedures/:id
 * Atualiza um procedimento da empresa
 */
router.patch(
  '/:id',
  authCheck,
  validate({
    params: idParamSchema,
    body: updateProcedureSchema
  }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;

    try {
      const updatedProcedure = await storage.updateProcedure(parseInt(id), req.body, companyId);
      res.json(updatedProcedure);
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({ error: 'Procedure not found' });
      }
      throw error;
    }
  })
);

/**
 * DELETE /api/v1/procedures/:id
 * Remove (soft delete) um procedimento da empresa
 */
router.delete(
  '/:id',
  authCheck,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;
    const deleted = await storage.deleteProcedure(parseInt(id), companyId);

    if (!deleted) {
      return res.status(404).json({ error: 'Procedure not found' });
    }

    res.status(204).send();
  })
);

export default router;
