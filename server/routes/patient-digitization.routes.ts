import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { z } from 'zod';
import { db } from '../db';
import { patients } from '../../shared/schema';
import vision from '@google-cloud/vision';
import OpenAI from 'openai';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads', 'digitization');
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|tiff|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Initialize Google Cloud Vision client (if credentials available)
let visionClient: vision.ImageAnnotatorClient | null = null;
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    visionClient = new vision.ImageAnnotatorClient();
  }
} catch (error) {
  console.warn('Google Cloud Vision not configured. OCR will be limited.');
}

// Initialize DeepSeek client
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

// Extract text from image using Google Cloud Vision
async function extractTextFromImage(imagePath: string): Promise<string> {
  if (!visionClient) {
    throw new Error('Google Cloud Vision not configured');
  }

  const [result] = await visionClient.textDetection(imagePath);
  const detections = result.textAnnotations;
  return detections && detections[0] ? detections[0].description || '' : '';
}

// Process text with DeepSeek
async function processTextWithDeepSeek(
  text: string,
  model: string,
  customPrompt?: string
): Promise<any> {
  const systemPrompt = `Você é um assistente especializado em extrair dados de prontuários odontológicos.
Extraia as seguintes informações do texto fornecido:
- Nome completo do paciente
- Telefone(s) de contato
- Email
- CPF
- Data de nascimento
- Endereço completo

${customPrompt ? `Instruções adicionais: ${customPrompt}` : ''}

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

  const response = await deepseek.chat.completions.create({
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Texto extraído:\n\n${text}` },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from DeepSeek');
  }

  return JSON.parse(content);
}

// POST /api/patients/digitize - Process images and extract patient data
router.post('/digitize', upload.array('files', 50), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    const { customPrompt, aiModel, outputFormat, companyId } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      return res.status(500).json({ error: 'DeepSeek API key not configured' });
    }

    const extractedPatients: any[] = [];
    const errors: string[] = [];

    // Process each image
    for (const file of files) {
      try {
        // Extract text using OCR
        let extractedText = '';
        if (visionClient) {
          extractedText = await extractTextFromImage(file.path);
        } else {
          // Fallback: use a simple text extraction or skip
          throw new Error('OCR not available');
        }

        if (!extractedText) {
          errors.push(`Nenhum texto encontrado em ${file.originalname}`);
          continue;
        }

        // Process with DeepSeek
        const patientData = await processTextWithDeepSeek(
          extractedText,
          aiModel || 'deepseek-chat',
          customPrompt
        );

        if (!patientData.name) {
          errors.push(`Nome do paciente não encontrado em ${file.originalname}`);
          continue;
        }

        extractedPatients.push({
          ...patientData,
          status: 'success',
          sourceFile: file.originalname,
        });

        // Clean up uploaded file
        await fs.unlink(file.path);
      } catch (error) {
        console.error(`Error processing ${file.originalname}:`, error);
        errors.push(`Erro ao processar ${file.originalname}: ${error.message}`);
        extractedPatients.push({
          name: file.originalname,
          status: 'error',
          error: error.message,
        });
      }
    }

    // If output format is database, save to database
    if (outputFormat === 'database' && companyId) {
      const savedPatients = [];
      for (const patient of extractedPatients) {
        if (patient.status === 'success') {
          try {
            const [newPatient] = await db.insert(patients).values({
              companyId: parseInt(companyId),
              name: patient.name,
              phone: patient.phone || null,
              email: patient.email || null,
              cpf: patient.cpf || null,
              dateOfBirth: patient.dateOfBirth ? new Date(patient.dateOfBirth) : null,
              address: patient.address || null,
              notes: `Importado via digitalização de prontuário - Arquivo: ${patient.sourceFile}`,
            }).returning();
            savedPatients.push(newPatient);
          } catch (dbError) {
            console.error('Error saving patient to database:', dbError);
            patient.status = 'error';
            patient.error = 'Erro ao salvar no banco de dados';
          }
        }
      }
    }

    res.json({
      success: true,
      patients: extractedPatients,
      errors: errors.length > 0 ? errors : undefined,
      totalProcessed: files.length,
      successCount: extractedPatients.filter(p => p.status === 'success').length,
      errorCount: extractedPatients.filter(p => p.status === 'error').length,
    });
  } catch (error) {
    console.error('Error in digitization endpoint:', error);
    res.status(500).json({
      error: 'Erro ao processar imagens',
      details: error.message,
    });
  }
});

export default router;
