import { users, type User, type InsertUser, patients, appointments, procedures, rooms, workingHours, holidays, automations, patientRecords, odontogramEntries, appointmentProcedures, prosthesis, laboratories, prosthesisLabels, inventoryCategories, inventoryItems, inventoryTransactions, standardDentalProducts, anamnesis, patientExams, detailedTreatmentPlans, treatmentEvolution, prescriptions, type Patient, type Appointment, type Procedure, type Room, type WorkingHours, type Holiday, type Automation, type PatientRecord, type OdontogramEntry, type AppointmentProcedure, type Prosthesis, type InsertProsthesis, type Laboratory, type InsertLaboratory, type ProsthesisLabel, type InsertProsthesisLabel, type StandardDentalProduct, type Anamnesis, type PatientExam, type DetailedTreatmentPlan, type TreatmentEvolution, type Prescription } from "@shared/schema";
import { db, pool } from "./db";
import { eq, and, gte, lt, count, sql, desc, inArray } from "drizzle-orm";

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
    return Array.from(this.transactions.values()).filter(txn => txn.companyId === companyId);
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
    return Array.from(this.rooms.values()).filter(room => room.companyId === companyId);
  }

  async getProcedures(companyId: number): Promise<Procedure[]> {
    return Array.from(this.procedures.values()).filter(procedure => procedure.companyId === companyId);
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
    const [patient] = await db.select({
      id: patients.id,
      companyId: patients.companyId,
      fullName: patients.fullName,
      email: patients.email,
      phone: patients.phone,
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
      createdAt: patients.createdAt
    }).from(patients).where(
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

  // Laboratory operations (remove duplicates)

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
          eq(inventoryItems.active, true)
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

  // Digital Patient Record Methods
  async getPatientAnamnesis(patientId: number, companyId: number): Promise<Anamnesis | undefined> {
    try {
      const [result] = await db
        .select()
        .from(anamnesis)
        .innerJoin(patients, eq(anamnesis.patientId, patients.id))
        .where(and(
          eq(anamnesis.patientId, patientId),
          eq(patients.companyId, companyId)
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
          eq(patients.companyId, companyId)
        ))
        .orderBy(desc(patientExams.examDate));
      
      return result.map(r => r.patient_exams);
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
          eq(patients.companyId, companyId)
        ))
        .orderBy(desc(detailedTreatmentPlans.createdAt));
      
      return result.map(r => r.detailed_treatment_plans);
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
          eq(patients.companyId, companyId)
        ))
        .orderBy(desc(treatmentEvolution.sessionDate));
      
      return result.map(r => r.treatment_evolution);
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
          eq(patients.companyId, companyId)
        ))
        .orderBy(desc(prescriptions.createdAt));
      
      return result.map(r => r.prescriptions);
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

  sessionStore: any = null;
}

// Use DatabaseStorage with PostgreSQL
export const storage = new DatabaseStorage();
