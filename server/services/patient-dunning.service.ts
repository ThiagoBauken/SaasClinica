/**
 * Patient Dunning Service
 * Finds overdue patient receivables and sends WhatsApp reminders at escalating
 * intervals.  Unlike the SaaS dunning service (dunning-service.ts) which targets
 * subscription invoices, this one operates on accounts_receivable rows.
 *
 * Schedule via billing-cron.ts — recommended: once daily at 08:00.
 */

import { logger } from '../logger';

const dunningLogger = logger.child({ module: 'patient-dunning' });

interface OverdueRecord {
  id: number;
  company_id: number;
  patient_id: number;
  amount: number;
  description: string;
  due_date: string;
  full_name: string;
  whatsapp_phone: string | null;
  cellphone: string | null;
  phone: string | null;
  company_name: string;
}

/**
 * Compose the dunning message based on how many days overdue the record is.
 * Returns an empty string if no message should be sent for this interval.
 */
function buildMessage(record: OverdueRecord, daysOverdue: number): string {
  const amountBRL = (record.amount / 100).toFixed(2).replace('.', ',');
  const dueDateStr = new Date(record.due_date).toLocaleDateString('pt-BR');

  if (daysOverdue <= 3) {
    return (
      `Ola ${record.full_name}! Informamos que a parcela de R$ ${amountBRL} ` +
      `referente a "${record.description}" venceu em ${dueDateStr}. ` +
      `Por favor, entre em contato para regularizar. - ${record.company_name}`
    );
  }

  if (daysOverdue <= 7) {
    return (
      `${record.full_name}, sua parcela de R$ ${amountBRL} esta ` +
      `${daysOverdue} dias em atraso. Entre em contato para negociarmos. ` +
      `- ${record.company_name}`
    );
  }

  if (daysOverdue <= 30) {
    return (
      `Prezado(a) ${record.full_name}, voce possui um debito de R$ ${amountBRL} ` +
      `vencido ha ${daysOverdue} dias. Regularize sua situacao para manter seus ` +
      `atendimentos. - ${record.company_name}`
    );
  }

  // Beyond 30 days: do not send repeated messages (company should escalate via
  // other means such as debt collection).  Return empty string to skip.
  return '';
}

/**
 * Process all overdue patient receivables:
 *  1. Mark status = 'overdue' for pending records past their due_date.
 *  2. Send WhatsApp reminders on day 1–3, 4–7, and 8–30.
 */
export async function processOverduePatientPayments(): Promise<void> {
  dunningLogger.info('Starting patient dunning check');

  let db: any | undefined;
  try {
    ({ db } = await import('../db'));
  } catch {
    // db might be a named export
    const mod = await import('../db');
    db = (mod as any).db;
  }

  if (!db) {
    dunningLogger.error('Could not import db — aborting patient dunning');
    return;
  }

  try {
    // Fetch all pending / overdue receivables that have passed their due date
    const overdueResult = await (db as any).$client.query(`
      SELECT
        ar.id,
        ar.company_id,
        ar.patient_id,
        ar.amount,
        ar.description,
        ar.due_date,
        p.full_name,
        p.whatsapp_phone,
        p.cellphone,
        p.phone,
        c.name AS company_name
      FROM accounts_receivable ar
      JOIN patients p ON p.id = ar.patient_id
      JOIN companies c ON c.id = ar.company_id
      WHERE ar.status IN ('pending', 'overdue')
        AND ar.due_date < CURRENT_DATE
        AND ar.deleted_at IS NULL
        AND p.deleted_at IS NULL
    `);

    const records: OverdueRecord[] = overdueResult.rows;
    dunningLogger.info({ count: records.length }, 'Overdue receivables found');

    const now = Date.now();

    for (const record of records) {
      const daysOverdue = Math.floor(
        (now - new Date(record.due_date).getTime()) / 86_400_000
      );

      // Always ensure the status is updated to 'overdue'
      await (db as any).$client.query(
        `UPDATE accounts_receivable
         SET status = 'overdue', updated_at = NOW()
         WHERE id = $1 AND status = 'pending'`,
        [record.id]
      );

      const phone =
        record.whatsapp_phone || record.cellphone || record.phone || null;

      if (!phone) {
        dunningLogger.debug(
          { recordId: record.id, patientId: record.patient_id },
          'No phone available, skipping WhatsApp notification'
        );
        continue;
      }

      const message = buildMessage(record, daysOverdue);
      if (!message) {
        dunningLogger.debug(
          { recordId: record.id, daysOverdue },
          'Outside dunning window, skipping'
        );
        continue;
      }

      try {
        const { getWhatsAppProvider } = await import('./whatsapp-provider');
        const provider = await getWhatsAppProvider(record.company_id);

        if (!provider) {
          dunningLogger.warn(
            { companyId: record.company_id },
            'No WhatsApp provider configured'
          );
          continue;
        }

        const result = await provider.sendTextMessage({ phone, message });

        if (result.success) {
          dunningLogger.info(
            {
              recordId: record.id,
              patientId: record.patient_id,
              daysOverdue,
              provider: result.provider,
            },
            'Dunning message sent'
          );
        } else {
          dunningLogger.warn(
            { recordId: record.id, error: result.error },
            'Dunning message delivery failed'
          );
        }
      } catch (err) {
        dunningLogger.error(
          { err, recordId: record.id, phone },
          'Failed to send dunning WhatsApp message'
        );
      }
    }

    dunningLogger.info('Patient dunning check completed');
  } catch (error) {
    dunningLogger.error({ err: error }, 'Error during patient dunning process');
  }
}
