import { Router } from "express";
import { db } from "../db.js";
import { companies, modules, companyModules, users } from "../../shared/schema.js";
import { eq, and } from "drizzle-orm";
import { moduleManager } from "../core/moduleManager.js";

const router = Router();

// Middleware para verificar se o usuário é admin (temporariamente permitir acesso)
const requireAdmin = (req: any, res: any, next: any) => {
  // Temporariamente permitir acesso para configuração inicial
  next();
};

// Inicializar dados básicos do sistema
router.post("/initialize", requireAdmin, async (req, res) => {
  try {
    // Criar empresa de exemplo se não existir
    const existingCompany = await db.select().from(companies).where(eq(companies.id, 1)).limit(1);
    
    if (existingCompany.length === 0) {
      await db.insert(companies).values({
        name: "Clínica Dental Demo",
        email: "admin@clinica.com",
        active: true,
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias de trial
      });
    }

    // Criar módulos básicos se não existirem
    const existingModules = await db.select().from(modules);
    
    if (existingModules.length === 0) {
      const modulesToCreate = [
        {
          name: "clinic",
          displayName: "Sistema de Clínica",
          description: "Módulo completo para gestão de clínicas odontológicas",
          version: "1.0.0",
          isActive: true,
          requiredPermissions: ["clinic:read", "clinic:write"]
        },
        {
          name: "financial",
          displayName: "Sistema Financeiro",
          description: "Módulo para gestão financeira e pagamentos",
          version: "1.0.0",
          isActive: true,
          requiredPermissions: ["financial:read", "financial:write"]
        },
        {
          name: "automation",
          displayName: "Sistema de Automação",
          description: "Módulo para automação de processos",
          version: "1.0.0",
          isActive: true,
          requiredPermissions: ["automation:read", "automation:write"]
        }
      ];

      await db.insert(modules).values(modulesToCreate);
    }

    // Ativar módulos para a empresa demo
    const companyId = 1;
    const allModules = await db.select().from(modules);
    
    for (const module of allModules) {
      const existingCompanyModule = await db.select()
        .from(companyModules)
        .where(and(
          eq(companyModules.companyId, companyId),
          eq(companyModules.moduleId, module.id)
        ))
        .limit(1);

      if (existingCompanyModule.length === 0) {
        await db.insert(companyModules).values({
          companyId: companyId,
          moduleId: module.id,
          isEnabled: true,
          settings: {}
        });
      }
    }

    res.json({ message: "Sistema inicializado com sucesso!" });
  } catch (error) {
    console.error("Erro ao inicializar sistema:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// Listar módulos disponíveis
router.get("/modules", requireAdmin, async (req, res) => {
  try {
    const availableModules = moduleManager.getAvailableModules();
    res.json(availableModules);
  } catch (error) {
    console.error("Erro ao buscar módulos:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// Listar empresas
router.get("/companies", requireAdmin, async (req, res) => {
  try {
    const allCompanies = await db.select().from(companies);
    res.json(allCompanies);
  } catch (error) {
    console.error("Erro ao buscar empresas:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// Obter módulos de uma empresa específica
router.get("/companies/:companyId/modules", requireAdmin, async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);
    
    const companyModulesResult = await db
      .select({
        moduleId: companyModules.moduleId,
        moduleName: modules.name,
        displayName: modules.displayName,
        description: modules.description,
        version: modules.version,
        isEnabled: companyModules.isEnabled,
        settings: companyModules.settings
      })
      .from(companyModules)
      .innerJoin(modules, eq(companyModules.moduleId, modules.id))
      .where(eq(companyModules.companyId, companyId));

    res.json(companyModulesResult);
  } catch (error) {
    console.error("Erro ao buscar módulos da empresa:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// Ativar/Desativar módulo para uma empresa
router.put("/companies/:companyId/modules/:moduleId", requireAdmin, async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);
    const moduleId = parseInt(req.params.moduleId);
    const { isEnabled, settings } = req.body;

    await db
      .update(companyModules)
      .set({
        isEnabled: isEnabled,
        settings: settings || {},
        updatedAt: new Date()
      })
      .where(and(
        eq(companyModules.companyId, companyId),
        eq(companyModules.moduleId, moduleId)
      ));

    // Executar callbacks do módulo se disponível
    const module = moduleManager.getModule(req.params.moduleId);
    if (module) {
      if (isEnabled && module.onEnable) {
        await module.onEnable(companyId);
      } else if (!isEnabled && module.onDisable) {
        await module.onDisable(companyId);
      }
    }

    res.json({ message: "Módulo atualizado com sucesso!" });
  } catch (error) {
    console.error("Erro ao atualizar módulo:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// Criar nova empresa
router.post("/companies", requireAdmin, async (req, res) => {
  try {
    const { name, email, phone, address, cnpj } = req.body;
    
    const newCompany = await db.insert(companies).values({
      name,
      email,
      phone,
      address,
      cnpj,
      active: true,
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias de trial
    }).returning();

    res.json(newCompany[0]);
  } catch (error) {
    console.error("Erro ao criar empresa:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// Dashboard administrativo - estatísticas gerais
router.get("/dashboard", requireAdmin, async (req, res) => {
  try {
    const totalCompanies = await db.select().from(companies);
    const activeCompanies = totalCompanies.filter(c => c.active);
    const totalUsers = await db.select().from(users);
    
    const availableModules = moduleManager.getAvailableModules();
    const moduleStats = moduleManager.getModuleStats();

    const stats = {
      companies: {
        total: totalCompanies.length,
        active: activeCompanies.length,
        trial: activeCompanies.filter(c => c.trialEndsAt && c.trialEndsAt > new Date()).length
      },
      users: {
        total: totalUsers.length,
        active: totalUsers.filter(u => u.active).length
      },
      modules: {
        available: availableModules.length,
        ...moduleStats
      }
    };

    res.json(stats);
  } catch (error) {
    console.error("Erro ao buscar estatísticas:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

export default router;