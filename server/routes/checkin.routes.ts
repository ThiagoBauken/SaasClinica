/**
 * QR Code Check-in Routes
 * Paciente escaneia QR na recepcao e confirma chegada
 */

import { Router } from 'express';
import { z } from 'zod';
import { authCheck, asyncHandler } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import QRCode from 'qrcode';
import { notifyPatientArrived } from '../websocket';
import { publicSubmitLimiter } from '../middleware/public-rate-limit';

const router = Router();

/**
 * GET /api/v1/checkin/qrcode/:roomId
 * Gera QR code para check-in em uma sala/consultorio
 */
router.get('/qrcode/:roomId', authCheck, asyncHandler(async (req, res) => {
  const user = req.user!;
  const companyId = user.companyId;
  const roomId = req.params.roomId;
  const baseUrl = process.env.BASE_URL || 'https://app.example.com';
  const checkinUrl = `${baseUrl}/api/public/checkin/${companyId}/${roomId}`;

  const qrDataUrl = await QRCode.toDataURL(checkinUrl, { width: 300, margin: 2 });

  res.json({
    qrCode: qrDataUrl,
    url: checkinUrl,
    roomId,
  });
}));

/**
 * POST /api/public/checkin/:companyId/:roomId (PUBLICO - sem auth)
 * Paciente confirma chegada
 */
router.post('/public/:companyId/:roomId', publicSubmitLimiter, asyncHandler(async (req, res) => {
  const companyId = parseInt(req.params.companyId);
  const roomId = parseInt(req.params.roomId);
  const { patientName, phone } = req.body;
  const today = new Date().toISOString().split('T')[0];

  // Tentar encontrar agendamento do dia para este paciente/sala
  let appointmentQuery;
  if (phone) {
    appointmentQuery = await db.execute(sql`
      SELECT a.id, a.patient_id, a.start_time, pt.full_name
      FROM appointments a
      JOIN patients pt ON a.patient_id = pt.id
      WHERE a.company_id = ${companyId}
        AND (a.room_id = ${roomId} OR a.room_id IS NULL)
        AND a.start_time::date = ${today}::date
        AND a.status IN ('scheduled', 'confirmed')
        AND (pt.cellphone LIKE ${'%' + phone.replace(/\D/g, '').slice(-8)} OR pt.phone LIKE ${'%' + phone.replace(/\D/g, '').slice(-8)})
      ORDER BY a.start_time LIMIT 1
    `);
  } else if (patientName) {
    appointmentQuery = await db.execute(sql`
      SELECT a.id, a.patient_id, a.start_time, pt.full_name
      FROM appointments a
      JOIN patients pt ON a.patient_id = pt.id
      WHERE a.company_id = ${companyId}
        AND a.start_time::date = ${today}::date
        AND a.status IN ('scheduled', 'confirmed')
        AND LOWER(pt.full_name) LIKE ${`%${(patientName as string).toLowerCase()}%`}
      ORDER BY a.start_time LIMIT 1
    `);
  }

  if (appointmentQuery && appointmentQuery.rows.length > 0) {
    const appt = appointmentQuery.rows[0] as any;
    // Marcar como confirmado/chegou
    await db.execute(sql`
      UPDATE appointments SET status = 'arrived', confirmed_by_patient = true, confirmation_date = NOW(), confirmation_method = 'qr_checkin'
      WHERE id = ${appt.id}
    `);

    // Notificar via WebSocket que paciente chegou
    notifyPatientArrived(companyId, {
      id: appt.id,
      patientName: appt.full_name,
      professionalId: appt.professional_id ?? null,
      startTime: appt.start_time,
    });

    res.json({
      success: true,
      message: `Check-in confirmado para ${appt.full_name}`,
      appointment: { id: appt.id, time: appt.start_time, patientName: appt.full_name },
    });
  } else {
    // Check-in generico (sem agendamento encontrado)
    res.json({
      success: true,
      message: 'Check-in registrado. A recepcao sera notificada.',
      appointment: null,
    });
  }
}));

/**
 * GET /api/v1/checkin/today
 * Lista check-ins do dia (para dashboard da recepcao)
 */
router.get('/today', authCheck, asyncHandler(async (req, res) => {
  const user = req.user!;
  const companyId = user.companyId;
  const today = new Date().toISOString().split('T')[0];

  const result = await db.execute(sql`
    SELECT a.id, a.start_time, a.status, a.confirmation_method,
           pt.full_name as patient_name, pt.cellphone,
           r.name as room_name, u.full_name as professional_name
    FROM appointments a
    JOIN patients pt ON a.patient_id = pt.id
    LEFT JOIN rooms r ON a.room_id = r.id
    LEFT JOIN users u ON a.professional_id = u.id
    WHERE a.company_id = ${companyId}
      AND a.start_time::date = ${today}::date
      AND a.status NOT IN ('cancelled')
    ORDER BY a.start_time
  `);

  res.json({ data: result.rows });
}));

/**
 * POST /api/v1/checkin/quick
 * Check-in rapido pela recepcao (1 clique na agenda)
 */
router.post('/quick', authCheck, asyncHandler(async (req, res) => {
  const user = req.user!;
  const companyId = user.companyId;
  const { appointmentId } = req.body;

  if (!appointmentId) {
    return res.status(400).json({ error: 'appointmentId is required' });
  }

  // Atualizar status para 'arrived'
  const result = await db.execute(sql`
    UPDATE appointments
    SET status = 'arrived',
        confirmed_by_patient = true,
        confirmation_date = NOW(),
        confirmation_method = 'manual_checkin'
    WHERE id = ${appointmentId}
      AND company_id = ${companyId}
      AND status IN ('scheduled', 'confirmed')
    RETURNING id, patient_id, professional_id, start_time
  `);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Agendamento nao encontrado ou status invalido para check-in' });
  }

  const appt = result.rows[0] as any;

  // Verificar se paciente tem anamnese preenchida
  const anamnesisCheck = await db.execute(sql`
    SELECT id FROM anamnesis
    WHERE patient_id = ${appt.patient_id}
      AND company_id = ${companyId}
      AND deleted_at IS NULL
    LIMIT 1
  `);

  // Buscar nome do paciente para notificacao
  const patientResult = await db.execute(sql`
    SELECT full_name FROM patients WHERE id = ${appt.patient_id} LIMIT 1
  `);
  const patientName = (patientResult.rows[0] as any)?.full_name || 'Paciente';

  // Notificar via WebSocket
  notifyPatientArrived(companyId, {
    id: appt.id,
    patientName,
    professionalId: appt.professional_id,
    startTime: appt.start_time,
  });

  res.json({
    success: true,
    appointment: {
      id: appt.id,
      status: 'arrived',
      patientName,
    },
    hasAnamnesis: anamnesisCheck.rows.length > 0,
  });
}));

export default router;
