-- Migration 006: Criar tabela de Periodontograma
-- Data: 2025-11-15
-- Descrição: Adiciona suporte para gráficos periodontais (periodontogramas)

-- Criar tabela de periodontograma
CREATE TABLE IF NOT EXISTS periodontal_chart (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  professional_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  chart_date TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Dados dos dentes em JSON
  -- Array de objetos com dados periodontais de cada dente
  teeth_data JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Observações e diagnóstico
  general_notes TEXT,
  diagnosis TEXT,
  treatment_plan TEXT,

  -- Índices periodontais (calculados automaticamente)
  plaque_index DECIMAL(5,2), -- Percentual de dentes com placa (0-100)
  bleeding_index DECIMAL(5,2), -- Percentual de sítios com sangramento (0-100)

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_periodontal_chart_company ON periodontal_chart(company_id);
CREATE INDEX idx_periodontal_chart_patient ON periodontal_chart(patient_id);
CREATE INDEX idx_periodontal_chart_date ON periodontal_chart(chart_date DESC);
CREATE INDEX idx_periodontal_chart_professional ON periodontal_chart(professional_id);

-- Índice GIN para busca no JSONB
CREATE INDEX idx_periodontal_chart_teeth_data ON periodontal_chart USING GIN (teeth_data);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_periodontal_chart_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_periodontal_chart_updated_at
  BEFORE UPDATE ON periodontal_chart
  FOR EACH ROW
  EXECUTE FUNCTION update_periodontal_chart_updated_at();

-- Comentários para documentação
COMMENT ON TABLE periodontal_chart IS 'Periodontogramas (gráficos periodontais) dos pacientes';
COMMENT ON COLUMN periodontal_chart.teeth_data IS 'Dados periodontais de todos os dentes em formato JSON - contém profundidade de sondagem, recessão gengival, sangramento, mobilidade, etc';
COMMENT ON COLUMN periodontal_chart.plaque_index IS 'Índice de placa bacteriana - percentual de dentes com placa (0-100%)';
COMMENT ON COLUMN periodontal_chart.bleeding_index IS 'Índice de sangramento gengival - percentual de sítios com sangramento à sondagem (0-100%)';
COMMENT ON COLUMN periodontal_chart.chart_date IS 'Data da realização do periodontograma';

-- Estrutura esperada do teeth_data JSONB:
-- [
--   {
--     "toothNumber": "11",
--     "probingDepth": {
--       "mesialBuccal": 2, "buccal": 3, "distalBuccal": 2,
--       "mesialLingual": 2, "lingual": 2, "distalLingual": 3
--     },
--     "gingivalRecession": {
--       "mesialBuccal": 0, "buccal": 1, "distalBuccal": 0,
--       "mesialLingual": 0, "lingual": 0, "distalLingual": 1
--     },
--     "bleeding": {
--       "mesialBuccal": false, "buccal": true, "distalBuccal": false,
--       "mesialLingual": false, "lingual": false, "distalLingual": true
--     },
--     "suppuration": {
--       "mesialBuccal": false, "buccal": false, "distalBuccal": false,
--       "mesialLingual": false, "lingual": false, "distalLingual": false
--     },
--     "mobility": 0,
--     "furcation": 0,
--     "plaque": false,
--     "calculus": false,
--     "notes": ""
--   }
-- ]
