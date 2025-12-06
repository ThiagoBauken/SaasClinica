import { Router } from 'express';
import { storage } from '../storage';
import { authCheck, asyncHandler } from '../middleware/auth';
import { validate, paginationSchema, idParamSchema, createPaginatedResponse, getOffset } from '../middleware/validation';
import { cacheMiddleware, invalidateCache } from '../simpleCache';
import { z } from 'zod';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

// Schema para atualização de integrações do profissional
const updateProfessionalIntegrationsSchema = z.object({
  googleCalendarId: z.string().optional().nullable(),
  wuzapiPhone: z.string().optional().nullable(),
});

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

/**
 * PATCH /api/v1/professionals/:id/integrations
 * Atualiza configurações de integração do profissional (Google Calendar, WhatsApp)
 * Requer role: admin
 */
router.patch(
  '/:id/integrations',
  authCheck,
  validate({ params: idParamSchema, body: updateProfessionalIntegrationsSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    // Verificar se é admin
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Apenas administradores podem atualizar configurações de profissionais',
      });
    }

    const { id } = req.params as any;
    const { googleCalendarId, wuzapiPhone } = req.body;

    // Verificar se o profissional pertence à empresa
    const [professional] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, parseInt(id)), eq(users.companyId, companyId)))
      .limit(1);

    if (!professional) {
      return res.status(404).json({ error: 'Professional not found' });
    }

    // Atualizar as configurações
    const updateData: any = {};
    if (googleCalendarId !== undefined) {
      updateData.googleCalendarId = googleCalendarId;
    }
    if (wuzapiPhone !== undefined) {
      updateData.wuzapiPhone = wuzapiPhone;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, parseInt(id)))
      .returning();

    // Invalidar cache
    invalidateCache(`/api/v1/professionals`);
    invalidateCache(`/api/v1/professionals/${id}`);

    res.json({
      message: 'Configurações de integração atualizadas com sucesso',
      professional: {
        id: updated.id,
        fullName: updated.fullName,
        googleCalendarId: updated.googleCalendarId,
        wuzapiPhone: updated.wuzapiPhone,
      },
    });
  })
);

/**
 * GET /api/v1/professionals/:id/calendar-info
 * Retorna informações do Google Calendar do profissional
 */
router.get(
  '/:id/calendar-info',
  authCheck,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;

    const [professional] = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        googleCalendarId: users.googleCalendarId,
        googleAccessToken: users.googleAccessToken,
        googleTokenExpiry: users.googleTokenExpiry,
      })
      .from(users)
      .where(and(eq(users.id, parseInt(id)), eq(users.companyId, companyId)))
      .limit(1);

    if (!professional) {
      return res.status(404).json({ error: 'Professional not found' });
    }

    const hasGoogleAuth = !!(professional.googleAccessToken);
    const tokenExpired = professional.googleTokenExpiry ? new Date(professional.googleTokenExpiry) < new Date() : true;

    res.json({
      professionalId: professional.id,
      fullName: professional.fullName,
      googleCalendarId: professional.googleCalendarId,
      hasGoogleAuth,
      tokenExpired: hasGoogleAuth ? tokenExpired : null,
      needsReauth: hasGoogleAuth && tokenExpired,
    });
  })
);

export default router;
