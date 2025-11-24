import vision from '@google-cloud/vision';
import fs from 'fs';
import path from 'path';

/**
 * Serviço de OCR usando Google Cloud Vision API
 * Extrai texto de imagens de fichas físicas de pacientes
 */

// Inicializa o cliente do Google Cloud Vision
// Usa as credenciais do arquivo JSON especificado na variável de ambiente
const client = new vision.ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

export interface OcrResult {
  text: string;
  confidence: number;
}

/**
 * Extrai texto de uma imagem usando OCR
 * @param imagePath Caminho para a imagem ou buffer
 * @returns Texto extraído da imagem
 */
export async function extractTextFromImage(
  imagePath: string | Buffer
): Promise<OcrResult> {
  try {
    let imageContent: Buffer;

    // Se for um caminho de arquivo, lê o conteúdo
    if (typeof imagePath === 'string') {
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Arquivo não encontrado: ${imagePath}`);
      }
      imageContent = fs.readFileSync(imagePath);
    } else {
      imageContent = imagePath;
    }

    // Faz a detecção de texto na imagem
    const [result] = await client.textDetection(imageContent);
    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
      return {
        text: '',
        confidence: 0,
      };
    }

    // O primeiro elemento contém todo o texto detectado
    const fullText = detections[0].description || '';
    const confidence = detections[0].confidence || 0;

    return {
      text: fullText,
      confidence: confidence * 100, // Converte para porcentagem
    };
  } catch (error) {
    console.error('Erro ao extrair texto da imagem:', error);
    throw new Error(
      `Falha ao processar OCR: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    );
  }
}

/**
 * Processa múltiplas imagens em lote
 * @param imagePaths Array de caminhos de imagens ou buffers
 * @returns Array de textos extraídos
 */
export async function extractTextFromMultipleImages(
  imagePaths: (string | Buffer)[]
): Promise<OcrResult[]> {
  const results: OcrResult[] = [];

  for (const imagePath of imagePaths) {
    try {
      const result = await extractTextFromImage(imagePath);
      results.push(result);
      console.log(
        `OCR processado com sucesso. Confiança: ${result.confidence.toFixed(2)}%`
      );
    } catch (error) {
      console.error('Erro ao processar imagem:', error);
      // Adiciona resultado vazio em caso de erro
      results.push({ text: '', confidence: 0 });
    }
  }

  return results;
}

/**
 * Valida se a imagem é válida para OCR
 * @param imagePath Caminho da imagem
 * @returns true se a imagem é válida
 */
export function validateImageFile(imagePath: string): boolean {
  const validExtensions = ['.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.gif'];
  const ext = path.extname(imagePath).toLowerCase();

  if (!validExtensions.includes(ext)) {
    return false;
  }

  // Verifica se o arquivo existe
  if (!fs.existsSync(imagePath)) {
    return false;
  }

  // Verifica o tamanho do arquivo (max 20MB)
  const stats = fs.statSync(imagePath);
  const maxSize = 20 * 1024 * 1024; // 20MB

  return stats.size <= maxSize;
}

/**
 * Valida buffer de imagem
 * @param buffer Buffer da imagem
 * @returns true se o buffer é válido
 */
export function validateImageBuffer(buffer: Buffer): boolean {
  // Verifica tamanho máximo (20MB)
  const maxSize = 20 * 1024 * 1024;
  return buffer.length <= maxSize;
}
