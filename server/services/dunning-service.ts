import { db } from '../db';
import { subscriptions, companies, users, plans } from '@shared/schema';
import { eq, and, lt, gte, inArray } from 'drizzle-orm';
import { sendEmail, getTrialEndingSoonTemplate, getPaymentFailedTemplate } from './email-service';
import { logger } from '../logger';

const dunningLogger = logger.child({ module: 'dunning' });

/**
 * Verifica trials que vao expirar em 3 dias e envia lembretes
 */
export async function sendTrialExpiringReminders() {
  dunningLogger.info('Checking for expiring trials');

  try {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    threeDaysFromNow.setHours(0, 0, 0, 0);

    const fourDaysFromNow = new Date();
    fourDaysFromNow.setDate(fourDaysFromNow.getDate() + 4);
    fourDaysFromNow.setHours(0, 0, 0, 0);

    // Batch load all expiring trials with their company, plan and admin in one query
    const expiringTrials = await db
      .select({
        subscription: subscriptions,
        company: companies,
        plan: plans,
      })
      .from(subscriptions)
      .innerJoin(companies, eq(companies.id, subscriptions.companyId))
      .innerJoin(plans, eq(plans.id, subscriptions.planId))
      .where(
        and(
          eq(subscriptions.status, 'trial'),
          gte(subscriptions.trialEndsAt, threeDaysFromNow),
          lt(subscriptions.trialEndsAt, fourDaysFromNow)
        )
      );

    dunningLogger.info({ count: expiringTrials.length }, 'Expiring trials found');

    // Batch load admin users for all companies at once
    const companyIds = expiringTrials.map((t: any) => t.subscription.companyId);
    const admins: any[] = companyIds.length > 0
      ? await db
          .select()
          .from(users)
          .where(and(
            eq(users.role, 'admin'),
            // inArray requires at least one element
            ...companyIds.length > 0 ? [inArray(users.companyId, companyIds)] : []
          ))
      : [];

    const adminByCompany = new Map<number, any>(admins.map((a: any) => [a.companyId, a]));

    for (const { subscription, company, plan } of expiringTrials) {
      const admin = adminByCompany.get(subscription.companyId);

      if (!company || !plan || !admin || !admin.email) {
        dunningLogger.warn({ subscriptionId: subscription.id }, 'Incomplete data for subscription, skipping');
        continue;
      }

      const daysLeft = subscription.trialEndsAt
        ? Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 3;

      const result = await sendEmail({
        to: admin.email,
        subject: `\u23f0 Seu per\u00edodo de teste expira em ${daysLeft} dias`,
        html: getTrialEndingSoonTemplate(company.name || 'Cl\u00ednica', daysLeft, plan.name),
      });

      if (result.success) {
        dunningLogger.info({ subscriptionId: subscription.id, companyId: company.id, daysLeft }, 'Trial expiry reminder sent');
      } else {
        dunningLogger.error({ subscriptionId: subscription.id, error: result.error }, 'Failed to send trial reminder');
      }
    }

    dunningLogger.info('Trial expiry check completed');
  } catch (error) {
    dunningLogger.error({ err: error }, 'Error checking expiring trials');
  }
}

/**
 * Processa assinaturas com pagamento atrasado (past_due)
 */
export async function processPastDueSubscriptions() {
  dunningLogger.info('Processing past_due subscriptions');

  try {
    const pastDueSubscriptions = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.status, 'past_due'));

    dunningLogger.info({ count: pastDueSubscriptions.length }, 'Past-due subscriptions found');

    const now = new Date();

    for (const subscription of pastDueSubscriptions) {
      const daysPastDue = subscription.updatedAt
        ? Math.floor((now.getTime() - new Date(subscription.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      dunningLogger.debug({ subscriptionId: subscription.id, daysPastDue }, 'Processing past-due subscription');

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
        dunningLogger.warn({ subscriptionId: subscription.id }, 'Incomplete data for subscription, skipping');
        continue;
      }

      // Dunning strategy: Day 1, 3, 5 = reminder, Day 7 = cancel
      if (daysPastDue === 1 || daysPastDue === 3 || daysPastDue === 5) {
        const warningLevel = daysPastDue === 5 ? '\u26a0\ufe0f \u00daLTIMO AVISO' : '\u26a0\ufe0f LEMBRETE';

        const result = await sendEmail({
          to: admin.email,
          subject: `${warningLevel} - Problema com o Pagamento`,
          html: getPaymentFailedTemplate(
            company.name || 'Cl\u00ednica',
            parseFloat(subscription.amount || '0'),
            plan.name
          ),
        });

        if (result.success) {
          dunningLogger.info({ subscriptionId: subscription.id, daysPastDue, companyId: company.id }, 'Dunning email sent');
        } else {
          dunningLogger.error({ subscriptionId: subscription.id, error: result.error }, 'Failed to send dunning email');
        }
      }

      if (daysPastDue >= 7) {
        await db
          .update(subscriptions)
          .set({
            status: 'canceled',
            canceledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, subscription.id));

        dunningLogger.info({ subscriptionId: subscription.id, daysPastDue, companyId: company.id }, 'Subscription auto-canceled due to non-payment');

        await sendEmail({
          to: admin.email,
          subject: '\ud83d\udeab Assinatura Cancelada - DentalSystem',
          html: `
            <h1>Assinatura Cancelada</h1>
            <p>Ol\u00e1, ${company.name}</p>
            <p>Sua assinatura foi cancelada automaticamente devido \u00e0 falta de pagamento.</p>
            <p>Se voc\u00ea deseja reativar sua assinatura, entre em contato conosco ou fa\u00e7a login para atualizar seu m\u00e9todo de pagamento.</p>
            <a href="${process.env.BASE_URL}/billing">Reativar Assinatura</a>
          `,
        });
      }
    }

    dunningLogger.info('Past-due subscription processing completed');
  } catch (error) {
    dunningLogger.error({ err: error }, 'Error processing past-due subscriptions');
  }
}

/**
 * Verifica trials expirados e converte para paid ou cancela
 */
export async function convertExpiredTrials() {
  dunningLogger.info('Converting expired trials');

  try {
    const now = new Date();

    const expiredTrials = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, 'trial'),
          lt(subscriptions.trialEndsAt, now)
        )
      );

    dunningLogger.info({ count: expiredTrials.length }, 'Expired trials found');

    for (const subscription of expiredTrials) {
      if (subscription.stripeSubscriptionId) {
        dunningLogger.debug({ subscriptionId: subscription.id }, 'Trial managed by Stripe, skipping');
        continue;
      }

      await db
        .update(subscriptions)
        .set({
          status: 'canceled',
          canceledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, subscription.id));

      dunningLogger.info({ subscriptionId: subscription.id }, 'Expired trial canceled (no payment configured)');
    }

    dunningLogger.info('Expired trial conversion completed');
  } catch (error) {
    dunningLogger.error({ err: error }, 'Error converting expired trials');
  }
}

/**
 * Executa todos os processos de dunning de uma vez
 */
export async function runDunningTasks() {
  dunningLogger.info('Starting dunning tasks');

  await sendTrialExpiringReminders();
  await processPastDueSubscriptions();
  await convertExpiredTrials();

  dunningLogger.info('All dunning tasks completed');
}
