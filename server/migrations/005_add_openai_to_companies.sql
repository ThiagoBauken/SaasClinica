-- Migration: Add OpenAI API Key and N8N Webhook URL to Companies
-- Criado em: 2025-11-15
-- Descrição: Adiciona campos para configuração de automações com OpenAI e N8N por empresa

-- Adicionar campo openai_api_key
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS openai_api_key TEXT;

-- Adicionar campo n8n_webhook_url
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS n8n_webhook_url TEXT;

-- Adicionar comentários
COMMENT ON COLUMN companies.openai_api_key IS 'Chave da API OpenAI para automações N8N da empresa';
COMMENT ON COLUMN companies.n8n_webhook_url IS 'URL do webhook N8N configurado para a empresa (opcional)';
