import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import { tenantIsolationMiddleware } from "../../tenantMiddleware";
import { requireModulePermission } from "../../permissions";

export function registerAutomacoesRoutes(app: Express) {
  const authCheck = (req: Request, res: Response, next: Function) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    next();
  };

  const asyncHandler = (fn: (req: Request, res: Response, next: Function) => Promise<any>) => (req: Request, res: Response, next: Function) => {
    Promise.resolve(fn(req, res, next)).catch((error) => next(error));
  };

  // Listar automações da empresa
  app.get("/api/automations", 
    authCheck, 
    tenantIsolationMiddleware, 
    requireModulePermission('automacoes', 'read'),
    asyncHandler(async (req: Request, res: Response) => {
      const user = req.user as any;
      const companyId = user.companyId;
      
      const automations = await storage.getAutomations(companyId);
      res.json(automations);
    })
  );

  // Criar nova automação
  app.post("/api/automations",
    authCheck,
    tenantIsolationMiddleware,
    requireModulePermission('automacoes', 'write'),
    asyncHandler(async (req: Request, res: Response) => {
      const user = req.user as any;
      const companyId = user.companyId;
      
      const automationData = {
        ...req.body,
        companyId,
        userId: user.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const automation = await storage.createAutomation(automationData, companyId);
      res.status(201).json(automation);
    })
  );

  // Atualizar automação
  app.patch("/api/automations/:id",
    authCheck,
    tenantIsolationMiddleware,
    requireModulePermission('automacoes', 'write'),
    asyncHandler(async (req: Request, res: Response) => {
      const user = req.user as any;
      const companyId = user.companyId;
      const automationId = parseInt(req.params.id);
      
      const updateData = {
        ...req.body,
        updatedAt: new Date()
      };
      
      const automation = await storage.updateAutomation(automationId, updateData, companyId);
      res.json(automation);
    })
  );

  // Deletar automação
  app.delete("/api/automations/:id",
    authCheck,
    tenantIsolationMiddleware,
    requireModulePermission('automacoes', 'delete'),
    asyncHandler(async (req: Request, res: Response) => {
      const user = req.user as any;
      const companyId = user.companyId;
      const automationId = parseInt(req.params.id);
      
      await storage.deleteAutomation(automationId, companyId);
      res.status(204).send();
    })
  );

  // Executar automação manualmente
  app.post("/api/automations/:id/execute",
    authCheck,
    tenantIsolationMiddleware,
    requireModulePermission('automacoes', 'admin'),
    asyncHandler(async (req: Request, res: Response) => {
      const user = req.user as any;
      const companyId = user.companyId;
      const automationId = parseInt(req.params.id);
      
      // Implementar lógica de execução de automação
      // Por enquanto, retorna sucesso
      res.json({ 
        success: true, 
        message: "Automação executada com sucesso",
        executedAt: new Date(),
        executedBy: user.id
      });
    })
  );

  // Obter estatísticas de automações
  app.get("/api/automations/stats",
    authCheck,
    tenantIsolationMiddleware,
    requireModulePermission('automacoes', 'read'),
    asyncHandler(async (req: Request, res: Response) => {
      const user = req.user as any;
      const companyId = user.companyId;
      
      const automations = await storage.getAutomations(companyId);
      
      const stats = {
        total: automations.length,
        active: automations.filter(a => a.active).length,
        inactive: automations.filter(a => !a.active).length,
        byType: automations.reduce((acc: any, automation) => {
          acc[automation.triggerType] = (acc[automation.triggerType] || 0) + 1;
          return acc;
        }, {})
      };
      
      res.json(stats);
    })
  );
}