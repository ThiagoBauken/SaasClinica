-- Migration: Billing & Subscriptions System (SaaS)
-- Criado em: 2025
-- Descrição: Adiciona tabelas para sistema de planos, assinaturas e billing

-- ============================================
-- 1. Tabela de Planos
-- ============================================
CREATE TABLE IF NOT EXISTS plans (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  monthly_price DECIMAL(10, 2) NOT NULL,
  yearly_price DECIMAL(10, 2),
  trial_days INTEGER NOT NULL DEFAULT 14,
  max_users INTEGER NOT NULL DEFAULT 5,
  max_patients INTEGER NOT NULL DEFAULT 100,
  max_appointments_per_month INTEGER NOT NULL DEFAULT 500,
  max_automations INTEGER NOT NULL DEFAULT 5,
  max_storage_gb INTEGER NOT NULL DEFAULT 5,
  features JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. Tabela de Features dos Planos
-- ============================================
CREATE TABLE IF NOT EXISTS plan_features (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  feature_name TEXT NOT NULL,
  feature_description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  "limit" INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plan_features_plan_id ON plan_features(plan_id);

-- ============================================
-- 3. Tabela de Assinaturas
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'trial',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  current_period_start TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  current_period_end TIMESTAMP NOT NULL,
  trial_ends_at TIMESTAMP,
  canceled_at TIMESTAMP,
  -- Stripe Integration
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  -- Mercado Pago Integration
  mercado_pago_subscription_id TEXT UNIQUE,
  mercado_pago_customer_id TEXT,
  -- Metadata
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_company_id ON subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_mp_id ON subscriptions(mercado_pago_subscription_id);

-- ============================================
-- 4. Tabela de Faturas
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_invoices (
  id SERIAL PRIMARY KEY,
  subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  due_date TIMESTAMP NOT NULL,
  paid_at TIMESTAMP,
  -- Gateway Integration
  stripe_invoice_id TEXT UNIQUE,
  mercado_pago_invoice_id TEXT UNIQUE,
  payment_method TEXT,
  invoice_url TEXT,
  -- Metadata
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id ON subscription_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON subscription_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON subscription_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON subscription_invoices(due_date);

-- ============================================
-- 5. Tabela de Métricas de Uso
-- ============================================
CREATE TABLE IF NOT EXISTS usage_metrics (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  period_end TIMESTAMP NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usage_metrics_company_id ON usage_metrics(company_id);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_type ON usage_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_period ON usage_metrics(period_start, period_end);

-- ============================================
-- 6. Tabela de Histórico de Assinaturas
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_history (
  id SERIAL PRIMARY KEY,
  subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  from_plan_id INTEGER REFERENCES plans(id),
  to_plan_id INTEGER NOT NULL REFERENCES plans(id),
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sub_history_subscription_id ON subscription_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_history_company_id ON subscription_history(company_id);

-- ============================================
-- 7. Seed de Planos Iniciais
-- ============================================

-- Plano Básico
INSERT INTO plans (name, display_name, description, monthly_price, yearly_price, trial_days, max_users, max_patients, max_appointments_per_month, max_automations, max_storage_gb, features, is_active, is_popular, sort_order)
VALUES (
  'basic',
  'Básico',
  'Ideal para clínicas pequenas que estão começando',
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

-- Plano Profissional (Popular)
INSERT INTO plans (name, display_name, description, monthly_price, yearly_price, trial_days, max_users, max_patients, max_appointments_per_month, max_automations, max_storage_gb, features, is_active, is_popular, sort_order)
VALUES (
  'professional',
  'Profissional',
  'Perfeito para clínicas em crescimento com múltiplos profissionais',
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

-- Plano Enterprise
INSERT INTO plans (name, display_name, description, monthly_price, yearly_price, trial_days, max_users, max_patients, max_appointments_per_month, max_automations, max_storage_gb, features, is_active, is_popular, sort_order)
VALUES (
  'enterprise',
  'Empresarial',
  'Solução completa para redes de clínicas e franquias',
  497.00,
  4970.00,
  30,
  999,
  999999,
  999999,
  999,
  200,
  '["agenda", "pacientes", "financeiro_completo", "relatorios_avancados", "whatsapp", "automacoes", "estoque", "proteses", "api_acesso", "multi_clinicas", "suporte_prioritario", "onboarding_personalizado", "integracao_customizada"]'::jsonb,
  true,
  false,
  3
) ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 8. Inserir Features Detalhadas dos Planos
-- ============================================

-- Features do Plano Básico
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, is_enabled, "limit")
SELECT id, 'agenda', 'Agenda Online', 'Sistema de agendamentos com calendário', true, NULL FROM plans WHERE name = 'basic'
ON CONFLICT DO NOTHING;

INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, is_enabled, "limit")
SELECT id, 'pacientes', 'Gestão de Pacientes', 'Cadastro completo de pacientes', true, 100 FROM plans WHERE name = 'basic'
ON CONFLICT DO NOTHING;

-- Features do Plano Profissional
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, is_enabled, "limit")
SELECT id, 'whatsapp', 'WhatsApp Business', 'Envio automatizado de lembretes', true, 1000 FROM plans WHERE name = 'professional'
ON CONFLICT DO NOTHING;

INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, is_enabled, "limit")
SELECT id, 'automacoes', 'Automações', 'Workflows personalizados', true, 10 FROM plans WHERE name = 'professional'
ON CONFLICT DO NOTHING;

-- Features do Plano Enterprise
INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, is_enabled, "limit")
SELECT id, 'multi_clinicas', 'Multi-Clínicas', 'Gestão de múltiplas unidades', true, NULL FROM plans WHERE name = 'enterprise'
ON CONFLICT DO NOTHING;

INSERT INTO plan_features (plan_id, feature_key, feature_name, feature_description, is_enabled, "limit")
SELECT id, 'suporte_prioritario', 'Suporte Prioritário', 'Atendimento com SLA de 2h', true, NULL FROM plans WHERE name = 'enterprise'
ON CONFLICT DO NOTHING;

-- ============================================
-- 9. Triggers para updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger em todas as tabelas com updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_plans_updated_at') THEN
    CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_subscriptions_updated_at') THEN
    CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_invoices_updated_at') THEN
    CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON subscription_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_usage_metrics_updated_at') THEN
    CREATE TRIGGER update_usage_metrics_updated_at BEFORE UPDATE ON usage_metrics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;

-- ============================================
-- FIM DA MIGRATION
-- ============================================
