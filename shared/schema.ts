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
  email: text("email").notNull(),
  phone: text("phone"),
  profileImageUrl: text("profile_image_url"),
  speciality: text("speciality"),
  active: boolean("active").notNull().default(true),
  googleId: text("google_id").unique(),
  trialEndsAt: timestamp("trial_ends_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertModuleSchema = createInsertSchema(modules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompanyModuleSchema = createInsertSchema(companyModules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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
  googleId: true,
  trialEndsAt: true,
  active: true,
});

// Patients
export const patients = pgTable("patients", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
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
});

export const insertPatientSchema = createInsertSchema(patients).pick({
  companyId: true,
  fullName: true,
  email: true,
  phone: true,
  cpf: true,
  birthDate: true,
  gender: true,
  address: true,
  insuranceInfo: true,
  notes: true,
});

// Appointments
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
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
  companyId: true,
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

// Laboratories - Laboratórios de Próteses
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

// Subscriptions and Payments
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  planId: text("plan_id").notNull(),
  status: text("status").notNull().default("pending"), // pending, active, canceled, expired
  amount: integer("amount").notNull(), // in cents
  currency: text("currency").notNull().default("BRL"),
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  nextBillingDate: timestamp("next_billing_date"),
  mercadoPagoId: text("mercado_pago_id"),
  paymentMethod: text("payment_method").notNull().default("mercadopago"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  subscriptionId: text("subscription_id").notNull(),
  amount: integer("amount").notNull(), // in cents
  currency: text("currency").notNull().default("BRL"),
  status: text("status").notNull(), // approved, pending, rejected, cancelled
  paymentDate: timestamp("payment_date").notNull(),
  paymentMethod: text("payment_method").notNull(),
  mercadoPagoId: text("mercado_pago_id"),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions);
export const insertPaymentSchema = createInsertSchema(payments);

// N8N Automations
export const automations = pgTable("automations", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
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

// Controle de Estoque
export const inventoryCategories = pgTable("inventory_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInventoryCategorySchema = createInsertSchema(inventoryCategories).pick({
  name: true,
  description: true,
  color: true,
});

export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  categoryId: integer("category_id").references(() => inventoryCategories.id),
  sku: text("sku"),
  barcode: text("barcode"),
  brand: text("brand"),
  supplier: text("supplier"),
  minimumStock: integer("minimum_stock").default(0),
  currentStock: integer("current_stock").default(0),
  price: integer("price"), // em centavos
  unitOfMeasure: text("unit_of_measure"), // unidade, caixa, pacote, etc
  expirationDate: timestamp("expiration_date"),
  location: text("location"), // local de armazenamento
  lastPurchaseDate: timestamp("last_purchase_date"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertInventoryItemSchema = createInsertSchema(inventoryItems).pick({
  name: true,
  description: true,
  categoryId: true,
  sku: true,
  barcode: true,
  brand: true,
  supplier: true,
  minimumStock: true,
  currentStock: true,
  price: true,
  unitOfMeasure: true,
  expirationDate: true,
  location: true,
  lastPurchaseDate: true,
  active: true,
});

export const inventoryTransactions = pgTable("inventory_transactions", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").references(() => inventoryItems.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // entrada, saída, ajuste, baixa
  quantity: integer("quantity").notNull(),
  reason: text("reason"),
  notes: text("notes"),
  previousStock: integer("previous_stock").notNull(),
  newStock: integer("new_stock").notNull(),
  appointmentId: integer("appointment_id").references(() => appointments.id),
  patientId: integer("patient_id").references(() => patients.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInventoryTransactionSchema = createInsertSchema(inventoryTransactions).pick({
  itemId: true,
  userId: true,
  type: true,
  quantity: true,
  reason: true,
  notes: true,
  previousStock: true,
  newStock: true,
  appointmentId: true,
  patientId: true,
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

export type InventoryCategory = typeof inventoryCategories.$inferSelect;
export type InsertInventoryCategory = z.infer<typeof insertInventoryCategorySchema>;

export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;

export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export type InsertInventoryTransaction = z.infer<typeof insertInventoryTransactionSchema>;

// Configurações da Clínica
export const clinicSettings = pgTable("clinic_settings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  tradingName: text("trading_name"),
  cnpj: text("cnpj"),
  responsible: text("responsible"),
  email: text("email"),
  phone: text("phone"),
  cellphone: text("cellphone"),
  logo: text("logo"),
  openingTime: text("opening_time").notNull(),
  closingTime: text("closing_time").notNull(),
  address: text("address"),
  neighborhood: text("neighborhood"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  complement: text("complement"),
  number: text("number"),
  timeZone: text("time_zone").default("America/Sao_Paulo"),
  receiptPrintEnabled: boolean("receipt_print_enabled").default(false),
  receiptHeader: text("receipt_header"),
  receiptFooter: text("receipt_footer"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClinicSettingsSchema = createInsertSchema(clinicSettings).pick({
  name: true,
  tradingName: true,
  cnpj: true,
  responsible: true,
  email: true,
  phone: true,
  cellphone: true,
  logo: true,
  openingTime: true,
  closingTime: true,
  address: true,
  neighborhood: true,
  city: true,
  state: true,
  zipCode: true,
  complement: true,
  number: true,
  timeZone: true,
  receiptPrintEnabled: true,
  receiptHeader: true,
  receiptFooter: true,
});

// Permissões dos Usuários
export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  module: text("module").notNull(), // agenda, pacientes, financeiro, etc.
  action: text("action").notNull(), // create, read, update, delete, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPermissionSchema = createInsertSchema(permissions).pick({
  name: true,
  description: true,
  module: true,
  action: true,
});

// Relação entre Usuários e Permissões
export const userPermissions = pgTable("user_permissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  permissionId: integer("permission_id").references(() => permissions.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserPermissionSchema = createInsertSchema(userPermissions).pick({
  userId: true,
  permissionId: true,
});

// Papéis (Roles) predefinidos
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRoleSchema = createInsertSchema(roles).pick({
  name: true,
  description: true,
});

// Relação entre Papéis e Permissões
export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  roleId: integer("role_id").references(() => roles.id).notNull(),
  permissionId: integer("permission_id").references(() => permissions.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).pick({
  roleId: true,
  permissionId: true,
});

// Configurações de Comissão
export const commissionSettings = pgTable("commission_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // percentual, fixo
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  applyToAll: boolean("apply_to_all").default(false),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCommissionSettingSchema = createInsertSchema(commissionSettings).pick({
  userId: true,
  type: true,
  value: true,
  applyToAll: true,
  active: true,
});

// Comissões por Procedimento (caso específico)
export const procedureCommissions = pgTable("procedure_commissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  procedureId: integer("procedure_id").references(() => procedures.id).notNull(),
  type: text("type").notNull(), // percentual, fixo
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProcedureCommissionSchema = createInsertSchema(procedureCommissions).pick({
  userId: true,
  procedureId: true,
  type: true,
  value: true,
  active: true,
});

// Registros de Comissão
export const commissionRecords = pgTable("commission_records", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  appointmentId: integer("appointment_id").references(() => appointments.id),
  procedureId: integer("procedure_id").references(() => procedures.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull(), // pendente, pago, cancelado
  paymentDate: timestamp("payment_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCommissionRecordSchema = createInsertSchema(commissionRecords).pick({
  userId: true,
  appointmentId: true,
  procedureId: true,
  amount: true,
  status: true,
  paymentDate: true,
  notes: true,
});

// Configurações Fiscais
export const fiscalSettings = pgTable("fiscal_settings", {
  id: serial("id").primaryKey(),
  nfseProvider: text("nfse_provider"), // nome do provedor de NFS-e
  nfseToken: text("nfse_token"),
  nfseUrl: text("nfse_url"),
  emitReceiptFor: text("emit_receipt_for").default("all"), // all, procedures, products
  receiptType: text("receipt_type").default("standard"), // standard, electronic
  defaultTaxRate: decimal("default_tax_rate", { precision: 5, scale: 2 }),
  defaultServiceCode: text("default_service_code"),
  termsAndConditions: text("terms_and_conditions"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFiscalSettingSchema = createInsertSchema(fiscalSettings).pick({
  nfseProvider: true,
  nfseToken: true,
  nfseUrl: true,
  emitReceiptFor: true,
  receiptType: true,
  defaultTaxRate: true,
  defaultServiceCode: true,
  termsAndConditions: true,
});

// Cadeiras (Equipamentos)
export const chairs = pgTable("chairs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  roomId: integer("room_id").references(() => rooms.id),
  description: text("description"),
  status: text("status").default("active"), // active, maintenance, inactive
  serialNumber: text("serial_number"),
  manufacturer: text("manufacturer"),
  purchaseDate: date("purchase_date"),
  warrantyUntil: date("warranty_until"),
  maintenanceSchedule: jsonb("maintenance_schedule"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertChairSchema = createInsertSchema(chairs).pick({
  name: true,
  roomId: true,
  description: true,
  status: true,
  serialNumber: true,
  manufacturer: true,
  purchaseDate: true,
  warrantyUntil: true,
  maintenanceSchedule: true,
});

// Boxes (Caixas)
export const boxes = pgTable("boxes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  openingBalance: decimal("opening_balance", { precision: 10, scale: 2 }).default("0"),
  currentBalance: decimal("current_balance", { precision: 10, scale: 2 }).default("0"),
  status: text("status").default("open"), // open, closed
  responsibleId: integer("responsible_id").references(() => users.id),
  lastOpenedAt: timestamp("last_opened_at").defaultNow(),
  lastClosedAt: timestamp("last_closed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBoxSchema = createInsertSchema(boxes).pick({
  name: true,
  description: true,
  openingBalance: true,
  currentBalance: true,
  status: true,
  responsibleId: true,
  lastOpenedAt: true,
  lastClosedAt: true,
});

// Transações de Caixa
export const boxTransactions = pgTable("box_transactions", {
  id: serial("id").primaryKey(),
  boxId: integer("box_id").references(() => boxes.id).notNull(),
  type: text("type").notNull(), // deposit, withdrawal, transfer, adjustment
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  paymentMethod: text("payment_method"), // cash, credit_card, debit_card, bank_transfer, pix
  referenceId: integer("reference_id"), // ID de referência (transação, consulta, etc)
  referenceType: text("reference_type"), // appointment, expense, etc
  userId: integer("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBoxTransactionSchema = createInsertSchema(boxTransactions).pick({
  boxId: true,
  type: true,
  amount: true,
  description: true,
  paymentMethod: true,
  referenceId: true,
  referenceType: true,
  userId: true,
});

// Planos de Pagamento
export const paymentPlans = pgTable("payment_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  installments: integer("installments").default(1),
  interval: text("interval").default("month"), // day, week, month, year
  interest: decimal("interest", { precision: 5, scale: 2 }).default("0"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPaymentPlanSchema = createInsertSchema(paymentPlans).pick({
  name: true,
  description: true,
  installments: true,
  interval: true,
  interest: true,
  active: true,
});

// Categoria para Despesas/Receitas
export const financialCategories = pgTable("financial_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // revenue, expense
  color: text("color"),
  parentId: integer("parent_id").references((): any => financialCategories.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFinancialCategorySchema = createInsertSchema(financialCategories).pick({
  name: true,
  type: true,
  color: true,
  parentId: true,
});

// Anamnese Templates
export const anamnesisTemplates = pgTable("anamnesis_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  fields: jsonb("fields").notNull(), // Array de objetos com os campos (tipo, label, opções, etc)
  active: boolean("active").default(true),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAnamnesisTemplateSchema = createInsertSchema(anamnesisTemplates).pick({
  name: true,
  description: true,
  fields: true,
  active: true,
  createdBy: true,
});

// Controle de Próteses/Laboratório
export const prosthesisServices = pgTable("prosthesis_services", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => patients.id).notNull(),
  professionalId: integer("professional_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // coroa, ponte, prótese total, etc
  description: text("description").notNull(),
  laboratory: text("laboratory"),
  status: text("status").notNull().default("ordered"), // ordered, in_progress, ready, delivered, cancelled
  sentDate: date("sent_date"),
  expectedReturnDate: date("expected_return_date"),
  returnedDate: date("returned_date"),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  price: decimal("price", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProsthesisServiceSchema = createInsertSchema(prosthesisServices).pick({
  patientId: true,
  professionalId: true,
  type: true,
  description: true,
  laboratory: true,
  status: true,
  sentDate: true,
  expectedReturnDate: true,
  returnedDate: true,
  cost: true,
  price: true,
  notes: true,
});

// Etapas do Serviço de Prótese
export const prosthesisStages = pgTable("prosthesis_stages", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").references(() => prosthesisServices.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").default("pending"), // pending, in_progress, completed
  order: integer("order").notNull(),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProsthesisStageSchema = createInsertSchema(prosthesisStages).pick({
  serviceId: true,
  name: true,
  description: true,
  status: true,
  order: true,
  completedAt: true,
  notes: true,
});

// Tipos de Serviço de Prótese Predefinidos
export const prosthesisTypes = pgTable("prosthesis_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  defaultStages: jsonb("default_stages"), // Array de nomes de etapas padrão
  defaultPrice: decimal("default_price", { precision: 10, scale: 2 }),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProsthesisTypeSchema = createInsertSchema(prosthesisTypes).pick({
  name: true,
  description: true,
  defaultStages: true,
  defaultPrice: true,
  active: true,
});

// Metas de Vendas e KPIs
export const salesGoals = pgTable("sales_goals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  userId: integer("user_id").references(() => users.id), // Se nulo, é meta geral da clínica
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  targetValue: decimal("target_value", { precision: 10, scale: 2 }).notNull(),
  targetType: text("target_type").notNull(), // revenue, appointments, new_patients, etc
  currentValue: decimal("current_value", { precision: 10, scale: 2 }).default("0"),
  status: text("status").default("active"), // active, completed, cancelled
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSalesGoalSchema = createInsertSchema(salesGoals).pick({
  name: true,
  description: true,
  userId: true,
  startDate: true,
  endDate: true,
  targetValue: true,
  targetType: true,
  currentValue: true,
  status: true,
});

// Tarefas
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  assignedTo: integer("assigned_to").references(() => users.id),
  patientId: integer("patient_id").references(() => patients.id),
  dueDate: timestamp("due_date"),
  priority: text("priority").default("medium"), // low, medium, high
  status: text("status").default("pending"), // pending, in_progress, completed, cancelled
  completedAt: timestamp("completed_at"),
  completedBy: integer("completed_by").references(() => users.id),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasks).pick({
  title: true,
  description: true,
  assignedTo: true,
  patientId: true,
  dueDate: true,
  priority: true,
  status: true,
  completedAt: true,
  completedBy: true,
  createdBy: true,
});

// Items da Loja Online
export const shopItems = pgTable("shop_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  salePrice: decimal("sale_price", { precision: 10, scale: 2 }),
  inventoryItemId: integer("inventory_item_id").references(() => inventoryItems.id),
  categoryId: integer("category_id").references(() => inventoryCategories.id),
  images: jsonb("images"), // Array de URLs de imagens
  featured: boolean("featured").default(false),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertShopItemSchema = createInsertSchema(shopItems).pick({
  name: true,
  description: true,
  price: true,
  salePrice: true,
  inventoryItemId: true,
  categoryId: true,
  images: true,
  featured: true,
  active: true,
});

// Configurações de Link de Agendamento Externo
export const bookingLinkSettings = pgTable("booking_link_settings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  professionalId: integer("professional_id").references(() => users.id),
  services: jsonb("services"), // Array de IDs de procedimentos disponíveis
  timeSlotDuration: integer("time_slot_duration").default(30), // duração em minutos
  bufferTime: integer("buffer_time").default(0), // tempo de intervalo em minutos
  maxDaysInAdvance: integer("max_days_in_advance").default(30),
  minHoursBeforeBooking: integer("min_hours_before_booking").default(2),
  disabledDays: jsonb("disabled_days"), // Array de dias da semana desativados
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBookingLinkSettingSchema = createInsertSchema(bookingLinkSettings).pick({
  name: true,
  slug: true,
  professionalId: true,
  services: true,
  timeSlotDuration: true,
  bufferTime: true,
  maxDaysInAdvance: true,
  minHoursBeforeBooking: true,
  disabledDays: true,
  active: true,
});

// Configurações de Comunicação
export const communicationSettings = pgTable("communication_settings", {
  id: serial("id").primaryKey(),
  whatsappIntegrationEnabled: boolean("whatsapp_integration_enabled").default(false),
  whatsappProvider: text("whatsapp_provider"),
  whatsappApiKey: text("whatsapp_api_key"),
  whatsappNumber: text("whatsapp_number"),
  emailIntegrationEnabled: boolean("email_integration_enabled").default(false),
  emailProvider: text("email_provider"),
  emailApiKey: text("email_api_key"),
  emailSender: text("email_sender"),
  smsIntegrationEnabled: boolean("sms_integration_enabled").default(false),
  smsProvider: text("sms_provider"),
  smsApiKey: text("sms_api_key"),
  smsNumber: text("sms_number"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCommunicationSettingSchema = createInsertSchema(communicationSettings).pick({
  whatsappIntegrationEnabled: true,
  whatsappProvider: true,
  whatsappApiKey: true,
  whatsappNumber: true,
  emailIntegrationEnabled: true,
  emailProvider: true,
  emailApiKey: true,
  emailSender: true,
  smsIntegrationEnabled: true,
  smsProvider: true,
  smsApiKey: true,
  smsNumber: true,
});

// Documentos do Paciente
export const patientDocuments = pgTable("patient_documents", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => patients.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type"), // image, pdf, etc
  uploadedBy: integer("uploaded_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPatientDocumentSchema = createInsertSchema(patientDocuments).pick({
  patientId: true,
  title: true,
  description: true,
  fileUrl: true,
  fileType: true,
  uploadedBy: true,
});

// Machine Taxes (Taxas de maquininha)
export const machineTaxes = pgTable("machine_taxes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider"),
  creditTax: decimal("credit_tax", { precision: 5, scale: 2 }).default("0"),
  debitTax: decimal("debit_tax", { precision: 5, scale: 2 }).default("0"),
  creditInstallmentTaxes: jsonb("credit_installment_taxes"), // Array de objetos com instalments e taxa
  pixTax: decimal("pix_tax", { precision: 5, scale: 2 }).default("0"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMachineTaxSchema = createInsertSchema(machineTaxes).pick({
  name: true,
  provider: true,
  creditTax: true,
  debitTax: true,
  creditInstallmentTaxes: true,
  pixTax: true,
  active: true,
});

// Export types
export type ClinicSettings = typeof clinicSettings.$inferSelect;
export type InsertClinicSettings = z.infer<typeof insertClinicSettingsSchema>;

export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;

export type UserPermission = typeof userPermissions.$inferSelect;
export type InsertUserPermission = z.infer<typeof insertUserPermissionSchema>;

export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;

export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;

export type CommissionSetting = typeof commissionSettings.$inferSelect;
export type InsertCommissionSetting = z.infer<typeof insertCommissionSettingSchema>;

export type ProcedureCommission = typeof procedureCommissions.$inferSelect;
export type InsertProcedureCommission = z.infer<typeof insertProcedureCommissionSchema>;

export type CommissionRecord = typeof commissionRecords.$inferSelect;
export type InsertCommissionRecord = z.infer<typeof insertCommissionRecordSchema>;

export type FiscalSettings = typeof fiscalSettings.$inferSelect;
export type InsertFiscalSettings = z.infer<typeof insertFiscalSettingSchema>;

// Esta tabela já foi definida anteriormente no arquivo

export type Chair = typeof chairs.$inferSelect;
export type InsertChair = z.infer<typeof insertChairSchema>;

export type Box = typeof boxes.$inferSelect;
export type InsertBox = z.infer<typeof insertBoxSchema>;

export type BoxTransaction = typeof boxTransactions.$inferSelect;
export type InsertBoxTransaction = z.infer<typeof insertBoxTransactionSchema>;

export type PaymentPlan = typeof paymentPlans.$inferSelect;
export type InsertPaymentPlan = z.infer<typeof insertPaymentPlanSchema>;

export type FinancialCategory = typeof financialCategories.$inferSelect;
export type InsertFinancialCategory = z.infer<typeof insertFinancialCategorySchema>;

export type AnamnesisTemplate = typeof anamnesisTemplates.$inferSelect;
export type InsertAnamnesisTemplate = z.infer<typeof insertAnamnesisTemplateSchema>;

export type ProsthesisService = typeof prosthesisServices.$inferSelect;
export type InsertProsthesisService = z.infer<typeof insertProsthesisServiceSchema>;

export type ProsthesisStage = typeof prosthesisStages.$inferSelect;
export type InsertProsthesisStage = z.infer<typeof insertProsthesisStageSchema>;

export type ProsthesisType = typeof prosthesisTypes.$inferSelect;
export type InsertProsthesisType = z.infer<typeof insertProsthesisTypeSchema>;

export type SalesGoal = typeof salesGoals.$inferSelect;
export type InsertSalesGoal = z.infer<typeof insertSalesGoalSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export type ShopItem = typeof shopItems.$inferSelect;
export type InsertShopItem = z.infer<typeof insertShopItemSchema>;

export type BookingLinkSetting = typeof bookingLinkSettings.$inferSelect;
export type InsertBookingLinkSetting = z.infer<typeof insertBookingLinkSettingSchema>;

export type CommunicationSetting = typeof communicationSettings.$inferSelect;
export type InsertCommunicationSetting = z.infer<typeof insertCommunicationSettingSchema>;

export type PatientDocument = typeof patientDocuments.$inferSelect;
export type InsertPatientDocument = z.infer<typeof insertPatientDocumentSchema>;

export type MachineTax = typeof machineTaxes.$inferSelect;
export type InsertMachineTax = z.infer<typeof insertMachineTaxSchema>;
