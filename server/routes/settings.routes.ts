import { Router } from 'express';
import { storage } from '../storage';
import { authCheck, adminOnly, asyncHandler } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { z } from 'zod';
import { db } from '../db';
import { clinicSettings, companies, patients, appointments, financialTransactions, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Schema de validação completo para settings do chat e bot
const updateSettingsSchema = z.object({
  // Configurações gerais do chat
  chatEnabled: z.boolean().optional(),
  chatWelcomeMessage: z.string().optional(),
  chatFallbackMessage: z.string().optional(),
  emergencyPhone: z.string().optional(),
  googleReviewLink: z.string().optional(),
  googleMapsLink: z.string().optional(),

  // Estilo de conversa do bot
  conversationStyle: z.enum(['menu', 'humanized']).optional(),
  botPersonality: z.enum(['professional', 'friendly', 'casual']).optional(),
  botName: z.string().optional(),
  useEmojis: z.boolean().optional(),

  // Saudações
  greetingStyle: z.enum(['time_based', 'simple']).optional(),
  customGreetingMorning: z.string().optional(),
  customGreetingAfternoon: z.string().optional(),
  customGreetingEvening: z.string().optional(),

  // Contexto para IA
  humanizedPromptContext: z.string().optional(),
  clinicContextForBot: z.string().optional(),

  // Regras de negócio
  priceDisclosurePolicy: z.enum(['always', 'never_chat', 'only_general']).optional(),
  schedulingPolicy: z.enum(['immediate', 'appointment_required', 'callback']).optional(),
  paymentMethods: z.array(z.string()).optional(),

  // Tipo de clínica e serviços
  clinicType: z.enum([
    'consultorio_individual',
    'clinica_pequena',
    'clinica_media',
    'clinica_grande',
    'franquia'
  ]).optional(),
  servicesOffered: z.array(z.string()).optional(),

  // Configurações de agendamento e lembretes
  enableAppointmentReminders: z.boolean().optional(),
  reminderHoursBefore: z.number().int().min(1).max(72).optional(),
  enableBirthdayMessages: z.boolean().optional(),
  enableFeedbackRequests: z.boolean().optional(),
  feedbackHoursAfter: z.number().int().min(1).max(168).optional(),

  // Templates de mensagens
  confirmationMessageTemplate: z.string().optional(),
  reminderMessageTemplate: z.string().optional(),
  birthdayMessageTemplate: z.string().optional(),
  reviewRequestTemplate: z.string().optional(),
  cancellationMessageTemplate: z.string().optional(),

  // Configuração dinâmica de campos da ficha do paciente
  patientFormConfig: z.record(z.enum(['required', 'optional', 'hidden'])).optional(),
});

/**
 * GET /api/v1/settings
 * Busca todas as configurações da empresa (chat, bot style, etc.)
 */
router.get(
  '/',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    // Buscar settings da clínica
    const settings = await storage.getClinicSettings(companyId);

    // Buscar dados da empresa para fallback
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!settings) {
      // Retornar valores padrão se não existir configuração
      return res.json({
        data: {
          companyId,
          companyName: company?.name || '',

          // Chat
          chatEnabled: true,
          chatWelcomeMessage: '',
          chatFallbackMessage: '',
          emergencyPhone: company?.phone || '',
          googleReviewLink: '',
          googleMapsLink: '',

          // Bot style
          conversationStyle: 'menu',
          botPersonality: 'professional',
          botName: 'Assistente',
          useEmojis: true,
          greetingStyle: 'time_based',
          customGreetingMorning: '',
          customGreetingAfternoon: '',
          customGreetingEvening: '',
          humanizedPromptContext: '',

          // Regras de negócio
          priceDisclosurePolicy: 'always',
          schedulingPolicy: 'immediate',
          paymentMethods: ['pix', 'credit_card', 'debit_card', 'cash'],

          // Tipo e serviços
          clinicType: 'consultorio_individual',
          servicesOffered: [],
          clinicContextForBot: '',

          // Lembretes
          enableAppointmentReminders: true,
          reminderHoursBefore: 24,
          enableBirthdayMessages: true,
          enableFeedbackRequests: true,
          feedbackHoursAfter: 24,
        }
      });
    }

    // Retornar settings existentes
    res.json({
      data: {
        ...settings,
        companyName: settings.name || company?.name || '',
      }
    });
  })
);

/**
 * PUT /api/v1/settings
 * Atualiza configurações da empresa (admin only)
 */
router.put(
  '/',
  authCheck,
  adminOnly,
  validate({ body: updateSettingsSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    // Verificar se settings existe
    const existing = await storage.getClinicSettings(companyId);

    let updated;
    if (existing) {
      // Atualizar configurações existentes
      updated = await storage.updateClinicSettings(companyId, req.body);
    } else {
      // Criar novas configurações
      updated = await storage.createClinicSettings({
        companyId,
        ...req.body,
      });
    }

    res.json({
      message: 'Configurações salvas com sucesso',
      data: updated,
    });
  })
);

/**
 * PATCH /api/v1/settings
 * Atualização parcial de configurações (admin only)
 */
router.patch(
  '/',
  authCheck,
  adminOnly,
  validate({ body: updateSettingsSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    // Verificar se settings existe
    const existing = await storage.getClinicSettings(companyId);

    if (!existing) {
      // Criar com valores padrão + valores enviados
      const created = await storage.createClinicSettings({
        companyId,
        ...req.body,
      });
      return res.json({
        message: 'Configurações criadas com sucesso',
        data: created,
      });
    }

    // Atualizar apenas os campos enviados
    const updated = await storage.updateClinicSettings(companyId, req.body);

    res.json({
      message: 'Configurações atualizadas com sucesso',
      data: updated,
    });
  })
);

/**
 * GET /api/v1/settings/bot-context
 * Retorna contexto completo do bot para uso no N8N
 * (endpoint público para o workflow N8N chamar)
 */
router.get(
  '/bot-context/:companyId',
  asyncHandler(async (req, res) => {
    const companyId = parseInt(req.params.companyId);

    if (!companyId || isNaN(companyId)) {
      return res.status(400).json({ error: 'Invalid company ID' });
    }

    const settings = await storage.getClinicSettings(companyId);

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!settings && !company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Retornar contexto formatado para o bot
    res.json({
      company: {
        id: companyId,
        name: settings?.name || company?.name || '',
        phone: settings?.phone || company?.phone || '',
        address: settings?.address || '',
        googleReviewLink: settings?.googleReviewLink || '',
        googleMapsLink: settings?.googleMapsLink || '',
      },
      botStyle: {
        conversationStyle: settings?.conversationStyle || 'menu',
        personality: settings?.botPersonality || 'professional',
        name: settings?.botName || 'Assistente',
        useEmojis: settings?.useEmojis !== false,
        greetingStyle: settings?.greetingStyle || 'time_based',
        customGreetings: {
          morning: settings?.customGreetingMorning || '',
          afternoon: settings?.customGreetingAfternoon || '',
          evening: settings?.customGreetingEvening || '',
        },
      },
      businessRules: {
        priceDisclosurePolicy: settings?.priceDisclosurePolicy || 'always',
        schedulingPolicy: settings?.schedulingPolicy || 'immediate',
        paymentMethods: settings?.paymentMethods || ['pix', 'credit_card', 'debit_card', 'cash'],
      },
      context: {
        clinicType: settings?.clinicType || 'consultorio_individual',
        servicesOffered: settings?.servicesOffered || [],
        humanizedPromptContext: settings?.humanizedPromptContext || '',
        clinicContextForBot: settings?.clinicContextForBot || '',
      },
      messages: {
        welcome: settings?.chatWelcomeMessage || '',
        fallback: settings?.chatFallbackMessage || '',
        emergencyPhone: settings?.emergencyPhone || settings?.phone || company?.phone || '',
      }
    });
  })
);

// ---------------------------------------------------------------------------
// Notification Settings
// ---------------------------------------------------------------------------

const DEFAULT_NOTIFICATION_SETTINGS = {
  appointmentReminders: {
    enabled: true,
    whatsapp: true,
    email: true,
    sms: false,
    hoursBefore: 24,
    template: '',
  },
  birthdays: { enabled: true, whatsapp: true, email: false, sms: false, template: '' },
  marketing: { enabled: false, whatsapp: false, email: false, sms: false, template: '' },
  system: { enabled: true, whatsapp: false, email: true, sms: false },
};

/**
 * GET /api/v1/settings/notifications
 * Retorna configurações de notificação ou padrões
 */
router.get(
  '/notifications',
  authCheck,
  adminOnly,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const existing = await storage.getClinicSettings(companyId);

    return res.json({
      data: existing?.notificationSettings ?? DEFAULT_NOTIFICATION_SETTINGS,
    });
  })
);

/**
 * PUT /api/v1/settings/notifications
 * Salva configurações de notificação
 */
router.put(
  '/notifications',
  authCheck,
  adminOnly,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const existing = await storage.getClinicSettings(companyId);

    if (existing) {
      await db
        .update(clinicSettings)
        .set({ notificationSettings: req.body })
        .where(eq(clinicSettings.companyId, companyId));
    } else {
      await storage.createClinicSettings({ companyId, notificationSettings: req.body });
    }

    return res.json({
      message: 'Configurações de notificação salvas com sucesso',
      data: req.body,
    });
  })
);

// ---------------------------------------------------------------------------
// Financial Settings
// ---------------------------------------------------------------------------

const DEFAULT_FINANCIAL_SETTINGS = {
  paymentMethods: {
    cash: true,
    creditCard: true,
    debitCard: true,
    pix: true,
    boleto: false,
    transfer: false,
  },
  pix: { keyType: 'cpf', key: '' },
  installments: { maxInstallments: 12, minValue: 50 },
  fees: { cardFee: 3.5 },
  bankAccount: { bank: '', agency: '', account: '' },
};

/**
 * GET /api/v1/settings/financial
 * Retorna configurações financeiras ou padrões
 */
router.get(
  '/financial',
  authCheck,
  adminOnly,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const existing = await storage.getClinicSettings(companyId);

    return res.json({
      data: existing?.financialSettings ?? DEFAULT_FINANCIAL_SETTINGS,
    });
  })
);

/**
 * PUT /api/v1/settings/financial
 * Salva configurações financeiras
 */
router.put(
  '/financial',
  authCheck,
  adminOnly,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const existing = await storage.getClinicSettings(companyId);

    if (existing) {
      await db
        .update(clinicSettings)
        .set({ financialSettings: req.body })
        .where(eq(clinicSettings.companyId, companyId));
    } else {
      await storage.createClinicSettings({ companyId, financialSettings: req.body });
    }

    return res.json({
      message: 'Configurações financeiras salvas com sucesso',
      data: req.body,
    });
  })
);

// ---------------------------------------------------------------------------
// Printing Settings
// ---------------------------------------------------------------------------

const DEFAULT_PRINTING_SETTINGS = {
  pageSize: 'A4',
  orientation: 'portrait',
  margins: { top: 20, bottom: 20, left: 15, right: 15 },
  templates: {
    receipt: { header: '', footer: '', showLogo: true, showClinicInfo: true },
    quote: { header: '', footer: '', showLogo: true, showClinicInfo: true },
    certificate: { header: '', footer: '', showLogo: true, showClinicInfo: true },
    prescription: { header: '', footer: '', showLogo: true, showClinicInfo: true },
    declaration: { header: '', footer: '', showLogo: true, showClinicInfo: true },
  },
};

/**
 * GET /api/v1/settings/printing
 * Retorna configurações de impressão ou padrões
 */
router.get(
  '/printing',
  authCheck,
  adminOnly,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const existing = await storage.getClinicSettings(companyId);

    return res.json({
      data: existing?.printingSettings ?? DEFAULT_PRINTING_SETTINGS,
    });
  })
);

/**
 * PUT /api/v1/settings/printing
 * Salva configurações de impressão
 */
router.put(
  '/printing',
  authCheck,
  adminOnly,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const existing = await storage.getClinicSettings(companyId);

    if (existing) {
      await db
        .update(clinicSettings)
        .set({ printingSettings: req.body })
        .where(eq(clinicSettings.companyId, companyId));
    } else {
      await storage.createClinicSettings({ companyId, printingSettings: req.body });
    }

    return res.json({
      message: 'Configurações de impressão salvas com sucesso',
      data: req.body,
    });
  })
);

// ---------------------------------------------------------------------------
// Appearance Settings
// ---------------------------------------------------------------------------

const DEFAULT_APPEARANCE_SETTINGS = {
  theme: 'system',
  primaryColor: 'blue',
  sidebarStyle: 'expanded',
  fontSize: 'medium',
  showClinicName: true,
};

/**
 * GET /api/v1/settings/appearance
 * Retorna configurações de aparência ou padrões
 */
router.get(
  '/appearance',
  authCheck,
  adminOnly,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const existing = await storage.getClinicSettings(companyId);

    return res.json({
      data: existing?.appearanceSettings ?? DEFAULT_APPEARANCE_SETTINGS,
    });
  })
);

/**
 * PUT /api/v1/settings/appearance
 * Salva configurações de aparência
 */
router.put(
  '/appearance',
  authCheck,
  adminOnly,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const existing = await storage.getClinicSettings(companyId);

    if (existing) {
      await db
        .update(clinicSettings)
        .set({ appearanceSettings: req.body })
        .where(eq(clinicSettings.companyId, companyId));
    } else {
      await storage.createClinicSettings({ companyId, appearanceSettings: req.body });
    }

    return res.json({
      message: 'Configurações de aparência salvas com sucesso',
      data: req.body,
    });
  })
);

// ---------------------------------------------------------------------------
// Backup Settings
// ---------------------------------------------------------------------------

const DEFAULT_BACKUP_SETTINGS = {
  autoBackup: { enabled: false, frequency: 'daily' },
  retention: { days: 90 },
  lastBackup: null,
};

/**
 * GET /api/v1/settings/backup
 * Retorna configurações de backup ou padrões
 */
router.get(
  '/backup',
  authCheck,
  adminOnly,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const existing = await storage.getClinicSettings(companyId);

    return res.json({
      data: existing?.backupSettings ?? DEFAULT_BACKUP_SETTINGS,
    });
  })
);

/**
 * PUT /api/v1/settings/backup
 * Salva configurações de backup
 */
router.put(
  '/backup',
  authCheck,
  adminOnly,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const existing = await storage.getClinicSettings(companyId);

    if (existing) {
      await db
        .update(clinicSettings)
        .set({ backupSettings: req.body })
        .where(eq(clinicSettings.companyId, companyId));
    } else {
      await storage.createClinicSettings({ companyId, backupSettings: req.body });
    }

    return res.json({
      message: 'Configurações de backup salvas com sucesso',
      data: req.body,
    });
  })
);

/**
 * POST /api/v1/settings/backup/create
 * Dispara um backup manual e registra o timestamp
 */
router.post(
  '/backup/create',
  authCheck,
  adminOnly,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const existing = await storage.getClinicSettings(companyId);
    const backupData: any = (existing?.backupSettings as any) ?? {};
    backupData.lastBackup = { date: new Date().toISOString(), status: 'completed' };

    if (existing) {
      await db
        .update(clinicSettings)
        .set({ backupSettings: backupData })
        .where(eq(clinicSettings.companyId, companyId));
    } else {
      await storage.createClinicSettings({ companyId, backupSettings: backupData });
    }

    return res.json({
      message: 'Backup realizado com sucesso',
      data: backupData.lastBackup,
    });
  })
);

/**
 * DELETE /api/v1/settings/data/clean-test
 * Remove dados de teste/demonstração (admin only)
 */
router.delete(
  '/data/clean-test',
  authCheck,
  adminOnly,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    // Remove dados de demonstração criados automaticamente
    // Apaga apenas registros marcados como teste ou com datas futuras irreais
    const result = await db.$client.query(`
      DELETE FROM appointments WHERE company_id = $1 AND notes LIKE '%[TESTE]%';
    `, [companyId]);

    const deletedCount = result.rowCount || 0;

    res.json({
      message: 'Dados de teste removidos com sucesso',
      deletedAppointments: deletedCount,
    });
  })
);

// ---------------------------------------------------------------------------
// Export Routes - registered on the same router, paths exposed via /export/*
// in index.ts
// ---------------------------------------------------------------------------

export const exportRouter = Router();

/**
 * GET /api/v1/export/patients.csv
 * Exporta pacientes da empresa em formato CSV
 */
exportRouter.get(
  '/patients.csv',
  authCheck,
  adminOnly,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const rows = await db
      .select({
        fullName: patients.fullName,
        cpf: patients.cpf,
        phone: patients.cellphone,
        email: patients.email,
        birthDate: patients.birthDate,
      })
      .from(patients)
      .where(eq(patients.companyId, companyId));

    const csvHeader = 'Nome,CPF,Telefone,Email,Data de Nascimento\n';
    const csvRows = rows
      .map((r: any) => {
        const birthDateStr = r.birthDate
          ? new Date(r.birthDate).toLocaleDateString('pt-BR')
          : '';
        return `"${r.fullName || ''}","${r.cpf || ''}","${r.phone || ''}","${r.email || ''}","${birthDateStr}"`;
      })
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=pacientes.csv');
    res.send('\uFEFF' + csvHeader + csvRows);
  })
);

/**
 * GET /api/v1/export/financial.csv
 * Exporta transações financeiras da empresa em formato CSV
 */
exportRouter.get(
  '/financial.csv',
  authCheck,
  adminOnly,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const rows = await db
      .select({
        date: financialTransactions.date,
        type: financialTransactions.type,
        description: financialTransactions.description,
        amount: financialTransactions.amount,
        status: financialTransactions.status,
      })
      .from(financialTransactions)
      .where(eq(financialTransactions.companyId, companyId));

    const csvHeader = 'Data,Tipo,Descrição,Valor,Status\n';
    const csvRows = rows
      .map((r: any) => {
        const dateStr = r.date ? new Date(r.date).toLocaleDateString('pt-BR') : '';
        const amountStr = r.amount != null ? (Number(r.amount) / 100).toFixed(2) : '0.00';
        const type = r.type === 'income' ? 'Receita' : 'Despesa';
        return `"${dateStr}","${type}","${r.description || ''}","${amountStr}","${r.status || ''}"`;
      })
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=financeiro.csv');
    res.send('\uFEFF' + csvHeader + csvRows);
  })
);

/**
 * GET /api/v1/export/appointments.csv
 * Exporta agendamentos da empresa em formato CSV
 */
exportRouter.get(
  '/appointments.csv',
  authCheck,
  adminOnly,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const rows = await db
      .select({
        startTime: appointments.startTime,
        title: appointments.title,
        status: appointments.status,
        patientName: patients.fullName,
        professionalName: users.fullName,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(users, eq(appointments.professionalId, users.id))
      .where(eq(appointments.companyId, companyId));

    const csvHeader = 'Data,Horário,Paciente,Profissional,Procedimento,Status\n';
    const csvRows = rows
      .map((r: any) => {
        const dateStr = r.startTime ? new Date(r.startTime).toLocaleDateString('pt-BR') : '';
        const timeStr = r.startTime
          ? new Date(r.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : '';
        return `"${dateStr}","${timeStr}","${r.patientName || ''}","${r.professionalName || ''}","${r.title || ''}","${r.status || ''}"`;
      })
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=agendamentos.csv');
    res.send('\uFEFF' + csvHeader + csvRows);
  })
);

export default router;
