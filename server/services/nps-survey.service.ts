/**
 * NPS Satisfaction Survey Service
 *
 * Sends post-consultation NPS surveys via WhatsApp and records patient responses.
 * Responses are stored in audit_logs with category classification:
 *   - Promoter:  score 9-10
 *   - Passive:   score 7-8
 *   - Detractor: score 0-6
 */

import { db } from '../db';
import { logger } from '../logger';

const log = logger.child({ module: 'nps-survey' });

/**
 * Sends an NPS survey message to a patient via WhatsApp.
 * Logs the send event to audit_logs for LGPD traceability.
 */
export async function sendNPSSurvey(
  companyId: number,
  patientPhone: string,
  patientName: string,
  sessionId: number,
): Promise<void> {
  const message =
    `Ola ${patientName}! Como voce avalia seu atendimento hoje?\n\n` +
    `Responda com uma nota de 0 a 10:\n` +
    `0-6: Pode melhorar\n` +
    `7-8: Bom\n` +
    `9-10: Excelente\n\n` +
    `Sua opiniao e muito importante para nos! 😊`;

  try {
    const { getWhatsAppProvider } = await import('./whatsapp-provider');
    const provider = await getWhatsAppProvider(companyId);

    if (!provider) {
      log.warn({ companyId }, 'No WhatsApp provider configured — NPS survey not sent');
      return;
    }

    const result = await provider.sendTextMessage({ phone: patientPhone, message });

    if (!result.success) {
      log.warn({ companyId, patientPhone, error: result.error }, 'NPS survey send failed');
      return;
    }

    // Audit trail — LGPD compliance
    await db.$client.query(
      `INSERT INTO audit_logs (company_id, action, resource_type, resource_id, details)
       VALUES ($1, 'create', 'nps_survey', $2, $3)`,
      [
        companyId,
        sessionId,
        JSON.stringify({
          phone: patientPhone,
          patientName,
          sentAt: new Date().toISOString(),
          messageId: result.messageId,
        }),
      ],
    );

    log.info({ companyId, patientPhone, sessionId }, 'NPS survey sent');
  } catch (err) {
    // Non-fatal — survey failure must never break the main flow
    log.error({ err, companyId, patientPhone }, 'Failed to send NPS survey');
  }
}

/**
 * Classifies an NPS score into a standard category.
 */
function classifyNPS(score: number): 'promoter' | 'passive' | 'detractor' {
  if (score >= 9) return 'promoter';
  if (score >= 7) return 'passive';
  return 'detractor';
}

/**
 * Records a patient's NPS response.
 * Validates the score range before persisting.
 *
 * @param companyId  - Tenant ID
 * @param phone      - Patient phone (used to correlate with session)
 * @param score      - Integer 0–10 provided by the patient
 * @param sessionId  - Optional chat session ID for correlation
 */
export async function processNPSResponse(
  companyId: number,
  phone: string,
  score: number,
  sessionId?: number,
): Promise<void> {
  if (score < 0 || score > 10) {
    log.warn({ companyId, phone, score }, 'Invalid NPS score received — ignoring');
    return;
  }

  const category = classifyNPS(score);

  try {
    await db.$client.query(
      `INSERT INTO audit_logs (company_id, action, resource_type, resource_id, details)
       VALUES ($1, 'create', 'nps_response', $2, $3)`,
      [
        companyId,
        sessionId ?? null,
        JSON.stringify({
          phone,
          score,
          category,
          respondedAt: new Date().toISOString(),
        }),
      ],
    );

    log.info({ companyId, phone, score, category }, 'NPS response recorded');
  } catch (err) {
    log.error({ err, companyId, phone }, 'Failed to record NPS response');
    throw err;
  }
}

/**
 * Checks if an incoming WhatsApp message is a valid NPS score reply.
 * Returns the parsed integer or null if the message is not an NPS response.
 */
export function parseNPSScore(message: string): number | null {
  const trimmed = message.trim();
  // Accept a single integer 0-10 (optionally surrounded by whitespace)
  if (/^\d{1,2}$/.test(trimmed)) {
    const score = parseInt(trimmed, 10);
    if (score >= 0 && score <= 10) return score;
  }
  return null;
}
