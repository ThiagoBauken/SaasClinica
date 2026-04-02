import { Router, Request, Response } from 'express';
import { db } from '../db';
import { companies, subscriptions, plans, subscriptionInvoices } from '@shared/schema';
import { eq, sql, desc, and } from 'drizzle-orm';
import { authCheck, asyncHandler } from '../middleware/auth';
import { hashPassword } from '../auth';
import { z } from 'zod';

const router = Router();

/**
 * Middleware: somente superadmin tem acesso
 */
const superadminOnly = (req: Request, res: Response, next: any) => {
  const user = req.user as any;
  if (!user || user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Acesso negado. Apenas superadmin.' });
  }
  next();
};

// Aplicar auth + superadmin em todas as rotas
router.use(authCheck, superadminOnly);

// =============================================
// DASHBOARD / STATS
// =============================================

/**
 * GET /api/superadmin/dashboard
 * Retorna estatísticas gerais do SaaS
 */
router.get('/dashboard', asyncHandler(async (_req: Request, res: Response) => {
  const [companiesResult, usersResult, subscriptionsResult, revenueResult, recentCompaniesResult, activeUsersResult] = await Promise.all([
    // Total de empresas e empresas ativas
    db.$client.query(`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE active = true)::int as active,
        COUNT(*) FILTER (WHERE active = false)::int as inactive,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int as new_last_30_days
      FROM companies
    `),
    // Total de usuários
    db.$client.query(`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE active = true)::int as active,
        COUNT(*) FILTER (WHERE role = 'admin')::int as admins,
        COUNT(*) FILTER (WHERE role = 'dentist')::int as dentists,
        COUNT(*) FILTER (WHERE role = 'staff')::int as staff,
        COUNT(*) FILTER (WHERE role = 'superadmin')::int as superadmins
      FROM users
    `),
    // Assinaturas por status
    db.$client.query(`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'active')::int as active,
        COUNT(*) FILTER (WHERE status = 'trial')::int as trial,
        COUNT(*) FILTER (WHERE status = 'past_due')::int as past_due,
        COUNT(*) FILTER (WHERE status = 'canceled')::int as canceled,
        COUNT(*) FILTER (WHERE status = 'expired')::int as expired
      FROM subscriptions
    `),
    // Receita
    db.$client.query(`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0)::numeric as total_revenue,
        COALESCE(SUM(amount) FILTER (WHERE status = 'paid' AND paid_at >= NOW() - INTERVAL '30 days'), 0)::numeric as revenue_last_30_days,
        COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0)::numeric as pending_amount,
        COUNT(*) FILTER (WHERE status = 'failed')::int as failed_payments
      FROM subscription_invoices
    `),
    // Empresas recentes
    db.$client.query(`
      SELECT id, name, email, active, created_at
      FROM companies
      ORDER BY created_at DESC
      LIMIT 5
    `),
    // Usuários ativos recentemente (últimos 7 dias)
    db.$client.query(`
      SELECT COUNT(DISTINCT company_id)::int as active_companies_7d
      FROM users
      WHERE active = true AND updated_at >= NOW() - INTERVAL '7 days'
    `)
  ]);

  res.json({
    companies: companiesResult.rows[0],
    users: usersResult.rows[0],
    subscriptions: subscriptionsResult.rows[0],
    revenue: revenueResult.rows[0],
    recentCompanies: recentCompaniesResult.rows,
    activeCompanies7d: activeUsersResult.rows[0]?.active_companies_7d || 0
  });
}));

// =============================================
// EMPRESAS (COMPANIES)
// =============================================

const companySchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(255),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().max(20).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  cnpj: z.string().regex(/^\d{14}$|^$/, 'CNPJ deve ter 14 dígitos').optional().or(z.literal('')),
});

/**
 * GET /api/superadmin/companies
 */
router.get('/companies', asyncHandler(async (_req: Request, res: Response) => {
  const result = await db.$client.query(`
    SELECT
      c.id, c.name, c.cnpj, c.email, c.phone, c.address, c.active, c.created_at,
      (SELECT COUNT(*)::int FROM company_modules WHERE company_id = c.id AND is_enabled = true) as module_count,
      (SELECT COUNT(*)::int FROM users WHERE company_id = c.id AND active = true) as user_count,
      (SELECT COUNT(*)::int FROM patients WHERE company_id = c.id) as patient_count,
      s.status as subscription_status,
      p.display_name as plan_name
    FROM companies c
    LEFT JOIN subscriptions s ON s.company_id = c.id
    LEFT JOIN plans p ON s.plan_id = p.id
    ORDER BY c.created_at DESC
  `);
  res.json(result.rows);
}));

/**
 * POST /api/superadmin/companies
 */
router.post('/companies', asyncHandler(async (req: Request, res: Response) => {
  const validation = companySchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: 'Validação falhou', details: validation.error.errors });
  }

  const { name, email, phone, address, cnpj } = validation.data;

  const result = await db.$client.query(`
    INSERT INTO companies (name, email, phone, address, cnpj, active, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
    RETURNING *
  `, [name, email || null, phone || null, address || null, cnpj || null]);

  res.status(201).json(result.rows[0]);
}));

/**
 * PUT /api/superadmin/companies/:id
 */
router.put('/companies/:id', asyncHandler(async (req: Request, res: Response) => {
  const companyId = parseInt(req.params.id);
  const { name, email, phone, address, cnpj, active } = req.body;

  const result = await db.$client.query(`
    UPDATE companies
    SET name = COALESCE($1, name),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone),
        address = COALESCE($4, address),
        cnpj = COALESCE($5, cnpj),
        active = COALESCE($6, active),
        updated_at = NOW()
    WHERE id = $7
    RETURNING *
  `, [name, email, phone, address, cnpj, active, companyId]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Empresa não encontrada' });
  }

  res.json(result.rows[0]);
}));

/**
 * DELETE /api/superadmin/companies/:id (soft delete - desativa)
 */
router.delete('/companies/:id', asyncHandler(async (req: Request, res: Response) => {
  const companyId = parseInt(req.params.id);

  const result = await db.$client.query(`
    UPDATE companies SET active = false, updated_at = NOW()
    WHERE id = $1 RETURNING id, name
  `, [companyId]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Empresa não encontrada' });
  }

  res.json({ success: true, message: `Empresa ${result.rows[0].name} desativada` });
}));

// =============================================
// MÓDULOS POR EMPRESA
// =============================================

/**
 * GET /api/superadmin/companies/:id/modules
 */
router.get('/companies/:id/modules', asyncHandler(async (req: Request, res: Response) => {
  const companyId = parseInt(req.params.id);

  const result = await db.$client.query(`
    SELECT
      m.id, m.name, m.display_name, m.description,
      COALESCE(cm.is_enabled, false) as is_enabled
    FROM modules m
    LEFT JOIN company_modules cm ON m.id = cm.module_id AND cm.company_id = $1
    ORDER BY m.display_name
  `, [companyId]);

  res.json(result.rows);
}));

/**
 * POST /api/superadmin/companies/:id/modules/:moduleId/toggle
 */
router.post('/companies/:id/modules/:moduleId/toggle', asyncHandler(async (req: Request, res: Response) => {
  const companyId = parseInt(req.params.id);
  const moduleId = req.params.moduleId;
  const { enabled } = req.body;

  // moduleId pode ser o ID numérico ou o name do módulo
  let dbModuleId = parseInt(moduleId);

  if (isNaN(dbModuleId)) {
    // Buscar pelo name
    const moduleResult = await db.$client.query(
      `SELECT id FROM modules WHERE name = $1`, [moduleId]
    );
    if (moduleResult.rows.length === 0) {
      return res.status(404).json({ error: `Módulo '${moduleId}' não encontrado` });
    }
    dbModuleId = moduleResult.rows[0].id;
  }

  await db.$client.query(`
    INSERT INTO company_modules (company_id, module_id, is_enabled, created_at, updated_at)
    VALUES ($1, $2, $3, NOW(), NOW())
    ON CONFLICT (company_id, module_id)
    DO UPDATE SET is_enabled = $3, updated_at = NOW()
  `, [companyId, dbModuleId, enabled]);

  res.json({ success: true, companyId, moduleId, enabled });
}));

// =============================================
// USUÁRIOS
// =============================================

/**
 * GET /api/superadmin/users
 */
router.get('/users', asyncHandler(async (_req: Request, res: Response) => {
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
}));

/**
 * POST /api/superadmin/users
 */
router.post('/users', asyncHandler(async (req: Request, res: Response) => {
  const { companyId, username, password, fullName, role, email, phone } = req.body;

  if (!companyId || !username || !password || !fullName || !email) {
    return res.status(400).json({ error: 'Campos obrigatórios: companyId, username, password, fullName, email' });
  }

  // Verificar username duplicado
  const existing = await db.$client.query(`SELECT id FROM users WHERE username = $1`, [username]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Username já existe' });
  }

  const hashedPassword = await hashPassword(password);

  const result = await db.$client.query(`
    INSERT INTO users (company_id, username, password, full_name, role, email, phone, active, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
    RETURNING id, username, full_name, email, phone, role, active, created_at, company_id
  `, [companyId, username, hashedPassword, fullName, role || 'staff', email, phone]);

  res.status(201).json(result.rows[0]);
}));

/**
 * PUT /api/superadmin/users/:id
 */
router.put('/users/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = parseInt(req.params.id);
  const { fullName, email, phone, role, active, companyId } = req.body;

  const result = await db.$client.query(`
    UPDATE users
    SET full_name = COALESCE($1, full_name),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone),
        role = COALESCE($4, role),
        active = COALESCE($5, active),
        company_id = COALESCE($6, company_id),
        updated_at = NOW()
    WHERE id = $7
    RETURNING id, username, full_name, email, phone, role, active, company_id
  `, [fullName, email, phone, role, active, companyId, userId]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  res.json(result.rows[0]);
}));

/**
 * DELETE /api/superadmin/users/:id (soft delete)
 */
router.delete('/users/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = parseInt(req.params.id);

  const result = await db.$client.query(`
    UPDATE users SET active = false, updated_at = NOW()
    WHERE id = $1 RETURNING id, full_name
  `, [userId]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  res.json({ success: true, message: `Usuário ${result.rows[0].full_name} desativado` });
}));

/**
 * DELETE /api/superadmin/users/:id/permanent
 */
router.delete('/users/:id/permanent', asyncHandler(async (req: Request, res: Response) => {
  const userId = parseInt(req.params.id);

  // Não permitir deletar superadmins
  const check = await db.$client.query(`SELECT role FROM users WHERE id = $1`, [userId]);
  if (check.rows.length === 0) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }
  if (check.rows[0].role === 'superadmin') {
    return res.status(403).json({ error: 'Não é possível deletar um superadmin' });
  }

  await db.$client.query(`DELETE FROM users WHERE id = $1`, [userId]);
  res.json({ success: true, message: 'Usuário deletado permanentemente' });
}));

/**
 * POST /api/superadmin/users/:id/reset-password
 */
router.post('/users/:id/reset-password', asyncHandler(async (req: Request, res: Response) => {
  const userId = parseInt(req.params.id);
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres' });
  }

  const hashedPassword = await hashPassword(newPassword);
  const result = await db.$client.query(`
    UPDATE users SET password = $1, updated_at = NOW()
    WHERE id = $2 RETURNING id, username, full_name
  `, [hashedPassword, userId]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  res.json({ success: true, message: 'Senha resetada com sucesso', user: result.rows[0] });
}));

// =============================================
// ASSINATURAS
// =============================================

/**
 * GET /api/superadmin/subscriptions
 */
router.get('/subscriptions', asyncHandler(async (_req: Request, res: Response) => {
  const result = await db.$client.query(`
    SELECT
      s.id, s.status, s.billing_cycle, s.current_period_start,
      s.current_period_end, s.trial_ends_at, s.canceled_at, s.created_at,
      c.id as company_id, c.name as company_name, c.email as company_email,
      p.id as plan_id, p.name as plan_name, p.display_name as plan_display_name,
      p.monthly_price, p.yearly_price
    FROM subscriptions s
    LEFT JOIN companies c ON s.company_id = c.id
    LEFT JOIN plans p ON s.plan_id = p.id
    ORDER BY s.created_at DESC
  `);
  res.json(result.rows);
}));

/**
 * PUT /api/superadmin/subscriptions/:id
 * Alterar plano ou status de uma assinatura
 */
router.put('/subscriptions/:id', asyncHandler(async (req: Request, res: Response) => {
  const subId = parseInt(req.params.id);
  const { planId, status, billingCycle } = req.body;

  const result = await db.$client.query(`
    UPDATE subscriptions
    SET plan_id = COALESCE($1, plan_id),
        status = COALESCE($2, status),
        billing_cycle = COALESCE($3, billing_cycle),
        updated_at = NOW()
    WHERE id = $4
    RETURNING *
  `, [planId, status, billingCycle, subId]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Assinatura não encontrada' });
  }

  res.json(result.rows[0]);
}));

/**
 * POST /api/superadmin/subscriptions
 * Criar assinatura para empresa
 */
router.post('/subscriptions', asyncHandler(async (req: Request, res: Response) => {
  const { companyId, planId, billingCycle, status } = req.body;

  if (!companyId || !planId) {
    return res.status(400).json({ error: 'companyId e planId são obrigatórios' });
  }

  // Verificar se empresa já tem assinatura
  const existing = await db.$client.query(
    `SELECT id FROM subscriptions WHERE company_id = $1`, [companyId]
  );
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Empresa já possui uma assinatura. Use PUT para alterar.' });
  }

  // Buscar dados do plano para trial_days
  const planResult = await db.$client.query(`SELECT trial_days FROM plans WHERE id = $1`, [planId]);
  const trialDays = planResult.rows[0]?.trial_days || 7;

  const result = await db.$client.query(`
    INSERT INTO subscriptions (company_id, plan_id, status, billing_cycle, current_period_start, current_period_end, trial_ends_at, created_at, updated_at)
    VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '30 days', NOW() + ($5 || ' days')::interval, NOW(), NOW())
    RETURNING *
  `, [companyId, planId, status || 'trial', billingCycle || 'monthly', trialDays.toString()]);

  res.status(201).json(result.rows[0]);
}));

// =============================================
// PLANOS
// =============================================

/**
 * GET /api/superadmin/plans
 */
router.get('/plans', asyncHandler(async (_req: Request, res: Response) => {
  const result = await db.$client.query(`
    SELECT
      id, name, display_name, description, monthly_price, yearly_price,
      trial_days, max_users, max_patients, max_appointments_per_month,
      max_automations, max_storage_gb, features, is_active, is_popular, sort_order
    FROM plans
    ORDER BY sort_order ASC, monthly_price ASC
  `);
  res.json(result.rows);
}));

/**
 * PUT /api/superadmin/plans/:id
 */
router.put('/plans/:id', asyncHandler(async (req: Request, res: Response) => {
  const planId = parseInt(req.params.id);
  const { displayName, description, monthlyPrice, yearlyPrice, trialDays,
    maxUsers, maxPatients, maxAppointmentsPerMonth, maxAutomations, maxStorageGb,
    isActive, isPopular, sortOrder } = req.body;

  const result = await db.$client.query(`
    UPDATE plans
    SET display_name = COALESCE($1, display_name),
        description = COALESCE($2, description),
        monthly_price = COALESCE($3, monthly_price),
        yearly_price = COALESCE($4, yearly_price),
        trial_days = COALESCE($5, trial_days),
        max_users = COALESCE($6, max_users),
        max_patients = COALESCE($7, max_patients),
        max_appointments_per_month = COALESCE($8, max_appointments_per_month),
        max_automations = COALESCE($9, max_automations),
        max_storage_gb = COALESCE($10, max_storage_gb),
        is_active = COALESCE($11, is_active),
        is_popular = COALESCE($12, is_popular),
        sort_order = COALESCE($13, sort_order),
        updated_at = NOW()
    WHERE id = $14
    RETURNING *
  `, [displayName, description, monthlyPrice, yearlyPrice, trialDays,
    maxUsers, maxPatients, maxAppointmentsPerMonth, maxAutomations, maxStorageGb,
    isActive, isPopular, sortOrder, planId]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Plano não encontrado' });
  }

  res.json(result.rows[0]);
}));

// =============================================
// FATURAS
// =============================================

/**
 * GET /api/superadmin/invoices
 */
router.get('/invoices', asyncHandler(async (_req: Request, res: Response) => {
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
}));

/**
 * PUT /api/superadmin/invoices/:id
 * Marcar fatura como paga/pendente/etc
 */
router.put('/invoices/:id', asyncHandler(async (req: Request, res: Response) => {
  const invoiceId = parseInt(req.params.id);
  const { status, paymentMethod } = req.body;

  const paidAt = status === 'paid' ? 'NOW()' : 'NULL';

  const result = await db.$client.query(`
    UPDATE subscription_invoices
    SET status = COALESCE($1, status),
        payment_method = COALESCE($2, payment_method),
        paid_at = ${status === 'paid' ? 'NOW()' : 'paid_at'},
        updated_at = NOW()
    WHERE id = $3
    RETURNING *
  `, [status, paymentMethod, invoiceId]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Fatura não encontrada' });
  }

  res.json(result.rows[0]);
}));

// =============================================
// LOGS DE AUDITORIA
// =============================================

/**
 * GET /api/superadmin/audit-logs
 */
router.get('/audit-logs', asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;

  const result = await db.$client.query(`
    SELECT
      al.id, al.action, al.entity_type, al.entity_id, al.details,
      al.ip_address, al.created_at,
      u.full_name as user_name, u.email as user_email,
      c.name as company_name
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    LEFT JOIN companies c ON al.company_id = c.id
    ORDER BY al.created_at DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset]);

  const countResult = await db.$client.query(`SELECT COUNT(*)::int as total FROM audit_logs`);

  res.json({
    data: result.rows,
    total: countResult.rows[0].total,
    limit,
    offset
  });
}));

export default router;
