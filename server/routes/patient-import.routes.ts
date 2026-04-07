import express, { type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authCheck } from '../middleware/auth';
import {
  importPatientsFromImages,
  importPatientsFromXLSX,
  previewImport,
  type MergeOptions,
} from '../services/patientImport';
import { extractTextFromImage } from '../services/ocr';
import { extractPatientData } from '../services/aiExtraction';

import { logger } from '../logger';
const router = express.Router();

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'patient-import');

    // Cria diretório se não existir
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB max por arquivo
  },
  fileFilter: (req, file, cb) => {
    // Aceita imagens e XLSX
    const allowedMimes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/tiff',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não suportado'));
    }
  },
});

/**
 * POST /api/patients/import/images
 * Importa pacientes de imagens (fichas físicas)
 */
router.post(
  '/import/images',
  authCheck,
  upload.array('images', 50), // Máximo 50 imagens
  async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'Nenhuma imagem fornecida' });
      }

      // Pega companyId do usuário autenticado
      const companyId = (req.user!)?.companyId;
      if (!companyId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      // Opções de merge do body
      const mergeOptions: MergeOptions = {
        prioritizeExisting: req.body.prioritizeExisting !== 'false',
        overwriteEmpty: req.body.overwriteEmpty !== 'false',
        skipDuplicates: req.body.skipDuplicates === 'true',
      };

      logger.info({ fileCount: files.length }, 'Starting image import')

      // Lê os arquivos em buffers
      const imageBuffers = files.map((file) => fs.readFileSync(file.path));

      // Processa importação
      const result = await importPatientsFromImages(
        imageBuffers,
        companyId,
        mergeOptions
      );

      // Remove arquivos temporários
      files.forEach((file) => {
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          logger.error({ err: err }, 'Erro ao remover arquivo temporário:');
        }
      });

      res.json({
        message: 'Importação concluída',
        result,
      });
    } catch (error) {
      logger.error({ err: error }, 'Erro na importação de imagens:');
      res.status(500).json({
        error: 'Erro ao processar importação',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  }
);

/**
 * POST /api/patients/import/xlsx
 * Importa pacientes de arquivo XLSX
 */
router.post(
  '/import/xlsx',
  authCheck,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'Nenhum arquivo fornecido' });
      }

      // Pega companyId do usuário autenticado
      const companyId = (req.user!)?.companyId;
      if (!companyId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      // Opções de merge do body
      const mergeOptions: MergeOptions = {
        prioritizeExisting: req.body.prioritizeExisting !== 'false',
        overwriteEmpty: req.body.overwriteEmpty !== 'false',
        skipDuplicates: req.body.skipDuplicates === 'true',
      };

      logger.info({ filename: file.originalname }, 'Starting XLSX import')

      // Processa importação
      const result = await importPatientsFromXLSX(
        file.path,
        companyId,
        mergeOptions
      );

      // Remove arquivo temporário
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        logger.error({ err: err }, 'Erro ao remover arquivo temporário:');
      }

      res.json({
        message: 'Importação concluída',
        result,
      });
    } catch (error) {
      logger.error({ err: error }, 'Erro na importação de XLSX:');
      res.status(500).json({
        error: 'Erro ao processar importação',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  }
);

/**
 * POST /api/patients/import/preview
 * Gera preview da importação sem salvar no banco
 */
router.post(
  '/import/preview',
  authCheck,
  upload.array('files', 50),
  async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'Nenhum arquivo fornecido' });
      }

      const companyId = (req.user!)?.companyId;
      if (!companyId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      logger.info({ fileCount: files.length }, 'Generating file preview')

      const extractedData: any[] = [];

      // Processa cada arquivo
      for (const file of files) {
        try {
          if (file.mimetype.startsWith('image/')) {
            // Processa imagem
            const buffer = fs.readFileSync(file.path);
            const ocrResult = await extractTextFromImage(buffer);
            const data = await extractPatientData(ocrResult.text);
            extractedData.push({
              ...data,
              companyId,
              source: 'image',
              filename: file.originalname,
              confidence: ocrResult.confidence,
            });
          } else if (
            file.mimetype.includes('spreadsheet') ||
            file.mimetype.includes('excel')
          ) {
            // Process XLSX: read rows and extract patient data for preview
            const XLSX = await import('xlsx');
            const workbook = XLSX.read(fs.readFileSync(file.path));
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

            for (const row of rows) {
              extractedData.push({
                name: row.nome || row.name || row.Nome || row.Name || '',
                email: row.email || row.Email || '',
                phone: row.telefone || row.phone || row.Telefone || row.Phone || row.celular || row.Celular || '',
                cpf: row.cpf || row.CPF || '',
                birthDate: row.nascimento || row.birthDate || row.data_nascimento || row['Data de Nascimento'] || '',
                address: row.endereco || row.address || row.Endereco || '',
                source: 'xlsx',
                filename: file.originalname,
              });
            }
          }
        } catch (error) {
          logger.error({ err: error, filename: file.originalname }, 'Error processing file')
        }

        // Remove arquivo temporário
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          logger.error({ err: err }, 'Erro ao remover arquivo temporário:');
        }
      }

      // Gera preview
      const preview = await previewImport(extractedData, companyId);

      res.json({
        message: 'Preview gerado',
        preview,
        extractedData,
      });
    } catch (error) {
      logger.error({ err: error }, 'Erro ao gerar preview:');
      res.status(500).json({
        error: 'Erro ao gerar preview',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  }
);

/**
 * POST /api/patients/import/test-ocr
 * Endpoint de teste para OCR de uma única imagem
 */
router.post(
  '/import/test-ocr',
  authCheck,
  upload.single('image'),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'Nenhuma imagem fornecida' });
      }

      logger.info({ filename: file.originalname }, 'Testing OCR')

      const buffer = fs.readFileSync(file.path);
      const ocrResult = await extractTextFromImage(buffer);
      const extractedData = await extractPatientData(ocrResult.text);

      // Remove arquivo temporário
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        logger.error({ err: err }, 'Erro ao remover arquivo temporário:');
      }

      res.json({
        message: 'OCR processado',
        ocr: {
          text: ocrResult.text,
          confidence: ocrResult.confidence,
        },
        extractedData,
      });
    } catch (error) {
      logger.error({ err: error }, 'Erro no teste de OCR:');
      res.status(500).json({
        error: 'Erro ao processar OCR',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  }
);

export default router;
