/**
 * CRM Seed/Dev Routes
 *
 * Seed endpoints for pipeline stages and sample test data.
 * Extracted from crm.routes.ts to keep the main file focused on CRUD.
 *
 * Mounted at /api/crm via crm.routes.ts.
 */
import { Router } from 'express';
import { db } from '../db';
import { eq, and, asc } from 'drizzle-orm';
import {
  salesFunnelStages,
  salesOpportunities,
  salesOpportunityHistory,
} from '@shared/schema';
import { requireAuth } from '../middleware/auth';
import { logger } from '../logger';

const router = Router();

/**
 * POST /seed-stages
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
          eq(salesFunnelStages.isActive, true),
        ),
      )
      .orderBy(asc(salesFunnelStages.order));

    res.json({ success: true, stages });
  } catch (error: any) {
    logger.error({ err: error }, 'Erro ao criar etapas padrão:');
    res.status(500).json({ error: 'Erro ao criar etapas padrão' });
  }
});

/**
 * POST /seed-test-data
 * Seeds default stages AND sample opportunities for testing.
 */
router.post('/seed-test-data', requireAuth, async (req, res) => {
  try {
    const companyId = req.user!.companyId;
    const userId = req.user?.id;

    const { seedDefaultStages } = await import('../services/crm-auto-progression');
    await seedDefaultStages(companyId);

    const stages = await db
      .select()
      .from(salesFunnelStages)
      .where(
        and(
          eq(salesFunnelStages.companyId, companyId),
          eq(salesFunnelStages.isActive, true),
        ),
      )
      .orderBy(asc(salesFunnelStages.order));

    if (stages.length === 0) {
      return res.status(500).json({ error: 'Falha ao criar etapas' });
    }

    const existingOpps = await db
      .select({ id: salesOpportunities.id })
      .from(salesOpportunities)
      .where(eq(salesOpportunities.companyId, companyId))
      .limit(1);

    if (existingOpps.length > 0) {
      return res.json({ success: true, message: 'Dados já existem', skipped: true });
    }

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

    const stageByTrigger: Record<string, number> = {};
    for (const stage of stages) {
      if (stage.automationTrigger) {
        stageByTrigger[stage.automationTrigger] = stage.id;
      }
    }
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
