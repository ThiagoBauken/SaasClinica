/**
 * SaaS Admin Routes — /api/saas/*
 *
 * Handles company management, user management, subscription and plan
 * administration for the SaaS platform. All routes require admin or
 * superadmin role (enforced via `adminOnly` middleware).
 */
import { Router } from 'express';
import { db } from '../db';
import { appointments, companies, subscriptions } from '@shared/schema';
import { eq, gt, and, notInArray, isNull, sql } from 'drizzle-orm';
import { authCheck, adminOnly, asyncHandler } from '../middleware/auth';
import { hashPassword } from '../auth';
import { z } from 'zod';
const router = Router();

// =====================================================
// COMPANY MANAGEMENT
// =====================================================

const createCompanySchema = z.object({
  name: z.string().min(1, 'Nome da empresa é obrigatório').max(255),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().max(20).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  cnpj: z
    .string()
    .regex(/^\d{14}$|^$/, 'CNPJ deve ter 14 dígitos ou estar vazio')
    .optional()
    .or(z.literal('')),
  active: z.boolean().optional().default(true),
});

/**
 * GET /api/saas/companies
 * Lista todas as empresas cadastradas no SaaS.
 */
router.get(
  '/companies',
  authCheck,
  adminOnly,
  asyncHandler(async (req, res) => {
    const result = await db.$client.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM company_modules WHERE company_id = c.id AND is_enabled = true) as module_count
      FROM companies c
      ORDER BY c.name
    `);
    res.json(result.rows);
  })
);

/**
 * POST /api/saas/companies
 * Cria uma nova empresa.
 */
router.post(
  '/companies',
  authCheck,
  adminOnly,
  asyncHandler(async (req, res) => {
    const validation = createCompanySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Erro de validação',
        details: validation.error.errors,
      });
    }

    const { name, email, phone, address, cnpj, active } = validation.data;

    const result = await db.$client.query(
      `INSERT INTO companies (name, email, phone, address, cnpj, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [name, email || null, phone || null, address || null, cnpj || null, active]
    );

    res.status(201).json(result.rows[0]);
  })
);

/**
 * GET /api/saas/companies/:companyId/modules
 * Lista todos os módulos disponíveis e o status de ativação para uma empresa.
 */
router.get(
  '/companies/:companyId/modules',
  authCheck,
  adminOnly,
  asyncHandler(async (req, res) => {
    const { companyId } = req.params;

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');

    const result = await db.$client.query(
      `SELECT
         m.id, m.name, m.display_name, m.description,
         COALESCE(cm.is_enabled, false) as enabled
       FROM modules m
       LEFT JOIN company_modules cm ON m.id = cm.module_id AND cm.company_id = $1
       ORDER BY m.display_name`,
      [companyId]
    );
    res.json(result.rows);
  })
);

/**
 * POST /api/saas/companies/:companyId/modules/:moduleId/toggle
 * Ativa ou desativa um módulo para uma empresa específica.
 */
router.post(
  '/companies/:companyId/modules/:moduleId/toggle',
  authCheck,
  adminOnly,
  asyncHandler(async (req, res) => {
    const { companyId, moduleId } = req.params;
    const { enabled } = req.body;

    await db.$client.query(
      `INSERT INTO company_modules (company_id, module_id, is_enabled, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (company_id, module_id)
       DO UPDATE SET is_enabled = $3, updated_at = NOW()`,
      [companyId, moduleId, !!enabled]
    );

    res.json({
      success: true,
      message: enabled ? 'Módulo ativado' : 'Módulo desativado',
    });
  })
);

// =====================================================
// USER MANAGEMENT
// =====================================================

/**
 * GET /api/saas/users
 * Lista todos os usuários de todas as empresas.
 */
router.get(
  '/users',
  authCheck,
  adminOnly,
  asyncHandler(async (req, res) => {
    const result = await db.$client.query(`
      SELECT
        u.id, u.username, u.full_name, u.email, u.phone, u.role,
        u.speciality, u.active, u.created_at, u.company_id,
        c.name as company_name
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  })
);

/**
 * POST /api/saas/users
 * Cria um novo usuário em uma empresa específica.
 */
router.post(
  '/users',
  authCheck,
  adminOnly,
  asyncHandler(async (req, res) => {
    const { companyId, username, password, fullName, role, email, phone } = req.body;

    if (!companyId || !username || !password || !fullName || !email) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }

    const hashedPassword = await hashPassword(password);

    const result = await db.$client.query(
      `INSERT INTO users (company_id, username, password, full_name, role, email, phone, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
       RETURNING id, username, full_name, email, phone, role, active, created_at`,
      [companyId, username, hashedPassword, fullName, role || 'staff', email, phone]
    );

    res.status(201).json(result.rows[0]);
  })
);

/**
 * PUT /api/saas/users/:userId
 * Atualiza dados de um usuário. Verifica agendamentos futuros antes de desativar.
 */
router.put(
  '/users/:userId',
  authCheck,
  adminOnly,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { fullName, email, phone, role, active } = req.body;
    const user = req.user!;
    const companyId = user.companyId;

    if (active === false) {
      const futureAppointments = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(appointments)
        .where(
          and(
            eq(appointments.professionalId, parseInt(userId)),
            eq(appointments.companyId, companyId),
            gt(appointments.startTime, new Date()),
            notInArray(appointments.status, ['cancelled', 'completed', 'no_show']),
            isNull(appointments.deletedAt)
          )
        );

      if (futureAppointments[0]?.count > 0) {
        return res.status(409).json({
          error: 'Este profissional tem agendamentos futuros',
          futureCount: futureAppointments[0].count,
          message: `Existem ${futureAppointments[0].count} agendamento(s) futuro(s). Reatribua ou cancele antes de remover este profissional.`,
          action: 'reassign_or_cancel',
        });
      }
    }

    const result = await db.$client.query(
      `UPDATE users
       SET full_name = COALESCE($1, full_name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           role = COALESCE($4, role),
           active = COALESCE($5, active),
           updated_at = NOW()
       WHERE id = $6
       RETURNING id, username, full_name, email, phone, role, active`,
      [fullName, email, phone, role, active, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(result.rows[0]);
  })
);

/**
 * DELETE /api/saas/users/:userId
 * Desativa um usuário (soft delete). Verifica agendamentos futuros antes.
 */
router.delete(
  '/users/:userId',
  authCheck,
  adminOnly,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const user = req.user!;
    const companyId = user.companyId;

    const futureAppointments = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(appointments)
      .where(
        and(
          eq(appointments.professionalId, parseInt(userId)),
          eq(appointments.companyId, companyId),
          gt(appointments.startTime, new Date()),
          notInArray(appointments.status, ['cancelled', 'completed', 'no_show']),
          isNull(appointments.deletedAt)
        )
      );

    if (futureAppointments[0]?.count > 0) {
      return res.status(409).json({
        error: 'Este profissional tem agendamentos futuros',
        futureCount: futureAppointments[0].count,
        message: `Existem ${futureAppointments[0].count} agendamento(s) futuro(s). Reatribua ou cancele antes de remover este profissional.`,
        action: 'reassign_or_cancel',
      });
    }

    const result = await db.$client.query(
      `UPDATE users SET active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({ success: true, message: 'Usuário desativado com sucesso' });
  })
);

/**
 * DELETE /api/saas/users/:userId/permanent
 * Remove um usuário permanentemente do banco de dados.
 */
router.delete(
  '/users/:userId/permanent',
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const result = await db.$client.query(
      `DELETE FROM users WHERE id = $1 RETURNING id`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({ success: true, message: 'Usuário deletado permanentemente' });
  })
);

/**
 * POST /api/saas/users/:userId/reset-password
 * Reseta a senha de um usuário.
 */
router.post(
  '/users/:userId/reset-password',
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: 'Nova senha é obrigatória' });
    }

    const hashedPassword = await hashPassword(newPassword);
    const result = await db.$client.query(
      `UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, full_name`,
      [hashedPassword, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({ success: true, message: 'Senha resetada com sucesso', user: result.rows[0] });
  })
);

// =====================================================
// SUBSCRIPTIONS, PLANS & INVOICES
// =====================================================

/**
 * GET /api/saas/subscriptions
 * Lista todas as assinaturas ativas.
 */
router.get(
  '/subscriptions',
  asyncHandler(async (req, res) => {
    const result = await db.$client.query(`
      SELECT
        s.id, s.status, s.billing_cycle, s.current_period_start,
        s.current_period_end, s.trial_ends_at, s.created_at,
        c.id as company_id, c.name as company_name, c.email as company_email,
        p.id as plan_id, p.name as plan_name, p.display_name as plan_display_name,
        p.monthly_price, p.yearly_price
      FROM subscriptions s
      LEFT JOIN companies c ON s.company_id = c.id
      LEFT JOIN plans p ON s.plan_id = p.id
      ORDER BY s.created_at DESC
    `);
    res.json(result.rows);
  })
);

/**
 * GET /api/saas/plans
 * Lista todos os planos disponíveis e ativos.
 */
router.get(
  '/plans',
  asyncHandler(async (req, res) => {
    const result = await db.$client.query(`
      SELECT
        id, name, display_name, description, monthly_price, yearly_price,
        trial_days, max_users, max_patients, max_appointments_per_month,
        max_automations, max_storage_gb, features, is_active, is_popular, sort_order
      FROM plans
      WHERE is_active = true
      ORDER BY sort_order ASC, monthly_price ASC
    `);
    res.json(result.rows);
  })
);

/**
 * GET /api/saas/invoices
 * Lista todas as faturas.
 */
router.get(
  '/invoices',
  asyncHandler(async (req, res) => {
    const result = await db.$client.query(`
      SELECT
        i.id, i.amount, i.status, i.due_date, i.paid_at, i.payment_method,
        i.invoice_url, i.created_at,
        c.id as company_id, c.name as company_name, c.email as company_email,
        s.id as subscription_id
      FROM subscription_invoices i
      LEFT JOIN companies c ON i.company_id = c.id
      LEFT JOIN subscriptions s ON i.subscription_id = s.id
      ORDER BY i.created_at DESC
    `);
    res.json(result.rows);
  })
);

export default router;
