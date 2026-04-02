/**
 * Clinical Assistant Service
 * Transcrição de áudio + análise clínica com IA para dentistas
 * Sugere tratamentos e medicamentos com base no contexto do paciente
 */

import fs from 'fs';
import { db } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import {
  patients,
  anamnesis,
  odontogramEntries,
  prescriptions,
  patientRecords,
} from '@shared/schema';
import { AIProviderService } from './ai-provider';
import { logger } from '../logger';

const log = logger.child({ module: 'clinical-assistant' });

// ============================================================
// Interfaces
// ============================================================

export interface TranscriptionResult {
  text: string;
  segments: Array<{ start: number; end: number; text: string }>;
  duration: number;
}

export interface ClinicalFinding {
  description: string;
  severity: 'low' | 'medium' | 'high';
  toothId?: string;
}

export interface TreatmentSuggestion {
  procedure: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  toothId?: string;
  justification: string;
}

export interface MedicationSuggestion {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: 'oral' | 'topical';
  notes?: string;
}

export interface ClinicalAlert {
  type: 'contraindication' | 'interaction' | 'precaution';
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

export interface ClinicalAnalysis {
  clinicalFindings: ClinicalFinding[];
  treatmentSuggestions: TreatmentSuggestion[];
  medicationSuggestions: MedicationSuggestion[];
  alerts: ClinicalAlert[];
  summary: string;
}

interface PatientContext {
  patient: any;
  anamnesisData: any | null;
  odontogram: any[];
  recentPrescriptions: any[];
}

// ============================================================
// Dental Medication Knowledge Base
// ============================================================

const DENTAL_MEDICATIONS_KB = `
BASE DE MEDICAMENTOS ODONTOLOGICOS:

ANALGESICOS:
- Dipirona Sodica 500mg: 500-1000mg VO 6/6h por 3-5 dias (dor leve-moderada)
- Paracetamol 750mg: 750mg VO 6/6h por 3-5 dias (dor leve, seguro na gestacao)
- Ibuprofeno 200-400mg: 200-400mg VO 6/6h por 3-5 dias (dor leve + anti-inflamatorio)

ANTI-INFLAMATORIOS:
- Ibuprofeno 600mg: 600mg VO 8/8h por 3-5 dias (pos-extracao, pos-cirurgico)
- Nimesulida 100mg: 100mg VO 12/12h por 3-5 dias (inflamacao pos-cirurgica)
- Diclofenaco Sodico 50mg: 50mg VO 8/8h por 3 dias (pos-cirurgico, evitar em problemas gastricos)
- Dexametasona 4mg: 4mg dose unica pre-operatoria ou 4mg VO 8/8h por 3 dias (cirurgia de terceiro molar, edema severo)

ANTIBIOTICOS:
- Amoxicilina 500mg: 500mg VO 8/8h por 7 dias (primeira escolha para infeccoes odontogenicas)
- Amoxicilina 1g: dose unica 1h antes do procedimento (profilaxia para endocardite/valvula protetica)
- Amoxicilina + Clavulanato 500/125mg: 1 comp VO 8/8h por 7 dias (infeccoes resistentes)
- Azitromicina 500mg: 500mg VO 24/24h por 3 dias (alternativa para alergia a penicilina)
- Clindamicina 300mg: 300mg VO 8/8h por 7 dias (alergia a penicilina, infeccoes anaerobias)
- Metronidazol 400mg: 400mg VO 8/8h por 7 dias (infeccoes anaerobias, abscesso periodontal)

ANTISSEPTICOS:
- Clorexidina 0,12% (bochecho): 15ml 12/12h por 7-14 dias (pos-cirurgico, periodontal)

ANSIOLITICOS (receita especial B1):
- Midazolam 7,5mg: 7,5-15mg dose unica 30min antes (sedacao consciente)
- Diazepam 5-10mg: 5-10mg noite anterior + 1h antes (pacientes ansiosos)
`;

const CONTRAINDICATION_RULES = `
REGRAS DE CONTRAINDICACAO (OBRIGATORIO VERIFICAR):

1. GESTANTE:
   - PROIBIDO: Nimesulida, Ibuprofeno (especialmente 3o trimestre), Metronidazol (1o trimestre)
   - SEGURO: Paracetamol, Amoxicilina
   - CUIDADO: Dipirona (evitar no 1o e 3o trimestre)

2. ALERGIA A PENICILINA:
   - SUBSTITUIR Amoxicilina por Clindamicina 300mg ou Azitromicina 500mg
   - Profilaxia: Clindamicina 600mg dose unica 1h antes

3. USO DE ANTICOAGULANTES (Warfarina, Rivaroxabana, AAS, etc):
   - EVITAR todos os AINEs (Ibuprofeno, Nimesulida, Diclofenaco)
   - PREFERIR Paracetamol + Dipirona
   - ALERTAR risco aumentado de sangramento em procedimentos cirurgicos
   - Verificar INR antes de exodontias

4. USO DE BIFOSFONATOS (Alendronato, Risedronato, Zolendronato):
   - CONTRAINDICACAO RELATIVA para exodontia (risco de osteonecrose mandibular/maxilar)
   - OBRIGATORIO alertar e considerar alternativas conservadoras
   - Se cirurgia inevitavel: protocolo com antibiotico pre e pos-operatorio

5. VALVULA PROTETICA / FEBRE REUMATICA / ENDOCARDITE PREVIA:
   - PROFILAXIA ANTIBIOTICA OBRIGATORIA antes de qualquer procedimento invasivo
   - Amoxicilina 2g dose unica 1h antes (ou Clindamicina 600mg se alergia)

6. HIPERTENSAO SEVERA:
   - Evitar vasoconstritores com adrenalina em concentracao alta
   - Monitorar PA antes do procedimento

7. DIABETES:
   - Risco de cicatrizacao comprometida
   - Preferir atendimento no horario matinal
   - Corticosteroides (Dexametasona) podem elevar glicemia - usar com cautela

8. ASMA:
   - EVITAR AINEs (risco de broncoespasmo)
   - EVITAR anestesico com sulfito

9. DISTURBIO DE COAGULACAO / HEMOFILIA:
   - Avaliacao hematologica pre-operatoria obrigatoria
   - Evitar AINEs, preferir Paracetamol

10. INSUFICIENCIA RENAL:
    - EVITAR AINEs
    - Ajustar dose de antibioticos

11. INSUFICIENCIA HEPATICA:
    - EVITAR Paracetamol em doses altas
    - Cuidado com Metronidazol

12. HIV/AIDS:
    - Verificar interacoes com antirretrovirais
    - Cuidado redobrado com infeccoes oportunistas
`;

// ============================================================
// Service
// ============================================================

export class ClinicalAssistantService {
  private companyId: number;

  constructor(companyId: number) {
    this.companyId = companyId;
  }

  /**
   * Transcreve áudio: Local Whisper → OpenAI Whisper (fallback)
   *
   * LGPD: Prefere processamento local. Fallback para OpenAI se local indisponível.
   */
  async transcribeAudio(audioFilePath: string): Promise<TranscriptionResult> {
    const whisperUrl = process.env.WHISPER_API_URL || 'http://localhost:8178/inference';

    try {
      const audioBuffer = fs.readFileSync(audioFilePath);

      // 1. Try local Whisper
      try {
        const formData = new FormData();
        formData.append('file', new Blob([audioBuffer]), 'audio.wav');
        formData.append('language', 'pt');
        formData.append('response_format', 'verbose_json');

        log.info({ audioFilePath, provider: 'local-whisper' }, 'Transcribing audio');

        const response = await fetch(whisperUrl, {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(120000),
        });

        if (response.ok) {
          const transcription = await response.json();
          return {
            text: transcription.text || '',
            segments: (transcription.segments || []).map((s: any) => ({
              start: s.start, end: s.end, text: s.text,
            })),
            duration: transcription.duration || 0,
          };
        }
        log.warn({ status: response.status }, 'Local Whisper error, trying OpenAI fallback');
      } catch (localErr) {
        log.warn({ err: localErr }, 'Local Whisper unavailable, trying OpenAI fallback');
      }

      // 2. Fallback: OpenAI Whisper
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('Whisper local indisponível e OPENAI_API_KEY não configurada');
      }

      const formData = new FormData();
      formData.append('file', new Blob([audioBuffer]), 'audio.wav');
      formData.append('model', 'whisper-1');
      formData.append('language', 'pt');
      formData.append('response_format', 'verbose_json');

      log.info({ audioFilePath, provider: 'openai-whisper' }, 'Transcribing audio via OpenAI fallback');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
        signal: AbortSignal.timeout(120000),
      });

      if (!response.ok) {
        throw new Error(`OpenAI Whisper error: ${response.status}`);
      }

      const transcription = await response.json();
      return {
        text: transcription.text || '',
        segments: ((transcription as any).segments || []).map((s: any) => ({
          start: s.start, end: s.end, text: s.text,
        })),
        duration: (transcription as any).duration || 0,
      };
    } finally {
      try { fs.unlinkSync(audioFilePath); } catch { /* cleanup */ }
    }
  }

  /**
   * Analisa transcrição clínica com IA
   */
  async analyzeClinical(transcription: string, patientId: number): Promise<ClinicalAnalysis> {
    const context = await this.getPatientContext(patientId);
    const prompt = this.buildClinicalPrompt(transcription, context);

    const aiService = new AIProviderService(this.companyId);
    await aiService.initialize();

    const response = await aiService.complete({
      messages: [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: `TRANSCRICAO DA CONSULTA:\n\n${transcription}\n\nAnalise a transcricao acima e retorne o JSON estruturado com achados clinicos, sugestoes de tratamento, medicamentos e alertas.`,
        },
      ],
      maxTokens: 2048,
      temperature: 0.2,
    });

    return this.parseClinicalResponse(response.content);
  }

  /**
   * Salva nota clínica como registro do paciente
   */
  async saveClinicalNote(
    patientId: number,
    transcription: string,
    analysis: ClinicalAnalysis,
    createdBy: number,
  ): Promise<number> {
    const [record] = await db
      .insert(patientRecords)
      .values({
        companyId: this.companyId,
        patientId,
        recordType: 'ai_clinical_note',
        content: {
          transcription,
          analysis,
          timestamp: new Date().toISOString(),
        },
        createdBy,
      })
      .returning({ id: patientRecords.id });

    return record.id;
  }

  /**
   * Busca histórico de notas clínicas com IA
   */
  async getClinicalNoteHistory(patientId: number) {
    return db
      .select()
      .from(patientRecords)
      .where(
        and(
          eq(patientRecords.companyId, this.companyId),
          eq(patientRecords.patientId, patientId),
          eq(patientRecords.recordType, 'ai_clinical_note'),
        ),
      )
      .orderBy(desc(patientRecords.createdAt));
  }

  // ============================================================
  // Private Methods
  // ============================================================

  private async getPatientContext(patientId: number): Promise<PatientContext> {
    const [patient] = await db
      .select()
      .from(patients)
      .where(
        and(eq(patients.id, patientId), eq(patients.companyId, this.companyId)),
      )
      .limit(1);

    if (!patient) {
      throw new Error('Paciente não encontrado');
    }

    const [anamnesisData] = await db
      .select()
      .from(anamnesis)
      .where(
        and(
          eq(anamnesis.patientId, patientId),
          eq(anamnesis.companyId, this.companyId),
        ),
      )
      .orderBy(desc(anamnesis.createdAt))
      .limit(1);

    const odontogram = await db
      .select()
      .from(odontogramEntries)
      .where(
        and(
          eq(odontogramEntries.patientId, patientId),
          eq(odontogramEntries.companyId, this.companyId),
        ),
      )
      .orderBy(desc(odontogramEntries.createdAt));

    // Pegar últimas 5 prescrições
    const recentPrescriptions = await db
      .select()
      .from(prescriptions)
      .where(
        and(
          eq(prescriptions.patientId, patientId),
          eq(prescriptions.companyId, this.companyId),
        ),
      )
      .orderBy(desc(prescriptions.createdAt))
      .limit(5);

    return { patient, anamnesisData, odontogram, recentPrescriptions };
  }

  private buildClinicalPrompt(transcription: string, ctx: PatientContext): string {
    const p = ctx.patient;
    const a = ctx.anamnesisData;

    // Calcular idade
    const age = p.birthDate
      ? Math.floor(
          (Date.now() - new Date(p.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
        )
      : 'Desconhecida';

    // Formatar odontograma atual
    const odontogramMap = new Map<string, any>();
    for (const entry of ctx.odontogram) {
      const key = `${entry.toothId}_${entry.faceId || 'whole'}`;
      if (!odontogramMap.has(key)) {
        odontogramMap.set(key, entry);
      }
    }
    const odontogramText =
      odontogramMap.size > 0
        ? Array.from(odontogramMap.values())
            .map(
              (e) =>
                `- Dente ${e.toothId}${e.faceId ? ` (face ${e.faceId})` : ''}: ${e.status}${e.notes ? ` - ${e.notes}` : ''}`,
            )
            .join('\n')
        : 'Nenhum registro no odontograma';

    // Formatar prescrições recentes
    const prescriptionsText =
      ctx.recentPrescriptions.length > 0
        ? ctx.recentPrescriptions
            .map(
              (pr) =>
                `- ${pr.title || pr.type}: ${pr.medications ? JSON.stringify(pr.medications) : pr.content}`,
            )
            .join('\n')
        : 'Nenhuma prescricao recente';

    return `Voce e um assistente clinico odontologico especializado. Analise a transcricao da consulta do dentista e retorne uma analise clinica estruturada em JSON.

IMPORTANTE: Voce DEVE responder APENAS com JSON valido, sem texto adicional, sem markdown, sem code blocks.

DADOS DO PACIENTE (anonimizado — LGPD Art. 11):
- ID: PACIENTE_${p.id}
- Idade: ${age} anos
- Genero: ${p.gender || 'Nao informado'}
- Tipo Sanguineo: ${p.bloodType || 'Nao informado'}
- Alergias: ${p.allergies || 'Nenhuma registrada'}
- Medicamentos em uso: ${p.medications || 'Nenhum registrado'}
- Doencas cronicas: ${p.chronicDiseases || 'Nenhuma registrada'}

${a ? `ANAMNESE:
- Queixa principal: ${a.chiefComplaint || 'N/A'}
- Historico medico: ${a.medicalHistory || 'N/A'}
- Medicamentos atuais: ${a.currentMedications || 'N/A'}
- Alergias detalhadas: ${a.allergiesDetail || 'N/A'}
- Cirurgias previas: ${a.previousSurgeries || 'N/A'}
- Historico dental: ${a.dentalHistory || 'N/A'}
- Tratamentos previos: ${a.previousDentalTreatments || 'N/A'}
- Gestante: ${a.pregnant ? `SIM (${a.pregnancyMonth || '?'} meses)` : 'Nao'}
- Doenca cardiaca: ${a.heartDisease ? 'SIM' : 'Nao'}
- Hipertensao: ${a.highBloodPressure ? 'SIM' : 'Nao'}
- Diabetes: ${a.diabetes ? 'SIM' : 'Nao'}
- Hepatite: ${a.hepatitis ? 'SIM' : 'Nao'}
- Doenca renal: ${a.kidney_disease ? 'SIM' : 'Nao'}
- Tabagismo: ${a.smoking ? `SIM (${a.smokingFrequency || ''})` : 'Nao'}
- Alcool: ${a.alcohol ? `SIM (${a.alcoholFrequency || ''})` : 'Nao'}
- Bruxismo: ${a.bruxism ? 'SIM' : 'Nao'}
- Uso de anticoagulante: ${a.anticoagulantUse ? `SIM (${a.anticoagulantName || 'nome nao especificado'})` : 'Nao'}
- Uso de bifosfonatos: ${a.bisphosphonateUse ? 'SIM' : 'Nao'}
- Valvula cardiaca protetica: ${a.prostheticHeartValve ? 'SIM' : 'Nao'}
- Febre reumatica: ${a.rheumaticFever ? 'SIM' : 'Nao'}
- Disturbio de coagulacao: ${a.bleedingDisorder ? 'SIM' : 'Nao'}
- HIV/AIDS: ${a.hivAids ? 'SIM' : 'Nao'}
- Anemia: ${a.anemiaFlag ? 'SIM' : 'Nao'}
- Asma: ${a.asthma ? 'SIM' : 'Nao'}
- Epilepsia: ${a.epilepsy ? 'SIM' : 'Nao'}
- Disturbio tireoidiano: ${a.thyroidDisorder ? 'SIM' : 'Nao'}
- Historico de cancer: ${a.cancerHistory ? `SIM (${a.cancerType || '?'})` : 'Nao'}
- Radioterapia: ${a.radiationTherapy ? 'SIM' : 'Nao'}
- Uso de drogas: ${a.drugUse ? 'SIM' : 'Nao'}
- Nivel de ansiedade dental: ${a.dentalAnxietyLevel ?? 'N/A'}/10
- PA: ${a.bloodPressureSystolic ? `${a.bloodPressureSystolic}/${a.bloodPressureDiastolic} mmHg` : 'N/A'}
- Peso: ${a.weight || 'N/A'} kg | Altura: ${a.height || 'N/A'} cm` : 'ANAMNESE: Nao preenchida'}

ODONTOGRAMA ATUAL:
${odontogramText}

PRESCRICOES RECENTES:
${prescriptionsText}

${DENTAL_MEDICATIONS_KB}

${CONTRAINDICATION_RULES}

RETORNE EXATAMENTE ESTE JSON (sem texto adicional):
{
  "clinicalFindings": [
    { "description": "descricao do achado", "severity": "low|medium|high", "toothId": "numero FDI opcional" }
  ],
  "treatmentSuggestions": [
    { "procedure": "nome do procedimento", "priority": "urgent|high|medium|low", "toothId": "numero FDI opcional", "justification": "justificativa clinica" }
  ],
  "medicationSuggestions": [
    { "name": "nome do medicamento", "dosage": "dosagem", "frequency": "frequencia", "duration": "duracao", "route": "oral|topical", "notes": "observacoes" }
  ],
  "alerts": [
    { "type": "contraindication|interaction|precaution", "severity": "critical|warning|info", "message": "mensagem do alerta" }
  ],
  "summary": "resumo geral da consulta em 2-3 frases"
}`;
  }

  private parseClinicalResponse(response: string): ClinicalAnalysis {
    // Tentar parsear JSON diretamente
    let jsonStr = response.trim();

    // Remover code blocks markdown se presentes
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    // Tentar encontrar JSON no texto
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    try {
      const parsed = JSON.parse(jsonStr);

      return {
        clinicalFindings: Array.isArray(parsed.clinicalFindings)
          ? parsed.clinicalFindings
          : [],
        treatmentSuggestions: Array.isArray(parsed.treatmentSuggestions)
          ? parsed.treatmentSuggestions
          : [],
        medicationSuggestions: Array.isArray(parsed.medicationSuggestions)
          ? parsed.medicationSuggestions
          : [],
        alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
        summary: parsed.summary || 'Analise concluida.',
      };
    } catch {
      // Se falhar o parse, retornar análise básica com o texto como sumário
      return {
        clinicalFindings: [],
        treatmentSuggestions: [],
        medicationSuggestions: [],
        alerts: [
          {
            type: 'precaution',
            severity: 'info',
            message:
              'A IA nao conseguiu estruturar a resposta. Revise o texto abaixo manualmente.',
          },
        ],
        summary: response.substring(0, 500),
      };
    }
  }
}
