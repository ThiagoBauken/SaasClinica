-- ============================================================
-- Migration 028: Anamnesis versioning — full history of changes
-- ============================================================
-- Creates anamnesis_versions to store a complete snapshot of
-- every anamnesis record before each update, providing a full
-- audit trail of clinical data changes.
-- ============================================================

-- Version history table
CREATE TABLE IF NOT EXISTS anamnesis_versions (
  id                SERIAL PRIMARY KEY,
  company_id        INTEGER NOT NULL,
  anamnesis_id      INTEGER NOT NULL REFERENCES anamnesis(id) ON DELETE CASCADE,
  patient_id        INTEGER NOT NULL REFERENCES patients(id),
  version_number    INTEGER NOT NULL DEFAULT 1,
  snapshot          JSONB NOT NULL,       -- Full row snapshot before this update
  changed_fields    TEXT[],               -- Column names that differed from prev version
  change_summary    TEXT,                 -- Human-readable summary (optional)
  changed_by        INTEGER REFERENCES users(id),
  changed_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  change_reason     TEXT,                 -- Optional reason supplied by the caller
  ip_address        TEXT,
  UNIQUE (anamnesis_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_anamnesis_versions_anamnesis
  ON anamnesis_versions(anamnesis_id, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_anamnesis_versions_patient
  ON anamnesis_versions(patient_id);

CREATE INDEX IF NOT EXISTS idx_anamnesis_versions_company
  ON anamnesis_versions(company_id);

-- Add version-tracking columns to the live anamnesis table
ALTER TABLE anamnesis
  ADD COLUMN IF NOT EXISTS current_version      INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_modified_by     INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS last_modified_reason TEXT;
