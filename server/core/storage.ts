// Core system storage - only authentication and company management
import { users, companies, modules, companyModules, type SelectUser, type InsertUser, type SelectCompany, type InsertCompany, type SelectModule, type InsertModule } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { db, pool } from "../db";
import { eq, and } from "drizzle-orm";

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);

export interface ICoreStorage {
  // User authentication
  getUser(id: number): Promise<SelectUser | undefined>;
  getUserByUsername(username: string): Promise<SelectUser | undefined>;
  getUserByEmail(email: string): Promise<SelectUser | undefined>;
  getUserByGoogleId(googleId: string): Promise<SelectUser | undefined>;
  createUser(user: InsertUser): Promise<SelectUser>;
  updateUser(id: number, data: Partial<SelectUser>): Promise<SelectUser>;
  
  // Company management
  getCompanies(): Promise<SelectCompany[]>;
  getCompany(id: number): Promise<SelectCompany | undefined>;
  createCompany(company: InsertCompany): Promise<SelectCompany>;
  updateCompany(id: number, data: Partial<SelectCompany>): Promise<SelectCompany>;
  
  // Module management
  getModules(): Promise<SelectModule[]>;
  getModule(id: number): Promise<SelectModule | undefined>;
  createModule(module: InsertModule): Promise<SelectModule>;
  updateModule(id: number, data: Partial<SelectModule>): Promise<SelectModule>;
  
  // Company-Module relationship
  getCompanyModules(companyId: number): Promise<any[]>;
  enableModuleForCompany(companyId: number, moduleId: number): Promise<any>;
  disableModuleForCompany(companyId: number, moduleId: number): Promise<any>;
}

export class CoreStorage implements ICoreStorage {
  // User methods
  async getUser(id: number): Promise<SelectUser | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<SelectUser | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<SelectUser | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async getUserByGoogleId(googleId: string): Promise<SelectUser | undefined> {
    const result = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<SelectUser> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async updateUser(id: number, data: Partial<SelectUser>): Promise<SelectUser> {
    const result = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return result[0];
  }

  // Company methods
  async getCompanies(): Promise<SelectCompany[]> {
    return await db.select().from(companies);
  }

  async getCompany(id: number): Promise<SelectCompany | undefined> {
    const result = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
    return result[0];
  }

  async createCompany(company: InsertCompany): Promise<SelectCompany> {
    const result = await db.insert(companies).values(company).returning();
    return result[0];
  }

  async updateCompany(id: number, data: Partial<SelectCompany>): Promise<SelectCompany> {
    const result = await db.update(companies).set(data).where(eq(companies.id, id)).returning();
    return result[0];
  }

  // Module methods
  async getModules(): Promise<SelectModule[]> {
    return await db.select().from(modules);
  }

  async getModule(id: number): Promise<SelectModule | undefined> {
    const result = await db.select().from(modules).where(eq(modules.id, id)).limit(1);
    return result[0];
  }

  async createModule(module: InsertModule): Promise<SelectModule> {
    const result = await db.insert(modules).values(module).returning();
    return result[0];
  }

  async updateModule(id: number, data: Partial<SelectModule>): Promise<SelectModule> {
    const result = await db.update(modules).set(data).where(eq(modules.id, id)).returning();
    return result[0];
  }

  // Company-Module methods
  async getCompanyModules(companyId: number): Promise<any[]> {
    return await db
      .select()
      .from(companyModules)
      .leftJoin(modules, eq(companyModules.moduleId, modules.id))
      .where(eq(companyModules.companyId, companyId));
  }

  async enableModuleForCompany(companyId: number, moduleId: number): Promise<any> {
    const result = await db.insert(companyModules).values({
      companyId,
      moduleId,
      isEnabled: true,
    }).returning();
    return result[0];
  }

  async disableModuleForCompany(companyId: number, moduleId: number): Promise<any> {
    const result = await db
      .update(companyModules)
      .set({ isEnabled: false })
      .where(and(eq(companyModules.companyId, companyId), eq(companyModules.moduleId, moduleId)))
      .returning();
    return result[0];
  }

  getSessionStore() {
    if (process.env.NODE_ENV === "production") {
      return new PostgresSessionStore({ pool });
    }
    return new MemoryStore({ checkPeriod: 86400000 });
  }
}

export const coreStorage = new CoreStorage();