/**
 * Automation API Routes
 * Substitui N8N com endpoints nativos
 * Inclui notificações em tempo real via WebSocket
 */

import { Router } from 'express';
import { db } from '../db';
import { eq, and, sql } from 'drizzle-orm';
import { appointments, companies, clinicSettings, users } from '@shared/schema';
import { asyncHandler, requireAuth, getCompanyId } from '../middleware/auth';
import {
  createAutomationEngine,
  startScheduledJobs,
  stopScheduledJobs,
  startAllScheduledJobs,
} from '../services/automation-engine';
import { getWebSocketServer } from '../websocket';

const router = Router();

// ==================== TRIGGERS DE EVENTOS ====================

/**
 * POST /api/v1/automation/appointment/created
 * Trigger quando um agendamento é criado
 * Chamado automaticamente pelo sistema ou manualmente
 */
router.post(
  '/appointment/created',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const { appointmentId } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId é obrigatório' });
    }

    const engine = createAutomationEngine(companyId);
    const result = await engine.onAppointmentCreated(appointmentId);

    // Notificar via WebSocket
    const wss = getWebSocketServer();
    if (wss) {
      wss.notifyCompany(companyId, {
        type: 'APPOINTMENT_CREATED',
        data: {
          appointmentId,
          ...result.metadata,
        },
      });
    }

    res.json({
      success: result.success,
      data: result,
    });
  })
);

/**
 * POST /api/v1/automation/appointment/cancelled
 * Trigger quando um agendamento é cancelado
 */
router.post(
  '/appointment/cancelled',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const { appointmentId, reason } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId é obrigatório' });
    }

    const engine = createAutomationEngine(companyId);
    const result = await engine.onAppointmentCancelled(appointmentId, reason);

    // Buscar dados do appointment para notificação
    const [appointment] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);

    // Notificar via WebSocket (secretária e dentista veem em tempo real)
    const wss = getWebSocketServer();
    if (wss) {
      wss.notifyCompany(companyId, {
        type: 'APPOINTMENT_CANCELLED',
        data: {
          appointmentId,
          reason,
          startTime: appointment?.startTime,
          professionalId: appointment?.professionalId,
        },
      });

      // Notificar especificamente o profissional
      if (appointment?.professionalId) {
        wss.notifyUser(appointment.professionalId, {
          type: 'APPOINTMENT_CANCELLED',
          data: {
            appointmentId,
            reason,
            startTime: appointment.startTime,
            message: '❌ Um paciente cancelou a consulta',
          },
        });
      }
    }

    res.json({
      success: result.success,
      data: result,
    });
  })
);

/**
 * POST /api/v1/automation/appointment/rescheduled
 * Trigger quando um agendamento é reagendado
 */
router.post(
  '/appointment/rescheduled',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const { appointmentId, oldStartTime, newStartTime } = req.body;

    if (!appointmentId || !oldStartTime || !newStartTime) {
      return res.status(400).json({
        error: 'appointmentId, oldStartTime e newStartTime são obrigatórios',
      });
    }

    const engine = createAutomationEngine(companyId);
    const result = await engine.onAppointmentRescheduled(
      appointmentId,
      new Date(oldStartTime),
      new Date(newStartTime)
    );

    // Buscar dados do appointment para notificação
    const [appointment] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);

    // Notificar via WebSocket
    const wss = getWebSocketServer();
    if (wss) {
      wss.notifyCompany(companyId, {
        type: 'APPOINTMENT_RESCHEDULED',
        data: {
          appointmentId,
          oldStartTime,
          newStartTime,
          professionalId: appointment?.professionalId,
        },
      });

      // Notificar especificamente o profissional
      if (appointment?.professionalId) {
        wss.notifyUser(appointment.professionalId, {
          type: 'APPOINTMENT_RESCHEDULED',
          data: {
            appointmentId,
            oldStartTime,
            newStartTime,
            message: '🔄 Consulta reagendada',
          },
        });
      }
    }

    res.json({
      success: result.success,
      data: result,
    });
  })
);

/**
 * POST /api/v1/automation/appointment/confirmed
 * Quando paciente confirma via WhatsApp
 */
router.post(
  '/appointment/confirmed',
  asyncHandler(async (req, res) => {
    const { appointmentId, companyId, confirmed, patientResponse } = req.body;

    if (!appointmentId || companyId === undefined) {
      return res.status(400).json({ error: 'appointmentId e companyId são obrigatórios' });
    }

    // Atualizar appointment
    await db
      .update(appointments)
      .set({
        confirmedByPatient: confirmed,
        patientResponse,
        confirmationDate: new Date(),
        confirmationMethod: 'whatsapp',
        status: confirmed ? 'confirmed' : 'scheduled',
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, appointmentId));

    // Buscar dados para notificação
    const [appointment] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);

    // Notificar via WebSocket
    const wss = getWebSocketServer();
    if (wss) {
      wss.notifyCompany(companyId, {
        type: 'APPOINTMENT_CONFIRMATION',
        data: {
          appointmentId,
          confirmed,
          patientResponse,
          professionalId: appointment?.professionalId,
        },
      });
    }

    res.json({
      success: true,
      confirmed,
    });
  })
);

// ==================== JOBS MANUAIS ====================

/**
 * POST /api/v1/automation/jobs/daily-confirmations
 * Executa job de confirmações manualmente
 */
router.post(
  '/jobs/daily-confirmations',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);

    const engine = createAutomationEngine(companyId);
    const result = await engine.sendDailyConfirmations();

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/v1/automation/jobs/daily-summary
 * Executa resumo diário manualmente
 */
router.post(
  '/jobs/daily-summary',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);

    const engine = createAutomationEngine(companyId);
    const result = await engine.sendDailySummary();

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/v1/automation/jobs/finalize-appointments
 * Finaliza atendimentos passados
 */
router.post(
  '/jobs/finalize-appointments',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);

    const engine = createAutomationEngine(companyId);
    const result = await engine.finalizeCompletedAppointments();

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/v1/automation/jobs/birthday-messages
 * Envia mensagens de aniversário
 */
router.post(
  '/jobs/birthday-messages',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);

    const engine = createAutomationEngine(companyId);
    const result = await engine.sendBirthdayMessages();

    res.json({
      success: true,
      data: result,
    });
  })
);

// ==================== RELATÓRIO DO DENTISTA ====================

/**
 * POST /api/v1/automation/report/professional-daily
 * Envia relatório diário para um profissional específico
 */
router.post(
  '/report/professional-daily',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const { professionalId } = req.body;

    if (!professionalId) {
      return res.status(400).json({ error: 'professionalId é obrigatório' });
    }

    // Buscar profissional
    const [professional] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, professionalId),
          eq(users.companyId, companyId)
        )
      )
      .limit(1);

    if (!professional) {
      return res.status(404).json({ error: 'Profissional não encontrado' });
    }

    // Buscar agendamentos do dia para este profissional
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAppointments = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.companyId, companyId),
          eq(appointments.professionalId, professionalId),
          sql`${appointments.startTime} >= ${today}`,
          sql`${appointments.startTime} < ${tomorrow}`
        )
      )
      .orderBy(appointments.startTime);

    // Formatar relatório
    const engine = createAutomationEngine(companyId);
    await engine.initialize();

    let appointmentsList = '';
    for (let i = 0; i < todayAppointments.length; i++) {
      const apt = todayAppointments[i];
      const status = apt.status === 'confirmed' ? '✅' : apt.status === 'cancelled' ? '❌' : '⏳';
      const time = new Date(apt.startTime!).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      appointmentsList += `${i + 1}. ${time} - ${apt.procedure || 'Consulta'} ${status}\n`;
    }

    const message = `📊 *Seu Dia - ${professional.fullName}*

📅 ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}

📋 *Pacientes agendados:* ${todayAppointments.length}

${appointmentsList || 'Nenhum agendamento hoje'}

💙 Bom trabalho!`;

    // Enviar WhatsApp se o profissional tiver telefone
    const phone = (professional as any).whatsappPhone || (professional as any).phone;
    let whatsappResult: { success: boolean; messageId?: string; error?: string } = { success: false };

    if (phone) {
      whatsappResult = await engine.sendWhatsApp({ phone, message });
    }

    res.json({
      success: true,
      data: {
        professionalId,
        totalAppointments: todayAppointments.length,
        whatsappSent: whatsappResult.success,
      },
    });
  })
);

/**
 * POST /api/v1/automation/report/all-professionals
 * Envia relatório para todos os profissionais da empresa
 */
router.post(
  '/report/all-professionals',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);

    // Buscar todos os profissionais ativos
    const professionals = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.companyId, companyId),
          eq(users.active, true),
          sql`${users.role} IN ('dentist', 'professional', 'doctor')`
        )
      );

    let sent = 0;
    let failed = 0;

    for (const professional of professionals) {
      try {
        // Simular chamada ao endpoint individual
        // Na prática, reutilizamos a lógica
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayAppointments = await db
          .select()
          .from(appointments)
          .where(
            and(
              eq(appointments.companyId, companyId),
              eq(appointments.professionalId, professional.id),
              sql`${appointments.startTime} >= ${today}`,
              sql`${appointments.startTime} < ${tomorrow}`
            )
          )
          .orderBy(appointments.startTime);

        if (todayAppointments.length === 0) continue;

        const engine = createAutomationEngine(companyId);
        await engine.initialize();

        let appointmentsList = '';
        for (let i = 0; i < todayAppointments.length; i++) {
          const apt = todayAppointments[i];
          const status = apt.status === 'confirmed' ? '✅' : apt.status === 'cancelled' ? '❌' : '⏳';
          const time = new Date(apt.startTime!).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          });
          appointmentsList += `${i + 1}. ${time} - ${apt.procedure || 'Consulta'} ${status}\n`;
        }

        const message = `📊 *Seu Dia - ${professional.fullName}*\n\n📅 ${new Date().toLocaleDateString('pt-BR')}\n\n📋 *Pacientes:* ${todayAppointments.length}\n\n${appointmentsList}\n\n💙 Bom trabalho!`;

        const phone = (professional as any).whatsappPhone || (professional as any).phone;
        if (phone) {
          const result = await engine.sendWhatsApp({ phone, message });
          if (result.success) sent++;
          else failed++;
        }
      } catch (error) {
        failed++;
      }
    }

    res.json({
      success: true,
      data: {
        totalProfessionals: professionals.length,
        sent,
        failed,
      },
    });
  })
);

// ==================== GERENCIAMENTO DE JOBS ====================

/**
 * POST /api/v1/automation/scheduler/start
 * Inicia os jobs agendados para a empresa
 */
router.post(
  '/scheduler/start',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);

    await startScheduledJobs(companyId);

    res.json({
      success: true,
      message: 'Jobs agendados iniciados',
    });
  })
);

/**
 * POST /api/v1/automation/scheduler/stop
 * Para os jobs agendados
 */
router.post(
  '/scheduler/stop',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);

    stopScheduledJobs(companyId);

    res.json({
      success: true,
      message: 'Jobs agendados parados',
    });
  })
);

/**
 * GET /api/v1/automation/status
 * Status das automações
 */
router.get(
  '/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);

    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    res.json({
      success: true,
      data: {
        wuzapiConfigured: !!(settings?.wuzapiApiKey && settings?.wuzapiInstanceId),
        googleCalendarConfigured: !!settings?.defaultGoogleCalendarId,
        automationsEnabled: true,
        scheduledJobs: {
          confirmations: '18:00',
          dailySummary: '07:30',
          finalize: '23:00',
          birthdays: '09:00',
        },
      },
    });
  })
);

export default router;
