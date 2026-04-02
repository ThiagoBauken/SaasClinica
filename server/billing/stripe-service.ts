import Stripe from 'stripe';
import { db } from '../db';
import { subscriptions, subscriptionInvoices, plans, companies, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { subscriptionService } from './subscription-service';
import { logger } from '../logger';
import {
  sendEmail,
  getTrialEndingSoonTemplate,
  getPaymentFailedTemplate,
  getInvoicePaidTemplate,
} from '../services/email-service';

/**
 * Serviço de Integração com Stripe
 * Só inicializa se STRIPE_SECRET_KEY estiver configurado
 */

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const stripeEnabled = !!STRIPE_SECRET_KEY && STRIPE_SECRET_KEY !== 'sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxx';

let stripe: Stripe | null = null;
if (stripeEnabled) {
  stripe = new Stripe(STRIPE_SECRET_KEY!, {
    apiVersion: '2025-04-30.basil',
  });
  console.log('✓ Stripe initialized');
} else {
  console.log('⚠️  Stripe not configured - payment features disabled');
}

function requireStripe(): Stripe {
  if (!stripe) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.');
  }
  return stripe;
}

export class StripeService {
  /**
   * Verifica se Stripe está configurado
   */
  isEnabled(): boolean {
    return stripeEnabled;
  }

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

    const customer = await requireStripe().customers.create({
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

    const subscription = await requireStripe().subscriptions.create({
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
      return await requireStripe().subscriptions.cancel(stripeSubscriptionId);
    } else {
      // Cancelar no final do período
      return await requireStripe().subscriptions.update(stripeSubscriptionId, {
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
    const subscription = await requireStripe().subscriptions.retrieve(stripeSubscriptionId);

    // Atualizar item da assinatura
    return await requireStripe().subscriptions.update(stripeSubscriptionId, {
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

    const session = await requireStripe().checkout.sessions.create({
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

    const session = await requireStripe().billingPortal.sessions.create({
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
      const event = requireStripe().webhooks.constructEvent(payload, signature, webhookSecret);

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

    // Buscar informações da empresa e plano
    const [subscriptionData] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.companyId, companyId))
      .limit(1);

    if (!subscriptionData) return;

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    const [plan] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, subscriptionData.planId))
      .limit(1);

    // Buscar admin da empresa para enviar email
    const [admin] = await db
      .select()
      .from(users)
      .where(eq(users.companyId, companyId))
      .limit(1);

    if (!company || !plan || !admin || !admin.email) return;

    // Calcular dias restantes
    const daysLeft = subscriptionData.trialEndsAt
      ? Math.ceil((new Date(subscriptionData.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 3;

    // Enviar email de aviso
    await sendEmail({
      to: admin.email,
      subject: `⏰ Seu período de teste expira em ${daysLeft} dias`,
      html: getTrialEndingSoonTemplate(company.name || 'Clínica', daysLeft, plan.name),
    });

    logger.info({ module: 'stripe', companyId: company.id }, 'Trial ending email sent');
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
    const [insertedInvoice] = await db
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
      .onConflictDoNothing()
      .returning();

    console.log(`✅ Fatura ${invoice.id} paga: R$ ${invoice.amount_paid / 100}`);

    // Enviar email de confirmação de pagamento
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, subscription.companyId))
      .limit(1);

    const [admin] = await db
      .select()
      .from(users)
      .where(eq(users.companyId, subscription.companyId))
      .limit(1);

    if (company && admin && admin.email) {
      await sendEmail({
        to: admin.email,
        subject: '✅ Pagamento Confirmado - DentalSystem',
        html: getInvoicePaidTemplate(
          company.name || 'Clínica',
          invoice.amount_paid / 100,
          invoice.number || invoice.id || 'N/A',
          invoice.hosted_invoice_url || ''
        ),
      });

      logger.info({ module: 'stripe', companyId: company.id, invoiceId: invoice.id }, 'Payment confirmation email sent');
    }
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

    // Enviar email sobre falha no pagamento
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, subscription.companyId))
      .limit(1);

    const [plan] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, subscription.planId))
      .limit(1);

    const [admin] = await db
      .select()
      .from(users)
      .where(eq(users.companyId, subscription.companyId))
      .limit(1);

    if (company && plan && admin && admin.email) {
      await sendEmail({
        to: admin.email,
        subject: '⚠️ Problema com o Pagamento - DentalSystem',
        html: getPaymentFailedTemplate(
          company.name || 'Clínica',
          invoice.amount_due / 100,
          plan.name
        ),
      });

      logger.info({ module: 'stripe', companyId: company.id, invoiceId: invoice.id }, 'Payment failure email sent');
    }
  }

  /**
   * Create a one-time payment link for patient billing
   */
  async createPaymentLink(params: {
    amount: number; // in centavos
    description: string;
    companyId: number;
    patientId?: number;
    appointmentId?: number;
  }): Promise<{ url: string; id: string } | null> {
    if (!stripe) {
      console.warn('Stripe not configured - cannot create payment link');
      return null;
    }

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card', 'boleto'],
        line_items: [{
          price_data: {
            currency: 'brl',
            product_data: {
              name: params.description,
            },
            unit_amount: params.amount,
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${process.env.APP_URL || 'http://localhost:5000'}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL || 'http://localhost:5000'}/checkout-canceled`,
        metadata: {
          companyId: String(params.companyId),
          patientId: String(params.patientId || ''),
          appointmentId: String(params.appointmentId || ''),
          type: 'patient_payment',
        },
      });

      return { url: session.url!, id: session.id };
    } catch (error) {
      console.error('Error creating payment link:', error);
      return null;
    }
  }
}

export const stripeService = new StripeService();
