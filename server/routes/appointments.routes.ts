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

const router = Router();

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

    const conflicts = await storage.checkAppointmentConflicts(
      companyId,
      new Date(startTime),
      new Date(endTime),
      { professionalId, roomId, excludeAppointmentId }
    );

    if (conflicts.length > 0) {
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
      });
    }

    res.status(200).json({
      available: true,
      conflicts: [],
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
      // Retornar erro 409 Conflict com detalhes dos conflitos
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
      });
    }

    // Se não há conflitos, criar o agendamento
    const appointment = await storage.createAppointment(req.body, companyId);

    // Disparar automações N8N (async, não bloqueia resposta)
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
        });
      }
    }

    const updatedAppointment = await storage.updateAppointment(parseInt(id), req.body, companyId);

    // Disparar automação se houve mudança de horário ou profissional
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

    // Enviar notificação se notifyPatient === true
    if (notifyPatient && updatedAppointment.automationEnabled !== false) {
      N8NService.triggerAutomation(id, companyId, 'appointment_cancelled')
        .catch(error => {
          console.error('Error triggering N8N automation on cancel:', error);
        });
    }

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

    res.status(204).send();
  })
);

export default router;
