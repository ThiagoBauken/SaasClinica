/**
 * Dental Clinic AI Agent - Tool Definitions
 *
 * Defines all tools the Claude AI agent can call during WhatsApp conversations.
 * Tools are global (same schema for all tenants) - company isolation happens in the executor.
 *
 * Using strict: true for guaranteed schema conformance.
 * Last tool gets cache_control for prompt caching (~90% cost reduction on tool tokens).
 */

import type Anthropic from '@anthropic-ai/sdk';

export type ToolName =
  | 'lookup_patient'
  | 'get_patient_appointments'
  | 'check_availability'
  | 'schedule_appointment'
  | 'confirm_appointment'
  | 'cancel_appointment'
  | 'reschedule_appointment'
  | 'get_clinic_info'
  | 'move_crm_stage'
  | 'transfer_to_human'
  | 'save_patient_intake'
  | 'generate_payment_link'
  | 'list_procedures'
  | 'list_professionals'
  | 'update_patient_tags'
  | 'consultation_completed'
  | 'payment_completed'
  | 'generate_confirmation_link';

export const DENTAL_CLINIC_TOOLS: Anthropic.Tool[] = [
  {
    name: 'lookup_patient',
    description: `Busca informações do paciente pelo número de telefone.
Chame esta ferramenta NO INÍCIO de cada nova conversa para personalizar as respostas.
Retorna: nome, próximas consultas, última visita, tipo de tratamento.
Retorna null se o paciente não for cadastrado (paciente novo).`,
    input_schema: {
      type: 'object' as const,
      properties: {
        phone: {
          type: 'string',
          description: 'Número de telefone do paciente no formato brasileiro (ex: 5511999887766)',
        },
      },
      required: ['phone'],
    },
  },
  {
    name: 'get_patient_appointments',
    description: `Lista consultas futuras e recentes de um paciente.
Use quando o paciente perguntar "quais são meus agendamentos", "quando é minha próxima consulta", etc.
Retorna consultas ordenadas por data com status (agendado, confirmado, cancelado).`,
    input_schema: {
      type: 'object' as const,
      properties: {
        phone: {
          type: 'string',
          description: 'Número de telefone do paciente',
        },
        include_past: {
          type: 'boolean',
          description: 'Incluir consultas passadas (default: false)',
        },
        limit: {
          type: 'number',
          description: 'Máximo de consultas a retornar (default: 5)',
        },
      },
      required: ['phone'],
    },
  },
  {
    name: 'check_availability',
    description: `Retorna horários disponíveis para agendamento em um período.
SEMPRE chame esta ferramenta ANTES de schedule_appointment para mostrar slots reais.
Se não houver horários, sugira os próximos 3 dias disponíveis.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        date_from: {
          type: 'string',
          description: 'Data inicial no formato YYYY-MM-DD',
        },
        date_to: {
          type: 'string',
          description: 'Data final no formato YYYY-MM-DD (máximo 7 dias após date_from)',
        },
        professional_id: {
          type: 'number',
          description: 'ID do profissional (opcional - se não informado, busca todos)',
        },
        procedure_id: {
          type: 'number',
          description: 'ID do procedimento (para calcular duração do slot)',
        },
      },
      required: ['date_from'],
    },
  },
  {
    name: 'schedule_appointment',
    description: `Agenda uma nova consulta para o paciente.
REGRAS:
- SEMPRE verifique disponibilidade (check_availability) antes de chamar esta ferramenta.
- NÃO chame se o paciente ainda não confirmou data, horário e procedimento.
- Após agendar, informe o paciente e mova o CRM para "scheduling".
Retorna: ID da consulta e confirmação.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        patient_phone: {
          type: 'string',
          description: 'Telefone do paciente',
        },
        date: {
          type: 'string',
          description: 'Data no formato YYYY-MM-DD',
        },
        time: {
          type: 'string',
          description: 'Horário no formato HH:MM (24h)',
        },
        professional_id: {
          type: 'number',
          description: 'ID do profissional',
        },
        procedure_id: {
          type: 'number',
          description: 'ID do procedimento',
        },
        title: {
          type: 'string',
          description: 'Título da consulta (ex: "Limpeza - João Silva")',
        },
        notes: {
          type: 'string',
          description: 'Observações do paciente sobre sintomas ou pedidos especiais',
        },
      },
      required: ['patient_phone', 'date', 'time'],
    },
  },
  {
    name: 'confirm_appointment',
    description: `Confirma uma consulta existente (paciente confirmou presença).
Use quando o paciente responder "sim", "confirmo", "vou sim", etc. a uma confirmação.
Após confirmar, mova o CRM para "confirmation" automaticamente.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        appointment_id: {
          type: 'number',
          description: 'ID da consulta a confirmar',
        },
      },
      required: ['appointment_id'],
    },
  },
  {
    name: 'cancel_appointment',
    description: `Cancela uma consulta existente.
SEMPRE confirme com o paciente antes de chamar: "Tem certeza que deseja cancelar sua consulta do dia [data]?"
Após cancelar, pergunte se deseja reagendar.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        appointment_id: {
          type: 'number',
          description: 'ID da consulta a cancelar',
        },
        reason: {
          type: 'string',
          description: 'Motivo do cancelamento informado pelo paciente',
        },
      },
      required: ['appointment_id'],
    },
  },
  {
    name: 'reschedule_appointment',
    description: `Reagenda uma consulta existente para nova data/horário.
Verifique disponibilidade (check_availability) antes de chamar esta ferramenta.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        appointment_id: {
          type: 'number',
          description: 'ID da consulta a reagendar',
        },
        new_date: {
          type: 'string',
          description: 'Nova data no formato YYYY-MM-DD',
        },
        new_time: {
          type: 'string',
          description: 'Novo horário no formato HH:MM (24h)',
        },
      },
      required: ['appointment_id', 'new_date', 'new_time'],
    },
  },
  {
    name: 'get_clinic_info',
    description: `Retorna informações da clínica: endereço, horário de funcionamento, telefone, serviços.
Use quando o paciente perguntar sobre localização, horários, procedimentos ou preços.
Para preços: somente informe se a clínica permite divulgação por chat.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        info_type: {
          type: 'string',
          enum: ['address', 'hours', 'phone', 'services', 'prices', 'emergency', 'all'],
          description: 'Tipo de informação solicitada',
        },
      },
      required: ['info_type'],
    },
  },
  {
    name: 'move_crm_stage',
    description: `Move a oportunidade do CRM para o próximo estágio do pipeline.
Chame AUTOMATICAMENTE em marcos da conversa:
- Após agendar → "scheduling"
- Após paciente confirmar → "confirmation"
- Após consulta realizada → "consultation_done"
- Após pagamento → "payment_done"
NÃO mencione esta ação ao paciente, é operação interna.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        target_stage: {
          type: 'string',
          enum: ['first_contact', 'scheduling', 'confirmation', 'consultation_done', 'payment_done'],
          description: 'Estágio do CRM para mover a oportunidade',
        },
        notes: {
          type: 'string',
          description: 'Observações sobre a transição (interno)',
        },
      },
      required: ['target_stage'],
    },
  },
  {
    name: 'transfer_to_human',
    description: `Transfere a conversa para atendimento humano e notifica a equipe.
Use quando:
- Paciente pedir explicitamente para falar com atendente
- Emergência odontológica detectada
- Reclamação detectada
- Questão complexa de pagamento/convênio
- Agente não conseguiu resolver em 3+ tentativas
Após chamar, informe o paciente que um membro da equipe responderá em breve.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        reason: {
          type: 'string',
          enum: ['patient_request', 'emergency', 'complaint', 'complex_query', 'payment_issue', 'agent_failed'],
          description: 'Motivo da transferência',
        },
        summary: {
          type: 'string',
          description: 'Resumo breve do contexto da conversa para o atendente humano',
        },
      },
      required: ['reason', 'summary'],
    },
  },
  {
    name: 'save_patient_intake',
    description: `Salva dados do paciente coletados durante a conversa (cadastro automático).
Chame quando coletar: nome completo + pelo menos mais um dado (data nascimento, CPF, email).
NÃO peça todos os dados de uma vez - colete naturalmente durante a conversa.
Só chame após o paciente confirmar que as informações estão corretas.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        full_name: {
          type: 'string',
          description: 'Nome completo do paciente',
        },
        phone: {
          type: 'string',
          description: 'Telefone do paciente',
        },
        date_of_birth: {
          type: 'string',
          description: 'Data de nascimento YYYY-MM-DD',
        },
        cpf: {
          type: 'string',
          description: 'CPF (somente dígitos, opcional)',
        },
        email: {
          type: 'string',
          description: 'Email do paciente',
        },
        health_plan: {
          type: 'string',
          description: 'Nome do convênio/plano (se houver)',
        },
        chief_complaint: {
          type: 'string',
          description: 'Queixa principal ou motivo da visita',
        },
        allergies: {
          type: 'string',
          description: 'Alergias ou medicamentos conhecidos',
        },
      },
      required: ['full_name', 'phone'],
    },
  },
  {
    name: 'generate_payment_link',
    description: `Gera um link de pagamento para o paciente (PIX, cartão de crédito, etc.).
Use quando o paciente perguntar sobre pagamento ou quando o fluxo de atendimento chegar na etapa de cobrança.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        patient_phone: {
          type: 'string',
          description: 'Telefone do paciente',
        },
        amount: {
          type: 'number',
          description: 'Valor em reais (BRL)',
        },
        description: {
          type: 'string',
          description: 'Descrição do pagamento (ex: "Limpeza dental")',
        },
        method: {
          type: 'string',
          enum: ['pix', 'credit_card', 'boleto'],
          description: 'Método de pagamento preferido',
        },
      },
      required: ['patient_phone', 'amount', 'description'],
    },
  },
  {
    name: 'list_procedures',
    description: `Lista procedimentos/serviços disponíveis na clínica.
Use quando o paciente perguntar "quais serviços vocês oferecem", "quanto custa uma limpeza", etc.
Retorna nome, duração, preço e categoria de cada procedimento.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          description: 'Filtrar por categoria (ex: "ortodontia", "endodontia"). Opcional.',
        },
      },
      required: [],
    },
  },
  {
    name: 'list_professionals',
    description: `Lista dentistas/profissionais disponíveis na clínica.
Use quando o paciente perguntar "quem são os dentistas", ou para mostrar opções ao agendar.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        speciality: {
          type: 'string',
          description: 'Filtrar por especialidade (ex: "ortodontia", "implantodontia"). Opcional.',
        },
      },
      required: [],
    },
  },
  {
    name: 'update_patient_tags',
    description: `Atualiza tags/categorias do paciente (ex: ortodontia, VIP, convênio).
Use quando identificar que o paciente pertence a uma categoria específica.
NÃO mencione tags ao paciente, é operação interna.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        phone: {
          type: 'string',
          description: 'Telefone do paciente',
        },
        add_tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags a adicionar (ex: ["ortodontia", "vip"])',
        },
        remove_tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags a remover',
        },
        is_orthodontic: {
          type: 'boolean',
          description: 'Marcar como paciente de ortodontia',
        },
      },
      required: ['phone'],
    },
  },
  {
    name: 'consultation_completed',
    description: `Marca uma consulta como realizada e move o CRM para "consultation_done".
Use quando o dentista ou sistema confirmar que a consulta foi concluída.
NÃO mencione esta ação ao paciente, é operação interna.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        appointment_id: {
          type: 'number',
          description: 'ID da consulta realizada',
        },
      },
      required: ['appointment_id'],
    },
  },
  {
    name: 'payment_completed',
    description: `Registra pagamento realizado e move o CRM para "payment_done".
Use quando o pagamento for confirmado pelo sistema.
NÃO mencione esta ação ao paciente, é operação interna.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        amount: {
          type: 'number',
          description: 'Valor pago em reais (BRL)',
        },
        payment_method: {
          type: 'string',
          enum: ['pix', 'credit_card', 'debit_card', 'boleto', 'cash'],
          description: 'Método de pagamento utilizado',
        },
        appointment_id: {
          type: 'number',
          description: 'ID da consulta associada (opcional)',
        },
      },
      required: ['amount', 'payment_method'],
    },
  },
  {
    name: 'generate_confirmation_link',
    description: `Gera um link de confirmação de consulta que o paciente pode clicar.
Use quando quiser enviar um link clicável para o paciente confirmar a consulta, ao invés de pedir resposta por texto.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        appointment_id: {
          type: 'number',
          description: 'ID da consulta',
        },
        expires_in_hours: {
          type: 'number',
          description: 'Horas para o link expirar (default: 48)',
        },
      },
      required: ['appointment_id'],
    },
    // cache_control on last tool enables prompt caching for all tools above
    cache_control: { type: 'ephemeral' } as any,
  },
];

/** Map of tool names to their definitions for quick lookup */
export const TOOLS_MAP = new Map(DENTAL_CLINIC_TOOLS.map(t => [t.name, t]));
