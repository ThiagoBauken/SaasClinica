/**
 * Chat API Routes
 * Gerencia sessões de chat, mensagens e processamento
 */

import { Router } from 'express';
import { db } from '../db';
import { eq, and, desc, sql, gte, lte, or, isNull, ne } from 'drizzle-orm';
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

    const sessions = await db
      .select({
        id: chatSessions.id,
        phone: chatSessions.phone,
        userType: chatSessions.userType,
        patientId: chatSessions.patientId,
        status: chatSessions.status,
        currentState: chatSessions.currentState,
        lastMessageAt: chatSessions.lastMessageAt,
        createdAt: chatSessions.createdAt,
        updatedAt: chatSessions.updatedAt,
      })
      .from(chatSessions)
      .where(and(...conditions))
      .orderBy(desc(chatSessions.lastMessageAt))
      .limit(Number(limit))
      .offset(Number(offset));

    // Buscar nome do paciente e última mensagem para cada sessão
    type SessionRow = typeof sessions[0];
    const sessionsWithDetails = await Promise.all(
      sessions.map(async (session: SessionRow) => {
        let patientName = null;
        let lastMessage = null;
        let unreadCount = 0;

        // Buscar nome do paciente
        if (session.patientId) {
          const [patient] = await db
            .select({ fullName: patients.fullName })
            .from(patients)
            .where(eq(patients.id, session.patientId))
            .limit(1);
          patientName = patient?.fullName;
        }

        // Buscar última mensagem
        const [lastMsg] = await db
          .select({
            content: chatMessages.content,
            role: chatMessages.role,
            createdAt: chatMessages.createdAt,
          })
          .from(chatMessages)
          .where(eq(chatMessages.sessionId, session.id))
          .orderBy(desc(chatMessages.createdAt))
          .limit(1);

        if (lastMsg) {
          lastMessage = {
            content: lastMsg.content.substring(0, 100) + (lastMsg.content.length > 100 ? '...' : ''),
            role: lastMsg.role,
            createdAt: lastMsg.createdAt,
          };
        }

        // Contar mensagens não lidas (mensagens de usuário após última resposta)
        const [count] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(chatMessages)
          .where(
            and(
              eq(chatMessages.sessionId, session.id),
              eq(chatMessages.role, 'user'),
              // Mensagens após a última atualização da sessão (aproximação)
              session.updatedAt
                ? gte(chatMessages.createdAt, session.updatedAt)
                : sql`true`
            )
          );

        return {
          ...session,
          patientName,
          lastMessage,
          unreadCount: count?.count || 0,
          // Indicador se precisa atenção (waiting_human ou sem resposta)
          needsAttention: session.status === 'waiting_human' || (count?.count || 0) > 0,
        };
      })
    );

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
      data: sessionsWithDetails,
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
        .where(eq(patients.id, session.patientId))
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

    // Tentar enviar via Wuzapi primeiro, depois Evolution API
    let sendResult: { success: boolean; messageId?: string; error?: string };

    // Verificar se Wuzapi esta configurado e conectado
    const wuzapiStatus = await getWuzapiStatus(companyId);

    if (wuzapiStatus.configured && wuzapiStatus.loggedIn) {
      // Usar Wuzapi
      console.log('[Chat] Enviando via Wuzapi para:', session.phone);
      sendResult = await sendWuzapiTextMessage(companyId, session.phone, content);
    } else {
      // Fallback para Evolution API
      const evolutionService = await createEvolutionService(companyId);
      if (!evolutionService) {
        return res.status(503).json({
          error: 'Serviço de WhatsApp não configurado para esta empresa',
        });
      }
      console.log('[Chat] Enviando via Evolution API para:', session.phone);
      sendResult = await evolutionService.sendTextMessage({
        phone: session.phone,
        message: content,
      });
    }

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
 * Processa uma mensagem de chat (endpoint principal para N8N)
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
      console.error('Erro ao processar mensagem:', error);
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
        console.warn(`[Security] Tentativa de acesso a arquivo fora do diretório: ${filePath}`);
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

export default router;
