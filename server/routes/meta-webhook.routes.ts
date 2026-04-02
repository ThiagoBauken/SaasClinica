/**
 * Meta Cloud API Webhook Routes
 * Receives incoming WhatsApp messages from the official Meta Cloud API.
 *
 * Webhook URL: POST /api/v1/webhooks/meta
 * Verify URL: GET /api/v1/webhooks/meta (for webhook registration)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { createHmac } from 'crypto';
import { db } from '../db';
import { clinicSettings } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { asyncHandler } from '../middleware/auth';
import { logger } from '../logger';

const router = Router();
const log = logger.child({ module: 'meta-webhook' });

/**
 * SEGURANÇA: Valida assinatura HMAC-SHA256 dos webhooks Meta.
 * Meta envia o header X-Hub-Signature-256 com HMAC do body.
 * Sem esta validação, qualquer atacante pode forjar webhooks.
 */
function verifyMetaSignature(req: Request, res: Response, next: NextFunction): void {
  const signature = req.headers['x-hub-signature-256'] as string;
  const appSecret = process.env.META_APP_SECRET;

  // Em desenvolvimento sem app secret configurado, apenas logar warning
  if (!appSecret) {
    log.warn('META_APP_SECRET not configured — webhook signature verification DISABLED');
    return next();
  }

  if (!signature) {
    log.warn({ ip: req.ip }, 'Meta webhook missing X-Hub-Signature-256 header');
    res.status(401).json({ error: 'Missing signature' });
    return;
  }

  // Body precisa estar como Buffer/string raw para HMAC funcionar
  const rawBody = typeof req.body === 'string'
    ? req.body
    : JSON.stringify(req.body);

  const expectedSignature = 'sha256=' + createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  if (signature !== expectedSignature) {
    log.warn({ ip: req.ip }, 'Meta webhook HMAC signature mismatch — potential forgery');
    res.status(403).json({ error: 'Invalid signature' });
    return;
  }

  next();
}

/**
 * GET /api/v1/webhooks/meta
 * Meta webhook verification (required for webhook registration)
 */
router.get(
  '/',
  (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token) {
      // Look up the verify token - accept if it matches any company's token
      // In production, you'd want to be more specific
      log.info({ mode, token: String(token).substring(0, 8) + '...' }, 'Meta webhook verification request');

      // For now accept with a simple env var or accept any valid token
      const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
      if (expectedToken && token === expectedToken) {
        return res.status(200).send(challenge);
      }

      // Fallback: check against company-specific tokens
      db.select({ companyId: clinicSettings.companyId })
        .from(clinicSettings)
        .where(eq(clinicSettings.metaWebhookVerifyToken, String(token)))
        .limit(1)
        .then(([match]: any[]) => {
          if (match) {
            log.info({ companyId: match.companyId }, 'Meta webhook verified for company');
            return res.status(200).send(challenge);
          }
          log.warn('Meta webhook verification failed - token mismatch');
          return res.sendStatus(403);
        })
        .catch((err: any) => {
          log.error({ error: err.message }, 'Meta webhook verification error');
          return res.sendStatus(500);
        });
    } else {
      res.sendStatus(400);
    }
  }
);

/**
 * POST /api/v1/webhooks/meta
 * Receives incoming messages from Meta Cloud API
 */
router.post(
  '/',
  verifyMetaSignature,
  asyncHandler(async (req, res) => {
    // Always respond 200 quickly to avoid Meta retries
    res.sendStatus(200);

    try {
      const body = req.body;

      if (body.object !== 'whatsapp_business_account') {
        return;
      }

      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field !== 'messages') continue;

          const value = change.value;
          const phoneNumberId = value?.metadata?.phone_number_id;

          if (!phoneNumberId) continue;

          // Find which company owns this phone number ID
          const [settings] = await db
            .select({ companyId: clinicSettings.companyId })
            .from(clinicSettings)
            .where(eq(clinicSettings.metaPhoneNumberId, phoneNumberId))
            .limit(1);

          if (!settings?.companyId) {
            log.warn({ phoneNumberId }, 'Meta webhook: no company found for phone number ID');
            continue;
          }

          const companyId = settings.companyId;

          // Process incoming messages
          for (const message of value.messages || []) {
            const from = message.from; // Sender phone number
            const msgType = message.type; // text, image, audio, etc.
            const timestamp = message.timestamp;

            let content = '';
            if (msgType === 'text') {
              content = message.text?.body || '';
            } else if (msgType === 'interactive') {
              // Button reply or list reply
              content = message.interactive?.button_reply?.title
                || message.interactive?.list_reply?.title
                || '';
            } else {
              content = `[${msgType}]`;
            }

            if (!content) continue;

            log.info(
              { companyId, from, msgType, contentLength: content.length },
              'Meta webhook: incoming message'
            );

            // Route to chat processor (same as Wuzapi/Evolution)
            try {
              const { createChatProcessor } = await import('../services/chat-processor');
              const processor = createChatProcessor(companyId);
              await processor.processMessage(
                from,
                content,
                message.id,
                false
              );
            } catch (err: any) {
              log.error(
                { companyId, from, error: err.message },
                'Meta webhook: failed to process message'
              );
            }
          }

          // Process status updates (delivered, read, etc.)
          for (const status of value.statuses || []) {
            log.debug(
              { companyId, messageId: status.id, status: status.status },
              'Meta webhook: message status update'
            );
          }
        }
      }
    } catch (error: any) {
      log.error({ error: error.message }, 'Meta webhook processing error');
    }
  })
);

export default router;
