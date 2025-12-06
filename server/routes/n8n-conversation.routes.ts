import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/auth';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import { pgTable, serial, integer, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { eq, and, desc, gte } from 'drizzle-orm';

const router = Router();

// Importar Redis se disponível
let redisClient: any = null;
try {
  const { getRedisClient } = require('../redis');
  redisClient = getRedisClient();
} catch (e) {
  console.log('[N8N Conversation] Redis não disponível, usando memória local');
}

// Fallback para memória local (desenvolvimento)
const conversationContextsMemory = new Map<string, ConversationContext>();

interface ConversationContext {
  companyId: number;
  phone: string;
  patientId?: number;
  patientName?: string;
  currentIntent?: string;
  awaitingResponse?: string; // 'schedule_time', 'confirm_appointment', etc.
  pendingData?: Record<string, any>;
  lastMessageAt: Date;
  messageHistory: Array<{
    role: 'user' | 'bot';
    text: string;
    timestamp: Date;
    intent?: string;
  }>;
}

// Tempo máximo de sessão (30 minutos)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const REDIS_PREFIX = 'n8n:conversation:';

// Helper para get/set contexto (Redis ou Memória)
async function getContext(key: string): Promise<ConversationContext | null> {
  try {
    if (redisClient) {
      const data = await redisClient.get(`${REDIS_PREFIX}${key}`);
      if (data) {
        const parsed = JSON.parse(data);
        parsed.lastMessageAt = new Date(parsed.lastMessageAt);
        parsed.messageHistory = parsed.messageHistory?.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })) || [];
        return parsed;
      }
      return null;
    }
    return conversationContextsMemory.get(key) || null;
  } catch (e) {
    console.error('[N8N Conversation] Erro ao buscar contexto:', e);
    return conversationContextsMemory.get(key) || null;
  }
}

async function setContext(key: string, context: ConversationContext): Promise<void> {
  try {
    if (redisClient) {
      // Salvar no Redis com TTL de 30 minutos
      await redisClient.setex(
        `${REDIS_PREFIX}${key}`,
        SESSION_TIMEOUT_MS / 1000,
        JSON.stringify(context)
      );
    }
    // Sempre salvar em memória também (backup)
    conversationContextsMemory.set(key, context);
  } catch (e) {
    console.error('[N8N Conversation] Erro ao salvar contexto:', e);
    conversationContextsMemory.set(key, context);
  }
}

async function deleteContext(key: string): Promise<void> {
  try {
    if (redisClient) {
      await redisClient.del(`${REDIS_PREFIX}${key}`);
    }
    conversationContextsMemory.delete(key);
  } catch (e) {
    console.error('[N8N Conversation] Erro ao deletar contexto:', e);
    conversationContextsMemory.delete(key);
  }
}

/**
 * Middleware para autenticação N8N (mesmo do n8n-tools)
 */
async function n8nAuth(req: any, res: any, next: any) {
  const apiKey = req.headers['x-api-key'] as string;
  const masterKey = process.env.SAAS_MASTER_API_KEY;

  if (apiKey && apiKey === masterKey) {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized',
  });
}

/**
 * GET /api/v1/n8n/conversation/context
 * Busca contexto atual da conversa
 */
router.get(
  '/context',
  n8nAuth,
  asyncHandler(async (req, res) => {
    const { phone, companyId } = req.query;

    if (!phone || !companyId) {
      return res.status(400).json({
        success: false,
        error: 'phone and companyId are required',
      });
    }

    const key = `${companyId}:${phone}`;
    const context = await getContext(key);

    // Verificar se sessão expirou (para memória local)
    if (context && !redisClient) {
      const timeSinceLastMessage = Date.now() - context.lastMessageAt.getTime();
      if (timeSinceLastMessage > SESSION_TIMEOUT_MS) {
        await deleteContext(key);
        return res.json({
          success: true,
          found: false,
          context: null,
          message: 'Sessão expirada',
        });
      }
    }

    res.json({
      success: true,
      found: !!context,
      context: context || null,
      storage: redisClient ? 'redis' : 'memory',
    });
  })
);

/**
 * POST /api/v1/n8n/conversation/update
 * Atualiza contexto da conversa
 */
router.post(
  '/update',
  n8nAuth,
  asyncHandler(async (req, res) => {
    const {
      phone,
      companyId,
      patientId,
      patientName,
      currentIntent,
      awaitingResponse,
      pendingData,
      messageText,
      messageRole,
    } = req.body;

    if (!phone || !companyId) {
      return res.status(400).json({
        success: false,
        error: 'phone and companyId are required',
      });
    }

    const key = `${companyId}:${phone}`;
    let context = await getContext(key);

    if (!context) {
      context = {
        companyId: parseInt(companyId),
        phone,
        lastMessageAt: new Date(),
        messageHistory: [],
      };
    }

    // Atualizar campos
    if (patientId) context.patientId = patientId;
    if (patientName) context.patientName = patientName;
    if (currentIntent !== undefined) context.currentIntent = currentIntent;
    if (awaitingResponse !== undefined) context.awaitingResponse = awaitingResponse;
    if (pendingData !== undefined) context.pendingData = pendingData;

    // Adicionar mensagem ao histórico
    if (messageText && messageRole) {
      context.messageHistory.push({
        role: messageRole,
        text: messageText,
        timestamp: new Date(),
        intent: currentIntent,
      });

      // Manter apenas últimas 10 mensagens
      if (context.messageHistory.length > 10) {
        context.messageHistory = context.messageHistory.slice(-10);
      }
    }

    context.lastMessageAt = new Date();
    await setContext(key, context);

    res.json({
      success: true,
      context,
      storage: redisClient ? 'redis' : 'memory',
    });
  })
);

/**
 * POST /api/v1/n8n/conversation/clear
 * Limpa contexto da conversa
 */
router.post(
  '/clear',
  n8nAuth,
  asyncHandler(async (req, res) => {
    const { phone, companyId } = req.body;

    if (!phone || !companyId) {
      return res.status(400).json({
        success: false,
        error: 'phone and companyId are required',
      });
    }

    const key = `${companyId}:${phone}`;
    await deleteContext(key);

    res.json({
      success: true,
      message: 'Contexto limpo',
    });
  })
);

/**
 * POST /api/v1/n8n/conversation/parse-datetime
 * Extrai data/hora de mensagem do usuário
 */
router.post(
  '/parse-datetime',
  n8nAuth,
  asyncHandler(async (req, res) => {
    const { message, timezone = 'America/Sao_Paulo' } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'message is required',
      });
    }

    const text = message.toLowerCase();
    const now = new Date();

    let parsedDate: Date | null = null;
    let parsedTime: string | null = null;
    let confidence = 0;

    // Padrões de tempo
    const timePatterns = [
      /(\d{1,2})[:\s]?(\d{2})?\s*(h|hrs?|horas?)?/i,
      /(\d{1,2})\s*(da\s+)?(manhã|manha|tarde|noite)/i,
    ];

    // Padrões de data
    const datePatterns = {
      hoje: 0,
      amanha: 1,
      amanhã: 1,
      'depois de amanha': 2,
      'depois de amanhã': 2,
      segunda: () => getNextDayOfWeek(1),
      'segunda-feira': () => getNextDayOfWeek(1),
      terca: () => getNextDayOfWeek(2),
      terça: () => getNextDayOfWeek(2),
      'terca-feira': () => getNextDayOfWeek(2),
      'terça-feira': () => getNextDayOfWeek(2),
      quarta: () => getNextDayOfWeek(3),
      'quarta-feira': () => getNextDayOfWeek(3),
      quinta: () => getNextDayOfWeek(4),
      'quinta-feira': () => getNextDayOfWeek(4),
      sexta: () => getNextDayOfWeek(5),
      'sexta-feira': () => getNextDayOfWeek(5),
      sabado: () => getNextDayOfWeek(6),
      sábado: () => getNextDayOfWeek(6),
    };

    function getNextDayOfWeek(dayOfWeek: number): number {
      const today = now.getDay();
      let daysUntil = dayOfWeek - today;
      if (daysUntil <= 0) daysUntil += 7;
      return daysUntil;
    }

    // Buscar data
    for (const [pattern, offset] of Object.entries(datePatterns)) {
      if (text.includes(pattern)) {
        const daysToAdd = typeof offset === 'function' ? offset() : offset;
        parsedDate = new Date(now);
        parsedDate.setDate(parsedDate.getDate() + daysToAdd);
        parsedDate.setHours(0, 0, 0, 0);
        confidence += 0.4;
        break;
      }
    }

    // Buscar padrão DD/MM
    const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]) - 1;
      parsedDate = new Date(now.getFullYear(), month, day);
      if (parsedDate < now) {
        parsedDate.setFullYear(parsedDate.getFullYear() + 1);
      }
      confidence += 0.5;
    }

    // Buscar hora
    const timeMatch = text.match(/(\d{1,2})[:\s]?(\d{2})?/);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;

      // Ajustar para período do dia
      if (text.includes('tarde') && hours < 12) hours += 12;
      if (text.includes('noite') && hours < 18) hours += 12;

      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        parsedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        confidence += 0.4;
      }
    }

    // Se não encontrou data, assumir "hoje" ou "próximo dia útil"
    if (!parsedDate && parsedTime) {
      parsedDate = new Date(now);
      const [hours] = parsedTime.split(':').map(Number);
      if (now.getHours() >= hours) {
        parsedDate.setDate(parsedDate.getDate() + 1);
      }
      // Pular domingo
      if (parsedDate.getDay() === 0) {
        parsedDate.setDate(parsedDate.getDate() + 1);
      }
      confidence += 0.2;
    }

    res.json({
      success: true,
      parsed: {
        date: parsedDate ? parsedDate.toISOString().split('T')[0] : null,
        dateFormatted: parsedDate ? parsedDate.toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
        }) : null,
        time: parsedTime,
        confidence: Math.min(confidence, 1),
      },
      originalMessage: message,
    });
  })
);

/**
 * GET /api/v1/n8n/conversation/stats
 * Estatísticas das conversas ativas
 */
router.get(
  '/stats',
  n8nAuth,
  asyncHandler(async (req, res) => {
    // Para stats, usamos memória local (Redis precisaria de SCAN que é caro)
    const activeContexts = Array.from(conversationContextsMemory.values());
    const now = Date.now();

    const stats = {
      totalActive: activeContexts.filter(
        c => now - c.lastMessageAt.getTime() < SESSION_TIMEOUT_MS
      ).length,
      byIntent: {} as Record<string, number>,
      awaitingResponses: {} as Record<string, number>,
      storage: redisClient ? 'redis' : 'memory',
      note: redisClient ? 'Stats baseadas em cache local (para performance)' : 'Usando memória local',
    };

    activeContexts.forEach(ctx => {
      if (ctx.currentIntent) {
        stats.byIntent[ctx.currentIntent] = (stats.byIntent[ctx.currentIntent] || 0) + 1;
      }
      if (ctx.awaitingResponse) {
        stats.awaitingResponses[ctx.awaitingResponse] =
          (stats.awaitingResponses[ctx.awaitingResponse] || 0) + 1;
      }
    });

    res.json({
      success: true,
      stats,
    });
  })
);

export default router;
