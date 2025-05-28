import { ModuleDefinition } from "../../core/moduleManager";
import { Router } from "express";

// Import existing clinic routes/controllers
const clinicRoutes = Router();

// Patients routes
clinicRoutes.get("/patients", async (req, res) => {
  // Move existing patients logic here
  res.json({ message: "Patients endpoint for clinic module" });
});

clinicRoutes.post("/patients", async (req, res) => {
  // Move existing patients creation logic here
  res.json({ message: "Create patient endpoint for clinic module" });
});

// Appointments routes
clinicRoutes.get("/appointments", async (req, res) => {
  // Move existing appointments logic here
  res.json({ message: "Appointments endpoint for clinic module" });
});

clinicRoutes.post("/appointments", async (req, res) => {
  // Move existing appointments creation logic here
  res.json({ message: "Create appointment endpoint for clinic module" });
});

// Professionals routes
clinicRoutes.get("/professionals", async (req, res) => {
  // Move existing professionals logic here
  res.json({ message: "Professionals endpoint for clinic module" });
});

// Financial routes
clinicRoutes.get("/financial", async (req, res) => {
  // Move existing financial logic here
  res.json({ message: "Financial endpoint for clinic module" });
});

const clinicModule: ModuleDefinition = {
  info: {
    name: "clinic",
    displayName: "Sistema Clínico",
    description: "Módulo completo para gestão de clínicas odontológicas incluindo pacientes, agendamentos, profissionais e financeiro",
    version: "1.0.0",
    isLoaded: true,
    hasBackend: true,
    hasFrontend: true,
    requiredPermissions: ["clinic.read", "clinic.write"],
  },
  routes: [
    {
      path: "/patients",
      method: "GET",
      handler: (req: any, res: any) => clinicRoutes.handle(req, res),
    },
    {
      path: "/patients",
      method: "POST",
      handler: (req: any, res: any) => clinicRoutes.handle(req, res),
    },
    {
      path: "/appointments",
      method: "GET",
      handler: (req: any, res: any) => clinicRoutes.handle(req, res),
    },
    {
      path: "/appointments",
      method: "POST",
      handler: (req: any, res: any) => clinicRoutes.handle(req, res),
    },
    {
      path: "/professionals",
      method: "GET",
      handler: (req: any, res: any) => clinicRoutes.handle(req, res),
    },
    {
      path: "/financial",
      method: "GET",
      handler: (req: any, res: any) => clinicRoutes.handle(req, res),
    },
  ],
  initialize: (app) => {
    console.log("🦷 Clinic module initialized");
  },
  onEnable: async (companyId) => {
    console.log(`🦷 Clinic module enabled for company ${companyId}`);
    // Initialize company-specific clinic data
  },
  onDisable: async (companyId) => {
    console.log(`🦷 Clinic module disabled for company ${companyId}`);
    // Cleanup company-specific clinic data if needed
  },
};

export default clinicModule;