/**
 * ClinicalRepository.ts
 * Handles all clinical record operations:
 * patient records, odontogram, anamnesis, exams, treatment plans,
 * treatment evolution, and prescriptions.
 * Extracted from DatabaseStorage to improve maintainability.
 */

import {
  patientRecords,
  odontogramEntries,
  anamnesis,
  anamnesisVersions,
  patientExams,
  detailedTreatmentPlans,
  treatmentEvolution,
  prescriptions,
  patients,
  type PatientRecord,
  type OdontogramEntry,
  type Anamnesis,
  type AnamnesisVersion,
  type PatientExam,
  type DetailedTreatmentPlan,
  type TreatmentEvolution,
  type Prescription,
} from "@shared/schema";
import { db } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";
import { notDeleted } from "../lib/soft-delete";
import { logger } from "../logger";

// ---------------------------------------------------------------------------
// Patient Records
// ---------------------------------------------------------------------------

export async function getPatientRecords(patientId: number): Promise<PatientRecord[]> {
  return db
    .select()
    .from(patientRecords)
    .where(and(eq(patientRecords.patientId, patientId), notDeleted(patientRecords.deletedAt)));
}

export async function createPatientRecord(data: any): Promise<PatientRecord> {
  const [record] = await db
    .insert(patientRecords)
    .values({ ...data, createdAt: new Date() })
    .returning();
  return record;
}

// ---------------------------------------------------------------------------
// Odontogram
// ---------------------------------------------------------------------------

export async function getOdontogramEntries(patientId: number): Promise<OdontogramEntry[]> {
  return db
    .select()
    .from(odontogramEntries)
    .where(
      and(eq(odontogramEntries.patientId, patientId), notDeleted(odontogramEntries.deletedAt))
    );
}

export async function createOdontogramEntry(data: any): Promise<OdontogramEntry> {
  const [entry] = await db
    .insert(odontogramEntries)
    .values({ ...data, createdAt: new Date(), updatedAt: new Date() })
    .returning();
  return entry;
}

// ---------------------------------------------------------------------------
// Anamnesis
// ---------------------------------------------------------------------------

export async function getPatientAnamnesis(
  patientId: number,
  companyId: number
): Promise<Anamnesis | undefined> {
  try {
    const [result] = await db
      .select()
      .from(anamnesis)
      .innerJoin(patients, eq(anamnesis.patientId, patients.id))
      .where(
        and(
          eq(anamnesis.patientId, patientId),
          eq(patients.companyId, companyId),
          notDeleted(anamnesis.deletedAt),
          notDeleted(patients.deletedAt)
        )
      )
      .limit(1);

    return result?.anamnesis;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao buscar anamnese:');
    return undefined;
  }
}

export async function createPatientAnamnesis(data: any): Promise<Anamnesis> {
  try {
    const [result] = await db.insert(anamnesis).values(data).returning();
    return result;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao criar anamnese:');
    throw error;
  }
}

/**
 * Fields that are internal bookkeeping and should not be treated as
 * "clinical data changes" when computing the diff between two snapshots.
 */
const NON_CLINICAL_FIELDS = new Set([
  'id', 'company_id', 'companyId',
  'created_at', 'createdAt',
  'updated_at', 'updatedAt',
  'deleted_at', 'deletedAt',
  'current_version', 'currentVersion',
  'last_modified_by', 'lastModifiedBy',
  'last_modified_reason', 'lastModifiedReason',
]);

/**
 * Return the list of top-level keys whose value changed between `prev` and
 * `next`. Uses JSON serialisation so nested objects are compared by value.
 */
function diffFields(prev: Record<string, unknown>, next: Record<string, unknown>): string[] {
  const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const changed: string[] = [];
  for (const key of allKeys) {
    if (NON_CLINICAL_FIELDS.has(key)) continue;
    if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) {
      changed.push(key);
    }
  }
  return changed;
}

export async function updatePatientAnamnesis(
  id: number,
  data: any,
  companyId: number,
  options?: {
    changedBy?: number;
    changeReason?: string;
    ipAddress?: string;
  }
): Promise<Anamnesis> {
  try {
    // 1. Fetch the current row before making any changes
    const [currentRow] = await db
      .select()
      .from(anamnesis)
      .where(
        and(
          eq(anamnesis.id, id),
          sql`EXISTS (SELECT 1 FROM ${patients} WHERE ${patients.id} = ${anamnesis.patientId} AND ${patients.companyId} = ${companyId})`
        )
      )
      .limit(1);

    if (!currentRow) {
      throw new Error(`Anamnesis ${id} not found or access denied`);
    }

    const currentVersion = currentRow.currentVersion ?? 1;
    const changedFields = diffFields(
      currentRow as unknown as Record<string, unknown>,
      data as Record<string, unknown>
    );

    // 2. Only snapshot + increment when something clinical actually changed
    if (changedFields.length > 0) {
      await db.insert(anamnesisVersions).values({
        companyId,
        anamnesisId: id,
        patientId: currentRow.patientId,
        versionNumber: currentVersion,
        snapshot: currentRow as unknown as Record<string, unknown>,
        changedFields,
        changedBy: options?.changedBy ?? null,
        changeReason: options?.changeReason ?? null,
        ipAddress: options?.ipAddress ?? null,
        changedAt: new Date(),
      });
    }

    // 3. Apply the update, bumping currentVersion when there were changes
    const updatePayload: any = {
      ...data,
      updatedAt: new Date(),
    };

    if (changedFields.length > 0) {
      updatePayload.currentVersion = currentVersion + 1;
      if (options?.changedBy !== undefined) {
        updatePayload.lastModifiedBy = options.changedBy;
      }
      if (options?.changeReason !== undefined) {
        updatePayload.lastModifiedReason = options.changeReason;
      }
    }

    const [result] = await db
      .update(anamnesis)
      .set(updatePayload)
      .where(
        and(
          eq(anamnesis.id, id),
          sql`EXISTS (SELECT 1 FROM ${patients} WHERE ${patients.id} = ${anamnesis.patientId} AND ${patients.companyId} = ${companyId})`
        )
      )
      .returning();

    return result;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao atualizar anamnese:');
    throw error;
  }
}

/**
 * Retrieve the full version history for an anamnesis record.
 * Results are sorted newest-first and include the name of the user who
 * made the change when available.
 */
export async function getAnamnesisVersionHistory(
  anamnesisId: number,
  companyId: number
): Promise<AnamnesisVersion[]> {
  try {
    const result = await db.$client.query(
      `SELECT av.*, u.full_name AS changed_by_name
       FROM anamnesis_versions av
       LEFT JOIN users u ON av.changed_by = u.id
       WHERE av.company_id = $1 AND av.anamnesis_id = $2
       ORDER BY av.version_number DESC`,
      [companyId, anamnesisId]
    );
    return result.rows as unknown as AnamnesisVersion[];
  } catch (error) {
    logger.error({ err: error }, 'Erro ao buscar histórico de versões da anamnese:');
    throw error;
  }
}

/**
 * Retrieve a single version snapshot by version number.
 */
export async function getAnamnesisVersion(
  anamnesisId: number,
  versionNumber: number,
  companyId: number
): Promise<(AnamnesisVersion & { changed_by_name: string | null }) | undefined> {
  try {
    const result = await db.$client.query(
      `SELECT av.*, u.full_name AS changed_by_name
       FROM anamnesis_versions av
       LEFT JOIN users u ON av.changed_by = u.id
       WHERE av.company_id = $1 AND av.anamnesis_id = $2 AND av.version_number = $3`,
      [companyId, anamnesisId, versionNumber]
    );
    return result.rows[0] as (AnamnesisVersion & { changed_by_name: string | null }) | undefined;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao buscar versão da anamnese:');
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Patient Exams
// ---------------------------------------------------------------------------

export async function getPatientExams(
  patientId: number,
  companyId: number
): Promise<PatientExam[]> {
  try {
    const result = await db
      .select()
      .from(patientExams)
      .innerJoin(patients, eq(patientExams.patientId, patients.id))
      .where(
        and(
          eq(patientExams.patientId, patientId),
          eq(patients.companyId, companyId),
          notDeleted(patientExams.deletedAt),
          notDeleted(patients.deletedAt)
        )
      )
      .orderBy(desc(patientExams.examDate));

    return result.map((r: typeof result[0]) => r.patient_exams);
  } catch (error) {
    logger.error({ err: error }, 'Erro ao buscar exames:');
    return [];
  }
}

export async function createPatientExam(data: any): Promise<PatientExam> {
  try {
    const [result] = await db.insert(patientExams).values(data).returning();
    return result;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao criar exame:');
    throw error;
  }
}

export async function updatePatientExam(
  id: number,
  data: any,
  companyId: number
): Promise<PatientExam> {
  try {
    const [result] = await db
      .update(patientExams)
      .set(data)
      .where(
        and(
          eq(patientExams.id, id),
          sql`EXISTS (SELECT 1 FROM ${patients} WHERE ${patients.id} = ${patientExams.patientId} AND ${patients.companyId} = ${companyId})`
        )
      )
      .returning();
    return result;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao atualizar exame:');
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Treatment Plans
// ---------------------------------------------------------------------------

export async function getPatientTreatmentPlans(
  patientId: number,
  companyId: number
): Promise<DetailedTreatmentPlan[]> {
  try {
    const result = await db
      .select()
      .from(detailedTreatmentPlans)
      .innerJoin(patients, eq(detailedTreatmentPlans.patientId, patients.id))
      .where(
        and(
          eq(detailedTreatmentPlans.patientId, patientId),
          eq(patients.companyId, companyId),
          notDeleted(detailedTreatmentPlans.deletedAt),
          notDeleted(patients.deletedAt)
        )
      )
      .orderBy(desc(detailedTreatmentPlans.createdAt));

    return result.map((r: typeof result[0]) => r.detailed_treatment_plans);
  } catch (error) {
    logger.error({ err: error }, 'Erro ao buscar planos de tratamento:');
    return [];
  }
}

export async function createPatientTreatmentPlan(data: any): Promise<DetailedTreatmentPlan> {
  try {
    const [result] = await db.insert(detailedTreatmentPlans).values(data).returning();
    return result;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao criar plano de tratamento:');
    throw error;
  }
}

export async function updatePatientTreatmentPlan(
  id: number,
  data: any,
  companyId: number
): Promise<DetailedTreatmentPlan> {
  try {
    const [result] = await db
      .update(detailedTreatmentPlans)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(detailedTreatmentPlans.id, id),
          sql`EXISTS (SELECT 1 FROM ${patients} WHERE ${patients.id} = ${detailedTreatmentPlans.patientId} AND ${patients.companyId} = ${companyId})`
        )
      )
      .returning();
    return result;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao atualizar plano de tratamento:');
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Treatment Evolution
// ---------------------------------------------------------------------------

export async function getPatientEvolution(
  patientId: number,
  companyId: number
): Promise<TreatmentEvolution[]> {
  try {
    const result = await db
      .select()
      .from(treatmentEvolution)
      .innerJoin(patients, eq(treatmentEvolution.patientId, patients.id))
      .where(
        and(
          eq(treatmentEvolution.patientId, patientId),
          eq(patients.companyId, companyId),
          notDeleted(treatmentEvolution.deletedAt),
          notDeleted(patients.deletedAt)
        )
      )
      .orderBy(desc(treatmentEvolution.sessionDate));

    type EvolutionRow = { treatment_evolution: TreatmentEvolution; patients: typeof patients.$inferSelect };
    return result.map((r: EvolutionRow) => r.treatment_evolution);
  } catch (error) {
    logger.error({ err: error }, 'Erro ao buscar evolução:');
    return [];
  }
}

export async function createPatientEvolution(data: any): Promise<TreatmentEvolution> {
  try {
    const [result] = await db.insert(treatmentEvolution).values(data).returning();
    return result;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao criar evolução:');
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Prescriptions
// ---------------------------------------------------------------------------

export async function getPatientPrescriptions(
  patientId: number,
  companyId: number
): Promise<Prescription[]> {
  try {
    const result = await db
      .select()
      .from(prescriptions)
      .innerJoin(patients, eq(prescriptions.patientId, patients.id))
      .where(
        and(
          eq(prescriptions.patientId, patientId),
          eq(patients.companyId, companyId),
          notDeleted(prescriptions.deletedAt),
          notDeleted(patients.deletedAt)
        )
      )
      .orderBy(desc(prescriptions.createdAt));

    type PrescriptionRow = { prescriptions: Prescription; patients: typeof patients.$inferSelect };
    return result.map((r: PrescriptionRow) => r.prescriptions);
  } catch (error) {
    logger.error({ err: error }, 'Erro ao buscar receitas:');
    return [];
  }
}

export async function createPatientPrescription(data: any): Promise<Prescription> {
  try {
    const [result] = await db.insert(prescriptions).values(data).returning();
    return result;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao criar receita:');
    throw error;
  }
}

export async function updatePatientPrescription(
  id: number,
  data: any,
  companyId: number
): Promise<Prescription> {
  try {
    const [result] = await db
      .update(prescriptions)
      .set(data)
      .where(
        and(
          eq(prescriptions.id, id),
          sql`EXISTS (SELECT 1 FROM ${patients} WHERE ${patients.id} = ${prescriptions.patientId} AND ${patients.companyId} = ${companyId})`
        )
      )
      .returning();
    return result;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao atualizar receita:');
    throw error;
  }
}
