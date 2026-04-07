import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import { z } from 'zod';
import { db } from '../db';
import { patients, digitizationHistory } from '../../shared/schema';
import { extractTextFromImage } from '../services/ocr';
import xlsx from 'xlsx';
import { eq, and, or, like, sql } from 'drizzle-orm';
import AdmZip from 'adm-zip';
import { authCheck, asyncHandler } from '../middleware/auth';
import { storageService } from '../services/storage.service';

import { logger } from '../logger';
const router = Router();

// Directories - use system temp dir for temp files (works in Docker containers)
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'digitization');
const PROCESSED_DIR = path.join(process.cwd(), 'processed', 'digitization');
const TEMP_DIR = path.join(os.tmpdir(), 'dental-digitization');

// Ensure directories exist
(async () => {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.mkdir(PROCESSED_DIR, { recursive: true });
  await fs.mkdir(TEMP_DIR, { recursive: true });
})();

// Configure multer for file uploads (images and ZIP files)
const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|tiff|webp|zip/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas imagens (JPG, PNG, TIFF) ou arquivos ZIP são permitidos'));
    }
  },
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB for ZIP files
  },
});

// LGPD: Prefer local Ollama, fallback to DeepSeek/OpenAI
function getOllamaConfig() {
  return {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_EXTRACTION_MODEL || process.env.OLLAMA_MODEL || 'llama3.1:8b',
  };
}

async function isOllamaAvailable(): Promise<boolean> {
  try {
    const { baseUrl } = getOllamaConfig();
    const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch { return false; }
}

// Extract ZIP file and return image paths
async function extractZipFile(zipPath: string): Promise<string[]> {
  const extractDir = path.join(TEMP_DIR, `extract-${Date.now()}`);
  await fs.mkdir(extractDir, { recursive: true });

  const zip = new AdmZip(zipPath);

  // Security: Validate all entries before extraction (prevent Zip Slip CWE-22)
  for (const entry of zip.getEntries()) {
    const entryPath = path.resolve(extractDir, entry.entryName);
    if (!entryPath.startsWith(extractDir + path.sep) && entryPath !== extractDir) {
      throw new Error(`Zip Slip detected: ${entry.entryName}`);
    }
  }

  zip.extractAllTo(extractDir, true);

  // Find all image files in extracted directory
  const imageFiles: string[] = [];
  const findImages = async (dir: string) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await findImages(fullPath);
      } else if (/\.(jpg|jpeg|png|tiff|webp)$/i.test(entry.name)) {
        imageFiles.push(fullPath);
      }
    }
  };

  await findImages(extractDir);
  return imageFiles;
}

/**
 * Process text with LLM: Ollama local → DeepSeek → OpenAI (fallback chain)
 * LGPD: Sempre tenta local primeiro para manter dados no servidor.
 */
async function processTextWithLocalLLM(text: string): Promise<any> {
  const systemPrompt = `Você é um assistente especializado em extrair dados de prontuários odontológicos.
Extraia as seguintes informações do texto fornecido:
- Nome completo do paciente
- Telefone(s) de contato
- Email
- CPF
- Data de nascimento (formato: DD/MM/AAAA)
- Endereço completo

Retorne os dados no formato JSON:
{
  "name": "Nome do Paciente",
  "phone": "telefone",
  "email": "email@example.com",
  "cpf": "123.456.789-00",
  "dateOfBirth": "DD/MM/AAAA",
  "address": "endereço completo"
}

Se algum campo não for encontrado, use null. Seja preciso e extraia apenas informações que estejam claramente presentes no texto.`;

  let content: string | null = null;

  // 1. Try Ollama local
  if (await isOllamaAvailable()) {
    try {
      const { baseUrl, model } = getOllamaConfig();
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Texto extraído:\n\n${text}` },
          ],
          stream: false,
          format: 'json',
          options: { temperature: 0.1, num_predict: 2000, num_gpu: 99 },
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (response.ok) {
        const data = await response.json();
        content = data.message?.content || null;
      }
    } catch {
      // Fall through to external
    }
  }

  // 2. Fallback: DeepSeek or OpenAI
  if (!content) {
    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('Nenhum provider de IA disponível (Ollama offline, sem API key)');

    const baseUrl = process.env.DEEPSEEK_API_KEY ? 'https://api.deepseek.com/v1' : 'https://api.openai.com/v1';
    const model = process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini';

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Texto extraído:\n\n${text}` },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`External API error: ${response.status}`);
    const data = await response.json();
    content = data.choices?.[0]?.message?.content || null;
  }

  if (!content) throw new Error('Nenhum provider retornou resposta');

  let jsonStr = content.trim();
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) jsonStr = jsonMatch[0];
  return JSON.parse(jsonStr);
}

// Check for duplicate patients using smart matching
async function findDuplicates(patientData: any, companyId: number): Promise<any[]> {
  const conditions: any[] = [];

  // Match by CPF (exact match - high priority)
  if (patientData.cpf) {
    const [cpfMatch] = await db
      .select()
      .from(patients)
      .where(
        and(
          eq(patients.companyId, companyId),
          eq(patients.cpf, patientData.cpf)
        )
      )
      .limit(5);

    if (cpfMatch) {
      return [{
        existingPatientId: cpfMatch.id,
        existingPatientName: cpfMatch.fullName,
        matchScore: 1.0,
        matchReasons: ['CPF idêntico'],
      }];
    }
  }

  // Match by name similarity and date of birth
  const nameWords = patientData.name?.toLowerCase().split(' ').filter((w: string) => w.length > 2) || [];
  if (nameWords.length > 0) {
    const nameConditions = nameWords.map((word: string) =>
      like(sql`LOWER(${patients.fullName})`, `%${word}%`)
    );

    const similarPatients = await db
      .select()
      .from(patients)
      .where(
        and(
          eq(patients.companyId, companyId),
          or(...nameConditions)
        )
      )
      .limit(10);

    type PatientRow = typeof similarPatients[0];
    const matches = similarPatients
      .map((existingPatient: PatientRow) => {
        const reasons: string[] = [];
        let score = 0;

        // Name similarity
        const existingNameWords = existingPatient.fullName.toLowerCase().split(' ');
        const commonWords = nameWords.filter((w: string) => existingNameWords.includes(w));
        const nameSimilarity = commonWords.length / Math.max(nameWords.length, existingNameWords.length);

        if (nameSimilarity > 0.5) {
          score += nameSimilarity * 0.5;
          reasons.push(`Nome ${Math.round(nameSimilarity * 100)}% similar`);
        }

        // Date of birth match
        if (patientData.dateOfBirth && existingPatient.birthDate) {
          const newDate = new Date(patientData.dateOfBirth);
          const existingDate = new Date(existingPatient.birthDate);
          if (newDate.getTime() === existingDate.getTime()) {
            score += 0.4;
            reasons.push('Data de nascimento idêntica');
          }
        }

        // Phone match
        if (patientData.phone && existingPatient.phone) {
          const cleanNew = patientData.phone.replace(/\D/g, '');
          const cleanExisting = existingPatient.phone.replace(/\D/g, '');
          if (cleanNew === cleanExisting) {
            score += 0.3;
            reasons.push('Telefone idêntico');
          }
        }

        return {
          existingPatientId: existingPatient.id,
          existingPatientName: existingPatient.fullName,
          matchScore: score,
          matchReasons: reasons,
        };
      })
      .filter((match: { matchScore: number }) => match.matchScore > 0.4) // Only return matches with >40% similarity
      .sort((a: { matchScore: number }, b: { matchScore: number }) => b.matchScore - a.matchScore);

    return matches;
  }

  return [];
}

// Clean up temporary files
async function cleanupTempFiles(filePaths: string[]) {
  for (const filePath of filePaths) {
    try {
      // Check if it's a directory or file
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) {
        await fs.rm(filePath, { recursive: true, force: true });
      } else {
        await fs.unlink(filePath);
      }
    } catch (error) {
      logger.error({ err: error, filePath: filePath }, 'Error deleting file')
    }
  }
}

// Calculate directory size
async function getDirectorySize(dirPath: string): Promise<number> {
  let size = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        size += await getDirectorySize(fullPath);
      } else {
        const stats = await fs.stat(fullPath);
        size += stats.size;
      }
    }
  } catch (error) {
    logger.error({ err: error }, 'Error calculating directory size:');
  }
  return size;
}

// Export data to different formats - returns S3 key or local path
async function exportData(patientsData: any[], format: string, companyId?: number): Promise<{ key: string; isS3: boolean }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `patients-export-${timestamp}`;

  let buffer: Buffer;
  let finalFilename: string;

  switch (format) {
    case 'xlsx': {
      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.json_to_sheet(patientsData);
      xlsx.utils.book_append_sheet(wb, ws, 'Patients');
      buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
      finalFilename = `${filename}.xlsx`;
      break;
    }

    case 'csv': {
      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.json_to_sheet(patientsData);
      xlsx.utils.book_append_sheet(wb, ws, 'Patients');
      buffer = xlsx.write(wb, { type: 'buffer', bookType: 'csv' });
      finalFilename = `${filename}.csv`;
      break;
    }

    case 'json': {
      buffer = Buffer.from(JSON.stringify(patientsData, null, 2));
      finalFilename = `${filename}.json`;
      break;
    }

    default:
      throw new Error(`Unsupported export format: ${format}`);
  }

  // Upload to S3/MinIO if available
  if (storageService.isCloudStorageAvailable()) {
    const result = await storageService.upload(buffer, finalFilename, 'documents', companyId);
    return { key: result.key, isS3: true };
  }

  // Local fallback
  const filepath = path.join(PROCESSED_DIR, finalFilename);
  await fs.writeFile(filepath, buffer);
  return { key: filepath, isS3: false };
}

// POST /api/v1/patients/digitization - Process images/ZIP and extract patient data
router.post('/', authCheck, upload.array('files', 1000), asyncHandler(async (req, res) => {
  const uploadedFiles = req.files as Express.Multer.File[];
  const tempFilesToCleanup: string[] = [];

  try {
    const { outputFormat } = req.body;
    const user = req.user!;
    const userId = user.id;
    const companyId = user.companyId;

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    if (!companyId || !userId) {
      return res.status(400).json({ error: 'Company ID e User ID são obrigatórios' });
    }

    const imageFilePaths: string[] = [];

    // Process each uploaded file (could be images or ZIP)
    for (const file of uploadedFiles) {
      if (file.originalname.toLowerCase().endsWith('.zip')) {
        // Extract ZIP and get all image files
        const extractedImages = await extractZipFile(file.path);
        imageFilePaths.push(...extractedImages);
        tempFilesToCleanup.push(file.path); // Mark ZIP for cleanup

        // Mark extracted directory for cleanup
        const extractDir = path.dirname(extractedImages[0]);
        tempFilesToCleanup.push(extractDir);
      } else {
        // Regular image file
        imageFilePaths.push(file.path);
        tempFilesToCleanup.push(file.path);
      }
    }

    logger.info({ imageCount: imageFilePaths.length }, 'Processing image files')

    const extractedPatients: any[] = [];
    const errors: { file: string; error: string; type: string }[] = [];
    let successCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;
    let processedCount = 0;

    // Process each image
    for (const imagePath of imageFilePaths) {
      processedCount++;

      // Log progress every 10 images
      if (processedCount % 10 === 0 || processedCount === imageFilePaths.length) {
        logger.info({ processedCount, total: imageFilePaths.length, percent: Math.round(processedCount/imageFilePaths.length*100) }, 'Digitization progress')
      }
      try {
        // Extract text using OCR
        const ocrResult = await extractTextFromImage(imagePath);

        if (!ocrResult || !ocrResult.text) {
          const fileName = path.basename(imagePath);
          errors.push({
            file: fileName,
            error: 'Nenhum texto foi detectado na imagem',
            type: 'OCR_NO_TEXT'
          });
          errorCount++;
          extractedPatients.push({
            name: fileName,
            status: 'error',
            error: 'Nenhum texto detectado',
            sourceFile: fileName,
          });
          continue;
        }

        // Process with DeepSeek AI
        const patientData = await processTextWithLocalLLM(ocrResult.text);

        if (!patientData.name) {
          const fileName = path.basename(imagePath);
          errors.push({
            file: fileName,
            error: 'Nome do paciente não foi identificado no texto extraído',
            type: 'AI_NO_NAME'
          });
          errorCount++;
          extractedPatients.push({
            name: fileName,
            status: 'error',
            error: 'Nome não identificado',
            sourceFile: fileName,
          });
          continue;
        }

        // Check for duplicates if saving to database
        let isDuplicate = false;
        let duplicateMatches: any[] = [];

        if (outputFormat === 'database') {
          duplicateMatches = await findDuplicates(patientData, companyId);
          isDuplicate = duplicateMatches.length > 0;
          if (isDuplicate) {
            duplicateCount++;
          }
        }

        extractedPatients.push({
          ...patientData,
          status: isDuplicate ? 'duplicate' : 'success',
          isDuplicate,
          duplicateMatches: isDuplicate ? duplicateMatches : undefined,
          sourceFile: path.basename(imagePath),
        });

        if (!isDuplicate) {
          successCount++;
        }
      } catch (error: any) {
        const fileName = path.basename(imagePath);
        logger.error({ err: error, fileName }, 'Error processing file')

        // Categorize error type
        let errorType = 'UNKNOWN';
        if (error.message.includes('OCR') || error.message.includes('Vision')) {
          errorType = 'OCR_FAILED';
        } else if (error.message.includes('DeepSeek') || error.message.includes('API')) {
          errorType = 'AI_FAILED';
        } else if (error.message.includes('timeout')) {
          errorType = 'TIMEOUT';
        }

        errors.push({
          file: fileName,
          error: error.message,
          type: errorType
        });
        errorCount++;
        extractedPatients.push({
          name: fileName,
          status: 'error',
          error: error.message,
          errorType,
          sourceFile: fileName,
        });
      }
    }

    // Save to database or export to file
    let downloadUrl: string | null = null;

    if (outputFormat === 'database') {
      // Save non-duplicate patients to database
      for (const patient of extractedPatients) {
        if (patient.status === 'success' && !patient.isDuplicate) {
          try {
            await db.insert(patients).values({
              companyId: companyId,
              fullName: patient.name,
              phone: patient.phone || null,
              email: patient.email || null,
              cpf: patient.cpf || null,
              birthDate: patient.dateOfBirth ? new Date(patient.dateOfBirth.split('/').reverse().join('-')) : null,
              address: patient.address || null,
              notes: `Importado via digitalização - Arquivo: ${patient.sourceFile}`,
            });
          } catch (dbError) {
            logger.error({ err: dbError }, 'Error saving patient to database:');
            patient.status = 'error';
            patient.error = 'Erro ao salvar no banco de dados';
          }
        }
      }
    } else {
      // Export to file (S3 or local)
      const exportResult = await exportData(
        extractedPatients.map(p => ({
          Nome: p.name,
          Telefone: p.phone || '',
          Email: p.email || '',
          CPF: p.cpf || '',
          'Data de Nascimento': p.dateOfBirth || '',
          Endereço: p.address || '',
          Status: p.status,
        })),
        outputFormat,
        companyId
      );
      // Store the key (S3 key or local path) for later retrieval
      downloadUrl = exportResult.isS3
        ? `s3://${exportResult.key}`
        : `/downloads/digitization/${path.basename(exportResult.key)}`;
    }

    // Save history with patient data for reprocessing
    const totalSize = await getDirectorySize(UPLOAD_DIR);
    const [historyRecord] = await db.insert(digitizationHistory).values({
      companyId: companyId,
      userId: userId,
      totalFiles: imageFilePaths.length,
      successCount,
      errorCount,
      duplicateCount,
      outputFormat,
      downloadUrl,
      uploadedFilesPath: UPLOAD_DIR,
      processedFilesSize: totalSize,
      metadata: {
        errors: errors.length > 0 ? errors : undefined,
        patients: extractedPatients // Save patient data for reprocessing
      },
    }).returning();

    // Clean up temporary files
    await cleanupTempFiles(tempFilesToCleanup);

    res.json({
      success: true,
      patients: extractedPatients,
      errors: errors.length > 0 ? errors : undefined,
      totalProcessed: imageFilePaths.length,
      successCount,
      errorCount,
      duplicateCount,
      downloadUrl,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error in digitization endpoint:');

    // Attempt cleanup even on error
    await cleanupTempFiles(tempFilesToCleanup);

    res.status(500).json({
      error: 'Erro ao processar arquivos',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

// GET /api/v1/patients/digitization/history - Get digitization history
router.get('/history', authCheck, asyncHandler(async (req, res) => {
  const user = req.user!;
  const companyId = user.companyId;

  if (!companyId) {
    return res.status(403).json({ error: 'User not associated with any company' });
  }

  const history = await db
    .select()
    .from(digitizationHistory)
    .where(eq(digitizationHistory.companyId, companyId))
    .orderBy(sql`${digitizationHistory.processedAt} DESC`)
    .limit(50);

  res.json(history);
}));

// GET /api/v1/patients/digitization/storage - Get storage information
router.get('/storage', authCheck, asyncHandler(async (req, res) => {
  const totalSize = await getDirectorySize(UPLOAD_DIR);

  res.json({
    path: UPLOAD_DIR,
    size: totalSize,
  });
}));

// GET /api/v1/patients/digitization/history/:id/download - Download history file
router.get('/history/:id/download', authCheck, asyncHandler(async (req, res) => {
  const historyId = parseInt(req.params.id);
  const user = req.user!;
  const companyId = user.companyId;

  if (!companyId) {
    return res.status(403).json({ error: 'User not associated with any company' });
  }

  const [historyRecord] = await db
    .select()
    .from(digitizationHistory)
    .where(
      and(
        eq(digitizationHistory.id, historyId),
        eq(digitizationHistory.companyId, companyId)
      )
    );

  if (!historyRecord || !historyRecord.downloadUrl) {
    return res.status(404).json({ error: 'Arquivo não encontrado' });
  }

  // Check if file is stored in S3
  if (historyRecord.downloadUrl.startsWith('s3://')) {
    const s3Key = historyRecord.downloadUrl.replace('s3://', '');
    try {
      // Generate presigned URL for direct download
      const presignedUrl = await storageService.getPresignedUrl(s3Key, 3600); // 1 hour
      return res.redirect(presignedUrl);
    } catch (error) {
      logger.error({ err: error }, 'Error generating presigned URL:');
      return res.status(500).json({ error: 'Erro ao gerar link de download' });
    }
  }

  // Local file fallback
  const filePath = path.join(process.cwd(), historyRecord.downloadUrl);

  if (!fsSync.existsSync(filePath)) {
    return res.status(404).json({ error: 'Arquivo não existe' });
  }

  res.download(filePath);
}));

// POST /api/v1/patients/digitization/history/:id/reprocess - Reprocess history data
router.post('/history/:id/reprocess', authCheck, asyncHandler(async (req, res) => {
  const historyId = parseInt(req.params.id);
  const { action, format } = req.body; // action: 'database' or 'export', format: 'xlsx', 'csv', 'json'
  const user = req.user!;
  const companyId = user.companyId;

  logger.info({ data: { historyId, action, format, companyId } }, 'Reprocessing history:')

  if (!companyId) {
    return res.status(403).json({ error: 'User not associated with any company' });
  }

  const [historyRecord] = await db
    .select()
    .from(digitizationHistory)
    .where(
      and(
        eq(digitizationHistory.id, historyId),
        eq(digitizationHistory.companyId, companyId)
      )
    );

  logger.info({
    hasRecord: !!historyRecord,
    hasMetadata: !!historyRecord?.metadata,
    hasPatients: !!historyRecord?.metadata?.patients,
    patientsCount: historyRecord?.metadata?.patients?.length
  }, 'History record found');

  if (!historyRecord) {
    return res.status(404).json({ error: 'Registro de histórico não encontrado' });
  }

  if (!historyRecord.metadata?.patients) {
    return res.status(404).json({
      error: 'Dados dos pacientes não encontrados no histórico',
      hint: 'Este registro foi processado com uma versão antiga do sistema. Processe novamente as imagens.'
    });
  }

  const extractedPatients = historyRecord.metadata.patients as any[];
  let successCount = 0;
  let errorCount = 0;

  if (action === 'database') {
    // Add patients to database (excluding duplicates and checking for existing records)
    logger.info({ patientCount: extractedPatients.length }, 'Saving patients to database')

    for (const patient of extractedPatients) {
      logger.info({ patientName: patient.name, status: patient.status, isDuplicate: patient.isDuplicate }, 'Processing patient')

      if (patient.status === 'success') {
        try {
          // Check if patient already exists in database
          const duplicateMatches = await findDuplicates(patient, companyId);

          if (duplicateMatches.length > 0) {
            logger.info({ patientName: patient.name, matchCount: duplicateMatches.length }, 'Patient already exists in database')
            errorCount++;
            continue;
          }

          const patientData = {
            companyId: companyId,
            fullName: patient.name,
            phone: patient.phone || null,
            email: patient.email || null,
            cpf: patient.cpf || null,
            birthDate: patient.dateOfBirth ? new Date(patient.dateOfBirth.split('/').reverse().join('-')) : null,
            address: patient.address || null,
            notes: `Importado via digitalização (histórico ID: ${historyId}) - Arquivo: ${patient.sourceFile || 'reprocessado'}`,
          };

          logger.info({ data: patientData }, 'Inserting:')
          await db.insert(patients).values(patientData);
          successCount++;
        } catch (dbError: any) {
          logger.error({ err: dbError, patientName: patient.name }, 'Error saving patient')
          errorCount++;
        }
      } else {
        logger.info({ patient_status: patient.status }, '⏭ Skipping (status: {patient_status})')
      }
    }

    logger.info({ successCount: successCount, errorCount: errorCount }, 'Database save complete: {successCount} saved, {errorCount} skipped (duplicates or errors)')


    return res.json({
      success: true,
      message: `${successCount} paciente(s) adicionado(s) ao banco de dados`,
      successCount,
      errorCount
    });
  } else if (action === 'export') {
    // Export to specified format (S3 or local)
    const exportResult = await exportData(
      extractedPatients.map(p => ({
        Nome: p.name,
        Telefone: p.phone || '',
        Email: p.email || '',
        CPF: p.cpf || '',
        'Data de Nascimento': p.dateOfBirth || '',
        Endereço: p.address || '',
        Status: p.status,
      })),
      format || 'xlsx',
      companyId
    );

    const downloadUrl = exportResult.isS3
      ? `s3://${exportResult.key}`
      : `/downloads/digitization/${path.basename(exportResult.key)}`;

    return res.json({
      success: true,
      message: `Dados exportados em ${format}`,
      downloadUrl,
      isS3: exportResult.isS3
    });
  } else {
    return res.status(400).json({ error: 'Ação inválida. Use "database" ou "export"' });
  }
}));

// POST /api/v1/patients/digitization/resolve - Resolve duplicate patient
router.post('/resolve', authCheck, asyncHandler(async (req, res) => {
  const { patient, decision, existingPatientId } = req.body;
  const user = req.user!;
  const companyId = user.companyId;

  if (!patient || !decision) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  if (!companyId) {
    return res.status(403).json({ error: 'User not associated with any company' });
  }

  if (decision === 'skip') {
    return res.json({ success: true, message: 'Paciente ignorado' });
  }

  if (decision === 'merge' && existingPatientId) {
    // Update existing patient with new data
    await db
      .update(patients)
      .set({
        phone: patient.phone || sql`${patients.phone}`,
        email: patient.email || sql`${patients.email}`,
        address: patient.address || sql`${patients.address}`,
        notes: sql`CONCAT(COALESCE(${patients.notes}, ''), '\n', 'Atualizado via digitalização')`,
      })
      .where(eq(patients.id, existingPatientId));

    return res.json({ success: true, message: 'Paciente atualizado' });
  }

  if (decision === 'new') {
    // Create new patient
    const [newPatient] = await db.insert(patients).values({
      companyId: companyId,
      fullName: patient.name,
      phone: patient.phone || null,
      email: patient.email || null,
      cpf: patient.cpf || null,
      birthDate: patient.dateOfBirth ? new Date(patient.dateOfBirth.split('/').reverse().join('-')) : null,
      address: patient.address || null,
      notes: 'Importado via digitalização (duplicata resolvida)',
    }).returning();

    return res.json({ success: true, patient: newPatient });
  }

  res.status(400).json({ error: 'Decisão inválida' });
}));

export default router;
