/**
 * Canned Responses API Routes
 * Gerencia respostas prontas configuráveis por empresa
 */

import { Router } from 'express';
import { db } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { cannedResponses, type CannedResponse } from '@shared/schema';
import { asyncHandler, requireAuth, getCompanyId } from '../middleware/auth';

const router = Router();

/**
 * GET /api/v1/canned-responses
 * Lista todas as respostas prontas da empresa
 */
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const { intent, isActive } = req.query;

    let conditions = [eq(cannedResponses.companyId, companyId)];

    if (intent) {
      conditions.push(eq(cannedResponses.intent, intent as string));
    }

    if (isActive !== undefined) {
      conditions.push(eq(cannedResponses.isActive, isActive === 'true'));
    }

    const responses = await db
      .select()
      .from(cannedResponses)
      .where(and(...conditions))
      .orderBy(cannedResponses.intent, desc(cannedResponses.priority));

    res.json({
      success: true,
      data: responses,
    });
  })
);

/**
 * GET /api/v1/canned-responses/:id
 * Retorna uma resposta pronta específica
 */
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const id = parseInt(req.params.id);

    const [response] = await db
      .select()
      .from(cannedResponses)
      .where(
        and(
          eq(cannedResponses.id, id),
          eq(cannedResponses.companyId, companyId)
        )
      )
      .limit(1);

    if (!response) {
      return res.status(404).json({ error: 'Resposta não encontrada' });
    }

    res.json({
      success: true,
      data: response,
    });
  })
);

/**
 * POST /api/v1/canned-responses
 * Cria uma nova resposta pronta
 */
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const { intent, name, content, category, priority, isActive } = req.body;

    if (!intent || !name || !content) {
      return res.status(400).json({
        error: 'intent, name e content são obrigatórios',
      });
    }

    const [response] = await db
      .insert(cannedResponses)
      .values({
        companyId,
        intent,
        name,
        content,
        category: category || 'general',
        priority: priority || 0,
        isActive: isActive !== false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    res.status(201).json({
      success: true,
      data: response,
    });
  })
);

/**
 * PUT /api/v1/canned-responses/:id
 * Atualiza uma resposta pronta
 */
router.put(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const id = parseInt(req.params.id);
    const { intent, name, content, category, priority, isActive } = req.body;

    // Verificar se existe
    const [existing] = await db
      .select()
      .from(cannedResponses)
      .where(
        and(
          eq(cannedResponses.id, id),
          eq(cannedResponses.companyId, companyId)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Resposta não encontrada' });
    }

    const [updated] = await db
      .update(cannedResponses)
      .set({
        intent: intent ?? existing.intent,
        name: name ?? existing.name,
        content: content ?? existing.content,
        category: category ?? existing.category,
        priority: priority ?? existing.priority,
        isActive: isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(cannedResponses.id, id))
      .returning();

    res.json({
      success: true,
      data: updated,
    });
  })
);

/**
 * DELETE /api/v1/canned-responses/:id
 * Remove uma resposta pronta
 */
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const id = parseInt(req.params.id);

    const [existing] = await db
      .select()
      .from(cannedResponses)
      .where(
        and(
          eq(cannedResponses.id, id),
          eq(cannedResponses.companyId, companyId)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Resposta não encontrada' });
    }

    await db
      .delete(cannedResponses)
      .where(eq(cannedResponses.id, id));

    res.json({
      success: true,
      message: 'Resposta removida',
    });
  })
);

/**
 * POST /api/v1/canned-responses/seed-defaults
 * Popula respostas padrão para a empresa
 */
router.post(
  '/seed-defaults',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);

    // Verificar se já tem respostas
    const existing = await db
      .select()
      .from(cannedResponses)
      .where(eq(cannedResponses.companyId, companyId))
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({
        error: 'Empresa já possui respostas configuradas',
      });
    }

    // Respostas padrão
    const defaultResponses = [
      {
        intent: 'greeting',
        name: 'Saudação',
        content: `Olá! 👋 Seja bem-vindo(a) à {{company.name}}!\n\nComo posso ajudar você hoje?\n\n📅 Agendar consulta\n📍 Endereço\n💰 Valores\n🕐 Horários`,
        category: 'general',
        priority: 10,
      },
      {
        intent: 'confirm',
        name: 'Confirmação de Consulta',
        content: `✅ Perfeito! Sua consulta está confirmada.\n\nAguardamos você! 😊\n\n📍 Endereço: {{company.address}}\n🗺️ Como chegar: {{settings.googleMapsLink}}`,
        category: 'appointment',
        priority: 10,
      },
      {
        intent: 'cancel',
        name: 'Cancelamento',
        content: `❌ Ok, sua consulta foi cancelada.\n\nSe precisar remarcar, é só me avisar ou ligue:\n📞 {{company.phone}}`,
        category: 'appointment',
        priority: 10,
      },
      {
        intent: 'location',
        name: 'Localização',
        content: `📍 *Nosso Endereço:*\n{{company.address}}\n\n🗺️ Ver no mapa: {{settings.googleMapsLink}}\n\n🚗 Temos estacionamento próximo!`,
        category: 'info',
        priority: 10,
      },
      {
        intent: 'hours',
        name: 'Horário de Funcionamento',
        content: `🕐 *Horário de Funcionamento:*\n\n📅 Segunda a Sexta: 08:00 - 18:00\n📅 Sábado: 08:00 - 12:00\n📅 Domingo: Fechado\n\n_Sujeito a alterações em feriados_`,
        category: 'info',
        priority: 10,
      },
      {
        intent: 'price',
        name: 'Valores',
        content: `💰 Para informações sobre valores, entre em contato:\n\n📞 {{company.phone}}\n📱 WhatsApp: {{settings.emergencyPhone}}\n\nOu agende uma avaliação gratuita!`,
        category: 'info',
        priority: 10,
      },
      {
        intent: 'emergency',
        name: 'Emergência',
        content: `🚨 *Emergência Odontológica?*\n\nLigue agora:\n📞 {{settings.emergencyPhone}}\n\nEstamos prontos para ajudar!\n\n⚠️ Em caso de dor intensa, sangramento ou trauma, procure atendimento imediato.`,
        category: 'urgent',
        priority: 100,
      },
      {
        intent: 'thanks',
        name: 'Agradecimento',
        content: `😊 Por nada! Estamos sempre à disposição.\n\n⭐ Gostou do atendimento? Deixe sua avaliação:\n{{settings.googleReviewLink}}`,
        category: 'general',
        priority: 5,
      },
      {
        intent: 'goodbye',
        name: 'Despedida',
        content: `Até logo! 👋\n\nFoi um prazer atendê-lo(a).\nQualquer dúvida, estamos aqui!\n\n💙 {{company.name}}`,
        category: 'general',
        priority: 5,
      },
      {
        intent: 'talk_to_human',
        name: 'Falar com Atendente',
        content: `👤 Entendi! Vou transferir você para um atendente humano.\n\nAguarde um momento, por favor.\n\n⏱️ Tempo estimado: 2-5 minutos`,
        category: 'transfer',
        priority: 50,
      },
      {
        intent: 'review',
        name: 'Avaliação',
        content: `⭐ Adoraríamos saber sua opinião!\n\nSua avaliação é muito importante para nós:\n\n🌟 Avaliar no Google: {{settings.googleReviewLink}}\n\nObrigado pela confiança! 💙`,
        category: 'engagement',
        priority: 5,
      },
      {
        intent: 'unknown',
        name: 'Não Entendi',
        content: `Desculpe, não entendi sua mensagem. 😅\n\nPosso ajudar com:\n• 📅 Agendar consulta\n• ✅ Confirmar/cancelar\n• 📍 Endereço e horário\n• 💰 Valores\n\nOu digite "atendente" para falar com uma pessoa.`,
        category: 'fallback',
        priority: 0,
      },
    ];

    // Inserir respostas
    const inserted = await db
      .insert(cannedResponses)
      .values(
        defaultResponses.map((r) => ({
          ...r,
          companyId,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
      )
      .returning();

    res.status(201).json({
      success: true,
      message: `${inserted.length} respostas padrão criadas`,
      data: inserted,
    });
  })
);

/**
 * GET /api/v1/canned-responses/intents
 * Lista os intents disponíveis
 */
router.get(
  '/meta/intents',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const intents = [
      { value: 'greeting', label: 'Saudação', description: 'Oi, olá, bom dia, etc.' },
      { value: 'confirm', label: 'Confirmação', description: 'Sim, confirmo, ok' },
      { value: 'cancel', label: 'Cancelamento', description: 'Não, cancelar, desmarcar' },
      { value: 'reschedule', label: 'Reagendamento', description: 'Remarcar, trocar horário' },
      { value: 'schedule', label: 'Agendamento', description: 'Marcar consulta, agendar' },
      { value: 'price', label: 'Valores', description: 'Preço, quanto custa, valor' },
      { value: 'location', label: 'Localização', description: 'Endereço, onde fica, mapa' },
      { value: 'hours', label: 'Horário', description: 'Horário de funcionamento' },
      { value: 'emergency', label: 'Emergência', description: 'Urgente, dor, emergência' },
      { value: 'thanks', label: 'Agradecimento', description: 'Obrigado, valeu' },
      { value: 'goodbye', label: 'Despedida', description: 'Tchau, até logo' },
      { value: 'talk_to_human', label: 'Falar com Humano', description: 'Atendente, pessoa real' },
      { value: 'review', label: 'Avaliação', description: 'Review, feedback, estrelas' },
      { value: 'unknown', label: 'Não Entendido', description: 'Fallback para mensagens não reconhecidas' },
    ];

    res.json({
      success: true,
      data: intents,
    });
  })
);

export default router;
