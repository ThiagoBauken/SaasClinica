/**
 * Serviço de Conversa Inteligente
 *
 * Regras:
 * 1. Menu só aparece na PRIMEIRA saudação da sessão
 * 2. Depois entende texto livre sem precisar de números
 * 3. Debounce de 5s para aguardar mensagens complementares
 * 4. Contexto da conversa mantido entre mensagens
 */

import {
  ConversationStyleConfig,
  ConversationContext,
  getGreeting,
} from './conversation-style.service';

// ==========================================
// CONFIGURAÇÃO ESTENDIDA COM REGRAS DE NEGÓCIO
// ==========================================

export interface ExtendedConversationConfig extends ConversationStyleConfig {
  priceDisclosurePolicy?: 'always' | 'never_chat' | 'only_general';
  schedulingPolicy?: 'immediate' | 'appointment_required' | 'callback';
  clinicPhone?: string;
}

// ==========================================
// TIPOS
// ==========================================

export interface MessageBuffer {
  companyId: number;
  phone: string;
  messages: Array<{
    text: string;
    timestamp: Date;
  }>;
  timeoutId?: NodeJS.Timeout;
  isFirstMessage: boolean; // Primeira msg da sessão?
}

export interface ProcessedMessage {
  combinedText: string;
  messageCount: number;
  shouldShowMenu: boolean;
  intent: string;
  confidence: number;
}

export interface SmartResponse {
  text: string;
  shouldWait: boolean; // Esperar mais mensagens?
  waitMs: number;
  intent: string;
  awaitingResponse?: string;
}

// ==========================================
// BUFFER DE MENSAGENS (para debounce)
// ==========================================

const messageBuffers = new Map<string, MessageBuffer>();
export const DEBOUNCE_MS = 5000; // 5 segundos

/**
 * Adiciona mensagem ao buffer e retorna se deve processar agora
 */
export function addToBuffer(
  companyId: number,
  phone: string,
  text: string,
  isFirstMessage: boolean
): { shouldProcess: boolean; buffer: MessageBuffer } {
  const key = `${companyId}:${phone}`;

  let buffer = messageBuffers.get(key);

  if (!buffer) {
    buffer = {
      companyId,
      phone,
      messages: [],
      isFirstMessage,
    };
    messageBuffers.set(key, buffer);
  }

  // Adicionar mensagem
  buffer.messages.push({
    text,
    timestamp: new Date(),
  });

  // Cancelar timeout anterior
  if (buffer.timeoutId) {
    clearTimeout(buffer.timeoutId);
  }

  return { shouldProcess: false, buffer };
}

/**
 * Processa buffer e limpa
 */
export function processBuffer(companyId: number, phone: string): ProcessedMessage | null {
  const key = `${companyId}:${phone}`;
  const buffer = messageBuffers.get(key);

  if (!buffer || buffer.messages.length === 0) {
    return null;
  }

  // Combinar todas as mensagens
  const combinedText = buffer.messages
    .map(m => m.text)
    .join(' ')
    .trim();

  const messageCount = buffer.messages.length;
  const isFirstMessage = buffer.isFirstMessage;

  // Limpar buffer
  messageBuffers.delete(key);

  // Classificar intent
  const classification = classifyIntent(combinedText);

  // Menu só na PRIMEIRA saudação da sessão
  const shouldShowMenu = isFirstMessage && classification.intent === 'GREETING';

  return {
    combinedText,
    messageCount,
    shouldShowMenu,
    intent: classification.intent,
    confidence: classification.confidence,
  };
}

/**
 * Limpa buffer sem processar
 */
export function clearBuffer(companyId: number, phone: string): void {
  const key = `${companyId}:${phone}`;
  const buffer = messageBuffers.get(key);

  if (buffer?.timeoutId) {
    clearTimeout(buffer.timeoutId);
  }

  messageBuffers.delete(key);
}

// ==========================================
// CLASSIFICADOR INTELIGENTE
// ==========================================

interface IntentClassification {
  intent: string;
  confidence: number;
  entities: Record<string, any>;
  matchedPattern?: string;
}

/**
 * Classifica intent com suporte a texto livre
 */
export function classifyIntent(text: string): IntentClassification {
  const normalized = text.toLowerCase().trim();

  // Extrair entidades primeiro
  const entities = extractEntities(normalized);

  // Padrões ordenados por prioridade
  const intentPatterns: Array<{
    intent: string;
    patterns: RegExp[];
    priority: number;
  }> = [
    // EMERGÊNCIA - Máxima prioridade
    {
      intent: 'EMERGENCY',
      patterns: [
        /urgente|emerg[eê]ncia|dor\s*(forte|muito|intensa)|sangr(ando|amento)|inchaço|acidente|quebr(ei|ou)\s*(dente|o\s*dente)|caiu\s*(o\s*)?dente|abscess?o/i,
      ],
      priority: 100,
    },
    // HUMAN TAKEOVER
    {
      intent: 'HUMAN_TAKEOVER',
      patterns: [
        /falar\s*(com)?\s*(uma?\s*)?(pessoa|humano|atendente|funcionario|recepcionista)|atendimento\s*humano|quero\s*falar\s*com|preciso\s*falar/i,
      ],
      priority: 95,
    },
    // RECLAMAÇÃO
    {
      intent: 'COMPLAINT',
      patterns: [
        /reclamar|reclama[çc][aã]o|insatisf|problema\s*(com|no)|p[ée]ssim|horr[íi]vel|n[aã]o\s*gostei|decep/i,
      ],
      priority: 90,
    },
    // CANCELAR - Alta prioridade
    {
      intent: 'CANCEL',
      patterns: [
        /cancel(ar|o|ei|a)|desmarc(ar|o|a|uei)|n[aã]o\s*(vou|posso|consigo)\s*(ir|comparecer)|desist/i,
      ],
      priority: 85,
    },
    // REAGENDAR
    {
      intent: 'RESCHEDULE',
      patterns: [
        /reag(endar|endo)|remarc(ar|o|a)|mud(ar|o|a)\s*(hor[aá]rio|data)|outro\s*(dia|hor[aá]rio)|trocar\s*(hor[aá]rio|data)|alterar\s*(hor[aá]rio|data)/i,
      ],
      priority: 80,
    },
    // CONFIRMAR AGENDAMENTO
    {
      intent: 'CONFIRM',
      patterns: [
        /^(sim|s|yes|ok|confirmo?|isso|perfeito|certo|fechado|blz|beleza|pode\s*ser|positivo|t[aá]\s*bom|combinado)[!?\s,.]*$/i,
        /confirm(ar|o|a)\s*(consulta|agendamento|hor[aá]rio)?/i,
        /vou\s*(sim|comparecer|estar\s*l[aá])/i,
      ],
      priority: 75,
    },
    // NEGAR/RECUSAR
    {
      intent: 'DENY',
      patterns: [
        /^(n[aã]o|n|no|nope|negativo|nada)[!?\s,.]*$/i,
        /n[aã]o\s*(quero|preciso|obrigad)/i,
      ],
      priority: 75,
    },
    // AGENDAR - Texto livre
    {
      intent: 'SCHEDULE',
      patterns: [
        /agend(ar|o|a|amento)|marc(ar|o|a)|hor[aá]rio|dispon[íi]vel|vag(a|as)|atend(er|imento)|consult(a|ar)|quero\s*marc|preciso\s*(marc|agend)|quero\s*uma?\s*consult/i,
        /tem\s*(hor[aá]rio|vaga|agenda)/i,
        /posso\s*marc/i,
        /gostaria\s*de\s*(marc|agend|uma?\s*consult)/i,
      ],
      priority: 70,
    },
    // ORTODONTIA
    {
      intent: 'ORTHODONTIC',
      patterns: [
        /orto(dont|donti|d[oô]nti)|aparelho|manuten[çc][aã]o|ajust(e|ar)|trocar\s*(borracha|ligadura|el[aá]stico)|m[eê]s\s*do\s*aparelho/i,
      ],
      priority: 65,
    },
    // VER AGENDAMENTOS
    {
      intent: 'VIEW_APPOINTMENTS',
      patterns: [
        /meu(s)?\s*(agendamento|consulta|hor[aá]rio)|quando\s*([eé]|tenho)|pr[oó]xim[oa]\s*consult|ver\s*(minha|meus)\s*(consulta|agendamento)|minhas?\s*consultas?/i,
        /qual\s*(dia|hor[aá]rio)\s*(da\s*minha|[eé]\s*minha)/i,
        /tenho\s*(alguma?|consulta)/i,
      ],
      priority: 60,
    },
    // SAUDAÇÃO - Só como primeira msg
    {
      intent: 'GREETING',
      patterns: [
        /^(oi+|ol[aá]|hey|e\s*a[íi]|opa|bom\s*dia|boa\s*tarde|boa\s*noite|eae|fala|tudo\s*bem|td\s*bem|como\s*vai|salve|alou)[!?\s,.]*$/i,
      ],
      priority: 55,
    },
    // DESPEDIDA
    {
      intent: 'GOODBYE',
      patterns: [
        /^(tchau|xau|at[eé]|adeus|vlw|valeu|falou|flw|brigad[oa]|obrigad[oa]|thanks|bye)[!?\s,.]*$/i,
        /at[eé]\s*(mais|logo|a\s*pr[oó]xima)/i,
      ],
      priority: 50,
    },
    // INFO - Horários
    {
      intent: 'INFO_HOURS',
      patterns: [
        /hor[aá]rio\s*(de)?\s*funcionamento|que\s*horas?\s*(abre|fecha|funciona)|hora\s*de\s*(abrir|fechar)|aberto|fechado|funciona\s*(at[eé]|quando)/i,
      ],
      priority: 45,
    },
    // INFO - Endereço
    {
      intent: 'INFO_ADDRESS',
      patterns: [
        /endere[çc]o|onde\s*(fica|[eé]|localiza)|localiza[çc][aã]o|como\s*(chego|chegar)|mapa|qual\s*o\s*endere/i,
      ],
      priority: 45,
    },
    // INFO - Preço
    {
      intent: 'INFO_PRICE',
      patterns: [
        /pre[çc]o|valor|quanto\s*custa|custo|or[çc]amento|tabela\s*de\s*pre[çc]os?|quanto\s*[eé]/i,
      ],
      priority: 45,
    },
    // INFO - Procedimentos
    {
      intent: 'INFO_PROCEDURES',
      patterns: [
        /procedimento|tratamento|servi[çc]o|o\s*que\s*(voc[eê]s|voces)\s*fazem|especialidade|fazem\s*(clareamento|canal|extra[çc][aã]o|limpeza)/i,
      ],
      priority: 45,
    },
    // FEEDBACK POSITIVO
    {
      intent: 'FEEDBACK_POSITIVE',
      patterns: [
        /muito\s*bom|excelente|[oó]timo|perfeito|adorei|amei|maravilh|parab[eé]ns|recomend|5\s*estrelas/i,
      ],
      priority: 40,
    },
    // SELEÇÃO DE NÚMERO (menu)
    {
      intent: 'MENU_SELECTION',
      patterns: [
        /^[1-9]$/,
        /^op[çc][aã]o\s*[1-9]$/i,
      ],
      priority: 35,
    },
  ];

  // Buscar melhor match
  let bestMatch: IntentClassification = {
    intent: 'UNKNOWN',
    confidence: 0,
    entities,
  };

  for (const { intent, patterns, priority } of intentPatterns) {
    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        const confidence = priority / 100;
        if (confidence > bestMatch.confidence) {
          bestMatch = {
            intent,
            confidence,
            entities,
            matchedPattern: pattern.source,
          };
        }
        break;
      }
    }
  }

  // Se tem entidades de data/hora, aumentar confiança de SCHEDULE
  if (bestMatch.intent === 'UNKNOWN' && (entities.date || entities.time)) {
    bestMatch.intent = 'SCHEDULE';
    bestMatch.confidence = 0.5;
  }

  return bestMatch;
}

/**
 * Extrai entidades do texto (datas, horários, etc)
 */
export function extractEntities(text: string): Record<string, any> {
  const entities: Record<string, any> = {};
  const normalized = text.toLowerCase();

  // Data relativa
  const datePatterns: Record<string, number> = {
    'hoje': 0,
    'amanha': 1,
    'amanhã': 1,
    'depois de amanha': 2,
    'depois de amanhã': 2,
  };

  for (const [pattern, offset] of Object.entries(datePatterns)) {
    if (normalized.includes(pattern)) {
      const date = new Date();
      date.setDate(date.getDate() + offset);
      entities.date = date.toISOString().split('T')[0];
      entities.dateRelative = pattern;
      break;
    }
  }

  // Dia da semana
  const weekDays: Record<string, number> = {
    'segunda': 1, 'segunda-feira': 1,
    'terça': 2, 'terca': 2, 'terça-feira': 2,
    'quarta': 3, 'quarta-feira': 3,
    'quinta': 4, 'quinta-feira': 4,
    'sexta': 5, 'sexta-feira': 5,
    'sábado': 6, 'sabado': 6,
  };

  for (const [day, dayOfWeek] of Object.entries(weekDays)) {
    if (normalized.includes(day)) {
      const date = new Date();
      const currentDay = date.getDay();
      let daysUntil = dayOfWeek - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      date.setDate(date.getDate() + daysUntil);
      entities.date = date.toISOString().split('T')[0];
      entities.dayOfWeek = day;
      break;
    }
  }

  // Data DD/MM
  const dateMatch = normalized.match(/(\d{1,2})[\/\-](\d{1,2})/);
  if (dateMatch && !entities.date) {
    const day = parseInt(dateMatch[1]);
    const month = parseInt(dateMatch[2]) - 1;
    const date = new Date();
    date.setMonth(month, day);
    if (date < new Date()) {
      date.setFullYear(date.getFullYear() + 1);
    }
    entities.date = date.toISOString().split('T')[0];
  }

  // Horário
  const timeMatch = normalized.match(/(\d{1,2})(?:[:\s]?(\d{2}))?\s*(?:h|hrs?|horas?)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;

    // Ajustar período
    if (normalized.includes('tarde') && hours < 12) hours += 12;
    if (normalized.includes('noite') && hours < 18) hours += 12;
    if (hours >= 0 && hours <= 23) {
      entities.time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
  }

  // Período preferido
  if (normalized.includes('manhã') || normalized.includes('manha')) {
    entities.preferredPeriod = 'morning';
  } else if (normalized.includes('tarde')) {
    entities.preferredPeriod = 'afternoon';
  } else if (normalized.includes('noite')) {
    entities.preferredPeriod = 'evening';
  }

  // Número (para seleção de menu ou slot)
  const numberMatch = normalized.match(/^(\d+)$/);
  if (numberMatch) {
    entities.selectedNumber = parseInt(numberMatch[1]);
  }

  return entities;
}

// ==========================================
// GERADOR DE RESPOSTAS INTELIGENTES
// ==========================================

/**
 * Gera resposta baseada no contexto e intent
 * Menu só aparece na PRIMEIRA saudação
 */
export function generateSmartResponse(
  config: ConversationStyleConfig,
  context: ConversationContext & { isFirstMessage?: boolean; sessionMessageCount?: number },
  processed: ProcessedMessage
): SmartResponse {
  const { intent, shouldShowMenu, entities } = processed as ProcessedMessage & { entities?: Record<string, any> };
  const name = context.patientName || '';
  const emoji = config.useEmojis;
  const greeting = getGreeting(config);

  // Se é GREETING e primeira mensagem da sessão
  if (intent === 'GREETING' && shouldShowMenu) {
    if (config.conversationStyle === 'menu') {
      return {
        text: `${greeting}${name ? `, ${name}` : ''}${emoji ? ' 👋' : ''}

Seja bem-vindo(a) à *${config.companyName}*!

Como posso ajudar?

1️⃣ Agendar consulta
2️⃣ Ver meus agendamentos
3️⃣ Informações
4️⃣ Falar com atendente`,
        shouldWait: false,
        waitMs: 0,
        intent,
      };
    } else {
      // Humanizado
      const botIntro = config.botName !== 'Assistente'
        ? `Aqui é ${config.botName.startsWith('a') ? 'a' : 'o'} ${config.botName}, da ${config.companyName}.`
        : `Sou da ${config.companyName}.`;

      const endings = {
        professional: 'Em que posso ajudá-lo(a) hoje?',
        friendly: 'Em que posso te ajudar?',
        casual: 'Como posso te ajudar?',
      };

      return {
        text: `${greeting}${name ? `, ${name}` : ''}! Tudo bem?
${botIntro}
${endings[config.botPersonality]}`,
        shouldWait: false,
        waitMs: 0,
        intent,
      };
    }
  }

  // GREETING mas NÃO é primeira mensagem - só responder brevemente
  if (intent === 'GREETING' && !shouldShowMenu) {
    const responses = {
      professional: `${greeting}${name ? `, ${name}` : ''}! Como posso ajudar?`,
      friendly: `${greeting}${name ? `, ${name}` : ''}! ${emoji ? '😊 ' : ''}O que precisa?`,
      casual: `E aí${name ? `, ${name}` : ''}! ${emoji ? '👋 ' : ''}Fala!`,
    };
    return {
      text: responses[config.botPersonality],
      shouldWait: false,
      waitMs: 0,
      intent,
    };
  }

  // SCHEDULE - Agendar
  if (intent === 'SCHEDULE') {
    if (config.conversationStyle === 'menu') {
      return {
        text: `${emoji ? '📅 ' : ''}Vou verificar os horários disponíveis para você${name ? `, ${name}` : ''}!

Qual sua preferência de dia?`,
        shouldWait: false,
        waitMs: 0,
        intent,
        awaitingResponse: 'schedule_date',
      };
    } else {
      const responses = {
        professional: `Claro${name ? `, ${name}` : ''}! Vou verificar nossa agenda. Tem preferência de dia ou horário?`,
        friendly: `Opa${name ? `, ${name}` : ''}! ${emoji ? '😊 ' : ''}Vou ver os horários pra você! Tem algum dia que prefere?`,
        casual: `Beleza${name ? `, ${name}` : ''}! ${emoji ? '👍 ' : ''}Qual dia fica bom pra ti?`,
      };
      return {
        text: responses[config.botPersonality],
        shouldWait: false,
        waitMs: 0,
        intent,
        awaitingResponse: 'schedule_date',
      };
    }
  }

  // CONFIRM - Confirmar agendamento
  if (intent === 'CONFIRM') {
    if (config.conversationStyle === 'menu') {
      return {
        text: `${emoji ? '✅ ' : ''}Perfeito${name ? `, ${name}` : ''}!

Sua consulta está *CONFIRMADA*!

${emoji ? '📍 ' : ''}Te esperamos!

*${config.companyName}*`,
        shouldWait: false,
        waitMs: 0,
        intent,
      };
    } else {
      const responses = {
        professional: `Confirmado${name ? `, ${name}` : ''}! Estaremos te esperando. Qualquer dúvida, é só chamar. Até lá!`,
        friendly: `Perfeito${name ? `, ${name}` : ''}! ${emoji ? '😊 ' : ''}Tá tudo certo! Te esperamos com carinho. Até breve!`,
        casual: `Show${name ? `, ${name}` : ''}! ${emoji ? '👍 ' : ''}Tamo junto! Até lá!`,
      };
      return {
        text: responses[config.botPersonality],
        shouldWait: false,
        waitMs: 0,
        intent,
      };
    }
  }

  // CANCEL - Cancelar
  if (intent === 'CANCEL') {
    const responses = {
      professional: `Entendido${name ? `, ${name}` : ''}. Vou cancelar seu agendamento. Gostaria de remarcar para outro dia?`,
      friendly: `Tudo bem${name ? `, ${name}` : ''}! ${emoji ? '😊 ' : ''}Cancelei aqui. Quer marcar pra outro dia?`,
      casual: `Beleza${name ? `, ${name}` : ''}! Cancelado. Quer remarcar?`,
    };
    return {
      text: responses[config.botPersonality],
      shouldWait: false,
      waitMs: 0,
      intent,
      awaitingResponse: 'reschedule_confirm',
    };
  }

  // RESCHEDULE - Reagendar
  if (intent === 'RESCHEDULE') {
    const responses = {
      professional: `Claro${name ? `, ${name}` : ''}! Vou verificar outros horários. Qual dia seria melhor para você?`,
      friendly: `Sem problemas${name ? `, ${name}` : ''}! ${emoji ? '📅 ' : ''}Vou ver outros horários. Qual dia prefere?`,
      casual: `Tranquilo${name ? `, ${name}` : ''}! Qual dia fica melhor?`,
    };
    return {
      text: responses[config.botPersonality],
      shouldWait: false,
      waitMs: 0,
      intent,
      awaitingResponse: 'schedule_date',
    };
  }

  // VIEW_APPOINTMENTS - Ver agendamentos
  if (intent === 'VIEW_APPOINTMENTS') {
    return {
      text: `${emoji ? '📋 ' : ''}Vou verificar seus agendamentos${name ? `, ${name}` : ''}...`,
      shouldWait: false,
      waitMs: 0,
      intent,
    };
  }

  // ORTHODONTIC - Ortodontia
  if (intent === 'ORTHODONTIC') {
    const responses = {
      professional: `${name || 'Olá'}! Vou verificar sua próxima manutenção ortodôntica. Um momento...`,
      friendly: `${name || 'Oi'}! ${emoji ? '🦷 ' : ''}Vou ver aqui sua manutenção do aparelho!`,
      casual: `E aí${name ? `, ${name}` : ''}! Manutenção do aparelho né? Deixa eu ver aqui...`,
    };
    return {
      text: responses[config.botPersonality],
      shouldWait: false,
      waitMs: 0,
      intent,
    };
  }

  // EMERGENCY - Emergência
  if (intent === 'EMERGENCY') {
    return {
      text: `${emoji ? '🚨 ' : ''}${name || 'Olá'}, entendo que é urgente!

Estou acionando nossa equipe e alguém vai entrar em contato com você nos próximos minutos.

Fique tranquilo(a), vamos te ajudar!`,
      shouldWait: false,
      waitMs: 0,
      intent,
    };
  }

  // HUMAN_TAKEOVER - Falar com atendente
  if (intent === 'HUMAN_TAKEOVER') {
    return {
      text: `${name || 'Olá'}! Vou transferir você para um de nossos atendentes.

${emoji ? '⏳ ' : ''}Aguarde um momento que já já alguém te responde!`,
      shouldWait: false,
      waitMs: 0,
      intent,
    };
  }

  // COMPLAINT - Reclamação
  if (intent === 'COMPLAINT') {
    return {
      text: `${name || 'Olá'}, sinto muito pelo ocorrido! ${emoji ? '😔' : ''}

Vou encaminhar sua mensagem para nossa equipe resolver isso o mais rápido possível.

Alguém entrará em contato com você em breve.`,
      shouldWait: false,
      waitMs: 0,
      intent,
    };
  }

  // GOODBYE - Despedida
  if (intent === 'GOODBYE') {
    const responses = {
      professional: `Foi um prazer atendê-lo(a)${name ? `, ${name}` : ''}. Qualquer dúvida, estamos à disposição. Tenha um ótimo dia!`,
      friendly: `Tchau${name ? `, ${name}` : ''}! ${emoji ? '😊 ' : ''}Foi ótimo falar com você! Precisando, é só chamar!`,
      casual: `Falou${name ? `, ${name}` : ''}! ${emoji ? '✌️ ' : ''}Qualquer coisa, tamo aí!`,
    };
    return {
      text: responses[config.botPersonality],
      shouldWait: false,
      waitMs: 0,
      intent,
    };
  }

  // INFO_PRICE - Informações de preço (com política de divulgação)
  if (intent === 'INFO_PRICE') {
    const extConfig = config as ExtendedConversationConfig;
    const policy = extConfig.priceDisclosurePolicy || 'always';

    if (policy === 'never_chat') {
      const responses = {
        professional: `${name || 'Olá'}, nossos valores são apresentados presencialmente na clínica, onde podemos avaliar seu caso e oferecer o melhor orçamento. Gostaria de agendar uma avaliação?`,
        friendly: `Oi${name ? `, ${name}` : ''}! ${emoji ? '😊 ' : ''}Os valores a gente passa pessoalmente na clínica, assim consigo ver direitinho o que você precisa. Quer marcar uma avaliação?`,
        casual: `E aí${name ? `, ${name}` : ''}! ${emoji ? '😉 ' : ''}Preço só pessoalmente, mas bora marcar uma avaliação rapidinho?`,
      };
      return {
        text: responses[config.botPersonality],
        shouldWait: false,
        waitMs: 0,
        intent,
        awaitingResponse: 'schedule_evaluation',
      };
    } else if (policy === 'only_general') {
      const responses = {
        professional: `${name || 'Olá'}, posso informar faixas de valores gerais. Para um orçamento detalhado, recomendamos uma avaliação presencial. Posso ajudá-lo(a) com mais informações?`,
        friendly: `Oi${name ? `, ${name}` : ''}! ${emoji ? '📋 ' : ''}Posso te passar uma ideia geral de valores, mas o orçamento certinho a gente faz presencialmente. Quer saber mais sobre algum tratamento específico?`,
        casual: `${name || 'Fala'}! ${emoji ? '💰 ' : ''}Posso dar uma noção dos valores, mas o preço certo só presencial. Qual tratamento você quer saber?`,
      };
      return {
        text: responses[config.botPersonality],
        shouldWait: false,
        waitMs: 0,
        intent,
      };
    }

    // policy === 'always' - informar preços normalmente
    return {
      text: `${emoji ? '💰 ' : ''}Vou verificar os valores para você${name ? `, ${name}` : ''}. Qual procedimento você gostaria de saber o preço?`,
      shouldWait: false,
      waitMs: 0,
      intent,
      awaitingResponse: 'price_procedure',
    };
  }

  // INFO - Outras informações
  if (intent.startsWith('INFO_')) {
    return {
      text: `${emoji ? 'ℹ️ ' : ''}Vou buscar essa informação para você${name ? `, ${name}` : ''}...`,
      shouldWait: false,
      waitMs: 0,
      intent,
    };
  }

  // MENU_SELECTION - Seleção de número
  if (intent === 'MENU_SELECTION') {
    // Mapear número para intent
    const menuMap: Record<number, string> = {
      1: 'SCHEDULE',
      2: 'VIEW_APPOINTMENTS',
      3: 'INFO_GENERAL',
      4: 'HUMAN_TAKEOVER',
    };

    const selectedNumber = (processed as any).entities?.selectedNumber || parseInt(processed.combinedText);
    const mappedIntent = menuMap[selectedNumber];

    if (mappedIntent) {
      // Recursivamente gerar resposta para o intent mapeado
      return generateSmartResponse(config, context, {
        ...processed,
        intent: mappedIntent,
        shouldShowMenu: false,
      });
    }
  }

  // FEEDBACK_POSITIVE - Feedback positivo
  if (intent === 'FEEDBACK_POSITIVE') {
    const responses = {
      professional: `Muito obrigado pelo feedback${name ? `, ${name}` : ''}! Ficamos felizes em saber. Se puder, deixe uma avaliação no Google para nos ajudar!`,
      friendly: `Que bom${name ? `, ${name}` : ''}! ${emoji ? '😊💖 ' : ''}Adoramos saber disso! Se puder nos avaliar no Google, ajuda muito!`,
      casual: `Valeu demais${name ? `, ${name}` : ''}! ${emoji ? '🙏 ' : ''}Manda um feedback no Google pra gente!`,
    };
    return {
      text: responses[config.botPersonality],
      shouldWait: false,
      waitMs: 0,
      intent,
    };
  }

  // UNKNOWN - Não entendeu
  if (config.conversationStyle === 'menu') {
    return {
      text: `${emoji ? '🤔 ' : ''}Desculpe${name ? `, ${name}` : ''}, não entendi bem.

Pode me explicar de outra forma ou escolher uma opção:

1️⃣ Agendar consulta
2️⃣ Ver meus agendamentos
3️⃣ Informações
4️⃣ Falar com atendente`,
      shouldWait: false,
      waitMs: 0,
      intent: 'FALLBACK',
    };
  } else {
    const responses = {
      professional: `Desculpe${name ? `, ${name}` : ''}, não consegui entender sua solicitação. Poderia reformular ou me dizer como posso ajudá-lo(a)?`,
      friendly: `Hmm${name ? `, ${name}` : ''}, não consegui entender bem ${emoji ? '😅' : ''}. Pode me explicar de outra forma?`,
      casual: `Opa${name ? `, ${name}` : ''}, não peguei essa ${emoji ? '😬' : ''}. Pode falar de novo?`,
    };
    return {
      text: responses[config.botPersonality],
      shouldWait: false,
      waitMs: 0,
      intent: 'FALLBACK',
    };
  }
}

// ==========================================
// EXPORTS
// ==========================================

export default {
  addToBuffer,
  processBuffer,
  clearBuffer,
  classifyIntent,
  extractEntities,
  generateSmartResponse,
  DEBOUNCE_MS,
};

// ExtendedConversationConfig is already exported as interface above
