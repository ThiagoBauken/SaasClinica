import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';

interface ProcessingRecord {
  id: string;
  filename: string;
  downloadUrl: string;
  processedAt: string;
  format: string;
  recordCount: number;
  companyId: number;
}

// Storage em memória para os processamentos (em produção usar banco de dados)
const processedFiles = new Map<string, ProcessingRecord[]>();

// Configuração do multer para upload de arquivos
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 20
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/tiff'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens JPG, PNG e TIFF são aceitas'));
    }
  }
});

// Simulador de extração de texto via OCR (Google Vision API)
async function extractTextFromImage(imagePath: string): Promise<string> {
  // Em produção, aqui seria integrada a Google Vision API
  // Por enquanto, simular extração de dados de uma ficha odontológica
  
  const mockExtractedText = `
    FICHA ODONTOLÓGICA
    
    Nome: Maria Silva Santos
    CPF: 123.456.789-10
    RG: 12.345.678-9
    Data de Nascimento: 15/03/1985
    Telefone: (11) 99999-8888
    Celular: (11) 98888-7777
    Email: maria.silva@email.com
    
    Endereço: Rua das Flores, 123
    Bairro: Centro
    Cidade: São Paulo
    CEP: 01234-567
    
    Profissão: Professora
    Estado Civil: Casada
    
    Responsável: João Santos (Esposo)
    Telefone Responsável: (11) 97777-6666
    
    Convênio: Unimed
    Número do Convênio: 123456789
    
    Histórico Médico:
    - Hipertensão controlada
    - Alergia à penicilina
    
    Procedimentos Anteriores:
    - Limpeza (Janeiro 2024)
    - Restauração dente 16 (Março 2024)
    
    Observações:
    Paciente pontual, comparece regularmente às consultas.
    Boa higiene bucal.
  `;
  
  return mockExtractedText;
}

// Simulador de processamento com IA (OpenAI)
async function processTextWithAI(text: string, model: string, customPrompt?: string): Promise<any> {
  // Em produção, aqui seria integrada a OpenAI API
  
  const extractedData = {
    nome: 'Maria Silva Santos',
    cpf: '123.456.789-10',
    rg: '12.345.678-9',
    dataNascimento: '15/03/1985',
    telefone: '(11) 99999-8888',
    celular: '(11) 98888-7777',
    email: 'maria.silva@email.com',
    endereco: 'Rua das Flores, 123, Centro, São Paulo, CEP: 01234-567',
    profissao: 'Professora',
    estadoCivil: 'Casada',
    responsavel: 'João Santos (Esposo)',
    telefoneResponsavel: '(11) 97777-6666',
    convenio: 'Unimed',
    numeroConvenio: '123456789',
    historicoMedico: 'Hipertensão controlada, Alergia à penicilina',
    procedimentosAnteriores: 'Limpeza (Janeiro 2024), Restauração dente 16 (Março 2024)',
    observacoes: 'Paciente pontual, comparece regularmente às consultas. Boa higiene bucal.'
  };
  
  return extractedData;
}

// Função para gerar arquivo Excel/CSV/JSON/PDF
async function generateOutputFile(data: any[], format: string, outputPath: string): Promise<boolean> {
  try {
    if (format === 'json') {
      await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
      return true;
    }
    
    if (format === 'csv') {
      const headers = Object.keys(data[0] || {});
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
      ].join('\n');
      
      await fs.writeFile(outputPath, csvContent);
      return true;
    }
    
    if (format === 'xlsx') {
      // Em produção, usar biblioteca como 'xlsx' para gerar Excel
      // Por enquanto, simular criação do arquivo
      const excelContent = JSON.stringify(data, null, 2);
      await fs.writeFile(outputPath, excelContent);
      return true;
    }
    
    if (format === 'pdf') {
      // Em produção, usar biblioteca como 'pdfkit' para gerar PDF
      // Por enquanto, simular criação do arquivo
      const pdfContent = JSON.stringify(data, null, 2);
      await fs.writeFile(outputPath, pdfContent);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Erro ao gerar arquivo:', error);
    return false;
  }
}

export const uploadMiddleware = upload.array('files', 20);

export async function processFiles(req: Request, res: Response) {
  try {
    const companyId = (req.user as any)?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'Nenhum arquivo enviado' });
    }

    const { customPrompt, model = 'gpt-4o-mini', format = 'xlsx' } = req.body;

    const allExtractedData: any[] = [];

    // Processar cada arquivo
    for (const file of files) {
      try {
        // Extrair texto da imagem
        const extractedText = await extractTextFromImage(file.path);
        
        if (extractedText.trim()) {
          // Processar com IA
          const structuredData = await processTextWithAI(extractedText, model, customPrompt);
          allExtractedData.push(structuredData);
        }
        
        // Limpar arquivo temporário
        await fs.unlink(file.path).catch(() => {});
      } catch (error) {
        console.error(`Erro ao processar arquivo ${file.filename}:`, error);
      }
    }

    if (allExtractedData.length === 0) {
      return res.status(400).json({ message: 'Nenhum dado foi extraído dos arquivos' });
    }

    // Gerar arquivo de saída
    const timestamp = Date.now();
    const outputFilename = `registros_${timestamp}.${format}`;
    const outputPath = path.join('processed', outputFilename);

    // Criar diretório se não existir
    await fs.mkdir('processed', { recursive: true });

    const success = await generateOutputFile(allExtractedData, format, outputPath);

    if (!success) {
      return res.status(500).json({ message: 'Erro ao gerar arquivo de saída' });
    }

    // Salvar registro do processamento
    const processRecord: ProcessingRecord = {
      id: timestamp.toString(),
      filename: outputFilename,
      downloadUrl: `/api/digitalizacao/download/${outputFilename}`,
      processedAt: new Date().toISOString(),
      format,
      recordCount: allExtractedData.length,
      companyId
    };

    const companyRecords = processedFiles.get(companyId.toString()) || [];
    companyRecords.push(processRecord);
    processedFiles.set(companyId.toString(), companyRecords);

    res.json({
      success: true,
      recordCount: allExtractedData.length,
      downloadUrl: processRecord.downloadUrl,
      filename: outputFilename
    });

  } catch (error) {
    console.error('Erro no processamento:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

export async function getProcessingHistory(req: Request, res: Response) {
  try {
    const companyId = (req.user as any)?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const companyRecords = processedFiles.get(companyId.toString()) || [];
    
    // Ordenar por data de processamento (mais recente primeiro)
    const sortedRecords = companyRecords.sort((a, b) => 
      new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime()
    );

    res.json(sortedRecords);
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

export async function downloadFile(req: Request, res: Response) {
  try {
    const companyId = (req.user as any)?.companyId;
    const { filename } = req.params;
    
    if (!companyId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    // Verificar se o arquivo pertence à empresa do usuário
    const companyRecords = processedFiles.get(companyId.toString()) || [];
    const fileRecord = companyRecords.find(record => record.filename === filename);
    
    if (!fileRecord) {
      return res.status(404).json({ message: 'Arquivo não encontrado' });
    }

    const filePath = path.join('processed', filename);
    
    try {
      await fs.access(filePath);
      
      // Configurar headers para download
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      
      // Enviar arquivo
      const fileStream = createReadStream(filePath);
      fileStream.pipe(res);
      
    } catch (error) {
      res.status(404).json({ message: 'Arquivo não encontrado no sistema' });
    }

  } catch (error) {
    console.error('Erro no download:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

export async function deleteFile(req: Request, res: Response) {
  try {
    const companyId = (req.user as any)?.companyId;
    const { filename } = req.params;
    
    if (!companyId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    // Verificar se o arquivo pertence à empresa do usuário
    const companyRecords = processedFiles.get(companyId.toString()) || [];
    const fileIndex = companyRecords.findIndex(record => record.filename === filename);
    
    if (fileIndex === -1) {
      return res.status(404).json({ message: 'Arquivo não encontrado' });
    }

    // Remover arquivo do sistema de arquivos
    const filePath = path.join('processed', filename);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Arquivo pode não existir no sistema de arquivos, mas continuar com remoção do registro
    }

    // Remover registro da memória
    companyRecords.splice(fileIndex, 1);
    processedFiles.set(companyId.toString(), companyRecords);

    res.json({ success: true, message: 'Arquivo deletado com sucesso' });

  } catch (error) {
    console.error('Erro ao deletar arquivo:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}