import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, decimal, date } from "drizzle-orm/pg-core";
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
  // Configurações de Automação/Integrações
  openaiApiKey: text("openai_api_key"), // Chave da OpenAI para automações N8N
  n8nWebhookUrl: text("n8n_webhook_url"), // URL do webhook N8N (opcional)
  // API Key para autenticação de integrações externas (N8N, webhooks, etc.)
  n8nApiKey: text("n8n_api_key").unique(), // Chave única para autenticação via header X-API-Key
  n8nApiKeyCreatedAt: timestamp("n8n_api_key_created_at"), // Data de criação da API Key
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
  googleCalendarId: text("google_calendar_id"), // ID do Google Calendar do profissional
  googleAccessToken: text("google_access_token"), // Token de acesso do Google Calendar
  googleRefreshToken: text("google_refresh_token"), // Token de refresh do Google Calendar
  googleTokenExpiry: timestamp("google_token_expiry"), // Data de expiração do access token
  wuzapiPhone: text("wuzapi_phone"), // Telefone WhatsApp para notificações
  // Dados CFO para assinatura digital
  cfoRegistrationNumber: text("cfo_registration_number"), // Número do CRO (ex: "12345")
  cfoState: text("cfo_state"), // Estado do CRO (ex: "SP", "RJ")
  digitalCertificatePath: text("digital_certificate_path"), // Caminho do certificado digital (opcional)
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
  googleCalendarId: true,
  googleAccessToken: true,
  googleRefreshToken: true,
  googleTokenExpiry: true,
  wuzapiPhone: true,
  cfoRegistrationNumber: true,
  cfoState: true,
  digitalCertificatePath: true,
  trialEndsAt: true,
  active: true,
});

// Patients - Ficha Digital Completa
export const patients = pgTable("patients", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  
  // Dados de Identificação
  fullName: text("full_name").notNull(),
  birthDate: timestamp("birth_date"),
  cpf: text("cpf"),
  rg: text("rg"),
  gender: text("gender"), // masculino, feminino, outro
  nationality: text("nationality"),
  maritalStatus: text("marital_status"), // solteiro, casado, divorciado, viuvo
  profession: text("profession"),
  
  // Contato
  email: text("email"),
  phone: text("phone"),
  cellphone: text("cellphone"),
  whatsappPhone: text("whatsapp_phone"), // WhatsApp específico (pode ser diferente)

  // Endereço
  address: text("address"),
  neighborhood: text("neighborhood"),
  city: text("city"),
  state: text("state"),
  cep: text("cep"),
  
  // Contato de Emergência
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  emergencyContactRelation: text("emergency_contact_relation"),
  
  // Informações de Saúde
  healthInsurance: text("health_insurance"),
  healthInsuranceNumber: text("health_insurance_number"),
  bloodType: text("blood_type"), // A+, A-, B+, B-, AB+, AB-, O+, O-
  allergies: text("allergies"),
  medications: text("medications"),
  chronicDiseases: text("chronic_diseases"),
  
  // Sistema
  patientNumber: text("patient_number").unique(), // Número do prontuário
  status: text("status").default("active"), // active, inactive, archived
  active: boolean("active").notNull().default(true),
  notes: text("notes"),
  profilePhoto: text("profile_photo"),
  lastVisit: timestamp("last_visit"),
  insuranceInfo: jsonb("insurance_info").$type<Record<string, any>>(),

  // LGPD - Consentimentos e Privacidade
  dataProcessingConsent: boolean("data_processing_consent").notNull().default(false), // Consentimento para processar dados
  marketingConsent: boolean("marketing_consent").notNull().default(false), // Consentimento para marketing
  whatsappConsent: boolean("whatsapp_consent").notNull().default(false), // Consentimento para WhatsApp
  emailConsent: boolean("email_consent").notNull().default(false), // Consentimento para e-mail
  smsConsent: boolean("sms_consent").notNull().default(false), // Consentimento para SMS
  consentDate: timestamp("consent_date"), // Data do consentimento
  consentIpAddress: text("consent_ip_address"), // IP de onde veio o consentimento
  consentMethod: text("consent_method"), // online, paper, verbal
  dataRetentionPeriod: integer("data_retention_period").default(730), // Período de retenção em dias (2 anos)
  dataAnonymizationDate: timestamp("data_anonymization_date"), // Data para anonimizar os dados

  // Avaliação/Follow-up
  lastReviewRequestedAt: timestamp("last_review_requested_at"), // Última vez que pediu avaliação no Google
  totalAppointments: integer("total_appointments").default(0), // Total de consultas realizadas

  // Tags e Tratamentos Especiais
  tags: jsonb("tags").$type<string[]>().default([]), // ["ortodontia", "vip", "idoso", "gestante", "diabetico", etc]
  treatmentType: text("treatment_type"), // ortodontia, implante, protese, geral
  isOrthodonticPatient: boolean("is_orthodontic_patient").default(false), // Atalho para filtrar pacientes de ortodontia
  orthodonticStartDate: timestamp("orthodontic_start_date"), // Data início tratamento ortodôntico
  orthodonticExpectedEndDate: timestamp("orthodontic_expected_end_date"), // Previsão término
  nextRecurringAppointment: timestamp("next_recurring_appointment"), // Próxima consulta recorrente agendada
  recurringIntervalDays: integer("recurring_interval_days").default(30), // Intervalo padrão em dias (30 = mensal)
  preferredDayOfWeek: integer("preferred_day_of_week"), // 0-6 (domingo-sábado) - dia preferido
  preferredTimeSlot: text("preferred_time_slot"), // "morning", "afternoon", "evening"

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPatientSchema = createInsertSchema(patients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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
  googleCalendarEventId: text("google_calendar_event_id"), // ID do evento no Google Calendar
  wuzapiMessageId: text("wuzapi_message_id"), // ID da mensagem enviada via Wuzapi
  automationStatus: text("automation_status").default("pending"), // pending, sent, confirmed, cancelled, error
  automationSentAt: timestamp("automation_sent_at"),
  automationError: text("automation_error"),
  lastReminderSent: timestamp("last_reminder_sent"),
  // Confirmação
  confirmationMethod: text("confirmation_method"), // whatsapp, sms, email, phone, manual
  confirmedByPatient: boolean("confirmed_by_patient").default(false),
  confirmationDate: timestamp("confirmation_date"),
  confirmationMessageId: text("confirmation_message_id"), // ID da mensagem de confirmação
  patientResponse: text("patient_response"), // Resposta do paciente
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
  companyId: integer("company_id").references(() => companies.id).notNull(),
  name: text("name").notNull(),
  duration: integer("duration").notNull(), // in minutes
  price: integer("price").notNull(), // in cents
  description: text("description"),
  color: text("color"),
  active: boolean("active").notNull().default(true),

  // Categorização para automação
  category: text("category"), // ortodontia, prevencao, estetica, cirurgia, emergencia, geral

  // Configuração de Recorrência
  isRecurring: boolean("is_recurring").default(false), // Procedimento é recorrente?
  defaultRecurrenceIntervalDays: integer("default_recurrence_interval_days"), // Intervalo padrão (30 = mensal, 7 = semanal)
  requiresFollowUp: boolean("requires_follow_up").default(false), // Requer acompanhamento?
  followUpIntervalDays: integer("follow_up_interval_days"), // Intervalo para retorno

  // Automação
  autoScheduleNext: boolean("auto_schedule_next").default(false), // Agendar próxima automaticamente?
  sendReminder: boolean("send_reminder").default(true), // Enviar lembrete?
  reminderHoursBefore: integer("reminder_hours_before").default(24), // Horas antes para lembrete

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProcedureSchema = createInsertSchema(procedures).pick({
  companyId: true,
  name: true,
  duration: true,
  price: true,
  description: true,
  color: true,
  active: true,
  category: true,
  isRecurring: true,
  defaultRecurrenceIntervalDays: true,
  requiresFollowUp: true,
  followUpIntervalDays: true,
  autoScheduleNext: true,
  sendReminder: true,
  reminderHoursBefore: true,
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
  status: text("status").notNull().default("pending"), // pending, sent, returned, completed, canceled, archived
  sentDate: date("sent_date"),
  expectedReturnDate: date("expected_return_date"),
  returnDate: date("return_date"),
  observations: text("observations"),
  labels: jsonb("labels").$type<string[]>().default([]),
  cost: integer("cost").default(0), // in cents
  price: integer("price").default(0), // in cents
  sortOrder: integer("sort_order").default(0), // Para ordenação no Kanban
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
  sortOrder: true,
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

// Prosthesis Labels - Etiquetas de Próteses
export const prosthesisLabels = pgTable("prosthesis_labels", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 7 }).notNull().default("#3B82F6"), // hex color
  description: text("description"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProsthesisLabelSchema = createInsertSchema(prosthesisLabels).pick({
  companyId: true,
  name: true,
  color: true,
  description: true,
  active: true,
});

export type ProsthesisLabel = typeof prosthesisLabels.$inferSelect;
export type InsertProsthesisLabel = z.infer<typeof insertProsthesisLabelSchema>;

// Rooms
export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRoomSchema = createInsertSchema(rooms).pick({
  companyId: true,
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
  companyId: integer("company_id").references(() => companies.id), // NULL = nacional, preenchido = específico da clínica
  name: text("name").notNull(),
  date: timestamp("date").notNull(),
  isRecurringYearly: boolean("is_recurring_yearly").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertHolidaySchema = createInsertSchema(holidays).pick({
  companyId: true,
  name: true,
  date: true,
  isRecurringYearly: true,
});

// Legacy: MercadoPago Subscriptions (deprecated - use new billing system)
export const mercadoPagoSubscriptions = pgTable("mercado_pago_subscriptions", {
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
  subscriptionId: integer("subscription_id"),
  appointmentId: integer("appointment_id").references(() => appointments.id),
  patientId: integer("patient_id").references(() => patients.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull(), // pending, confirmed, failed
  paymentDate: timestamp("payment_date").notNull(),
  paymentMethod: text("payment_method").notNull(), // credit_card, debit_card, cash, pix
  mercadoPagoId: text("mercado_pago_id"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMercadoPagoSubscriptionSchema = createInsertSchema(mercadoPagoSubscriptions);
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
  n8nWorkflowId: text("n8n_workflow_id"), // ID do workflow no n8n
  lastExecution: timestamp("last_execution"),
  executionCount: integer("execution_count").default(0),
  errorCount: integer("error_count").default(0),
  lastError: text("last_error"),
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
  companyId: integer("company_id").references(() => companies.id).notNull(),
  patientId: integer("patient_id").references(() => patients.id).notNull(),
  recordType: text("record_type").notNull(), // anamnesis, evolution, document, prescription, exam
  content: jsonb("content").notNull(),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPatientRecordSchema = createInsertSchema(patientRecords).pick({
  companyId: true,
  patientId: true,
  recordType: true,
  content: true,
  createdBy: true,
});

// Anamnese Digital
export const anamnesis = pgTable("anamnesis", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  patientId: integer("patient_id").references(() => patients.id).notNull(),
  
  // Queixa Principal
  chiefComplaint: text("chief_complaint"),
  currentIllnessHistory: text("current_illness_history"),
  
  // Histórico Médico
  medicalHistory: text("medical_history"),
  currentMedications: text("current_medications"),
  allergiesDetail: text("allergies_detail"),
  previousSurgeries: text("previous_surgeries"),
  hospitalizations: text("hospitalizations"),
  
  // Histórico Odontológico
  dentalHistory: text("dental_history"),
  previousDentalTreatments: text("previous_dental_treatments"),
  orthodonticTreatment: boolean("orthodontic_treatment").default(false),
  oralHygieneFequency: text("oral_hygiene_frequency"),
  
  // Hábitos
  smoking: boolean("smoking").default(false),
  smokingFrequency: text("smoking_frequency"),
  alcohol: boolean("alcohol").default(false),
  alcoholFrequency: text("alcohol_frequency"),
  bruxism: boolean("bruxism").default(false),
  nailBiting: boolean("nail_biting").default(false),
  
  // Informações Sistêmicas
  heartDisease: boolean("heart_disease").default(false),
  highBloodPressure: boolean("high_blood_pressure").default(false),
  diabetes: boolean("diabetes").default(false),
  hepatitis: boolean("hepatitis").default(false),
  kidney_disease: boolean("kidney_disease").default(false),
  pregnant: boolean("pregnant").default(false),
  pregnancyMonth: integer("pregnancy_month"),
  
  // Informações Adicionais
  additionalInfo: text("additional_info"),
  
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAnamnesisSchema = createInsertSchema(anamnesis).pick({
  companyId: true,
  patientId: true,
  chiefComplaint: true,
  currentIllnessHistory: true,
  medicalHistory: true,
  currentMedications: true,
  allergiesDetail: true,
  previousSurgeries: true,
  hospitalizations: true,
  dentalHistory: true,
  previousDentalTreatments: true,
  orthodonticTreatment: true,
  oralHygieneFequency: true,
  smoking: true,
  smokingFrequency: true,
  alcohol: true,
  alcoholFrequency: true,
  bruxism: true,
  nailBiting: true,
  heartDisease: true,
  highBloodPressure: true,
  diabetes: true,
  hepatitis: true,
  kidney_disease: true,
  pregnant: true,
  pregnancyMonth: true,
  additionalInfo: true,
  createdBy: true,
});

// Exames do Paciente
export const patientExams = pgTable("patient_exams", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  patientId: integer("patient_id").references(() => patients.id).notNull(),
  examType: text("exam_type").notNull(), // radiografia, tomografia, fotografia, outros
  title: text("title").notNull(),
  description: text("description"),
  examDate: timestamp("exam_date").defaultNow(),
  fileUrl: text("file_url"),
  fileType: text("file_type"), // image/jpeg, application/pdf, etc
  results: text("results"),
  observations: text("observations"),
  requestedBy: integer("requested_by").references(() => users.id).notNull(),
  performedAt: text("performed_at"), // Local do exame
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPatientExamSchema = createInsertSchema(patientExams).pick({
  companyId: true,
  patientId: true,
  examType: true,
  title: true,
  description: true,
  examDate: true,
  fileUrl: true,
  fileType: true,
  results: true,
  observations: true,
  requestedBy: true,
  performedAt: true,
});

// Planos de Tratamento Detalhados
export const detailedTreatmentPlans = pgTable("detailed_treatment_plans", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  patientId: integer("patient_id").references(() => patients.id).notNull(),
  professionalId: integer("professional_id").references(() => users.id).notNull(),
  
  title: text("title").notNull(),
  description: text("description"),
  diagnosis: text("diagnosis"),
  objectives: text("objectives"),
  
  // Fases do tratamento
  phases: jsonb("phases"), // Array de objetos com as fases
  
  // Financeiro
  estimatedCost: integer("estimated_cost"), // em centavos
  approvedCost: integer("approved_cost"), // em centavos
  
  // Status
  status: text("status").default("proposed"), // proposed, approved, in_progress, completed, cancelled
  priority: text("priority").default("normal"), // urgent, high, normal, low
  
  // Datas
  proposedDate: timestamp("proposed_date").defaultNow(),
  approvedDate: timestamp("approved_date"),
  startDate: timestamp("start_date"),
  expectedEndDate: timestamp("expected_end_date"),
  completedDate: timestamp("completed_date"),
  
  // Observações
  notes: text("notes"),
  patientConsent: boolean("patient_consent").default(false),
  consentDate: timestamp("consent_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDetailedTreatmentPlanSchema = createInsertSchema(detailedTreatmentPlans).pick({
  companyId: true,
  patientId: true,
  professionalId: true,
  title: true,
  description: true,
  diagnosis: true,
  objectives: true,
  phases: true,
  estimatedCost: true,
  approvedCost: true,
  status: true,
  priority: true,
  proposedDate: true,
  approvedDate: true,
  startDate: true,
  expectedEndDate: true,
  completedDate: true,
  notes: true,
  patientConsent: true,
  consentDate: true,
});

// Evolução do Tratamento
export const treatmentEvolution = pgTable("treatment_evolution", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  patientId: integer("patient_id").references(() => patients.id).notNull(),
  appointmentId: integer("appointment_id").references(() => appointments.id),
  treatmentPlanId: integer("treatment_plan_id").references(() => detailedTreatmentPlans.id),
  
  sessionDate: timestamp("session_date").notNull(),
  sessionNumber: integer("session_number"),
  
  // Procedimentos realizados
  proceduresPerformed: text("procedures_performed"),
  materials_used: text("materials_used"),
  
  // Observações clínicas
  clinicalObservations: text("clinical_observations"),
  patientResponse: text("patient_response"),
  complications: text("complications"),
  
  // Próxima sessão
  nextSession: text("next_session"),
  homecare_instructions: text("homecare_instructions"),
  
  // Profissional
  performedBy: integer("performed_by").references(() => users.id).notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTreatmentEvolutionSchema = createInsertSchema(treatmentEvolution).pick({
  companyId: true,
  patientId: true,
  appointmentId: true,
  treatmentPlanId: true,
  sessionDate: true,
  sessionNumber: true,
  proceduresPerformed: true,
  materials_used: true,
  clinicalObservations: true,
  patientResponse: true,
  complications: true,
  nextSession: true,
  homecare_instructions: true,
  performedBy: true,
});

// Assinaturas Digitais (CFO)
export const digitalSignatures = pgTable("digital_signatures", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  professionalId: integer("professional_id").notNull().references(() => users.id),

  // Tipo de documento
  documentType: text("document_type").notNull(), // 'prescription', 'certificate', 'attestation', 'exam_request'
  documentId: integer("document_id").notNull(),

  // Dados do certificado digital
  certificateSerialNumber: text("certificate_serial_number"),
  certificateName: text("certificate_name"),
  certificateIssuer: text("certificate_issuer"),
  certificateValidFrom: timestamp("certificate_valid_from"),
  certificateValidUntil: timestamp("certificate_valid_until"),

  // Dados do CFO
  cfoRegistrationNumber: text("cfo_registration_number").notNull(),
  cfoState: text("cfo_state").notNull(),

  // Assinatura e validação
  signedPdfUrl: text("signed_pdf_url").notNull(),
  signatureHash: text("signature_hash"),
  qrCodeData: text("qr_code_data"),
  cfoValidationUrl: text("cfo_validation_url"),

  // Timestamps
  signedAt: timestamp("signed_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),

  // Status
  status: text("status").notNull().default('valid'), // 'valid', 'revoked', 'expired'
  revokedAt: timestamp("revoked_at"),
  revokedReason: text("revoked_reason"),

  // Metadata
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDigitalSignatureSchema = createInsertSchema(digitalSignatures).pick({
  companyId: true,
  professionalId: true,
  documentType: true,
  documentId: true,
  certificateSerialNumber: true,
  certificateName: true,
  certificateIssuer: true,
  certificateValidFrom: true,
  certificateValidUntil: true,
  cfoRegistrationNumber: true,
  cfoState: true,
  signedPdfUrl: true,
  signatureHash: true,
  qrCodeData: true,
  cfoValidationUrl: true,
  expiresAt: true,
  status: true,
  metadata: true,
});

// Receitas e Atestados
export const prescriptions = pgTable("prescriptions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  patientId: integer("patient_id").references(() => patients.id).notNull(),

  type: text("type").notNull(), // receita, atestado, declaracao
  title: text("title").notNull(),
  content: text("content").notNull(),

  // Para receitas
  medications: jsonb("medications"), // Array de medicamentos
  instructions: text("instructions"),

  // Para atestados
  attestationType: text("attestation_type"), // comparecimento, incapacidade, etc
  period: text("period"), // período de afastamento
  cid: text("cid"), // código CID se aplicável

  validUntil: timestamp("valid_until"),
  prescribedBy: integer("prescribed_by").references(() => users.id).notNull(),

  // Controle
  issued: boolean("issued").default(false),
  issuedAt: timestamp("issued_at"),

  // Assinatura Digital
  signatureId: integer("signature_id").references(() => digitalSignatures.id),
  digitallySigned: boolean("digitally_signed").default(false),
  signedPdfUrl: text("signed_pdf_url"),
  validatedByCfo: boolean("validated_by_cfo").default(false),
  cfoValidationUrl: text("cfo_validation_url"),
  qrCodeData: text("qr_code_data"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPrescriptionSchema = createInsertSchema(prescriptions).pick({
  companyId: true,
  patientId: true,
  type: true,
  title: true,
  content: true,
  medications: true,
  instructions: true,
  attestationType: true,
  period: true,
  cid: true,
  validUntil: true,
  prescribedBy: true,
  issued: true,
  issuedAt: true,
});

// Odontogram
export const odontogramEntries = pgTable("odontogram_entries", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
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
  companyId: true,
  patientId: true,
  toothId: true,
  faceId: true,
  status: true,
  color: true,
  notes: true,
  procedureId: true,
  createdBy: true,
});

// Periodontal Chart (Periodontograma)
export const periodontalChart = pgTable("periodontal_chart", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  professionalId: integer("professional_id").references(() => users.id),
  chartDate: timestamp("chart_date").notNull().defaultNow(),
  teethData: jsonb("teeth_data").notNull().$type<PeriodontalToothData[]>().default([]),
  generalNotes: text("general_notes"),
  diagnosis: text("diagnosis"),
  treatmentPlan: text("treatment_plan"),
  plaqueIndex: decimal("plaque_index", { precision: 5, scale: 2 }),
  bleedingIndex: decimal("bleeding_index", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPeriodontalChartSchema = createInsertSchema(periodontalChart).pick({
  companyId: true,
  patientId: true,
  professionalId: true,
  chartDate: true,
  teethData: true,
  generalNotes: true,
  diagnosis: true,
  treatmentPlan: true,
  plaqueIndex: true,
  bleedingIndex: true,
});

// TypeScript interfaces for Periodontal Chart
export interface PeriodontalMeasurements {
  mesialBuccal: number;
  buccal: number;
  distalBuccal: number;
  mesialLingual: number;
  lingual: number;
  distalLingual: number;
}

export interface PeriodontalBleedingSupp {
  mesialBuccal: boolean;
  buccal: boolean;
  distalBuccal: boolean;
  mesialLingual: boolean;
  lingual: boolean;
  distalLingual: boolean;
}

export interface PeriodontalToothData {
  toothNumber: string; // "11", "12", ... "48" (FDI notation)
  probingDepth: PeriodontalMeasurements; // in mm
  gingivalRecession: PeriodontalMeasurements; // in mm
  bleeding: PeriodontalBleedingSupp;
  suppuration: PeriodontalBleedingSupp;
  mobility: 0 | 1 | 2 | 3; // 0=normal, 1=slight, 2=moderate, 3=severe
  furcation: 0 | 1 | 2 | 3; // 0=none, 1=incipient, 2=moderate, 3=severe
  plaque: boolean;
  calculus: boolean;
  notes?: string;
}

// Controle de Estoque
export const inventoryCategories = pgTable("inventory_categories", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInventoryCategorySchema = createInsertSchema(inventoryCategories).pick({
  companyId: true,
  name: true,
  description: true,
  color: true,
});

export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
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
  companyId: true,
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

// Produtos Odontológicos Padrão
export const standardDentalProducts = pgTable("standard_dental_products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  brand: text("brand"),
  unitOfMeasure: text("unit_of_measure").notNull(),
  estimatedPrice: integer("estimated_price"), // em centavos
  tags: jsonb("tags").$type<string[]>().default([]),
  isPopular: boolean("is_popular").default(false),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStandardDentalProductSchema = createInsertSchema(standardDentalProducts).pick({
  name: true,
  description: true,
  category: true,
  brand: true,
  unitOfMeasure: true,
  estimatedPrice: true,
  tags: true,
  isPopular: true,
  active: true,
});

export type StandardDentalProduct = typeof standardDentalProducts.$inferSelect;
export type InsertStandardDentalProduct = z.infer<typeof insertStandardDentalProductSchema>;

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
  companyId: integer("company_id").references(() => companies.id).unique(), // Uma configuração por empresa
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
  // Integrações WhatsApp/Wuzapi
  wuzapiInstanceId: text("wuzapi_instance_id"),
  wuzapiApiKey: text("wuzapi_api_key"), // Token único da empresa no Wuzapi
  wuzapiBaseUrl: text("wuzapi_base_url").default("https://private-wuzapi.pbzgje.easypanel.host"), // URL base do Wuzapi compartilhado
  wuzapiWebhookUrl: text("wuzapi_webhook_url"), // URL do webhook configurada no Wuzapi
  wuzapiWebhookSecret: text("wuzapi_webhook_secret"), // Secret para validar webhooks
  wuzapiConnectedPhone: text("wuzapi_connected_phone"), // Número do WhatsApp conectado
  wuzapiStatus: text("wuzapi_status").default("disconnected"), // Status: disconnected, connecting, connected
  wuzapiLastSyncAt: timestamp("wuzapi_last_sync_at"), // Última sincronização

  // Integrações Evolution API (alternativa)
  evolutionApiBaseUrl: text("evolution_api_base_url"), // URL da API Evolution
  evolutionInstanceName: text("evolution_instance_name"), // Nome da instância
  evolutionApiKey: text("evolution_api_key"), // API Key da Evolution
  adminWhatsappPhone: text("admin_whatsapp_phone"),

  // Integrações Google
  defaultGoogleCalendarId: text("default_google_calendar_id"),

  // Integrações N8N/Automação
  n8nWebhookBaseUrl: text("n8n_webhook_base_url"),

  // Integrações Flowise/AI
  flowiseBaseUrl: text("flowise_base_url"), // URL do Flowise
  flowiseChatflowId: text("flowise_chatflow_id"), // ID do chatflow

  // Integrações Baserow (caso use)
  baserowApiKey: text("baserow_api_key"),
  baserowDatabaseId: integer("baserow_database_id"),
  baserowPatientsTableId: integer("baserow_patients_table_id"),
  baserowAppointmentsTableId: integer("baserow_appointments_table_id"),

  // Chat e Automação - Novos campos para SaaS
  chatEnabled: boolean("chat_enabled").default(true), // Habilitar/desabilitar chatbot
  chatWelcomeMessage: text("chat_welcome_message"), // Mensagem de boas-vindas personalizada
  chatFallbackMessage: text("chat_fallback_message"), // Mensagem quando não entende
  emergencyPhone: text("emergency_phone"), // Telefone de emergência
  googleReviewLink: text("google_review_link"), // Link para avaliação no Google
  googleMapsLink: text("google_maps_link"), // Link do Google Maps
  workingHoursJson: jsonb("working_hours_json").$type<Record<string, {open: string, close: string, lunchStart?: string, lunchEnd?: string}>>(), // Horários por dia da semana
  slotDurationMinutes: integer("slot_duration_minutes").default(30), // Duração padrão dos slots
  appointmentBufferMinutes: integer("appointment_buffer_minutes").default(0), // Intervalo entre consultas

  // Personalização de mensagens automáticas
  confirmationMessageTemplate: text("confirmation_message_template"), // Template de confirmação de agendamento
  reminderMessageTemplate: text("reminder_message_template"), // Template de lembrete 24h
  cancellationMessageTemplate: text("cancellation_message_template"), // Template de cancelamento
  birthdayMessageTemplate: text("birthday_message_template"), // Template de aniversário
  reviewRequestTemplate: text("review_request_template"), // Template de pedido de avaliação

  // Estilo de Conversa do Bot (NOVO)
  conversationStyle: text("conversation_style").default("menu"), // "menu" = com opções numeradas, "humanized" = conversa natural
  botPersonality: text("bot_personality").default("professional"), // "professional", "friendly", "casual"
  botName: text("bot_name").default("Assistente"), // Nome do bot (ex: "Carol", "Atendente Virtual")
  useEmojis: boolean("use_emojis").default(true), // Usar emojis nas respostas?
  greetingStyle: text("greeting_style").default("time_based"), // "time_based" = bom dia/tarde/noite, "simple" = olá
  customGreetingMorning: text("custom_greeting_morning"), // Saudação personalizada manhã
  customGreetingAfternoon: text("custom_greeting_afternoon"), // Saudação personalizada tarde
  customGreetingEvening: text("custom_greeting_evening"), // Saudação personalizada noite
  humanizedPromptContext: text("humanized_prompt_context"), // Contexto extra para IA no modo humanizado

  // Regras de Negócio do Bot
  priceDisclosurePolicy: text("price_disclosure_policy").default("always"), // "always", "never_chat", "only_general"
  schedulingPolicy: text("scheduling_policy").default("immediate"), // "immediate", "appointment_required", "callback"
  paymentMethods: jsonb("payment_methods").$type<string[]>().default(['pix', 'credit_card', 'debit_card', 'cash']),

  // Especialidades e Serviços
  clinicType: text("clinic_type").default("consultorio_individual"), // consultorio_individual, clinica_pequena, clinica_media, clinica_grande, franquia
  servicesOffered: jsonb("services_offered").$type<string[]>().default([]), // Array de códigos de especialidades CFO
  clinicContextForBot: text("clinic_context_for_bot"), // Contexto geral da clínica para o bot

  // ===== REATIVAÇÃO DE PACIENTES =====
  reactivationEnabled: boolean("reactivation_enabled").default(true), // Habilitar reativação automática
  reactivation3MonthsTemplate: text("reactivation_3_months_template"), // Mensagem 3 meses
  reactivation6MonthsTemplate: text("reactivation_6_months_template"), // Mensagem 6 meses
  reactivation9MonthsTemplate: text("reactivation_9_months_template"), // Mensagem 9 meses
  reactivation12MonthsTemplate: text("reactivation_12_months_template"), // Mensagem 12 meses
  reactivationHourToSend: integer("reactivation_hour_to_send").default(10), // Hora do dia para enviar (0-23)

  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
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
  // Campos de integrações
  wuzapiInstanceId: true,
  wuzapiApiKey: true,
  evolutionApiBaseUrl: true,
  evolutionInstanceName: true,
  evolutionApiKey: true,
  adminWhatsappPhone: true,
  defaultGoogleCalendarId: true,
  n8nWebhookBaseUrl: true,
  flowiseBaseUrl: true,
  flowiseChatflowId: true,
  baserowApiKey: true,
  baserowDatabaseId: true,
  baserowPatientsTableId: true,
  baserowAppointmentsTableId: true,
  // Novos campos de chat e automação
  chatEnabled: true,
  chatWelcomeMessage: true,
  chatFallbackMessage: true,
  emergencyPhone: true,
  googleReviewLink: true,
  googleMapsLink: true,
  workingHoursJson: true,
  slotDurationMinutes: true,
  appointmentBufferMinutes: true,
  confirmationMessageTemplate: true,
  reminderMessageTemplate: true,
  cancellationMessageTemplate: true,
  birthdayMessageTemplate: true,
  reviewRequestTemplate: true,
  // Estilo de conversa
  conversationStyle: true,
  botPersonality: true,
  botName: true,
  useEmojis: true,
  greetingStyle: true,
  customGreetingMorning: true,
  customGreetingAfternoon: true,
  customGreetingEvening: true,
  humanizedPromptContext: true,
  // Regras de negócio
  priceDisclosurePolicy: true,
  schedulingPolicy: true,
  paymentMethods: true,
  // Especialidades
  clinicType: true,
  servicesOffered: true,
  clinicContextForBot: true,
  // Reativação de Pacientes
  reactivationEnabled: true,
  reactivation3MonthsTemplate: true,
  reactivation6MonthsTemplate: true,
  reactivation9MonthsTemplate: true,
  reactivation12MonthsTemplate: true,
  reactivationHourToSend: true,
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

// Financial Transactions - Comprehensive financial system
export const financialTransactions = pgTable("financial_transactions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  type: text("type").notNull(), // income, expense
  category: text("category").notNull(),
  description: text("description").notNull(),
  amount: integer("amount").notNull(), // in cents
  patientId: integer("patient_id").references(() => patients.id),
  appointmentId: integer("appointment_id").references(() => appointments.id),
  professionalId: integer("professional_id").references(() => users.id),
  date: timestamp("date").notNull(),
  dueDate: timestamp("due_date"),
  paymentMethod: text("payment_method"), // cash, credit_card, debit_card, pix, bank_transfer
  status: text("status").notNull().default("pending"), // pending, partial, paid, overdue, cancelled
  installments: integer("installments").default(1),
  installmentsPaid: integer("installments_paid").default(0),
  feeAmount: integer("fee_amount").default(0), // payment machine fees in cents
  netAmount: integer("net_amount"), // amount after fees
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
  professionalId: true,
  date: true,
  dueDate: true,
  paymentMethod: true,
  status: true,
  installments: true,
  installmentsPaid: true,
  feeAmount: true,
  netAmount: true,
  notes: true,
});

// Configurações de Comissão por Profissional
export const professionalCommissions = pgTable("professional_commissions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  professionalId: integer("professional_id").notNull().references(() => users.id),

  // Taxa de comissão padrão (em porcentagem - ex: 50 = 50%)
  defaultCommissionRate: decimal("default_commission_rate", { precision: 5, scale: 2 }).notNull().default("50.00"),

  // Comissões por categoria de procedimento (JSON)
  // Ex: { "implante": 60, "ortodontia": 45, "limpeza": 50 }
  categoryRates: jsonb("category_rates").$type<Record<string, number>>(),

  // Valor fixo mensal (para profissionais com salário fixo + comissão)
  fixedMonthlyAmount: integer("fixed_monthly_amount").default(0), // em centavos

  // Modelo de comissão: percentage, fixed, hybrid
  commissionModel: text("commission_model").notNull().default("percentage"),

  // Deduções automáticas (%)
  taxDeductionRate: decimal("tax_deduction_rate", { precision: 5, scale: 2 }).default("0.00"), // ISS, etc
  materialDeductionRate: decimal("material_deduction_rate", { precision: 5, scale: 2 }).default("0.00"), // Materiais

  // Configurações de pagamento
  paymentDay: integer("payment_day").default(5), // Dia do mês para pagamento
  minimumPayout: integer("minimum_payout").default(0), // Valor mínimo para pagamento em centavos

  // Status e datas
  isActive: boolean("is_active").notNull().default(true),
  validFrom: timestamp("valid_from").defaultNow(),
  validUntil: timestamp("valid_until"),

  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProfessionalCommissionSchema = createInsertSchema(professionalCommissions).pick({
  companyId: true,
  professionalId: true,
  defaultCommissionRate: true,
  categoryRates: true,
  fixedMonthlyAmount: true,
  commissionModel: true,
  taxDeductionRate: true,
  materialDeductionRate: true,
  paymentDay: true,
  minimumPayout: true,
  isActive: true,
  validFrom: true,
  validUntil: true,
  notes: true,
});

export type ProfessionalCommission = typeof professionalCommissions.$inferSelect;
export type InsertProfessionalCommission = z.infer<typeof insertProfessionalCommissionSchema>;

// Treatment Plans
export const treatmentPlans = pgTable("treatment_plans", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  professionalId: integer("professional_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  totalAmount: integer("total_amount").notNull(), // in cents
  paidAmount: integer("paid_amount").default(0), // in cents
  discountAmount: integer("discount_amount").default(0), // in cents
  status: text("status").notNull().default("proposed"), // proposed, approved, in_progress, completed, cancelled
  paymentPlan: jsonb("payment_plan"), // installment details
  startDate: timestamp("start_date"),
  completedDate: timestamp("completed_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTreatmentPlanSchema = createInsertSchema(treatmentPlans).pick({
  companyId: true,
  patientId: true,
  professionalId: true,
  name: true,
  description: true,
  totalAmount: true,
  paidAmount: true,
  discountAmount: true,
  status: true,
  paymentPlan: true,
  startDate: true,
  completedDate: true,
  notes: true,
});

// Treatment Plan Procedures
export const treatmentPlanProcedures = pgTable("treatment_plan_procedures", {
  id: serial("id").primaryKey(),
  treatmentPlanId: integer("treatment_plan_id").notNull().references(() => treatmentPlans.id),
  procedureId: integer("procedure_id").notNull().references(() => procedures.id),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: integer("unit_price").notNull(), // in cents
  totalPrice: integer("total_price").notNull(), // in cents
  status: text("status").notNull().default("pending"), // pending, scheduled, completed
  appointmentId: integer("appointment_id").references(() => appointments.id),
  completedDate: timestamp("completed_date"),
  notes: text("notes"),
});

export const insertTreatmentPlanProcedureSchema = createInsertSchema(treatmentPlanProcedures).pick({
  treatmentPlanId: true,
  procedureId: true,
  quantity: true,
  unitPrice: true,
  totalPrice: true,
  status: true,
  appointmentId: true,
  completedDate: true,
  notes: true,
});

export type FinancialTransaction = typeof financialTransactions.$inferSelect;
export type InsertFinancialTransaction = z.infer<typeof insertFinancialTransactionSchema>;

export type TreatmentPlan = typeof treatmentPlans.$inferSelect;
export type InsertTreatmentPlan = z.infer<typeof insertTreatmentPlanSchema>;

export type TreatmentPlanProcedure = typeof treatmentPlanProcedures.$inferSelect;
export type InsertTreatmentPlanProcedure = z.infer<typeof insertTreatmentPlanProcedureSchema>;

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

// Types para Ficha Digital do Paciente
export type Anamnesis = typeof anamnesis.$inferSelect;
export type InsertAnamnesis = z.infer<typeof insertAnamnesisSchema>;

export type PatientExam = typeof patientExams.$inferSelect;
export type InsertPatientExam = z.infer<typeof insertPatientExamSchema>;

export type DetailedTreatmentPlan = typeof detailedTreatmentPlans.$inferSelect;
export type InsertDetailedTreatmentPlan = z.infer<typeof insertDetailedTreatmentPlanSchema>;

export type TreatmentEvolution = typeof treatmentEvolution.$inferSelect;
export type InsertTreatmentEvolution = z.infer<typeof insertTreatmentEvolutionSchema>;

export type Prescription = typeof prescriptions.$inferSelect;
export type InsertPrescription = z.infer<typeof insertPrescriptionSchema>;

// ============================================
// BILLING & SUBSCRIPTIONS (SaaS)
// ============================================

// Planos do SaaS
export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // basic, pro, enterprise
  displayName: text("display_name").notNull(), // "Básico", "Profissional", "Empresarial"
  description: text("description"),
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull(),
  yearlyPrice: decimal("yearly_price", { precision: 10, scale: 2 }),
  trialDays: integer("trial_days").notNull().default(7), // Consistente com a landing page
  maxUsers: integer("max_users").notNull().default(5),
  maxPatients: integer("max_patients").notNull().default(100),
  maxAppointmentsPerMonth: integer("max_appointments_per_month").notNull().default(500),
  maxAutomations: integer("max_automations").notNull().default(5),
  maxStorageGB: integer("max_storage_gb").notNull().default(5),
  features: jsonb("features").$type<string[]>(), // Lista de features incluídas
  isActive: boolean("is_active").notNull().default(true),
  isPopular: boolean("is_popular").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Features detalhadas dos planos
export const planFeatures = pgTable("plan_features", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => plans.id),
  featureKey: text("feature_key").notNull(), // whatsapp_integration, reports_pdf, etc.
  featureName: text("feature_name").notNull(),
  featureDescription: text("feature_description"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  limit: integer("limit"), // null = ilimitado
  createdAt: timestamp("created_at").defaultNow(),
});

// Assinaturas das empresas
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id).unique(),
  planId: integer("plan_id").notNull().references(() => plans.id),
  status: text("status").notNull().default("trial"), // trial, active, past_due, canceled, expired
  billingCycle: text("billing_cycle").notNull().default("monthly"), // monthly, yearly
  currentPeriodStart: timestamp("current_period_start").notNull().defaultNow(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  trialEndsAt: timestamp("trial_ends_at"),
  canceledAt: timestamp("canceled_at"),
  // Integração com gateways
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripeCustomerId: text("stripe_customer_id"),
  mercadoPagoSubscriptionId: text("mercado_pago_subscription_id").unique(),
  mercadoPagoCustomerId: text("mercado_pago_customer_id"),
  // Metadata
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Faturas de assinaturas
export const subscriptionInvoices = pgTable("subscription_invoices", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull().references(() => subscriptions.id),
  companyId: integer("company_id").notNull().references(() => companies.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // pending, paid, failed, refunded
  dueDate: timestamp("due_date").notNull(),
  paidAt: timestamp("paid_at"),
  // Integração com gateways
  stripeInvoiceId: text("stripe_invoice_id").unique(),
  mercadoPagoInvoiceId: text("mercado_pago_invoice_id").unique(),
  paymentMethod: text("payment_method"), // credit_card, pix, boleto
  invoiceUrl: text("invoice_url"),
  // Metadata
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Métricas de uso para enforcement de limites
export const usageMetrics = pgTable("usage_metrics", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  metricType: text("metric_type").notNull(), // users, patients, appointments, automations, storage_gb
  currentValue: integer("current_value").notNull().default(0),
  periodStart: timestamp("period_start").notNull().defaultNow(),
  periodEnd: timestamp("period_end").notNull(),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Histórico de mudanças de planos
export const subscriptionHistory = pgTable("subscription_history", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull().references(() => subscriptions.id),
  companyId: integer("company_id").notNull().references(() => companies.id),
  fromPlanId: integer("from_plan_id").references(() => plans.id),
  toPlanId: integer("to_plan_id").notNull().references(() => plans.id),
  reason: text("reason"), // upgrade, downgrade, trial_ended, payment_failed
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Cupons e Descontos
export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // Código do cupom (ex: "PROMO20", "BLACKFRIDAY")
  description: text("description"), // Descrição do cupom
  discountType: text("discount_type").notNull(), // "percentage" ou "fixed"
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(), // Valor ou percentual
  maxUses: integer("max_uses"), // Máximo de usos permitidos (null = ilimitado)
  usedCount: integer("used_count").notNull().default(0), // Quantas vezes foi usado
  validFrom: timestamp("valid_from").notNull(), // Data de início da validade
  validUntil: timestamp("valid_until"), // Data de fim da validade (null = sem expiração)
  planIds: jsonb("plan_ids").$type<number[]>(), // IDs dos planos que podem usar (null = todos)
  isActive: boolean("is_active").notNull().default(true),
  createdBy: integer("created_by").references(() => users.id), // Quem criou o cupom
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Histórico de uso de cupons
export const couponUsages = pgTable("coupon_usages", {
  id: serial("id").primaryKey(),
  couponId: integer("coupon_id").notNull().references(() => coupons.id),
  companyId: integer("company_id").notNull().references(() => companies.id),
  subscriptionId: integer("subscription_id").references(() => subscriptions.id),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull(), // Desconto aplicado
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert Schemas para Billing
export const insertPlanSchema = createInsertSchema(plans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPlanFeatureSchema = createInsertSchema(planFeatures).omit({
  id: true,
  createdAt: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubscriptionInvoiceSchema = createInsertSchema(subscriptionInvoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUsageMetricSchema = createInsertSchema(usageMetrics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubscriptionHistorySchema = createInsertSchema(subscriptionHistory).omit({
  id: true,
  createdAt: true,
});

export const insertCouponSchema = createInsertSchema(coupons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCouponUsageSchema = createInsertSchema(couponUsages).omit({
  id: true,
  createdAt: true,
});

// Automation Logs
export const automationLogs = pgTable("automation_logs", {
  id: serial("id").primaryKey(),
  automationId: integer("automation_id").references(() => automations.id, { onDelete: "cascade" }),
  appointmentId: integer("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  executionStatus: text("execution_status").notNull(), // success, error, skipped, pending
  executionTime: integer("execution_time"), // tempo em milissegundos
  errorMessage: text("error_message"),
  payload: jsonb("payload").$type<Record<string, any>>(),
  sentTo: text("sent_to"), // telefone ou email de destino
  messageId: text("message_id"), // ID da mensagem retornado pelo provedor
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAutomationLogSchema = createInsertSchema(automationLogs).omit({
  id: true,
  createdAt: true,
});

export type AutomationLog = typeof automationLogs.$inferSelect;
export type InsertAutomationLog = z.infer<typeof insertAutomationLogSchema>;

// Types para Billing
export type Plan = typeof plans.$inferSelect;
export type InsertPlan = z.infer<typeof insertPlanSchema>;

export type PlanFeature = typeof planFeatures.$inferSelect;
export type InsertPlanFeature = z.infer<typeof insertPlanFeatureSchema>;

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

export type SubscriptionInvoice = typeof subscriptionInvoices.$inferSelect;
export type InsertSubscriptionInvoice = z.infer<typeof insertSubscriptionInvoiceSchema>;

export type UsageMetric = typeof usageMetrics.$inferSelect;
export type InsertUsageMetric = z.infer<typeof insertUsageMetricSchema>;

export type SubscriptionHistory = typeof subscriptionHistory.$inferSelect;
export type InsertSubscriptionHistory = z.infer<typeof insertSubscriptionHistorySchema>;

// ============================================
// DIGITALIZAÇÃO DE FICHAS - CONTROLE DE USO
// ============================================

// Controle de uso de digitalização (OCR + AI)
export const digitalizationUsage = pgTable("digitalization_usage", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  usageCount: integer("usage_count").notNull().default(0), // Total de fichas digitalizadas
  lastUsedAt: timestamp("last_used_at"),
  billingCycle: text("billing_cycle").notNull().default("monthly"), // monthly, prepaid
  currentCycleStart: timestamp("current_cycle_start").notNull().defaultNow(),
  currentCycleEnd: timestamp("current_cycle_end").notNull(),
  currentCycleCount: integer("current_cycle_count").notNull().default(0), // Usos no ciclo atual
  paidUnits: integer("paid_units").notNull().default(0), // Unidades pagas antecipadamente
  remainingUnits: integer("remaining_units").notNull().default(0), // Unidades restantes (prepago)
  pricePerThousand: integer("price_per_thousand").notNull().default(3000), // R$ 30,00 em centavos
  totalSpent: integer("total_spent").notNull().default(0), // Total gasto em centavos
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDigitalizationUsageSchema = createInsertSchema(digitalizationUsage).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Log detalhado de cada digitalização
export const digitalizationLogs = pgTable("digitalization_logs", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  userId: integer("user_id").references(() => users.id),
  imageCount: integer("image_count").notNull().default(1), // Número de imagens processadas
  successCount: integer("success_count").notNull().default(0), // Fichas extraídas com sucesso
  failedCount: integer("failed_count").notNull().default(0), // Fichas com falha
  ocrConfidence: decimal("ocr_confidence", { precision: 5, scale: 2 }), // Confiança média do OCR
  aiModel: text("ai_model").notNull().default("deepseek-chat"), // Modelo AI usado
  processingTime: integer("processing_time"), // Tempo de processamento em ms
  cost: integer("cost").notNull().default(0), // Custo em centavos
  importType: text("import_type").notNull(), // images, xlsx
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDigitalizationLogSchema = createInsertSchema(digitalizationLogs).omit({
  id: true,
  createdAt: true,
});

// Histórico de Digitalizações
export const digitizationHistory = pgTable("digitization_history", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  userId: integer("user_id").notNull().references(() => users.id), // Usuário que executou a digitalização

  // Informações do processamento
  totalFiles: integer("total_files").notNull(), // Total de arquivos processados
  successCount: integer("success_count").notNull().default(0), // Quantos foram processados com sucesso
  errorCount: integer("error_count").notNull().default(0), // Quantos tiveram erro
  duplicateCount: integer("duplicate_count").notNull().default(0), // Quantas duplicatas foram encontradas

  // Formato de saída
  outputFormat: text("output_format").notNull(), // database, xlsx, csv, json
  downloadUrl: text("download_url"), // URL para download do arquivo gerado (se aplicável)

  // Armazenamento
  uploadedFilesPath: text("uploaded_files_path"), // Caminho onde os arquivos foram armazenados
  processedFilesSize: integer("processed_files_size"), // Tamanho total em bytes

  // Metadata adicional
  metadata: jsonb("metadata").$type<Record<string, any>>(),

  // Timestamps
  processedAt: timestamp("processed_at").defaultNow(),
  deletedAt: timestamp("deleted_at"), // Quando os arquivos temporários foram deletados
});

export const insertDigitizationHistorySchema = createInsertSchema(digitizationHistory).omit({
  id: true,
  processedAt: true,
});

// Faturas de digitalização
export const digitalizationInvoices = pgTable("digitalization_invoices", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  unitsUsed: integer("units_used").notNull(), // Quantidade de fichas digitalizadas
  amount: integer("amount").notNull(), // Valor em centavos
  status: text("status").notNull().default("pending"), // pending, paid, cancelled
  paidAt: timestamp("paid_at"),
  paymentMethod: text("payment_method"), // credit_card, pix, boleto
  invoiceUrl: text("invoice_url"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDigitalizationInvoiceSchema = createInsertSchema(digitalizationInvoices).omit({
  id: true,
  createdAt: true,
});

// Types para digitalização
export type DigitalizationUsage = typeof digitalizationUsage.$inferSelect;
export type InsertDigitalizationUsage = z.infer<typeof insertDigitalizationUsageSchema>;

export type DigitalizationLog = typeof digitalizationLogs.$inferSelect;
export type InsertDigitalizationLog = z.infer<typeof insertDigitalizationLogSchema>;

export type DigitalizationInvoice = typeof digitalizationInvoices.$inferSelect;

// =============================================
// WHATSAPP MESSAGES HISTORY
// =============================================

export const whatsappMessages = pgTable("whatsapp_messages", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  patientId: integer("patient_id").references(() => patients.id),
  appointmentId: integer("appointment_id").references(() => appointments.id),

  // Identificadores do WhatsApp
  messageId: text("message_id").notNull(), // ID único da mensagem no WhatsApp
  chatId: text("chat_id").notNull(), // ID do chat (número de telefone)

  // Conteúdo da mensagem
  content: text("content").notNull(), // Conteúdo da mensagem
  type: text("type").notNull().default("text"), // text, image, video, audio, document, location
  direction: text("direction").notNull(), // inbound (recebida), outbound (enviada)

  // Metadata
  from: text("from").notNull(), // Número de quem enviou
  to: text("to").notNull(), // Número de quem recebeu
  timestamp: timestamp("timestamp").notNull(), // Timestamp da mensagem
  status: text("status").notNull().default("sent"), // sent, delivered, read, failed
  mediaUrl: text("media_url"), // URL da mídia (se aplicável)
  error: text("error"), // Mensagem de erro (se falhou)

  // Automação
  isAutomated: boolean("is_automated").default(false), // Se foi enviada automaticamente
  automationType: text("automation_type"), // reminder, confirmation, follow_up
  templateId: text("template_id"), // ID do template usado (se aplicável)

  // Contexto
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages).omit({
  id: true,
  createdAt: true,
});

// =============================================
// AUDIT LOGS - LGPD COMPLIANCE
// =============================================

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  userId: integer("user_id").references(() => users.id),

  // Informações do evento
  action: text("action").notNull(), // create, update, delete, read, export, anonymize
  resource: text("resource").notNull(), // patients, appointments, users, etc
  resourceId: integer("resource_id"), // ID do recurso afetado

  // Dados sensíveis
  sensitiveData: boolean("sensitive_data").default(false), // Se envolve dados sensíveis (LGPD)
  dataCategory: text("data_category"), // personal, health, financial, etc

  // Contexto da ação
  description: text("description"), // Descrição da ação
  changes: jsonb("changes").$type<Record<string, any>>(), // Mudanças realizadas (before/after)
  reason: text("reason"), // Motivo da ação (especialmente para delete/export)

  // Informações técnicas
  ipAddress: text("ip_address"), // IP de onde veio a ação
  userAgent: text("user_agent"), // User Agent do navegador
  method: text("method"), // GET, POST, PUT, DELETE
  url: text("url"), // URL acessada
  statusCode: integer("status_code"), // HTTP status code

  // Compliance
  lgpdJustification: text("lgpd_justification"), // Justificativa LGPD para processamento
  consentGiven: boolean("consent_given"), // Se havia consentimento

  // Metadata
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

// Types para WhatsApp e Audit Logs
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// =============================================
// NOTIFICATIONS (Real-time System)
// =============================================

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  userId: integer("user_id").notNull().references(() => users.id), // Destinatário da notificação

  // Informações da notificação
  type: text("type").notNull(), // appointment, payment, patient, system, alert, reminder
  title: text("title").notNull(),
  message: text("message").notNull(),

  // Dados relacionados
  relatedResource: text("related_resource"), // appointments, patients, payments, etc
  relatedResourceId: integer("related_resource_id"), // ID do recurso relacionado

  // Estado
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),

  // Ação (link para navegar)
  actionUrl: text("action_url"), // URL para onde a notificação leva quando clicada

  // Prioridade
  priority: text("priority").notNull().default("normal"), // low, normal, high, urgent

  // Metadata adicional
  metadata: jsonb("metadata").$type<Record<string, any>>(),

  // Timestamp
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // Para notificações temporárias
});

// Schema para inserir notificação
export const insertNotificationSchema = z.object({
  companyId: z.number(),
  userId: z.number(),
  type: z.enum(['appointment', 'payment', 'patient', 'system', 'alert', 'reminder']),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  relatedResource: z.string().optional(),
  relatedResourceId: z.number().optional(),
  actionUrl: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  metadata: z.record(z.any()).optional(),
  expiresAt: z.date().optional(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

// =============================================
// MENU PERMISSIONS (Configurable by Admin)
// =============================================

export const menuPermissions = pgTable("menu_permissions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),

  // Papel do usuário
  role: text("role").notNull(), // admin, dentist, staff

  // Item do menu
  menuItem: text("menu_item").notNull(), // Ex: 'schedule', 'patients', 'financial', 'automation', etc
  label: text("label").notNull(), // Label personalizada (ex: "Agenda", "Pacientes")
  path: text("path").notNull(), // Caminho da rota (ex: '/schedule', '/patients')
  icon: text("icon").notNull(), // Nome do ícone Lucide (ex: 'Calendar', 'Users')

  // Controle de acesso
  canView: boolean("can_view").notNull().default(true), // Se pode ver o item no menu
  canCreate: boolean("can_create").notNull().default(false), // Se pode criar novos registros
  canEdit: boolean("can_edit").notNull().default(false), // Se pode editar registros
  canDelete: boolean("can_delete").notNull().default(false), // Se pode deletar registros

  // Ordenação no menu
  order: integer("order").notNull().default(0), // Ordem de exibição no menu

  // Metadata adicional
  metadata: jsonb("metadata").$type<Record<string, any>>(),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMenuPermissionSchema = createInsertSchema(menuPermissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type MenuPermission = typeof menuPermissions.$inferSelect;
export type InsertMenuPermission = z.infer<typeof insertMenuPermissionSchema>;

// =============================================
// CHAT & AUTOMATION SYSTEM (Código Primeiro)
// =============================================

// Chat Sessions - Gerencia conversas de WhatsApp
export const chatSessions = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  phone: varchar("phone", { length: 20 }).notNull(), // Telefone do usuário
  userType: varchar("user_type", { length: 20 }).notNull().default("unknown"), // 'patient', 'dentist', 'admin', 'unknown'
  patientId: integer("patient_id").references(() => patients.id),
  professionalId: integer("professional_id").references(() => users.id),
  status: varchar("status", { length: 20 }).default("active"), // 'active', 'waiting_human', 'closed'
  currentState: varchar("current_state", { length: 50 }), // Estado atual da state machine
  stateData: jsonb("state_data").$type<Record<string, any>>(), // Dados do estado atual
  context: jsonb("context").$type<Record<string, any>>(), // Contexto adicional
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;

// Chat Messages - Histórico de mensagens
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => chatSessions.id, { onDelete: "cascade" }),
  companyId: integer("company_id").references(() => companies.id),
  role: varchar("role", { length: 20 }), // 'user', 'assistant', 'system' (deprecated, use direction)
  direction: varchar("direction", { length: 20 }).default("incoming"), // 'incoming', 'outgoing'
  content: text("content").notNull(),
  messageType: varchar("message_type", { length: 20 }).default("text"), // 'text', 'audio', 'voice', 'image', 'video', 'document', 'sticker', 'location', 'contact'
  // Campos para mídia (imagens, áudios, vídeos, documentos)
  mediaUrl: varchar("media_url", { length: 500 }), // URL local do arquivo de mídia
  mimeType: varchar("mime_type", { length: 100 }), // 'image/jpeg', 'audio/ogg', etc.
  fileName: varchar("file_name", { length: 255 }), // Nome original do arquivo (para documentos)
  // Status da mensagem
  status: varchar("status", { length: 20 }).default("pending"), // 'pending', 'sent', 'delivered', 'read', 'failed', 'received'
  readAt: timestamp("read_at"), // Quando foi lida pelo destinatário
  // Análise e processamento
  intent: varchar("intent", { length: 50 }), // Intent detectado (para analytics)
  processedBy: varchar("processed_by", { length: 20 }), // 'code', 'state_machine', 'ai'
  tokensUsed: integer("tokens_used").default(0),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  wuzapiMessageId: varchar("wuzapi_message_id", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

// Canned Responses - Respostas prontas por intenção
export const cannedResponses = pgTable("canned_responses", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  intent: varchar("intent", { length: 50 }).notNull(), // 'greeting', 'location', 'hours', 'price_limpeza', etc.
  template: text("template").notNull(), // Template com variáveis {{var}}
  variables: jsonb("variables").$type<Record<string, string>>(), // Mapeamento de variáveis
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(0), // Para ordenação
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCannedResponseSchema = createInsertSchema(cannedResponses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CannedResponse = typeof cannedResponses.$inferSelect;
export type InsertCannedResponse = z.infer<typeof insertCannedResponseSchema>;

// Admin Phones - Telefones de administradores para notificações
export const adminPhones = pgTable("admin_phones", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  phone: varchar("phone", { length: 20 }).notNull(),
  name: varchar("name", { length: 100 }),
  role: varchar("role", { length: 50 }).default("admin"), // 'owner', 'manager', 'receptionist', 'admin'
  receiveDailyReport: boolean("receive_daily_report").default(true),
  receiveUrgencies: boolean("receive_urgencies").default(true),
  receiveNewAppointments: boolean("receive_new_appointments").default(true),
  receiveCancellations: boolean("receive_cancellations").default(true),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAdminPhoneSchema = createInsertSchema(adminPhones).omit({
  id: true,
  createdAt: true,
});

export type AdminPhone = typeof adminPhones.$inferSelect;
export type InsertAdminPhone = z.infer<typeof insertAdminPhoneSchema>;

// Intent Patterns - Padrões regex para classificar intenções
export const intentPatterns = pgTable("intent_patterns", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id), // NULL = padrão global
  intent: varchar("intent", { length: 50 }).notNull(), // 'confirm', 'cancel', 'schedule', 'price', etc.
  pattern: text("pattern").notNull(), // Padrão regex
  priority: integer("priority").default(0), // Maior = mais prioritário
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertIntentPatternSchema = createInsertSchema(intentPatterns).omit({
  id: true,
  createdAt: true,
});

export type IntentPattern = typeof intentPatterns.$inferSelect;
export type InsertIntentPattern = z.infer<typeof insertIntentPatternSchema>;

// =============================================
// REATIVAÇÃO DE PACIENTES
// =============================================

// Logs de reativação - rastreia mensagens enviadas para não enviar duplicado
export const reactivationLogs = pgTable("reactivation_logs", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  periodMonths: integer("period_months").notNull(), // 3, 6, 9 ou 12
  sentAt: timestamp("sent_at").defaultNow(),
  messageTemplate: text("message_template"), // Template usado
  whatsappMessageId: text("whatsapp_message_id"), // ID da mensagem no WhatsApp
  status: text("status").default("sent"), // sent, delivered, read, failed
  errorMessage: text("error_message"), // Mensagem de erro se falhou
  patientLastVisit: timestamp("patient_last_visit"), // Snapshot da última visita na hora do envio
});

export const insertReactivationLogSchema = createInsertSchema(reactivationLogs).omit({
  id: true,
  sentAt: true,
});

export type ReactivationLog = typeof reactivationLogs.$inferSelect;
export type InsertReactivationLog = z.infer<typeof insertReactivationLogSchema>;

// =============================================
// ALERTAS DE RISCO CLÍNICO
// =============================================

// Tipos de alertas de risco configuráveis por empresa
export const riskAlertTypes = pgTable("risk_alert_types", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id), // NULL = global
  code: text("code").notNull(), // "allergy", "cardiac", "diabetes", "anticoagulant", "pregnancy", etc
  name: text("name").notNull(), // "Alergia", "Cardiopatia", "Diabetes", etc
  color: text("color").notNull().default("#EF4444"), // Cor do badge (vermelho por padrão)
  icon: text("icon").default("alert-triangle"), // Ícone lucide-react
  severity: text("severity").notNull().default("high"), // "low", "medium", "high", "critical"
  description: text("description"), // Descrição do alerta
  clinicalWarning: text("clinical_warning"), // Aviso clínico (ex: "Suspender AAS 7 dias antes de procedimentos")
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRiskAlertTypeSchema = createInsertSchema(riskAlertTypes).omit({
  id: true,
  createdAt: true,
});

export type RiskAlertType = typeof riskAlertTypes.$inferSelect;
export type InsertRiskAlertType = z.infer<typeof insertRiskAlertTypeSchema>;

// Alertas ativos por paciente
export const patientRiskAlerts = pgTable("patient_risk_alerts", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  alertTypeId: integer("alert_type_id").notNull().references(() => riskAlertTypes.id),
  details: text("details"), // Detalhes específicos (ex: "Penicilina", "AAS 100mg/dia")
  notes: text("notes"), // Observações adicionais
  detectedAt: timestamp("detected_at").defaultNow(), // Quando foi detectado
  resolvedAt: timestamp("resolved_at"), // Se foi resolvido (ex: gestação terminou)
  isActive: boolean("is_active").default(true),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPatientRiskAlertSchema = createInsertSchema(patientRiskAlerts).omit({
  id: true,
  createdAt: true,
});

export type PatientRiskAlert = typeof patientRiskAlerts.$inferSelect;
export type InsertPatientRiskAlert = z.infer<typeof insertPatientRiskAlertSchema>;

// =============================================
// ANAMNESE VIA LINK PÚBLICO
// =============================================

// Links públicos de anamnese
export const publicAnamnesisLinks = pgTable("public_anamnesis_links", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  patientId: integer("patient_id").references(() => patients.id), // Pode ser null se for link genérico
  appointmentId: integer("appointment_id").references(() => appointments.id), // Opcional - vincula a agendamento
  templateId: integer("template_id").references(() => anamnesisTemplates.id), // Template a usar
  token: text("token").notNull().unique(), // Token único para URL
  expiresAt: timestamp("expires_at"), // Quando expira (null = não expira)
  usedAt: timestamp("used_at"), // Quando foi preenchido
  isActive: boolean("is_active").default(true),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPublicAnamnesisLinkSchema = createInsertSchema(publicAnamnesisLinks).omit({
  id: true,
  createdAt: true,
});

export type PublicAnamnesisLink = typeof publicAnamnesisLinks.$inferSelect;
export type InsertPublicAnamnesisLink = z.infer<typeof insertPublicAnamnesisLinkSchema>;

// Respostas de anamnese pública (quando paciente novo preenche sem cadastro prévio)
export const publicAnamnesisResponses = pgTable("public_anamnesis_responses", {
  id: serial("id").primaryKey(),
  linkId: integer("link_id").notNull().references(() => publicAnamnesisLinks.id),
  companyId: integer("company_id").notNull().references(() => companies.id),
  patientId: integer("patient_id").references(() => patients.id), // Vincula depois de criar paciente
  // Dados básicos do paciente (se não existe ainda)
  fullName: text("full_name"),
  email: text("email"),
  phone: text("phone"),
  cpf: text("cpf"),
  dateOfBirth: date("date_of_birth"),
  // Respostas da anamnese
  responses: jsonb("responses").$type<Record<string, any>>().notNull(), // { "tem_alergia": true, "qual_alergia": "Penicilina", ... }
  // Alertas detectados automaticamente
  detectedAlerts: jsonb("detected_alerts").$type<string[]>().default([]), // ["allergy", "cardiac", ...]
  // Metadados
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  consentGiven: boolean("consent_given").default(false),
  consentTimestamp: timestamp("consent_timestamp"),
  processedAt: timestamp("processed_at"), // Quando foi processado/importado
  status: text("status").default("pending"), // pending, processed, rejected
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPublicAnamnesisResponseSchema = createInsertSchema(publicAnamnesisResponses).omit({
  id: true,
  createdAt: true,
});

export type PublicAnamnesisResponse = typeof publicAnamnesisResponses.$inferSelect;
export type InsertPublicAnamnesisResponse = z.infer<typeof insertPublicAnamnesisResponseSchema>;

// =============================================
// CRM - FUNIL DE VENDAS
// =============================================

// Etapas do funil de vendas (configurável por empresa)
export const salesFunnelStages = pgTable("sales_funnel_stages", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(), // "Lead Novo", "Orçamento Enviado", "Negociação", "Fechado Ganho", "Fechado Perdido"
  code: text("code").notNull(), // "new_lead", "quote_sent", "negotiation", "won", "lost"
  color: text("color").notNull().default("#3B82F6"), // Cor para o kanban
  order: integer("order").notNull().default(0), // Ordem de exibição
  isDefault: boolean("is_default").default(false), // Etapa padrão para novos leads
  isWon: boolean("is_won").default(false), // É etapa de ganho?
  isLost: boolean("is_lost").default(false), // É etapa de perda?
  autoMoveAfterDays: integer("auto_move_after_days"), // Mover automaticamente após X dias
  nextStageId: integer("next_stage_id"), // Para qual etapa mover automaticamente
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSalesFunnelStageSchema = createInsertSchema(salesFunnelStages).omit({
  id: true,
  createdAt: true,
});

export type SalesFunnelStage = typeof salesFunnelStages.$inferSelect;
export type InsertSalesFunnelStage = z.infer<typeof insertSalesFunnelStageSchema>;

// Oportunidades de venda (leads no funil)
export const salesOpportunities = pgTable("sales_opportunities", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  patientId: integer("patient_id").references(() => patients.id), // Pode ser null se for lead novo
  stageId: integer("stage_id").notNull().references(() => salesFunnelStages.id),
  // Dados do lead (se não for paciente ainda)
  leadName: text("lead_name"),
  leadPhone: text("lead_phone"),
  leadEmail: text("lead_email"),
  leadSource: text("lead_source"), // "whatsapp", "instagram", "google", "indicacao", "site"
  // Dados da oportunidade
  title: text("title").notNull(), // "Implante - Maria Silva"
  description: text("description"),
  treatmentType: text("treatment_type"), // "implante", "ortodontia", "protese", "clareamento", etc
  estimatedValue: decimal("estimated_value", { precision: 10, scale: 2 }), // Valor estimado
  probability: integer("probability").default(50), // % de chance de fechar (0-100)
  expectedCloseDate: date("expected_close_date"), // Data prevista de fechamento
  // Responsável
  assignedTo: integer("assigned_to").references(() => users.id), // Quem está cuidando
  // Datas de movimentação
  stageEnteredAt: timestamp("stage_entered_at").defaultNow(), // Quando entrou na etapa atual
  lastContactAt: timestamp("last_contact_at"), // Último contato
  nextFollowUpAt: timestamp("next_follow_up_at"), // Próximo follow-up agendado
  // Resultado final
  wonAt: timestamp("won_at"),
  lostAt: timestamp("lost_at"),
  lostReason: text("lost_reason"), // "preco", "concorrente", "desistiu", "sem_resposta"
  // Metadados
  notes: text("notes"),
  tags: jsonb("tags").$type<string[]>().default([]),
  customFields: jsonb("custom_fields").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSalesOpportunitySchema = createInsertSchema(salesOpportunities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SalesOpportunity = typeof salesOpportunities.$inferSelect;
export type InsertSalesOpportunity = z.infer<typeof insertSalesOpportunitySchema>;

// Histórico de movimentações do funil
export const salesOpportunityHistory = pgTable("sales_opportunity_history", {
  id: serial("id").primaryKey(),
  opportunityId: integer("opportunity_id").notNull().references(() => salesOpportunities.id),
  fromStageId: integer("from_stage_id").references(() => salesFunnelStages.id),
  toStageId: integer("to_stage_id").references(() => salesFunnelStages.id),
  action: text("action").notNull(), // "stage_changed", "value_updated", "contact_made", "note_added"
  description: text("description"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export type SalesOpportunityHistory = typeof salesOpportunityHistory.$inferSelect;

// Tarefas/Follow-ups do CRM
export const salesTasks = pgTable("sales_tasks", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id),
  opportunityId: integer("opportunity_id").references(() => salesOpportunities.id),
  patientId: integer("patient_id").references(() => patients.id),
  assignedTo: integer("assigned_to").references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  taskType: text("task_type").notNull().default("follow_up"), // "follow_up", "call", "whatsapp", "email", "meeting"
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  priority: text("priority").default("normal"), // "low", "normal", "high", "urgent"
  status: text("status").default("pending"), // "pending", "completed", "cancelled"
  result: text("result"), // Resultado do contato
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSalesTaskSchema = createInsertSchema(salesTasks).omit({
  id: true,
  createdAt: true,
});

export type SalesTask = typeof salesTasks.$inferSelect;
export type InsertSalesTask = z.infer<typeof insertSalesTaskSchema>;

// =============================================
// EXPORT TYPES
// =============================================

export type InsertDigitalizationInvoice = z.infer<typeof insertDigitalizationInvoiceSchema>;
