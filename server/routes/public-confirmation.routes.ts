/**
 * Rotas Públicas de Confirmação de Agendamento
 *
 * Permite que pacientes confirmem ou cancelem consultas
 * via link enviado pelo WhatsApp - sem necessidade de login.
 */

import { Router } from 'express';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import {
  appointmentConfirmationLinks,
  appointments,
  patients,
  companies,
  clinicSettings,
} from '@shared/schema';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/auth';

const router = Router();

// ==================== HELPER ====================

async function validateToken(token: string) {
  const [link] = await db
    .select()
    .from(appointmentConfirmationLinks)
    .where(
      and(
        eq(appointmentConfirmationLinks.token, token),
        eq(appointmentConfirmationLinks.isActive, true),
      ),
    )
    .limit(1);

  return link ?? null;
}

// ==================== ROTAS PÚBLICAS ====================

/**
 * GET /api/public/confirm/:token
 * Retorna os detalhes do agendamento para exibição na página pública.
 */
router.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const { token } = req.params;

    const link = await validateToken(token);

    if (!link) {
      return res.status(404).json({ error: 'Link inválido ou expirado' });
    }

    if (link.expiresAt < new Date()) {
      return res.status(410).json({ error: 'Link expirado' });
    }

    if (link.usedAt) {
      return res.status(410).json({ error: 'Link já utilizado' });
    }

    // Buscar agendamento
    const [appointment] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, link.appointmentId))
      .limit(1);

    if (!appointment) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    // Buscar paciente
    const patient = appointment.patientId
      ? (
          await db
            .select({ id: patients.id, fullName: patients.fullName })
            .from(patients)
            .where(eq(patients.id, appointment.patientId))
            .limit(1)
        )[0]
      : null;

    // Buscar nome da clínica
    const [settings] = await db
      .select({ clinicName: clinicSettings.name, clinicLogo: clinicSettings.logo })
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, link.companyId))
      .limit(1);

    const [company] = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, link.companyId))
      .limit(1);

    return res.json({
      appointment: {
        id: appointment.id,
        title: appointment.title,
        date: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
        notes: appointment.notes,
      },
      patient: patient ? { name: patient.fullName } : null,
      clinic: {
        name: settings?.clinicName ?? company?.name ?? 'Clínica',
        logo: settings?.clinicLogo ?? null,
      },
      link: {
        action: link.action,
        expiresAt: link.expiresAt,
      },
    });
  }),
);

/**
 * POST /api/public/confirm/:token/confirm
 * Confirma o agendamento e marca o link como utilizado.
 */
router.post(
  '/:token/confirm',
  asyncHandler(async (req, res) => {
    const { token } = req.params;

    const link = await validateToken(token);

    if (!link) {
      return res.status(404).json({ error: 'Link inválido ou expirado' });
    }

    if (link.expiresAt < new Date()) {
      return res.status(410).json({ error: 'Link expirado' });
    }

    if (link.usedAt) {
      return res.status(410).json({ error: 'Link já utilizado' });
    }

    // Atualizar status do agendamento para confirmado
    await db
      .update(appointments)
      .set({
        status: 'confirmed',
        confirmedByPatient: true,
        confirmationDate: new Date(),
        confirmationMethod: 'whatsapp',
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, link.appointmentId));

    // Marcar link como utilizado
    await db
      .update(appointmentConfirmationLinks)
      .set({ usedAt: new Date(), isActive: false })
      .where(eq(appointmentConfirmationLinks.id, link.id));

    return res.json({
      success: true,
      message: 'Consulta confirmada com sucesso! Até breve.',
      action: 'confirmed',
    });
  }),
);

/**
 * POST /api/public/confirm/:token/cancel
 * Cancela o agendamento e marca o link como utilizado.
 */
router.post(
  '/:token/cancel',
  asyncHandler(async (req, res) => {
    const { token } = req.params;

    const link = await validateToken(token);

    if (!link) {
      return res.status(404).json({ error: 'Link inválido ou expirado' });
    }

    if (link.expiresAt < new Date()) {
      return res.status(410).json({ error: 'Link expirado' });
    }

    if (link.usedAt) {
      return res.status(410).json({ error: 'Link já utilizado' });
    }

    // Atualizar status do agendamento para cancelado
    await db
      .update(appointments)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, link.appointmentId));

    // Marcar link como utilizado
    await db
      .update(appointmentConfirmationLinks)
      .set({ usedAt: new Date(), isActive: false })
      .where(eq(appointmentConfirmationLinks.id, link.id));

    return res.json({
      success: true,
      message: 'Consulta cancelada. Para reagendar, entre em contato conosco.',
      action: 'cancelled',
    });
  }),
);

// ==================== ROTAS AUTENTICADAS ====================

/**
 * POST /api/public/confirm/generate
 * Gera um link de confirmação para um agendamento (requer autenticação).
 *
 * Body: { appointmentId, expiresInHours? }
 * Returns: { confirmUrl, cancelUrl, token, expiresAt }
 */
router.post(
  '/generate',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = (req as any).user?.companyId as number;
    const { appointmentId, expiresInHours = 48 } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId é obrigatório' });
    }

    // Verificar que o agendamento pertence à empresa
    const [appointment] = await db
      .select({ id: appointments.id, companyId: appointments.companyId })
      .from(appointments)
      .where(
        and(
          eq(appointments.id, Number(appointmentId)),
          eq(appointments.companyId, companyId),
        ),
      )
      .limit(1);

    if (!appointment) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    // Desativar links anteriores para o mesmo agendamento
    await db
      .update(appointmentConfirmationLinks)
      .set({ isActive: false })
      .where(
        and(
          eq(appointmentConfirmationLinks.appointmentId, appointment.id),
          eq(appointmentConfirmationLinks.isActive, true),
        ),
      );

    // Gerar token único
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const [link] = await db
      .insert(appointmentConfirmationLinks)
      .values({
        companyId,
        appointmentId: appointment.id,
        token,
        action: 'confirm',
        expiresAt,
        isActive: true,
      })
      .returning();

    const baseUrl = process.env.APP_URL ?? `${req.protocol}://${req.get('host')}`;
    const confirmUrl = `${baseUrl}/confirmar/${token}`;

    return res.json({
      success: true,
      token,
      confirmUrl,
      expiresAt: link.expiresAt,
    });
  }),
);

export default router;
