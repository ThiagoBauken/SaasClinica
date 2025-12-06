/**
 * Serviço de Estilo de Conversa
 * Gera respostas no estilo configurado pela clínica (menu ou humanizado)
 */

export interface ConversationStyleConfig {
  conversationStyle: 'menu' | 'humanized';
  botPersonality: 'professional' | 'friendly' | 'casual';
  botName: string;
  useEmojis: boolean;
  greetingStyle: 'time_based' | 'simple';
  customGreetingMorning?: string;
  customGreetingAfternoon?: string;
  customGreetingEvening?: string;
  companyName: string;
  humanizedPromptContext?: string;
}

export interface ConversationContext {
  patientName?: string;
  patientFound: boolean;
  isOrthodontic?: boolean;
  lastIntent?: string;
}

/**
 * Retorna saudação baseada no horário e estilo configurado
 */
export function getGreeting(config: ConversationStyleConfig): string {
  const hour = new Date().getHours();

  if (config.greetingStyle === 'simple') {
    return config.useEmojis ? 'Olá! 👋' : 'Olá!';
  }

  // time_based
  if (hour >= 5 && hour < 12) {
    return config.customGreetingMorning || (config.useEmojis ? 'Bom dia! ☀️' : 'Bom dia!');
  } else if (hour >= 12 && hour < 18) {
    return config.customGreetingAfternoon || (config.useEmojis ? 'Boa tarde! 🌤️' : 'Boa tarde!');
  } else {
    return config.customGreetingEvening || (config.useEmojis ? 'Boa noite! 🌙' : 'Boa noite!');
  }
}

/**
 * Gera resposta de saudação inicial
 */
export function generateGreetingResponse(
  config: ConversationStyleConfig,
  context: ConversationContext
): string {
  const greeting = getGreeting(config);
  const name = context.patientName || '';
  const emoji = config.useEmojis;

  if (config.conversationStyle === 'menu') {
    // Estilo Menu - Com opções numeradas
    return `${greeting}${name ? `, ${name}` : ''}${emoji ? ' 👋' : ''}

Seja bem-vindo(a) à *${config.companyName}*!

Como posso ajudar?

1️⃣ Agendar consulta
2️⃣ Ver meus agendamentos
3️⃣ Informações
4️⃣ Falar com atendente`;
  }

  // Estilo Humanizado - Conversa natural
  const botIntro = config.botName !== 'Assistente'
    ? `Aqui é ${config.botName === 'a' ? 'a' : 'o'} ${config.botName}, da ${config.companyName}.`
    : `Sou da ${config.companyName}.`;

  const personalityEnding = {
    professional: 'Em que posso ajudá-lo(a) hoje?',
    friendly: 'Em que posso te ajudar?',
    casual: 'Como posso te ajudar?',
  };

  return `${greeting}${name ? `, ${name}` : ''}! Tudo bem?
${botIntro}
${personalityEnding[config.botPersonality]}`;
}

/**
 * Gera resposta de horários disponíveis
 */
export function generateScheduleResponse(
  config: ConversationStyleConfig,
  context: ConversationContext,
  slots: Array<{ dateFormatted: string; slots: string[] }>
): string {
  const name = context.patientName || '';
  const emoji = config.useEmojis;

  if (slots.length === 0) {
    if (config.conversationStyle === 'menu') {
      return `${emoji ? '😕 ' : ''}Desculpe${name ? `, ${name}` : ''}, não encontrei horários disponíveis nos próximos dias.

Um atendente entrará em contato para ajudar.`;
    }

    return `Puxa${name ? `, ${name}` : ''}, infelizmente não tenho horários disponíveis nos próximos dias. Mas não se preocupe, vou pedir para alguém da equipe entrar em contato com você para encontrar o melhor horário, tá?`;
  }

  if (config.conversationStyle === 'menu') {
    // Estilo Menu - Lista numerada
    let response = `${emoji ? '📅 ' : ''}Horários disponíveis:\n\n`;
    let optionNumber = 1;

    slots.slice(0, 3).forEach(day => {
      response += `*${day.dateFormatted}*\n`;
      day.slots.slice(0, 4).forEach(slot => {
        response += `${optionNumber}. ${slot}  `;
        optionNumber++;
      });
      response += '\n\n';
    });

    response += `Qual número você prefere?`;
    return response;
  }

  // Estilo Humanizado
  const firstDay = slots[0];
  const secondDay = slots[1];

  let response = '';

  if (config.botPersonality === 'casual') {
    response = `Deixa eu ver aqui... `;
  } else if (config.botPersonality === 'friendly') {
    response = `Vou verificar os horários pra você! `;
  } else {
    response = `Verificando disponibilidade... `;
  }

  response += `Temos horários na *${firstDay.dateFormatted}* às ${firstDay.slots.slice(0, 2).join(' ou ')}`;

  if (secondDay) {
    response += `, ou na *${secondDay.dateFormatted}* às ${secondDay.slots[0]}`;
  }

  response += '.\n\nQual fica melhor pra você?';

  return response;
}

/**
 * Gera resposta de confirmação de agendamento
 */
export function generateAppointmentCreatedResponse(
  config: ConversationStyleConfig,
  context: ConversationContext,
  appointment: { dataFormatada: string; horaFormatada: string }
): string {
  const name = context.patientName || '';
  const emoji = config.useEmojis;

  if (config.conversationStyle === 'menu') {
    return `${emoji ? '✅ ' : ''}Agendamento realizado!

${emoji ? '📆 ' : ''}Data: *${appointment.dataFormatada}*
${emoji ? '🕐 ' : ''}Horário: *${appointment.horaFormatada}*

Confirmar agendamento?

1️⃣ Sim, confirmar
2️⃣ Não, escolher outro horário`;
  }

  // Humanizado
  const confirmations = {
    professional: `Perfeito${name ? `, ${name}` : ''}! Agendei para ${appointment.dataFormatada} às ${appointment.horaFormatada}. Posso confirmar esse horário?`,
    friendly: `Maravilha${name ? `, ${name}` : ''}! ${emoji ? '🎉 ' : ''}Agendei pra ${appointment.dataFormatada} às ${appointment.horaFormatada}. Tá confirmado?`,
    casual: `Pronto${name ? `, ${name}` : ''}! Marquei pra ${appointment.dataFormatada} às ${appointment.horaFormatada}. Confirma?`,
  };

  return confirmations[config.botPersonality];
}

/**
 * Gera resposta de agendamento confirmado
 */
export function generateConfirmedResponse(
  config: ConversationStyleConfig,
  context: ConversationContext
): string {
  const name = context.patientName || '';
  const emoji = config.useEmojis;

  if (config.conversationStyle === 'menu') {
    return `${emoji ? '✅ ' : ''}Perfeito${name ? `, ${name}` : ''}!

Sua consulta está *CONFIRMADA*!

${emoji ? '📍 ' : ''}Te esperamos!

*${config.companyName}*`;
  }

  // Humanizado
  const responses = {
    professional: `Confirmado${name ? `, ${name}` : ''}! Estaremos te esperando. Qualquer dúvida, é só chamar. Até lá!`,
    friendly: `Perfeito${name ? `, ${name}` : ''}! ${emoji ? '😊 ' : ''}Tá tudo certo! Te esperamos com carinho. Até breve!`,
    casual: `Show${name ? `, ${name}` : ''}! ${emoji ? '👍 ' : ''}Tamo junto! Até lá!`,
  };

  return responses[config.botPersonality];
}

/**
 * Gera resposta de despedida
 */
export function generateGoodbyeResponse(
  config: ConversationStyleConfig,
  context: ConversationContext
): string {
  const name = context.patientName || '';
  const emoji = config.useEmojis;

  if (config.conversationStyle === 'menu') {
    return `Até logo${name ? `, ${name}` : ''}! ${emoji ? '👋' : ''}

Foi um prazer atendê-lo(a)!

*${config.companyName}*`;
  }

  // Humanizado
  const responses = {
    professional: `Foi um prazer atendê-lo(a)${name ? `, ${name}` : ''}. Qualquer dúvida, estamos à disposição. Tenha um ótimo dia!`,
    friendly: `Tchau${name ? `, ${name}` : ''}! ${emoji ? '😊 ' : ''}Foi ótimo falar com você! Precisando, é só chamar!`,
    casual: `Falou${name ? `, ${name}` : ''}! ${emoji ? '✌️ ' : ''}Qualquer coisa, tamo aí!`,
  };

  return responses[config.botPersonality];
}

/**
 * Gera resposta de emergência
 */
export function generateEmergencyResponse(
  config: ConversationStyleConfig,
  context: ConversationContext,
  clinicPhone?: string
): string {
  const name = context.patientName || '';
  const emoji = config.useEmojis;

  if (config.conversationStyle === 'menu') {
    return `${emoji ? '🚨 ' : ''}*EMERGÊNCIA*

${name || 'Olá'}, entendemos sua urgência!

Um profissional entrará em contato *IMEDIATAMENTE*.

${clinicPhone ? `${emoji ? '📞 ' : ''}Se preferir, ligue: ${clinicPhone}` : ''}

Aguarde um momento!`;
  }

  // Humanizado
  return `${name || 'Olá'}, entendo que é urgente e vou priorizar seu atendimento agora mesmo! ${emoji ? '🏃' : ''}

Estou acionando nossa equipe e alguém vai entrar em contato com você nos próximos minutos.

${clinicPhone ? `Se precisar, pode ligar direto: ${clinicPhone}` : ''}

Fique tranquilo(a), vamos te ajudar!`;
}

/**
 * Gera resposta para intent não reconhecido (fallback)
 */
export function generateFallbackResponse(
  config: ConversationStyleConfig,
  context: ConversationContext
): string {
  const name = context.patientName || '';
  const emoji = config.useEmojis;

  if (config.conversationStyle === 'menu') {
    return `${emoji ? '🤔 ' : ''}Desculpe${name ? `, ${name}` : ''}, não entendi sua mensagem.

Por favor, escolha uma opção:

1️⃣ Agendar consulta
2️⃣ Ver meus agendamentos
3️⃣ Informações
4️⃣ Falar com atendente`;
  }

  // Humanizado
  const responses = {
    professional: `Desculpe${name ? `, ${name}` : ''}, não consegui entender sua solicitação. Poderia reformular ou me dizer como posso ajudá-lo(a)?`,
    friendly: `Hmm${name ? `, ${name}` : ''}, não consegui entender bem ${emoji ? '😅' : ''}. Pode me explicar de outra forma?`,
    casual: `Opa${name ? `, ${name}` : ''}, não peguei essa ${emoji ? '😬' : ''}. Pode falar de novo?`,
  };

  return responses[config.botPersonality];
}

/**
 * Gera prompt para AI no modo humanizado
 */
export function generateHumanizedAIPrompt(
  config: ConversationStyleConfig,
  context: ConversationContext,
  message: string
): string {
  const personalityDescriptions = {
    professional: 'Seja profissional, educado e formal, mas acolhedor.',
    friendly: 'Seja amigável, simpático e use uma linguagem próxima.',
    casual: 'Seja descontraído e use linguagem informal, como se fosse um amigo.',
  };

  return `Você é ${config.botName}, assistente virtual da clínica odontológica "${config.companyName}".

PERSONALIDADE: ${personalityDescriptions[config.botPersonality]}
${config.useEmojis ? 'Use emojis moderadamente para deixar a conversa mais leve.' : 'NÃO use emojis.'}

CONTEXTO DO PACIENTE:
- Nome: ${context.patientName || 'Não identificado'}
- É paciente cadastrado: ${context.patientFound ? 'Sim' : 'Não'}
- É paciente de ortodontia: ${context.isOrthodontic ? 'Sim' : 'Não'}

${config.humanizedPromptContext ? `CONTEXTO ADICIONAL DA CLÍNICA:\n${config.humanizedPromptContext}\n` : ''}

REGRAS:
1. Responda de forma curta e natural (máximo 3 frases)
2. NÃO invente informações sobre preços ou procedimentos
3. Para agendamentos, pergunte preferência de data/horário
4. Se for urgência, demonstre empatia e priorize o atendimento
5. Se não souber responder, diga que vai passar para um atendente

MENSAGEM DO PACIENTE:
"${message}"

Responda de forma natural e humanizada:`;
}

/**
 * Formata resposta baseada nas configurações
 */
export function formatResponse(
  config: ConversationStyleConfig,
  template: string,
  variables: Record<string, string>
): string {
  let response = template;

  // Substituir variáveis
  Object.entries(variables).forEach(([key, value]) => {
    response = response.replace(new RegExp(`{{${key}}}`, 'g'), value);
  });

  // Remover emojis se configurado
  if (!config.useEmojis) {
    response = response.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
  }

  return response.trim();
}

export default {
  getGreeting,
  generateGreetingResponse,
  generateScheduleResponse,
  generateAppointmentCreatedResponse,
  generateConfirmedResponse,
  generateGoodbyeResponse,
  generateEmergencyResponse,
  generateFallbackResponse,
  generateHumanizedAIPrompt,
  formatResponse,
};
