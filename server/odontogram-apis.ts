import { Request, Response } from "express";
import { db } from "./db";
import { odontogramEntries, users, procedures } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { notDeleted } from "./lib/soft-delete";

import { logger } from './logger';
/**
 * Odontogram APIs - Endpoints para odontograma com histórico completo
 */

/**
 * GET /api/patients/:patientId/odontogram
 * Retorna estado atual do odontograma (última entrada por dente/face)
 */
export async function getPatientOdontogram(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const companyId = user.companyId;
    const { patientId } = req.params;

    // Get all entries, ordered by newest first
    const allEntries = await db
      .select()
      .from(odontogramEntries)
      .where(
        and(
          eq(odontogramEntries.patientId, parseInt(patientId)),
          eq(odontogramEntries.companyId, companyId),
          notDeleted(odontogramEntries.deletedAt)
        )
      )
      .orderBy(desc(odontogramEntries.createdAt));

    // Build current state: latest entry per tooth+face combination
    const currentState = new Map<string, typeof allEntries[0]>();
    for (const entry of allEntries) {
      const key = `${entry.toothId}_${entry.faceId || 'whole'}`;
      if (!currentState.has(key)) {
        currentState.set(key, entry);
      }
    }

    res.json(Array.from(currentState.values()));
  } catch (error) {
    logger.error({ err: error }, 'Error fetching odontogram:');
    res.status(500).json({ error: "Failed to fetch odontogram" });
  }
}

/**
 * POST /api/patients/:patientId/odontogram
 * Criar nova entrada no odontograma (sempre insere, mantém histórico)
 */
export async function saveToothStatus(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const companyId = user.companyId;
    const userId = user.id;
    const { patientId } = req.params;
    const { toothId, faceId, status, notes, color, procedureId } = req.body;

    if (!toothId || !status) {
      return res.status(400).json({ error: "toothId and status are required" });
    }

    // Always insert new entry (preserves history)
    const [result] = await db
      .insert(odontogramEntries)
      .values({
        patientId: parseInt(patientId),
        companyId,
        toothId,
        faceId: faceId || null,
        status,
        color: color || null,
        notes: notes || null,
        procedureId: procedureId || null,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Error saving tooth status:');
    res.status(500).json({ error: "Failed to save tooth status" });
  }
}

/**
 * GET /api/patients/:patientId/odontogram/tooth/:toothId/history
 * Retorna histórico completo de um dente específico
 */
export async function getToothHistory(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const companyId = user.companyId;
    const { patientId, toothId } = req.params;

    const history = await db
      .select({
        id: odontogramEntries.id,
        toothId: odontogramEntries.toothId,
        faceId: odontogramEntries.faceId,
        status: odontogramEntries.status,
        color: odontogramEntries.color,
        notes: odontogramEntries.notes,
        procedureId: odontogramEntries.procedureId,
        createdAt: odontogramEntries.createdAt,
        createdByName: users.fullName,
        procedureName: procedures.name,
      })
      .from(odontogramEntries)
      .leftJoin(users, eq(odontogramEntries.createdBy, users.id))
      .leftJoin(procedures, eq(odontogramEntries.procedureId, procedures.id))
      .where(
        and(
          eq(odontogramEntries.patientId, parseInt(patientId)),
          eq(odontogramEntries.companyId, companyId),
          eq(odontogramEntries.toothId, toothId),
          notDeleted(odontogramEntries.deletedAt)
        )
      )
      .orderBy(desc(odontogramEntries.createdAt));

    res.json(history);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching tooth history:');
    res.status(500).json({ error: "Failed to fetch tooth history" });
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
    logger.error({ err: error }, 'Error deleting tooth status:');
    res.status(500).json({ error: "Failed to delete tooth status" });
  }
}
