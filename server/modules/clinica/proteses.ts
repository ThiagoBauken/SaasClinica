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
      
      // Dados de próteses compatíveis com o frontend
      const prosthesis = [
        {
          id: 1,
          patientId: 1,
          patientName: "Maria Silva",
          professionalId: 1,
          professionalName: "Dr. Ana Silva",
          type: "Coroa",
          description: "Coroa de cerâmica no dente 36",
          laboratory: "Lab Dental",
          sentDate: "2024-12-10",
          expectedReturnDate: "2024-12-20",
          returnDate: null,
          status: "sent",
          observations: "Paciente com sensibilidade",
          labels: ["urgente", "premium"],
          createdAt: "2024-12-01",
          updatedAt: "2024-12-10",
          companyId
        },
        {
          id: 2,
          patientId: 2,
          patientName: "João Pereira",
          professionalId: 2,
          professionalName: "Dr. Carlos Mendes",
          type: "Ponte",
          description: "Ponte fixa nos dentes 11, 12 e 13",
          laboratory: "Odonto Tech",
          sentDate: "2024-12-15",
          expectedReturnDate: "2024-12-25",
          returnDate: null,
          status: "sent",
          observations: "Usar material resistente",
          labels: ["prioridade"],
          createdAt: "2024-12-05",
          updatedAt: "2024-12-15",
          companyId
        },
        {
          id: 3,
          patientId: 3,
          patientName: "Ana Oliveira",
          professionalId: 3,
          professionalName: "Dr. Juliana Costa",
          type: "Prótese Total",
          description: "Prótese total superior",
          laboratory: "Prótese Premium",
          sentDate: null,
          expectedReturnDate: null,
          returnDate: null,
          status: "pending",
          observations: "Paciente alérgico a metal",
          labels: ["provisorio"],
          createdAt: "2024-12-18",
          updatedAt: null,
          companyId
        },
        {
          id: 4,
          patientId: 1,
          patientName: "Maria Silva",
          professionalId: 1,
          professionalName: "Dr. Ana Silva",
          type: "Faceta",
          description: "Facetas nos dentes 21 e 22",
          laboratory: "Lab Dental",
          sentDate: "2024-12-05",
          expectedReturnDate: "2024-12-15",
          returnDate: "2024-12-17",
          status: "returned",
          observations: "Cor A2",
          labels: ["premium", "definitivo"],
          createdAt: "2024-11-28",
          updatedAt: "2024-12-17",
          companyId
        },
        {
          id: 5,
          patientId: 2,
          patientName: "João Pereira",
          professionalId: 3,
          professionalName: "Dr. Juliana Costa",
          type: "Inlay",
          description: "Inlay no dente 46",
          laboratory: "Odonto Tech",
          sentDate: "2024-12-01",
          expectedReturnDate: "2024-12-10",
          returnDate: "2024-12-12",
          status: "completed",
          observations: "Prioridade alta",
          labels: ["retrabalho", "urgente"],
          createdAt: "2024-11-25",
          updatedAt: "2024-12-18",
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
      try {
        const user = req.user as any;
        const companyId = user.companyId;
        const prosthesisId = parseInt(req.params.id);
        
        if (!prosthesisId || isNaN(prosthesisId)) {
          return res.status(400).json({ error: 'ID de prótese inválido' });
        }
        
        const updateData = {
          ...req.body,
          updatedAt: new Date().toISOString(),
          updatedBy: user.id
        };
        
        // Simular busca e atualização no banco
        const updatedProsthesis = {
          id: prosthesisId,
          patientId: updateData.patientId || 1,
          patientName: updateData.patientName || "Maria Silva",
          professionalId: updateData.professionalId || 1,
          professionalName: updateData.professionalName || "Dr. João",
          type: updateData.type || "Crown",
          description: updateData.description || "Coroa de porcelana",
          laboratory: updateData.laboratory || "DentLab",
          status: updateData.status || "in_progress",
          sentDate: updateData.sentDate || null,
          expectedReturnDate: updateData.expectedReturnDate || null,
          returnDate: updateData.returnDate || null,
          observations: updateData.observations || null,
          labels: updateData.labels || [],
          cost: updateData.cost || 350.00,
          notes: updateData.notes || "",
          companyId,
          createdAt: "2024-01-15T10:00:00.000Z",
          updatedAt: updateData.updatedAt
        };
        
        res.json({
          success: true,
          data: updatedProsthesis,
          message: 'Status atualizado com sucesso'
        });
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