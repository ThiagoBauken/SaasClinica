/**
 * Public Booking Routes — no authentication required
 *
 * Allows patients to self-schedule appointments directly via a public web page
 * without needing to interact with the WhatsApp bot.
 *
 * All endpoints are scoped by :companyId so a single server instance can serve
 * every tenant's booking page.
 *
 * Routes:
 *   GET  /api/public/booking/:companyId/info    — Clinic info, procedures, working hours
 *   GET  /api/public/booking/:companyId/slots   — Available time slots for a date
 *   POST /api/public/booking/:companyId/book    — Create appointment + patient if new
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { eq, and, isNull } from 'drizzle-orm';
import {
  clinicSettings,
  companies,
  procedures,
  workingHours,
  patients,
  appointments,
  users,
} from '@shared/schema';
import { getAvailableSlots } from '../services/availability.service';
import { addAppointmentConfirmationJob } from '../queue/queues';
import { publicReadLimiter, publicSubmitLimiter } from '../middleware/public-rate-limit';
import { logger } from '../logger';

const router = Router();
const log = logger.child({ module: 'public-booking' });

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const bookingBodySchema = z.object({
  patientName: z.string().min(2, 'Nome obrigatorio'),
  patientPhone: z.string().min(8, 'Telefone obrigatorio'),
  patientCpf: z.string().optional().nullable(),
  patientEmail: z.string().email('Email invalido').optional().nullable().or(z.literal('')),
  procedureId: z.number().int().positive(),
  professionalId: z.number().int().positive(),
  startTime: z.string().datetime({ message: 'startTime deve ser ISO 8601' }),
  endTime: z.string().datetime({ message: 'endTime deve ser ISO 8601' }),
});

// ---------------------------------------------------------------------------
// Helper: normalise phone to digits only
// ---------------------------------------------------------------------------
function normalisePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

// ---------------------------------------------------------------------------
// GET /api/public/booking/:companyId/info
// ---------------------------------------------------------------------------

router.get('/:companyId/info', publicReadLimiter, async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    if (isNaN(companyId)) {
      return res.status(400).json({ error: 'companyId invalido' });
    }

    // Clinic settings + company fallback
    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      return res.status(404).json({ error: 'Clinica nao encontrada' });
    }

    // Active procedures
    const procedureRows = await db
      .select({
        id: procedures.id,
        name: procedures.name,
        duration: procedures.duration,
        price: procedures.price,
        description: procedures.description,
        color: procedures.color,
        category: procedures.category,
      })
      .from(procedures)
      .where(
        and(
          eq(procedures.companyId, companyId),
          eq(procedures.active, true),
        ),
      );

    // Working hours — one row per (userId, dayOfWeek)
    // Join with users so we only return hours for active professionals
    const whRows = await db
      .select({
        id: workingHours.id,
        userId: workingHours.userId,
        dayOfWeek: workingHours.dayOfWeek,
        startTime: workingHours.startTime,
        endTime: workingHours.endTime,
        isWorking: workingHours.isWorking,
        breakStart: workingHours.breakStart,
        breakEnd: workingHours.breakEnd,
        professionalName: users.fullName,
      })
      .from(workingHours)
      .innerJoin(users, eq(users.id, workingHours.userId))
      .where(
        and(
          eq(users.companyId, companyId),
          eq(users.active, true),
          eq(workingHours.isWorking, true),
        ),
      );

    // Active professionals (dentists + admins who have appointments)
    const profRows = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        speciality: users.speciality,
        profileImageUrl: users.profileImageUrl,
      })
      .from(users)
      .where(
        and(
          eq(users.companyId, companyId),
          eq(users.active, true),
          isNull(users.deletedAt),
        ),
      );

    const clinicName = settings?.name ?? company.name;
    const clinicPhone = settings?.phone ?? settings?.cellphone ?? company.phone ?? null;
    const clinicAddress = settings
      ? [settings.address, settings.number, settings.neighborhood, settings.city, settings.state]
          .filter(Boolean)
          .join(', ')
      : company.address ?? null;

    return res.json({
      clinicName,
      clinicPhone,
      clinicAddress,
      clinicLogo: settings?.logo ?? null,
      procedures: procedureRows,
      workingHours: whRows,
      professionals: profRows,
    });
  } catch (err) {
    log.error({ err }, 'Error fetching public booking info');
    return res.status(500).json({ error: 'Erro interno ao buscar informacoes da clinica' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/public/booking/:companyId/slots?date=YYYY-MM-DD&procedureId=5&professionalId=2
// ---------------------------------------------------------------------------

router.get('/:companyId/slots', publicReadLimiter, async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    if (isNaN(companyId)) {
      return res.status(400).json({ error: 'companyId invalido' });
    }

    const { date, procedureId, professionalId } = req.query;

    if (!date || typeof date !== 'string') {
      return res.status(400).json({ error: 'Parametro date e obrigatorio (YYYY-MM-DD)' });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'date invalido. Use formato YYYY-MM-DD' });
    }

    // Resolve procedure duration
    let durationMinutes = 30;
    if (procedureId) {
      const pid = parseInt(procedureId as string, 10);
      if (!isNaN(pid)) {
        const [proc] = await db
          .select({ duration: procedures.duration })
          .from(procedures)
          .where(
            and(
              eq(procedures.id, pid),
              eq(procedures.companyId, companyId),
              eq(procedures.active, true),
            ),
          )
          .limit(1);
        if (proc) durationMinutes = proc.duration;
      }
    }

    const profId = professionalId ? parseInt(professionalId as string, 10) : undefined;
    const validProfId = profId && !isNaN(profId) ? profId : undefined;

    const slots = await getAvailableSlots(companyId, parsedDate, durationMinutes, validProfId);

    const slotDtos = slots.map((s) => ({
      startTime: s.startTime.toISOString(),
      endTime: s.endTime.toISOString(),
      professionalId: s.professionalId,
      professionalName: s.professionalName,
    }));

    return res.json({ slots: slotDtos });
  } catch (err) {
    log.error({ err }, 'Error fetching public booking slots');
    return res.status(500).json({ error: 'Erro interno ao buscar horarios disponíveis' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/public/booking/:companyId/book
// ---------------------------------------------------------------------------

router.post('/:companyId/book', publicSubmitLimiter, async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    if (isNaN(companyId)) {
      return res.status(400).json({ error: 'companyId invalido' });
    }

    // Validate body
    const parseResult = bookingBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(422).json({
        error: 'Dados invalidos',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const {
      patientName,
      patientPhone,
      patientCpf,
      patientEmail,
      procedureId,
      professionalId,
      startTime: startTimeRaw,
      endTime: endTimeRaw,
    } = parseResult.data;

    const startTime = new Date(startTimeRaw);
    const endTime = new Date(endTimeRaw);

    // Validate company exists
    const [company] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      return res.status(404).json({ error: 'Clinica nao encontrada' });
    }

    // Validate procedure belongs to this company
    const [procedure] = await db
      .select({ id: procedures.id, name: procedures.name, duration: procedures.duration })
      .from(procedures)
      .where(
        and(
          eq(procedures.id, procedureId),
          eq(procedures.companyId, companyId),
          eq(procedures.active, true),
        ),
      )
      .limit(1);

    if (!procedure) {
      return res.status(400).json({ error: 'Procedimento invalido ou inativo' });
    }

    // Validate professional belongs to this company
    const [professional] = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(
        and(
          eq(users.id, professionalId),
          eq(users.companyId, companyId),
          eq(users.active, true),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);

    if (!professional) {
      return res.status(400).json({ error: 'Profissional invalido ou inativo' });
    }

    // -----------------------------------------------------------------------
    // Step 1 — Find or create patient by phone (UPSERT)
    // -----------------------------------------------------------------------
    const normalisedPhone = normalisePhone(patientPhone);

    let patient: { id: number; fullName: string } | undefined;
    let isNewPatient = false;

    // Fetch all non-deleted patients for this company then match by normalised
    // phone to handle formatting variance (spaces, dashes, country codes, etc.)
    const phoneMatches = await db
      .select({
        id: patients.id,
        fullName: patients.fullName,
        phone: patients.phone,
        cellphone: patients.cellphone,
        whatsappPhone: patients.whatsappPhone,
      })
      .from(patients)
      .where(
        and(
          eq(patients.companyId, companyId),
          isNull(patients.deletedAt),
        ),
      );

    const foundPatient = phoneMatches.find((p: any) => {
      const phones = [p.phone, p.cellphone, p.whatsappPhone].filter(Boolean) as string[];
      return phones.some((ph) => normalisePhone(ph) === normalisedPhone);
    });

    if (foundPatient) {
      patient = { id: foundPatient.id, fullName: foundPatient.fullName };
    } else {
      // Create new patient
      isNewPatient = true;
      const [newPatient] = await db
        .insert(patients)
        .values({
          companyId,
          fullName: patientName,
          phone: normalisedPhone,
          cellphone: normalisedPhone,
          whatsappPhone: normalisedPhone,
          email: patientEmail || null,
          cpf: patientCpf || null,
          referralSource: 'agendamento_online',
          dataProcessingConsent: true,
          consentDate: new Date(),
          consentMethod: 'online',
          consentIpAddress: req.ip ?? null,
          active: true,
          status: 'active',
        })
        .returning({ id: patients.id, fullName: patients.fullName });

      patient = { id: newPatient.id, fullName: newPatient.fullName };
    }

    // -----------------------------------------------------------------------
    // Step 2 — Create appointment
    // -----------------------------------------------------------------------
    const appointmentTitle = `${procedure.name} — ${patientName}`;

    const [newAppointment] = await db
      .insert(appointments)
      .values({
        companyId,
        title: appointmentTitle,
        patientId: patient.id,
        professionalId,
        startTime,
        endTime,
        status: 'scheduled',
        type: 'appointment',
        automationEnabled: true,
      })
      .returning({ id: appointments.id });

    // -----------------------------------------------------------------------
    // Step 3 — Queue WhatsApp confirmation (best-effort, non-blocking)
    // -----------------------------------------------------------------------
    try {
      await addAppointmentConfirmationJob({
        type: 'appointment-confirmation',
        appointmentId: newAppointment.id,
        patientId: patient.id,
        companyId,
      });
    } catch (queueErr) {
      // Queue failures must not break the booking response
      log.warn({ queueErr, appointmentId: newAppointment.id }, 'Failed to enqueue confirmation job — booking still created');
    }

    log.info(
      {
        companyId,
        appointmentId: newAppointment.id,
        patientId: patient.id,
        isNewPatient,
        professionalId,
        procedureId,
        startTime: startTime.toISOString(),
      },
      'Public booking created',
    );

    return res.status(201).json({
      success: true,
      appointmentId: newAppointment.id,
      patientId: patient.id,
      isNewPatient,
      patientName: patient.fullName,
    });
  } catch (err) {
    log.error({ err }, 'Error creating public booking');
    return res.status(500).json({ error: 'Erro interno ao criar agendamento' });
  }
});

export default router;
