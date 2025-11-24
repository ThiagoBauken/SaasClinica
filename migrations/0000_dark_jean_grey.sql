CREATE TABLE "anamnesis" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"patient_id" integer NOT NULL,
	"chief_complaint" text,
	"current_illness_history" text,
	"medical_history" text,
	"current_medications" text,
	"allergies_detail" text,
	"previous_surgeries" text,
	"hospitalizations" text,
	"dental_history" text,
	"previous_dental_treatments" text,
	"orthodontic_treatment" boolean DEFAULT false,
	"oral_hygiene_frequency" text,
	"smoking" boolean DEFAULT false,
	"smoking_frequency" text,
	"alcohol" boolean DEFAULT false,
	"alcohol_frequency" text,
	"bruxism" boolean DEFAULT false,
	"nail_biting" boolean DEFAULT false,
	"heart_disease" boolean DEFAULT false,
	"high_blood_pressure" boolean DEFAULT false,
	"diabetes" boolean DEFAULT false,
	"hepatitis" boolean DEFAULT false,
	"kidney_disease" boolean DEFAULT false,
	"pregnant" boolean DEFAULT false,
	"pregnancy_month" integer,
	"additional_info" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "anamnesis_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"fields" jsonb NOT NULL,
	"active" boolean DEFAULT true,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "appointment_procedures" (
	"id" serial PRIMARY KEY NOT NULL,
	"appointment_id" integer NOT NULL,
	"procedure_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"price" integer NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"title" text NOT NULL,
	"patient_id" integer,
	"professional_id" integer,
	"room_id" integer,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"type" text DEFAULT 'appointment' NOT NULL,
	"notes" text,
	"color" text,
	"recurring" boolean DEFAULT false,
	"recurrence_pattern" text,
	"automation_enabled" boolean DEFAULT true,
	"automation_params" jsonb,
	"google_calendar_event_id" text,
	"wuzapi_message_id" text,
	"automation_status" text DEFAULT 'pending',
	"automation_sent_at" timestamp,
	"automation_error" text,
	"last_reminder_sent" timestamp,
	"confirmation_method" text,
	"confirmed_by_patient" boolean DEFAULT false,
	"confirmation_date" timestamp,
	"confirmation_message_id" text,
	"patient_response" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "automation_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"automation_id" integer,
	"appointment_id" integer,
	"company_id" integer NOT NULL,
	"execution_status" text NOT NULL,
	"execution_time" integer,
	"error_message" text,
	"payload" jsonb,
	"sent_to" text,
	"message_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"trigger_type" text NOT NULL,
	"time_before_value" integer,
	"time_before_unit" text,
	"appointment_status" text,
	"whatsapp_enabled" boolean DEFAULT false,
	"whatsapp_template_id" text,
	"whatsapp_template_variables" text,
	"email_enabled" boolean DEFAULT false,
	"email_sender" text,
	"email_subject" text,
	"email_body" text,
	"sms_enabled" boolean DEFAULT false,
	"sms_text" text,
	"webhook_url" text,
	"custom_headers" jsonb,
	"response_actions" jsonb,
	"log_level" text DEFAULT 'complete',
	"active" boolean DEFAULT true,
	"n8n_workflow_id" text,
	"last_execution" timestamp,
	"execution_count" integer DEFAULT 0,
	"error_count" integer DEFAULT 0,
	"last_error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "booking_link_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"professional_id" integer,
	"services" jsonb,
	"time_slot_duration" integer DEFAULT 30,
	"buffer_time" integer DEFAULT 0,
	"max_days_in_advance" integer DEFAULT 30,
	"min_hours_before_booking" integer DEFAULT 2,
	"disabled_days" jsonb,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "booking_link_settings_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "box_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"box_id" integer NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"description" text,
	"payment_method" text,
	"reference_id" integer,
	"reference_type" text,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "boxes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"opening_balance" numeric(10, 2) DEFAULT '0',
	"current_balance" numeric(10, 2) DEFAULT '0',
	"status" text DEFAULT 'open',
	"responsible_id" integer,
	"last_opened_at" timestamp DEFAULT now(),
	"last_closed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chairs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"room_id" integer,
	"description" text,
	"status" text DEFAULT 'active',
	"serial_number" text,
	"manufacturer" text,
	"purchase_date" date,
	"warranty_until" date,
	"maintenance_schedule" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clinic_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"name" text NOT NULL,
	"trading_name" text,
	"cnpj" text,
	"responsible" text,
	"email" text,
	"phone" text,
	"cellphone" text,
	"logo" text,
	"opening_time" text NOT NULL,
	"closing_time" text NOT NULL,
	"address" text,
	"neighborhood" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"complement" text,
	"number" text,
	"time_zone" text DEFAULT 'America/Sao_Paulo',
	"receipt_print_enabled" boolean DEFAULT false,
	"receipt_header" text,
	"receipt_footer" text,
	"wuzapi_instance_id" text,
	"wuzapi_api_key" text,
	"default_google_calendar_id" text,
	"n8n_webhook_base_url" text,
	"admin_whatsapp_phone" text,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "clinic_settings_company_id_unique" UNIQUE("company_id")
);
--> statement-breakpoint
CREATE TABLE "commission_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"appointment_id" integer,
	"procedure_id" integer,
	"amount" numeric(10, 2) NOT NULL,
	"status" text NOT NULL,
	"payment_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "commission_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"apply_to_all" boolean DEFAULT false,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "communication_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"whatsapp_integration_enabled" boolean DEFAULT false,
	"whatsapp_provider" text,
	"whatsapp_api_key" text,
	"whatsapp_number" text,
	"email_integration_enabled" boolean DEFAULT false,
	"email_provider" text,
	"email_api_key" text,
	"email_sender" text,
	"sms_integration_enabled" boolean DEFAULT false,
	"sms_provider" text,
	"sms_api_key" text,
	"sms_number" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"address" text,
	"cnpj" text,
	"active" boolean DEFAULT true NOT NULL,
	"trial_ends_at" timestamp,
	"openai_api_key" text,
	"n8n_webhook_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"module_id" integer NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"settings" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "detailed_treatment_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"patient_id" integer NOT NULL,
	"professional_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"diagnosis" text,
	"objectives" text,
	"phases" jsonb,
	"estimated_cost" integer,
	"approved_cost" integer,
	"status" text DEFAULT 'proposed',
	"priority" text DEFAULT 'normal',
	"proposed_date" timestamp DEFAULT now(),
	"approved_date" timestamp,
	"start_date" timestamp,
	"expected_end_date" timestamp,
	"completed_date" timestamp,
	"notes" text,
	"patient_consent" boolean DEFAULT false,
	"consent_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "digitalization_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"units_used" integer NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp,
	"payment_method" text,
	"invoice_url" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "digitalization_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"user_id" integer,
	"image_count" integer DEFAULT 1 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"ocr_confidence" numeric(5, 2),
	"ai_model" text DEFAULT 'deepseek-chat' NOT NULL,
	"processing_time" integer,
	"cost" integer DEFAULT 0 NOT NULL,
	"import_type" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "digitalization_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"billing_cycle" text DEFAULT 'monthly' NOT NULL,
	"current_cycle_start" timestamp DEFAULT now() NOT NULL,
	"current_cycle_end" timestamp NOT NULL,
	"current_cycle_count" integer DEFAULT 0 NOT NULL,
	"paid_units" integer DEFAULT 0 NOT NULL,
	"remaining_units" integer DEFAULT 0 NOT NULL,
	"price_per_thousand" integer DEFAULT 3000 NOT NULL,
	"total_spent" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "financial_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"color" text,
	"parent_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "financial_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"type" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"amount" integer NOT NULL,
	"patient_id" integer,
	"appointment_id" integer,
	"professional_id" integer,
	"date" timestamp NOT NULL,
	"due_date" timestamp,
	"payment_method" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"installments" integer DEFAULT 1,
	"installments_paid" integer DEFAULT 0,
	"fee_amount" integer DEFAULT 0,
	"net_amount" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fiscal_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"nfse_provider" text,
	"nfse_token" text,
	"nfse_url" text,
	"emit_receipt_for" text DEFAULT 'all',
	"receipt_type" text DEFAULT 'standard',
	"default_tax_rate" numeric(5, 2),
	"default_service_code" text,
	"terms_and_conditions" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"name" text NOT NULL,
	"date" timestamp NOT NULL,
	"is_recurring_yearly" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category_id" integer,
	"sku" text,
	"barcode" text,
	"brand" text,
	"supplier" text,
	"minimum_stock" integer DEFAULT 0,
	"current_stock" integer DEFAULT 0,
	"price" integer,
	"unit_of_measure" text,
	"expiration_date" timestamp,
	"location" text,
	"last_purchase_date" timestamp,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"quantity" integer NOT NULL,
	"reason" text,
	"notes" text,
	"previous_stock" integer NOT NULL,
	"new_stock" integer NOT NULL,
	"appointment_id" integer,
	"patient_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "laboratories" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"contact_name" varchar(255),
	"phone" varchar(50),
	"email" varchar(255),
	"address" text,
	"cnpj" varchar(20),
	"specialties" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "machine_taxes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"provider" text,
	"credit_tax" numeric(5, 2) DEFAULT '0',
	"debit_tax" numeric(5, 2) DEFAULT '0',
	"credit_installment_taxes" jsonb,
	"pix_tax" numeric(5, 2) DEFAULT '0',
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mercado_pago_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"plan_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"next_billing_date" timestamp,
	"mercado_pago_id" text,
	"payment_method" text DEFAULT 'mercadopago' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"required_permissions" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "modules_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "odontogram_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"patient_id" integer NOT NULL,
	"tooth_id" text NOT NULL,
	"face_id" text,
	"status" text NOT NULL,
	"color" text,
	"notes" text,
	"procedure_id" integer,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "patient_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"file_url" text NOT NULL,
	"file_type" text,
	"uploaded_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "patient_exams" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"patient_id" integer NOT NULL,
	"exam_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"exam_date" timestamp DEFAULT now(),
	"file_url" text,
	"file_type" text,
	"results" text,
	"observations" text,
	"requested_by" integer NOT NULL,
	"performed_at" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "patient_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"patient_id" integer NOT NULL,
	"record_type" text NOT NULL,
	"content" jsonb NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"full_name" text NOT NULL,
	"birth_date" timestamp,
	"cpf" text,
	"rg" text,
	"gender" text,
	"nationality" text,
	"marital_status" text,
	"profession" text,
	"email" text,
	"phone" text,
	"cellphone" text,
	"whatsapp_phone" text,
	"address" text,
	"neighborhood" text,
	"city" text,
	"state" text,
	"cep" text,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"emergency_contact_relation" text,
	"health_insurance" text,
	"health_insurance_number" text,
	"blood_type" text,
	"allergies" text,
	"medications" text,
	"chronic_diseases" text,
	"patient_number" text,
	"status" text DEFAULT 'active',
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"profile_photo" text,
	"last_visit" timestamp,
	"insurance_info" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "patients_patient_number_unique" UNIQUE("patient_number")
);
--> statement-breakpoint
CREATE TABLE "payment_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"installments" integer DEFAULT 1,
	"interval" text DEFAULT 'month',
	"interest" numeric(5, 2) DEFAULT '0',
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"subscription_id" integer,
	"appointment_id" integer,
	"patient_id" integer,
	"amount" numeric(10, 2) NOT NULL,
	"status" text NOT NULL,
	"payment_date" timestamp NOT NULL,
	"payment_method" text NOT NULL,
	"mercado_pago_id" text,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "periodontal_chart" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"patient_id" integer NOT NULL,
	"professional_id" integer,
	"chart_date" timestamp DEFAULT now() NOT NULL,
	"teeth_data" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"general_notes" text,
	"diagnosis" text,
	"treatment_plan" text,
	"plaque_index" numeric(5, 2),
	"bleeding_index" numeric(5, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"module" text NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "plan_features" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"feature_key" text NOT NULL,
	"feature_name" text NOT NULL,
	"feature_description" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"limit" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"monthly_price" numeric(10, 2) NOT NULL,
	"yearly_price" numeric(10, 2),
	"trial_days" integer DEFAULT 14 NOT NULL,
	"max_users" integer DEFAULT 5 NOT NULL,
	"max_patients" integer DEFAULT 100 NOT NULL,
	"max_appointments_per_month" integer DEFAULT 500 NOT NULL,
	"max_automations" integer DEFAULT 5 NOT NULL,
	"max_storage_gb" integer DEFAULT 5 NOT NULL,
	"features" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_popular" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "plans_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "prescriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"patient_id" integer NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"medications" jsonb,
	"instructions" text,
	"attestation_type" text,
	"period" text,
	"cid" text,
	"valid_until" timestamp,
	"prescribed_by" integer NOT NULL,
	"issued" boolean DEFAULT false,
	"issued_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "procedure_commissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"procedure_id" integer NOT NULL,
	"type" text NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "procedures" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"duration" integer NOT NULL,
	"price" integer NOT NULL,
	"description" text,
	"color" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prosthesis" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"patient_id" integer NOT NULL,
	"professional_id" integer NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"laboratory" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sent_date" date,
	"expected_return_date" date,
	"return_date" date,
	"observations" text,
	"labels" jsonb DEFAULT '[]'::jsonb,
	"cost" integer DEFAULT 0,
	"price" integer DEFAULT 0,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prosthesis_labels" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(7) DEFAULT '#3B82F6' NOT NULL,
	"description" text,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prosthesis_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"professional_id" integer NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"laboratory" text,
	"status" text DEFAULT 'ordered' NOT NULL,
	"sent_date" date,
	"expected_return_date" date,
	"returned_date" date,
	"cost" numeric(10, 2),
	"price" numeric(10, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prosthesis_stages" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending',
	"order" integer NOT NULL,
	"completed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prosthesis_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"default_stages" jsonb,
	"default_price" numeric(10, 2),
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sales_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"user_id" integer,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"target_value" numeric(10, 2) NOT NULL,
	"target_type" text NOT NULL,
	"current_value" numeric(10, 2) DEFAULT '0',
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shop_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"sale_price" numeric(10, 2),
	"inventory_item_id" integer,
	"category_id" integer,
	"images" jsonb,
	"featured" boolean DEFAULT false,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "standard_dental_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"brand" text,
	"unit_of_measure" text NOT NULL,
	"estimated_price" integer,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"is_popular" boolean DEFAULT false,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"from_plan_id" integer,
	"to_plan_id" integer NOT NULL,
	"reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"due_date" timestamp NOT NULL,
	"paid_at" timestamp,
	"stripe_invoice_id" text,
	"mercado_pago_invoice_id" text,
	"payment_method" text,
	"invoice_url" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "subscription_invoices_stripe_invoice_id_unique" UNIQUE("stripe_invoice_id"),
	CONSTRAINT "subscription_invoices_mercado_pago_invoice_id_unique" UNIQUE("mercado_pago_invoice_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"plan_id" integer NOT NULL,
	"status" text DEFAULT 'trial' NOT NULL,
	"billing_cycle" text DEFAULT 'monthly' NOT NULL,
	"current_period_start" timestamp DEFAULT now() NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"trial_ends_at" timestamp,
	"canceled_at" timestamp,
	"stripe_subscription_id" text,
	"stripe_customer_id" text,
	"mercado_pago_subscription_id" text,
	"mercado_pago_customer_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "subscriptions_company_id_unique" UNIQUE("company_id"),
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id"),
	CONSTRAINT "subscriptions_mercado_pago_subscription_id_unique" UNIQUE("mercado_pago_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"assigned_to" integer,
	"patient_id" integer,
	"due_date" timestamp,
	"priority" text DEFAULT 'medium',
	"status" text DEFAULT 'pending',
	"completed_at" timestamp,
	"completed_by" integer,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "treatment_evolution" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"patient_id" integer NOT NULL,
	"appointment_id" integer,
	"treatment_plan_id" integer,
	"session_date" timestamp NOT NULL,
	"session_number" integer,
	"procedures_performed" text,
	"materials_used" text,
	"clinical_observations" text,
	"patient_response" text,
	"complications" text,
	"next_session" text,
	"homecare_instructions" text,
	"performed_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "treatment_plan_procedures" (
	"id" serial PRIMARY KEY NOT NULL,
	"treatment_plan_id" integer NOT NULL,
	"procedure_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" integer NOT NULL,
	"total_price" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"appointment_id" integer,
	"completed_date" timestamp,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "treatment_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"patient_id" integer NOT NULL,
	"professional_id" integer,
	"name" text NOT NULL,
	"description" text,
	"total_amount" integer NOT NULL,
	"paid_amount" integer DEFAULT 0,
	"discount_amount" integer DEFAULT 0,
	"status" text DEFAULT 'proposed' NOT NULL,
	"payment_plan" jsonb,
	"start_date" timestamp,
	"completed_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "usage_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"metric_type" text NOT NULL,
	"current_value" integer DEFAULT 0 NOT NULL,
	"period_start" timestamp DEFAULT now() NOT NULL,
	"period_end" timestamp NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"full_name" text NOT NULL,
	"role" text DEFAULT 'staff' NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"profile_image_url" text,
	"speciality" text,
	"active" boolean DEFAULT true NOT NULL,
	"google_id" text,
	"google_calendar_id" text,
	"google_access_token" text,
	"google_refresh_token" text,
	"google_token_expiry" timestamp,
	"wuzapi_phone" text,
	"trial_ends_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
CREATE TABLE "working_hours" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"is_working" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anamnesis" ADD CONSTRAINT "anamnesis_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anamnesis" ADD CONSTRAINT "anamnesis_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anamnesis" ADD CONSTRAINT "anamnesis_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anamnesis_templates" ADD CONSTRAINT "anamnesis_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_procedures" ADD CONSTRAINT "appointment_procedures_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_procedures" ADD CONSTRAINT "appointment_procedures_procedure_id_procedures_id_fk" FOREIGN KEY ("procedure_id") REFERENCES "public"."procedures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_professional_id_users_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_logs" ADD CONSTRAINT "automation_logs_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_logs" ADD CONSTRAINT "automation_logs_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_logs" ADD CONSTRAINT "automation_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_link_settings" ADD CONSTRAINT "booking_link_settings_professional_id_users_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "box_transactions" ADD CONSTRAINT "box_transactions_box_id_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "box_transactions" ADD CONSTRAINT "box_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boxes" ADD CONSTRAINT "boxes_responsible_id_users_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chairs" ADD CONSTRAINT "chairs_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_settings" ADD CONSTRAINT "clinic_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_records" ADD CONSTRAINT "commission_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_records" ADD CONSTRAINT "commission_records_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_records" ADD CONSTRAINT "commission_records_procedure_id_procedures_id_fk" FOREIGN KEY ("procedure_id") REFERENCES "public"."procedures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_settings" ADD CONSTRAINT "commission_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_modules" ADD CONSTRAINT "company_modules_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_modules" ADD CONSTRAINT "company_modules_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detailed_treatment_plans" ADD CONSTRAINT "detailed_treatment_plans_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detailed_treatment_plans" ADD CONSTRAINT "detailed_treatment_plans_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detailed_treatment_plans" ADD CONSTRAINT "detailed_treatment_plans_professional_id_users_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digitalization_invoices" ADD CONSTRAINT "digitalization_invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digitalization_logs" ADD CONSTRAINT "digitalization_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digitalization_logs" ADD CONSTRAINT "digitalization_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digitalization_usage" ADD CONSTRAINT "digitalization_usage_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_categories" ADD CONSTRAINT "financial_categories_parent_id_financial_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."financial_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_professional_id_users_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_categories" ADD CONSTRAINT "inventory_categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_category_id_inventory_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."inventory_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "laboratories" ADD CONSTRAINT "laboratories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mercado_pago_subscriptions" ADD CONSTRAINT "mercado_pago_subscriptions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontogram_entries" ADD CONSTRAINT "odontogram_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontogram_entries" ADD CONSTRAINT "odontogram_entries_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontogram_entries" ADD CONSTRAINT "odontogram_entries_procedure_id_procedures_id_fk" FOREIGN KEY ("procedure_id") REFERENCES "public"."procedures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontogram_entries" ADD CONSTRAINT "odontogram_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_documents" ADD CONSTRAINT "patient_documents_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_documents" ADD CONSTRAINT "patient_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_exams" ADD CONSTRAINT "patient_exams_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_exams" ADD CONSTRAINT "patient_exams_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_exams" ADD CONSTRAINT "patient_exams_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_records" ADD CONSTRAINT "patient_records_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_records" ADD CONSTRAINT "patient_records_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_records" ADD CONSTRAINT "patient_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periodontal_chart" ADD CONSTRAINT "periodontal_chart_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periodontal_chart" ADD CONSTRAINT "periodontal_chart_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periodontal_chart" ADD CONSTRAINT "periodontal_chart_professional_id_users_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_prescribed_by_users_id_fk" FOREIGN KEY ("prescribed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedure_commissions" ADD CONSTRAINT "procedure_commissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedure_commissions" ADD CONSTRAINT "procedure_commissions_procedure_id_procedures_id_fk" FOREIGN KEY ("procedure_id") REFERENCES "public"."procedures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prosthesis" ADD CONSTRAINT "prosthesis_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prosthesis" ADD CONSTRAINT "prosthesis_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prosthesis" ADD CONSTRAINT "prosthesis_professional_id_users_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prosthesis_labels" ADD CONSTRAINT "prosthesis_labels_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prosthesis_services" ADD CONSTRAINT "prosthesis_services_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prosthesis_services" ADD CONSTRAINT "prosthesis_services_professional_id_users_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prosthesis_stages" ADD CONSTRAINT "prosthesis_stages_service_id_prosthesis_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."prosthesis_services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_goals" ADD CONSTRAINT "sales_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_items" ADD CONSTRAINT "shop_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_items" ADD CONSTRAINT "shop_items_category_id_inventory_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."inventory_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_from_plan_id_plans_id_fk" FOREIGN KEY ("from_plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_to_plan_id_plans_id_fk" FOREIGN KEY ("to_plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_evolution" ADD CONSTRAINT "treatment_evolution_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_evolution" ADD CONSTRAINT "treatment_evolution_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_evolution" ADD CONSTRAINT "treatment_evolution_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_evolution" ADD CONSTRAINT "treatment_evolution_treatment_plan_id_detailed_treatment_plans_id_fk" FOREIGN KEY ("treatment_plan_id") REFERENCES "public"."detailed_treatment_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_evolution" ADD CONSTRAINT "treatment_evolution_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plan_procedures" ADD CONSTRAINT "treatment_plan_procedures_treatment_plan_id_treatment_plans_id_fk" FOREIGN KEY ("treatment_plan_id") REFERENCES "public"."treatment_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plan_procedures" ADD CONSTRAINT "treatment_plan_procedures_procedure_id_procedures_id_fk" FOREIGN KEY ("procedure_id") REFERENCES "public"."procedures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plan_procedures" ADD CONSTRAINT "treatment_plan_procedures_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_professional_id_users_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_metrics" ADD CONSTRAINT "usage_metrics_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "working_hours" ADD CONSTRAINT "working_hours_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;