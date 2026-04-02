import { companies, users, type User, type InsertUser, patients, appointments, procedures, rooms, workingHours, holidays, automations, patientRecords, odontogramEntries, appointmentProcedures, prosthesis, laboratories, prosthesisLabels, inventoryCategories, inventoryItems, inventoryTransactions, standardDentalProducts, anamnesis, patientExams, detailedTreatmentPlans, treatmentEvolution, prescriptions, type Patient, type Appointment, type Procedure, type Room, type WorkingHours, type Holiday, type Automation, type PatientRecord, type OdontogramEntry, type AppointmentProcedure, type Prosthesis, type InsertProsthesis, type Laboratory, type InsertLaboratory, type ProsthesisLabel, type InsertProsthesisLabel, type StandardDentalProduct, type Anamnesis, type PatientExam, type DetailedTreatmentPlan, type TreatmentEvolution, type Prescription } from "@shared/schema";
import { db, pool } from "./db";
import { eq, and, gte, lte, lt, count, sql, desc, inArray } from "drizzle-orm";
import { notDeleted } from "./lib/soft-delete";
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
  updatePatientAnamnesis(id: number, data: any, companyId: number): Promise<any>;
  
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

export class DatabaseStorage implements IStorage {
  constructor() {
    // Removido sessionStore problemático
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(and(eq(users.id, id), notDeleted(users.deletedAt)));
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
      .where(and(eq(prosthesis.companyId, companyId), notDeleted(prosthesis.deletedAt)))
      .orderBy(prosthesis.sortOrder, desc(prosthesis.createdAt));

    return results;
  }

  async getProsthesisById(id: number, companyId: number): Promise<any | undefined> {
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
      .where(and(eq(prosthesis.id, id), eq(prosthesis.companyId, companyId), notDeleted(prosthesis.deletedAt)));

    return result;
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

  async getLaboratory(id: number, companyId: number): Promise<Laboratory | undefined> {
    const [result] = await db
      .select()
      .from(laboratories)
      .where(and(eq(laboratories.id, id), eq(laboratories.companyId, companyId)));
    return result;
  }

  async createLaboratory(data: any): Promise<Laboratory> {
    const cleanData = { ...data };
    delete cleanData.id;
    delete cleanData.createdAt;
    delete cleanData.updatedAt;
    
    const [result] = await db
      .insert(laboratories)
      .values({
        ...cleanData,
        active: cleanData.active ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    
    return result;
  }

  async updateLaboratory(id: number, data: any, companyId: number): Promise<Laboratory> {
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

  async deleteLaboratory(id: number, companyId: number): Promise<boolean> {
    const result = await db
      .update(laboratories)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(laboratories.id, id), eq(laboratories.companyId, companyId)));
    
    return (result.rowCount || 0) > 0;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(and(eq(users.username, username), notDeleted(users.deletedAt)));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(and(eq(users.email, email), notDeleted(users.deletedAt)));
    return user || undefined;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    if (!googleId) return undefined;
    const [user] = await db.select().from(users).where(and(eq(users.googleId, googleId), notDeleted(users.deletedAt)));
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
    const rows = await db.select().from(patients).where(and(eq(patients.companyId, companyId), notDeleted(patients.deletedAt)));
    return decryptPatientList(rows);
  }

  async getPatient(id: number, companyId: number): Promise<Patient | undefined> {
    const [patient] = await db.select({
      id: patients.id,
      companyId: patients.companyId,
      fullName: patients.fullName,
      email: patients.email,
      phone: patients.phone,
      whatsappPhone: patients.whatsappPhone,
      cpf: patients.cpf,
      birthDate: patients.birthDate,
      gender: patients.gender,
      address: patients.address,
      neighborhood: patients.neighborhood,
      city: patients.city,
      state: patients.state,
      cep: patients.cep,
      rg: patients.rg,
      profession: patients.profession,
      cellphone: patients.cellphone,
      emergencyContactName: patients.emergencyContactName,
      emergencyContactPhone: patients.emergencyContactPhone,
      emergencyContactRelation: patients.emergencyContactRelation,
      healthInsurance: patients.healthInsurance,
      healthInsuranceNumber: patients.healthInsuranceNumber,
      bloodType: patients.bloodType,
      allergies: patients.allergies,
      medications: patients.medications,
      chronicDiseases: patients.chronicDiseases,
      patientNumber: patients.patientNumber,
      status: patients.status,
      lastVisit: patients.lastVisit,
      active: patients.active,
      notes: patients.notes,
      insuranceInfo: patients.insuranceInfo,
      createdAt: patients.createdAt,
      updatedAt: patients.updatedAt,
      nationality: patients.nationality,
      maritalStatus: patients.maritalStatus,
      profilePhoto: patients.profilePhoto
    }).from(patients).where(
      and(eq(patients.id, id), eq(patients.companyId, companyId), notDeleted(patients.deletedAt))
    );
    return patient ? decryptPatientData(patient) : undefined;
  }

  async createPatient(patientData: any, companyId: number): Promise<Patient> {
    // LGPD: Encrypt sensitive fields before persisting
    const encryptedData = encryptPatientData(patientData);

    const [patient] = await db
      .insert(patients)
      .values({
        ...encryptedData,
        companyId,
        createdAt: new Date(),
      })
      .returning();
    return decryptPatientData(patient);
  }

  async updatePatient(id: number, data: any, companyId: number): Promise<Patient> {
    // LGPD: Encrypt sensitive fields before persisting
    const encryptedData = encryptPatientData(data);

    const [updatedPatient] = await db
      .update(patients)
      .set(encryptedData)
      .where(and(eq(patients.id, id), eq(patients.companyId, companyId)))
      .returning();

    if (!updatedPatient) {
      throw new Error("Patient not found");
    }

    return decryptPatientData(updatedPatient);
  }

  // Appointment methods
  async getAppointments(companyId: number, filters?: AppointmentFilters): Promise<any[]> {
    try {
      // PERFORMANCE: Single JOIN query instead of N+1 (was 400+ queries for 100 appointments)
      // Step 1: Build WHERE conditions
      const conditions: any[] = [eq(appointments.companyId, companyId), notDeleted(appointments.deletedAt)];
      if (filters?.startDate) conditions.push(gte(appointments.startTime, new Date(filters.startDate)));
      if (filters?.endDate) conditions.push(lt(appointments.startTime, new Date(filters.endDate)));
      if (filters?.professionalId !== undefined) conditions.push(eq(appointments.professionalId, filters.professionalId));
      if (filters?.patientId !== undefined) conditions.push(eq(appointments.patientId, filters.patientId));
      if (filters?.status) conditions.push(eq(appointments.status, filters.status));

      // Step 2: Single query with LEFT JOINs for patient, professional, room
      const rows = await db
        .select({
          // Appointment fields
          appointment: appointments,
          // Patient fields (nullable)
          patientId: patients.id,
          patientFullName: patients.fullName,
          patientPhone: patients.phone,
          // Professional fields (nullable)
          professionalId: users.id,
          professionalFullName: users.fullName,
          professionalSpeciality: users.speciality,
          // Room fields (nullable)
          roomId: rooms.id,
          roomName: rooms.name,
        })
        .from(appointments)
        .leftJoin(patients, eq(appointments.patientId, patients.id))
        .leftJoin(users, eq(appointments.professionalId, users.id))
        .leftJoin(rooms, eq(appointments.roomId, rooms.id))
        .where(and(...conditions))
        .orderBy(appointments.startTime);

      // Step 3: Batch-load procedures for all appointments in 2 queries (instead of N*2)
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
            // Procedure details via JOIN
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

      // Step 4: Assemble enriched results
      return rows.map((row: any) => ({
        ...row.appointment,
        patient: row.patientId ? {
          id: row.patientId,
          fullName: row.patientFullName,
          phone: row.patientPhone,
        } : undefined,
        professional: row.professionalId ? {
          id: row.professionalId,
          fullName: row.professionalFullName,
          speciality: row.professionalSpeciality,
        } : undefined,
        room: row.roomId ? {
          id: row.roomId,
          name: row.roomName,
        } : undefined,
        procedures: proceduresByAppointment.get(row.appointment.id) || [],
      }));
    } catch (error) {
      console.error('Database error in getAppointments:', error);
      return [];
    }
  }

  async getAppointment(id: number, companyId?: number): Promise<any | undefined> {
    // PERFORMANCE: Single JOIN query instead of 5+ separate queries
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

    // Single query for procedures (instead of N queries)
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
      patient: row.patientId ? {
        id: row.patientId,
        fullName: row.patientFullName,
        phone: row.patientPhone,
      } : undefined,
      professional: row.professionalId ? {
        id: row.professionalId,
        fullName: row.professionalFullName,
        speciality: row.professionalSpeciality,
      } : undefined,
      room: row.roomId ? {
        id: row.roomId,
        name: row.roomName,
      } : undefined,
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

  async updateAppointment(id: number, data: any, companyId?: number): Promise<any> {
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

  async deleteAppointment(id: number, companyId: number): Promise<boolean> {
    // Verify appointment belongs to company
    const appointment = await this.getAppointment(id, companyId);

    if (!appointment) {
      throw new Error("Appointment not found or does not belong to this company");
    }

    // Delete appointment procedures first (foreign key constraint)
    await db
      .delete(appointmentProcedures)
      .where(eq(appointmentProcedures.appointmentId, id));

    // Delete appointment
    const result = await db
      .delete(appointments)
      .where(and(
        eq(appointments.id, id),
        eq(appointments.companyId, companyId)
      ))
      .returning();

    return result.length > 0;
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

    // Build the where clause
    const conditions = [
      eq(appointments.companyId, companyId),
      notDeleted(appointments.deletedAt),
      // Check for time overlap: (start < end AND end > start)
      and(
        lte(appointments.startTime, endTime),
        gte(appointments.endTime, startTime)
      )
    ];

    // Add professional or room filter
    if (professionalId) {
      conditions.push(eq(appointments.professionalId, professionalId));
    }
    if (roomId) {
      conditions.push(eq(appointments.roomId, roomId));
    }

    // Exclude specific appointment (useful for updates)
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

    // Enrich with patient, professional, and room names
    type ConflictRow = typeof conflicts[0];
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

  // Professional methods
  async getProfessionals(companyId: number): Promise<User[]> {
    return db
      .select()
      .from(users)
      .where(and(
        eq(users.companyId, companyId),
        eq(users.role, "dentist"),
        notDeleted(users.deletedAt)
      ));
  }

  // Room methods
  async getRooms(companyId: number): Promise<Room[]> {
    return db.select().from(rooms)
      .where(and(
        eq(rooms.companyId, companyId),
        eq(rooms.active, true)
      ))
      .orderBy(rooms.name);
  }

  async getRoom(id: number, companyId: number): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms)
      .where(and(
        eq(rooms.id, id),
        eq(rooms.companyId, companyId)
      ));
    return room || undefined;
  }

  async createRoom(data: any, companyId: number): Promise<Room> {
    const [room] = await db.insert(rooms)
      .values({
        ...data,
        companyId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return room;
  }

  async updateRoom(id: number, data: any, companyId: number): Promise<Room> {
    const [room] = await db.update(rooms)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(
        eq(rooms.id, id),
        eq(rooms.companyId, companyId)
      ))
      .returning();

    if (!room) {
      throw new Error('Room not found or access denied');
    }
    return room;
  }

  async deleteRoom(id: number, companyId: number): Promise<boolean> {
    // Soft delete - marca como inativo
    const [room] = await db.update(rooms)
      .set({
        active: false,
        updatedAt: new Date(),
      })
      .where(and(
        eq(rooms.id, id),
        eq(rooms.companyId, companyId)
      ))
      .returning();

    return !!room;
  }

  // Procedure methods
  async getProcedures(companyId: number): Promise<Procedure[]> {
    return db.select().from(procedures)
      .where(and(
        eq(procedures.companyId, companyId),
        eq(procedures.active, true)
      ))
      .orderBy(procedures.name);
  }

  async getProcedure(id: number, companyId: number): Promise<Procedure | undefined> {
    const [procedure] = await db.select().from(procedures)
      .where(and(
        eq(procedures.id, id),
        eq(procedures.companyId, companyId)
      ));
    return procedure || undefined;
  }

  async createProcedure(data: any, companyId: number): Promise<Procedure> {
    const [procedure] = await db.insert(procedures)
      .values({
        ...data,
        companyId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return procedure;
  }

  async updateProcedure(id: number, data: any, companyId: number): Promise<Procedure> {
    const [procedure] = await db.update(procedures)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(
        eq(procedures.id, id),
        eq(procedures.companyId, companyId)
      ))
      .returning();

    if (!procedure) {
      throw new Error('Procedure not found or access denied');
    }
    return procedure;
  }

  async deleteProcedure(id: number, companyId: number): Promise<boolean> {
    // Soft delete - marca como inativo
    const [procedure] = await db.update(procedures)
      .set({
        active: false,
        updatedAt: new Date(),
      })
      .where(and(
        eq(procedures.id, id),
        eq(procedures.companyId, companyId)
      ))
      .returning();

    return !!procedure;
  }

  // Patient records
  async getPatientRecords(patientId: number): Promise<PatientRecord[]> {
    return db
      .select()
      .from(patientRecords)
      .where(and(eq(patientRecords.patientId, patientId), notDeleted(patientRecords.deletedAt)));
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
      .where(and(eq(odontogramEntries.patientId, patientId), notDeleted(odontogramEntries.deletedAt)));
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

  // Laboratory operations (remove duplicates)

  // Helper methods to seed initial data
  async seedInitialData() {
    // Check if we have any users
    const userCount = await db.select({ count: count() }).from(users);

    if (userCount[0].count === 0) {
      // First, create a default company if it doesn't exist
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
        console.log('✅ Empresa padrão criada com ID 1');
      }

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
        .values({ name: "Sala 01", description: "Consultório principal", active: true, companyId: 1 })
        .returning();

      const room2 = await db
        .insert(rooms)
        .values({ name: "Sala 02", description: "Consultório secundário", active: true, companyId: 1 })
        .returning();

      const room3 = await db
        .insert(rooms)
        .values({ name: "Sala 03", description: "Sala de procedimentos", active: true, companyId: 1 })
        .returning();
      
      // Create procedures
      await db
        .insert(procedures)
        .values({ name: "Consulta inicial", duration: 30, price: 12000, description: "Avaliação inicial", color: "#1976d2", companyId: 1 });

      await db
        .insert(procedures)
        .values({ name: "Limpeza dental", duration: 60, price: 15000, description: "Profilaxia completa", color: "#43a047", companyId: 1 });

      await db
        .insert(procedures)
        .values({ name: "Tratamento de canal", duration: 90, price: 30000, description: "Endodontia", color: "#ff5722", companyId: 1 });

      await db
        .insert(procedures)
        .values({ name: "Restauração", duration: 60, price: 18000, description: "Restauração em resina", color: "#9c27b0", companyId: 1 });

      await db
        .insert(procedures)
        .values({ name: "Extração", duration: 60, price: 20000, description: "Extração simples", color: "#f44336", companyId: 1 });
    }
  }
  // Prosthesis Labels Methods
  async getProsthesisLabels(companyId: number): Promise<ProsthesisLabel[]> {
    try {
      const result = await db
        .select()
        .from(prosthesisLabels)
        .where(and(
          eq(prosthesisLabels.companyId, companyId),
          eq(prosthesisLabels.active, true)
        ))
        .orderBy(prosthesisLabels.name);
      
      return result;
    } catch (error) {
      console.error('Erro ao buscar etiquetas:', error);
      return [];
    }
  }

  async createProsthesisLabel(data: any): Promise<ProsthesisLabel> {
    try {
      const [result] = await db
        .insert(prosthesisLabels)
        .values({
          companyId: data.companyId,
          name: data.name,
          color: data.color,
          description: data.description,
          active: data.active ?? true
        })
        .returning();
      
      return result;
    } catch (error) {
      console.error('Erro ao criar etiqueta:', error);
      throw error;
    }
  }

  async updateProsthesisLabel(id: number, companyId: number, data: any): Promise<ProsthesisLabel> {
    try {
      const [result] = await db
        .update(prosthesisLabels)
        .set({
          name: data.name,
          color: data.color,
          description: data.description,
          active: data.active,
          updatedAt: new Date()
        })
        .where(and(
          eq(prosthesisLabels.id, id),
          eq(prosthesisLabels.companyId, companyId)
        ))
        .returning();
      
      return result;
    } catch (error) {
      console.error('Erro ao atualizar etiqueta:', error);
      throw error;
    }
  }

  async deleteProsthesisLabel(id: number, companyId: number): Promise<boolean> {
    try {
      const result = await db
        .update(prosthesisLabels)
        .set({
          active: false,
          updatedAt: new Date()
        })
        .where(and(
          eq(prosthesisLabels.id, id),
          eq(prosthesisLabels.companyId, companyId)
        ));
      
      return true;
    } catch (error) {
      console.error('Erro ao deletar etiqueta:', error);
      throw error;
    }
  }

  // Inventory Methods
  async getInventoryCategories(companyId: number): Promise<any[]> {
    try {
      const result = await db
        .select()
        .from(inventoryCategories)
        .where(eq(inventoryCategories.companyId, companyId))
        .orderBy(inventoryCategories.name);
      
      return result;
    } catch (error) {
      console.error('Erro ao buscar categorias de estoque:', error);
      return [];
    }
  }

  async createInventoryCategory(data: any): Promise<any> {
    try {
      const [result] = await db
        .insert(inventoryCategories)
        .values({
          companyId: data.companyId,
          name: data.name,
          description: data.description,
          color: data.color
        })
        .returning();
      
      return result;
    } catch (error) {
      console.error('Erro ao criar categoria de estoque:', error);
      throw error;
    }
  }

  async updateInventoryCategory(id: number, data: any, companyId: number): Promise<any> {
    try {
      const [result] = await db
        .update(inventoryCategories)
        .set({
          name: data.name,
          description: data.description,
          color: data.color
        })
        .where(and(
          eq(inventoryCategories.id, id),
          eq(inventoryCategories.companyId, companyId)
        ))
        .returning();
      
      return result;
    } catch (error) {
      console.error('Erro ao atualizar categoria de estoque:', error);
      throw error;
    }
  }

  async getInventoryItems(companyId: number): Promise<any[]> {
    try {
      const result = await db
        .select({
          id: inventoryItems.id,
          name: inventoryItems.name,
          description: inventoryItems.description,
          categoryId: inventoryItems.categoryId,
          categoryName: inventoryCategories.name,
          categoryColor: inventoryCategories.color,
          sku: inventoryItems.sku,
          barcode: inventoryItems.barcode,
          brand: inventoryItems.brand,
          supplier: inventoryItems.supplier,
          minimumStock: inventoryItems.minimumStock,
          currentStock: inventoryItems.currentStock,
          price: inventoryItems.price,
          unitOfMeasure: inventoryItems.unitOfMeasure,
          expirationDate: inventoryItems.expirationDate,
          location: inventoryItems.location,
          lastPurchaseDate: inventoryItems.lastPurchaseDate,
          active: inventoryItems.active,
          createdAt: inventoryItems.createdAt,
          updatedAt: inventoryItems.updatedAt
        })
        .from(inventoryItems)
        .leftJoin(inventoryCategories, eq(inventoryItems.categoryId, inventoryCategories.id))
        .where(and(
          eq(inventoryItems.companyId, companyId),
          eq(inventoryItems.active, true),
          notDeleted(inventoryItems.deletedAt)
        ))
        .orderBy(inventoryItems.name);
      
      return result;
    } catch (error) {
      console.error('Erro ao buscar itens de estoque:', error);
      return [];
    }
  }

  async createInventoryItem(data: any): Promise<any> {
    try {
      const [result] = await db
        .insert(inventoryItems)
        .values({
          companyId: data.companyId,
          name: data.name,
          description: data.description,
          categoryId: data.categoryId,
          sku: data.sku,
          barcode: data.barcode,
          brand: data.brand,
          supplier: data.supplier,
          minimumStock: data.minimumStock || 0,
          currentStock: data.currentStock || 0,
          price: data.price,
          unitOfMeasure: data.unitOfMeasure,
          expirationDate: data.expirationDate,
          location: data.location,
          lastPurchaseDate: data.lastPurchaseDate,
          active: data.active ?? true
        })
        .returning();
      
      return result;
    } catch (error) {
      console.error('Erro ao criar item de estoque:', error);
      throw error;
    }
  }

  async updateInventoryItem(id: number, data: any, companyId: number): Promise<any> {
    try {
      const [result] = await db
        .update(inventoryItems)
        .set({
          name: data.name,
          description: data.description,
          categoryId: data.categoryId,
          sku: data.sku,
          barcode: data.barcode,
          brand: data.brand,
          supplier: data.supplier,
          minimumStock: data.minimumStock,
          currentStock: data.currentStock,
          price: data.price,
          unitOfMeasure: data.unitOfMeasure,
          expirationDate: data.expirationDate,
          location: data.location,
          lastPurchaseDate: data.lastPurchaseDate,
          active: data.active,
          updatedAt: new Date()
        })
        .where(and(
          eq(inventoryItems.id, id),
          eq(inventoryItems.companyId, companyId)
        ))
        .returning();
      
      return result;
    } catch (error) {
      console.error('Erro ao atualizar item de estoque:', error);
      throw error;
    }
  }

  async deleteInventoryItem(id: number, companyId: number): Promise<boolean> {
    try {
      await db
        .update(inventoryItems)
        .set({
          active: false,
          updatedAt: new Date()
        })
        .where(and(
          eq(inventoryItems.id, id),
          eq(inventoryItems.companyId, companyId)
        ));
      
      return true;
    } catch (error) {
      console.error('Erro ao deletar item de estoque:', error);
      throw error;
    }
  }

  async getInventoryTransactions(companyId: number, itemId?: number): Promise<any[]> {
    try {
      let whereConditions = [eq(inventoryItems.companyId, companyId)];
      
      if (itemId) {
        whereConditions.push(eq(inventoryTransactions.itemId, itemId));
      }

      const result = await db
        .select({
          id: inventoryTransactions.id,
          itemId: inventoryTransactions.itemId,
          itemName: inventoryItems.name,
          userId: inventoryTransactions.userId,
          userName: users.fullName,
          type: inventoryTransactions.type,
          quantity: inventoryTransactions.quantity,
          reason: inventoryTransactions.reason,
          notes: inventoryTransactions.notes,
          previousStock: inventoryTransactions.previousStock,
          newStock: inventoryTransactions.newStock,
          appointmentId: inventoryTransactions.appointmentId,
          patientId: inventoryTransactions.patientId,
          createdAt: inventoryTransactions.createdAt
        })
        .from(inventoryTransactions)
        .leftJoin(inventoryItems, eq(inventoryTransactions.itemId, inventoryItems.id))
        .leftJoin(users, eq(inventoryTransactions.userId, users.id))
        .where(and(...whereConditions))
        .orderBy(desc(inventoryTransactions.createdAt));
      
      return result;
    } catch (error) {
      console.error('Erro ao buscar transações de estoque:', error);
      return [];
    }
  }

  async createInventoryTransaction(data: any): Promise<any> {
    try {
      const [result] = await db
        .insert(inventoryTransactions)
        .values({
          itemId: data.itemId,
          userId: data.userId,
          type: data.type,
          quantity: data.quantity,
          reason: data.reason,
          notes: data.notes,
          previousStock: data.previousStock,
          newStock: data.newStock,
          appointmentId: data.appointmentId,
          patientId: data.patientId
        })
        .returning();
      
      return result;
    } catch (error) {
      console.error('Erro ao criar transação de estoque:', error);
      throw error;
    }
  }

  async getStandardDentalProducts(): Promise<StandardDentalProduct[]> {
    try {
      const result = await db
        .select()
        .from(standardDentalProducts)
        .where(eq(standardDentalProducts.active, true))
        .orderBy(desc(standardDentalProducts.isPopular), standardDentalProducts.category, standardDentalProducts.name);
      
      return result;
    } catch (error) {
      console.error('Erro ao buscar produtos odontológicos padrão:', error);
      return [];
    }
  }

  async importStandardProducts(productIds: number[], companyId: number): Promise<any[]> {
    try {
      const standardProducts = await db
        .select()
        .from(standardDentalProducts)
        .where(and(
          inArray(standardDentalProducts.id, productIds),
          eq(standardDentalProducts.active, true)
        ));

      const importedItems = [];
      
      for (const product of standardProducts) {
        // Buscar categoria correspondente ou criar se não existir
        let category = await db
          .select()
          .from(inventoryCategories)
          .where(and(
            eq(inventoryCategories.companyId, companyId),
            eq(inventoryCategories.name, product.category)
          ))
          .limit(1);

        if (category.length === 0) {
          // Criar categoria se não existir
          const [newCategory] = await db
            .insert(inventoryCategories)
            .values({
              companyId,
              name: product.category,
              description: `Categoria ${product.category}`,
              color: '#6B7280'
            })
            .returning();
          category = [newCategory];
        }

        // Criar item no estoque da empresa
        const [item] = await db
          .insert(inventoryItems)
          .values({
            companyId,
            name: product.name,
            description: product.description,
            categoryId: category[0].id,
            brand: product.brand,
            unitOfMeasure: product.unitOfMeasure,
            price: product.estimatedPrice,
            minimumStock: 5,
            currentStock: 0,
            active: true
          })
          .returning();

        importedItems.push(item);
      }
      
      return importedItems;
    } catch (error) {
      console.error('Erro ao importar produtos padrão:', error);
      throw error;
    }
  }

  // Dados padrão de estoque para clínica odontológica - compartilhado com MemStorage
  private getDefaultInventoryDataDB() {
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

    const defaultItemsByCategory: Record<string, Array<{ name: string; minimumStock: number; unitOfMeasure: string; brand?: string }>> = {
      'Descartáveis e Consumo': [
        { name: 'Luva de Procedimento Látex P', minimumStock: 100, unitOfMeasure: 'unidade', brand: 'Supermax' },
        { name: 'Luva de Procedimento Látex M', minimumStock: 100, unitOfMeasure: 'unidade', brand: 'Supermax' },
        { name: 'Luva de Procedimento Látex G', minimumStock: 100, unitOfMeasure: 'unidade', brand: 'Supermax' },
        { name: 'Máscara Descartável Tripla', minimumStock: 100, unitOfMeasure: 'unidade' },
        { name: 'Algodão Rolete', minimumStock: 10, unitOfMeasure: 'pacote' },
        { name: 'Gaze Estéril 7,5x7,5', minimumStock: 20, unitOfMeasure: 'pacote' },
        { name: 'Sugador Descartável', minimumStock: 200, unitOfMeasure: 'unidade' },
        { name: 'Babador Descartável Impermeável', minimumStock: 100, unitOfMeasure: 'unidade' },
      ],
      'Anestésicos e Agulhas': [
        { name: 'Lidocaína 2% c/ Epinefrina 1:100.000', minimumStock: 50, unitOfMeasure: 'tubete', brand: 'DFL' },
        { name: 'Articaína 4% c/ Epinefrina 1:100.000', minimumStock: 50, unitOfMeasure: 'tubete', brand: 'DFL' },
        { name: 'Agulha Gengival Curta 30G', minimumStock: 100, unitOfMeasure: 'unidade' },
        { name: 'Agulha Gengival Longa 27G', minimumStock: 100, unitOfMeasure: 'unidade' },
      ],
      'Medicamentos': [
        { name: 'Ibuprofeno 600mg', minimumStock: 50, unitOfMeasure: 'comprimido' },
        { name: 'Amoxicilina 500mg', minimumStock: 30, unitOfMeasure: 'cápsula' },
        { name: 'Paracetamol 750mg', minimumStock: 50, unitOfMeasure: 'comprimido' },
      ],
      'Materiais de Restauração': [
        { name: 'Resina Composta A2', minimumStock: 5, unitOfMeasure: 'seringa', brand: '3M Filtek' },
        { name: 'Resina Composta A3', minimumStock: 5, unitOfMeasure: 'seringa', brand: '3M Filtek' },
        { name: 'Adesivo Single Bond Universal', minimumStock: 2, unitOfMeasure: 'frasco', brand: '3M' },
        { name: 'Ácido Fosfórico 37%', minimumStock: 10, unitOfMeasure: 'seringa' },
      ],
      'Cimentos Odontológicos': [
        { name: 'Cimento Resinoso Dual', minimumStock: 2, unitOfMeasure: 'kit' },
        { name: 'Cimento Provisório', minimumStock: 3, unitOfMeasure: 'pote' },
      ],
      'Materiais de Endodontia': [
        { name: 'Lima K #15', minimumStock: 10, unitOfMeasure: 'unidade' },
        { name: 'Lima K #20', minimumStock: 10, unitOfMeasure: 'unidade' },
        { name: 'Hipoclorito de Sódio 2,5%', minimumStock: 5, unitOfMeasure: 'litro' },
        { name: 'Cone de Guta-percha Principal', minimumStock: 20, unitOfMeasure: 'unidade' },
      ],
      'Materiais de Moldagem': [
        { name: 'Alginato', minimumStock: 5, unitOfMeasure: 'kg' },
        { name: 'Silicone de Adição Pesado', minimumStock: 2, unitOfMeasure: 'kit' },
        { name: 'Gesso Pedra Tipo III', minimumStock: 5, unitOfMeasure: 'kg' },
      ],
      'Instrumentais Rotatórios': [
        { name: 'Broca Carbide Esférica FG', minimumStock: 10, unitOfMeasure: 'unidade' },
        { name: 'Ponta Diamantada 1012', minimumStock: 10, unitOfMeasure: 'unidade', brand: 'KG Sorensen' },
        { name: 'Disco de Lixa', minimumStock: 20, unitOfMeasure: 'unidade' },
      ],
      'EPI e Biossegurança': [
        { name: 'Óculos de Proteção', minimumStock: 5, unitOfMeasure: 'unidade' },
        { name: 'Gorro Descartável', minimumStock: 100, unitOfMeasure: 'unidade' },
        { name: 'Álcool 70%', minimumStock: 10, unitOfMeasure: 'litro' },
      ],
      'Material de Prótese': [
        { name: 'Resina Acrílica', minimumStock: 2, unitOfMeasure: 'kit' },
        { name: 'Dentes de Estoque', minimumStock: 10, unitOfMeasure: 'cartela' },
      ],
      'Cirurgia e Periodontia': [
        { name: 'Fio de Sutura Seda 3-0', minimumStock: 20, unitOfMeasure: 'unidade' },
        { name: 'Lâmina de Bisturi #15', minimumStock: 20, unitOfMeasure: 'unidade' },
      ],
      'Ortodontia': [
        { name: 'Bráquete Metálico', minimumStock: 50, unitOfMeasure: 'unidade' },
        { name: 'Fio Ortodôntico NiTi', minimumStock: 10, unitOfMeasure: 'unidade' },
        { name: 'Elástico Ligadura', minimumStock: 100, unitOfMeasure: 'unidade' },
      ],
      'Radiologia': [
        { name: 'Filme Radiográfico Periapical', minimumStock: 50, unitOfMeasure: 'unidade' },
        { name: 'Capa Plástica para Sensor', minimumStock: 100, unitOfMeasure: 'unidade' },
      ],
      'Profilaxia e Prevenção': [
        { name: 'Flúor Gel Acidulado', minimumStock: 5, unitOfMeasure: 'frasco' },
        { name: 'Pasta Profilática', minimumStock: 5, unitOfMeasure: 'pote' },
        { name: 'Escova Robinson', minimumStock: 20, unitOfMeasure: 'unidade' },
      ],
    };

    return { defaultCategories, defaultItemsByCategory };
  }

  getInventorySeedData(): {
    categories: Array<{ name: string; description: string; color: string; items: Array<{ name: string; minimumStock: number; unitOfMeasure: string; brand?: string }> }>;
  } {
    const { defaultCategories, defaultItemsByCategory } = this.getDefaultInventoryDataDB();

    return {
      categories: defaultCategories.map(cat => ({
        ...cat,
        items: defaultItemsByCategory[cat.name] || []
      }))
    };
  }

  async seedInventoryDefaults(
    companyId: number,
    selection?: { categoryNames: string[]; itemsByCategory?: Record<string, string[]> }
  ): Promise<{ categories: any[], items: any[] }> {
    try {
      // Verifica se já existem categorias
      const existingCategories = await this.getInventoryCategories(companyId);
      if (existingCategories.length > 0) {
        throw new Error('Esta empresa já possui categorias de estoque cadastradas');
      }

      const { defaultCategories, defaultItemsByCategory } = this.getDefaultInventoryDataDB();

      // Filtrar categorias baseado na seleção
      let categoriesToCreate = defaultCategories;
      if (selection?.categoryNames && selection.categoryNames.length > 0) {
        categoriesToCreate = defaultCategories.filter(cat =>
          selection.categoryNames.includes(cat.name)
        );
      }

      const createdCategories: any[] = [];
      const createdItems: any[] = [];

      for (const categoryData of categoriesToCreate) {
        // Criar categoria
        const [category] = await db
          .insert(inventoryCategories)
          .values({
            ...categoryData,
            companyId,
          })
          .returning();
        createdCategories.push(category);

        // Obter itens para esta categoria
        let itemsForCategory = defaultItemsByCategory[categoryData.name] || [];

        // Filtrar itens se houver seleção específica
        if (selection?.itemsByCategory && selection.itemsByCategory[categoryData.name]) {
          const selectedItemNames = selection.itemsByCategory[categoryData.name];
          itemsForCategory = itemsForCategory.filter(item =>
            selectedItemNames.includes(item.name)
          );
        }

        // Criar itens
        for (const itemData of itemsForCategory) {
          const [item] = await db
            .insert(inventoryItems)
            .values({
              ...itemData,
              categoryId: category.id,
              companyId,
              currentStock: 0,
              price: 0,
              active: true,
            })
            .returning();
          createdItems.push(item);
        }
      }

      return { categories: createdCategories, items: createdItems };
    } catch (error: any) {
      console.error('Erro ao popular estoque:', error);
      throw error;
    }
  }

  // Digital Patient Record Methods
  async getPatientAnamnesis(patientId: number, companyId: number): Promise<Anamnesis | undefined> {
    try {
      const [result] = await db
        .select()
        .from(anamnesis)
        .innerJoin(patients, eq(anamnesis.patientId, patients.id))
        .where(and(
          eq(anamnesis.patientId, patientId),
          eq(patients.companyId, companyId),
          notDeleted(anamnesis.deletedAt),
          notDeleted(patients.deletedAt)
        ))
        .limit(1);
      
      return result?.anamnesis;
    } catch (error) {
      console.error('Erro ao buscar anamnese:', error);
      return undefined;
    }
  }

  async createPatientAnamnesis(data: any): Promise<Anamnesis> {
    try {
      const [result] = await db
        .insert(anamnesis)
        .values(data)
        .returning();
      
      return result;
    } catch (error) {
      console.error('Erro ao criar anamnese:', error);
      throw error;
    }
  }

  async updatePatientAnamnesis(id: number, data: any, companyId: number): Promise<Anamnesis> {
    try {
      const [result] = await db
        .update(anamnesis)
        .set({ ...data, updatedAt: new Date() })
        .where(and(
          eq(anamnesis.id, id),
          sql`EXISTS (SELECT 1 FROM ${patients} WHERE ${patients.id} = ${anamnesis.patientId} AND ${patients.companyId} = ${companyId})`
        ))
        .returning();
      
      return result;
    } catch (error) {
      console.error('Erro ao atualizar anamnese:', error);
      throw error;
    }
  }

  async getPatientExams(patientId: number, companyId: number): Promise<PatientExam[]> {
    try {
      const result = await db
        .select()
        .from(patientExams)
        .innerJoin(patients, eq(patientExams.patientId, patients.id))
        .where(and(
          eq(patientExams.patientId, patientId),
          eq(patients.companyId, companyId),
          notDeleted(patientExams.deletedAt),
          notDeleted(patients.deletedAt)
        ))
        .orderBy(desc(patientExams.examDate));
      
      return result.map((r: typeof result[0]) => r.patient_exams);
    } catch (error) {
      console.error('Erro ao buscar exames:', error);
      return [];
    }
  }

  async createPatientExam(data: any): Promise<PatientExam> {
    try {
      const [result] = await db
        .insert(patientExams)
        .values(data)
        .returning();
      
      return result;
    } catch (error) {
      console.error('Erro ao criar exame:', error);
      throw error;
    }
  }

  async updatePatientExam(id: number, data: any, companyId: number): Promise<PatientExam> {
    try {
      const [result] = await db
        .update(patientExams)
        .set(data)
        .where(and(
          eq(patientExams.id, id),
          sql`EXISTS (SELECT 1 FROM ${patients} WHERE ${patients.id} = ${patientExams.patientId} AND ${patients.companyId} = ${companyId})`
        ))
        .returning();
      
      return result;
    } catch (error) {
      console.error('Erro ao atualizar exame:', error);
      throw error;
    }
  }

  async getPatientTreatmentPlans(patientId: number, companyId: number): Promise<DetailedTreatmentPlan[]> {
    try {
      const result = await db
        .select()
        .from(detailedTreatmentPlans)
        .innerJoin(patients, eq(detailedTreatmentPlans.patientId, patients.id))
        .where(and(
          eq(detailedTreatmentPlans.patientId, patientId),
          eq(patients.companyId, companyId),
          notDeleted(detailedTreatmentPlans.deletedAt),
          notDeleted(patients.deletedAt)
        ))
        .orderBy(desc(detailedTreatmentPlans.createdAt));
      
      return result.map((r: typeof result[0]) => r.detailed_treatment_plans);
    } catch (error) {
      console.error('Erro ao buscar planos de tratamento:', error);
      return [];
    }
  }

  async createPatientTreatmentPlan(data: any): Promise<DetailedTreatmentPlan> {
    try {
      const [result] = await db
        .insert(detailedTreatmentPlans)
        .values(data)
        .returning();
      
      return result;
    } catch (error) {
      console.error('Erro ao criar plano de tratamento:', error);
      throw error;
    }
  }

  async updatePatientTreatmentPlan(id: number, data: any, companyId: number): Promise<DetailedTreatmentPlan> {
    try {
      const [result] = await db
        .update(detailedTreatmentPlans)
        .set({ ...data, updatedAt: new Date() })
        .where(and(
          eq(detailedTreatmentPlans.id, id),
          sql`EXISTS (SELECT 1 FROM ${patients} WHERE ${patients.id} = ${detailedTreatmentPlans.patientId} AND ${patients.companyId} = ${companyId})`
        ))
        .returning();
      
      return result;
    } catch (error) {
      console.error('Erro ao atualizar plano de tratamento:', error);
      throw error;
    }
  }

  async getPatientEvolution(patientId: number, companyId: number): Promise<TreatmentEvolution[]> {
    try {
      const result = await db
        .select()
        .from(treatmentEvolution)
        .innerJoin(patients, eq(treatmentEvolution.patientId, patients.id))
        .where(and(
          eq(treatmentEvolution.patientId, patientId),
          eq(patients.companyId, companyId),
          notDeleted(treatmentEvolution.deletedAt),
          notDeleted(patients.deletedAt)
        ))
        .orderBy(desc(treatmentEvolution.sessionDate));
      
      type EvolutionRow = { treatment_evolution: TreatmentEvolution; patients: typeof patients.$inferSelect };
      return result.map((r: EvolutionRow) => r.treatment_evolution);
    } catch (error) {
      console.error('Erro ao buscar evolução:', error);
      return [];
    }
  }

  async createPatientEvolution(data: any): Promise<TreatmentEvolution> {
    try {
      const [result] = await db
        .insert(treatmentEvolution)
        .values(data)
        .returning();
      
      return result;
    } catch (error) {
      console.error('Erro ao criar evolução:', error);
      throw error;
    }
  }

  async getPatientPrescriptions(patientId: number, companyId: number): Promise<Prescription[]> {
    try {
      const result = await db
        .select()
        .from(prescriptions)
        .innerJoin(patients, eq(prescriptions.patientId, patients.id))
        .where(and(
          eq(prescriptions.patientId, patientId),
          eq(patients.companyId, companyId),
          notDeleted(prescriptions.deletedAt),
          notDeleted(patients.deletedAt)
        ))
        .orderBy(desc(prescriptions.createdAt));
      
      type PrescriptionRow = { prescriptions: Prescription; patients: typeof patients.$inferSelect };
      return result.map((r: PrescriptionRow) => r.prescriptions);
    } catch (error) {
      console.error('Erro ao buscar receitas:', error);
      return [];
    }
  }

  async createPatientPrescription(data: any): Promise<Prescription> {
    try {
      const [result] = await db
        .insert(prescriptions)
        .values(data)
        .returning();
      
      return result;
    } catch (error) {
      console.error('Erro ao criar receita:', error);
      throw error;
    }
  }

  async updatePatientPrescription(id: number, data: any, companyId: number): Promise<Prescription> {
    try {
      const [result] = await db
        .update(prescriptions)
        .set(data)
        .where(and(
          eq(prescriptions.id, id),
          sql`EXISTS (SELECT 1 FROM ${patients} WHERE ${patients.id} = ${prescriptions.patientId} AND ${patients.companyId} = ${companyId})`
        ))
        .returning();

      return result;
    } catch (error) {
      console.error('Erro ao atualizar receita:', error);
      throw error;
    }
  }

  // Clinic Settings - tenant-aware
  async getClinicSettings(companyId: number): Promise<any | undefined> {
    const { clinicSettings } = await import('@shared/schema');
    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId));
    return settings || undefined;
  }

  async createClinicSettings(data: any): Promise<any> {
    const { clinicSettings } = await import('@shared/schema');
    const [settings] = await db
      .insert(clinicSettings)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return settings;
  }

  async updateClinicSettings(companyId: number, data: any): Promise<any> {
    const { clinicSettings } = await import('@shared/schema');
    const [settings] = await db
      .update(clinicSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clinicSettings.companyId, companyId))
      .returning();

    if (!settings) throw new Error('Clinic settings not found');
    return settings;
  }

  // Automation Logs - tenant-aware
  async createAutomationLog(data: any): Promise<any> {
    const { automationLogs } = await import('@shared/schema');
    const [log] = await db
      .insert(automationLogs)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return log;
  }

  sessionStore: any = null;
}

// Use DatabaseStorage with PostgreSQL
export const storage = new DatabaseStorage();
