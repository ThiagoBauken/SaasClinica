import { db } from '../db';
import { subscriptions, companies, users, plans } from '@shared/schema';
import { eq, and, lt, gte } from 'drizzle-orm';
import { sendEmail, getTrialEndingSoonTemplate, getPaymentFailedTemplate } from './email-service';

/**
 * Serviço de Dunning Management
 * Gerencia lembretes de trials expirando e pagamentos falhados
 */

/**
 * Verifica trials que vão expirar em 3 dias e envia lembretes
 */
export async function sendTrialExpiringReminders() {
  console.log('🔄 Executando verificação de trials expirando...');

  try {
    // Buscar subscriptions em trial que expiram em 3 dias
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    threeDaysFromNow.setHours(0, 0, 0, 0);

    const fourDaysFromNow = new Date();
    fourDaysFromNow.setDate(fourDaysFromNow.getDate() + 4);
    fourDaysFromNow.setHours(0, 0, 0, 0);

    const expiringTrials = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, 'trial'),
          gte(subscriptions.trialEndsAt, threeDaysFromNow),
          lt(subscriptions.trialEndsAt, fourDaysFromNow)
        )
      );

    console.log(`📊 Encontrados ${expiringTrials.length} trials expirando em 3 dias`);

    for (const subscription of expiringTrials) {
      // Buscar informações da empresa e plano
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

      if (!company || !plan || !admin || !admin.email) {
        console.warn(`⚠️ Dados incompletos para subscription ${subscription.id}`);
        continue;
      }

      // Calcular dias restantes
      const daysLeft = subscription.trialEndsAt
        ? Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 3;

      // Enviar email de lembrete
      const result = await sendEmail({
        to: admin.email,
        subject: `⏰ Seu período de teste expira em ${daysLeft} dias`,
        html: getTrialEndingSoonTemplate(company.name || 'Clínica', daysLeft, plan.name),
      });

      if (result.success) {
        console.log(`✅ Lembrete de trial enviado para ${admin.email} (${company.name})`);
      } else {
        console.error(`❌ Erro ao enviar lembrete para ${admin.email}:`, result.error);
      }
    }

    console.log('✅ Verificação de trials concluída');
  } catch (error) {
    console.error('❌ Erro ao verificar trials expirando:', error);
  }
}

/**
 * Processa assinaturas com pagamento atrasado (past_due)
 * Envia lembretes e eventualmente cancela a assinatura
 */
export async function processPastDueSubscriptions() {
  console.log('🔄 Executando processamento de assinaturas past_due...');

  try {
    // Buscar assinaturas com pagamento atrasado
    const pastDueSubscriptions = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.status, 'past_due'));

    console.log(`📊 Encontradas ${pastDueSubscriptions.length} assinaturas past_due`);

    const now = new Date();

    for (const subscription of pastDueSubscriptions) {
      // Calcular dias desde que ficou past_due
      const daysPastDue = subscription.updatedAt
        ? Math.floor((now.getTime() - new Date(subscription.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      console.log(`📅 Assinatura ${subscription.id}: ${daysPastDue} dias em atraso`);

      // Buscar informações da empresa e plano
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

      if (!company || !plan || !admin || !admin.email) {
        console.warn(`⚠️ Dados incompletos para subscription ${subscription.id}`);
        continue;
      }

      // Estratégia de Dunning:
      // Dia 1: Primeiro email de lembrete
      // Dia 3: Segundo email de lembrete
      // Dia 5: Terceiro email de lembrete (último aviso)
      // Dia 7: Cancelar assinatura automaticamente

      if (daysPastDue === 1 || daysPastDue === 3 || daysPastDue === 5) {
        // Enviar email de lembrete
        const warningLevel = daysPastDue === 5 ? '⚠️ ÚLTIMO AVISO' : '⚠️ LEMBRETE';
        const daysUntilCancellation = 7 - daysPastDue;

        const result = await sendEmail({
          to: admin.email,
          subject: `${warningLevel} - Problema com o Pagamento`,
          html: getPaymentFailedTemplate(
            company.name || 'Clínica',
            parseFloat(subscription.amount || '0'),
            plan.name
          ),
        });

        if (result.success) {
          console.log(`✅ Email de dunning (dia ${daysPastDue}) enviado para ${admin.email}`);
        } else {
          console.error(`❌ Erro ao enviar email de dunning:`, result.error);
        }
      }

      if (daysPastDue >= 7) {
        // Cancelar assinatura automaticamente após 7 dias
        await db
          .update(subscriptions)
          .set({
            status: 'canceled',
            canceledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, subscription.id));

        console.log(`🚫 Assinatura ${subscription.id} cancelada automaticamente após ${daysPastDue} dias`);

        // Enviar email de cancelamento
        await sendEmail({
          to: admin.email,
          subject: '🚫 Assinatura Cancelada - DentalSystem',
          html: `
            <h1>Assinatura Cancelada</h1>
            <p>Olá, ${company.name}</p>
            <p>Sua assinatura foi cancelada automaticamente devido à falta de pagamento.</p>
            <p>Se você deseja reativar sua assinatura, entre em contato conosco ou faça login para atualizar seu método de pagamento.</p>
            <a href="${process.env.BASE_URL}/billing">Reativar Assinatura</a>
          `,
        });
      }
    }

    console.log('✅ Processamento de assinaturas past_due concluído');
  } catch (error) {
    console.error('❌ Erro ao processar assinaturas past_due:', error);
  }
}

/**
 * Verifica trials expirados e converte para paid ou cancela
 */
export async function convertExpiredTrials() {
  console.log('🔄 Executando conversão de trials expirados...');

  try {
    const now = new Date();

    // Buscar trials expirados
    const expiredTrials = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, 'trial'),
          lt(subscriptions.trialEndsAt, now)
        )
      );

    console.log(`📊 Encontrados ${expiredTrials.length} trials expirados`);

    for (const subscription of expiredTrials) {
      // Se tem stripeSubscriptionId, o Stripe vai gerenciar a conversão automaticamente
      if (subscription.stripeSubscriptionId) {
        console.log(`⏩ Trial ${subscription.id} será convertido automaticamente pelo Stripe`);
        continue;
      }

      // Se não tem Stripe, cancelar o trial
      await db
        .update(subscriptions)
        .set({
          status: 'canceled',
          canceledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, subscription.id));

      console.log(`🚫 Trial ${subscription.id} expirado e cancelado (sem pagamento configurado)`);
    }

    console.log('✅ Conversão de trials expirados concluída');
  } catch (error) {
    console.error('❌ Erro ao converter trials expirados:', error);
  }
}

/**
 * Executa todos os processos de dunning de uma vez
 */
export async function runDunningTasks() {
  console.log('🚀 Iniciando tarefas de dunning...');

  await sendTrialExpiringReminders();
  await processPastDueSubscriptions();
  await convertExpiredTrials();

  console.log('✅ Todas as tarefas de dunning concluídas');
}
