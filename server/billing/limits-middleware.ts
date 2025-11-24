import { Request, Response, NextFunction } from 'express';
import { subscriptionService } from './subscription-service';
import { db } from '../db';
import { users, patients, appointments } from '@shared/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { startOfMonth, endOfMonth } from 'date-fns';

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
    console.error('Erro ao verificar limite de usuários:', error);
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
    console.error('Erro ao verificar limite de pacientes:', error);
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
    console.error('Erro ao verificar limite de agendamentos:', error);
    next(error);
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

      const limits = await subscriptionService.getCompanyLimits(user.companyId);

      // TODO: Implementar verificação de features específicas
      // Por enquanto, permite tudo
      next();
    } catch (error) {
      console.error('Erro ao verificar feature:', error);
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
    console.error('Erro ao verificar assinatura:', error);
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
