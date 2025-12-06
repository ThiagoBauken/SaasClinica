import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { companies } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Middleware de autenticação via API Key para integrações externas (N8N, webhooks)
 *
 * Uso:
 * - Header: X-API-Key: <api_key_da_empresa>
 * - Ou Query param: ?apiKey=<api_key_da_empresa>
 *
 * Adiciona req.company com os dados da empresa autenticada
 */
export async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Buscar API Key do header ou query param
    const apiKey = req.headers['x-api-key'] as string || req.query.apiKey as string;

    if (!apiKey) {
      return res.status(401).json({
        error: 'API Key required',
        message: 'Forneça a API Key via header X-API-Key ou query param apiKey',
      });
    }

    // Buscar empresa pela API Key
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.n8nApiKey, apiKey))
      .limit(1);

    if (!company) {
      return res.status(401).json({
        error: 'Invalid API Key',
        message: 'API Key inválida ou empresa não encontrada',
      });
    }

    if (!company.active) {
      return res.status(403).json({
        error: 'Company inactive',
        message: 'Empresa desativada. Entre em contato com o suporte.',
      });
    }

    // Adicionar dados da empresa ao request
    (req as any).company = company;
    (req as any).companyId = company.id;

    next();
  } catch (error) {
    console.error('API Key auth error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Erro ao validar API Key',
    });
  }
}

/**
 * Middleware híbrido que aceita autenticação por sessão OU API Key
 * Útil para rotas que podem ser chamadas tanto pelo frontend quanto pelo N8N
 */
export function hybridAuth(req: Request, res: Response, next: NextFunction) {
  // Se já tem usuário autenticado por sessão, prossegue
  if ((req as any).user?.companyId) {
    (req as any).companyId = (req as any).user.companyId;
    return next();
  }

  // Senão, tenta autenticar via API Key
  const apiKey = req.headers['x-api-key'] as string || req.query.apiKey as string;

  if (apiKey) {
    return apiKeyAuth(req, res, next);
  }

  // Nenhuma autenticação fornecida
  return res.status(401).json({
    error: 'Authentication required',
    message: 'Forneça sessão de usuário ou API Key',
  });
}

/**
 * Gera uma nova API Key segura
 */
export function generateApiKey(): string {
  return `dk_${crypto.randomBytes(32).toString('hex')}`;
}
