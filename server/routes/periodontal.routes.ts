import express from 'express';
import { db } from '../db';
import { periodontalChart } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

const router = express.Router();

// Middleware simples de autenticação (assumindo que req.user existe)
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

/**
 * GET /api/v1/patients/:patientId/periodontal-charts
 * Listar todos os periodontogramas de um paciente
 */
router.get('/patients/:patientId/periodontal-charts', requireAuth, async (req, res) => {
  try {
    const { patientId } = req.params;
    const user = req.user as any;
    const companyId = user.companyId;

    const charts = await db
      .select()
      .from(periodontalChart)
      .where(
        and(
          eq(periodontalChart.patientId, parseInt(patientId)),
          eq(periodontalChart.companyId, companyId)
        )
      )
      .orderBy(desc(periodontalChart.chartDate));

    res.json(charts);
  } catch (error) {
    console.error('Error fetching periodontal charts:', error);
    res.status(500).json({ error: 'Failed to fetch periodontal charts' });
  }
});

/**
 * GET /api/v1/patients/:patientId/periodontal-charts/:chartId
 * Buscar um periodontograma específico
 */
router.get('/patients/:patientId/periodontal-charts/:chartId', requireAuth, async (req, res) => {
  try {
    const { patientId, chartId } = req.params;
    const user = req.user as any;
    const companyId = user.companyId;

    const [chart] = await db
      .select()
      .from(periodontalChart)
      .where(
        and(
          eq(periodontalChart.id, parseInt(chartId)),
          eq(periodontalChart.patientId, parseInt(patientId)),
          eq(periodontalChart.companyId, companyId)
        )
      );

    if (!chart) {
      return res.status(404).json({ error: 'Periodontal chart not found' });
    }

    res.json(chart);
  } catch (error) {
    console.error('Error fetching periodontal chart:', error);
    res.status(500).json({ error: 'Failed to fetch periodontal chart' });
  }
});

/**
 * GET /api/v1/patients/:patientId/periodontal-charts-latest
 * Buscar o periodontograma mais recente de um paciente
 */
router.get('/patients/:patientId/periodontal-charts-latest', requireAuth, async (req, res) => {
  try {
    const { patientId } = req.params;
    const user = req.user as any;
    const companyId = user.companyId;

    const [latestChart] = await db
      .select()
      .from(periodontalChart)
      .where(
        and(
          eq(periodontalChart.patientId, parseInt(patientId)),
          eq(periodontalChart.companyId, companyId)
        )
      )
      .orderBy(desc(periodontalChart.chartDate))
      .limit(1);

    if (!latestChart) {
      return res.status(404).json({ error: 'No periodontal charts found for this patient' });
    }

    res.json(latestChart);
  } catch (error) {
    console.error('Error fetching latest periodontal chart:', error);
    res.status(500).json({ error: 'Failed to fetch latest periodontal chart' });
  }
});

/**
 * POST /api/v1/patients/:patientId/periodontal-charts
 * Criar novo periodontograma
 */
router.post('/patients/:patientId/periodontal-charts', requireAuth, async (req, res) => {
  try {
    const { patientId } = req.params;
    const user = req.user as any;
    const companyId = user.companyId;
    const professionalId = user.id;

    const {
      teethData,
      generalNotes,
      diagnosis,
      treatmentPlan,
      plaqueIndex,
      bleedingIndex,
      chartDate
    } = req.body;

    // Validação básica
    if (!teethData || !Array.isArray(teethData)) {
      return res.status(400).json({
        error: 'teethData is required and must be an array'
      });
    }

    // Validar estrutura dos dados dos dentes
    for (const tooth of teethData) {
      if (!tooth.toothNumber || !tooth.probingDepth || !tooth.gingivalRecession) {
        return res.status(400).json({
          error: 'Each tooth must have toothNumber, probingDepth, and gingivalRecession'
        });
      }
    }

    const [newChart] = await db
      .insert(periodontalChart)
      .values({
        companyId,
        patientId: parseInt(patientId),
        professionalId,
        teethData,
        generalNotes: generalNotes || null,
        diagnosis: diagnosis || null,
        treatmentPlan: treatmentPlan || null,
        plaqueIndex: plaqueIndex ? plaqueIndex.toString() : null,
        bleedingIndex: bleedingIndex ? bleedingIndex.toString() : null,
        chartDate: chartDate ? new Date(chartDate) : new Date(),
      })
      .returning();

    res.status(201).json(newChart);
  } catch (error) {
    console.error('Error creating periodontal chart:', error);
    res.status(500).json({ error: 'Failed to create periodontal chart' });
  }
});

/**
 * PATCH /api/v1/patients/:patientId/periodontal-charts/:chartId
 * Atualizar periodontograma existente
 */
router.patch('/patients/:patientId/periodontal-charts/:chartId', requireAuth, async (req, res) => {
  try {
    const { patientId, chartId } = req.params;
    const user = req.user as any;
    const companyId = user.companyId;

    const {
      teethData,
      generalNotes,
      diagnosis,
      treatmentPlan,
      plaqueIndex,
      bleedingIndex,
    } = req.body;

    const updateData: any = {};

    if (teethData !== undefined) {
      // Validar estrutura se fornecida
      if (!Array.isArray(teethData)) {
        return res.status(400).json({ error: 'teethData must be an array' });
      }
      updateData.teethData = teethData;
    }

    if (generalNotes !== undefined) updateData.generalNotes = generalNotes;
    if (diagnosis !== undefined) updateData.diagnosis = diagnosis;
    if (treatmentPlan !== undefined) updateData.treatmentPlan = treatmentPlan;
    if (plaqueIndex !== undefined) updateData.plaqueIndex = plaqueIndex.toString();
    if (bleedingIndex !== undefined) updateData.bleedingIndex = bleedingIndex.toString();

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const [updatedChart] = await db
      .update(periodontalChart)
      .set(updateData)
      .where(
        and(
          eq(periodontalChart.id, parseInt(chartId)),
          eq(periodontalChart.patientId, parseInt(patientId)),
          eq(periodontalChart.companyId, companyId)
        )
      )
      .returning();

    if (!updatedChart) {
      return res.status(404).json({ error: 'Periodontal chart not found' });
    }

    res.json(updatedChart);
  } catch (error) {
    console.error('Error updating periodontal chart:', error);
    res.status(500).json({ error: 'Failed to update periodontal chart' });
  }
});

/**
 * DELETE /api/v1/patients/:patientId/periodontal-charts/:chartId
 * Deletar periodontograma
 */
router.delete('/patients/:patientId/periodontal-charts/:chartId', requireAuth, async (req, res) => {
  try {
    const { patientId, chartId } = req.params;
    const user = req.user as any;
    const companyId = user.companyId;

    const [deletedChart] = await db
      .delete(periodontalChart)
      .where(
        and(
          eq(periodontalChart.id, parseInt(chartId)),
          eq(periodontalChart.patientId, parseInt(patientId)),
          eq(periodontalChart.companyId, companyId)
        )
      )
      .returning();

    if (!deletedChart) {
      return res.status(404).json({ error: 'Periodontal chart not found' });
    }

    res.json({
      message: 'Periodontal chart deleted successfully',
      deletedId: deletedChart.id
    });
  } catch (error) {
    console.error('Error deleting periodontal chart:', error);
    res.status(500).json({ error: 'Failed to delete periodontal chart' });
  }
});

export default router;
