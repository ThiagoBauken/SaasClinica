/**
 * Rotas para Alertas de Risco Clínico
 *
 * Gerencia tipos de alertas (alergia, cardíaco, diabetes, etc.)
 * e alertas específicos por paciente
 */

import { Router } from 'express';
import { db } from '../db';
import { eq, and, isNull, or } from 'drizzle-orm';
import {
  riskAlertTypes,
  patientRiskAlerts,
  patients,
  insertRiskAlertTypeSchema,
  insertPatientRiskAlertSchema
} from '@shared/schema';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Types
interface AlertWithType {
  alert: typeof patientRiskAlerts.$inferSelect;
  alertType: typeof riskAlertTypes.$inferSelect;
}

// ==================== TIPOS DE ALERTA ====================

/**
 * GET /api/risk-alerts/types
 * Lista todos os tipos de alerta (globais + da empresa)
 */
router.get('/types', requireAuth, async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    const types = await db
      .select()
      .from(riskAlertTypes)
      .where(
        and(
          eq(riskAlertTypes.isActive, true),
          or(
            isNull(riskAlertTypes.companyId), // Globais
            eq(riskAlertTypes.companyId, companyId!) // Da empresa
          )
        )
      )
      .orderBy(riskAlertTypes.severity);

    res.json(types);
  } catch (error: any) {
    console.error('Erro ao listar tipos de alerta:', error);
    res.status(500).json({ error: 'Erro ao listar tipos de alerta' });
  }
});

/**
 * POST /api/risk-alerts/types
 * Cria novo tipo de alerta customizado
 */
router.post('/types', requireAuth, async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const data = insertRiskAlertTypeSchema.parse(req.body);

    const [newType] = await db
      .insert(riskAlertTypes)
      .values({
        ...data,
        companyId,
      })
      .returning();

    res.status(201).json(newType);
  } catch (error: any) {
    console.error('Erro ao criar tipo de alerta:', error);
    res.status(500).json({ error: 'Erro ao criar tipo de alerta' });
  }
});

/**
 * PUT /api/risk-alerts/types/:id
 * Atualiza tipo de alerta
 */
router.put('/types/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.companyId;
    const data = req.body;

    // Só pode editar alertas da própria empresa
    const [existing] = await db
      .select()
      .from(riskAlertTypes)
      .where(
        and(
          eq(riskAlertTypes.id, parseInt(id)),
          eq(riskAlertTypes.companyId, companyId!)
        )
      );

    if (!existing) {
      return res.status(404).json({ error: 'Tipo de alerta não encontrado ou sem permissão' });
    }

    const [updated] = await db
      .update(riskAlertTypes)
      .set(data)
      .where(eq(riskAlertTypes.id, parseInt(id)))
      .returning();

    res.json(updated);
  } catch (error: any) {
    console.error('Erro ao atualizar tipo de alerta:', error);
    res.status(500).json({ error: 'Erro ao atualizar tipo de alerta' });
  }
});

// ==================== ALERTAS DE PACIENTES ====================

/**
 * GET /api/risk-alerts/patient/:patientId
 * Lista alertas ativos de um paciente
 */
router.get('/patient/:patientId', requireAuth, async (req, res) => {
  try {
    const { patientId } = req.params;
    const companyId = req.user?.companyId;

    // Verificar se paciente pertence à empresa
    const [patient] = await db
      .select()
      .from(patients)
      .where(
        and(
          eq(patients.id, parseInt(patientId)),
          eq(patients.companyId, companyId!)
        )
      );

    if (!patient) {
      return res.status(404).json({ error: 'Paciente não encontrado' });
    }

    const alerts = await db
      .select({
        alert: patientRiskAlerts,
        alertType: riskAlertTypes,
      })
      .from(patientRiskAlerts)
      .innerJoin(riskAlertTypes, eq(patientRiskAlerts.alertTypeId, riskAlertTypes.id))
      .where(
        and(
          eq(patientRiskAlerts.patientId, parseInt(patientId)),
          eq(patientRiskAlerts.isActive, true)
        )
      )
      .orderBy(riskAlertTypes.severity);

    // Formatar resposta
    const formattedAlerts = alerts.map(({ alert, alertType }: AlertWithType) => ({
      id: alert.id,
      code: alertType.code,
      name: alertType.name,
      color: alertType.color,
      icon: alertType.icon,
      severity: alertType.severity,
      details: alert.details,
      notes: alert.notes,
      clinicalWarning: alertType.clinicalWarning,
      detectedAt: alert.detectedAt,
    }));

    res.json(formattedAlerts);
  } catch (error: any) {
    console.error('Erro ao listar alertas do paciente:', error);
    res.status(500).json({ error: 'Erro ao listar alertas do paciente' });
  }
});

/**
 * POST /api/risk-alerts/patient/:patientId
 * Adiciona alerta a um paciente
 */
router.post('/patient/:patientId', requireAuth, async (req, res) => {
  try {
    const { patientId } = req.params;
    const companyId = req.user?.companyId;
    const userId = req.user?.id;
    const { alertTypeId, details, notes } = req.body;

    // Verificar se paciente pertence à empresa
    const [patient] = await db
      .select()
      .from(patients)
      .where(
        and(
          eq(patients.id, parseInt(patientId)),
          eq(patients.companyId, companyId!)
        )
      );

    if (!patient) {
      return res.status(404).json({ error: 'Paciente não encontrado' });
    }

    // Verificar se já existe alerta ativo desse tipo
    const [existing] = await db
      .select()
      .from(patientRiskAlerts)
      .where(
        and(
          eq(patientRiskAlerts.patientId, parseInt(patientId)),
          eq(patientRiskAlerts.alertTypeId, alertTypeId),
          eq(patientRiskAlerts.isActive, true)
        )
      );

    if (existing) {
      return res.status(400).json({ error: 'Paciente já possui este alerta ativo' });
    }

    const [newAlert] = await db
      .insert(patientRiskAlerts)
      .values({
        patientId: parseInt(patientId),
        alertTypeId,
        details,
        notes,
        createdBy: userId,
      })
      .returning();

    res.status(201).json(newAlert);
  } catch (error: any) {
    console.error('Erro ao adicionar alerta:', error);
    res.status(500).json({ error: 'Erro ao adicionar alerta' });
  }
});

/**
 * PUT /api/risk-alerts/:alertId
 * Atualiza alerta de paciente
 */
router.put('/:alertId', requireAuth, async (req, res) => {
  try {
    const { alertId } = req.params;
    const { details, notes, isActive } = req.body;

    const [updated] = await db
      .update(patientRiskAlerts)
      .set({
        details,
        notes,
        isActive,
        resolvedAt: isActive === false ? new Date() : null,
      })
      .where(eq(patientRiskAlerts.id, parseInt(alertId)))
      .returning();

    res.json(updated);
  } catch (error: any) {
    console.error('Erro ao atualizar alerta:', error);
    res.status(500).json({ error: 'Erro ao atualizar alerta' });
  }
});

/**
 * DELETE /api/risk-alerts/:alertId
 * Remove (desativa) alerta de paciente
 */
router.delete('/:alertId', requireAuth, async (req, res) => {
  try {
    const { alertId } = req.params;

    const [updated] = await db
      .update(patientRiskAlerts)
      .set({
        isActive: false,
        resolvedAt: new Date(),
      })
      .where(eq(patientRiskAlerts.id, parseInt(alertId)))
      .returning();

    res.json({ success: true, alert: updated });
  } catch (error: any) {
    console.error('Erro ao remover alerta:', error);
    res.status(500).json({ error: 'Erro ao remover alerta' });
  }
});

/**
 * POST /api/risk-alerts/auto-detect/:patientId
 * Auto-detecta alertas baseado nos campos de saúde do paciente
 */
router.post('/auto-detect/:patientId', requireAuth, async (req, res) => {
  try {
    const { patientId } = req.params;
    const companyId = req.user?.companyId;
    const userId = req.user?.id;

    // Buscar paciente
    const [patient] = await db
      .select()
      .from(patients)
      .where(
        and(
          eq(patients.id, parseInt(patientId)),
          eq(patients.companyId, companyId!)
        )
      );

    if (!patient) {
      return res.status(404).json({ error: 'Paciente não encontrado' });
    }

    // Buscar tipos de alerta
    const alertTypes = await db
      .select()
      .from(riskAlertTypes)
      .where(eq(riskAlertTypes.isActive, true));

    type AlertType = typeof riskAlertTypes.$inferSelect;
    const alertTypeMap = new Map<string, AlertType>(alertTypes.map((t: AlertType) => [t.code, t]));
    const detectedAlerts: any[] = [];

    // Detectar alergias
    if (patient.allergies && patient.allergies.trim()) {
      const allergyType = alertTypeMap.get('allergy');
      if (allergyType) {
        detectedAlerts.push({
          alertTypeId: allergyType.id,
          details: patient.allergies,
          code: 'allergy',
        });
      }
    }

    // Detectar medicamentos (anticoagulantes, etc.)
    if (patient.medications && patient.medications.trim()) {
      const medsLower = patient.medications.toLowerCase();

      // Anticoagulantes
      if (medsLower.includes('warfarin') || medsLower.includes('marevan') ||
          medsLower.includes('aas') || medsLower.includes('aspirina') ||
          medsLower.includes('xarelto') || medsLower.includes('eliquis') ||
          medsLower.includes('pradaxa') || medsLower.includes('heparina')) {
        const anticoagType = alertTypeMap.get('anticoagulant');
        if (anticoagType) {
          detectedAlerts.push({
            alertTypeId: anticoagType.id,
            details: patient.medications,
            code: 'anticoagulant',
          });
        }
      }

      // Bifosfonatos (risco de osteonecrose)
      if (medsLower.includes('alendronato') || medsLower.includes('fosamax') ||
          medsLower.includes('risedronato') || medsLower.includes('zometa') ||
          medsLower.includes('bifosfonato')) {
        const bisphoType = alertTypeMap.get('bisphosphonate');
        if (bisphoType) {
          detectedAlerts.push({
            alertTypeId: bisphoType.id,
            details: patient.medications,
            code: 'bisphosphonate',
          });
        }
      }
    }

    // Detectar doenças crônicas
    if (patient.chronicDiseases && patient.chronicDiseases.trim()) {
      const diseasesLower = patient.chronicDiseases.toLowerCase();

      // Cardiopatia / Hipertensão
      if (diseasesLower.includes('cardia') || diseasesLower.includes('coração') ||
          diseasesLower.includes('hipertens') || diseasesLower.includes('pressão alta') ||
          diseasesLower.includes('infarto') || diseasesLower.includes('arritmia')) {
        const cardiacType = alertTypeMap.get('cardiac');
        if (cardiacType) {
          detectedAlerts.push({
            alertTypeId: cardiacType.id,
            details: patient.chronicDiseases,
            code: 'cardiac',
          });
        }
      }

      // Diabetes
      if (diseasesLower.includes('diabet')) {
        const diabetesType = alertTypeMap.get('diabetes');
        if (diabetesType) {
          detectedAlerts.push({
            alertTypeId: diabetesType.id,
            details: patient.chronicDiseases,
            code: 'diabetes',
          });
        }
      }

      // Imunossupressão
      if (diseasesLower.includes('hiv') || diseasesLower.includes('aids') ||
          diseasesLower.includes('imunossupr') || diseasesLower.includes('transplant') ||
          diseasesLower.includes('quimioterapia') || diseasesLower.includes('cancer') ||
          diseasesLower.includes('câncer')) {
        const immunoType = alertTypeMap.get('immunosuppressed');
        if (immunoType) {
          detectedAlerts.push({
            alertTypeId: immunoType.id,
            details: patient.chronicDiseases,
            code: 'immunosuppressed',
          });
        }
      }
    }

    // Inserir alertas detectados (se não existirem)
    const inserted: any[] = [];
    for (const alert of detectedAlerts) {
      // Verificar se já existe
      const [existing] = await db
        .select()
        .from(patientRiskAlerts)
        .where(
          and(
            eq(patientRiskAlerts.patientId, parseInt(patientId)),
            eq(patientRiskAlerts.alertTypeId, alert.alertTypeId),
            eq(patientRiskAlerts.isActive, true)
          )
        );

      if (!existing) {
        const [newAlert] = await db
          .insert(patientRiskAlerts)
          .values({
            patientId: parseInt(patientId),
            alertTypeId: alert.alertTypeId,
            details: alert.details,
            notes: 'Detectado automaticamente',
            createdBy: userId,
          })
          .returning();
        inserted.push({ ...newAlert, code: alert.code });
      }
    }

    res.json({
      detected: detectedAlerts.length,
      inserted: inserted.length,
      alerts: inserted,
    });
  } catch (error: any) {
    console.error('Erro na auto-detecção de alertas:', error);
    res.status(500).json({ error: 'Erro na auto-detecção de alertas' });
  }
});

export default router;
