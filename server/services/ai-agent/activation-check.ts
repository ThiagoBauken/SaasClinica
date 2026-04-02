/**
 * AI Agent Activation Check
 *
 * Validates that all required configuration is in place before enabling
 * the AI agent for a company. The automation ONLY activates after the
 * client fills in all necessary data.
 *
 * Required fields:
 * 1. ANTHROPIC_API_KEY (global or per-company)
 * 2. Clinic name + phone (basic identity)
 * 3. Opening/closing hours (for scheduling)
 * 4. WhatsApp connected (Wuzapi or Evolution API)
 * 5. At least 1 professional registered
 * 6. chatEnabled = true
 *
 * Optional but recommended:
 * - Procedures configured (for scheduling)
 * - Bot name/personality configured
 * - Emergency phone
 * - Address (for location queries)
 */

import { db } from '../../db';
import { eq, and, or } from 'drizzle-orm';
import { companies, clinicSettings, users, procedures } from '@shared/schema';
import { logger } from '../../logger';

const log = logger.child({ module: 'activation-check' });

export interface ActivationStatus {
  /** Whether the AI agent can be activated */
  canActivate: boolean;
  /** Whether it's currently active and processing messages */
  isActive: boolean;
  /** Required fields that are missing */
  missingRequired: ActivationItem[];
  /** Recommended fields that are missing (agent works without them) */
  missingRecommended: ActivationItem[];
  /** All checks that passed */
  passed: ActivationItem[];
  /** Completion percentage (0-100) */
  completionPercent: number;
}

export interface ActivationItem {
  key: string;
  label: string;
  description: string;
  category: 'required' | 'recommended';
}

// Cache check results for 2 minutes per company
const statusCache = new Map<number, { status: ActivationStatus; expiresAt: number }>();
const CACHE_TTL = 2 * 60 * 1000;

/**
 * Checks if a company has all required data to activate the AI agent.
 * Results are cached for 2 minutes.
 */
export async function checkActivation(companyId: number): Promise<ActivationStatus> {
  const cached = statusCache.get(companyId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.status;
  }

  const missingRequired: ActivationItem[] = [];
  const missingRecommended: ActivationItem[] = [];
  const passed: ActivationItem[] = [];

  // Load company data
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  const [settings] = await db.select().from(clinicSettings).where(eq(clinicSettings.companyId, companyId)).limit(1);

  // ============================================
  // REQUIRED CHECKS
  // ============================================

  // 1. API Key (global or per-company)
  const hasApiKey = !!(process.env.ANTHROPIC_API_KEY || company?.anthropicApiKey);
  if (hasApiKey) {
    passed.push({ key: 'api_key', label: 'Chave API da IA', description: 'Anthropic API Key configurada', category: 'required' });
  } else {
    missingRequired.push({ key: 'api_key', label: 'Chave API da IA', description: 'Configure a ANTHROPIC_API_KEY nas variáveis de ambiente ou nas configurações da empresa', category: 'required' });
  }

  // 2. Clinic basic info
  const hasClinicName = !!(settings?.name || company?.name);
  if (hasClinicName) {
    passed.push({ key: 'clinic_name', label: 'Nome da clínica', description: 'Nome da clínica configurado', category: 'required' });
  } else {
    missingRequired.push({ key: 'clinic_name', label: 'Nome da clínica', description: 'Configure o nome da clínica nas Configurações', category: 'required' });
  }

  const hasPhone = !!(settings?.phone || company?.phone);
  if (hasPhone) {
    passed.push({ key: 'phone', label: 'Telefone da clínica', description: 'Telefone principal configurado', category: 'required' });
  } else {
    missingRequired.push({ key: 'phone', label: 'Telefone da clínica', description: 'Configure o telefone principal nas Configurações', category: 'required' });
  }

  // 3. Working hours
  const hasHours = !!(settings?.openingTime && settings?.closingTime);
  if (hasHours) {
    passed.push({ key: 'working_hours', label: 'Horário de funcionamento', description: 'Horário de abertura e fechamento configurados', category: 'required' });
  } else {
    missingRequired.push({ key: 'working_hours', label: 'Horário de funcionamento', description: 'Configure horário de abertura e fechamento nas Configurações', category: 'required' });
  }

  // 4. WhatsApp connected
  const hasWuzapi = !!(settings?.wuzapiInstanceId && settings?.wuzapiApiKey);
  const hasEvolution = !!(settings?.evolutionApiBaseUrl && settings?.evolutionInstanceName && settings?.evolutionApiKey);
  const hasWhatsApp = hasWuzapi || hasEvolution;
  if (hasWhatsApp) {
    passed.push({ key: 'whatsapp', label: 'WhatsApp conectado', description: 'Integração WhatsApp configurada', category: 'required' });
  } else {
    missingRequired.push({ key: 'whatsapp', label: 'WhatsApp conectado', description: 'Configure a integração WhatsApp (Wuzapi ou Evolution API) nas Integrações', category: 'required' });
  }

  // 5. At least 1 professional
  const professionals = await db.select({ id: users.id }).from(users).where(
    and(eq(users.companyId, companyId), eq(users.active, true), or(eq(users.role, 'dentist'), eq(users.role, 'admin')))
  ).limit(1);
  const hasProfessional = professionals.length > 0;
  if (hasProfessional) {
    passed.push({ key: 'professional', label: 'Profissional cadastrado', description: 'Pelo menos um dentista cadastrado', category: 'required' });
  } else {
    missingRequired.push({ key: 'professional', label: 'Profissional cadastrado', description: 'Cadastre pelo menos um dentista na seção Profissionais', category: 'required' });
  }

  // 6. Chat enabled
  const chatEnabled = settings?.chatEnabled !== false;
  if (chatEnabled) {
    passed.push({ key: 'chat_enabled', label: 'Chat habilitado', description: 'Chatbot habilitado nas configurações', category: 'required' });
  } else {
    missingRequired.push({ key: 'chat_enabled', label: 'Chat habilitado', description: 'Habilite o chatbot nas Configurações do Chat', category: 'required' });
  }

  // ============================================
  // RECOMMENDED CHECKS
  // ============================================

  // Procedures
  const procs = await db.select({ id: procedures.id }).from(procedures).where(
    and(eq(procedures.companyId, companyId), eq(procedures.active, true))
  ).limit(1);
  if (procs.length > 0) {
    passed.push({ key: 'procedures', label: 'Procedimentos cadastrados', description: 'Procedimentos/serviços configurados', category: 'recommended' });
  } else {
    missingRecommended.push({ key: 'procedures', label: 'Procedimentos cadastrados', description: 'Cadastre procedimentos para a IA poder informar preços e duração', category: 'recommended' });
  }

  // Bot personality
  const hasBotConfig = !!(settings?.botName && settings.botName !== 'Assistente');
  if (hasBotConfig) {
    passed.push({ key: 'bot_config', label: 'Personalidade do bot', description: 'Nome e personalidade do bot configurados', category: 'recommended' });
  } else {
    missingRecommended.push({ key: 'bot_config', label: 'Personalidade do bot', description: 'Personalize o nome e personalidade do assistente', category: 'recommended' });
  }

  // Emergency phone
  if (settings?.emergencyPhone) {
    passed.push({ key: 'emergency_phone', label: 'Telefone de emergência', description: 'Telefone de emergência configurado', category: 'recommended' });
  } else {
    missingRecommended.push({ key: 'emergency_phone', label: 'Telefone de emergência', description: 'Configure um telefone de emergência para urgências', category: 'recommended' });
  }

  // Address
  if (settings?.address) {
    passed.push({ key: 'address', label: 'Endereço', description: 'Endereço da clínica configurado', category: 'recommended' });
  } else {
    missingRecommended.push({ key: 'address', label: 'Endereço', description: 'Configure o endereço da clínica para informar pacientes', category: 'recommended' });
  }

  // Google Maps link
  if (settings?.googleMapsLink) {
    passed.push({ key: 'google_maps', label: 'Google Maps', description: 'Link do Google Maps configurado', category: 'recommended' });
  } else {
    missingRecommended.push({ key: 'google_maps', label: 'Google Maps', description: 'Adicione o link do Google Maps para facilitar a localização', category: 'recommended' });
  }

  // ============================================
  // COMPUTE RESULT
  // ============================================

  const canActivate = missingRequired.length === 0;
  const totalChecks = passed.length + missingRequired.length + missingRecommended.length;
  const completionPercent = Math.round((passed.length / totalChecks) * 100);

  const status: ActivationStatus = {
    canActivate,
    isActive: canActivate && chatEnabled,
    missingRequired,
    missingRecommended,
    passed,
    completionPercent,
  };

  statusCache.set(companyId, { status, expiresAt: Date.now() + CACHE_TTL });
  return status;
}

/**
 * Quick check: can the AI agent process messages for this company?
 * Lightweight version for the hot path (webhook processing).
 */
export async function isAgentReady(companyId: number): Promise<boolean> {
  const status = await checkActivation(companyId);
  return status.isActive;
}

/**
 * Invalidates the cached activation status (call after settings update).
 */
export function invalidateActivationCache(companyId: number): void {
  statusCache.delete(companyId);
}
