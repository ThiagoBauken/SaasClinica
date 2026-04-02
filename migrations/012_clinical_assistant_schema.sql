-- Migration 012: Clinical Assistant - New patient/anamnesis fields
-- Adds critical medical fields for AI clinical assistant integration

BEGIN;

-- ============================================================
-- PATIENTS TABLE - New fields
-- ============================================================

-- Nome social (obrigatorio por lei brasileira para pacientes trans)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS social_name TEXT;

-- Responsavel legal (para pacientes menores de idade)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS responsible_name TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS responsible_cpf TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS responsible_relationship TEXT;

-- Fonte de indicacao (marketing analytics)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS referral_source TEXT;

-- Dentista preferido
ALTER TABLE patients ADD COLUMN IF NOT EXISTS preferred_dentist_id INTEGER REFERENCES users(id);

-- ============================================================
-- ANAMNESIS TABLE - Critical medical flags
-- ============================================================

-- Anticoagulantes (critico para procedimentos cirurgicos)
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS anticoagulant_use BOOLEAN DEFAULT FALSE;
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS anticoagulant_name TEXT;

-- Bifosfonatos (risco de osteonecrose em extracoes)
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS bisphosphonate_use BOOLEAN DEFAULT FALSE;

-- Profilaxia antibiotica obrigatoria
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS prosthetic_heart_valve BOOLEAN DEFAULT FALSE;
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS rheumatic_fever BOOLEAN DEFAULT FALSE;

-- Disturbios de coagulacao
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS bleeding_disorder BOOLEAN DEFAULT FALSE;

-- Condicoes medicas adicionais
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS hiv_aids BOOLEAN DEFAULT FALSE;
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS anemia BOOLEAN DEFAULT FALSE;
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS asthma BOOLEAN DEFAULT FALSE;
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS epilepsy BOOLEAN DEFAULT FALSE;
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS thyroid_disorder BOOLEAN DEFAULT FALSE;

-- Historico de cancer
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS cancer_history BOOLEAN DEFAULT FALSE;
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS cancer_type TEXT;
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS radiation_therapy BOOLEAN DEFAULT FALSE;

-- Uso de drogas recreativas (afeta anestesia)
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS drug_use BOOLEAN DEFAULT FALSE;

-- Nivel de ansiedade dental (0-10, afeta decisao de sedacao)
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS dental_anxiety_level INTEGER;

-- Sinais vitais (para calculo de dosagem)
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS blood_pressure_systolic INTEGER;
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS blood_pressure_diastolic INTEGER;
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS weight DECIMAL(5,2);
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS height DECIMAL(5,2);

-- Ultima visita ao dentista
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS last_dental_visit DATE;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_patients_preferred_dentist ON patients(preferred_dentist_id);
CREATE INDEX IF NOT EXISTS idx_patients_referral_source ON patients(referral_source);

COMMIT;
