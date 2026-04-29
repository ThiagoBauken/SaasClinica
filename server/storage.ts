import { companies, users, type User, type InsertUser, patients, appointments, procedures, rooms, workingHours, holidays, automations, patientRecords, odontogramEntries, appointmentProcedures, prosthesis, laboratories, prosthesisLabels, inventoryCategories, inventoryItems, inventoryTransactions, standardDentalProducts, anamnesis, patientExams, detailedTreatmentPlans, treatmentEvolution, prescriptions, type Patient, type Appointment, type Procedure, type Room, type WorkingHours, type Holiday, type Automation, type PatientRecord, type OdontogramEntry, type AppointmentProcedure, type Prosthesis, type InsertProsthesis, type Laboratory, type InsertLaboratory, type ProsthesisLabel, type InsertProsthesisLabel, type StandardDentalProduct, type Anamnesis, type PatientExam, type DetailedTreatmentPlan, type TreatmentEvolution, type Prescription } from "@shared/schema";
import { db, pool } from "./db";
import { eq, and, gte, lte, lt, count, sql, desc, inArray } from "drizzle-orm";
import { notDeleted } from "./lib/soft-delete";
import { logger } from './logger';
import {
  encryptField, decryptField, hmacIndex,
  PATIENT_ENCRYPTED_FIELDS,
} from "./lib/field-encryption";

/**
 * LGPD: Encrypt sensitive patient fields before persisting to DB.
 * Fields: cpf, rg, bloodType, allergies, medications, chronicDiseases
 */
function encryptPatientData(data: Record<string, any>): Record<string, any> {
  const result = { ...data };
  for (const field of PATIENT_ENCRYPTED_FIELDS) {
    if (result[field] != null && typeof result[field] === 'string') {
      result[field] = encryptField(result[field]);
    }
  }
  // Generate HMAC search index for CPF (allows WHERE queries without decrypting all rows)
  if (result.cpf != null) {
    result.cpfHash = hmacIndex(data.cpf); // Use original plaintext for hash
  }
  return result;
}

/**
 * LGPD: Decrypt sensitive patient fields after reading from DB.
 */
function decryptPatientData<T extends Record<string, any>>(patient: T): T {
  if (!patient) return patient;
  const result = { ...patient };
  for (const field of PATIENT_ENCRYPTED_FIELDS) {
    if ((result as any)[field] != null && typeof (result as any)[field] === 'string') {
      (result as any)[field] = decryptField((result as any)[field]);
    }
  }
  return result;
}

/**
 * LGPD: Decrypt an array of patient records.
 */
function decryptPatientList<T extends Record<string, any>>(patients: T[]): T[] {
  return patients.map(decryptPatientData);
}

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
  /** SQL-level pagination */
  limit?: number;
  offset?: number;
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
  countAppointments(companyId: number, filters?: AppointmentFilters): Promise<number>;
  getAppointment(id: number, companyId?: number): Promise<any | undefined>;
  createAppointment(appointment: any, companyId: number): Promise<any>;
  updateAppointment(id: number, data: any, companyId: number): Promise<any>;
  deleteAppointment(id: number, companyId: number): Promise<boolean>;
  checkAppointmentConflicts(
    companyId: number,
    startTime: Date,
    endTime: Date,
    options?: { professionalId?: number; roomId?: number; excludeAppointmentId?: number }
  ): Promise<any[]>;

  // Professionals - tenant-aware
  getProfessionals(companyId: number): Promise<User[]>;

  // Rooms - tenant-aware
  getRooms(companyId: number): Promise<Room[]>;
  getRoom(id: number, companyId: number): Promise<Room | undefined>;
  createRoom(room: any, companyId: number): Promise<Room>;
  updateRoom(id: number, data: any, companyId: number): Promise<Room>;
  deleteRoom(id: number, companyId: number): Promise<boolean>;

  // Procedures - tenant-aware
  getProcedures(companyId: number): Promise<Procedure[]>;
  getProcedure(id: number, companyId: number): Promise<Procedure | undefined>;
  createProcedure(procedure: any, companyId: number): Promise<Procedure>;
  updateProcedure(id: number, data: any, companyId: number): Promise<Procedure>;
  deleteProcedure(id: number, companyId: number): Promise<boolean>;
  
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

  // Clinic Settings - tenant-aware
  getClinicSettings(companyId: number): Promise<any | undefined>;
  createClinicSettings(data: any): Promise<any>;
  updateClinicSettings(companyId: number, data: any): Promise<any>;

  // Automation Logs - tenant-aware
  createAutomationLog(data: any): Promise<any>;

  // Laboratories - tenant-aware
  getLaboratories(companyId: number): Promise<Laboratory[]>;
  getLaboratory(id: number, companyId: number): Promise<Laboratory | undefined>;
  createLaboratory(laboratory: any): Promise<Laboratory>;
  updateLaboratory(id: number, data: any, companyId: number): Promise<Laboratory>;
  deleteLaboratory(id: number, companyId: number): Promise<boolean>;
  
  // Prosthesis - tenant-aware
  getProsthesis(companyId: number): Promise<any[]>;
  getProsthesisById(id: number, companyId: number): Promise<any | undefined>;
  createProsthesis(data: any): Promise<any>;
  updateProsthesis(id: number, data: any, companyId: number): Promise<any>;
  deleteProsthesis(id: number, companyId: number): Promise<void>;

  // Prosthesis Labels - tenant-aware
  getProsthesisLabels(companyId: number): Promise<any[]>;
  createProsthesisLabel(label: any): Promise<any>;
  updateProsthesisLabel(id: number, companyId: number, data: any): Promise<any>;
  deleteProsthesisLabel(id: number, companyId: number): Promise<boolean>;

  // Inventory - tenant-aware
  getInventoryCategories(companyId: number): Promise<any[]>;
  createInventoryCategory(data: any): Promise<any>;
  updateInventoryCategory(id: number, data: any, companyId: number): Promise<any>;
  getInventoryItems(companyId: number): Promise<any[]>;
  createInventoryItem(data: any): Promise<any>;
  updateInventoryItem(id: number, data: any, companyId: number): Promise<any>;
  deleteInventoryItem(id: number, companyId: number): Promise<boolean>;
  getInventoryTransactions(companyId: number, itemId?: number): Promise<any[]>;
  createInventoryTransaction(data: any): Promise<any>;
  getStandardDentalProducts(): Promise<StandardDentalProduct[]>;
  importStandardProducts(productIds: number[], companyId: number): Promise<any[]>;
  getInventorySeedData(): {
    categories: Array<{ name: string; description: string; color: string; items: Array<{ name: string; minimumStock: number; unitOfMeasure: string; brand?: string }> }>;
  };
  seedInventoryDefaults(companyId: number, selection?: { categoryNames: string[]; itemsByCategory?: Record<string, string[]> }): Promise<{ categories: any[], items: any[] }>;

  // Digital Patient Record - tenant-aware
  getPatientAnamnesis(patientId: number, companyId: number): Promise<any | undefined>;
  createPatientAnamnesis(data: any): Promise<any>;
  updatePatientAnamnesis(id: number, data: any, companyId: number, options?: { changedBy?: number; changeReason?: string; ipAddress?: string }): Promise<any>;
  getAnamnesisVersionHistory(anamnesisId: number, companyId: number): Promise<any[]>;
  getAnamnesisVersion(anamnesisId: number, versionNumber: number, companyId: number): Promise<any | undefined>;

  getPatientExams(patientId: number, companyId: number): Promise<any[]>;
  createPatientExam(data: any): Promise<any>;
  updatePatientExam(id: number, data: any, companyId: number): Promise<any>;
  
  getPatientTreatmentPlans(patientId: number, companyId: number): Promise<any[]>;
  createPatientTreatmentPlan(data: any): Promise<any>;
  updatePatientTreatmentPlan(id: number, data: any, companyId: number): Promise<any>;
  
  getPatientEvolution(patientId: number, companyId: number): Promise<any[]>;
  createPatientEvolution(data: any): Promise<any>;
  
  getPatientPrescriptions(patientId: number, companyId: number): Promise<any[]>;
  createPatientPrescription(data: any): Promise<any>;
  updatePatientPrescription(id: number, data: any, companyId: number): Promise<any>;
  
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
    this.laboratories = new Map();
    this.prosthesisLabels = new Map();
    this.inventoryCategories = new Map();
    this.inventoryItems = new Map();
    this.inventoryTransactions = new Map();
    this.standardDentalProducts = new Map();
    this.patientAnamnesis = new Map();
    this.patientExams = new Map();
    this.treatmentPlans = new Map();
    this.treatmentEvolution = new Map();
    this.prescriptions = new Map();
    
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
    this.laboratoriesIdCounter = 1;
    this.prosthesisLabelsIdCounter = 1;
    this.inventoryCategoriesIdCounter = 1;
    this.inventoryItemsIdCounter = 1;
    this.inventoryTransactionsIdCounter = 1;
    this.anamnesisIdCounter = 1;
    this.examIdCounter = 1;
    this.treatmentPlanIdCounter = 1;
    this.evolutionIdCounter = 1;
    this.prescriptionIdCounter = 1;
    
    // Remover sessionStore que está causando problemas
    // this.sessionStore = new MemoryStore({
    //   checkPeriod: 86400000, // 24 hours
    // });
    
    // Seed initial data
    this.seedData();
  }

  private async seedData() {
    // Create admin user
    await this.createUser({
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
    await this.createUser({
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
    const room1 = await this.createRoom({ name: "Sala 01", description: "Consultório principal", active: true }, 1);
    const room2 = await this.createRoom({ name: "Sala 02", description: "Consultório secundário", active: true }, 1);
    const room3 = await this.createRoom({ name: "Sala 03", description: "Sala de procedimentos", active: true }, 1);

    // Create procedures
    const procedure1 = await this.createProcedure({ name: "Consulta inicial", duration: 30, price: 12000, description: "Avaliação inicial", color: "#1976d2" }, 1);
    const procedure2 = await this.createProcedure({ name: "Limpeza dental", duration: 60, price: 15000, description: "Profilaxia completa", color: "#43a047" }, 1);
    const procedure3 = await this.createProcedure({ name: "Tratamento de canal", duration: 90, price: 30000, description: "Endodontia", color: "#ff5722" }, 1);
    const procedure4 = await this.createProcedure({ name: "Restauração", duration: 60, price: 18000, description: "Restauração em resina", color: "#9c27b0" }, 1);
    const procedure5 = await this.createProcedure({ name: "Extração", duration: 60, price: 20000, description: "Extração simples", color: "#f44336" }, 1);
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
      googleCalendarId: insertUser.googleCalendarId || null,
      googleAccessToken: insertUser.googleAccessToken || null,
      googleRefreshToken: insertUser.googleRefreshToken || null,
      googleTokenExpiry: insertUser.googleTokenExpiry || null,
      wuzapiPhone: insertUser.wuzapiPhone || null,
      cfoRegistrationNumber: insertUser.cfoRegistrationNumber || null,
      cfoState: insertUser.cfoState || null,
      digitalCertificatePath: insertUser.digitalCertificatePath || null,
      trialEndsAt: insertUser.trialEndsAt || null,
      phone: insertUser.phone || null,
      role: insertUser.role || "user",
      profileImageUrl: insertUser.profileImageUrl || null,
      speciality: speciality || null,
      passwordResetToken: null,
      passwordResetExpires: null,
      totpSecret: null,
      totpEnabled: false,
      totpBackupCodes: null,
      deletedAt: null,
      croNumber: null,
      croState: null,
      specialties: null,
      professionalCouncil: null,
    } as User;
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

  // Anamnesis versioning stubs (in-memory storage does not track versions)
  async getAnamnesisVersionHistory(_anamnesisId: number, _companyId: number): Promise<any[]> {
    return [];
  }

  async getAnamnesisVersion(_anamnesisId: number, _versionNumber: number, _companyId: number): Promise<any | undefined> {
    return undefined;
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
        const room = appointment.roomId ? await this.getRoom(appointment.roomId, companyId) : undefined;

        // Get procedures for this appointment
        const appointmentProcedures = Array.from(this.appointmentProcedures.values())
          .filter(ap => ap.appointmentId === appointment.id);

        const procedures = await Promise.all(
          appointmentProcedures.map(async (ap) => this.getProcedure(ap.procedureId, companyId))
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

  async countAppointments(companyId: number, filters?: AppointmentFilters): Promise<number> {
    const all = await this.getAppointments(companyId, filters);
    return all.length;
  }

  async getAppointment(id: number, companyId: number): Promise<any | undefined> {
    const appointment = this.appointments.get(id);
    if (!appointment) return undefined;
    
    // Filter by company if provided
    if (companyId && appointment.companyId !== companyId) return undefined;
    
    // Enrich with related data
    const patient = appointment.patientId ? await this.getPatient(appointment.patientId, companyId || appointment.companyId) : undefined;
    const professional = appointment.professionalId ? await this.getUser(appointment.professionalId) : undefined;
    const room = appointment.roomId ? await this.getRoom(appointment.roomId, companyId || appointment.companyId) : undefined;

    // Get procedures for this appointment
    const appointmentProcedures = Array.from(this.appointmentProcedures.values())
      .filter(ap => ap.appointmentId === appointment.id);

    const procedures = await Promise.all(
      appointmentProcedures.map(async (ap) => this.getProcedure(ap.procedureId, companyId || appointment.companyId))
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

  async deleteAppointment(id: number, companyId: number): Promise<boolean> {
    const appointment = this.appointments.get(id);
    if (!appointment || appointment.companyId !== companyId) {
      return false;
    }

    // Remove appointment
    this.appointments.delete(id);

    // Remove associated appointment procedures
    const appointmentProcedures = Array.from(this.appointmentProcedures.values())
      .filter(ap => ap.appointmentId === id);

    for (const ap of appointmentProcedures) {
      this.appointmentProcedures.delete(ap.id);
    }

    return true;
  }

  async checkAppointmentConflicts(
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

    // Filter appointments from memory
    const conflicts = Array.from(this.appointments.values()).filter((apt) => {
      // Check company
      if (apt.companyId !== companyId) return false;

      // Exclude specific appointment
      if (excludeAppointmentId && apt.id === excludeAppointmentId) return false;

      // Check professional or room
      if (professionalId && apt.professionalId !== professionalId) return false;
      if (roomId && apt.roomId !== roomId) return false;

      // Check time overlap: (start < end AND end > start)
      const aptStart = new Date(apt.startTime);
      const aptEnd = new Date(apt.endTime);
      return aptStart < endTime && aptEnd > startTime;
    });

    // Enrich with names
    return conflicts.map((conflict) => {
      const patient = conflict.patientId
        ? this.patients.get(conflict.patientId)
        : null;
      const professional = conflict.professionalId
        ? this.users.get(conflict.professionalId)
        : null;
      const room = conflict.roomId ? this.rooms.get(conflict.roomId) : null;

      return {
        ...conflict,
        patientName: patient?.fullName || 'Unknown',
        professionalName: professional?.fullName || null,
        roomName: room?.name || null,
        conflictType: professionalId ? 'professional' : 'room',
      };
    });
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

  // Laboratory methods (missing implementations)
  private laboratories: Map<number, Laboratory> = new Map();
  private laboratoriesIdCounter: number = 1;

  async getLaboratories(companyId: number): Promise<Laboratory[]> {
    return Array.from(this.laboratories.values()).filter(lab => lab.companyId === companyId);
  }

  async getLaboratory(id: number, companyId: number): Promise<Laboratory | undefined> {
    const lab = this.laboratories.get(id);
    if (lab && lab.companyId === companyId) {
      return lab;
    }
    return undefined;
  }

  async createLaboratory(laboratory: any): Promise<Laboratory> {
    const id = this.laboratoriesIdCounter++;
    const now = new Date();
    const newLab: Laboratory = {
      ...laboratory,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.laboratories.set(id, newLab);
    return newLab;
  }

  async updateLaboratory(id: number, data: any, companyId: number): Promise<Laboratory> {
    const lab = await this.getLaboratory(id, companyId);
    if (!lab) {
      throw new Error("Laboratory not found");
    }
    
    const updatedLab = {
      ...lab,
      ...data,
      updatedAt: new Date()
    };
    
    this.laboratories.set(id, updatedLab);
    return updatedLab;
  }

  async deleteLaboratory(id: number, companyId: number): Promise<boolean> {
    const lab = await this.getLaboratory(id, companyId);
    if (!lab) {
      return false;
    }
    
    // Soft delete
    const updatedLab = {
      ...lab,
      active: false,
      updatedAt: new Date()
    };
    
    this.laboratories.set(id, updatedLab);
    return true;
  }

  // Prosthesis Label methods (missing implementations)
  private prosthesisLabels: Map<number, ProsthesisLabel> = new Map();
  private prosthesisLabelsIdCounter: number = 1;

  async getProsthesisLabels(companyId: number): Promise<any[]> {
    return Array.from(this.prosthesisLabels.values()).filter(label => label.companyId === companyId);
  }

  async createProsthesisLabel(label: any): Promise<any> {
    const id = this.prosthesisLabelsIdCounter++;
    const now = new Date();
    const newLabel: ProsthesisLabel = {
      ...label,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.prosthesisLabels.set(id, newLabel);
    return newLabel;
  }

  async updateProsthesisLabel(id: number, companyId: number, data: any): Promise<any> {
    const label = this.prosthesisLabels.get(id);
    if (!label || label.companyId !== companyId) {
      throw new Error("Prosthesis label not found");
    }
    
    const updatedLabel = {
      ...label,
      ...data,
      updatedAt: new Date()
    };
    
    this.prosthesisLabels.set(id, updatedLabel);
    return updatedLabel;
  }

  async deleteProsthesisLabel(id: number, companyId: number): Promise<boolean> {
    const label = this.prosthesisLabels.get(id);
    if (!label || label.companyId !== companyId) {
      return false;
    }

    this.prosthesisLabels.delete(id);
    return true;
  }

  // Prosthesis methods (missing implementations)
  private prosthesesMap: Map<number, any> = new Map();
  private prosthesisIdCounter: number = 1;

  async getProsthesis(companyId: number): Promise<any[]> {
    return Array.from(this.prosthesesMap.values()).filter(p => p.companyId === companyId);
  }

  async getProsthesisById(id: number, companyId: number): Promise<any | undefined> {
    const prosthesis = this.prosthesesMap.get(id);
    if (prosthesis && prosthesis.companyId === companyId) {
      return prosthesis;
    }
    return undefined;
  }

  async createProsthesis(data: any): Promise<any> {
    const id = this.prosthesisIdCounter++;
    const now = new Date();
    const newProsthesis = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.prosthesesMap.set(id, newProsthesis);
    return newProsthesis;
  }

  async updateProsthesis(id: number, data: any, companyId: number): Promise<any> {
    const prosthesis = this.prosthesesMap.get(id);
    if (!prosthesis || prosthesis.companyId !== companyId) {
      throw new Error("Prosthesis not found");
    }

    const updatedProsthesis = {
      ...prosthesis,
      ...data,
      updatedAt: new Date()
    };

    this.prosthesesMap.set(id, updatedProsthesis);
    return updatedProsthesis;
  }

  async deleteProsthesis(id: number, companyId: number): Promise<void> {
    const prosthesis = this.prosthesesMap.get(id);
    if (prosthesis && prosthesis.companyId === companyId) {
      this.prosthesesMap.delete(id);
    }
  }

  // Inventory methods (missing implementations)
  private inventoryCategories: Map<number, any> = new Map();
  private inventoryItems: Map<number, any> = new Map();
  private inventoryTransactions: Map<number, any> = new Map();
  private standardDentalProducts: Map<number, StandardDentalProduct> = new Map();
  private inventoryCategoriesIdCounter: number = 1;
  private inventoryItemsIdCounter: number = 1;
  private inventoryTransactionsIdCounter: number = 1;

  async getInventoryCategories(companyId: number): Promise<any[]> {
    return Array.from(this.inventoryCategories.values()).filter(cat => cat.companyId === companyId);
  }

  async createInventoryCategory(data: any): Promise<any> {
    const id = this.inventoryCategoriesIdCounter++;
    const now = new Date();
    const newCategory = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.inventoryCategories.set(id, newCategory);
    return newCategory;
  }

  async updateInventoryCategory(id: number, data: any, companyId: number): Promise<any> {
    const category = this.inventoryCategories.get(id);
    if (!category || category.companyId !== companyId) {
      throw new Error("Inventory category not found");
    }
    
    const updatedCategory = {
      ...category,
      ...data,
      updatedAt: new Date()
    };
    
    this.inventoryCategories.set(id, updatedCategory);
    return updatedCategory;
  }

  async getInventoryItems(companyId: number): Promise<any[]> {
    return Array.from(this.inventoryItems.values()).filter(item => item.companyId === companyId);
  }

  async createInventoryItem(data: any): Promise<any> {
    const id = this.inventoryItemsIdCounter++;
    const now = new Date();
    const newItem = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.inventoryItems.set(id, newItem);
    return newItem;
  }

  async updateInventoryItem(id: number, data: any, companyId: number): Promise<any> {
    const item = this.inventoryItems.get(id);
    if (!item || item.companyId !== companyId) {
      throw new Error("Inventory item not found");
    }
    
    const updatedItem = {
      ...item,
      ...data,
      updatedAt: new Date()
    };
    
    this.inventoryItems.set(id, updatedItem);
    return updatedItem;
  }

  async deleteInventoryItem(id: number, companyId: number): Promise<boolean> {
    const item = this.inventoryItems.get(id);
    if (!item || item.companyId !== companyId) {
      return false;
    }
    
    this.inventoryItems.delete(id);
    return true;
  }

  async getInventoryTransactions(companyId: number, itemId?: number): Promise<any[]> {
    let transactions = Array.from(this.inventoryTransactions.values()).filter(txn => txn.companyId === companyId);
    
    if (itemId) {
      transactions = transactions.filter(txn => txn.itemId === itemId);
    }
    
    return transactions;
  }

  async createInventoryTransaction(data: any): Promise<any> {
    const id = this.inventoryTransactionsIdCounter++;
    const now = new Date();
    const newTransaction = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.inventoryTransactions.set(id, newTransaction);
    return newTransaction;
  }

  async getStandardDentalProducts(): Promise<StandardDentalProduct[]> {
    return Array.from(this.standardDentalProducts.values());
  }

  async importStandardProducts(productIds: number[], companyId: number): Promise<any[]> {
    const importedProducts = [];
    for (const productId of productIds) {
      const product = this.standardDentalProducts.get(productId);
      if (product) {
        const newItem = await this.createInventoryItem({
          ...product,
          companyId,
          quantity: 0
        });
        importedProducts.push(newItem);
      }
    }
    return importedProducts;
  }

  // Dados padrão de estoque para clínica odontológica
  private getDefaultInventoryData() {
    // Categorias padrão de uma clínica odontológica (expandidas)
    const defaultCategories = [
      { name: 'Descartáveis e Consumo', description: 'Luvas, máscaras, algodão, gaze, sugadores, babadores', color: '#3B82F6' },
      { name: 'Anestésicos e Agulhas', description: 'Anestésicos locais, tubetes, agulhas gengivais', color: '#EF4444' },
      { name: 'Medicamentos', description: 'Anti-inflamatórios, antibióticos, analgésicos', color: '#DC2626' },
      { name: 'Materiais de Restauração', description: 'Resinas, adesivos, ionômeros, condicionadores', color: '#10B981' },
      { name: 'Cimentos Odontológicos', description: 'Cimentos resinosos, provisórios, ionômeros', color: '#059669' },
      { name: 'Materiais de Endodontia', description: 'Limas, cones, cimentos endodônticos, irrigantes', color: '#F59E0B' },
      { name: 'Materiais de Moldagem', description: 'Alginato, silicone, gesso, moldeiras', color: '#8B5CF6' },
      { name: 'Instrumentais Rotatórios', description: 'Brocas, pontas diamantadas, discos, polidores', color: '#EC4899' },
      { name: 'EPI e Biossegurança', description: 'Equipamentos de proteção, desinfetantes, esterilização', color: '#06B6D4' },
      { name: 'Material de Prótese', description: 'Ceras, resinas acrílicas, dentes, cimentos', color: '#84CC16' },
      { name: 'Cirurgia e Periodontia', description: 'Fios de sutura, lâminas, hemostáticos', color: '#7C3AED' },
      { name: 'Ortodontia', description: 'Bráquetes, fios, elásticos, ligaduras', color: '#F97316' },
      { name: 'Radiologia', description: 'Filmes, posicionadores, capas para sensor', color: '#64748B' },
      { name: 'Profilaxia e Prevenção', description: 'Pastas profiláticas, flúor, escovas', color: '#0EA5E9' },
    ];

    // Itens padrão por categoria - lista completa baseada em pesquisa
    const defaultItemsByCategory: Record<string, Array<{ name: string; minimumStock: number; unitOfMeasure: string; brand?: string }>> = {
      'Descartáveis e Consumo': [
        // Luvas
        { name: 'Luva de Procedimento Látex P', minimumStock: 100, unitOfMeasure: 'unidade', brand: 'Supermax' },
        { name: 'Luva de Procedimento Látex M', minimumStock: 100, unitOfMeasure: 'unidade', brand: 'Supermax' },
        { name: 'Luva de Procedimento Látex G', minimumStock: 100, unitOfMeasure: 'unidade', brand: 'Supermax' },
        { name: 'Luva de Nitrilo P', minimumStock: 50, unitOfMeasure: 'unidade' },
        { name: 'Luva de Nitrilo M', minimumStock: 50, unitOfMeasure: 'unidade' },
        { name: 'Luva de Nitrilo G', minimumStock: 50, unitOfMeasure: 'unidade' },
        { name: 'Luva Cirúrgica Estéril 7.0', minimumStock: 20, unitOfMeasure: 'par' },
        { name: 'Luva Cirúrgica Estéril 7.5', minimumStock: 20, unitOfMeasure: 'par' },
        { name: 'Luva Cirúrgica Estéril 8.0', minimumStock: 20, unitOfMeasure: 'par' },
        // Máscaras
        { name: 'Máscara Descartável Tripla', minimumStock: 100, unitOfMeasure: 'unidade' },
        { name: 'Máscara N95/PFF2', minimumStock: 20, unitOfMeasure: 'unidade' },
        // Algodão e Gaze
        { name: 'Algodão Rolete', minimumStock: 10, unitOfMeasure: 'pacote' },
        { name: 'Algodão Bola', minimumStock: 5, unitOfMeasure: 'pacote' },
        { name: 'Gaze Estéril 7,5x7,5', minimumStock: 20, unitOfMeasure: 'pacote' },
        { name: 'Compressa de Gaze', minimumStock: 10, unitOfMeasure: 'pacote' },
        // Sugadores e Babadores
        { name: 'Sugador Descartável', minimumStock: 200, unitOfMeasure: 'unidade' },
        { name: 'Babador Descartável Impermeável', minimumStock: 100, unitOfMeasure: 'unidade' },
        { name: 'Guardanapo de Papel', minimumStock: 100, unitOfMeasure: 'unidade' },
        // Outros descartáveis
        { name: 'Copo Descartável 50ml', minimumStock: 200, unitOfMeasure: 'unidade' },
        { name: 'Copo Descartável 200ml', minimumStock: 100, unitOfMeasure: 'unidade' },
        { name: 'Toalha de Papel', minimumStock: 10, unitOfMeasure: 'rolo' },
        { name: 'Lençol de Borracha (Isolamento)', minimumStock: 20, unitOfMeasure: 'unidade' },
        { name: 'Dappen Descartável', minimumStock: 50, unitOfMeasure: 'unidade' },
        { name: 'Aplicador Descartável (Microbrush)', minimumStock: 100, unitOfMeasure: 'unidade' },
        { name: 'Seringa Descartável 5ml', minimumStock: 50, unitOfMeasure: 'unidade' },
        { name: 'Seringa Descartável 10ml', minimumStock: 50, unitOfMeasure: 'unidade' },
        { name: 'Seringa Descartável 20ml', minimumStock: 30, unitOfMeasure: 'unidade' },
      ],
      'Anestésicos e Agulhas': [
        // Anestésicos
        { name: 'Lidocaína 2% c/ Epinefrina 1:100.000', minimumStock: 50, unitOfMeasure: 'tubete', brand: 'DFL' },
        { name: 'Lidocaína 2% c/ Epinefrina 1:50.000', minimumStock: 20, unitOfMeasure: 'tubete', brand: 'DFL' },
        { name: 'Mepivacaína 3% s/ Vasoconstritor', minimumStock: 30, unitOfMeasure: 'tubete', brand: 'DFL' },
        { name: 'Mepivacaína 2% c/ Epinefrina', minimumStock: 20, unitOfMeasure: 'tubete', brand: 'DFL' },
        { name: 'Articaína 4% c/ Epinefrina 1:100.000', minimumStock: 50, unitOfMeasure: 'tubete', brand: 'DFL' },
        { name: 'Articaína 4% c/ Epinefrina 1:200.000', minimumStock: 30, unitOfMeasure: 'tubete', brand: 'DFL' },
        { name: 'Prilocaína 3% c/ Felipressina', minimumStock: 20, unitOfMeasure: 'tubete', brand: 'DFL' },
        { name: 'Anestésico Tópico Benzocaína 20%', minimumStock: 5, unitOfMeasure: 'pote' },
        { name: 'Anestésico Tópico Gel Tutti-Frutti', minimumStock: 3, unitOfMeasure: 'bisnaga' },
        // Agulhas
        { name: 'Agulha Gengival Curta 30G', minimumStock: 100, unitOfMeasure: 'unidade' },
        { name: 'Agulha Gengival Longa 27G', minimumStock: 100, unitOfMeasure: 'unidade' },
        { name: 'Agulha Gengival Extra-Curta 30G', minimumStock: 50, unitOfMeasure: 'unidade' },
      ],
      'Medicamentos': [
        // Anti-inflamatórios
        { name: 'Ibuprofeno 600mg', minimumStock: 50, unitOfMeasure: 'comprimido' },
        { name: 'Nimesulida 100mg', minimumStock: 50, unitOfMeasure: 'comprimido' },
        { name: 'Diclofenaco Sódico 50mg', minimumStock: 30, unitOfMeasure: 'comprimido' },
        { name: 'Dexametasona 4mg', minimumStock: 20, unitOfMeasure: 'comprimido' },
        // Analgésicos
        { name: 'Paracetamol 750mg', minimumStock: 50, unitOfMeasure: 'comprimido' },
        { name: 'Dipirona 500mg', minimumStock: 50, unitOfMeasure: 'comprimido' },
        // Antibióticos
        { name: 'Amoxicilina 500mg', minimumStock: 30, unitOfMeasure: 'cápsula' },
        { name: 'Amoxicilina + Clavulanato 875mg', minimumStock: 20, unitOfMeasure: 'comprimido' },
        { name: 'Azitromicina 500mg', minimumStock: 15, unitOfMeasure: 'comprimido' },
        { name: 'Metronidazol 400mg', minimumStock: 20, unitOfMeasure: 'comprimido' },
        { name: 'Clindamicina 300mg', minimumStock: 15, unitOfMeasure: 'cápsula' },
      ],
      'Materiais de Restauração': [
        // Resinas Compostas
        { name: 'Resina Composta A1', minimumStock: 3, unitOfMeasure: 'seringa', brand: '3M Filtek' },
        { name: 'Resina Composta A2', minimumStock: 5, unitOfMeasure: 'seringa', brand: '3M Filtek' },
        { name: 'Resina Composta A3', minimumStock: 5, unitOfMeasure: 'seringa', brand: '3M Filtek' },
        { name: 'Resina Composta A3.5', minimumStock: 3, unitOfMeasure: 'seringa', brand: '3M Filtek' },
        { name: 'Resina Composta B1', minimumStock: 2, unitOfMeasure: 'seringa', brand: '3M Filtek' },
        { name: 'Resina Composta B2', minimumStock: 2, unitOfMeasure: 'seringa', brand: '3M Filtek' },
        { name: 'Resina Composta C2', minimumStock: 2, unitOfMeasure: 'seringa', brand: '3M Filtek' },
        { name: 'Resina Flow A2', minimumStock: 3, unitOfMeasure: 'seringa' },
        { name: 'Resina Flow A3', minimumStock: 3, unitOfMeasure: 'seringa' },
        { name: 'Resina Bulk Fill', minimumStock: 2, unitOfMeasure: 'seringa', brand: '3M' },
        // Adesivos
        { name: 'Adesivo Single Bond Universal', minimumStock: 2, unitOfMeasure: 'frasco', brand: '3M' },
        { name: 'Adesivo Prime & Bond', minimumStock: 2, unitOfMeasure: 'frasco', brand: 'Dentsply' },
        { name: 'Adesivo Ambar Universal', minimumStock: 2, unitOfMeasure: 'frasco', brand: 'FGM' },
        // Condicionadores
        { name: 'Ácido Fosfórico 37%', minimumStock: 10, unitOfMeasure: 'seringa' },
        { name: 'Ácido Fluorídrico 10%', minimumStock: 3, unitOfMeasure: 'seringa' },
        { name: 'Silano', minimumStock: 2, unitOfMeasure: 'frasco' },
        // Ionômeros
        { name: 'Ionômero de Vidro Restaurador', minimumStock: 2, unitOfMeasure: 'kit', brand: 'FGM' },
        { name: 'Ionômero de Vidro Forrador', minimumStock: 2, unitOfMeasure: 'kit' },
        { name: 'Ionômero de Vidro Fotopolimerizável', minimumStock: 2, unitOfMeasure: 'kit' },
        // Acabamento e Polimento
        { name: 'Tira de Lixa Aço', minimumStock: 20, unitOfMeasure: 'unidade' },
        { name: 'Tira de Lixa Poliéster', minimumStock: 20, unitOfMeasure: 'unidade' },
        { name: 'Disco Soflex (kit cores)', minimumStock: 2, unitOfMeasure: 'kit', brand: '3M' },
        { name: 'Papel Carbono Oclusal', minimumStock: 3, unitOfMeasure: 'bloco' },
        { name: 'Matriz Metálica', minimumStock: 20, unitOfMeasure: 'unidade' },
        { name: 'Cunha de Madeira', minimumStock: 50, unitOfMeasure: 'unidade' },
      ],
      'Cimentos Odontológicos': [
        { name: 'Cimento Resinoso Dual AllCem', minimumStock: 2, unitOfMeasure: 'kit', brand: 'FGM' },
        { name: 'Cimento Resinoso RelyX U200', minimumStock: 2, unitOfMeasure: 'kit', brand: '3M' },
        { name: 'Cimento de Ionômero para Cimentação', minimumStock: 2, unitOfMeasure: 'kit' },
        { name: 'Cimento de Zinco (Provisório)', minimumStock: 2, unitOfMeasure: 'kit' },
        { name: 'Cimento de Óxido de Zinco e Eugenol', minimumStock: 2, unitOfMeasure: 'kit' },
        { name: 'Cimento Fosfato de Zinco', minimumStock: 1, unitOfMeasure: 'kit' },
        { name: 'Hidróxido de Cálcio PA', minimumStock: 2, unitOfMeasure: 'pote' },
        { name: 'Hidróxido de Cálcio Fotopolimerizável', minimumStock: 2, unitOfMeasure: 'seringa' },
      ],
      'Materiais de Endodontia': [
        // Limas Manuais
        { name: 'Lima K #08', minimumStock: 10, unitOfMeasure: 'unidade' },
        { name: 'Lima K #10', minimumStock: 10, unitOfMeasure: 'unidade' },
        { name: 'Lima K #15', minimumStock: 15, unitOfMeasure: 'unidade' },
        { name: 'Lima K #20', minimumStock: 15, unitOfMeasure: 'unidade' },
        { name: 'Lima K #25', minimumStock: 15, unitOfMeasure: 'unidade' },
        { name: 'Lima K #30', minimumStock: 10, unitOfMeasure: 'unidade' },
        { name: 'Lima K #35', minimumStock: 10, unitOfMeasure: 'unidade' },
        { name: 'Lima K #40', minimumStock: 10, unitOfMeasure: 'unidade' },
        { name: 'Lima Hedstrom #15', minimumStock: 5, unitOfMeasure: 'unidade' },
        { name: 'Lima Hedstrom #20', minimumStock: 5, unitOfMeasure: 'unidade' },
        // Cones
        { name: 'Cone de Guta-Percha Principal (sortido)', minimumStock: 5, unitOfMeasure: 'caixa' },
        { name: 'Cone de Guta-Percha Acessório FM', minimumStock: 3, unitOfMeasure: 'caixa' },
        { name: 'Cone de Guta-Percha Acessório FF', minimumStock: 3, unitOfMeasure: 'caixa' },
        { name: 'Cone de Papel Absorvente', minimumStock: 5, unitOfMeasure: 'caixa' },
        // Cimentos e Irrigantes
        { name: 'Cimento Endodôntico AH Plus', minimumStock: 1, unitOfMeasure: 'kit', brand: 'Dentsply' },
        { name: 'Cimento Endodôntico Sealer 26', minimumStock: 1, unitOfMeasure: 'kit' },
        { name: 'Hipoclorito de Sódio 1%', minimumStock: 5, unitOfMeasure: 'litro' },
        { name: 'Hipoclorito de Sódio 2,5%', minimumStock: 5, unitOfMeasure: 'litro' },
        { name: 'Hipoclorito de Sódio 5,25%', minimumStock: 3, unitOfMeasure: 'litro' },
        { name: 'EDTA 17%', minimumStock: 5, unitOfMeasure: 'frasco' },
        { name: 'Clorexidina 2% Solução', minimumStock: 3, unitOfMeasure: 'frasco' },
        { name: 'Pasta de Hidróxido de Cálcio', minimumStock: 3, unitOfMeasure: 'seringa' },
        { name: 'Soro Fisiológico', minimumStock: 10, unitOfMeasure: 'frasco' },
      ],
      'Materiais de Moldagem': [
        // Alginato
        { name: 'Alginato Tipo I (presa rápida)', minimumStock: 5, unitOfMeasure: 'pacote' },
        { name: 'Alginato Tipo II (presa normal)', minimumStock: 5, unitOfMeasure: 'pacote' },
        // Silicones
        { name: 'Silicone de Adição Pesado (putty)', minimumStock: 2, unitOfMeasure: 'kit' },
        { name: 'Silicone de Adição Leve (light)', minimumStock: 3, unitOfMeasure: 'cartucho' },
        { name: 'Silicone de Condensação Pesado', minimumStock: 2, unitOfMeasure: 'kit' },
        { name: 'Silicone de Condensação Leve', minimumStock: 2, unitOfMeasure: 'kit' },
        // Gessos
        { name: 'Gesso Comum Tipo II', minimumStock: 5, unitOfMeasure: 'kg' },
        { name: 'Gesso Pedra Tipo III', minimumStock: 5, unitOfMeasure: 'kg' },
        { name: 'Gesso Especial Tipo IV', minimumStock: 3, unitOfMeasure: 'kg' },
        { name: 'Gesso Tipo V (Extra-duro)', minimumStock: 2, unitOfMeasure: 'kg' },
        // Moldeiras e Acessórios
        { name: 'Moldeira Descartável Superior P', minimumStock: 20, unitOfMeasure: 'unidade' },
        { name: 'Moldeira Descartável Superior M', minimumStock: 30, unitOfMeasure: 'unidade' },
        { name: 'Moldeira Descartável Superior G', minimumStock: 20, unitOfMeasure: 'unidade' },
        { name: 'Moldeira Descartável Inferior P', minimumStock: 20, unitOfMeasure: 'unidade' },
        { name: 'Moldeira Descartável Inferior M', minimumStock: 30, unitOfMeasure: 'unidade' },
        { name: 'Moldeira Descartável Inferior G', minimumStock: 20, unitOfMeasure: 'unidade' },
        { name: 'Fio Retrator #000', minimumStock: 3, unitOfMeasure: 'frasco' },
        { name: 'Fio Retrator #00', minimumStock: 3, unitOfMeasure: 'frasco' },
        { name: 'Fio Retrator #0', minimumStock: 3, unitOfMeasure: 'frasco' },
        { name: 'Fio Retrator #1', minimumStock: 3, unitOfMeasure: 'frasco' },
      ],
      'Instrumentais Rotatórios': [
        // Brocas Carbide
        { name: 'Broca Carbide Esférica FG 1/4', minimumStock: 5, unitOfMeasure: 'unidade' },
        { name: 'Broca Carbide Esférica FG 1/2', minimumStock: 5, unitOfMeasure: 'unidade' },
        { name: 'Broca Carbide Esférica FG 1', minimumStock: 5, unitOfMeasure: 'unidade' },
        { name: 'Broca Carbide Esférica FG 2', minimumStock: 5, unitOfMeasure: 'unidade' },
        { name: 'Broca Carbide Esférica FG 4', minimumStock: 5, unitOfMeasure: 'unidade' },
        { name: 'Broca Carbide Esférica FG 6', minimumStock: 5, unitOfMeasure: 'unidade' },
        { name: 'Broca Carbide Cilíndrica FG 56', minimumStock: 5, unitOfMeasure: 'unidade' },
        { name: 'Broca Carbide Cilíndrica FG 57', minimumStock: 5, unitOfMeasure: 'unidade' },
        // Pontas Diamantadas
        { name: 'Ponta Diamantada 1011 (esférica)', minimumStock: 5, unitOfMeasure: 'unidade', brand: 'KG Sorensen' },
        { name: 'Ponta Diamantada 1012 (esférica)', minimumStock: 5, unitOfMeasure: 'unidade', brand: 'KG Sorensen' },
        { name: 'Ponta Diamantada 1014 (esférica)', minimumStock: 5, unitOfMeasure: 'unidade', brand: 'KG Sorensen' },
        { name: 'Ponta Diamantada 2135 (tronco-cônica)', minimumStock: 5, unitOfMeasure: 'unidade', brand: 'KG Sorensen' },
        { name: 'Ponta Diamantada 3118 (chama)', minimumStock: 5, unitOfMeasure: 'unidade', brand: 'KG Sorensen' },
        { name: 'Ponta Diamantada 4138 (pêra)', minimumStock: 5, unitOfMeasure: 'unidade', brand: 'KG Sorensen' },
        { name: 'Ponta Diamantada 1190 (cilíndrica)', minimumStock: 5, unitOfMeasure: 'unidade', brand: 'KG Sorensen' },
        // Acabamento e Polimento
        { name: 'Disco de Lixa (kit granulações)', minimumStock: 3, unitOfMeasure: 'kit' },
        { name: 'Disco Diamantado Dupla Face', minimumStock: 5, unitOfMeasure: 'unidade' },
        { name: 'Taça de Borracha para Polimento', minimumStock: 10, unitOfMeasure: 'unidade' },
        { name: 'Escova de Robinson', minimumStock: 10, unitOfMeasure: 'unidade' },
        { name: 'Pedra Montada Branca', minimumStock: 5, unitOfMeasure: 'unidade' },
        { name: 'Ponta de Silicone para Polimento', minimumStock: 10, unitOfMeasure: 'unidade' },
        { name: 'Pasta de Polimento Diamantada', minimumStock: 2, unitOfMeasure: 'seringa' },
      ],
      'EPI e Biossegurança': [
        // EPIs
        { name: 'Óculos de Proteção', minimumStock: 5, unitOfMeasure: 'unidade' },
        { name: 'Protetor Facial (Face Shield)', minimumStock: 3, unitOfMeasure: 'unidade' },
        { name: 'Gorro Descartável', minimumStock: 100, unitOfMeasure: 'unidade' },
        { name: 'Propé Descartável', minimumStock: 100, unitOfMeasure: 'par' },
        { name: 'Avental Descartável', minimumStock: 50, unitOfMeasure: 'unidade' },
        { name: 'Avental de Chumbo (uso radiografia)', minimumStock: 2, unitOfMeasure: 'unidade' },
        // Desinfetantes
        { name: 'Álcool 70% Líquido', minimumStock: 10, unitOfMeasure: 'litro' },
        { name: 'Álcool 70% Gel', minimumStock: 5, unitOfMeasure: 'litro' },
        { name: 'Glutaraldeído 2%', minimumStock: 5, unitOfMeasure: 'litro' },
        { name: 'Hipoclorito de Sódio 1% (desinfecção)', minimumStock: 5, unitOfMeasure: 'litro' },
        { name: 'Quaternário de Amônio', minimumStock: 3, unitOfMeasure: 'litro' },
        { name: 'Spray Desinfetante Superfícies', minimumStock: 5, unitOfMeasure: 'frasco' },
        // Esterilização
        { name: 'Papel Grau Cirúrgico (rolo)', minimumStock: 5, unitOfMeasure: 'rolo' },
        { name: 'Indicador Biológico', minimumStock: 10, unitOfMeasure: 'unidade' },
        { name: 'Fita para Autoclave', minimumStock: 5, unitOfMeasure: 'rolo' },
        { name: 'Água Destilada', minimumStock: 10, unitOfMeasure: 'litro' },
        // Descarte
        { name: 'Coletor Perfurocortante 7L', minimumStock: 3, unitOfMeasure: 'unidade' },
        { name: 'Saco de Lixo Infectante Branco', minimumStock: 50, unitOfMeasure: 'unidade' },
      ],
      'Material de Prótese': [
        // Ceras
        { name: 'Cera Utilidade', minimumStock: 5, unitOfMeasure: 'caixa' },
        { name: 'Cera 7 (escultura)', minimumStock: 5, unitOfMeasure: 'caixa' },
        { name: 'Cera Rosa (base)', minimumStock: 3, unitOfMeasure: 'caixa' },
        // Resinas Acrílicas
        { name: 'Resina Acrílica Autopolimerizável (pó)', minimumStock: 2, unitOfMeasure: 'pote' },
        { name: 'Resina Acrílica Autopolimerizável (líquido)', minimumStock: 2, unitOfMeasure: 'frasco' },
        { name: 'Resina Acrílica Termopolimerizável (pó)', minimumStock: 2, unitOfMeasure: 'pote' },
        { name: 'Resina Acrílica Termopolimerizável (líquido)', minimumStock: 2, unitOfMeasure: 'frasco' },
        // Dentes
        { name: 'Dentes de Estoque Anteriores', minimumStock: 5, unitOfMeasure: 'cartela' },
        { name: 'Dentes de Estoque Posteriores', minimumStock: 5, unitOfMeasure: 'cartela' },
        // Cimentos e Acessórios
        { name: 'Cimento Provisório (Temp Bond)', minimumStock: 2, unitOfMeasure: 'kit' },
        { name: 'Adesivo para Prótese', minimumStock: 3, unitOfMeasure: 'tubo' },
        { name: 'Pino de Fibra de Vidro (kit)', minimumStock: 1, unitOfMeasure: 'kit' },
        { name: 'Pasta Zinco-Enólica', minimumStock: 2, unitOfMeasure: 'kit' },
      ],
      'Cirurgia e Periodontia': [
        // Fios de Sutura
        { name: 'Fio de Sutura Seda 3-0', minimumStock: 20, unitOfMeasure: 'unidade' },
        { name: 'Fio de Sutura Seda 4-0', minimumStock: 20, unitOfMeasure: 'unidade' },
        { name: 'Fio de Sutura Nylon 3-0', minimumStock: 10, unitOfMeasure: 'unidade' },
        { name: 'Fio de Sutura Nylon 4-0', minimumStock: 10, unitOfMeasure: 'unidade' },
        { name: 'Fio de Sutura Nylon 5-0', minimumStock: 10, unitOfMeasure: 'unidade' },
        { name: 'Fio de Sutura Vicryl 4-0', minimumStock: 10, unitOfMeasure: 'unidade' },
        // Lâminas e Hemostáticos
        { name: 'Lâmina de Bisturi #15', minimumStock: 20, unitOfMeasure: 'unidade' },
        { name: 'Lâmina de Bisturi #15C', minimumStock: 10, unitOfMeasure: 'unidade' },
        { name: 'Lâmina de Bisturi #12', minimumStock: 10, unitOfMeasure: 'unidade' },
        { name: 'Esponja Hemostática', minimumStock: 10, unitOfMeasure: 'unidade' },
        { name: 'Solução Hemostática', minimumStock: 3, unitOfMeasure: 'frasco' },
        // Periodontia
        { name: 'Clorexidina 0,12% (bochecho)', minimumStock: 10, unitOfMeasure: 'frasco' },
        { name: 'Pasta Profilática Fina', minimumStock: 5, unitOfMeasure: 'pote' },
        { name: 'Pasta Profilática Grossa', minimumStock: 3, unitOfMeasure: 'pote' },
        { name: 'Bicarbonato de Sódio (jateamento)', minimumStock: 3, unitOfMeasure: 'pacote' },
      ],
      'Ortodontia': [
        // Bráquetes
        { name: 'Bráquete Metálico Roth (kit)', minimumStock: 5, unitOfMeasure: 'kit' },
        { name: 'Bráquete Estético Cerâmico (kit)', minimumStock: 2, unitOfMeasure: 'kit' },
        { name: 'Tubo Molar Simples', minimumStock: 20, unitOfMeasure: 'unidade' },
        { name: 'Tubo Molar Duplo', minimumStock: 10, unitOfMeasure: 'unidade' },
        // Fios
        { name: 'Fio NiTi 0.014"', minimumStock: 10, unitOfMeasure: 'unidade' },
        { name: 'Fio NiTi 0.016"', minimumStock: 10, unitOfMeasure: 'unidade' },
        { name: 'Fio NiTi 0.018"', minimumStock: 10, unitOfMeasure: 'unidade' },
        { name: 'Fio de Aço 0.016"', minimumStock: 10, unitOfMeasure: 'unidade' },
        { name: 'Fio de Aço 0.018"', minimumStock: 10, unitOfMeasure: 'unidade' },
        { name: 'Fio de Aço 0.020"', minimumStock: 10, unitOfMeasure: 'unidade' },
        // Elásticos e Ligaduras
        { name: 'Elástico Corrente', minimumStock: 5, unitOfMeasure: 'carretel' },
        { name: 'Elástico Intermaxilar (kit tamanhos)', minimumStock: 3, unitOfMeasure: 'kit' },
        { name: 'Ligadura Elástica Colorida', minimumStock: 10, unitOfMeasure: 'cartela' },
        { name: 'Ligadura Metálica', minimumStock: 5, unitOfMeasure: 'carretel' },
        // Acessórios
        { name: 'Cera para Ortodontia', minimumStock: 20, unitOfMeasure: 'estojo' },
        { name: 'Cola Ortodôntica (Resina)', minimumStock: 3, unitOfMeasure: 'kit' },
        { name: 'Banda Ortodôntica (kit)', minimumStock: 2, unitOfMeasure: 'kit' },
        { name: 'Mola Aberta NiTi', minimumStock: 10, unitOfMeasure: 'unidade' },
      ],
      'Radiologia': [
        { name: 'Filme Radiográfico Periapical #2', minimumStock: 50, unitOfMeasure: 'unidade' },
        { name: 'Filme Radiográfico Periapical #0 (infantil)', minimumStock: 20, unitOfMeasure: 'unidade' },
        { name: 'Capa Plástica para Sensor Digital', minimumStock: 100, unitOfMeasure: 'unidade' },
        { name: 'Posicionador Radiográfico (kit)', minimumStock: 2, unitOfMeasure: 'kit' },
        { name: 'Revelador Radiográfico', minimumStock: 3, unitOfMeasure: 'litro' },
        { name: 'Fixador Radiográfico', minimumStock: 3, unitOfMeasure: 'litro' },
        { name: 'Envelope para Filme Periapical', minimumStock: 50, unitOfMeasure: 'unidade' },
      ],
      'Profilaxia e Prevenção': [
        { name: 'Flúor Gel Acidulado 1,23%', minimumStock: 5, unitOfMeasure: 'frasco' },
        { name: 'Flúor Gel Neutro', minimumStock: 3, unitOfMeasure: 'frasco' },
        { name: 'Verniz de Flúor', minimumStock: 3, unitOfMeasure: 'frasco' },
        { name: 'Moldeira para Flúor Descartável', minimumStock: 50, unitOfMeasure: 'unidade' },
        { name: 'Selante Resinoso', minimumStock: 3, unitOfMeasure: 'seringa' },
        { name: 'Escova Dental Adulto', minimumStock: 50, unitOfMeasure: 'unidade' },
        { name: 'Escova Dental Infantil', minimumStock: 30, unitOfMeasure: 'unidade' },
        { name: 'Fio Dental', minimumStock: 20, unitOfMeasure: 'unidade' },
        { name: 'Evidenciador de Placa', minimumStock: 5, unitOfMeasure: 'frasco' },
        { name: 'Enxaguante Bucal', minimumStock: 10, unitOfMeasure: 'frasco' },
      ],
    };

    return { defaultCategories, defaultItemsByCategory };
  }

  // Retorna os dados de seed disponíveis para seleção
  getInventorySeedData(): {
    categories: Array<{ name: string; description: string; color: string; items: Array<{ name: string; minimumStock: number; unitOfMeasure: string; brand?: string }> }>;
  } {
    const { defaultCategories, defaultItemsByCategory } = this.getDefaultInventoryData();

    return {
      categories: defaultCategories.map(cat => ({
        ...cat,
        items: defaultItemsByCategory[cat.name] || []
      }))
    };
  }

  // Popula o estoque com categorias e itens selecionados
  async seedInventoryDefaults(
    companyId: number,
    selection?: { categoryNames: string[]; itemsByCategory?: Record<string, string[]> }
  ): Promise<{ categories: any[], items: any[] }> {
    // Verifica se já existem categorias para esta empresa
    const existingCategories = await this.getInventoryCategories(companyId);
    if (existingCategories.length > 0) {
      throw new Error('Esta empresa já possui categorias de estoque cadastradas');
    }

    const { defaultCategories, defaultItemsByCategory } = this.getDefaultInventoryData();

    // Filtrar categorias baseado na seleção
    let categoriesToCreate = defaultCategories;
    if (selection?.categoryNames && selection.categoryNames.length > 0) {
      categoriesToCreate = defaultCategories.filter(cat =>
        selection.categoryNames.includes(cat.name)
      );
    }

    const createdCategories: any[] = [];
    const createdItems: any[] = [];

    // Criar categorias e seus itens
    for (const categoryData of categoriesToCreate) {
      const category = await this.createInventoryCategory({
        ...categoryData,
        companyId,
      });
      createdCategories.push(category);

      // Criar itens para esta categoria
      let itemsForCategory = defaultItemsByCategory[categoryData.name] || [];

      // Filtrar itens se houver seleção específica
      if (selection?.itemsByCategory && selection.itemsByCategory[categoryData.name]) {
        const selectedItemNames = selection.itemsByCategory[categoryData.name];
        itemsForCategory = itemsForCategory.filter(item =>
          selectedItemNames.includes(item.name)
        );
      }

      for (const itemData of itemsForCategory) {
        const item = await this.createInventoryItem({
          ...itemData,
          categoryId: category.id,
          companyId,
          currentStock: 0,
          price: 0,
        });
        createdItems.push(item);
      }
    }

    return { categories: createdCategories, items: createdItems };
  }

  // Digital Patient Record methods (missing implementations)
  private patientAnamnesis: Map<number, Anamnesis> = new Map();
  private patientExams: Map<number, PatientExam> = new Map();
  private treatmentPlans: Map<number, DetailedTreatmentPlan> = new Map();
  private treatmentEvolution: Map<number, TreatmentEvolution> = new Map();
  private prescriptions: Map<number, Prescription> = new Map();
  private anamnesisIdCounter: number = 1;
  private examIdCounter: number = 1;
  private treatmentPlanIdCounter: number = 1;
  private evolutionIdCounter: number = 1;
  private prescriptionIdCounter: number = 1;

  async getPatientAnamnesis(patientId: number, companyId: number): Promise<any | undefined> {
    return Array.from(this.patientAnamnesis.values()).find(anamnesis => 
      anamnesis.patientId === patientId && anamnesis.companyId === companyId
    );
  }

  async createPatientAnamnesis(data: any): Promise<any> {
    const id = this.anamnesisIdCounter++;
    const now = new Date();
    const newAnamnesis = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.patientAnamnesis.set(id, newAnamnesis);
    return newAnamnesis;
  }

  async updatePatientAnamnesis(id: number, data: any, companyId: number): Promise<any> {
    const anamnesis = this.patientAnamnesis.get(id);
    if (!anamnesis || anamnesis.companyId !== companyId) {
      throw new Error("Anamnesis not found");
    }
    
    const updatedAnamnesis = {
      ...anamnesis,
      ...data,
      updatedAt: new Date()
    };
    
    this.patientAnamnesis.set(id, updatedAnamnesis);
    return updatedAnamnesis;
  }

  async getPatientExams(patientId: number, companyId: number): Promise<any[]> {
    return Array.from(this.patientExams.values()).filter(exam => 
      exam.patientId === patientId && exam.companyId === companyId
    );
  }

  async createPatientExam(data: any): Promise<any> {
    const id = this.examIdCounter++;
    const now = new Date();
    const newExam = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.patientExams.set(id, newExam);
    return newExam;
  }

  async updatePatientExam(id: number, data: any, companyId: number): Promise<any> {
    const exam = this.patientExams.get(id);
    if (!exam || exam.companyId !== companyId) {
      throw new Error("Exam not found");
    }
    
    const updatedExam = {
      ...exam,
      ...data,
      updatedAt: new Date()
    };
    
    this.patientExams.set(id, updatedExam);
    return updatedExam;
  }

  async getPatientTreatmentPlans(patientId: number, companyId: number): Promise<any[]> {
    return Array.from(this.treatmentPlans.values()).filter(plan => 
      plan.patientId === patientId && plan.companyId === companyId
    );
  }

  async createPatientTreatmentPlan(data: any): Promise<any> {
    const id = this.treatmentPlanIdCounter++;
    const now = new Date();
    const newPlan = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.treatmentPlans.set(id, newPlan);
    return newPlan;
  }

  async updatePatientTreatmentPlan(id: number, data: any, companyId: number): Promise<any> {
    const plan = this.treatmentPlans.get(id);
    if (!plan || plan.companyId !== companyId) {
      throw new Error("Treatment plan not found");
    }
    
    const updatedPlan = {
      ...plan,
      ...data,
      updatedAt: new Date()
    };
    
    this.treatmentPlans.set(id, updatedPlan);
    return updatedPlan;
  }

  async getPatientEvolution(patientId: number, companyId: number): Promise<any[]> {
    return Array.from(this.treatmentEvolution.values()).filter(evolution => 
      evolution.patientId === patientId && evolution.companyId === companyId
    );
  }

  async createPatientEvolution(data: any): Promise<any> {
    const id = this.evolutionIdCounter++;
    const now = new Date();
    const newEvolution = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.treatmentEvolution.set(id, newEvolution);
    return newEvolution;
  }

  async getPatientPrescriptions(patientId: number, companyId: number): Promise<any[]> {
    return Array.from(this.prescriptions.values()).filter(prescription => 
      prescription.patientId === patientId && prescription.companyId === companyId
    );
  }

  async createPatientPrescription(data: any): Promise<any> {
    const id = this.prescriptionIdCounter++;
    const now = new Date();
    const newPrescription = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.prescriptions.set(id, newPrescription);
    return newPrescription;
  }

  async updatePatientPrescription(id: number, data: any, companyId: number): Promise<any> {
    const prescription = this.prescriptions.get(id);
    if (!prescription || prescription.companyId !== companyId) {
      throw new Error("Prescription not found");
    }
    
    const updatedPrescription = {
      ...prescription,
      ...data,
      updatedAt: new Date()
    };
    
    this.prescriptions.set(id, updatedPrescription);
    return updatedPrescription;
  }

  // Fix method signatures to match interface
  async getOdontogramEntries(patientId: number, companyId: number): Promise<OdontogramEntry[]> {
    return Array.from(this.odontogramEntries.values())
      .filter(entry => entry.patientId === patientId && entry.companyId === companyId);
  }

  async createOdontogramEntry(entry: any, companyId: number): Promise<OdontogramEntry> {
    const id = this.odontogramEntryIdCounter++;
    const now = new Date();
    const newEntry: OdontogramEntry = {
      ...entry,
      id,
      companyId,
      createdAt: now,
      updatedAt: now
    };
    this.odontogramEntries.set(id, newEntry);
    return newEntry;
  }

  async getPatientRecords(patientId: number, companyId: number): Promise<PatientRecord[]> {
    return Array.from(this.patientRecords.values())
      .filter(record => record.patientId === patientId && record.companyId === companyId);
  }

  async createPatientRecord(record: any, companyId: number): Promise<PatientRecord> {
    const id = this.patientRecordIdCounter++;
    const now = new Date();
    const newRecord: PatientRecord = {
      ...record,
      id,
      companyId,
      createdAt: now,
      updatedAt: now
    };
    this.patientRecords.set(id, newRecord);
    return newRecord;
  }

  async getTransactions(companyId: number): Promise<Transaction[]> {
    return Array.from(this.transactions.values()).filter((txn: any) => txn.companyId === companyId);
  }

  async createTransaction(transaction: any, companyId: number): Promise<Transaction> {
    const id = this.transactionIdCounter++;
    const now = new Date();
    const newTransaction: Transaction = {
      ...transaction,
      id,
      companyId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    this.transactions.set(id, newTransaction);
    return newTransaction;
  }

  async getProfessionals(companyId: number): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => 
      user.companyId === companyId && (user.role === 'dentist' || user.role === 'admin')
    );
  }

  async getRooms(companyId: number): Promise<Room[]> {
    return Array.from(this.rooms.values()).filter((room: any) =>
      room.companyId === companyId && room.active !== false
    );
  }

  async getRoom(id: number, companyId: number): Promise<Room | undefined> {
    const room = this.rooms.get(id);
    if (!room || (room as any).companyId !== companyId) {
      return undefined;
    }
    return room;
  }

  async createRoom(data: any, companyId: number): Promise<Room> {
    const id = this.roomIdCounter++;
    const now = new Date();
    const room: Room = {
      ...data,
      id,
      companyId,
      active: data.active !== undefined ? data.active : true,
      createdAt: now,
      updatedAt: now,
    };
    this.rooms.set(id, room);
    return room;
  }

  async updateRoom(id: number, data: any, companyId: number): Promise<Room> {
    const room = this.rooms.get(id);
    if (!room || (room as any).companyId !== companyId) {
      throw new Error('Room not found or access denied');
    }

    const now = new Date();
    const updatedRoom: Room = {
      ...room,
      ...data,
      id,
      companyId,
      updatedAt: now,
    };
    this.rooms.set(id, updatedRoom);
    return updatedRoom;
  }

  async deleteRoom(id: number, companyId: number): Promise<boolean> {
    const room = this.rooms.get(id);
    if (!room || (room as any).companyId !== companyId) {
      return false;
    }

    // Soft delete
    const updatedRoom: Room = {
      ...room,
      active: false,
      updatedAt: new Date(),
    };
    this.rooms.set(id, updatedRoom);
    return true;
  }

  async getProcedures(companyId: number): Promise<Procedure[]> {
    return Array.from(this.procedures.values()).filter((procedure: any) =>
      procedure.companyId === companyId && procedure.active !== false
    );
  }

  async getProcedure(id: number, companyId: number): Promise<Procedure | undefined> {
    const procedure = this.procedures.get(id);
    if (!procedure || (procedure as any).companyId !== companyId) {
      return undefined;
    }
    return procedure;
  }

  async createProcedure(data: any, companyId: number): Promise<Procedure> {
    const id = this.procedureIdCounter++;
    const now = new Date();
    const procedure: Procedure = {
      ...data,
      id,
      companyId,
      active: data.active !== undefined ? data.active : true,
      createdAt: now,
      updatedAt: now,
    };
    this.procedures.set(id, procedure);
    return procedure;
  }

  async updateProcedure(id: number, data: any, companyId: number): Promise<Procedure> {
    const procedure = this.procedures.get(id);
    if (!procedure || (procedure as any).companyId !== companyId) {
      throw new Error('Procedure not found or access denied');
    }

    const now = new Date();
    const updatedProcedure: Procedure = {
      ...procedure,
      ...data,
      id,
      companyId,
      updatedAt: now,
    };
    this.procedures.set(id, updatedProcedure);
    return updatedProcedure;
  }

  async deleteProcedure(id: number, companyId: number): Promise<boolean> {
    const procedure = this.procedures.get(id);
    if (!procedure || (procedure as any).companyId !== companyId) {
      return false;
    }

    // Soft delete
    const updatedProcedure: Procedure = {
      ...procedure,
      active: false,
      updatedAt: new Date(),
    };
    this.procedures.set(id, updatedProcedure);
    return true;
  }

  // Clinic Settings (MemStorage stub - não implementado)
  async getClinicSettings(companyId: number): Promise<any | undefined> {
    return undefined; // MemStorage doesn't support clinic settings
  }

  async createClinicSettings(data: any): Promise<any> {
    throw new Error("MemStorage doesn't support clinic settings");
  }

  async updateClinicSettings(companyId: number, data: any): Promise<any> {
    throw new Error("MemStorage doesn't support clinic settings");
  }

  // Automation Logs (MemStorage stub - não implementado)
  async createAutomationLog(data: any): Promise<any> {
    throw new Error("MemStorage doesn't support automation logs");
  }
}

// =============================================================================
// DatabaseStorage — thin facade that delegates to domain repositories.
// All routes import `storage` from this file; nothing changes for consumers.
// =============================================================================

import {
  getPatients, getPatient, createPatient, updatePatient,
} from './repositories/PatientRepository';

import {
  getAppointments as _getAppointments,
  countAppointments as _countAppointments,
  getAppointment as _getAppointment,
  createAppointment as _createAppointment,
  updateAppointment as _updateAppointment,
  deleteAppointment as _deleteAppointment,
  checkAppointmentConflicts as _checkAppointmentConflicts,
} from './repositories/AppointmentRepository';

import {
  getPatientRecords, createPatientRecord,
  getOdontogramEntries, createOdontogramEntry,
  getPatientAnamnesis, createPatientAnamnesis, updatePatientAnamnesis,
  getAnamnesisVersionHistory, getAnamnesisVersion,
  getPatientExams, createPatientExam, updatePatientExam,
  getPatientTreatmentPlans, createPatientTreatmentPlan, updatePatientTreatmentPlan,
  getPatientEvolution, createPatientEvolution,
  getPatientPrescriptions, createPatientPrescription, updatePatientPrescription,
} from './repositories/ClinicalRepository';

import {
  getTransactions as _getTransactions,
  createTransaction as _createTransaction,
} from './repositories/FinancialRepository';

import {
  getInventoryCategories, createInventoryCategory, updateInventoryCategory,
  getInventoryItems, createInventoryItem, updateInventoryItem, deleteInventoryItem,
  getInventoryTransactions, createInventoryTransaction,
  getStandardDentalProducts, importStandardProducts,
  getInventorySeedData, seedInventoryDefaults,
} from './repositories/InventoryRepository';

import {
  getUser as _getUser,
  getUserByUsername as _getUserByUsername,
  getUserByEmail as _getUserByEmail,
  getUserByGoogleId as _getUserByGoogleId,
  createUser as _createUser,
  updateUser as _updateUser,
  getProfessionals as _getProfessionals,
  getRooms as _getRooms, getRoom as _getRoom,
  createRoom as _createRoom, updateRoom as _updateRoom, deleteRoom as _deleteRoom,
  getProcedures as _getProcedures, getProcedure as _getProcedure,
  createProcedure as _createProcedure, updateProcedure as _updateProcedure,
  deleteProcedure as _deleteProcedure,
  getAutomations as _getAutomations, createAutomation as _createAutomation,
  updateAutomation as _updateAutomation, deleteAutomation as _deleteAutomation,
  getClinicSettings as _getClinicSettings,
  createClinicSettings as _createClinicSettings,
  updateClinicSettings as _updateClinicSettings,
  createAutomationLog as _createAutomationLog,
  seedInitialData as _seedInitialData,
} from './repositories/ClinicRepository';

import {
  getProsthesis as _getProsthesis, getProsthesisById as _getProsthesisById,
  createProsthesis as _createProsthesis, updateProsthesis as _updateProsthesis,
  deleteProsthesis as _deleteProsthesis,
  getProsthesisLabels as _getProsthesisLabels, createProsthesisLabel as _createProsthesisLabel,
  updateProsthesisLabel as _updateProsthesisLabel, deleteProsthesisLabel as _deleteProsthesisLabel,
  getLaboratories as _getLaboratories, getLaboratory as _getLaboratory,
  createLaboratory as _createLaboratory, updateLaboratory as _updateLaboratory,
  deleteLaboratory as _deleteLaboratory,
} from './repositories/ProsthesisRepository';


export class DatabaseStorage implements IStorage {
  constructor() {
    // Session store is handled via Redis in app.ts
  }

  sessionStore: any = null;

  // ---- Users ---------------------------------------------------------------
  async getUser(id: number, companyId?: number): Promise<User | undefined> { return _getUser(id, companyId); }
  async getUserByUsername(username: string): Promise<User | undefined> { return _getUserByUsername(username); }
  async getUserByEmail(email: string): Promise<User | undefined> { return _getUserByEmail(email); }
  async getUserByGoogleId(googleId: string): Promise<User | undefined> { return _getUserByGoogleId(googleId); }
  async createUser(insertUser: InsertUser): Promise<User> { return _createUser(insertUser); }
  async updateUser(id: number, data: Partial<User>, companyId?: number): Promise<User> { return _updateUser(id, data, companyId); }

  // ---- Professionals -------------------------------------------------------
  async getProfessionals(companyId: number): Promise<User[]> { return _getProfessionals(companyId); }

  // ---- Patients ------------------------------------------------------------
  async getPatients(companyId: number): Promise<Patient[]> { return getPatients(companyId); }
  async getPatient(id: number, companyId: number): Promise<Patient | undefined> { return getPatient(id, companyId); }
  async createPatient(patientData: any, companyId: number): Promise<Patient> { return createPatient(patientData, companyId); }
  async updatePatient(id: number, data: any, companyId: number): Promise<Patient> { return updatePatient(id, data, companyId); }

  // ---- Appointments --------------------------------------------------------
  async getAppointments(companyId: number, filters?: AppointmentFilters): Promise<any[]> { return _getAppointments(companyId, filters); }
  async countAppointments(companyId: number, filters?: AppointmentFilters): Promise<number> { return _countAppointments(companyId, filters); }
  async getAppointment(id: number, companyId?: number): Promise<any | undefined> { return _getAppointment(id, companyId); }
  async createAppointment(appointmentData: any, companyId: number): Promise<any> { return _createAppointment(appointmentData, companyId); }
  async updateAppointment(id: number, data: any, companyId?: number): Promise<any> { return _updateAppointment(id, data, companyId); }
  async deleteAppointment(id: number, companyId: number): Promise<boolean> { return _deleteAppointment(id, companyId); }
  async checkAppointmentConflicts(
    companyId: number,
    startTime: Date,
    endTime: Date,
    options?: { professionalId?: number; roomId?: number; excludeAppointmentId?: number }
  ): Promise<any[]> { return _checkAppointmentConflicts(companyId, startTime, endTime, options); }

  // ---- Rooms ---------------------------------------------------------------
  async getRooms(companyId: number): Promise<Room[]> { return _getRooms(companyId); }
  async getRoom(id: number, companyId: number): Promise<Room | undefined> { return _getRoom(id, companyId); }
  async createRoom(data: any, companyId: number): Promise<Room> { return _createRoom(data, companyId); }
  async updateRoom(id: number, data: any, companyId: number): Promise<Room> { return _updateRoom(id, data, companyId); }
  async deleteRoom(id: number, companyId: number): Promise<boolean> { return _deleteRoom(id, companyId); }

  // ---- Procedures ----------------------------------------------------------
  async getProcedures(companyId: number): Promise<Procedure[]> { return _getProcedures(companyId); }
  async getProcedure(id: number, companyId: number): Promise<Procedure | undefined> { return _getProcedure(id, companyId); }
  async createProcedure(data: any, companyId: number): Promise<Procedure> { return _createProcedure(data, companyId); }
  async updateProcedure(id: number, data: any, companyId: number): Promise<Procedure> { return _updateProcedure(id, data, companyId); }
  async deleteProcedure(id: number, companyId: number): Promise<boolean> { return _deleteProcedure(id, companyId); }

  // ---- Automations ---------------------------------------------------------
  async getAutomations(companyId: number): Promise<Automation[]> { return _getAutomations(companyId); }
  async createAutomation(data: any, companyId: number): Promise<Automation> { return _createAutomation(data, companyId); }
  async updateAutomation(id: number, data: any, companyId: number): Promise<Automation> { return _updateAutomation(id, data, companyId); }
  async deleteAutomation(id: number, companyId: number): Promise<void> { return _deleteAutomation(id, companyId); }

  // ---- Clinic Settings -----------------------------------------------------
  async getClinicSettings(companyId: number): Promise<any | undefined> { return _getClinicSettings(companyId); }
  async createClinicSettings(data: any): Promise<any> { return _createClinicSettings(data); }
  async updateClinicSettings(companyId: number, data: any): Promise<any> { return _updateClinicSettings(companyId, data); }
  async createAutomationLog(data: any): Promise<any> { return _createAutomationLog(data); }

  // ---- Patient Records & Odontogram ----------------------------------------
  async getPatientRecords(patientId: number, companyId?: number): Promise<PatientRecord[]> { return getPatientRecords(patientId); }
  async createPatientRecord(data: any, companyId?: number): Promise<PatientRecord> { return createPatientRecord(data); }
  async getOdontogramEntries(patientId: number, companyId?: number): Promise<OdontogramEntry[]> { return getOdontogramEntries(patientId); }
  async createOdontogramEntry(entry: any, companyId?: number): Promise<OdontogramEntry> { return createOdontogramEntry(entry); }

  // ---- Clinical: Anamnesis -------------------------------------------------
  async getPatientAnamnesis(patientId: number, companyId: number): Promise<any | undefined> { return getPatientAnamnesis(patientId, companyId); }
  async createPatientAnamnesis(data: any): Promise<any> { return createPatientAnamnesis(data); }
  async updatePatientAnamnesis(id: number, data: any, companyId: number, options?: { changedBy?: number; changeReason?: string; ipAddress?: string }): Promise<any> { return updatePatientAnamnesis(id, data, companyId, options); }
  async getAnamnesisVersionHistory(anamnesisId: number, companyId: number): Promise<any[]> { return getAnamnesisVersionHistory(anamnesisId, companyId); }
  async getAnamnesisVersion(anamnesisId: number, versionNumber: number, companyId: number): Promise<any | undefined> { return getAnamnesisVersion(anamnesisId, versionNumber, companyId); }

  // ---- Clinical: Exams -----------------------------------------------------
  async getPatientExams(patientId: number, companyId: number): Promise<any[]> { return getPatientExams(patientId, companyId); }
  async createPatientExam(data: any): Promise<any> { return createPatientExam(data); }
  async updatePatientExam(id: number, data: any, companyId: number): Promise<any> { return updatePatientExam(id, data, companyId); }

  // ---- Clinical: Treatment Plans -------------------------------------------
  async getPatientTreatmentPlans(patientId: number, companyId: number): Promise<any[]> { return getPatientTreatmentPlans(patientId, companyId); }
  async createPatientTreatmentPlan(data: any): Promise<any> { return createPatientTreatmentPlan(data); }
  async updatePatientTreatmentPlan(id: number, data: any, companyId: number): Promise<any> { return updatePatientTreatmentPlan(id, data, companyId); }

  // ---- Clinical: Evolution -------------------------------------------------
  async getPatientEvolution(patientId: number, companyId: number): Promise<any[]> { return getPatientEvolution(patientId, companyId); }
  async createPatientEvolution(data: any): Promise<any> { return createPatientEvolution(data); }

  // ---- Clinical: Prescriptions ---------------------------------------------
  async getPatientPrescriptions(patientId: number, companyId: number): Promise<any[]> { return getPatientPrescriptions(patientId, companyId); }
  async createPatientPrescription(data: any): Promise<any> { return createPatientPrescription(data); }
  async updatePatientPrescription(id: number, data: any, companyId: number): Promise<any> { return updatePatientPrescription(id, data, companyId); }

  // ---- Financial (stubs — no DB table yet) ---------------------------------
  async getTransactions(companyId?: number): Promise<Transaction[]> { return _getTransactions(companyId); }
  async createTransaction(transaction: any, companyId?: number): Promise<Transaction> { return _createTransaction(transaction, companyId); }

  // ---- Inventory -----------------------------------------------------------
  async getInventoryCategories(companyId: number): Promise<any[]> { return getInventoryCategories(companyId); }
  async createInventoryCategory(data: any): Promise<any> { return createInventoryCategory(data); }
  async updateInventoryCategory(id: number, data: any, companyId: number): Promise<any> { return updateInventoryCategory(id, data, companyId); }
  async getInventoryItems(companyId: number): Promise<any[]> { return getInventoryItems(companyId); }
  async createInventoryItem(data: any): Promise<any> { return createInventoryItem(data); }
  async updateInventoryItem(id: number, data: any, companyId: number): Promise<any> { return updateInventoryItem(id, data, companyId); }
  async deleteInventoryItem(id: number, companyId: number): Promise<boolean> { return deleteInventoryItem(id, companyId); }
  async getInventoryTransactions(companyId: number, itemId?: number): Promise<any[]> { return getInventoryTransactions(companyId, itemId); }
  async createInventoryTransaction(data: any): Promise<any> { return createInventoryTransaction(data); }
  async getStandardDentalProducts(): Promise<StandardDentalProduct[]> { return getStandardDentalProducts(); }
  async importStandardProducts(productIds: number[], companyId: number): Promise<any[]> { return importStandardProducts(productIds, companyId); }
  getInventorySeedData() { return getInventorySeedData(); }
  async seedInventoryDefaults(
    companyId: number,
    selection?: { categoryNames: string[]; itemsByCategory?: Record<string, string[]> }
  ): Promise<{ categories: any[]; items: any[] }> {
    return seedInventoryDefaults(companyId, selection);
  }

  // ---- Prosthesis ----------------------------------------------------------
  async getProsthesis(companyId: number): Promise<any[]> { return _getProsthesis(companyId); }
  async getProsthesisById(id: number, companyId: number): Promise<any | undefined> { return _getProsthesisById(id, companyId); }
  async createProsthesis(data: any): Promise<any> { return _createProsthesis(data); }
  async updateProsthesis(id: number, data: any, companyId: number): Promise<any> { return _updateProsthesis(id, data, companyId); }
  async deleteProsthesis(id: number, companyId: number): Promise<void> { return _deleteProsthesis(id, companyId); }

  // ---- Prosthesis Labels ---------------------------------------------------
  async getProsthesisLabels(companyId: number): Promise<any[]> { return _getProsthesisLabels(companyId); }
  async createProsthesisLabel(data: any): Promise<any> { return _createProsthesisLabel(data); }
  async updateProsthesisLabel(id: number, companyId: number, data: any): Promise<any> { return _updateProsthesisLabel(id, companyId, data); }
  async deleteProsthesisLabel(id: number, companyId: number): Promise<boolean> { return _deleteProsthesisLabel(id, companyId); }

  // ---- Laboratories --------------------------------------------------------
  async getLaboratories(companyId: number): Promise<Laboratory[]> { return _getLaboratories(companyId); }
  async getLaboratory(id: number, companyId: number): Promise<Laboratory | undefined> { return _getLaboratory(id, companyId); }
  async createLaboratory(data: any): Promise<Laboratory> { return _createLaboratory(data); }
  async updateLaboratory(id: number, data: any, companyId: number): Promise<Laboratory> { return _updateLaboratory(id, data, companyId); }
  async deleteLaboratory(id: number, companyId: number): Promise<boolean> { return _deleteLaboratory(id, companyId); }

  // ---- Bootstrap -----------------------------------------------------------
  async seedInitialData(): Promise<void> { return _seedInitialData(); }
}

// Use DatabaseStorage with PostgreSQL
export const storage = new DatabaseStorage();
