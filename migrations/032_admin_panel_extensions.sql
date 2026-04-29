-- ============================================================
-- Migration 032: Admin panel extensions
-- ============================================================
-- Adds login tracking + session indexing + admin notes to
-- support the new admin panel (force-logout, audit, lockout).
--
-- Idempotent.
-- ============================================================

-- 1) Garantir que user_sessions exista (connect-pg-simple cria em runtime,
--    mas a migration precisa rodar mesmo antes do primeiro boot).
CREATE TABLE IF NOT EXISTS user_sessions (
  sid     varchar NOT NULL COLLATE "default",
  sess    json    NOT NULL,
  expire  timestamp(6) NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_sessions_pkey'
  ) THEN
    ALTER TABLE user_sessions ADD CONSTRAINT user_sessions_pkey
      PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire"
  ON user_sessions (expire);

-- 2) Coluna user_id em user_sessions (enumerar sessões por usuário)
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS user_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
  ON user_sessions(user_id) WHERE user_id IS NOT NULL;

-- 3) Trigger que sincroniza user_sessions.user_id a partir do JSON da sessão.
-- Fallback caso o hook em código não rode.
CREATE OR REPLACE FUNCTION sync_user_session_user_id() RETURNS trigger AS $$
BEGIN
  IF NEW.sess IS NOT NULL THEN
    BEGIN
      NEW.user_id := (NEW.sess::jsonb -> 'passport' ->> 'user')::INTEGER;
    EXCEPTION WHEN OTHERS THEN
      NEW.user_id := NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_sessions_sync_user_id ON user_sessions;
CREATE TRIGGER user_sessions_sync_user_id
  BEFORE INSERT OR UPDATE ON user_sessions
  FOR EACH ROW EXECUTE FUNCTION sync_user_session_user_id();

-- Backfill linhas existentes
UPDATE user_sessions
   SET user_id = (sess::jsonb -> 'passport' ->> 'user')::INTEGER
 WHERE user_id IS NULL
   AND sess::jsonb -> 'passport' ->> 'user' IS NOT NULL;

-- 4) Tracking de login + lockout em users
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;

-- 5) Notas administrativas livres (visíveis só ao admin)
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- 6) Índice para listagem ordenada por último login (painel admin)
CREATE INDEX IF NOT EXISTS idx_users_last_login_at
  ON users (last_login_at DESC NULLS LAST);
