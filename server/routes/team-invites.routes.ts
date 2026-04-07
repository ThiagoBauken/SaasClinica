/**
 * Team Invite Routes
 *
 * Handles invite creation, listing, revocation, validation and acceptance.
 *
 * Authenticated endpoints (require login):
 *   POST   /api/v1/team/invite        — Create a new invite
 *   GET    /api/v1/team/invites        — List pending invites for the company
 *   DELETE /api/v1/team/invites/:id    — Revoke an invite
 *
 * Public endpoints (no auth required):
 *   GET    /api/public/invite/:token         — Validate token, return invite info
 *   POST   /api/public/invite/:token/accept  — Accept invite, create user account
 *
 * NOTE: The teamInvites table is defined in server/data/team-invites-schema.ts.
 * Merge it into shared/schema.ts and run the migration SQL before deploying.
 */

import { Router } from 'express';
import { randomBytes } from 'crypto';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { users, companies, teamInvites } from '@shared/schema';
import { authCheck, asyncHandler } from '../middleware/auth';
import { addEmailJob } from '../queue/queues';
import { hashPassword } from '../auth';
import { logger } from '../logger';
import { publicTokenLimiter, publicSubmitLimiter } from '../middleware/public-rate-limit';

const router = Router();

// ─── Validation schemas ─────────────────────────────────────────────────────

const createInviteSchema = z.object({
  email: z.string().email('Email invalido'),
  role: z.enum(['dentista', 'recepcionista', 'assistente', 'staff', 'admin']).default('staff'),
});

const acceptInviteSchema = z.object({
  fullName: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
  username: z.string().min(3, 'Username deve ter ao menos 3 caracteres').optional(),
});

// ─── Helper ─────────────────────────────────────────────────────────────────

function getCompanyId(req: any): number {
  return req.user!.companyId;
}

// ─── Authenticated routes ────────────────────────────────────────────────────

/**
 * POST /api/v1/team/invite
 * Creates an invite and queues an e-mail to the invitee.
 */
router.post(
  '/invite',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const parsed = createInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados invalidos', details: parsed.error.flatten() });
    }

    const { email, role } = parsed.data;
    const invitedBy = req.user!.id ?? null;

    // Check if there is already a pending (non-expired, non-accepted) invite for this email+company
    const existing = await db
      .select({ id: teamInvites.id })
      .from(teamInvites)
      .where(
        and(
          eq(teamInvites.companyId, companyId),
          eq(teamInvites.email, email),
          isNull(teamInvites.acceptedAt),
          gt(teamInvites.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Ja existe um convite pendente para este email' });
    }

    // Generate token with 48-hour expiry
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const [invite] = await db
      .insert(teamInvites)
      .values({ companyId, email, role, token, expiresAt, invitedBy })
      .returning();

    // Fetch clinic name for the email
    const [company] = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    const clinicName = company?.name ?? 'Clinica';
    const baseUrl = process.env.APP_URL ?? `${req.protocol}://${req.get('host')}`;
    const acceptUrl = `${baseUrl}/aceitar-convite/${token}`;

    // Queue invite email (non-blocking — failures are logged but don't abort the response)
    try {
      await addEmailJob({
        to: email,
        subject: `Voce foi convidado para ${clinicName}`,
        body: [
          `Ola!`,
          ``,
          `Voce foi convidado para fazer parte da equipe de <strong>${clinicName}</strong> como <strong>${role}</strong>.`,
          ``,
          `Clique no link abaixo para criar sua conta e aceitar o convite:`,
          `<a href="${acceptUrl}">${acceptUrl}</a>`,
          ``,
          `Este link expira em 48 horas.`,
          ``,
          `Se voce nao esperava este convite, ignore este e-mail.`,
        ].join('\n'),
        companyId,
      });
    } catch (emailErr) {
      logger.warn({ err: emailErr, inviteId: invite.id }, 'Failed to queue invite email — invite was still created');
    }

    logger.info({ inviteId: invite.id, email, role, companyId }, 'Team invite created');

    return res.status(201).json({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      acceptUrl,
    });
  }),
);

/**
 * GET /api/v1/team/invites
 * Returns all non-accepted, non-expired invites for the current company.
 */
router.get(
  '/invites',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const rows = await db
      .select({
        id: teamInvites.id,
        email: teamInvites.email,
        role: teamInvites.role,
        expiresAt: teamInvites.expiresAt,
        acceptedAt: teamInvites.acceptedAt,
        createdAt: teamInvites.createdAt,
        invitedBy: teamInvites.invitedBy,
      })
      .from(teamInvites)
      .where(
        and(
          eq(teamInvites.companyId, companyId),
          isNull(teamInvites.acceptedAt),
        ),
      )
      .orderBy(teamInvites.createdAt);

    const now = new Date();
    const result = rows.map((r: any) => ({
      ...r,
      expired: r.expiresAt < now,
    }));

    return res.json(result);
  }),
);

/**
 * DELETE /api/v1/team/invites/:id
 * Revokes (deletes) an invite. Only the owning company can revoke it.
 */
router.delete(
  '/invites/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const inviteId = parseInt(req.params.id, 10);
    if (isNaN(inviteId)) {
      return res.status(400).json({ error: 'ID invalido' });
    }

    const [deleted] = await db
      .delete(teamInvites)
      .where(
        and(
          eq(teamInvites.id, inviteId),
          eq(teamInvites.companyId, companyId),
        ),
      )
      .returning({ id: teamInvites.id });

    if (!deleted) {
      return res.status(404).json({ error: 'Convite nao encontrado' });
    }

    logger.info({ inviteId, companyId }, 'Team invite revoked');
    return res.status(204).send();
  }),
);

// ─── Public routes ───────────────────────────────────────────────────────────

/**
 * GET /api/public/invite/:token
 * Validates the token and returns invite metadata (clinic name, role).
 * Used by the accept-invite frontend page before showing the registration form.
 */
router.get(
  '/public/invite/:token',
  publicTokenLimiter,
  asyncHandler(async (req, res) => {
    const { token } = req.params;

    const [invite] = await db
      .select()
      .from(teamInvites)
      .where(eq(teamInvites.token, token))
      .limit(1);

    if (!invite) {
      return res.status(404).json({ error: 'Convite invalido ou nao encontrado' });
    }

    if (invite.expiresAt < new Date()) {
      return res.status(410).json({ error: 'Este convite expirou' });
    }

    if (invite.acceptedAt) {
      return res.status(410).json({ error: 'Este convite ja foi utilizado' });
    }

    const [company] = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, invite.companyId))
      .limit(1);

    return res.json({
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      clinicName: company?.name ?? 'Clinica',
    });
  }),
);

/**
 * POST /api/public/invite/:token/accept
 * Creates the user account and marks the invite as accepted.
 *
 * Body: { fullName, password, username? }
 * The username defaults to the local-part of the email when omitted.
 */
router.post(
  '/public/invite/:token/accept',
  publicSubmitLimiter,
  asyncHandler(async (req, res) => {
    const { token } = req.params;

    const [invite] = await db
      .select()
      .from(teamInvites)
      .where(eq(teamInvites.token, token))
      .limit(1);

    if (!invite) {
      return res.status(404).json({ error: 'Convite invalido ou nao encontrado' });
    }

    if (invite.expiresAt < new Date()) {
      return res.status(410).json({ error: 'Este convite expirou' });
    }

    if (invite.acceptedAt) {
      return res.status(410).json({ error: 'Este convite ja foi utilizado' });
    }

    const parsed = acceptInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados invalidos', details: parsed.error.flatten() });
    }

    const { fullName, password } = parsed.data;

    // Derive a unique username: prefer supplied value, otherwise email local-part + suffix
    const emailLocalPart = invite.email.split('@')[0].replace(/[^a-z0-9_]/gi, '');
    let username = (parsed.data.username ?? emailLocalPart).toLowerCase();

    // Ensure username is unique within the company — append a random suffix if needed
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existing) {
      username = `${username}_${randomBytes(3).toString('hex')}`;
    }

    // Map invite role to internal user role
    const roleMap: Record<string, string> = {
      dentista: 'dentist',
      recepcionista: 'staff',
      assistente: 'staff',
      staff: 'staff',
      admin: 'admin',
    };
    const internalRole = roleMap[invite.role] ?? 'staff';

    const hashedPassword = await hashPassword(password);

    const [newUser] = await db
      .insert(users)
      .values({
        companyId: invite.companyId,
        username,
        password: hashedPassword,
        fullName,
        email: invite.email,
        role: internalRole,
        active: true,
      })
      .returning({ id: users.id, username: users.username, email: users.email, role: users.role });

    // Mark invite as accepted
    await db
      .update(teamInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(teamInvites.id, invite.id));

    logger.info(
      { userId: newUser.id, inviteId: invite.id, companyId: invite.companyId },
      'Team invite accepted — user created',
    );

    return res.status(201).json({
      success: true,
      message: 'Conta criada com sucesso. Voce ja pode fazer login.',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
      },
    });
  }),
);

export default router;
