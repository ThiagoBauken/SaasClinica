import { Express } from "express";
import { db } from "./db";

export function setupTestRoutes(app: Express) {
  // Rotas de teste para o painel SaaS (sem autenticação)
  app.get("/api/test/saas/companies", async (req, res) => {
    try {
      const result = await db.$client.query('SELECT * FROM companies ORDER BY name');
      res.json(result.rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/test/saas/companies/:companyId/modules", async (req, res) => {
    try {
      const { companyId } = req.params;
      const result = await db.$client.query(`
        SELECT 
          m.id, m.name, m.display_name, m.description,
          COALESCE(cm.is_enabled, false) as enabled
        FROM modules m
        LEFT JOIN company_modules cm ON m.id = cm.module_id AND cm.company_id = $1
        ORDER BY m.display_name
      `, [companyId]);
      
      res.json(result.rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/test/saas/companies/:companyId/modules/:moduleId/toggle", async (req, res) => {
    try {
      const { companyId, moduleId } = req.params;
      const { enabled } = req.body;
      
      const query = enabled 
        ? `INSERT INTO company_modules (company_id, module_id, is_enabled, created_at, updated_at) 
           VALUES ($1, $2, true, NOW(), NOW()) 
           ON CONFLICT (company_id, module_id) 
           DO UPDATE SET is_enabled = true, updated_at = NOW()`
        : `UPDATE company_modules SET is_enabled = false, updated_at = NOW() 
           WHERE company_id = $1 AND module_id = $2`;
           
      await db.$client.query(query, [companyId, moduleId]);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}