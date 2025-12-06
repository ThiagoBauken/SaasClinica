import { Router, Express } from 'express';
import patientsRoutes from './patients.routes';
import patientImportRoutes from './patient-import.routes';
import patientDigitizationRoutes from './patient-digitization.routes';
import appointmentsRoutes from './appointments.routes';
import professionalsRoutes from './professionals.routes';
import roomsRoutes from './rooms.routes';
import proceduresRoutes from './procedures.routes';
import settingsRoutes from './settings.routes';
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
import n8nToolsRoutes from './n8n-tools.routes';
import n8nConversationRoutes from './n8n-conversation.routes';
import riskAlertsRoutes from './risk-alerts.routes';
import publicAnamnesisRoutes from './public-anamnesis.routes';
import crmRoutes from './crm.routes';
import { auditLogMiddleware } from '../middleware/auditLog';

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
  apiV1Router.use('/company', companySettingsRoutes); // Configurações da empresa
  apiV1Router.use('/integrations', integrationsRoutes); // Integrações (Wuzapi, Google Calendar, N8N)
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
  apiV1Router.use('/automation', automationRoutes); // Automation engine (substitui N8N)
  apiV1Router.use('/saas', saasRoutes); // SaaS multi-tenant routes (para N8N)
  apiV1Router.use('/n8n/tools', n8nToolsRoutes); // N8N Tools API para Multi-Agente
  apiV1Router.use('/n8n/conversation', n8nConversationRoutes); // N8N Conversation Context
  apiV1Router.use('/risk-alerts', riskAlertsRoutes); // Risk alerts for patients (clinical safety)
  apiV1Router.use('/public-anamnesis', publicAnamnesisRoutes); // Public anamnesis links and management
  apiV1Router.use('/crm', crmRoutes); // CRM - Funil de Vendas

  // Registrar o router v1 na aplicação
  app.use('/api/v1', apiV1Router);

  // Rotas públicas (sem autenticação)
  app.use('/api/public-anamnesis', publicAnamnesisRoutes); // Public anamnesis form (form/:token and submit/:token)

  // Webhooks (sem autenticação, usam verificação própria)
  app.use('/api/webhooks', webhooksRoutes);

  console.log('✓ Modular routes registered under /api/v1');
  console.log('✓ Webhooks available at /api/webhooks');
  console.log('✓ Health checks available at /health');
  console.log('✓ Chat API available at /api/v1/chat');
  console.log('✓ Canned responses API available at /api/v1/canned-responses');
  console.log('✓ Admin phones API available at /api/v1/admin-phones');
  console.log('✓ N8N Tools API available at /api/v1/n8n/tools');
}
