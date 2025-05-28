import express from "express";
import session from "express-session";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { coreStorage } from "./core/storage";
import coreRoutes from "./core/routes";
import { moduleManager } from "./core/moduleManager";
import bcrypt from "bcryptjs";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use("/api", limiter);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Session configuration
app.use(session({
  store: coreStorage.getSessionStore(),
  secret: process.env.SESSION_SECRET || "your-secret-key-change-this",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// Trust proxy in production
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Core routes (authentication and administration)
app.use(coreRoutes);

// Initialize module system
async function initializeModules() {
  try {
    // Create default company for superadmin
    const companies = await coreStorage.getCompanies();
    if (companies.length === 0) {
      console.log("Creating default company...");
      const defaultCompany = await coreStorage.createCompany({
        name: "Sistema Principal",
        email: "admin@sistema.com",
        active: true,
      });
      console.log("Default company created:", defaultCompany.id);

      // Create superadmin user
      const hashedPassword = await bcrypt.hash("admin123", 10);
      const superAdmin = await coreStorage.createUser({
        companyId: defaultCompany.id,
        username: "superadmin",
        password: hashedPassword,
        fullName: "Super Administrator",
        email: "admin@sistema.com",
        role: "superadmin",
        active: true,
      });
      console.log("Superadmin user created:", superAdmin.username);
    }

    // Register clinic module if it doesn't exist
    const modules = await coreStorage.getModules();
    const clinicModule = modules.find(m => m.name === "clinic");
    
    if (!clinicModule) {
      console.log("Creating clinic module...");
      await coreStorage.createModule({
        name: "clinic",
        displayName: "Clínica Odontológica",
        description: "Sistema completo de gestão para clínicas odontológicas",
        version: "1.0.0",
        isActive: true,
        requiredPermissions: ["clinic:read", "clinic:write"],
      });
      console.log("Clinic module created");
    }

    // Initialize module manager
    await moduleManager.initialize();
    console.log("Module system initialized");

    // Load module routes dynamically
    app.use("/api/modules", moduleManager.getModuleRoutes());
    console.log("Module routes loaded");

  } catch (error) {
    console.error("Failed to initialize modules:", error);
  }
}

// Start server
async function startServer() {
  try {
    await initializeModules();
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Core system running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`🔐 Authentication and administration ready`);
      console.log(`🧩 Modular architecture active`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

export default app;