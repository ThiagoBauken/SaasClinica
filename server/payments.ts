import { Request, Response } from 'express';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { db } from './db';
import { subscriptions, payments } from '../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

// Configurar Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
  options: {
    timeout: 5000,
    idempotencyKey: 'abc'
  }
});

const preference = new Preference(client);
const payment = new Payment(client);

// Planos disponíveis
const availablePlans = [
  {
    id: 'basic',
    name: 'Básico',
    description: 'Ideal para clínicas pequenas',
    price: 9900, // R$ 99,00 em centavos
    currency: 'BRL',
    interval: 'monthly',
    features: [
      'Até 500 pacientes',
      'Agendamento básico',
      'Relatórios simples',
      'Suporte por email'
    ]
  },
  {
    id: 'professional',
    name: 'Profissional',
    description: 'Para clínicas em crescimento',
    price: 19900, // R$ 199,00
    currency: 'BRL',
    interval: 'monthly',
    isPopular: true,
    features: [
      'Pacientes ilimitados',
      'Agendamento avançado',
      'Relatórios completos',
      'Integração WhatsApp',
      'Automações N8N',
      'Suporte prioritário'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Para clínicas grandes',
    price: 39900, // R$ 399,00
    currency: 'BRL',
    interval: 'monthly',
    features: [
      'Todas as funcionalidades',
      'Multi-clínicas',
      'API personalizada',
      'Integrações customizadas',
      'Suporte 24/7',
      'Gerente de conta dedicado'
    ]
  }
];

export async function getPlans(req: Request, res: Response) {
  try {
    res.json(availablePlans);
  } catch (error) {
    console.error('Erro ao buscar planos:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

export async function getCurrentSubscription(req: Request, res: Response) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.companyId, companyId),
      orderBy: desc(subscriptions.createdAt)
    });

    if (!subscription) {
      return res.status(404).json({ message: 'Nenhuma assinatura encontrada' });
    }

    const plan = availablePlans.find(p => p.id === subscription.planId);
    
    res.json({
      ...subscription,
      planName: plan?.name || 'Plano Desconhecido'
    });
  } catch (error) {
    console.error('Erro ao buscar assinatura:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

export async function createSubscription(req: Request, res: Response) {
  try {
    const { planId } = req.body;
    const companyId = req.user?.companyId;
    const userEmail = req.user?.email;

    if (!companyId || !userEmail) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    const plan = availablePlans.find(p => p.id === planId);
    if (!plan) {
      return res.status(400).json({ message: 'Plano não encontrado' });
    }

    // Criar preferência no Mercado Pago
    const preferenceData = {
      items: [
        {
          id: plan.id,
          title: `Assinatura ${plan.name} - DentCare`,
          description: plan.description,
          quantity: 1,
          unit_price: plan.price / 100, // Converter de centavos para reais
          currency_id: plan.currency
        }
      ],
      payer: {
        email: userEmail
      },
      back_urls: {
        success: `${process.env.BASE_URL}/payments/success`,
        failure: `${process.env.BASE_URL}/payments/failure`,
        pending: `${process.env.BASE_URL}/payments/pending`
      },
      auto_return: 'approved',
      external_reference: `${companyId}-${planId}`,
      metadata: {
        company_id: companyId,
        plan_id: planId
      }
    };

    const mpPreference = await preference.create({ body: preferenceData });

    // Salvar assinatura pendente no banco
    const currentDate = new Date();
    const nextBillingDate = new Date(currentDate);
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    await db.insert(subscriptions).values({
      companyId,
      planId,
      status: 'pending',
      amount: plan.price,
      currency: plan.currency,
      currentPeriodStart: currentDate,
      currentPeriodEnd: nextBillingDate,
      nextBillingDate,
      mercadoPagoId: mpPreference.id,
      paymentMethod: 'mercadopago'
    });

    res.json({
      subscriptionId: mpPreference.id,
      initPoint: mpPreference.init_point,
      sandboxInitPoint: mpPreference.sandbox_init_point
    });

  } catch (error) {
    console.error('Erro ao criar assinatura:', error);
    res.status(500).json({ message: 'Erro ao processar assinatura' });
  }
}

export async function cancelSubscription(req: Request, res: Response) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    // Atualizar status da assinatura para cancelada
    await db.update(subscriptions)
      .set({ 
        status: 'canceled',
        updatedAt: new Date()
      })
      .where(and(
        eq(subscriptions.companyId, companyId),
        eq(subscriptions.status, 'active')
      ));

    res.json({ message: 'Assinatura cancelada com sucesso' });
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

export async function getPaymentHistory(req: Request, res: Response) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    const paymentHistory = await db.query.payments.findMany({
      where: eq(payments.companyId, companyId),
      orderBy: desc(payments.createdAt),
      limit: 50
    });

    res.json(paymentHistory);
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

export async function handleWebhook(req: Request, res: Response) {
  try {
    const { type, data } = req.body;

    if (type === 'payment') {
      const paymentId = data.id;
      
      // Buscar informações do pagamento no Mercado Pago
      const paymentInfo = await payment.get({ id: paymentId });
      
      if (paymentInfo && paymentInfo.external_reference) {
        const [companyId, planId] = paymentInfo.external_reference.split('-');
        
        // Atualizar status da assinatura baseado no pagamento
        if (paymentInfo.status === 'approved') {
          await db.update(subscriptions)
            .set({ 
              status: 'active',
              updatedAt: new Date()
            })
            .where(and(
              eq(subscriptions.companyId, parseInt(companyId)),
              eq(subscriptions.mercadoPagoId, paymentInfo.collector_id?.toString() || '')
            ));

          // Registrar o pagamento
          await db.insert(payments).values({
            companyId: parseInt(companyId),
            subscriptionId: paymentInfo.collector_id?.toString() || '',
            amount: (paymentInfo.transaction_amount || 0) * 100, // Converter para centavos
            currency: paymentInfo.currency_id || 'BRL',
            status: 'approved',
            paymentDate: new Date(),
            paymentMethod: paymentInfo.payment_method_id || 'mercadopago',
            mercadoPagoId: paymentId.toString(),
            description: `Pagamento assinatura - ${planId}`
          });
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Erro no webhook:', error);
    res.status(500).json({ message: 'Erro no webhook' });
  }
}

export async function getPaymentSuccess(req: Request, res: Response) {
  try {
    const { payment_id, status, external_reference } = req.query;

    if (status === 'approved' && external_reference) {
      const [companyId] = (external_reference as string).split('-');
      
      // Redirecionar para dashboard com sucesso
      res.redirect(`/dashboard?payment=success&company=${companyId}`);
    } else {
      res.redirect('/payments?payment=error');
    }
  } catch (error) {
    console.error('Erro na confirmação:', error);
    res.redirect('/payments?payment=error');
  }
}