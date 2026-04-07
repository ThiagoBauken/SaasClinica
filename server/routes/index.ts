import { Router, Express } from 'express';
import patientsRoutes from './patients.routes';
import patientImportRoutes from './patient-import.routes';
import patientDigitizationRoutes from './patient-digitization.routes';
import appointmentsRoutes from './appointments.routes';
import professionalsRoutes from './professionals.routes';
import roomsRoutes from './rooms.routes';
import proceduresRoutes from './procedures.routes';
import settingsRoutes, { exportRouter as exportRoutes } from './settings.routes';
import companySettingsRoutes from './company-settings.routes';
import integrationsRoutes from './integrations.routes';
import webhooksRoutes from './webhooks.routes';
import healthRoutes from './health.routes';
import whatsappRoutes from './whatsapp.routes';
import financialRoutes from './financial.routes';
import googleCalendarRoutes from './google-calendar.routes';
import periodontalRoutes from './periodontal.routes';
import digitalSignatureRoutes from './digital-signature.routes';
import prosthesisRoutes from './prosthesis.routes';
import auditLogsRoutes from './audit-logs.routes';
import notificationsRoutes from './notifications.routes';
import analyticsRoutes from './analytics.routes';
import couponsRoutes from './coupons.routes';
import paymentGatewaysRoutes from './payment-gateways.routes';
import menuPermissionsRoutes from './menu-permissions.routes';
import chatRoutes from './chat.routes';
import cannedResponsesRoutes from './canned-responses.routes';
import adminPhonesRoutes from './admin-phones.routes';
import automationRoutes from './automation.routes';
import saasRoutes from './saas.routes';
import riskAlertsRoutes from './risk-alerts.routes';
import publicAnamnesisRoutes from './public-anamnesis.routes';
import crmRoutes from './crm.routes';
import storageRoutes from './storage.routes';
import clinicalAssistantRoutes from './clinical-assistant.routes';
import publicConfirmationRoutes from './public-confirmation.routes';
import superadminRoutes from './superadmin.routes';
import metaWebhookRoutes from './meta-webhook.routes';
import reportsRoutes from './reports.routes';
import patientPaymentsRoutes from './patient-payments.routes';
import recallRoutes from './recall.routes';
import reviewsRoutes from './reviews.routes';
import campaignsRoutes from './campaigns.routes';
import contractsRoutes from './contracts.routes';
import teleconsultationRoutes from './teleconsultation.routes';
import officeChatRoutes from './office-chat.routes';
import insuranceRoutes from './insurance.routes';
import checkinRoutes from './checkin.routes';
import adminSeedRoutes from './admin-seed.routes';
import dlqAdminRoutes from './dlq-admin.routes';
import scheduleBlocksRoutes from './schedule-blocks.routes';
import accountsPayableRoutes from './accounts-payable.routes';
import accountsReceivableRoutes from './accounts-receivable.routes';
import anesthesiaLogsRoutes from './anesthesia-logs.routes';
import clinicUnitsRoutes from './clinic-units.routes';
import discountLimitsRoutes from './discount-limits.routes';
import examRequestsRoutes from './exam-requests.routes';
import faqRoutes from './faq.routes';
import aiFaqCacheRoutes from './ai-faq-cache.routes';
import installmentsRoutes from './installments.routes';
import quotesRoutes from './quotes.routes';
import cashRegisterRoutes from './cash-register.routes';
import teamInvitesRoutes from './team-invites.routes';
import pixRoutes from './pix.routes';
import medicationsRoutes from './medications.routes';
import publicBookingRoutes from './public-booking.routes';
import publicChatbotRoutes from './public-chatbot.routes';
import goalsRoutes from './goals.routes';
import patientPortalRoutes from './patient-portal.routes';
import holidaysRoutes from './holidays.routes';
import aestheticRoutes from './aesthetic.routes';
import waitlistRoutes from './waitlist.routes';
import { auditLogMiddleware } from '../middleware/auditLog';

// ── Migrated from monolithic routes.ts ──────────────────────────────────────
import saasAdminRoutes from './saas-admin.routes';
import userModulesRoutes from './user-modules.routes';
import clinicConfigRoutes from './clinic-config.routes';
import inventoryRoutes from './inventory.routes';
import financialIntegrationRoutes from './financial-integration.routes';
import cadastrosRoutes from './cadastros.routes';
import prosthesisLabelsRoutes from './prosthesis-labels.routes';
import legacyApiRoutes, { registerStripeRoutes } from './legacy-api.routes';
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from '../logger';
/**
 * Registra todas as rotas modulares da API v1
 */
export function registerModularRoutes(app: Express) {
  // Health checks (sem prefixo /api)
  app.use('/health', healthRoutes);

  // API v1 Router
  const apiV1Router = Router();

  // Aplicar middleware de audit log para conformidade LGPD
  apiV1Router.use(auditLogMiddleware);

  // Montar rotas modulares
  apiV1Router.use('/patients', patientsRoutes);
  apiV1Router.use('/patients', patientImportRoutes); // Rotas de importação
  apiV1Router.use('/patients/digitization', patientDigitizationRoutes); // Rotas de digitalização (prefixo específico)
  apiV1Router.use('/', periodontalRoutes); // Periodontal charts
  apiV1Router.use('/digital-signature', digitalSignatureRoutes); // Digital signatures (CFO)
  apiV1Router.use('/appointments', appointmentsRoutes);
  apiV1Router.use('/professionals', professionalsRoutes);
  apiV1Router.use('/rooms', roomsRoutes);
  apiV1Router.use('/procedures', proceduresRoutes);
  apiV1Router.use('/settings', settingsRoutes);
  apiV1Router.use('/export', exportRoutes);
  apiV1Router.use('/company', companySettingsRoutes); // Configurações da empresa
  apiV1Router.use('/integrations', integrationsRoutes); // Integrações (Wuzapi, Google Calendar, AI)
  apiV1Router.use('/whatsapp', whatsappRoutes); // WhatsApp messaging
  apiV1Router.use('/financial', financialRoutes); // Financial management
  apiV1Router.use('/google', googleCalendarRoutes); // Google Calendar integration
  apiV1Router.use('/prosthesis', prosthesisRoutes); // Prosthesis management
  apiV1Router.use('/audit-logs', auditLogsRoutes); // Audit logs (LGPD compliance)
  apiV1Router.use('/notifications', notificationsRoutes); // Real-time notifications
  apiV1Router.use('/analytics', analyticsRoutes); // Analytics and reports
  apiV1Router.use('/coupons', couponsRoutes); // Coupon management
  apiV1Router.use('/payment-gateways', paymentGatewaysRoutes); // Payment gateways (crypto, mercadopago)
  apiV1Router.use('/menu-permissions', menuPermissionsRoutes); // Menu permissions (role-based access)
  apiV1Router.use('/chat', chatRoutes); // Chat sessions and messages
  apiV1Router.use('/canned-responses', cannedResponsesRoutes); // Canned responses for chat
  apiV1Router.use('/admin-phones', adminPhonesRoutes); // Admin phones for notifications
  apiV1Router.use('/automation', automationRoutes); // Automation engine
  apiV1Router.use('/saas', saasRoutes); // SaaS multi-tenant routes
  apiV1Router.use('/risk-alerts', riskAlertsRoutes); // Risk alerts for patients (clinical safety)
  apiV1Router.use('/public-anamnesis', publicAnamnesisRoutes); // Public anamnesis links and management
  apiV1Router.use('/crm', crmRoutes); // CRM - Funil de Vendas
  apiV1Router.use('/storage', storageRoutes); // Storage API (S3/MinIO)
  apiV1Router.use('/clinical-assistant', clinicalAssistantRoutes); // AI Clinical Assistant
  apiV1Router.use('/reports', reportsRoutes); // Advanced Reports (25+)
  apiV1Router.use('/patient-payments', patientPaymentsRoutes); // PIX/Boleto/Card patient payments
  apiV1Router.use('/recall', recallRoutes);       // Recall system, waitlist and cancellation auto-fill
  apiV1Router.use('/reviews', reviewsRoutes);     // Review requests and NPS surveys
  apiV1Router.use('/campaigns', campaignsRoutes); // Email/WhatsApp mass campaigns
  apiV1Router.use('/contracts', contractsRoutes); // Contract templates and patient contracts
  apiV1Router.use('/teleconsultations', teleconsultationRoutes); // Teleconsultation via Jitsi
  apiV1Router.use('/office-chat', officeChatRoutes); // Intra-office chat
  apiV1Router.use('/insurance', insuranceRoutes); // Insurance/Convenios management (TISS)
  apiV1Router.use('/checkin', checkinRoutes); // QR Code check-in
  apiV1Router.use('/admin', adminSeedRoutes); // Admin seed data
  apiV1Router.use('/admin', dlqAdminRoutes);  // DLQ list/replay/discard (BullMQ)
  apiV1Router.use('/schedule-blocks', scheduleBlocksRoutes); // Schedule blocks (vacations, holidays, maintenance)
  apiV1Router.use('/accounts-payable', accountsPayableRoutes); // Accounts payable (clinic expenses)
  apiV1Router.use('/accounts-receivable', accountsReceivableRoutes); // Accounts receivable (patient receivables)
  apiV1Router.use('/anesthesia-logs', anesthesiaLogsRoutes); // Anesthesia logs (clinical records)
  apiV1Router.use('/clinic-units', clinicUnitsRoutes); // Clinic units (multi-unit management)
  apiV1Router.use('/discount-limits', discountLimitsRoutes); // Discount limits by role
  apiV1Router.use('/exam-requests', examRequestsRoutes); // Exam request workflow
  apiV1Router.use('/faq', faqRoutes);                   // FAQ / AI training knowledge base
  apiV1Router.use('/ai-faq-cache', aiFaqCacheRoutes);    // AI FAQ cache (pre-LLM lookup)
  apiV1Router.use('/financial', installmentsRoutes);    // Installment calculation and simulation
  apiV1Router.use('/quotes', quotesRoutes);             // Quote / Budget generation (Orçamentos)
  apiV1Router.use('/cash-register', cashRegisterRoutes); // Cash register open/close workflow (Caixa)
  apiV1Router.use('/team', teamInvitesRoutes);           // Team invite system
  apiV1Router.use('/payments', pixRoutes);               // PIX QR Code generation (F2-02)
  apiV1Router.use('/medications', medicationsRoutes);     // Medications database for prescription autocomplete (F1-04)
  apiV1Router.use('/goals', goalsRoutes);                 // Sales goals and KPI tracking (S4-04)
  apiV1Router.use('/patient-portal', patientPortalRoutes); // Patient self-service portal (generate-link)
  apiV1Router.use('/holidays', holidaysRoutes);           // Holiday management (CRUD + Brazilian national seed)
  apiV1Router.use('/aesthetic', aestheticRoutes);         // Aesthetic features (before/after photos, packages)
  apiV1Router.use('/waitlist', waitlistRoutes);           // Waitlist (Lista de Espera)

  // Registrar o router v1 na aplicação
  app.use('/api/v1', apiV1Router);

  // ── Legacy /api/* routes (migrated from monolithic routes.ts) ────────────
  // These mount at /api/ (not /api/v1/) to preserve existing frontend contracts.
  app.use('/api/saas', saasAdminRoutes);              // SaaS company/user/plan/invoice admin
  app.use('/api', userModulesRoutes);                 // /api/user/modules, /api/user/company, /api/user/me, /api/clinic/modules/*
  app.use('/api', clinicConfigRoutes);                // /api/clinic-settings, /api/fiscal-settings, /api/admin/users, /api/permissions, /api/machine-taxes, /api/commissions/*
  app.use('/api/inventory', inventoryRoutes);         // /api/inventory/* (items, categories, transactions, seed)
  app.use('/api/financial', financialIntegrationRoutes); // /api/financial/* (integration endpoints)
  app.use('/api/cadastros', cadastrosRoutes);         // /api/cadastros/categories, /boxes, /chairs
  app.use('/api/prosthesis-labels', prosthesisLabelsRoutes); // /api/prosthesis-labels
  app.use('/api', legacyApiRoutes);                   // All remaining legacy /api/* handlers

  // Stripe webhook + checkout (called from legacyApiRoutes export)
  registerStripeRoutes(app);
  // ─────────────────────────────────────────────────────────────────────────

  // Rotas públicas (sem autenticação)
  app.use('/api/public-anamnesis', publicAnamnesisRoutes); // Public anamnesis form (form/:token and submit/:token)
  app.use('/api/public/confirm', publicConfirmationRoutes); // Public appointment confirmation links
  app.use('/api/public', teamInvitesRoutes); // Public invite validation and acceptance (/invite/:token)
  app.use('/api/public/booking', publicBookingRoutes); // Public self-scheduling booking page
  app.use('/api/public/chatbot', publicChatbotRoutes); // Public patient chatbot (triage + FAQ + booking)
  app.use('/api/public/portal', patientPortalRoutes);  // Patient portal token lookup (GET /:token)
  // Public quote routes are already nested under /api/v1/quotes/public/:token (no auth guard on those handlers)

  // SuperAdmin routes (autenticação superadmin obrigatória)
  app.use('/api/superadmin', superadminRoutes);

  // Webhooks (sem autenticação, usam verificação própria)
  app.use('/api/webhooks', webhooksRoutes);
  app.use('/api/v1/webhooks/meta', metaWebhookRoutes); // Meta Cloud API webhook

  logger.info('FAQ routes available at /api/v1/faq');
  logger.info('Modular routes registered under /api/v1');
  logger.info('Webhooks available at /api/webhooks');
  logger.info('Health checks available at /health');
  logger.info('Chat API available at /api/v1/chat');
  logger.info('Canned responses API available at /api/v1/canned-responses');
  logger.info('Admin phones API available at /api/v1/admin-phones');
  logger.info('Storage API available at /api/v1/storage');
  logger.info('Quotes API available at /api/v1/quotes');
  logger.info('Cash register API available at /api/v1/cash-register');
  logger.info('Team invites API available at /api/v1/team/invite[s]');
  logger.info('Public invite API available at /api/public/invite/:token');
  logger.info('PIX QR Code available at /api/v1/payments/pix');
  logger.info('Patient portal: POST /api/v1/patient-portal/generate-link | GET /api/public/portal/:token');
  logger.info('Public chatbot API available at /api/public/chatbot/:companyId/message');
}
