/**
 * Serviço de Integração com Wuzapi (WhatsApp Business API Oficial)
 *
 * Responsável por:
 * - Enviar mensagens via Wuzapi
 * - Verificar status da conexão
 * - Processar webhooks de entrada
 * - Gerenciar templates de mensagem
 */

interface WuzapiConfig {
  instanceId: string;
  apiKey: string;
  baseUrl: string;
}

interface SendMessageParams {
  phone: string; // Número no formato internacional (5577998698925)
  message: string;
  companyId?: number;
}

interface SendMessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class WhatsAppService {
  private config: WuzapiConfig;

  constructor(config: WuzapiConfig) {
    this.config = config;
  }

  /**
   * Envia mensagem de texto via Wuzapi
   */
  async sendMessage(params: SendMessageParams): Promise<SendMessageResponse> {
    const { phone, message } = params;

    try {
      const response = await fetch(
        `${this.config.baseUrl}/send-message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            instance_id: this.config.instanceId,
            phone,
            message,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'Failed to send message',
        };
      }

      return {
        success: true,
        messageId: data.message_id || data.id,
      };
    } catch (error: any) {
      console.error('Wuzapi send message error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verifica status da conexão WhatsApp
   */
  async checkConnection(): Promise<{ connected: boolean; error?: string }> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/instance/status`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
        }
      );

      const data = await response.json();

      return {
        connected: data.status === 'connected' || data.connected === true,
      };
    } catch (error: any) {
      return {
        connected: false,
        error: error.message,
      };
    }
  }

  /**
   * Envia mensagem de confirmação de agendamento
   */
  async sendAppointmentConfirmation(params: {
    phone: string;
    patientName: string;
    professionalName: string;
    datetime: string;
    appointmentId: number;
  }): Promise<SendMessageResponse> {
    const message = this.buildConfirmationMessage(params);

    return this.sendMessage({
      phone: params.phone,
      message,
    });
  }

  /**
   * Envia mensagem de cancelamento
   */
  async sendCancellationNotice(params: {
    phone: string;
    patientName: string;
    datetime: string;
    reason?: string;
  }): Promise<SendMessageResponse> {
    const message = this.buildCancellationMessage(params);

    return this.sendMessage({
      phone: params.phone,
      message,
    });
  }

  /**
   * Envia mensagem de reagendamento
   */
  async sendReschedulingNotice(params: {
    phone: string;
    patientName: string;
    oldDatetime: string;
    newDatetime: string;
  }): Promise<SendMessageResponse> {
    const message = this.buildReschedulingMessage(params);

    return this.sendMessage({
      phone: params.phone,
      message,
    });
  }

  /**
   * Envia mensagem de aniversário
   */
  async sendBirthdayMessage(params: {
    phone: string;
    patientName: string;
    age: number;
  }): Promise<SendMessageResponse> {
    const message = this.buildBirthdayMessage(params);

    return this.sendMessage({
      phone: params.phone,
      message,
    });
  }

  /**
   * Envia solicitação de avaliação
   */
  async sendFeedbackRequest(params: {
    phone: string;
    patientName: string;
    reviewLink?: string;
  }): Promise<SendMessageResponse> {
    const message = this.buildFeedbackMessage(params);

    return this.sendMessage({
      phone: params.phone,
      message,
    });
  }

  // ==============================================
  // TEMPLATES DE MENSAGEM
  // ==============================================

  private buildConfirmationMessage(params: {
    patientName: string;
    professionalName: string;
    datetime: string;
  }): string {
    return `Olá ${params.patientName}! 👋

Confirmamos seu agendamento:

🦷 Profissional: ${params.professionalName}
📅 Data/Hora: ${params.datetime}

Responda *SIM* para confirmar sua presença ou *REAGENDAR* se precisar alterar.

Aguardamos você! 😊`;
  }

  private buildCancellationMessage(params: {
    patientName: string;
    datetime: string;
    reason?: string;
  }): string {
    const reasonText = params.reason ? `\n\nMotivo: ${params.reason}` : '';

    return `Olá ${params.patientName},

Informamos que seu agendamento para ${params.datetime} foi cancelado.${reasonText}

Para reagendar, entre em contato conosco.`;
  }

  private buildReschedulingMessage(params: {
    patientName: string;
    oldDatetime: string;
    newDatetime: string;
  }): string {
    return `Olá ${params.patientName}! 👋

Seu agendamento foi reagendado:

❌ Data anterior: ${params.oldDatetime}
✅ Nova data: ${params.newDatetime}

Qualquer dúvida, estamos à disposição! 😊`;
  }

  private buildBirthdayMessage(params: {
    patientName: string;
    age: number;
  }): string {
    return `🎉 Parabéns, ${params.patientName}! 🎂

A equipe deseja um feliz aniversário de ${params.age} anos!

Que este novo ano seja repleto de sorrisos e saúde! 😁✨`;
  }

  private buildFeedbackMessage(params: {
    patientName: string;
    reviewLink?: string;
  }): string {
    const reviewLinkText = params.reviewLink
      ? `\n\n⭐ Deixe sua avaliação: ${params.reviewLink}`
      : '';

    return `Olá ${params.patientName}! 😊

Esperamos que tenha gostado do atendimento!

Sua opinião é muito importante para nós. ${reviewLinkText}

Obrigado por confiar em nosso trabalho! 🦷`;
  }
}

// ==============================================
// FACTORY para criar instância com config
// ==============================================

/**
 * Cria instância do WhatsAppService a partir das configurações da clínica
 */
export function createWhatsAppService(config: WuzapiConfig): WhatsAppService {
  if (!config.instanceId || !config.apiKey) {
    throw new Error('Wuzapi credentials not configured');
  }

  return new WhatsAppService(config);
}

// ==============================================
// HELPER para obter config do banco
// ==============================================

/**
 * Obtém configuração Wuzapi do banco de dados
 */
export async function getWhatsAppConfig(
  storage: any,
  companyId: number
): Promise<WuzapiConfig | null> {
  // TODO: Implementar quando storage tiver método getClinicSettings
  // const settings = await storage.getClinicSettings(companyId);

  // if (!settings?.wuzapiInstanceId || !settings?.wuzapiApiKey) {
  //   return null;
  // }

  // return {
  //   instanceId: settings.wuzapiInstanceId,
  //   apiKey: settings.wuzapiApiKey,
  //   baseUrl: settings.wuzapiBaseUrl || 'https://wuzapi.cloud/api/v2',
  // };

  // Mock para agora (remover depois):
  return {
    instanceId: process.env.WUZAPI_INSTANCE_ID || '',
    apiKey: process.env.WUZAPI_API_KEY || '',
    baseUrl: process.env.WUZAPI_BASE_URL || 'https://wuzapi.cloud/api/v2',
  };
}
