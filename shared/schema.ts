import { pgTable, text, serial, integer, boolean, timestamp, json, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User and Authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("staff"), // admin, dentist, staff
  email: text("email").notNull(),
  phone: text("phone"),
  profileImageUrl: text("profile_image_url"),
  speciality: text("speciality"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  fullName: true,
  role: true,
  email: true,
  phone: true,
  profileImageUrl: true,
  speciality: true,
});

// Patients
export const patients = pgTable("patients", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  birthDate: timestamp("birth_date"),
  gender: text("gender"),
  address: text("address"),
  insuranceInfo: text("insurance_info"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPatientSchema = createInsertSchema(patients).pick({
  fullName: true,
  email: true,
  phone: true,
  birthDate: true,
  gender: true,
  address: true,
  insuranceInfo: true,
  notes: true,
});

// Appointments
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  patientId: integer("patient_id").references(() => patients.id),
  professionalId: integer("professional_id").references(() => users.id),
  roomId: integer("room_id").references(() => rooms.id),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  status: text("status").notNull().default("scheduled"), // scheduled, confirmed, in_progress, completed, cancelled, no_show
  type: text("type").notNull().default("appointment"), // appointment, block, reminder
  notes: text("notes"),
  color: text("color"),
  recurring: boolean("recurring").default(false),
  recurrencePattern: text("recurrence_pattern"),
  automationEnabled: boolean("automation_enabled").default(true),
  automationParams: jsonb("automation_params"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAppointmentSchema = createInsertSchema(appointments).pick({
  title: true,
  patientId: true,
  professionalId: true,
  roomId: true,
  startTime: true,
  endTime: true,
  status: true,
  type: true,
  notes: true,
  color: true,
  recurring: true,
  recurrencePattern: true,
  automationEnabled: true,
  automationParams: true,
});

// Procedures
export const procedures = pgTable("procedures", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  duration: integer("duration").notNull(), // in minutes
  price: integer("price").notNull(), // in cents
  description: text("description"),
  color: text("color"),
});

export const insertProcedureSchema = createInsertSchema(procedures).pick({
  name: true,
  duration: true,
  price: true,
  description: true,
  color: true,
});

// AppointmentProcedures - many-to-many relationship
export const appointmentProcedures = pgTable("appointment_procedures", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id").references(() => appointments.id).notNull(),
  procedureId: integer("procedure_id").references(() => procedures.id).notNull(),
  quantity: integer("quantity").notNull().default(1),
  price: integer("price").notNull(), // Price at time of appointment
  notes: text("notes"),
});

export const insertAppointmentProcedureSchema = createInsertSchema(appointmentProcedures).pick({
  appointmentId: true,
  procedureId: true,
  quantity: true,
  price: true,
  notes: true,
});

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
  name: text("name").notNull(),
  date: timestamp("date").notNull(),
  isRecurringYearly: boolean("is_recurring_yearly").notNull().default(false),
});

export const insertHolidaySchema = createInsertSchema(holidays).pick({
  name: true,
  date: true,
  isRecurringYearly: true,
});

// N8N Automations
export const automations = pgTable("automations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  triggerType: text("trigger_type").notNull(), // appointment, time_before, after_appointment, status_change
  timeBeforeValue: integer("time_before_value"),
  timeBeforeUnit: text("time_before_unit"), // minutes, hours, days
  appointmentStatus: text("appointment_status"),
  whatsappEnabled: boolean("whatsapp_enabled").default(false),
  whatsappTemplateId: text("whatsapp_template_id"),
  whatsappTemplateVariables: text("whatsapp_template_variables"),
  emailEnabled: boolean("email_enabled").default(false),
  emailSender: text("email_sender"),
  emailSubject: text("email_subject"),
  emailBody: text("email_body"),
  smsEnabled: boolean("sms_enabled").default(false),
  smsText: text("sms_text"),
  webhookUrl: text("webhook_url"),
  customHeaders: jsonb("custom_headers"),
  responseActions: jsonb("response_actions"),
  logLevel: text("log_level").default("complete"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAutomationSchema = createInsertSchema(automations).pick({
  name: true,
  triggerType: true,
  timeBeforeValue: true,
  timeBeforeUnit: true,
  appointmentStatus: true,
  whatsappEnabled: true,
  whatsappTemplateId: true,
  whatsappTemplateVariables: true,
  emailEnabled: true,
  emailSender: true,
  emailSubject: true,
  emailBody: true,
  smsEnabled: true,
  smsText: true,
  webhookUrl: true,
  customHeaders: true,
  responseActions: true,
  logLevel: true,
  active: true,
});

// Patient Records
export const patientRecords = pgTable("patient_records", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => patients.id).notNull(),
  recordType: text("record_type").notNull(), // anamnesis, evolution, document, prescription, exam
  content: jsonb("content").notNull(),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPatientRecordSchema = createInsertSchema(patientRecords).pick({
  patientId: true,
  recordType: true,
  content: true,
  createdBy: true,
});

// Odontogram
export const odontogramEntries = pgTable("odontogram_entries", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => patients.id).notNull(),
  toothId: text("tooth_id").notNull(), // E.g. "11", "21", etc.
  faceId: text("face_id"), // occlusal, buccal, lingual, mesial, distal
  status: text("status").notNull(), // caries, filled, crown, bridge, implant, missing, etc.
  color: text("color"),
  notes: text("notes"),
  procedureId: integer("procedure_id").references(() => procedures.id),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertOdontogramEntrySchema = createInsertSchema(odontogramEntries).pick({
  patientId: true,
  toothId: true,
  faceId: true,
  status: true,
  color: true,
  notes: true,
  procedureId: true,
  createdBy: true,
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Patient = typeof patients.$inferSelect;
export type InsertPatient = z.infer<typeof insertPatientSchema>;

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;

export type Procedure = typeof procedures.$inferSelect;
export type InsertProcedure = z.infer<typeof insertProcedureSchema>;

export type AppointmentProcedure = typeof appointmentProcedures.$inferSelect;
export type InsertAppointmentProcedure = z.infer<typeof insertAppointmentProcedureSchema>;

export type Room = typeof rooms.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;

export type WorkingHours = typeof workingHours.$inferSelect;
export type InsertWorkingHours = z.infer<typeof insertWorkingHoursSchema>;

export type Holiday = typeof holidays.$inferSelect;
export type InsertHoliday = z.infer<typeof insertHolidaySchema>;

export type Automation = typeof automations.$inferSelect;
export type InsertAutomation = z.infer<typeof insertAutomationSchema>;

export type PatientRecord = typeof patientRecords.$inferSelect;
export type InsertPatientRecord = z.infer<typeof insertPatientRecordSchema>;

export type OdontogramEntry = typeof odontogramEntries.$inferSelect;
export type InsertOdontogramEntry = z.infer<typeof insertOdontogramEntrySchema>;
