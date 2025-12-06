/**
 * Chat Processor Service
 * Implementa arquitetura "Code First" para processamento de mensagens
 * 80% regex + 15% state machine + 5% AI (local RX 7900 XTX com fallback OpenAI)
 */

import { db } from '../db';
import { eq, and, desc, or, gte } from 'drizzle-orm';
import {
  chatSessions,
  chatMessages,
  cannedResponses,
  intentPatterns,
  patients,
  appointments,
  procedures,
  clinicSettings,
  companies,
  adminPhones,
  type ChatSession,
  type ChatMessage,
} from '@shared/schema';

// Tipos para o processador
export interface ProcessedMessage {
  intent: string;
  confidence: number;
  response: string;
  processedBy: 'regex' | 'state_machine' | 'ai' | 'fallback' | 'human_takeover';
  tokensUsed: number;
  nextState?: string;
  stateData?: Record<string, any>;
  requiresHumanTransfer?: boolean;
  isUrgency?: boolean;
  urgencyLevel?: 'low' | 'medium' | 'high' | 'critical';
  actions?: ChatAction[];
  skipResponse?: boolean; // Quando humano assumiu, não responde
}

export interface ChatAction {
  type: 'create_appointment' | 'confirm_appointment' | 'cancel_appointment' | 'transfer_to_human' | 'send_location' | 'send_prices' | 'notify_doctor_urgency' | 'human_takeover';
  data?: Record<string, any>;
}

// Tempo em minutos que a IA fica "em silêncio" após humano assumir
const HUMAN_TAKEOVER_TIMEOUT_MINUTES = 30;

export interface ChatContext {
  companyId: number;
  phone: string;
  patientId?: number;
  patientName?: string;
  sessionId?: number;
  currentState?: string;
  stateData?: Record<string, any>;
}

// Padrões de intent padrão (fallback se não houver no banco)
const DEFAULT_INTENT_PATTERNS: Record<string, RegExp[]> = {
  greeting: [
    /^(oi|ol[aá]|opa|bom dia|boa tarde|boa noite|e a[ií]|eai|fala|hey|hi|hello)/i,
  ],
  confirm: [
    /^(sim|confirmo|confirmado|ok|beleza|blz|pode ser|fechado|combinado|certo|s|yes)/i,
    /(confirmar|quero confirmar|vou sim|estarei l[aá])/i,
  ],
  cancel: [
    /^(n[aã]o|nop|cancelar|desmarcar|n|no)/i,
    /(cancelar|desmarcar|n[aã]o (vou|posso|consigo))/i,
  ],
  reschedule: [
    /(reagendar|remarcar|mudar|trocar|alterar).*(hor[aá]rio|data|dia|consulta)/i,
    /(outro|nova|diferente).*(hor[aá]rio|data|dia)/i,
  ],
  schedule: [
    /(agendar|marcar|consulta|atendimento|hor[aá]rio)/i,
    /(quero|gostaria|preciso).*(agendar|marcar|consulta)/i,
  ],
  price: [
    /(pre[cç]o|valor|quanto|custo|tabela)/i,
    /(quanto custa|qual o valor|pre[cç]o de)/i,
  ],
  location: [
    /(endere[cç]o|localiza[cç][aã]o|onde|como chego|mapa)/i,
    /(onde fica|qual o endere[cç]o)/i,
  ],
  hours: [
    /(hor[aá]rio|funcionamento|abre|fecha|atende)/i,
    /(que horas|at[eé] que horas)/i,
  ],
  emergency: [
    /(emerg[eê]ncia|urgente|dor|inchado|sangue|acidente|quebr)/i,
    /(preciso urgente|muita dor|n[aã]o aguento)/i,
  ],
  thanks: [
    /^(obrigad[oa]|valeu|agradec|thanks|thx|vlw)/i,
  ],
  goodbye: [
    /^(tchau|at[eé] mais|at[eé] logo|bye|flw|falou)/i,
  ],
  talk_to_human: [
    /(falar com|atendente|humano|pessoa|real|recep[cç][aã]o)/i,
    /(n[aã]o entend|preciso de ajuda|outro assunto)/i,
  ],
  review: [
    /(avalia[cç][aã]o|review|estrela|feedback)/i,
  ],
};

export class ChatProcessor {
  private companyId: number;
  private intentPatterns: Map<string, RegExp[]> = new Map();
  private settings: any = null;
  private company: any = null;

  constructor(companyId: number) {
    this.companyId = companyId;
  }

  /**
   * Inicializa o processador carregando padrões do banco
   */
  async initialize(): Promise<void> {
    // Carregar configurações da clínica
    const [settingsRow] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, this.companyId))
      .limit(1);

    this.settings = settingsRow;

    // Carregar dados da empresa
    const [companyRow] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, this.companyId))
      .limit(1);

    this.company = companyRow;

    // Carregar padrões de intent do banco
    const patterns = await db
      .select()
      .from(intentPatterns)
      .where(
        and(
          eq(intentPatterns.companyId, this.companyId),
          eq(intentPatterns.isActive, true)
        )
      );

    // Inicializar com padrões padrão
    for (const [intent, regexes] of Object.entries(DEFAULT_INTENT_PATTERNS)) {
      this.intentPatterns.set(intent, regexes);
    }

    // Sobrescrever com padrões customizados do banco
    for (const pattern of patterns) {
      const existing = this.intentPatterns.get(pattern.intent) || [];
      try {
        const regex = new RegExp(pattern.pattern, pattern.flags || 'i');
        existing.push(regex);
        this.intentPatterns.set(pattern.intent, existing);
      } catch (e) {
        console.error(`Invalid regex pattern for intent ${pattern.intent}:`, pattern.pattern);
      }
    }
  }

  /**
   * Classifica a intenção da mensagem usando regex
   */
  classifyIntent(message: string): { intent: string; confidence: number } {
    const normalizedMessage = message
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .trim();

    let bestMatch = { intent: 'unknown', confidence: 0 };

    for (const [intent, patterns] of this.intentPatterns.entries()) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedMessage)) {
          // Confiança baseada no tamanho do match vs tamanho da mensagem
          const match = normalizedMessage.match(pattern);
          if (match) {
            const confidence = Math.min(0.95, (match[0].length / normalizedMessage.length) + 0.5);
            if (confidence > bestMatch.confidence) {
              bestMatch = { intent, confidence };
            }
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * Busca ou cria uma sessão de chat
   */
  async getOrCreateSession(phone: string): Promise<ChatSession> {
    // Limpar telefone
    const cleanPhone = phone.replace(/[^\d+]/g, '');

    // Buscar sessão existente ativa
    const [existingSession] = await db
      .select()
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.companyId, this.companyId),
          eq(chatSessions.phone, cleanPhone),
          eq(chatSessions.status, 'active')
        )
      )
      .orderBy(desc(chatSessions.createdAt))
      .limit(1);

    if (existingSession) {
      // Atualizar lastMessageAt
      await db
        .update(chatSessions)
        .set({ lastMessageAt: new Date(), updatedAt: new Date() })
        .where(eq(chatSessions.id, existingSession.id));

      return existingSession;
    }

    // Buscar paciente pelo telefone
    const [patient] = await db
      .select()
      .from(patients)
      .where(
        and(
          eq(patients.companyId, this.companyId),
          or(
            eq(patients.whatsappPhone, cleanPhone),
            eq(patients.cellphone, cleanPhone),
            eq(patients.phone, cleanPhone)
          )
        )
      )
      .limit(1);

    // Criar nova sessão
    const [newSession] = await db
      .insert(chatSessions)
      .values({
        companyId: this.companyId,
        phone: cleanPhone,
        userType: patient ? 'patient' : 'unknown',
        patientId: patient?.id || null,
        status: 'active',
        currentState: null,
        stateData: {},
        context: {},
        lastMessageAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return newSession;
  }

  /**
   * Salva uma mensagem no histórico
   */
  async saveMessage(
    sessionId: number,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: {
      intent?: string;
      processedBy?: string;
      tokensUsed?: number;
      wuzapiMessageId?: string;
    }
  ): Promise<ChatMessage> {
    const [message] = await db
      .insert(chatMessages)
      .values({
        sessionId,
        role,
        content,
        messageType: 'text',
        intent: metadata?.intent || null,
        processedBy: metadata?.processedBy || null,
        tokensUsed: metadata?.tokensUsed || 0,
        wuzapiMessageId: metadata?.wuzapiMessageId || null,
        metadata: metadata || {},
        createdAt: new Date(),
      })
      .returning();

    return message;
  }

  /**
   * Atualiza o estado da máquina de estados
   */
  async updateSessionState(
    sessionId: number,
    state: string | null,
    stateData?: Record<string, any>
  ): Promise<void> {
    await db
      .update(chatSessions)
      .set({
        currentState: state,
        stateData: stateData || {},
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.id, sessionId));
  }

  /**
   * Busca resposta pronta do banco
   */
  async getCannedResponse(intent: string): Promise<string | null> {
    const [response] = await db
      .select()
      .from(cannedResponses)
      .where(
        and(
          eq(cannedResponses.companyId, this.companyId),
          eq(cannedResponses.intent, intent),
          eq(cannedResponses.isActive, true)
        )
      )
      .limit(1);

    if (response) {
      return this.interpolateTemplate(response.content);
    }

    return null;
  }

  /**
   * Interpola variáveis no template
   */
  interpolateTemplate(template: string, extraVars?: Record<string, any>): string {
    const vars: Record<string, string> = {
      '{{company.name}}': this.company?.name || 'Clínica',
      '{{company.phone}}': this.company?.phone || '',
      '{{company.address}}': this.company?.address || '',
      '{{settings.googleMapsLink}}': this.settings?.googleMapsLink || '',
      '{{settings.googleReviewLink}}': this.settings?.googleReviewLink || '',
      '{{settings.emergencyPhone}}': this.settings?.emergencyPhone || this.company?.phone || '',
      ...extraVars,
    };

    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value || '');
    }

    return result;
  }

  /**
   * Gera resposta padrão baseada no intent
   */
  getDefaultResponse(intent: string): string {
    const defaults: Record<string, string> = {
      greeting: `Olá! 👋 Seja bem-vindo(a) à ${this.company?.name || 'Clínica'}!\n\nComo posso ajudar você hoje?`,

      confirm: `✅ Perfeito! Sua consulta está confirmada.\n\nAguardamos você! 😊`,

      cancel: `❌ Ok, sua consulta foi cancelada.\n\nSe precisar remarcar, é só me avisar!`,

      price: `💰 Para informações sobre valores e procedimentos, entre em contato:\n📞 ${this.settings?.emergencyPhone || this.company?.phone || 'Telefone da clínica'}`,

      location: `📍 *Endereço:*\n${this.company?.address || 'Endereço da clínica'}\n\n${this.settings?.googleMapsLink ? `🗺️ Ver no mapa: ${this.settings.googleMapsLink}` : ''}`,

      hours: `🕐 *Horário de Funcionamento:*\n\nSegunda a Sexta: 08:00 - 18:00\nSábado: 08:00 - 12:00\n\n_Sujeito a alterações em feriados_`,

      emergency: `🚨 *Emergência?*\n\nLigue agora:\n📞 ${this.settings?.emergencyPhone || this.company?.phone || 'Telefone de emergência'}\n\nEstamos prontos para ajudar!`,

      thanks: `😊 Por nada! Estamos sempre à disposição.\n\nPrecisa de mais alguma coisa?`,

      goodbye: `Até logo! 👋\n\nFoi um prazer atendê-lo(a).\nQualquer dúvida, estamos aqui!`,

      talk_to_human: `👤 Entendi! Vou transferir você para um atendente.\n\nAguarde um momento, por favor.`,

      review: `⭐ Adoraríamos saber sua opinião!\n\n${this.settings?.googleReviewLink ? `Deixe sua avaliação: ${this.settings.googleReviewLink}` : 'Obrigado pelo feedback!'}`,

      unknown: `Desculpe, não entendi sua mensagem. 😅\n\nPosso ajudar com:\n• Agendar consulta\n• Confirmar/cancelar consulta\n• Informações sobre preços\n• Endereço e horário\n\nOu digite "atendente" para falar com uma pessoa.`,
    };

    return defaults[intent] || defaults.unknown;
  }

  /**
   * Processa uma mensagem (código principal)
   * @param fromMe - true se a mensagem foi enviada PELA clínica (secretária)
   */
  async processMessage(
    phone: string,
    message: string,
    wuzapiMessageId?: string,
    fromMe: boolean = false
  ): Promise<ProcessedMessage> {
    await this.initialize();

    // Obter ou criar sessão
    const session = await this.getOrCreateSession(phone);

    // =============================================
    // HUMAN TAKEOVER: Se mensagem é da SECRETÁRIA (fromMe=true)
    // =============================================
    if (fromMe) {
      // Secretária respondeu - marcar sessão como "humano assumiu"
      await this.setHumanTakeover(session.id);

      // Salvar mensagem como "assistant" (secretária respondendo)
      await this.saveMessage(session.id, 'assistant', message, {
        wuzapiMessageId,
        processedBy: 'human',
      });

      return {
        intent: 'human_response',
        confidence: 1,
        response: message,
        processedBy: 'human_takeover',
        tokensUsed: 0,
        skipResponse: true, // NÃO enviar resposta automática
      };
    }

    // =============================================
    // Verificar se HUMANO ASSUMIU a conversa
    // =============================================
    const isHumanActive = await this.isHumanTakeoverActive(session);
    if (isHumanActive) {
      // Salvar mensagem do usuário mas NÃO responder
      await this.saveMessage(session.id, 'user', message, { wuzapiMessageId });

      // Notificar secretária que paciente enviou nova mensagem
      return {
        intent: 'waiting_human',
        confidence: 1,
        response: '', // Sem resposta automática
        processedBy: 'human_takeover',
        tokensUsed: 0,
        skipResponse: true,
        actions: [{
          type: 'human_takeover',
          data: {
            reason: 'patient_message_while_human_active',
            sessionId: session.id,
            phone,
            message,
          },
        }],
      };
    }

    // Salvar mensagem do usuário
    await this.saveMessage(session.id, 'user', message, { wuzapiMessageId });

    // Verificar se está em um fluxo de estado
    if (session.currentState) {
      const stateResult = await this.processStateMachine(session, message);
      if (stateResult) {
        // Salvar resposta
        await this.saveMessage(session.id, 'assistant', stateResult.response, {
          intent: stateResult.intent,
          processedBy: stateResult.processedBy,
          tokensUsed: stateResult.tokensUsed,
        });

        return stateResult;
      }
    }

    // Classificar intent
    const { intent, confidence } = this.classifyIntent(message);

    // =============================================
    // URGÊNCIA: Detectar e notificar DOUTOR
    // =============================================
    const isUrgency = intent === 'emergency';
    let urgencyLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const actions: ChatAction[] = [];

    if (isUrgency) {
      urgencyLevel = this.detectUrgencyLevel(message);

      // Adicionar ação para notificar doutor
      actions.push({
        type: 'notify_doctor_urgency',
        data: {
          phone,
          message,
          urgencyLevel,
          patientName: session.patientId ? await this.getPatientName(session.patientId) : 'Paciente',
          sessionId: session.id,
        },
      });

      // Também transferir para humano
      actions.push({
        type: 'transfer_to_human',
        data: { reason: 'emergency', urgencyLevel },
      });
    }

    // Buscar resposta pronta
    let response = await this.getCannedResponse(intent);
    let processedBy: 'regex' | 'state_machine' | 'ai' | 'fallback' | 'human_takeover' = 'regex';

    // Se não encontrou resposta pronta, usar padrão
    if (!response) {
      response = this.getDefaultResponse(intent);
      processedBy = 'fallback';
    }

    // Humanizar resposta de urgência
    if (isUrgency) {
      response = this.getHumanizedEmergencyResponse(urgencyLevel);
    }

    // Verificar se precisa iniciar fluxo de estado
    const stateResult = await this.checkStateTransition(session, intent);
    if (stateResult) {
      response = stateResult.response;
      processedBy = 'state_machine';

      await this.updateSessionState(session.id, stateResult.nextState!, stateResult.stateData);
    }

    // Verificar se precisa transferir para humano
    const requiresHumanTransfer = intent === 'talk_to_human' || intent === 'emergency';

    if (requiresHumanTransfer && !isUrgency) {
      actions.push({
        type: 'transfer_to_human',
        data: { reason: intent },
      });
    }

    // Salvar resposta
    await this.saveMessage(session.id, 'assistant', response, {
      intent,
      processedBy,
      tokensUsed: 0,
    });

    return {
      intent,
      confidence,
      response,
      processedBy,
      tokensUsed: 0,
      requiresHumanTransfer,
      isUrgency,
      urgencyLevel: isUrgency ? urgencyLevel : undefined,
      nextState: stateResult?.nextState,
      stateData: stateResult?.stateData,
      actions: actions.length > 0 ? actions : undefined,
    };
  }

  /**
   * Marca sessão como "humano assumiu"
   */
  async setHumanTakeover(sessionId: number): Promise<void> {
    await db
      .update(chatSessions)
      .set({
        status: 'waiting_human',
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.id, sessionId));
  }

  /**
   * Verifica se humano está ativo na conversa
   */
  async isHumanTakeoverActive(session: ChatSession): Promise<boolean> {
    if (session.status !== 'waiting_human') {
      return false;
    }

    // Verificar se passou o timeout (30 min)
    const timeoutDate = new Date();
    timeoutDate.setMinutes(timeoutDate.getMinutes() - HUMAN_TAKEOVER_TIMEOUT_MINUTES);

    if (session.updatedAt && new Date(session.updatedAt) < timeoutDate) {
      // Timeout expirou - reativar IA
      await db
        .update(chatSessions)
        .set({ status: 'active', updatedAt: new Date() })
        .where(eq(chatSessions.id, session.id));
      return false;
    }

    return true;
  }

  /**
   * Libera sessão para IA voltar a responder
   */
  async releaseHumanTakeover(sessionId: number): Promise<void> {
    await db
      .update(chatSessions)
      .set({
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.id, sessionId));
  }

  /**
   * Detecta nível de urgência baseado na mensagem
   */
  detectUrgencyLevel(message: string): 'low' | 'medium' | 'high' | 'critical' {
    const msg = message.toLowerCase();

    // CRITICAL: Sangramento intenso, acidente, desmaiou
    if (/sangue|sangramento|acidente|desmaiou|inconsciente|n[aã]o para|muito sangue/i.test(msg)) {
      return 'critical';
    }

    // HIGH: Dor intensa, inchaço grande, febre alta
    if (/muita dor|dor forte|dor intensa|inchado demais|febre alta|n[aã]o aguento/i.test(msg)) {
      return 'high';
    }

    // MEDIUM: Dor moderada, desconforto
    if (/dor|doendo|incomodando|inchaço|desconforto/i.test(msg)) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Busca nome do paciente
   */
  async getPatientName(patientId: number): Promise<string> {
    const [patient] = await db
      .select({ fullName: patients.fullName })
      .from(patients)
      .where(eq(patients.id, patientId))
      .limit(1);

    return patient?.fullName || 'Paciente';
  }

  /**
   * Resposta humanizada para emergência
   */
  getHumanizedEmergencyResponse(urgencyLevel: 'low' | 'medium' | 'high' | 'critical'): string {
    const emergencyPhone = this.settings?.emergencyPhone || this.company?.phone || '';

    if (urgencyLevel === 'critical') {
      return `🚨 *EMERGÊNCIA DETECTADA*

Entendo que você está passando por uma situação muito difícil. Não se preocupe, vamos ajudar!

📞 *Ligue AGORA:* ${emergencyPhone}

Um profissional já foi notificado e entrará em contato imediatamente.

Se for muito grave, procure a emergência mais próxima.

_Estamos aqui com você_ ❤️`;
    }

    if (urgencyLevel === 'high') {
      return `🔴 *Situação Urgente*

Sinto muito que você está passando por isso! Vamos resolver juntos.

📞 *Ligue para nós:* ${emergencyPhone}

Já estou avisando a equipe sobre sua mensagem. Alguém entrará em contato muito em breve.

_Fique tranquilo(a), estamos cuidando de você_ 💙`;
    }

    if (urgencyLevel === 'medium') {
      return `⚠️ *Precisando de Ajuda?*

Entendi que você está com desconforto. Vamos resolver isso!

📞 Ligue: ${emergencyPhone}

Ou aguarde que um atendente vai entrar em contato em breve.

_Estamos aqui para ajudar!_ 😊`;
    }

    return `Entendi sua situação. Um membro da nossa equipe vai entrar em contato para ajudar você.

📞 Ou ligue: ${emergencyPhone}

_Aguarde um momento, por favor._`;
  }

  /**
   * Processa máquina de estados
   */
  async processStateMachine(
    session: ChatSession,
    message: string
  ): Promise<ProcessedMessage | null> {
    const state = session.currentState;
    const stateData = (session.stateData as Record<string, any>) || {};

    switch (state) {
      case 'scheduling_procedure':
        return this.handleSchedulingProcedure(session, message, stateData);

      case 'scheduling_date':
        return this.handleSchedulingDate(session, message, stateData);

      case 'scheduling_time':
        return this.handleSchedulingTime(session, message, stateData);

      case 'scheduling_confirm':
        return this.handleSchedulingConfirm(session, message, stateData);

      case 'waiting_reschedule_date':
        return this.handleRescheduleDate(session, message, stateData);

      default:
        // Estado desconhecido, limpar
        await this.updateSessionState(session.id, null);
        return null;
    }
  }

  /**
   * Verifica se precisa iniciar um fluxo de estado
   */
  async checkStateTransition(
    session: ChatSession,
    intent: string
  ): Promise<{ response: string; nextState: string; stateData: Record<string, any> } | null> {
    if (intent === 'schedule') {
      // Iniciar fluxo de agendamento
      const proceduresList = await db
        .select()
        .from(procedures)
        .where(eq(procedures.companyId, this.companyId))
        .limit(10);

      if (proceduresList.length === 0) {
        return {
          response: `Para agendar, entre em contato:\n📞 ${this.company?.phone}`,
          nextState: '',
          stateData: {},
        };
      }

      const proceduresText = proceduresList
        .map((p: { name: string }, i: number) => `${i + 1}. ${p.name}`)
        .join('\n');

      return {
        response: `📅 *Agendamento de Consulta*\n\nQual procedimento você deseja agendar?\n\n${proceduresText}\n\n_Digite o número ou nome do procedimento_`,
        nextState: 'scheduling_procedure',
        stateData: { procedures: proceduresList },
      };
    }

    if (intent === 'reschedule') {
      // Verificar se tem consulta agendada
      if (session.patientId) {
        const [appointment] = await db
          .select()
          .from(appointments)
          .where(
            and(
              eq(appointments.patientId, session.patientId),
              eq(appointments.companyId, this.companyId)
            )
          )
          .orderBy(desc(appointments.startTime))
          .limit(1);

        if (appointment) {
          return {
            response: `🔄 *Reagendamento*\n\nPara qual data você gostaria de remarcar?\n\n_Informe a data desejada (ex: 15/01, próxima segunda)_`,
            nextState: 'waiting_reschedule_date',
            stateData: { appointmentId: appointment.id },
          };
        }
      }

      return {
        response: `Para reagendar, entre em contato:\n📞 ${this.company?.phone}`,
        nextState: '',
        stateData: {},
      };
    }

    return null;
  }

  // Handlers da máquina de estados
  async handleSchedulingProcedure(
    session: ChatSession,
    message: string,
    stateData: Record<string, any>
  ): Promise<ProcessedMessage> {
    const proceduresList = stateData.procedures || [];
    const input = message.trim();

    // Tentar encontrar por número
    const num = parseInt(input);
    let selectedProcedure = null;

    if (!isNaN(num) && num > 0 && num <= proceduresList.length) {
      selectedProcedure = proceduresList[num - 1];
    } else {
      // Tentar encontrar por nome
      selectedProcedure = proceduresList.find((p: any) =>
        p.name.toLowerCase().includes(input.toLowerCase())
      );
    }

    if (!selectedProcedure) {
      return {
        intent: 'schedule',
        confidence: 1,
        response: `Não encontrei esse procedimento. Por favor, escolha uma opção da lista:\n\n${proceduresList.map((p: any, i: number) => `${i + 1}. ${p.name}`).join('\n')}`,
        processedBy: 'state_machine',
        tokensUsed: 0,
      };
    }

    // Avançar para próximo estado
    await this.updateSessionState(session.id, 'scheduling_date', {
      ...stateData,
      procedureId: selectedProcedure.id,
      procedureName: selectedProcedure.name,
    });

    return {
      intent: 'schedule',
      confidence: 1,
      response: `✅ *${selectedProcedure.name}*\n\nPara qual data você gostaria de agendar?\n\n_Informe a data desejada (ex: 15/01, próxima segunda, amanhã)_`,
      processedBy: 'state_machine',
      tokensUsed: 0,
      nextState: 'scheduling_date',
      stateData: { procedureId: selectedProcedure.id, procedureName: selectedProcedure.name },
    };
  }

  async handleSchedulingDate(
    session: ChatSession,
    message: string,
    stateData: Record<string, any>
  ): Promise<ProcessedMessage> {
    // Parsing simples de data (pode ser melhorado)
    const dateStr = message.trim();
    let targetDate: Date | null = null;

    // Tentar parsear formatos comuns
    if (/amanh[ãa]/i.test(dateStr)) {
      targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 1);
    } else if (/hoje/i.test(dateStr)) {
      targetDate = new Date();
    } else if (/pr[oó]xim[ao]?\s*(segunda|ter[çc]a|quarta|quinta|sexta|s[aá]bado)/i.test(dateStr)) {
      const days = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
      const match = dateStr.toLowerCase().match(/segunda|ter[çc]a|quarta|quinta|sexta|s[aá]bado/);
      if (match) {
        const dayName = match[0].replace('ç', 'c').replace('á', 'a');
        const targetDayIndex = days.findIndex(d => d.includes(dayName.substring(0, 3)));
        targetDate = new Date();
        const currentDay = targetDate.getDay();
        let daysToAdd = targetDayIndex - currentDay;
        if (daysToAdd <= 0) daysToAdd += 7;
        targetDate.setDate(targetDate.getDate() + daysToAdd);
      }
    } else {
      // Tentar formato DD/MM
      const dateMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
      if (dateMatch) {
        const day = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]) - 1;
        const year = dateMatch[3] ? parseInt(dateMatch[3]) : new Date().getFullYear();
        targetDate = new Date(year < 100 ? 2000 + year : year, month, day);
      }
    }

    if (!targetDate || isNaN(targetDate.getTime())) {
      return {
        intent: 'schedule',
        confidence: 1,
        response: `Não consegui entender a data. Por favor, informe no formato:\n\n• DD/MM (ex: 15/01)\n• "amanhã"\n• "próxima segunda"`,
        processedBy: 'state_machine',
        tokensUsed: 0,
      };
    }

    // Verificar se é data futura
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (targetDate < today) {
      return {
        intent: 'schedule',
        confidence: 1,
        response: `A data precisa ser futura. Por favor, escolha outra data.`,
        processedBy: 'state_machine',
        tokensUsed: 0,
      };
    }

    // Avançar para seleção de horário
    const formattedDate = targetDate.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });

    await this.updateSessionState(session.id, 'scheduling_time', {
      ...stateData,
      date: targetDate.toISOString().split('T')[0],
      formattedDate,
    });

    return {
      intent: 'schedule',
      confidence: 1,
      response: `📅 *${formattedDate}*\n\nQual horário você prefere?\n\n• Manhã (08:00 - 12:00)\n• Tarde (14:00 - 18:00)\n\n_Ou informe o horário específico (ex: 10:00, 15:30)_`,
      processedBy: 'state_machine',
      tokensUsed: 0,
      nextState: 'scheduling_time',
    };
  }

  async handleSchedulingTime(
    session: ChatSession,
    message: string,
    stateData: Record<string, any>
  ): Promise<ProcessedMessage> {
    const timeStr = message.trim().toLowerCase();
    let hour = 0;
    let minute = 0;

    // Tentar parsear horário
    if (/manh[ãa]/i.test(timeStr)) {
      hour = 9;
      minute = 0;
    } else if (/tarde/i.test(timeStr)) {
      hour = 14;
      minute = 0;
    } else {
      const timeMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?/);
      if (timeMatch) {
        hour = parseInt(timeMatch[1]);
        minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      }
    }

    // Validar horário
    if (hour < 7 || hour > 20) {
      return {
        intent: 'schedule',
        confidence: 1,
        response: `Esse horário não está disponível. Nosso atendimento é das 08:00 às 18:00.\n\nPor favor, escolha outro horário.`,
        processedBy: 'state_machine',
        tokensUsed: 0,
      };
    }

    const formattedTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

    // Ir para confirmação
    await this.updateSessionState(session.id, 'scheduling_confirm', {
      ...stateData,
      time: formattedTime,
    });

    const { procedureName, formattedDate } = stateData;

    return {
      intent: 'schedule',
      confidence: 1,
      response: `📋 *Confirme seu agendamento:*\n\n🏥 *Procedimento:* ${procedureName}\n📅 *Data:* ${formattedDate}\n⏰ *Horário:* ${formattedTime}\n\nDeseja confirmar? Responda *SIM* ou *NÃO*`,
      processedBy: 'state_machine',
      tokensUsed: 0,
      nextState: 'scheduling_confirm',
    };
  }

  async handleSchedulingConfirm(
    session: ChatSession,
    message: string,
    stateData: Record<string, any>
  ): Promise<ProcessedMessage> {
    const { intent } = this.classifyIntent(message);

    if (intent === 'confirm') {
      // Limpar estado e criar ação de agendamento
      await this.updateSessionState(session.id, null);

      return {
        intent: 'schedule',
        confidence: 1,
        response: `✅ *Agendamento Solicitado!*\n\nEm breve você receberá a confirmação.\n\nObrigado por agendar com a ${this.company?.name}! 😊`,
        processedBy: 'state_machine',
        tokensUsed: 0,
        actions: [
          {
            type: 'create_appointment',
            data: {
              patientId: session.patientId,
              phone: session.phone,
              procedureId: stateData.procedureId,
              date: stateData.date,
              time: stateData.time,
            },
          },
        ],
      };
    } else if (intent === 'cancel') {
      await this.updateSessionState(session.id, null);

      return {
        intent: 'cancel',
        confidence: 1,
        response: `❌ Agendamento cancelado.\n\nSe precisar de algo, é só chamar!`,
        processedBy: 'state_machine',
        tokensUsed: 0,
      };
    }

    return {
      intent: 'schedule',
      confidence: 1,
      response: `Por favor, responda *SIM* para confirmar ou *NÃO* para cancelar.`,
      processedBy: 'state_machine',
      tokensUsed: 0,
    };
  }

  async handleRescheduleDate(
    session: ChatSession,
    message: string,
    stateData: Record<string, any>
  ): Promise<ProcessedMessage> {
    // Similar ao handleSchedulingDate mas para reagendamento
    await this.updateSessionState(session.id, null);

    return {
      intent: 'reschedule',
      confidence: 1,
      response: `🔄 Solicitação de reagendamento recebida!\n\nEntraremos em contato para confirmar o novo horário.\n\n📞 Ou ligue: ${this.company?.phone}`,
      processedBy: 'state_machine',
      tokensUsed: 0,
      actions: [
        {
          type: 'transfer_to_human',
          data: {
            reason: 'reschedule_request',
            appointmentId: stateData.appointmentId,
            requestedDate: message,
          },
        },
      ],
    };
  }
}

// Factory function
export function createChatProcessor(companyId: number): ChatProcessor {
  return new ChatProcessor(companyId);
}
