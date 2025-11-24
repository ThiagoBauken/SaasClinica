import { Request, Response, Express } from 'express';
import { stripeService } from './stripe-service';
import express from 'express';

/**
 * Rotas do Stripe
 */

export function registerStripeRoutes(app: Express) {
  /**
   * POST /api/stripe/webhook
   * Webhook do Stripe (raw body necessário)
   */
  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
      try {
        const signature = req.headers['stripe-signature'] as string;

        if (!signature) {
          return res.status(400).json({ error: 'Signature ausente' });
        }

        await stripeService.handleWebhook(req.body, signature);

        res.json({ received: true });
      } catch (error: any) {
        console.error('Erro no webhook Stripe:', error);
        res.status(400).json({ error: error.message });
      }
    }
  );

  /**
   * POST /api/stripe/create-checkout-session
   * Criar sessão de checkout do Stripe
   */
  app.post('/api/stripe/create-checkout-session', async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (!user || !user.companyId) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      const { priceId, trialDays } = req.body;

      if (!priceId) {
        return res.status(400).json({ error: 'Price ID é obrigatório' });
      }

      const baseUrl = process.env.BASE_URL || 'http://localhost:5000';

      const session = await stripeService.createCheckoutSession({
        companyId: user.companyId,
        priceId,
        successUrl: `${baseUrl}/settings/billing?success=true`,
        cancelUrl: `${baseUrl}/settings/billing?canceled=true`,
        trialDays,
      });

      res.json({ sessionId: session.id, url: session.url });
    } catch (error: any) {
      console.error('Erro ao criar checkout session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/stripe/create-portal-session
   * Criar portal de gerenciamento de assinaturas
   */
  app.post('/api/stripe/create-portal-session', async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (!user || !user.companyId) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      const { customerId } = req.body;

      if (!customerId) {
        return res.status(400).json({ error: 'Customer ID é obrigatório' });
      }

      const baseUrl = process.env.BASE_URL || 'http://localhost:5000';

      const session = await stripeService.createCustomerPortal({
        customerId,
        returnUrl: `${baseUrl}/settings/billing`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Erro ao criar portal session:', error);
      res.status(500).json({ error: error.message });
    }
  });
}
