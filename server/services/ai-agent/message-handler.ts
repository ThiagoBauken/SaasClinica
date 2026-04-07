/**
 * WhatsApp Message Handler
 *
 * Replaces the N8N forwarding in webhooks.routes.ts with direct AI processing.
 * Handles debouncing (5s window), AI processing, and response delivery.
 *
 * Flow:
 *   Wuzapi webhook → debounce → AI Agent → WhatsApp response
 *
 * Media support:
 *   - audio / voice: transcribed via OpenAI Whisper before AI processing
 *   - image: forwarded as a base64 content block to Claude Vision
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../../logger';
import { processMessage, type AgentResult } from './index';
import { getWhatsAppProvider } from '../whatsapp-provider';
import { broadcastToCompany } from '../../websocket-redis-adapter';
import { isAgentReady } from './activation-check';
import { markOutboundSent } from './conversation-memory';

const log = logger.child({ module: 'message-handler' });

const DEBOUNCE_MS = 5000; // 5 seconds to batch rapid messages

// ============================================================
// HUMANIZAÇÃO DE ENVIO
// ============================================================
const HUMANIZE_DELAY_MIN_MS = 800;   // delay mínimo entre chunks
const HUMANIZE_DELAY_MAX_MS = 2200;  // delay máximo entre chunks
const TYPING_PER_CHAR_MS = 35;       // simulação de digitação
const MAX_CHUNK_LENGTH = 350;        // se uma mensagem passar disso, splitar
const MIN_TYPING_DELAY_MS = 600;
const MAX_TYPING_DELAY_MS = 4000;

/**
 * Quebra uma resposta longa em chunks naturais para envio humanizado.
 * Tenta dividir por:
 *   1. Parágrafos (\n\n)
 *   2. Linhas únicas (\n)
 *   3. Frases (. ! ?) — apenas se ainda estiver acima do limite
 *
 * Garante que nenhum chunk exceda MAX_CHUNK_LENGTH.
 */
function splitIntoChunks(text: string, maxLen = MAX_CHUNK_LENGTH): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxLen) return [trimmed];

  // 1) Tenta por parágrafos
  const paragraphs = trimmed.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const chunks: string[] = [];

  for (const p of paragraphs) {
    if (p.length <= maxLen) {
      chunks.push(p);
      continue;
    }
    // 2) Tenta por linhas
    const lines = p.split(/\n/).map(l => l.trim()).filter(Boolean);
    let buf = '';
    for (const line of lines) {
      if ((buf + (buf ? '\n' : '') + line).length <= maxLen) {
        buf = buf ? `${buf}\n${line}` : line;
      } else {
        if (buf) chunks.push(buf);
        if (line.length <= maxLen) {
          buf = line;
        } else {
          // 3) Frase a frase
          const sentences = line.split(/(?<=[.!?])\s+/);
          let sbuf = '';
          for (const s of sentences) {
            if ((sbuf + ' ' + s).trim().length <= maxLen) {
              sbuf = (sbuf ? `${sbuf} ${s}` : s);
            } else {
              if (sbuf) chunks.push(sbuf);
              sbuf = s.length <= maxLen ? s : s.slice(0, maxLen);
            }
          }
          if (sbuf) chunks.push(sbuf);
          buf = '';
        }
      }
    }
    if (buf) chunks.push(buf);
  }

  // Merge consecutivos curtos (< 80 chars) para não fragmentar demais
  const merged: string[] = [];
  for (const c of chunks) {
    const last = merged[merged.length - 1];
    if (last && (last.length + c.length + 2) <= maxLen && last.length < 80) {
      merged[merged.length - 1] = `${last}\n${c}`;
    } else {
      merged.push(c);
    }
  }
  return merged;
}

/** Delay aleatório entre min e max para variar e parecer humano */
function humanDelay(min = HUMANIZE_DELAY_MIN_MS, max = HUMANIZE_DELAY_MAX_MS): number {
  return Math.floor(Math.random() * (max - min)) + min;
}

/** Delay de "digitação" proporcional ao tamanho do próximo chunk */
function typingDelayFor(text: string): number {
  const ms = text.length * TYPING_PER_CHAR_MS;
  return Math.max(MIN_TYPING_DELAY_MS, Math.min(MAX_TYPING_DELAY_MS, ms));
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Verifica se está em "horário de silêncio" (22h–7h horário local).
 * Mensagens proativas (lembretes, marketing) não devem ser enviadas neste período.
 * Mensagens de RESPOSTA a um paciente que acabou de escrever SÃO permitidas
 * (se ele escreveu às 23h, ele claramente está acordado).
 */
function isQuietHours(): boolean {
  const hour = new Date().getHours();
  return hour >= 22 || hour < 7;
}

/** Buffered messages waiting for debounce to complete */
interface MessageBuffer {
  messages: string[];
  companyId: number;
  phone: string;
  sessionId?: number;
  wuzapiMessageId?: string;
  fromMe: boolean;
  timeoutId: ReturnType<typeof setTimeout>;
  /** For image messages: base64-encoded image data of the most recent image */
  pendingImageBase64?: string;
  /** MIME type of the pending image */
  pendingImageMime?: string;
}

// Debounce buffer: key = `${companyId}:${phone}`
const messageBuffers = new Map<string, MessageBuffer>();

/**
 * Resolves the absolute file-system path for a stored media file.
 * mediaUrl is stored as `/uploads/chat/{companyId}/{file}` (a URL path).
 * We map that to `{cwd}/uploads/chat/{companyId}/{file}`.
 */
function resolveMediaPath(mediaUrl: string): string {
  // Strip leading slash and join with cwd
  const relative = mediaUrl.replace(/^\//, '');
  return path.join(process.cwd(), relative);
}

/**
 * Transcribes an audio file using local Whisper first, then OpenAI Whisper as fallback.
 *
 * Chain: Local whisper.cpp → OpenAI Whisper API (fallback)
 * LGPD: Prefers local processing; only falls back to OpenAI if local unavailable.
 */
async function transcribeAudio(filePath: string): Promise<string | null> {
  if (!fs.existsSync(filePath)) {
    log.warn({ filePath }, 'Audio file not found on disk');
    return null;
  }

  // 1. Try local Whisper (whisper.cpp / faster-whisper server)
  const whisperUrl = process.env.WHISPER_API_URL || 'http://localhost:8178/inference';
  try {
    const audioBuffer = fs.readFileSync(filePath);
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer]), 'audio.wav');
    formData.append('language', 'pt');

    const response = await fetch(whisperUrl, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(60000),
    });

    if (response.ok) {
      const result = await response.json();
      log.info({ filePath, provider: 'local-whisper' }, 'Audio transcribed successfully');
      return result.text || null;
    }
    log.warn({ status: response.status }, 'Local Whisper returned error, trying fallback');
  } catch (err) {
    log.warn({ err }, 'Local Whisper unavailable, trying OpenAI fallback');
  }

  // 2. Fallback: OpenAI Whisper API
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    log.warn('No local Whisper and no OPENAI_API_KEY — cannot transcribe audio');
    return null;
  }

  try {
    const audioBuffer = fs.readFileSync(filePath);
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer]), 'audio.wav');
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      throw new Error(`OpenAI Whisper error: ${response.status}`);
    }

    const result = await response.json();
    log.info({ filePath, provider: 'openai-whisper' }, 'Audio transcribed via OpenAI fallback');
    return result.text || null;
  } catch (err) {
    log.error({ err, filePath }, 'All transcription providers failed');
    return null;
  }
}

/**
 * Reads an image file from disk and returns it as a base64 string.
 * Returns null when the file cannot be read.
 */
function readImageAsBase64(filePath: string): string | null {
  if (!fs.existsSync(filePath)) {
    log.warn({ filePath }, 'Image file not found on disk');
    return null;
  }

  try {
    const buffer = fs.readFileSync(filePath);
    return buffer.toString('base64');
  } catch (err) {
    log.error({ err, filePath }, 'Failed to read image file');
    return null;
  }
}

/**
 * Handles an incoming WhatsApp message with debouncing.
 * Called from the wuzapi/:companyId webhook.
 *
 * Multiple rapid messages from the same user are batched into one AI call.
 * Audio messages are transcribed; images are forwarded to Claude Vision.
 */
export async function handleIncomingMessage(params: {
  companyId: number;
  phone: string;
  message: string;
  messageType: string;
  wuzapiMessageId?: string;
  fromMe: boolean;
  sessionId?: number;
  mediaUrl?: string | null;
  mimeType?: string | null;
}): Promise<void> {
  const { companyId, phone, message, messageType, wuzapiMessageId, fromMe, mediaUrl, mimeType } = params;

  // Skip messages that carry no processable content
  const isText = messageType === 'text';
  const isAudio = messageType === 'audio' || messageType === 'voice';
  const isImage = messageType === 'image';

  if (!isText && !isAudio && !isImage) {
    // Other types (video, document, sticker, location…) are stored but not AI-processed
    return;
  }

  // Text messages with empty content are skipped
  if (isText && !message.trim()) {
    return;
  }

  // Check if AI agent is ready (all required config filled)
  const ready = await isAgentReady(companyId);
  if (!ready) {
    log.info({ companyId }, 'AI Agent not ready - missing required configuration. Skipping.');
    return;
  }

  // --- Resolve media before buffering ---

  // For audio: transcribe immediately so the text can be batched with other messages
  let resolvedText = message;

  if (isAudio) {
    if (mediaUrl) {
      const filePath = resolveMediaPath(mediaUrl);
      const transcribed = await transcribeAudio(filePath);
      if (transcribed) {
        resolvedText = `[Áudio transcrito]: ${transcribed}`;
        log.info({ companyId, phone }, 'Voice message transcribed');
      } else {
        // Whisper not available or file missing – ask patient to type
        resolvedText = '[Paciente enviou áudio – transcrição indisponível]';
      }
    } else {
      resolvedText = '[Paciente enviou áudio – arquivo de mídia não encontrado]';
    }
  }

  // For image: read as base64 now; store in buffer for the current debounce window
  let imageBase64: string | undefined;
  let imageMime: string | undefined;

  if (isImage && mediaUrl) {
    const filePath = resolveMediaPath(mediaUrl);
    const b64 = readImageAsBase64(filePath);
    if (b64) {
      imageBase64 = b64;
      // Normalise mime type: Claude only accepts image/jpeg, image/png, image/gif, image/webp
      const raw = (mimeType || 'image/jpeg').toLowerCase();
      imageMime = ['image/png', 'image/gif', 'image/webp'].includes(raw) ? raw : 'image/jpeg';
    } else {
      resolvedText = '[Paciente enviou imagem – arquivo de mídia não encontrado]';
    }
  }

  const bufferKey = `${companyId}:${phone}`;

  // If there's an existing buffer, add to it (debounce)
  const existing = messageBuffers.get(bufferKey);
  if (existing) {
    existing.messages.push(resolvedText);
    existing.wuzapiMessageId = wuzapiMessageId;

    // Images: keep the most recent one per debounce window
    if (imageBase64) {
      existing.pendingImageBase64 = imageBase64;
      existing.pendingImageMime = imageMime;
    }

    // Reset the debounce timer
    clearTimeout(existing.timeoutId);
    existing.timeoutId = setTimeout(() => processBuffer(bufferKey), DEBOUNCE_MS);
    return;
  }

  // Create new buffer
  const buffer: MessageBuffer = {
    messages: [resolvedText],
    companyId,
    phone,
    wuzapiMessageId,
    fromMe,
    pendingImageBase64: imageBase64,
    pendingImageMime: imageMime,
    timeoutId: setTimeout(() => processBuffer(bufferKey), DEBOUNCE_MS),
  };

  messageBuffers.set(bufferKey, buffer);
}

/**
 * Processes the debounced message buffer.
 * Combines multiple messages and sends to AI Agent.
 */
async function processBuffer(bufferKey: string): Promise<void> {
  const buffer = messageBuffers.get(bufferKey);
  if (!buffer) return;

  messageBuffers.delete(bufferKey);

  const { companyId, phone, messages, wuzapiMessageId, fromMe, pendingImageBase64, pendingImageMime } = buffer;

  // Combine multiple messages into one
  const combinedMessage = messages.length > 1
    ? messages.join('\n')
    : messages[0];

  log.info({
    companyId, phone,
    messageCount: messages.length,
    hasImage: !!pendingImageBase64,
    fromMe,
  }, 'Processing debounced messages');

  try {
    // Run through AI Agent
    const result = await processMessage(companyId, phone, combinedMessage, {
      wuzapiMessageId,
      fromMe,
      messageType: pendingImageBase64 ? 'image' : 'text',
      imageAttachment: pendingImageBase64 ? {
        base64: pendingImageBase64,
        mimeType: (pendingImageMime || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
      } : undefined,
    });

    // If AI has a response to send — humanize com chunks + delays
    if (result.shouldRespond && result.response && !result.skipResponse) {
      const chunks = splitIntoChunks(result.response);
      log.info({ companyId, phone, chunkCount: chunks.length }, 'Sending humanized response');

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        // Delay de digitação ANTES de enviar (simula "está digitando…")
        // Para o primeiro chunk, delay menor; entre chunks, delay maior.
        const delay = i === 0
          ? Math.min(typingDelayFor(chunk), 2500)
          : humanDelay() + Math.min(typingDelayFor(chunk), 1500);

        await sleep(delay);

        // ANTI-LOOP: marca o conteúdo como recém-enviado, para que se o
        // provider devolva como echo no webhook, seja descartado.
        try {
          await markOutboundSent(companyId, phone, chunk);
        } catch (err) {
          log.debug({ err }, 'markOutboundSent failed (non-critical)');
        }

        const sent = await sendWhatsAppResponse(companyId, phone, chunk);
        if (!sent) {
          log.warn({ companyId, phone, chunkIndex: i }, 'Failed to send chunk, aborting remaining');
          break;
        }
      }

      // Broadcast to dashboard (real-time chat UI) — uma vez só, com texto completo
      try {
        broadcastToCompany(companyId, 'chat:new_message', {
          phone,
          direction: 'outgoing',
          content: result.response,
          processedBy: 'ai_agent',
          model: result.model,
          toolsUsed: result.toolsUsed,
        });
      } catch (wsErr) {
        log.warn({ wsErr }, 'WebSocket broadcast failed');
      }
    }

    // If human transfer requested, notify admins
    if (result.isHumanTransfer) {
      try {
        broadcastToCompany(companyId, 'chat:human_transfer', {
          phone,
          isEmergency: result.isEmergency,
        });
      } catch (wsErr) {
        log.warn({ wsErr }, 'WebSocket broadcast for human transfer failed');
      }
    }

    log.info({
      companyId, phone,
      shouldRespond: result.shouldRespond,
      toolsUsed: result.toolsUsed,
      model: result.model,
      tokensUsed: result.tokensUsed,
      processingTimeMs: result.processingTimeMs,
    }, 'Message processed');

  } catch (err) {
    log.error({ err, companyId, phone }, 'Failed to process message through AI Agent');

    // Send fallback message — também marca como outbound para anti-eco
    try {
      const fallback = 'Desculpe, estou com dificuldades técnicas no momento. Tente novamente em instantes ou ligue para a clínica 🙏';
      await markOutboundSent(companyId, phone, fallback);
      await sendWhatsAppResponse(companyId, phone, fallback);
    } catch (sendErr) {
      log.error({ sendErr }, 'Failed to send fallback message');
    }
  }
}

/**
 * Sends a WhatsApp response using the unified provider abstraction.
 * Respects the provider choice configured by the client (Wuzapi, Evolution, or Meta Cloud API).
 * Returns true on success, false on failure.
 */
async function sendWhatsAppResponse(
  companyId: number,
  phone: string,
  message: string
): Promise<boolean> {
  const provider = await getWhatsAppProvider(companyId);

  if (!provider) {
    log.error({ companyId, phone }, 'No WhatsApp provider configured for this company');
    return false;
  }

  try {
    const result = await provider.sendTextMessage({ phone, message });
    if (result.success) {
      log.info({ companyId, phone, provider: result.provider, messageId: result.messageId }, 'Response sent');
      return true;
    } else {
      log.error({ companyId, phone, provider: result.provider, error: result.error }, 'Failed to send response');
      return false;
    }
  } catch (err) {
    log.error({ err, companyId, phone, provider: provider.providerType }, 'WhatsApp send threw error');
    return false;
  }
}
