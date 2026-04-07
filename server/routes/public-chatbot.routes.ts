/**
 * Public Chatbot Routes — no authentication required
 *
 * Provides a stateless conversational endpoint for patient-facing web chatbots.
 * Each request carries the full session context so no server-side session storage
 * is needed; the client is responsible for persisting and forwarding `context`.
 *
 * Capabilities:
 *   - Dental urgency triage (dor, sangramento, inchaço → urgent / semi_urgent / routine)
 *   - FAQ answers (horário, endereço, convênio, preço, emergência)
 *   - Guided appointment booking (name → phone → professional → date → time → confirm)
 *
 * Route:
 *   POST /api/public/chatbot/:companyId/message
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { eq, and, isNull, not, inArray } from 'drizzle-orm';
import { companies, patients, appointments, users } from '@shared/schema';
import { addAppointmentConfirmationJob } from '../queue/queues';
import { publicSubmitLimiter, publicReadLimiter } from '../middleware/public-rate-limit';
import { logger } from '../logger';

const router = Router();
const log = logger.child({ module: 'public-chatbot' });

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const chatMessageSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1).max(1000),
  context: z
    .object({
      step: z.string().optional(),
      patientName: z.string().optional(),
      patientPhone: z.string().optional(),
      selectedDate: z.string().optional(),
      selectedTime: z.string().optional(),
      selectedProfessionalId: z.number().optional(),
      availableSlots: z.array(z.string()).optional(),
      urgencyLevel: z.string().optional(),
    })
    .optional(),
});

// ---------------------------------------------------------------------------
// Triage keyword lists
// ---------------------------------------------------------------------------

const TRIAGE_KEYWORDS = {
  urgent: [
    'dor forte',
    'sangramento',
    'inchado',
    'inchaço',
    'trauma',
    'quebrou dente',
    'caiu dente',
    'abscesso',
    'pus',
    'febre',
    'não consigo abrir a boca',
  ],
  semi_urgent: ['dor', 'sensibilidade', 'dor ao morder', 'gengiva sangrando', 'dente mole'],
  routine: [
    'limpeza',
    'clareamento',
    'check-up',
    'revisão',
    'ortodontia',
    'aparelho',
    'implante',
    'prótese',
  ],
};

// ---------------------------------------------------------------------------
// FAQ map — keyword → reply
// ---------------------------------------------------------------------------

const FAQ_RESPONSES: Record<string, string> = {
  horario:
    'Nosso horário de funcionamento é de segunda a sexta, das 8h às 18h, e sábados das 8h às 12h.',
  endereco: 'Você pode encontrar nosso endereço e mapa no site da clínica.',
  convenio:
    'Trabalhamos com diversos convênios. Por favor, informe o nome do seu convênio para verificarmos.',
  preco:
    'Os valores variam de acordo com o procedimento. Agende uma avaliação para recebermos você e fazermos um orçamento personalizado.',
  emergencia:
    'Em caso de emergência grave (sangramento intenso, trauma facial), procure o pronto-socorro mais próximo. Para urgências odontológicas, podemos atendê-lo hoje.',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function classifyUrgency(message: string): { level: string; response: string } {
  const lower = message.toLowerCase();

  for (const keyword of TRIAGE_KEYWORDS.urgent) {
    if (lower.includes(keyword)) {
      return {
        level: 'urgent',
        response:
          'Entendo que você está com uma situação que pode ser urgente. Recomendo agendar uma consulta de emergência para hoje ou amanhã. Posso verificar a disponibilidade agora?',
      };
    }
  }

  for (const keyword of TRIAGE_KEYWORDS.semi_urgent) {
    if (lower.includes(keyword)) {
      return {
        level: 'semi_urgent',
        response:
          'Compreendo sua situação. É importante avaliar isso em breve. Gostaria de agendar uma consulta nos próximos dias?',
      };
    }
  }

  for (const keyword of TRIAGE_KEYWORDS.routine) {
    if (lower.includes(keyword)) {
      return {
        level: 'routine',
        response: `Ótimo! Posso ajudá-lo a agendar uma consulta de ${keyword}. Qual a melhor data para você?`,
      };
    }
  }

  return { level: 'unknown', response: '' };
}

function checkFAQ(message: string): string | null {
  const lower = message.toLowerCase();
  for (const [key, response] of Object.entries(FAQ_RESPONSES)) {
    if (lower.includes(key)) return response;
  }
  return null;
}

function normalisePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

// ---------------------------------------------------------------------------
// POST /api/public/chatbot/:companyId/message
// ---------------------------------------------------------------------------

router.post('/:companyId/message', publicSubmitLimiter, async (req, res) => {
  try {
    // ── 1. Validate companyId ──────────────────────────────────────────────
    const companyId = parseInt(req.params.companyId, 10);
    if (isNaN(companyId)) {
      return res.status(400).json({ error: 'companyId inválido' });
    }

    // ── 2. Validate request body ───────────────────────────────────────────
    const parseResult = chatMessageSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(422).json({
        error: 'Dados inválidos',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { sessionId, message, context } = parseResult.data;
    const step = context?.step ?? 'greeting';

    // ── 3. Verify clinic exists ────────────────────────────────────────────
    const [company] = await db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      return res.status(404).json({ error: 'Clínica não encontrada' });
    }

    const clinicName = company.name;

    // ── 4. State machine ──────────────────────────────────────────────────
    type BotMessage = { type: 'text'; content: string };

    const response: {
      sessionId: string;
      step: string;
      messages: BotMessage[];
      quickReplies?: string[];
      urgencyLevel?: string;
      patientName?: string;
      patientPhone?: string;
      selectedDate?: string;
      selectedTime?: string;
      selectedProfessionalId?: number | null;
      availableSlots?: string[];
      professionals?: Array<{ id: number; fullName: string }>;
    } = { sessionId, step, messages: [] };

    switch (step) {
      // ── Greeting ────────────────────────────────────────────────────────
      case 'greeting': {
        response.messages.push({
          type: 'text',
          content: `Olá! Bem-vindo à ${clinicName}. Como posso ajudá-lo hoje?\n\n1. Agendar uma consulta\n2. Tirar uma dúvida\n3. Estou com dor / urgência`,
        });
        response.step = 'main_menu';
        response.quickReplies = ['Agendar consulta', 'Tirar dúvida', 'Estou com dor'];
        break;
      }

      // ── Main menu ────────────────────────────────────────────────────────
      case 'main_menu': {
        const lower = message.toLowerCase();

        if (lower.includes('1') || lower.includes('agendar')) {
          response.messages.push({
            type: 'text',
            content: 'Vamos agendar sua consulta! Por favor, me informe seu nome completo.',
          });
          response.step = 'collect_name';
        } else if (
          lower.includes('2') ||
          lower.includes('dúvida') ||
          lower.includes('duvida')
        ) {
          response.messages.push({
            type: 'text',
            content:
              'Claro! Sobre o que gostaria de saber? (horários, endereço, convênios, preços...)',
          });
          response.step = 'faq';
        } else if (
          lower.includes('3') ||
          lower.includes('dor') ||
          lower.includes('urgência') ||
          lower.includes('urgencia')
        ) {
          response.messages.push({
            type: 'text',
            content:
              'Entendo. Por favor, descreva o que está sentindo para que eu possa avaliar a urgência.',
          });
          response.step = 'triage';
        } else {
          const faq = checkFAQ(message);
          if (faq) {
            response.messages.push({ type: 'text', content: faq });
            response.step = 'main_menu';
            response.quickReplies = ['Agendar consulta', 'Outra dúvida', 'Não, obrigado'];
          } else {
            response.messages.push({
              type: 'text',
              content:
                'Desculpe, não entendi. Por favor, escolha uma opção:\n1. Agendar\n2. Dúvida\n3. Urgência',
            });
            response.step = 'main_menu';
            response.quickReplies = ['Agendar consulta', 'Tirar dúvida', 'Estou com dor'];
          }
        }
        break;
      }

      // ── Dental triage ────────────────────────────────────────────────────
      case 'triage': {
        const triage = classifyUrgency(message);
        response.urgencyLevel = triage.level;

        const triageReply =
          triage.response ||
          'Obrigado por descrever sua situação. Para uma avaliação adequada, recomendo agendar uma consulta. Deseja agendar?';

        response.messages.push({ type: 'text', content: triageReply });
        response.step = triage.level === 'urgent' ? 'collect_name' : 'ask_schedule';
        response.quickReplies = ['Sim, agendar', 'Não, obrigado'];
        break;
      }

      // ── Ask whether to schedule after semi-urgent triage ─────────────────
      case 'ask_schedule': {
        if (message.toLowerCase().includes('sim')) {
          response.messages.push({
            type: 'text',
            content: 'Ótimo! Por favor, me informe seu nome completo.',
          });
          response.step = 'collect_name';
        } else {
          response.messages.push({
            type: 'text',
            content:
              'Tudo bem! Se precisar, entre em contato conosco pelo telefone da clínica. Desejamos melhoras!',
          });
          response.step = 'end';
        }
        break;
      }

      // ── FAQ ──────────────────────────────────────────────────────────────
      case 'faq': {
        const faq = checkFAQ(message);
        if (faq) {
          response.messages.push({ type: 'text', content: faq });
          response.messages.push({
            type: 'text',
            content: 'Posso ajudar com mais alguma coisa?',
          });
          response.quickReplies = ['Agendar consulta', 'Outra dúvida', 'Não, obrigado'];
        } else {
          response.messages.push({
            type: 'text',
            content:
              'Não encontrei uma resposta direta. Recomendo entrar em contato por telefone para essa questão. Posso ajudar com agendamento?',
          });
          response.quickReplies = ['Agendar consulta', 'Não, obrigado'];
        }
        response.step = 'main_menu';
        break;
      }

      // ── Collect patient name ─────────────────────────────────────────────
      case 'collect_name': {
        if (message.trim().length < 3) {
          response.messages.push({
            type: 'text',
            content: 'Por favor, informe seu nome completo (mínimo 3 caracteres).',
          });
          response.step = 'collect_name';
        } else {
          response.patientName = message.trim();
          response.messages.push({
            type: 'text',
            content: `Prazer, ${message.trim()}! Agora, por favor, informe seu telefone com DDD. Exemplo: (11) 99999-9999`,
          });
          response.step = 'collect_phone';
        }
        break;
      }

      // ── Collect patient phone ────────────────────────────────────────────
      case 'collect_phone': {
        const digits = normalisePhone(message);
        if (digits.length < 10 || digits.length > 11) {
          response.messages.push({
            type: 'text',
            content: 'Telefone inválido. Informe com DDD, ex: (11) 99999-9999',
          });
          response.step = 'collect_phone';
        } else {
          response.patientPhone = digits;

          // Fetch active professionals for this clinic
          const profRows = await db
            .select({ id: users.id, fullName: users.fullName })
            .from(users)
            .where(
              and(
                eq(users.companyId, companyId),
                eq(users.active, true),
                isNull(users.deletedAt),
              ),
            )
            .orderBy(users.fullName);

          if (profRows.length > 0) {
            const profList = profRows
              .map((p: any, i: number) => `${i + 1}. ${p.fullName}`)
              .join('\n');
            response.messages.push({
              type: 'text',
              content: `Perfeito! Com qual profissional gostaria de agendar?\n\n${profList}\n\nDigite o número correspondente.`,
            });
            response.professionals = profRows;
            response.step = 'select_professional';
          } else {
            response.messages.push({
              type: 'text',
              content: 'Qual a melhor data para você? (ex: 15/04/2026)',
            });
            response.step = 'select_date';
          }
        }
        break;
      }

      // ── Select professional ──────────────────────────────────────────────
      case 'select_professional': {
        // The client must send the professionals list back in context for
        // index resolution. If it's missing we skip professional selection.
        const profRows = context?.selectedProfessionalId != null
          ? []
          : await db
              .select({ id: users.id, fullName: users.fullName })
              .from(users)
              .where(
                and(
                  eq(users.companyId, companyId),
                  eq(users.active, true),
                  isNull(users.deletedAt),
                ),
              )
              .orderBy(users.fullName);

        const num = parseInt(message.trim(), 10);
        const chosen = profRows[num - 1];

        if (chosen) {
          response.selectedProfessionalId = chosen.id;
          response.messages.push({
            type: 'text',
            content: `${chosen.fullName} selecionado(a)! Qual a melhor data para você? (ex: 15/04/2026)`,
          });
        } else {
          // Accept free-text name match or just proceed without a professional
          response.selectedProfessionalId = null;
          response.messages.push({
            type: 'text',
            content: 'Qual a melhor data para você? (ex: 15/04/2026)',
          });
        }
        response.step = 'select_date';
        break;
      }

      // ── Select date ──────────────────────────────────────────────────────
      case 'select_date': {
        // Accept DD/MM/YYYY or DDMMYYYY
        const cleaned = message.replace(/[^0-9/]/g, '');
        const parts = cleaned.split('/');
        let dateStr = '';

        if (parts.length === 3 && parts[2].length >= 4) {
          dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        } else if (parts.length === 1 && parts[0].length === 8) {
          const d = parts[0];
          dateStr = `${d.slice(4)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
        }

        const parsedDate = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (!dateStr || isNaN(parsedDate.getTime()) || parsedDate < today) {
          response.messages.push({
            type: 'text',
            content:
              'Data inválida ou no passado. Por favor, informe uma data futura (ex: 15/04/2026).',
          });
          response.step = 'select_date';
          break;
        }

        response.selectedDate = dateStr;
        response.messages.push({
          type: 'text',
          content: `Data selecionada: ${parts[0]}/${parts[1]}/${parts[2]}. Verificando horários disponíveis...`,
        });

        // Determine booked slots for the given date
        const bookedRows = await db
          .select({ startTime: appointments.startTime })
          .from(appointments)
          .where(
            and(
              eq(appointments.companyId, companyId),
              not(inArray(appointments.status, ['cancelled', 'no_show'])),
            ),
          );

        // Filter to target date and build a set of HH:MM strings
        const bookedTimes = new Set(
          bookedRows
            .filter((r: any) => {
              const d = new Date(r.startTime);
              return (
                d.getFullYear() === parsedDate.getFullYear() &&
                d.getMonth() === parsedDate.getMonth() &&
                d.getDate() === parsedDate.getDate()
              );
            })
            .map((r: any) => {
              const d = new Date(r.startTime);
              return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
            }),
        );

        // Generate 30-minute slots from 08:00 to 17:30
        const available: string[] = [];
        for (let h = 8; h < 18; h++) {
          for (const m of [0, 30]) {
            const t = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            if (!bookedTimes.has(t)) available.push(t);
          }
        }

        if (available.length === 0) {
          response.messages.push({
            type: 'text',
            content:
              'Infelizmente não há horários disponíveis nesta data. Gostaria de tentar outra data?',
          });
          response.step = 'select_date';
          response.quickReplies = ['Sim, outra data', 'Não, obrigado'];
          break;
        }

        const shown = available.slice(0, 8);
        const slotList = shown.map((t, i) => `${i + 1}. ${t}`).join('\n');
        response.messages.push({
          type: 'text',
          content: `Horários disponíveis:\n\n${slotList}\n\nDigite o número do horário desejado.`,
        });
        response.availableSlots = shown;
        response.step = 'select_time';
        break;
      }

      // ── Select time ──────────────────────────────────────────────────────
      case 'select_time': {
        const slots = context?.availableSlots ?? [];
        const num = parseInt(message.trim(), 10);
        const chosen = slots[num - 1];

        // Also accept direct HH:MM input
        const directTime = /^\d{1,2}:\d{2}$/.test(message.trim()) ? message.trim() : null;
        const selectedTime = chosen ?? directTime;

        if (!selectedTime) {
          response.messages.push({
            type: 'text',
            content: 'Opção inválida. Por favor, digite o número do horário desejado.',
          });
          response.step = 'select_time';
          response.availableSlots = slots;
          break;
        }

        response.selectedTime = selectedTime;

        // Format date for display
        const dateParts = (context?.selectedDate ?? '').split('-');
        const displayDate =
          dateParts.length === 3
            ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`
            : context?.selectedDate ?? '';

        response.messages.push({
          type: 'text',
          content: `Perfeito! Vamos confirmar:\n\nNome: ${context?.patientName ?? ''}\nTelefone: ${context?.patientPhone ?? ''}\nData: ${displayDate}\nHorário: ${selectedTime}\n\nConfirma o agendamento? (Sim / Não)`,
        });
        response.step = 'confirm';
        response.quickReplies = ['Sim, confirmar', 'Não, cancelar'];
        break;
      }

      // ── Confirmation ──────────────────────────────────────────────────────
      case 'confirm': {
        if (!message.toLowerCase().includes('sim')) {
          response.messages.push({
            type: 'text',
            content: 'Agendamento cancelado. Posso ajudar com mais alguma coisa?',
          });
          response.step = 'main_menu';
          response.quickReplies = ['Agendar consulta', 'Tirar dúvida', 'Não, obrigado'];
          break;
        }

        // ── Validate required context fields ────────────────────────────
        const patientName = context?.patientName?.trim();
        const patientPhone = context?.patientPhone?.trim();
        const selectedDate = context?.selectedDate;
        const selectedTime = context?.selectedTime;

        if (!patientName || !patientPhone || !selectedDate || !selectedTime) {
          response.messages.push({
            type: 'text',
            content:
              'Alguns dados da consulta estão faltando. Vamos recomeçar o agendamento.',
          });
          response.step = 'collect_name';
          break;
        }

        const startDateTime = new Date(`${selectedDate}T${selectedTime}:00`);
        const endDateTime = new Date(startDateTime.getTime() + 30 * 60 * 1000);

        if (isNaN(startDateTime.getTime())) {
          response.messages.push({
            type: 'text',
            content:
              'Houve um problema com a data/hora selecionada. Por favor, comece novamente.',
          });
          response.step = 'select_date';
          break;
        }

        try {
          // ── Find or create patient ─────────────────────────────────────
          const normalisedPhone = normalisePhone(patientPhone);

          const existingPatients = await db
            .select({
              id: patients.id,
              fullName: patients.fullName,
              phone: patients.phone,
              cellphone: patients.cellphone,
              whatsappPhone: patients.whatsappPhone,
            })
            .from(patients)
            .where(and(eq(patients.companyId, companyId), isNull(patients.deletedAt)));

          const found = existingPatients.find((p: any) => {
            const phones = [p.phone, p.cellphone, p.whatsappPhone].filter(
              Boolean,
            ) as string[];
            return phones.some((ph) => normalisePhone(ph) === normalisedPhone);
          });

          let patientId: number;
          let isNewPatient = false;

          if (found) {
            patientId = found.id;
          } else {
            isNewPatient = true;
            const [newPatient] = await db
              .insert(patients)
              .values({
                companyId,
                fullName: patientName,
                phone: normalisedPhone,
                cellphone: normalisedPhone,
                whatsappPhone: normalisedPhone,
                referralSource: 'chatbot',
                dataProcessingConsent: true,
                consentDate: new Date(),
                consentMethod: 'online',
                consentIpAddress: req.ip ?? null,
                active: true,
                status: 'active',
              })
              .returning({ id: patients.id });

            patientId = newPatient.id;
          }

          // ── Create appointment ─────────────────────────────────────────
          const appointmentTitle = `Consulta — ${patientName}`;

          const [newAppointment] = await db
            .insert(appointments)
            .values({
              companyId,
              title: appointmentTitle,
              patientId,
              professionalId: context?.selectedProfessionalId ?? null,
              startTime: startDateTime,
              endTime: endDateTime,
              status: 'scheduled',
              type: 'appointment',
              notes: 'Agendado via chatbot',
              automationEnabled: true,
            })
            .returning({ id: appointments.id });

          // ── Queue WhatsApp confirmation (best-effort) ──────────────────
          try {
            await addAppointmentConfirmationJob({
              type: 'appointment-confirmation',
              appointmentId: newAppointment.id,
              patientId,
              companyId,
            });
          } catch (queueErr) {
            log.warn(
              { queueErr, appointmentId: newAppointment.id },
              'Failed to enqueue confirmation job — booking still created',
            );
          }

          log.info(
            {
              companyId,
              appointmentId: newAppointment.id,
              patientId,
              isNewPatient,
              startTime: startDateTime.toISOString(),
            },
            'Appointment created via public chatbot',
          );

          response.messages.push({
            type: 'text',
            content: `Agendamento confirmado!\n\nVocê receberá uma confirmação em breve. Até breve!`,
          });
          response.step = 'end';
        } catch (err) {
          log.error({ err }, 'Failed to create appointment via public chatbot');
          response.messages.push({
            type: 'text',
            content:
              'Houve um erro ao criar o agendamento. Por favor, entre em contato com a clínica por telefone.',
          });
          response.step = 'end';
        }
        break;
      }

      // ── Default / end ────────────────────────────────────────────────────
      default: {
        response.messages.push({
          type: 'text',
          content: `Olá! Como posso ajudá-lo?\n\n1. Agendar\n2. Dúvida\n3. Urgência`,
        });
        response.step = 'main_menu';
        response.quickReplies = ['Agendar consulta', 'Tirar dúvida', 'Estou com dor'];
      }
    }

    return res.json(response);
  } catch (err) {
    log.error({ err }, 'Unhandled error in public chatbot');
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/public/chatbot/:companyId/info
// Returns clinic name so the frontend can greet patients correctly without
// a full POST round-trip.
// ---------------------------------------------------------------------------

router.get('/:companyId/info', publicReadLimiter, async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    if (isNaN(companyId)) {
      return res.status(400).json({ error: 'companyId inválido' });
    }

    const [company] = await db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      return res.status(404).json({ error: 'Clínica não encontrada' });
    }

    return res.json({ companyId: company.id, clinicName: company.name });
  } catch (err) {
    log.error({ err }, 'Error fetching chatbot clinic info');
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
