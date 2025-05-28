import { Express, Router } from "express";
import fs from "fs";
import path from "path";
import { db } from "../db";
import { modules, companyModules } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface ModuleInfo {
  name: string;
  displayName: string;
  description: string;
  version: string;
  isLoaded: boolean;
  hasBackend: boolean;
  hasFrontend: boolean;
  requiredPermissions: string[];
}

export interface ModuleRoute {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  handler: any;
  middleware?: any[];
}

export interface ModuleDefinition {
  info: ModuleInfo;
  routes?: ModuleRoute[];
  initialize?: (app: Express) => void;
  onEnable?: (companyId: number) => Promise<void>;
  onDisable?: (companyId: number) => Promise<void>;
}

class ModuleManager {
  private loadedModules: Map<string, ModuleDefinition> = new Map();
  private moduleRouter = Router();
  private app: Express | null = null;

  async initialize() {
    await this.loadAvailableModules();
    await this.registerModuleRoutes();
  }

  getModuleRoutes() {
    return this.moduleRouter;
  }

  private async loadAvailableModules() {
    const modulesPath = path.join(process.cwd(), "server/modules");
    
    if (!fs.existsSync(modulesPath)) {
      fs.mkdirSync(modulesPath, { recursive: true });
      return;
    }

    const moduleDirectories = fs.readdirSync(modulesPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const moduleName of moduleDirectories) {
      try {
        await this.loadModule(moduleName);
      } catch (error) {
        console.error(`Failed to load module ${moduleName}:`, error);
      }
    }
  }

  private async loadModule(moduleName: string) {
    const modulePath = path.join(__dirname, "../modules", moduleName, "index.ts");
    
    if (!fs.existsSync(modulePath)) {
      console.warn(`Module ${moduleName} does not have an index.ts file`);
      return;
    }

    try {
      const moduleDefinition = require(modulePath).default as ModuleDefinition;
      
      // Validate module definition
      if (!moduleDefinition.info || !moduleDefinition.info.name) {
        throw new Error(`Invalid module definition for ${moduleName}`);
      }

      this.loadedModules.set(moduleName, moduleDefinition);
      
      // Register module in database if not exists
      await this.registerModuleInDatabase(moduleDefinition.info);
      
      console.log(`✅ Module ${moduleName} loaded successfully`);
    } catch (error) {
      console.error(`❌ Failed to load module ${moduleName}:`, error);
    }
  }

  private async registerModuleInDatabase(moduleInfo: ModuleInfo) {
    const existingModule = await db.select()
      .from(modules)
      .where(eq(modules.name, moduleInfo.name))
      .limit(1);

    if (existingModule.length === 0) {
      await db.insert(modules).values({
        name: moduleInfo.name,
        displayName: moduleInfo.displayName,
        description: moduleInfo.description,
        version: moduleInfo.version,
        isActive: true,
        requiredPermissions: moduleInfo.requiredPermissions,
      });
    } else {
      // Update version if different
      if (existingModule[0].version !== moduleInfo.version) {
        await db.update(modules)
          .set({ 
            version: moduleInfo.version,
            updatedAt: new Date()
          })
          .where(eq(modules.id, existingModule[0].id));
      }
    }
  }

  private async registerModuleRoutes() {
    if (!this.app) return;

    for (const [moduleName, moduleDefinition] of this.loadedModules) {
      // Initialize module if it has an initialize function
      if (moduleDefinition.initialize) {
        moduleDefinition.initialize(this.app);
      }

      // Register routes with module prefix
      if (moduleDefinition.routes) {
        for (const route of moduleDefinition.routes) {
          const fullPath = `/api/modules/${moduleName}${route.path}`;
          const middlewares = [
            this.moduleAccessMiddleware(moduleName),
            ...(route.middleware || [])
          ];

          switch (route.method) {
            case 'GET':
              this.app.get(fullPath, ...middlewares, route.handler);
              break;
            case 'POST':
              this.app.post(fullPath, ...middlewares, route.handler);
              break;
            case 'PUT':
              this.app.put(fullPath, ...middlewares, route.handler);
              break;
            case 'DELETE':
              this.app.delete(fullPath, ...middlewares, route.handler);
              break;
            case 'PATCH':
              this.app.patch(fullPath, ...middlewares, route.handler);
              break;
          }
        }
      }
    }
  }

  private moduleAccessMiddleware(moduleName: string) {
    return async (req: any, res: any, next: any) => {
      try {
        if (!req.user) {
          return res.status(401).json({ message: "Authentication required" });
        }

        // Superadmin has access to all modules
        if (req.user.role === 'superadmin') {
          return next();
        }

        // Check if the user's company has this module enabled
        const moduleAccess = await db.select()
          .from(companyModules)
          .innerJoin(modules, eq(modules.id, companyModules.moduleId))
          .where(and(
            eq(modules.name, moduleName),
            eq(companyModules.companyId, req.user.companyId),
            eq(companyModules.isEnabled, true)
          ))
          .limit(1);

        if (moduleAccess.length === 0) {
          return res.status(403).json({ 
            message: `Access denied to module: ${moduleName}` 
          });
        }

        next();
      } catch (error) {
        console.error('Module access middleware error:', error);
        res.status(500).json({ message: "Internal server error" });
      }
    };
  }

  async getAvailableModules(): Promise<ModuleInfo[]> {
    return Array.from(this.loadedModules.values()).map(mod => mod.info);
  }

  async getCompanyModules(companyId: number) {
    return await db.select({
      id: modules.id,
      name: modules.name,
      displayName: modules.displayName,
      description: modules.description,
      version: modules.version,
      isActive: modules.isActive,
      requiredPermissions: modules.requiredPermissions,
      isEnabled: companyModules.isEnabled,
      settings: companyModules.settings,
    })
    .from(modules)
    .leftJoin(companyModules, 
      and(
        eq(modules.id, companyModules.moduleId),
        eq(companyModules.companyId, companyId)
      )
    );
  }

  async enableModuleForCompany(companyId: number, moduleId: number, settings: Record<string, any> = {}) {
    const module = this.loadedModules.get(await this.getModuleNameById(moduleId));
    
    const existingAssociation = await db.select()
      .from(companyModules)
      .where(and(
        eq(companyModules.companyId, companyId),
        eq(companyModules.moduleId, moduleId)
      ))
      .limit(1);

    if (existingAssociation.length > 0) {
      await db.update(companyModules)
        .set({
          isEnabled: true,
          settings,
          updatedAt: new Date(),
        })
        .where(eq(companyModules.id, existingAssociation[0].id));
    } else {
      await db.insert(companyModules).values({
        companyId,
        moduleId,
        isEnabled: true,
        settings,
      });
    }

    // Call module's onEnable hook if it exists
    if (module?.onEnable) {
      await module.onEnable(companyId);
    }
  }

  async disableModuleForCompany(companyId: number, moduleId: number) {
    const module = this.loadedModules.get(await this.getModuleNameById(moduleId));
    
    await db.update(companyModules)
      .set({ 
        isEnabled: false,
        updatedAt: new Date(),
      })
      .where(and(
        eq(companyModules.companyId, companyId),
        eq(companyModules.moduleId, moduleId)
      ));

    // Call module's onDisable hook if it exists
    if (module?.onDisable) {
      await module.onDisable(companyId);
    }
  }

  private async getModuleNameById(moduleId: number): Promise<string> {
    const module = await db.select()
      .from(modules)
      .where(eq(modules.id, moduleId))
      .limit(1);
    
    return module[0]?.name || '';
  }
}

export const moduleManager = new ModuleManager();