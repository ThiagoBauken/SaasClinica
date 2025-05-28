import { pgTable, text, serial, integer, boolean, timestamp, json, jsonb, varchar, decimal, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "@shared/schema";

// Patients (moved from main schema)
export const patients = pgTable("patients", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => users.companyId), // Link to company
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  cpf: text("cpf"),
  birthDate: timestamp("birth_date"),
  gender: text("gender"),
  address: text("address"),
  insuranceInfo: text("insurance_info"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Professionals (moved from main schema)
export const professionals = pgTable("professionals", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  speciality: text("speciality"),
  licenseNumber: text("license_number"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Rooms (moved from main schema)
export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  equipment: jsonb("equipment").$type<string[]>(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Appointments (moved from main schema)
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  title: text("title").notNull(),
  patientId: integer("patient_id").references(() => patients.id),
  professionalId: integer("professional_id").references(() => professionals.id),
  roomId: integer("room_id").references(() => rooms.id),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  status: text("status").notNull().default("scheduled"),
  type: text("type").notNull().default("appointment"),
  notes: text("notes"),
  color: text("color"),
  recurring: boolean("recurring").notNull().default(false),
  recurrencePattern: text("recurrence_pattern"),
  automationEnabled: boolean("automation_enabled").notNull().default(false),
  automationParams: jsonb("automation_params"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Procedures (moved from main schema)
export const procedures = pgTable("procedures", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  duration: integer("duration").notNull().default(30),
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0.00"),
  category: text("category"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Financial Transactions (moved from main schema)
export const financialTransactions = pgTable("financial_transactions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  patientId: integer("patient_id").references(() => patients.id),
  appointmentId: integer("appointment_id").references(() => appointments.id),
  type: text("type").notNull(), // income, expense
  category: text("category").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  paymentMethod: text("payment_method"),
  dueDate: date("due_date"),
  paidDate: date("paid_date"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Odontogram Procedures (moved from main schema)
export const odontogramProcedures = pgTable("odontogram_procedures", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  toothNumber: text("tooth_number").notNull(),
  procedureId: integer("procedure_id").references(() => procedures.id),
  side: text("side"),
  status: text("status").notNull().default("planned"),
  date: timestamp("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas for clinic module
export const insertPatientSchema = createInsertSchema(patients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProfessionalSchema = createInsertSchema(professionals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRoomSchema = createInsertSchema(rooms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProcedureSchema = createInsertSchema(procedures).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFinancialTransactionSchema = createInsertSchema(financialTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOdontogramProcedureSchema = createInsertSchema(odontogramProcedures).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type SelectPatient = typeof patients.$inferSelect;
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type SelectProfessional = typeof professionals.$inferSelect;
export type InsertProfessional = z.infer<typeof insertProfessionalSchema>;
export type SelectRoom = typeof rooms.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type SelectAppointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type SelectProcedure = typeof procedures.$inferSelect;
export type InsertProcedure = z.infer<typeof insertProcedureSchema>;
export type SelectFinancialTransaction = typeof financialTransactions.$inferSelect;
export type InsertFinancialTransaction = z.infer<typeof insertFinancialTransactionSchema>;
export type SelectOdontogramProcedure = typeof odontogramProcedures.$inferSelect;
export type InsertOdontogramProcedure = z.infer<typeof insertOdontogramProcedureSchema>;