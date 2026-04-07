-- Migration: Aesthetic Features (Before/After Photos + Aesthetic Packages)

-- Before/After Photos for aesthetic procedures
CREATE TABLE IF NOT EXISTS before_after_photos (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  treatment_plan_id INTEGER,
  procedure_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  before_photo_url TEXT NOT NULL,
  after_photo_url TEXT,
  before_date TIMESTAMPTZ NOT NULL,
  after_date TIMESTAMPTZ,
  tooth_numbers TEXT,
  notes TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  patient_consent BOOLEAN DEFAULT FALSE,
  created_by INTEGER NOT NULL REFERENCES users(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_before_after_photos_company ON before_after_photos(company_id);
CREATE INDEX IF NOT EXISTS idx_before_after_photos_patient ON before_after_photos(patient_id);
CREATE INDEX IF NOT EXISTS idx_before_after_photos_procedure ON before_after_photos(procedure_type);
CREATE INDEX IF NOT EXISTS idx_before_after_photos_public ON before_after_photos(is_public) WHERE is_public = TRUE AND deleted_at IS NULL;

-- Aesthetic Packages (Templates)
CREATE TABLE IF NOT EXISTS aesthetic_packages (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  procedures JSONB NOT NULL DEFAULT '[]',
  total_price NUMERIC(10,2) NOT NULL,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  estimated_sessions INTEGER,
  estimated_duration_days INTEGER,
  included_items TEXT,
  active BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aesthetic_packages_company ON aesthetic_packages(company_id);
CREATE INDEX IF NOT EXISTS idx_aesthetic_packages_category ON aesthetic_packages(category);

-- Add 'photos' to storage folders
-- (No schema change needed, just note that 'photos' folder is now valid)
