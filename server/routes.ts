import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage, DatabaseStorage } from "./storage";
import { setupAuth } from "./auth";
import { parse, formatISO, addDays } from "date-fns";
import { cacheMiddleware, invalidateCache } from "./simpleCache";

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
    // Invalida o cache relacionado a pacientes
    invalidateCache('api:/api/patients');
    res.status(201).json(patient);
  }));

  app.patch("/api/patients/:id", authCheck, asyncHandler(async (req, res) => {
    const updatedPatient = await storage.updatePatient(parseInt(req.params.id), req.body);
    // Invalida caches específicos
    invalidateCache(`api:/api/patients/${req.params.id}`);
    invalidateCache('api:/api/patients');
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
  app.get("/api/automations", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
      const automations = await storage.getAutomations();
      res.json(automations);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/automations", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
      const automation = await storage.createAutomation(req.body);
      res.status(201).json(automation);
    } catch (error) {
      next(error);
    }
  });

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

  const httpServer = createServer(app);
  return httpServer;
}
