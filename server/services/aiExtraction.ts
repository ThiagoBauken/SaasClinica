/**
 * Serviço de extração de dados de pacientes usando LLM
 * Converte texto não estruturado (OCR) em dados estruturados
 *
 * Estratégia LGPD-first:
 *   1. Tenta Ollama local (dados nunca saem do servidor)
 *   2. Fallback: DeepSeek/OpenAI (quando infra local indisponível)
 *
 * Nota: Na extração de fichas OCR, os dados já estão em texto bruto,
 * então anonimização não se aplica (o objetivo é extrair os dados).
 * A proteção aqui é preferir processamento local.
 */

import { logger } from '../logger';

const log = logger.child({ module: 'ai-extraction' });

/**
 * Get Ollama base URL from env or default.
 */
function getOllamaUrl(): string {
  return process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
}

/**
 * Get the model to use for extraction tasks.
 */
function getExtractionModel(): string {
  return process.env.OLLAMA_EXTRACTION_MODEL || process.env.OLLAMA_MODEL || 'llama3.1:8b';
}

/**
 * Check if Ollama is available (quick health check)
 */
async function isOllamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${getOllamaUrl()}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Call external API (DeepSeek/OpenAI) as fallback.
 * Only used when Ollama is unavailable.
 */
async function callExternalFallback(
  systemContent: string,
  userContent: string
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Nenhum provider de IA disponível: Ollama offline e sem API key externa configurada');
  }

  const baseUrl = process.env.DEEPSEEK_API_KEY
    ? 'https://api.deepseek.com/v1'
    : 'https://api.openai.com/v1';
  const model = process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini';

  log.warn({ provider: process.env.DEEPSEEK_API_KEY ? 'deepseek' : 'openai' },
    'LGPD: Ollama indisponível — usando provider externo como fallback para extração');

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: userContent },
      ],
      temperature: 0,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`External API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

export interface ExtractedPatientData {
  fullName: string;
  phone?: string;
  cellphone?: string;
  email?: string;
  cpf?: string;
  birthDate?: string;
  address?: string;
  city?: string;
  state?: string;
  cep?: string;
  neighborhood?: string;
}

/**
 * Prompt otimizado para extração de dados de fichas odontológicas
 * Detecta tabelas, colunas e campos com inteligência avançada
 */
const EXTRACTION_PROMPT = `Você é um assistente ESPECIALISTA em extrair dados de fichas de pacientes odontológicos.

IMPORTANTE: As fichas podem estar em FORMATO DE TABELA com colunas e linhas separadas.
Você deve identificar inteligentemente os campos mesmo que estejam organizados em:
- Tabelas com múltiplas colunas
- Formulários com campos lado a lado
- Listas verticais
- Texto livre

MAPEAMENTO INTELIGENTE DE CAMPOS:

📝 NOME/IDENTIFICAÇÃO:
- Procure: "NOME", "NOME COMPLETO", "PACIENTE", "NOME DO PACIENTE", "PATIENT NAME"
- Fica geralmente no topo da ficha
- Ignore nomes de campos, pegue apenas o valor

📞 TELEFONES (pode ter múltiplos):
- Fixo: "TELEFONE", "TEL", "FONE", "TEL. RESIDENCIAL", "TELEFONE FIXO"
- Celular: "CELULAR", "CEL", "WHATSAPP", "TEL. CELULAR", "MOBILE"
- Formatos aceitos: (XX) XXXX-XXXX, (XX) XXXXX-XXXX, XX XXXX-XXXX

📧 EMAIL:
- Procure: "EMAIL", "E-MAIL", "E MAIL", "CORREIO ELETRÔNICO"
- Detecte automaticamente padrão: texto@dominio.com

🆔 CPF:
- Procure: "CPF", "CPF:", "C.P.F"
- Formatos: XXX.XXX.XXX-XX ou XXXXXXXXXXX
- Ignore CPFs inválidos (todos iguais: 000.000.000-00, 111.111.111-11)

🎂 DATA DE NASCIMENTO:
- Procure: "DATA DE NASCIMENTO", "DN", "NASCIMENTO", "NASC", "D.N.", "DATA NASC"
- Formatos aceitos: DD/MM/AAAA, DD-MM-AAAA, DD.MM.AAAA
- Converta para DD/MM/AAAA

🏠 ENDEREÇO COMPLETO:
- Endereço: "ENDEREÇO", "END", "RUA", "AVENIDA", "AV", "ALAMEDA"
- Bairro: "BAIRRO", "BAIRRO/DISTRITO"
- Cidade: "CIDADE", "MUNICÍPIO"
- Estado: "ESTADO", "UF", "ESTADO/UF"
- CEP: "CEP", "CEP:" (formato: XXXXX-XXX)

DETECÇÃO DE TABELAS:
Se o texto contém caracteres como "|", "___", "---", ou espaçamentos regulares:
1. Identifique as colunas pela posição vertical
2. Associe cabeçalhos com valores
3. Extraia dados mesmo em layouts complexos

REGRAS DE VALIDAÇÃO:
✅ Nome: Mínimo 3 caracteres, sem números
✅ CPF: Exatamente 11 dígitos
✅ Email: Deve conter @ e domínio
✅ Telefone: Mínimo 8 dígitos
✅ CEP: Exatamente 8 dígitos
❌ Ignore campos de exemplo/instruções

Retorne APENAS um objeto JSON válido:
{
  "fullName": "Nome completo extraído",
  "phone": "Telefone fixo formatado",
  "cellphone": "Celular formatado",
  "email": "email@dominio.com",
  "cpf": "XXX.XXX.XXX-XX",
  "birthDate": "DD/MM/AAAA",
  "address": "Rua/Av completa, número",
  "city": "Nome da cidade",
  "state": "UF",
  "cep": "XXXXX-XXX",
  "neighborhood": "Nome do bairro"
}

Se um campo não for encontrado ou for inválido, use string vazia "".

===== TEXTO DA FICHA PARA ANÁLISE =====`;

/**
 * Extrai dados estruturados de texto não estruturado usando LLM
 *
 * Cadeia de providers:
 *   1. Ollama local (LGPD: dados não saem do servidor)
 *   2. DeepSeek (fallback barato — se DEEPSEEK_API_KEY configurada)
 *   3. OpenAI (último fallback — se OPENAI_API_KEY configurada)
 *
 * @param ocrText Texto extraído do OCR
 * @returns Dados estruturados do paciente
 */
export async function extractPatientData(
  ocrText: string
): Promise<ExtractedPatientData> {
  if (!ocrText || ocrText.trim().length === 0) {
    throw new Error('Texto OCR vazio');
  }

  const systemContent = 'Você é um assistente ESPECIALISTA em extrair dados de fichas odontológicas. Retorne APENAS JSON válido, sem texto adicional. Detecte inteligentemente tabelas, colunas e campos.';
  const userContent = `${EXTRACTION_PROMPT}\n\n${ocrText}`;
  let content: string;

  // Tentar Ollama local primeiro
  const ollamaAvailable = await isOllamaAvailable();

  if (ollamaAvailable) {
    try {
      const ollamaUrl = getOllamaUrl();
      const model = getExtractionModel();
      log.info({ model, provider: 'ollama' }, 'Extracting patient data with local LLM');

      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: userContent },
          ],
          stream: false,
          format: 'json',
          options: { temperature: 0, num_predict: 2000, num_gpu: 99 },
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
      const data = await response.json();
      content = data.message?.content || '';
      if (!content) throw new Error('Resposta vazia do Ollama');
    } catch (ollamaErr) {
      log.warn({ err: ollamaErr }, 'Ollama falhou, tentando fallback externo');
      content = await callExternalFallback(systemContent, userContent);
    }
  } else {
    log.info('Ollama indisponível, usando provider externo');
    content = await callExternalFallback(systemContent, userContent);
  }

  // Parse JSON da resposta
  let jsonStr = content.trim();
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) jsonStr = jsonMatch[0];

  const extractedData = JSON.parse(jsonStr) as ExtractedPatientData;

  return {
    fullName: extractedData.fullName?.trim() || '',
    phone: extractedData.phone?.trim() || undefined,
    cellphone: extractedData.cellphone?.trim() || undefined,
    email: extractedData.email?.trim() || undefined,
    cpf: extractedData.cpf?.trim() || undefined,
    birthDate: extractedData.birthDate?.trim() || undefined,
    address: extractedData.address?.trim() || undefined,
    city: extractedData.city?.trim() || undefined,
    state: extractedData.state?.trim() || undefined,
    cep: extractedData.cep?.trim() || undefined,
    neighborhood: extractedData.neighborhood?.trim() || undefined,
  };
}

/**
 * Processa múltiplos textos OCR em lote
 * @param ocrTexts Array de textos extraídos
 * @returns Array de dados estruturados
 */
export async function extractMultiplePatients(
  ocrTexts: string[]
): Promise<ExtractedPatientData[]> {
  const results: ExtractedPatientData[] = [];

  for (const ocrText of ocrTexts) {
    try {
      const data = await extractPatientData(ocrText);
      results.push(data);
      log.info({ name: data.fullName || 'unknown' }, 'Dados extraídos com sucesso');
    } catch (error) {
      log.error({ err: error }, 'Erro ao processar texto OCR');
      // Adiciona dados vazios em caso de erro
      results.push({
        fullName: '',
      });
    }
  }

  return results;
}

/**
 * Valida se os dados extraídos são suficientes para criar um paciente
 * @param data Dados extraídos
 * @returns true se os dados são válidos
 */
export function validateExtractedData(data: ExtractedPatientData): boolean {
  // No mínimo precisa ter nome
  if (!data.fullName || data.fullName.trim().length < 3) {
    return false;
  }

  return true;
}

/**
 * Formata CPF para o padrão brasileiro
 * @param cpf CPF sem formatação
 * @returns CPF formatado (XXX.XXX.XXX-XX)
 */
export function formatCPF(cpf: string): string {
  const numbers = cpf.replace(/\D/g, '');
  if (numbers.length !== 11) return cpf;

  return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formata CEP para o padrão brasileiro
 * @param cep CEP sem formatação
 * @returns CEP formatado (XXXXX-XXX)
 */
export function formatCEP(cep: string): string {
  const numbers = cep.replace(/\D/g, '');
  if (numbers.length !== 8) return cep;

  return numbers.replace(/(\d{5})(\d{3})/, '$1-$2');
}

/**
 * Formata telefone brasileiro
 * @param phone Telefone sem formatação
 * @returns Telefone formatado
 */
export function formatPhone(phone: string): string {
  const numbers = phone.replace(/\D/g, '');

  if (numbers.length === 11) {
    // Celular: (XX) XXXXX-XXXX
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (numbers.length === 10) {
    // Fixo: (XX) XXXX-XXXX
    return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }

  return phone;
}
