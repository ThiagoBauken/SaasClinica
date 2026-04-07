/**
 * Conversation Memory Service
 *
 * 3-tier memory architecture for AI agent conversations:
 *
 * Tier 1 - Redis (short-term): Last 12 messages verbatim + compressed summary
 * Tier 2 - PostgreSQL (medium-term): Full message history in chat_messages
 * Tier 3 - Patient Record (long-term): Extracted patient data accumulated over time
 *
 * Redis stores the active conversation state with 4h TTL.
 * When a conversation exceeds MAX_VERBATIM_MESSAGES, older messages are
 * compressed into a summary using Haiku (cheapest model).
 */

import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'crypto';
import { redisCacheClient, isRedisAvailable } from '../../redis';
import { db } from '../../db';
import { eq, and, desc } from 'drizzle-orm';
import { chatMessages, chatSessions } from '@shared/schema';
import { logger } from '../../logger';

const log = logger.child({ module: 'conversation-memory' });

const MAX_VERBATIM_MESSAGES = 12;
const SESSION_TTL_SECONDS = 4 * 60 * 60; // 4 hours
const SUMMARY_MODEL = 'claude-haiku-4-5-20251001';

/** A single message in the conversation */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolsUsed?: string[];
}

/** Full conversation state stored in Redis */
export interface ConversationState {
  messages: Anthropic.MessageParam[];
  summary?: string;
  patientId?: number;
  patientName?: string;
  sessionStartedAt: string;
  lastMessageAt: string;
  humanTakeover: boolean;
  humanTakeoverAt?: string;
  /** Marca para a IA enviar saudação de retomada após takeover expirar */
  botShouldResume?: boolean;
  /** Timestamp da última mensagem do atendente humano (para reset de timeout) */
  lastHumanMessageAt?: string;
  /** Confirmação pendente de cancelamento de consulta (anti-cancelamento acidental) */
  pendingCancelAppointmentId?: number;
  pendingCancelExpiresAt?: string;
  messageCount: number;
}

// In-memory fallback when Redis is unavailable
const memoryStore = new Map<string, { state: ConversationState; expiresAt: number }>();

function getKey(companyId: number, sessionId: number): string {
  return `ai:conv:${companyId}:${sessionId}`;
}

/**
 * Loads conversation state from Redis (or memory fallback).
 * If no state exists, returns a fresh initial state.
 */
export async function loadConversationState(
  companyId: number,
  sessionId: number
): Promise<ConversationState> {
  const key = getKey(companyId, sessionId);

  try {
    const redisAvailable = await isRedisAvailable();
    if (redisAvailable) {
      const stored = await redisCacheClient.get(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } else {
      const cached = memoryStore.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.state;
      }
      memoryStore.delete(key);
    }
  } catch (err) {
    log.warn({ err }, 'Failed to load conversation state from Redis');
  }

  // Try to reconstruct from DB (last 12 messages)
  try {
    const dbMessages = await db
      .select({ role: chatMessages.role, content: chatMessages.content, createdAt: chatMessages.createdAt })
      .from(chatMessages)
      .where(and(eq(chatMessages.sessionId, sessionId), eq(chatMessages.companyId, companyId)))
      .orderBy(desc(chatMessages.createdAt))
      .limit(MAX_VERBATIM_MESSAGES);

    if (dbMessages.length > 0) {
      const messages: Anthropic.MessageParam[] = dbMessages
        .reverse()
        .filter((m: any) => (m.role === 'user' || m.role === 'assistant') && m.content)
        .map((m: any) => ({
          role: m.role as 'user' | 'assistant',
          content: String(m.content),
        }));

      // Ensure conversation starts with user message (Claude requirement)
      if (messages.length > 0 && messages[0].role !== 'user') {
        messages.shift();
      }

      return {
        messages,
        sessionStartedAt: dbMessages[dbMessages.length - 1]?.createdAt?.toISOString() || new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        humanTakeover: false,
        messageCount: dbMessages.length,
      };
    }
  } catch (err) {
    log.warn({ err }, 'Failed to reconstruct conversation from DB');
  }

  // Fresh state
  return {
    messages: [],
    sessionStartedAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
    humanTakeover: false,
    messageCount: 0,
  };
}

/**
 * Saves conversation state to Redis.
 * If message count exceeds threshold, compresses older messages into summary.
 */
export async function saveConversationState(
  companyId: number,
  sessionId: number,
  state: ConversationState
): Promise<void> {
  // Compress if too many messages — only when exceeding by 4+ to batch compressions
  // and avoid calling the compression API on every single message after threshold
  const COMPRESSION_BUFFER = 4;
  if (state.messages.length > MAX_VERBATIM_MESSAGES + COMPRESSION_BUFFER) {
    try {
      const toCompress = state.messages.slice(0, -MAX_VERBATIM_MESSAGES);
      // Compress FIRST, only truncate after success
      const newSummary = await compressMessages(toCompress, state.summary);

      state.messages = state.messages.slice(-MAX_VERBATIM_MESSAGES);
      state.summary = newSummary;

      // Ensure messages still start with user
      if (state.messages.length > 0 && state.messages[0].role !== 'user') {
        state.messages.shift();
      }
    } catch (err) {
      log.error({ err }, 'Failed to compress messages - keeping all to prevent data loss');
    }
  }

  state.lastMessageAt = new Date().toISOString();
  state.messageCount++;

  const key = getKey(companyId, sessionId);
  const serialized = JSON.stringify(state);

  try {
    const redisAvailable = await isRedisAvailable();
    if (redisAvailable) {
      await redisCacheClient.setex(key, SESSION_TTL_SECONDS, serialized);
    } else {
      memoryStore.set(key, {
        state,
        expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
      });
    }
  } catch (err) {
    log.warn({ err }, 'Failed to save conversation state to Redis, using memory');

    // Evict expired entries to prevent unbounded memory growth
    if (memoryStore.size > 5000) {
      const now = Date.now();
      for (const [k, v] of memoryStore.entries()) {
        if (v.expiresAt < now) memoryStore.delete(k);
      }
      // If still too large after cleanup, drop oldest
      if (memoryStore.size > 5000) {
        const keys = [...memoryStore.keys()];
        for (let i = 0; i < 1000; i++) memoryStore.delete(keys[i]);
      }
    }

    memoryStore.set(key, {
      state,
      expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
    });
  }
}

/**
 * Adds a user message to the conversation and persists to DB.
 */
export async function addUserMessage(
  companyId: number,
  sessionId: number,
  state: ConversationState,
  content: string,
  wuzapiMessageId?: string
): Promise<void> {
  state.messages.push({ role: 'user', content });

  // Persist to DB
  try {
    await db.insert(chatMessages).values({
      sessionId,
      companyId,
      role: 'user',
      direction: 'incoming',
      content,
      status: 'received',
      wuzapiMessageId,
      createdAt: new Date(),
    });
  } catch (err) {
    log.warn({ err }, 'Failed to persist user message to DB');
  }
}

/**
 * Adds an assistant message to the conversation and persists to DB.
 *
 * `metadata.model === 'human-attendant'` marks the message as coming from
 * a human attendant (not the AI). The message is still added to the
 * conversation history so the AI has context when it eventually resumes.
 */
export async function addAssistantMessage(
  companyId: number,
  sessionId: number,
  state: ConversationState,
  content: string,
  metadata?: { toolsUsed?: string[]; tokensUsed?: number; model?: string }
): Promise<void> {
  state.messages.push({ role: 'assistant', content });

  const isHumanAttendant = metadata?.model === 'human-attendant';

  // Persist to DB
  try {
    await db.insert(chatMessages).values({
      sessionId,
      companyId,
      role: 'assistant',
      direction: 'outgoing',
      content,
      processedBy: isHumanAttendant ? 'human' : 'ai',
      tokensUsed: metadata?.tokensUsed || 0,
      metadata: metadata ? { toolsUsed: metadata.toolsUsed, model: metadata.model } : undefined,
      status: 'sent',
      createdAt: new Date(),
    });
  } catch (err) {
    log.warn({ err }, 'Failed to persist assistant message to DB');
  }
}

/**
 * Marks the conversation as human takeover.
 * AI will not respond for HUMAN_TAKEOVER_TIMEOUT.
 */
export async function setHumanTakeover(
  companyId: number,
  sessionId: number,
  state: ConversationState
): Promise<void> {
  state.humanTakeover = true;
  state.humanTakeoverAt = new Date().toISOString();
  await saveConversationState(companyId, sessionId, state);
}

/**
 * Checks if human takeover is still active.
 *
 * Janela configurável por clínica (default 120 minutos). O timeout reseta a
 * cada nova mensagem do atendente humano (humanTakeoverAt é atualizado em
 * processMessage quando fromMe=true). Isso garante que enquanto o atendente
 * estiver ativo, a IA NUNCA atropela a conversa.
 *
 * Se o atendente parar de responder e o paciente continuar enviando mensagens,
 * após `timeoutMinutes` o controle volta para a IA — mas com uma "saudação de
 * retomada" gentil em vez de continuar como se nada tivesse acontecido.
 */
export function isHumanTakeoverActive(
  state: ConversationState,
  timeoutMinutes: number = 120
): boolean {
  if (!state.humanTakeover || !state.humanTakeoverAt) return false;
  const elapsed = Date.now() - new Date(state.humanTakeoverAt).getTime();
  const timeoutMs = Math.max(1, timeoutMinutes) * 60 * 1000;
  return elapsed < timeoutMs;
}

/**
 * Clears the conversation state (e.g., when session ends).
 */
export async function clearConversationState(
  companyId: number,
  sessionId: number
): Promise<void> {
  const key = getKey(companyId, sessionId);
  try {
    const redisAvailable = await isRedisAvailable();
    if (redisAvailable) {
      await redisCacheClient.del(key);
    }
    memoryStore.delete(key);
  } catch (err) {
    log.warn({ err }, 'Failed to clear conversation state');
  }
}

/**
 * Compresses older messages into a concise summary using a cheap model.
 */
async function compressMessages(
  messages: Anthropic.MessageParam[],
  existingSummary?: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fallback: simple concatenation
    return messages
      .map(m => `${m.role}: ${typeof m.content === 'string' ? m.content : '[tool interaction]'}`)
      .slice(-5)
      .join(' | ');
  }

  const client = new Anthropic({ apiKey });

  const historyText = messages
    .map(m => `${m.role}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
    .join('\n');

  try {
    const response = await client.messages.create({
      model: SUMMARY_MODEL,
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Resuma esta conversa de clínica odontológica em 2-3 frases em português, preservando: nome do paciente, procedimentos discutidos, consultas agendadas/canceladas, e preferências.

${existingSummary ? `Resumo anterior: ${existingSummary}\n\n` : ''}Novas mensagens:
${historyText}`,
      }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    return textBlock?.text || historyText.slice(0, 500);
  } catch (err) {
    log.warn({ err }, 'Failed to compress messages with AI');
    return existingSummary || historyText.slice(0, 500);
  }
}

/**
 * Checks for duplicate WhatsApp messages (idempotency).
 */
// In-memory dedup set fallback when Redis is unavailable
const memoryDedupSet = new Map<string, number>(); // key → expiry timestamp
const DEDUP_TTL_MS = 60 * 60 * 1000; // 1 hour
const DEDUP_MAX_SIZE = 10000;

export async function isDuplicateMessage(
  companyId: number,
  messageId: string
): Promise<boolean> {
  if (!messageId) return false;

  const key = `ai:dedup:${companyId}:${messageId}`;

  try {
    const redisAvailable = await isRedisAvailable();
    if (redisAvailable) {
      // SET NX = only set if not exists. Returns null if key existed.
      const result = await redisCacheClient.set(key, '1', 'EX', 86400, 'NX');
      return result === null;
    }
  } catch (err) {
    log.warn({ err }, 'Dedup Redis check failed, using memory fallback');
  }

  // In-memory fallback
  const now = Date.now();
  const existing = memoryDedupSet.get(key);
  if (existing && existing > now) {
    return true; // Duplicate
  }

  // Evict expired entries if too large
  if (memoryDedupSet.size > DEDUP_MAX_SIZE) {
    for (const [k, exp] of memoryDedupSet.entries()) {
      if (exp < now) memoryDedupSet.delete(k);
    }
  }

  memoryDedupSet.set(key, now + DEDUP_TTL_MS);
  return false;
}

// ============================================================
// ANTI-LOOP: Outbound message echo detection
// ============================================================
//
// Quando o bot envia uma mensagem, alguns providers WhatsApp (e o app oficial
// do operador humano) entregam de volta como webhook. Sem esta proteção, o
// bot pode entrar em loop respondendo às próprias mensagens.
//
// Hash da mensagem outbound é guardado por 5 minutos. Se uma mensagem
// inbound match com um hash recente do mesmo paciente, é descartada.

const OUTBOUND_DEDUP_TTL_MS = 5 * 60 * 1000; // 5 min — janela de eco WhatsApp típica
const memoryOutboundHashes = new Map<string, number>();

function hashOutbound(content: string): string {
  // Normaliza espaços/case para detectar matches mesmo com pequenas diferenças
  const norm = content.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 500);
  return createHash('sha256').update(norm).digest('hex').slice(0, 16);
}

/**
 * Marca uma mensagem como recém-enviada pelo bot/clínica para um telefone.
 * Chamado pelo message-handler ANTES de enviar via provider.
 */
export async function markOutboundSent(
  companyId: number,
  phone: string,
  content: string
): Promise<void> {
  if (!content) return;
  const h = hashOutbound(content);
  const key = `ai:outbound:${companyId}:${phone}:${h}`;

  try {
    const redisAvailable = await isRedisAvailable();
    if (redisAvailable) {
      await redisCacheClient.set(key, '1', 'EX', Math.ceil(OUTBOUND_DEDUP_TTL_MS / 1000));
      return;
    }
  } catch (err) {
    log.debug({ err }, 'markOutboundSent Redis failed, using memory');
  }

  // Memory fallback
  memoryOutboundHashes.set(key, Date.now() + OUTBOUND_DEDUP_TTL_MS);
  if (memoryOutboundHashes.size > 5000) {
    const now = Date.now();
    for (const [k, exp] of memoryOutboundHashes.entries()) {
      if (exp < now) memoryOutboundHashes.delete(k);
    }
  }
}

/**
 * Retorna true se a mensagem inbound corresponde a algo que o bot/clínica
 * acabou de enviar — ou seja, é um echo do próprio provider.
 */
export async function isOutboundEcho(
  companyId: number,
  phone: string,
  content: string
): Promise<boolean> {
  if (!content) return false;
  const h = hashOutbound(content);
  const key = `ai:outbound:${companyId}:${phone}:${h}`;

  try {
    const redisAvailable = await isRedisAvailable();
    if (redisAvailable) {
      const exists = await redisCacheClient.get(key);
      return !!exists;
    }
  } catch (err) {
    log.debug({ err }, 'isOutboundEcho Redis failed, using memory');
  }

  const exp = memoryOutboundHashes.get(key);
  return !!exp && exp > Date.now();
}

// ============================================================
// ANTI-LOOP: Hard cap on responses per minute per session
// ============================================================
//
// Defesa adicional contra loops imprevistos: nunca responder mais que N
// vezes por minuto na mesma sessão. Se atingir o teto, transfere para humano.

const MAX_RESPONSES_PER_MINUTE = 6;

export async function shouldThrottleResponse(
  companyId: number,
  sessionId: number
): Promise<{ throttle: boolean; count: number }> {
  const key = `ai:resp_rate:${companyId}:${sessionId}`;
  try {
    const redisAvailable = await isRedisAvailable();
    if (redisAvailable) {
      const count = await redisCacheClient.incr(key);
      if (count === 1) {
        await redisCacheClient.expire(key, 60);
      }
      return { throttle: count > MAX_RESPONSES_PER_MINUTE, count };
    }
  } catch (err) {
    log.debug({ err }, 'shouldThrottleResponse Redis failed');
  }
  return { throttle: false, count: 0 };
}
