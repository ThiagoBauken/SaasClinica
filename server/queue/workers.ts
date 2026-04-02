import { Job, DelayedError } from 'bullmq';
import { createWorker, QueueNames } from './config';
import { db } from '../db';
import { appointments, patients, payments, users, companies, clinicSettings, automations } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createEvolutionService, interpolateMessage } from '../services/evolution-api.service';
import { getWhatsAppProvider } from '../services/whatsapp-provider';
import { sendEmail } from '../services/email-service';
import { logger } from '../logger';

/**
 * Workers para processar jobs das filas
 */

/**
 * Worker de WhatsApp
 * Processa envios de mensagens WhatsApp
 */
/**
 * Verifica se o horário atual está dentro da janela de envio permitida (8h-21h).
 * Mensagens proativas (lembretes, confirmações) devem respeitar o horário.
 * Respostas diretas do chatbot e emergências NÃO são restritas.
 */
function isWithinSendingHours(): boolean {
  const now = new Date();
  const hour = now.getHours();
  return hour >= 8 && hour < 21;
}

/**
 * Calcula o delay em ms até a próxima janela de envio (8h).
 */
function getDelayUntilNextSendingWindow(): number {
  const now = new Date();
  const next8am = new Date(now);
  if (now.getHours() >= 21) {
    // Após 21h: próximo dia às 8h
    next8am.setDate(next8am.getDate() + 1);
  }
  next8am.setHours(8, 0, 0, 0);
  return Math.max(next8am.getTime() - now.getTime(), 0);
}

export const whatsappWorker = createWorker(
  QueueNames.WHATSAPP,
  async (job: Job) => {
    logger.info({ jobName: job.name, jobId: job.id }, 'Processing WhatsApp job');

    const { type, appointmentId, patientId, companyId } = job.data;

    // Restrição de horário para mensagens proativas (lembretes, confirmações)
    // Mensagens genéricas (respostas do chatbot) e emergências não são restritas
    const isProactiveMessage = type === 'appointment-reminder' || type === 'appointment-confirmation';
    if (isProactiveMessage && !isWithinSendingHours()) {
      const delay = getDelayUntilNextSendingWindow();
      logger.info({ type, delayMs: delay }, 'Proactive message outside sending hours — rescheduling for next window');
      // Re-add the job with delay to the next 8am window
      await job.moveToDelayed(Date.now() + delay, job.token);
      throw new DelayedError('Rescheduled to sending window');
    }

    try {
      switch (type) {
        case 'appointment-reminder':
          return await sendAppointmentReminder(appointmentId, patientId, companyId);

        case 'appointment-confirmation':
          return await sendAppointmentConfirmation(appointmentId, patientId, companyId);

        case 'generic-message': {
          // Send generic WhatsApp via unified provider
          const { phone, message, companyId: cId } = job.data;
          if (!phone || !message || !cId) {
            throw new Error('Missing phone, message, or companyId for WhatsApp');
          }
          const provider = await getWhatsAppProvider(cId);
          if (provider) {
            const result = await provider.sendTextMessage({ phone, message });
            logger.info({ phone, provider: provider.providerType, success: result.success }, 'Generic WhatsApp sent');
            return { success: result.success, messageId: result.messageId };
          }
          logger.warn({ phone }, 'No WhatsApp provider configured');
          return { success: false, message: 'No WhatsApp provider configured' };
        }

        default:
          logger.warn({ type }, 'Unknown WhatsApp job type');
          return { success: false, message: `Unknown job type: ${type}` };
      }
    } catch (error) {
      logger.error({ err: error, jobId: job.id }, 'WhatsApp job failed');
      throw error; // Re-throw para BullMQ fazer retry
    }
  },
  3 // Concorrência: 3 jobs simultâneos
);

/**
 * Worker de Emails
 * Processa envios de emails
 */
export const emailsWorker = createWorker(
  QueueNames.EMAILS,
  async (job: Job) => {
    logger.info({ jobName: job.name, jobId: job.id }, 'Processing email job');

    const { type, paymentId, patientId, companyId } = job.data;

    try {
      switch (type) {
        case 'payment-receipt':
          return await sendPaymentReceipt(paymentId, patientId, companyId);

        case 'generic-email': {
          // Send generic email via email service
          const { to, subject, html, text } = job.data;
          if (!to || !subject) {
            throw new Error('Missing to or subject for email');
          }
          try {
            await sendEmail({ to, subject, html: html || text || '' });
            logger.info({ to, subject }, 'Generic email sent');
            return { success: true, message: 'Email sent' };
          } catch (emailErr) {
            logger.error({ err: emailErr, to }, 'Failed to send email');
            throw emailErr;
          }
        }

        default:
          logger.warn({ type }, 'Unknown email job type');
          return { success: false, message: `Unknown job type: ${type}` };
      }
    } catch (error) {
      logger.error({ err: error, jobId: job.id }, 'Email job failed');
      throw error;
    }
  },
  5 // Concorrência: 5 jobs simultâneos
);

/**
 * Worker de Automações
 * Processa automações complexas que envolvem múltiplos passos
 */
export const automationsWorker = createWorker(
  QueueNames.AUTOMATIONS,
  async (job: Job) => {
    logger.info({ jobId: job.id, jobName: job.name }, 'Processing automation job');

    const { automationId, companyId, triggerData } = job.data;

    try {
      // Fetch the automation config
      const [automation] = await db
        .select()
        .from(automations)
        .where(eq(automations.id, automationId))
        .limit(1);

      if (!automation || !automation.active) {
        return { success: false, message: 'Automation not found or inactive' };
      }

      const results: any[] = [];

      // Execute WhatsApp step if enabled (via unified provider)
      if (automation.whatsappEnabled && triggerData?.phone) {
        const whatsappProvider = await getWhatsAppProvider(companyId);
        if (whatsappProvider) {
          const msg = interpolateMessage(
            automation.whatsappTemplateVariables || '',
            triggerData,
          );
          const result = await whatsappProvider.sendTextMessage({
            phone: triggerData.phone,
            message: msg,
          });
          results.push({ step: 'whatsapp', success: result.success, provider: whatsappProvider.providerType });
        }
      }

      // Execute Email step if enabled
      if (automation.emailEnabled && triggerData?.email) {
        try {
          await sendEmail({
            to: triggerData.email,
            subject: automation.emailSubject || 'Notification',
            html: automation.emailBody || '',
          });
          results.push({ step: 'email', success: true });
        } catch (err) {
          results.push({ step: 'email', success: false, error: (err as Error).message });
        }
      }

      // Execute Webhook step if configured
      if (automation.webhookUrl) {
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(automation.customHeaders as Record<string, string> || {}),
          };
          const resp = await fetch(automation.webhookUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ automationId, triggerData, timestamp: new Date().toISOString() }),
          });
          results.push({ step: 'webhook', success: resp.ok, status: resp.status });
        } catch (err) {
          results.push({ step: 'webhook', success: false, error: (err as Error).message });
        }
      }

      // Update automation stats
      await db
        .update(automations)
        .set({
          lastExecution: new Date(),
          executionCount: (automation.executionCount || 0) + 1,
        })
        .where(eq(automations.id, automationId));

      logger.info({ automationId, results }, 'Automation executed');
      return { success: true, results };
    } catch (error) {
      // Update error count
      if (automationId) {
        await db
          .update(automations)
          .set({
            errorCount: db.$client ? undefined : 0, // Increment handled below
            lastError: (error as Error).message,
          })
          .where(eq(automations.id, automationId))
          .catch(() => {});
      }
      throw error;
    }
  },
  2,
);

/**
 * Worker de Relatórios
 * Processa geração de relatórios em background
 */
export const reportsWorker = createWorker(
  QueueNames.REPORTS,
  async (job: Job) => {
    logger.info({ jobId: job.id, jobName: job.name }, 'Processing report job');

    const { reportType, companyId, params, format: outputFormat } = job.data;

    try {
      switch (reportType) {
        case 'financial-summary': {
          // Generate financial summary report
          const financialData = await db.$client.query(
            `SELECT
              payment_method,
              status,
              COUNT(*) as count,
              SUM(amount::numeric) as total
            FROM payments
            WHERE company_id = $1
            AND payment_date >= $2 AND payment_date <= $3
            GROUP BY payment_method, status`,
            [companyId, params?.startDate || '2024-01-01', params?.endDate || new Date().toISOString()],
          );

          logger.info({ companyId, rows: financialData.rows.length }, 'Financial report generated');
          return {
            success: true,
            data: financialData.rows,
            format: outputFormat || 'json',
          };
        }

        case 'patient-list': {
          const patientData = await db.$client.query(
            `SELECT full_name, email, phone, cellphone, status, created_at
            FROM patients
            WHERE company_id = $1
            ORDER BY full_name`,
            [companyId],
          );

          logger.info({ companyId, rows: patientData.rows.length }, 'Patient report generated');
          return {
            success: true,
            data: patientData.rows,
            format: outputFormat || 'json',
          };
        }

        case 'appointments-summary': {
          const appointmentData = await db.$client.query(
            `SELECT
              status,
              COUNT(*) as count,
              DATE(start_time) as date
            FROM appointments
            WHERE company_id = $1
            AND start_time >= $2 AND start_time <= $3
            GROUP BY status, DATE(start_time)
            ORDER BY date`,
            [companyId, params?.startDate || '2024-01-01', params?.endDate || new Date().toISOString()],
          );

          logger.info({ companyId, rows: appointmentData.rows.length }, 'Appointments report generated');
          return {
            success: true,
            data: appointmentData.rows,
            format: outputFormat || 'json',
          };
        }

        default:
          logger.warn({ reportType }, 'Unknown report type');
          return { success: false, message: `Unknown report type: ${reportType}` };
      }
    } catch (error) {
      logger.error({ err: error, reportType, companyId }, 'Report generation failed');
      throw error;
    }
  },
  1,
);

/**
 * Helpers para processar jobs específicos
 */

async function sendAppointmentReminder(appointmentId: number, patientId: number, companyId: number) {
  // Buscar dados do agendamento
  const [appointment] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  if (!appointment) {
    throw new Error(`Agendamento ${appointmentId} não encontrado`);
  }

  // Buscar dados do paciente
  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!patient) {
    throw new Error(`Paciente ${patientId} não encontrado`);
  }

  // Buscar dentista
  const [dentist] = await db
    .select()
    .from(users)
    .where(eq(users.id, appointment.professionalId || 0))
    .limit(1);

  // Buscar empresa
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  // Montar mensagem
  const appointmentDate = format(new Date(appointment.startTime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const message = `
🦷 *${company?.name || 'Clínica'}*

Olá *${patient.fullName}*!

📅 Lembrete de consulta:
⏰ Data: ${appointmentDate}
👨‍⚕️ Profissional: ${dentist?.fullName || 'Dentista'}

${company?.address ? `📍 Endereço: ${company.address}` : ''}

Aguardamos você! Em caso de imprevistos, entre em contato conosco.
  `.trim();

  // Enviar via provider unificado
  const whatsappProvider = await getWhatsAppProvider(companyId);
  const targetPhone = patient.whatsappPhone || patient.cellphone || patient.phone || '';

  if (whatsappProvider && targetPhone) {
    const result = await whatsappProvider.sendTextMessage({
      phone: targetPhone,
      message,
    });

    if (result.success) {
      logger.info({ provider: result.provider, appointmentId, messageId: result.messageId }, 'Appointment reminder sent via WhatsApp');
      return {
        success: true,
        message: `Lembrete enviado via ${result.provider}`,
        to: targetPhone,
        appointmentId,
        messageId: result.messageId,
      };
    } else {
      logger.error({ error: result.error, appointmentId }, 'Failed to send WhatsApp reminder');
    }
  }

  // Fallback: log apenas (nenhum provider configurado)
  logger.warn({ appointmentId, patientId: patient.id }, 'WhatsApp not configured, reminder logged only');

  return {
    success: true,
    message: 'Lembrete registrado (WhatsApp não configurado)',
    to: patient.phone,
    appointmentId,
  };
}

async function sendAppointmentConfirmation(appointmentId: number, patientId: number, companyId: number) {
  const [appointment] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!appointment || !patient) {
    throw new Error('Dados não encontrados');
  }

  const appointmentDate = format(new Date(appointment.startTime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const message = `
✅ *Agendamento Confirmado!*

Olá *${patient.fullName}*,

Sua consulta foi confirmada com sucesso!

📅 ${appointmentDate}
🏥 ${company?.name || 'Clínica'}

Até lá! 😊
  `.trim();

  // Enviar via provider unificado
  const confirmProvider = await getWhatsAppProvider(companyId);
  const confirmPhone = patient.whatsappPhone || patient.cellphone || patient.phone || '';

  if (confirmProvider && confirmPhone) {
    const result = await confirmProvider.sendTextMessage({
      phone: confirmPhone,
      message,
    });

    if (result.success) {
      logger.info({ provider: result.provider, appointmentId, messageId: result.messageId }, 'Appointment confirmation sent via WhatsApp');
      return {
        success: true,
        message: `Confirmação enviada via ${result.provider}`,
        to: confirmPhone,
        messageId: result.messageId,
      };
    } else {
      logger.error({ error: result.error, appointmentId }, 'Failed to send WhatsApp confirmation');
    }
  }

  // Fallback
  logger.warn({ appointmentId, patientId: patient.id }, 'WhatsApp not configured, confirmation logged only');

  return {
    success: true,
    message: 'Confirmação registrada (WhatsApp não configurado)',
    to: patient.phone,
  };
}

async function sendPaymentReceipt(paymentId: number, patientId: number, companyId: number) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);

  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!payment || !patient) {
    throw new Error('Dados não encontrados');
  }

  const emailSubject = `Recibo de Pagamento - ${company?.name || 'Clínica'}`;
  const emailBody = `
    <h2>Recibo de Pagamento</h2>
    <p>Olá ${patient.fullName},</p>
    <p>Confirmamos o recebimento do seu pagamento:</p>
    <ul>
      <li><strong>Valor:</strong> R$ ${parseFloat(payment.amount).toFixed(2)}</li>
      <li><strong>Método:</strong> ${payment.paymentMethod}</li>
      <li><strong>Data:</strong> ${format(new Date(payment.paymentDate), 'dd/MM/yyyy')}</li>
    </ul>
    <p>Obrigado pela preferência!</p>
    <p><em>${company?.name || 'Clínica'}</em></p>
  `;

  // Send email via email service
  if (patient.email) {
    try {
      await sendEmail({
        to: patient.email,
        subject: emailSubject,
        html: emailBody,
      });
      logger.info({ to: patient.email, paymentId }, 'Payment receipt email sent');
      return { success: true, message: 'Receipt sent', to: patient.email };
    } catch (emailErr) {
      logger.error({ err: emailErr, to: patient.email }, 'Failed to send receipt email');
      // Don't throw - log and return partial success
      return { success: false, message: 'Email send failed', to: patient.email };
    }
  }

  logger.warn({ patientId }, 'Patient has no email, receipt not sent');
  return { success: false, message: 'Patient has no email', to: null };
}

/**
 * Event listeners para monitoramento
 */

const workerLogger = logger.child({ module: 'queue-workers' });

whatsappWorker.on('completed', (job) => {
  workerLogger.debug({ jobId: job.id, queue: 'whatsapp' }, 'Job completed');
});

whatsappWorker.on('failed', (job, err) => {
  workerLogger.error({ jobId: job?.id, queue: 'whatsapp', error: err.message }, 'Job failed');
});

emailsWorker.on('completed', (job) => {
  workerLogger.debug({ jobId: job.id, queue: 'emails' }, 'Job completed');
});

emailsWorker.on('failed', (job, err) => {
  workerLogger.error({ jobId: job?.id, queue: 'emails', error: err.message }, 'Job failed');
});

automationsWorker.on('completed', (job) => {
  workerLogger.debug({ jobId: job.id, queue: 'automations' }, 'Job completed');
});

automationsWorker.on('failed', (job, err) => {
  workerLogger.error({ jobId: job?.id, queue: 'automations', error: err.message }, 'Job failed');
});

reportsWorker.on('completed', (job) => {
  workerLogger.debug({ jobId: job.id, queue: 'reports' }, 'Job completed');
});

reportsWorker.on('failed', (job, err) => {
  workerLogger.error({ jobId: job?.id, queue: 'reports', error: err.message }, 'Job failed');
});

workerLogger.info({ workers: ['whatsapp:3', 'emails:5', 'automations:2', 'reports:1'] }, 'Workers started');
