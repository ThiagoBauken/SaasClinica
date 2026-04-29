import { Router } from 'express';
import { storage } from '../storage';
import { asyncHandler } from '../middleware/auth';
import { db } from '../db';
import { or, and, eq, inArray, isNotNull, desc } from 'drizzle-orm';
import { nowpaymentsService } from '../billing/nowpayments-service';
import { mercadopagoService } from '../billing/mercadopago-service';
import { stripeService } from '../billing/stripe-service';
import { logger } from '../logger';
import { timingSafeEqual } from 'crypto';
import { webhookIdempotency } from '../middleware/webhook-idempotency';

const log = logger.child({ module: 'webhooks' });
const router = Router();

// Shared idempotency middleware instance (24-hour TTL)
const dedup = webhookIdempotency();

/**
 * POST /api/webhooks/wuzapi/incoming
 * Recebe mensagens WhatsApp do Wuzapi
 *
 * Wuzapi envia para este endpoint quando:
 * - Paciente envia mensagem
 * - Paciente responde confirmação
 * - Status de mensagem muda (entregue, lido, etc.)
 */
router.post(
  '/wuzapi/incoming',
  dedup,
  asyncHandler(async (req, res) => {
    const { type, data } = req.body;

    // Webhook secret is MANDATORY. Missing env var must fail closed to
    // prevent spoofed WhatsApp messages being accepted in misconfigured envs.
    const webhookSecret = req.headers['x-webhook-secret'] as string;
    const expectedSecret = process.env.WUZAPI_WEBHOOK_SECRET;

    if (!expectedSecret) {
      log.error('WUZAPI_WEBHOOK_SECRET is not configured — rejecting webhook');
      return res.status(503).json({ error: 'Service misconfigured' });
    }
    if (!webhookSecret ||
        webhookSecret.length !== expectedSecret.length ||
        !timingSafeEqual(Buffer.from(webhookSecret), Buffer.from(expectedSecret))) {
      log.warn('Invalid Wuzapi webhook secret received');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (type === 'message') {
      // Mensagem recebida do WhatsApp
      const { from, message, messageId, timestamp } = data;

      // Limpar número de telefone (remover caracteres especiais)
      const cleanPhone = from.replace(/[^\d+]/g, '');

      // Buscar paciente pelo número de WhatsApp
      const { patients } = await import('@shared/schema');
      const [patient] = await db
        .select()
        .from(patients)
        .where(
          or(
            eq(patients.whatsappPhone, cleanPhone),
            eq(patients.cellphone, cleanPhone),
            eq(patients.phone, cleanPhone)
          )
        )
        .limit(1);

      if (!patient) {
        log.info({ phone: cleanPhone }, 'Patient not found for phone');
        return res.json({ success: true, received: true, patientNotFound: true });
      }

      // Buscar agendamento pendente de confirmação do paciente
      const { appointments } = await import('@shared/schema');
      const [appointment] = await db
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.patientId, patient.id),
            eq(appointments.companyId, patient.companyId),
            inArray(appointments.status, ['scheduled', 'confirmed']),
            eq(appointments.confirmedByPatient, false),
            isNotNull(appointments.confirmationMessageId)
          )
        )
        .orderBy(desc(appointments.startTime))
        .limit(1);

      if (appointment) {
        // Detectar resposta de confirmação
        const messageLower = message.toLowerCase().trim();
        const isConfirmation = messageLower.includes('sim') ||
                              messageLower.includes('confirmo') ||
                              messageLower.includes('ok') ||
                              messageLower.includes('confirmar');
        const isRejection = messageLower.includes('não') ||
                           messageLower.includes('nao') ||
                           messageLower.includes('cancelar');

        if (isConfirmation || isRejection) {
          // Atualizar appointment com resposta do paciente
          await db
            .update(appointments)
            .set({
              patientResponse: message,
              confirmedByPatient: isConfirmation,
              confirmationDate: new Date(),
              confirmationMethod: 'whatsapp',
              status: isConfirmation ? 'confirmed' : 'scheduled',
              updatedAt: new Date(),
            })
            .where(eq(appointments.id, appointment.id));

          logger.info({
            appointmentId: appointment.id,
            patientId: patient.id,
            confirmed: isConfirmation,
            response: message,
          }, 'Patient confirmation processed');

          return res.json({
            success: true,
            processed: true,
            appointmentId: appointment.id,
            confirmed: isConfirmation,
          });
        }
      }

      // Mensagem não relacionada a confirmação - apenas log
      logger.info({
        from: cleanPhone,
        patientId: patient?.id,
        message,
        messageId,
      }, 'Received WhatsApp message (not a confirmation)');

      res.json({ success: true, received: true });
    } else if (type === 'status') {
      // Status de mensagem (entregue, lido, etc.)
      const { messageId, status } = data;

      // Atualizar status no automation_logs (se existir)
      try {
        const { automationLogs } = await import('@shared/schema');
        await db
          .update(automationLogs)
          .set({
            executionStatus: status === 'read' ? 'success' : 'pending',
          })
          .where(eq(automationLogs.messageId, messageId));
      } catch (error) {
        log.error({ err: error }, 'Failed to update message status');
      }

      log.info({ messageId, status }, 'Message status update');
      res.json({ success: true, statusUpdated: true });
    } else {
      res.status(400).json({ error: 'Unknown webhook type' });
    }
  })
);

/**
 * POST /api/webhooks/nowpayments
 * Webhook do NOWPayments para pagamentos crypto
 */
router.post('/nowpayments', dedup, async (req, res) => {
  try {
    const signature = req.headers['x-nowpayments-sig'] as string;
    const payload = JSON.stringify(req.body);

    // Verificar assinatura
    const isValid = nowpaymentsService.verifyWebhookSignature(payload, signature);

    if (!isValid) {
      log.warn('⚠️ Invalid NOWPayments webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Processar webhook
    await nowpaymentsService.handleWebhook(req.body);

    res.json({ received: true });
  } catch (error) {
    log.error({ err: error }, 'Erro ao processar webhook NOWPayments');
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /api/webhooks/mercadopago
 * Webhook do MercadoPago para pagamentos Pix/Boleto/Cartão
 */
router.post('/mercadopago', dedup, async (req, res) => {
  try {
    const xSignature = req.headers['x-signature'] as string;
    const xRequestId = req.headers['x-request-id'] as string;

    // Verificar assinatura
    const isValid = mercadopagoService.verifyWebhookSignature(req.body, xSignature, xRequestId);

    if (!isValid) {
      log.warn('⚠️ Invalid MercadoPago webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Processar webhook
    await mercadopagoService.handleWebhook(req.body);

    res.status(200).send();
  } catch (error) {
    log.error({ err: error }, 'Erro ao processar webhook MercadoPago');
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /api/webhooks/stripe
 * Webhook do Stripe (já existe no stripe-service, mas adicionamos aqui para centralizar)
 */
router.post('/stripe', dedup, async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    // req.body is already a raw Buffer because server/index.ts registers
    // express.raw() specifically for this path BEFORE express.json().
    // This preserves the original bytes required for Stripe HMAC verification.
    const payload = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));

    await stripeService.handleWebhook(payload, signature);

    res.json({ received: true });
  } catch (error) {
    log.error({ err: error }, 'Erro ao processar webhook Stripe');
    res.status(400).json({ error: 'Webhook error' });
  }
});

// =============================================
// WEBHOOK WUZAPI 3.0 - COM SUPORTE A MÍDIA
// =============================================

/**
 * POST /api/webhooks/wuzapi/:companyId
 * Recebe TODOS os eventos do Wuzapi 3.0 para uma empresa específica
 *
 * Tipos de eventos suportados:
 * - Message: Mensagens de texto, imagem, áudio, vídeo, documento, sticker, location
 * - ReadReceipt: Status de leitura
 * - Presence: Status online/offline
 * - ChatPresence: Digitando, gravando áudio
 * - HistorySync: Sincronização de histórico
 * - Call: Chamadas de voz/vídeo
 */
router.post(
  '/wuzapi/:companyId',
  dedup,
  asyncHandler(async (req, res) => {
    const companyId = parseInt(req.params.companyId);
    const event = req.body;

    // Log do evento recebido
    log.info({ companyId, event: JSON.stringify(event).substring(0, 500) }, 'Wuzapi webhook received');

    // Importações dinâmicas
    const { chatMessages, chatSessions, clinicSettings } = await import('@shared/schema');
    const fs = await import('fs');
    const path = await import('path');

    // Buscar configurações da empresa para validar token
    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    if (!settings) {
      log.warn(`[Wuzapi Webhook] Company ${companyId} not found`);
      return res.status(404).json({ error: 'Company not found' });
    }

    // Processar diferentes tipos de evento
    const eventType = event.type || event.Type || 'unknown';

    switch (eventType.toLowerCase()) {
      case 'message': {
        // Extrair dados da mensagem (compatível com Wuzapi 3.0)
        const data = event.data || event.Data || event;
        const messageInfo = data.Info || data.info || {};
        const messageContent = data.Message || data.message || {};

        const from = messageInfo.RemoteJid || messageInfo.remoteJid || data.From || data.from || '';
        const fromMe = messageInfo.FromMe || messageInfo.fromMe || data.FromMe || data.fromMe || false;
        const messageId = messageInfo.Id || messageInfo.id || data.Id || data.id || '';
        const timestamp = messageInfo.Timestamp || messageInfo.timestamp || data.Timestamp || Date.now();

        // Limpar número de telefone
        const cleanPhone = from.replace('@s.whatsapp.net', '').replace(/[^\d+]/g, '');

        if (!cleanPhone) {
          return res.json({ success: true, skipped: true, reason: 'No phone number' });
        }

        // Determinar tipo de mensagem e conteúdo
        let messageType = 'text';
        let textContent = '';
        let mediaUrl = null;
        let mediaType = null;
        let mimeType = null;
        let fileName = null;

        // Texto
        if (messageContent.Conversation || messageContent.conversation) {
          textContent = messageContent.Conversation || messageContent.conversation;
          messageType = 'text';
        }
        // Texto estendido (com links, etc)
        else if (messageContent.ExtendedTextMessage || messageContent.extendedTextMessage) {
          const ext = messageContent.ExtendedTextMessage || messageContent.extendedTextMessage;
          textContent = ext.Text || ext.text || '';
          messageType = 'text';
        }
        // Imagem
        else if (messageContent.ImageMessage || messageContent.imageMessage) {
          const img = messageContent.ImageMessage || messageContent.imageMessage;
          textContent = img.Caption || img.caption || '[Imagem]';
          messageType = 'image';
          mimeType = img.Mimetype || img.mimetype || 'image/jpeg';
          mediaType = 'image';
        }
        // Áudio/Voice Note
        else if (messageContent.AudioMessage || messageContent.audioMessage) {
          const audio = messageContent.AudioMessage || messageContent.audioMessage;
          textContent = '[Áudio]';
          messageType = audio.Ptt || audio.ptt ? 'voice' : 'audio';
          mimeType = audio.Mimetype || audio.mimetype || 'audio/ogg';
          mediaType = 'audio';
        }
        // Vídeo
        else if (messageContent.VideoMessage || messageContent.videoMessage) {
          const video = messageContent.VideoMessage || messageContent.videoMessage;
          textContent = video.Caption || video.caption || '[Vídeo]';
          messageType = 'video';
          mimeType = video.Mimetype || video.mimetype || 'video/mp4';
          mediaType = 'video';
        }
        // Documento
        else if (messageContent.DocumentMessage || messageContent.documentMessage) {
          const doc = messageContent.DocumentMessage || messageContent.documentMessage;
          fileName = doc.FileName || doc.fileName || 'documento';
          textContent = `[Documento: ${fileName}]`;
          messageType = 'document';
          mimeType = doc.Mimetype || doc.mimetype || 'application/octet-stream';
          mediaType = 'document';
        }
        // Sticker
        else if (messageContent.StickerMessage || messageContent.stickerMessage) {
          textContent = '[Sticker]';
          messageType = 'sticker';
          mediaType = 'sticker';
        }
        // Localização
        else if (messageContent.LocationMessage || messageContent.locationMessage) {
          const loc = messageContent.LocationMessage || messageContent.locationMessage;
          const lat = loc.DegreesLatitude || loc.degreesLatitude;
          const lng = loc.DegreesLongitude || loc.degreesLongitude;
          textContent = `[Localização: ${lat}, ${lng}]`;
          messageType = 'location';
        }
        // Contato
        else if (messageContent.ContactMessage || messageContent.contactMessage) {
          const contact = messageContent.ContactMessage || messageContent.contactMessage;
          textContent = `[Contato: ${contact.DisplayName || contact.displayName || 'Contato'}]`;
          messageType = 'contact';
        }
        // Mensagem não suportada
        else {
          textContent = '[Tipo de mensagem não suportado]';
          messageType = 'unknown';
          log.info({ content: JSON.stringify(messageContent).substring(0, 300) }, 'Unknown message type');
        }

        // Se tem mídia, tentar baixar
        if (mediaType && messageId && settings.wuzapiApiKey) {
          try {
            const baseUrl = process.env.WUZAPI_BASE_URL || 'http://private_wuzapi:8080';
            const downloadResponse = await fetch(`${baseUrl}/chat/download/media`, {
              method: 'POST',
              headers: {
                'token': settings.wuzapiApiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                MessageId: messageId,
              }),
            });

            if (downloadResponse.ok) {
              const mediaData = await downloadResponse.json();
              if (mediaData.success !== false && mediaData.data?.Data) {
                // Salvar mídia no servidor
                const uploadsDir = path.join(process.cwd(), 'uploads', 'chat', String(companyId));
                if (!fs.existsSync(uploadsDir)) {
                  fs.mkdirSync(uploadsDir, { recursive: true });
                }

                const extension = mimeType?.split('/')[1] || 'bin';
                const mediaFileName = `${messageId}.${extension}`;
                const filePath = path.join(uploadsDir, mediaFileName);

                // Decodificar base64 e salvar
                const buffer = Buffer.from(mediaData.data.Data, 'base64');
                fs.writeFileSync(filePath, buffer);

                mediaUrl = `/uploads/chat/${companyId}/${mediaFileName}`;
                log.info(`[Wuzapi Webhook] Media saved: ${mediaUrl}`);
              }
            }
          } catch (mediaError) {
            log.error({ err: mediaError }, 'Error downloading media');
          }
        }

        // Buscar ou criar sessão de chat
        let [session] = await db
          .select()
          .from(chatSessions)
          .where(
            and(
              eq(chatSessions.companyId, companyId),
              eq(chatSessions.phone, cleanPhone)
            )
          )
          .limit(1);

        if (!session) {
          // Criar nova sessão
          const [newSession] = await db
            .insert(chatSessions)
            .values({
              companyId,
              phone: cleanPhone,
              status: 'active',
              lastMessageAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();
          session = newSession;
        } else {
          // Atualizar última mensagem
          await db
            .update(chatSessions)
            .set({
              lastMessageAt: new Date(),
              updatedAt: new Date(),
              status: 'active',
            })
            .where(eq(chatSessions.id, session.id));
        }

        // Salvar mensagem no banco apenas para tipos que o AI Agent NÃO processa
        // (o AI Agent salva via addUserMessage para text/audio/image que ele processa)
        const aiProcessableTypes = ['text', 'audio', 'voice', 'image'];
        const willBeProcessedByAI = settings.chatEnabled && aiProcessableTypes.includes(messageType);

        if (!willBeProcessedByAI) {
          await db.insert(chatMessages).values({
            sessionId: session.id,
            companyId,
            direction: fromMe ? 'outgoing' : 'incoming',
            messageType,
            content: textContent,
            mediaUrl,
            mimeType,
            fileName,
            wuzapiMessageId: messageId,
            status: 'received',
            createdAt: new Date(timestamp * 1000 || Date.now()),
          });
        }

        // Processar resposta automática via AI Agent nativo (Claude)
        if (settings.chatEnabled) {
          try {
            const { handleIncomingMessage } = await import('../services/ai-agent/message-handler');
            await handleIncomingMessage({
              companyId,
              phone: cleanPhone,
              message: textContent,
              messageType,
              wuzapiMessageId: messageId,
              fromMe: !!fromMe,
              sessionId: session.id,
              mediaUrl: mediaUrl ?? null,
              mimeType: mimeType ?? null,
            });
          } catch (aiError) {
            log.error({ err: aiError }, 'AI Agent processing error');
          }
        }

        return res.json({
          success: true,
          processed: true,
          messageType,
          sessionId: session.id,
          hasMedia: !!mediaUrl,
        });
      }

      case 'readreceipt':
      case 'receipt': {
        // Status de leitura
        const data = event.data || event.Data || event;
        const messageIds = data.MessageIds || data.messageIds || [];
        const status = data.Type || data.type || 'read'; // read, delivered, played

        log.info(`[Wuzapi Webhook] Read receipt: ${messageIds.join(', ')} - ${status}`);

        // Atualizar status das mensagens
        if (messageIds.length > 0) {
          const { chatMessages } = await import('@shared/schema');
          for (const msgId of messageIds) {
            await db
              .update(chatMessages)
              .set({
                status: status === 'read' ? 'read' : 'delivered',
                readAt: status === 'read' ? new Date() : undefined,
              })
              .where(eq(chatMessages.wuzapiMessageId, msgId));
          }
        }

        return res.json({ success: true, statusUpdated: true });
      }

      case 'chatpresence':
      case 'presence': {
        // Digitando, gravando áudio, online/offline
        const data = event.data || event.Data || event;
        const from = data.Chat || data.chat || '';
        const state = data.State || data.state || ''; // composing, recording, available, unavailable

        log.info(`[Wuzapi Webhook] Presence: ${from} - ${state}`);

        // Pode ser usado para mostrar "digitando..." na UI
        // Por enquanto apenas log

        return res.json({ success: true, presenceReceived: true });
      }

      case 'call': {
        // Chamada de voz/vídeo
        const data = event.data || event.Data || event;
        const from = data.From || data.from || '';
        const callType = data.Type || data.type || 'voice'; // voice, video

        log.info(`[Wuzapi Webhook] Call from ${from}: ${callType}`);

        // Notificar admin sobre chamada perdida (opcional)

        return res.json({ success: true, callReceived: true });
      }

      default:
        log.info(`[Wuzapi Webhook] Unknown event type: ${eventType}`);
        return res.json({ success: true, skipped: true, reason: 'Unknown event type' });
    }
  })
);

export default router;
