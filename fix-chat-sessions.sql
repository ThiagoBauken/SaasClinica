-- Adicionar colunas faltantes na tabela chat_sessions
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS current_state VARCHAR(50);
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS state_data JSONB;
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS context JSONB;
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
