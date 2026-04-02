-- Migration 014: AI Agent Integration (Claude Direct)
-- Adds support for direct Claude AI integration replacing N8N

-- Add Anthropic API key to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT;

-- Add AI Agent settings to clinic_settings
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS ai_agent_enabled BOOLEAN DEFAULT false;
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS ai_agent_model TEXT DEFAULT 'claude-haiku-4-5-20251001';
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS ai_agent_max_tokens INTEGER DEFAULT 1024;

-- AI Tool Calls log table
CREATE TABLE IF NOT EXISTS ai_tool_calls (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  company_id INTEGER REFERENCES companies(id),
  tool_name VARCHAR(50) NOT NULL,
  tool_input JSONB,
  tool_result JSONB,
  is_error BOOLEAN DEFAULT false,
  execution_time_ms INTEGER,
  model VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for querying tool calls by session
CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_session ON ai_tool_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_company ON ai_tool_calls(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_tool_name ON ai_tool_calls(tool_name);

-- Add processedBy 'ai' value support to chat_messages (already varchar, just documenting)
-- processedBy can now be: 'code', 'state_machine', 'ai', 'ai_agent'

-- Index for conversation memory lookups
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON chat_messages(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_company_phone_status ON chat_sessions(company_id, phone, status);
