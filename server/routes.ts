import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage, DatabaseStorage } from "./storage";
import { setupAuth } from "./auth";
import { parse, formatISO, addDays } from "date-fns";
import { cacheMiddleware } from "./simpleCache";
import { invalidateClusterCache } from "./clusterCache";
import { db } from "./db";
import { clinicSettings, fiscalSettings, permissions, userPermissions, commissionSettings, procedureCommissions, machineTaxes } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize database with seed data if needed
  if (storage instanceof DatabaseStorage) {
    await storage.seedInitialData();
  }
  
  // Set up authentication routes
  setupAuth(app);

  // API routes
  // --------------------------

  // Middleware para verificar autenticação em todas as rotas API
  const authCheck = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  // Função auxiliar para tratamento de erros assíncrono
  const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };

  // Patients - Com cache otimizado
  app.get("/api/patients", authCheck, cacheMiddleware(300), asyncHandler(async (req, res) => {
    const patients = await storage.getPatients();
    res.json(patients);
  }));

  app.get("/api/patients/:id", authCheck, cacheMiddleware(300), asyncHandler(async (req, res) => {
    const patient = await storage.getPatient(parseInt(req.params.id));
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }
    res.json(patient);
  }));

  app.post("/api/patients", authCheck, asyncHandler(async (req, res) => {
    const patient = await storage.createPatient(req.body);
    // Invalida o cache relacionado a pacientes em todos os workers
    invalidateClusterCache('api:/api/patients');
    res.status(201).json(patient);
  }));

  app.patch("/api/patients/:id", authCheck, asyncHandler(async (req, res) => {
    const updatedPatient = await storage.updatePatient(parseInt(req.params.id), req.body);
    // Invalida caches específicos em todos os workers
    invalidateClusterCache(`api:/api/patients/${req.params.id}`);
    invalidateClusterCache('api:/api/patients');
    res.json(updatedPatient);
  }));

  // Appointments
  app.get("/api/appointments", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
      
      let startDate: Date | undefined;
      let endDate: Date | undefined;
      
      if (req.query.date) {
        startDate = parse(req.query.date as string, 'yyyy-MM-dd', new Date());
        endDate = addDays(startDate, 1);
      }
      
      const appointments = await storage.getAppointments({
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
      const appointment = await storage.createAppointment(req.body);
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
    const automations = await storage.getAutomations();
    res.json(automations);
  }));

  app.post("/api/automations", authCheck, asyncHandler(async (req, res) => {
    const automation = await storage.createAutomation(req.body);
    res.status(201).json(automation);
  }));

  app.patch("/api/automations/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
      const updatedAutomation = await storage.updateAutomation(parseInt(req.params.id), req.body);
      res.json(updatedAutomation);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/automations/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
      await storage.deleteAutomation(parseInt(req.params.id));
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/automations/:id/toggle", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
      const updatedAutomation = await storage.updateAutomation(parseInt(req.params.id), {
        active: req.body.active,
      });
      res.json(updatedAutomation);
    } catch (error) {
      next(error);
    }
  });

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
      const newPermissions = permissionIds.map(permId => ({
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

  const httpServer = createServer(app);
  return httpServer;
}
