import { Request, Response } from "express";
import { db } from "./db";
import { patientRecords, users } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * Patient Records APIs - Endpoints para prontuários
 */

/**
 * GET /api/patients/:patientId/records
 * Retorna registros do prontuário do paciente
 */
export async function getPatientRecords(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const companyId = user.companyId;
    const { patientId } = req.params;

    const records = await db
      .select({
        id: patientRecords.id,
        patientId: patientRecords.patientId,
        recordType: patientRecords.recordType,
        content: patientRecords.content,
        createdBy: patientRecords.createdBy,
        createdAt: patientRecords.createdAt,
        createdByName: users.fullName,
      })
      .from(patientRecords)
      .leftJoin(users, eq(patientRecords.createdBy, users.id))
      .where(
        and(
          eq(patientRecords.patientId, parseInt(patientId)),
          eq(patientRecords.companyId, companyId)
        )
      )
      .orderBy(desc(patientRecords.createdAt));

    res.json(records);
  } catch (error) {
    console.error("Error fetching patient records:", error);
    res.status(500).json({ error: "Failed to fetch patient records" });
  }
}

/**
 * POST /api/patients/:patientId/records
 * Criar novo registro no prontuário
 */
export async function createPatientRecord(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const companyId = user.companyId;
    const { patientId } = req.params;
    const recordData = req.body;

    const [newRecord] = await db
      .insert(patientRecords)
      .values({
        patientId: parseInt(patientId),
        companyId,
        recordType: recordData.recordType,
        content: recordData.content,
        createdBy: user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    res.status(201).json(newRecord);
  } catch (error) {
    console.error("Error creating patient record:", error);
    res.status(500).json({ error: "Failed to create patient record" });
  }
}

/**
 * PUT /api/patients/:patientId/records/:recordId
 * Atualizar registro do prontuário
 */
export async function updatePatientRecord(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const companyId = user.companyId;
    const { patientId, recordId } = req.params;
    const recordData = req.body;

    const [updatedRecord] = await db
      .update(patientRecords)
      .set({
        content: recordData.content,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(patientRecords.id, parseInt(recordId)),
          eq(patientRecords.patientId, parseInt(patientId)),
          eq(patientRecords.companyId, companyId)
        )
      )
      .returning();

    if (!updatedRecord) {
      return res.status(404).json({ error: "Record not found" });
    }

    res.json(updatedRecord);
  } catch (error) {
    console.error("Error updating patient record:", error);
    res.status(500).json({ error: "Failed to update patient record" });
  }
}

/**
 * DELETE /api/patients/:patientId/records/:recordId
 * Deletar registro do prontuário
 */
export async function deletePatientRecord(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const companyId = user.companyId;
    const { patientId, recordId } = req.params;

    const [deletedRecord] = await db
      .delete(patientRecords)
      .where(
        and(
          eq(patientRecords.id, parseInt(recordId)),
          eq(patientRecords.patientId, parseInt(patientId)),
          eq(patientRecords.companyId, companyId)
        )
      )
      .returning();

    if (!deletedRecord) {
      return res.status(404).json({ error: "Record not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting patient record:", error);
    res.status(500).json({ error: "Failed to delete patient record" });
  }
}
