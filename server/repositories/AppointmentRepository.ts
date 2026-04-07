/**
 * AppointmentRepository.ts
 * Handles all appointment-related database operations.
 * Extracted from DatabaseStorage to improve maintainability.
 */

import {
  appointments,
  patients,
  users,
  rooms,
  procedures,
  appointmentProcedures,
} from "@shared/schema";
import { db } from "../db";
import { eq, and, gte, lte, lt, sql, inArray } from "drizzle-orm";
import { notDeleted } from "../lib/soft-delete";
import { logger } from "../logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AppointmentFilters {
  startDate?: string;
  endDate?: string;
  professionalId?: number;
  patientId?: number;
  status?: string;
}

// ---------------------------------------------------------------------------
// Repository functions
// ---------------------------------------------------------------------------

export async function getAppointments(
  companyId: number,
  filters?: AppointmentFilters
): Promise<any[]> {
  try {
    // PERFORMANCE: Single JOIN query instead of N+1
    const conditions: any[] = [
      eq(appointments.companyId, companyId),
      notDeleted(appointments.deletedAt),
    ];
    if (filters?.startDate) conditions.push(gte(appointments.startTime, new Date(filters.startDate)));
    if (filters?.endDate) conditions.push(lt(appointments.startTime, new Date(filters.endDate)));
    if (filters?.professionalId !== undefined)
      conditions.push(eq(appointments.professionalId, filters.professionalId));
    if (filters?.patientId !== undefined)
      conditions.push(eq(appointments.patientId, filters.patientId));
    if (filters?.status) conditions.push(eq(appointments.status, filters.status));

    const rows = await db
      .select({
        appointment: appointments,
        patientId: patients.id,
        patientFullName: patients.fullName,
        patientPhone: patients.phone,
        professionalId: users.id,
        professionalFullName: users.fullName,
        professionalSpeciality: users.speciality,
        roomId: rooms.id,
        roomName: rooms.name,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(users, eq(appointments.professionalId, users.id))
      .leftJoin(rooms, eq(appointments.roomId, rooms.id))
      .where(and(...conditions))
      .orderBy(appointments.startTime);

    // Batch-load procedures for all appointments in 2 queries
    const appointmentIds = rows.map((r: any) => r.appointment.id);
    const proceduresByAppointment = new Map<number, any[]>();

    if (appointmentIds.length > 0) {
      const apRows = await db
        .select({
          appointmentId: appointmentProcedures.appointmentId,
          procedureId: appointmentProcedures.procedureId,
          quantity: appointmentProcedures.quantity,
          price: appointmentProcedures.price,
          notes: appointmentProcedures.notes,
          procedureName: procedures.name,
          procedureDuration: procedures.duration,
          procedurePrice: procedures.price,
          procedureDescription: procedures.description,
          procedureColor: procedures.color,
          procedureCategory: procedures.category,
        })
        .from(appointmentProcedures)
        .leftJoin(procedures, eq(appointmentProcedures.procedureId, procedures.id))
        .where(inArray(appointmentProcedures.appointmentId, appointmentIds));

      for (const row of apRows) {
        const list = proceduresByAppointment.get(row.appointmentId) || [];
        list.push({
          id: row.procedureId,
          name: row.procedureName,
          duration: row.procedureDuration,
          price: row.procedurePrice,
          description: row.procedureDescription,
          color: row.procedureColor,
          category: row.procedureCategory,
          quantity: row.quantity,
          appointmentPrice: row.price,
          notes: row.notes,
        });
        proceduresByAppointment.set(row.appointmentId, list);
      }
    }

    return rows.map((row: any) => ({
      ...row.appointment,
      patient: row.patientId
        ? { id: row.patientId, fullName: row.patientFullName, phone: row.patientPhone }
        : undefined,
      professional: row.professionalId
        ? { id: row.professionalId, fullName: row.professionalFullName, speciality: row.professionalSpeciality }
        : undefined,
      room: row.roomId ? { id: row.roomId, name: row.roomName } : undefined,
      procedures: proceduresByAppointment.get(row.appointment.id) || [],
    }));
  } catch (error) {
    logger.error({ err: error }, 'Database error in getAppointments:');
    return [];
  }
}

export async function getAppointment(id: number, companyId?: number): Promise<any | undefined> {
  const conditions: any[] = [eq(appointments.id, id), notDeleted(appointments.deletedAt)];
  if (companyId !== undefined) {
    conditions.push(eq(appointments.companyId, companyId));
  }

  const [row] = await db
    .select({
      appointment: appointments,
      patientId: patients.id,
      patientFullName: patients.fullName,
      patientPhone: patients.phone,
      professionalId: users.id,
      professionalFullName: users.fullName,
      professionalSpeciality: users.speciality,
      roomId: rooms.id,
      roomName: rooms.name,
    })
    .from(appointments)
    .leftJoin(patients, eq(appointments.patientId, patients.id))
    .leftJoin(users, eq(appointments.professionalId, users.id))
    .leftJoin(rooms, eq(appointments.roomId, rooms.id))
    .where(and(...conditions));

  if (!row) return undefined;

  const procedureRows = await db
    .select({
      procedureId: appointmentProcedures.procedureId,
      quantity: appointmentProcedures.quantity,
      price: appointmentProcedures.price,
      notes: appointmentProcedures.notes,
      procedureName: procedures.name,
      procedureDuration: procedures.duration,
      procedurePrice: procedures.price,
      procedureDescription: procedures.description,
      procedureColor: procedures.color,
      procedureCategory: procedures.category,
    })
    .from(appointmentProcedures)
    .leftJoin(procedures, eq(appointmentProcedures.procedureId, procedures.id))
    .where(eq(appointmentProcedures.appointmentId, id));

  return {
    ...row.appointment,
    patient: row.patientId
      ? { id: row.patientId, fullName: row.patientFullName, phone: row.patientPhone }
      : undefined,
    professional: row.professionalId
      ? { id: row.professionalId, fullName: row.professionalFullName, speciality: row.professionalSpeciality }
      : undefined,
    room: row.roomId ? { id: row.roomId, name: row.roomName } : undefined,
    procedures: procedureRows.map((p: any) => ({
      id: p.procedureId,
      name: p.procedureName,
      duration: p.procedureDuration,
      price: p.procedurePrice,
      description: p.procedureDescription,
      color: p.procedureColor,
      category: p.procedureCategory,
      quantity: p.quantity,
      appointmentPrice: p.price,
      notes: p.notes,
    })),
  };
}

export async function createAppointment(appointmentData: any, companyId: number): Promise<any> {
  const procs = appointmentData.procedures || [];
  delete appointmentData.procedures;

  const [appointment] = await db
    .insert(appointments)
    .values({
      ...appointmentData,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  for (const proc of procs) {
    await db.insert(appointmentProcedures).values({
      appointmentId: appointment.id,
      procedureId: proc.id,
      quantity: 1,
      price: proc.price,
      notes: "",
    });
  }

  return getAppointment(appointment.id);
}

export async function updateAppointment(id: number, data: any, companyId?: number): Promise<any> {
  const procs = data.procedures;
  delete data.procedures;

  const [updatedAppointment] = await db
    .update(appointments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(appointments.id, id))
    .returning();

  if (!updatedAppointment) {
    throw new Error("Appointment not found");
  }

  if (procs) {
    await db
      .delete(appointmentProcedures)
      .where(eq(appointmentProcedures.appointmentId, id));

    for (const proc of procs) {
      await db.insert(appointmentProcedures).values({
        appointmentId: id,
        procedureId: proc.id,
        quantity: 1,
        price: proc.price,
        notes: "",
      });
    }
  }

  return getAppointment(id);
}

export async function deleteAppointment(id: number, companyId: number): Promise<boolean> {
  const appointment = await getAppointment(id, companyId);
  if (!appointment) {
    throw new Error("Appointment not found or does not belong to this company");
  }

  await db
    .delete(appointmentProcedures)
    .where(eq(appointmentProcedures.appointmentId, id));

  const result = await db
    .delete(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.companyId, companyId)))
    .returning();

  return result.length > 0;
}

export async function checkAppointmentConflicts(
  companyId: number,
  startTime: Date,
  endTime: Date,
  options: {
    professionalId?: number;
    roomId?: number;
    excludeAppointmentId?: number;
  } = {}
): Promise<any[]> {
  const { professionalId, roomId, excludeAppointmentId } = options;

  const conditions: any[] = [
    eq(appointments.companyId, companyId),
    notDeleted(appointments.deletedAt),
    and(lte(appointments.startTime, endTime), gte(appointments.endTime, startTime)),
  ];

  if (professionalId) conditions.push(eq(appointments.professionalId, professionalId));
  if (roomId) conditions.push(eq(appointments.roomId, roomId));
  if (excludeAppointmentId) {
    conditions.push(sql`${appointments.id} != ${excludeAppointmentId}`);
  }

  const conflicts = await db
    .select({
      id: appointments.id,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      professionalId: appointments.professionalId,
      roomId: appointments.roomId,
      patientId: appointments.patientId,
    })
    .from(appointments)
    .where(and(...conditions));

  type ConflictRow = (typeof conflicts)[0];
  const enrichedConflicts = await Promise.all(
    conflicts.map(async (conflict: ConflictRow) => {
      const patient = conflict.patientId
        ? await db
            .select({ fullName: patients.fullName })
            .from(patients)
            .where(and(eq(patients.id, conflict.patientId), notDeleted(patients.deletedAt)))
            .limit(1)
        : [];

      const professional = conflict.professionalId
        ? await db
            .select({ fullName: users.fullName })
            .from(users)
            .where(and(eq(users.id, conflict.professionalId), notDeleted(users.deletedAt)))
            .limit(1)
        : [];

      const room = conflict.roomId
        ? await db
            .select({ name: rooms.name })
            .from(rooms)
            .where(eq(rooms.id, conflict.roomId))
            .limit(1)
        : [];

      return {
        ...conflict,
        patientName: patient[0]?.fullName || 'Unknown',
        professionalName: professional[0]?.fullName || null,
        roomName: room[0]?.name || null,
        conflictType: professionalId ? 'professional' : 'room',
      };
    })
  );

  return enrichedConflicts;
}
