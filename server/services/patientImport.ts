import * as XLSX from 'xlsx';
import { db } from '../db';
import { patients, type InsertPatient, type Patient } from '@shared/schema';
import { eq, or, and } from 'drizzle-orm';
import {
  extractTextFromImage,
  extractTextFromMultipleImages,
  type OcrResult,
} from './ocr';
import {
  extractPatientData,
  extractMultiplePatients,
  validateExtractedData,
  formatCPF,
  formatCEP,
  formatPhone,
  type ExtractedPatientData,
} from './aiExtraction';
import {
  recordDigitalizationUsage,
  getUsageStats,
  shouldSendUsageAlert,
} from './digitalizationBilling';

/**
 * Serviço de importação de pacientes
 * Suporta importação via XLSX e digitalização de fichas físicas
 */

export interface ImportResult {
  success: number;
  failed: number;
  skipped: number;
  errors: string[];
  patients: Patient[];
  billing?: {
    unitsUsed: number;
    cost: number; // em centavos
    currentCycleTotal: number;
    estimatedCost: number; // em centavos
    alert?: { level: 'warning' | 'critical'; message: string };
  };
}

export interface MergeOptions {
  prioritizeExisting: boolean; // Se true, mantém dados existentes
  overwriteEmpty: boolean; // Se true, sobrescreve campos vazios
  skipDuplicates: boolean; // Se true, pula pacientes duplicados
}

export interface ImportPreview {
  total: number;
  new: number;
  existing: number;
  duplicates: PatientDuplicate[];
}

export interface PatientDuplicate {
  imported: ExtractedPatientData;
  existing: Patient;
  matchReason: 'cpf' | 'name_and_phone' | 'email';
}

/**
 * Importa pacientes de um arquivo XLSX
 * @param filePath Caminho do arquivo XLSX
 * @param companyId ID da empresa
 * @param mergeOptions Opções de merge
 * @returns Resultado da importação
 */
export async function importPatientsFromXLSX(
  filePath: string,
  companyId: number,
  mergeOptions: MergeOptions = {
    prioritizeExisting: true,
    overwriteEmpty: true,
    skipDuplicates: false,
  }
): Promise<ImportResult> {
  const result: ImportResult = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    patients: [],
  };

  try {
    // Lê o arquivo XLSX
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Converte para JSON
    const data = XLSX.utils.sheet_to_json(worksheet) as any[];

    console.log(`Processando ${data.length} pacientes do XLSX...`);

    for (const row of data) {
      try {
        // Mapeia os campos do Excel para o schema
        const patientData: Partial<InsertPatient> = {
          companyId,
          fullName: row['Nome'] || row['Nome Completo'] || row['fullName'] || '',
          phone: formatPhone(row['Telefone'] || row['phone'] || ''),
          cellphone: formatPhone(row['Celular'] || row['cellphone'] || ''),
          email: row['Email'] || row['email'] || '',
          cpf: formatCPF(row['CPF'] || row['cpf'] || ''),
          birthDate: parseDate(row['Data de Nascimento'] || row['birthDate']),
          address: row['Endereço'] || row['address'] || '',
          city: row['Cidade'] || row['city'] || '',
          state: row['Estado'] || row['state'] || '',
          cep: formatCEP(row['CEP'] || row['cep'] || ''),
          neighborhood: row['Bairro'] || row['neighborhood'] || '',
        };

        // Valida nome (campo obrigatório)
        if (!patientData.fullName || patientData.fullName.trim().length < 3) {
          result.failed++;
          result.errors.push(`Linha ${result.success + result.failed}: Nome inválido ou ausente`);
          continue;
        }

        // Tenta inserir ou atualizar
        const patient = await insertOrUpdatePatient(patientData, mergeOptions);

        if (patient) {
          result.success++;
          result.patients.push(patient);
        } else {
          result.skipped++;
        }
      } catch (error) {
        result.failed++;
        result.errors.push(
          `Erro ao processar linha ${result.success + result.failed}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
        );
      }
    }

    console.log(
      `Importação XLSX concluída: ${result.success} sucesso, ${result.failed} falhas, ${result.skipped} ignorados`
    );
  } catch (error) {
    console.error('Erro ao importar XLSX:', error);
    throw new Error(`Falha ao processar arquivo XLSX: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }

  return result;
}

/**
 * Importa pacientes de imagens (fichas físicas)
 * @param imageBuffers Array de buffers de imagens
 * @param companyId ID da empresa
 * @param mergeOptions Opções de merge
 * @returns Resultado da importação
 */
export async function importPatientsFromImages(
  imageBuffers: Buffer[],
  companyId: number,
  mergeOptions: MergeOptions = {
    prioritizeExisting: true,
    overwriteEmpty: true,
    skipDuplicates: false,
  }
): Promise<ImportResult> {
  const result: ImportResult = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    patients: [],
  };

  const startTime = Date.now();

  try {
    console.log(`Processando ${imageBuffers.length} imagens...`);

    // Passo 1: OCR em todas as imagens
    console.log('Executando OCR...');
    const ocrResults = await extractTextFromMultipleImages(imageBuffers);

    // Passo 2: Extração de dados com AI
    console.log('Extraindo dados com AI...');
    const extractedData = await extractMultiplePatients(
      ocrResults.map((r) => r.text)
    );

    // Passo 3: Processar cada paciente extraído
    for (let i = 0; i < extractedData.length; i++) {
      try {
        const data = extractedData[i];
        const ocrConfidence = ocrResults[i]?.confidence || 0;

        // Valida dados extraídos
        if (!validateExtractedData(data)) {
          result.failed++;
          result.errors.push(
            `Imagem ${i + 1}: Dados insuficientes (confiança OCR: ${ocrConfidence.toFixed(2)}%)`
          );
          continue;
        }

        // Mapeia para InsertPatient
        const patientData: Partial<InsertPatient> = {
          companyId,
          fullName: data.fullName,
          phone: data.phone ? formatPhone(data.phone) : undefined,
          cellphone: data.cellphone ? formatPhone(data.cellphone) : undefined,
          email: data.email || undefined,
          cpf: data.cpf ? formatCPF(data.cpf) : undefined,
          birthDate: data.birthDate ? parseDate(data.birthDate) : undefined,
          address: data.address || undefined,
          city: data.city || undefined,
          state: data.state || undefined,
          cep: data.cep ? formatCEP(data.cep) : undefined,
          neighborhood: data.neighborhood || undefined,
        };

        // Insere ou atualiza
        const patient = await insertOrUpdatePatient(patientData, mergeOptions);

        if (patient) {
          result.success++;
          result.patients.push(patient);
          console.log(
            `Paciente ${patient.fullName} importado (confiança: ${ocrConfidence.toFixed(2)}%)`
          );
        } else {
          result.skipped++;
        }
      } catch (error) {
        result.failed++;
        result.errors.push(
          `Imagem ${i + 1}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
        );
      }
    }

    const processingTime = Date.now() - startTime;
    const avgConfidence =
      ocrResults.reduce((sum, r) => sum + r.confidence, 0) / ocrResults.length;

    // Registra uso e calcula custo (apenas fichas com sucesso são cobradas)
    const billingResult = await recordDigitalizationUsage({
      companyId,
      imageCount: imageBuffers.length,
      successCount: result.success,
      failedCount: result.failed,
      ocrConfidence: avgConfidence,
      aiModel: process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini',
      processingTime,
      importType: 'images',
      metadata: {
        totalImages: imageBuffers.length,
        avgOcrConfidence: avgConfidence,
      },
    });

    if (billingResult.allowed && billingResult.usage) {
      const cost = Math.ceil((result.success / 1000) * 3000); // R$ 30,00 / 1000
      const alert = shouldSendUsageAlert(billingResult.usage);

      result.billing = {
        unitsUsed: result.success,
        cost,
        currentCycleTotal: billingResult.usage.currentCycleCount,
        estimatedCost: billingResult.usage.estimatedCost,
        alert: alert.send ? { level: alert.level!, message: alert.message } : undefined,
      };

      console.log(
        `💰 Custo desta importação: R$ ${(cost / 100).toFixed(2)} (${result.success} fichas)`
      );
      console.log(
        `📊 Total do mês: ${billingResult.usage.currentCycleCount} fichas (R$ ${(billingResult.usage.estimatedCost / 100).toFixed(2)})`
      );

      if (alert.send) {
        console.warn(`⚠️  ${alert.message}`);
      }
    }

    console.log(
      `Importação de imagens concluída: ${result.success} sucesso, ${result.failed} falhas, ${result.skipped} ignorados`
    );
  } catch (error) {
    console.error('Erro ao importar imagens:', error);
    throw new Error(
      `Falha ao processar imagens: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    );
  }

  return result;
}

/**
 * Gera preview da importação (sem salvar no banco)
 * @param data Array de dados extraídos
 * @param companyId ID da empresa
 * @returns Preview da importação
 */
export async function previewImport(
  data: Partial<InsertPatient>[],
  companyId: number
): Promise<ImportPreview> {
  const preview: ImportPreview = {
    total: data.length,
    new: 0,
    existing: 0,
    duplicates: [],
  };

  for (const patientData of data) {
    const existing = await findExistingPatient(patientData, companyId);

    if (existing) {
      preview.existing++;
      preview.duplicates.push({
        imported: patientData as ExtractedPatientData,
        existing,
        matchReason: getMatchReason(patientData, existing),
      });
    } else {
      preview.new++;
    }
  }

  return preview;
}

/**
 * Insere ou atualiza um paciente com lógica de merge
 * @param patientData Dados do paciente
 * @param mergeOptions Opções de merge
 * @returns Paciente criado/atualizado ou null se pulado
 */
async function insertOrUpdatePatient(
  patientData: Partial<InsertPatient>,
  mergeOptions: MergeOptions
): Promise<Patient | null> {
  const existing = await findExistingPatient(
    patientData,
    patientData.companyId!
  );

  if (existing) {
    // Paciente já existe
    if (mergeOptions.skipDuplicates) {
      console.log(`Paciente ${existing.fullName} já existe - pulado`);
      return null;
    }

    // Merge dos dados
    const mergedData = mergePatientData(existing, patientData, mergeOptions);

    // Atualiza paciente
    const [updated] = await db
      .update(patients)
      .set(mergedData)
      .where(eq(patients.id, existing.id))
      .returning();

    console.log(`Paciente ${updated.fullName} atualizado`);
    return updated;
  } else {
    // Novo paciente
    const [created] = await db
      .insert(patients)
      .values(patientData as InsertPatient)
      .returning();

    console.log(`Paciente ${created.fullName} criado`);
    return created;
  }
}

/**
 * Procura paciente existente por CPF, nome+telefone ou email
 * @param patientData Dados do paciente
 * @param companyId ID da empresa
 * @returns Paciente existente ou null
 */
async function findExistingPatient(
  patientData: Partial<InsertPatient>,
  companyId: number
): Promise<Patient | null> {
  // Busca por CPF (prioridade máxima)
  if (patientData.cpf) {
    const [found] = await db
      .select()
      .from(patients)
      .where(
        and(
          eq(patients.companyId, companyId),
          eq(patients.cpf, patientData.cpf)
        )
      )
      .limit(1);

    if (found) return found;
  }

  // Busca por email
  if (patientData.email) {
    const [found] = await db
      .select()
      .from(patients)
      .where(
        and(
          eq(patients.companyId, companyId),
          eq(patients.email, patientData.email)
        )
      )
      .limit(1);

    if (found) return found;
  }

  // Busca por nome + telefone
  if (patientData.fullName && (patientData.phone || patientData.cellphone)) {
    const phoneToMatch = patientData.cellphone || patientData.phone;
    const [found] = await db
      .select()
      .from(patients)
      .where(
        and(
          eq(patients.companyId, companyId),
          eq(patients.fullName, patientData.fullName),
          or(
            eq(patients.phone, phoneToMatch!),
            eq(patients.cellphone, phoneToMatch!)
          )
        )
      )
      .limit(1);

    if (found) return found;
  }

  return null;
}

/**
 * Merge inteligente de dados do paciente
 * Prioriza dados existentes não vazios
 */
function mergePatientData(
  existing: Patient,
  imported: Partial<InsertPatient>,
  options: MergeOptions
): Partial<Patient> {
  const merged: Partial<Patient> = { ...existing };

  // Se priorizar existentes, só sobrescreve campos vazios
  if (options.prioritizeExisting) {
    for (const key in imported) {
      const field = key as keyof InsertPatient;
      const existingValue = existing[field as keyof Patient];
      const importedValue = imported[field];

      // Sobrescreve se:
      // 1. Campo existente está vazio E overwriteEmpty = true
      // 2. Campo importado tem valor
      if (
        options.overwriteEmpty &&
        (!existingValue || existingValue === '') &&
        importedValue
      ) {
        (merged as any)[field] = importedValue;
      }
    }
  } else {
    // Sobrescreve tudo com dados importados
    Object.assign(merged, imported);
  }

  return merged;
}

/**
 * Determina o motivo da correspondência
 */
function getMatchReason(
  imported: Partial<InsertPatient>,
  existing: Patient
): 'cpf' | 'name_and_phone' | 'email' {
  if (imported.cpf && imported.cpf === existing.cpf) {
    return 'cpf';
  }
  if (imported.email && imported.email === existing.email) {
    return 'email';
  }
  return 'name_and_phone';
}

/**
 * Converte string de data para Date
 * Suporta formatos: DD/MM/YYYY, YYYY-MM-DD
 */
function parseDate(dateStr: string | Date | undefined): Date | undefined {
  if (!dateStr) return undefined;
  if (dateStr instanceof Date) return dateStr;

  // Tenta formato DD/MM/YYYY
  const brFormat = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (brFormat) {
    const [_, day, month, year] = brFormat;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Tenta formato YYYY-MM-DD
  const isoFormat = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoFormat) {
    const [_, year, month, day] = isoFormat;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  return undefined;
}
