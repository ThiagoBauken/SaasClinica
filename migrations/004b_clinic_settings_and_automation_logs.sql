-- Migration 004: Clinic Settings, Automation Logs e Campos de Confirmação
-- Data: 2024-11-15
-- Descrição: Adiciona tabelas e campos necessários para integração completa com n8n, Wuzapi e Google Calendar

-- =============================================
-- 1. TABELA: clinic_settings
-- =============================================
-- Armazena configurações de integrações por empresa

CREATE TABLE IF NOT EXISTS clinic_settings (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,

  -- Configurações Wuzapi (WhatsApp Business API Oficial)
  wuzapi_instance_id TEXT,
  wuzapi_api_key TEXT,
  wuzapi_base_url TEXT DEFAULT 'https://wuzapi.cloud/api/v2',
  wuzapi_webhook_secret TEXT,

  -- Configurações Google Calendar
  default_google_calendar_id TEXT,
  google_calendar_timezone TEXT DEFAULT 'America/Sao_Paulo',

  -- Configurações N8N
  n8n_webhook_base_url TEXT,
  n8n_webhook_secret TEXT,

  -- WhatsApp do Admin para notificações
  admin_whatsapp_phone TEXT,

  -- Preferências de Automação
  enable_appointment_reminders BOOLEAN DEFAULT true,
  reminder_hours_before INTEGER DEFAULT 24, -- Horas antes para lembrete
  enable_birthday_messages BOOLEAN DEFAULT true,
  enable_feedback_requests BOOLEAN DEFAULT true,
  feedback_hours_after INTEGER DEFAULT 24, -- Horas depois para solicitar feedback

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índice para busca rápida por empresa
CREATE INDEX IF NOT EXISTS idx_clinic_settings_company ON clinic_settings(company_id);

COMMENT ON TABLE clinic_settings IS 'Configurações de integrações (Wuzapi, Google Calendar, N8N) por empresa';
COMMENT ON COLUMN clinic_settings.wuzapi_instance_id IS 'ID da instância Wuzapi para envio de WhatsApp';
COMMENT ON COLUMN clinic_settings.wuzapi_api_key IS 'API Key do Wuzapi (criptografada)';
COMMENT ON COLUMN clinic_settings.n8n_webhook_base_url IS 'URL base do n8n para disparar webhooks';
COMMENT ON COLUMN clinic_settings.reminder_hours_before IS 'Quantas horas antes enviar lembrete de agendamento';

-- =============================================
-- 2. TABELA: automation_logs
-- =============================================
-- Registra todas as execuções de automações para auditoria e debug

CREATE TABLE IF NOT EXISTS automation_logs (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Relacionamentos (opcionais)
  automation_id INTEGER REFERENCES automations(id) ON DELETE SET NULL,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,

  -- Detalhes da Execução
  execution_type TEXT NOT NULL, -- 'appointment_reminder', 'birthday', 'feedback', 'cancellation', etc.
  execution_status TEXT NOT NULL, -- 'success', 'error', 'pending', 'skipped'
  execution_time INTEGER, -- Tempo de execução em milissegundos

  -- Dados da Mensagem
  message_provider TEXT, -- 'wuzapi', 'email', 'sms'
  message_id TEXT, -- ID retornado pelo provedor (ex: Wuzapi message ID)
  sent_to TEXT, -- Número/email de destino
  message_content TEXT, -- Conteúdo enviado

  -- Erro (se houver)
  error_message TEXT,
  error_stack TEXT,

  -- Payload Completo (para debug)
  payload JSONB,

  -- Metadata
  triggered_by TEXT, -- 'n8n', 'manual', 'cron', 'webhook'
  triggered_at TIMESTAMP DEFAULT NOW(),

  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para queries eficientes
CREATE INDEX IF NOT EXISTS idx_automation_logs_company ON automation_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_appointment ON automation_logs(appointment_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_patient ON automation_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON automation_logs(execution_status);
CREATE INDEX IF NOT EXISTS idx_automation_logs_type ON automation_logs(execution_type);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created ON automation_logs(created_at DESC);

COMMENT ON TABLE automation_logs IS 'Log de todas execuções de automações para auditoria';
COMMENT ON COLUMN automation_logs.execution_type IS 'Tipo de automação executada';
COMMENT ON COLUMN automation_logs.execution_status IS 'Status: success, error, pending, skipped';
COMMENT ON COLUMN automation_logs.message_id IS 'ID da mensagem retornado pelo provedor';

-- =============================================
-- 3. ADICIONAR CAMPOS: patients
-- =============================================
-- Campo específico para WhatsApp (pode ser diferente do cellphone)

ALTER TABLE patients
ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;

COMMENT ON COLUMN patients.whatsapp_phone IS 'Número WhatsApp do paciente (pode ser diferente de cellphone)';

-- Criar índice para busca por WhatsApp
CREATE INDEX IF NOT EXISTS idx_patients_whatsapp ON patients(whatsapp_phone) WHERE whatsapp_phone IS NOT NULL;

-- =============================================
-- 4. ADICIONAR CAMPOS: appointments
-- =============================================
-- Campos para rastrear confirmação de agendamentos

ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS confirmation_method TEXT, -- 'whatsapp', 'sms', 'email', 'phone', 'manual'
ADD COLUMN IF NOT EXISTS confirmed_by_patient BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS confirmation_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS confirmation_message_id TEXT, -- ID da mensagem de confirmação enviada
ADD COLUMN IF NOT EXISTS patient_response TEXT; -- Resposta do paciente (ex: "SIM", "NÃO", "REAGENDAR")

COMMENT ON COLUMN appointments.confirmation_method IS 'Método usado para confirmar: whatsapp, sms, email, phone, manual';
COMMENT ON COLUMN appointments.confirmed_by_patient IS 'Se o paciente confirmou o agendamento';
COMMENT ON COLUMN appointments.confirmation_date IS 'Quando o paciente confirmou';
COMMENT ON COLUMN appointments.patient_response IS 'Resposta literal do paciente';

-- Índices para queries de confirmação
CREATE INDEX IF NOT EXISTS idx_appointments_confirmed ON appointments(confirmed_by_patient);
CREATE INDEX IF NOT EXISTS idx_appointments_confirmation_date ON appointments(confirmation_date);

-- =============================================
-- 5. VIEW: v_automation_stats
-- =============================================
-- View para estatísticas de automação (dashboard)

CREATE OR REPLACE VIEW v_automation_stats AS
SELECT
  al.company_id,
  al.execution_type,
  COUNT(*) as total_executions,
  COUNT(*) FILTER (WHERE al.execution_status = 'success') as successful,
  COUNT(*) FILTER (WHERE al.execution_status = 'error') as failed,
  COUNT(*) FILTER (WHERE al.execution_status = 'pending') as pending,
  AVG(al.execution_time) FILTER (WHERE al.execution_status = 'success') as avg_execution_time,
  DATE(al.created_at) as execution_date
FROM automation_logs al
GROUP BY al.company_id, al.execution_type, DATE(al.created_at);

COMMENT ON VIEW v_automation_stats IS 'Estatísticas agregadas de automações por empresa';

-- =============================================
-- 6. FUNÇÃO: log_automation_execution
-- =============================================
-- Função auxiliar para criar logs de automação facilmente

CREATE OR REPLACE FUNCTION log_automation_execution(
  p_company_id INTEGER,
  p_execution_type TEXT,
  p_execution_status TEXT,
  p_appointment_id INTEGER DEFAULT NULL,
  p_patient_id INTEGER DEFAULT NULL,
  p_message_provider TEXT DEFAULT NULL,
  p_message_id TEXT DEFAULT NULL,
  p_sent_to TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_payload JSONB DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_log_id INTEGER;
BEGIN
  INSERT INTO automation_logs (
    company_id,
    execution_type,
    execution_status,
    appointment_id,
    patient_id,
    message_provider,
    message_id,
    sent_to,
    error_message,
    payload,
    triggered_by,
    triggered_at
  ) VALUES (
    p_company_id,
    p_execution_type,
    p_execution_status,
    p_appointment_id,
    p_patient_id,
    p_message_provider,
    p_message_id,
    p_sent_to,
    p_error_message,
    p_payload,
    'n8n',
    NOW()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_automation_execution IS 'Cria log de execução de automação';

-- =============================================
-- 7. FUNÇÃO: get_appointments_needing_confirmation
-- =============================================
-- Retorna agendamentos que precisam de confirmação (1 dia antes)

CREATE OR REPLACE FUNCTION get_appointments_needing_confirmation(
  p_company_id INTEGER,
  p_hours_before INTEGER DEFAULT 24
)
RETURNS TABLE (
  appointment_id INTEGER,
  patient_id INTEGER,
  patient_name TEXT,
  patient_whatsapp TEXT,
  professional_name TEXT,
  room_name TEXT,
  start_time TIMESTAMP,
  end_time TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.patient_id,
    p.full_name,
    COALESCE(p.whatsapp_phone, p.cellphone) as patient_whatsapp,
    u.full_name as professional_name,
    r.name as room_name,
    a.start_time,
    a.end_time
  FROM appointments a
  INNER JOIN patients p ON a.patient_id = p.id
  INNER JOIN users u ON a.professional_id = u.id
  LEFT JOIN rooms r ON a.room_id = r.id
  WHERE a.company_id = p_company_id
    AND a.status IN ('scheduled', 'confirmed')
    AND a.confirmed_by_patient = false
    AND a.start_time > NOW()
    AND a.start_time <= NOW() + (p_hours_before || ' hours')::INTERVAL
    AND (a.confirmation_message_id IS NULL OR a.confirmation_date IS NULL);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_appointments_needing_confirmation IS 'Lista agendamentos que precisam de confirmação';

-- =============================================
-- 8. FUNÇÃO: get_today_birthdays
-- =============================================
-- Retorna pacientes que fazem aniversário hoje

CREATE OR REPLACE FUNCTION get_today_birthdays(p_company_id INTEGER)
RETURNS TABLE (
  patient_id INTEGER,
  patient_name TEXT,
  patient_whatsapp TEXT,
  birth_date DATE,
  age INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    COALESCE(p.whatsapp_phone, p.cellphone) as patient_whatsapp,
    p.birth_date,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.birth_date))::INTEGER as age
  FROM patients p
  WHERE p.company_id = p_company_id
    AND p.birth_date IS NOT NULL
    AND EXTRACT(MONTH FROM p.birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(DAY FROM p.birth_date) = EXTRACT(DAY FROM CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_today_birthdays IS 'Lista pacientes que fazem aniversário hoje';

-- =============================================
-- 9. ÍNDICES ADICIONAIS PARA PERFORMANCE
-- =============================================

-- Índice para busca de aniversários
CREATE INDEX IF NOT EXISTS idx_patients_birth_month_day
ON patients(EXTRACT(MONTH FROM birth_date), EXTRACT(DAY FROM birth_date))
WHERE birth_date IS NOT NULL;

-- Índice para agendamentos futuros
CREATE INDEX IF NOT EXISTS idx_appointments_future
ON appointments(company_id, start_time)
WHERE start_time > NOW() AND status IN ('scheduled', 'confirmed');

-- =============================================
-- 10. VALORES PADRÃO (OPCIONAL)
-- =============================================
-- Inserir configurações padrão para empresas existentes

INSERT INTO clinic_settings (company_id, enable_appointment_reminders, reminder_hours_before)
SELECT id, true, 24
FROM companies
WHERE id NOT IN (SELECT company_id FROM clinic_settings)
ON CONFLICT (company_id) DO NOTHING;

-- =============================================
-- FIM DA MIGRATION
-- =============================================

COMMIT;
