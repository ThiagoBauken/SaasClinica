/**
 * ProsthesisRepository.ts
 * Handles all prosthesis and laboratory-related database operations.
 * Extracted from DatabaseStorage to improve maintainability.
 */

import {
  prosthesis,
  prosthesisLabels,
  laboratories,
  patients,
  users,
  type Prosthesis,
  type InsertProsthesis,
  type Laboratory,
  type InsertLaboratory,
  type ProsthesisLabel,
  type InsertProsthesisLabel,
} from "@shared/schema";
import { db } from "../db";
import { eq, and, desc } from "drizzle-orm";
import { notDeleted } from "../lib/soft-delete";
import { logger } from "../logger";

// ---------------------------------------------------------------------------
// Prosthesis
// ---------------------------------------------------------------------------

export async function getProsthesis(companyId: number): Promise<any[]> {
  return db
    .select({
      id: prosthesis.id,
      patientId: prosthesis.patientId,
      patientName: patients.fullName,
      professionalId: prosthesis.professionalId,
      professionalName: users.fullName,
      type: prosthesis.type,
      description: prosthesis.description,
      laboratory: prosthesis.laboratory,
      status: prosthesis.status,
      sentDate: prosthesis.sentDate,
      expectedReturnDate: prosthesis.expectedReturnDate,
      returnDate: prosthesis.returnDate,
      observations: prosthesis.observations,
      labels: prosthesis.labels,
      price: prosthesis.price,
      sortOrder: prosthesis.sortOrder,
      createdAt: prosthesis.createdAt,
      updatedAt: prosthesis.updatedAt,
    })
    .from(prosthesis)
    .leftJoin(patients, eq(prosthesis.patientId, patients.id))
    .leftJoin(users, eq(prosthesis.professionalId, users.id))
    .where(and(eq(prosthesis.companyId, companyId), notDeleted(prosthesis.deletedAt)))
    .orderBy(prosthesis.sortOrder, desc(prosthesis.createdAt));
}

export async function getProsthesisById(id: number, companyId: number): Promise<any | undefined> {
  const [result] = await db
    .select({
      id: prosthesis.id,
      patientId: prosthesis.patientId,
      patientName: patients.fullName,
      professionalId: prosthesis.professionalId,
      professionalName: users.fullName,
      type: prosthesis.type,
      description: prosthesis.description,
      laboratory: prosthesis.laboratory,
      status: prosthesis.status,
      sentDate: prosthesis.sentDate,
      expectedReturnDate: prosthesis.expectedReturnDate,
      returnDate: prosthesis.returnDate,
      observations: prosthesis.observations,
      labels: prosthesis.labels,
      price: prosthesis.price,
      cost: prosthesis.cost,
      sortOrder: prosthesis.sortOrder,
      createdAt: prosthesis.createdAt,
      updatedAt: prosthesis.updatedAt,
    })
    .from(prosthesis)
    .leftJoin(patients, eq(prosthesis.patientId, patients.id))
    .leftJoin(users, eq(prosthesis.professionalId, users.id))
    .where(
      and(eq(prosthesis.id, id), eq(prosthesis.companyId, companyId), notDeleted(prosthesis.deletedAt))
    );
  return result;
}

export async function createProsthesis(data: any): Promise<any> {
  try {
    const cleanData = { ...data };
    delete cleanData.patientName;
    delete cleanData.professionalName;
    delete cleanData.id;

    const [result] = await db
      .insert(prosthesis)
      .values({ ...cleanData, createdAt: new Date(), updatedAt: new Date() })
      .returning();

    return result;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao criar prótese:');
    throw new Error(
      `Falha ao criar prótese: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    );
  }
}

export async function updateProsthesis(id: number, data: any, companyId: number): Promise<any> {
  const [result] = await db
    .update(prosthesis)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(prosthesis.id, id), eq(prosthesis.companyId, companyId)))
    .returning();
  return result;
}

export async function deleteProsthesis(id: number, companyId: number): Promise<void> {
  await db
    .delete(prosthesis)
    .where(and(eq(prosthesis.id, id), eq(prosthesis.companyId, companyId)));
}

// ---------------------------------------------------------------------------
// Prosthesis Labels
// ---------------------------------------------------------------------------

export async function getProsthesisLabels(companyId: number): Promise<ProsthesisLabel[]> {
  try {
    return db
      .select()
      .from(prosthesisLabels)
      .where(and(eq(prosthesisLabels.companyId, companyId), eq(prosthesisLabels.active, true)))
      .orderBy(prosthesisLabels.name);
  } catch (error) {
    logger.error({ err: error }, 'Erro ao buscar etiquetas:');
    return [];
  }
}

export async function createProsthesisLabel(data: any): Promise<ProsthesisLabel> {
  try {
    const [result] = await db
      .insert(prosthesisLabels)
      .values({
        companyId: data.companyId,
        name: data.name,
        color: data.color,
        description: data.description,
        active: data.active ?? true,
      })
      .returning();
    return result;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao criar etiqueta:');
    throw error;
  }
}

export async function updateProsthesisLabel(
  id: number,
  companyId: number,
  data: any
): Promise<ProsthesisLabel> {
  try {
    const [result] = await db
      .update(prosthesisLabels)
      .set({
        name: data.name,
        color: data.color,
        description: data.description,
        active: data.active,
        updatedAt: new Date(),
      })
      .where(and(eq(prosthesisLabels.id, id), eq(prosthesisLabels.companyId, companyId)))
      .returning();
    return result;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao atualizar etiqueta:');
    throw error;
  }
}

export async function deleteProsthesisLabel(id: number, companyId: number): Promise<boolean> {
  try {
    await db
      .update(prosthesisLabels)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(prosthesisLabels.id, id), eq(prosthesisLabels.companyId, companyId)));
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao deletar etiqueta:');
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Laboratories
// ---------------------------------------------------------------------------

export async function getLaboratories(companyId: number): Promise<Laboratory[]> {
  return db
    .select()
    .from(laboratories)
    .where(and(eq(laboratories.companyId, companyId), eq(laboratories.active, true)))
    .orderBy(laboratories.name);
}

export async function getLaboratory(id: number, companyId: number): Promise<Laboratory | undefined> {
  const [result] = await db
    .select()
    .from(laboratories)
    .where(and(eq(laboratories.id, id), eq(laboratories.companyId, companyId)));
  return result;
}

export async function createLaboratory(data: any): Promise<Laboratory> {
  const cleanData = { ...data };
  delete cleanData.id;
  delete cleanData.createdAt;
  delete cleanData.updatedAt;

  const [result] = await db
    .insert(laboratories)
    .values({ ...cleanData, active: cleanData.active ?? true, createdAt: new Date(), updatedAt: new Date() })
    .returning();
  return result;
}

export async function updateLaboratory(id: number, data: any, companyId: number): Promise<Laboratory> {
  const cleanData = { ...data };
  delete cleanData.id;
  delete cleanData.companyId;
  delete cleanData.createdAt;
  cleanData.updatedAt = new Date();

  const [result] = await db
    .update(laboratories)
    .set(cleanData)
    .where(and(eq(laboratories.id, id), eq(laboratories.companyId, companyId)))
    .returning();

  if (!result) {
    throw new Error("Laboratory not found");
  }
  return result;
}

export async function deleteLaboratory(id: number, companyId: number): Promise<boolean> {
  const result = await db
    .update(laboratories)
    .set({ active: false, updatedAt: new Date() })
    .where(and(eq(laboratories.id, id), eq(laboratories.companyId, companyId)));
  return (result.rowCount || 0) > 0;
}
