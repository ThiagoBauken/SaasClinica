import { Router } from 'express';
import { db } from '../db';
import { auditLogs, users } from '@shared/schema';
import { authCheck, asyncHandler } from '../middleware/auth';
import { validate, paginationSchema, createPaginatedResponse, getOffset } from '../middleware/validation';
import { z } from 'zod';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

const router = Router();

// Schema para query params de listagem de logs
const listAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  action: z.enum(['create', 'read', 'update', 'delete', 'export', 'anonymize']).optional(),
  resource: z.string().optional(),
  userId: z.coerce.number().int().positive().optional(),
  sensitiveDataOnly: z.coerce.boolean().optional().default(false),
});

/**
 * GET /api/v1/audit-logs
 * Lista logs de auditoria com filtros (paginado)
 * Apenas para administradores
 */
router.get(
  '/',
  authCheck,
  validate({ query: listAuditLogsQuerySchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    // Verificar se o usuário é administrador
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied - Admin only' });
    }

    const { page, limit, startDate, endDate, action, resource, userId, sensitiveDataOnly } = req.query as any;

    // Construir query base
    let query = db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        userName: users.fullName,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        sensitiveData: auditLogs.sensitiveData,
        dataCategory: auditLogs.dataCategory,
        description: auditLogs.description,
        changes: auditLogs.changes,
        reason: auditLogs.reason,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        method: auditLogs.method,
        url: auditLogs.url,
        statusCode: auditLogs.statusCode,
        lgpdJustification: auditLogs.lgpdJustification,
        consentGiven: auditLogs.consentGiven,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(eq(auditLogs.companyId, companyId))
      .$dynamic();

    // Aplicar filtros
    if (startDate) {
      query = query.where(gte(auditLogs.createdAt, new Date(startDate)));
    }

    if (endDate) {
      query = query.where(lte(auditLogs.createdAt, new Date(endDate)));
    }

    if (action) {
      query = query.where(eq(auditLogs.action, action));
    }

    if (resource) {
      query = query.where(eq(auditLogs.resource, resource));
    }

    if (userId) {
      query = query.where(eq(auditLogs.userId, userId));
    }

    if (sensitiveDataOnly) {
      query = query.where(eq(auditLogs.sensitiveData, true));
    }

    // Executar query com paginação
    const results = await query
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(getOffset(page, limit));

    // Contar total
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(eq(auditLogs.companyId, companyId));

    res.json(createPaginatedResponse(results, count, page, limit));
  })
);

/**
 * GET /api/v1/audit-logs/stats
 * Retorna estatísticas dos logs de auditoria
 * Apenas para administradores
 */
router.get(
  '/stats',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    // Verificar se o usuário é administrador
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied - Admin only' });
    }

    // Buscar estatísticas
    const actionStats = await db.execute(sql`
      SELECT
        action,
        COUNT(*)::int as count
      FROM ${auditLogs}
      WHERE company_id = ${companyId}
      GROUP BY action
      ORDER BY count DESC
    `);

    const resourceStats = await db.execute(sql`
      SELECT
        resource,
        COUNT(*)::int as count
      FROM ${auditLogs}
      WHERE company_id = ${companyId}
      GROUP BY resource
      ORDER BY count DESC
      LIMIT 10
    `);

    const dataCategoryStats = await db.execute(sql`
      SELECT
        data_category,
        COUNT(*)::int as count
      FROM ${auditLogs}
      WHERE company_id = ${companyId} AND sensitive_data = true
      GROUP BY data_category
      ORDER BY count DESC
    `);

    const [totalLogs] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(eq(auditLogs.companyId, companyId));

    const [sensitiveLogs] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(and(
        eq(auditLogs.companyId, companyId),
        eq(auditLogs.sensitiveData, true)
      ));

    res.json({
      total: totalLogs.count,
      sensitiveData: sensitiveLogs.count,
      byAction: actionStats.rows,
      byResource: resourceStats.rows,
      byDataCategory: dataCategoryStats.rows,
    });
  })
);

/**
 * GET /api/v1/audit-logs/:id
 * Busca um log específico
 * Apenas para administradores
 */
router.get(
  '/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    // Verificar se o usuário é administrador
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied - Admin only' });
    }

    const { id } = req.params;

    const [log] = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        userName: users.fullName,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        sensitiveData: auditLogs.sensitiveData,
        dataCategory: auditLogs.dataCategory,
        description: auditLogs.description,
        changes: auditLogs.changes,
        reason: auditLogs.reason,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        method: auditLogs.method,
        url: auditLogs.url,
        statusCode: auditLogs.statusCode,
        lgpdJustification: auditLogs.lgpdJustification,
        consentGiven: auditLogs.consentGiven,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(and(
        eq(auditLogs.id, parseInt(id)),
        eq(auditLogs.companyId, companyId)
      ));

    if (!log) {
      return res.status(404).json({ error: 'Audit log not found' });
    }

    res.json(log);
  })
);

/**
 * GET /api/v1/audit-logs/resource/:resource/:id
 * Busca todos os logs relacionados a um recurso específico
 * Apenas para administradores
 */
router.get(
  '/resource/:resource/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    // Verificar se o usuário é administrador
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied - Admin only' });
    }

    const { resource, id } = req.params;

    const logs = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        userName: users.fullName,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        description: auditLogs.description,
        changes: auditLogs.changes,
        reason: auditLogs.reason,
        ipAddress: auditLogs.ipAddress,
        method: auditLogs.method,
        url: auditLogs.url,
        statusCode: auditLogs.statusCode,
        lgpdJustification: auditLogs.lgpdJustification,
        consentGiven: auditLogs.consentGiven,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(and(
        eq(auditLogs.companyId, companyId),
        eq(auditLogs.resource, resource),
        eq(auditLogs.resourceId, parseInt(id))
      ))
      .orderBy(desc(auditLogs.createdAt));

    res.json(logs);
  })
);

export default router;
