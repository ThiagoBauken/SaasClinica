/**
 * Unified Payment Gateway
 * Abstracts Stripe, MercadoPago and NOWPayments behind a single interface.
 * The correct provider is selected based on the payment method and the
 * company's preferred provider stored in fiscal_settings.
 */

import { logger } from '../logger';

const gwLogger = logger.child({ module: 'payment-gateway' });

export interface PaymentRequest {
  companyId: number;
  patientId: number;
  /** Amount in cents (integer) */
  amount: number;
  description: string;
  method: 'pix' | 'boleto' | 'credit_card' | 'debit_card' | 'crypto';
  installments?: number;
  patientEmail?: string;
  patientCpf?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  status: 'pending' | 'approved' | 'rejected' | 'processing';
  pixQrCode?: string;
  pixCopyPaste?: string;
  boletoUrl?: string;
  cardReceiptUrl?: string;
  error?: string;
}

interface PaymentSettings {
  preferredProvider?: 'stripe' | 'mercadopago';
  stripeSecretKey?: string;
  mercadoPagoAccessToken?: string;
  nowPaymentsApiKey?: string;
  [key: string]: unknown;
}

export class UnifiedPaymentGateway {
  /**
   * Create a new patient payment using the best available provider.
   */
  async createPayment(req: PaymentRequest): Promise<PaymentResult> {
    gwLogger.info(
      { companyId: req.companyId, method: req.method, amount: req.amount },
      'Creating payment'
    );

    if (req.method === 'crypto') {
      return this.createCryptoPayment(req);
    }

    const settings = await this.getPaymentSettings(req.companyId);

    if (settings.preferredProvider === 'stripe') {
      return this.createStripePayment(req, settings);
    }

    return this.createMercadoPagoPayment(req, settings);
  }

  /**
   * Retrieve the current status of a transaction from the provider that
   * originally processed it. The provider is inferred from the transactionId
   * prefix written at creation time.
   */
  async getPaymentStatus(
    companyId: number,
    transactionId: string
  ): Promise<PaymentResult> {
    gwLogger.info({ companyId, transactionId }, 'Getting payment status');

    try {
      if (transactionId.startsWith('stripe_')) {
        const { stripeService } = await import('../billing/stripe-service');
        if (!stripeService) {
          return { success: false, status: 'rejected', error: 'Stripe not configured' };
        }
        // stripeService exposes raw Stripe instance via .stripe — use it if present,
        // otherwise fall back to a best-effort status response.
        const rawId = transactionId.replace('stripe_', '');
        if ((stripeService as any).stripe) {
          const intent = await (stripeService as any).stripe.paymentIntents.retrieve(rawId);
          const status: PaymentResult['status'] =
            intent.status === 'succeeded'
              ? 'approved'
              : intent.status === 'canceled'
              ? 'rejected'
              : intent.status === 'processing'
              ? 'processing'
              : 'pending';
          return { success: true, transactionId, status };
        }
        return { success: true, transactionId, status: 'processing' };
      }

      if (transactionId.startsWith('mp_')) {
        const { MercadoPagoConfig, Payment } = await import('mercadopago');
        const settings = await this.getPaymentSettings(companyId);
        const client = new MercadoPagoConfig({
          accessToken:
            (settings.mercadoPagoAccessToken as string) ||
            process.env.MERCADOPAGO_ACCESS_TOKEN ||
            '',
        });
        const mpPayment = new Payment(client);
        const rawId = transactionId.replace('mp_', '');
        const result = await mpPayment.get({ id: rawId });
        const statusMap: Record<string, PaymentResult['status']> = {
          approved: 'approved',
          pending: 'pending',
          rejected: 'rejected',
          in_process: 'processing',
        };
        return {
          success: true,
          transactionId,
          status: statusMap[result.status ?? ''] ?? 'pending',
        };
      }

      if (transactionId.startsWith('crypto_')) {
        // NOWPayments IPN updates status asynchronously; return pending as default
        return { success: true, transactionId, status: 'pending' };
      }

      return { success: false, status: 'rejected', error: 'Unknown transaction prefix' };
    } catch (err: any) {
      gwLogger.error({ err, transactionId }, 'Failed to get payment status');
      return { success: false, status: 'rejected', error: err.message };
    }
  }

  /**
   * Issue a full or partial refund for a previously completed payment.
   * @param amount Optional refund amount in cents; omit for full refund.
   */
  async refund(
    companyId: number,
    transactionId: string,
    amount?: number
  ): Promise<PaymentResult> {
    gwLogger.info({ companyId, transactionId, amount }, 'Issuing refund');

    try {
      if (transactionId.startsWith('stripe_')) {
        const { stripeService } = await import('../billing/stripe-service');
        if (!stripeService || !(stripeService as any).stripe) {
          return { success: false, status: 'rejected', error: 'Stripe not configured' };
        }
        const rawId = transactionId.replace('stripe_', '');
        const refundParams: Record<string, unknown> = { payment_intent: rawId };
        if (amount) refundParams.amount = amount;
        await (stripeService as any).stripe.refunds.create(refundParams);
        return { success: true, transactionId, status: 'approved' };
      }

      if (transactionId.startsWith('mp_')) {
        // MercadoPago refunds go through their Refund API
        const settings = await this.getPaymentSettings(companyId);
        const accessToken =
          (settings.mercadoPagoAccessToken as string) ||
          process.env.MERCADOPAGO_ACCESS_TOKEN ||
          '';
        const rawId = transactionId.replace('mp_', '');
        const body: Record<string, unknown> = {};
        if (amount) body.amount = amount / 100; // MP expects BRL decimal
        const resp = await fetch(
          `https://api.mercadopago.com/v1/payments/${rawId}/refunds`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          }
        );
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`MercadoPago refund error: ${resp.status} ${text}`);
        }
        return { success: true, transactionId, status: 'approved' };
      }

      return {
        success: false,
        status: 'rejected',
        error: 'Refunds not supported for this provider',
      };
    } catch (err: any) {
      gwLogger.error({ err, transactionId }, 'Refund failed');
      return { success: false, status: 'rejected', error: err.message };
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async getPaymentSettings(companyId: number): Promise<PaymentSettings> {
    try {
      const { db } = await import('../db');
      const result = await db.$client.query(
        `SELECT * FROM fiscal_settings WHERE company_id = $1 LIMIT 1`,
        [companyId]
      );
      return (result.rows[0] as PaymentSettings) ?? {};
    } catch (err) {
      gwLogger.warn({ err, companyId }, 'Could not load fiscal_settings; using defaults');
      return {};
    }
  }

  private async createStripePayment(
    req: PaymentRequest,
    settings: PaymentSettings
  ): Promise<PaymentResult> {
    try {
      const { stripeService } = await import('../billing/stripe-service');
      if (!stripeService || !(stripeService as any).stripe) {
        gwLogger.warn('Stripe not configured, falling back to MercadoPago');
        return this.createMercadoPagoPayment(req, settings);
      }

      const stripeInstance: import('stripe').default = (stripeService as any).stripe;

      const methodTypeMap: Record<string, string[]> = {
        credit_card: ['card'],
        debit_card: ['card'],
        pix: ['pix'],
        boleto: ['boleto'],
      };

      const intent = await stripeInstance.paymentIntents.create({
        amount: req.amount,
        currency: 'brl',
        description: req.description,
        payment_method_types: methodTypeMap[req.method] ?? ['card'],
        receipt_email: req.patientEmail,
        metadata: {
          companyId: String(req.companyId),
          patientId: String(req.patientId),
          patientCpf: req.patientCpf ?? '',
        },
      });

      const result: PaymentResult = {
        success: true,
        transactionId: `stripe_${intent.id}`,
        status: 'processing',
      };

      // Extract next-action data for Pix/Boleto
      const nextAction = (intent as any).next_action;
      if (nextAction?.type === 'pix_display_qr_code') {
        result.pixQrCode = nextAction.pix_display_qr_code?.image_url_png;
        result.pixCopyPaste = nextAction.pix_display_qr_code?.data;
        result.status = 'pending';
      }
      if (nextAction?.type === 'boleto_display_details') {
        result.boletoUrl = nextAction.boleto_display_details?.hosted_voucher_url;
        result.status = 'pending';
      }

      gwLogger.info(
        { companyId: req.companyId, transactionId: result.transactionId },
        'Stripe payment created'
      );
      return result;
    } catch (err: any) {
      gwLogger.error({ err, companyId: req.companyId }, 'Stripe payment failed');
      return { success: false, status: 'rejected', error: err.message };
    }
  }

  private async createMercadoPagoPayment(
    req: PaymentRequest,
    settings: PaymentSettings
  ): Promise<PaymentResult> {
    try {
      const { MercadoPagoConfig, Payment } = await import('mercadopago');
      const accessToken =
        (settings.mercadoPagoAccessToken as string) ||
        process.env.MERCADOPAGO_ACCESS_TOKEN ||
        '';

      if (!accessToken) {
        return {
          success: false,
          status: 'rejected',
          error: 'MercadoPago access token not configured',
        };
      }

      const client = new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } });
      const mpPayment = new Payment(client);

      const paymentMethodMap: Record<string, string> = {
        pix: 'pix',
        boleto: 'boleto',
        credit_card: 'credit_card',
        debit_card: 'debit_card',
      };

      const body: Record<string, unknown> = {
        transaction_amount: req.amount / 100, // MP expects BRL decimal
        description: req.description,
        payment_method_id: paymentMethodMap[req.method] ?? 'pix',
        payer: {
          email: req.patientEmail ?? 'paciente@clinica.com',
        },
      };

      if (req.patientCpf) {
        (body.payer as Record<string, unknown>).identification = {
          type: 'CPF',
          number: req.patientCpf.replace(/\D/g, ''),
        };
      }

      if (req.installments && req.method === 'credit_card') {
        body.installments = req.installments;
      }

      const response = await mpPayment.create({ body });

      const statusMap: Record<string, PaymentResult['status']> = {
        approved: 'approved',
        pending: 'pending',
        rejected: 'rejected',
        in_process: 'processing',
      };

      const result: PaymentResult = {
        success: true,
        transactionId: `mp_${response.id}`,
        status: statusMap[response.status ?? ''] ?? 'pending',
      };

      // Pix QR code
      const pixData = (response as any).point_of_interaction?.transaction_data;
      if (pixData) {
        result.pixQrCode = pixData.qr_code_base64;
        result.pixCopyPaste = pixData.qr_code;
        result.status = 'pending';
      }

      // Boleto URL
      const boletoUrl = (response as any).transaction_details?.external_resource_url;
      if (boletoUrl) {
        result.boletoUrl = boletoUrl;
        result.status = 'pending';
      }

      gwLogger.info(
        { companyId: req.companyId, transactionId: result.transactionId },
        'MercadoPago payment created'
      );
      return result;
    } catch (err: any) {
      gwLogger.error({ err, companyId: req.companyId }, 'MercadoPago payment failed');
      return { success: false, status: 'rejected', error: err.message };
    }
  }

  private async createCryptoPayment(req: PaymentRequest): Promise<PaymentResult> {
    try {
      const apiKey = process.env.NOWPAYMENTS_API_KEY ?? '';
      if (!apiKey) {
        return {
          success: false,
          status: 'rejected',
          error: 'NOWPayments API key not configured',
        };
      }

      const amountBrl = (req.amount / 100).toFixed(2);
      const resp = await fetch('https://api.nowpayments.io/v1/payment', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          price_amount: amountBrl,
          price_currency: 'brl',
          pay_currency: 'usdttrc20', // default crypto; caller can extend
          order_description: req.description,
          order_id: `patient_${req.patientId}_${Date.now()}`,
          ipn_callback_url: process.env.NOWPAYMENTS_IPN_URL ?? '',
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`NOWPayments error: ${resp.status} ${text}`);
      }

      const data: Record<string, unknown> = await resp.json();

      gwLogger.info(
        { companyId: req.companyId, paymentId: data['payment_id'] },
        'Crypto payment created'
      );

      return {
        success: true,
        transactionId: `crypto_${data['payment_id']}`,
        status: 'pending',
      };
    } catch (err: any) {
      gwLogger.error({ err, companyId: req.companyId }, 'Crypto payment failed');
      return { success: false, status: 'rejected', error: err.message };
    }
  }
}

export const paymentGateway = new UnifiedPaymentGateway();
