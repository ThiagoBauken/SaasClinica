/**
 * Unified WhatsApp Provider Abstraction
 *
 * Supports three providers with a single interface:
 *   - wuzapi: Unofficial WhatsApp API (self-hosted)
 *   - evolution: Evolution API (unofficial, self-hosted)
 *   - meta_cloud_api: Official Meta WhatsApp Cloud API
 *
 * The active provider is stored in clinic_settings.whatsapp_provider.
 * All message sending across the app should go through getWhatsAppProvider().
 */

import { db } from '../db';
import { clinicSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../logger';
import { WhatsAppService, createWhatsAppService, getWhatsAppConfig } from './whatsapp.service';
import { EvolutionApiService, createEvolutionService } from './evolution-api.service';

const log = logger.child({ module: 'whatsapp-provider' });

// ==========================================
// Unified interface
// ==========================================

export type WhatsAppProviderType = 'wuzapi' | 'evolution' | 'meta_cloud_api';

export interface SendMessageOptions {
  phone: string;
  message: string;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: WhatsAppProviderType;
}

export interface ConnectionStatus {
  connected: boolean;
  provider: WhatsAppProviderType;
  state?: string;
  error?: string;
}

export interface IWhatsAppProvider {
  readonly providerType: WhatsAppProviderType;
  sendTextMessage(options: SendMessageOptions): Promise<SendMessageResult>;
  checkConnection(): Promise<ConnectionStatus>;
}

// ==========================================
// Wuzapi adapter
// ==========================================

class WuzapiAdapter implements IWhatsAppProvider {
  readonly providerType: WhatsAppProviderType = 'wuzapi';

  constructor(private service: WhatsAppService) {}

  async sendTextMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    const result = await this.service.sendMessage({ phone: options.phone, message: options.message });
    return { ...result, provider: 'wuzapi' };
  }

  async checkConnection(): Promise<ConnectionStatus> {
    const result = await this.service.checkConnection();
    return { ...result, provider: 'wuzapi' };
  }
}

// ==========================================
// Evolution API adapter
// ==========================================

class EvolutionAdapter implements IWhatsAppProvider {
  readonly providerType: WhatsAppProviderType = 'evolution';

  constructor(private service: EvolutionApiService) {}

  async sendTextMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    const result = await this.service.sendTextMessage({ phone: options.phone, message: options.message });
    return { ...result, provider: 'evolution' };
  }

  async checkConnection(): Promise<ConnectionStatus> {
    const result = await this.service.checkConnection();
    return { ...result, provider: 'evolution' };
  }
}

// ==========================================
// Meta Cloud API provider (Official)
// ==========================================

export interface MetaCloudApiConfig {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId?: string;
  apiVersion?: string;
}

class MetaCloudApiProvider implements IWhatsAppProvider {
  readonly providerType: WhatsAppProviderType = 'meta_cloud_api';
  private config: MetaCloudApiConfig;
  private apiVersion: string;

  constructor(config: MetaCloudApiConfig) {
    this.config = config;
    this.apiVersion = config.apiVersion || 'v21.0';
  }

  private formatPhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (!cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }
    return cleaned;
  }

  async sendTextMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    const phone = this.formatPhone(options.phone);

    try {
      const response = await fetch(
        `https://graph.facebook.com/${this.apiVersion}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: phone,
            type: 'text',
            text: { body: options.message },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData?.error?.message || `HTTP ${response.status}`;
        log.error({ phone, status: response.status, error: errorMsg }, 'Meta Cloud API send failed');
        return { success: false, error: errorMsg, provider: 'meta_cloud_api' };
      }

      const data = await response.json();
      const messageId = data.messages?.[0]?.id;

      return { success: true, messageId, provider: 'meta_cloud_api' };
    } catch (error: any) {
      log.error({ phone, error: error.message }, 'Meta Cloud API send error');
      return { success: false, error: error.message, provider: 'meta_cloud_api' };
    }
  }

  async checkConnection(): Promise<ConnectionStatus> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/${this.apiVersion}/${this.config.phoneNumberId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          connected: false,
          provider: 'meta_cloud_api',
          error: errorData?.error?.message || `HTTP ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        connected: true,
        provider: 'meta_cloud_api',
        state: data.verified_name || 'connected',
      };
    } catch (error: any) {
      return {
        connected: false,
        provider: 'meta_cloud_api',
        error: error.message,
      };
    }
  }

  /**
   * Send a template message (required for starting conversations on official API)
   */
  async sendTemplateMessage(options: {
    phone: string;
    templateName: string;
    languageCode?: string;
    components?: any[];
  }): Promise<SendMessageResult> {
    const phone = this.formatPhone(options.phone);

    try {
      const response = await fetch(
        `https://graph.facebook.com/${this.apiVersion}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone,
            type: 'template',
            template: {
              name: options.templateName,
              language: { code: options.languageCode || 'pt_BR' },
              components: options.components || [],
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData?.error?.message || `HTTP ${response.status}`, provider: 'meta_cloud_api' };
      }

      const data = await response.json();
      return { success: true, messageId: data.messages?.[0]?.id, provider: 'meta_cloud_api' };
    } catch (error: any) {
      return { success: false, error: error.message, provider: 'meta_cloud_api' };
    }
  }
}

// ==========================================
// Factory: get the active provider for a company
// ==========================================

/**
 * Returns the configured WhatsApp provider for a company.
 * Reads whatsapp_provider from clinic_settings to determine which to use.
 *
 * Falls back to: wuzapi → evolution → null
 */
export async function getWhatsAppProvider(companyId: number): Promise<IWhatsAppProvider | null> {
  try {
    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    const providerType = (settings?.whatsappProvider as WhatsAppProviderType) || null;

    // Explicit provider selection
    if (providerType === 'meta_cloud_api') {
      if (settings?.metaPhoneNumberId && settings?.metaAccessToken) {
        return new MetaCloudApiProvider({
          phoneNumberId: settings.metaPhoneNumberId,
          accessToken: settings.metaAccessToken,
          businessAccountId: settings.metaBusinessAccountId || undefined,
        });
      }
      log.warn({ companyId }, 'Meta Cloud API selected but not configured');
      return null;
    }

    if (providerType === 'evolution') {
      const service = await createEvolutionService(companyId);
      if (service) return new EvolutionAdapter(service);
      log.warn({ companyId }, 'Evolution API selected but not configured');
      return null;
    }

    if (providerType === 'wuzapi') {
      const config = await getWhatsAppConfig(null, companyId);
      if (config?.instanceId && config?.apiKey) {
        return new WuzapiAdapter(createWhatsAppService(config));
      }
      log.warn({ companyId }, 'Wuzapi selected but not configured');
      return null;
    }

    // Auto-detect: try wuzapi first, then evolution
    const wuzapiConfig = await getWhatsAppConfig(null, companyId);
    if (wuzapiConfig?.instanceId && wuzapiConfig?.apiKey) {
      return new WuzapiAdapter(createWhatsAppService(wuzapiConfig));
    }

    const evolutionService = await createEvolutionService(companyId);
    if (evolutionService) {
      return new EvolutionAdapter(evolutionService);
    }

    log.warn({ companyId }, 'No WhatsApp provider configured');
    return null;
  } catch (error: any) {
    log.error({ companyId, error: error.message }, 'Failed to get WhatsApp provider');
    return null;
  }
}

/**
 * Get provider info without instantiating the full service.
 * Useful for frontend status display.
 */
export async function getWhatsAppProviderInfo(companyId: number): Promise<{
  activeProvider: WhatsAppProviderType | null;
  configured: {
    wuzapi: boolean;
    evolution: boolean;
    meta_cloud_api: boolean;
  };
}> {
  try {
    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    if (!settings) {
      return {
        activeProvider: null,
        configured: { wuzapi: false, evolution: false, meta_cloud_api: false },
      };
    }

    return {
      activeProvider: (settings.whatsappProvider as WhatsAppProviderType) || null,
      configured: {
        wuzapi: !!(settings.wuzapiInstanceId && settings.wuzapiApiKey),
        evolution: !!(settings.evolutionApiBaseUrl && settings.evolutionInstanceName && settings.evolutionApiKey),
        meta_cloud_api: !!(settings.metaPhoneNumberId && settings.metaAccessToken),
      },
    };
  } catch {
    return {
      activeProvider: null,
      configured: { wuzapi: false, evolution: false, meta_cloud_api: false },
    };
  }
}

// Re-export for convenience
export { MetaCloudApiProvider };
