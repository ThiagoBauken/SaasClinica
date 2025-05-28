import { Express, Router } from "express";
import { ModuleDefinition } from "../../core/moduleManager";

const router = Router();

// Rotas básicas do módulo clínica (serão expandidas)
router.get("/health", (req, res) => {
  res.json({ status: "ok", module: "clinic", timestamp: new Date().toISOString() });
});

router.get("/dashboard", (req, res) => {
  res.json({ 
    message: "Clinic module dashboard",
    features: ["patients", "appointments", "procedures", "professionals"]
  });
});

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
    // Registrar todas as rotas do módulo clínica
    app.use("/api/modules/clinic", router);
    console.log("✅ Clinic module initialized and routes registered");
  },
  
  onEnable: async (companyId: number) => {
    console.log(`🏥 Clinic module enabled for company ${companyId}`);
    // Aqui você pode inicializar dados específicos da empresa
    // Como criar salas padrão, procedimentos base, etc.
  },
  
  onDisable: async (companyId: number) => {
    console.log(`🏥 Clinic module disabled for company ${companyId}`);
    // Cleanup se necessário
  }
};

export default clinicModule;