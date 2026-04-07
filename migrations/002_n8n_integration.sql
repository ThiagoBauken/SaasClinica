-- Migration: N8N Integration Fields
-- Descrição: Adiciona campos necessários para integração com n8n e Wuzapi
-- Data: 2024-11-15

BEGIN;

-- ============================================
-- APPOINTMENTS: Campos de automação
-- ============================================
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT,
ADD COLUMN IF NOT EXISTS wuzapi_message_id TEXT,
ADD COLUMN IF NOT EXISTS automation_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS automation_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS automation_error TEXT,
ADD COLUMN IF NOT EXISTS last_reminder_sent TIMESTAMP;

COMMENT ON COLUMN appointments.google_calendar_event_id IS 'ID do evento no Google Calendar';
COMMENT ON COLUMN appointments.wuzapi_message_id IS 'ID da mensagem enviada via Wuzapi';
COMMENT ON COLUMN appointments.automation_status IS 'Status da automação: pending, sent, confirmed, error';
COMMENT ON COLUMN appointments.automation_sent_at IS 'Data/hora do envio da automação';
COMMENT ON COLUMN appointments.automation_error IS 'Mensagem de erro caso a automação falhe';
COMMENT ON COLUMN appointments.last_reminder_sent IS 'Data/hora do último lembrete enviado';

-- ============================================
-- USERS: Campos de integração (profissionais)
-- ============================================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS google_calendar_id TEXT,
ADD COLUMN IF NOT EXISTS wuzapi_phone TEXT;

COMMENT ON COLUMN users.google_calendar_id IS 'ID do Google Calendar do profissional (ex: dentista1@clinica.com.br)';
COMMENT ON COLUMN users.wuzapi_phone IS 'Telefone WhatsApp do profissional para notificações';

-- ============================================
-- AUTOMATIONS: Campos de tracking n8n
-- ============================================
ALTER TABLE automations
ADD COLUMN IF NOT EXISTS n8n_workflow_id TEXT,
ADD COLUMN IF NOT EXISTS last_execution TIMESTAMP,
ADD COLUMN IF NOT EXISTS execution_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error TEXT;

COMMENT ON COLUMN automations.n8n_workflow_id IS 'ID do workflow no n8n';
COMMENT ON COLUMN automations.last_execution IS 'Data/hora da última execução';
COMMENT ON COLUMN automations.execution_count IS 'Contador de execuções totais';
COMMENT ON COLUMN automations.error_count IS 'Contador de erros';
COMMENT ON COLUMN automations.last_error IS 'Última mensagem de erro';

-- ============================================
-- CLINIC_SETTINGS: Configurações Wuzapi e N8N
-- ============================================
ALTER TABLE clinic_settings
ADD COLUMN IF NOT EXISTS wuzapi_instance_id TEXT,
ADD COLUMN IF NOT EXISTS wuzapi_api_key TEXT,
ADD COLUMN IF NOT EXISTS default_google_calendar_id TEXT,
ADD COLUMN IF NOT EXISTS n8n_webhook_base_url TEXT,
ADD COLUMN IF NOT EXISTS admin_whatsapp_phone TEXT;

COMMENT ON COLUMN clinic_settings.wuzapi_instance_id IS 'ID da instância Wuzapi';
COMMENT ON COLUMN clinic_settings.wuzapi_api_key IS 'API Key do Wuzapi (criptografada)';
COMMENT ON COLUMN clinic_settings.default_google_calendar_id IS 'Google Calendar padrão da clínica';
COMMENT ON COLUMN clinic_settings.n8n_webhook_base_url IS 'URL base dos webhooks n8n (ex: https://n8n.clinica.com)';
COMMENT ON COLUMN clinic_settings.admin_whatsapp_phone IS 'Telefone WhatsApp do administrador para alertas';

-- ============================================
-- AUTOMATION_LOGS: Tabela de logs de execução
-- ============================================
CREATE TABLE IF NOT EXISTS automation_logs (
  id SERIAL PRIMARY KEY,
  automation_id INTEGER REFERENCES automations(id) ON DELETE CASCADE,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  execution_status TEXT NOT NULL CHECK (execution_status IN ('success', 'error', 'skipped', 'pending')),
  execution_time INTEGER, -- tempo em milissegundos
  error_message TEXT,
  payload JSONB,
  sent_to TEXT, -- telefone ou email de destino
  message_id TEXT, -- ID da mensagem (Wuzapi, email, etc)
  created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE automation_logs IS 'Logs de execução de automações';
COMMENT ON COLUMN automation_logs.execution_status IS 'Status: success, error, skipped, pending';
COMMENT ON COLUMN automation_logs.execution_time IS 'Tempo de execução em milissegundos';
COMMENT ON COLUMN automation_logs.payload IS 'Payload completo enviado';
COMMENT ON COLUMN automation_logs.sent_to IS 'Destinatário (telefone ou email)';
COMMENT ON COLUMN automation_logs.message_id IS 'ID da mensagem retornado pelo provedor';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_automation_logs_automation ON automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_appointment ON automation_logs(appointment_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_company ON automation_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON automation_logs(execution_status);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created_at ON automation_logs(created_at DESC);

-- ============================================
-- ÍNDICES ADICIONAIS PARA PERFORMANCE
-- ============================================

-- Appointments: busca rápida por automações pendentes
CREATE INDEX IF NOT EXISTS idx_appointments_automation_status
ON appointments(company_id, automation_enabled, automation_status, start_time)
WHERE automation_enabled = true;

-- Appointments: busca por profissional e data
CREATE INDEX IF NOT EXISTS idx_appointments_professional_date
ON appointments(professional_id, start_time);

-- Appointments: busca por sala e data (detectar conflitos)
CREATE INDEX IF NOT EXISTS idx_appointments_room_date
ON appointments(room_id, start_time, end_time)
WHERE status NOT IN ('cancelled', 'completed');

-- Patients: busca por aniversário
CREATE INDEX IF NOT EXISTS idx_patients_birthday
ON patients(company_id, birth_date)
WHERE active = true;

-- Automations: busca por trigger e empresa
CREATE INDEX IF NOT EXISTS idx_automations_trigger
ON automations(company_id, trigger_type, active)
WHERE active = true;

-- ============================================
-- CONSTRAINTS ADICIONAIS
-- ============================================

-- Validar formato de telefone WhatsApp (55 + DDD + número)
ALTER TABLE users
ADD CONSTRAINT chk_wuzapi_phone_format
CHECK (wuzapi_phone IS NULL OR wuzapi_phone ~ '^55[1-9]{2}9?[0-9]{8}$');

-- Validar status de automação
ALTER TABLE appointments
ADD CONSTRAINT chk_automation_status
CHECK (automation_status IN ('pending', 'sent', 'confirmed', 'cancelled', 'error'));

COMMIT;
