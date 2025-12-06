import { db } from '../db';
import { subscriptions, subscriptionInvoices, companies, users, plans } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Serviço de Integração com NOWPayments (Crypto)
 * Suporta Bitcoin, Ethereum, USDT, e mais de 300 criptomoedas
 */

const NOWPAYMENTS_API_URL = 'https://api.nowpayments.io/v1';
const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY || '';
const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET || '';

interface CreatePaymentParams {
  companyId: number;
  planId: number;
  currency: string; // btc, eth, usdt, etc.
  billingCycle: 'monthly' | 'yearly';
}

interface NOWPaymentResponse {
  payment_id: string;
  payment_status: string;
  pay_address: string;
  price_amount: number;
  price_currency: string;
  pay_amount: number;
  pay_currency: string;
  order_id: string;
  order_description: string;
  ipn_callback_url?: string;
  created_at: string;
  updated_at: string;
  purchase_id?: string;
  invoice_url?: string;
}

export class NOWPaymentsService {
  /**
   * Fazer requisição à API do NOWPayments
   */
  private async makeRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any) {
    const url = `${NOWPAYMENTS_API_URL}${endpoint}`;

    const headers: Record<string, string> = {
      'x-api-key': NOWPAYMENTS_API_KEY,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method === 'POST') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`NOWPayments API error: ${error}`);
    }

    return await response.json();
  }

  /**
   * Obter moedas disponíveis
   */
  async getAvailableCurrencies(): Promise<string[]> {
    try {
      const response = await this.makeRequest('/currencies');
      return response.currencies || [];
    } catch (error) {
      console.error('Erro ao buscar moedas:', error);
      return ['btc', 'eth', 'usdt', 'bnb', 'ltc']; // Fallback para moedas populares
    }
  }

  /**
   * Obter taxa de câmbio estimada
   */
  async getEstimatedPrice(params: {
    amount: number;
    currency_from: string; // USD, BRL, etc.
    currency_to: string; // BTC, ETH, etc.
  }): Promise<number> {
    try {
      const response = await this.makeRequest('/estimate', 'GET');
      return response.estimated_amount || 0;
    } catch (error) {
      console.error('Erro ao estimar preço:', error);
      return 0;
    }
  }

  /**
   * Criar pagamento único para assinatura
   */
  async createPayment(params: CreatePaymentParams): Promise<NOWPaymentResponse> {
    const { companyId, planId, currency, billingCycle } = params;

    // Buscar informações do plano
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

    // Criar ID único para o pedido
    const orderId = `sub-${companyId}-${Date.now()}`;

    // Criar pagamento no NOWPayments
    const paymentData = {
      price_amount: amount,
      price_currency: 'brl', // Moeda de origem
      pay_currency: currency.toLowerCase(), // Moeda crypto de destino
      order_id: orderId,
      order_description: `Assinatura ${plan.displayName} - ${billingCycle === 'yearly' ? 'Anual' : 'Mensal'}`,
      ipn_callback_url: `${process.env.BASE_URL}/api/webhooks/nowpayments`,
      success_url: `${process.env.BASE_URL}/billing?payment=success`,
      cancel_url: `${process.env.BASE_URL}/billing?payment=canceled`,
    };

    const payment = await this.makeRequest('/payment', 'POST', paymentData);

    // Criar fatura pendente no banco
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
        paymentMethod: `crypto_${currency}`,
        metadata: {
          nowpayments_payment_id: payment.payment_id,
          order_id: orderId,
          pay_currency: currency,
        },
      });
    }

    return payment;
  }

  /**
   * Verificar status de um pagamento
   */
  async getPaymentStatus(paymentId: string): Promise<any> {
    try {
      return await this.makeRequest(`/payment/${paymentId}`);
    } catch (error) {
      console.error('Erro ao buscar status do pagamento:', error);
      throw error;
    }
  }

  /**
   * Verificar assinatura do webhook (IPN)
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!NOWPAYMENTS_IPN_SECRET) {
      console.warn('⚠️ NOWPAYMENTS_IPN_SECRET não configurado');
      return false;
    }

    const hmac = crypto.createHmac('sha512', NOWPAYMENTS_IPN_SECRET);
    const calculatedSignature = hmac.update(payload).digest('hex');

    return calculatedSignature === signature;
  }

  /**
   * Processar webhook do NOWPayments
   */
  async handleWebhook(payload: any) {
    const { payment_id, payment_status, order_id, pay_currency, outcome_amount } = payload;

    console.log(`🔔 NOWPayments Webhook: ${payment_status} para pagamento ${payment_id}`);

    try {
      // Buscar fatura pelo payment_id
      const [invoice] = await db
        .select()
        .from(subscriptionInvoices)
        .where(eq(subscriptionInvoices.metadata, { nowpayments_payment_id: payment_id }))
        .limit(1);

      if (!invoice) {
        console.warn(`⚠️ Fatura não encontrada para payment_id: ${payment_id}`);
        return;
      }

      // Atualizar status baseado no status do pagamento
      switch (payment_status) {
        case 'finished':
        case 'confirmed':
          // Pagamento confirmado
          await this.handlePaymentConfirmed(invoice, payload);
          break;

        case 'sending':
        case 'confirming':
          // Pagamento em processamento
          await db
            .update(subscriptionInvoices)
            .set({
              status: 'pending',
              metadata: {
                ...(invoice.metadata as any),
                payment_status,
                last_updated: new Date().toISOString(),
              },
              updatedAt: new Date(),
            })
            .where(eq(subscriptionInvoices.id, invoice.id));
          break;

        case 'failed':
        case 'expired':
          // Pagamento falhou
          await this.handlePaymentFailed(invoice, payload);
          break;

        case 'refunded':
        case 'partially_paid':
          // Pagamento reembolsado ou parcialmente pago
          await db
            .update(subscriptionInvoices)
            .set({
              status: 'refunded',
              metadata: {
                ...(invoice.metadata as any),
                payment_status,
                outcome_amount,
              },
              updatedAt: new Date(),
            })
            .where(eq(subscriptionInvoices.id, invoice.id));
          break;
      }
    } catch (error) {
      console.error('❌ Erro ao processar webhook NOWPayments:', error);
      throw error;
    }
  }

  /**
   * Processar pagamento confirmado
   */
  private async handlePaymentConfirmed(invoice: any, payload: any) {
    // Atualizar fatura como paga
    await db
      .update(subscriptionInvoices)
      .set({
        status: 'paid',
        paidAt: new Date(),
        metadata: {
          ...(invoice.metadata as any),
          payment_status: payload.payment_status,
          outcome_amount: payload.outcome_amount,
          actually_paid: payload.actually_paid,
          pay_currency: payload.pay_currency,
        },
        updatedAt: new Date(),
      })
      .where(eq(subscriptionInvoices.id, invoice.id));

    // Atualizar assinatura para ativa
    await db
      .update(subscriptions)
      .set({
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, invoice.subscriptionId));

    console.log(`✅ Pagamento crypto confirmado para invoice ${invoice.id}`);

    // TODO: Enviar email de confirmação
  }

  /**
   * Processar pagamento falho
   */
  private async handlePaymentFailed(invoice: any, payload: any) {
    await db
      .update(subscriptionInvoices)
      .set({
        status: 'failed',
        metadata: {
          ...(invoice.metadata as any),
          payment_status: payload.payment_status,
          failure_reason: payload.payment_status,
        },
        updatedAt: new Date(),
      })
      .where(eq(subscriptionInvoices.id, invoice.id));

    console.log(`❌ Pagamento crypto falhou para invoice ${invoice.id}`);

    // TODO: Enviar email de falha
  }
}

export const nowpaymentsService = new NOWPaymentsService();
