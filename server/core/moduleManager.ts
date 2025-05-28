import { Express } from "express";

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

export interface ModuleDefinition {
  info: ModuleInfo;
  initialize: (app: Express) => void;
  onEnable?: (companyId: number) => Promise<void>;
  onDisable?: (companyId: number) => Promise<void>;
}

export class ModuleManager {
  private modules: Map<string, ModuleDefinition> = new Map();
  private app: Express | null = null;

  async initialize(app: Express): Promise<void> {
    this.app = app;
    console.log("🔧 Initializing Module Manager...");
    await this.loadAvailableModules();
    await this.registerModuleRoutes();
  }

  private async loadAvailableModules() {
    // Criar módulo de clínica básico
    const clinicModule: ModuleDefinition = {
      info: {
        name: "clinic",
        displayName: "Sistema de Clínica",
        description: "Módulo completo para gestão de clínicas odontológicas com agenda, pacientes, procedimentos e profissionais",
        version: "1.0.0",
        isLoaded: true,
        hasBackend: true,
        hasFrontend: true,
        requiredPermissions: ["clinic:read", "clinic:write", "clinic:manage"]
      },
      initialize: (app: Express) => {
        // Registrar rotas básicas do módulo clínica
        app.get("/api/modules/clinic/health", (req, res) => {
          res.json({ 
            status: "ok", 
            module: "clinic", 
            timestamp: new Date().toISOString() 
          });
        });

        app.get("/api/modules/clinic/dashboard", (req, res) => {
          res.json({ 
            message: "Clinic module dashboard",
            features: ["patients", "appointments", "procedures", "professionals"]
          });
        });

        console.log("✅ Clinic module initialized and routes registered");
      }
    };

    this.modules.set("clinic", clinicModule);

    // Criar módulo financeiro
    const financialModule: ModuleDefinition = {
      info: {
        name: "financial",
        displayName: "Sistema Financeiro",
        description: "Módulo para gestão financeira, pagamentos e relatórios",
        version: "1.0.0",
        isLoaded: true,
        hasBackend: true,
        hasFrontend: true,
        requiredPermissions: ["financial:read", "financial:write"]
      },
      initialize: (app: Express) => {
        app.get("/api/modules/financial/health", (req, res) => {
          res.json({ 
            status: "ok", 
            module: "financial", 
            timestamp: new Date().toISOString() 
          });
        });
        console.log("✅ Financial module initialized");
      }
    };

    this.modules.set("financial", financialModule);

    // Criar módulo de automação
    const automationModule: ModuleDefinition = {
      info: {
        name: "automation",
        displayName: "Sistema de Automação",
        description: "Módulo para automação de processos e workflows",
        version: "1.0.0",
        isLoaded: true,
        hasBackend: true,
        hasFrontend: true,
        requiredPermissions: ["automation:read", "automation:write"]
      },
      initialize: (app: Express) => {
        app.get("/api/modules/automation/health", (req, res) => {
          res.json({ 
            status: "ok", 
            module: "automation", 
            timestamp: new Date().toISOString() 
          });
        });
        console.log("✅ Automation module initialized");
      }
    };

    this.modules.set("automation", automationModule);
  }

  private async registerModuleRoutes(): Promise<void> {
    if (!this.app) {
      throw new Error("App not initialized");
    }

    this.modules.forEach((module, name) => {
      try {
        if (module.initialize) {
          module.initialize(this.app!);
        }
      } catch (error) {
        console.error(`❌ Failed to initialize module ${name}:`, error);
      }
    });
  }

  getAvailableModules(): ModuleInfo[] {
    const modules: ModuleInfo[] = [];
    this.modules.forEach((module) => {
      modules.push(module.info);
    });
    return modules;
  }

  getModule(name: string): ModuleDefinition | undefined {
    return this.modules.get(name);
  }

  isModuleLoaded(name: string): boolean {
    return this.modules.has(name);
  }

  getModuleStats() {
    const total = this.modules.size;
    let loaded = 0;
    let withBackend = 0;
    let withFrontend = 0;

    this.modules.forEach((module) => {
      if (module.info.isLoaded) loaded++;
      if (module.info.hasBackend) withBackend++;
      if (module.info.hasFrontend) withFrontend++;
    });

    return {
      total,
      loaded,
      withBackend,
      withFrontend,
      loadedPercentage: total > 0 ? Math.round((loaded / total) * 100) : 0
    };
  }
}

export const moduleManager = new ModuleManager();