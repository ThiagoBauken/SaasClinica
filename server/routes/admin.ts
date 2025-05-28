import { Router } from "express";
import { db } from "../db";
import { companies, companyModules, users } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { moduleManager } from "../core/moduleManager";

const router = Router();

// Middleware para verificar se o usuário é admin
const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: "Acesso negado. Apenas administradores podem acessar esta funcionalidade." });
  }
  next();
};

// ========================================
// GERENCIAMENTO DE EMPRESAS
// ========================================

// Listar todas as empresas
router.get("/companies", requireAdmin, async (req, res) => {
  try {
    const companiesList = await db
      .select()
      .from(companies)
      .orderBy(companies.name);

    res.json(companiesList);
  } catch (error) {
    console.error("Erro ao buscar empresas:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// Criar nova empresa
router.post("/companies", requireAdmin, async (req, res) => {
  try {
    const { name, email, phone, address, subscription } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "Nome e email são obrigatórios" });
    }

    const [company] = await db
      .insert(companies)
      .values({
        name,
        email,
        phone,
        address,
        subscription: subscription || 'trial',
        active: true
      })
      .returning();

    res.status(201).json(company);
  } catch (error) {
    console.error("Erro ao criar empresa:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// Atualizar empresa
router.put("/companies/:id", requireAdmin, async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    const { name, email, phone, address, subscription, active } = req.body;

    const [company] = await db
      .update(companies)
      .set({
        name,
        email,
        phone,
        address,
        subscription,
        active,
        updatedAt: new Date()
      })
      .where(eq(companies.id, companyId))
      .returning();

    if (!company) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    res.json(company);
  } catch (error) {
    console.error("Erro ao atualizar empresa:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ========================================
// GERENCIAMENTO DE MÓDULOS
// ========================================

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

// Listar módulos de uma empresa
router.get("/companies/:id/modules", requireAdmin, async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);

    const companyModulesList = await db
      .select()
      .from(companyModules)
      .where(eq(companyModules.companyId, companyId));

    res.json(companyModulesList);
  } catch (error) {
    console.error("Erro ao buscar módulos da empresa:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// Ativar módulo para uma empresa
router.post("/companies/:id/modules/:moduleName/enable", requireAdmin, async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    const moduleName = req.params.moduleName;

    // Verificar se o módulo existe
    const module = moduleManager.getModule(moduleName);
    if (!module) {
      return res.status(404).json({ error: "Módulo não encontrado" });
    }

    // Verificar se a empresa existe
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId));

    if (!company) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    // Verificar se o módulo já está ativo
    const existingModule = await db
      .select()
      .from(companyModules)
      .where(and(
        eq(companyModules.companyId, companyId),
        eq(companyModules.moduleName, moduleName)
      ));

    if (existingModule.length > 0) {
      return res.status(400).json({ error: "Módulo já está ativo para esta empresa" });
    }

    // Ativar o módulo
    const [companyModule] = await db
      .insert(companyModules)
      .values({
        companyId,
        moduleName,
        enabled: true,
        settings: {}
      })
      .returning();

    // Executar callback de ativação do módulo
    if (module.onEnable) {
      await module.onEnable(companyId);
    }

    res.status(201).json(companyModule);
  } catch (error) {
    console.error("Erro ao ativar módulo:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// Desativar módulo para uma empresa
router.post("/companies/:id/modules/:moduleName/disable", requireAdmin, async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    const moduleName = req.params.moduleName;

    // Verificar se o módulo existe
    const module = moduleManager.getModule(moduleName);
    if (!module) {
      return res.status(404).json({ error: "Módulo não encontrado" });
    }

    // Desativar o módulo
    const [companyModule] = await db
      .update(companyModules)
      .set({
        enabled: false,
        updatedAt: new Date()
      })
      .where(and(
        eq(companyModules.companyId, companyId),
        eq(companyModules.moduleName, moduleName)
      ))
      .returning();

    if (!companyModule) {
      return res.status(404).json({ error: "Módulo não encontrado para esta empresa" });
    }

    // Executar callback de desativação do módulo
    if (module.onDisable) {
      await module.onDisable(companyId);
    }

    res.json(companyModule);
  } catch (error) {
    console.error("Erro ao desativar módulo:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ========================================
// GERENCIAMENTO DE USUÁRIOS
// ========================================

// Listar todos os usuários (admin)
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const usersList = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        companyId: users.companyId,
        active: users.active,
        createdAt: users.createdAt
      })
      .from(users)
      .orderBy(users.createdAt);

    res.json(usersList);
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// Dashboard administrativo
router.get("/dashboard", requireAdmin, async (req, res) => {
  try {
    // Estatísticas gerais
    const totalCompanies = await db.select().from(companies);
    const totalUsers = await db.select().from(users);
    const totalModules = moduleManager.getAvailableModules();

    const stats = {
      companies: {
        total: totalCompanies.length,
        active: totalCompanies.filter(c => c.active).length,
        trial: totalCompanies.filter(c => c.subscription === 'trial').length,
        premium: totalCompanies.filter(c => c.subscription === 'premium').length
      },
      users: {
        total: totalUsers.length,
        active: totalUsers.filter(u => u.active).length,
        admins: totalUsers.filter(u => u.role === 'admin').length,
        dentists: totalUsers.filter(u => u.role === 'dentist').length,
        secretaries: totalUsers.filter(u => u.role === 'secretary').length
      },
      modules: {
        available: totalModules.length,
        loaded: totalModules.filter(m => m.isLoaded).length
      }
    };

    res.json(stats);
  } catch (error) {
    console.error("Erro ao buscar estatísticas:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

export default router;