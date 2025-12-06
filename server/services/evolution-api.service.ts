/**
 * Evolution API Service
 * Serviço para integração com Evolution API (WhatsApp)
 */

import { db } from '../db';
import { clinicSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface EvolutionConfig {
  baseUrl: string;
  instanceName: string;
  apiKey: string;
}

export interface SendMessageOptions {
  phone: string;
  message: string;
  delay?: number;
  linkPreview?: boolean;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  state?: string;
  error?: string;
}

export class EvolutionApiService {
  private config: EvolutionConfig;

  constructor(config: EvolutionConfig) {
    this.config = config;
  }

  /**
   * Formata número de telefone para o padrão do WhatsApp
   */
  private formatPhone(phone: string): string {
    // Remove tudo que não é número
    let cleaned = phone.replace(/\D/g, '');

    // Se não começar com 55, adiciona
    if (!cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }

    return cleaned;
  }

  /**
   * Verifica status da conexão
   */
  async checkConnection(): Promise<ConnectionStatus> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/instance/connectionState/${this.config.instanceName}`,
        {
          method: 'GET',
          headers: {
            'apikey': this.config.apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return { connected: false, error: `HTTP ${response.status}: ${error}` };
      }

      const data = await response.json();
      const isConnected = data.state === 'open' || data.instance?.state === 'open';

      return {
        connected: isConnected,
        state: data.state || data.instance?.state,
      };
    } catch (error: any) {
      return {
        connected: false,
        error: error.message || 'Connection failed',
      };
    }
  }

  /**
   * Envia mensagem de texto
   */
  async sendTextMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    try {
      const phone = this.formatPhone(options.phone);

      const response = await fetch(
        `${this.config.baseUrl}/message/sendText/${this.config.instanceName}`,
        {
          method: 'POST',
          headers: {
            'apikey': this.config.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            number: phone,
            options: {
              delay: options.delay || 1200,
              presence: 'composing',
              linkPreview: options.linkPreview ?? false,
            },
            textMessage: {
              text: options.message,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('[EvolutionAPI] Send failed:', error);
        return { success: false, error: `HTTP ${response.status}: ${error}` };
      }

      const data = await response.json();
      return {
        success: true,
        messageId: data.key?.id || data.messageId,
      };
    } catch (error: any) {
      console.error('[EvolutionAPI] Send error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send message',
      };
    }
  }

  /**
   * Envia lista interativa (para confirmação de consulta)
   */
  async sendListMessage(options: {
    phone: string;
    title: string;
    description: string;
    buttonText: string;
    footerText?: string;
    sections: Array<{
      title: string;
      rows: Array<{
        title: string;
        description: string;
        rowId: string;
      }>;
    }>;
  }): Promise<SendMessageResult> {
    try {
      const phone = this.formatPhone(options.phone);

      const response = await fetch(
        `${this.config.baseUrl}/message/sendList/${this.config.instanceName}`,
        {
          method: 'POST',
          headers: {
            'apikey': this.config.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            number: phone,
            options: {
              delay: 1200,
              presence: 'composing',
            },
            listMessage: {
              title: options.title,
              description: options.description,
              buttonText: options.buttonText,
              footerText: options.footerText || '',
              sections: options.sections,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${error}` };
      }

      const data = await response.json();
      return {
        success: true,
        messageId: data.key?.id || data.messageId,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send list message',
      };
    }
  }
}

/**
 * Factory function para criar serviço a partir das configurações do banco
 */
export async function createEvolutionService(companyId: number): Promise<EvolutionApiService | null> {
  try {
    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    if (!settings?.evolutionApiBaseUrl || !settings?.evolutionInstanceName || !settings?.evolutionApiKey) {
      console.warn(`[EvolutionAPI] Company ${companyId} not configured`);
      return null;
    }

    return new EvolutionApiService({
      baseUrl: settings.evolutionApiBaseUrl,
      instanceName: settings.evolutionInstanceName,
      apiKey: settings.evolutionApiKey,
    });
  } catch (error) {
    console.error('[EvolutionAPI] Failed to create service:', error);
    return null;
  }
}

/**
 * Interpola variáveis em um template de mensagem
 */
export function interpolateMessage(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value || '');
  }

  return result;
}
