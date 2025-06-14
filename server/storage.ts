import { users, type User, type InsertUser, patients, appointments, procedures, rooms, workingHours, holidays, automations, patientRecords, odontogramEntries, appointmentProcedures, type Patient, type Appointment, type Procedure, type Room, type WorkingHours, type Holiday, type Automation, type PatientRecord, type OdontogramEntry, type AppointmentProcedure } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { db, pool } from "./db";
import { eq, and, gte, lt, count, sql } from "drizzle-orm";

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);

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
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    });
    
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
    
    return this.getAppointment(id);
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
    
    return this.getAppointment(id); // CompanyId is optional now
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
  async getAutomations(): Promise<Automation[]> {
    return Array.from(this.automations.values());
  }

  async createAutomation(data: any): Promise<Automation> {
    const id = this.automationIdCounter++;
    const now = new Date();
    const automation: Automation = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.automations.set(id, automation);
    return automation;
  }

  async updateAutomation(id: number, data: any): Promise<Automation> {
    const automation = this.automations.get(id);
    if (!automation) {
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

  async deleteAutomation(id: number): Promise<void> {
    if (!this.automations.has(id)) {
      throw new Error("Automation not found");
    }
    
    this.automations.delete(id);
  }
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool,
      createTableIfMissing: true 
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
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

  async createAppointment(appointmentData: any): Promise<any> {
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
  async getAutomations(): Promise<Automation[]> {
    return db.select().from(automations);
  }

  async createAutomation(data: any): Promise<Automation> {
    const [automation] = await db
      .insert(automations)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return automation;
  }

  async updateAutomation(id: number, data: any): Promise<Automation> {
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

  async deleteAutomation(id: number): Promise<void> {
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

  // Helper methods to seed initial data
  async seedInitialData() {
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
}

// Use DatabaseStorage with PostgreSQL
export const storage = new DatabaseStorage();
