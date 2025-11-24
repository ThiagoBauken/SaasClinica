import { Router } from 'express';
import { storage } from '../storage';
import { authCheck, asyncHandler } from '../middleware/auth';
import { validate, paginationSchema, idParamSchema, createPaginatedResponse, getOffset } from '../middleware/validation';
import { cacheMiddleware } from '../simpleCache';

const router = Router();

/**
 * GET /api/v1/professionals
 * Lista todos os profissionais da empresa
 */
router.get(
  '/',
  authCheck,
  validate({ query: paginationSchema }),
  cacheMiddleware(60), // Cache por 1 minuto (profissionais podem mudar)
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { page, limit } = req.query as any;

    const professionals = await storage.getProfessionals(companyId);

    const total = professionals.length;
    const offset = getOffset(page, limit);
    const paginatedData = professionals.slice(offset, offset + limit);

    res.json(createPaginatedResponse(paginatedData, total, page, limit));
  })
);

/**
 * GET /api/v1/professionals/:id
 * Busca um profissional específico da empresa
 * Retorna dados completos incluindo googleCalendarId e wuzapiPhone
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

    const professionals = await storage.getProfessionals(companyId);
    const professional = professionals.find((p: any) => p.id === parseInt(id));

    if (!professional) {
      return res.status(404).json({ error: 'Professional not found' });
    }

    // Retornar todos os campos incluindo googleCalendarId e wuzapiPhone
    res.json({
      id: professional.id,
      fullName: professional.fullName,
      email: professional.email,
      phone: professional.phone,
      speciality: professional.speciality,
      role: professional.role,
      active: professional.active,
      profileImageUrl: professional.profileImageUrl,
      googleCalendarId: professional.googleCalendarId || null,
      wuzapiPhone: professional.wuzapiPhone || null,
    });
  })
);

export default router;
