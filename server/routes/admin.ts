import { Router } from "express";
import { db } from "../db";
import { companies, modules, companyModules, users } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { moduleManager } from "../core/moduleManager";

const router = Router();

// Middleware para verificar se o usuário é superadmin
const requireSuperAdmin = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ message: "Superadmin access required" });
  }
  
  next();
};

// Listar todas as empresas
router.get("/companies", requireSuperAdmin, async (req, res) => {
  try {
    const allCompanies = await db.select().from(companies);
    res.json(allCompanies);
  } catch (error) {
    console.error("Error fetching companies:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Criar nova empresa
router.post("/companies", requireSuperAdmin, async (req, res) => {
  try {
    const { name, email, phone, address, cnpj } = req.body;
    
    const newCompany = await db.insert(companies).values({
      name,
      email,
      phone,
      address,
      cnpj,
    }).returning();
    
    res.status(201).json(newCompany[0]);
  } catch (error) {
    console.error("Error creating company:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Listar todos os módulos disponíveis
router.get("/modules", requireSuperAdmin, async (req, res) => {
  try {
    const availableModules = await moduleManager.getAvailableModules();
    const dbModules = await db.select().from(modules);
    
    const modulesList = dbModules.map(dbModule => {
      const loadedModule = availableModules.find(m => m.name === dbModule.name);
      return {
        ...dbModule,
        isLoaded: !!loadedModule,
        hasBackend: loadedModule?.hasBackend || false,
        hasFrontend: loadedModule?.hasFrontend || false,
      };
    });
    
    res.json(modulesList);
  } catch (error) {
    console.error("Error fetching modules:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Listar módulos de uma empresa específica
router.get("/companies/:companyId/modules", requireSuperAdmin, async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);
    const companyModulesList = await moduleManager.getCompanyModules(companyId);
    res.json(companyModulesList);
  } catch (error) {
    console.error("Error fetching company modules:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Ativar módulo para uma empresa
router.post("/companies/:companyId/modules/:moduleId/enable", requireSuperAdmin, async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);
    const moduleId = parseInt(req.params.moduleId);
    const { settings = {} } = req.body;
    
    await moduleManager.enableModuleForCompany(companyId, moduleId, settings);
    
    res.json({ message: "Module enabled successfully" });
  } catch (error) {
    console.error("Error enabling module:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Desativar módulo para uma empresa
router.post("/companies/:companyId/modules/:moduleId/disable", requireSuperAdmin, async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);
    const moduleId = parseInt(req.params.moduleId);
    
    await moduleManager.disableModuleForCompany(companyId, moduleId);
    
    res.json({ message: "Module disabled successfully" });
  } catch (error) {
    console.error("Error disabling module:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Listar usuários de uma empresa
router.get("/companies/:companyId/users", requireSuperAdmin, async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);
    
    const companyUsers = await db.select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      active: users.active,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.companyId, companyId));
    
    res.json(companyUsers);
  } catch (error) {
    console.error("Error fetching company users:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;