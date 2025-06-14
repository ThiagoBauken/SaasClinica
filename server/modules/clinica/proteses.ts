import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import { tenantIsolationMiddleware } from "../../tenantMiddleware";
import { requireModulePermission } from "../../permissions";

export function registerProtesesRoutes(app: Express) {
  const authCheck = (req: Request, res: Response, next: Function) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    next();
  };

  const asyncHandler = (fn: (req: Request, res: Response, next: Function) => Promise<any>) => (req: Request, res: Response, next: Function) => {
    Promise.resolve(fn(req, res, next)).catch((error) => next(error));
  };

  // Listar próteses da empresa
  app.get("/api/prosthesis", 
    authCheck, 
    tenantIsolationMiddleware, 
    requireModulePermission('proteses', 'read'),
    asyncHandler(async (req: Request, res: Response) => {
      const user = req.user as any;
      const companyId = user.companyId;
      
      // Mock data for now - would come from storage
      const prosthesis = [
        {
          id: 1,
          patientId: 1,
          patientName: "Maria Silva",
          type: "Crown",
          tooth: "14",
          laboratory: "DentLab",
          status: "Em produção",
          requestDate: "2024-01-15",
          deliveryDate: "2024-01-25",
          cost: 350.00,
          notes: "Porcelana metal-free",
          companyId
        },
        {
          id: 2,
          patientId: 2,
          patientName: "João Santos",
          type: "Bridge",
          tooth: "24-26",
          laboratory: "ProLab",
          status: "Entregue",
          requestDate: "2024-01-10",
          deliveryDate: "2024-01-20",
          cost: 800.00,
          notes: "3 elementos",
          companyId
        }
      ];
      
      res.json(prosthesis);
    })
  );

  // Criar nova prótese
  app.post("/api/prosthesis",
    authCheck,
    tenantIsolationMiddleware,
    requireModulePermission('proteses', 'write'),
    asyncHandler(async (req: Request, res: Response) => {
      const user = req.user as any;
      const companyId = user.companyId;
      
      const prosthesisData = {
        ...req.body,
        companyId,
        createdBy: user.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // For now, return the created data with an ID
      const newProsthesis = {
        id: Date.now(),
        ...prosthesisData
      };
      
      res.status(201).json(newProsthesis);
    })
  );

  // Atualizar prótese
  app.patch("/api/prosthesis/:id",
    authCheck,
    tenantIsolationMiddleware,
    requireModulePermission('proteses', 'write'),
    asyncHandler(async (req: Request, res: Response) => {
      const user = req.user as any;
      const companyId = user.companyId;
      const prosthesisId = parseInt(req.params.id);
      
      const updateData = {
        ...req.body,
        updatedAt: new Date(),
        updatedBy: user.id
      };
      
      // Mock updated prosthesis
      const updatedProsthesis = {
        id: prosthesisId,
        ...updateData,
        companyId
      };
      
      res.json(updatedProsthesis);
    })
  );

  // Obter estatísticas de próteses
  app.get("/api/prosthesis/stats",
    authCheck,
    tenantIsolationMiddleware,
    requireModulePermission('proteses', 'read'),
    asyncHandler(async (req: Request, res: Response) => {
      const user = req.user as any;
      const companyId = user.companyId;
      
      const stats = {
        total: 15,
        inProduction: 5,
        delivered: 8,
        pending: 2,
        totalValue: 4250.00,
        averageCost: 283.33,
        byLaboratory: {
          "DentLab": 8,
          "ProLab": 4,
          "TechLab": 3
        },
        byType: {
          "Crown": 9,
          "Bridge": 4,
          "Implant": 2
        }
      };
      
      res.json(stats);
    })
  );

  // Obter próteses por paciente
  app.get("/api/patients/:patientId/prosthesis",
    authCheck,
    tenantIsolationMiddleware,
    requireModulePermission('proteses', 'read'),
    asyncHandler(async (req: Request, res: Response) => {
      const user = req.user as any;
      const companyId = user.companyId;
      const patientId = parseInt(req.params.patientId);
      
      // Mock patient prosthesis
      const patientProsthesis = [
        {
          id: 1,
          type: "Crown",
          tooth: "14",
          status: "Em produção",
          requestDate: "2024-01-15",
          deliveryDate: "2024-01-25",
          cost: 350.00
        }
      ];
      
      res.json(patientProsthesis);
    })
  );
}