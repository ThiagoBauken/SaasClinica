import { MercadoPagoConfig, Payment, PreApproval } from 'mercadopago';
import { db } from '../db';
import { subscriptions, subscriptionInvoices, companies, users, plans } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Serviço de Integração com MercadoPago
 * Suporta assinaturas recorrentes, Pix, boleto e cartão
 */

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
  options: {
    timeout: 5000,
  },
});

const payment = new Payment(client);
const preApproval = new PreApproval(client);

interface CreateSubscriptionParams {
  companyId: number;
  planId: number;
  paymentMethod: 'credit_card' | 'pix' | 'boleto';
  billingCycle: 'monthly' | 'yearly';
  email: string;
}

export class MercadoPagoService {
  /**
   * Criar assinatura recorrente
   */
  async createSubscription(params: CreateSubscriptionParams) {
    const { companyId, planId, paymentMethod, billingCycle, email } = params;

    // Buscar plano
    const [plan] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, planId))
      .limit(1);

    if (!plan) {
      throw new Error('Plano não encontrado');
    }

    // Buscar empresa
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      throw new Error('Empresa não encontrada');
    }

    // Calcular valor
    const amount = billingCycle === 'yearly'
      ? parseFloat(plan.yearlyPrice || '0')
      : parseFloat(plan.monthlyPrice);

    // Criar assinatura no MercadoPago
    const subscriptionData = {
      reason: `Assinatura ${plan.displayName} - ${company.name}`,
      auto_recurring: {
        frequency: billingCycle === 'yearly' ? 12 : 1,
        frequency_type: 'months' as const,
        transaction_amount: amount,
        currency_id: 'BRL',
      },
      back_url: `${process.env.BASE_URL}/billing`,
      payer_email: email,
      status: 'pending' as const,
      external_reference: `company-${companyId}-plan-${planId}`,
    };

    try {
      const response = await preApproval.create({ body: subscriptionData });

      // Salvar assinatura no banco
      const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.companyId, companyId))
        .limit(1);

      if (subscription) {
        await db
          .update(subscriptions)
          .set({
            mercadoPagoSubscriptionId: response.id,
            mercadoPagoCustomerId: response.payer_id?.toString(),
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, subscription.id));
      }

      return {
        subscriptionId: response.id,
        initPoint: response.init_point,
        status: response.status,
      };
    } catch (error: any) {
      console.error('Erro ao criar assinatura MercadoPago:', error);
      throw new Error(`Erro ao criar assinatura: ${error.message}`);
    }
  }

  /**
   * Criar pagamento único (Pix ou Boleto)
   */
  async createPayment(params: {
    companyId: number;
    planId: number;
    amount: number;
    paymentMethod: 'pix' | 'boleto';
    email: string;
    description: string;
  }) {
    const { companyId, amount, paymentMethod, email, description } = params;

    const paymentData: any = {
      transaction_amount: amount,
      description,
      payment_method_id: paymentMethod === 'pix' ? 'pix' : 'bolbradesco',
      payer: {
        email,
      },
      external_reference: `company-${companyId}-${Date.now()}`,
      notification_url: `${process.env.BASE_URL}/api/webhooks/mercadopago`,
    };

    try {
      const response = await payment.create({ body: paymentData });

      // Buscar assinatura para criar fatura
      const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.companyId, companyId))
        .limit(1);

      if (subscription) {
        await db.insert(subscriptionInvoices).values({
          subscriptionId: subscription.id,
          companyId,
          amount: amount.toString(),
          status: 'pending',
          dueDate: new Date(),
          paymentMethod,
          mercadoPagoInvoiceId: response.id?.toString(),
          invoiceUrl: paymentMethod === 'pix'
            ? response.point_of_interaction?.transaction_data?.ticket_url
            : response.transaction_details?.external_resource_url,
          metadata: {
            payment_id: response.id,
            qr_code: paymentMethod === 'pix'
              ? response.point_of_interaction?.transaction_data?.qr_code
              : null,
            qr_code_base64: paymentMethod === 'pix'
              ? response.point_of_interaction?.transaction_data?.qr_code_base64
              : null,
          },
        });
      }

      return {
        paymentId: response.id,
        status: response.status,
        qrCode: paymentMethod === 'pix'
          ? response.point_of_interaction?.transaction_data?.qr_code
          : null,
        qrCodeBase64: paymentMethod === 'pix'
          ? response.point_of_interaction?.transaction_data?.qr_code_base64
          : null,
        ticketUrl: paymentMethod === 'boleto'
          ? response.transaction_details?.external_resource_url
          : null,
      };
    } catch (error: any) {
      console.error('Erro ao criar pagamento MercadoPago:', error);
      throw new Error(`Erro ao criar pagamento: ${error.message}`);
    }
  }

  /**
   * Obter status do pagamento
   */
  async getPaymentStatus(paymentId: string) {
    try {
      const response = await payment.get({ id: paymentId });
      return response;
    } catch (error) {
      console.error('Erro ao buscar status do pagamento:', error);
      throw error;
    }
  }

  /**
   * Obter status da assinatura
   */
  async getSubscriptionStatus(subscriptionId: string) {
    try {
      const response = await preApproval.get({ id: subscriptionId });
      return response;
    } catch (error) {
      console.error('Erro ao buscar status da assinatura:', error);
      throw error;
    }
  }

  /**
   * Cancelar assinatura
   */
  async cancelSubscription(subscriptionId: string) {
    try {
      const response = await preApproval.update({
        id: subscriptionId,
        body: { status: 'cancelled' },
      });

      // Atualizar no banco
      await db
        .update(subscriptions)
        .set({
          status: 'canceled',
          canceledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.mercadoPagoSubscriptionId, subscriptionId));

      return response;
    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error);
      throw error;
    }
  }

  /**
   * Verificar assinatura do webhook
   */
  verifyWebhookSignature(payload: any, xSignature: string, xRequestId: string): boolean {
    if (!process.env.MERCADOPAGO_WEBHOOK_SECRET) {
      console.warn('⚠️ MERCADOPAGO_WEBHOOK_SECRET não configurado');
      return false;
    }

    const parts = xSignature.split(',');
    const ts = parts.find(p => p.startsWith('ts='))?.split('=')[1];
    const hash = parts.find(p => p.startsWith('v1='))?.split('=')[1];

    if (!ts || !hash) return false;

    const manifest = `id:${payload.data?.id};request-id:${xRequestId};ts:${ts};`;
    const hmac = crypto.createHmac('sha256', process.env.MERCADOPAGO_WEBHOOK_SECRET);
    const calculatedHash = hmac.update(manifest).digest('hex');

    return calculatedHash === hash;
  }

  /**
   * Processar webhook do MercadoPago
   */
  async handleWebhook(payload: any) {
    const { type, data } = payload;

    console.log(`🔔 MercadoPago Webhook: ${type} para ID ${data?.id}`);

    try {
      switch (type) {
        case 'payment':
          await this.handlePaymentNotification(data.id);
          break;

        case 'subscription_preapproval':
        case 'subscription_authorized_payment':
          await this.handleSubscriptionNotification(data.id);
          break;

        default:
          console.log(`⚠️ Tipo de webhook não tratado: ${type}`);
      }
    } catch (error) {
      console.error('❌ Erro ao processar webhook MercadoPago:', error);
      throw error;
    }
  }

  /**
   * Processar notificação de pagamento
   */
  private async handlePaymentNotification(paymentId: string) {
    const paymentData = await this.getPaymentStatus(paymentId);

    // Buscar fatura
    const [invoice] = await db
      .select()
      .from(subscriptionInvoices)
      .where(eq(subscriptionInvoices.mercadoPagoInvoiceId, paymentId))
      .limit(1);

    if (!invoice) {
      console.warn(`⚠️ Fatura não encontrada para payment_id: ${paymentId}`);
      return;
    }

    // Atualizar status baseado no status do pagamento
    switch (paymentData.status) {
      case 'approved':
        await db
          .update(subscriptionInvoices)
          .set({
            status: 'paid',
            paidAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(subscriptionInvoices.id, invoice.id));

        // Ativar assinatura
        await db
          .update(subscriptions)
          .set({
            status: 'active',
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, invoice.subscriptionId));

        console.log(`✅ Pagamento MercadoPago confirmado: ${paymentId}`);
        break;

      case 'rejected':
      case 'cancelled':
        await db
          .update(subscriptionInvoices)
          .set({
            status: 'failed',
            updatedAt: new Date(),
          })
          .where(eq(subscriptionInvoices.id, invoice.id));

        console.log(`❌ Pagamento MercadoPago rejeitado: ${paymentId}`);
        break;

      case 'pending':
      case 'in_process':
        await db
          .update(subscriptionInvoices)
          .set({
            status: 'pending',
            updatedAt: new Date(),
          })
          .where(eq(subscriptionInvoices.id, invoice.id));
        break;
    }
  }

  /**
   * Processar notificação de assinatura
   */
  private async handleSubscriptionNotification(subscriptionId: string) {
    const subscriptionData = await this.getSubscriptionStatus(subscriptionId);

    // Buscar assinatura no banco
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.mercadoPagoSubscriptionId, subscriptionId))
      .limit(1);

    if (!subscription) {
      console.warn(`⚠️ Assinatura não encontrada: ${subscriptionId}`);
      return;
    }

    // Atualizar status
    let status = 'active';
    if (subscriptionData.status === 'cancelled') status = 'canceled';
    else if (subscriptionData.status === 'paused') status = 'past_due';

    await db
      .update(subscriptions)
      .set({
        status: status as any,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id));

    console.log(`✅ Assinatura MercadoPago atualizada: ${subscriptionId} -> ${status}`);
  }
}

export const mercadopagoService = new MercadoPagoService();
