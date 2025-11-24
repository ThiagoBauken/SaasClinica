import { db } from '../db';
import { companies, plans, subscriptions, subscriptionHistory, usageMetrics, subscriptionInvoices } from '@shared/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { addMonths, addYears, addDays } from 'date-fns';

/**
 * Serviço de Gerenciamento de Assinaturas
 */

export class SubscriptionService {
  /**
   * Criar assinatura para uma nova empresa
   */
  async createSubscription(params: {
    companyId: number;
    planId: number;
    billingCycle: 'monthly' | 'yearly';
    paymentMethod?: 'stripe' | 'mercado_pago';
  }) {
    const { companyId, planId, billingCycle, paymentMethod } = params;

    // Buscar plano
    const [plan] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, planId))
      .limit(1);

    if (!plan) {
      throw new Error('Plano não encontrado');
    }

    // Verificar se já existe assinatura
    const existingSub = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.companyId, companyId))
      .limit(1);

    if (existingSub.length > 0) {
      throw new Error('Empresa já possui assinatura');
    }

    // Calcular datas
    const now = new Date();
    const trialEndsAt = addDays(now, plan.trialDays);
    const currentPeriodEnd = billingCycle === 'monthly'
      ? addMonths(trialEndsAt, 1)
      : addYears(trialEndsAt, 1);

    // Criar assinatura
    const [subscription] = await db
      .insert(subscriptions)
      .values({
        companyId,
        planId,
        status: 'trial',
        billingCycle,
        currentPeriodStart: now,
        currentPeriodEnd,
        trialEndsAt,
      })
      .returning();

    // Registrar histórico
    await db.insert(subscriptionHistory).values({
      subscriptionId: subscription.id,
      companyId,
      fromPlanId: null,
      toPlanId: planId,
      reason: 'initial_subscription',
    });

    // Inicializar métricas de uso
    await this.initializeUsageMetrics(companyId, currentPeriodEnd);

    return subscription;
  }

  /**
   * Alterar plano (upgrade/downgrade)
   */
  async changePlan(params: {
    companyId: number;
    newPlanId: number;
    reason?: string;
  }) {
    const { companyId, newPlanId, reason } = params;

    // Buscar assinatura atual
    const [currentSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.companyId, companyId))
      .limit(1);

    if (!currentSub) {
      throw new Error('Assinatura não encontrada');
    }

    const oldPlanId = currentSub.planId;

    // Atualizar assinatura
    const [updatedSub] = await db
      .update(subscriptions)
      .set({
        planId: newPlanId,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, currentSub.id))
      .returning();

    // Registrar histórico
    await db.insert(subscriptionHistory).values({
      subscriptionId: currentSub.id,
      companyId,
      fromPlanId: oldPlanId,
      toPlanId: newPlanId,
      reason: reason || (newPlanId > oldPlanId ? 'upgrade' : 'downgrade'),
    });

    return updatedSub;
  }

  /**
   * Cancelar assinatura
   */
  async cancelSubscription(companyId: number, reason?: string) {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.companyId, companyId))
      .limit(1);

    if (!subscription) {
      throw new Error('Assinatura não encontrada');
    }

    // Cancelar no final do período atual
    const [updatedSub] = await db
      .update(subscriptions)
      .set({
        status: 'canceled',
        canceledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id))
      .returning();

    // Registrar histórico
    await db.insert(subscriptionHistory).values({
      subscriptionId: subscription.id,
      companyId,
      fromPlanId: subscription.planId,
      toPlanId: subscription.planId,
      reason: reason || 'user_cancellation',
    });

    return updatedSub;
  }

  /**
   * Verificar se assinatura está ativa
   */
  async isSubscriptionActive(companyId: number): Promise<boolean> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.companyId, companyId))
      .limit(1);

    if (!subscription) {
      return false;
    }

    const now = new Date();

    // Trial ativo
    if (subscription.status === 'trial' && subscription.trialEndsAt && subscription.trialEndsAt > now) {
      return true;
    }

    // Assinatura ativa
    if (subscription.status === 'active' && subscription.currentPeriodEnd > now) {
      return true;
    }

    return false;
  }

  /**
   * Obter limites do plano da empresa
   */
  async getCompanyLimits(companyId: number) {
    const [subscription] = await db
      .select({
        subscription: subscriptions,
        plan: plans,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(plans.id, subscriptions.planId))
      .where(eq(subscriptions.companyId, companyId))
      .limit(1);

    if (!subscription) {
      // Retornar limites default (trial sem plano)
      return {
        maxUsers: 1,
        maxPatients: 10,
        maxAppointmentsPerMonth: 50,
        maxAutomations: 0,
        maxStorageGB: 1,
      };
    }

    return {
      maxUsers: subscription.plan.maxUsers,
      maxPatients: subscription.plan.maxPatients,
      maxAppointmentsPerMonth: subscription.plan.maxAppointmentsPerMonth,
      maxAutomations: subscription.plan.maxAutomations,
      maxStorageGB: subscription.plan.maxStorageGB,
    };
  }

  /**
   * Verificar se empresa está dentro dos limites
   */
  async checkLimit(params: {
    companyId: number;
    metricType: 'users' | 'patients' | 'appointments' | 'automations' | 'storage_gb';
    currentValue: number;
  }): Promise<{ allowed: boolean; limit: number; current: number }> {
    const { companyId, metricType, currentValue } = params;

    const limits = await this.getCompanyLimits(companyId);

    let limit: number;
    switch (metricType) {
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
        throw new Error('Tipo de métrica inválido');
    }

    return {
      allowed: currentValue < limit,
      limit,
      current: currentValue,
    };
  }

  /**
   * Atualizar métrica de uso
   */
  async updateUsageMetric(params: {
    companyId: number;
    metricType: string;
    value: number;
  }) {
    const { companyId, metricType, value } = params;

    const now = new Date();
    const periodEnd = addMonths(now, 1);

    // Buscar métrica existente no período atual
    const existingMetrics = await db
      .select()
      .from(usageMetrics)
      .where(
        and(
          eq(usageMetrics.companyId, companyId),
          eq(usageMetrics.metricType, metricType),
          gte(usageMetrics.periodEnd, now)
        )
      )
      .limit(1);

    if (existingMetrics.length > 0) {
      // Atualizar métrica existente
      return await db
        .update(usageMetrics)
        .set({
          currentValue: value,
          updatedAt: now,
        })
        .where(eq(usageMetrics.id, existingMetrics[0].id))
        .returning();
    } else {
      // Criar nova métrica
      return await db
        .insert(usageMetrics)
        .values({
          companyId,
          metricType,
          currentValue: value,
          periodStart: now,
          periodEnd,
        })
        .returning();
    }
  }

  /**
   * Obter métricas de uso da empresa
   */
  async getUsageMetrics(companyId: number) {
    return await db
      .select()
      .from(usageMetrics)
      .where(
        and(
          eq(usageMetrics.companyId, companyId),
          gte(usageMetrics.periodEnd, new Date())
        )
      );
  }

  /**
   * Inicializar métricas de uso zeradas
   */
  private async initializeUsageMetrics(companyId: number, periodEnd: Date) {
    const metricTypes = ['users', 'patients', 'appointments', 'automations', 'storage_gb'];

    for (const metricType of metricTypes) {
      await db.insert(usageMetrics).values({
        companyId,
        metricType,
        currentValue: 0,
        periodStart: new Date(),
        periodEnd,
      }).onConflictDoNothing();
    }
  }

  /**
   * Processar fim de trial
   */
  async processTrialEnd(companyId: number) {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.companyId, companyId),
          eq(subscriptions.status, 'trial')
        )
      )
      .limit(1);

    if (!subscription) {
      return null;
    }

    // Verificar se trial expirou
    const now = new Date();
    if (subscription.trialEndsAt && subscription.trialEndsAt <= now) {
      // Atualizar status para 'active' se houver método de pagamento
      // Ou 'expired' se não houver
      const newStatus = subscription.stripeCustomerId || subscription.mercadoPagoCustomerId
        ? 'active'
        : 'expired';

      return await db
        .update(subscriptions)
        .set({
          status: newStatus,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, subscription.id))
        .returning();
    }

    return null;
  }
}

export const subscriptionService = new SubscriptionService();
