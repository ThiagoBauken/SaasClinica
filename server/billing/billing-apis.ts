import { Request, Response } from 'express';
import { subscriptionService } from './subscription-service';
import { db } from '../db';
import { plans, subscriptions, subscriptionInvoices, usageMetrics, planFeatures, companies, users } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { sendEmail, getPlanChangedTemplate } from '../services/email-service';

import { logger } from '../logger';
/**
 * APIs de Billing e Assinaturas
 */

/**
 * GET /api/billing/plans
 * Listar todos os planos disponíveis
 */
export async function getPlans(req: Request, res: Response) {
  try {
    const allPlans = await db
      .select()
      .from(plans)
      .where(eq(plans.isActive, true))
      .orderBy(plans.sortOrder);

    // Buscar features de cada plano
    type Plan = typeof plans.$inferSelect;
    const plansWithFeatures = await Promise.all(
      allPlans.map(async (plan: Plan) => {
        const features = await db
          .select()
          .from(planFeatures)
          .where(eq(planFeatures.planId, plan.id));

        return {
          ...plan,
          featuresDetailed: features,
        };
      })
    );

    res.json(plansWithFeatures);
  } catch (error) {
    logger.error({ err: error }, 'Erro ao buscar planos:');
    res.status(500).json({ error: 'Erro ao buscar planos' });
  }
}

/**
 * GET /api/billing/subscription
 * Obter assinatura da empresa do usuário logado
 */
export async function getMySubscription(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user || !user.companyId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const [subscription] = await db
      .select({
        subscription: subscriptions,
        plan: plans,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(plans.id, subscriptions.planId))
      .where(eq(subscriptions.companyId, user.companyId))
      .limit(1);

    if (!subscription) {
      return res.status(404).json({ error: 'Assinatura não encontrada' });
    }

    // Buscar métricas de uso
    const usage = await subscriptionService.getUsageMetrics(user.companyId);

    res.json({
      ...subscription.subscription,
      plan: subscription.plan,
      usage,
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao buscar assinatura:');
    res.status(500).json({ error: 'Erro ao buscar assinatura' });
  }
}

/**
 * POST /api/billing/subscription
 * Criar nova assinatura
 */
export async function createSubscription(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user || !user.companyId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const { planId, billingCycle } = req.body;

    if (!planId || !billingCycle) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }

    const subscription = await subscriptionService.createSubscription({
      companyId: user.companyId,
      planId: parseInt(planId),
      billingCycle,
    });

    res.status(201).json(subscription);
  } catch (error: any) {
    logger.error({ err: error }, 'Erro ao criar assinatura:');
    res.status(400).json({ error: error.message || 'Erro ao criar assinatura' });
  }
}

/**
 * PUT /api/billing/subscription/plan
 * Alterar plano da assinatura (upgrade/downgrade)
 */
export async function changePlan(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user || !user.companyId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const { planId, reason } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'ID do plano é obrigatório' });
    }

    const updatedSubscription = await subscriptionService.changePlan({
      companyId: user.companyId,
      newPlanId: parseInt(planId),
      reason,
    });

    // Enviar email de notificação de mudança de plano
    try {
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, user.companyId))
        .limit(1);

      const [admin] = await db
        .select()
        .from(users)
        .where(eq(users.companyId, user.companyId))
        .limit(1);

      const [oldPlan] = await db
        .select()
        .from(plans)
        .where(eq(plans.id, updatedSubscription.fromPlanId!))
        .limit(1);

      const [newPlan] = await db
        .select()
        .from(plans)
        .where(eq(plans.id, updatedSubscription.toPlanId!))
        .limit(1);

      if (company && admin && admin.email && oldPlan && newPlan) {
        await sendEmail({
          to: admin.email,
          subject: '🔄 Plano Alterado com Sucesso - DentalSystem',
          html: getPlanChangedTemplate(company.name || 'Clínica', oldPlan.name, newPlan.name),
        });
      }
    } catch (emailError) {
      logger.error({ err: emailError }, 'Erro ao enviar email de mudança de plano:');
      // Não falhar a operação se o email falhar
    }

    res.json(updatedSubscription);
  } catch (error: any) {
    logger.error({ err: error }, 'Erro ao alterar plano:');
    res.status(400).json({ error: error.message || 'Erro ao alterar plano' });
  }
}

/**
 * DELETE /api/billing/subscription
 * Cancelar assinatura
 */
export async function cancelSubscription(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user || !user.companyId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const { reason } = req.body;

    const subscription = await subscriptionService.cancelSubscription(
      user.companyId,
      reason
    );

    res.json({
      message: 'Assinatura cancelada com sucesso',
      subscription,
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Erro ao cancelar assinatura:');
    res.status(400).json({ error: error.message || 'Erro ao cancelar assinatura' });
  }
}

/**
 * GET /api/billing/invoices
 * Listar faturas da empresa
 */
export async function getInvoices(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user || !user.companyId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const invoices = await db
      .select()
      .from(subscriptionInvoices)
      .where(eq(subscriptionInvoices.companyId, user.companyId))
      .orderBy(desc(subscriptionInvoices.dueDate));

    res.json(invoices);
  } catch (error) {
    logger.error({ err: error }, 'Erro ao buscar faturas:');
    res.status(500).json({ error: 'Erro ao buscar faturas' });
  }
}

/**
 * GET /api/billing/usage
 * Obter métricas de uso da empresa
 */
export async function getUsage(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user || !user.companyId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const usage = await subscriptionService.getUsageMetrics(user.companyId);
    const limits = await subscriptionService.getCompanyLimits(user.companyId);

    // Formatar resposta com porcentagem de uso
    interface UsageMetric { metricType: string; currentValue: number; periodStart: Date; periodEnd: Date }
    const formattedUsage = usage.map((metric: UsageMetric) => {
      let limit: number;
      switch (metric.metricType) {
        case 'users':
          limit = limits.maxUsers;
          break;
        case 'patients':
          limit = limits.maxPatients;
          break;
        case 'appointments':
          limit = limits.maxAppointmentsPerMonth;
          break;
        case 'automations':
          limit = limits.maxAutomations;
          break;
        case 'storage_gb':
          limit = limits.maxStorageGB;
          break;
        default:
          limit = 0;
      }

      const percentage = limit > 0 ? Math.round((metric.currentValue / limit) * 100) : 0;

      return {
        ...metric,
        limit,
        percentage,
        isNearLimit: percentage >= 80,
        isOverLimit: percentage >= 100,
      };
    });

    res.json({
      usage: formattedUsage,
      limits,
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao buscar métricas de uso:');
    res.status(500).json({ error: 'Erro ao buscar métricas de uso' });
  }
}

/**
 * GET /api/billing/check-limit/:metricType
 * Verificar se pode criar novo recurso (sem bloquear)
 */
export async function checkLimit(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user || !user.companyId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const { metricType } = req.params;
    const { currentValue } = req.query;

    if (!['users', 'patients', 'appointments', 'automations', 'storage_gb'].includes(metricType)) {
      return res.status(400).json({ error: 'Tipo de métrica inválido' });
    }

    const check = await subscriptionService.checkLimit({
      companyId: user.companyId,
      metricType: metricType as any,
      currentValue: parseInt(currentValue as string) || 0,
    });

    res.json(check);
  } catch (error) {
    logger.error({ err: error }, 'Erro ao verificar limite:');
    res.status(500).json({ error: 'Erro ao verificar limite' });
  }
}
