import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { tenantIsolationMiddleware } from "../tenantMiddleware";

export function registerLaboratoryRoutes(app: Express) {
  const authCheck = (req: Request, res: Response, next: Function) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    next();
  };

  const asyncHandler = (fn: (req: Request, res: Response, next: Function) => Promise<any>) => (req: Request, res: Response, next: Function) => {
    Promise.resolve(fn(req, res, next)).catch((error) => next(error));
  };

  // Listar laboratórios da empresa
  app.get("/api/laboratories", 
    authCheck, 
    tenantIsolationMiddleware, 
    asyncHandler(async (req: Request, res: Response) => {
      const user = req.user as any;
      const companyId = user.companyId;
      
      try {
        const laboratories = await storage.getLaboratories(companyId);
        res.json(laboratories);
      } catch (error) {
        console.error('Erro ao listar laboratórios:', error);
        res.status(500).json({ 
          error: 'Erro ao listar laboratórios',
          details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    })
  );

  // Criar novo laboratório
  app.post("/api/laboratories",
    authCheck,
    tenantIsolationMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const user = req.user as any;
      const companyId = user.companyId;
      
      try {
        console.log('Dados recebidos para criação de laboratório:', req.body);
        
        const laboratoryData = {
          ...req.body,
          companyId
        };
        
        console.log('Dados processados para inserção:', laboratoryData);
        
        const newLaboratory = await storage.createLaboratory(laboratoryData);
        console.log('Laboratório criado com sucesso:', newLaboratory);
        
        res.status(201).json(newLaboratory);
      } catch (error) {
        console.error('Erro detalhado ao criar laboratório:', error);
        res.status(500).json({ 
          error: 'Erro ao criar laboratório',
          details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    })
  );

  // Atualizar laboratório
  app.patch("/api/laboratories/:id",
    authCheck,
    tenantIsolationMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
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
    })
  );

  // Excluir laboratório
  app.delete("/api/laboratories/:id",
    authCheck,
    tenantIsolationMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      try {
        const user = req.user as any;
        const companyId = user.companyId;
        const laboratoryId = parseInt(req.params.id);
        
        if (!laboratoryId || isNaN(laboratoryId)) {
          return res.status(400).json({ error: 'ID de laboratório inválido' });
        }
        
        const deleted = await storage.deleteLaboratory(laboratoryId, companyId);
        
        if (!deleted) {
          return res.status(404).json({ error: 'Laboratório não encontrado' });
        }
        
        res.json({ message: 'Laboratório excluído com sucesso' });
      } catch (error) {
        console.error('Erro ao excluir laboratório:', error);
        res.status(500).json({ 
          error: 'Erro interno do servidor',
          message: 'Falha ao excluir laboratório'
        });
      }
    })
  );

  // Obter laboratório específico
  app.get("/api/laboratories/:id",
    authCheck,
    tenantIsolationMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
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
    })
  );
}