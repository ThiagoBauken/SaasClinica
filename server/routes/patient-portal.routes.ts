/**
 * Patient Self-Service Portal Routes
 *
 * Authenticated endpoint: POST /api/v1/patient-portal/generate-link
 *   Staff generates a tokenized portal link for a patient.
 *
 * Public endpoint: GET /api/public/portal/:token
 *   Token-based (no session auth). Returns patient's appointments,
 *   prescriptions, payments, and treatment plans.
 *
 * Token strategy: stored in patient_records with recordType = 'portal_token'.
 * Valid for 30 days.
 */

import { Router } from 'express';
import { randomBytes } from 'crypto';
import { db } from '../db';
import {
  patients,
  patientRecords,
  appointments,
  prescriptions,
  financialTransactions,
  treatmentPlans,
  users,
  clinicSettings,
  companies,
} from '@shared/schema';
import { eq, and, gte, lte, isNull, desc } from 'drizzle-orm';
import { requireAuth, asyncHandler } from '../middleware/auth';
import { publicTokenLimiter } from '../middleware/public-rate-limit';
import { logger } from '../logger';

const router = Router();

const TOKEN_TTL_DAYS = 30;

// ─── helpers ────────────────────────────────────────────────────────────────

function formatCents(cents: number | null | undefined): number {
  return Math.round(cents ?? 0);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ─── POST /api/v1/patient-portal/generate-link ──────────────────────────────

/**
 * Authenticated — staff generates a 30-day portal link for a patient.
 * Stores the token as a patient_record (recordType = 'portal_token').
 * Existing unexpired tokens are replaced.
 */
router.post(
  '/generate-link',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const userId = req.user!.id;
    const { patientId } = req.body as { patientId?: number };

    if (!patientId || typeof patientId !== 'number') {
      return res.status(400).json({ error: 'patientId e obrigatorio e deve ser um numero inteiro.' });
    }

    // Confirm patient belongs to this company
    const [patient] = await db
      .select({ id: patients.id, fullName: patients.fullName })
      .from(patients)
      .where(
        and(
          eq(patients.id, patientId),
          eq(patients.companyId, companyId),
          isNull(patients.deletedAt),
        ),
      )
      .limit(1);

    if (!patient) {
      return res.status(404).json({ error: 'Paciente nao encontrado.' });
    }

    // Soft-delete any existing portal token records for this patient
    await db
      .update(patientRecords)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(patientRecords.patientId, patientId),
          eq(patientRecords.companyId, companyId),
          eq(patientRecords.recordType, 'portal_token'),
          isNull(patientRecords.deletedAt),
        ),
      );

    const token = randomBytes(32).toString('hex');
    const expiresAt = addDays(new Date(), TOKEN_TTL_DAYS);

    await db.insert(patientRecords).values({
      companyId,
      patientId,
      recordType: 'portal_token',
      content: { token, expiresAt: expiresAt.toISOString() },
      createdBy: userId,
    });

    const baseUrl = process.env.PUBLIC_URL || process.env.VITE_API_URL || 'http://localhost:5000';
    const url = `${baseUrl}/portal/${token}`;

    logger.info({ companyId, patientId, expiresAt }, 'Portal link generated');

    return res.status(201).json({ url, expiresAt });
  }),
);

// ─── GET /api/public/portal/:token ──────────────────────────────────────────

/**
 * Public — no session auth. Rate-limited by IP.
 * Validates token, then aggregates and returns patient portal data.
 */
router.get(
  '/:token',
  publicTokenLimiter,
  asyncHandler(async (req, res) => {
    const { token } = req.params;

    // We need to match the token value inside the JSONB content.
    // Drizzle doesn't support jsonb field equality directly in where(), so
    // we scan a bounded batch of recent portal_token records and filter in JS.
    // Tokens are 64-char hex strings; the active set is small in practice.
    const allRecent = await db
      .select()
      .from(patientRecords)
      .where(
        and(
          eq(patientRecords.recordType, 'portal_token'),
          isNull(patientRecords.deletedAt),
        ),
      )
      .orderBy(desc(patientRecords.createdAt))
      .limit(500);

    const tokenRecord = allRecent.find((r: any) => {
      const c = r.content as { token?: string; expiresAt?: string };
      return c?.token === token;
    });

    if (!tokenRecord) {
      return res.status(404).json({ error: 'Link invalido ou expirado.' });
    }

    const tokenContent = tokenRecord.content as { token: string; expiresAt: string };
    if (new Date(tokenContent.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'Este link expirou. Solicite um novo link a clinica.' });
    }

    const { patientId, companyId } = tokenRecord;

    // ── Patient basic info ──────────────────────────────────────────────────
    const [patientRow] = await db
      .select({
        fullName: patients.fullName,
        email: patients.email,
        phone: patients.phone,
        cellphone: patients.cellphone,
      })
      .from(patients)
      .where(and(eq(patients.id, patientId), eq(patients.companyId, companyId)))
      .limit(1);

    if (!patientRow) {
      return res.status(404).json({ error: 'Dados do paciente nao encontrados.' });
    }

    // ── Clinic info (name + logo) ───────────────────────────────────────────
    const [settings] = await db
      .select({ name: clinicSettings.name, logo: clinicSettings.logo })
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    const [company] = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    const clinicName = settings?.name || company?.name || 'Clinica';
    const clinicLogo = settings?.logo ?? null;

    // ── Upcoming appointments (next 30 days) ───────────────────────────────
    const now = new Date();
    const in30Days = addDays(now, 30);

    const apptRows = await db
      .select({
        id: appointments.id,
        title: appointments.title,
        startTime: appointments.startTime,
        endTime: appointments.endTime,
        status: appointments.status,
        professionalName: users.fullName,
        professionalSpeciality: users.speciality,
      })
      .from(appointments)
      .leftJoin(users, eq(appointments.professionalId, users.id))
      .where(
        and(
          eq(appointments.patientId, patientId),
          eq(appointments.companyId, companyId),
          gte(appointments.startTime, now),
          lte(appointments.startTime, in30Days),
          isNull(appointments.deletedAt),
        ),
      )
      .orderBy(appointments.startTime)
      .limit(20);

    const upcomingAppointments = apptRows.map((a: any) => ({
      id: a.id,
      date: a.startTime,
      time: a.startTime
        ? new Date(a.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : null,
      professional: a.professionalName ?? null,
      speciality: a.professionalSpeciality ?? null,
      procedure: a.title,
      status: a.status,
    }));

    // ── Prescriptions (all, most recent first) ──────────────────────────────
    const prescriptionRows = await db
      .select({
        id: prescriptions.id,
        type: prescriptions.type,
        title: prescriptions.title,
        issuedAt: prescriptions.issuedAt,
        signedPdfUrl: prescriptions.signedPdfUrl,
        digitallySigned: prescriptions.digitallySigned,
        medications: prescriptions.medications,
        instructions: prescriptions.instructions,
        validUntil: prescriptions.validUntil,
      })
      .from(prescriptions)
      .where(
        and(
          eq(prescriptions.patientId, patientId),
          eq(prescriptions.companyId, companyId),
          isNull(prescriptions.deletedAt),
        ),
      )
      .orderBy(desc(prescriptions.createdAt))
      .limit(30);

    // ── Recent payments (last 6 months) ────────────────────────────────────
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const paymentRows = await db
      .select({
        id: financialTransactions.id,
        date: financialTransactions.date,
        description: financialTransactions.description,
        amount: financialTransactions.amount,
        paymentMethod: financialTransactions.paymentMethod,
        status: financialTransactions.status,
      })
      .from(financialTransactions)
      .where(
        and(
          eq(financialTransactions.patientId, patientId),
          eq(financialTransactions.companyId, companyId),
          eq(financialTransactions.type, 'income'),
          gte(financialTransactions.date, sixMonthsAgo),
          isNull(financialTransactions.deletedAt),
        ),
      )
      .orderBy(desc(financialTransactions.date))
      .limit(10);

    const recentPayments = paymentRows.map((p: any) => ({
      id: p.id,
      date: p.date,
      description: p.description,
      amount: formatCents(p.amount),
      paymentMethod: p.paymentMethod,
      status: p.status,
    }));

    // ── Treatment plans ─────────────────────────────────────────────────────
    const planRows = await db
      .select({
        id: treatmentPlans.id,
        name: treatmentPlans.name,
        status: treatmentPlans.status,
        totalAmount: treatmentPlans.totalAmount,
        paidAmount: treatmentPlans.paidAmount,
        discountAmount: treatmentPlans.discountAmount,
        startDate: treatmentPlans.startDate,
        completedDate: treatmentPlans.completedDate,
      })
      .from(treatmentPlans)
      .where(
        and(
          eq(treatmentPlans.patientId, patientId),
          eq(treatmentPlans.companyId, companyId),
          isNull(treatmentPlans.deletedAt),
        ),
      )
      .orderBy(desc(treatmentPlans.createdAt))
      .limit(20);

    const treatmentPlansData = planRows.map((p: any) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      totalAmount: formatCents(p.totalAmount),
      paidAmount: formatCents(p.paidAmount ?? 0),
      discountAmount: formatCents(p.discountAmount ?? 0),
      remainingAmount: Math.max(0, formatCents(p.totalAmount) - formatCents(p.paidAmount ?? 0)),
      startDate: p.startDate,
      completedDate: p.completedDate,
    }));

    return res.json({
      clinic: { name: clinicName, logo: clinicLogo },
      patient: {
        fullName: patientRow.fullName,
        email: patientRow.email,
        phone: patientRow.cellphone || patientRow.phone,
      },
      upcomingAppointments,
      prescriptions: prescriptionRows,
      recentPayments,
      treatmentPlans: treatmentPlansData,
    });
  }),
);

export default router;
