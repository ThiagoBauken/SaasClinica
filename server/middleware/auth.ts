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

/**
 * Alias para authCheck - mantido para compatibilidade com código existente
 */
export const requireAuth = authCheck;

/**
 * Extrai o companyId do usuário autenticado
 * @throws Error se o usuário não tiver companyId
 */
export const getCompanyId = (req: Request): number => {
  const user = req.user as { companyId?: number } | undefined;
  if (!user?.companyId) {
    throw new Error('User not associated with any company');
  }
  return user.companyId;
};

/**
 * Middleware de validação usando Zod
 */
export const validate = (schemas: { body?: any; query?: any; params?: any }) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      next();
    } catch (error: any) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors || error.message,
      });
    }
  };
};
