import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage, DatabaseStorage } from "./storage";
import { setupAuth, hashPassword } from "./auth";
import { parse, formatISO, addDays } from "date-fns";
import { cacheMiddleware } from "./simpleCache";
import { invalidateClusterCache } from "./clusterCache";
import { db } from "./db";
import { clinicSettings, fiscalSettings, permissions, userPermissions, commissionSettings, procedureCommissions, machineTaxes, companies, appointments, patients, subscriptions, payments } from "@shared/schema";
import * as paymentHandlers from "./payments";
import * as clinicHandlers from "./clinic-apis";
import * as backupHandlers from "./backup";
import * as websiteHandlers from "./website-apis";
import * as dashboardHandlers from "./dashboard-apis";
import * as financialHandlers from "./financial-apis";
import * as patientRecordsHandlers from "./patient-records-apis";
import * as odontogramHandlers from "./odontogram-apis";
import * as calendarHandlers from "./calendar-apis";
import { queueApi } from "./queue";
import { billingApi, checkPatientsLimit, checkUsersLimit, checkAppointmentsLimit, registerStripeRoutes } from "./billing";
import { eq, desc, sql } from "drizzle-orm";
import { tenantIsolationMiddleware, resourceAccessMiddleware } from "./tenantMiddleware";
import { createDefaultCompany, migrateUsersToDefaultCompany } from "./seedCompany";
import { requireModulePermission, getUserModulePermissions, grantModulePermission } from "./permissions";
import { moduleRegistry } from "../modules/index";
import { registerProtesesRoutes } from "./modules/clinica/proteses";
import { registerModularRoutes } from "./routes/index";
import { notificationService } from "./services/notificationService";
import { authCheck, adminOnly, asyncHandler, tenantAwareAuth } from "./middleware/auth";
import { rlsMiddleware } from "./middleware/rls";
import { z } from "zod";
import multer from "multer";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize database with seed data if needed
  if (storage instanceof DatabaseStorage) {
    await storage.seedInitialData();
    // Criar empresa padrão e migrar usuários existentes
    await migrateUsersToDefaultCompany();
  }

  // Set up authentication routes
  setupAuth(app);

  // RLS: set app.current_company_id for every request so PostgreSQL
  // Row-Level Security policies can enforce tenant isolation at the DB level.
  // Must come after setupAuth so req.user is populated by Passport.
  app.use(rlsMiddleware);

  // Register new modular routes (v1 API with validation and pagination)
  registerModularRoutes(app);

  // === APIs DE MÓDULOS (COM AUTENTICAÇÃO) ===
  app.get("/api/user/modules", authCheck, asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    if (!user?.companyId) {
      return res.status(403).json({ error: "User not associated with any company" });
    }
    const companyId = user.companyId;
    const activeModules = await db.$client.query(`
      SELECT 
        m.id, m.name, m.display_name, m.description,
        CASE WHEN cm.is_enabled = true THEN '["admin"]'::jsonb ELSE '[]'::jsonb END as permissions
      FROM modules m
      LEFT JOIN company_modules cm ON m.id = cm.module_id AND cm.company_id = $1
      WHERE cm.is_enabled = true
      ORDER BY m.display_name
    `, [companyId]);
    res.json(activeModules.rows);
  }));

  app.get("/api/clinic/modules", asyncHandler(async (req: Request, res: Response) => {
    const modules = moduleRegistry.getAllModules();
    const modulesByCategory = moduleRegistry.getModulesByCategory();
    res.json({
      all: modules,
      byCategory: modulesByCategory,
      loaded: modules.length
    });
  }));

  // === ROTAS SaaS (COM AUTENTICAÇÃO ADMIN) ===
  // Listar todas as empresas
  app.get("/api/saas/companies", authCheck, adminOnly, asyncHandler(async (req: Request, res: Response) => {
    const result = await db.$client.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM company_modules WHERE company_id = c.id AND is_enabled = true) as module_count
      FROM companies c
      ORDER BY c.name
    `);
    res.json(result.rows);
  }));

  // Schema de validação para criação de empresa
  const createCompanySchema = z.object({
    name: z.string().min(1, "Nome da empresa é obrigatório").max(255),
    email: z.string().email("Email inválido").optional().or(z.literal("")),
    phone: z.string().max(20).optional().or(z.literal("")),
    address: z.string().max(500).optional().or(z.literal("")),
    cnpj: z.string().regex(/^\d{14}$|^$/, "CNPJ deve ter 14 dígitos ou estar vazio").optional().or(z.literal("")),
    active: z.boolean().optional().default(true),
  });

  // Criar nova empresa
  app.post("/api/saas/companies", authCheck, adminOnly, asyncHandler(async (req: Request, res: Response) => {
    // Validação com Zod
    const validation = createCompanySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Erro de validação',
        details: validation.error.errors
      });
    }

    const { name, email, phone, address, cnpj, active } = validation.data;

    const result = await db.$client.query(`
      INSERT INTO companies (name, email, phone, address, cnpj, active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
    `, [name, email || null, phone || null, address || null, cnpj || null, active]);

    res.status(201).json(result.rows[0]);
  }));

  app.get("/api/saas/companies/:companyId/modules", authCheck, adminOnly, asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req.params;

    // Desabilitar cache para esta rota
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');

    const result = await db.$client.query(`
      SELECT
        m.id, m.name, m.display_name, m.description,
        COALESCE(cm.is_enabled, false) as enabled
      FROM modules m
      LEFT JOIN company_modules cm ON m.id = cm.module_id AND cm.company_id = $1
      ORDER BY m.display_name
    `, [companyId]);
    res.json(result.rows);
  }));

  app.post("/api/saas/companies/:companyId/modules/:moduleId/toggle", authCheck, adminOnly, asyncHandler(async (req: Request, res: Response) => {
    const { companyId, moduleId } = req.params;
    const { enabled } = req.body;

    const query = `INSERT INTO company_modules (company_id, module_id, is_enabled, created_at, updated_at)
                   VALUES ($1, $2, $3, NOW(), NOW())
                   ON CONFLICT (company_id, module_id)
                   DO UPDATE SET is_enabled = $3, updated_at = NOW()`;

    await db.$client.query(query, [companyId, moduleId, !!enabled]);
    res.json({ success: true, message: enabled ? 'Módulo ativado' : 'Módulo desativado' });
  }));

  // === ROTAS DE GERENCIAMENTO DE USUÁRIOS SaaS ===
  // Listar todos os usuários do SaaS (todas as empresas)
  app.get("/api/saas/users", authCheck, adminOnly, asyncHandler(async (req: Request, res: Response) => {
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

  // Criar novo usuário
  app.post("/api/saas/users", authCheck, adminOnly, asyncHandler(async (req: Request, res: Response) => {
    const { companyId, username, password, fullName, role, email, phone } = req.body;

    // Validação básica
    if (!companyId || !username || !password || !fullName || !email) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }

    // Hash da senha usando scrypt
    const hashedPassword = await hashPassword(password);

    const result = await db.$client.query(`
      INSERT INTO users (company_id, username, password, full_name, role, email, phone, active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
      RETURNING id, username, full_name, email, phone, role, active, created_at
    `, [companyId, username, hashedPassword, fullName, role || 'staff', email, phone]);

    res.status(201).json(result.rows[0]);
  }));

  // Atualizar usuário
  app.put("/api/saas/users/:userId", authCheck, adminOnly, asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { fullName, email, phone, role, active } = req.body;

    const result = await db.$client.query(`
      UPDATE users
      SET full_name = COALESCE($1, full_name),
          email = COALESCE($2, email),
          phone = COALESCE($3, phone),
          role = COALESCE($4, role),
          active = COALESCE($5, active),
          updated_at = NOW()
      WHERE id = $6
      RETURNING id, username, full_name, email, phone, role, active
    `, [fullName, email, phone, role, active, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(result.rows[0]);
  }));

  // Desativar/deletar usuário
  app.delete("/api/saas/users/:userId", authCheck, adminOnly, asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    const result = await db.$client.query(`
      UPDATE users
      SET active = false, updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({ success: true, message: 'Usuário desativado com sucesso' });
  }));

  // Deletar usuário permanentemente
  app.delete("/api/saas/users/:userId/permanent", asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    const result = await db.$client.query(`
      DELETE FROM users
      WHERE id = $1
      RETURNING id
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({ success: true, message: 'Usuário deletado permanentemente' });
  }));

  // Resetar senha de usuário
  app.post("/api/saas/users/:userId/reset-password", asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: 'Nova senha é obrigatória' });
    }

    // Hash da senha usando scrypt
    const hashedPassword = await hashPassword(newPassword);
    const result = await db.$client.query(`
      UPDATE users
      SET password = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, username, full_name
    `, [hashedPassword, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({ success: true, message: 'Senha resetada com sucesso', user: result.rows[0] });
  }));

  // === ROTAS DE ASSINATURAS E PLANOS SaaS ===
  // Listar todas as assinaturas
  app.get("/api/saas/subscriptions", asyncHandler(async (req: Request, res: Response) => {
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
  }));

  // Listar todos os planos disponíveis
  app.get("/api/saas/plans", asyncHandler(async (req: Request, res: Response) => {
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
  }));

  // Listar todas as faturas
  app.get("/api/saas/invoices", asyncHandler(async (req: Request, res: Response) => {
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

  // Company info for current user
  app.get("/api/user/company", authCheck, asyncHandler(async (req, res) => {
    const user = req.user as any;
    if (!user.companyId) {
      return res.status(404).json({ message: "User not associated with company" });
    }
    
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, user.companyId));
    
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }
    
    res.json(company);
  }));

  // === ROTAS DE ADMINISTRAÇÃO SaaS ===
  // (Rotas movidas para testRoutes.ts temporariamente)

  // === ROTAS DE ADMINISTRAÇÃO DA CLÍNICA (Admin da Empresa) ===
  // Para gerenciar usuários e permissões dentro da empresa
  app.get("/api/admin/users", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    const result = await db.$client.query(`
      SELECT id, username, full_name, email, phone, role, speciality, active, created_at
      FROM users
      WHERE company_id = $1
        AND deleted_at IS NULL
      ORDER BY full_name
    `, [user.companyId]);
    
    res.json(result.rows);
  }));

  app.get("/api/admin/users/:userId/permissions", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    const { userId } = req.params;
    const permissions = await getUserModulePermissions(parseInt(userId), user.companyId);
    res.json(permissions);
  }));

  app.post("/api/admin/users/:userId/permissions", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    const { userId } = req.params;
    const { moduleName, permissions } = req.body;
    
    const success = await grantModulePermission(
      parseInt(userId), 
      user.companyId, 
      moduleName, 
      permissions, 
      user.id
    );
    
    if (success) {
      res.json({ message: "Permissions updated successfully" });
    } else {
      res.status(500).json({ message: "Failed to update permissions" });
    }
  }));

  // === ROTAS DE DASHBOARD ===
  app.get("/api/dashboard/stats", tenantAwareAuth, asyncHandler(dashboardHandlers.getDashboardStats));
  app.get("/api/dashboard/appointments-week", tenantAwareAuth, asyncHandler(dashboardHandlers.getWeeklyAppointments));
  app.get("/api/dashboard/revenue-monthly", tenantAwareAuth, asyncHandler(dashboardHandlers.getMonthlyRevenue));
  app.get("/api/dashboard/procedures-distribution", tenantAwareAuth, asyncHandler(dashboardHandlers.getProceduresDistribution));
  app.get("/api/recent-activities", tenantAwareAuth, asyncHandler(dashboardHandlers.getRecentActivities));

  // === ROTAS FINANCEIRAS ===
  app.get("/api/transactions", tenantAwareAuth, asyncHandler(financialHandlers.getTransactions));
  app.post("/api/transactions", tenantAwareAuth, asyncHandler(financialHandlers.createTransaction));
  app.patch("/api/transactions/:id", tenantAwareAuth, asyncHandler(financialHandlers.updateTransaction));
  app.get("/api/financial/revenue-by-month", tenantAwareAuth, asyncHandler(financialHandlers.getRevenueByMonth));
  app.get("/api/financial/revenue-by-type", tenantAwareAuth, asyncHandler(financialHandlers.getRevenueByType));

  // === ROTAS DE PRONTUÁRIO DO PACIENTE ===
  app.get("/api/patients/:patientId/records", tenantAwareAuth, asyncHandler(patientRecordsHandlers.getPatientRecords));
  app.post("/api/patients/:patientId/records", tenantAwareAuth, asyncHandler(patientRecordsHandlers.createPatientRecord));
  app.put("/api/patients/:patientId/records/:recordId", tenantAwareAuth, asyncHandler(patientRecordsHandlers.updatePatientRecord));
  app.delete("/api/patients/:patientId/records/:recordId", tenantAwareAuth, asyncHandler(patientRecordsHandlers.deletePatientRecord));

  // === ROTAS DE ODONTOGRAMA ===
  app.get("/api/patients/:patientId/odontogram", tenantAwareAuth, asyncHandler(odontogramHandlers.getPatientOdontogram));
  app.post("/api/patients/:patientId/odontogram", tenantAwareAuth, asyncHandler(odontogramHandlers.saveToothStatus));
  app.get("/api/patients/:patientId/odontogram/tooth/:toothId/history", tenantAwareAuth, asyncHandler(odontogramHandlers.getToothHistory));
  app.delete("/api/patients/:patientId/odontogram/:entryId", tenantAwareAuth, asyncHandler(odontogramHandlers.deleteToothStatus));

  // === ROTAS DE CALENDÁRIO ===
  app.get("/api/calendar/occupation-status", tenantAwareAuth, asyncHandler(calendarHandlers.getOccupationStatus));
  app.get("/api/appointments/stats/procedures", tenantAwareAuth, asyncHandler(calendarHandlers.getProcedureStats));

  // === ROTAS DE MONITORAMENTO DE FILAS ===
  app.get("/api/queue/health", authCheck, asyncHandler(queueApi.getQueueHealth));
  app.get("/api/queue/stats", authCheck, asyncHandler(queueApi.getQueueStats));
  app.get("/api/queue/:queueName/jobs", authCheck, asyncHandler(queueApi.getQueueJobs));
  app.post("/api/queue/:queueName/retry/:jobId", authCheck, asyncHandler(queueApi.retryJob));
  app.post("/api/queue/:queueName/clean", authCheck, asyncHandler(queueApi.cleanQueue));

  // === ROTAS DE BILLING E ASSINATURAS ===
  // Wrapped com try-catch para tabelas que podem não existir ainda
  app.get("/api/billing/plans", asyncHandler(async (req, res) => {
    try {
      await billingApi.getPlans(req, res);
    } catch (error: any) {
      console.error('Error fetching plans:', error);
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return res.json([]);
      }
      throw error;
    }
  }));

  app.get("/api/billing/subscription", authCheck, asyncHandler(async (req, res) => {
    try {
      await billingApi.getMySubscription(req, res);
    } catch (error: any) {
      console.error('Error fetching subscription:', error);
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return res.status(404).json({ error: 'Subscription not found - tables may not exist' });
      }
      throw error;
    }
  }));

  app.post("/api/billing/subscription", authCheck, asyncHandler(billingApi.createSubscription));
  app.put("/api/billing/subscription/plan", authCheck, asyncHandler(billingApi.changePlan));
  app.delete("/api/billing/subscription", authCheck, asyncHandler(billingApi.cancelSubscription));

  app.get("/api/billing/invoices", authCheck, asyncHandler(async (req, res) => {
    try {
      await billingApi.getInvoices(req, res);
    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return res.json([]);
      }
      throw error;
    }
  }));

  app.get("/api/billing/usage", authCheck, asyncHandler(async (req, res) => {
    try {
      await billingApi.getUsage(req, res);
    } catch (error: any) {
      console.error('Error fetching usage:', error);
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return res.json({ usage: [], limits: {} });
      }
      throw error;
    }
  }));

  app.get("/api/billing/check-limit/:metricType", authCheck, asyncHandler(billingApi.checkLimit));

  // Registrar rotas do Stripe (webhook + checkout)
  registerStripeRoutes(app);

  // === ROTAS DE USUÁRIO NORMAL ===
  // Esta rota foi movida para a seção de APIs de módulos mais abaixo

  // Patients - Com cache otimizado e tenant-aware
  app.get("/api/patients", tenantAwareAuth, cacheMiddleware(300), asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;
    if (!companyId) return res.status(403).json({ error: "User not associated with any company" });
    try {
      const patients = await storage.getPatients(companyId);
      res.json(patients);
    } catch (error: any) {
      console.error('Error fetching patients:', error);
      // Se a tabela não existe, retornar array vazio
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return res.json([]);
      }
      throw error;
    }
  }));

  app.get("/api/patients/:id", authCheck, cacheMiddleware(300), asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;
    if (!companyId) return res.status(403).json({ error: "User not associated with any company" });
    const patient = await storage.getPatient(parseInt(req.params.id), companyId);
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }
    res.json(patient);
  }));

  app.post("/api/patients", authCheck, checkPatientsLimit, asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;
    if (!companyId) return res.status(403).json({ error: "User not associated with any company" });
    const patient = await storage.createPatient(req.body, companyId);
    // Invalida o cache relacionado a pacientes em todos os workers
    invalidateClusterCache('api:/api/patients');
    res.status(201).json(patient);
  }));

  app.patch("/api/patients/:id", authCheck, asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;
    if (!companyId) return res.status(403).json({ error: "User not associated with any company" });
    const updatedPatient = await storage.updatePatient(parseInt(req.params.id), req.body, companyId);
    // Invalida caches específicos em todos os workers
    invalidateClusterCache(`api:/api/patients/${req.params.id}`);
    invalidateClusterCache('api:/api/patients');
    res.json(updatedPatient);
  }));

  // Patient Anamnesis Routes
  app.get("/api/patients/:id/anamnesis", authCheck, asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;
    if (!companyId) return res.status(403).json({ error: "User not associated with any company" });
    const patientId = parseInt(req.params.id);
    const anamnesis = await storage.getPatientAnamnesis(patientId, companyId);
    res.json(anamnesis);
  }));

  app.post("/api/patients/:id/anamnesis", authCheck, asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;
    if (!companyId) return res.status(403).json({ error: "User not associated with any company" });
    const patientId = parseInt(req.params.id);
    const anamnesis = await storage.createPatientAnamnesis({ ...req.body, patientId, companyId });
    res.status(201).json(anamnesis);
  }));

  // Patient Exams Routes
  app.get("/api/patients/:id/exams", authCheck, asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;
    if (!companyId) return res.status(403).json({ error: "User not associated with any company" });
    const patientId = parseInt(req.params.id);
    const exams = await storage.getPatientExams(patientId, companyId);
    res.json(exams);
  }));

  app.post("/api/patients/:id/exams", authCheck, asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;
    if (!companyId) return res.status(403).json({ error: "User not associated with any company" });
    const patientId = parseInt(req.params.id);
    const exam = await storage.createPatientExam({ ...req.body, patientId, companyId });
    res.status(201).json(exam);
  }));

  // Patient Treatment Plans Routes
  app.get("/api/patients/:id/treatment-plans", authCheck, asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;
    if (!companyId) return res.status(403).json({ error: "User not associated with any company" });
    const patientId = parseInt(req.params.id);
    const plans = await storage.getPatientTreatmentPlans(patientId, companyId);
    res.json(plans);
  }));

  app.post("/api/patients/:id/treatment-plans", authCheck, asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;
    if (!companyId) return res.status(403).json({ error: "User not associated with any company" });
    const patientId = parseInt(req.params.id);
    const plan = await storage.createPatientTreatmentPlan({ ...req.body, patientId, companyId, professionalId: user.id });
    res.status(201).json(plan);
  }));

  // Patient Evolution Routes
  app.get("/api/patients/:id/evolution", authCheck, asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;
    if (!companyId) return res.status(403).json({ error: "User not associated with any company" });
    const patientId = parseInt(req.params.id);
    const evolution = await storage.getPatientEvolution(patientId, companyId);
    res.json(evolution);
  }));

  app.post("/api/patients/:id/evolution", authCheck, asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;
    if (!companyId) return res.status(403).json({ error: "User not associated with any company" });
    const patientId = parseInt(req.params.id);
    const evolution = await storage.createPatientEvolution({ ...req.body, patientId, companyId });
    res.status(201).json(evolution);
  }));

  // Patient Prescriptions Routes
  app.get("/api/patients/:id/prescriptions", authCheck, asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;
    if (!companyId) return res.status(403).json({ error: "User not associated with any company" });
    const patientId = parseInt(req.params.id);
    const prescriptions = await storage.getPatientPrescriptions(patientId, companyId);
    res.json(prescriptions);
  }));

  app.post("/api/patients/:id/prescriptions", authCheck, asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;
    if (!companyId) return res.status(403).json({ error: "User not associated with any company" });
    const patientId = parseInt(req.params.id);
    const prescription = await storage.createPatientPrescription({ ...req.body, patientId, companyId });
    res.status(201).json(prescription);
  }));

  // Appointments
  app.get("/api/appointments", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
      
      const user = req.user as any;
      if (!user?.companyId) return res.status(403).json({ message: "User not associated with any company" });
      const companyId = user.companyId;
      
      let startDate: Date | undefined;
      let endDate: Date | undefined;
      
      if (req.query.date) {
        startDate = parse(req.query.date as string, 'yyyy-MM-dd', new Date());
        endDate = addDays(startDate, 1);
      }
      
      const appointments = await storage.getAppointments(companyId, {
        startDate: startDate ? formatISO(startDate) : undefined,
        endDate: endDate ? formatISO(endDate) : undefined,
        professionalId: req.query.professionalId ? parseInt(req.query.professionalId as string) : undefined,
        patientId: req.query.patientId ? parseInt(req.query.patientId as string) : undefined,
        status: req.query.status as string,
      });
      res.json(appointments);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/appointments", authCheck, checkAppointmentsLimit, async (req, res, next) => {
    try {
      const appointment = await storage.createAppointment(req.body, req.user!.companyId);
      res.status(201).json(appointment);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/appointments/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
      const updatedAppointment = await storage.updateAppointment(parseInt(req.params.id), req.body);
      res.json(updatedAppointment);
    } catch (error) {
      next(error);
    }
  });

  // Professionals
  app.get("/api/professionals", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
      const user = req.user as any;
      const companyId = user?.companyId;
      if (!companyId) return res.status(403).json({ message: "User not associated with any company" });
      const professionals = await storage.getProfessionals(companyId);
      res.json(professionals);
    } catch (error) {
      next(error);
    }
  });

  // Rooms
  app.get("/api/rooms", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
      const user = req.user as any;
      if (!user?.companyId) return res.status(403).json({ message: "User not associated with any company" });
      const companyId = user.companyId;
      const rooms = await storage.getRooms(companyId);
      res.json(rooms);
    } catch (error) {
      next(error);
    }
  });

  // Procedures
  app.get("/api/procedures", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
      const user = req.user as any;
      if (!user?.companyId) return res.status(403).json({ message: "User not associated with any company" });
      const companyId = user.companyId;
      const procedures = await storage.getProcedures(companyId);
      res.json(procedures);
    } catch (error) {
      next(error);
    }
  });

  // ✅ REMOVIDO: Rotas antigas duplicadas
  // As novas rotas estão nas linhas 418-437 com implementação completa
  // usando handlers especializados (financialHandlers, patientRecordsHandlers, odontogramHandlers)

  // Automations
  app.get("/api/automations", authCheck, cacheMiddleware(300), asyncHandler(async (req, res) => {
    const automations = await storage.getAutomations(req.user!.companyId);
    res.json(automations);
  }));

  app.post("/api/automations", authCheck, asyncHandler(async (req, res) => {
    const automation = await storage.createAutomation(req.body, req.user!.companyId);
    res.status(201).json(automation);
  }));

  app.patch("/api/automations/:id", authCheck, asyncHandler(async (req, res) => {
    const updatedAutomation = await storage.updateAutomation(parseInt(req.params.id), req.body, req.user!.companyId);
    res.json(updatedAutomation);
  }));

  app.delete("/api/automations/:id", authCheck, asyncHandler(async (req, res) => {
    await storage.deleteAutomation(parseInt(req.params.id), req.user!.companyId);
    res.status(204).end();
  }));

  app.patch("/api/automations/:id/toggle", authCheck, asyncHandler(async (req, res) => {
    const updatedAutomation = await storage.updateAutomation(parseInt(req.params.id), {
      active: req.body.active,
    }, req.user!.companyId);
    res.json(updatedAutomation);
  }));

  // Novas rotas para configurações da clínica
  // ----------------------------------------

  // Configurações da Clínica
  app.get("/api/clinic-settings", authCheck, asyncHandler(async (req, res) => {
    const settings = await db.query.clinicSettings.findFirst();
    res.json(settings || {});
  }));

  app.post("/api/clinic-settings", authCheck, asyncHandler(async (req, res) => {
    const existingSettings = await db.query.clinicSettings.findFirst();
    
    if (existingSettings) {
      // Atualiza as configurações existentes
      const [updated] = await db
        .update(clinicSettings)
        .set({
          ...req.body,
          updatedAt: new Date()
        })
        .where(eq(clinicSettings.id, existingSettings.id))
        .returning();
      
      invalidateClusterCache('api:/api/clinic-settings');
      res.json(updated);
    } else {
      // Cria novas configurações
      const [newSettings] = await db
        .insert(clinicSettings)
        .values({
          ...req.body,
          updatedAt: new Date()
        })
        .returning();
      
      invalidateClusterCache('api:/api/clinic-settings');
      res.status(201).json(newSettings);
    }
  }));

  // Atividades Recentes da Agenda
  app.get("/api/recent-activities", asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;
    if (!companyId) return res.status(403).json({ error: "User not associated with any company" });
    
    try {
      // Usar storage layer para buscar dados com fallback seguro
      let recentAppointments: any[] = [];
      let recentPatients: any[] = [];
      
      try {
        recentAppointments = await storage.getAppointments(companyId, {}) || [];
      } catch (error) {
        console.error('Erro ao buscar agendamentos:', error);
      }
      
      try {
        recentPatients = await storage.getPatients(companyId);
      } catch (error) {
        console.error('Erro ao buscar pacientes:', error);
      }

      // Formatar atividades de agendamentos
      const appointmentActivities = recentAppointments.map(apt => ({
        id: apt.id.toString(),
        type: 'appointment',
        title: apt.status === 'confirmed' ? 'Consulta confirmada' :
               apt.status === 'cancelled' ? 'Consulta cancelada' :
               apt.status === 'completed' ? 'Consulta realizada' : 'Consulta agendada',
        description: `${apt.patientName || 'Paciente'} - ${new Date(apt.startTime).toLocaleDateString('pt-BR')}`,
        created_at: apt.createdAt,
        patient_id: apt.patientId?.toString(),
        appointment_id: apt.id.toString()
      }));

      // Formatar atividades de pacientes
      const patientActivities = recentPatients.map(patient => ({
        id: patient.id.toString(),
        type: 'patient',
        title: 'Novo paciente cadastrado',
        description: `${patient.fullName} foi adicionado ao sistema`,
        created_at: patient.createdAt,
        patient_id: patient.id.toString(),
        appointment_id: null
      }));

      // Combinar e ordenar
      const allActivities = [...appointmentActivities, ...patientActivities]
        .filter(activity => activity.created_at) // Remove activities without dates
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 10);

      res.json(allActivities);
    } catch (error) {
      console.error('Erro ao buscar atividades recentes:', error);
      res.json([]);
    }
  }));

  // Configurações Fiscais
  app.get("/api/fiscal-settings", authCheck, asyncHandler(async (req, res) => {
    const settings = await db.query.fiscalSettings.findFirst();
    res.json(settings || {});
  }));

  app.post("/api/fiscal-settings", authCheck, asyncHandler(async (req, res) => {
    const existingSettings = await db.query.fiscalSettings.findFirst();
    
    if (existingSettings) {
      // Atualiza as configurações existentes
      const [updated] = await db
        .update(fiscalSettings)
        .set({
          ...req.body,
          updatedAt: new Date()
        })
        .where(eq(fiscalSettings.id, existingSettings.id))
        .returning();
      
      invalidateClusterCache('api:/api/fiscal-settings');
      res.json(updated);
    } else {
      // Cria novas configurações
      const [newSettings] = await db
        .insert(fiscalSettings)
        .values({
          ...req.body,
          updatedAt: new Date()
        })
        .returning();
      
      invalidateClusterCache('api:/api/fiscal-settings');
      res.status(201).json(newSettings);
    }
  }));

  // Permissões
  app.get("/api/permissions", authCheck, asyncHandler(async (req, res) => {
    const allPermissions = await db.query.permissions.findMany();
    res.json(allPermissions);
  }));

  app.get("/api/users/:id/permissions", authCheck, asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.id);
    const userPerms = await db.query.userPermissions.findMany({
      where: eq(userPermissions.userId, userId)
    });
    
    type UserPermission = typeof userPermissions.$inferSelect;
    const permissionIds = userPerms.map((up: UserPermission) => up.permissionId);
    
    // Carrega os detalhes completos das permissões
    const permissionsDetails = await db.query.permissions.findMany({
      where: (perms: typeof permissions, { inArray }: { inArray: typeof import('drizzle-orm').inArray }) => inArray(perms.id, permissionIds)
    });

    res.json(permissionsDetails);
  }));

  app.post("/api/users/:id/permissions", authCheck, asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.id);
    const { permissions: permissionIds } = req.body;
    
    // Remove as permissões atuais
    await db
      .delete(userPermissions)
      .where(eq(userPermissions.userId, userId));
    
    // Adiciona as novas permissões
    if (permissionIds && permissionIds.length > 0) {
      const newPermissions = permissionIds.map((permId: number) => ({
        userId,
        permissionId: permId,
        createdAt: new Date()
      }));
      
      await db.insert(userPermissions).values(newPermissions);
    }
    
    // Carrega as permissões atualizadas
    const updatedUserPerms = await db.query.userPermissions.findMany({
      where: eq(userPermissions.userId, userId)
    });

    type UserPermission = typeof userPermissions.$inferSelect;
    const updatedPermissionIds = updatedUserPerms.map((up: UserPermission) => up.permissionId);

    // Carrega os detalhes completos das permissões
    const permissionsDetails = await db.query.permissions.findMany({
      where: (perms: typeof permissions, { inArray }: { inArray: typeof import('drizzle-orm').inArray }) => inArray(perms.id, updatedPermissionIds)
    });
    
    invalidateClusterCache(`api:/api/users/${userId}/permissions`);
    res.json(permissionsDetails);
  }));

  // Taxas de Maquininha
  app.get("/api/machine-taxes", authCheck, asyncHandler(async (req, res) => {
    const taxes = await db.query.machineTaxes.findMany();
    res.json(taxes);
  }));

  app.get("/api/machine-taxes/:id", authCheck, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    const tax = await db.query.machineTaxes.findFirst({
      where: eq(machineTaxes.id, id)
    });
    
    if (!tax) {
      return res.status(404).json({ message: "Taxa não encontrada" });
    }
    
    res.json(tax);
  }));

  app.post("/api/machine-taxes", authCheck, asyncHandler(async (req, res) => {
    const [newTax] = await db
      .insert(machineTaxes)
      .values({
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    invalidateClusterCache('api:/api/machine-taxes');
    res.status(201).json(newTax);
  }));

  app.patch("/api/machine-taxes/:id", authCheck, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    
    const [updated] = await db
      .update(machineTaxes)
      .set({
        ...req.body,
        updatedAt: new Date()
      })
      .where(eq(machineTaxes.id, id))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ message: "Taxa não encontrada" });
    }
    
    invalidateClusterCache(`api:/api/machine-taxes/${id}`);
    invalidateClusterCache('api:/api/machine-taxes');
    res.json(updated);
  }));

  app.delete("/api/machine-taxes/:id", authCheck, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    
    await db
      .delete(machineTaxes)
      .where(eq(machineTaxes.id, id));
    
    invalidateClusterCache(`api:/api/machine-taxes/${id}`);
    invalidateClusterCache('api:/api/machine-taxes');
    res.status(204).end();
  }));

  // Comissões
  app.get("/api/commissions/settings", authCheck, asyncHandler(async (req, res) => {
    const settings = await db.query.commissionSettings.findMany();
    res.json(settings);
  }));

  app.get("/api/commissions/settings/:userId", authCheck, asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.userId);
    const setting = await db.query.commissionSettings.findFirst({
      where: eq(commissionSettings.userId, userId)
    });
    
    res.json(setting || {});
  }));

  app.post("/api/commissions/settings", authCheck, asyncHandler(async (req, res) => {
    const [newSetting] = await db
      .insert(commissionSettings)
      .values({
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    invalidateClusterCache('api:/api/commissions/settings');
    res.status(201).json(newSetting);
  }));

  app.post("/api/commissions/settings/:userId", authCheck, asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.userId);
    const existingSetting = await db.query.commissionSettings.findFirst({
      where: eq(commissionSettings.userId, userId)
    });
    
    if (existingSetting) {
      // Atualiza configuração existente
      const [updated] = await db
        .update(commissionSettings)
        .set({
          ...req.body,
          updatedAt: new Date()
        })
        .where(eq(commissionSettings.id, existingSetting.id))
        .returning();
      
      invalidateClusterCache(`api:/api/commissions/settings/${userId}`);
      invalidateClusterCache('api:/api/commissions/settings');
      res.json(updated);
    } else {
      // Cria nova configuração
      const [newSetting] = await db
        .insert(commissionSettings)
        .values({
          ...req.body,
          userId,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      invalidateClusterCache(`api:/api/commissions/settings/${userId}`);
      invalidateClusterCache('api:/api/commissions/settings');
      res.status(201).json(newSetting);
    }
  }));

  // Comissões por procedimento
  app.get("/api/commissions/procedures/:userId", authCheck, asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.userId);
    const commissions = await db.query.procedureCommissions.findMany({
      where: eq(procedureCommissions.userId, userId)
    });
    
    res.json(commissions);
  }));

  app.post("/api/commissions/procedures/:userId/:procedureId", authCheck, asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.userId);
    const procedureId = parseInt(req.params.procedureId);
    
    const existingCommission = await db.query.procedureCommissions.findFirst({
      where: (comms: typeof procedureCommissions, { and: andFn, eq: eqFn }: { and: typeof import('drizzle-orm').and, eq: typeof import('drizzle-orm').eq }) => andFn(
        eqFn(comms.userId, userId),
        eqFn(comms.procedureId, procedureId)
      )
    });
    
    if (existingCommission) {
      // Atualiza comissão existente
      const [updated] = await db
        .update(procedureCommissions)
        .set({
          ...req.body
        })
        .where(eq(procedureCommissions.id, existingCommission.id))
        .returning();
      
      res.json(updated);
    } else {
      // Cria nova comissão
      const [newCommission] = await db
        .insert(procedureCommissions)
        .values({
          ...req.body,
          userId,
          procedureId,
          createdAt: new Date()
        })
        .returning();
      
      res.status(201).json(newCommission);
    }
    
    invalidateClusterCache(`api:/api/commissions/procedures/${userId}`);
  }));

  // === API DE PAGAMENTOS MERCADO PAGO ===
  app.get("/api/payments/plans", paymentHandlers.getPlans);
  app.get("/api/payments/subscription", authCheck, paymentHandlers.getCurrentSubscription);
  app.post("/api/payments/subscribe", authCheck, paymentHandlers.createSubscription);
  app.post("/api/payments/cancel", authCheck, paymentHandlers.cancelSubscription);
  app.get("/api/payments/history", authCheck, paymentHandlers.getPaymentHistory);
  app.post("/api/payments/webhook", paymentHandlers.handleWebhook);
  app.get("/payments/success", paymentHandlers.getPaymentSuccess);
  app.get("/payments/failure", (req, res) => res.redirect('/payments?status=error'));
  app.get("/payments/pending", (req, res) => res.redirect('/payments?status=pending'));

  // === API DE CONFIGURAÇÕES DA CLÍNICA ===
  app.get("/api/clinic/settings", authCheck, clinicHandlers.getClinicSettings);
  app.patch("/api/clinic/settings", authCheck, clinicHandlers.updateClinicSettings);

  // === API DE RELATÓRIOS ===
  app.get("/api/reports/revenue", authCheck, clinicHandlers.getRevenueReport);
  app.get("/api/reports/appointments", authCheck, clinicHandlers.getAppointmentStats);
  app.get("/api/reports/procedures", authCheck, clinicHandlers.getProcedureAnalytics);
  app.get("/api/reports/patients", authCheck, clinicHandlers.getPatientAnalytics);

  // === API DE USUÁRIOS E CADASTROS ===
  app.get("/api/users", authCheck, clinicHandlers.getUsers);
  app.patch("/api/users/:id", authCheck, clinicHandlers.updateUser);
  app.delete("/api/users/:id", authCheck, clinicHandlers.deleteUser);
  // Nota: /api/procedures já definido na linha 732
  // Nota: /api/rooms já definido acima (linha ~704) e em /api/v1/rooms

  // === API DE PERFIL (AVATAR UPLOAD) ===
  const avatarUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
  app.post("/api/v1/profile/avatar", authCheck, avatarUpload.single('avatar'), asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    if (!user?.id) return res.status(401).json({ error: 'Not authenticated' });

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    // Store as base64 data URI in the user's profileImageUrl field
    const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    await db.$client.query(
      `UPDATE users SET profile_image_url = $1, updated_at = NOW() WHERE id = $2`,
      [base64, user.id]
    );

    res.json({ success: true, url: base64 });
  }));

  // === API DE BACKUP ===
  app.post("/api/backup/create", authCheck, backupHandlers.createBackup);
  app.post("/api/backup/schedule", authCheck, backupHandlers.scheduleBackup);
  app.get("/api/backup/status", authCheck, backupHandlers.getBackupStatus);

  // === API DE CRIADOR DE SITES ===
  app.get("/api/website", authCheck, websiteHandlers.getWebsite);
  app.post("/api/website", authCheck, websiteHandlers.saveWebsite);
  app.put("/api/website", authCheck, websiteHandlers.saveWebsite);
  app.post("/api/website/publish", authCheck, websiteHandlers.publishWebsite);
  app.get("/api/website/preview/:template", authCheck, websiteHandlers.getWebsitePreview);
  app.post("/api/website/unpublish", authCheck, websiteHandlers.unpublishWebsite);
  app.get("/api/website/public/:domain", websiteHandlers.getPublicWebsite);
  app.get("/api/websites/published", authCheck, websiteHandlers.listPublishedWebsites);

  // Upload de imagens do website (recebe base64)
  app.post("/api/website/upload", authCheck, asyncHandler(async (req: Request, res: Response) => {
    const { imageData, filename } = req.body;
    if (!imageData || !filename) {
      return res.status(400).json({ error: 'imageData and filename are required' });
    }
    // Return the base64 data URI as the URL (can be stored in website config)
    res.json({ success: true, url: imageData, filename });
  }));

  // === API DE LABORATÓRIOS ===
  // Listar laboratórios
  app.get("/api/laboratories", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    const companyId = user.companyId;
    
    try {
      const laboratories = await storage.getLaboratories(companyId);
      res.json(laboratories);
    } catch (error) {
      console.error('Erro ao buscar laboratórios:', error);
      res.status(500).json({ error: 'Erro ao buscar laboratórios' });
    }
  }));

  // Criar laboratório
  app.post("/api/laboratories", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    const companyId = user.companyId;
    
    try {
      const laboratoryData = {
        ...req.body,
        companyId
      };
      
      const newLaboratory = await storage.createLaboratory(laboratoryData);
      res.status(201).json(newLaboratory);
    } catch (error) {
      console.error('Erro ao criar laboratório:', error);
      res.status(500).json({ 
        error: 'Erro ao criar laboratório',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }));

  // Obter laboratório específico
  app.get("/api/laboratories/:id", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const companyId = user.companyId;
      const laboratoryId = parseInt(req.params.id);
      
      if (!laboratoryId || isNaN(laboratoryId)) {
        return res.status(400).json({ error: 'ID de laboratório inválido' });
      }
      
      const laboratory = await storage.getLaboratory(laboratoryId, companyId);
      
      if (!laboratory) {
        return res.status(404).json({ error: 'Laboratório não encontrado' });
      }
      
      res.json(laboratory);
    } catch (error) {
      console.error('Erro ao buscar laboratório:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: 'Falha ao buscar laboratório'
      });
    }
  }));

  // Atualizar laboratório
  app.patch("/api/laboratories/:id", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const companyId = user.companyId;
      const laboratoryId = parseInt(req.params.id);
      
      if (!laboratoryId || isNaN(laboratoryId)) {
        return res.status(400).json({ error: 'ID de laboratório inválido' });
      }
      
      const updatedLaboratory = await storage.updateLaboratory(laboratoryId, req.body, companyId);
      
      if (!updatedLaboratory) {
        return res.status(404).json({ error: 'Laboratório não encontrado' });
      }
      
      res.json(updatedLaboratory);
    } catch (error) {
      console.error('Erro ao atualizar laboratório:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: 'Falha ao atualizar laboratório'
      });
    }
  }));

  // Excluir laboratório
  app.delete("/api/laboratories/:id", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    const companyId = user.companyId;
    const laboratoryId = parseInt(req.params.id);
    
    try {
      if (!laboratoryId || isNaN(laboratoryId)) {
        return res.status(400).json({ error: 'ID de laboratório inválido' });
      }
      
      await storage.deleteLaboratory(laboratoryId, companyId);
      res.status(204).send();
    } catch (error) {
      console.error('Erro ao excluir laboratório:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: 'Falha ao excluir laboratório'
      });
    }
  }));

  // === API DE PRÓTESES ===
  // Listar próteses
  app.get("/api/prosthesis", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    const companyId = user.companyId;
    
    try {
      const prosthesis = await storage.getProsthesis(companyId);
      res.json(prosthesis);
    } catch (error) {
      console.error('Erro ao buscar próteses:', error);
      res.status(500).json({ error: 'Erro ao buscar próteses' });
    }
  }));

  // Criar prótese
  app.post("/api/prosthesis", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    const companyId = user.companyId;
    
    try {
      console.log('Dados recebidos para criação:', req.body);
      
      const prosthesisData = {
        ...req.body,
        companyId
      };
      
      console.log('Dados processados para inserção:', prosthesisData);
      
      const newProsthesis = await storage.createProsthesis(prosthesisData);
      console.log('Prótese criada com sucesso:', newProsthesis);
      
      if (!newProsthesis || !newProsthesis.id) {
        console.error('Prótese criada mas sem dados válidos:', newProsthesis);
        return res.status(500).json({ 
          error: 'Erro interno',
          details: 'Prótese criada mas dados inválidos'
        });
      }
      
      res.status(200).json(newProsthesis);
    } catch (error) {
      console.error('Erro detalhado ao criar prótese:', error);
      res.status(500).json({ 
        error: 'Erro ao criar prótese',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }));

  // Obter prótese específica
  app.get("/api/prosthesis/:id", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const companyId = user.companyId;
      const prosthesisId = parseInt(req.params.id);
      
      if (!prosthesisId || isNaN(prosthesisId)) {
        return res.status(400).json({ error: 'ID de prótese inválido' });
      }


      const allProsthesis = await storage.getProsthesis(companyId);
      const prosthesis = allProsthesis.find((p: any) => p.id === prosthesisId);

      if (!prosthesis) {
        return res.status(404).json({ error: 'Prótese não encontrada' });
      }
      
      res.json(prosthesis);
    } catch (error) {
      console.error('Erro ao buscar prótese:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: 'Falha ao buscar prótese'
      });
    }
  }));

  // Atualizar prótese
  app.patch("/api/prosthesis/:id", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const companyId = user.companyId;
      const prosthesisId = parseInt(req.params.id);
      
      if (!prosthesisId || isNaN(prosthesisId)) {
        return res.status(400).json({ error: 'ID de prótese inválido' });
      }
      
      const updatedProsthesis = await storage.updateProsthesis(prosthesisId, req.body, companyId);
      
      if (!updatedProsthesis) {
        return res.status(404).json({ error: 'Prótese não encontrada' });
      }
      
      res.json(updatedProsthesis);
    } catch (error) {
      console.error('Erro ao atualizar prótese:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: 'Falha ao atualizar prótese'
      });
    }
  }));

  // Excluir prótese
  app.delete("/api/prosthesis/:id", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    const companyId = user.companyId;
    const prosthesisId = parseInt(req.params.id);
    
    try {
      if (!prosthesisId || isNaN(prosthesisId)) {
        return res.status(400).json({ error: 'ID de prótese inválido' });
      }
      
      await storage.deleteProsthesis(prosthesisId, companyId);
      res.status(204).send();
    } catch (error) {
      console.error('Erro ao excluir prótese:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: 'Falha ao excluir prótese'
      });
    }
  }));

  // === API DE AUTENTICAÇÃO ===
  // Auto-login para desenvolvimento
  app.post("/api/auth/auto-login", asyncHandler(async (req: Request, res: Response) => {
    try {
      // Fazer login automático com o usuário admin
      const user = await storage.getUserByUsername("admin");
      
      if (!user) {
        return res.status(404).json({ message: "Usuário admin não encontrado" });
      }
      
      // Simular login estabelecendo sessão
      req.login(user, (err) => {
        if (err) {
          console.error("Erro no auto-login:", err);
          return res.status(500).json({ message: "Erro no login automático" });
        }
        
        res.json({
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
          active: user.active
        });
      });
    } catch (error) {
      console.error("Erro no auto-login:", error);
      res.status(500).json({ message: "Erro interno no auto-login" });
    }
  }));

  // Verificar usuário atual
  app.get("/api/user/me", authCheck, asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    res.json({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      active: user.active
    });
  }));

  // === APIs SUPERADMIN === (movidas para /api/superadmin via server/routes/superadmin.routes.ts)

  // === APIs PARA MÓDULOS DO USUÁRIO ===
  // REMOVIDO: Rota duplicada - já existe na linha ~48

  // === APIs PARA MÓDULOS DA CLÍNICA ===
  // Nota: /api/clinic/modules já definido na linha 65

  app.get("/api/clinic/modules/:moduleId", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    const { moduleId } = req.params;
    const module = moduleRegistry.getModule(moduleId);
    
    if (!module) {
      return res.status(404).json({ message: "Módulo não encontrado" });
    }
    
    res.json(module);
  }));

  app.post("/api/clinic/modules/:moduleId/activate", authCheck, tenantIsolationMiddleware, requireModulePermission('clinica', 'admin'), asyncHandler(async (req: Request, res: Response) => {
    const { moduleId } = req.params;
    const success = moduleRegistry.activate(moduleId);
    
    if (success) {
      res.json({ message: `Módulo ${moduleId} ativado com sucesso` });
    } else {
      res.status(404).json({ message: "Módulo não encontrado" });
    }
  }));

  app.post("/api/clinic/modules/:moduleId/deactivate", authCheck, tenantIsolationMiddleware, requireModulePermission('clinica', 'admin'), asyncHandler(async (req: Request, res: Response) => {
    const { moduleId } = req.params;
    const success = moduleRegistry.deactivate(moduleId);
    
    if (success) {
      res.json({ message: `Módulo ${moduleId} desativado com sucesso` });
    } else {
      res.status(404).json({ message: "Módulo não encontrado" });
    }
  }));

  // Registrar rotas dos módulos da clínica
  registerProtesesRoutes(app);
  
  // Import and register laboratory routes
  const { registerLaboratoryRoutes } = await import('./routes/laboratories');
  registerLaboratoryRoutes(app);

  // Prosthesis Labels routes
  // Listar etiquetas da empresa
  app.get("/api/prosthesis-labels", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const companyId = user.companyId;
      
      const labels = await storage.getProsthesisLabels(companyId);
      res.json(labels);
    } catch (error) {
      console.error('Erro ao buscar etiquetas:', error);
      res.status(500).json({ error: 'Falha ao carregar etiquetas' });
    }
  }));

  // Criar nova etiqueta
  app.post("/api/prosthesis-labels", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const companyId = user.companyId;
      const { name, color } = req.body;
      
      if (!name || !color) {
        return res.status(400).json({ error: 'Nome e cor são obrigatórios' });
      }
      
      const newLabel = await storage.createProsthesisLabel({
        companyId,
        name,
        color,
        active: true
      });
      
      res.status(201).json(newLabel);
    } catch (error) {
      console.error('Erro ao criar etiqueta:', error);
      res.status(500).json({ error: 'Falha ao criar etiqueta' });
    }
  }));

  // Atualizar etiqueta
  app.patch("/api/prosthesis-labels/:id", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const companyId = user.companyId;
      const labelId = parseInt(req.params.id);
      const updates = req.body;
      
      if (!labelId || isNaN(labelId)) {
        return res.status(400).json({ error: 'ID da etiqueta inválido' });
      }
      
      const updatedLabel = await storage.updateProsthesisLabel(labelId, companyId, updates);
      
      if (!updatedLabel) {
        return res.status(404).json({ error: 'Etiqueta não encontrada' });
      }
      
      res.json(updatedLabel);
    } catch (error) {
      console.error('Erro ao atualizar etiqueta:', error);
      res.status(500).json({ error: 'Falha ao atualizar etiqueta' });
    }
  }));

  // Excluir etiqueta
  app.delete("/api/prosthesis-labels/:id", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const companyId = user.companyId;
      const labelId = parseInt(req.params.id);
      
      if (!labelId || isNaN(labelId)) {
        return res.status(400).json({ error: 'ID da etiqueta inválido' });
      }
      
      const deleted = await storage.deleteProsthesisLabel(labelId, companyId);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Etiqueta não encontrada' });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Erro ao excluir etiqueta:', error);
      res.status(500).json({ error: 'Falha ao excluir etiqueta' });
    }
  }));

  // === CADASTROS API ROUTES (Categories, Boxes, Chairs) ===

  // Financial Categories CRUD
  app.get("/api/cadastros/categories", authCheck, asyncHandler(async (req: Request, res: Response) => {
    const result = await db.$client.query(`SELECT * FROM financial_categories ORDER BY name`);
    res.json(result.rows);
  }));

  app.post("/api/cadastros/categories", authCheck, asyncHandler(async (req: Request, res: Response) => {
    const { name, type } = req.body;
    if (!name) return res.status(400).json({ error: "Nome é obrigatório" });
    const result = await db.$client.query(
      `INSERT INTO financial_categories (name, type) VALUES ($1, $2) RETURNING *`,
      [name, type || 'expense']
    );
    res.json(result.rows[0]);
  }));

  app.patch("/api/cadastros/categories/:id", authCheck, asyncHandler(async (req: Request, res: Response) => {
    const { name, type } = req.body;
    const result = await db.$client.query(
      `UPDATE financial_categories SET name = COALESCE($1, name), type = COALESCE($2, type) WHERE id = $3 RETURNING *`,
      [name, type, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Categoria não encontrada" });
    res.json(result.rows[0]);
  }));

  app.delete("/api/cadastros/categories/:id", authCheck, asyncHandler(async (req: Request, res: Response) => {
    await db.$client.query(`DELETE FROM financial_categories WHERE id = $1`, [req.params.id]);
    res.status(204).send();
  }));

  // Boxes CRUD
  app.get("/api/cadastros/boxes", authCheck, asyncHandler(async (req: Request, res: Response) => {
    const result = await db.$client.query(`SELECT * FROM boxes ORDER BY name`);
    res.json(result.rows);
  }));

  app.post("/api/cadastros/boxes", authCheck, asyncHandler(async (req: Request, res: Response) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "Nome é obrigatório" });
    const result = await db.$client.query(
      `INSERT INTO boxes (name, description) VALUES ($1, $2) RETURNING *`,
      [name, description || null]
    );
    res.json(result.rows[0]);
  }));

  app.patch("/api/cadastros/boxes/:id", authCheck, asyncHandler(async (req: Request, res: Response) => {
    const { name, description } = req.body;
    const result = await db.$client.query(
      `UPDATE boxes SET name = COALESCE($1, name), description = COALESCE($2, description) WHERE id = $3 RETURNING *`,
      [name, description, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Caixa não encontrada" });
    res.json(result.rows[0]);
  }));

  app.delete("/api/cadastros/boxes/:id", authCheck, asyncHandler(async (req: Request, res: Response) => {
    await db.$client.query(`DELETE FROM boxes WHERE id = $1`, [req.params.id]);
    res.status(204).send();
  }));

  // Chairs CRUD
  app.get("/api/cadastros/chairs", authCheck, asyncHandler(async (req: Request, res: Response) => {
    const result = await db.$client.query(`SELECT * FROM chairs ORDER BY name`);
    res.json(result.rows);
  }));

  app.post("/api/cadastros/chairs", authCheck, asyncHandler(async (req: Request, res: Response) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "Nome é obrigatório" });
    const result = await db.$client.query(
      `INSERT INTO chairs (name, description) VALUES ($1, $2) RETURNING *`,
      [name, description || null]
    );
    res.json(result.rows[0]);
  }));

  app.patch("/api/cadastros/chairs/:id", authCheck, asyncHandler(async (req: Request, res: Response) => {
    const { name, description } = req.body;
    const result = await db.$client.query(
      `UPDATE chairs SET name = COALESCE($1, name), description = COALESCE($2, description) WHERE id = $3 RETURNING *`,
      [name, description, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Cadeira não encontrada" });
    res.json(result.rows[0]);
  }));

  app.delete("/api/cadastros/chairs/:id", authCheck, asyncHandler(async (req: Request, res: Response) => {
    await db.$client.query(`DELETE FROM chairs WHERE id = $1`, [req.params.id]);
    res.status(204).send();
  }));

  // === INVENTORY API ROUTES ===
  
  // Get inventory categories
  app.get("/api/inventory/categories", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const categories = await storage.getInventoryCategories(user.companyId);
      res.json(categories);
    } catch (error) {
      console.error('Erro ao buscar categorias de estoque:', error);
      res.status(500).json({ error: 'Falha ao carregar categorias' });
    }
  }));

  // Create inventory category
  app.post("/api/inventory/categories", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const categoryData = { ...req.body, companyId: user.companyId };
      const category = await storage.createInventoryCategory(categoryData);
      res.status(201).json(category);
    } catch (error) {
      console.error('Erro ao criar categoria:', error);
      res.status(500).json({ error: 'Falha ao criar categoria' });
    }
  }));

  // Update inventory category
  app.patch("/api/inventory/categories/:id", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const categoryId = parseInt(req.params.id);
      const category = await storage.updateInventoryCategory(categoryId, req.body, user.companyId);
      res.json(category);
    } catch (error) {
      console.error('Erro ao atualizar categoria:', error);
      res.status(500).json({ error: 'Falha ao atualizar categoria' });
    }
  }));

  // Get inventory items
  app.get("/api/inventory/items", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const items = await storage.getInventoryItems(user.companyId);
      res.json(items);
    } catch (error) {
      console.error('Erro ao buscar itens de estoque:', error);
      res.status(500).json({ error: 'Falha ao carregar itens' });
    }
  }));

  // Create inventory item
  app.post("/api/inventory/items", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const itemData = { ...req.body, companyId: user.companyId };
      const item = await storage.createInventoryItem(itemData);
      res.status(201).json(item);
    } catch (error) {
      console.error('Erro ao criar item:', error);
      res.status(500).json({ error: 'Falha ao criar item' });
    }
  }));

  // Update inventory item
  app.patch("/api/inventory/items/:id", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const itemId = parseInt(req.params.id);
      const item = await storage.updateInventoryItem(itemId, req.body, user.companyId);
      res.json(item);
    } catch (error) {
      console.error('Erro ao atualizar item:', error);
      res.status(500).json({ error: 'Falha ao atualizar item' });
    }
  }));

  // Delete inventory item
  app.delete("/api/inventory/items/:id", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const itemId = parseInt(req.params.id);
      await storage.deleteInventoryItem(itemId, user.companyId);
      res.status(204).send();
    } catch (error) {
      console.error('Erro ao deletar item:', error);
      res.status(500).json({ error: 'Falha ao deletar item' });
    }
  }));

  // Get inventory transactions
  app.get("/api/inventory/transactions", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const itemId = req.query.itemId ? parseInt(req.query.itemId as string) : undefined;
      const transactions = await storage.getInventoryTransactions(user.companyId, itemId);
      res.json(transactions);
    } catch (error) {
      console.error('Erro ao buscar transações:', error);
      res.status(500).json({ error: 'Falha ao carregar transações' });
    }
  }));

  // Create inventory transaction (entrada/saída)
  app.post("/api/inventory/transactions", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const transactionData = { ...req.body, userId: user.id };
      
      // Get current stock for validation
      const items = await storage.getInventoryItems(user.companyId);
      const item = items.find(i => i.id === transactionData.itemId);
      
      if (!item) {
        return res.status(404).json({ error: 'Item não encontrado' });
      }

      const previousStock = item.currentStock;
      const quantity = parseInt(transactionData.quantity);
      const type = transactionData.type;

      let newStock = previousStock;
      if (type === 'entrada') {
        newStock = previousStock + quantity;
      } else if (type === 'saida') {
        newStock = previousStock - quantity;
        if (newStock < 0) {
          return res.status(400).json({ error: 'Estoque insuficiente' });
        }
      } else if (type === 'ajuste') {
        newStock = quantity;
      }

      transactionData.previousStock = previousStock;
      transactionData.newStock = newStock;

      // Create transaction
      const transaction = await storage.createInventoryTransaction(transactionData);
      
      // Update item stock
      await storage.updateInventoryItem(transactionData.itemId, { currentStock: newStock }, user.companyId);
      
      res.status(201).json(transaction);
    } catch (error) {
      console.error('Erro ao criar transação:', error);
      res.status(500).json({ error: 'Falha ao criar transação' });
    }
  }));

  // Get standard dental products
  app.get("/api/inventory/standard-products", authCheck, asyncHandler(async (req: Request, res: Response) => {
    try {
      const products = await storage.getStandardDentalProducts();
      res.json(products);
    } catch (error) {
      console.error('Erro ao buscar produtos padrão:', error);
      res.status(500).json({ error: 'Falha ao carregar produtos padrão' });
    }
  }));

  // Import standard products to inventory
  app.post("/api/inventory/import-standard", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const { productIds } = req.body;

      if (!Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ error: 'Lista de produtos inválida' });
      }

      const importedItems = await storage.importStandardProducts(productIds, user.companyId);
      res.status(201).json(importedItems);
    } catch (error) {
      console.error('Erro ao importar produtos padrão:', error);
      res.status(500).json({ error: 'Falha ao importar produtos' });
    }
  }));

  // Get available seed data for inventory selection
  app.get("/api/inventory/seed-defaults", authCheck, asyncHandler(async (req: Request, res: Response) => {
    try {
      const seedData = storage.getInventorySeedData();
      res.json(seedData);
    } catch (error: any) {
      console.error('Erro ao buscar dados de seed:', error);
      res.status(500).json({ error: 'Falha ao buscar dados de seed' });
    }
  }));

  // Seed inventory with selected dental clinic data
  app.post("/api/inventory/seed-defaults", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const { categoryNames, itemsByCategory } = req.body;

      // Aceita seleção opcional - se não fornecida, cria tudo
      const selection = (categoryNames && categoryNames.length > 0)
        ? { categoryNames, itemsByCategory }
        : undefined;

      const result = await storage.seedInventoryDefaults(user.companyId, selection);
      res.status(201).json({
        message: 'Estoque populado com dados padrão de clínica odontológica',
        categoriesCreated: result.categories.length,
        itemsCreated: result.items.length,
        categories: result.categories,
        items: result.items
      });
    } catch (error: any) {
      console.error('Erro ao popular estoque com dados padrão:', error);
      if (error.message?.includes('já possui categorias')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Falha ao popular estoque com dados padrão' });
    }
  }));

  // === FINANCIAL INTEGRATION API ROUTES ===
  
  // Import financial integration service
  const { financialIntegration } = await import("./financialIntegration");

  // Create financial transactions from completed appointment
  app.post("/api/financial/create-from-appointment/:appointmentId", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const appointmentId = parseInt(req.params.appointmentId);
      
      if (!appointmentId) {
        return res.status(400).json({ error: 'ID do agendamento é obrigatório' });
      }

      const transactions = await financialIntegration.createFinancialTransactionsFromAppointment(appointmentId);
      
      res.status(201).json({
        message: 'Transações financeiras criadas com sucesso',
        transactions: transactions
      });
    } catch (error) {
      console.error('Erro ao criar transações financeiras:', error);
      res.status(500).json({ error: 'Falha ao criar transações financeiras' });
    }
  }));

  // Get patient financial summary
  app.get("/api/financial/patient/:patientId/summary", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const patientId = parseInt(req.params.patientId);
      
      if (!patientId) {
        return res.status(400).json({ error: 'ID do paciente é obrigatório' });
      }

      const summary = await financialIntegration.getPatientFinancialSummary(patientId, user.companyId);
      
      res.json(summary);
    } catch (error) {
      console.error('Erro ao buscar resumo financeiro do paciente:', error);
      res.status(500).json({ error: 'Falha ao carregar resumo financeiro' });
    }
  }));

  // Create treatment plan with financial breakdown
  app.post("/api/financial/treatment-plans", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const { patientId, procedures, paymentPlan, name, description } = req.body;
      
      if (!patientId || !procedures || !Array.isArray(procedures)) {
        return res.status(400).json({ error: 'Dados inválidos para criar plano de tratamento' });
      }

      const treatmentPlan = await financialIntegration.createTreatmentPlan(
        patientId, 
        user.companyId, 
        procedures, 
        paymentPlan
      );
      
      res.status(201).json({
        message: 'Plano de tratamento criado com sucesso',
        treatmentPlan: treatmentPlan
      });
    } catch (error) {
      console.error('Erro ao criar plano de tratamento:', error);
      res.status(500).json({ error: 'Falha ao criar plano de tratamento' });
    }
  }));

  // Process payment with fee calculation
  app.post("/api/financial/process-payment", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const { transactionId, paymentAmount, paymentMethod } = req.body;
      
      if (!transactionId || !paymentAmount || !paymentMethod) {
        return res.status(400).json({ error: 'Dados de pagamento incompletos' });
      }

      const result = await financialIntegration.processPayment(
        transactionId,
        paymentAmount,
        paymentMethod,
        user.companyId
      );
      
      res.json({
        message: 'Pagamento processado com sucesso',
        payment: result
      });
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
      res.status(500).json({ error: 'Falha ao processar pagamento' });
    }
  }));

  // Calculate payment machine fees
  app.post("/api/financial/calculate-fees", authCheck, asyncHandler(async (req: Request, res: Response) => {
    try {
      const { amount, paymentMethod } = req.body;
      
      if (!amount || !paymentMethod) {
        return res.status(400).json({ error: 'Valor e método de pagamento são obrigatórios' });
      }

      const feeCalculation = financialIntegration.calculatePaymentMachineFees(amount, paymentMethod);
      
      res.json(feeCalculation);
    } catch (error) {
      console.error('Erro ao calcular taxas:', error);
      res.status(500).json({ error: 'Falha ao calcular taxas' });
    }
  }));

  // Generate installment schedule
  app.post("/api/financial/generate-installments", authCheck, asyncHandler(async (req: Request, res: Response) => {
    try {
      const { totalAmount, installments, startDate, interval = 'monthly' } = req.body;
      
      if (!totalAmount || !installments || !startDate) {
        return res.status(400).json({ error: 'Dados incompletos para gerar parcelas' });
      }

      const schedule = financialIntegration.generateInstallmentSchedule(
        totalAmount,
        installments,
        startDate,
        interval
      );
      
      res.json({
        message: 'Cronograma de parcelas gerado com sucesso',
        schedule: schedule
      });
    } catch (error) {
      console.error('Erro ao gerar cronograma de parcelas:', error);
      res.status(500).json({ error: 'Falha ao gerar cronograma' });
    }
  }));

  // Auto-trigger financial transaction creation when appointment status changes to completed
  app.patch("/api/appointments/:id/complete", authCheck, tenantIsolationMiddleware, asyncHandler(async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const appointmentId = parseInt(req.params.id);


      // Update appointment status to completed
      await storage.updateAppointment(appointmentId, { status: 'completed', companyId: user.companyId });
      
      // Automatically create financial transactions
      try {
        const transactions = await financialIntegration.createFinancialTransactionsFromAppointment(appointmentId);
        
        res.json({
          message: 'Consulta finalizada e transações financeiras criadas automaticamente',
          appointmentId: appointmentId,
          transactionsCreated: transactions.length,
          transactions: transactions
        });
      } catch (financialError) {
        console.error('Erro na integração financeira automática:', financialError);
        
        res.json({
          message: 'Consulta finalizada, mas houve erro na criação automática das transações financeiras',
          appointmentId: appointmentId,
          warning: 'Transações financeiras precisam ser criadas manualmente'
        });
      }
    } catch (error) {
      console.error('Erro ao finalizar consulta:', error);
      res.status(500).json({ error: 'Falha ao finalizar consulta' });
    }
  }));

  // Digital Patient Record APIs (duplicates removed - already defined above ~line 546)


  const httpServer = createServer(app);

  // Initialize WebSocket server for real-time notifications
  notificationService.initialize(httpServer);

  return httpServer;
}
