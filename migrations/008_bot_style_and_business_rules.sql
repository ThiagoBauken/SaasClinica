-- Migration: 008_bot_style_and_business_rules
-- Description: Adiciona campos de estilo do bot e regras de negócio
-- Date: 2024-12-04

-- ===========================================
-- CAMPOS DE ESTILO DO BOT
-- ===========================================

-- Estilo de conversa
ALTER TABLE clinic_settings
ADD COLUMN IF NOT EXISTS conversation_style TEXT DEFAULT 'menu';
-- Valores: 'menu' = opções numeradas, 'humanized' = conversa natural

ALTER TABLE clinic_settings
ADD COLUMN IF NOT EXISTS bot_personality TEXT DEFAULT 'professional';
-- Valores: 'professional' | 'friendly' | 'casual'

ALTER TABLE clinic_settings
ADD COLUMN IF NOT EXISTS bot_name TEXT DEFAULT 'Assistente';
-- Nome do bot (ex: Carol, Atendente Virtual)

ALTER TABLE clinic_settings
ADD COLUMN IF NOT EXISTS use_emojis BOOLEAN DEFAULT true;
-- Usar emojis nas respostas?

ALTER TABLE clinic_settings
ADD COLUMN IF NOT EXISTS greeting_style TEXT DEFAULT 'time_based';
-- Valores: 'time_based' = bom dia/tarde/noite, 'simple' = olá

-- Saudações personalizadas
ALTER TABLE clinic_settings
ADD COLUMN IF NOT EXISTS custom_greeting_morning TEXT;
-- Saudação personalizada manhã

ALTER TABLE clinic_settings
ADD COLUMN IF NOT EXISTS custom_greeting_afternoon TEXT;
-- Saudação personalizada tarde

ALTER TABLE clinic_settings
ADD COLUMN IF NOT EXISTS custom_greeting_evening TEXT;
-- Saudação personalizada noite

-- Contexto para IA
ALTER TABLE clinic_settings
ADD COLUMN IF NOT EXISTS humanized_prompt_context TEXT;
-- Contexto extra para IA no modo humanizado

-- ===========================================
-- REGRAS DE NEGÓCIO DO BOT
-- ===========================================

ALTER TABLE clinic_settings
ADD COLUMN IF NOT EXISTS price_disclosure_policy TEXT DEFAULT 'always';
-- Valores: 'always' | 'never_chat' | 'only_general'

ALTER TABLE clinic_settings
ADD COLUMN IF NOT EXISTS scheduling_policy TEXT DEFAULT 'immediate';
-- Valores: 'immediate' | 'appointment_required' | 'callback'

ALTER TABLE clinic_settings
ADD COLUMN IF NOT EXISTS payment_methods JSONB DEFAULT '["pix", "credit_card", "debit_card", "cash"]'::jsonb;
-- Array de métodos de pagamento aceitos

-- ===========================================
-- ESPECIALIDADES E SERVIÇOS
-- ===========================================

ALTER TABLE clinic_settings
ADD COLUMN IF NOT EXISTS clinic_type TEXT DEFAULT 'consultorio_individual';
-- Valores: 'consultorio_individual' | 'clinica_pequena' | 'clinica_media' | 'clinica_grande' | 'franquia'

ALTER TABLE clinic_settings
ADD COLUMN IF NOT EXISTS services_offered JSONB DEFAULT '[]'::jsonb;
-- Array de códigos de especialidades CFO oferecidas

ALTER TABLE clinic_settings
ADD COLUMN IF NOT EXISTS clinic_context_for_bot TEXT;
-- Contexto geral da clínica para uso no prompt do bot

-- ===========================================
-- CAMPOS DE MENSAGENS (se não existirem)
-- ===========================================

ALTER TABLE clinic_settings
ADD COLUMN IF NOT EXISTS chat_welcome_message TEXT;
-- Mensagem de boas-vindas personalizada

ALTER TABLE clinic_settings
ADD COLUMN IF NOT EXISTS chat_fallback_message TEXT;
-- Mensagem quando não entende

ALTER TABLE clinic_settings
ADD COLUMN IF NOT EXISTS emergency_phone TEXT;
-- Telefone de emergência

-- ===========================================
-- ÍNDICES PARA PERFORMANCE
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_clinic_settings_clinic_type
ON clinic_settings(clinic_type)
WHERE clinic_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clinic_settings_price_policy
ON clinic_settings(price_disclosure_policy)
WHERE price_disclosure_policy IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clinic_settings_conversation_style
ON clinic_settings(conversation_style)
WHERE conversation_style IS NOT NULL;

-- ===========================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ===========================================

COMMENT ON COLUMN clinic_settings.conversation_style IS
'Estilo de conversa: menu=opções numeradas, humanized=conversa natural';

COMMENT ON COLUMN clinic_settings.bot_personality IS
'Personalidade do bot: professional, friendly, casual';

COMMENT ON COLUMN clinic_settings.bot_name IS
'Nome do bot usado nas saudações';

COMMENT ON COLUMN clinic_settings.use_emojis IS
'Se deve usar emojis nas respostas do bot';

COMMENT ON COLUMN clinic_settings.greeting_style IS
'Estilo de saudação: time_based=bom dia/tarde/noite, simple=olá';

COMMENT ON COLUMN clinic_settings.price_disclosure_policy IS
'Política de divulgação de preços: always=sempre, never_chat=só presencial, only_general=faixas de valores';

COMMENT ON COLUMN clinic_settings.scheduling_policy IS
'Política de agendamento: immediate=agenda direto, appointment_required=avaliação primeiro, callback=retorno de ligação';

COMMENT ON COLUMN clinic_settings.payment_methods IS
'Array JSON com métodos de pagamento aceitos: pix, credit_card, debit_card, cash, etc';

COMMENT ON COLUMN clinic_settings.clinic_type IS
'Tipo de clínica: consultorio_individual, clinica_pequena, clinica_media, clinica_grande, franquia';

COMMENT ON COLUMN clinic_settings.services_offered IS
'Array JSON com códigos de especialidades CFO oferecidas pela clínica';

COMMENT ON COLUMN clinic_settings.clinic_context_for_bot IS
'Contexto personalizado da clínica para uso nos prompts do bot de IA';

COMMENT ON COLUMN clinic_settings.humanized_prompt_context IS
'Contexto adicional para respostas humanizadas da IA';

-- ===========================================
-- VALORES DEFAULT PARA REGISTROS EXISTENTES
-- ===========================================

UPDATE clinic_settings
SET conversation_style = 'menu'
WHERE conversation_style IS NULL;

UPDATE clinic_settings
SET bot_personality = 'professional'
WHERE bot_personality IS NULL;

UPDATE clinic_settings
SET bot_name = 'Assistente'
WHERE bot_name IS NULL;

UPDATE clinic_settings
SET use_emojis = true
WHERE use_emojis IS NULL;

UPDATE clinic_settings
SET greeting_style = 'time_based'
WHERE greeting_style IS NULL;

UPDATE clinic_settings
SET price_disclosure_policy = 'always'
WHERE price_disclosure_policy IS NULL;

UPDATE clinic_settings
SET scheduling_policy = 'immediate'
WHERE scheduling_policy IS NULL;

UPDATE clinic_settings
SET payment_methods = '["pix", "credit_card", "debit_card", "cash"]'::jsonb
WHERE payment_methods IS NULL;

UPDATE clinic_settings
SET clinic_type = 'consultorio_individual'
WHERE clinic_type IS NULL;

UPDATE clinic_settings
SET services_offered = '[]'::jsonb
WHERE services_offered IS NULL;
