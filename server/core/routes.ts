import { Router } from "express";
import { coreStorage } from "./storage";
import { insertUserSchema, insertCompanySchema, insertModuleSchema } from "@shared/schema";
import bcrypt from "bcryptjs";

const router = Router();

// Authentication routes
router.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await coreStorage.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Store user session
    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).json({ error: "Session error" });
      }
      res.json({ user: { ...user, password: undefined } });
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Could not log out" });
    }
    res.json({ message: "Logged out successfully" });
  });
});

router.get("/api/auth/me", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await coreStorage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    res.json({ user: { ...user, password: undefined } });
  } catch (error) {
    console.error("Auth check error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin routes - only for superadmin
router.get("/api/admin/companies", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await coreStorage.getUser(req.session.userId);
    if (!user || user.role !== "superadmin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const companies = await coreStorage.getCompanies();
    res.json(companies);
  } catch (error) {
    console.error("Get companies error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/admin/companies", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await coreStorage.getUser(req.session.userId);
    if (!user || user.role !== "superadmin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const validatedData = insertCompanySchema.parse(req.body);
    const company = await coreStorage.createCompany(validatedData);
    res.json(company);
  } catch (error) {
    console.error("Create company error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/admin/modules", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await coreStorage.getUser(req.session.userId);
    if (!user || user.role !== "superadmin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const modules = await coreStorage.getModules();
    res.json(modules);
  } catch (error) {
    console.error("Get modules error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/admin/modules", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await coreStorage.getUser(req.session.userId);
    if (!user || user.role !== "superadmin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const validatedData = insertModuleSchema.parse(req.body);
    const module = await coreStorage.createModule(validatedData);
    res.json(module);
  } catch (error) {
    console.error("Create module error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/admin/companies/:companyId/modules/:moduleId/enable", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await coreStorage.getUser(req.session.userId);
    if (!user || user.role !== "superadmin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const { companyId, moduleId } = req.params;
    const result = await coreStorage.enableModuleForCompany(Number(companyId), Number(moduleId));
    res.json(result);
  } catch (error) {
    console.error("Enable module error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/admin/companies/:companyId/modules/:moduleId/disable", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await coreStorage.getUser(req.session.userId);
    if (!user || user.role !== "superadmin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const { companyId, moduleId } = req.params;
    const result = await coreStorage.disableModuleForCompany(Number(companyId), Number(moduleId));
    res.json(result);
  } catch (error) {
    console.error("Disable module error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;