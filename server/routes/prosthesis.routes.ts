import { Router } from 'express';
import { storage } from '../storage';
import { authCheck, asyncHandler } from '../middleware/auth';
import { validate, paginationSchema, idParamSchema, createPaginatedResponse, getOffset } from '../middleware/validation';
import { z } from 'zod';

const router = Router();

// Schema para criar prótese
const createProsthesisSchema = z.object({
  patientId: z.number().int().positive(),
  professionalId: z.number().int().positive(),
  type: z.string().min(1),
  description: z.string().min(1),
  laboratory: z.string().optional().or(z.literal("")),
  sentDate: z.string().optional(),
  expectedReturnDate: z.string().optional(),
  returnDate: z.string().optional(),
  cost: z.number().optional(),
  price: z.number().optional(),
  observations: z.string().optional(),
  labels: z.array(z.string()).optional().default([]),
});

// Schema para atualizar prótese
const updateProsthesisSchema = z.object({
  patientId: z.number().int().positive().optional(),
  professionalId: z.number().int().positive().optional(),
  type: z.string().min(1).optional(),
  description: z.string().optional(),
  laboratory: z.string().optional(),
  status: z.enum(['pending', 'sent', 'returned', 'completed', 'canceled', 'archived']).optional(),
  sentDate: z.string().optional(),
  expectedReturnDate: z.string().optional(),
  returnDate: z.string().optional(),
  cost: z.number().optional(),
  price: z.number().optional(),
  observations: z.string().optional(),
  labels: z.array(z.string()).optional(),
  sortOrder: z.number().optional(),
});

// Schema para query params de listagem
const listProsthesisQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  status: z.enum(['pending', 'sent', 'returned', 'completed', 'canceled', 'archived', 'all']).optional().default('all'),
  patientId: z.coerce.number().int().positive().optional(),
  professionalId: z.coerce.number().int().positive().optional(),
  laboratory: z.string().optional(),
});

/**
 * GET /api/v1/prosthesis
 * Lista próteses com filtros (paginado)
 */
router.get(
  '/',
  authCheck,
  validate({ query: listProsthesisQuerySchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { page, limit, status, patientId, professionalId, laboratory } = req.query as any;

    // Buscar todas as próteses da company
    const allProsthesis = await storage.getProsthesis(companyId);

    // Aplicar filtros
    let filtered = allProsthesis;

    if (status && status !== 'all') {
      filtered = filtered.filter((p: any) => p.status === status);
    }

    if (patientId) {
      filtered = filtered.filter((p: any) => p.patientId === patientId);
    }

    if (professionalId) {
      filtered = filtered.filter((p: any) => p.professionalId === professionalId);
    }

    if (laboratory) {
      filtered = filtered.filter((p: any) =>
        p.laboratory.toLowerCase().includes(laboratory.toLowerCase())
      );
    }

    // Aplicar paginação
    const total = filtered.length;
    const offset = getOffset(page, limit);
    const paginatedData = filtered.slice(offset, offset + limit);

    res.json(createPaginatedResponse(paginatedData, total, page, limit));
  })
);

/**
 * GET /api/v1/prosthesis/:id
 * Busca uma prótese específica
 */
router.get(
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

    const prosthesisItem = await storage.getProsthesisById(parseInt(id), companyId);

    if (!prosthesisItem) {
      return res.status(404).json({ error: 'Prosthesis not found' });
    }

    res.json(prosthesisItem);
  })
);

/**
 * POST /api/v1/prosthesis
 * Cria nova prótese
 */
router.post(
  '/',
  authCheck,
  validate({ body: createProsthesisSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const prosthesisData = {
      ...req.body,
      companyId,
      status: 'pending', // Nova prótese sempre começa como pending
    };

    const newProsthesis = await storage.createProsthesis(prosthesisData);

    res.status(201).json(newProsthesis);
  })
);

/**
 * PATCH /api/v1/prosthesis/:id
 * Atualiza uma prótese
 */
router.patch(
  '/:id',
  authCheck,
  validate({
    params: idParamSchema,
    body: updateProsthesisSchema
  }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;

    // Verificar se a prótese pertence à company
    const existingProsthesis = await storage.getProsthesisById(parseInt(id), companyId);

    if (!existingProsthesis) {
      return res.status(404).json({ error: 'Prosthesis not found' });
    }

    const updatedProsthesis = await storage.updateProsthesis(parseInt(id), req.body, companyId);

    res.json(updatedProsthesis);
  })
);

/**
 * DELETE /api/v1/prosthesis/:id
 * Remove uma prótese (soft delete - marca como archived)
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

    // Buscar prótese antes de deletar
    const prosthesisItem = await storage.getProsthesisById(parseInt(id), companyId);

    if (!prosthesisItem) {
      return res.status(404).json({ error: 'Prosthesis not found' });
    }

    // Soft delete - marcar como archived ao invés de deletar
    await storage.updateProsthesis(parseInt(id), { status: 'archived' }, companyId);

    res.status(204).send();
  })
);

/**
 * GET /api/v1/prosthesis/stats/overview
 * Retorna estatísticas gerais de próteses
 */
router.get(
  '/stats/overview',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const allProsthesis = await storage.getProsthesis(companyId);

    const stats = {
      total: allProsthesis.length,
      pending: allProsthesis.filter((p: any) => p.status === 'pending').length,
      sent: allProsthesis.filter((p: any) => p.status === 'sent').length,
      returned: allProsthesis.filter((p: any) => p.status === 'returned').length,
      completed: allProsthesis.filter((p: any) => p.status === 'completed').length,
      canceled: allProsthesis.filter((p: any) => p.status === 'canceled').length,

      // Estatísticas de custo
      totalCost: allProsthesis.reduce((sum: number, p: any) => sum + (p.cost || 0), 0),
      totalRevenue: allProsthesis.reduce((sum: number, p: any) => sum + (p.price || 0), 0),

      // Laboratórios mais utilizados
      topLaboratories: Object.entries(
        allProsthesis.reduce((acc: any, p: any) => {
          acc[p.laboratory] = (acc[p.laboratory] || 0) + 1;
          return acc;
        }, {})
      )
        .sort((a: any, b: any) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count })),

      // Tipos mais comuns
      topTypes: Object.entries(
        allProsthesis.reduce((acc: any, p: any) => {
          acc[p.type] = (acc[p.type] || 0) + 1;
          return acc;
        }, {})
      )
        .sort((a: any, b: any) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count })),
    };

    res.json(stats);
  })
);

/**
 * POST /api/v1/prosthesis/:id/mark-sent
 * Marca prótese como enviada ao laboratório
 */
router.post(
  '/:id/mark-sent',
  authCheck,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;
    const { sentDate, expectedReturnDate } = req.body;

    const prosthesisItem = await storage.getProsthesisById(parseInt(id), companyId);

    if (!prosthesisItem) {
      return res.status(404).json({ error: 'Prosthesis not found' });
    }

    const updated = await storage.updateProsthesis(
      parseInt(id),
      {
        status: 'sent',
        sentDate: sentDate || new Date().toISOString(),
        expectedReturnDate,
      },
      companyId
    );

    res.json(updated);
  })
);

/**
 * POST /api/v1/prosthesis/:id/mark-returned
 * Marca prótese como retornada do laboratório
 */
router.post(
  '/:id/mark-returned',
  authCheck,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;
    const { returnDate } = req.body;

    const prosthesisItem = await storage.getProsthesisById(parseInt(id), companyId);

    if (!prosthesisItem) {
      return res.status(404).json({ error: 'Prosthesis not found' });
    }

    const updated = await storage.updateProsthesis(
      parseInt(id),
      {
        status: 'returned',
        returnDate: returnDate || new Date().toISOString(),
      },
      companyId
    );

    res.json(updated);
  })
);

/**
 * POST /api/v1/prosthesis/:id/mark-completed
 * Marca prótese como concluída (entregue ao paciente)
 */
router.post(
  '/:id/mark-completed',
  authCheck,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;

    const prosthesisItem = await storage.getProsthesisById(parseInt(id), companyId);

    if (!prosthesisItem) {
      return res.status(404).json({ error: 'Prosthesis not found' });
    }

    const updated = await storage.updateProsthesis(
      parseInt(id),
      { status: 'completed' },
      companyId
    );

    res.json(updated);
  })
);

export default router;
