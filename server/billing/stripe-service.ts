import Stripe from 'stripe';
import { db } from '../db';
import { subscriptions, subscriptionInvoices, plans } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { subscriptionService } from './subscription-service';

/**
 * Serviço de Integração com Stripe
 */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-04-30.basil',
});

export class StripeService {
  /**
   * Criar cliente Stripe para uma empresa
   */
  async createCustomer(params: {
    companyId: number;
    email: string;
    name: string;
    phone?: string;
    metadata?: Record<string, string>;
  }) {
    const { companyId, email, name, phone, metadata } = params;

    const customer = await stripe.customers.create({
      email,
      name,
      phone,
      metadata: {
        companyId: companyId.toString(),
        ...metadata,
      },
    });

    return customer;
  }

  /**
   * Criar assinatura recorrente no Stripe
   */
  async createSubscription(params: {
    companyId: number;
    customerId: string;
    priceId: string;
    trialDays?: number;
  }) {
    const { companyId, customerId, priceId, trialDays } = params;

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: trialDays,
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        companyId: companyId.toString(),
      },
    });

    return subscription;
  }

  /**
   * Cancelar assinatura no Stripe
   */
  async cancelSubscription(stripeSubscriptionId: string, immediately = false) {
    if (immediately) {
      return await stripe.subscriptions.cancel(stripeSubscriptionId);
    } else {
      // Cancelar no final do período
      return await stripe.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    }
  }

  /**
   * Atualizar assinatura (mudar de plano)
   */
  async updateSubscription(params: {
    stripeSubscriptionId: string;
    newPriceId: string;
    prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';
  }) {
    const { stripeSubscriptionId, newPriceId, prorationBehavior = 'create_prorations' } = params;

    // Buscar assinatura atual
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

    // Atualizar item da assinatura
    return await stripe.subscriptions.update(stripeSubscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: prorationBehavior,
    });
  }

  /**
   * Criar sessão de checkout
   */
  async createCheckoutSession(params: {
    companyId: number;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    trialDays?: number;
  }) {
    const { companyId, priceId, successUrl, cancelUrl, trialDays } = params;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        trial_period_days: trialDays,
        metadata: {
          companyId: companyId.toString(),
        },
      },
      metadata: {
        companyId: companyId.toString(),
      },
    });

    return session;
  }

  /**
   * Criar portal de gerenciamento para cliente
   */
  async createCustomerPortal(params: {
    customerId: string;
    returnUrl: string;
  }) {
    const { customerId, returnUrl } = params;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session;
  }

  /**
   * Processar webhook do Stripe
   */
  async handleWebhook(payload: Buffer, signature: string) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

    try {
      const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

      console.log(`🔔 Stripe Webhook recebido: ${event.type}`);

      switch (event.type) {
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.trial_will_end':
          await this.handleTrialWillEnd(event.data.object as Stripe.Subscription);
          break;

        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        default:
          console.log(`⚠️ Evento não tratado: ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      console.error('❌ Erro ao processar webhook Stripe:', error);
      throw error;
    }
  }

  /**
   * Handler: Assinatura criada
   */
  private async handleSubscriptionCreated(subscription: Stripe.Subscription) {
    const companyId = parseInt(subscription.metadata.companyId || '0');

    if (!companyId) {
      console.error('CompanyId não encontrado no metadata da assinatura');
      return;
    }

    console.log(`✅ Assinatura criada para empresa ${companyId}`);

    // Atualizar assinatura no banco com IDs do Stripe
    await db
      .update(subscriptions)
      .set({
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer as string,
        status: subscription.status === 'trialing' ? 'trial' : 'active',
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.companyId, companyId));
  }

  /**
   * Handler: Assinatura atualizada
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const companyId = parseInt(subscription.metadata.companyId || '0');

    if (!companyId) return;

    let status = 'active';
    if (subscription.status === 'trialing') status = 'trial';
    else if (subscription.status === 'past_due') status = 'past_due';
    else if (subscription.status === 'canceled') status = 'canceled';
    else if (subscription.status === 'unpaid') status = 'expired';

    await db
      .update(subscriptions)
      .set({
        status: status as any,
        currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        canceledAt: (subscription as any).canceled_at ? new Date((subscription as any).canceled_at * 1000) : null,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

    console.log(`✅ Assinatura ${subscription.id} atualizada para status: ${status}`);
  }

  /**
   * Handler: Assinatura deletada/cancelada
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    await db
      .update(subscriptions)
      .set({
        status: 'canceled',
        canceledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

    console.log(`✅ Assinatura ${subscription.id} cancelada`);
  }

  /**
   * Handler: Trial vai acabar
   */
  private async handleTrialWillEnd(subscription: Stripe.Subscription) {
    const companyId = parseInt(subscription.metadata.companyId || '0');

    console.log(`⚠️ Trial vai acabar para empresa ${companyId} em 3 dias`);

    // TODO: Enviar email/notificação avisando que trial vai acabar
  }

  /**
   * Handler: Fatura paga
   */
  private async handleInvoicePaid(invoice: Stripe.Invoice) {
    if (!(invoice as any).subscription) return;

    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, (invoice as any).subscription as string))
      .limit(1);

    if (!subscription) return;

    // Registrar fatura como paga
    await db
      .insert(subscriptionInvoices)
      .values({
        subscriptionId: subscription.id,
        companyId: subscription.companyId,
        amount: (invoice.amount_paid / 100).toString(), // Converter centavos para reais
        status: 'paid',
        dueDate: new Date(invoice.created * 1000),
        paidAt: new Date(),
        stripeInvoiceId: invoice.id,
        paymentMethod: 'credit_card',
        invoiceUrl: invoice.hosted_invoice_url || undefined,
      })
      .onConflictDoNothing();

    console.log(`✅ Fatura ${invoice.id} paga: R$ ${invoice.amount_paid / 100}`);
  }

  /**
   * Handler: Falha no pagamento da fatura
   */
  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    if (!(invoice as any).subscription) return;

    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, (invoice as any).subscription as string))
      .limit(1);

    if (!subscription) return;

    // Atualizar status para past_due
    await db
      .update(subscriptions)
      .set({
        status: 'past_due',
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id));

    console.log(`❌ Falha no pagamento da fatura ${invoice.id} para empresa ${subscription.companyId}`);

    // TODO: Enviar email/notificação sobre falha no pagamento
  }
}

export const stripeService = new StripeService();
