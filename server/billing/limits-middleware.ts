import { Request, Response, NextFunction } from 'express';
import { subscriptionService } from './subscription-service';
import { getAvailableFeatures, getCompanyPlanName, PLAN_AI_TOKEN_LIMITS } from './feature-gate';
import { db } from '../db';
import { users, patients, appointments } from '@shared/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { startOfMonth, endOfMonth } from 'date-fns';

import { logger } from '../logger';
/**
 * Middleware para enforcement de limites por plano
 */

/**
 * Verificar limite de usuários antes de criar novo
 */
export async function checkUsersLimit(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as any;
    if (!user || !user.companyId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    // Contar usuários ativos da empresa
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(
        and(
          eq(users.companyId, user.companyId),
          eq(users.active, true)
        )
      );

    const currentUsers = result[0]?.count || 0;

    // Verificar limite
    const check = await subscriptionService.checkLimit({
      companyId: user.companyId,
      metricType: 'users',
      currentValue: currentUsers + 1, // +1 porque vamos criar um novo
    });

    if (!check.allowed) {
      return res.status(403).json({
        error: 'Limite de usuários atingido',
        message: `Seu plano permite até ${check.limit} usuários. Você já tem ${check.current}. Faça upgrade do seu plano para adicionar mais usuários.`,
        limit: check.limit,
        current: check.current,
        upgradeUrl: '/settings/billing',
      });
    }

    next();
  } catch (error) {
    logger.error({ err: error }, 'Erro ao verificar limite de usuários:');
    next(error);
  }
}

/**
 * Verificar limite de pacientes antes de criar novo
 */
export async function checkPatientsLimit(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as any;
    if (!user || !user.companyId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    // Contar pacientes da empresa
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(patients)
      .where(eq(patients.companyId, user.companyId));

    const currentPatients = result[0]?.count || 0;

    // Verificar limite
    const check = await subscriptionService.checkLimit({
      companyId: user.companyId,
      metricType: 'patients',
      currentValue: currentPatients + 1,
    });

    if (!check.allowed) {
      return res.status(403).json({
        error: 'Limite de pacientes atingido',
        message: `Seu plano permite até ${check.limit} pacientes. Você já tem ${check.current}. Faça upgrade do seu plano para cadastrar mais pacientes.`,
        limit: check.limit,
        current: check.current,
        upgradeUrl: '/settings/billing',
      });
    }

    next();
  } catch (error) {
    logger.error({ err: error }, 'Erro ao verificar limite de pacientes:');
    next(error);
  }
}

/**
 * Verificar limite de agendamentos mensais antes de criar novo
 */
export async function checkAppointmentsLimit(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as any;
    if (!user || !user.companyId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    // Contar agendamentos do mês atual
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(appointments)
      .where(
        and(
          eq(appointments.companyId, user.companyId),
          gte(appointments.startTime, monthStart),
          lte(appointments.startTime, monthEnd)
        )
      );

    const currentAppointments = result[0]?.count || 0;

    // Verificar limite
    const check = await subscriptionService.checkLimit({
      companyId: user.companyId,
      metricType: 'appointments',
      currentValue: currentAppointments + 1,
    });

    if (!check.allowed) {
      return res.status(403).json({
        error: 'Limite de agendamentos mensais atingido',
        message: `Seu plano permite até ${check.limit} agendamentos por mês. Você já criou ${check.current} agendamentos este mês. Faça upgrade do seu plano para criar mais agendamentos.`,
        limit: check.limit,
        current: check.current,
        upgradeUrl: '/settings/billing',
      });
    }

    next();
  } catch (error) {
    logger.error({ err: error }, 'Erro ao verificar limite de agendamentos:');
    next(error);
  }
}

/**
 * Verificar se a empresa ainda tem orçamento de tokens de IA no mês atual.
 * Bloqueia 429 se exceder o limite mensal do plano.
 *
 * Aplicar em rotas que disparam chamadas LLM (ex.: chatbot, IA clínica).
 */
export async function checkAITokensLimit(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as any;
    if (!user || !user.companyId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const plan = await getCompanyPlanName(user.companyId);
    const planLimit = PLAN_AI_TOKEN_LIMITS[plan] ?? 0;

    if (planLimit === 0) {
      return res.status(403).json({
        error: 'Recurso de IA não disponível',
        message: `Seu plano (${plan}) não inclui acesso a IA. Faça upgrade para professional ou enterprise.`,
        upgradeUrl: '/settings/billing',
      });
    }

    const used = await subscriptionService.getAITokenUsage(user.companyId);

    if (used >= planLimit) {
      return res.status(429).json({
        error: 'Limite mensal de tokens de IA atingido',
        message: `Seu plano (${plan}) permite ${planLimit.toLocaleString('pt-BR')} tokens de IA por mês. Você já usou ${used.toLocaleString('pt-BR')}. O limite reseta no primeiro dia do próximo mês.`,
        limit: planLimit,
        used,
        upgradeUrl: '/settings/billing',
      });
    }

    // Anexar para uso opcional do handler downstream
    (req as any).aiTokenBudget = { plan, used, limit: planLimit, remaining: planLimit - used };
    next();
  } catch (error) {
    logger.error({ err: error }, 'Erro ao verificar limite de tokens de IA');
    // Fail-closed: não permitir uso ilimitado em caso de falha
    return res.status(503).json({ error: 'Não foi possível verificar limite de IA. Tente novamente.' });
  }
}

/**
 * Verificar se feature está disponível no plano
 */
export function requireFeature(featureKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any;
      if (!user || !user.companyId) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      const { features } = await getAvailableFeatures(user.companyId);

      if (!features.includes(featureKey)) {
        return res.status(403).json({
          error: 'Feature não disponível',
          message: `A funcionalidade "${featureKey}" não está incluída no seu plano atual. Faça upgrade para ter acesso.`,
          requiredFeature: featureKey,
        });
      }

      next();
    } catch (error) {
      logger.error({ err: error }, 'Erro ao verificar feature:');
      next(error);
    }
  };
}

/**
 * Verificar se assinatura está ativa
 */
export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as any;
    if (!user || !user.companyId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const isActive = await subscriptionService.isSubscriptionActive(user.companyId);

    if (!isActive) {
      return res.status(402).json({
        error: 'Assinatura inativa',
        message: 'Sua assinatura expirou ou foi cancelada. Por favor, renove sua assinatura para continuar usando o sistema.',
        renewUrl: '/settings/billing',
      });
    }

    next();
  } catch (error) {
    logger.error({ err: error }, 'Erro ao verificar assinatura:');
    next(error);
  }
}

/**
 * Middleware combinado: Verificar assinatura ativa E limite
 */
export function checkSubscriptionAndLimit(limitType: 'users' | 'patients' | 'appointments' | 'automations') {
  return [
    requireActiveSubscription,
    limitType === 'users' ? checkUsersLimit :
    limitType === 'patients' ? checkPatientsLimit :
    limitType === 'appointments' ? checkAppointmentsLimit :
    (req: Request, res: Response, next: NextFunction) => next()
  ];
}
