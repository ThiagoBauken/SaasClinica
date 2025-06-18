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
      
      try {
        const prosthesis = await storage.getProsthesis(companyId);
        res.json(prosthesis);
      } catch (error) {
        console.error('Erro ao buscar próteses:', error);
        res.status(500).json({ error: 'Erro ao buscar próteses' });
      }
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
      
      try {
        const prosthesisData = {
          ...req.body,
          companyId
        };
        
        const newProsthesis = await storage.createProsthesis(prosthesisData);
        res.status(201).json(newProsthesis);
      } catch (error) {
        console.error('Erro ao criar prótese:', error);
        res.status(500).json({ error: 'Erro ao criar prótese' });
      }
    })
  );

  // Atualizar prótese
  app.patch("/api/prosthesis/:id",
    authCheck,
    tenantIsolationMiddleware,
    requireModulePermission('proteses', 'write'),
    asyncHandler(async (req: Request, res: Response) => {
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
          message: 'Falha ao atualizar status da prótese'
        });
      }
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