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

/**
 * Registra todas as rotas modulares da API v1
 */
export function registerModularRoutes(app: Express) {
  // Health checks (sem prefixo /api)
  app.use('/health', healthRoutes);

  // API v1 Router
  const apiV1Router = Router();

  // Montar rotas modulares
  apiV1Router.use('/patients', patientsRoutes);
  apiV1Router.use('/patients', patientImportRoutes); // Rotas de importação
  apiV1Router.use('/patients', patientDigitizationRoutes); // Rotas de digitalização
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

  // Registrar o router v1 na aplicação
  app.use('/api/v1', apiV1Router);

  // Webhooks (sem autenticação, usam verificação própria)
  app.use('/api/webhooks', webhooksRoutes);

  console.log('✓ Modular routes registered under /api/v1');
  console.log('✓ Webhooks available at /api/webhooks');
  console.log('✓ Health checks available at /health');
}
