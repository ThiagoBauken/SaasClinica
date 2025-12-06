/**
 * Wuzapi 3.0 Provisioning Service
 *
 * Este servico gerencia o provisionamento automatico de instancias Wuzapi
 * para cada clinica no SaaS.
 *
 * Arquitetura Wuzapi 3.0:
 * 1. WUZAPI_ADMIN_TOKEN no .env - Token master para criar usuarios/instancias
 * 2. POST /admin/users - Cria um novo usuario com name + token unico
 * 3. Cada clinica recebe seu proprio token armazenado no banco
 * 4. Usuario so ve QR Code para conectar
 */

import { db } from '../db';
import { clinicSettings, companies } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

// URL base do Wuzapi (usa URL interna no Easypanel para comunicação entre containers)
const WUZAPI_BASE_URL = process.env.WUZAPI_BASE_URL || 'http://private_wuzapi:8080';
const WUZAPI_ADMIN_TOKEN = process.env.WUZAPI_ADMIN_TOKEN || '';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

interface WuzapiResponse {
  success?: boolean;
  error?: string;
  data?: any;
  code?: number;
}

/**
 * Gera um token unico e seguro para a instancia
 */
function generateInstanceToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

/**
 * Gera um slug amigavel a partir do nome da empresa
 * Ex: "Odonto Sorriso Feliz" -> "odonto-sorriso-feliz"
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]+/g, '-') // Substitui caracteres especiais por hifen
    .replace(/^-+|-+$/g, '') // Remove hifens do inicio/fim
    .substring(0, 25); // Limita tamanho
}

/**
 * Cria uma nova instancia/usuario no Wuzapi via API Admin
 */
async function createWuzapiUser(name: string, token: string, webhookUrl?: string): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!WUZAPI_ADMIN_TOKEN) {
    return { success: false, error: 'WUZAPI_ADMIN_TOKEN nao configurado' };
  }

  try {
    // IMPORTANTE: Wuzapi 3.0 usa campos com PascalCase (Name, Token, etc)
    const body: any = { Name: name, Token: token };
    // Nota: Webhook e Events são configurados depois via /webhook endpoint

    const response = await fetch(`${WUZAPI_BASE_URL}/admin/users`, {
      method: 'POST',
      headers: {
        'Authorization': WUZAPI_ADMIN_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      // Se ja existe, consideramos sucesso
      if (data.error?.includes('already exists') || response.status === 409) {
        return { success: true };
      }
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Cria ou recupera uma instancia Wuzapi para uma empresa
 */
export async function getOrCreateWuzapiInstance(companyId: number): Promise<{
  success: boolean;
  token: string;
  baseUrl: string;
  message: string;
}> {
  // Buscar configuracoes existentes
  const [settings] = await db
    .select()
    .from(clinicSettings)
    .where(eq(clinicSettings.companyId, companyId))
    .limit(1);

  // Se ja tem token configurado e valido, retornar
  if (settings?.wuzapiApiKey && settings.wuzapiApiKey !== WUZAPI_ADMIN_TOKEN) {
    return {
      success: true,
      token: settings.wuzapiApiKey,
      baseUrl: settings.wuzapiBaseUrl || WUZAPI_BASE_URL,
      message: 'Instancia ja configurada',
    };
  }

  // Se nao tem token admin configurado, erro
  if (!WUZAPI_ADMIN_TOKEN) {
    return {
      success: false,
      token: '',
      baseUrl: WUZAPI_BASE_URL,
      message: 'WUZAPI_ADMIN_TOKEN nao configurado no servidor',
    };
  }

  // Buscar dados da empresa
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  // Gerar token unico para esta clinica
  const instanceToken = generateInstanceToken();

  // Gerar nome amigavel: slug do nome da empresa + id para garantir unicidade
  // Ex: "Odonto Sorriso" -> "odonto-sorriso-1"
  const companyName = company?.name || settings?.name || `Clinica ${companyId}`;
  const slug = generateSlug(companyName);
  const instanceName = slug ? `${slug}-${companyId}` : `clinica-${companyId}`;

  const webhookUrl = `${BASE_URL}/api/webhooks/wuzapi/${companyId}`;

  // Criar usuario no Wuzapi
  const createResult = await createWuzapiUser(instanceName, instanceToken, webhookUrl);

  if (!createResult.success) {
    return {
      success: false,
      token: '',
      baseUrl: WUZAPI_BASE_URL,
      message: `Erro ao criar instancia: ${createResult.error}`,
    };
  }

  // Salvar token no banco
  if (settings) {
    await db
      .update(clinicSettings)
      .set({
        wuzapiBaseUrl: WUZAPI_BASE_URL,
        wuzapiApiKey: instanceToken,
        wuzapiWebhookUrl: webhookUrl,
        updatedAt: new Date(),
      })
      .where(eq(clinicSettings.companyId, companyId));
  } else {
    await db.insert(clinicSettings).values({
      companyId,
      name: company?.name || `Clinica ${companyId}`,
      openingTime: '08:00',
      closingTime: '18:00',
      wuzapiBaseUrl: WUZAPI_BASE_URL,
      wuzapiApiKey: instanceToken,
      wuzapiWebhookUrl: webhookUrl,
    });
  }

  return {
    success: true,
    token: instanceToken,
    baseUrl: WUZAPI_BASE_URL,
    message: 'Instancia criada automaticamente',
  };
}

/**
 * Busca o status da conexao WhatsApp de uma empresa
 */
export async function getWuzapiStatus(companyId: number): Promise<{
  configured: boolean;
  connected: boolean;
  loggedIn: boolean;
  phoneNumber?: string;
  pushName?: string;
  error?: string;
}> {
  // Garantir que a instancia existe
  const instance = await getOrCreateWuzapiInstance(companyId);

  if (!instance.success) {
    return {
      configured: false,
      connected: false,
      loggedIn: false,
      error: instance.message,
    };
  }

  try {
    const response = await fetch(`${instance.baseUrl}/session/status`, {
      method: 'GET',
      headers: {
        'Token': instance.token,
      },
    });

    const data = await response.json().catch(() => ({}));

    // Log para debug
    console.log('[Wuzapi Status] Response:', JSON.stringify(data));

    if (!response.ok) {
      return {
        configured: true,
        connected: false,
        loggedIn: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    // Wuzapi pode retornar em formatos diferentes
    // Formato 1: { success: true, data: { Connected: true, LoggedIn: true } }
    // Formato 2: { Connected: true, LoggedIn: true }
    const statusData = data.data || data;

    return {
      configured: true,
      connected: statusData.Connected ?? statusData.connected ?? false,
      loggedIn: statusData.LoggedIn ?? statusData.loggedIn ?? false,
      phoneNumber: statusData.PhoneNumber ?? statusData.phoneNumber,
      pushName: statusData.PushName ?? statusData.pushName,
    };
  } catch (error: any) {
    return {
      configured: true,
      connected: false,
      loggedIn: false,
      error: error.message,
    };
  }
}

/**
 * Obtem QR Code para conectar WhatsApp
 * IMPORTANTE: Primeiro inicia a sessao com /session/connect, depois busca o QR
 */
export async function getWuzapiQrCode(companyId: number): Promise<{
  success: boolean;
  connected?: boolean;
  qrCode?: string;
  message: string;
}> {
  // Garantir que a instancia existe
  const instance = await getOrCreateWuzapiInstance(companyId);

  if (!instance.success) {
    return {
      success: false,
      message: instance.message,
    };
  }

  try {
    // PASSO 1: Iniciar sessao primeiro (obrigatório no Wuzapi 3.0)
    const connectResponse = await fetch(`${instance.baseUrl}/session/connect`, {
      method: 'POST',
      headers: {
        'Token': instance.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Subscribe: ['Message', 'ReadReceipt', 'Presence', 'HistorySync', 'Call'],
        Immediate: true,
      }),
    });

    const connectData = await connectResponse.json().catch(() => ({}));

    // Log para debug
    console.log('[Wuzapi Connect] Response:', JSON.stringify(connectData));

    // Verificar se ja esta logado (pode vir como erro ou como dado)
    // Wuzapi pode retornar de varias formas:
    // 1. { data: { details: "Connected!", jid: "..." } } - Reconexao bem-sucedida
    // 2. { error: "already logged in" } - Ja logado (erro HTTP)
    // 3. { data: { LoggedIn: true } } - Status de logado
    const errorMessage = connectData.error || connectData.message || '';
    const isAlreadyLoggedIn = errorMessage.toLowerCase().includes('already logged in') ||
                              errorMessage.toLowerCase().includes('already connected');

    const isLoggedIn = connectData.data?.LoggedIn ||
                       connectData.data?.jid || // Se tem JID, esta conectado
                       connectData.data?.details === 'Connected!' || // Reconexao bem-sucedida
                       isAlreadyLoggedIn;

    if (isLoggedIn) {
      return {
        success: true,
        connected: true,
        message: 'WhatsApp ja conectado',
      };
    }

    // Se retornou erro HTTP mas nao e "already logged in", verificar se ainda assim esta conectado
    if (!connectResponse.ok && !isAlreadyLoggedIn) {
      // Verificar status real antes de retornar erro
      const statusCheck = await fetch(`${instance.baseUrl}/session/status`, {
        method: 'GET',
        headers: { 'Token': instance.token },
      });
      const statusData = await statusCheck.json().catch(() => ({}));

      if (statusData.data?.LoggedIn || statusData.LoggedIn) {
        return {
          success: true,
          connected: true,
          message: 'WhatsApp ja conectado',
        };
      }
    }

    // Se connect retornou QR Code diretamente
    if (connectData.data?.QRCode) {
      return {
        success: true,
        connected: false,
        qrCode: connectData.data.QRCode,
        message: 'Escaneie o QR Code com seu WhatsApp',
      };
    }

    // PASSO 2: Buscar QR Code separadamente
    const qrResponse = await fetch(`${instance.baseUrl}/session/qr`, {
      method: 'GET',
      headers: {
        'Token': instance.token,
      },
    });

    // Se 404, pode significar que ja esta conectado
    if (qrResponse.status === 404) {
      return {
        success: true,
        connected: true,
        message: 'WhatsApp ja conectado',
      };
    }

    if (!qrResponse.ok) {
      const data = await qrResponse.json().catch(() => ({}));
      return {
        success: false,
        message: data.error || `Erro HTTP ${qrResponse.status}`,
      };
    }

    const qrData: WuzapiResponse = await qrResponse.json();

    if (qrData.success === false) {
      return {
        success: false,
        message: qrData.error || 'Erro ao obter QR Code',
      };
    }

    return {
      success: true,
      connected: false,
      qrCode: qrData.data?.QRCode || qrData.data?.qrcode,
      message: 'Escaneie o QR Code com seu WhatsApp',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Falha ao conectar: ${error.message}`,
    };
  }
}

/**
 * Inicia conexao WhatsApp e configura webhook
 */
export async function connectWuzapi(companyId: number): Promise<{
  success: boolean;
  qrCode?: string;
  connected?: boolean;
  loggedIn?: boolean;
  phoneNumber?: string;
  webhookConfigured?: boolean;
  message: string;
}> {
  // Garantir que a instancia existe
  const instance = await getOrCreateWuzapiInstance(companyId);

  if (!instance.success) {
    return {
      success: false,
      message: instance.message,
    };
  }

  try {
    // Iniciar conexao
    const response = await fetch(`${instance.baseUrl}/session/connect`, {
      method: 'POST',
      headers: {
        'Token': instance.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Subscribe: ['Message', 'ReadReceipt', 'Presence', 'HistorySync', 'Call'],
        Immediate: true,
      }),
    });

    const data: WuzapiResponse = await response.json();

    if (data.success === false || !response.ok) {
      return {
        success: false,
        message: data.error || 'Erro ao iniciar conexao',
      };
    }

    const connected = data.data?.Connected ?? false;
    const loggedIn = data.data?.LoggedIn ?? false;

    // Se conectado, configurar webhook automaticamente
    let webhookConfigured = false;
    if (loggedIn || connected) {
      webhookConfigured = await configureWuzapiWebhook(companyId);
    }

    return {
      success: true,
      qrCode: data.data?.QRCode,
      connected,
      loggedIn,
      phoneNumber: data.data?.PhoneNumber,
      webhookConfigured,
      message: loggedIn ? 'WhatsApp conectado!' : 'Escaneie o QR Code',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Falha ao conectar: ${error.message}`,
    };
  }
}

/**
 * Configura webhook do Wuzapi para receber mensagens
 */
export async function configureWuzapiWebhook(companyId: number): Promise<boolean> {
  const instance = await getOrCreateWuzapiInstance(companyId);

  if (!instance.success) {
    return false;
  }

  const webhookUrl = `${BASE_URL}/api/webhooks/wuzapi/${companyId}`;

  try {
    const response = await fetch(`${instance.baseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Token': instance.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        WebhookURL: webhookUrl,
        Events: ['Message', 'ReadReceipt', 'Presence', 'ChatPresence', 'HistorySync', 'Call'],
      }),
    });

    const data: WuzapiResponse = await response.json();

    if (data.success !== false && response.ok) {
      // Atualizar URL do webhook no banco
      await db
        .update(clinicSettings)
        .set({
          wuzapiWebhookUrl: webhookUrl,
          wuzapiStatus: 'connected',
          updatedAt: new Date(),
        })
        .where(eq(clinicSettings.companyId, companyId));

      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Reconecta WhatsApp sem precisar de QR Code
 * Usa a sessao existente que ja foi autenticada
 */
export async function reconnectWuzapi(companyId: number): Promise<{
  success: boolean;
  connected: boolean;
  loggedIn: boolean;
  message: string;
}> {
  const instance = await getOrCreateWuzapiInstance(companyId);

  if (!instance.success) {
    return {
      success: false,
      connected: false,
      loggedIn: false,
      message: instance.message,
    };
  }

  try {
    console.log('[Wuzapi Reconnect] Tentando reconectar...');

    const response = await fetch(`${instance.baseUrl}/session/connect`, {
      method: 'POST',
      headers: {
        'Token': instance.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Subscribe: ['Message', 'ReadReceipt', 'Presence', 'HistorySync', 'Call'],
        Immediate: true,
      }),
    });

    const data = await response.json().catch(() => ({}));
    console.log('[Wuzapi Reconnect] Response:', JSON.stringify(data));

    // Verificar se conectou com sucesso
    const isConnected = data.data?.jid ||
                        data.data?.details === 'Connected!' ||
                        data.data?.LoggedIn ||
                        data.success === true;

    if (isConnected) {
      // Configurar webhook apos reconexao
      await configureWuzapiWebhook(companyId);

      return {
        success: true,
        connected: true,
        loggedIn: true,
        message: 'WhatsApp reconectado com sucesso!',
      };
    }

    // Se precisa de QR Code, informar
    if (data.data?.QRCode) {
      return {
        success: false,
        connected: false,
        loggedIn: false,
        message: 'Sessao expirada. Necessario escanear QR Code novamente.',
      };
    }

    return {
      success: false,
      connected: false,
      loggedIn: false,
      message: data.error || 'Falha ao reconectar',
    };
  } catch (error: any) {
    console.error('[Wuzapi Reconnect] Error:', error);
    return {
      success: false,
      connected: false,
      loggedIn: false,
      message: error.message,
    };
  }
}

/**
 * Desconecta WhatsApp (mantem sessao)
 */
export async function disconnectWuzapi(companyId: number): Promise<{
  success: boolean;
  message: string;
}> {
  const instance = await getOrCreateWuzapiInstance(companyId);

  if (!instance.success) {
    return {
      success: false,
      message: instance.message,
    };
  }

  try {
    const response = await fetch(`${instance.baseUrl}/session/disconnect`, {
      method: 'POST',
      headers: {
        'Token': instance.token,
      },
    });

    const data: WuzapiResponse = await response.json();

    return {
      success: data.success !== false,
      message: data.success !== false ? 'WhatsApp desconectado' : 'Falha ao desconectar',
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Faz logout do WhatsApp (remove sessao)
 */
export async function logoutWuzapi(companyId: number): Promise<{
  success: boolean;
  message: string;
}> {
  const instance = await getOrCreateWuzapiInstance(companyId);

  if (!instance.success) {
    return {
      success: false,
      message: instance.message,
    };
  }

  try {
    const response = await fetch(`${instance.baseUrl}/session/logout`, {
      method: 'POST',
      headers: {
        'Token': instance.token,
      },
    });

    const data: WuzapiResponse = await response.json();

    if (data.success !== false) {
      // Atualizar status no banco
      await db
        .update(clinicSettings)
        .set({
          wuzapiStatus: 'disconnected',
          wuzapiConnectedPhone: null,
          updatedAt: new Date(),
        })
        .where(eq(clinicSettings.companyId, companyId));
    }

    return {
      success: data.success !== false,
      message: data.success !== false
        ? 'Logout realizado. Sera necessario escanear QR Code novamente.'
        : 'Falha ao fazer logout',
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Lista todas as instancias criadas (admin only)
 */
export async function listWuzapiInstances(): Promise<{
  success: boolean;
  instances?: any[];
  error?: string;
}> {
  if (!WUZAPI_ADMIN_TOKEN) {
    return { success: false, error: 'WUZAPI_ADMIN_TOKEN nao configurado' };
  }

  try {
    const response = await fetch(`${WUZAPI_BASE_URL}/admin/users`, {
      method: 'GET',
      headers: {
        'Authorization': WUZAPI_ADMIN_TOKEN,
      },
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { success: true, instances: data.users || data.data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Envia mensagem de texto via Wuzapi
 */
export async function sendWuzapiTextMessage(
  companyId: number,
  phone: string,
  message: string
): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const instance = await getOrCreateWuzapiInstance(companyId);

  if (!instance.success) {
    return { success: false, error: instance.message };
  }

  try {
    // Formatar telefone (remover caracteres especiais, adicionar 55 se necessario)
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    const response = await fetch(`${instance.baseUrl}/chat/send/text`, {
      method: 'POST',
      headers: {
        'Token': instance.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Phone: formattedPhone,
        Body: message,
      }),
    });

    const data = await response.json().catch(() => ({}));

    console.log('[Wuzapi SendText] Response:', JSON.stringify(data));

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      messageId: data.data?.Id || data.Id || data.messageId,
    };
  } catch (error: any) {
    console.error('[Wuzapi SendText] Error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Remove uma instancia do Wuzapi (admin only)
 * @param instanceId - ID da instancia (hash retornado na criacao)
 */
export async function deleteWuzapiInstance(instanceId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!WUZAPI_ADMIN_TOKEN) {
    return { success: false, error: 'WUZAPI_ADMIN_TOKEN nao configurado' };
  }

  try {
    const response = await fetch(`${WUZAPI_BASE_URL}/admin/users/${instanceId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': WUZAPI_ADMIN_TOKEN,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
