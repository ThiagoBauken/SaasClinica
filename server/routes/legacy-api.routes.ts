/**
 * Legacy API Routes — /api/* (non-v1 paths)
 *
 * This file consolidates all remaining legacy handlers that cannot yet be
 * removed because the frontend references `/api/...` (not `/api/v1/...`).
 * Over time these should be migrated client-side to the v1 paths, after
 * which this file can be removed.
 *
 * Covered groups:
 *  - Dashboard stats/charts
 *  - Patients CRUD (legacy /api/patients)
 *  - Patient sub-resources (anamnesis, exams, treatment-plans, evolution, prescriptions)
 *  - Appointments CRUD (legacy /api/appointments)
 *  - Professionals list (legacy /api/professionals)
 *  - Rooms list (legacy /api/rooms)
 *  - Procedures list (legacy /api/procedures)
 *  - Automations CRUD (legacy /api/automations)
 *  - Billing plans/subscription/invoices/usage
 *  - Queue health/stats monitoring
 *  - Payments (MercadoPago)
 *  - Website builder
 *  - Backup
 *  - Profile avatar upload
 *  - Prosthesis CRUD (legacy /api/prosthesis)
 *  - Reports (legacy /api/reports/*)
 *  - Auth: auto-login, /api/user/me (also covered in user-modules)
 *  - Recent activities
 *  - Appointment complete trigger
 */
import { Router } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { parse, formatISO, addDays } from 'date-fns';
import { cacheMiddleware } from '../simpleCache';
import { invalidateClusterCache } from '../clusterCache';
import { authCheck, asyncHandler, tenantAwareAuth } from '../middleware/auth';
import { tenantIsolationMiddleware } from '../tenantMiddleware';
import { billingApi, checkPatientsLimit, checkAppointmentsLimit, registerStripeRoutes } from '../billing';
import { queueApi } from '../queue';
import * as paymentHandlers from '../payments';
import * as clinicHandlers from '../clinic-apis';
import * as backupHandlers from '../backup';
import * as websiteHandlers from '../website-apis';
import * as dashboardHandlers from '../dashboard-apis';
import * as financialHandlers from '../financial-apis';
import * as patientRecordsHandlers from '../patient-records-apis';
import * as odontogramHandlers from '../odontogram-apis';
import * as calendarHandlers from '../calendar-apis';
import multer from 'multer';
import { logger } from '../logger';

const router = Router();

// =====================================================
// DASHBOARD
// =====================================================

router.get('/dashboard/stats', tenantAwareAuth, asyncHandler(dashboardHandlers.getDashboardStats));
router.get('/dashboard/appointments-week', tenantAwareAuth, asyncHandler(dashboardHandlers.getWeeklyAppointments));
router.get('/dashboard/revenue-monthly', tenantAwareAuth, asyncHandler(dashboardHandlers.getMonthlyRevenue));
router.get('/dashboard/procedures-distribution', tenantAwareAuth, asyncHandler(dashboardHandlers.getProceduresDistribution));

/**
 * GET /api/recent-activities
 * Returns recent appointment and patient activity for the dashboard.
 */
router.get(
  '/recent-activities',
  tenantAwareAuth,
  asyncHandler(dashboardHandlers.getRecentActivities)
);

// =====================================================
// FINANCIAL (legacy handlers — revenue charts)
// =====================================================

router.get('/transactions', tenantAwareAuth, asyncHandler(financialHandlers.getTransactions));
router.post('/transactions', tenantAwareAuth, asyncHandler(financialHandlers.createTransaction));
router.patch('/transactions/:id', tenantAwareAuth, asyncHandler(financialHandlers.updateTransaction));
router.get('/financial/revenue-by-month', tenantAwareAuth, asyncHandler(financialHandlers.getRevenueByMonth));
router.get('/financial/revenue-by-type', tenantAwareAuth, asyncHandler(financialHandlers.getRevenueByType));

// =====================================================
// PATIENT RECORDS (legacy /api/patients/:patientId/records)
// =====================================================

router.get('/patients/:patientId/records', tenantAwareAuth, asyncHandler(patientRecordsHandlers.getPatientRecords));
router.post('/patients/:patientId/records', tenantAwareAuth, asyncHandler(patientRecordsHandlers.createPatientRecord));
router.put('/patients/:patientId/records/:recordId', tenantAwareAuth, asyncHandler(patientRecordsHandlers.updatePatientRecord));
router.delete('/patients/:patientId/records/:recordId', tenantAwareAuth, asyncHandler(patientRecordsHandlers.deletePatientRecord));

// =====================================================
// ODONTOGRAM (legacy /api/patients/:patientId/odontogram)
// =====================================================

router.get('/patients/:patientId/odontogram', tenantAwareAuth, asyncHandler(odontogramHandlers.getPatientOdontogram));
router.post('/patients/:patientId/odontogram', tenantAwareAuth, asyncHandler(odontogramHandlers.saveToothStatus));
router.get('/patients/:patientId/odontogram/tooth/:toothId/history', tenantAwareAuth, asyncHandler(odontogramHandlers.getToothHistory));
router.delete('/patients/:patientId/odontogram/:entryId', tenantAwareAuth, asyncHandler(odontogramHandlers.deleteToothStatus));

// =====================================================
// CALENDAR
// =====================================================

router.get('/calendar/occupation-status', tenantAwareAuth, asyncHandler(calendarHandlers.getOccupationStatus));
router.get('/appointments/stats/procedures', tenantAwareAuth, asyncHandler(calendarHandlers.getProcedureStats));

// =====================================================
// PATIENTS (legacy /api/patients — used by older frontend pages)
// =====================================================

router.get(
  '/patients',
  tenantAwareAuth,
  cacheMiddleware(300),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;
    if (!companyId) return res.status(403).json({ error: 'User not associated with any company' });

    try {
      const patients = await storage.getPatients(companyId);
      res.json(patients);
    } catch (error: any) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return res.json([]);
      }
      throw error;
    }
  })
);

router.get(
  '/patients/:id',
  authCheck,
  cacheMiddleware(300),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;
    if (!companyId) return res.status(403).json({ error: 'User not associated with any company' });

    const patient = await storage.getPatient(parseInt(req.params.id), companyId);
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    res.json(patient);
  })
);

router.post(
  '/patients',
  authCheck,
  checkPatientsLimit,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;
    if (!companyId) return res.status(403).json({ error: 'User not associated with any company' });

    const patient = await storage.createPatient(req.body, companyId);
    invalidateClusterCache('api:/api/patients');
    res.status(201).json(patient);
  })
);

router.patch(
  '/patients/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;
    if (!companyId) return res.status(403).json({ error: 'User not associated with any company' });

    const updatedPatient = await storage.updatePatient(parseInt(req.params.id), req.body, companyId);
    invalidateClusterCache(`api:/api/patients/${req.params.id}`);
    invalidateClusterCache('api:/api/patients');
    res.json(updatedPatient);
  })
);

// ---- Patient sub-resources ----

router.get('/patients/:id/anamnesis', authCheck, asyncHandler(async (req, res) => {
  const user = req.user!;
  const companyId = user.companyId;
  if (!companyId) return res.status(403).json({ error: 'User not associated with any company' });
  const anamnesis = await storage.getPatientAnamnesis(parseInt(req.params.id), companyId);
  res.json(anamnesis);
}));

router.post('/patients/:id/anamnesis', authCheck, asyncHandler(async (req, res) => {
  const user = req.user!;
  const companyId = user.companyId;
  if (!companyId) return res.status(403).json({ error: 'User not associated with any company' });
  const anamnesis = await storage.createPatientAnamnesis({ ...req.body, patientId: parseInt(req.params.id), companyId });
  res.status(201).json(anamnesis);
}));

router.get('/patients/:id/exams', authCheck, asyncHandler(async (req, res) => {
  const user = req.user!;
  const companyId = user.companyId;
  if (!companyId) return res.status(403).json({ error: 'User not associated with any company' });
  const exams = await storage.getPatientExams(parseInt(req.params.id), companyId);
  res.json(exams);
}));

router.post('/patients/:id/exams', authCheck, asyncHandler(async (req, res) => {
  const user = req.user!;
  const companyId = user.companyId;
  if (!companyId) return res.status(403).json({ error: 'User not associated with any company' });
  const exam = await storage.createPatientExam({ ...req.body, patientId: parseInt(req.params.id), companyId });
  res.status(201).json(exam);
}));

router.get('/patients/:id/treatment-plans', authCheck, asyncHandler(async (req, res) => {
  const user = req.user!;
  const companyId = user.companyId;
  if (!companyId) return res.status(403).json({ error: 'User not associated with any company' });
  const plans = await storage.getPatientTreatmentPlans(parseInt(req.params.id), companyId);
  res.json(plans);
}));

router.post('/patients/:id/treatment-plans', authCheck, asyncHandler(async (req, res) => {
  const user = req.user!;
  const companyId = user.companyId;
  if (!companyId) return res.status(403).json({ error: 'User not associated with any company' });
  const plan = await storage.createPatientTreatmentPlan({ ...req.body, patientId: parseInt(req.params.id), companyId, professionalId: user.id });
  res.status(201).json(plan);
}));

router.get('/patients/:id/evolution', authCheck, asyncHandler(async (req, res) => {
  const user = req.user!;
  const companyId = user.companyId;
  if (!companyId) return res.status(403).json({ error: 'User not associated with any company' });
  const evolution = await storage.getPatientEvolution(parseInt(req.params.id), companyId);
  res.json(evolution);
}));

router.post('/patients/:id/evolution', authCheck, asyncHandler(async (req, res) => {
  const user = req.user!;
  const companyId = user.companyId;
  if (!companyId) return res.status(403).json({ error: 'User not associated with any company' });
  const evolution = await storage.createPatientEvolution({ ...req.body, patientId: parseInt(req.params.id), companyId });
  res.status(201).json(evolution);
}));

router.get('/patients/:id/prescriptions', authCheck, asyncHandler(async (req, res) => {
  const user = req.user!;
  const companyId = user.companyId;
  if (!companyId) return res.status(403).json({ error: 'User not associated with any company' });
  const prescriptions = await storage.getPatientPrescriptions(parseInt(req.params.id), companyId);
  res.json(prescriptions);
}));

router.post('/patients/:id/prescriptions', authCheck, asyncHandler(async (req, res) => {
  const user = req.user!;
  const companyId = user.companyId;
  if (!companyId) return res.status(403).json({ error: 'User not associated with any company' });
  const prescription = await storage.createPatientPrescription({ ...req.body, patientId: parseInt(req.params.id), companyId });
  res.status(201).json(prescription);
}));

// =====================================================
// APPOINTMENTS (legacy /api/appointments)
// =====================================================

router.get('/appointments', async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) return res.status(401).json({ message: 'Unauthorized' });

    const user = req.user!;
    if (!user.companyId) return res.status(403).json({ message: 'User not associated with any company' });
    const companyId = user.companyId;

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (req.query.date) {
      startDate = parse(req.query.date as string, 'yyyy-MM-dd', new Date());
      endDate = addDays(startDate, 1);
    }

    const appointments = await storage.getAppointments(companyId, {
      startDate: startDate ? formatISO(startDate) : undefined,
      endDate: endDate ? formatISO(endDate) : undefined,
      professionalId: req.query.professionalId ? parseInt(req.query.professionalId as string) : undefined,
      patientId: req.query.patientId ? parseInt(req.query.patientId as string) : undefined,
      status: req.query.status as string,
    });
    res.json(appointments);
  } catch (error) {
    next(error);
  }
});

router.post('/appointments', authCheck, checkAppointmentsLimit, async (req, res, next) => {
  try {
    const appointment = await storage.createAppointment(req.body, req.user!.companyId);
    res.status(201).json(appointment);
  } catch (error) {
    next(error);
  }
});

router.patch('/appointments/:id', async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) return res.status(401).json({ message: 'Unauthorized' });
    const updatedAppointment = await storage.updateAppointment(parseInt(req.params.id), req.body);
    res.json(updatedAppointment);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// PROFESSIONALS, ROOMS, PROCEDURES (legacy reads)
// =====================================================

router.get('/professionals', async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) return res.status(401).json({ message: 'Unauthorized' });
    const user = req.user!;
    const companyId = user.companyId;
    if (!companyId) return res.status(403).json({ message: 'User not associated with any company' });
    const professionals = await storage.getProfessionals(companyId);
    res.json(professionals);
  } catch (error) {
    next(error);
  }
});

router.get('/rooms', async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) return res.status(401).json({ message: 'Unauthorized' });
    const user = req.user!;
    if (!user.companyId) return res.status(403).json({ message: 'User not associated with any company' });
    const rooms = await storage.getRooms(user.companyId);
    res.json(rooms);
  } catch (error) {
    next(error);
  }
});

router.get('/procedures', async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) return res.status(401).json({ message: 'Unauthorized' });
    const user = req.user!;
    if (!user.companyId) return res.status(403).json({ message: 'User not associated with any company' });
    const procedures = await storage.getProcedures(user.companyId);
    res.json(procedures);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// AUTOMATIONS
// =====================================================

router.get('/automations', authCheck, cacheMiddleware(300), asyncHandler(async (req, res) => {
  const automations = await storage.getAutomations(req.user!.companyId);
  res.json(automations);
}));

router.post('/automations', authCheck, asyncHandler(async (req, res) => {
  const automation = await storage.createAutomation(req.body, req.user!.companyId);
  res.status(201).json(automation);
}));

router.patch('/automations/:id', authCheck, asyncHandler(async (req, res) => {
  const automation = await storage.updateAutomation(parseInt(req.params.id), req.body, req.user!.companyId);
  res.json(automation);
}));

router.delete('/automations/:id', authCheck, asyncHandler(async (req, res) => {
  await storage.deleteAutomation(parseInt(req.params.id), req.user!.companyId);
  res.status(204).end();
}));

router.patch('/automations/:id/toggle', authCheck, asyncHandler(async (req, res) => {
  const automation = await storage.updateAutomation(
    parseInt(req.params.id),
    { active: req.body.active },
    req.user!.companyId
  );
  res.json(automation);
}));

// =====================================================
// QUEUE MONITORING
// =====================================================

router.get('/queue/health', authCheck, asyncHandler(queueApi.getQueueHealth));
router.get('/queue/stats', authCheck, asyncHandler(queueApi.getQueueStats));
router.get('/queue/:queueName/jobs', authCheck, asyncHandler(queueApi.getQueueJobs));
router.post('/queue/:queueName/retry/:jobId', authCheck, asyncHandler(queueApi.retryJob));
router.post('/queue/:queueName/clean', authCheck, asyncHandler(queueApi.cleanQueue));

// =====================================================
// BILLING (wrapped to handle missing tables gracefully)
// =====================================================

router.get('/billing/plans', asyncHandler(async (req, res) => {
  try {
    await billingApi.getPlans(req, res);
  } catch (error: any) {
    if (error.message?.includes('does not exist') || error.code === '42P01') return res.json([]);
    throw error;
  }
}));

router.get('/billing/subscription', authCheck, asyncHandler(async (req, res) => {
  try {
    await billingApi.getMySubscription(req, res);
  } catch (error: any) {
    if (error.message?.includes('does not exist') || error.code === '42P01') {
      return res.status(404).json({ error: 'Subscription not found - tables may not exist' });
    }
    throw error;
  }
}));

router.post('/billing/subscription', authCheck, asyncHandler(billingApi.createSubscription));
router.put('/billing/subscription/plan', authCheck, asyncHandler(billingApi.changePlan));
router.delete('/billing/subscription', authCheck, asyncHandler(billingApi.cancelSubscription));

router.get('/billing/invoices', authCheck, asyncHandler(async (req, res) => {
  try {
    await billingApi.getInvoices(req, res);
  } catch (error: any) {
    if (error.message?.includes('does not exist') || error.code === '42P01') return res.json([]);
    throw error;
  }
}));

router.get('/billing/usage', authCheck, asyncHandler(async (req, res) => {
  try {
    await billingApi.getUsage(req, res);
  } catch (error: any) {
    if (error.message?.includes('does not exist') || error.code === '42P01') {
      return res.json({ usage: [], limits: {} });
    }
    throw error;
  }
}));

router.get('/billing/check-limit/:metricType', authCheck, asyncHandler(billingApi.checkLimit));

// =====================================================
// PAYMENTS (MercadoPago)
// =====================================================

router.get('/payments/plans', paymentHandlers.getPlans);
router.get('/payments/subscription', authCheck, paymentHandlers.getCurrentSubscription);
router.post('/payments/subscribe', authCheck, paymentHandlers.createSubscription);
router.post('/payments/cancel', authCheck, paymentHandlers.cancelSubscription);
router.get('/payments/history', authCheck, paymentHandlers.getPaymentHistory);
router.post('/payments/webhook', paymentHandlers.handleWebhook);
router.get('/payments/success', paymentHandlers.getPaymentSuccess);
router.get('/payments/failure', (req, res) => res.redirect('/payments?status=error'));
router.get('/payments/pending', (req, res) => res.redirect('/payments?status=pending'));

// =====================================================
// REPORTS (legacy /api/reports/*)
// =====================================================

router.get('/reports/revenue', authCheck, clinicHandlers.getRevenueReport);
router.get('/reports/appointments', authCheck, clinicHandlers.getAppointmentStats);
router.get('/reports/procedures', authCheck, clinicHandlers.getProcedureAnalytics);
router.get('/reports/patients', authCheck, clinicHandlers.getPatientAnalytics);

// =====================================================
// WEBSITE BUILDER
// =====================================================

router.get('/website', authCheck, websiteHandlers.getWebsite);
router.post('/website', authCheck, websiteHandlers.saveWebsite);
router.put('/website', authCheck, websiteHandlers.saveWebsite);
router.post('/website/publish', authCheck, websiteHandlers.publishWebsite);
router.get('/website/preview/:template', authCheck, websiteHandlers.getWebsitePreview);
router.post('/website/unpublish', authCheck, websiteHandlers.unpublishWebsite);
router.get('/website/public/:domain', websiteHandlers.getPublicWebsite);
router.get('/websites/published', authCheck, websiteHandlers.listPublishedWebsites);

router.post('/website/upload', authCheck, asyncHandler(async (req, res) => {
  const { imageData, filename } = req.body;
  if (!imageData || !filename) {
    return res.status(400).json({ error: 'imageData and filename are required' });
  }
  res.json({ success: true, url: imageData, filename });
}));

// =====================================================
// BACKUP
// =====================================================

router.post('/backup/create', authCheck, backupHandlers.createBackup);
router.post('/backup/schedule', authCheck, backupHandlers.scheduleBackup);
router.get('/backup/status', authCheck, backupHandlers.getBackupStatus);

// =====================================================
// PROFILE AVATAR UPLOAD
// =====================================================

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post(
  '/v1/profile/avatar',
  authCheck,
  avatarUpload.single('avatar'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user?.id) return res.status(401).json({ error: 'Not authenticated' });

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    await db.$client.query(
      `UPDATE users SET profile_image_url = $1, updated_at = NOW() WHERE id = $2`,
      [base64, user.id]
    );

    res.json({ success: true, url: base64 });
  })
);

// =====================================================
// PROSTHESIS (legacy /api/prosthesis — frontend uses this path)
// =====================================================

router.get('/prosthesis', authCheck, tenantIsolationMiddleware, asyncHandler(async (req, res) => {
  const user = req.user!;
  const prosthesis = await storage.getProsthesis(user.companyId);
  res.json(prosthesis);
}));

router.post('/prosthesis', authCheck, tenantIsolationMiddleware, asyncHandler(async (req, res) => {
  const user = req.user!;
  const prosthesisData = { ...req.body, companyId: user.companyId };
  const newProsthesis = await storage.createProsthesis(prosthesisData);

  if (!newProsthesis || !newProsthesis.id) {
    return res.status(500).json({ error: 'Erro interno', details: 'Prótese criada mas dados inválidos' });
  }

  res.status(200).json(newProsthesis);
}));

router.get('/prosthesis/:id', authCheck, tenantIsolationMiddleware, asyncHandler(async (req, res) => {
  const user = req.user!;
  const prosthesisId = parseInt(req.params.id);

  if (!prosthesisId || isNaN(prosthesisId)) {
    return res.status(400).json({ error: 'ID de prótese inválido' });
  }

  const allProsthesis = await storage.getProsthesis(user.companyId);
  const prosthesis = allProsthesis.find((p: any) => p.id === prosthesisId);

  if (!prosthesis) return res.status(404).json({ error: 'Prótese não encontrada' });
  res.json(prosthesis);
}));

router.patch('/prosthesis/:id', authCheck, tenantIsolationMiddleware, asyncHandler(async (req, res) => {
  const user = req.user!;
  const prosthesisId = parseInt(req.params.id);

  if (!prosthesisId || isNaN(prosthesisId)) {
    return res.status(400).json({ error: 'ID de prótese inválido' });
  }

  const updated = await storage.updateProsthesis(prosthesisId, req.body, user.companyId);
  if (!updated) return res.status(404).json({ error: 'Prótese não encontrada' });
  res.json(updated);
}));

router.delete('/prosthesis/:id', authCheck, tenantIsolationMiddleware, asyncHandler(async (req, res) => {
  const user = req.user!;
  const prosthesisId = parseInt(req.params.id);

  if (!prosthesisId || isNaN(prosthesisId)) {
    return res.status(400).json({ error: 'ID de prótese inválido' });
  }

  await storage.deleteProsthesis(prosthesisId, user.companyId);
  res.status(204).send();
}));

// =====================================================
// AUTH — Auto-login (dev utility)
// =====================================================

router.post('/auth/auto-login', asyncHandler(async (req, res) => {
  const user = await storage.getUserByUsername('admin');

  if (!user) {
    return res.status(404).json({ message: 'Usuário admin não encontrado' });
  }

  req.login(user, (err) => {
    if (err) {
      logger.error({ err }, 'Erro no auto-login:');
      return res.status(500).json({ message: 'Erro no login automático' });
    }

    res.json({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      active: user.active,
    });
  });
}));

// =====================================================
// APPOINTMENT COMPLETE (with auto financial transaction)
// =====================================================

router.patch(
  '/appointments/:id/complete',
  authCheck,
  tenantIsolationMiddleware,
  asyncHandler(async (req, res) => {
    const { financialIntegration } = await import('../financialIntegration');
    const user = req.user!;
    const appointmentId = parseInt(req.params.id);

    await storage.updateAppointment(appointmentId, { status: 'completed', companyId: user.companyId });

    try {
      const transactions =
        await financialIntegration.createFinancialTransactionsFromAppointment(appointmentId);

      res.json({
        message: 'Consulta finalizada e transações financeiras criadas automaticamente',
        appointmentId,
        transactionsCreated: transactions.length,
        transactions,
      });
    } catch (financialError) {
      logger.error({ err: financialError }, 'Erro na integração financeira automática:');
      res.json({
        message: 'Consulta finalizada, mas houve erro na criação automática das transações financeiras',
        appointmentId,
        warning: 'Transações financeiras precisam ser criadas manualmente',
      });
    }
  })
);

export { registerStripeRoutes };
export default router;
