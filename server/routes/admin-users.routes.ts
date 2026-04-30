/**
 * Admin user-management routes.
 *
 * Mount path: /api/admin
 * Auth: authCheck + adminOnly (role === 'admin' || 'superadmin')
 *
 * Tenant scoping:
 *   - superadmin: pode listar/agir em qualquer empresa
 *   - admin: implicitamente filtrado pela própria companyId
 *
 * Reusa:
 *   - paginationSchema, getOffset, createPaginatedResponse (validation.ts)
 *   - createAuditLog, getAuditContext (audit-log.service.ts)
 *   - issueEmailVerificationToken (importado de auth.ts via export)
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { storage } from '../storage';
import { logger } from '../logger';
import { authCheck, adminOnly, asyncHandler } from '../middleware/auth';
import {
  paginationSchema,
  getOffset,
  createPaginatedResponse,
} from '../middleware/validation';
import { createAuditLog, getAuditContext } from '../services/audit-log.service';
import type { AuthenticatedUser } from '../types/express';

const router = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

function isSuperadmin(req: Request): boolean {
  return (req.user as AuthenticatedUser)?.role === 'superadmin';
}

function actorCompanyId(req: Request): number {
  return (req.user as AuthenticatedUser).companyId;
}

const userIdSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

const listUsersFilterSchema = paginationSchema.extend({
  q: z.string().optional(),
  role: z.string().optional(),
  active: z.enum(['true', 'false']).optional(),
  companyId: z.string().regex(/^\d+$/).optional(),
  mfa: z.enum(['true', 'false']).optional(),
  verified: z.enum(['true', 'false']).optional(),
  locked: z.enum(['true', 'false']).optional(),
});

// SELECT columns for list & detail endpoints — NEVER inclui password / segredos.
const SAFE_USER_COLUMNS = `
  u.id,
  u.username,
  u.full_name        AS "fullName",
  u.email,
  u.phone,
  u.role,
  u.active,
  u.company_id       AS "companyId",
  c.name             AS "companyName",
  u.email_verified   AS "emailVerified",
  u.totp_enabled     AS "totpEnabled",
  u.last_login_at    AS "lastLoginAt",
  u.last_login_ip    AS "lastLoginIp",
  u.failed_login_count AS "failedLoginCount",
  u.locked_until     AS "lockedUntil",
  u.deleted_at       AS "deletedAt",
  u.profile_image_url AS "profileImageUrl",
  u.speciality,
  u.admin_notes      AS "adminNotes",
  u.trial_ends_at    AS "trialEndsAt",
  u.created_at       AS "createdAt",
  u.updated_at       AS "updatedAt"
`;

// ─── GET /api/admin/users ──────────────────────────────────────────────────
// Lista paginada com filtros + ordenação.
router.get(
  '/users',
  authCheck,
  adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = listUsersFilterSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Filtros inválidos', details: parsed.error.flatten() });
    }
    const f = parsed.data;
    const offset = getOffset(f.page, f.limit);

    // Construção segura: cláusulas WHERE com placeholders posicionais.
    const wheres: string[] = ['u.deleted_at IS NULL'];
    const params: unknown[] = [];
    let p = 0;
    const next = () => `$${++p}`;

    // Tenant scoping
    if (!isSuperadmin(req)) {
      wheres.push(`u.company_id = ${next()}`);
      params.push(actorCompanyId(req));
    } else if (f.companyId) {
      wheres.push(`u.company_id = ${next()}`);
      params.push(parseInt(f.companyId, 10));
    }

    if (f.q) {
      wheres.push(`(u.username ILIKE ${next()} OR u.full_name ILIKE ${'$' + p} OR u.email ILIKE ${'$' + p})`);
      params.push(`%${f.q}%`);
    }
    if (f.role) {
      wheres.push(`u.role = ${next()}`);
      params.push(f.role);
    }
    if (f.active === 'true') wheres.push('u.active = true');
    if (f.active === 'false') wheres.push('u.active = false');
    if (f.mfa === 'true') wheres.push('u.totp_enabled = true');
    if (f.mfa === 'false') wheres.push('u.totp_enabled = false');
    if (f.verified === 'true') wheres.push('u.email_verified = true');
    if (f.verified === 'false') wheres.push('u.email_verified = false');
    if (f.locked === 'true') wheres.push('u.locked_until > NOW()');
    if (f.locked === 'false') wheres.push('(u.locked_until IS NULL OR u.locked_until <= NOW())');

    const ALLOWED_SORTS: Record<string, string> = {
      id: 'u.id',
      username: 'u.username',
      fullName: 'u.full_name',
      email: 'u.email',
      role: 'u.role',
      active: 'u.active',
      lastLoginAt: 'u.last_login_at',
      createdAt: 'u.created_at',
    };
    const sortCol = ALLOWED_SORTS[f.sortBy ?? ''] ?? 'u.id';
    const sortOrder = f.sortOrder === 'asc' ? 'ASC' : 'DESC';

    const whereSql = wheres.join(' AND ');

    const dataQuery = `
      SELECT ${SAFE_USER_COLUMNS}
      FROM users u
      LEFT JOIN companies c ON c.id = u.company_id
      WHERE ${whereSql}
      ORDER BY ${sortCol} ${sortOrder} NULLS LAST
      LIMIT ${next()} OFFSET ${next()}
    `;
    params.push(f.limit, offset);

    const countQuery = `SELECT COUNT(*)::int AS total FROM users u WHERE ${whereSql}`;
    // count usa os mesmos params, exceto os 2 últimos (limit/offset)
    const countParams = params.slice(0, -2);

    const [data, count] = await Promise.all([
      db.$client.query(dataQuery, params),
      db.$client.query(countQuery, countParams),
    ]);

    res.json(createPaginatedResponse(data.rows, count.rows[0]?.total ?? 0, f.page, f.limit));
  }),
);

// ─── GET /api/admin/users/:id ──────────────────────────────────────────────
router.get(
  '/users/:id',
  authCheck,
  adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = userIdSchema.parse(req.params);
    const target = await storage.getUser(id);
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado' });

    if (!isSuperadmin(req) && target.companyId !== actorCompanyId(req)) {
      return res.status(403).json({ error: 'Sem permissão para ver este usuário' });
    }

    const r = await db.$client.query(
      `SELECT ${SAFE_USER_COLUMNS}
       FROM users u
       LEFT JOIN companies c ON c.id = u.company_id
       WHERE u.id = $1`,
      [id],
    );
    res.json(r.rows[0]);
  }),
);

// ─── PATCH /api/admin/users/:id ─────────────────────────────────────────────
const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  role: z.enum(['admin', 'dentist', 'receptionist', 'assistant', 'staff']).optional(),
  active: z.boolean().optional(),
  speciality: z.string().optional().nullable(),
  adminNotes: z.string().optional().nullable(),
});

router.patch(
  '/users/:id',
  authCheck,
  adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = userIdSchema.parse(req.params);
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const target = await storage.getUser(id);
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado' });

    if (!isSuperadmin(req) && target.companyId !== actorCompanyId(req)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    // Apenas superadmin pode promover alguém para superadmin
    if (parsed.data.role && parsed.data.role === 'admin' && !isSuperadmin(req) && target.role === 'superadmin') {
      return res.status(403).json({ error: 'Não pode rebaixar superadmin' });
    }

    const updated = await storage.updateUser(id, parsed.data as any);

    const ctx = getAuditContext(req);
    const wasActiveChange = parsed.data.active !== undefined && parsed.data.active !== target.active;
    await createAuditLog({
      ...ctx,
      action: wasActiveChange
        ? parsed.data.active
          ? 'account_activated_by_admin'
          : 'account_deactivated_by_admin'
        : 'update',
      resourceType: 'user',
      resourceId: id,
      details: { changes: parsed.data, targetUserId: id },
    });

    const { password, googleAccessToken, googleRefreshToken, totpSecret, totpBackupCodes, passwordResetToken, ...safe } = updated as any;
    res.json(safe);
  }),
);

// ─── DELETE /api/admin/users/:id ────────────────────────────────────────────
router.delete(
  '/users/:id',
  authCheck,
  adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = userIdSchema.parse(req.params);
    const target = await storage.getUser(id);
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado' });

    if (!isSuperadmin(req) && target.companyId !== actorCompanyId(req)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    if (target.role === 'superadmin') {
      return res.status(403).json({ error: 'Não é possível excluir superadmin' });
    }

    await db.$client.query(
      `UPDATE users SET active = false, deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id],
    );
    // Revogar sessões do usuário deletado
    await db.$client.query(`DELETE FROM user_sessions WHERE user_id = $1`, [id]);

    await createAuditLog({
      ...getAuditContext(req),
      action: 'account_deleted_by_admin',
      resourceType: 'user',
      resourceId: id,
    });

    res.status(204).send();
  }),
);

// ─── GET /api/admin/users/:id/sessions ─────────────────────────────────────
router.get(
  '/users/:id/sessions',
  authCheck,
  adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = userIdSchema.parse(req.params);
    const target = await storage.getUser(id);
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (!isSuperadmin(req) && target.companyId !== actorCompanyId(req)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    const r = await db.$client.query(
      `SELECT sid, expire,
              (sess::jsonb -> 'cookie' ->> 'maxAge')::bigint AS "maxAge"
       FROM user_sessions
       WHERE user_id = $1 AND expire > NOW()
       ORDER BY expire DESC`,
      [id],
    );
    res.json(r.rows);
  }),
);

// ─── DELETE /api/admin/users/:id/sessions/:sid ─────────────────────────────
router.delete(
  '/users/:id/sessions/:sid',
  authCheck,
  adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = userIdSchema.parse(req.params);
    const sid = req.params.sid;
    const target = await storage.getUser(id);
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (!isSuperadmin(req) && target.companyId !== actorCompanyId(req)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    const r = await db.$client.query(
      `DELETE FROM user_sessions WHERE sid = $1 AND user_id = $2`,
      [sid, id],
    );
    await createAuditLog({
      ...getAuditContext(req),
      action: 'session_revoked',
      resourceType: 'user',
      resourceId: id,
      details: { sid },
    });
    res.json({ revoked: r.rowCount ?? 0 });
  }),
);

// ─── DELETE /api/admin/users/:id/sessions ───────────────────────────────────
router.delete(
  '/users/:id/sessions',
  authCheck,
  adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = userIdSchema.parse(req.params);
    const target = await storage.getUser(id);
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (!isSuperadmin(req) && target.companyId !== actorCompanyId(req)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    const r = await db.$client.query(
      `DELETE FROM user_sessions WHERE user_id = $1`,
      [id],
    );
    await createAuditLog({
      ...getAuditContext(req),
      action: 'all_sessions_revoked',
      resourceType: 'user',
      resourceId: id,
      details: { count: r.rowCount ?? 0 },
    });
    res.json({ revoked: r.rowCount ?? 0 });
  }),
);

// ─── POST /api/admin/users/:id/reset-mfa ────────────────────────────────────
router.post(
  '/users/:id/reset-mfa',
  authCheck,
  adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = userIdSchema.parse(req.params);
    if (req.headers['x-confirm'] !== 'true') {
      return res.status(400).json({ error: 'Confirmação obrigatória (x-confirm: true)' });
    }
    const target = await storage.getUser(id);
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (!isSuperadmin(req) && target.companyId !== actorCompanyId(req)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    await db.$client.query(
      `UPDATE users SET totp_enabled = false, totp_secret = NULL, totp_backup_codes = NULL, updated_at = NOW() WHERE id = $1`,
      [id],
    );
    await createAuditLog({
      ...getAuditContext(req),
      action: 'mfa_reset_by_admin',
      resourceType: 'user',
      resourceId: id,
    });
    res.json({ success: true, message: 'MFA resetado. O usuário pode configurar novamente.' });
  }),
);

// ─── POST /api/admin/users/:id/mark-verified ────────────────────────────────
router.post(
  '/users/:id/mark-verified',
  authCheck,
  adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = userIdSchema.parse(req.params);
    const target = await storage.getUser(id);
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (!isSuperadmin(req) && target.companyId !== actorCompanyId(req)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    await db.$client.query(
      `UPDATE users SET email_verified = true, email_verification_token = NULL, email_verification_expires = NULL, updated_at = NOW() WHERE id = $1`,
      [id],
    );
    await createAuditLog({
      ...getAuditContext(req),
      action: 'email_marked_verified_by_admin',
      resourceType: 'user',
      resourceId: id,
    });
    res.json({ success: true });
  }),
);

// ─── POST /api/admin/users/:id/unlock ───────────────────────────────────────
router.post(
  '/users/:id/unlock',
  authCheck,
  adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = userIdSchema.parse(req.params);
    const target = await storage.getUser(id);
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (!isSuperadmin(req) && target.companyId !== actorCompanyId(req)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    await db.$client.query(
      `UPDATE users SET failed_login_count = 0, locked_until = NULL, updated_at = NOW() WHERE id = $1`,
      [id],
    );
    await createAuditLog({
      ...getAuditContext(req),
      action: 'account_unlocked',
      resourceType: 'user',
      resourceId: id,
    });
    res.json({ success: true });
  }),
);

// ─── POST /api/admin/users/:id/impersonate ─────────────────────────────────
// Inicia impersonação. Sessão atual é mantida (admin), e injetamos a flag
// `impersonatedBy` na sessão. Login subsequente é trocado para o target via
// passport.req.login. TTL de 30 min.
router.post(
  '/users/:id/impersonate',
  authCheck,
  adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = userIdSchema.parse(req.params);
    const admin = req.user as AuthenticatedUser;

    if (admin.id === id) {
      return res.status(400).json({ error: 'Não pode impersonar a si mesmo' });
    }

    const target = await storage.getUser(id);
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado' });

    if (target.role === 'superadmin') {
      return res.status(403).json({ error: 'Não é possível impersonar superadmin' });
    }
    if (!isSuperadmin(req) && target.companyId !== admin.companyId) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    // Guarda o admin original na sessão
    (req.session as any).impersonatedBy = admin.id;
    (req.session as any).cookie.maxAge = 30 * 60 * 1000; // 30 min

    await createAuditLog({
      companyId: admin.companyId,
      userId: admin.id,
      action: 'impersonation_started',
      resourceType: 'user',
      resourceId: id,
      details: { actingAs: id },
      ipAddress: getAuditContext(req).ipAddress,
      userAgent: getAuditContext(req).userAgent,
    });

    // Faz login como target (mantém impersonatedBy na sessão)
    req.login(target as any, (err) => {
      if (err) {
        logger.error({ err }, 'Impersonate: req.login failed');
        return res.status(500).json({ error: 'Falha ao iniciar impersonação' });
      }
      const { password, googleAccessToken, googleRefreshToken, totpSecret, totpBackupCodes, passwordResetToken, ...safe } = target as any;
      res.json({ success: true, target: safe });
    });
  }),
);

// ─── POST /api/admin/users/stop-impersonate ────────────────────────────────
router.post(
  '/users/stop-impersonate',
  authCheck,
  asyncHandler(async (req: Request, res: Response) => {
    const impersonatedBy = (req.session as any)?.impersonatedBy as number | undefined;
    if (!impersonatedBy) {
      return res.status(400).json({ error: 'Nenhuma impersonação ativa' });
    }

    const admin = await storage.getUser(impersonatedBy);
    if (!admin) {
      // Falhou — desloga geral por segurança
      req.logout(() => res.status(401).json({ error: 'Admin original não encontrado' }));
      return;
    }

    const targetId = (req.user as any)?.id;
    delete (req.session as any).impersonatedBy;

    await createAuditLog({
      companyId: admin.companyId,
      userId: admin.id,
      action: 'impersonation_stopped',
      resourceType: 'user',
      resourceId: targetId,
      details: { actingAs: targetId },
      ipAddress: getAuditContext(req).ipAddress,
      userAgent: getAuditContext(req).userAgent,
    });

    req.login(admin as any, (err) => {
      if (err) return res.status(500).json({ error: 'Falha ao restaurar sessão' });
      const { password, googleAccessToken, googleRefreshToken, totpSecret, totpBackupCodes, passwordResetToken, ...safe } = admin as any;
      res.json({ success: true, restored: safe });
    });
  }),
);

// ─── POST /api/admin/users/bulk ─────────────────────────────────────────────
const bulkSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(100),
  action: z.enum(['activate', 'deactivate', 'delete', 'reset-mfa', 'unlock']),
});

router.post(
  '/users/bulk',
  authCheck,
  adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = bulkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido', details: parsed.error.flatten() });
    }
    const { ids, action } = parsed.data;
    const ctx = getAuditContext(req);

    // Filtra alvos: tenant scoping + remove superadmin
    const targets = await db.$client.query(
      `SELECT id, company_id, role FROM users WHERE id = ANY($1::int[]) AND deleted_at IS NULL`,
      [ids],
    );
    const allowed = (targets.rows as any[]).filter((t) => {
      if (t.role === 'superadmin') return false;
      if (!isSuperadmin(req) && t.company_id !== actorCompanyId(req)) return false;
      return true;
    });
    const allowedIds = allowed.map((t) => t.id);

    if (allowedIds.length === 0) {
      return res.status(400).json({ error: 'Nenhum usuário elegível na seleção' });
    }

    let sqlText = '';
    switch (action) {
      case 'activate':
        sqlText = `UPDATE users SET active = true, updated_at = NOW() WHERE id = ANY($1::int[])`;
        break;
      case 'deactivate':
        sqlText = `UPDATE users SET active = false, updated_at = NOW() WHERE id = ANY($1::int[])`;
        break;
      case 'delete':
        sqlText = `UPDATE users SET active = false, deleted_at = NOW(), updated_at = NOW() WHERE id = ANY($1::int[])`;
        break;
      case 'reset-mfa':
        sqlText = `UPDATE users SET totp_enabled = false, totp_secret = NULL, totp_backup_codes = NULL, updated_at = NOW() WHERE id = ANY($1::int[])`;
        break;
      case 'unlock':
        sqlText = `UPDATE users SET failed_login_count = 0, locked_until = NULL, updated_at = NOW() WHERE id = ANY($1::int[])`;
        break;
    }
    await db.$client.query(sqlText, [allowedIds]);

    if (action === 'delete') {
      await db.$client.query(`DELETE FROM user_sessions WHERE user_id = ANY($1::int[])`, [allowedIds]);
    }

    // 1 audit log resumido por ação + audit individual para auditoria fina
    await createAuditLog({
      ...ctx,
      action: 'bulk_action',
      resourceType: 'user',
      details: { action, userIds: allowedIds, count: allowedIds.length },
    });

    res.json({ affected: allowedIds.length, ids: allowedIds });
  }),
);

// ─── GET /api/admin/users/export.csv ────────────────────────────────────────
router.get(
  '/users/export.csv',
  authCheck,
  adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    // Reusa os mesmos filtros do GET /users (sem limit/offset)
    const filterSchema = listUsersFilterSchema.partial();
    const f = filterSchema.parse(req.query);

    const wheres: string[] = ['u.deleted_at IS NULL'];
    const params: unknown[] = [];
    let p = 0;
    const next = () => `$${++p}`;

    if (!isSuperadmin(req)) {
      wheres.push(`u.company_id = ${next()}`);
      params.push(actorCompanyId(req));
    } else if (f.companyId) {
      wheres.push(`u.company_id = ${next()}`);
      params.push(parseInt(f.companyId, 10));
    }
    if (f.q) {
      wheres.push(`(u.username ILIKE ${next()} OR u.full_name ILIKE ${'$' + p} OR u.email ILIKE ${'$' + p})`);
      params.push(`%${f.q}%`);
    }
    if (f.role) { wheres.push(`u.role = ${next()}`); params.push(f.role); }
    if (f.active === 'true') wheres.push('u.active = true');
    if (f.active === 'false') wheres.push('u.active = false');
    if (f.mfa === 'true') wheres.push('u.totp_enabled = true');
    if (f.mfa === 'false') wheres.push('u.totp_enabled = false');
    if (f.verified === 'true') wheres.push('u.email_verified = true');
    if (f.verified === 'false') wheres.push('u.email_verified = false');

    const r = await db.$client.query(
      `SELECT u.id, u.username, u.full_name AS "fullName", u.email, u.role,
              u.active, u.email_verified AS "emailVerified", u.totp_enabled AS "totpEnabled",
              u.last_login_at AS "lastLoginAt", c.name AS "companyName", u.created_at AS "createdAt"
       FROM users u
       LEFT JOIN companies c ON c.id = u.company_id
       WHERE ${wheres.join(' AND ')}
       ORDER BY u.id`,
      params,
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="users-${Date.now()}.csv"`);
    const escape = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const headers = ['id', 'username', 'fullName', 'email', 'role', 'active', 'emailVerified', 'totpEnabled', 'lastLoginAt', 'companyName', 'createdAt'];
    res.write(headers.join(',') + '\n');
    for (const row of r.rows) {
      res.write(headers.map((h) => escape((row as any)[h])).join(',') + '\n');
    }
    res.end();

    await createAuditLog({
      ...getAuditContext(req),
      action: 'export',
      resourceType: 'user',
      details: { filters: f, count: r.rows.length },
    });
  }),
);

// ─── GET /api/admin/audit-logs ──────────────────────────────────────────────
const auditQuerySchema = paginationSchema.extend({
  userId: z.string().regex(/^\d+$/).optional(),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

router.get(
  '/audit-logs',
  authCheck,
  adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const f = auditQuerySchema.parse(req.query);
    const offset = getOffset(f.page, f.limit);

    const wheres: string[] = ['1=1'];
    const params: unknown[] = [];
    let p = 0;
    const next = () => `$${++p}`;

    if (!isSuperadmin(req)) {
      wheres.push(`a.company_id = ${next()}`);
      params.push(actorCompanyId(req));
    }
    if (f.userId) { wheres.push(`a.user_id = ${next()}`); params.push(parseInt(f.userId, 10)); }
    if (f.action) { wheres.push(`a.action = ${next()}`); params.push(f.action); }
    if (f.resourceType) { wheres.push(`a.resource = ${next()}`); params.push(f.resourceType); }
    if (f.from) { wheres.push(`a.created_at >= ${next()}`); params.push(new Date(f.from)); }
    if (f.to) { wheres.push(`a.created_at <= ${next()}`); params.push(new Date(f.to)); }

    const whereSql = wheres.join(' AND ');
    const data = await db.$client.query(
      `SELECT a.id, a.company_id AS "companyId", a.user_id AS "userId", a.action,
              a.resource AS "resourceType", a.resource_id AS "resourceId",
              a.changes AS details, a.ip_address AS "ipAddress", a.user_agent AS "userAgent",
              a.created_at AS "createdAt",
              u.username AS "actorUsername", u.full_name AS "actorFullName"
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE ${whereSql}
       ORDER BY a.created_at DESC
       LIMIT ${next()} OFFSET ${next()}`,
      [...params, f.limit, offset],
    );
    const count = await db.$client.query(
      `SELECT COUNT(*)::int AS total FROM audit_logs a WHERE ${whereSql}`,
      params,
    );
    res.json(createPaginatedResponse(data.rows, count.rows[0]?.total ?? 0, f.page, f.limit));
  }),
);

export default router;
