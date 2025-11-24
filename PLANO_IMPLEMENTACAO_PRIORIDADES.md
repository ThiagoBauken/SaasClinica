# 🎯 Plano de Implementação - Funcionalidades Críticas

**Data:** 15/11/2025

---

## 📋 PRIORIDADES ABSOLUTAS

Com base na análise e feedback:

### ✅ Já Resolvido:
- **Laboratório Protético** → Gerenciado via Kanban (solução existente)

### 🔴 Gaps Críticos para Implementar:

1. **Gráfico Periodontal (Periodontograma)**
   - Funcionalidade essencial para periodontistas
   - Sem isso, o sistema não serve para especialidades periodontais
   - Estimativa: 4-6 semanas

2. **Assinatura Digital CFO**
   - Compliance legal obrigatório no Brasil
   - Sem isso, prescrições digitais não têm validade legal
   - Estimativa: 6-8 semanas

---

## 📊 FUNCIONALIDADE 1: GRÁFICO PERIODONTAL

### Visão Geral

O periodontograma é uma ferramenta essencial para registrar e acompanhar a saúde periodontal dos pacientes, medindo profundidade de sondagem, recessão gengival, mobilidade dentária e outros indicadores.

### Especificação Técnica

#### Schema do Banco de Dados

```typescript
// shared/schema.ts

export const periodontalChart = pgTable('periodontal_chart', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => companies.id),
  patientId: integer('patient_id').notNull().references(() => patients.id),
  professionalId: integer('professional_id').references(() => users.id),
  chartDate: timestamp('chart_date').notNull().defaultNow(),

  // Dados dos dentes em formato JSON
  teethData: json('teeth_data').$type<PeriodontalToothData[]>(),

  // Observações gerais
  generalNotes: text('general_notes'),
  diagnosis: text('diagnosis'),
  treatmentPlan: text('treatment_plan'),

  // Índices periodontais
  plaque_index: decimal('plaque_index', { precision: 5, scale: 2 }), // 0-100%
  bleeding_index: decimal('bleeding_index', { precision: 5, scale: 2 }), // 0-100%

  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Tipo TypeScript para dados de cada dente
export interface PeriodontalToothData {
  toothNumber: string; // "11", "12", ... "48" (notação FDI)

  // Profundidade de sondagem (6 pontos por dente) - em mm
  probingDepth: {
    mesialBuccal: number;    // Vestibular mesial
    buccal: number;          // Vestibular
    distalBuccal: number;    // Vestibular distal
    mesialLingual: number;   // Lingual/Palatina mesial
    lingual: number;         // Lingual/Palatina
    distalLingual: number;   // Lingual/Palatina distal
  };

  // Recessão gengival (6 pontos) - em mm
  gingivalRecession: {
    mesialBuccal: number;
    buccal: number;
    distalBuccal: number;
    mesialLingual: number;
    lingual: number;
    distalLingual: number;
  };

  // Nível de inserção clínica (calculado automaticamente)
  // NIC = Profundidade de Sondagem + Recessão

  // Sangramento à sondagem (6 pontos) - boolean
  bleeding: {
    mesialBuccal: boolean;
    buccal: boolean;
    distalBuccal: boolean;
    mesialLingual: boolean;
    lingual: boolean;
    distalLingual: boolean;
  };

  // Supuração (6 pontos) - boolean
  suppuration: {
    mesialBuccal: boolean;
    buccal: boolean;
    distalBuccal: boolean;
    mesialLingual: boolean;
    lingual: boolean;
    distalLingual: boolean;
  };

  // Mobilidade dentária (escala 0-3)
  // 0 = normal, 1 = leve, 2 = moderada, 3 = severa
  mobility: 0 | 1 | 2 | 3;

  // Lesão de furca (escala 0-3)
  // 0 = sem lesão, 1 = incipiente, 2 = moderada, 3 = severa
  furcation: 0 | 1 | 2 | 3;

  // Placa visível
  plaque: boolean;

  // Cálculo dental
  calculus: boolean;

  // Notas específicas do dente
  notes?: string;
}
```

#### Migration SQL

```sql
-- server/migrations/006_periodontal_chart.sql

-- Criar tabela de periodontograma
CREATE TABLE IF NOT EXISTS periodontal_chart (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  professional_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  chart_date TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Dados dos dentes em JSON
  teeth_data JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Observações e diagnóstico
  general_notes TEXT,
  diagnosis TEXT,
  treatment_plan TEXT,

  -- Índices periodontais
  plaque_index DECIMAL(5,2),
  bleeding_index DECIMAL(5,2),

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_periodontal_chart_company ON periodontal_chart(company_id);
CREATE INDEX idx_periodontal_chart_patient ON periodontal_chart(patient_id);
CREATE INDEX idx_periodontal_chart_date ON periodontal_chart(chart_date);

-- Índice GIN para busca no JSONB
CREATE INDEX idx_periodontal_chart_teeth_data ON periodontal_chart USING GIN (teeth_data);

-- Trigger para atualizar updated_at
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

-- Comentários
COMMENT ON TABLE periodontal_chart IS 'Periodontogramas (gráficos periodontais) dos pacientes';
COMMENT ON COLUMN periodontal_chart.teeth_data IS 'Dados periodontais de todos os dentes em formato JSON';
COMMENT ON COLUMN periodontal_chart.plaque_index IS 'Índice de placa bacteriana (0-100%)';
COMMENT ON COLUMN periodontal_chart.bleeding_index IS 'Índice de sangramento gengival (0-100%)';
```

---

### API Endpoints

#### Criar arquivo: `server/routes/periodontal.routes.ts`

```typescript
import express from 'express';
import { db } from '../db';
import { periodontalChart } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

// GET /api/v1/patients/:patientId/periodontal-charts
// Listar todos os periodontogramas de um paciente
router.get('/patients/:patientId/periodontal-charts', requireAuth, async (req, res) => {
  try {
    const { patientId } = req.params;
    const companyId = req.user!.companyId;

    const charts = await db
      .select()
      .from(periodontalChart)
      .where(
        and(
          eq(periodontalChart.patientId, parseInt(patientId)),
          eq(periodontalChart.companyId, companyId)
        )
      )
      .orderBy(desc(periodontalChart.chartDate));

    res.json(charts);
  } catch (error) {
    console.error('Error fetching periodontal charts:', error);
    res.status(500).json({ error: 'Failed to fetch periodontal charts' });
  }
});

// GET /api/v1/patients/:patientId/periodontal-charts/:chartId
// Buscar um periodontograma específico
router.get('/patients/:patientId/periodontal-charts/:chartId', requireAuth, async (req, res) => {
  try {
    const { patientId, chartId } = req.params;
    const companyId = req.user!.companyId;

    const [chart] = await db
      .select()
      .from(periodontalChart)
      .where(
        and(
          eq(periodontalChart.id, parseInt(chartId)),
          eq(periodontalChart.patientId, parseInt(patientId)),
          eq(periodontalChart.companyId, companyId)
        )
      );

    if (!chart) {
      return res.status(404).json({ error: 'Periodontal chart not found' });
    }

    res.json(chart);
  } catch (error) {
    console.error('Error fetching periodontal chart:', error);
    res.status(500).json({ error: 'Failed to fetch periodontal chart' });
  }
});

// POST /api/v1/patients/:patientId/periodontal-charts
// Criar novo periodontograma
router.post('/patients/:patientId/periodontal-charts', requireAuth, async (req, res) => {
  try {
    const { patientId } = req.params;
    const companyId = req.user!.companyId;
    const professionalId = req.user!.id;

    const {
      teethData,
      generalNotes,
      diagnosis,
      treatmentPlan,
      plaqueIndex,
      bleedingIndex,
      chartDate
    } = req.body;

    // Validação básica
    if (!teethData || !Array.isArray(teethData)) {
      return res.status(400).json({ error: 'teethData is required and must be an array' });
    }

    const [newChart] = await db
      .insert(periodontalChart)
      .values({
        companyId,
        patientId: parseInt(patientId),
        professionalId,
        teethData,
        generalNotes,
        diagnosis,
        treatmentPlan,
        plaque_index: plaqueIndex,
        bleeding_index: bleedingIndex,
        chartDate: chartDate ? new Date(chartDate) : new Date(),
      })
      .returning();

    res.status(201).json(newChart);
  } catch (error) {
    console.error('Error creating periodontal chart:', error);
    res.status(500).json({ error: 'Failed to create periodontal chart' });
  }
});

// PATCH /api/v1/patients/:patientId/periodontal-charts/:chartId
// Atualizar periodontograma existente
router.patch('/patients/:patientId/periodontal-charts/:chartId', requireAuth, async (req, res) => {
  try {
    const { patientId, chartId } = req.params;
    const companyId = req.user!.companyId;

    const {
      teethData,
      generalNotes,
      diagnosis,
      treatmentPlan,
      plaqueIndex,
      bleedingIndex,
    } = req.body;

    const updateData: any = {};
    if (teethData !== undefined) updateData.teethData = teethData;
    if (generalNotes !== undefined) updateData.generalNotes = generalNotes;
    if (diagnosis !== undefined) updateData.diagnosis = diagnosis;
    if (treatmentPlan !== undefined) updateData.treatmentPlan = treatmentPlan;
    if (plaqueIndex !== undefined) updateData.plaque_index = plaqueIndex;
    if (bleedingIndex !== undefined) updateData.bleeding_index = bleedingIndex;

    const [updatedChart] = await db
      .update(periodontalChart)
      .set(updateData)
      .where(
        and(
          eq(periodontalChart.id, parseInt(chartId)),
          eq(periodontalChart.patientId, parseInt(patientId)),
          eq(periodontalChart.companyId, companyId)
        )
      )
      .returning();

    if (!updatedChart) {
      return res.status(404).json({ error: 'Periodontal chart not found' });
    }

    res.json(updatedChart);
  } catch (error) {
    console.error('Error updating periodontal chart:', error);
    res.status(500).json({ error: 'Failed to update periodontal chart' });
  }
});

// DELETE /api/v1/patients/:patientId/periodontal-charts/:chartId
// Deletar periodontograma
router.delete('/patients/:patientId/periodontal-charts/:chartId', requireAuth, async (req, res) => {
  try {
    const { patientId, chartId } = req.params;
    const companyId = req.user!.companyId;

    const [deletedChart] = await db
      .delete(periodontalChart)
      .where(
        and(
          eq(periodontalChart.id, parseInt(chartId)),
          eq(periodontalChart.patientId, parseInt(patientId)),
          eq(periodontalChart.companyId, companyId)
        )
      )
      .returning();

    if (!deletedChart) {
      return res.status(404).json({ error: 'Periodontal chart not found' });
    }

    res.json({ message: 'Periodontal chart deleted successfully' });
  } catch (error) {
    console.error('Error deleting periodontal chart:', error);
    res.status(500).json({ error: 'Failed to delete periodontal chart' });
  }
});

// GET /api/v1/patients/:patientId/periodontal-charts/latest
// Buscar o periodontograma mais recente
router.get('/patients/:patientId/periodontal-charts-latest', requireAuth, async (req, res) => {
  try {
    const { patientId } = req.params;
    const companyId = req.user!.companyId;

    const [latestChart] = await db
      .select()
      .from(periodontalChart)
      .where(
        and(
          eq(periodontalChart.patientId, parseInt(patientId)),
          eq(periodontalChart.companyId, companyId)
        )
      )
      .orderBy(desc(periodontalChart.chartDate))
      .limit(1);

    if (!latestChart) {
      return res.status(404).json({ error: 'No periodontal charts found for this patient' });
    }

    res.json(latestChart);
  } catch (error) {
    console.error('Error fetching latest periodontal chart:', error);
    res.status(500).json({ error: 'Failed to fetch latest periodontal chart' });
  }
});

export default router;
```

---

### Frontend - Componente React

#### Estrutura de Componentes

```
client/src/components/periodontal/
├── PeriodontalChart.tsx          # Componente principal
├── PeriodontalGrid.tsx            # Grid com todos os dentes
├── ToothPeriodontalInput.tsx      # Input para um dente específico
├── PeriodontalHistory.tsx         # Histórico de periodontogramas
├── PeriodontalIndices.tsx         # Índices de placa e sangramento
└── PeriodontalComparison.tsx      # Comparação entre 2 periodontogramas
```

#### Componente Principal (esboço)

```typescript
// client/src/components/periodontal/PeriodontalChart.tsx

import React, { useState, useEffect } from 'react';
import { PeriodontalToothData } from '../../types/periodontal';

interface Props {
  patientId: number;
  chartId?: number; // Se fornecido, edita existente, senão cria novo
  readOnly?: boolean;
}

export function PeriodontalChart({ patientId, chartId, readOnly = false }: Props) {
  const [teethData, setTeethData] = useState<PeriodontalToothData[]>([]);
  const [generalNotes, setGeneralNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [loading, setLoading] = useState(false);

  // Inicializar com 32 dentes
  useEffect(() => {
    if (!chartId) {
      // Criar estrutura inicial para 32 dentes
      const initialTeeth = generateInitialTeethData();
      setTeethData(initialTeeth);
    } else {
      // Carregar dados existentes
      loadChart(chartId);
    }
  }, [chartId]);

  const generateInitialTeethData = (): PeriodontalToothData[] => {
    const teeth = [];
    // Quadrante 1 (superior direito): 18 a 11
    for (let i = 18; i >= 11; i--) teeth.push(createEmptyTooth(`${i}`));
    // Quadrante 2 (superior esquerdo): 21 a 28
    for (let i = 21; i <= 28; i++) teeth.push(createEmptyTooth(`${i}`));
    // Quadrante 3 (inferior esquerdo): 31 a 38
    for (let i = 38; i >= 31; i--) teeth.push(createEmptyTooth(`${i}`));
    // Quadrante 4 (inferior direito): 41 a 48
    for (let i = 48; i >= 41; i--) teeth.push(createEmptyTooth(`${i}`));
    return teeth;
  };

  const createEmptyTooth = (toothNumber: string): PeriodontalToothData => ({
    toothNumber,
    probingDepth: {
      mesialBuccal: 0, buccal: 0, distalBuccal: 0,
      mesialLingual: 0, lingual: 0, distalLingual: 0
    },
    gingivalRecession: {
      mesialBuccal: 0, buccal: 0, distalBuccal: 0,
      mesialLingual: 0, lingual: 0, distalLingual: 0
    },
    bleeding: {
      mesialBuccal: false, buccal: false, distalBuccal: false,
      mesialLingual: false, lingual: false, distalLingual: false
    },
    suppuration: {
      mesialBuccal: false, buccal: false, distalBuccal: false,
      mesialLingual: false, lingual: false, distalLingual: false
    },
    mobility: 0,
    furcation: 0,
    plaque: false,
    calculus: false
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      const url = chartId
        ? `/api/v1/patients/${patientId}/periodontal-charts/${chartId}`
        : `/api/v1/patients/${patientId}/periodontal-charts`;

      const method = chartId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teethData,
          generalNotes,
          diagnosis,
          plaqueIndex: calculatePlaqueIndex(),
          bleedingIndex: calculateBleedingIndex()
        })
      });

      if (response.ok) {
        alert('Periodontograma salvo com sucesso!');
      }
    } catch (error) {
      console.error('Error saving periodontal chart:', error);
      alert('Erro ao salvar periodontograma');
    } finally {
      setLoading(false);
    }
  };

  const calculatePlaqueIndex = (): number => {
    // % de dentes com placa
    const teethWithPlaque = teethData.filter(t => t.plaque).length;
    return (teethWithPlaque / teethData.length) * 100;
  };

  const calculateBleedingIndex = (): number => {
    // % de sítios com sangramento
    let totalSites = 0;
    let bleedingSites = 0;

    teethData.forEach(tooth => {
      Object.values(tooth.bleeding).forEach(bleeds => {
        totalSites++;
        if (bleeds) bleedingSites++;
      });
    });

    return totalSites > 0 ? (bleedingSites / totalSites) * 100 : 0;
  };

  return (
    <div className="periodontal-chart">
      <h2>Periodontograma</h2>

      {/* Grid de dentes com inputs */}
      <PeriodontalGrid
        teethData={teethData}
        onChange={setTeethData}
        readOnly={readOnly}
      />

      {/* Índices */}
      <PeriodontalIndices
        plaqueIndex={calculatePlaqueIndex()}
        bleedingIndex={calculateBleedingIndex()}
      />

      {/* Observações */}
      <div className="notes-section">
        <textarea
          value={generalNotes}
          onChange={(e) => setGeneralNotes(e.target.value)}
          placeholder="Observações gerais"
          disabled={readOnly}
        />
        <textarea
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          placeholder="Diagnóstico"
          disabled={readOnly}
        />
      </div>

      {/* Botões */}
      {!readOnly && (
        <button onClick={handleSave} disabled={loading}>
          {loading ? 'Salvando...' : 'Salvar Periodontograma'}
        </button>
      )}
    </div>
  );
}
```

---

### Estimativa de Implementação

| Tarefa | Tempo Estimado |
|--------|----------------|
| Schema e Migration | 1 dia |
| API Endpoints | 2 dias |
| Componentes React (básicos) | 5 dias |
| Visualização gráfica (charts) | 3 dias |
| Comparação entre periodontogramas | 2 dias |
| Impressão/PDF | 2 dias |
| Testes e ajustes | 3 dias |
| **TOTAL** | **18 dias (~4 semanas)** |

---

## 🔐 FUNCIONALIDADE 2: ASSINATURA DIGITAL CFO

### Visão Geral

Integração com o sistema oficial de Prescrição Eletrônica do CFO (Conselho Federal de Odontologia) para emitir prescrições, atestados e receitas digitais com validade legal.

### Requisitos Legais

**Obrigatório:**
- Certificado digital ICP-Brasil modelo A3 (em token ou cartão)
- Integração com portal CFO: https://prescricaoeletronica.cfo.org.br/
- Assinatura digital em cada documento
- QR Code para validação

### Arquitetura da Solução

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Sistema   │────────►│   Backend    │────────►│   CFO API   │
│   (React)   │         │   (Express)  │         │  (Oficial)  │
└─────────────┘         └──────┬───────┘         └─────────────┘
                               │
                               │
                               ▼
                        ┌──────────────┐
                        │  Certificado │
                        │   Digital    │
                        │  (ICP-Brasil)│
                        └──────────────┘
```

### Opções de Implementação

#### Opção 1: Integração Direta com CFO (Mais Complexa)

**Vantagens:**
- Controle total
- Sem custos extras de terceiros

**Desvantagens:**
- Complexidade alta (certificado digital A3)
- Precisa leitor de smartcard
- Manutenção complexa

**Tecnologias necessárias:**
- Biblioteca para ler certificado A3 (ex: node-forge, pki.js)
- Driver para leitora de cartão/token
- Integração com API CFO

#### Opção 2: Usar Serviço Terceiro (Mais Simples)

Existem serviços que facilitam a assinatura digital:

**Serviços disponíveis:**
- **Assinei** (https://assinei.com.br)
- **ClickSign** (https://www.clicksign.com)
- **DocuSign** (internacional)

**Vantagens:**
- Implementação mais rápida
- Não precisa lidar com certificado A3 diretamente
- Manutenção simplificada

**Desvantagens:**
- Custo mensal por assinatura
- Dependência de terceiro

---

### Implementação Recomendada (Híbrida)

**Fase 1:** Usar serviço terceiro (rápido, funcional)
**Fase 2:** Migrar para integração direta CFO (quando volume justificar)

---

### Schema do Banco de Dados

```typescript
// shared/schema.ts

export const digitalSignatures = pgTable('digital_signatures', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => companies.id),
  professionalId: integer('professional_id').notNull().references(() => users.id),

  // Tipo de documento
  documentType: text('document_type').notNull(), // 'prescription', 'certificate', 'exam_request'
  documentId: integer('document_id').notNull(), // ID da prescrição/atestado

  // Dados do certificado
  certificateSerialNumber: text('certificate_serial_number'),
  certificateName: text('certificate_name'),
  certificateIssuer: text('certificate_issuer'),

  // CFO
  cfoRegistrationNumber: text('cfo_registration_number').notNull(), // Número CRO
  cfoState: text('cfo_state').notNull(), // Estado do CRO (ex: "SP", "RJ")

  // Assinatura
  signedPdfUrl: text('signed_pdf_url').notNull(), // URL do PDF assinado
  signatureHash: text('signature_hash'), // Hash da assinatura
  qrCodeData: text('qr_code_data'), // Dados do QR Code para validação
  cfoValidationUrl: text('cfo_validation_url'), // URL de validação no portal CFO

  // Timestamps
  signedAt: timestamp('signed_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'), // Para documentos com validade

  // Status
  status: text('status').notNull().default('valid'), // 'valid', 'revoked', 'expired'

  createdAt: timestamp('created_at').defaultNow(),
});

// Adicionar ao schema de prescriptions
export const prescriptions = pgTable('prescriptions', {
  // ... campos existentes ...

  // Novos campos para assinatura digital
  signatureId: integer('signature_id').references(() => digitalSignatures.id),
  digitallySigned: boolean('digitally_signed').default(false),
  signedPdfUrl: text('signed_pdf_url'),
  validatedByCfo: boolean('validated_by_cfo').default(false),
  cfoValidationUrl: text('cfo_validation_url'),
});
```

---

### API Endpoints

```typescript
// server/routes/digital-signature.routes.ts

import express from 'express';
import { db } from '../db';
import { digitalSignatures, prescriptions } from '../../shared/schema';
import { requireAuth } from '../middleware/auth';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

const router = express.Router();

// POST /api/v1/digital-signature/sign-prescription/:prescriptionId
router.post('/sign-prescription/:prescriptionId', requireAuth, async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const professionalId = req.user!.id;
    const companyId = req.user!.companyId;

    // 1. Buscar prescrição
    const [prescription] = await db
      .select()
      .from(prescriptions)
      .where(eq(prescriptions.id, parseInt(prescriptionId)));

    if (!prescription) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    // 2. Verificar se profissional tem certificado digital cadastrado
    const professional = await db
      .select()
      .from(users)
      .where(eq(users.id, professionalId));

    if (!professional.cfoRegistrationNumber) {
      return res.status(400).json({
        error: 'Professional does not have CFO registration number'
      });
    }

    // 3. Gerar PDF da prescrição
    const pdfBuffer = await generatePrescriptionPDF(prescription);

    // 4. Assinar digitalmente (integrar com serviço de assinatura)
    const signedPdfUrl = await signPDFWithCertificate(pdfBuffer, professionalId);

    // 5. Gerar QR Code para validação
    const validationUrl = `https://prescricao.cfo.org.br/validar?id=${prescription.id}`;
    const qrCodeData = await QRCode.toDataURL(validationUrl);

    // 6. Salvar assinatura digital
    const [signature] = await db
      .insert(digitalSignatures)
      .values({
        companyId,
        professionalId,
        documentType: 'prescription',
        documentId: prescription.id,
        cfoRegistrationNumber: professional.cfoRegistrationNumber,
        cfoState: professional.cfoState,
        signedPdfUrl,
        qrCodeData,
        cfoValidationUrl: validationUrl,
        status: 'valid'
      })
      .returning();

    // 7. Atualizar prescrição
    await db
      .update(prescriptions)
      .set({
        signatureId: signature.id,
        digitallySigned: true,
        signedPdfUrl,
        cfoValidationUrl: validationUrl
      })
      .where(eq(prescriptions.id, prescription.id));

    res.json({
      success: true,
      signedPdfUrl,
      validationUrl,
      qrCodeData
    });

  } catch (error) {
    console.error('Error signing prescription:', error);
    res.status(500).json({ error: 'Failed to sign prescription' });
  }
});

// GET /api/v1/digital-signature/validate/:signatureId
router.get('/validate/:signatureId', async (req, res) => {
  try {
    const { signatureId } = req.params;

    const [signature] = await db
      .select()
      .from(digitalSignatures)
      .where(eq(digitalSignatures.id, parseInt(signatureId)));

    if (!signature) {
      return res.status(404).json({ error: 'Signature not found' });
    }

    // Verificar validade
    const isValid = signature.status === 'valid' &&
                   (!signature.expiresAt || new Date(signature.expiresAt) > new Date());

    res.json({
      isValid,
      signature,
      validationUrl: signature.cfoValidationUrl
    });

  } catch (error) {
    console.error('Error validating signature:', error);
    res.status(500).json({ error: 'Failed to validate signature' });
  }
});

export default router;
```

---

### Integração com Serviço de Assinatura (Exemplo: Assinei)

```typescript
// server/services/digital-signature.service.ts

import axios from 'axios';

export class DigitalSignatureService {
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = process.env.ASSINEI_API_KEY || '';
    this.apiUrl = process.env.ASSINEI_API_URL || 'https://api.assinei.com.br';
  }

  async signDocument(pdfBuffer: Buffer, signerData: {
    name: string;
    email: string;
    cfoNumber: string;
    cfoState: string;
  }): Promise<string> {
    try {
      // 1. Upload do documento
      const uploadResponse = await axios.post(
        `${this.apiUrl}/v1/documents`,
        {
          file: pdfBuffer.toString('base64'),
          filename: `prescription_${Date.now()}.pdf`
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const documentId = uploadResponse.data.id;

      // 2. Adicionar assinante
      await axios.post(
        `${this.apiUrl}/v1/documents/${documentId}/signers`,
        {
          name: signerData.name,
          email: signerData.email,
          sign_as: 'signer',
          signature_type: 'digital_certificate', // Certificado digital
          custom_fields: {
            cfo_number: signerData.cfoNumber,
            cfo_state: signerData.cfoState
          }
        },
        {
          headers: { 'Authorization': `Bearer ${this.apiKey}` }
        }
      );

      // 3. Enviar para assinatura
      const signResponse = await axios.post(
        `${this.apiUrl}/v1/documents/${documentId}/send`,
        {},
        {
          headers: { 'Authorization': `Bearer ${this.apiKey}` }
        }
      );

      // 4. Retornar URL do documento assinado
      return signResponse.data.signed_url;

    } catch (error) {
      console.error('Error signing document:', error);
      throw new Error('Failed to sign document');
    }
  }
}
```

---

### Frontend - Interface de Assinatura

```typescript
// client/src/components/prescriptions/DigitalSignature.tsx

import React, { useState } from 'react';

interface Props {
  prescriptionId: number;
  onSigned: () => void;
}

export function DigitalSignature({ prescriptionId, onSigned }: Props) {
  const [loading, setLoading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);

  const handleSign = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/v1/digital-signature/sign-prescription/${prescriptionId}`,
        { method: 'POST' }
      );

      const data = await response.json();

      if (response.ok) {
        setSignedUrl(data.signedPdfUrl);
        setQrCode(data.qrCodeData);
        onSigned();
        alert('Prescrição assinada digitalmente com sucesso!');
      } else {
        alert(data.error || 'Erro ao assinar prescrição');
      }
    } catch (error) {
      console.error('Error signing prescription:', error);
      alert('Erro ao assinar prescrição');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="digital-signature">
      <h3>Assinatura Digital CFO</h3>

      {!signedUrl ? (
        <button onClick={handleSign} disabled={loading}>
          {loading ? 'Assinando...' : 'Assinar Digitalmente'}
        </button>
      ) : (
        <div className="signature-result">
          <p>✅ Documento assinado digitalmente</p>

          <a href={signedUrl} target="_blank" rel="noopener noreferrer">
            📄 Baixar PDF Assinado
          </a>

          {qrCode && (
            <div className="qr-code">
              <p>QR Code para validação:</p>
              <img src={qrCode} alt="QR Code validação CFO" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

### Estimativa de Implementação

| Tarefa | Tempo Estimado |
|--------|----------------|
| Schema e Migration | 1 dia |
| Integração com serviço de assinatura | 3 dias |
| API Endpoints | 2 dias |
| Geração de PDF com QR Code | 2 dias |
| Interface React | 2 dias |
| Configuração de certificados | 1 dia |
| Testes e validação CFO | 3 dias |
| Documentação | 1 dia |
| **TOTAL** | **15 dias (~3 semanas)** |

**Nota:** Se optar por integração direta com CFO (sem terceiro), adicionar +3-4 semanas para implementar leitura de certificado A3.

---

## 📅 CRONOGRAMA SUGERIDO

### Semana 1-4: Gráfico Periodontal
- Backend completo (schema, API, testes)
- Frontend básico (input de dados)
- Visualização gráfica

### Semana 5-7: Assinatura Digital CFO
- Integração com serviço de assinatura
- Geração de PDF assinado
- QR Code e validação

### Semana 8: Testes e Ajustes
- Testes integrados
- Correções de bugs
- Documentação final

**TOTAL: 8 semanas (~2 meses)**

---

## 🎯 PRÓXIMOS PASSOS IMEDIATOS

1. **Definir prioridade:**
   - Começar pelo Periodontal? (mais complexo, mas independente)
   - Começar pela Assinatura CFO? (compliance legal)

2. **Para Periodontal:**
   - Criar migration
   - Implementar API
   - Desenvolver componente React

3. **Para Assinatura CFO:**
   - Escolher serviço de assinatura (Assinei, ClickSign, etc.)
   - Criar conta e obter credenciais de teste
   - Implementar integração

**Qual você quer priorizar primeiro?**
