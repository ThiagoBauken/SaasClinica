import type { Request, Response, NextFunction } from "express";
import { User } from "@shared/schema";

// Extend Express Request to include tenant info
declare global {
  namespace Express {
    interface Request {
      tenant?: {
        companyId: number;
        companyName: string;
      };
    }
  }
}

/**
 * Middleware para isolamento de tenant (empresa)
 * Garante que cada usuário só acesse dados de sua empresa
 */
export function tenantIsolationMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = req.user as User;
  
  if (!user.companyId) {
    return res.status(403).json({ 
      message: "User not associated with any company" 
    });
  }

  // Adiciona informações do tenant na request
  req.tenant = {
    companyId: user.companyId,
    companyName: user.fullName // Temporário até ter company data
  };

  next();
}

/**
 * Middleware para verificar se o usuário tem acesso a um recurso específico
 */
export function resourceAccessMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.tenant) {
    return res.status(403).json({ message: "Tenant information missing" });
  }

  next();
}

/**
 * Utilitário para criar filtros tenant-aware
 */
export function createTenantFilter(companyId: number, additionalFilters?: Record<string, any>) {
  return {
    companyId,
    ...additionalFilters
  };
}