/**
 * Clinical Assistant Routes
 * Endpoints para o assistente clínico com IA
 * - Transcrição de áudio (Whisper)
 * - Análise clínica com sugestões de tratamento/medicação
 * - Histórico de notas clínicas
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { authCheck, asyncHandler } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { ClinicalAssistantService } from '../services/clinical-assistant';

const router = Router();

// Garantir que o diretório de upload existe
const uploadDir = path.join(process.cwd(), 'uploads', 'clinical-audio');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuração do multer para upload de áudio
const audioUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname) || '.webm';
      cb(null, 'audio-' + uniqueSuffix + ext);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/ogg', 'audio/x-m4a'];
    const allowedExts = /\.(webm|wav|mp3|m4a|ogg|mp4|mpeg)$/i;

    if (allowedTypes.includes(file.mimetype) || allowedExts.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de áudio não suportado. Use: webm, wav, mp3, m4a ou ogg'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Schemas de validação
const analyzeSchema = z.object({
  transcription: z.string().min(1, 'Transcrição é obrigatória'),
  patientId: z.number().int().positive(),
});

const saveNoteSchema = z.object({
  patientId: z.number().int().positive(),
  transcription: z.string().min(1),
  analysis: z.object({
    clinicalFindings: z.array(z.any()),
    treatmentSuggestions: z.array(z.any()),
    medicationSuggestions: z.array(z.any()),
    alerts: z.array(z.any()),
    summary: z.string(),
  }),
});

const patientIdParamSchema = z.object({
  patientId: z.string().regex(/^\d+$/).transform(Number),
});

/**
 * POST /api/v1/clinical-assistant/transcribe
 * Transcreve áudio da consulta usando OpenAI Whisper
 */
router.post(
  '/transcribe',
  authCheck,
  audioUpload.single('audio'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo de áudio é obrigatório' });
    }

    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'Empresa não identificada' });
    }

    const service = new ClinicalAssistantService(companyId);
    const transcription = await service.transcribeAudio(req.file.path);

    res.json({
      success: true,
      transcription,
    });
  }),
);

/**
 * POST /api/v1/clinical-assistant/analyze
 * Analisa transcrição clínica e sugere tratamentos/medicamentos
 */
router.post(
  '/analyze',
  authCheck,
  validate({ body: analyzeSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'Empresa não identificada' });
    }

    const { transcription, patientId } = req.body;
    const service = new ClinicalAssistantService(companyId);
    const analysis = await service.analyzeClinical(transcription, patientId);

    res.json({
      success: true,
      analysis,
    });
  }),
);

/**
 * POST /api/v1/clinical-assistant/save-note
 * Salva nota clínica gerada pela IA como registro do paciente
 */
router.post(
  '/save-note',
  authCheck,
  validate({ body: saveNoteSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'Empresa não identificada' });
    }

    const { patientId, transcription, analysis } = req.body;
    const service = new ClinicalAssistantService(companyId);
    const recordId = await service.saveClinicalNote(
      patientId,
      transcription,
      analysis,
      user.id,
    );

    res.status(201).json({
      success: true,
      recordId,
    });
  }),
);

/**
 * GET /api/v1/clinical-assistant/history/:patientId
 * Retorna histórico de notas clínicas com IA do paciente
 */
router.get(
  '/history/:patientId',
  authCheck,
  validate({ params: patientIdParamSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'Empresa não identificada' });
    }

    const patientId = parseInt(req.params.patientId);
    const service = new ClinicalAssistantService(companyId);
    const history = await service.getClinicalNoteHistory(patientId);

    res.json({
      success: true,
      history,
    });
  }),
);

/**
 * POST /api/v1/clinical-assistant/suggest-treatment-plan
 * Sugere um plano de tratamento a partir dos dados do odontograma do paciente.
 *
 * Body:
 *   patientId         — ID do paciente (integer)
 *   odontogramEntries — array de entradas do odontograma:
 *     { toothId: string, faceId?: string, status: string, notes?: string }
 *
 * Response (JSON estruturado ou raw em caso de falha no parse):
 *   {
 *     diagnosis: string,
 *     treatments: [{ tooth, procedure, priority, sessions, notes }],
 *     generalRecommendations: string
 *   }
 */
router.post(
  '/suggest-treatment-plan',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId: number | undefined = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'Empresa não identificada' });
    }

    const { patientId, odontogramEntries } = req.body as {
      patientId: number;
      odontogramEntries: Array<{
        toothId: string;
        faceId?: string;
        status: string;
        notes?: string;
      }>;
    };

    if (!patientId || !Array.isArray(odontogramEntries) || odontogramEntries.length === 0) {
      return res.status(400).json({ error: 'patientId e odontogramEntries são obrigatórios' });
    }

    const toothSummary = odontogramEntries
      .map(e =>
        `Dente ${e.toothId}${e.faceId ? ` (face: ${e.faceId})` : ' (completo)'}: ${e.status}${e.notes ? ' - ' + e.notes : ''}`,
      )
      .join('\n');

    const prompt = `Voce e um dentista experiente. Com base no odontograma abaixo, sugira um plano de tratamento completo, ordenado por prioridade (urgente primeiro), com estimativa de sessoes para cada procedimento.

Odontograma:
${toothSummary}

Responda SOMENTE com um objeto JSON valido, sem markdown, sem texto extra, no seguinte formato:
{
  "diagnosis": "resumo do diagnostico geral",
  "treatments": [
    { "tooth": "11", "procedure": "restauracao classe II", "priority": "alta", "sessions": 1, "notes": "cavidade mesial extensa" }
  ],
  "generalRecommendations": "recomendacoes gerais de higiene ou acompanhamento"
}`;

    const { AIProviderService } = await import('../services/ai-provider');
    const aiService = new AIProviderService(companyId);
    await aiService.initialize();

    const aiResponse = await aiService.complete({
      messages: [
        { role: 'user', content: prompt },
      ],
      maxTokens: 2048,
      temperature: 0.2,
    });

    try {
      // Strip potential markdown fences before parsing
      const clean = aiResponse.content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      const parsed = JSON.parse(clean);
      res.json(parsed);
    } catch {
      res.json({ raw: aiResponse.content, error: 'Could not parse structured response' });
    }
  }),
);

export default router;
