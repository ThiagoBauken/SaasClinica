import { users, type User, type InsertUser, patients, appointments, procedures, rooms, workingHours, holidays, automations, patientRecords, odontogramEntries, appointmentProcedures, prosthesis, laboratories, inventoryCategories, inventoryItems, inventoryTransactions, type Patient, type Appointment, type Procedure, type Room, type WorkingHours, type Holiday, type Automation, type PatientRecord, type OdontogramEntry, type AppointmentProcedure, type Prosthesis, type InsertProsthesis, type Laboratory, type InsertLaboratory, type InventoryCategory, type InventoryItem, type InventoryTransaction, type InsertInventoryCategory, type InsertInventoryItem, type InsertInventoryTransaction } from "@shared/schema";
import { db, pool } from "./db";
import { eq, and, gte, lt, count, sql, desc } from "drizzle-orm";

// Data structure for transaction objects
interface Transaction {
  id: number;
  type: 'revenue' | 'expense';
  date: string;
  category: string;
  description: string;
  amount: number; // in cents
  paymentMethod: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface AppointmentFilters {
  startDate?: string;
  endDate?: string;
  professionalId?: number;
  patientId?: number;
  status?: string;
}

export interface IStorage {
  // Multi-tenant aware methods
  getUser(id: number, companyId?: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<User>, companyId?: number): Promise<User>;
  
  // Patients - tenant-aware
  getPatients(companyId: number): Promise<Patient[]>;
  getPatient(id: number, companyId: number): Promise<Patient | undefined>;
  createPatient(patient: any, companyId: number): Promise<Patient>;
  updatePatient(id: number, data: any, companyId: number): Promise<Patient>;
  
  // Appointments - tenant-aware
  getAppointments(companyId: number, filters?: AppointmentFilters): Promise<any[]>;
  getAppointment(id: number, companyId?: number): Promise<any | undefined>;
  createAppointment(appointment: any, companyId: number): Promise<any>;
  updateAppointment(id: number, data: any, companyId: number): Promise<any>;
  
  // Professionals - tenant-aware
  getProfessionals(companyId: number): Promise<User[]>;

  // Rooms - tenant-aware
  getRooms(companyId: number): Promise<Room[]>;
  
  // Procedures - tenant-aware
  getProcedures(companyId: number): Promise<Procedure[]>;
  
  // Patient records - tenant-aware
  getPatientRecords(patientId: number, companyId: number): Promise<PatientRecord[]>;
  createPatientRecord(record: any, companyId: number): Promise<PatientRecord>;
  
  // Odontogram - tenant-aware
  getOdontogramEntries(patientId: number, companyId: number): Promise<OdontogramEntry[]>;
  createOdontogramEntry(entry: any, companyId: number): Promise<OdontogramEntry>;
  
  // Financial - tenant-aware
  getTransactions(companyId: number): Promise<Transaction[]>;
  createTransaction(transaction: any, companyId: number): Promise<Transaction>;
  
  // Automations - tenant-aware
  getAutomations(companyId: number): Promise<Automation[]>;
  createAutomation(automation: any, companyId: number): Promise<Automation>;
  updateAutomation(id: number, data: any, companyId: number): Promise<Automation>;
  deleteAutomation(id: number, companyId: number): Promise<void>;
  
  // Laboratories - tenant-aware
  getLaboratories(companyId: number): Promise<Laboratory[]>;
  getLaboratory(id: number, companyId: number): Promise<Laboratory | undefined>;
  createLaboratory(laboratory: any): Promise<Laboratory>;
  updateLaboratory(id: number, data: any, companyId: number): Promise<Laboratory>;
  deleteLaboratory(id: number, companyId: number): Promise<boolean>;
  
  // Prosthesis Labels - tenant-aware
  getProsthesisLabels(companyId: number): Promise<any[]>;
  createProsthesisLabel(label: any): Promise<any>;
  updateProsthesisLabel(id: number, companyId: number, data: any): Promise<any>;
  deleteProsthesisLabel(id: number, companyId: number): Promise<boolean>;
  
  // Inventory Management
  getInventoryCategories(): Promise<InventoryCategory[]>;
  getInventoryItems(): Promise<InventoryItem[]>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: number, data: Partial<InventoryItem>): Promise<InventoryItem>;
  updateInventoryStock(id: number, quantity: number, type: 'add' | 'remove'): Promise<InventoryItem>;
  getInventoryTransactions(): Promise<InventoryTransaction[]>;
  
  sessionStore: any;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private patients: Map<number, Patient>;
  private appointments: Map<number, Appointment>;
  private procedures: Map<number, Procedure>;
  private rooms: Map<number, Room>;
  private workingHours: Map<number, WorkingHours>;
  private holidays: Map<number, Holiday>;
  private automations: Map<number, Automation>;
  private patientRecords: Map<number, PatientRecord>;
  private odontogramEntries: Map<number, OdontogramEntry>;
  private appointmentProcedures: Map<number, AppointmentProcedure>;
  private transactions: Map<number, Transaction>;
  
  sessionStore: any;
  userIdCounter: number;
  patientIdCounter: number;
  appointmentIdCounter: number;
  procedureIdCounter: number;
  roomIdCounter: number;
  workingHoursIdCounter: number;
  holidayIdCounter: number;
  automationIdCounter: number;
  patientRecordIdCounter: number;
  odontogramEntryIdCounter: number;
  appointmentProcedureIdCounter: number;
  transactionIdCounter: number;

  constructor() {
    this.users = new Map();
    this.patients = new Map();
    this.appointments = new Map();
    this.procedures = new Map();
    this.rooms = new Map();
    this.workingHours = new Map();
    this.holidays = new Map();
    this.automations = new Map();
    this.patientRecords = new Map();
    this.odontogramEntries = new Map();
    this.appointmentProcedures = new Map();
    this.transactions = new Map();
    
    this.userIdCounter = 1;
    this.patientIdCounter = 1;
    this.appointmentIdCounter = 1;
    this.procedureIdCounter = 1;
    this.roomIdCounter = 1;
    this.workingHoursIdCounter = 1;
    this.holidayIdCounter = 1;
    this.automationIdCounter = 1;
    this.patientRecordIdCounter = 1;
    this.odontogramEntryIdCounter = 1;
    this.appointmentProcedureIdCounter = 1;
    this.transactionIdCounter = 1;
    
    // Remover sessionStore que está causando problemas
    // this.sessionStore = new MemoryStore({
    //   checkPeriod: 86400000, // 24 hours
    // });
    
    // Seed initial data
    this.seedData();
  }

  private seedData() {
    // Create admin user
    this.createUser({
      username: "admin",
      password: "$2b$10$I9HhVdTaRHpxPR3ykU5XvuxO1rDZw8yU4VOVUZ0KdJkD9TaFYWjwq.salt", // password: admin123
      fullName: "Administrador",
      email: "admin@dentalclinic.com",
      role: "admin",
      speciality: "Administração",
      active: true,
      companyId: 3
    });
    
    // Create dentist user
    this.createUser({
      username: "dentista",
      password: "$2b$10$I9HhVdTaRHpxPR3ykU5XvuxO1rDZw8yU4VOVUZ0KdJkD9TaFYWjwq.salt", // password: dentista123
      fullName: "Dr. Ana Silva",
      email: "ana.silva@dentalclinic.com",
      role: "dentist",
      speciality: "Clínico Geral",
      active: true,
      companyId: 3
    });
    
    // Create rooms
    const room1 = this.createRoom({ name: "Sala 01", description: "Consultório principal", active: true });
    const room2 = this.createRoom({ name: "Sala 02", description: "Consultório secundário", active: true });
    const room3 = this.createRoom({ name: "Sala 03", description: "Sala de procedimentos", active: true });
    
    // Create procedures
    const procedure1 = this.createProcedure({ name: "Consulta inicial", duration: 30, price: 12000, description: "Avaliação inicial", color: "#1976d2" });
    const procedure2 = this.createProcedure({ name: "Limpeza dental", duration: 60, price: 15000, description: "Profilaxia completa", color: "#43a047" });
    const procedure3 = this.createProcedure({ name: "Tratamento de canal", duration: 90, price: 30000, description: "Endodontia", color: "#ff5722" });
    const procedure4 = this.createProcedure({ name: "Restauração", duration: 60, price: 18000, description: "Restauração em resina", color: "#9c27b0" });
    const procedure5 = this.createProcedure({ name: "Extração", duration: 60, price: 20000, description: "Extração simples", color: "#f44336" });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }
  
  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.googleId === googleId,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const now = new Date();
    const { speciality, ...userWithoutSpeciality } = insertUser;
    const user: User = { 
      ...userWithoutSpeciality, 
      id, 
      createdAt: now,
      updatedAt: now,
      active: true,
      googleId: insertUser.googleId || null,
      trialEndsAt: insertUser.trialEndsAt || null,
      phone: insertUser.phone || null,
      role: insertUser.role || "user",
      profileImageUrl: insertUser.profileImageUrl || null,
      speciality: speciality || null,
    };
    this.users.set(id, user);
    return user;
  }
  
  async updateUser(id: number, data: Partial<User>): Promise<User> {
    const user = await this.getUser(id);
    if (!user) {
      throw new Error("User not found");
    }
    
    const updatedUser = {
      ...user,
      ...data,
      updatedAt: new Date()
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Patient methods
  async getPatients(companyId: number): Promise<Patient[]> {
    return Array.from(this.patients.values()).filter(patient => patient.companyId === companyId);
  }

  async getPatient(id: number, companyId: number): Promise<Patient | undefined> {
    const patient = this.patients.get(id);
    if (patient && patient.companyId === companyId) {
      return patient;
    }
    return undefined;
  }

  async createPatient(patient: any, companyId: number): Promise<Patient> {
    const id = this.patientIdCounter++;
    const now = new Date();
    const newPatient: Patient = {
      ...patient,
      id,
      createdAt: now
    };
    this.patients.set(id, newPatient);
    return newPatient;
  }

  async updatePatient(id: number, data: any, companyId: number): Promise<Patient> {
    const patient = await this.getPatient(id, companyId);
    if (!patient) {
      throw new Error("Patient not found");
    }
    
    const updatedPatient = {
      ...patient,
      ...data
    };
    
    this.patients.set(id, updatedPatient);
    return updatedPatient;
  }

  // Appointment methods
  async getAppointments(companyId: number, filters?: AppointmentFilters): Promise<any[]> {
    let appointments = Array.from(this.appointments.values());
    
    // Apply filters
    if (filters) {
      if (filters.startDate) {
        appointments = appointments.filter(a => a.startTime >= new Date(filters.startDate!));
      }
      if (filters.endDate) {
        appointments = appointments.filter(a => a.startTime < new Date(filters.endDate!));
      }
      if (filters.professionalId !== undefined) {
        appointments = appointments.filter(a => a.professionalId === filters.professionalId);
      }
      if (filters.patientId !== undefined) {
        appointments = appointments.filter(a => a.patientId === filters.patientId);
      }
      if (filters.status) {
        appointments = appointments.filter(a => a.status === filters.status);
      }
    }
    
    // Enrich with related data
    const enrichedAppointments = await Promise.all(
      appointments.map(async (appointment) => {
        const patient = appointment.patientId ? await this.getPatient(appointment.patientId, companyId) : undefined;
        const professional = appointment.professionalId ? await this.getUser(appointment.professionalId) : undefined;
        const room = appointment.roomId ? await this.getRoom(appointment.roomId) : undefined;
        
        // Get procedures for this appointment
        const appointmentProcedures = Array.from(this.appointmentProcedures.values())
          .filter(ap => ap.appointmentId === appointment.id);
        
        const procedures = await Promise.all(
          appointmentProcedures.map(async (ap) => this.getProcedure(ap.procedureId))
        );
        
        return {
          ...appointment,
          patient: patient ? { 
            id: patient.id,
            fullName: patient.fullName,
            phone: patient.phone 
          } : undefined,
          professional: professional ? { 
            id: professional.id,
            fullName: professional.fullName,
            speciality: professional.speciality 
          } : undefined,
          room: room ? { 
            id: room.id,
            name: room.name 
          } : undefined,
          procedures: procedures.filter(Boolean)
        };
      })
    );
    
    return enrichedAppointments;
  }

  async getAppointment(id: number, companyId: number): Promise<any | undefined> {
    const appointment = this.appointments.get(id);
    if (!appointment) return undefined;
    
    // Filter by company if provided
    if (companyId && appointment.companyId !== companyId) return undefined;
    
    // Enrich with related data
    const patient = appointment.patientId ? await this.getPatient(appointment.patientId, companyId || appointment.companyId) : undefined;
    const professional = appointment.professionalId ? await this.getUser(appointment.professionalId) : undefined;
    const room = appointment.roomId ? await this.getRoom(appointment.roomId) : undefined;
    
    // Get procedures for this appointment
    const appointmentProcedures = Array.from(this.appointmentProcedures.values())
      .filter(ap => ap.appointmentId === appointment.id);
    
    const procedures = await Promise.all(
      appointmentProcedures.map(async (ap) => this.getProcedure(ap.procedureId))
    );
    
    return {
      ...appointment,
      patient: patient ? { 
        id: patient.id,
        fullName: patient.fullName,
        phone: patient.phone 
      } : undefined,
      professional: professional ? { 
        id: professional.id,
        fullName: professional.fullName,
        speciality: professional.speciality 
      } : undefined,
      room: room ? { 
        id: room.id,
        name: room.name 
      } : undefined,
      procedures: procedures.filter(Boolean)
    };
  }

  async createAppointment(appointmentData: any, companyId: number): Promise<any> {
    const id = this.appointmentIdCounter++;
    const now = new Date();
    
    // Extract procedures to create appointment procedures
    const procedures = appointmentData.procedures || [];
    delete appointmentData.procedures;
    
    const appointment: Appointment = {
      ...appointmentData,
      id,
      createdAt: now,
      updatedAt: now
    };
    
    this.appointments.set(id, appointment);
    
    // Create appointment procedures
    for (const proc of procedures) {
      await this.createAppointmentProcedure({
        appointmentId: id,
        procedureId: proc.id,
        quantity: 1,
        price: proc.price,
        notes: ""
      });
    }
    
    return this.getAppointment(id, companyId);
  }

  async updateAppointment(id: number, data: any, companyId: number): Promise<any> {
    const appointment = await this.getAppointment(id, companyId);
    if (!appointment) {
      throw new Error("Appointment not found");
    }
    
    // Extract procedures to update appointment procedures
    const procedures = data.procedures;
    delete data.procedures;
    
    const updatedAppointment = {
      ...appointment,
      ...data,
      updatedAt: new Date()
    };
    
    this.appointments.set(id, updatedAppointment);
    
    // Update appointment procedures if provided
    if (procedures) {
      // Remove existing procedures
      const existingAppointmentProcedures = Array.from(this.appointmentProcedures.values())
        .filter(ap => ap.appointmentId === id);
      
      for (const ap of existingAppointmentProcedures) {
        this.appointmentProcedures.delete(ap.id);
      }
      
      // Add new procedures
      for (const proc of procedures) {
        await this.createAppointmentProcedure({
          appointmentId: id,
          procedureId: proc.id,
          quantity: 1,
          price: proc.price,
          notes: ""
        });
      }
    }
    
    return this.getAppointment(id, companyId);
  }

  // Professional methods
  async getProfessionals(): Promise<User[]> {
    return Array.from(this.users.values()).filter(
      (user) => user.role === "dentist" || user.speciality
    );
  }

  // Room methods
  async getRooms(): Promise<Room[]> {
    return Array.from(this.rooms.values());
  }

  async getRoom(id: number): Promise<Room | undefined> {
    return this.rooms.get(id);
  }

  private createRoom(room: any): Room {
    const id = this.roomIdCounter++;
    const newRoom: Room = {
      ...room,
      id
    };
    this.rooms.set(id, newRoom);
    return newRoom;
  }

  // Procedure methods
  async getProcedures(): Promise<Procedure[]> {
    return Array.from(this.procedures.values());
  }

  async getProcedure(id: number): Promise<Procedure | undefined> {
    return this.procedures.get(id);
  }

  private createProcedure(procedure: any): Procedure {
    const id = this.procedureIdCounter++;
    const newProcedure: Procedure = {
      ...procedure,
      id
    };
    this.procedures.set(id, newProcedure);
    return newProcedure;
  }

  // Appointment procedure methods
  private async createAppointmentProcedure(data: any): Promise<AppointmentProcedure> {
    const id = this.appointmentProcedureIdCounter++;
    const appointmentProcedure: AppointmentProcedure = {
      ...data,
      id
    };
    this.appointmentProcedures.set(id, appointmentProcedure);
    return appointmentProcedure;
  }

  // Patient record methods
  async getPatientRecords(patientId: number): Promise<PatientRecord[]> {
    return Array.from(this.patientRecords.values())
      .filter(record => record.patientId === patientId);
  }

  async createPatientRecord(data: any): Promise<PatientRecord> {
    const id = this.patientRecordIdCounter++;
    const now = new Date();
    const record: PatientRecord = {
      ...data,
      id,
      createdAt: now
    };
    this.patientRecords.set(id, record);
    return record;
  }

  // Odontogram methods
  async getOdontogramEntries(patientId: number): Promise<OdontogramEntry[]> {
    return Array.from(this.odontogramEntries.values())
      .filter(entry => entry.patientId === patientId);
  }

  async createOdontogramEntry(data: any): Promise<OdontogramEntry> {
    const id = this.odontogramEntryIdCounter++;
    const now = new Date();
    const entry: OdontogramEntry = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.odontogramEntries.set(id, entry);
    return entry;
  }

  // Financial methods
  async getTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values());
  }

  async createTransaction(data: any): Promise<Transaction> {
    const id = this.transactionIdCounter++;
    const now = new Date();
    const transaction: Transaction = {
      ...data,
      id,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    this.transactions.set(id, transaction);
    return transaction;
  }

  // Automation methods
  async getAutomations(companyId: number): Promise<Automation[]> {
    return Array.from(this.automations.values()).filter(automation => automation.companyId === companyId);
  }

  async createAutomation(data: any, companyId: number): Promise<Automation> {
    const id = this.automationIdCounter++;
    const now = new Date();
    const automation: Automation = {
      ...data,
      id,
      companyId,
      createdAt: now,
      updatedAt: now
    };
    this.automations.set(id, automation);
    return automation;
  }

  async updateAutomation(id: number, data: any, companyId: number): Promise<Automation> {
    const automation = this.automations.get(id);
    if (!automation || automation.companyId !== companyId) {
      throw new Error("Automation not found");
    }
    
    const now = new Date();
    const updatedAutomation: Automation = {
      ...automation,
      ...data,
      updatedAt: now
    };
    
    this.automations.set(id, updatedAutomation);
    return updatedAutomation;
  }

  async deleteAutomation(id: number, companyId: number): Promise<void> {
    const automation = this.automations.get(id);
    if (!automation || automation.companyId !== companyId) {
      throw new Error("Automation not found");
    }
    
    this.automations.delete(id);
  }
}

export class DatabaseStorage implements IStorage {
  constructor() {
    // Removido sessionStore problemático
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  // Prosthesis methods
  async getProsthesis(companyId: number): Promise<any[]> {
    const results = await db
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
      .where(eq(prosthesis.companyId, companyId))
      .orderBy(prosthesis.sortOrder, desc(prosthesis.createdAt));
    
    return results;
  }

  async createProsthesis(data: any): Promise<any> {
    try {
      // Limpar dados que não devem ser inseridos
      const cleanData = { ...data };
      delete cleanData.patientName;
      delete cleanData.professionalName;
      delete cleanData.id;
      
      const [result] = await db
        .insert(prosthesis)
        .values({
          ...cleanData,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      
      return result;
    } catch (error) {
      console.error('Erro ao criar prótese:', error);
      throw new Error(`Falha ao criar prótese: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  async updateProsthesis(id: number, data: any, companyId: number): Promise<any> {
    const [result] = await db
      .update(prosthesis)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(prosthesis.id, id), eq(prosthesis.companyId, companyId)))
      .returning();
    
    return result;
  }

  async deleteProsthesis(id: number, companyId: number): Promise<void> {
    await db
      .delete(prosthesis)
      .where(and(eq(prosthesis.id, id), eq(prosthesis.companyId, companyId)));
  }

  // Laboratory methods
  async getLaboratories(companyId: number): Promise<Laboratory[]> {
    return db
      .select()
      .from(laboratories)
      .where(and(eq(laboratories.companyId, companyId), eq(laboratories.active, true)))
      .orderBy(laboratories.name);
  }

  async createLaboratory(data: any): Promise<Laboratory> {
    const cleanData = { ...data };
    delete cleanData.id;
    delete cleanData.createdAt;
    delete cleanData.updatedAt;
    
    const [result] = await db
      .insert(laboratories)
      .values(cleanData)
      .returning();
    
    return result;
  }

  async updateLaboratory(id: number, data: any, companyId: number): Promise<Laboratory | null> {
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
    
    return result || null;
  }

  async deleteLaboratory(id: number, companyId: number): Promise<void> {
    await db
      .update(laboratories)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(laboratories.id, id), eq(laboratories.companyId, companyId)));
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }
  
  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    if (!googleId) return undefined;
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return user;
  }
  
  async updateUser(id: number, data: Partial<User>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();
    
    if (!updatedUser) {
      throw new Error("User not found");
    }
    
    return updatedUser;
  }

  // Database Patient methods
  async getPatients(companyId: number): Promise<Patient[]> {
    return db.select().from(patients).where(eq(patients.companyId, companyId));
  }

  async getPatient(id: number, companyId: number): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(
      and(eq(patients.id, id), eq(patients.companyId, companyId))
    );
    return patient || undefined;
  }

  async createPatient(patientData: any, companyId: number): Promise<Patient> {
    const [patient] = await db
      .insert(patients)
      .values({
        ...patientData,
        createdAt: new Date(),
      })
      .returning();
    return patient;
  }

  async updatePatient(id: number, data: any, companyId: number): Promise<Patient> {
    const [updatedPatient] = await db
      .update(patients)
      .set(data)
      .where(and(eq(patients.id, id), eq(patients.companyId, companyId)))
      .returning();
    
    if (!updatedPatient) {
      throw new Error("Patient not found");
    }
    
    return updatedPatient;
  }

  // Appointment methods
  async getAppointments(companyId: number, filters?: AppointmentFilters): Promise<any[]> {
    try {
      // Basic query with company filter
      const appointmentsList = await db.select().from(appointments).where(eq(appointments.companyId, companyId));
    
      // Enrich with related data
    const enrichedAppointments = await Promise.all(
      appointmentsList.map(async (appointment) => {
        // Get patient info
        let patient;
        if (appointment.patientId) {
          const [patientData] = await db
            .select({
              id: patients.id,
              fullName: patients.fullName,
              phone: patients.phone,
            })
            .from(patients)
            .where(eq(patients.id, appointment.patientId));
          patient = patientData;
        }
        
        // Get professional info
        let professional;
        if (appointment.professionalId) {
          const [professionalData] = await db
            .select({
              id: users.id,
              fullName: users.fullName,
              speciality: users.speciality,
            })
            .from(users)
            .where(eq(users.id, appointment.professionalId));
          professional = professionalData;
        }
        
        // Get room info
        let room;
        if (appointment.roomId) {
          const [roomData] = await db
            .select({
              id: rooms.id,
              name: rooms.name,
            })
            .from(rooms)
            .where(eq(rooms.id, appointment.roomId));
          room = roomData;
        }
        
        // Get procedures for this appointment
        const appointmentProceduresList = await db
          .select()
          .from(appointmentProcedures)
          .where(eq(appointmentProcedures.appointmentId, appointment.id));
        
        const proceduresList = await Promise.all(
          appointmentProceduresList.map(async (ap) => {
            const [procedure] = await db
              .select()
              .from(procedures)
              .where(eq(procedures.id, ap.procedureId));
            return procedure;
          })
        );
        
        return {
          ...appointment,
          patient,
          professional,
          room,
          procedures: proceduresList.filter(Boolean),
        };
      })
    );
    
      return enrichedAppointments;
    } catch (error) {
      console.error('Database error in getAppointments:', error);
      return [];
    }
  }

  async getAppointment(id: number): Promise<any | undefined> {
    const [appointment] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, id));
    
    if (!appointment) return undefined;
    
    // Enrich with related data (patient, professional, room, procedures)
    // Get patient info
    let patient;
    if (appointment.patientId) {
      const [patientData] = await db
        .select({
          id: patients.id,
          fullName: patients.fullName,
          phone: patients.phone,
        })
        .from(patients)
        .where(eq(patients.id, appointment.patientId));
      patient = patientData;
    }
    
    // Get professional info
    let professional;
    if (appointment.professionalId) {
      const [professionalData] = await db
        .select({
          id: users.id,
          fullName: users.fullName,
          speciality: users.speciality,
        })
        .from(users)
        .where(eq(users.id, appointment.professionalId));
      professional = professionalData;
    }
    
    // Get room info
    let room;
    if (appointment.roomId) {
      const [roomData] = await db
        .select({
          id: rooms.id,
          name: rooms.name,
        })
        .from(rooms)
        .where(eq(rooms.id, appointment.roomId));
      room = roomData;
    }
    
    // Get procedures for this appointment
    const appointmentProceduresList = await db
      .select()
      .from(appointmentProcedures)
      .where(eq(appointmentProcedures.appointmentId, appointment.id));
    
    const proceduresList = await Promise.all(
      appointmentProceduresList.map(async (ap) => {
        const [procedure] = await db
          .select()
          .from(procedures)
          .where(eq(procedures.id, ap.procedureId));
        return procedure;
      })
    );
    
    return {
      ...appointment,
      patient,
      professional,
      room,
      procedures: proceduresList.filter(Boolean),
    };
  }

  async createAppointment(appointmentData: any, companyId: number): Promise<any> {
    // Extract procedures to create appointment procedures
    const procedures = appointmentData.procedures || [];
    delete appointmentData.procedures;
    
    // Insert appointment
    const [appointment] = await db
      .insert(appointments)
      .values({
        ...appointmentData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    
    // Create appointment procedures
    for (const proc of procedures) {
      await db
        .insert(appointmentProcedures)
        .values({
          appointmentId: appointment.id,
          procedureId: proc.id,
          quantity: 1,
          price: proc.price,
          notes: "",
        });
    }
    
    return this.getAppointment(appointment.id);
  }

  async updateAppointment(id: number, data: any): Promise<any> {
    // Extract procedures to update appointment procedures
    const procedures = data.procedures;
    delete data.procedures;
    
    // Update appointment
    const [updatedAppointment] = await db
      .update(appointments)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))
      .returning();
    
    if (!updatedAppointment) {
      throw new Error("Appointment not found");
    }
    
    // Update appointment procedures if provided
    if (procedures) {
      // Remove existing procedures
      await db
        .delete(appointmentProcedures)
        .where(eq(appointmentProcedures.appointmentId, id));
      
      // Add new procedures
      for (const proc of procedures) {
        await db
          .insert(appointmentProcedures)
          .values({
            appointmentId: id,
            procedureId: proc.id,
            quantity: 1,
            price: proc.price,
            notes: "",
          });
      }
    }
    
    return this.getAppointment(id);
  }

  // Professional methods
  async getProfessionals(): Promise<User[]> {
    return db
      .select()
      .from(users)
      .where(eq(users.role, "dentist"));
  }

  // Room methods
  async getRooms(): Promise<Room[]> {
    return db.select().from(rooms);
  }

  // Procedures
  async getProcedures(): Promise<Procedure[]> {
    return db.select().from(procedures);
  }

  // Patient records
  async getPatientRecords(patientId: number): Promise<PatientRecord[]> {
    return db
      .select()
      .from(patientRecords)
      .where(eq(patientRecords.patientId, patientId));
  }

  async createPatientRecord(data: any): Promise<PatientRecord> {
    const [record] = await db
      .insert(patientRecords)
      .values({
        ...data,
        createdAt: new Date(),
      })
      .returning();
    return record;
  }

  // Odontogram
  async getOdontogramEntries(patientId: number): Promise<OdontogramEntry[]> {
    return db
      .select()
      .from(odontogramEntries)
      .where(eq(odontogramEntries.patientId, patientId));
  }

  async createOdontogramEntry(data: any): Promise<OdontogramEntry> {
    const [entry] = await db
      .insert(odontogramEntries)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return entry;
  }

  // Automations
  async getAutomations(companyId: number): Promise<Automation[]> {
    return db.select().from(automations).where(eq(automations.companyId, companyId));
  }

  async createAutomation(data: any, companyId: number): Promise<Automation> {
    const [automation] = await db
      .insert(automations)
      .values({
        ...data,
        companyId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return automation;
  }

  async updateAutomation(id: number, data: any, companyId: number): Promise<Automation> {
    try {
      // Verificar se a automação existe antes de tentar atualizar
      const [existingAutomation] = await db
        .select()
        .from(automations)
        .where(eq(automations.id, id));
        
      if (!existingAutomation) {
        throw new Error("Automation not found");
      }
      
      // Preparar dados de atualização garantindo formato correto da data
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
      console.error("Error updating automation:", error);
      throw error;
    }
  }

  async deleteAutomation(id: number, companyId: number): Promise<void> {
    await db
      .delete(automations)
      .where(eq(automations.id, id));
  }

  // Financial transactions
  async getTransactions(): Promise<Transaction[]> {
    // Note: Transactions are currently handled in-memory
    // This will need to be implemented when we add a transactions table to the schema
    return [];
  }

  async createTransaction(transaction: any): Promise<Transaction> {
    // Note: Transactions are currently handled in-memory
    // This will need to be implemented when we add a transactions table to the schema
    throw new Error("Method not implemented with database storage");
  }

  // Laboratory operations
  async getLaboratories(companyId: number): Promise<Laboratory[]> {
    return db
      .select()
      .from(laboratories)
      .where(eq(laboratories.companyId, companyId))
      .orderBy(desc(laboratories.createdAt));
  }

  async getLaboratory(id: number, companyId: number): Promise<Laboratory | undefined> {
    const [result] = await db
      .select()
      .from(laboratories)
      .where(and(eq(laboratories.id, id), eq(laboratories.companyId, companyId)));
    return result;
  }

  async createLaboratory(data: any): Promise<Laboratory> {
    console.log('Storage: Creating laboratory with data:', data);
    
    const [newLaboratory] = await db
      .insert(laboratories)
      .values({
        ...data,
        active: data.active ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    
    console.log('Storage: Created laboratory:', newLaboratory);
    return newLaboratory;
  }

  async updateLaboratory(id: number, data: any, companyId: number): Promise<Laboratory> {
    console.log('Storage: Updating laboratory', id, 'with data:', data);
    
    const [updatedLaboratory] = await db
      .update(laboratories)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(laboratories.id, id), eq(laboratories.companyId, companyId)))
      .returning();
    
    if (!updatedLaboratory) {
      throw new Error("Laboratory not found");
    }
    
    console.log('Storage: Updated laboratory:', updatedLaboratory);
    return updatedLaboratory;
  }

  async deleteLaboratory(id: number, companyId: number): Promise<boolean> {
    console.log('Storage: Deleting laboratory', id, 'for company', companyId);
    
    const result = await db
      .delete(laboratories)
      .where(and(eq(laboratories.id, id), eq(laboratories.companyId, companyId)));
    
    console.log('Storage: Delete result:', result);
    return result.rowCount > 0;
  }

  // Helper methods to seed initial data
  async seedInitialData() {
    // Seed inventory data first
    await this.seedInventoryData();
    
    // Check if we have any users
    const userCount = await db.select({ count: count() }).from(users);
    
    if (userCount[0].count === 0) {
      // Create admin user
      await this.createUser({
        username: "admin",
        password: "$2b$10$I9HhVdTaRHpxPR3ykU5XvuxO1rDZw8yU4VOVUZ0KdJkD9TaFYWjwq.salt", // password: admin123
        fullName: "Administrador",
        email: "admin@dentalclinic.com",
        role: "admin",
        speciality: "Administração",
        companyId: 1,
      });
      
      // Create dentist user
      await this.createUser({
        username: "dentista",
        password: "$2b$10$I9HhVdTaRHpxPR3ykU5XvuxO1rDZw8yU4VOVUZ0KdJkD9TaFYWjwq.salt", // password: dentista123
        fullName: "Dr. Ana Silva",
        email: "ana.silva@dentalclinic.com",
        role: "dentist",
        speciality: "Clínico Geral",
        companyId: 1,
      });
      
      // Create rooms
      const room1 = await db
        .insert(rooms)
        .values({ name: "Sala 01", description: "Consultório principal", active: true })
        .returning();
      
      const room2 = await db
        .insert(rooms)
        .values({ name: "Sala 02", description: "Consultório secundário", active: true })
        .returning();
      
      const room3 = await db
        .insert(rooms)
        .values({ name: "Sala 03", description: "Sala de procedimentos", active: true })
        .returning();
      
      // Create procedures
      await db
        .insert(procedures)
        .values({ name: "Consulta inicial", duration: 30, price: 12000, description: "Avaliação inicial", color: "#1976d2" });
      
      await db
        .insert(procedures)
        .values({ name: "Limpeza dental", duration: 60, price: 15000, description: "Profilaxia completa", color: "#43a047" });
      
      await db
        .insert(procedures)
        .values({ name: "Tratamento de canal", duration: 90, price: 30000, description: "Endodontia", color: "#ff5722" });
      
      await db
        .insert(procedures)
        .values({ name: "Restauração", duration: 60, price: 18000, description: "Restauração em resina", color: "#9c27b0" });
      
      await db
        .insert(procedures)
        .values({ name: "Extração", duration: 60, price: 20000, description: "Extração simples", color: "#f44336" });
    }
  }
  // Prosthesis Labels Methods
  async getProsthesisLabels(companyId: number): Promise<any[]> {
    try {
      const result = await pool.query(`
        SELECT * FROM prosthesis_labels 
        WHERE company_id = $1 AND active = true 
        ORDER BY name
      `, [companyId]);
      
      return result.rows || [];
    } catch (error) {
      console.error('Erro ao buscar etiquetas:', error);
      // Return default labels if table doesn't exist yet
      return [
        { id: 1, name: "urgente", color: "#ef4444", companyId },
        { id: 2, name: "retrabalho", color: "#f97316", companyId },
        { id: 3, name: "prioritário", color: "#eab308", companyId },
        { id: 4, name: "complexo", color: "#8b5cf6", companyId }
      ];
    }
  }

  async createProsthesisLabel(data: any): Promise<any> {
    try {
      const result = await pool.query(`
        INSERT INTO prosthesis_labels (company_id, name, color, active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING *
      `, [data.companyId, data.name, data.color, data.active ?? true]);
      
      return result.rows[0];
    } catch (error) {
      console.error('Erro ao criar etiqueta:', error);
      throw error;
    }
  }

  async updateProsthesisLabel(id: number, companyId: number, data: any): Promise<any> {
    try {
      const result = await pool.query(`
        UPDATE prosthesis_labels 
        SET name = $1, color = $2, active = $3, updated_at = NOW()
        WHERE id = $4 AND company_id = $5
        RETURNING *
      `, [data.name, data.color, data.active, id, companyId]);
      
      return result.rows[0];
    } catch (error) {
      console.error('Erro ao atualizar etiqueta:', error);
      throw error;
    }
  }

  async deleteProsthesisLabel(id: number, companyId: number): Promise<boolean> {
    try {
      const result = await pool.query(`
        UPDATE prosthesis_labels 
        SET active = false, updated_at = NOW()
        WHERE id = $1 AND company_id = $2
      `, [id, companyId]);
      
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Erro ao deletar etiqueta:', error);
      throw error;
    }
  }

  // === INVENTORY MANAGEMENT ===
  
  async getInventoryCategories(): Promise<InventoryCategory[]> {
    try {
      const categories = await db.select().from(inventoryCategories);
      return categories;
    } catch (error) {
      console.error('Erro ao buscar categorias de estoque:', error);
      throw error;
    }
  }

  async getInventoryItems(): Promise<InventoryItem[]> {
    try {
      const items = await db.select().from(inventoryItems).where(eq(inventoryItems.active, true));
      return items;
    } catch (error) {
      console.error('Erro ao buscar itens de estoque:', error);
      throw error;
    }
  }

  async createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem> {
    try {
      const [newItem] = await db.insert(inventoryItems).values(item).returning();
      return newItem;
    } catch (error) {
      console.error('Erro ao criar item de estoque:', error);
      throw error;
    }
  }

  async updateInventoryItem(id: number, data: Partial<InventoryItem>): Promise<InventoryItem> {
    try {
      const [updatedItem] = await db
        .update(inventoryItems)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(inventoryItems.id, id))
        .returning();
      return updatedItem;
    } catch (error) {
      console.error('Erro ao atualizar item de estoque:', error);
      throw error;
    }
  }

  async updateInventoryStock(id: number, quantity: number, type: 'add' | 'remove'): Promise<InventoryItem> {
    try {
      // First get the current item
      const [currentItem] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
      if (!currentItem) {
        throw new Error('Item não encontrado');
      }

      const currentStockValue = currentItem.currentStock ?? 0;
      const newStock = type === 'add' 
        ? currentStockValue + quantity
        : currentStockValue - quantity;

      if (newStock < 0) {
        throw new Error('Estoque não pode ser negativo');
      }

      // Update the stock
      const [updatedItem] = await db
        .update(inventoryItems)
        .set({ 
          currentStock: newStock,
          updatedAt: new Date()
        })
        .where(eq(inventoryItems.id, id))
        .returning();

      // Create a transaction record
      await db.insert(inventoryTransactions).values({
        itemId: id,
        userId: 1, // TODO: Get from request context
        type: type === 'add' ? 'entrada' : 'saida',
        quantity: quantity,
        reason: `Ajuste de estoque - ${type === 'add' ? 'Entrada' : 'Saída'}`,
        previousStock: currentStockValue,
        newStock: newStock
      });

      return updatedItem;
    } catch (error) {
      console.error('Erro ao atualizar estoque:', error);
      throw error;
    }
  }

  async getInventoryTransactions(): Promise<InventoryTransaction[]> {
    try {
      const transactions = await db.select().from(inventoryTransactions).orderBy(desc(inventoryTransactions.createdAt));
      return transactions;
    } catch (error) {
      console.error('Erro ao buscar transações de estoque:', error);
      throw error;
    }
  }

  // Seed comprehensive dental inventory data
  async seedInventoryData() {
    try {
      console.log('Iniciando população do banco com materiais odontológicos padrão...');

      // Check if data already exists
      const existingCategories = await db.select().from(inventoryCategories);
      if (existingCategories.length > 0) {
        console.log('Dados de estoque já existem no banco.');
        return;
      }

      // Insert standard dental categories
      const categories = [
        { name: "Resinas e Compósitos", description: "Materiais restauradores fotopolimerizáveis", color: "#3498db" },
        { name: "Anestésicos", description: "Anestésicos locais e tópicos", color: "#e74c3c" },
        { name: "Materiais de Moldagem", description: "Alginatos, silicones e materiais de impressão", color: "#9b59b6" },
        { name: "Cimentos e Bases", description: "Cimentos definitivos e forradores", color: "#f39c12" },
        { name: "Materiais Endodônticos", description: "Limas, cones e medicamentos para endodontia", color: "#27ae60" },
        { name: "Materiais Preventivos", description: "Vernizes fluoretados e selantes", color: "#2ecc71" },
        { name: "Descartáveis e EPI", description: "Luvas, máscaras e materiais descartáveis", color: "#95a5a6" },
        { name: "Instrumentos Rotatórios", description: "Brocas, discos e pontas", color: "#34495e" },
        { name: "Materiais Protéticos", description: "Silicones, ceras e materiais para próteses", color: "#e67e22" },
        { name: "Medicamentos", description: "Antibióticos, anti-inflamatórios e analgésicos", color: "#8e44ad" },
        { name: "Materiais Periodontais", description: "Instrumentos e medicamentos para periodontia", color: "#16a085" },
        { name: "Materiais Cirúrgicos", description: "Instrumentos e materiais para cirurgia oral", color: "#c0392b" },
        { name: "Materiais de Impressão Digital", description: "Scanners e materiais para odontologia digital", color: "#2c3e50" },
        { name: "Equipamentos e Acessórios", description: "Peças de mão, turbinas e acessórios", color: "#7f8c8d" }
      ];

      const insertedCategories = await db.insert(inventoryCategories).values(categories).returning();
      console.log(`${insertedCategories.length} categorias inseridas.`);

      // Create category map for reference
      const categoryMap = new Map();
      insertedCategories.forEach(cat => {
        categoryMap.set(cat.name, cat.id);
      });

      // Comprehensive dental materials database
      const standardItems = [
        // Resinas e Compósitos (Extensive List)
        { name: "Resina Z350 XT A1", description: "Resina composta fotopolimerizável universal", categoryId: categoryMap.get("Resinas e Compósitos"), sku: "3M-Z350-A1", brand: "3M ESPE", supplier: "3M do Brasil", minimumStock: 3, currentStock: 8, price: 14500, unitOfMeasure: "seringa", location: "Armário 1" },
        { name: "Resina Z350 XT A2", description: "Resina composta fotopolimerizável universal", categoryId: categoryMap.get("Resinas e Compósitos"), sku: "3M-Z350-A2", brand: "3M ESPE", supplier: "3M do Brasil", minimumStock: 5, currentStock: 12, price: 14500, unitOfMeasure: "seringa", location: "Armário 1" },
        { name: "Resina Z350 XT A3", description: "Resina composta fotopolimerizável universal", categoryId: categoryMap.get("Resinas e Compósitos"), sku: "3M-Z350-A3", brand: "3M ESPE", supplier: "3M do Brasil", minimumStock: 4, currentStock: 10, price: 14500, unitOfMeasure: "seringa", location: "Armário 1" },
        { name: "Resina Filtek Universal A2", description: "Resina composta universal", categoryId: categoryMap.get("Resinas e Compósitos"), sku: "3M-FU-A2", brand: "3M ESPE", supplier: "3M do Brasil", minimumStock: 3, currentStock: 7, price: 16200, unitOfMeasure: "seringa", location: "Armário 1" },
        { name: "Resina Tetric N-Ceram A1", description: "Resina composta nanohíbrida", categoryId: categoryMap.get("Resinas e Compósitos"), sku: "IVO-TNC-A1", brand: "Ivoclar", supplier: "Ivoclar Vivadent", minimumStock: 4, currentStock: 6, price: 13800, unitOfMeasure: "seringa", location: "Armário 1" },
        { name: "Resina Charisma Diamond A2", description: "Resina nanohíbrida", categoryId: categoryMap.get("Resinas e Compósitos"), sku: "KULZER-CD-A2", brand: "Kulzer", supplier: "Kulzer", minimumStock: 2, currentStock: 5, price: 12500, unitOfMeasure: "seringa", location: "Armário 1" },
        { name: "Resina TPH3 A2", description: "Resina microhíbrida", categoryId: categoryMap.get("Resinas e Compósitos"), sku: "DENTSPLY-TPH3", brand: "Dentsply", supplier: "Dentsply Sirona", minimumStock: 3, currentStock: 8, price: 11800, unitOfMeasure: "seringa", location: "Armário 1" },

        // Anestésicos (Comprehensive List)
        { name: "Lidocaína 2% com Epinefrina", description: "Anestésico local com vasoconstritor", categoryId: categoryMap.get("Anestésicos"), sku: "DFL-LID2E", brand: "DFL", supplier: "DFL", minimumStock: 10, currentStock: 25, price: 4200, unitOfMeasure: "caixa 50 tubetes", location: "Geladeira" },
        { name: "Mepivacaína 2% sem Vasoconstritor", description: "Anestésico local sem epinefrina", categoryId: categoryMap.get("Anestésicos"), sku: "DFL-MEP2", brand: "DFL", supplier: "DFL", minimumStock: 5, currentStock: 12, price: 3850, unitOfMeasure: "caixa 50 tubetes", location: "Geladeira" },
        { name: "Articaína 4% com Epinefrina", description: "Anestésico local de alta potência", categoryId: categoryMap.get("Anestésicos"), sku: "DFL-ART4E", brand: "DFL", supplier: "DFL", minimumStock: 8, currentStock: 15, price: 5200, unitOfMeasure: "caixa 50 tubetes", location: "Geladeira" },
        { name: "Gel Anestésico Benzocaína 20%", description: "Anestésico tópico", categoryId: categoryMap.get("Anestésicos"), sku: "DFL-BENZ20", brand: "DFL", supplier: "DFL", minimumStock: 3, currentStock: 8, price: 1850, unitOfMeasure: "pote 12g", location: "Armário 2" },
        { name: "Prilocaína 3% com Felipressina", description: "Anestésico local", categoryId: categoryMap.get("Anestésicos"), sku: "DFL-PRI3F", brand: "DFL", supplier: "DFL", minimumStock: 4, currentStock: 9, price: 4500, unitOfMeasure: "caixa 50 tubetes", location: "Geladeira" },

        // Materiais de Moldagem
        { name: "Alginato Jeltrate Plus", description: "Alginato para moldagem", categoryId: categoryMap.get("Materiais de Moldagem"), sku: "DENTSPLY-JP", brand: "Dentsply", supplier: "Dentsply Sirona", minimumStock: 2, currentStock: 5, price: 8900, unitOfMeasure: "pacote 454g", location: "Armário 3" },
        { name: "Silicone Optosil Comfort", description: "Silicone de moldagem", categoryId: categoryMap.get("Materiais de Moldagem"), sku: "KULZER-OPT", brand: "Kulzer", supplier: "Kulzer", minimumStock: 1, currentStock: 3, price: 12400, unitOfMeasure: "kit", location: "Armário 3" },
        { name: "Pasta Zinco-Enólica", description: "Material para moldagem funcional", categoryId: categoryMap.get("Materiais de Moldagem"), sku: "SSW-PZE", brand: "SS White", supplier: "SS White", minimumStock: 2, currentStock: 4, price: 3200, unitOfMeasure: "tubo", location: "Armário 3" },

        // Cimentos e Bases
        { name: "Cimento de Ionômero Vidrion R", description: "Cimento restaurador", categoryId: categoryMap.get("Cimentos e Bases"), sku: "SSW-VDR", brand: "SS White", supplier: "SS White", minimumStock: 3, currentStock: 7, price: 5600, unitOfMeasure: "kit", location: "Armário 2" },
        { name: "Cimento RelyX Ultimate", description: "Cimento resinoso dual", categoryId: categoryMap.get("Cimentos e Bases"), sku: "3M-RXU", brand: "3M ESPE", supplier: "3M", minimumStock: 2, currentStock: 4, price: 28500, unitOfMeasure: "kit", location: "Armário 2" },
        { name: "Cimento de Fosfato de Zinco", description: "Cimento definitivo", categoryId: categoryMap.get("Cimentos e Bases"), sku: "SSW-CFZ", brand: "SS White", supplier: "SS White", minimumStock: 2, currentStock: 3, price: 4200, unitOfMeasure: "kit", location: "Armário 2" },

        // Materiais Endodônticos (Extensive)
        { name: "Lima K-File #15 25mm", description: "Lima manual endodôntica", categoryId: categoryMap.get("Materiais Endodônticos"), sku: "DENTSPLY-KF15", brand: "Dentsply", supplier: "Dentsply", minimumStock: 15, currentStock: 30, price: 1200, unitOfMeasure: "unidade", location: "Gaveta Endo" },
        { name: "Lima K-File #20 25mm", description: "Lima manual endodôntica", categoryId: categoryMap.get("Materiais Endodônticos"), sku: "DENTSPLY-KF20", brand: "Dentsply", supplier: "Dentsply", minimumStock: 20, currentStock: 35, price: 1200, unitOfMeasure: "unidade", location: "Gaveta Endo" },
        { name: "Lima K-File #25 25mm", description: "Lima manual endodôntica", categoryId: categoryMap.get("Materiais Endodônticos"), sku: "DENTSPLY-KF25", brand: "Dentsply", supplier: "Dentsply", minimumStock: 20, currentStock: 35, price: 1200, unitOfMeasure: "unidade", location: "Gaveta Endo" },
        { name: "Cones Guta-Percha #20", description: "Cones de obturação", categoryId: categoryMap.get("Materiais Endodônticos"), sku: "DENTSPLY-GP20", brand: "Dentsply", supplier: "Dentsply", minimumStock: 40, currentStock: 80, price: 450, unitOfMeasure: "unidade", location: "Gaveta Endo" },
        { name: "Cones Guta-Percha #25", description: "Cones de obturação", categoryId: categoryMap.get("Materiais Endodônticos"), sku: "DENTSPLY-GP25", brand: "Dentsply", supplier: "Dentsply", minimumStock: 50, currentStock: 120, price: 450, unitOfMeasure: "unidade", location: "Gaveta Endo" },
        { name: "Cimento AH Plus", description: "Cimento endodôntico epóxico", categoryId: categoryMap.get("Materiais Endodônticos"), sku: "DENTSPLY-AHP", brand: "Dentsply", supplier: "Dentsply", minimumStock: 1, currentStock: 2, price: 18500, unitOfMeasure: "kit", location: "Gaveta Endo" },
        { name: "EDTA 17%", description: "Solução quelante", categoryId: categoryMap.get("Materiais Endodônticos"), sku: "BIODINÂMICA-EDTA17", brand: "Biodinâmica", supplier: "Biodinâmica", minimumStock: 2, currentStock: 4, price: 2800, unitOfMeasure: "frasco 100ml", location: "Gaveta Endo" },
        { name: "Hipoclorito de Sódio 2,5%", description: "Solução irrigadora", categoryId: categoryMap.get("Materiais Endodônticos"), sku: "BIODINÂMICA-HIPO25", brand: "Biodinâmica", supplier: "Biodinâmica", minimumStock: 3, currentStock: 6, price: 1800, unitOfMeasure: "frasco 100ml", location: "Gaveta Endo" },

        // Materiais Preventivos
        { name: "Verniz Duraphat", description: "Verniz fluoretado 5%", categoryId: categoryMap.get("Materiais Preventivos"), sku: "COLGATE-DUR", brand: "Colgate", supplier: "Colgate", minimumStock: 2, currentStock: 6, price: 12800, unitOfMeasure: "tubo 10ml", location: "Armário Preventivo" },
        { name: "Selante FluroShield", description: "Selante de fóssulas", categoryId: categoryMap.get("Materiais Preventivos"), sku: "DENTSPLY-FS", brand: "Dentsply", supplier: "Dentsply", minimumStock: 3, currentStock: 8, price: 9200, unitOfMeasure: "seringa", location: "Armário Preventivo" },
        { name: "Gel Fluoretado Acidulado", description: "Gel para aplicação tópica", categoryId: categoryMap.get("Materiais Preventivos"), sku: "DFL-GFA", brand: "DFL", supplier: "DFL", minimumStock: 4, currentStock: 10, price: 3500, unitOfMeasure: "pote 250g", location: "Armário Preventivo" },

        // Descartáveis e EPI (Comprehensive)
        { name: "Luvas Nitrílicas P", description: "Luvas descartáveis pequenas", categoryId: categoryMap.get("Descartáveis e EPI"), sku: "MEDIX-LNP", brand: "Medix", supplier: "Medix", minimumStock: 3, currentStock: 8, price: 3200, unitOfMeasure: "caixa 100", location: "Estoque EPI" },
        { name: "Luvas Nitrílicas M", description: "Luvas descartáveis médias", categoryId: categoryMap.get("Descartáveis e EPI"), sku: "MEDIX-LNM", brand: "Medix", supplier: "Medix", minimumStock: 5, currentStock: 15, price: 3200, unitOfMeasure: "caixa 100", location: "Estoque EPI" },
        { name: "Luvas Nitrílicas G", description: "Luvas descartáveis grandes", categoryId: categoryMap.get("Descartáveis e EPI"), sku: "MEDIX-LNG", brand: "Medix", supplier: "Medix", minimumStock: 4, currentStock: 12, price: 3200, unitOfMeasure: "caixa 100", location: "Estoque EPI" },
        { name: "Máscaras Cirúrgicas", description: "Máscaras tripla camada", categoryId: categoryMap.get("Descartáveis e EPI"), sku: "MEDIX-MASK", brand: "Medix", supplier: "Medix", minimumStock: 10, currentStock: 25, price: 1800, unitOfMeasure: "caixa 50", location: "Estoque EPI" },
        { name: "Babadores Impermeáveis", description: "Babadores descartáveis", categoryId: categoryMap.get("Descartáveis e EPI"), sku: "MEDIX-BAB", brand: "Medix", supplier: "Medix", minimumStock: 5, currentStock: 12, price: 2400, unitOfMeasure: "pacote 100", location: "Estoque EPI" },
        { name: "Copos Descartáveis 50ml", description: "Copos plásticos", categoryId: categoryMap.get("Descartáveis e EPI"), sku: "MEDIX-COP50", brand: "Medix", supplier: "Medix", minimumStock: 10, currentStock: 20, price: 800, unitOfMeasure: "pacote 100", location: "Estoque EPI" },
        { name: "Sugadores Descartáveis", description: "Sugadores plásticos", categoryId: categoryMap.get("Descartáveis e EPI"), sku: "MEDIX-SUG", brand: "Medix", supplier: "Medix", minimumStock: 15, currentStock: 30, price: 1200, unitOfMeasure: "pacote 100", location: "Estoque EPI" },

        // Instrumentos Rotatórios (Extensive)
        { name: "Broca Carbide 329 FG", description: "Broca esférica pequena", categoryId: categoryMap.get("Instrumentos Rotatórios"), sku: "KG-329FG", brand: "KG Sorensen", supplier: "KG Sorensen", minimumStock: 8, currentStock: 15, price: 850, unitOfMeasure: "unidade", location: "Organizador Brocas" },
        { name: "Broca Carbide 330 FG", description: "Broca esférica média", categoryId: categoryMap.get("Instrumentos Rotatórios"), sku: "KG-330FG", brand: "KG Sorensen", supplier: "KG Sorensen", minimumStock: 10, currentStock: 18, price: 850, unitOfMeasure: "unidade", location: "Organizador Brocas" },
        { name: "Broca Carbide 331 FG", description: "Broca esférica grande", categoryId: categoryMap.get("Instrumentos Rotatórios"), sku: "KG-331FG", brand: "KG Sorensen", supplier: "KG Sorensen", minimumStock: 6, currentStock: 12, price: 850, unitOfMeasure: "unidade", location: "Organizador Brocas" },
        { name: "Broca Diamantada 1012 HL", description: "Broca diamantada cilíndrica", categoryId: categoryMap.get("Instrumentos Rotatórios"), sku: "KG-1012HL", brand: "KG Sorensen", supplier: "KG Sorensen", minimumStock: 5, currentStock: 10, price: 1250, unitOfMeasure: "unidade", location: "Organizador Brocas" },
        { name: "Broca Diamantada 1014 HL", description: "Broca diamantada tronco-cônica", categoryId: categoryMap.get("Instrumentos Rotatórios"), sku: "KG-1014HL", brand: "KG Sorensen", supplier: "KG Sorensen", minimumStock: 8, currentStock: 14, price: 1250, unitOfMeasure: "unidade", location: "Organizador Brocas" },
        { name: "Disco Sof-Lex Grosso", description: "Disco abrasivo grosso", categoryId: categoryMap.get("Instrumentos Rotatórios"), sku: "3M-SOFLEX-G", brand: "3M", supplier: "3M", minimumStock: 2, currentStock: 4, price: 4800, unitOfMeasure: "kit 50", location: "Organizador Brocas" },
        { name: "Disco Sof-Lex Médio", description: "Disco abrasivo médio", categoryId: categoryMap.get("Instrumentos Rotatórios"), sku: "3M-SOFLEX-M", brand: "3M", supplier: "3M", minimumStock: 2, currentStock: 6, price: 4800, unitOfMeasure: "kit 50", location: "Organizador Brocas" },
        { name: "Disco Sof-Lex Fino", description: "Disco abrasivo fino", categoryId: categoryMap.get("Instrumentos Rotatórios"), sku: "3M-SOFLEX-F", brand: "3M", supplier: "3M", minimumStock: 2, currentStock: 5, price: 4800, unitOfMeasure: "kit 50", location: "Organizador Brocas" },

        // Materiais Protéticos
        { name: "Silicone Laboratorial", description: "Silicone para laboratório", categoryId: categoryMap.get("Materiais Protéticos"), sku: "KULZER-SIL", brand: "Kulzer", supplier: "Kulzer", minimumStock: 1, currentStock: 2, price: 15600, unitOfMeasure: "kit", location: "Armário Protético" },
        { name: "Cera Rosa 7", description: "Cera para escultura", categoryId: categoryMap.get("Materiais Protéticos"), sku: "LYSANDA-CR7", brand: "Lysanda", supplier: "Lysanda", minimumStock: 3, currentStock: 6, price: 2800, unitOfMeasure: "placa", location: "Armário Protético" },
        { name: "Gesso Pedra Especial", description: "Gesso tipo IV", categoryId: categoryMap.get("Materiais Protéticos"), sku: "POLIDENTAL-GPE", brand: "Polidental", supplier: "Polidental", minimumStock: 2, currentStock: 4, price: 3200, unitOfMeasure: "saco 25kg", location: "Armário Protético" },

        // Medicamentos (Comprehensive)
        { name: "Amoxicilina 500mg", description: "Antibiótico", categoryId: categoryMap.get("Medicamentos"), sku: "MEDLEY-AMX500", brand: "Medley", supplier: "Medley", minimumStock: 5, currentStock: 12, price: 1200, unitOfMeasure: "caixa 21 cápsulas", location: "Armário Medicamentos" },
        { name: "Ibuprofeno 400mg", description: "Anti-inflamatório", categoryId: categoryMap.get("Medicamentos"), sku: "MEDLEY-IBU400", brand: "Medley", supplier: "Medley", minimumStock: 3, currentStock: 8, price: 800, unitOfMeasure: "caixa 20 comprimidos", location: "Armário Medicamentos" },
        { name: "Nimesulida 100mg", description: "Anti-inflamatório", categoryId: categoryMap.get("Medicamentos"), sku: "MEDLEY-NIM100", brand: "Medley", supplier: "Medley", minimumStock: 2, currentStock: 6, price: 950, unitOfMeasure: "caixa 12 comprimidos", location: "Armário Medicamentos" },
        { name: "Dipirona 500mg", description: "Analgésico", categoryId: categoryMap.get("Medicamentos"), sku: "MEDLEY-DIP500", brand: "Medley", supplier: "Medley", minimumStock: 4, currentStock: 10, price: 600, unitOfMeasure: "caixa 20 comprimidos", location: "Armário Medicamentos" },

        // Materiais Periodontais
        { name: "Cureta Gracey 5-6", description: "Cureta periodontal", categoryId: categoryMap.get("Materiais Periodontais"), sku: "HUFRIEDY-G56", brand: "Hu-Friedy", supplier: "Hu-Friedy", minimumStock: 2, currentStock: 4, price: 28500, unitOfMeasure: "unidade", location: "Instrumentos Periodontais" },
        { name: "Solução de Clorexidina 0,12%", description: "Antisséptico bucal", categoryId: categoryMap.get("Materiais Periodontais"), sku: "PERIOGARD-012", brand: "Periogard", supplier: "Colgate", minimumStock: 3, currentStock: 8, price: 1200, unitOfMeasure: "frasco 250ml", location: "Armário Periodontia" },
        { name: "Fio de Sutura Seda 4-0", description: "Fio de sutura", categoryId: categoryMap.get("Materiais Periodontais"), sku: "ETHICON-S40", brand: "Ethicon", supplier: "Ethicon", minimumStock: 10, currentStock: 25, price: 850, unitOfMeasure: "unidade", location: "Armário Cirúrgico" },

        // Materiais Cirúrgicos
        { name: "Lâmina de Bisturi #15", description: "Lâmina cirúrgica", categoryId: categoryMap.get("Materiais Cirúrgicos"), sku: "SOLIDOR-L15", brand: "Solidor", supplier: "Solidor", minimumStock: 20, currentStock: 50, price: 120, unitOfMeasure: "unidade", location: "Armário Cirúrgico" },
        { name: "Seringa Descartável 5ml", description: "Seringa para irrigação", categoryId: categoryMap.get("Materiais Cirúrgicos"), sku: "BD-SER5", brand: "BD", supplier: "BD", minimumStock: 15, currentStock: 30, price: 180, unitOfMeasure: "unidade", location: "Armário Cirúrgico" },
        { name: "Gaze Estéril 7,5x7,5", description: "Gaze cirúrgica", categoryId: categoryMap.get("Materiais Cirúrgicos"), sku: "CREMER-G75", brand: "Cremer", supplier: "Cremer", minimumStock: 10, currentStock: 25, price: 450, unitOfMeasure: "pacote 10", location: "Armário Cirúrgico" },

        // Equipamentos e Acessórios
        { name: "Peça de Mão Multiplicadora", description: "Contra-ângulo 1:5", categoryId: categoryMap.get("Equipamentos e Acessórios"), sku: "KAVO-PM15", brand: "Kavo", supplier: "Kavo", minimumStock: 1, currentStock: 2, price: 85000, unitOfMeasure: "unidade", location: "Equipamentos" },
        { name: "Turbina de Alta Rotação", description: "Turbina para alta rotação", categoryId: categoryMap.get("Equipamentos e Acessórios"), sku: "KAVO-TAR", brand: "Kavo", supplier: "Kavo", minimumStock: 1, currentStock: 3, price: 120000, unitOfMeasure: "unidade", location: "Equipamentos" },
        { name: "Sugador Cirúrgico", description: "Sugador de saliva", categoryId: categoryMap.get("Equipamentos e Acessórios"), sku: "KAVO-SUG", brand: "Kavo", supplier: "Kavo", minimumStock: 2, currentStock: 4, price: 15000, unitOfMeasure: "unidade", location: "Equipamentos" }
      ];

      const insertedItems = await db.insert(inventoryItems).values(standardItems).returning();
      console.log(`${insertedItems.length} itens de estoque inseridos.`);
      
      console.log('População concluída - Materiais odontológicos padrão disponíveis');

    } catch (error) {
      console.error('Erro ao popular dados de estoque:', error);
    }
  }

  sessionStore: any = null;
}

// Use DatabaseStorage with PostgreSQL
export const storage = new DatabaseStorage();
