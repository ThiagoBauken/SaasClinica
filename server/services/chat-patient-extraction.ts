/**
 * Chat Patient Extraction Service
 * Extrai dados do paciente a partir de mensagens de WhatsApp
 * e cria automaticamente o registro no sistema
 */

import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { patients, chatSessions, chatMessages, salesOpportunities } from '@shared/schema';
import { AIProviderService } from './ai-provider';

interface ExtractedPatientData {
  fullName?: string;
  phone?: string;
  email?: string;
  cpf?: string;
  birthDate?: string;
  chiefComplaint?: string;
  gender?: string;
  address?: string;
}

/**
 * Tenta extrair dados do paciente das mensagens do chat
 * e criar automaticamente um registro de paciente
 */
export async function tryExtractAndCreatePatient(
  companyId: number,
  sessionId: number,
  phone: string,
): Promise<{ patientId: number; fullName: string } | null> {
  try {
    // 1. Buscar mensagens do usuário na sessão
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.createdAt);

    // Filtrar apenas mensagens do usuário (não do bot)
    const userMessages = messages.filter((m: any) => m.senderType === 'patient' || m.role === 'user');

    // Precisa de pelo menos 3 mensagens para ter dados suficientes
    if (userMessages.length < 3) return null;

    // 2. Montar texto das mensagens para análise
    const conversationText = messages
      .map((m: any) => {
        const sender = m.senderType === 'patient' || m.role === 'user' ? 'Paciente' : 'Bot';
        return `${sender}: ${m.message || m.content || ''}`;
      })
      .join('\n');

    // 3. Usar IA para extrair dados
    const extracted = await extractPatientDataFromChat(companyId, conversationText);

    if (!extracted || !extracted.fullName) {
      return null; // Não conseguiu extrair nome - dado mínimo necessário
    }

    // 4. Verificar se paciente já existe (por nome + telefone)
    const existing = await db
      .select()
      .from(patients)
      .where(
        and(
          eq(patients.companyId, companyId),
          eq(patients.whatsappPhone, phone),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      // Paciente já existe, apenas vincular à sessão
      await linkPatientToSession(existing[0].id, existing[0].fullName, sessionId, companyId);
      return { patientId: existing[0].id, fullName: existing[0].fullName };
    }

    // 5. Criar paciente — LGPD Art. 7, I: consentimento pendente
    // O consentimento explícito será solicitado pelo AI Agent via WhatsApp
    // antes de ativar o cadastro. Até lá, o registro fica como pending_consent.
    const [newPatient] = await db
      .insert(patients)
      .values({
        companyId,
        fullName: extracted.fullName,
        whatsappPhone: phone,
        cellphone: phone,
        email: extracted.email || undefined,
        cpf: extracted.cpf || undefined,
        gender: extracted.gender || undefined,
        address: extracted.address || undefined,
        birthDate: extracted.birthDate ? new Date(extracted.birthDate) : undefined,
        notes: extracted.chiefComplaint
          ? `Queixa inicial (WhatsApp): ${extracted.chiefComplaint}`
          : 'Paciente criado via WhatsApp — aguardando consentimento LGPD',
        status: 'active',
        active: true,
        whatsappConsent: false, // LGPD: NÃO presumir consentimento — deve ser explícito
        dataProcessingConsent: false, // Será true após confirmação do paciente
        consentMethod: 'whatsapp_pending', // Indica que consentimento foi solicitado
        consentDate: null, // Será preenchido quando paciente confirmar
      })
      .returning({ id: patients.id, fullName: patients.fullName });

    // 6. Vincular paciente à sessão e oportunidade CRM
    await linkPatientToSession(newPatient.id, newPatient.fullName, sessionId, companyId);

    console.log(
      `[ChatExtraction] Auto-created patient "${newPatient.fullName}" (ID: ${newPatient.id}) for company ${companyId}`,
    );

    return { patientId: newPatient.id, fullName: newPatient.fullName };
  } catch (error) {
    console.error('[ChatExtraction] Error extracting/creating patient:', error);
    return null;
  }
}

/**
 * Extrai dados do paciente usando IA
 */
async function extractPatientDataFromChat(
  companyId: number,
  conversationText: string,
): Promise<ExtractedPatientData | null> {
  try {
    const aiService = new AIProviderService(companyId);
    await aiService.initialize();

    const response = await aiService.complete({
      messages: [
        {
          role: 'system',
          content: `Voce e um extrator de dados de pacientes. Analise a conversa de WhatsApp abaixo e extraia os dados pessoais do PACIENTE (nao do bot/clinica).

RETORNE APENAS JSON valido sem texto adicional:
{
  "fullName": "nome completo se mencionado",
  "email": "email se mencionado",
  "cpf": "CPF se mencionado (formato: 000.000.000-00)",
  "birthDate": "data de nascimento se mencionada (formato: YYYY-MM-DD)",
  "chiefComplaint": "queixa/motivo da consulta se mencionado",
  "gender": "male ou female se possivel inferir pelo nome/conversa",
  "address": "endereco se mencionado"
}

REGRAS:
- Inclua APENAS campos que foram EXPLICITAMENTE mencionados na conversa
- O nome deve ser o mais completo possivel
- Se nao encontrar o nome, retorne {}
- Nao invente dados
- CPF deve ter 11 digitos
- Data de nascimento no formato ISO (YYYY-MM-DD)`,
        },
        {
          role: 'user',
          content: `CONVERSA:\n\n${conversationText}`,
        },
      ],
      maxTokens: 256,
      temperature: 0.1, // Baixa para precisão na extração
    });

    // Parse JSON response
    let jsonStr = response.content.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const parsed = JSON.parse(jsonStr);
    return parsed as ExtractedPatientData;
  } catch (error) {
    console.error('[ChatExtraction] AI extraction failed:', error);
    return null;
  }
}

/**
 * Vincula paciente à sessão de chat e oportunidade CRM
 */
async function linkPatientToSession(
  patientId: number,
  patientName: string,
  sessionId: number,
  companyId: number,
): Promise<void> {
  // Atualizar sessão com o paciente
  await db
    .update(chatSessions)
    .set({
      patientId,
      userType: 'patient',
      context: { patientAutoCreated: true, extractedAt: new Date().toISOString() },
    })
    .where(
      and(eq(chatSessions.id, sessionId), eq(chatSessions.companyId, companyId)),
    );

  // Vincular oportunidade CRM ao paciente (se existir)
  await db
    .update(salesOpportunities)
    .set({
      patientId,
      leadName: patientName,
    })
    .where(
      and(
        eq(salesOpportunities.chatSessionId, sessionId),
        eq(salesOpportunities.companyId, companyId),
      ),
    );
}
