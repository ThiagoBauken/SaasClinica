/**
 * Impersonation context middleware.
 *
 * Quando o admin inicia "Acessar como usuário", a sessão recebe
 * `impersonatedBy` (id do admin original). Este middleware lê essa flag e
 * popula `req.impersonator` para que outros handlers / o frontend possam
 * identificar a operação e mostrar o banner persistente.
 *
 * Não substitui `req.user` (continua sendo o usuário-alvo, para que
 * `companyId` e `role` reflitam o contexto do alvo). Apenas anexa info
 * extra do admin original.
 */
import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

declare global {
  namespace Express {
    interface Request {
      impersonator?: { id: number; username: string; fullName: string };
    }
    interface Session {
      impersonatedBy?: number;
    }
  }
}

export async function impersonationContext(req: Request, res: Response, next: NextFunction) {
  try {
    const impersonatedBy = (req.session as any)?.impersonatedBy as number | undefined;
    if (!impersonatedBy) return next();

    const admin = await storage.getUser(impersonatedBy);
    if (admin) {
      req.impersonator = {
        id: admin.id,
        username: admin.username,
        fullName: admin.fullName,
      };
      // Header informativo (não confidencial — útil para debug client-side)
      res.setHeader('X-Impersonating', 'true');
    }
  } catch {
    // Não bloquear request por erro nesse middleware
  }
  next();
}
