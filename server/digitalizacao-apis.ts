import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import sharp from 'sharp';
import ExcelJS from 'exceljs';
import PDFKit from 'pdfkit';

// Configuração do Multer para upload
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'digitalizacao');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 20
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/tiff'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de arquivo não suportado'));
    }
  }
});

// Storage em memória para histórico (em produção, usar banco de dados)
const processingHistory = new Map<string, ProcessingRecord>();

interface ProcessingRecord {
  id: string;
  filename: string;
  originalFiles: string[];
  createdAt: string;
  recordCount: number;
  format: string;
  status: 'completed' | 'processing' | 'error';
  downloadUrl?: string;
  companyId: number;
  extractedData?: any[];
}

interface ExtractedPatientData {
  nomeCompleto: string;
  telefone: string;
  celular?: string;
  email?: string;
  cpf?: string;
  dataNascimento?: string;
  endereco?: string;
  historicoMedico?: string;
  procedimentosRealizados?: string;
  valores?: string;
  datasConsultas?: string;
  observacoes?: string;
}

// Middleware para upload
export const uploadMiddleware = upload.array('files', 20);

// Simular OCR (Google Vision API)
async function extractTextFromImage(imagePath: string): Promise<string> {
  // Em produção, usar Google Vision API
  // Por enquanto, retornar texto simulado para demonstração
  const filename = path.basename(imagePath).toLowerCase();
  
  if (filename.includes('ficha') || filename.includes('paciente')) {
    return `
      FICHA DO PACIENTE
      Nome: Maria Silva Santos
      Telefone: (11) 98765-4321
      Email: maria.silva@email.com
      CPF: 123.456.789-00
      Data Nascimento: 15/03/1985
      Endereço: Rua das Flores, 123 - Centro - São Paulo/SP
      
      HISTÓRICO MÉDICO:
      - Hipertensão controlada
      - Alergia à penicilina
      - Última consulta: 10/12/2024
      
      PROCEDIMENTOS REALIZADOS:
      - Limpeza dental (10/12/2024) - R$ 120,00
      - Restauração dente 16 (15/11/2024) - R$ 350,00
      - Clareamento dental (20/10/2024) - R$ 450,00
      
      PRÓXIMAS CONSULTAS:
      - Retorno em 15/01/2025
      
      OBSERVAÇÕES:
      Paciente colaborativa, boa higiene bucal
    `;
  }
  
  return 'Texto extraído da imagem via OCR';
}

// Simular processamento com IA (OpenAI GPT)
async function processWithAI(extractedText: string, aiModel: string, customPrompt: string): Promise<ExtractedPatientData> {
  // Em produção, usar OpenAI API
  // Por enquanto, retornar dados estruturados simulados
  
  const basePrompt = `
    Extraia as seguintes informações do texto da ficha odontológica:
    - Nome completo do paciente
    - Telefones (celular, fixo)
    - Email
    - CPF/documento
    - Data de nascimento
    - Endereço completo
    - Histórico médico/odontológico
    - Procedimentos realizados com datas e valores
    - Datas de consultas
    - Observações relevantes
    
    ${customPrompt ? `Instruções adicionais: ${customPrompt}` : ''}
    
    Texto da ficha:
    ${extractedText}
  `;

  // Simular resposta da IA
  return {
    nomeCompleto: 'Maria Silva Santos',
    telefone: '(11) 98765-4321',
    celular: '(11) 98765-4321',
    email: 'maria.silva@email.com',
    cpf: '123.456.789-00',
    dataNascimento: '15/03/1985',
    endereco: 'Rua das Flores, 123 - Centro - São Paulo/SP',
    historicoMedico: 'Hipertensão controlada, Alergia à penicilina',
    procedimentosRealizados: 'Limpeza dental, Restauração dente 16, Clareamento dental',
    valores: 'R$ 120,00, R$ 350,00, R$ 450,00',
    datasConsultas: '10/12/2024, 15/11/2024, 20/10/2024',
    observacoes: 'Paciente colaborativa, boa higiene bucal'
  };
}

// Gerar arquivo Excel
async function generateExcel(data: ExtractedPatientData[], filename: string): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Pacientes Digitalizados');

  // Cabeçalhos
  worksheet.columns = [
    { header: 'Nome Completo', key: 'nomeCompleto', width: 25 },
    { header: 'Telefone', key: 'telefone', width: 15 },
    { header: 'Celular', key: 'celular', width: 15 },
    { header: 'Email', key: 'email', width: 25 },
    { header: 'CPF', key: 'cpf', width: 15 },
    { header: 'Data Nascimento', key: 'dataNascimento', width: 15 },
    { header: 'Endereço', key: 'endereco', width: 40 },
    { header: 'Histórico Médico', key: 'historicoMedico', width: 30 },
    { header: 'Procedimentos', key: 'procedimentosRealizados', width: 30 },
    { header: 'Valores', key: 'valores', width: 20 },
    { header: 'Datas Consultas', key: 'datasConsultas', width: 20 },
    { header: 'Observações', key: 'observacoes', width: 30 }
  ];

  // Estilizar cabeçalho
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  // Adicionar dados
  data.forEach(patient => {
    worksheet.addRow(patient);
  });

  // Salvar arquivo
  const outputPath = path.join(process.cwd(), 'uploads', 'digitalizacao', 'processed', filename);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await workbook.xlsx.writeFile(outputPath);
  
  return outputPath;
}

// Gerar arquivo CSV
async function generateCSV(data: ExtractedPatientData[], filename: string): Promise<string> {
  const headers = [
    'Nome Completo', 'Telefone', 'Celular', 'Email', 'CPF', 
    'Data Nascimento', 'Endereço', 'Histórico Médico', 
    'Procedimentos', 'Valores', 'Datas Consultas', 'Observações'
  ];
  
  let csvContent = headers.join(',') + '\n';
  
  data.forEach(patient => {
    const row = [
      patient.nomeCompleto || '',
      patient.telefone || '',
      patient.celular || '',
      patient.email || '',
      patient.cpf || '',
      patient.dataNascimento || '',
      patient.endereco || '',
      patient.historicoMedico || '',
      patient.procedimentosRealizados || '',
      patient.valores || '',
      patient.datasConsultas || '',
      patient.observacoes || ''
    ].map(field => `"${field.replace(/"/g, '""')}"`);
    
    csvContent += row.join(',') + '\n';
  });

  const outputPath = path.join(process.cwd(), 'uploads', 'digitalizacao', 'processed', filename);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, csvContent, 'utf8');
  
  return outputPath;
}

// Gerar arquivo PDF
async function generatePDF(data: ExtractedPatientData[], filename: string): Promise<string> {
  const outputPath = path.join(process.cwd(), 'uploads', 'digitalizacao', 'processed', filename);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const doc = new PDFKit();
  doc.pipe(createWriteStream(outputPath));

  // Título
  doc.fontSize(16).font('Helvetica-Bold').text('Dados Extraídos - Digitalização de Fichas', { align: 'center' });
  doc.moveDown();

  // Dados de cada paciente
  data.forEach((patient, index) => {
    doc.fontSize(14).font('Helvetica-Bold').text(`Paciente ${index + 1}:`);
    doc.fontSize(10).font('Helvetica');
    
    Object.entries(patient).forEach(([key, value]) => {
      if (value) {
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        doc.text(`${label}: ${value}`);
      }
    });
    
    doc.moveDown();
  });

  doc.end();
  
  return outputPath;
}

// API: Processar arquivos
export async function processFiles(req: Request, res: Response) {
  try {
    const { aiModel, outputFormat, customPrompt } = req.body;
    const files = req.files as Express.Multer.File[];
    const companyId = (req.user as any)?.companyId;

    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'Nenhum arquivo enviado' });
    }

    const processId = Date.now().toString();
    const extractedData: ExtractedPatientData[] = [];

    // Criar registro de processamento
    const record: ProcessingRecord = {
      id: processId,
      filename: `digitalizacao-${processId}`,
      originalFiles: files.map(f => f.filename),
      createdAt: new Date().toISOString(),
      recordCount: 0,
      format: outputFormat,
      status: 'processing',
      companyId
    };

    processingHistory.set(processId, record);

    // Processar cada arquivo
    for (const file of files) {
      try {
        // OCR: Extrair texto da imagem
        const extractedText = await extractTextFromImage(file.path);
        
        // IA: Estruturar dados
        const structuredData = await processWithAI(extractedText, aiModel, customPrompt);
        extractedData.push(structuredData);

        // Cleanup: Remover arquivo original
        await fs.unlink(file.path);
      } catch (error) {
        console.error(`Erro ao processar arquivo ${file.filename}:`, error);
      }
    }

    // Gerar arquivo de saída
    let outputPath: string;
    const outputFilename = `digitalizacao-${processId}.${outputFormat}`;

    switch (outputFormat) {
      case 'xlsx':
        outputPath = await generateExcel(extractedData, outputFilename);
        break;
      case 'csv':
        outputPath = await generateCSV(extractedData, outputFilename);
        break;
      case 'pdf':
        outputPath = await generatePDF(extractedData, outputFilename);
        break;
      case 'json':
        outputPath = path.join(process.cwd(), 'uploads', 'digitalizacao', 'processed', outputFilename);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(extractedData, null, 2));
        break;
      default:
        outputPath = await generateExcel(extractedData, `digitalizacao-${processId}.xlsx`);
    }

    // Atualizar registro
    record.status = 'completed';
    record.recordCount = extractedData.length;
    record.downloadUrl = `/api/digitalizacao/download/${processId}`;
    record.extractedData = extractedData;
    processingHistory.set(processId, record);

    res.json({
      success: true,
      processId,
      recordCount: extractedData.length,
      downloadUrl: record.downloadUrl
    });

  } catch (error) {
    console.error('Erro no processamento:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

// API: Histórico de processamentos
export async function getHistory(req: Request, res: Response) {
  try {
    const companyId = (req.user as any)?.companyId;
    
    const userHistory = Array.from(processingHistory.values())
      .filter(record => record.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(userHistory.map(record => ({
      id: record.id,
      filename: record.filename,
      createdAt: record.createdAt,
      recordCount: record.recordCount,
      format: record.format,
      status: record.status,
      downloadUrl: record.downloadUrl
    })));

  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

// API: Download de arquivo processado
export async function downloadFile(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const companyId = (req.user as any)?.companyId;
    
    const record = processingHistory.get(id);
    
    if (!record || record.companyId !== companyId) {
      return res.status(404).json({ message: 'Arquivo não encontrado' });
    }

    const filePath = path.join(process.cwd(), 'uploads', 'digitalizacao', 'processed', 
      `${record.filename}.${record.format}`);

    try {
      await fs.access(filePath);
      res.download(filePath, `${record.filename}.${record.format}`);
    } catch (error) {
      res.status(404).json({ message: 'Arquivo não encontrado no sistema' });
    }

  } catch (error) {
    console.error('Erro no download:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

// API: Deletar arquivo do histórico
export async function deleteFile(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const companyId = (req.user as any)?.companyId;
    
    const record = processingHistory.get(id);
    
    if (!record || record.companyId !== companyId) {
      return res.status(404).json({ message: 'Arquivo não encontrado' });
    }

    // Remover arquivo físico
    const filePath = path.join(process.cwd(), 'uploads', 'digitalizacao', 'processed', 
      `${record.filename}.${record.format}`);
    
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Arquivo já pode ter sido removido
      console.log('Arquivo já removido:', filePath);
    }

    // Remover do histórico
    processingHistory.delete(id);

    res.json({ success: true });

  } catch (error) {
    console.error('Erro ao deletar arquivo:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}