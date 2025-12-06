import type { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { modules, companyModules } from "@shared/schema";

// Tipos de permissões disponíveis
export type Permission = "read" | "write" | "delete" | "admin";

// Interface para verificação de permissões
interface PermissionCheck {
  module: string;
  permission: Permission;
}

/**
 * Middleware para verificar permissões de módulo
 */
export function requireModulePermission(moduleName: string, permission: Permission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated() || !req.tenant) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = req.user as any;
      const hasPermission = await checkUserModulePermission(
        user.id,
        req.tenant.companyId,
        moduleName,
        permission
      );

      if (!hasPermission) {
        return res.status(403).json({ 
          message: `Access denied: ${permission} permission required for ${moduleName} module` 
        });
      }

      next();
    } catch (error) {
      console.error("Permission check error:", error);
      res.status(500).json({ message: "Permission check failed" });
    }
  };
}

/**
 * Verifica se um usuário tem permissão específica para um módulo
 */
export async function checkUserModulePermission(
  userId: number,
  companyId: number,
  moduleName: string,
  permission: Permission
): Promise<boolean> {
  try {
    // Buscar o módulo
    const [module] = await db
      .select()
      .from(modules)
      .where(eq(modules.name, moduleName));

    if (!module) {
      return false;
    }

    // Verificar se o módulo está ativo para a empresa
    const [companyModule] = await db
      .select()
      .from(companyModules)
      .where(
        and(
          eq(companyModules.companyId, companyId),
          eq(companyModules.moduleId, module.id),
          eq(companyModules.isEnabled, true)
        )
      );

    if (!companyModule) {
      return false;
    }

    // Buscar permissões do usuário para este módulo
    const result = await db.$client.query(`
      SELECT permissions 
      FROM user_module_permissions 
      WHERE user_id = $1 AND module_id = $2 AND company_id = $3
    `, [userId, module.id, companyId]);

    if (result.rows.length === 0) {
      return false;
    }

    const userPermissions = result.rows[0].permissions;
    return Array.isArray(userPermissions) && userPermissions.includes(permission);
  } catch (error) {
    console.error("Error checking module permission:", error);
    return false;
  }
}

/**
 * Busca todos os módulos e permissões de um usuário
 */
export async function getUserModulePermissions(userId: number, companyId: number) {
  try {
    const result = await db.$client.query(`
      SELECT 
        m.name as module_name,
        m.display_name,
        m.description,
        ump.permissions,
        cm.is_enabled as module_enabled
      FROM modules m
      JOIN company_modules cm ON m.id = cm.module_id
      LEFT JOIN user_module_permissions ump ON m.id = ump.module_id AND ump.user_id = $1
      WHERE cm.company_id = $2
      ORDER BY m.display_name
    `, [userId, companyId]);

    return result.rows.map((row: any) => ({
      moduleName: row.module_name,
      displayName: row.display_name,
      description: row.description,
      permissions: row.permissions || [],
      moduleEnabled: row.module_enabled
    }));
  } catch (error) {
    console.error("Error getting user module permissions:", error);
    return [];
  }
}

/**
 * Concede permissões de módulo para um usuário
 */
export async function grantModulePermission(
  userId: number,
  companyId: number,
  moduleName: string,
  permissions: Permission[],
  grantedBy: number
): Promise<boolean> {
  try {
    // Buscar o módulo
    const [module] = await db
      .select()
      .from(modules)
      .where(eq(modules.name, moduleName));

    if (!module) {
      throw new Error("Module not found");
    }

    // Inserir ou atualizar permissões
    await db.$client.query(`
      INSERT INTO user_module_permissions (user_id, company_id, module_id, permissions, granted_by)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, module_id)
      DO UPDATE SET 
        permissions = $4,
        granted_by = $5,
        granted_at = NOW()
    `, [userId, companyId, module.id, JSON.stringify(permissions), grantedBy]);

    return true;
  } catch (error) {
    console.error("Error granting module permission:", error);
    return false;
  }
}