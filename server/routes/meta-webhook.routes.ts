/**
 * Meta Cloud API Webhook Routes
 * Receives incoming WhatsApp messages from the official Meta Cloud API.
 *
 * Webhook URL: POST /api/v1/webhooks/meta
 * Verify URL: GET /api/v1/webhooks/meta (for webhook registration)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
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
 * Sem esta validação, qualquer atacante pode forjar webhooks e impersonar pacientes.
 *
 * Em produção a verificação é OBRIGATÓRIA — falha hard se META_APP_SECRET ausente.
 * Em desenvolvimento (NODE_ENV !== 'production') logamos warning e seguimos,
 * para permitir testes locais sem secret.
 */
function verifyMetaSignature(req: Request, res: Response, next: NextFunction): void {
  const signature = req.headers['x-hub-signature-256'] as string;
  const appSecret = process.env.META_APP_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  if (!appSecret) {
    if (isProd) {
      // FAIL HARD em produção. Sem secret = qualquer um pode forjar webhooks.
      log.error('META_APP_SECRET not configured in production — refusing webhook');
      res.status(500).json({ error: 'Webhook signature verification not configured' });
      return;
    }
    log.warn('META_APP_SECRET not configured — webhook signature verification DISABLED (dev only)');
    return next();
  }

  if (!signature) {
    log.warn({ ip: req.ip }, 'Meta webhook missing X-Hub-Signature-256 header');
    res.status(401).json({ error: 'Missing signature' });
    return;
  }

  // Body precisa estar como Buffer/string raw para HMAC funcionar.
  // IMPORTANTE: o express.raw() middleware deve estar configurado para esta rota,
  // senão JSON.stringify pode reordenar campos e quebrar a assinatura.
  const rawBody = (req as any).rawBody
    ? (req as any).rawBody.toString('utf8')
    : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

  const expectedSignature = 'sha256=' + createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  // Comparação timing-safe para evitar timing attacks
  let valid = false;
  try {
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length === expBuf.length) {
      valid = timingSafeEqual(sigBuf, expBuf);
    }
  } catch {
    valid = false;
  }

  if (!valid) {
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
          const businessDisplayPhone = value?.metadata?.display_phone_number;

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

          // Process incoming messages — route to AI Agent (not legacy chat-processor)
          for (const message of value.messages || []) {
            const from: string = message.from; // Sender phone number
            const msgType: string = message.type; // text, image, audio, etc.

            // ANTI-LOOP: Meta normalmente NÃO entrega mensagens enviadas pela
            // própria business account no array `messages` (elas vêm como
            // `statuses`). Mas em multi-operador (atendentes humanos no app
            // oficial), o `from` PODE ser o próprio número da clínica. Se
            // detectarmos isso, marcamos como fromMe para acionar takeover.
            const fromMe = !!businessDisplayPhone &&
              from.replace(/\D/g, '').endsWith(businessDisplayPhone.replace(/\D/g, '').slice(-10));

            let content = '';
            let mediaUrl: string | null = null;
            let mimeType: string | null = null;

            if (msgType === 'text') {
              content = message.text?.body || '';
            } else if (msgType === 'interactive') {
              // Button reply or list reply
              content = message.interactive?.button_reply?.title
                || message.interactive?.list_reply?.title
                || '';
            } else if (msgType === 'image' || msgType === 'audio' || msgType === 'voice') {
              // Para mídia, content vem com caption/identificador
              content = message[msgType]?.caption || `[${msgType}]`;
              mimeType = message[msgType]?.mime_type || null;
              // Note: download da mídia via Graph API não implementado aqui
              // (requer chamada extra ao endpoint /media com o id)
            } else {
              // Tipos não suportados — apenas ignorar
              continue;
            }

            if (!content && !mediaUrl) continue;

            log.info(
              { companyId, from, msgType, fromMe, contentLength: content.length },
              'Meta webhook: incoming message'
            );

            // Route to AI Agent message handler (mesma rota que Wuzapi/Evolution)
            try {
              const { handleIncomingMessage } = await import('../services/ai-agent/message-handler');
              await handleIncomingMessage({
                companyId,
                phone: from,
                message: content,
                messageType: msgType === 'voice' ? 'voice' : msgType,
                wuzapiMessageId: message.id,
                fromMe,
                mediaUrl,
                mimeType,
              });
            } catch (err: any) {
              log.error(
                { companyId, from, error: err.message },
                'Meta webhook: failed to process message'
              );
            }
          }

          // Process status updates (delivered, read, etc.)
          // Importante: ack de outgoing messages NÃO devem disparar fluxo de takeover.
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
