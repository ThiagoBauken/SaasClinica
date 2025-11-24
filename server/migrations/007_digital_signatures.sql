-- Migration 007: Sistema de Assinatura Digital CFO
-- Data: 2025-11-15
-- Descrição: Adiciona suporte para assinatura digital de prescrições, atestados e receitas conforme CFO

-- Criar tabela de assinaturas digitais
CREATE TABLE IF NOT EXISTS digital_signatures (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  professional_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Tipo de documento assinado
  document_type TEXT NOT NULL, -- 'prescription', 'certificate', 'attestation', 'exam_request'
  document_id INTEGER NOT NULL, -- ID do documento (prescrição, atestado, etc)

  -- Dados do certificado digital
  certificate_serial_number TEXT,
  certificate_name TEXT,
  certificate_issuer TEXT,
  certificate_valid_from TIMESTAMP,
  certificate_valid_until TIMESTAMP,

  -- Dados do CFO
  cfo_registration_number TEXT NOT NULL, -- Número do CRO (ex: "12345")
  cfo_state TEXT NOT NULL, -- Estado do CRO (ex: "SP", "RJ")

  -- Assinatura e validação
  signed_pdf_url TEXT NOT NULL, -- URL do PDF assinado no storage
  signature_hash TEXT, -- Hash SHA-256 da assinatura
  qr_code_data TEXT, -- Dados do QR Code para validação
  cfo_validation_url TEXT, -- URL de validação no portal CFO

  -- Timestamps
  signed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP, -- Para documentos com validade temporal

  -- Status da assinatura
  status TEXT NOT NULL DEFAULT 'valid', -- 'valid', 'revoked', 'expired'
  revoked_at TIMESTAMP,
  revoked_reason TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb, -- Informações adicionais em JSON
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_digital_signatures_company ON digital_signatures(company_id);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_professional ON digital_signatures(professional_id);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_document ON digital_signatures(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_status ON digital_signatures(status);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_signed_at ON digital_signatures(signed_at DESC);

-- Índice único para evitar duplicação de assinatura
CREATE UNIQUE INDEX IF NOT EXISTS idx_digital_signatures_unique_document
  ON digital_signatures(document_type, document_id, company_id)
  WHERE status = 'valid';

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_digital_signatures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_digital_signatures_updated_at
  BEFORE UPDATE ON digital_signatures
  FOR EACH ROW
  EXECUTE FUNCTION update_digital_signatures_updated_at();

-- Adicionar campos de assinatura digital à tabela prescriptions (se não existirem)
DO $$
BEGIN
  -- Verifica se a coluna já existe antes de adicionar
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prescriptions' AND column_name = 'signature_id'
  ) THEN
    ALTER TABLE prescriptions
      ADD COLUMN signature_id INTEGER REFERENCES digital_signatures(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prescriptions' AND column_name = 'digitally_signed'
  ) THEN
    ALTER TABLE prescriptions
      ADD COLUMN digitally_signed BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prescriptions' AND column_name = 'signed_pdf_url'
  ) THEN
    ALTER TABLE prescriptions
      ADD COLUMN signed_pdf_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prescriptions' AND column_name = 'validated_by_cfo'
  ) THEN
    ALTER TABLE prescriptions
      ADD COLUMN validated_by_cfo BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prescriptions' AND column_name = 'cfo_validation_url'
  ) THEN
    ALTER TABLE prescriptions
      ADD COLUMN cfo_validation_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prescriptions' AND column_name = 'qr_code_data'
  ) THEN
    ALTER TABLE prescriptions
      ADD COLUMN qr_code_data TEXT;
  END IF;
END $$;

-- Adicionar índices nas colunas de prescrições
CREATE INDEX IF NOT EXISTS idx_prescriptions_signature ON prescriptions(signature_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_digitally_signed ON prescriptions(digitally_signed);

-- Adicionar campos CFO aos usuários (profissionais) se não existirem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'cfo_registration_number'
  ) THEN
    ALTER TABLE users
      ADD COLUMN cfo_registration_number TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'cfo_state'
  ) THEN
    ALTER TABLE users
      ADD COLUMN cfo_state TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'digital_certificate_path'
  ) THEN
    ALTER TABLE users
      ADD COLUMN digital_certificate_path TEXT; -- Caminho do certificado digital (opcional)
  END IF;
END $$;

-- Comentários para documentação
COMMENT ON TABLE digital_signatures IS 'Assinaturas digitais de documentos (prescrições, atestados, receitas) conforme CFO';
COMMENT ON COLUMN digital_signatures.document_type IS 'Tipo de documento: prescription, certificate, attestation, exam_request';
COMMENT ON COLUMN digital_signatures.cfo_registration_number IS 'Número de registro no CRO (ex: 12345)';
COMMENT ON COLUMN digital_signatures.cfo_state IS 'Estado do CRO (ex: SP, RJ, MG)';
COMMENT ON COLUMN digital_signatures.signed_pdf_url IS 'URL do PDF assinado digitalmente';
COMMENT ON COLUMN digital_signatures.signature_hash IS 'Hash SHA-256 da assinatura digital';
COMMENT ON COLUMN digital_signatures.qr_code_data IS 'Dados do QR Code para validação no portal CFO';
COMMENT ON COLUMN digital_signatures.status IS 'Status: valid (válida), revoked (revogada), expired (expirada)';

COMMENT ON COLUMN prescriptions.signature_id IS 'ID da assinatura digital associada';
COMMENT ON COLUMN prescriptions.digitally_signed IS 'Indica se a prescrição foi assinada digitalmente';
COMMENT ON COLUMN prescriptions.validated_by_cfo IS 'Indica se a assinatura foi validada pelo CFO';

COMMENT ON COLUMN users.cfo_registration_number IS 'Número de registro no Conselho Regional de Odontologia';
COMMENT ON COLUMN users.cfo_state IS 'Estado do CRO (ex: SP para CRO-SP)';
COMMENT ON COLUMN users.digital_certificate_path IS 'Caminho do certificado digital ICP-Brasil (se armazenado localmente)';
