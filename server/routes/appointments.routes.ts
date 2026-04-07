import { Router } from 'express';
import { storage } from '../storage';
import { authCheck, asyncHandler } from '../middleware/auth';
import { validate, paginationSchema, idParamSchema, createPaginatedResponse, getOffset } from '../middleware/validation';
import {
  createAppointmentSchema,
  updateAppointmentSchema,
  searchAppointmentsSchema,
  cancelAppointmentSchema,
  checkAvailabilitySchema,
} from '../schemas/appointments.schema';
import { formatISO, parse, addDays } from 'date-fns';
import { z } from 'zod';
import { db } from '../db';
import { eq, and, lte, gte, ne, sql } from 'drizzle-orm';
import { appointmentProcedures, procedures, clinicSettings, appointments } from '@shared/schema';
import { notDeleted } from '../lib/soft-delete';
import { syncAppointmentToGoogle, updateGoogleCalendarEvent, deleteGoogleCalendarEvent } from '../services/google-calendar.service';
import { notifyAppointmentCreated, notifyAppointmentUpdated, notifyAppointmentDeleted, notifyAppointmentConfirmed } from '../websocket';
import { createAutomationEngine } from '../services/automation-engine';
import { progressOpportunityByPhone } from '../services/crm-auto-progression';

import { logger } from '../logger';

const router = Router();

// ── Holiday helpers ────────────────────────────────────────────────────────────

/**
 * Returns the first holiday record that blocks a given date for a company, or
 * null if the date is not a holiday.  Two conditions satisfy a match:
 *  1. The holiday's stored date falls on the same calendar day (exact match).
 *  2. The holiday is marked is_recurring_yearly and shares the same month + day
 *     as the requested date (regardless of the stored year).
 * Both company-specific (company_id = companyId) and national (company_id IS NULL)
 * holidays are considered.
 */
async function getHolidayForDate(
  companyId: number,
  date: Date
): Promise<{ id: number; name: string; isRecurringYearly: boolean } | null> {
  const result = await db.$client.query(
    `SELECT id, name, is_recurring_yearly
     FROM holidays
     WHERE (company_id = $1 OR company_id IS NULL)
       AND (
         DATE_TRUNC('day', date AT TIME ZONE 'UTC') = DATE_TRUNC('day', $2::timestamptz AT TIME ZONE 'UTC')
         OR (
           is_recurring_yearly = TRUE
           AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM $2::timestamptz)
           AND EXTRACT(DAY   FROM date) = EXTRACT(DAY   FROM $2::timestamptz)
         )
       )
     LIMIT 1`,
    [companyId, date]
  );

  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return { id: row.id, name: row.name, isRecurringYearly: row.is_recurring_yearly };
}

/**
 * Batch-loads all existing appointments in a date range to check conflicts in-memory.
 * Eliminates the N+1 pattern (was 1 query per slot, now 1 query total).
 */
async function batchLoadConflicts(
  companyId: number,
  rangeStart: Date,
  rangeEnd: Date,
  options?: { professionalId?: number; roomId?: number }
) {
  const conditions = [
    eq(appointments.companyId, companyId),
    notDeleted(appointments.deletedAt),
    lte(appointments.startTime, rangeEnd),
    gte(appointments.endTime, rangeStart),
    ne(appointments.status, 'cancelled'),
  ];
  if (options?.professionalId) conditions.push(eq(appointments.professionalId, options.professionalId));
  if (options?.roomId) conditions.push(eq(appointments.roomId, options.roomId));

  return db
    .select({
      id: appointments.id,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      professionalId: appointments.professionalId,
      roomId: appointments.roomId,
    })
    .from(appointments)
    .where(and(...conditions));
}

function hasConflict(
  existing: Array<{ startTime: Date | null; endTime: Date | null; professionalId?: number | null; roomId?: number | null }>,
  slotStart: Date,
  slotEnd: Date,
  filterOpts?: { professionalId?: number; roomId?: number }
): boolean {
  return existing.some((apt) => {
    if (!apt.startTime || !apt.endTime) return false;
    const overlaps = apt.startTime < slotEnd && apt.endTime > slotStart;
    if (!overlaps) return false;
    if (filterOpts?.professionalId && apt.professionalId !== filterOpts.professionalId) return false;
    if (filterOpts?.roomId && apt.roomId !== filterOpts.roomId) return false;
    return true;
  });
}

/**
 * Encontra os próximos N horários disponíveis (batch-optimized: 1 query instead of N)
 */
async function findNextAvailableSlots(
  companyId: number,
  professionalId: number | null | undefined,
  roomId: number | null | undefined,
  startFrom: Date,
  duration: number,
  count: number = 3
): Promise<Array<{ startTime: string; endTime: string }>> {
  const slots: Array<{ startTime: string; endTime: string }> = [];
  const workingHours = { start: 8, end: 18 };
  const slotInterval = 30;
  const maxDaysAhead = 14;

  // Pre-load all appointments in the search range (single query)
  const rangeEnd = new Date(startFrom);
  rangeEnd.setDate(rangeEnd.getDate() + maxDaysAhead);
  const existing = await batchLoadConflicts(companyId, startFrom, rangeEnd, {
    professionalId: professionalId ?? undefined,
    roomId: roomId ?? undefined,
  });

  let currentTime = new Date(startFrom);
  currentTime.setMinutes(Math.ceil(currentTime.getMinutes() / slotInterval) * slotInterval);
  const maxIterations = 100;
  let iterations = 0;

  while (slots.length < count && iterations < maxIterations) {
    iterations++;
    const hour = currentTime.getHours();
    if (hour >= workingHours.start && hour < workingHours.end) {
      const proposedEnd = new Date(currentTime.getTime() + duration);
      if (proposedEnd.getHours() < workingHours.end) {
        if (!hasConflict(existing, currentTime, proposedEnd)) {
          slots.push({ startTime: currentTime.toISOString(), endTime: proposedEnd.toISOString() });
        }
      }
    }
    currentTime = new Date(currentTime.getTime() + slotInterval * 60 * 1000);
    if (currentTime.getHours() >= workingHours.end) {
      currentTime.setDate(currentTime.getDate() + 1);
      currentTime.setHours(workingHours.start, 0, 0, 0);
    }
  }
  return slots;
}

/**
 * Encontra salas alternativas disponíveis no mesmo horário (batch-optimized: 2 queries instead of N)
 */
async function findAlternativeRooms(
  companyId: number,
  currentRoomId: number,
  startTime: Date,
  endTime: Date
): Promise<Array<{ roomId: number; roomName: string }>> {
  // 1 query: all rooms; 1 query: all conflicts in the time range
  const [allRooms, existing] = await Promise.all([
    storage.getRooms(companyId),
    batchLoadConflicts(companyId, startTime, endTime),
  ]);

  return allRooms
    .filter((room) => room.id !== currentRoomId)
    .filter((room) => !hasConflict(existing, startTime, endTime, { roomId: room.id }))
    .map((room) => ({ roomId: room.id, roomName: room.name }));
}

/**
 * Encontra todos os horários disponíveis em um dia específico (batch-optimized: 1 query instead of ~20)
 */
async function findAvailableSlotsForDay(
  companyId: number,
  professionalId: number | null | undefined,
  roomId: number | null | undefined,
  date: Date,
  duration: number
): Promise<Array<{ startTime: string; endTime: string; available: boolean }>> {
  const slots: Array<{ startTime: string; endTime: string; available: boolean }> = [];
  const workingHours = { start: 8, end: 18 };
  const slotInterval = 30;

  const dayStart = new Date(date);
  dayStart.setHours(workingHours.start, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(workingHours.end, 0, 0, 0);

  // Single query: load all appointments for this day
  const existing = await batchLoadConflicts(companyId, dayStart, dayEnd, {
    professionalId: professionalId ?? undefined,
    roomId: roomId ?? undefined,
  });

  let currentTime = new Date(dayStart);
  while (currentTime.getHours() < workingHours.end) {
    const proposedEnd = new Date(currentTime.getTime() + duration);
    if (proposedEnd.getHours() <= workingHours.end) {
      slots.push({
        startTime: currentTime.toISOString(),
        endTime: proposedEnd.toISOString(),
        available: !hasConflict(existing, currentTime, proposedEnd),
      });
    }
    currentTime = new Date(currentTime.getTime() + slotInterval * 60 * 1000);
  }
  return slots;
}

// Schema combinado para query params de listagem (sem refinement para evitar erro de merge)
const listAppointmentsQuerySchema = z.object({
  // Campos de paginação
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  // Campos de busca de agendamentos
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  professionalId: z.coerce.number().int().positive().optional(),
  patientId: z.coerce.number().int().positive().optional(),
  roomId: z.coerce.number().int().positive().optional(),
  status: z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'all'])
    .optional()
    .default('all'),
});

/**
 * GET /api/v1/appointments
 * Lista agendamentos com filtros (paginado)
 */
router.get(
  '/',
  authCheck,
  validate({ query: listAppointmentsQuerySchema }),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { page, limit, startDate, endDate, professionalId, patientId, roomId, status } = req.query as any;

    const appointments = await storage.getAppointments(companyId, {
      startDate,
      endDate,
      professionalId,
      patientId,
      status: status === 'all' ? undefined : status,
    });

    // Aplicar paginação
    const total = appointments.length;
    const offset = getOffset(page, limit);
    const paginatedData = appointments.slice(offset, offset + limit);

    res.json(createPaginatedResponse(paginatedData, total, page, limit));
  })
);

/**
 * GET /api/v1/appointments/:id
 * Busca um agendamento específico
 */
router.get(
  '/:id',
  authCheck,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;

    const appointment = await storage.getAppointment(parseInt(id), companyId);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json(appointment);
  })
);

/**
 * POST /api/v1/appointments/check-availability
 * Verifica disponibilidade de profissional e/ou sala
 * Retorna também sugestões de horários livres se houver conflito
 */
router.post(
  '/check-availability',
  authCheck,
  validate({ body: checkAvailabilitySchema }),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { professionalId, roomId, startTime, endTime, excludeAppointmentId } = req.body;
    const requestedStart = new Date(startTime);
    const requestedEnd = new Date(endTime);
    const duration = requestedEnd.getTime() - requestedStart.getTime();

    // Check if the requested date falls on a holiday before checking booking conflicts
    const holiday = await getHolidayForDate(companyId, requestedStart);
    if (holiday) {
      return res.status(200).json({
        available: false,
        holiday: {
          id: holiday.id,
          name: holiday.name,
          isRecurringYearly: holiday.isRecurringYearly,
        },
        conflicts: [
          {
            type: 'holiday',
            holidayId: holiday.id,
            title: holiday.name,
            startTime: requestedStart.toISOString(),
            endTime: requestedEnd.toISOString(),
          },
        ],
        suggestions: {
          nextAvailableSlots: await findNextAvailableSlots(
            companyId,
            professionalId,
            roomId,
            requestedStart,
            duration,
            3
          ),
          alternativeRooms: [],
        },
      });
    }

    const conflicts = await storage.checkAppointmentConflicts(
      companyId,
      requestedStart,
      requestedEnd,
      { professionalId, roomId, excludeAppointmentId }
    );

    // Check schedule blocks (vacations, holidays, maintenance, etc.)
    const blockReasonLabels: Record<string, string> = {
      ferias: 'Férias',
      folga: 'Folga',
      compromisso: 'Compromisso pessoal',
      manutencao: 'Manutenção',
      feriado: 'Feriado',
    };

    const blockResult = await db.$client.query(
      `SELECT id, title, reason, start_time, end_time, professional_id, room_id
       FROM schedule_blocks
       WHERE company_id = $1
         AND deleted_at IS NULL
         AND start_time < $3
         AND end_time > $2
         AND (
           ($4::int IS NULL OR professional_id IS NULL OR professional_id = $4)
           OR
           ($5::int IS NULL OR room_id IS NULL OR room_id = $5)
         )`,
      [companyId, requestedStart.toISOString(), requestedEnd.toISOString(), professionalId ?? null, roomId ?? null]
    );

    const blockConflicts = blockResult.rows.map((b: any) => ({
      conflictType: 'schedule_block',
      id: b.id,
      reason: blockReasonLabels[b.reason] || b.reason,
      title: b.title,
      startTime: b.start_time,
      endTime: b.end_time,
    }));

    const allConflicts = [...conflicts, ...blockConflicts];

    if (allConflicts.length > 0) {
      // Encontrar próximos horários disponíveis
      const suggestions = await findNextAvailableSlots(
        companyId,
        professionalId,
        roomId,
        requestedStart,
        duration,
        3 // Sugerir 3 próximos horários
      );

      // Verificar salas alternativas disponíveis
      const alternativeRooms = roomId ? await findAlternativeRooms(
        companyId,
        roomId,
        requestedStart,
        requestedEnd
      ) : [];

      return res.status(200).json({
        available: false,
        conflicts: allConflicts.map((conflict: any) => ({
          type: conflict.conflictType, // 'professional', 'room', or 'schedule_block'
          appointmentId: conflict.id,
          patientName: conflict.patientName,
          professionalName: conflict.professionalName,
          roomName: conflict.roomName,
          reason: conflict.reason,
          title: conflict.title,
          startTime: conflict.startTime,
          endTime: conflict.endTime,
        })),
        suggestions: {
          nextAvailableSlots: suggestions,
          alternativeRooms: alternativeRooms,
        },
      });
    }

    res.status(200).json({
      available: true,
      conflicts: [],
      suggestions: {
        nextAvailableSlots: [],
        alternativeRooms: [],
      },
    });
  })
);

/**
 * POST /api/v1/appointments/suggest-times
 * Sugere horários disponíveis para um profissional em um dia
 */
router.post(
  '/suggest-times',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { professionalId, roomId, date, duration = 30 } = req.body;

    if (!professionalId && !date) {
      return res.status(400).json({ error: 'professionalId and date are required' });
    }

    const suggestions = await findAvailableSlotsForDay(
      companyId,
      professionalId,
      roomId,
      new Date(date),
      duration * 60 * 1000 // converter minutos para milissegundos
    );

    res.json({
      date,
      professionalId,
      roomId,
      duration,
      availableSlots: suggestions,
    });
  })
);

/**
 * POST /api/v1/appointments
 * Cria novo agendamento
 */
router.post(
  '/',
  authCheck,
  validate({ body: createAppointmentSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { professionalId, roomId, startTime, endTime } = req.body;

    // Buscar buffer de agendamento configurado para a clínica
    const [settingsRow] = await db
      .select({ appointmentBufferMinutes: clinicSettings.appointmentBufferMinutes })
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);
    const bufferMs = ((settingsRow?.appointmentBufferMinutes) || 0) * 60 * 1000;

    // Verificar conflitos de horário ANTES de criar (com buffer expandido)
    const conflictStart = new Date(new Date(startTime).getTime() - bufferMs);
    const conflictEnd = new Date(new Date(endTime).getTime() + bufferMs);
    const conflicts = await storage.checkAppointmentConflicts(
      companyId,
      conflictStart,
      conflictEnd,
      { professionalId, roomId }
    );

    if (conflicts.length > 0) {
      // Encontrar sugestões de horários disponíveis
      const requestedStart = new Date(startTime);
      const requestedEnd = new Date(endTime);
      const duration = requestedEnd.getTime() - requestedStart.getTime();

      const suggestions = await findNextAvailableSlots(
        companyId,
        professionalId,
        roomId,
        requestedStart,
        duration,
        3
      );

      // Verificar salas alternativas se uma sala foi especificada
      const alternativeRooms = roomId ? await findAlternativeRooms(
        companyId,
        roomId,
        requestedStart,
        requestedEnd
      ) : [];

      // Retornar erro 409 Conflict com detalhes dos conflitos E sugestões
      return res.status(409).json({
        error: 'Conflito de agendamento detectado',
        message: 'Já existe um agendamento no horário solicitado',
        conflicts: conflicts.map((conflict: any) => ({
          type: conflict.conflictType,
          appointmentId: conflict.id,
          patientName: conflict.patientName,
          professionalName: conflict.professionalName,
          roomName: conflict.roomName,
          startTime: conflict.startTime,
          endTime: conflict.endTime,
        })),
        suggestions: {
          nextAvailableSlots: suggestions,
          alternativeRooms: alternativeRooms,
          message: suggestions.length > 0
            ? 'Horários alternativos disponíveis encontrados'
            : 'Nenhum horário alternativo encontrado nos próximos dias',
        },
      });
    }

    // Criar agendamento com lock pessimista (previne double-booking)
    const appointment = await db.transaction(async (tx: any) => {
      // Re-verificar conflitos DENTRO da transaction com FOR UPDATE
      // Isso garante que requests concorrentes sejam serializadas
      const txConflicts = await tx.execute(sql`
        SELECT id FROM appointments
        WHERE company_id = ${companyId}
          AND (
            (professional_id = ${professionalId} AND professional_id IS NOT NULL)
            OR (room_id = ${roomId} AND room_id IS NOT NULL)
          )
          AND start_time < ${endTime}::timestamptz
          AND end_time > ${startTime}::timestamptz
          AND status NOT IN ('cancelled', 'no_show')
          AND deleted_at IS NULL
        FOR UPDATE
      `);

      if (txConflicts.rows.length > 0) {
        throw new Error('CONFLICT_DETECTED');
      }

      // Inserir dentro da transaction (garante atomicidade)
      return await storage.createAppointment(req.body, companyId);
    }).catch((err: any) => {
      if (err.message === 'CONFLICT_DETECTED') {
        return null; // Sinaliza conflito detectado dentro da TX
      }
      throw err; // Re-throw outros erros
    });

    if (!appointment) {
      return res.status(409).json({
        error: 'Conflito de agendamento detectado',
        message: 'Outro agendamento foi criado neste horário enquanto sua requisição era processada. Tente novamente.',
      });
    }

    // Operações assíncronas FORA da transaction (não bloqueiam o agendamento)

    // Disparar automação nativa
    const automationEngine = createAutomationEngine(companyId);
    automationEngine.onAppointmentCreated(appointment.id)
      .then(result => {
        logger.info({ value: result.success ? 'sucesso' : 'falha' }, 'Automação de criação executada: {value}')
      })
      .catch(error => {
        logger.error({ err: error }, 'Erro na automação de criação:');
      });

    // Sincronizar com Google Calendar (async)
    if (appointment.professionalId) {
      syncAppointmentToGoogle(appointment.id, appointment.professionalId, companyId)
        .catch(error => {
          logger.error({ err: error }, 'Error syncing to Google Calendar:');
        });
    }

    // Notificar via WebSocket (em tempo real)
    notifyAppointmentCreated(companyId, appointment);

    res.status(201).json(appointment);
  })
);

/**
 * PATCH /api/v1/appointments/:id
 * Atualiza um agendamento
 */
router.patch(
  '/:id',
  authCheck,
  validate({
    params: idParamSchema,
    body: updateAppointmentSchema
  }),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;

    // Verificar se o appointment pertence à company
    const existingAppointment = await storage.getAppointment(parseInt(id));

    if (!existingAppointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Se está atualizando horário, profissional ou sala, verificar conflitos
    // Extrair confirmationMethod antes de passar req.body para storage (nao é um campo do appointment)
    const { confirmationMethod: _confirmationMethod, ...appointmentUpdateBody } = req.body;
    const { professionalId, roomId, startTime, endTime } = appointmentUpdateBody;

    if (startTime || endTime || professionalId !== undefined || roomId !== undefined) {
      const checkStartTime = startTime ? new Date(startTime) : new Date(existingAppointment.startTime);
      const checkEndTime = endTime ? new Date(endTime) : new Date(existingAppointment.endTime);
      const checkProfessionalId = professionalId !== undefined ? professionalId : existingAppointment.professionalId;
      const checkRoomId = roomId !== undefined ? roomId : existingAppointment.roomId;

      const conflicts = await storage.checkAppointmentConflicts(
        companyId,
        checkStartTime,
        checkEndTime,
        {
          professionalId: checkProfessionalId,
          roomId: checkRoomId,
          excludeAppointmentId: parseInt(id) // Excluir o próprio appointment
        }
      );

      if (conflicts.length > 0) {
        // Calcular duração e gerar sugestões
        const duration = checkEndTime.getTime() - checkStartTime.getTime();

        const suggestions = await findNextAvailableSlots(
          companyId,
          checkProfessionalId,
          checkRoomId,
          checkStartTime,
          duration,
          3
        );

        // Verificar salas alternativas se uma sala foi especificada
        const alternativeRooms = checkRoomId ? await findAlternativeRooms(
          companyId,
          checkRoomId,
          checkStartTime,
          checkEndTime
        ) : [];

        return res.status(409).json({
          error: 'Conflito de agendamento detectado',
          message: 'Já existe um agendamento no novo horário solicitado',
          conflicts: conflicts.map((conflict: any) => ({
            type: conflict.conflictType,
            appointmentId: conflict.id,
            patientName: conflict.patientName,
            professionalName: conflict.professionalName,
            roomName: conflict.roomName,
            startTime: conflict.startTime,
            endTime: conflict.endTime,
          })),
          suggestions: {
            nextAvailableSlots: suggestions,
            alternativeRooms: alternativeRooms,
            message: suggestions.length > 0
              ? 'Horários alternativos disponíveis encontrados'
              : 'Nenhum horário alternativo encontrado nos próximos dias',
          },
        });
      }
    }

    const updatedAppointment = await storage.updateAppointment(parseInt(id), appointmentUpdateBody, companyId);

    // CRM: Progride pipeline quando status muda para completed ou payment-related
    const newStatus = appointmentUpdateBody.status;
    if (newStatus && newStatus !== existingAppointment.status) {
      const patient = existingAppointment.patientId
        ? await storage.getPatient(existingAppointment.patientId, companyId)
        : null;
      const patientPhone = patient?.phone || (patient as any)?.whatsappPhone;

      if (patientPhone) {
        if (newStatus === 'completed') {
          progressOpportunityByPhone(companyId, patientPhone, 'consultation_done', {
            appointmentId: parseInt(id),
            appointmentStatus: newStatus,
          }).catch(err => logger.error({ err: err }, 'CRM progression error (consultation_done):'));
        }
      }
    }

    // Notificar recepção quando paciente confirma consulta
    if (newStatus === 'confirmed' && newStatus !== existingAppointment.status) {
      try {
        const confirmationMethod = _confirmationMethod || 'manual';
        const patientName = updatedAppointment.patientName || existingAppointment.patientName || 'Paciente';
        notifyAppointmentConfirmed(companyId, parseInt(id), patientName, confirmationMethod);
      } catch (wsErr) {
        logger.error({ err: wsErr }, 'Failed to notify reception of appointment confirmation');
      }
    }

    // Agendamento recorrente: ao completar, auto-criar próxima consulta se procedimento configurado
    if (newStatus === 'completed' && newStatus !== existingAppointment.status) {
      scheduleRecurringAppointment(parseInt(id), existingAppointment, companyId)
        .catch(err => logger.error({ err: err }, 'Recurring appointment scheduling error:'));

      // Auto-deduzir estoque de materiais usados nos procedimentos
      import('../services/stock-auto-deduct').then(({ autoDeductStock }) => {
        autoDeductStock(companyId, parseInt(id), user.id)
          .then(result => {
            if (result.alerts.length > 0) {
              logger.info({ alerts: result.alerts }, 'Stock alerts')
            }
          })
          .catch(err => logger.error({ err: err }, 'Stock auto-deduction error:'));
      }).catch(() => {});
    }

    // Verificar se houve mudança de horário (reagendamento)
    const wasRescheduled = startTime && existingAppointment.startTime !== startTime;

    // Disparar automação nativa para reagendamento
    if (wasRescheduled) {
      const automationEngine = createAutomationEngine(companyId);
      automationEngine.onAppointmentRescheduled(
        parseInt(id),
        new Date(existingAppointment.startTime),
        new Date(startTime)
      )
        .then(result => {
          logger.info({ value: result.success ? 'sucesso' : 'falha' }, 'Automação de reagendamento executada: {value}')
        })
        .catch(error => {
          logger.error({ err: error }, 'Erro na automação de reagendamento:');
        });
    }

    // Atualizar Google Calendar se houve mudança
    if ((startTime || endTime || professionalId !== undefined) && updatedAppointment.professionalId) {
      updateGoogleCalendarEvent(parseInt(id), updatedAppointment.professionalId, companyId)
        .catch(error => {
          logger.error({ err: error }, 'Error updating Google Calendar event:');
        });
    }

    // Notificar via WebSocket (em tempo real)
    notifyAppointmentUpdated(companyId, updatedAppointment);

    res.json(updatedAppointment);
  })
);

/**
 * POST /api/v1/appointments/:id/cancel
 * Cancela um agendamento
 */
router.post(
  '/:id/cancel',
  authCheck,
  validate({
    params: idParamSchema,
    body: cancelAppointmentSchema
  }),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;
    const { reason, notifyPatient } = req.body;

    // Atualizar status para cancelled
    const updatedAppointment = await storage.updateAppointment(id, {
      status: 'cancelled',
      notes: `Cancelado: ${reason}`,
    }, companyId);

    // Disparar automação nativa de cancelamento
    const automationEngine = createAutomationEngine(companyId);
    automationEngine.onAppointmentCancelled(parseInt(id), reason)
      .then(result => {
        logger.info({ value: result.success ? 'sucesso' : 'falha' }, 'Automação de cancelamento executada: {value}')
      })
      .catch(error => {
        logger.error({ err: error }, 'Erro na automação de cancelamento:');
      });

    // Notificar via WebSocket (atualização em tempo real)
    notifyAppointmentUpdated(companyId, updatedAppointment);

    res.json(updatedAppointment);
  })
);

/**
 * DELETE /api/v1/appointments/:id
 * Remove um agendamento
 */
router.delete(
  '/:id',
  authCheck,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;

    // Buscar appointment antes de deletar para pegar o googleCalendarEventId
    const appointment = await storage.getAppointment(parseInt(id), companyId);

    const deleted = await storage.deleteAppointment(parseInt(id), companyId);

    if (!deleted) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Deletar do Google Calendar se existir eventId
    if (appointment?.googleCalendarEventId && appointment.professionalId) {
      deleteGoogleCalendarEvent(appointment.googleCalendarEventId, appointment.professionalId, companyId)
        .catch(error => {
          logger.error({ err: error }, 'Error deleting Google Calendar event:');
        });
    }

    // Notificar via WebSocket (em tempo real)
    notifyAppointmentDeleted(companyId, parseInt(id));

    res.status(204).send();
  })
);

/**
 * GET /api/v1/appointments/available-slots
 * Retorna horários disponíveis para os próximos N dias
 * Usado pelo AI Agent para oferecer reagendamento
 */
const availableSlotsQuerySchema = z.object({
  companyId: z.coerce.number().int().positive(),
  days: z.coerce.number().int().positive().max(30).optional().default(7),
  professionalId: z.coerce.number().int().positive().optional(),
  duration: z.coerce.number().int().positive().optional().default(30),
});

router.get(
  '/available-slots',
  asyncHandler(async (req, res) => {
    const parsed = availableSlotsQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid parameters',
        details: parsed.error.errors
      });
    }

    const { companyId, days, professionalId, duration } = parsed.data;

    const slots: Array<{
      date: string;
      dayOfWeek: string;
      start: string;
      end: string;
      startTime: string;
      endTime: string;
    }> = [];

    const workingHours = { start: 8, end: 18 };
    const slotInterval = 30;
    const durationMs = duration * 60 * 1000;

    for (let dayOffset = 0; dayOffset < days; dayOffset++) {
      const date = new Date();
      date.setDate(date.getDate() + dayOffset);
      date.setHours(workingHours.start, 0, 0, 0);

      if (date.getDay() === 0) continue;

      const endHour = date.getDay() === 6 ? 12 : workingHours.end;

      let currentTime = new Date(date);

      if (dayOffset === 0) {
        const now = new Date();
        if (now.getHours() >= endHour) continue;
        if (now.getHours() >= workingHours.start) {
          currentTime = new Date(now);
          currentTime.setMinutes(Math.ceil(currentTime.getMinutes() / slotInterval) * slotInterval);
          currentTime.setSeconds(0, 0);
        }
      }

      while (currentTime.getHours() < endHour) {
        const proposedEnd = new Date(currentTime.getTime() + durationMs);

        if (proposedEnd.getHours() <= endHour || (proposedEnd.getHours() === endHour && proposedEnd.getMinutes() === 0)) {
          const conflicts = await storage.checkAppointmentConflicts(
            companyId,
            currentTime,
            proposedEnd,
            { professionalId }
          );

          if (conflicts.length === 0) {
            const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

            slots.push({
              date: currentTime.toISOString().split('T')[0],
              dayOfWeek: dayNames[currentTime.getDay()],
              start: currentTime.toISOString(),
              end: proposedEnd.toISOString(),
              startTime: currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              endTime: proposedEnd.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            });

            if (slots.length >= 50) break;
          }
        }

        currentTime = new Date(currentTime.getTime() + slotInterval * 60 * 1000);
      }

      if (slots.length >= 50) break;
    }

    res.json({
      success: true,
      companyId,
      days,
      duration,
      totalSlots: slots.length,
      data: slots,
      slots,
    });
  })
);

/**
 * Auto-agenda a próxima consulta recorrente após um agendamento ser marcado como concluído.
 * Para cada procedimento associado que tem autoScheduleNext=true, cria um novo agendamento.
 */
async function scheduleRecurringAppointment(
  appointmentId: number,
  existingAppointment: any,
  companyId: number
): Promise<void> {
  // Buscar procedimentos associados ao agendamento
  const apptProcedures = await db
    .select({
      procedureId: appointmentProcedures.procedureId,
      procedureName: procedures.name,
      procedureDuration: procedures.duration,
      autoScheduleNext: procedures.autoScheduleNext,
      defaultRecurrenceIntervalDays: procedures.defaultRecurrenceIntervalDays,
    })
    .from(appointmentProcedures)
    .innerJoin(procedures, eq(appointmentProcedures.procedureId, procedures.id))
    .where(eq(appointmentProcedures.appointmentId, appointmentId));

  if (!apptProcedures.length) return;

  const endTime = new Date(existingAppointment.endTime);

  for (const proc of apptProcedures) {
    if (!proc.autoScheduleNext || !proc.defaultRecurrenceIntervalDays) continue;

    // Calcular próxima data: endTime + intervalo em dias
    const nextStart = new Date(endTime);
    nextStart.setDate(nextStart.getDate() + proc.defaultRecurrenceIntervalDays);

    // Manter o mesmo horário do dia
    const durationMs = (proc.procedureDuration || 30) * 60 * 1000;
    const nextEnd = new Date(nextStart.getTime() + durationMs);

    const newAppointment = await storage.createAppointment(
      {
        title: `Retorno: ${proc.procedureName}`,
        patientId: existingAppointment.patientId,
        professionalId: existingAppointment.professionalId,
        roomId: existingAppointment.roomId,
        startTime: nextStart,
        endTime: nextEnd,
        status: 'scheduled',
        type: existingAppointment.type || 'consultation',
        recurring: true,
        notes: `Agendamento automático de retorno gerado de #${appointmentId}`,
        companyId,
      },
      companyId
    );

    logger.info({ appointmentId: newAppointment.id, nextStart: nextStart.toISOString() }, 'Next recurring appointment created');
  }
}

export default router;
