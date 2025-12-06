import { Router } from 'express';
import { storage } from '../storage';
import { authCheck, adminOnly, asyncHandler } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { z } from 'zod';
import { db } from '../db';
import { clinicSettings, companies } from '@shared/schema';
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

export default router;
