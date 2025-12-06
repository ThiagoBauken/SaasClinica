import { Request, Response } from "express";
import { db } from "./db";
import { odontogramEntries } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";

/**
 * Odontogram APIs - Endpoints para odontograma
 */

/**
 * GET /api/patients/:patientId/odontogram
 * Retorna dados do odontograma do paciente
 */
export async function getPatientOdontogram(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const companyId = user.companyId;
    const { patientId } = req.params;

    const odontogramData = await db
      .select()
      .from(odontogramEntries)
      .where(
        and(
          eq(odontogramEntries.patientId, parseInt(patientId)),
          eq(odontogramEntries.companyId, companyId)
        )
      );

    res.json(odontogramData);
  } catch (error) {
    console.error("Error fetching odontogram:", error);
    res.status(500).json({ error: "Failed to fetch odontogram" });
  }
}

/**
 * POST /api/patients/:patientId/odontogram
 * Criar ou atualizar entrada do odontograma
 */
export async function saveToothStatus(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const companyId = user.companyId;
    const { patientId } = req.params;
    const { toothId, faceId, status, notes } = req.body;

    // Verificar se já existe entrada para este dente/face
    const existing = await db
      .select()
      .from(odontogramEntries)
      .where(
        and(
          eq(odontogramEntries.patientId, parseInt(patientId)),
          eq(odontogramEntries.companyId, companyId),
          eq(odontogramEntries.toothId, toothId),
          faceId ? eq(odontogramEntries.faceId, faceId) : isNull(odontogramEntries.faceId)
        )
      )
      .limit(1);

    let result;

    if (existing.length > 0) {
      // Atualizar entrada existente
      [result] = await db
        .update(odontogramEntries)
        .set({
          status,
          notes,
          updatedAt: new Date(),
        })
        .where(eq(odontogramEntries.id, existing[0].id))
        .returning();
    } else {
      // Criar nova entrada
      [result] = await db
        .insert(odontogramEntries)
        .values({
          patientId: parseInt(patientId),
          companyId,
          toothId,
          faceId: faceId || null,
          status,
          notes,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
    }

    res.json(result);
  } catch (error) {
    console.error("Error saving tooth status:", error);
    res.status(500).json({ error: "Failed to save tooth status" });
  }
}

/**
 * DELETE /api/patients/:patientId/odontogram/:entryId
 * Deletar entrada do odontograma
 */
export async function deleteToothStatus(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const companyId = user.companyId;
    const { patientId, entryId } = req.params;

    const [deleted] = await db
      .delete(odontogramEntries)
      .where(
        and(
          eq(odontogramEntries.id, parseInt(entryId)),
          eq(odontogramEntries.patientId, parseInt(patientId)),
          eq(odontogramEntries.companyId, companyId)
        )
      )
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Entry not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting tooth status:", error);
    res.status(500).json({ error: "Failed to delete tooth status" });
  }
}
