import { Router } from 'express';
import { db } from '../db';
import { notifications } from '@shared/schema';
import { authCheck, asyncHandler } from '../middleware/auth';
import { validate, paginationSchema, createPaginatedResponse, getOffset } from '../middleware/validation';
import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { notificationService } from '../services/notificationService';

const router = Router();

// Schema para query params de listagem
const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  unreadOnly: z.coerce.boolean().optional().default(false),
  type: z.enum(['appointment', 'payment', 'patient', 'system', 'alert', 'reminder']).optional(),
});

// Schema para criar notificação (admin/system only)
const createNotificationSchema = z.object({
  userId: z.union([z.number(), z.array(z.number())]), // Pode ser um ou múltiplos usuários
  type: z.enum(['appointment', 'payment', 'patient', 'system', 'alert', 'reminder']),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  relatedResource: z.string().optional(),
  relatedResourceId: z.number().optional(),
  actionUrl: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  metadata: z.record(z.any()).optional(),
  expiresAt: z.string().optional(), // ISO date string
});

/**
 * GET /api/v1/notifications
 * Lista notificações do usuário (paginado)
 */
router.get(
  '/',
  authCheck,
  validate({ query: listNotificationsQuerySchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const userId = user?.id;
    const companyId = user?.companyId;

    if (!userId || !companyId) {
      return res.status(403).json({ error: 'User not authenticated' });
    }

    const { page, limit, unreadOnly, type } = req.query as any;

    try {
      // Construir query
      let query = db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.companyId, companyId)
          )
        )
        .$dynamic();

      // Filtros
      if (unreadOnly) {
        query = query.where(eq(notifications.isRead, false));
      }

      if (type) {
        query = query.where(eq(notifications.type, type));
      }

      // Executar com paginação
      const results = await query
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(getOffset(page, limit));

      // Contar total
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.companyId, companyId),
            unreadOnly ? eq(notifications.isRead, false) : sql`true`
          )
        );

      res.json(createPaginatedResponse(results, count, page, limit));
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      // Se a tabela não existe, retornar array vazio em vez de erro 500
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return res.json(createPaginatedResponse([], 0, page, limit));
      }
      throw error;
    }
  })
);

/**
 * GET /api/v1/notifications/unread-count
 * Retorna contagem de notificações não lidas
 */
router.get(
  '/unread-count',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const userId = user?.id;
    const companyId = user?.companyId;

    if (!userId || !companyId) {
      return res.status(403).json({ error: 'User not authenticated' });
    }

    try {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.companyId, companyId),
            eq(notifications.isRead, false)
          )
        );

      res.json({ count });
    } catch (error: any) {
      console.error('Error fetching unread count:', error);
      // Se a tabela não existe, retornar count 0
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return res.json({ count: 0 });
      }
      throw error;
    }
  })
);

/**
 * GET /api/v1/notifications/:id
 * Busca uma notificação específica
 */
router.get(
  '/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const userId = user?.id;
    const companyId = user?.companyId;

    if (!userId || !companyId) {
      return res.status(403).json({ error: 'User not authenticated' });
    }

    const { id } = req.params;

    const [notification] = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.id, parseInt(id)),
          eq(notifications.userId, userId),
          eq(notifications.companyId, companyId)
        )
      );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(notification);
  })
);

/**
 * PATCH /api/v1/notifications/:id/read
 * Marca notificação como lida
 */
router.patch(
  '/:id/read',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const userId = user?.id;
    const companyId = user?.companyId;

    if (!userId || !companyId) {
      return res.status(403).json({ error: 'User not authenticated' });
    }

    const { id } = req.params;

    const [updated] = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date()
      })
      .where(
        and(
          eq(notifications.id, parseInt(id)),
          eq(notifications.userId, userId),
          eq(notifications.companyId, companyId)
        )
      )
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(updated);
  })
);

/**
 * POST /api/v1/notifications/mark-all-read
 * Marca todas as notificações como lidas
 */
router.post(
  '/mark-all-read',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const userId = user?.id;
    const companyId = user?.companyId;

    if (!userId || !companyId) {
      return res.status(403).json({ error: 'User not authenticated' });
    }

    const result = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date()
      })
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.companyId, companyId),
          eq(notifications.isRead, false)
        )
      );

    res.json({ success: true, message: 'All notifications marked as read' });
  })
);

/**
 * DELETE /api/v1/notifications/:id
 * Deleta uma notificação
 */
router.delete(
  '/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const userId = user?.id;
    const companyId = user?.companyId;

    if (!userId || !companyId) {
      return res.status(403).json({ error: 'User not authenticated' });
    }

    const { id } = req.params;

    await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.id, parseInt(id)),
          eq(notifications.userId, userId),
          eq(notifications.companyId, companyId)
        )
      );

    res.status(204).send();
  })
);

/**
 * POST /api/v1/notifications
 * Cria e envia nova notificação (admin only)
 */
router.post(
  '/',
  authCheck,
  validate({ body: createNotificationSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    // Verificar se é admin
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied - Admin only' });
    }

    const { userId, expiresAt, ...notificationData } = req.body;

    // Criar e enviar notificação
    await notificationService.createAndSend({
      companyId,
      userId,
      ...notificationData,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined
    });

    res.status(201).json({ success: true, message: 'Notification created and sent' });
  })
);

/**
 * GET /api/v1/notifications/ws/stats
 * Retorna estatísticas do WebSocket server (admin only)
 */
router.get(
  '/ws/stats',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;

    // Verificar se é admin
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied - Admin only' });
    }

    const stats = notificationService.getStats();
    res.json(stats);
  })
);

export default router;
