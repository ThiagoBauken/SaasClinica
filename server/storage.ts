import { users, type User, type InsertUser, patients, appointments, procedures, rooms, workingHours, holidays, automations, patientRecords, odontogramEntries, appointmentProcedures, type Patient, type Appointment, type Procedure, type Room, type WorkingHours, type Holiday, type Automation, type PatientRecord, type OdontogramEntry, type AppointmentProcedure } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { db, pool } from "./db";
import { eq, and, gte, lt } from "drizzle-orm";

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
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Patients
  getPatients(): Promise<Patient[]>;
  getPatient(id: number): Promise<Patient | undefined>;
  createPatient(patient: any): Promise<Patient>;
  updatePatient(id: number, data: any): Promise<Patient>;
  
  // Appointments
  getAppointments(filters?: AppointmentFilters): Promise<any[]>;
  getAppointment(id: number): Promise<any | undefined>;
  createAppointment(appointment: any): Promise<any>;
  updateAppointment(id: number, data: any): Promise<any>;
  
  // Professionals
  getProfessionals(): Promise<User[]>;

  // Rooms
  getRooms(): Promise<Room[]>;
  
  // Procedures
  getProcedures(): Promise<Procedure[]>;
  
  // Patient records
  getPatientRecords(patientId: number): Promise<PatientRecord[]>;
  createPatientRecord(record: any): Promise<PatientRecord>;
  
  // Odontogram
  getOdontogramEntries(patientId: number): Promise<OdontogramEntry[]>;
  createOdontogramEntry(entry: any): Promise<OdontogramEntry>;
  
  // Financial
  getTransactions(): Promise<Transaction[]>;
  createTransaction(transaction: any): Promise<Transaction>;
  
  // Automations
  getAutomations(): Promise<Automation[]>;
  createAutomation(automation: any): Promise<Automation>;
  updateAutomation(id: number, data: any): Promise<Automation>;
  deleteAutomation(id: number): Promise<void>;
  
  sessionStore: session.SessionStore;
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
  
  sessionStore: session.SessionStore;
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
      active: true
    });
    
    // Create dentist user
    this.createUser({
      username: "dentista",
      password: "$2b$10$I9HhVdTaRHpxPR3ykU5XvuxO1rDZw8yU4VOVUZ0KdJkD9TaFYWjwq.salt", // password: dentista123
      fullName: "Dr. Ana Silva",
      email: "ana.silva@dentalclinic.com",
      role: "dentist",
      speciality: "Clínico Geral",
      active: true
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

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const now = new Date();
    const user: User = { 
      ...insertUser, 
      id, 
      createdAt: now,
      active: true
    };
    this.users.set(id, user);
    return user;
  }

  // Patient methods
  async getPatients(): Promise<Patient[]> {
    return Array.from(this.patients.values());
  }

  async getPatient(id: number): Promise<Patient | undefined> {
    return this.patients.get(id);
  }

  async createPatient(patient: any): Promise<Patient> {
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

  async updatePatient(id: number, data: any): Promise<Patient> {
    const patient = await this.getPatient(id);
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
  async getAppointments(filters?: AppointmentFilters): Promise<any[]> {
    let appointments = Array.from(this.appointments.values());
    
    // Apply filters
    if (filters) {
      if (filters.startDate) {
        appointments = appointments.filter(a => a.startTime >= filters.startDate);
      }
      if (filters.endDate) {
        appointments = appointments.filter(a => a.startTime < filters.endDate);
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
        const patient = appointment.patientId ? await this.getPatient(appointment.patientId) : undefined;
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

  async getAppointment(id: number): Promise<any | undefined> {
    const appointment = this.appointments.get(id);
    if (!appointment) return undefined;
    
    // Enrich with related data
    const patient = appointment.patientId ? await this.getPatient(appointment.patientId) : undefined;
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

  async createAppointment(appointmentData: any): Promise<any> {
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

  async updateAppointment(id: number, data: any): Promise<any> {
    const appointment = await this.getAppointment(id);
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
    
    return this.getAppointment(id);
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

export const storage = new MemStorage();
