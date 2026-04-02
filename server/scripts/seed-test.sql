-- =============================================================
-- SEED DE TESTE: 1 empresa, 1 usuário admin, 1 paciente
-- Executar: psql $DATABASE_URL -f server/scripts/seed-test.sql
-- =============================================================

BEGIN;

-- 1. Garantir que o plano básico existe
INSERT INTO plans (name, display_name, description, monthly_price, yearly_price, trial_days, max_users, max_patients, max_appointments_per_month, max_automations, max_storage_gb, features, is_active, is_popular, sort_order)
VALUES (
  'basic',
  'Básico',
  'Ideal para clínicas pequenas',
  97.00,
  970.00,
  14,
  3,
  100,
  300,
  3,
  5,
  '["agenda", "pacientes", "financeiro_basico", "relatorios_basicos"]'::jsonb,
  true,
  false,
  1
) ON CONFLICT (name) DO NOTHING;

INSERT INTO plans (name, display_name, description, monthly_price, yearly_price, trial_days, max_users, max_patients, max_appointments_per_month, max_automations, max_storage_gb, features, is_active, is_popular, sort_order)
VALUES (
  'professional',
  'Profissional',
  'Para clínicas em crescimento',
  197.00,
  1970.00,
  14,
  10,
  500,
  1000,
  10,
  20,
  '["agenda", "pacientes", "financeiro_completo", "relatorios_avancados", "whatsapp", "automacoes", "estoque", "proteses", "api_acesso"]'::jsonb,
  true,
  true,
  2
) ON CONFLICT (name) DO NOTHING;

INSERT INTO plans (name, display_name, description, monthly_price, yearly_price, trial_days, max_users, max_patients, max_appointments_per_month, max_automations, max_storage_gb, features, is_active, is_popular, sort_order)
VALUES (
  'enterprise',
  'Empresarial',
  'Solução completa para redes',
  497.00,
  4970.00,
  30,
  999,
  999999,
  999999,
  999,
  200,
  '["agenda", "pacientes", "financeiro_completo", "relatorios_avancados", "whatsapp", "automacoes", "estoque", "proteses", "api_acesso", "multi_clinicas", "suporte_prioritario"]'::jsonb,
  true,
  false,
  3
) ON CONFLICT (name) DO NOTHING;

-- 2. Criar empresa teste
INSERT INTO companies (name, email, phone, address, cnpj, active, trial_ends_at)
VALUES (
  'Clínica Teste',
  'contato@clinicateste.com',
  '(11) 99999-0000',
  'Rua Teste, 123 - Centro, São Paulo - SP',
  '12.345.678/0001-99',
  true,
  NOW() + INTERVAL '30 days'
) ON CONFLICT DO NOTHING;

-- Pegar o ID da empresa recém-criada (ou existente)
-- Usamos uma variável via CTE
DO $$
DECLARE
  v_company_id INT;
  v_plan_id INT;
  v_user_id INT;
BEGIN
  -- Buscar empresa
  SELECT id INTO v_company_id FROM companies WHERE email = 'contato@clinicateste.com' LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE NOTICE 'Empresa já existia ou não foi criada, buscando primeira empresa...';
    SELECT id INTO v_company_id FROM companies LIMIT 1;
  END IF;

  RAISE NOTICE 'Company ID: %', v_company_id;

  -- 3. Criar módulos básicos (se não existirem)
  INSERT INTO modules (name, display_name, description, version, is_active)
  VALUES
    ('clinic', 'Gestão Clínica', 'Agendamentos e pacientes', '1.0.0', true),
    ('financial', 'Financeiro', 'Controle financeiro', '1.0.0', true),
    ('inventory', 'Estoque', 'Controle de estoque', '1.0.0', true),
    ('automation', 'Automações', 'N8N e WhatsApp', '1.0.0', true),
    ('crm', 'CRM', 'Funil de vendas', '1.0.0', true)
  ON CONFLICT (name) DO NOTHING;

  -- 4. Ativar módulos para a empresa
  INSERT INTO company_modules (company_id, module_id, is_enabled)
  SELECT v_company_id, m.id, true
  FROM modules m
  WHERE m.name IN ('clinic', 'financial', 'inventory', 'automation', 'crm')
  ON CONFLICT DO NOTHING;

  -- 5. Criar subscription (plano profissional para ter tudo liberado)
  SELECT id INTO v_plan_id FROM plans WHERE name = 'professional' LIMIT 1;

  IF v_plan_id IS NOT NULL THEN
    INSERT INTO subscriptions (company_id, plan_id, status, billing_cycle, current_period_start, current_period_end, trial_ends_at)
    SELECT v_company_id, v_plan_id, 'trial', 'monthly', NOW(), NOW() + INTERVAL '44 days', NOW() + INTERVAL '14 days'
    WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE company_id = v_company_id);

    RAISE NOTICE 'Subscription criada com plano profissional (plan_id: %)', v_plan_id;
  END IF;

  -- 6. Criar usuário admin
  -- Senha: admin123 (hash scrypt do Node.js: salt = hex de 16 bytes random)
  -- Vamos usar um hash pré-computado
  -- NOTA: Este hash foi gerado com scrypt do Node.js, formato: hash_hex.salt_hex
  INSERT INTO users (company_id, username, password, full_name, role, email, phone, speciality, active, trial_ends_at)
  VALUES (
    v_company_id,
    'admin',
    -- Hash de "admin123" gerado com scrypt (formato: hash.salt)
    'placeholder_will_be_updated',
    'Dr. Admin Teste',
    'admin',
    'admin@clinicateste.com',
    '(11) 98765-4321',
    'Administração',
    true,
    NOW() + INTERVAL '30 days'
  )
  ON CONFLICT (username) DO NOTHING;

  SELECT id INTO v_user_id FROM users WHERE username = 'admin' LIMIT 1;
  RAISE NOTICE 'User ID: %', v_user_id;

  -- 7. Criar paciente teste
  INSERT INTO patients (
    company_id, full_name, birth_date, cpf, gender,
    email, phone, cellphone, whatsapp_phone,
    address, neighborhood, city, state, cep,
    health_insurance, blood_type, allergies,
    status, active, data_processing_consent,
    tags, referral_source
  ) VALUES (
    v_company_id,
    'Maria da Silva Santos',
    '1985-06-15',
    '123.456.789-00',
    'feminino',
    'maria.santos@email.com',
    '(11) 3456-7890',
    '(11) 99876-5432',
    '5511998765432',
    'Rua das Flores, 456',
    'Jardim Primavera',
    'São Paulo',
    'SP',
    '01234-567',
    'Unimed',
    'O+',
    'Penicilina',
    'active',
    true,
    true,
    '["geral"]'::jsonb,
    'indicacao'
  )
  ON CONFLICT DO NOTHING;

  -- 8. Criar sala
  INSERT INTO rooms (company_id, name, description, active)
  VALUES (v_company_id, 'Sala 01', 'Consultório principal', true)
  ON CONFLICT DO NOTHING;

  -- 9. Criar alguns procedimentos básicos
  INSERT INTO procedures (company_id, name, duration, price, description, color, active, category)
  VALUES
    (v_company_id, 'Consulta Avaliação', 30, 10000, 'Primeira consulta e avaliação', '#3B82F6', true, 'geral'),
    (v_company_id, 'Limpeza e Profilaxia', 30, 15000, 'Limpeza profissional', '#10B981', true, 'prevencao'),
    (v_company_id, 'Restauração Resina', 45, 25000, 'Restauração com resina composta', '#8B5CF6', true, 'geral'),
    (v_company_id, 'Extração Simples', 30, 20000, 'Extração dentária simples', '#EF4444', true, 'cirurgia'),
    (v_company_id, 'Clareamento Dental', 60, 80000, 'Clareamento a laser', '#F59E0B', true, 'estetica')
  ON CONFLICT DO NOTHING;

  -- 10. Criar etapas do funil de vendas
  INSERT INTO sales_funnel_stages (company_id, name, code, color, "order", is_default)
  VALUES
    (v_company_id, 'Lead Novo', 'new_lead', '#6B7280', 1, true),
    (v_company_id, 'Contato Realizado', 'contacted', '#3B82F6', 2, false),
    (v_company_id, 'Avaliação Agendada', 'evaluation_scheduled', '#8B5CF6', 3, false),
    (v_company_id, 'Orçamento Enviado', 'quote_sent', '#F59E0B', 4, false),
    (v_company_id, 'Fechado - Ganho', 'won', '#10B981', 6, false),
    (v_company_id, 'Fechado - Perdido', 'lost', '#EF4444', 7, false)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '✅ Seed completo!';
  RAISE NOTICE 'Empresa: Clínica Teste (ID: %)', v_company_id;
  RAISE NOTICE 'Paciente: Maria da Silva Santos';
  RAISE NOTICE '⚠️  IMPORTANTE: A senha do user "admin" precisa ser gerada via Node.js';
END $$;

COMMIT;
