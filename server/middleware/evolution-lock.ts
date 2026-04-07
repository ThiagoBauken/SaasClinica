import { Request, Response, NextFunction } from 'express';
import { db } from '../db';

const LOCK_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Middleware that enforces CFO Resolução 118/2012 immutability rules for
 * clinical evolution records.
 *
 * Treatment evolution records become read-only 24 hours after creation.
 * Any UPDATE, PUT, PATCH or DELETE request arriving after that window is
 * rejected with HTTP 403 so the record can never be retroactively altered.
 *
 * Expected route parameter: :evolutionId  (falls back to :id)
 *
 * Usage:
 *   router.put('/:evolutionId', authCheck, checkEvolutionLock, handler)
 *   router.delete('/:evolutionId', authCheck, checkEvolutionLock, handler)
 */
export async function checkEvolutionLock(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Only enforce on mutating methods
  const mutatingMethods = ['PUT', 'PATCH', 'DELETE'];
  if (!mutatingMethods.includes(req.method.toUpperCase())) {
    return next();
  }

  // Resolve the record ID from common param names
  const rawId = (req.params as Record<string, string>).evolutionId ?? req.params.id;
  const evolutionId = parseInt(rawId, 10);

  if (!evolutionId || isNaN(evolutionId)) {
    res.status(400).json({
      error: 'invalid_evolution_id',
      message: 'ID de evolução inválido ou ausente.',
    });
    return;
  }

  // Tenant guard — companyId must be present (no || 1 fallback)
  const user = (req as any).user;
  const companyId: number | undefined = user?.companyId;

  if (!companyId) {
    res.status(403).json({
      error: 'forbidden',
      message: 'Acesso não autorizado.',
    });
    return;
  }

  try {
    const result = await db.$client.query(
      `SELECT created_at
         FROM treatment_evolution
        WHERE id = $1
          AND company_id = $2
          AND deleted_at IS NULL
        LIMIT 1`,
      [evolutionId, companyId]
    );

    if (result.rows.length === 0) {
      // Let the downstream handler produce a proper 404
      return next();
    }

    const row = result.rows[0] as { created_at: Date };
    const createdAt = new Date(row.created_at);
    const lockedAt = new Date(createdAt.getTime() + LOCK_WINDOW_MS);
    const now = new Date();

    if (now > lockedAt) {
      res.status(403).json({
        error: 'evolution_locked',
        message:
          'Evolução clínica bloqueada para edição. Registros são imutáveis após 24 horas conforme CFO Resolução 118/2012.',
        lockedAt: lockedAt.toISOString(),
      });
      return;
    }

    // Still within the 24-hour editing window — attach metadata for downstream use
    (req as any).evolutionCreatedAt = createdAt;
    (req as any).evolutionLockedAt = lockedAt;

    return next();
  } catch (err) {
    // Surface DB errors as 500 so they are visible in logs
    const error = err as Error;
    res.status(500).json({
      error: 'internal_error',
      message: 'Erro ao verificar trava de evolução clínica.',
      detail: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  }
}
