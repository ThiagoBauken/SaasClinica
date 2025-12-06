import { Router, Request, Response } from 'express';
import { nowpaymentsService } from '../billing/nowpayments-service';
import { mercadopagoService } from '../billing/mercadopago-service';

const router = Router();

/**
 * ====================================
 * NOWPayments (Crypto) Routes
 * ====================================
 */

/**
 * GET /api/payment-gateways/nowpayments/currencies
 * Listar criptomoedas disponíveis
 */
router.get('/nowpayments/currencies', async (req: Request, res: Response) => {
  try {
    const currencies = await nowpaymentsService.getAvailableCurrencies();
    res.json({ currencies });
  } catch (error: any) {
    console.error('Erro ao buscar moedas:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/payment-gateways/nowpayments/create-payment
 * Criar pagamento em crypto
 */
router.post('/nowpayments/create-payment', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user || !user.companyId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const { planId, currency, billingCycle } = req.body;

    if (!planId || !currency || !billingCycle) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    const payment = await nowpaymentsService.createPayment({
      companyId: user.companyId,
      planId: parseInt(planId),
      currency,
      billingCycle,
    });

    res.json(payment);
  } catch (error: any) {
    console.error('Erro ao criar pagamento crypto:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/payment-gateways/nowpayments/payment/:id
 * Buscar status de pagamento crypto
 */
router.get('/nowpayments/payment/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const status = await nowpaymentsService.getPaymentStatus(id);
    res.json(status);
  } catch (error: any) {
    console.error('Erro ao buscar status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ====================================
 * MercadoPago Routes
 * ====================================
 */

/**
 * POST /api/payment-gateways/mercadopago/create-subscription
 * Criar assinatura no MercadoPago
 */
router.post('/mercadopago/create-subscription', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user || !user.companyId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const { planId, paymentMethod, billingCycle, email } = req.body;

    if (!planId || !paymentMethod || !billingCycle || !email) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    const subscription = await mercadopagoService.createSubscription({
      companyId: user.companyId,
      planId: parseInt(planId),
      paymentMethod,
      billingCycle,
      email,
    });

    res.json(subscription);
  } catch (error: any) {
    console.error('Erro ao criar assinatura MercadoPago:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/payment-gateways/mercadopago/create-payment
 * Criar pagamento único (Pix ou Boleto)
 */
router.post('/mercadopago/create-payment', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user || !user.companyId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const { planId, amount, paymentMethod, email, description } = req.body;

    if (!planId || !amount || !paymentMethod || !email) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    const payment = await mercadopagoService.createPayment({
      companyId: user.companyId,
      planId: parseInt(planId),
      amount: parseFloat(amount),
      paymentMethod,
      email,
      description: description || 'Assinatura DentalSystem',
    });

    res.json(payment);
  } catch (error: any) {
    console.error('Erro ao criar pagamento MercadoPago:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/payment-gateways/mercadopago/payment/:id
 * Buscar status de pagamento
 */
router.get('/mercadopago/payment/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const status = await mercadopagoService.getPaymentStatus(id);
    res.json(status);
  } catch (error: any) {
    console.error('Erro ao buscar status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/payment-gateways/mercadopago/subscription/:id
 * Buscar status de assinatura
 */
router.get('/mercadopago/subscription/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const status = await mercadopagoService.getSubscriptionStatus(id);
    res.json(status);
  } catch (error: any) {
    console.error('Erro ao buscar status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/payment-gateways/mercadopago/cancel-subscription/:id
 * Cancelar assinatura
 */
router.post('/mercadopago/cancel-subscription/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user || !user.companyId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const { id } = req.params;
    const result = await mercadopagoService.cancelSubscription(id);
    res.json(result);
  } catch (error: any) {
    console.error('Erro ao cancelar assinatura:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
