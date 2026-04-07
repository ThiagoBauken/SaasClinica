-- Migration: Add Google Calendar token storage fields to users table
-- Created: 2025-11-16
-- Description: Adds fields to securely store Google Calendar OAuth tokens

-- Add Google Calendar token fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS google_access_token TEXT,
ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_token_expiry TIMESTAMP;

-- Add index for faster lookups of users with Google Calendar connected
CREATE INDEX IF NOT EXISTS idx_users_google_calendar
ON users(google_calendar_id)
WHERE google_calendar_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.google_access_token IS 'OAuth 2.0 access token for Google Calendar API';
COMMENT ON COLUMN users.google_refresh_token IS 'OAuth 2.0 refresh token for Google Calendar API';
COMMENT ON COLUMN users.google_token_expiry IS 'Expiration timestamp for the access token';
