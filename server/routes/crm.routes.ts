/**
 * Rotas do CRM - Funil de Vendas
 *
 * Gerencia oportunidades de venda, etapas do funil,
 * tarefas de follow-up e histórico de movimentações
 */

import { Router } from 'express';
import { db } from '../db';
import { eq, and, desc, asc, sql, isNull, gte, lte } from 'drizzle-orm';
import { notDeleted } from '../lib/soft-delete';
import {
  salesFunnelStages,
  salesOpportunities,
  salesOpportunityHistory,
  salesTasks,
  chatSessions,
  chatMessages,
  patients,
  users,
  insertSalesFunnelStageSchema,
  insertSalesOpportunitySchema,
  insertSalesTaskSchema,
} from '@shared/schema';
import { requireAuth } from '../middleware/auth';
import { logger } from '../logger';
import {
  ensureOpportunityForSession,
  progressOpportunity,
  getEnrichedPipeline,
  getOpportunityTimeline,
  AI_STAGES,
  AI_STAGE_LABELS,
} from '../services/crm-auto-progression';

const router = Router();

// Types para o CRM
interface OpportunityWithRelations {
  opportunity: typeof salesOpportunities.$inferSelect;
  patient: typeof patients.$inferSelect | null;
  assignedUser: typeof users.$inferSelect | null;
  stage: typeof salesFunnelStages.$inferSelect;
}

// ==================== ETAPAS DO FUNIL ====================

/**
 * GET /api/crm/stages
 * Lista etapas do funil da empresa
 */
router.get('/stages', requireAuth, async (req, res) => {
  try {
    const companyId = req.user!.companyId;

    const stages = await db
      .select()
      .from(salesFunnelStages)
      .where(
        and(
          eq(salesFunnelStages.companyId, companyId),
          eq(salesFunnelStages.isActive, true)
        )
      )
      .orderBy(asc(salesFunnelStages.order));

    res.json(stages);
  } catch (error: any) {
    logger.error({ err: error }, 'Erro ao listar etapas:');
    res.status(500).json({ error: 'Erro ao listar etapas do funil' });
  }
});

/**
 * POST /api/crm/stages
 * Cria nova etapa do funil
 */
router.post('/stages', requireAuth, async (req, res) => {
  try {
    const companyId = req.user!.companyId;
    const data = insertSalesFunnelStageSchema.parse(req.body);

    // Buscar maior ordem atual
    const [maxOrder] = await db
      .select({ max: sql`MAX(${salesFunnelStages.order})` })
      .from(salesFunnelStages)
      .where(eq(salesFunnelStages.companyId, companyId));

    const [stage] = await db
      .insert(salesFunnelStages)
      .values({
        ...data,
        companyId,
        order: (maxOrder?.max as number || 0) + 1,
      })
      .returning();

    res.status(201).json(stage);
  } catch (error: any) {
    logger.error({ err: error }, 'Erro ao criar etapa:');
    res.status(500).json({ error: 'Erro ao criar etapa' });
  }
});

/**
 * PUT /api/crm/stages/:id
 * Atualiza etapa do funil
 */
router.put('/stages/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId;
    const data = req.body;

    const [updated] = await db
      .update(salesFunnelStages)
      .set(data)
      .where(
        and(
          eq(salesFunnelStages.id, parseInt(id)),
          eq(salesFunnelStages.companyId, companyId)
        )
      )
      .returning();

    res.json(updated);
  } catch (error: any) {
    logger.error({ err: error }, 'Erro ao atualizar etapa:');
    res.status(500).json({ error: 'Erro ao atualizar etapa' });
  }
});

/**
 * PUT /api/crm/stages/reorder
 * Reordena etapas do funil
 */
router.put('/stages/reorder', requireAuth, async (req, res) => {
  try {
    const companyId = req.user!.companyId;
    const { stageIds } = req.body; // Array de IDs na nova ordem

    for (let i = 0; i < stageIds.length; i++) {
      await db
        .update(salesFunnelStages)
        .set({ order: i + 1 })
        .where(
          and(
            eq(salesFunnelStages.id, stageIds[i]),
            eq(salesFunnelStages.companyId, companyId)
          )
        );
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, 'Erro ao reordenar etapas:');
    res.status(500).json({ error: 'Erro ao reordenar etapas' });
  }
});

// ==================== OPORTUNIDADES ====================

/**
 * GET /api/crm/opportunities
 * Lista oportunidades do funil (formato Kanban)
 */
router.get('/opportunities', requireAuth, async (req, res) => {
  try {
    const companyId = req.user!.companyId;
    const { stageId, assignedTo, treatmentType } = req.query;

    // Buscar etapas
    const stages = await db
      .select()
      .from(salesFunnelStages)
      .where(
        and(
          eq(salesFunnelStages.companyId, companyId),
          eq(salesFunnelStages.isActive, true)
        )
      )
      .orderBy(asc(salesFunnelStages.order));

    // Buscar oportunidades
    let query = db
      .select({
        opportunity: salesOpportunities,
        patient: patients,
        assignedUser: users,
        stage: salesFunnelStages,
      })
      .from(salesOpportunities)
      .leftJoin(patients, and(eq(salesOpportunities.patientId, patients.id), notDeleted(patients.deletedAt)))
      .leftJoin(users, and(eq(salesOpportunities.assignedTo, users.id), notDeleted(users.deletedAt)))
      .innerJoin(salesFunnelStages, eq(salesOpportunities.stageId, salesFunnelStages.id))
      .where(eq(salesOpportunities.companyId, companyId))
      .orderBy(desc(salesOpportunities.updatedAt));

    const opportunities: OpportunityWithRelations[] = await query;

    // Agrupar por etapa para o Kanban
    const kanbanData = stages.map((stage: typeof salesFunnelStages.$inferSelect) => ({
      ...stage,
      opportunities: opportunities
        .filter((o: OpportunityWithRelations) => o.opportunity.stageId === stage.id)
        .map((o: OpportunityWithRelations) => ({
          ...o.opportunity,
          patientName: o.patient?.fullName || o.opportunity.leadName,
          patientPhone: o.patient?.phone || o.opportunity.leadPhone,
          assignedUserName: o.assignedUser?.fullName,
        })),
      totalValue: opportunities
        .filter((o: OpportunityWithRelations) => o.opportunity.stageId === stage.id)
        .reduce((sum: number, o: OpportunityWithRelations) => sum + (parseFloat(o.opportunity.estimatedValue || '0')), 0),
    }));

    res.json({
      stages: kanbanData,
      summary: {
        totalOpportunities: opportunities.length,
        totalValue: opportunities.reduce((sum: number, o: OpportunityWithRelations) => sum + (parseFloat(o.opportunity.estimatedValue || '0')), 0),
        wonValue: opportunities
          .filter((o: OpportunityWithRelations) => o.stage.isWon)
          .reduce((sum: number, o: OpportunityWithRelations) => sum + (parseFloat(o.opportunity.estimatedValue || '0')), 0),
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Erro ao listar oportunidades:');
    res.status(500).json({ error: 'Erro ao listar oportunidades' });
  }
});

/**
 * GET /api/crm/opportunities/:id
 * Retorna detalhes de uma oportunidade
 */
router.get('/opportunities/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId;

    const [result] = await db
      .select({
        opportunity: salesOpportunities,
        patient: patients,
        assignedUser: users,
        stage: salesFunnelStages,
      })
      .from(salesOpportunities)
      .leftJoin(patients, and(eq(salesOpportunities.patientId, patients.id), notDeleted(patients.deletedAt)))
      .leftJoin(users, and(eq(salesOpportunities.assignedTo, users.id), notDeleted(users.deletedAt)))
      .innerJoin(salesFunnelStages, eq(salesOpportunities.stageId, salesFunnelStages.id))
      .where(
        and(
          eq(salesOpportunities.id, parseInt(id)),
          eq(salesOpportunities.companyId, companyId)
        )
      );

    if (!result) {
      return res.status(404).json({ error: 'Oportunidade não encontrada' });
    }

    // Buscar histórico
    const history = await db
      .select({
        history: salesOpportunityHistory,
        fromStage: salesFunnelStages,
        user: users,
      })
      .from(salesOpportunityHistory)
      .leftJoin(salesFunnelStages, eq(salesOpportunityHistory.fromStageId, salesFunnelStages.id))
      .leftJoin(users, eq(salesOpportunityHistory.createdBy, users.id))
      .where(eq(salesOpportunityHistory.opportunityId, parseInt(id)))
      .orderBy(desc(salesOpportunityHistory.createdAt));

    // Buscar tarefas
    const tasks = await db
      .select()
      .from(salesTasks)
      .where(eq(salesTasks.opportunityId, parseInt(id)))
      .orderBy(asc(salesTasks.dueDate));

    res.json({
      ...result.opportunity,
      patient: result.patient,
      assignedUser: result.assignedUser,
      stage: result.stage,
      history,
      tasks,
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Erro ao buscar oportunidade:');
    res.status(500).json({ error: 'Erro ao buscar oportunidade' });
  }
});

/**
 * POST /api/crm/opportunities
 * Cria nova oportunidade
 */
router.post('/opportunities', requireAuth, async (req, res) => {
  try {
    const companyId = req.user!.companyId;
    const userId = req.user?.id;
    const data = req.body;

    // Se não especificou etapa, usar a default
    let stageId = data.stageId;
    if (!stageId) {
      const [defaultStage] = await db
        .select()
        .from(salesFunnelStages)
        .where(
          and(
            eq(salesFunnelStages.companyId, companyId),
            eq(salesFunnelStages.isDefault, true)
          )
        )
        .limit(1);

      stageId = defaultStage?.id;
    }

    if (!stageId) {
      return res.status(400).json({ error: 'Nenhuma etapa de funil configurada' });
    }

    const [opportunity] = await db
      .insert(salesOpportunities)
      .values({
        ...data,
        companyId,
        stageId,
        stageEnteredAt: new Date(),
      })
      .returning();

    // Registrar no histórico
    await db.insert(salesOpportunityHistory).values({
      opportunityId: opportunity.id,
      toStageId: stageId,
      action: 'created',
      description: 'Oportunidade criada',
      createdBy: userId,
    });

    res.status(201).json(opportunity);
  } catch (error: any) {
    logger.error({ err: error }, 'Erro ao criar oportunidade:');
    res.status(500).json({ error: 'Erro ao criar oportunidade' });
  }
});

/**
 * PUT /api/crm/opportunities/:id
 * Atualiza oportunidade
 */
router.put('/opportunities/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId;
    const userId = req.user?.id;
    const data = req.body;

    // Buscar oportunidade atual
    const [current] = await db
      .select()
      .from(salesOpportunities)
      .where(
        and(
          eq(salesOpportunities.id, parseInt(id)),
          eq(salesOpportunities.companyId, companyId)
        )
      );

    if (!current) {
      return res.status(404).json({ error: 'Oportunidade não encontrada' });
    }

    // Verificar se mudou de etapa
    const stageChanged = data.stageId && data.stageId !== current.stageId;

    const updateData: any = {
      ...data,
      updatedAt: new Date(),
    };

    if (stageChanged) {
      updateData.stageEnteredAt = new Date();

      // Buscar etapa de destino
      const [newStage] = await db
        .select()
        .from(salesFunnelStages)
        .where(eq(salesFunnelStages.id, data.stageId));

      // Atualizar datas de ganho/perda
      if (newStage?.isWon) {
        updateData.wonAt = new Date();
      } else if (newStage?.isLost) {
        updateData.lostAt = new Date();
      }
    }

    const [updated] = await db
      .update(salesOpportunities)
      .set(updateData)
      .where(eq(salesOpportunities.id, parseInt(id)))
      .returning();

    // Registrar no histórico
    if (stageChanged) {
      await db.insert(salesOpportunityHistory).values({
        opportunityId: updated.id,
        fromStageId: current.stageId,
        toStageId: data.stageId,
        action: 'stage_changed',
        description: `Movido para nova etapa`,
        createdBy: userId,
      });
    }

    res.json(updated);
  } catch (error: any) {
    logger.error({ err: error }, 'Erro ao atualizar oportunidade:');
    res.status(500).json({ error: 'Erro ao atualizar oportunidade' });
  }
});

/**
 * PUT /api/crm/opportunities/:id/move
 * Move oportunidade para outra etapa (Drag & Drop)
 */
router.put('/opportunities/:id/move', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { stageId } = req.body;
    const companyId = req.user!.companyId;
    const userId = req.user?.id;

    // Buscar oportunidade atual
    const [current] = await db
      .select()
      .from(salesOpportunities)
      .where(
        and(
          eq(salesOpportunities.id, parseInt(id)),
          eq(salesOpportunities.companyId, companyId)
        )
      );

    if (!current) {
      return res.status(404).json({ error: 'Oportunidade não encontrada' });
    }

    // Buscar nova etapa
    const [newStage] = await db
      .select()
      .from(salesFunnelStages)
      .where(eq(salesFunnelStages.id, stageId));

    if (!newStage) {
      return res.status(404).json({ error: 'Etapa não encontrada' });
    }

    const updateData: any = {
      stageId,
      stageEnteredAt: new Date(),
      updatedAt: new Date(),
    };

    if (newStage.isWon) {
      updateData.wonAt = new Date();
    } else if (newStage.isLost) {
      updateData.lostAt = new Date();
    }

    const [updated] = await db
      .update(salesOpportunities)
      .set(updateData)
      .where(eq(salesOpportunities.id, parseInt(id)))
      .returning();

    // Registrar no histórico
    await db.insert(salesOpportunityHistory).values({
      opportunityId: updated.id,
      fromStageId: current.stageId,
      toStageId: stageId,
      action: 'stage_changed',
      description: `Movido de "${current.stageId}" para "${newStage.name}"`,
      createdBy: userId,
    });

    res.json(updated);
  } catch (error: any) {
    logger.error({ err: error }, 'Erro ao mover oportunidade:');
    res.status(500).json({ error: 'Erro ao mover oportunidade' });
  }
});

/**
 * DELETE /api/crm/opportunities/:id
 * Remove uma oportunidade
 */
router.delete('/opportunities/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId;

    // Verificar se existe e pertence à empresa
    const [opportunity] = await db
      .select()
      .from(salesOpportunities)
      .where(
        and(
          eq(salesOpportunities.id, parseInt(id)),
          eq(salesOpportunities.companyId, companyId)
        )
      );

    if (!opportunity) {
      return res.status(404).json({ error: 'Oportunidade não encontrada' });
    }

    // Excluir tarefas relacionadas primeiro
    await db
      .delete(salesTasks)
      .where(eq(salesTasks.opportunityId, parseInt(id)));
      
    // Excluir histórico relacionado
    await db
      .delete(salesOpportunityHistory)
      .where(eq(salesOpportunityHistory.opportunityId, parseInt(id)));

    // Excluir oportunidade
    await db
      .delete(salesOpportunities)
      .where(eq(salesOpportunities.id, parseInt(id)));

    res.json({ success: true, message: 'Oportunidade removida com sucesso' });
  } catch (error: any) {
    logger.error({ err: error }, 'Erro ao excluir oportunidade:');
    res.status(500).json({ error: 'Erro ao excluir oportunidade' });
  }
});

// ==================== TAREFAS / FOLLOW-UPS ====================

/**
 * GET /api/crm/tasks
 * Lista tarefas pendentes
 */
router.get('/tasks', requireAuth, async (req, res) => {
  try {
    const companyId = req.user!.companyId;
    const userId = req.user?.id;
    const { status = 'pending', mine } = req.query;

    let whereConditions = [
      eq(salesTasks.companyId, companyId),
      eq(salesTasks.status, status as string),
    ];

    if (mine === 'true') {
      whereConditions.push(eq(salesTasks.assignedTo, userId!));
    }

    const tasks = await db
      .select({
        task: salesTasks,
        opportunity: salesOpportunities,
        patient: patients,
      })
      .from(salesTasks)
      .leftJoin(salesOpportunities, eq(salesTasks.opportunityId, salesOpportunities.id))
      .leftJoin(patients, and(eq(salesTasks.patientId, patients.id), notDeleted(patients.deletedAt)))
      .where(and(...whereConditions))
      .orderBy(asc(salesTasks.dueDate));

    res.json(tasks);
  } catch (error: any) {
    logger.error({ err: error }, 'Erro ao listar tarefas:');
    res.status(500).json({ error: 'Erro ao listar tarefas' });
  }
});

/**
 * POST /api/crm/tasks
 * Cria nova tarefa
 */
router.post('/tasks', requireAuth, async (req, res) => {
  try {
    const companyId = req.user!.companyId;
    const userId = req.user?.id;
    const data = insertSalesTaskSchema.parse(req.body);

    const [task] = await db
      .insert(salesTasks)
      .values({
        ...data,
        companyId,
        createdBy: userId,
      })
      .returning();

    res.status(201).json(task);
  } catch (error: any) {
    logger.error({ err: error }, 'Erro ao criar tarefa:');
    res.status(500).json({ error: 'Erro ao criar tarefa' });
  }
});

/**
 * PUT /api/crm/tasks/:id/complete
 * Marca tarefa como concluída
 */
router.put('/tasks/:id/complete', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { result } = req.body;

    const [task] = await db
      .update(salesTasks)
      .set({
        status: 'completed',
        completedAt: new Date(),
        result,
      })
      .where(eq(salesTasks.id, parseInt(id)))
      .returning();

    res.json(task);
  } catch (error: any) {
    logger.error({ err: error }, 'Erro ao completar tarefa:');
    res.status(500).json({ error: 'Erro ao completar tarefa' });
  }
});

// ==================== ANALYTICS ====================

/**
 * GET /api/crm/analytics
 * Retorna métricas do funil
 */
router.get('/analytics', requireAuth, async (req, res) => {
  try {
    const companyId = req.user!.companyId;
    const { startDate, endDate } = req.query;

    // Métricas por etapa
    const stageMetrics = await db
      .select({
        stageId: salesOpportunities.stageId,
        stageName: salesFunnelStages.name,
        stageColor: salesFunnelStages.color,
        count: sql<number>`COUNT(*)`,
        totalValue: sql<number>`SUM(CAST(${salesOpportunities.estimatedValue} AS DECIMAL))`,
      })
      .from(salesOpportunities)
      .innerJoin(salesFunnelStages, eq(salesOpportunities.stageId, salesFunnelStages.id))
      .where(eq(salesOpportunities.companyId, companyId))
      .groupBy(salesOpportunities.stageId, salesFunnelStages.name, salesFunnelStages.color);

    // Taxa de conversão
    const [totals] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        won: sql<number>`COUNT(*) FILTER (WHERE ${salesOpportunities.wonAt} IS NOT NULL)`,
        lost: sql<number>`COUNT(*) FILTER (WHERE ${salesOpportunities.lostAt} IS NOT NULL)`,
        totalValue: sql<number>`SUM(CAST(${salesOpportunities.estimatedValue} AS DECIMAL))`,
        wonValue: sql<number>`SUM(CAST(${salesOpportunities.estimatedValue} AS DECIMAL)) FILTER (WHERE ${salesOpportunities.wonAt} IS NOT NULL)`,
      })
      .from(salesOpportunities)
      .where(eq(salesOpportunities.companyId, companyId));

    // Oportunidades por origem
    const bySource = await db
      .select({
        source: salesOpportunities.leadSource,
        count: sql<number>`COUNT(*)`,
        value: sql<number>`SUM(CAST(${salesOpportunities.estimatedValue} AS DECIMAL))`,
      })
      .from(salesOpportunities)
      .where(eq(salesOpportunities.companyId, companyId))
      .groupBy(salesOpportunities.leadSource);

    // Oportunidades por tipo de tratamento
    const byTreatment = await db
      .select({
        treatment: salesOpportunities.treatmentType,
        count: sql<number>`COUNT(*)`,
        value: sql<number>`SUM(CAST(${salesOpportunities.estimatedValue} AS DECIMAL))`,
      })
      .from(salesOpportunities)
      .where(eq(salesOpportunities.companyId, companyId))
      .groupBy(salesOpportunities.treatmentType);

    res.json({
      stageMetrics,
      totals: {
        ...totals,
        conversionRate: totals?.total ? ((totals.won || 0) / totals.total * 100).toFixed(1) : 0,
      },
      bySource,
      byTreatment,
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Erro ao buscar analytics:');
    res.status(500).json({ error: 'Erro ao buscar analytics' });
  }
});

// ==================== WHATSAPP CRM PIPELINE ====================

/**
 * GET /api/crm/pipeline
 * Returns enriched pipeline with WhatsApp session data
 */
router.get('/pipeline', requireAuth, async (req, res) => {
  try {
    const companyId = req.user!.companyId;

    // Inline pipeline to avoid import caching issues
    const stages = await db
      .select()
      .from(salesFunnelStages)
      .where(and(eq(salesFunnelStages.companyId, companyId), eq(salesFunnelStages.isActive, true)))
      .orderBy(asc(salesFunnelStages.order));

    const opportunities = await db
      .select({
        opportunity: salesOpportunities,
        patient: patients,
        chatStatus: chatSessions.status,
        chatLastMessageAt: chatSessions.lastMessageAt,
      })
      .from(salesOpportunities)
      .leftJoin(patients, and(eq(salesOpportunities.patientId, patients.id), notDeleted(patients.deletedAt)))
      .leftJoin(chatSessions, eq(salesOpportunities.chatSessionId, chatSessions.id))
      .where(eq(salesOpportunities.companyId, companyId))
      .orderBy(desc(salesOpportunities.updatedAt));

    type OppRow = typeof opportunities[number];

    // Last actions
    const oppIds = opportunities.map((o: OppRow) => o.opportunity.id);
    const lastActions: Record<number, { action: string; description: string }> = {};

    if (oppIds.length > 0) {
      try {
        const historyRows = await db
          .select({
            opportunityId: salesOpportunityHistory.opportunityId,
            action: salesOpportunityHistory.action,
            description: salesOpportunityHistory.description,
          })
          .from(salesOpportunityHistory)
          .where(sql`${salesOpportunityHistory.opportunityId} IN (${sql.join(oppIds.map((id: number) => sql`${id}`), sql`, `)})`)
          .orderBy(desc(salesOpportunityHistory.createdAt));

        for (const row of historyRows) {
          if (!lastActions[row.opportunityId]) {
            lastActions[row.opportunityId] = { action: row.action, description: row.description || '' };
          }
        }
      } catch (_e) { /* skip history */ }
    }

    // Orphan fix
    if (stages.length > 0) {
      const validStageIds = new Set(stages.map((s: any) => s.id));
      for (const o of opportunities) {
        if (!validStageIds.has(o.opportunity.stageId)) {
          o.opportunity.stageId = stages[0].id;
        }
      }
    }

    const pipeline = stages.map((stage: any) => {
      const stageOpps = opportunities
        .filter((o: OppRow) => o.opportunity.stageId === stage.id)
        .map((o: OppRow) => ({
          ...o.opportunity,
          patientName: o.patient?.fullName || o.opportunity.leadName,
          patientPhone: o.patient?.phone || o.opportunity.leadPhone,
          hasWhatsApp: !!o.opportunity.chatSessionId,
          chatStatus: o.chatStatus || null,
          chatLastMessage: o.chatLastMessageAt || null,
          aiStageLabel: o.opportunity.aiStage
            ? (AI_STAGE_LABELS[o.opportunity.aiStage] || o.opportunity.aiStage)
            : null,
          lastAction: lastActions[o.opportunity.id]?.action || null,
          lastActionDescription: lastActions[o.opportunity.id]?.description || null,
        }));

      return {
        ...stage,
        opportunities: stageOpps,
        totalValue: stageOpps.reduce((sum: number, o: any) => sum + parseFloat(o.estimatedValue || '0'), 0),
        count: stageOpps.length,
      };
    });

    const allOpps = opportunities.map((o: OppRow) => o.opportunity);
    const wonStageIds = stages.filter((s: any) => s.isWon).map((s: any) => s.id);

    res.json({
      stages: pipeline,
      summary: {
        totalOpportunities: allOpps.length,
        totalValue: allOpps.reduce((s: number, o: any) => s + parseFloat(o.estimatedValue || '0'), 0),
        wonValue: allOpps.filter((o: any) => wonStageIds.includes(o.stageId)).reduce((s: number, o: any) => s + parseFloat(o.estimatedValue || '0'), 0),
        whatsappActive: allOpps.filter((o: any) => o.chatSessionId).length,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Erro ao buscar pipeline:');
    res.status(500).json({ error: 'Erro ao buscar pipeline', details: error?.message });
  }
});

/**
 * POST /api/crm/auto-progress
 * Called by AI agent to progress an opportunity through stages.
 * Body: { trigger: 'scheduling', sessionId?: number, opportunityId?: number, metadata?: object }
 */
router.post('/auto-progress', requireAuth, async (req, res) => {
  try {
    const companyId = req.user!.companyId;
    const userId = req.user?.id;
    const { trigger, sessionId, opportunityId, metadata } = req.body;

    if (!trigger) {
      return res.status(400).json({ error: 'trigger é obrigatório' });
    }

    if (!sessionId && !opportunityId) {
      return res.status(400).json({ error: 'sessionId ou opportunityId é obrigatório' });
    }

    const result = await progressOpportunity(companyId, trigger, {
      sessionId,
      opportunityId,
      metadata,
      userId,
    });

    if (!result) {
      return res.status(404).json({ error: 'Oportunidade não encontrada' });
    }

    res.json({ success: true, opportunity: result });
  } catch (error: any) {
    logger.error({ err: error }, 'Erro ao progredir oportunidade:');
    res.status(500).json({ error: 'Erro ao progredir oportunidade' });
  }
});

/**
 * POST /api/crm/from-session
 * Creates a CRM opportunity from a WhatsApp chat session.
 * Body: { sessionId: number }
 */
router.post('/from-session', requireAuth, async (req, res) => {
  try {
    const companyId = req.user!.companyId;
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId é obrigatório' });
    }

    // Get session info
    const [session] = await db
      .select()
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.id, sessionId),
          eq(chatSessions.companyId, companyId)
        )
      );

    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    // Get patient info if linked
    let patientName: string | undefined;
    if (session.patientId) {
      const [patient] = await db
        .select({ fullName: patients.fullName })
        .from(patients)
        .where(and(eq(patients.id, session.patientId), notDeleted(patients.deletedAt)));
      patientName = patient?.fullName;
    }

    const opportunity = await ensureOpportunityForSession(companyId, sessionId, {
      patientId: session.patientId || undefined,
      patientName,
      phone: session.phone,
      source: 'whatsapp',
    });

    res.status(201).json({ success: true, opportunity });
  } catch (error: any) {
    logger.error({ err: error }, 'Erro ao criar oportunidade de sessão:');
    res.status(500).json({ error: 'Erro ao criar oportunidade' });
  }
});

/**
 * GET /api/crm/opportunities/:id/timeline
 * Returns the full timeline of an opportunity (history + chat)
 */
router.get('/opportunities/:id/timeline', requireAuth, async (req, res) => {
  try {
    const companyId = req.user!.companyId;
    const opportunityId = parseInt(req.params.id);

    const timeline = await getOpportunityTimeline(companyId, opportunityId);
    if (!timeline) {
      return res.status(404).json({ error: 'Oportunidade não encontrada' });
    }

    // If there's a linked chat session, get recent messages
    let recentMessages: any[] = [];
    if (timeline.opportunity.chatSessionId) {
      recentMessages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, timeline.opportunity.chatSessionId))
        .orderBy(desc(chatMessages.createdAt))
        .limit(20);
    }

    res.json({
      ...timeline,
      recentMessages: recentMessages.reverse(),
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Erro ao buscar timeline:');
    res.status(500).json({ error: 'Erro ao buscar timeline' });
  }
});

/**
 * GET /api/crm/ai-stages
 * Returns available AI stages and their labels
 */
router.get('/ai-stages', requireAuth, async (_req, res) => {
  res.json({
    stages: AI_STAGES,
    labels: AI_STAGE_LABELS,
  });
});

/**
 * POST /api/crm/seed-stages
 * Seeds default pipeline stages for the company (if none exist)
 */
router.post('/seed-stages', requireAuth, async (req, res) => {
  try {
    const companyId = req.user!.companyId;
    const { seedDefaultStages } = await import('../services/crm-auto-progression');
    await seedDefaultStages(companyId);

    const stages = await db
      .select()
      .from(salesFunnelStages)
      .where(
        and(
          eq(salesFunnelStages.companyId, companyId),
          eq(salesFunnelStages.isActive, true)
        )
      )
      .orderBy(asc(salesFunnelStages.order));

    res.json({ success: true, stages });
  } catch (error: any) {
    logger.error({ err: error }, 'Erro ao criar etapas padrão:');
    res.status(500).json({ error: 'Erro ao criar etapas padrão' });
  }
});

/**
 * POST /api/crm/seed-test-data
 * Seeds default stages AND sample opportunities for testing
 */
router.post('/seed-test-data', requireAuth, async (req, res) => {
  try {
    const companyId = req.user!.companyId;
    const userId = req.user?.id;

    // Ensure stages exist
    const { seedDefaultStages } = await import('../services/crm-auto-progression');
    await seedDefaultStages(companyId);

    // Get stages
    const stages = await db
      .select()
      .from(salesFunnelStages)
      .where(
        and(
          eq(salesFunnelStages.companyId, companyId),
          eq(salesFunnelStages.isActive, true)
        )
      )
      .orderBy(asc(salesFunnelStages.order));

    if (stages.length === 0) {
      return res.status(500).json({ error: 'Falha ao criar etapas' });
    }

    // Check if there are already opportunities
    const existingOpps = await db
      .select({ id: salesOpportunities.id })
      .from(salesOpportunities)
      .where(eq(salesOpportunities.companyId, companyId))
      .limit(1);

    if (existingOpps.length > 0) {
      return res.json({ success: true, message: 'Dados já existem', skipped: true });
    }

    // Sample test data - dental clinic patients
    const testOpportunities = [
      { title: 'Implante - Maria Silva', leadName: 'Maria Silva', leadPhone: '(11) 99876-5432', leadSource: 'whatsapp', treatmentType: 'implante', estimatedValue: '8500.00', probability: 80, aiStage: 'confirmation' },
      { title: 'Ortodontia - João Santos', leadName: 'João Santos', leadPhone: '(11) 98765-4321', leadSource: 'instagram', treatmentType: 'ortodontia', estimatedValue: '6000.00', probability: 60, aiStage: 'scheduling' },
      { title: 'Clareamento - Ana Oliveira', leadName: 'Ana Oliveira', leadPhone: '(21) 97654-3210', leadSource: 'google', treatmentType: 'clareamento', estimatedValue: '1200.00', probability: 90, aiStage: 'consultation_done' },
      { title: 'Prótese - Carlos Ferreira', leadName: 'Carlos Ferreira', leadPhone: '(11) 96543-2109', leadSource: 'indicacao', treatmentType: 'protese', estimatedValue: '4500.00', probability: 40, aiStage: 'first_contact' },
      { title: 'Limpeza - Beatriz Lima', leadName: 'Beatriz Lima', leadPhone: '(21) 95432-1098', leadSource: 'site', treatmentType: 'limpeza', estimatedValue: '350.00', probability: 95, aiStage: 'payment_done' },
      { title: 'Canal - Roberto Almeida', leadName: 'Roberto Almeida', leadPhone: '(11) 94321-0987', leadSource: 'whatsapp', treatmentType: 'canal', estimatedValue: '2200.00', probability: 70, aiStage: 'scheduling' },
      { title: 'Harmonização - Fernanda Costa', leadName: 'Fernanda Costa', leadPhone: '(31) 93210-9876', leadSource: 'instagram', treatmentType: 'harmonizacao', estimatedValue: '5000.00', probability: 50, aiStage: 'first_contact' },
      { title: 'Restauração - Pedro Souza', leadName: 'Pedro Souza', leadPhone: '(11) 92109-8765', leadSource: 'telefone', treatmentType: 'restauracao', estimatedValue: '800.00', probability: 85, aiStage: 'confirmation' },
      { title: 'Implante - Lucia Martins', leadName: 'Lucia Martins', leadPhone: '(21) 91098-7654', leadSource: 'google', treatmentType: 'implante', estimatedValue: '12000.00', probability: 30, aiStage: 'first_contact' },
      { title: 'Extração - Marcos Pereira', leadName: 'Marcos Pereira', leadPhone: '(11) 90987-6543', leadSource: 'whatsapp', treatmentType: 'extracao', estimatedValue: '600.00', probability: 75, aiStage: 'consultation_done' },
    ];

    // Map AI stages to funnel stages
    const stageByTrigger: Record<string, number> = {};
    for (const stage of stages) {
      if (stage.automationTrigger) {
        stageByTrigger[stage.automationTrigger] = stage.id;
      }
    }
    // Default stage fallback
    const defaultStageId = stages.find((s: any) => s.isDefault)?.id || stages[0].id;

    for (const opp of testOpportunities) {
      const stageId = stageByTrigger[opp.aiStage] || defaultStageId;

      const [created] = await db
        .insert(salesOpportunities)
        .values({
          companyId,
          title: opp.title,
          leadName: opp.leadName,
          leadPhone: opp.leadPhone,
          leadSource: opp.leadSource,
          treatmentType: opp.treatmentType,
          estimatedValue: opp.estimatedValue,
          probability: opp.probability,
          aiStage: opp.aiStage,
          aiStageUpdatedAt: new Date(),
          stageId,
          stageEnteredAt: new Date(),
        })
        .returning();

      // Record history
      await db.insert(salesOpportunityHistory).values({
        opportunityId: created.id,
        toStageId: stageId,
        action: 'created',
        description: 'Oportunidade de teste criada',
        createdBy: userId,
      });
    }

    res.json({ success: true, message: `${testOpportunities.length} oportunidades de teste criadas` });
  } catch (error: any) {
    logger.error({ err: error }, 'Erro ao criar dados de teste:');
    res.status(500).json({ error: 'Erro ao criar dados de teste' });
  }
});

export default router;
