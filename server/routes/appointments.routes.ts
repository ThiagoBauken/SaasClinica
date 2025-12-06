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
import { N8NService } from '../services/n8n.service';
import { syncAppointmentToGoogle, updateGoogleCalendarEvent, deleteGoogleCalendarEvent } from '../services/google-calendar.service';
import { notifyAppointmentCreated, notifyAppointmentUpdated, notifyAppointmentDeleted } from '../websocket';
import { createAutomationEngine } from '../services/automation-engine';

const router = Router();

/**
 * Encontra os próximos N horários disponíveis
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
  const workingHours = { start: 8, end: 18 }; // 8h às 18h
  const slotInterval = 30; // Verificar a cada 30 minutos

  let currentTime = new Date(startFrom);
  currentTime.setMinutes(Math.ceil(currentTime.getMinutes() / slotInterval) * slotInterval);

  const maxIterations = 100; // Limite de segurança
  let iterations = 0;

  while (slots.length < count && iterations < maxIterations) {
    iterations++;

    // Verificar se está dentro do horário de trabalho
    const hour = currentTime.getHours();
    if (hour >= workingHours.start && hour < workingHours.end) {
      const proposedEnd = new Date(currentTime.getTime() + duration);

      // Verificar se não ultrapassa horário de trabalho
      if (proposedEnd.getHours() < workingHours.end) {
        const conflicts = await storage.checkAppointmentConflicts(
          companyId,
          currentTime,
          proposedEnd,
          { professionalId: professionalId ?? undefined, roomId: roomId ?? undefined }
        );

        if (conflicts.length === 0) {
          slots.push({
            startTime: currentTime.toISOString(),
            endTime: proposedEnd.toISOString(),
          });
        }
      }
    }

    // Avançar para próximo slot
    currentTime = new Date(currentTime.getTime() + slotInterval * 60 * 1000);

    // Se passou do horário de trabalho, pular para próximo dia
    if (currentTime.getHours() >= workingHours.end) {
      currentTime.setDate(currentTime.getDate() + 1);
      currentTime.setHours(workingHours.start, 0, 0, 0);
    }
  }

  return slots;
}

/**
 * Encontra salas alternativas disponíveis no mesmo horário
 */
async function findAlternativeRooms(
  companyId: number,
  currentRoomId: number,
  startTime: Date,
  endTime: Date
): Promise<Array<{ roomId: number; roomName: string }>> {
  // Buscar todas as salas da clínica (assumindo que existe essa função no storage)
  const allRooms = await storage.getRooms(companyId);
  const alternatives: Array<{ roomId: number; roomName: string }> = [];

  for (const room of allRooms) {
    if (room.id === currentRoomId) continue; // Pular a sala atual

    const conflicts = await storage.checkAppointmentConflicts(
      companyId,
      startTime,
      endTime,
      { roomId: room.id }
    );

    if (conflicts.length === 0) {
      alternatives.push({
        roomId: room.id,
        roomName: room.name,
      });
    }
  }

  return alternatives;
}

/**
 * Encontra todos os horários disponíveis em um dia específico
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
  const slotInterval = 30; // Gerar slots a cada 30 minutos

  // Normalizar data para início do dia
  const dayStart = new Date(date);
  dayStart.setHours(workingHours.start, 0, 0, 0);

  let currentTime = new Date(dayStart);

  while (currentTime.getHours() < workingHours.end) {
    const proposedEnd = new Date(currentTime.getTime() + duration);

    // Verificar se o slot completo cabe no horário de trabalho
    if (proposedEnd.getHours() <= workingHours.end) {
      const conflicts = await storage.checkAppointmentConflicts(
        companyId,
        currentTime,
        proposedEnd,
        { professionalId: professionalId ?? undefined, roomId: roomId ?? undefined }
      );

      slots.push({
        startTime: currentTime.toISOString(),
        endTime: proposedEnd.toISOString(),
        available: conflicts.length === 0,
      });
    }

    // Avançar para próximo intervalo
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
    const user = req.user as any;
    const companyId = user?.companyId;

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
    const user = req.user as any;
    const companyId = user?.companyId;

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
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { professionalId, roomId, startTime, endTime, excludeAppointmentId } = req.body;
    const requestedStart = new Date(startTime);
    const requestedEnd = new Date(endTime);
    const duration = requestedEnd.getTime() - requestedStart.getTime();

    const conflicts = await storage.checkAppointmentConflicts(
      companyId,
      requestedStart,
      requestedEnd,
      { professionalId, roomId, excludeAppointmentId }
    );

    if (conflicts.length > 0) {
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
        conflicts: conflicts.map((conflict: any) => ({
          type: conflict.conflictType, // 'professional' ou 'room'
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
    const user = req.user as any;
    const companyId = user?.companyId;

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
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { professionalId, roomId, startTime, endTime } = req.body;

    // Verificar conflitos de horário ANTES de criar
    const conflicts = await storage.checkAppointmentConflicts(
      companyId,
      new Date(startTime),
      new Date(endTime),
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

    // Se não há conflitos, criar o agendamento
    const appointment = await storage.createAppointment(req.body, companyId);

    // Disparar automação nativa (substitui N8N gradualmente)
    const automationEngine = createAutomationEngine(companyId);
    automationEngine.onAppointmentCreated(appointment.id)
      .then(result => {
        console.log(`✅ Automação de criação executada: ${result.success ? 'sucesso' : 'falha'}`);
      })
      .catch(error => {
        console.error('❌ Erro na automação de criação:', error);
      });

    // Disparar automações N8N (async, não bloqueia resposta) - mantido para testes
    if (appointment.automationEnabled !== false) {
      N8NService.triggerAutomation(appointment.id, companyId, 'appointment_created')
        .catch(error => {
          console.error('Error triggering N8N automation:', error);
          // Não falhar a requisição se automação falhar
        });
    }

    // Sincronizar com Google Calendar (async)
    if (appointment.professionalId) {
      syncAppointmentToGoogle(appointment.id, appointment.professionalId, companyId)
        .catch(error => {
          console.error('Error syncing to Google Calendar:', error);
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
    const user = req.user as any;
    const companyId = user?.companyId;

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
    const { professionalId, roomId, startTime, endTime } = req.body;

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

    const updatedAppointment = await storage.updateAppointment(parseInt(id), req.body, companyId);

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
          console.log(`✅ Automação de reagendamento executada: ${result.success ? 'sucesso' : 'falha'}`);
        })
        .catch(error => {
          console.error('❌ Erro na automação de reagendamento:', error);
        });
    }

    // Disparar automação N8N se houve mudança de horário ou profissional - mantido para testes
    if ((startTime || endTime || professionalId !== undefined) && updatedAppointment.automationEnabled !== false) {
      N8NService.triggerAutomation(parseInt(id), companyId, 'appointment_updated')
        .catch(error => {
          console.error('Error triggering N8N automation on update:', error);
        });
    }

    // Atualizar Google Calendar se houve mudança
    if ((startTime || endTime || professionalId !== undefined) && updatedAppointment.professionalId) {
      updateGoogleCalendarEvent(parseInt(id), updatedAppointment.professionalId, companyId)
        .catch(error => {
          console.error('Error updating Google Calendar event:', error);
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
    const user = req.user as any;
    const companyId = user?.companyId;

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
        console.log(`✅ Automação de cancelamento executada: ${result.success ? 'sucesso' : 'falha'}`);
      })
      .catch(error => {
        console.error('❌ Erro na automação de cancelamento:', error);
      });

    // Enviar notificação via N8N se notifyPatient === true - mantido para testes
    if (notifyPatient && updatedAppointment.automationEnabled !== false) {
      N8NService.triggerAutomation(id, companyId, 'appointment_cancelled')
        .catch(error => {
          console.error('Error triggering N8N automation on cancel:', error);
        });
    }

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
    const user = req.user as any;
    const companyId = user?.companyId;

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
          console.error('Error deleting Google Calendar event:', error);
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
 * Usado pelo N8N para oferecer reagendamento
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

export default router;
