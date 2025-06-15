import type { Request, Response, NextFunction } from "express";

/**
 * Middleware específico para digitalização que permite acesso em desenvolvimento
 * e verifica autenticação em produção
 */
export function digitalizacaoAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  // Em desenvolvimento, permitir acesso sem autenticação
  if (process.env.NODE_ENV === "development") {
    // Simular usuário autenticado para desenvolvimento
    if (!req.user) {
      (req as any).user = {
        id: 99999,
        companyId: 3,
        username: "admin",
        role: "admin"
      };
    }
    return next();
  }
  
  // Em produção, verificar autenticação real
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ message: "Usuário não autenticado" });
  }
  
  const user = req.user as any;
  if (!user.companyId) {
    return res.status(403).json({ message: "Usuário não associado a uma empresa" });
  }
  
  next();
}