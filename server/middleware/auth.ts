import { Request, Response, NextFunction } from 'express';
import { tenantIsolationMiddleware, resourceAccessMiddleware } from '../tenantMiddleware';
import type { AuthenticatedUser } from '../types/express';

/**
 * Verifica se o usuario esta autenticado
 */
export const authCheck = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized - Please log in" });
  }
  next();
};

/**
 * Middleware combinado: autenticacao + tenant isolation + resource access
 */
export const tenantAwareAuth = [authCheck, tenantIsolationMiddleware, resourceAccessMiddleware];

/**
 * Verifica se o usuario tem role de admin
 */
export const adminOnly = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = req.user as AuthenticatedUser;
  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
};

/**
 * Verifica se o usuario tem role de superadmin
 */
export const superadminOnly = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = req.user as AuthenticatedUser;
  if (user.role !== 'superadmin') {
    return res.status(403).json({ error: "Superadmin access required" });
  }

  next();
};

/**
 * Wrapper para handlers assincronos
 * Captura erros e passa para o error handler
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Alias para authCheck - mantido para compatibilidade com codigo existente
 */
export const requireAuth = authCheck;

/**
 * Extrai o companyId do usuario autenticado de forma type-safe
 */
export const getCompanyId = (req: Request): number => {
  const user = req.user as AuthenticatedUser | undefined;
  if (!user?.companyId) {
    throw new Error('User not associated with any company');
  }
  return user.companyId;
};

/**
 * Helper type-safe para extrair o usuario autenticado
 */
export const getAuthUser = (req: Request): AuthenticatedUser => {
  const user = req.user as AuthenticatedUser | undefined;
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user;
};

/**
 * Middleware que garante companyId existe e o injeta em req.tenant
 * Elimina a necessidade de `const user = req.user as any; const companyId = user?.companyId;`
 * em cada handler individual.
 *
 * Uso: router.get('/', authCheck, requireCompany, asyncHandler(async (req, res) => {
 *   const companyId = req.tenant!.companyId; // garantido
 * }))
 */
export const requireCompany = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as AuthenticatedUser | undefined;
  if (!user?.companyId) {
    return res.status(403).json({ error: 'User not associated with any company' });
  }

  // Garante que req.tenant esta populado
  if (!req.tenant) {
    req.tenant = {
      companyId: user.companyId,
      companyName: user.fullName,
    };
  }

  next();
};

/**
 * Middleware de validacao usando Zod
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
