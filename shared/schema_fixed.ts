import { pgTable, text, serial, integer, boolean, timestamp, json, jsonb, varchar, decimal, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Companies/Organizations
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  cnpj: text("cnpj"),
  active: boolean("active").notNull().default(true),
  trialEndsAt: timestamp("trial_ends_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Modules available in the system
export const modules = pgTable("modules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // clinic, inventory, financial, etc.
  displayName: text("display_name").notNull(),
  description: text("description"),
  version: text("version").notNull().default("1.0.0"),
  isActive: boolean("is_active").notNull().default(true),
  requiredPermissions: jsonb("required_permissions").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Company-Module relationship (which modules are enabled for each company)
export const companyModules = pgTable("company_modules", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  moduleId: integer("module_id").notNull().references(() => modules.id),
  isEnabled: boolean("is_enabled").notNull().default(true),
  settings: jsonb("settings").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User and Authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("staff"), // superadmin, admin, dentist, staff
  email: text("email"),
  phone: text("phone"),
  profileImageUrl: text("profile_image_url"),
  speciality: text("speciality"),
  active: boolean("active").notNull().default(true),
  googleId: text("google_id"),
  trialEndsAt: timestamp("trial_ends_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  companyId: true,
  username: true,
  password: true,
  fullName: true,
  role: true,
  email: true,
  phone: true,
  profileImageUrl: true,
  speciality: true,
  active: true,
  googleId: true,
});

export type User = typeof users.$inferSelect;
export type SelectUser = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// Patients
export const patients = pgTable("patients", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  cpf: text("cpf"),
  birthDate: date("birth_date"),
  address: text("address"),
  profession: text("profession"),
  medicalHistory: jsonb("medical_history").$type<Record<string, any>>(),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPatientSchema = createInsertSchema(patients).pick({
  companyId: true,
  fullName: true,
  email: true,
  phone: true,
  cpf: true,
  birthDate: true,
  address: true,
  profession: true,
  medicalHistory: true,
  notes: true,
  active: true,
});

export type Patient = typeof patients.$inferSelect;
export type InsertPatient = z.infer<typeof insertPatientSchema>;

// Laboratories - Sistema de Gerenciamento de Laboratórios
export const laboratories = pgTable("laboratories", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  name: varchar("name", { length: 255 }).notNull(),
  contactName: varchar("contact_name", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  address: text("address"),
  cnpj: varchar("cnpj", { length: 20 }),
  specialties: jsonb("specialties").$type<string[]>().default([]),
  notes: text("notes"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLaboratorySchema = createInsertSchema(laboratories).pick({
  companyId: true,
  name: true,
  contactName: true,
  phone: true,
  email: true,
  address: true,
  cnpj: true,
  specialties: true,
  notes: true,
  active: true,
});

export type Laboratory = typeof laboratories.$inferSelect;
export type InsertLaboratory = z.infer<typeof insertLaboratorySchema>;

// Procedures
export const procedures = pgTable("procedures", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  duration: integer("duration").notNull(), // in minutes
  price: integer("price").notNull().default(0), // in cents
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProcedureSchema = createInsertSchema(procedures).pick({
  companyId: true,
  name: true,
  description: true,
  category: true,
  duration: true,
  price: true,
  active: true,
});

// Appointments
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  professionalId: integer("professional_id").notNull().references(() => users.id),
  roomId: integer("room_id"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  status: text("status").notNull().default("scheduled"), // scheduled, confirmed, in-progress, completed, cancelled
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAppointmentSchema = createInsertSchema(appointments).pick({
  companyId: true,
  patientId: true,
  professionalId: true,
  roomId: true,
  startTime: true,
  endTime: true,
  status: true,
  notes: true,
});

// Appointment Procedures (Many-to-Many)
export const appointmentProcedures = pgTable("appointment_procedures", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id").notNull().references(() => appointments.id),
  procedureId: integer("procedure_id").notNull().references(() => procedures.id),
  quantity: integer("quantity").notNull().default(1),
  price: integer("price").notNull(), // Price at the time of appointment
  notes: text("notes"),
});

export const insertAppointmentProcedureSchema = createInsertSchema(appointmentProcedures).pick({
  appointmentId: true,
  procedureId: true,
  quantity: true,
  price: true,
  notes: true,
});

// Prosthesis/Próteses - Sistema de Controle de Próteses
export const prosthesis = pgTable("prosthesis", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  professionalId: integer("professional_id").notNull().references(() => users.id),
  type: text("type").notNull(), // Coroa, Ponte, Prótese Total, Faceta, Inlay, etc.
  description: text("description").notNull(),
  laboratory: text("laboratory").notNull(),
  status: text("status").notNull().default("pending"), // pending, sent, returned, completed, canceled
  sentDate: date("sent_date"),
  expectedReturnDate: date("expected_return_date"),
  returnDate: date("return_date"),
  observations: text("observations"),
  labels: jsonb("labels").$type<string[]>().default([]),
  cost: integer("cost").default(0), // in cents
  price: integer("price").default(0), // in cents
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProsthesisSchema = createInsertSchema(prosthesis).pick({
  companyId: true,
  patientId: true,
  professionalId: true,
  type: true,
  description: true,
  laboratory: true,
  status: true,
  sentDate: true,
  expectedReturnDate: true,
  returnDate: true,
  observations: true,
  labels: true,
  cost: true,
  price: true,
});

export type Prosthesis = typeof prosthesis.$inferSelect;
export type InsertProsthesis = z.infer<typeof insertProsthesisSchema>;

// Rooms
export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
});

export const insertRoomSchema = createInsertSchema(rooms).pick({
  name: true,
  description: true,
  active: true,
});

// WorkingHours
export const workingHours = pgTable("working_hours", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 0-6 (Sunday-Saturday)
  startTime: text("start_time").notNull(), // HH:MM format
  endTime: text("end_time").notNull(), // HH:MM format
  isWorking: boolean("is_working").notNull().default(true),
});

export const insertWorkingHoursSchema = createInsertSchema(workingHours).pick({
  userId: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  isWorking: true,
});

// Holidays
export const holidays = pgTable("holidays", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  date: date("date").notNull(),
  name: text("name").notNull(),
  description: text("description"),
});

export const insertHolidaySchema = createInsertSchema(holidays).pick({
  userId: true,
  date: true,
  name: true,
  description: true,
});

// Inventory Items
export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  supplier: text("supplier"),
  unit: text("unit").notNull().default("unit"), // unit, box, bottle, etc.
  currentStock: integer("current_stock").notNull().default(0),
  minimumStock: integer("minimum_stock").notNull().default(0),
  cost: integer("cost").default(0), // in cents
  expirationDate: date("expiration_date"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertInventoryItemSchema = createInsertSchema(inventoryItems).pick({
  companyId: true,
  name: true,
  description: true,
  category: true,
  supplier: true,
  unit: true,
  currentStock: true,
  minimumStock: true,
  cost: true,
  expirationDate: true,
  active: true,
});

// Financial Transactions
export const financialTransactions = pgTable("financial_transactions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  type: text("type").notNull(), // income, expense
  category: text("category").notNull(),
  description: text("description").notNull(),
  amount: integer("amount").notNull(), // in cents
  patientId: integer("patient_id").references(() => patients.id),
  appointmentId: integer("appointment_id").references(() => appointments.id),
  date: date("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFinancialTransactionSchema = createInsertSchema(financialTransactions).pick({
  companyId: true,
  type: true,
  category: true,
  description: true,
  amount: true,
  patientId: true,
  appointmentId: true,
  date: true,
  notes: true,
});