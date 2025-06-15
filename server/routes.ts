import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage, DatabaseStorage } from "./storage";
import { setupAuth } from "./auth";
import { parse, formatISO, addDays } from "date-fns";
import { cacheMiddleware } from "./simpleCache";
import { invalidateClusterCache } from "./clusterCache";
import { db } from "./db";
import { clinicSettings, fiscalSettings, permissions, userPermissions, commissionSettings, procedureCommissions, machineTaxes, companies, appointments, patients, subscriptions, payments } from "@shared/schema";
import * as paymentHandlers from "./payments";
import * as clinicHandlers from "./clinic-apis";
import * as backupHandlers from "./backup";
import * as websiteHandlers from "./website-apis";
import { eq, desc, sql } from "drizzle-orm";
import { tenantIsolationMiddleware, resourceAccessMiddleware } from "./tenantMiddleware";
import { createDefaultCompany, migrateUsersToDefaultCompany } from "./seedCompany";
import { requireModulePermission, getUserModulePermissions, grantModulePermission } from "./permissions";
import { moduleRegistry } from "../modules/index";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize database with seed data if needed
  if (storage instanceof DatabaseStorage) {
    await storage.seedInitialData();
    // Criar empresa padrão e migrar usuários existentes
    await migrateUsersToDefaultCompany();
  }
  
  // Set up authentication routes
  setupAuth(app);

  // Função auxiliar para tratamento de erros assíncrono
  const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };

  // === APIs DE MÓDULOS (SEM AUTENTICAÇÃO) ===
  app.get("/api/user/modules", asyncHandler(async (req: Request, res: Response) => {
    const companyId = 3; // Dental Care Plus
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

  // === ROTAS SaaS TEMPORÁRIAS (SEM AUTENTICAÇÃO) ===
  app.get("/api/saas/companies", (req: Request, res: Response) => {
    db.$client.query('SELECT * FROM companies ORDER BY name')
      .then(result => res.json(result.rows))
      .catch(err => res.status(500).json({ error: err.message }));
  });

  app.get("/api/saas/companies/:companyId/modules", (req: Request, res: Response) => {
    const { companyId } = req.params;
    
    // Desabilitar cache para esta rota
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    
    db.$client.query(`
      SELECT 
        m.id, m.name, m.display_name, m.description,
        COALESCE(cm.is_enabled, false) as enabled
      FROM modules m
      LEFT JOIN company_modules cm ON m.id = cm.module_id AND cm.company_id = $1
      ORDER BY m.display_name
    `, [companyId])
      .then(result => res.json(result.rows))
      .catch(err => res.status(500).json({ error: err.message }));
  });

  app.post("/api/saas/companies/:companyId/modules/:moduleId/toggle", (req: Request, res: Response) => {
    const { companyId, moduleId } = req.params;
    const { enabled } = req.body;
    
    if (enabled) {
      // Inserir ou atualizar para ativado
      const query = `INSERT INTO company_modules (company_id, module_id, is_enabled, created_at, updated_at) 
                     VALUES ($1, $2, true, NOW(), NOW()) 
                     ON CONFLICT (company_id, module_id) 
                     DO UPDATE SET is_enabled = true, updated_at = NOW()`;
      
      db.$client.query(query, [companyId, moduleId])
        .then(() => res.json({ success: true, message: 'Módulo ativado' }))
        .catch(err => res.status(500).json({ error: err.message }));
    } else {
      // Inserir ou atualizar para desativado
      const query = `INSERT INTO company_modules (company_id, module_id, is_enabled, created_at, updated_at) 
                     VALUES ($1, $2, false, NOW(), NOW()) 
                     ON CONFLICT (company_id, module_id) 
                     DO UPDATE SET is_enabled = false, updated_at = NOW()`;
      
      db.$client.query(query, [companyId, moduleId])
        .then(() => res.json({ success: true, message: 'Módulo desativado' }))
        .catch(err => res.status(500).json({ error: err.message }));
    }
  });

  // Middleware para verificar autenticação em todas as rotas API
  const authCheck = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  // Middleware combinado: auth + tenant isolation
  const tenantAwareAuth = [authCheck, tenantIsolationMiddleware, resourceAccessMiddleware];

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

  // === ROTAS DE USUÁRIO NORMAL ===
  // Esta rota foi movida para a seção de APIs de módulos mais abaixo

  // Patients - Com cache otimizado e tenant-aware
  app.get("/api/patients", tenantAwareAuth, cacheMiddleware(300), asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId || 3;
    const patients = await storage.getPatients(companyId);
    res.json(patients);
  }));

  app.get("/api/patients/:id", authCheck, cacheMiddleware(300), asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId || 3;
    const patient = await storage.getPatient(parseInt(req.params.id), companyId);
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }
    res.json(patient);
  }));

  app.post("/api/patients", authCheck, asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId || 3;
    const patient = await storage.createPatient(req.body, companyId);
    // Invalida o cache relacionado a pacientes em todos os workers
    invalidateClusterCache('api:/api/patients');
    res.status(201).json(patient);
  }));

  app.patch("/api/patients/:id", authCheck, asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId || 3;
    const updatedPatient = await storage.updatePatient(parseInt(req.params.id), req.body, companyId);
    // Invalida caches específicos em todos os workers
    invalidateClusterCache(`api:/api/patients/${req.params.id}`);
    invalidateClusterCache('api:/api/patients');
    res.json(updatedPatient);
  }));

  // Appointments
  app.get("/api/appointments", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
      
      const companyId = (req.user as any)?.companyId || 1; // Extract from session
      
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

  app.post("/api/appointments", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
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
      const professionals = await storage.getProfessionals();
      res.json(professionals);
    } catch (error) {
      next(error);
    }
  });

  // Rooms
  app.get("/api/rooms", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
      const rooms = await storage.getRooms();
      res.json(rooms);
    } catch (error) {
      next(error);
    }
  });

  // Procedures
  app.get("/api/procedures", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
      const procedures = await storage.getProcedures();
      res.json(procedures);
    } catch (error) {
      next(error);
    }
  });

  // Patient records
  app.get("/api/patients/:id/records", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
      const records = await storage.getPatientRecords(parseInt(req.params.id));
      res.json(records);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/patients/:id/records", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
      const record = await storage.createPatientRecord({
        ...req.body,
        patientId: parseInt(req.params.id),
        createdBy: req.user?.id,
      });
      res.status(201).json(record);
    } catch (error) {
      next(error);
    }
  });

  // Odontogram
  app.get("/api/patients/:id/odontogram", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
      const entries = await storage.getOdontogramEntries(parseInt(req.params.id));
      res.json(entries);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/patients/:id/odontogram", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
      const entry = await storage.createOdontogramEntry({
        ...req.body,
        patientId: parseInt(req.params.id),
        createdBy: req.user?.id,
      });
      res.status(201).json(entry);
    } catch (error) {
      next(error);
    }
  });

  // Financial
  app.get("/api/transactions", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
      const transactions = await storage.getTransactions();
      res.json(transactions);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/transactions", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
      const transaction = await storage.createTransaction(req.body);
      res.status(201).json(transaction);
    } catch (error) {
      next(error);
    }
  });

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
    const companyId = user?.companyId || 3;
    
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
    
    const permissionIds = userPerms.map(up => up.permissionId);
    
    // Carrega os detalhes completos das permissões
    const permissionsDetails = await db.query.permissions.findMany({
      where: (permissions, { inArray }) => inArray(permissions.id, permissionIds)
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
    
    const updatedPermissionIds = updatedUserPerms.map(up => up.permissionId);
    
    // Carrega os detalhes completos das permissões
    const permissionsDetails = await db.query.permissions.findMany({
      where: (permissions, { inArray }) => inArray(permissions.id, updatedPermissionIds)
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
      where: (commissions, { and, eq }) => and(
        eq(commissions.userId, userId),
        eq(commissions.procedureId, procedureId)
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
  app.get("/api/procedures", authCheck, clinicHandlers.getProcedures);
  app.get("/api/rooms", authCheck, clinicHandlers.getRooms);

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

  // === API DE AUTENTICAÇÃO ===
  // Verificar usuário atual
  app.get("/api/user/me", asyncHandler(async (req: Request, res: Response) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const user = req.user as any;
    res.json({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      companyId: user.companyId || 3, // Default company for existing users
      active: user.active
    });
  }));

  // === APIs SUPERADMIN ===
  // Listar empresas (SuperAdmin)
  app.get("/api/saas/companies", authCheck, asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    
    if (user.role !== 'superadmin') {
      return res.status(403).json({ message: "Acesso negado. Apenas superadmin pode listar empresas." });
    }

    const companiesData = await db.select({
      id: companies.id,
      name: companies.name,
      cnpj: companies.cnpj,
      email: companies.email,
      phone: companies.phone,
      address: companies.address,
      active: companies.active,
      createdAt: companies.createdAt
    }).from(companies);

    res.json(companiesData);
  }));

  // Criar empresa (SuperAdmin)
  app.post("/api/saas/companies", authCheck, asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    
    if (user.role !== 'superadmin') {
      return res.status(403).json({ message: "Acesso negado" });
    }

    const { name, cnpj, email, phone, address } = req.body;
    
    const [company] = await db.insert(companies).values({
      name,
      cnpj,
      email,
      phone,
      address,
      active: true
    }).returning();

    res.json(company);
  }));

  // Módulos por empresa (SuperAdmin)
  app.get("/api/saas/companies/:companyId/modules", authCheck, asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    const companyId = parseInt(req.params.companyId);
    
    if (user.role !== 'superadmin') {
      return res.status(403).json({ message: "Acesso negado" });
    }

    const modulesList = [
      { name: 'agenda', display_name: 'Sistema de Agenda', description: 'Gerenciamento de consultas e agendamentos', version: '1.0.0', is_enabled: true },
      { name: 'pacientes', display_name: 'Gestão de Pacientes', description: 'Cadastro e histórico de pacientes', version: '1.0.0', is_enabled: true },
      { name: 'financeiro', display_name: 'Gestão Financeira', description: 'Controle financeiro e faturamento', version: '1.0.0', is_enabled: true },
      { name: 'estoque', display_name: 'Controle de Estoque', description: 'Gestão de materiais e produtos', version: '1.0.0', is_enabled: true },
      { name: 'proteses', display_name: 'Controle de Próteses', description: 'Gerenciamento de próteses e laboratórios', version: '1.0.0', is_enabled: true },
      { name: 'odontograma', display_name: 'Odontograma Digital', description: 'Mapeamento dental digital', version: '1.0.0', is_enabled: true },
      { name: 'automacoes', display_name: 'Automações e Integrações', description: 'Automações e integrações externas', version: '1.0.0', is_enabled: true },
      { name: 'clinica', display_name: 'Gestão da Clínica', description: 'Configurações gerais da clínica', version: '1.0.0', is_enabled: true }
    ];

    res.json(modulesList);
  }));

  // Toggle módulo (SuperAdmin)
  app.post("/api/saas/companies/:companyId/modules/:moduleId/toggle", authCheck, asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    const companyId = parseInt(req.params.companyId);
    const moduleId = req.params.moduleId;
    const { enabled } = req.body;
    
    if (user.role !== 'superadmin') {
      return res.status(403).json({ message: "Acesso negado" });
    }

    // Por enquanto, resposta de sucesso simples
    // TODO: Implementar lógica real de toggle no banco
    
    res.json({ 
      success: true, 
      companyId, 
      moduleId, 
      enabled,
      message: `Módulo ${moduleId} ${enabled ? 'ativado' : 'desativado'} para empresa ${companyId}` 
    });
  }));

  // === APIs PARA MÓDULOS DO USUÁRIO ===
  app.get("/api/user/modules", asyncHandler(async (req: Request, res: Response) => {
    // Retornar permissões baseadas nos módulos ativos da empresa
    const companyId = 3; // Dental Care Plus
    
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

  // === APIs PARA MÓDULOS DA CLÍNICA ===
  app.get("/api/clinic/modules", asyncHandler(async (req: Request, res: Response) => {
    const modules = moduleRegistry.getAllModules();
    const modulesByCategory = moduleRegistry.getModulesByCategory();
    
    res.json({
      all: modules,
      byCategory: modulesByCategory,
      loaded: modules.length
    });
  }));

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

  // === ROTAS PARA WEBSITES ===
  // Obter dados do website
  app.get("/api/website", authCheck, asyncHandler(websiteHandlers.getWebsite));
  
  // Salvar dados do website
  app.post("/api/website", authCheck, asyncHandler(websiteHandlers.saveWebsite));
  
  // Publicar website
  app.post("/api/website/publish", authCheck, asyncHandler(websiteHandlers.publishWebsite));
  
  // Preview do website
  app.get("/api/website/preview", authCheck, asyncHandler(websiteHandlers.previewWebsite));
  
  // Upload de imagens para galeria
  app.post("/api/website/upload", authCheck, asyncHandler(websiteHandlers.uploadImage));

  // === ROTAS DE DIGITALIZAÇÃO ===
  const digitalizacaoHandlers = await import('./digitalizacao-apis');
  
  app.post("/api/digitalizacao/process", authCheck, digitalizacaoHandlers.uploadMiddleware, asyncHandler(digitalizacaoHandlers.processFiles));
  app.get("/api/digitalizacao/history", authCheck, asyncHandler(digitalizacaoHandlers.getHistory));
  app.get("/api/digitalizacao/download/:id", authCheck, asyncHandler(digitalizacaoHandlers.downloadFile));
  app.delete("/api/digitalizacao/delete/:id", authCheck, asyncHandler(digitalizacaoHandlers.deleteFile));

  const httpServer = createServer(app);
  return httpServer;
}
