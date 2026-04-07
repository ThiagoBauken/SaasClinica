/**
 * ClinicRepository.ts
 * Handles clinic-level configuration operations:
 * users, professionals, rooms, procedures, working hours, automations,
 * clinic settings, and automation logs.
 * Extracted from DatabaseStorage to improve maintainability.
 */

import {
  users,
  rooms,
  procedures,
  automations,
  companies,
  type User,
  type InsertUser,
  type Room,
  type Procedure,
  type Automation,
} from "@shared/schema";
import { db } from "../db";
import { eq, and, count } from "drizzle-orm";
import { notDeleted } from "../lib/soft-delete";
import { logger } from "../logger";

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function getUser(id: number, _companyId?: number): Promise<User | undefined> {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), notDeleted(users.deletedAt)));
  return user || undefined;
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.username, username), notDeleted(users.deletedAt)));
  return user || undefined;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), notDeleted(users.deletedAt)));
  return user || undefined;
}

export async function getUserByGoogleId(googleId: string): Promise<User | undefined> {
  if (!googleId) return undefined;
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.googleId, googleId), notDeleted(users.deletedAt)));
  return user || undefined;
}

export async function createUser(insertUser: InsertUser): Promise<User> {
  const [user] = await db
    .insert(users)
    .values({ ...insertUser, active: true, createdAt: new Date(), updatedAt: new Date() })
    .returning();
  return user;
}

export async function updateUser(id: number, data: Partial<User>, _companyId?: number): Promise<User> {
  const [updatedUser] = await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();

  if (!updatedUser) {
    throw new Error("User not found");
  }
  return updatedUser;
}

// ---------------------------------------------------------------------------
// Professionals
// ---------------------------------------------------------------------------

export async function getProfessionals(companyId: number): Promise<User[]> {
  return db
    .select()
    .from(users)
    .where(
      and(
        eq(users.companyId, companyId),
        eq(users.role, "dentist"),
        notDeleted(users.deletedAt)
      )
    );
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export async function getRooms(companyId: number): Promise<Room[]> {
  return db
    .select()
    .from(rooms)
    .where(and(eq(rooms.companyId, companyId), eq(rooms.active, true)))
    .orderBy(rooms.name);
}

export async function getRoom(id: number, companyId: number): Promise<Room | undefined> {
  const [room] = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.id, id), eq(rooms.companyId, companyId)));
  return room || undefined;
}

export async function createRoom(data: any, companyId: number): Promise<Room> {
  const [room] = await db
    .insert(rooms)
    .values({ ...data, companyId, createdAt: new Date(), updatedAt: new Date() })
    .returning();
  return room;
}

export async function updateRoom(id: number, data: any, companyId: number): Promise<Room> {
  const [room] = await db
    .update(rooms)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(rooms.id, id), eq(rooms.companyId, companyId)))
    .returning();

  if (!room) {
    throw new Error('Room not found or access denied');
  }
  return room;
}

export async function deleteRoom(id: number, companyId: number): Promise<boolean> {
  const [room] = await db
    .update(rooms)
    .set({ active: false, updatedAt: new Date() })
    .where(and(eq(rooms.id, id), eq(rooms.companyId, companyId)))
    .returning();
  return !!room;
}

// ---------------------------------------------------------------------------
// Procedures
// ---------------------------------------------------------------------------

export async function getProcedures(companyId: number): Promise<Procedure[]> {
  return db
    .select()
    .from(procedures)
    .where(and(eq(procedures.companyId, companyId), eq(procedures.active, true)))
    .orderBy(procedures.name);
}

export async function getProcedure(id: number, companyId: number): Promise<Procedure | undefined> {
  const [procedure] = await db
    .select()
    .from(procedures)
    .where(and(eq(procedures.id, id), eq(procedures.companyId, companyId)));
  return procedure || undefined;
}

export async function createProcedure(data: any, companyId: number): Promise<Procedure> {
  const [procedure] = await db
    .insert(procedures)
    .values({ ...data, companyId, createdAt: new Date(), updatedAt: new Date() })
    .returning();
  return procedure;
}

export async function updateProcedure(id: number, data: any, companyId: number): Promise<Procedure> {
  const [procedure] = await db
    .update(procedures)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(procedures.id, id), eq(procedures.companyId, companyId)))
    .returning();

  if (!procedure) {
    throw new Error('Procedure not found or access denied');
  }
  return procedure;
}

export async function deleteProcedure(id: number, companyId: number): Promise<boolean> {
  const [procedure] = await db
    .update(procedures)
    .set({ active: false, updatedAt: new Date() })
    .where(and(eq(procedures.id, id), eq(procedures.companyId, companyId)))
    .returning();
  return !!procedure;
}

// ---------------------------------------------------------------------------
// Automations
// ---------------------------------------------------------------------------

export async function getAutomations(companyId: number): Promise<Automation[]> {
  return db.select().from(automations).where(eq(automations.companyId, companyId));
}

export async function createAutomation(data: any, companyId: number): Promise<Automation> {
  const [automation] = await db
    .insert(automations)
    .values({ ...data, companyId, createdAt: new Date(), updatedAt: new Date() })
    .returning();
  return automation;
}

export async function updateAutomation(id: number, data: any, companyId: number): Promise<Automation> {
  try {
    const [existingAutomation] = await db
      .select()
      .from(automations)
      .where(eq(automations.id, id));

    if (!existingAutomation) {
      throw new Error("Automation not found");
    }

    const updateData = { ...data };
    if (data.updatedAt === undefined) {
      updateData.updatedAt = new Date();
    }

    const [updatedAutomation] = await db
      .update(automations)
      .set(updateData)
      .where(eq(automations.id, id))
      .returning();

    return updatedAutomation;
  } catch (error) {
    logger.error({ err: error }, 'Error updating automation:');
    throw error;
  }
}

export async function deleteAutomation(id: number, _companyId: number): Promise<void> {
  await db.delete(automations).where(eq(automations.id, id));
}

// ---------------------------------------------------------------------------
// Clinic Settings
// ---------------------------------------------------------------------------

export async function getClinicSettings(companyId: number): Promise<any | undefined> {
  const { clinicSettings } = await import('@shared/schema');
  const [settings] = await db
    .select()
    .from(clinicSettings)
    .where(eq(clinicSettings.companyId, companyId));
  return settings || undefined;
}

export async function createClinicSettings(data: any): Promise<any> {
  const { clinicSettings } = await import('@shared/schema');
  const [settings] = await db
    .insert(clinicSettings)
    .values({ ...data, createdAt: new Date(), updatedAt: new Date() })
    .returning();
  return settings;
}

export async function updateClinicSettings(companyId: number, data: any): Promise<any> {
  const { clinicSettings } = await import('@shared/schema');
  const [settings] = await db
    .update(clinicSettings)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(clinicSettings.companyId, companyId))
    .returning();

  if (!settings) throw new Error('Clinic settings not found');
  return settings;
}

// ---------------------------------------------------------------------------
// Automation Logs
// ---------------------------------------------------------------------------

export async function createAutomationLog(data: any): Promise<any> {
  const { automationLogs } = await import('@shared/schema');
  const [log] = await db
    .insert(automationLogs)
    .values({ ...data, createdAt: new Date(), updatedAt: new Date() })
    .returning();
  return log;
}

// ---------------------------------------------------------------------------
// Seed helper (preserved from DatabaseStorage for bootstrap use)
// ---------------------------------------------------------------------------

export async function seedInitialData(): Promise<void> {
  const userCount = await db.select({ count: count() }).from(users);

  if (userCount[0].count === 0) {
    const existingCompanies = await db.select({ count: count() }).from(companies);

    if (existingCompanies[0].count === 0) {
      await db.insert(companies).values({
        id: 1,
        name: "Clínica Odontológica Demo",
        cnpj: "00.000.000/0000-00",
        phone: "(00) 0000-0000",
        email: "contato@clinicademo.com",
        address: "Rua Demo, 123",
        city: "São Paulo",
        state: "SP",
        zipCode: "00000-000",
        active: true,
      });
      logger.info('Empresa padrão criada com ID 1');
    }

    await createUser({
      username: "admin",
      password: "$2b$10$I9HhVdTaRHpxPR3ykU5XvuxO1rDZw8yU4VOVUZ0KdJkD9TaFYWjwq.salt",
      fullName: "Administrador",
      email: "admin@dentalclinic.com",
      role: "admin",
      speciality: "Administração",
      companyId: 1,
    });

    await createUser({
      username: "dentista",
      password: "$2b$10$I9HhVdTaRHpxPR3ykU5XvuxO1rDZw8yU4VOVUZ0KdJkD9TaFYWjwq.salt",
      fullName: "Dr. Ana Silva",
      email: "ana.silva@dentalclinic.com",
      role: "dentist",
      speciality: "Clínico Geral",
      companyId: 1,
    });

    await db.insert(rooms).values([
      { name: "Sala 01", description: "Consultório principal", active: true, companyId: 1 },
      { name: "Sala 02", description: "Consultório secundário", active: true, companyId: 1 },
      { name: "Sala 03", description: "Sala de procedimentos", active: true, companyId: 1 },
    ]);

    await db.insert(procedures).values([
      { name: "Consulta inicial", duration: 30, price: 12000, description: "Avaliação inicial", color: "#1976d2", companyId: 1 },
      { name: "Limpeza dental", duration: 60, price: 15000, description: "Profilaxia completa", color: "#43a047", companyId: 1 },
      { name: "Tratamento de canal", duration: 90, price: 30000, description: "Endodontia", color: "#ff5722", companyId: 1 },
      { name: "Restauração", duration: 60, price: 18000, description: "Restauração em resina", color: "#9c27b0", companyId: 1 },
      { name: "Extração", duration: 60, price: 20000, description: "Extração simples", color: "#f44336", companyId: 1 },
    ]);
  }
}
