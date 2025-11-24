import { Request, Response, NextFunction } from 'express';
import { tenantIsolationMiddleware, resourceAccessMiddleware } from '../tenantMiddleware';

/**
 * Verifica se o usuário está autenticado
 */
export const authCheck = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized - Please log in" });
  }
  next();
};

/**
 * Middleware combinado: autenticação + tenant isolation + resource access
 */
export const tenantAwareAuth = [authCheck, tenantIsolationMiddleware, resourceAccessMiddleware];

/**
 * Verifica se o usuário tem role de admin
 */
export const adminOnly = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = req.user as any;
  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
};

/**
 * Wrapper para handlers assíncronos
 * Captura erros e passa para o error handler
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
