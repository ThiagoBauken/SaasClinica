/**
 * Rotas do CRM - Funil de Vendas
 *
 * Gerencia oportunidades de venda, etapas do funil,
 * tarefas de follow-up e histórico de movimentações
 */

import { Router } from 'express';
import { db } from '../db';
import { eq, and, desc, asc, sql, isNull, gte, lte } from 'drizzle-orm';
import {
  salesFunnelStages,
  salesOpportunities,
  salesOpportunityHistory,
  salesTasks,
  patients,
  users,
  insertSalesFunnelStageSchema,
  insertSalesOpportunitySchema,
  insertSalesTaskSchema,
} from '@shared/schema';
import { requireAuth } from '../middleware/auth';

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
    const companyId = req.user?.companyId!;

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
    console.error('Erro ao listar etapas:', error);
    res.status(500).json({ error: 'Erro ao listar etapas do funil' });
  }
});

/**
 * POST /api/crm/stages
 * Cria nova etapa do funil
 */
router.post('/stages', requireAuth, async (req, res) => {
  try {
    const companyId = req.user?.companyId!;
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
    console.error('Erro ao criar etapa:', error);
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
    const companyId = req.user?.companyId!;
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
    console.error('Erro ao atualizar etapa:', error);
    res.status(500).json({ error: 'Erro ao atualizar etapa' });
  }
});

/**
 * PUT /api/crm/stages/reorder
 * Reordena etapas do funil
 */
router.put('/stages/reorder', requireAuth, async (req, res) => {
  try {
    const companyId = req.user?.companyId!;
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
    console.error('Erro ao reordenar etapas:', error);
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
    const companyId = req.user?.companyId!;
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
      .leftJoin(patients, eq(salesOpportunities.patientId, patients.id))
      .leftJoin(users, eq(salesOpportunities.assignedTo, users.id))
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
    console.error('Erro ao listar oportunidades:', error);
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
    const companyId = req.user?.companyId!;

    const [result] = await db
      .select({
        opportunity: salesOpportunities,
        patient: patients,
        assignedUser: users,
        stage: salesFunnelStages,
      })
      .from(salesOpportunities)
      .leftJoin(patients, eq(salesOpportunities.patientId, patients.id))
      .leftJoin(users, eq(salesOpportunities.assignedTo, users.id))
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
    console.error('Erro ao buscar oportunidade:', error);
    res.status(500).json({ error: 'Erro ao buscar oportunidade' });
  }
});

/**
 * POST /api/crm/opportunities
 * Cria nova oportunidade
 */
router.post('/opportunities', requireAuth, async (req, res) => {
  try {
    const companyId = req.user?.companyId!;
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
    console.error('Erro ao criar oportunidade:', error);
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
    const companyId = req.user?.companyId!;
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
    console.error('Erro ao atualizar oportunidade:', error);
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
    const companyId = req.user?.companyId!;
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
    console.error('Erro ao mover oportunidade:', error);
    res.status(500).json({ error: 'Erro ao mover oportunidade' });
  }
});

// ==================== TAREFAS / FOLLOW-UPS ====================

/**
 * GET /api/crm/tasks
 * Lista tarefas pendentes
 */
router.get('/tasks', requireAuth, async (req, res) => {
  try {
    const companyId = req.user?.companyId!;
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
      .leftJoin(patients, eq(salesTasks.patientId, patients.id))
      .where(and(...whereConditions))
      .orderBy(asc(salesTasks.dueDate));

    res.json(tasks);
  } catch (error: any) {
    console.error('Erro ao listar tarefas:', error);
    res.status(500).json({ error: 'Erro ao listar tarefas' });
  }
});

/**
 * POST /api/crm/tasks
 * Cria nova tarefa
 */
router.post('/tasks', requireAuth, async (req, res) => {
  try {
    const companyId = req.user?.companyId!;
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
    console.error('Erro ao criar tarefa:', error);
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
    console.error('Erro ao completar tarefa:', error);
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
    const companyId = req.user?.companyId!;
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
    console.error('Erro ao buscar analytics:', error);
    res.status(500).json({ error: 'Erro ao buscar analytics' });
  }
});

export default router;
