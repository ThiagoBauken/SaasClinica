import OpenAI from 'openai';

/**
 * Serviço de extração de dados de pacientes usando DeepSeek AI
 * Converte texto não estruturado (OCR) em dados estruturados
 *
 * DeepSeek é 95% mais barato que GPT-4o-mini!
 * Custo: ~R$ 0.30 por 1.000 fichas processadas
 */

// Inicializa o cliente DeepSeek (compatível com OpenAI SDK)
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.DEEPSEEK_API_KEY
    ? 'https://api.deepseek.com'
    : 'https://api.openai.com/v1',
});

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
 * Extrai dados estruturados de texto não estruturado usando DeepSeek AI
 * @param ocrText Texto extraído do OCR
 * @returns Dados estruturados do paciente
 */
export async function extractPatientData(
  ocrText: string
): Promise<ExtractedPatientData> {
  try {
    if (!ocrText || ocrText.trim().length === 0) {
      throw new Error('Texto OCR vazio');
    }

    const model = process.env.DEEPSEEK_API_KEY
      ? 'deepseek-chat' // DeepSeek: 95% mais barato!
      : 'gpt-4o-mini'; // Fallback para OpenAI

    const response = await deepseek.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'Você é um assistente ESPECIALISTA em extrair dados de fichas odontológicas. Retorne APENAS JSON válido, sem texto adicional. Detecte inteligentemente tabelas, colunas e campos.',
        },
        {
          role: 'user',
          content: `${EXTRACTION_PROMPT}\n\n${ocrText}`,
        },
      ],
      temperature: 0, // Temperatura 0 para consistência máxima
      max_tokens: 2000, // Aumentado para fichas complexas
      response_format: { type: 'json_object' }, // Garante resposta em JSON
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Resposta vazia da OpenAI');
    }

    // Parse do JSON
    const extractedData = JSON.parse(content) as ExtractedPatientData;

    // Normaliza campos vazios
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
  } catch (error) {
    console.error('Erro ao extrair dados do paciente:', error);
    throw new Error(
      `Falha ao processar extração AI: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    );
  }
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
      console.log(`Dados extraídos com sucesso: ${data.fullName || 'Nome não encontrado'}`);
    } catch (error) {
      console.error('Erro ao processar texto OCR:', error);
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
