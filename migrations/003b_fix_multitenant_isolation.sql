-- Migration: Fix Multi-Tenant Isolation
-- Descrição: Adiciona companyId em tabelas que estão faltando para isolamento correto
-- Data: 2024-11-15
-- CRÍTICO: Sem isso, múltiplas clínicas compartilham salas, procedimentos e feriados!

BEGIN;

-- ============================================
-- ROOMS: ADICIONAR companyId
-- ============================================
-- PROBLEMA: Todas as clínicas estão compartilhando as mesmas salas!
-- SOLUÇÃO: Adicionar companyId para isolar salas por empresa

ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;

COMMENT ON COLUMN rooms.company_id IS 'Isolamento multi-tenant: cada clínica tem suas próprias salas';

-- Atualizar salas existentes (se houver) para pertencer à primeira empresa
-- ATENÇÃO: Ajuste conforme necessário em produção!
UPDATE rooms
SET company_id = (SELECT id FROM companies ORDER BY id LIMIT 1)
WHERE company_id IS NULL;

-- Tornar obrigatório após migração
ALTER TABLE rooms
ALTER COLUMN company_id SET NOT NULL;

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_rooms_company ON rooms(company_id, active);

-- ============================================
-- PROCEDURES: ADICIONAR companyId
-- ============================================
-- PROBLEMA: Todas as clínicas compartilham os mesmos procedimentos!
-- SOLUÇÃO: Cada clínica deve ter seus próprios procedimentos e preços

ALTER TABLE procedures
ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;

COMMENT ON COLUMN procedures.company_id IS 'Isolamento multi-tenant: cada clínica define seus procedimentos e preços';

-- Migrar procedures existentes
UPDATE procedures
SET company_id = (SELECT id FROM companies ORDER BY id LIMIT 1)
WHERE company_id IS NULL;

-- Tornar obrigatório
ALTER TABLE procedures
ALTER COLUMN company_id SET NOT NULL;

-- Índice
CREATE INDEX IF NOT EXISTS idx_procedures_company ON procedures(company_id);

-- ============================================
-- HOLIDAYS: ADICIONAR companyId
-- ============================================
-- PROBLEMA: Todos os feriados são globais, mas podem variar por região/clínica
-- SOLUÇÃO: Feriados específicos por clínica

ALTER TABLE holidays
ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;

COMMENT ON COLUMN holidays.company_id IS 'NULL = feriado nacional, preenchido = feriado específico da clínica';

-- Nota: Mantemos company_id como NULLABLE para permitir feriados nacionais
-- Feriados nacionais (company_id = NULL) são compartilhados
-- Feriados específicos têm company_id preenchido

-- Índice
CREATE INDEX IF NOT EXISTS idx_holidays_company ON holidays(company_id, date);

-- ============================================
-- WORKING_HOURS: Verificar isolamento
-- ============================================
-- OK: working_hours já está isolado via userId → users.companyId

-- ============================================
-- CONSTRAINTS DE UNIQUE COMPOSTOS
-- ============================================

-- Rooms: Não pode ter 2 salas com mesmo nome na mesma empresa
DROP INDEX IF EXISTS rooms_name_key; -- Remove unique global se existir
CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_name_company
ON rooms(company_id, name) WHERE active = true;

-- Procedures: Nome único por empresa
CREATE UNIQUE INDEX IF NOT EXISTS idx_procedures_name_company
ON procedures(company_id, name);

-- ============================================
-- VALIDAÇÃO DE DISPONIBILIDADE MULTI-TENANT
-- ============================================

-- Função para verificar conflito de sala (IMPORTANTE para n8n)
CREATE OR REPLACE FUNCTION check_room_availability(
  p_room_id INTEGER,
  p_company_id INTEGER,
  p_start_time TIMESTAMP,
  p_end_time TIMESTAMP,
  p_exclude_appointment_id INTEGER DEFAULT NULL
) RETURNS TABLE(
  has_conflict BOOLEAN,
  conflict_appointment_id INTEGER,
  conflict_patient_name TEXT,
  conflict_professional_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    TRUE as has_conflict,
    a.id as conflict_appointment_id,
    p.full_name as conflict_patient_name,
    u.full_name as conflict_professional_name
  FROM appointments a
  LEFT JOIN patients p ON a.patient_id = p.id
  LEFT JOIN users u ON a.professional_id = u.id
  WHERE a.room_id = p_room_id
    AND a.company_id = p_company_id
    AND a.status NOT IN ('cancelled', 'completed', 'no_show')
    AND (p_exclude_appointment_id IS NULL OR a.id != p_exclude_appointment_id)
    AND (
      (a.start_time, a.end_time) OVERLAPS (p_start_time, p_end_time)
    )
  LIMIT 1;

  -- Se não encontrou conflito, retornar FALSE
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER, NULL::TEXT, NULL::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_room_availability IS 'Verifica conflito de horário para sala específica. Usado pelo n8n e backend.';

-- ============================================
-- Função para verificar disponibilidade do profissional
-- ============================================

CREATE OR REPLACE FUNCTION check_professional_availability(
  p_professional_id INTEGER,
  p_company_id INTEGER,
  p_start_time TIMESTAMP,
  p_end_time TIMESTAMP,
  p_exclude_appointment_id INTEGER DEFAULT NULL
) RETURNS TABLE(
  has_conflict BOOLEAN,
  conflict_appointment_id INTEGER,
  conflict_patient_name TEXT,
  conflict_room_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    TRUE as has_conflict,
    a.id as conflict_appointment_id,
    p.full_name as conflict_patient_name,
    r.name as conflict_room_name
  FROM appointments a
  LEFT JOIN patients p ON a.patient_id = p.id
  LEFT JOIN rooms r ON a.room_id = r.id
  WHERE a.professional_id = p_professional_id
    AND a.company_id = p_company_id
    AND a.status NOT IN ('cancelled', 'completed', 'no_show')
    AND (p_exclude_appointment_id IS NULL OR a.id != p_exclude_appointment_id)
    AND (
      (a.start_time, a.end_time) OVERLAPS (p_start_time, p_end_time)
    )
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER, NULL::TEXT, NULL::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_professional_availability IS 'Verifica conflito de horário para profissional. Previne double booking.';

-- ============================================
-- Função para buscar automações ativas de uma empresa
-- ============================================

CREATE OR REPLACE FUNCTION get_active_automations(
  p_company_id INTEGER,
  p_trigger_type TEXT DEFAULT NULL
) RETURNS TABLE(
  id INTEGER,
  name TEXT,
  trigger_type TEXT,
  time_before_value INTEGER,
  time_before_unit TEXT,
  whatsapp_enabled BOOLEAN,
  whatsapp_template_id TEXT,
  email_enabled BOOLEAN,
  email_subject TEXT,
  webhook_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.name,
    a.trigger_type,
    a.time_before_value,
    a.time_before_unit,
    a.whatsapp_enabled,
    a.whatsapp_template_id,
    a.email_enabled,
    a.email_subject,
    a.webhook_url
  FROM automations a
  WHERE a.company_id = p_company_id
    AND a.active = true
    AND (p_trigger_type IS NULL OR a.trigger_type = p_trigger_type)
  ORDER BY a.id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_active_automations IS 'Retorna automações ativas de uma empresa. Usado pelo n8n para processar triggers.';

-- ============================================
-- VIEW: Dashboard de automações por empresa
-- ============================================

CREATE OR REPLACE VIEW v_automation_stats AS
SELECT
  a.company_id,
  a.id as automation_id,
  a.name as automation_name,
  a.trigger_type,
  a.active,
  COUNT(al.id) as total_executions,
  COUNT(al.id) FILTER (WHERE al.execution_status = 'success') as successful_executions,
  COUNT(al.id) FILTER (WHERE al.execution_status = 'error') as failed_executions,
  ROUND(
    100.0 * COUNT(al.id) FILTER (WHERE al.execution_status = 'success') / NULLIF(COUNT(al.id), 0),
    2
  ) as success_rate,
  MAX(al.created_at) as last_execution
FROM automations a
LEFT JOIN automation_logs al ON a.id = al.automation_id
GROUP BY a.company_id, a.id, a.name, a.trigger_type, a.active;

COMMENT ON VIEW v_automation_stats IS 'Estatísticas de automações por empresa para dashboard';

-- ============================================
-- ÍNDICES ADICIONAIS PARA PERFORMANCE
-- ============================================

-- Appointments: busca por overlap de horário (usado nas funções acima)
CREATE INDEX IF NOT EXISTS idx_appointments_time_overlap
ON appointments(company_id, start_time, end_time, status)
WHERE status NOT IN ('cancelled', 'completed', 'no_show');

-- Automation logs: busca por empresa e status
CREATE INDEX IF NOT EXISTS idx_automation_logs_company_status
ON automation_logs(company_id, execution_status, created_at DESC);

COMMIT;

-- ============================================
-- VERIFICAÇÃO PÓS-MIGRAÇÃO
-- ============================================

-- Execute manualmente após a migration:
/*
-- Verificar se todas as tabelas críticas têm company_id:
SELECT
  table_name,
  column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'company_id'
ORDER BY table_name;

-- Deve retornar:
-- appointments, automations, clinic_settings, companies, company_modules,
-- holidays, laboratories, patients, payments, procedures, prosthesis, prosthesis_labels, rooms, users

-- Testar função de conflito de sala:
SELECT * FROM check_room_availability(
  p_room_id := 1,
  p_company_id := 1,
  p_start_time := '2024-11-16 14:00:00',
  p_end_time := '2024-11-16 15:00:00'
);

-- Testar função de disponibilidade profissional:
SELECT * FROM check_professional_availability(
  p_professional_id := 2,
  p_company_id := 1,
  p_start_time := '2024-11-16 14:00:00',
  p_end_time := '2024-11-16 15:00:00'
);
*/
