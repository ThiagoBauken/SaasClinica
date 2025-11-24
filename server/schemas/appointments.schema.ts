import { z } from 'zod';

/**
 * Schema base de agendamento (sem validações complexas)
 */
const appointmentBaseSchema = z.object({
  patientId: z.number().int().positive('Patient ID deve ser um número positivo'),
  professionalId: z.number().int().positive('Professional ID deve ser um número positivo'),
  roomId: z.number().int().positive().optional().nullable(),
  startTime: z.string().datetime('Data de início inválida'),
  endTime: z.string().datetime('Data de fim inválida'),
  procedureId: z.number().int().positive().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  status: z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'])
    .optional()
    .default('scheduled'),
  reminderSent: z.boolean().optional().default(false),
});

/**
 * Schema para criação de agendamento (com validação de datas)
 */
export const createAppointmentSchema = appointmentBaseSchema.refine(
  (data) => new Date(data.startTime) < new Date(data.endTime),
  {
    message: 'Data de início deve ser anterior à data de fim',
    path: ['startTime'],
  }
);

/**
 * Schema para atualização de agendamento
 */
export const updateAppointmentSchema = appointmentBaseSchema.partial();

/**
 * Schema para filtros de busca de agendamentos
 */
export const searchAppointmentsSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  professionalId: z.string().transform(val => parseInt(val, 10)).optional(),
  patientId: z.string().transform(val => parseInt(val, 10)).optional(),
  roomId: z.string().transform(val => parseInt(val, 10)).optional(),
  status: z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'all'])
    .optional()
    .default('all'),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  {
    message: 'startDate deve ser anterior ou igual a endDate',
    path: ['startDate'],
  }
);

/**
 * Schema para cancelamento de agendamento
 */
export const cancelAppointmentSchema = z.object({
  reason: z.string().min(3, 'Motivo deve ter no mínimo 3 caracteres').max(500),
  notifyPatient: z.boolean().optional().default(true),
});

/**
 * Schema para verificação de disponibilidade
 */
export const checkAvailabilitySchema = z.object({
  professionalId: z.number().int().positive('Professional ID deve ser um número positivo').optional(),
  roomId: z.number().int().positive('Room ID deve ser um número positivo').optional(),
  startTime: z.string().datetime('Data de início inválida'),
  endTime: z.string().datetime('Data de fim inválida'),
  excludeAppointmentId: z.number().int().positive().optional(), // Para edição de agendamentos
}).refine(
  (data) => new Date(data.startTime) < new Date(data.endTime),
  {
    message: 'Data de início deve ser anterior à data de fim',
    path: ['startTime'],
  }
).refine(
  (data) => data.professionalId || data.roomId,
  {
    message: 'É necessário fornecer pelo menos professionalId ou roomId',
    path: ['professionalId'],
  }
);
