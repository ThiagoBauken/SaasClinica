/**
 * Chat API Routes
 * Gerencia sessões de chat, mensagens e processamento
 */

import { Router } from 'express';
import { db } from '../db';
import { eq, and, desc, sql, gte, lte, or, isNull, ne } from 'drizzle-orm';
import { notDeleted } from '../lib/soft-delete';
import {
  chatSessions,
  chatMessages,
  patients,
  companies,
  clinicSettings,
} from '@shared/schema';
import { asyncHandler, requireAuth, getCompanyId } from '../middleware/auth';
import { createChatProcessor } from '../services/chat-processor';
import { createEvolutionService } from '../services/evolution-api.service';
import { sendWuzapiTextMessage, getWuzapiStatus } from '../services/wuzapi-provisioning';
import { getWhatsAppProvider } from '../services/whatsapp-provider';

import { logger } from '../logger';
const router = Router();

/**
 * GET /api/v1/chat/sessions
 * Lista sessões de chat da empresa
 * Query params: status (active|waiting_human|closed|all), limit, offset, search
 */
router.get(
  '/sessions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const { status, limit = 50, offset = 0, search } = req.query;

    // Construir condições de filtro
    const conditions = [eq(chatSessions.companyId, companyId)];

    // Filtrar por status
    if (status && status !== 'all') {
      conditions.push(eq(chatSessions.status, status as string));
    }

    // Single query with JOINs + LATERAL subqueries to avoid N+1 (was 150+ queries, now 1)
    const sessionsWithDetails = await db.execute(sql`
      SELECT
        cs.id, cs.phone, cs.user_type AS "userType", cs.patient_id AS "patientId",
        cs.status, cs.current_state AS "currentState",
        cs.last_message_at AS "lastMessageAt", cs.created_at AS "createdAt",
        cs.updated_at AS "updatedAt",
        p.full_name AS "patientName",
        last_msg.content AS "lastMessageContent",
        last_msg.role AS "lastMessageRole",
        last_msg.created_at AS "lastMessageCreatedAt",
        COALESCE(unread.cnt, 0)::int AS "unreadCount"
      FROM chat_sessions cs
      LEFT JOIN patients p ON p.id = cs.patient_id AND p.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT content, role, created_at
        FROM chat_messages
        WHERE session_id = cs.id
        ORDER BY created_at DESC
        LIMIT 1
      ) last_msg ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt
        FROM chat_messages
        WHERE session_id = cs.id
          AND role = 'user'
          AND (cs.updated_at IS NULL OR created_at >= cs.updated_at)
      ) unread ON true
      WHERE cs.company_id = ${companyId}
        ${status && status !== 'all' ? sql`AND cs.status = ${status as string}` : sql``}
      ORDER BY cs.last_message_at DESC NULLS LAST
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `);

    // Map raw rows to the expected shape
    const sessionsResult = (sessionsWithDetails.rows || sessionsWithDetails).map((row: any) => {
      const lastMessage = row.lastMessageContent
        ? {
            content: row.lastMessageContent.substring(0, 100) + (row.lastMessageContent.length > 100 ? '...' : ''),
            role: row.lastMessageRole,
            createdAt: row.lastMessageCreatedAt,
          }
        : null;
      const unreadCount = row.unreadCount || 0;
      return {
        id: row.id,
        phone: row.phone,
        userType: row.userType,
        patientId: row.patientId,
        status: row.status,
        currentState: row.currentState,
        lastMessageAt: row.lastMessageAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        patientName: row.patientName,
        lastMessage,
        unreadCount,
        needsAttention: row.status === 'waiting_human' || unreadCount > 0,
      };
    });

    // Contar totais por status
    const [statusCounts] = await db
      .select({
        active: sql<number>`count(*) filter (where ${chatSessions.status} = 'active')::int`,
        waitingHuman: sql<number>`count(*) filter (where ${chatSessions.status} = 'waiting_human')::int`,
        closed: sql<number>`count(*) filter (where ${chatSessions.status} = 'closed')::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(chatSessions)
      .where(eq(chatSessions.companyId, companyId));

    res.json({
      success: true,
      data: sessionsResult,
      counts: {
        active: statusCounts?.active || 0,
        waitingHuman: statusCounts?.waitingHuman || 0,
        closed: statusCounts?.closed || 0,
        total: statusCounts?.total || 0,
      },
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  })
);

/**
 * GET /api/v1/chat/unread-count
 * Retorna contagem de sessões que precisam de atenção (para badge no sidebar)
 */
router.get(
  '/unread-count',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(403).json({ error: 'No company' });

    const [counts] = await db
      .select({
        active: sql<number>`count(*) filter (where ${chatSessions.status} = 'active')::int`,
        waitingHuman: sql<number>`count(*) filter (where ${chatSessions.status} = 'waiting_human')::int`,
      })
      .from(chatSessions)
      .where(eq(chatSessions.companyId, companyId));

    res.json({
      unreadCount: (counts?.waitingHuman || 0) + (counts?.active || 0),
      waitingHuman: counts?.waitingHuman || 0,
      active: counts?.active || 0,
    });
  })
);

/**
 * GET /api/v1/chat/sessions/:id
 * Retorna uma sessão específica com histórico de mensagens
 */
router.get(
  '/sessions/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const sessionId = parseInt(req.params.id);

    const [session] = await db
      .select()
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.id, sessionId),
          eq(chatSessions.companyId, companyId)
        )
      )
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    // Buscar mensagens da sessão
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.createdAt);

    // Buscar dados do paciente
    let patient = null;
    if (session.patientId) {
      const [p] = await db
        .select()
        .from(patients)
        .where(and(eq(patients.id, session.patientId), notDeleted(patients.deletedAt)))
        .limit(1);
      patient = p;
    }

    res.json({
      success: true,
      data: {
        session,
        messages,
        patient,
      },
    });
  })
);

/**
 * POST /api/v1/chat/sessions
 * Cria ou recupera uma sessão de chat
 */
router.post(
  '/sessions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Telefone é obrigatório' });
    }

    const processor = createChatProcessor(companyId);
    await processor.initialize();
    const session = await processor.getOrCreateSession(phone);

    res.json({
      success: true,
      data: session,
    });
  })
);

/**
 * PUT /api/v1/chat/sessions/:id/state
 * Atualiza o estado da máquina de estados
 */
router.put(
  '/sessions/:id/state',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const sessionId = parseInt(req.params.id);
    const { currentState, stateData } = req.body;

    // Verificar se sessão pertence à empresa
    const [session] = await db
      .select()
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.id, sessionId),
          eq(chatSessions.companyId, companyId)
        )
      )
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    await db
      .update(chatSessions)
      .set({
        currentState,
        stateData: stateData || {},
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.id, sessionId));

    res.json({
      success: true,
      message: 'Estado atualizado',
    });
  })
);

/**
 * DELETE /api/v1/chat/sessions/:id/state
 * Limpa o estado da sessão
 */
router.delete(
  '/sessions/:id/state',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const sessionId = parseInt(req.params.id);

    const [session] = await db
      .select()
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.id, sessionId),
          eq(chatSessions.companyId, companyId)
        )
      )
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    await db
      .update(chatSessions)
      .set({
        currentState: null,
        stateData: {},
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.id, sessionId));

    res.json({
      success: true,
      message: 'Estado limpo',
    });
  })
);

/**
 * PUT /api/v1/chat/sessions/:id/close
 * Fecha uma sessão de chat
 */
router.put(
  '/sessions/:id/close',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const sessionId = parseInt(req.params.id);

    const [session] = await db
      .select()
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.id, sessionId),
          eq(chatSessions.companyId, companyId)
        )
      )
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    await db
      .update(chatSessions)
      .set({
        status: 'closed',
        currentState: null,
        stateData: {},
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.id, sessionId));

    res.json({
      success: true,
      message: 'Sessão fechada',
    });
  })
);

/**
 * POST /api/v1/chat/sessions/:id/send
 * Secretária envia mensagem via WhatsApp
 * Automaticamente ativa Human Takeover
 */
router.post(
  '/sessions/:id/send',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const sessionId = parseInt(req.params.id);
    const { content, activateTakeover = true } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ error: 'Conteúdo da mensagem é obrigatório' });
    }

    // Verificar se sessão pertence à empresa
    const [session] = await db
      .select()
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.id, sessionId),
          eq(chatSessions.companyId, companyId)
        )
      )
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    // Enviar via provider unificado (respeita configuração da empresa)
    const provider = await getWhatsAppProvider(companyId);
    if (!provider) {
      return res.status(503).json({
        error: 'Serviço de WhatsApp não configurado para esta empresa',
      });
    }

    logger.info({ provider_providerType: provider.providerType, data: session.phone }, '[Chat] Enviando via {provider_providerType} para:')
    const sendResult = await provider.sendTextMessage({
      phone: session.phone,
      message: content,
    });

    if (!sendResult.success) {
      return res.status(500).json({
        error: 'Falha ao enviar mensagem',
        details: sendResult.error,
      });
    }

    // Salvar mensagem no banco
    const [message] = await db
      .insert(chatMessages)
      .values({
        sessionId,
        role: 'assistant',
        content,
        messageType: 'text',
        processedBy: 'human',
        tokensUsed: 0,
        wuzapiMessageId: sendResult.messageId,
        metadata: {
          sentBy: (req as any).user?.id,
          sentByName: (req as any).user?.fullName || 'Secretária',
          sendMethod: 'dashboard',
        },
        createdAt: new Date(),
      })
      .returning();

    // Ativar Human Takeover (IA para de responder)
    if (activateTakeover) {
      const processor = createChatProcessor(companyId);
      await processor.setHumanTakeover(sessionId);
    }

    // Atualizar lastMessageAt da sessão
    await db
      .update(chatSessions)
      .set({
        lastMessageAt: new Date(),
        updatedAt: new Date(),
        status: activateTakeover ? 'waiting_human' : session.status,
      })
      .where(eq(chatSessions.id, sessionId));

    res.json({
      success: true,
      data: {
        message,
        whatsappMessageId: sendResult.messageId,
        humanTakeoverActive: activateTakeover,
      },
    });
  })
);

/**
 * POST /api/v1/chat/sessions/:id/takeover
 * Secretária assume a conversa (IA para de responder)
 */
router.post(
  '/sessions/:id/takeover',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const sessionId = parseInt(req.params.id);

    // Verificar se sessão pertence à empresa
    const [session] = await db
      .select()
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.id, sessionId),
          eq(chatSessions.companyId, companyId)
        )
      )
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    // Ativar Human Takeover
    const processor = createChatProcessor(companyId);
    await processor.setHumanTakeover(sessionId);

    // Registrar no log de mensagens
    await db
      .insert(chatMessages)
      .values({
        sessionId,
        role: 'system',
        content: `Atendimento humano iniciado por ${(req as any).user?.fullName || 'Secretária'}`,
        messageType: 'system',
        processedBy: 'human',
        tokensUsed: 0,
        metadata: {
          action: 'human_takeover',
          userId: (req as any).user?.id,
        },
        createdAt: new Date(),
      });

    res.json({
      success: true,
      message: 'Atendimento humano ativado. A IA não responderá por 30 minutos.',
      session: {
        ...session,
        status: 'waiting_human',
      },
    });
  })
);

/**
 * POST /api/v1/chat/sessions/:id/release
 * Libera a conversa para a IA voltar a responder
 */
router.post(
  '/sessions/:id/release',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const sessionId = parseInt(req.params.id);

    // Verificar se sessão pertence à empresa
    const [session] = await db
      .select()
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.id, sessionId),
          eq(chatSessions.companyId, companyId)
        )
      )
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    // Liberar para IA
    const processor = createChatProcessor(companyId);
    await processor.releaseHumanTakeover(sessionId);

    // Registrar no log de mensagens
    await db
      .insert(chatMessages)
      .values({
        sessionId,
        role: 'system',
        content: `Atendimento devolvido à IA por ${(req as any).user?.fullName || 'Secretária'}`,
        messageType: 'system',
        processedBy: 'human',
        tokensUsed: 0,
        metadata: {
          action: 'release_to_ai',
          userId: (req as any).user?.id,
        },
        createdAt: new Date(),
      });

    res.json({
      success: true,
      message: 'Conversa liberada para a IA.',
      session: {
        ...session,
        status: 'active',
      },
    });
  })
);

/**
 * GET /api/v1/chat/sessions/:id/quick-replies
 * Retorna respostas rápidas para a sessão
 */
router.get(
  '/sessions/:id/quick-replies',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const sessionId = parseInt(req.params.id);

    // Buscar sessão para contexto
    const [session] = await db
      .select()
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.id, sessionId),
          eq(chatSessions.companyId, companyId)
        )
      )
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    // Buscar última mensagem do usuário para contexto
    const [lastUserMessage] = await db
      .select({ content: chatMessages.content })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.sessionId, sessionId),
          eq(chatMessages.role, 'user')
        )
      )
      .orderBy(desc(chatMessages.createdAt))
      .limit(1);

    // Respostas rápidas baseadas no contexto
    const quickReplies = [
      {
        id: 'greeting',
        label: 'Saudação',
        message: 'Olá! Sou a secretária da clínica. Como posso ajudá-lo?',
      },
      {
        id: 'wait',
        label: 'Aguardar',
        message: 'Um momento, por favor. Estou verificando.',
      },
      {
        id: 'confirm_appointment',
        label: 'Confirmar consulta',
        message: 'Sua consulta está confirmada! Aguardamos você no horário marcado.',
      },
      {
        id: 'cancel_appointment',
        label: 'Cancelamento',
        message: 'Sua consulta foi cancelada. Entre em contato para reagendar.',
      },
      {
        id: 'reschedule',
        label: 'Reagendar',
        message: 'Sem problema! Qual seria o melhor dia e horário para você?',
      },
      {
        id: 'location',
        label: 'Localização',
        message: 'Nossa clínica fica na [ENDEREÇO]. Qualquer dúvida, estamos à disposição!',
      },
      {
        id: 'hours',
        label: 'Horários',
        message: 'Funcionamos de segunda a sexta, das 8h às 18h. Sábados das 8h às 12h.',
      },
      {
        id: 'thanks',
        label: 'Agradecimento',
        message: 'Obrigada pelo contato! Qualquer dúvida, estamos à disposição.',
      },
      {
        id: 'emergency',
        label: 'Urgência',
        message: 'Entendo que é urgente. Vou verificar com o doutor imediatamente. Por favor, aguarde.',
      },
    ];

    res.json({
      success: true,
      data: quickReplies,
      context: {
        sessionId,
        phone: session.phone,
        lastUserMessage: lastUserMessage?.content,
      },
    });
  })
);

/**
 * POST /api/v1/chat/process
 * Processa uma mensagem de chat (endpoint principal)
 */
router.post(
  '/process',
  asyncHandler(async (req, res) => {
    const { companyId, phone, message, wuzapiMessageId } = req.body;

    if (!companyId || !phone || !message) {
      return res.status(400).json({
        error: 'companyId, phone e message são obrigatórios',
      });
    }

    // Verificar se empresa existe e tem chat habilitado
    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    if (settings && settings.chatEnabled === false) {
      return res.json({
        success: false,
        error: 'Chat desabilitado para esta empresa',
        skipResponse: true,
      });
    }

    try {
      const processor = createChatProcessor(companyId);
      const result = await processor.processMessage(phone, message, wuzapiMessageId);

      res.json({
        success: true,
        data: {
          intent: result.intent,
          confidence: result.confidence,
          response: result.response,
          processedBy: result.processedBy,
          tokensUsed: result.tokensUsed,
          requiresHumanTransfer: result.requiresHumanTransfer,
          actions: result.actions,
        },
      });
    } catch (error: any) {
      logger.error({ err: error }, 'Erro ao processar mensagem:');
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao processar mensagem',
      });
    }
  })
);

/**
 * GET /api/v1/chat/stats
 * Estatísticas de uso do chat
 */
router.get(
  '/stats',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const { startDate, endDate } = req.query;

    // Data padrão: últimos 30 dias
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Total de sessões
    const [sessionsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.companyId, companyId),
          gte(chatSessions.createdAt, start),
          lte(chatSessions.createdAt, end)
        )
      );

    // Total de mensagens
    const [messagesCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatMessages)
      .innerJoin(chatSessions, eq(chatMessages.sessionId, chatSessions.id))
      .where(
        and(
          eq(chatSessions.companyId, companyId),
          gte(chatMessages.createdAt, start),
          lte(chatMessages.createdAt, end)
        )
      );

    // Tokens usados
    const [tokensSum] = await db
      .select({ total: sql<number>`coalesce(sum(${chatMessages.tokensUsed}), 0)::int` })
      .from(chatMessages)
      .innerJoin(chatSessions, eq(chatMessages.sessionId, chatSessions.id))
      .where(
        and(
          eq(chatSessions.companyId, companyId),
          gte(chatMessages.createdAt, start),
          lte(chatMessages.createdAt, end)
        )
      );

    // Distribuição por processedBy
    const processingDistribution = await db
      .select({
        processedBy: chatMessages.processedBy,
        count: sql<number>`count(*)::int`,
      })
      .from(chatMessages)
      .innerJoin(chatSessions, eq(chatMessages.sessionId, chatSessions.id))
      .where(
        and(
          eq(chatSessions.companyId, companyId),
          gte(chatMessages.createdAt, start),
          lte(chatMessages.createdAt, end),
          eq(chatMessages.role, 'assistant')
        )
      )
      .groupBy(chatMessages.processedBy);

    // Intents mais comuns
    const topIntents = await db
      .select({
        intent: chatMessages.intent,
        count: sql<number>`count(*)::int`,
      })
      .from(chatMessages)
      .innerJoin(chatSessions, eq(chatMessages.sessionId, chatSessions.id))
      .where(
        and(
          eq(chatSessions.companyId, companyId),
          gte(chatMessages.createdAt, start),
          lte(chatMessages.createdAt, end),
          sql`${chatMessages.intent} is not null`
        )
      )
      .groupBy(chatMessages.intent)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    res.json({
      success: true,
      data: {
        period: { start, end },
        totalSessions: sessionsCount?.count || 0,
        totalMessages: messagesCount?.count || 0,
        totalTokens: tokensSum?.total || 0,
        processingDistribution,
        topIntents,
        estimatedCost: ((tokensSum?.total || 0) / 1000) * 0.00015, // GPT-4o-mini pricing
      },
    });
  })
);

/**
 * POST /api/v1/chat/messages
 * Adiciona uma mensagem manual (para atendentes)
 */
router.post(
  '/messages',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const { sessionId, content, role = 'assistant' } = req.body;

    if (!sessionId || !content) {
      return res.status(400).json({ error: 'sessionId e content são obrigatórios' });
    }

    // Verificar se sessão pertence à empresa
    const [session] = await db
      .select()
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.id, sessionId),
          eq(chatSessions.companyId, companyId)
        )
      )
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    const [message] = await db
      .insert(chatMessages)
      .values({
        sessionId,
        role,
        content,
        messageType: 'text',
        processedBy: 'human',
        tokensUsed: 0,
        metadata: { addedBy: (req as any).user?.id },
        createdAt: new Date(),
      })
      .returning();

    // Atualizar lastMessageAt da sessão
    await db
      .update(chatSessions)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId));

    res.json({
      success: true,
      data: message,
    });
  })
);

/**
 * GET /api/v1/chat/media/:messageId
 * Proxy seguro para acessar mídias do chat
 *
 * MULTI-TENANT SECURITY:
 * - Valida autenticação do usuário
 * - Verifica se a mensagem pertence à empresa do usuário
 * - Baixa a mídia do MinIO e serve ao cliente
 * - NUNCA expõe URLs diretas do S3/MinIO
 */
router.get(
  '/media/:messageId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const messageId = req.params.messageId;

    // Buscar mensagem pelo wuzapiMessageId
    const [message] = await db
      .select({
        id: chatMessages.id,
        sessionId: chatMessages.sessionId,
        mediaUrl: chatMessages.mediaUrl,
        mimeType: chatMessages.mimeType,
        fileName: chatMessages.fileName,
      })
      .from(chatMessages)
      .innerJoin(chatSessions, eq(chatMessages.sessionId, chatSessions.id))
      .where(
        and(
          eq(chatMessages.wuzapiMessageId, messageId),
          eq(chatSessions.companyId, companyId) // CRÍTICO: Valida que pertence à empresa
        )
      )
      .limit(1);

    if (!message) {
      return res.status(404).json({ error: 'Mídia não encontrada ou acesso negado' });
    }

    if (!message.mediaUrl) {
      return res.status(404).json({ error: 'Mensagem não contém mídia' });
    }

    // Se a mídia está salva localmente (uploads/chat/...)
    if (message.mediaUrl.startsWith('/uploads/')) {
      const path = await import('path');
      const fs = await import('fs');

      const filePath = path.join(process.cwd(), message.mediaUrl);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Arquivo não encontrado' });
      }

      // Validar que o path está dentro do diretório correto (prevenir path traversal)
      const expectedDir = path.join(process.cwd(), 'uploads', 'chat', String(companyId));
      const normalizedPath = path.normalize(filePath);

      if (!normalizedPath.startsWith(expectedDir)) {
        logger.warn({ filePath: filePath }, '[Security] Tentativa de acesso a arquivo fora do diretório: {filePath}')
        return res.status(403).json({ error: 'Acesso negado' });
      }

      // Definir headers de cache e tipo
      res.setHeader('Content-Type', message.mimeType || 'application/octet-stream');
      res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache 1 hora

      if (message.fileName) {
        res.setHeader('Content-Disposition', `inline; filename="${message.fileName}"`);
      }

      // Stream do arquivo
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      return;
    }

    // Se for URL externa (S3/MinIO), fazer proxy
    // Buscar configurações do MinIO/S3 da empresa
    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    // Por segurança, não permitir URLs externas sem configuração S3
    return res.status(404).json({
      error: 'Mídia não disponível',
      hint: 'Configure o armazenamento S3/MinIO para mídias externas'
    });
  })
);

/**
 * GET /api/v1/chat/media/download/:messageId
 * Download de mídia (força download em vez de exibir)
 */
router.get(
  '/media/download/:messageId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const messageId = req.params.messageId;

    // Buscar mensagem
    const [message] = await db
      .select({
        id: chatMessages.id,
        sessionId: chatMessages.sessionId,
        mediaUrl: chatMessages.mediaUrl,
        mimeType: chatMessages.mimeType,
        fileName: chatMessages.fileName,
      })
      .from(chatMessages)
      .innerJoin(chatSessions, eq(chatMessages.sessionId, chatSessions.id))
      .where(
        and(
          eq(chatMessages.wuzapiMessageId, messageId),
          eq(chatSessions.companyId, companyId)
        )
      )
      .limit(1);

    if (!message || !message.mediaUrl) {
      return res.status(404).json({ error: 'Mídia não encontrada' });
    }

    if (message.mediaUrl.startsWith('/uploads/')) {
      const path = await import('path');
      const fs = await import('fs');

      const filePath = path.join(process.cwd(), message.mediaUrl);

      // Validar path
      const expectedDir = path.join(process.cwd(), 'uploads', 'chat', String(companyId));
      const normalizedPath = path.normalize(filePath);

      if (!normalizedPath.startsWith(expectedDir) || !fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Arquivo não encontrado' });
      }

      const fileName = message.fileName || `media_${messageId}`;
      res.setHeader('Content-Type', message.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      return;
    }

    return res.status(404).json({ error: 'Mídia não disponível' });
  })
);

/**
 * GET /api/v1/chat/patient/:patientId/history
 * Returns all chat sessions and their messages for a specific patient.
 * Used to display chat history inside the patient record.
 *
 * Each element in the response array represents one session with its
 * messages aggregated (ordered chronologically).
 * At most 20 most-recent sessions are returned.
 */
router.get(
  '/patient/:patientId/history',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const patientId = parseInt(req.params.patientId, 10);

    if (isNaN(patientId)) {
      return res.status(400).json({ error: 'patientId invalido' });
    }

    // Verify the patient belongs to this company before exposing messages
    const [patient] = await db
      .select({ id: patients.id, fullName: patients.fullName })
      .from(patients)
      .where(and(eq(patients.id, patientId), eq(patients.companyId, companyId)))
      .limit(1);

    if (!patient) {
      return res.status(404).json({ error: 'Paciente nao encontrado ou sem permissao' });
    }

    // Aggregate sessions + messages in a single query — avoids N+1
    // INDEX HINT: chat_sessions(company_id, patient_id), chat_messages(session_id, created_at)
    const result = await db.$client.query(
      `SELECT
         cs.id              AS session_id,
         cs.status,
         cs.phone,
         cs.current_state,
         cs.created_at      AS session_start,
         cs.last_message_at,
         json_agg(
           json_build_object(
             'id',           cm.id,
             'content',      cm.content,
             'role',         cm.role,
             'direction',    cm.direction,
             'messageType',  cm.message_type,
             'processedBy',  cm.processed_by,
             'tokensUsed',   cm.tokens_used,
             'createdAt',    cm.created_at
           )
           ORDER BY cm.created_at ASC
         ) FILTER (WHERE cm.id IS NOT NULL) AS messages
       FROM chat_sessions cs
       LEFT JOIN chat_messages cm ON cm.session_id = cs.id
       WHERE cs.company_id = $1
         AND cs.patient_id  = $2
       GROUP BY cs.id, cs.status, cs.phone, cs.current_state, cs.created_at, cs.last_message_at
       ORDER BY cs.created_at DESC
       LIMIT 20`,
      [companyId, patientId],
    );

    res.json({
      success: true,
      data: {
        patient: { id: patient.id, fullName: patient.fullName },
        sessions: result.rows.map((row: any) => ({
          sessionId: row.session_id,
          status: row.status,
          phone: row.phone,
          currentState: row.current_state,
          sessionStart: row.session_start,
          lastMessageAt: row.last_message_at,
          messages: row.messages ?? [],
          messageCount: (row.messages ?? []).length,
        })),
      },
    });
  }),
);

export default router;

