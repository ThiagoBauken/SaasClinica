import express, { type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  importPatientsFromImages,
  importPatientsFromXLSX,
  previewImport,
  type MergeOptions,
} from '../services/patientImport';
import { extractTextFromImage } from '../services/ocr';
import { extractPatientData } from '../services/aiExtraction';

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
  upload.array('images', 50), // Máximo 50 imagens
  async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'Nenhuma imagem fornecida' });
      }

      // Pega companyId do usuário autenticado
      const companyId = (req.user as any)?.companyId;
      if (!companyId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      // Opções de merge do body
      const mergeOptions: MergeOptions = {
        prioritizeExisting: req.body.prioritizeExisting !== 'false',
        overwriteEmpty: req.body.overwriteEmpty !== 'false',
        skipDuplicates: req.body.skipDuplicates === 'true',
      };

      console.log(`Iniciando importação de ${files.length} imagens...`);

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
          console.error('Erro ao remover arquivo temporário:', err);
        }
      });

      res.json({
        message: 'Importação concluída',
        result,
      });
    } catch (error) {
      console.error('Erro na importação de imagens:', error);
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
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'Nenhum arquivo fornecido' });
      }

      // Pega companyId do usuário autenticado
      const companyId = (req.user as any)?.companyId;
      if (!companyId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      // Opções de merge do body
      const mergeOptions: MergeOptions = {
        prioritizeExisting: req.body.prioritizeExisting !== 'false',
        overwriteEmpty: req.body.overwriteEmpty !== 'false',
        skipDuplicates: req.body.skipDuplicates === 'true',
      };

      console.log(`Iniciando importação de XLSX: ${file.originalname}`);

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
        console.error('Erro ao remover arquivo temporário:', err);
      }

      res.json({
        message: 'Importação concluída',
        result,
      });
    } catch (error) {
      console.error('Erro na importação de XLSX:', error);
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
  upload.array('files', 50),
  async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'Nenhum arquivo fornecido' });
      }

      const companyId = (req.user as any)?.companyId;
      if (!companyId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      console.log(`Gerando preview de ${files.length} arquivos...`);

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
            // Processa XLSX (implementação simplificada)
            // TODO: Implementar preview para XLSX
            extractedData.push({
              source: 'xlsx',
              filename: file.originalname,
            });
          }
        } catch (error) {
          console.error(`Erro ao processar ${file.originalname}:`, error);
        }

        // Remove arquivo temporário
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          console.error('Erro ao remover arquivo temporário:', err);
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
      console.error('Erro ao gerar preview:', error);
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
  upload.single('image'),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'Nenhuma imagem fornecida' });
      }

      console.log(`Testando OCR em: ${file.originalname}`);

      const buffer = fs.readFileSync(file.path);
      const ocrResult = await extractTextFromImage(buffer);
      const extractedData = await extractPatientData(ocrResult.text);

      // Remove arquivo temporário
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        console.error('Erro ao remover arquivo temporário:', err);
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
      console.error('Erro no teste de OCR:', error);
      res.status(500).json({
        error: 'Erro ao processar OCR',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  }
);

export default router;
