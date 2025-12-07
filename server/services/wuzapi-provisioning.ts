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

// S3/MinIO para armazenamento de mídia do WhatsApp (usa WUZAPI_S3_* prioritariamente)
const S3_ENDPOINT = process.env.WUZAPI_S3_ENDPOINT || process.env.S3_ENDPOINT || '';
const S3_ACCESS_KEY = process.env.WUZAPI_S3_ACCESS_KEY || process.env.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY || '';
const S3_SECRET_KEY = process.env.WUZAPI_S3_SECRET_KEY || process.env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY || '';
const S3_BUCKET = process.env.WUZAPI_S3_BUCKET || process.env.S3_BUCKET || 'whatsapp-media';
const S3_REGION = process.env.WUZAPI_S3_REGION || process.env.S3_REGION || 'us-east-1';
const S3_FORCE_PATH_STYLE = process.env.WUZAPI_S3_FORCE_PATH_STYLE === 'true';

// HMAC para segurança dos webhooks
const WUZAPI_HMAC_KEY = process.env.WUZAPI_GLOBAL_HMAC_KEY || process.env.WUZAPI_WEBHOOK_SECRET || '';

// Todos os eventos disponíveis no Wuzapi
const ALL_WEBHOOK_EVENTS = [
  'Message',
  'ReadReceipt',
  'Presence',
  'ChatPresence',
  'HistorySync',
  'Call',
  'QRCode',
];

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
 * Estratégia: criar primeiro com campos mínimos, depois atualizar com S3/HMAC
 */
async function createWuzapiUser(name: string, token: string, webhookUrl: string): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!WUZAPI_ADMIN_TOKEN) {
    return { success: false, error: 'WUZAPI_ADMIN_TOKEN nao configurado' };
  }

  try {
    // PASSO 1: Criar usuário apenas com campos obrigatórios
    const basicBody = {
      name,
      token,
    };

    const apiUrl = `${WUZAPI_BASE_URL}/admin/users`;
    console.log(`[Wuzapi] PASSO 1: Criando usuario basico: ${name}`);
    console.log(`[Wuzapi] Admin API URL: ${apiUrl}`);
    console.log(`[Wuzapi] Admin Token: ${WUZAPI_ADMIN_TOKEN ? WUZAPI_ADMIN_TOKEN.substring(0, 10) + '...' : 'NAO CONFIGURADO'}`);
    console.log(`[Wuzapi] Request body:`, JSON.stringify(basicBody));

    let response;
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': WUZAPI_ADMIN_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(basicBody),
      });
    } catch (fetchError: any) {
      console.error(`[Wuzapi] ERRO DE REDE ao conectar em ${apiUrl}: ${fetchError.message}`);
      return { success: false, error: `Erro de rede: ${fetchError.message}` };
    }

    console.log(`[Wuzapi] Response status: ${response.status}`);

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      const text = await response.text();
      console.error(`[Wuzapi] Response não é JSON: ${text}`);
      data = { error: text };
    }
    console.log(`[Wuzapi] Response data:`, JSON.stringify(data));

    if (!response.ok) {
      // Se ja existe, consideramos sucesso e atualizamos
      if (data.error?.includes('already exists') || response.status === 409) {
        console.log(`[Wuzapi] Usuario ${name} já existe, atualizando configurações...`);
        await updateWuzapiUserConfig(name, token, webhookUrl);
        return { success: true };
      }
      console.error(`[Wuzapi] ERRO ao criar usuario: ${data.error || `HTTP ${response.status}`}`);
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    console.log(`[Wuzapi] Usuario ${name} criado com sucesso!`);

    // PASSO 2: Adicionar webhook, S3, HMAC via update
    console.log(`[Wuzapi] PASSO 2: Configurando webhook, S3 e HMAC...`);
    await updateWuzapiUserConfig(name, token, webhookUrl);

    return { success: true };
  } catch (error: any) {
    console.error(`[Wuzapi] EXCEPTION ao criar usuario: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Atualiza TODAS as configurações de um usuário existente no Wuzapi via Admin API
 */
async function updateWuzapiUserConfig(name: string, token: string, webhookUrl: string): Promise<void> {
  try {
    // Usar Admin API para atualizar usuário com todas as configurações
    const body: any = {
      webhook: webhookUrl,
      events: ALL_WEBHOOK_EVENTS,
      messagehistory: 1000,
    };

    // Adicionar configuração S3 se disponível
    if (S3_ENDPOINT && S3_ACCESS_KEY && S3_SECRET_KEY) {
      body.s3 = {
        endpoint: S3_ENDPOINT,
        access_key: S3_ACCESS_KEY,
        secret_key: S3_SECRET_KEY,
        bucket: S3_BUCKET,
        region: S3_REGION,
        force_path_style: true,
      };
      console.log(`[Wuzapi] Atualizando S3: ${S3_ENDPOINT}/${S3_BUCKET}`);
    }

    // Adicionar HMAC para segurança do webhook
    if (WUZAPI_HMAC_KEY) {
      body.hmac = WUZAPI_HMAC_KEY;
      console.log('[Wuzapi] Atualizando HMAC para webhook');
    }

    // Buscar o ID do usuário pelo nome
    const listResponse = await fetch(`${WUZAPI_BASE_URL}/admin/users`, {
      method: 'GET',
      headers: {
        'Authorization': WUZAPI_ADMIN_TOKEN,
      },
    });

    if (listResponse.ok) {
      const listData = await listResponse.json();
      const users = listData.users || listData.data || [];
      const user = users.find((u: any) => u.name === name || u.Name === name);

      if (user) {
        const userId = user.id || user.Id;
        console.log(`[Wuzapi] Atualizando usuário ${name} (ID: ${userId})`);

        // PUT para atualizar via Admin API
        const updateResponse = await fetch(`${WUZAPI_BASE_URL}/admin/users/${userId}`, {
          method: 'PUT',
          headers: {
            'Authorization': WUZAPI_ADMIN_TOKEN,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (updateResponse.ok) {
          console.log(`[Wuzapi] Configurações atualizadas via Admin API para ${name}`);
          return;
        } else {
          const errData = await updateResponse.json().catch(() => ({}));
          console.error(`[Wuzapi] Erro Admin API: ${errData.error || updateResponse.status}`);
        }
      }
    }

    // Fallback: Atualizar via endpoints individuais com Token do usuário
    console.log(`[Wuzapi] Fallback: atualizando via endpoints individuais`);

    // Atualizar webhook (PUT para update, POST para criar)
    const webhookResponse = await fetch(`${WUZAPI_BASE_URL}/webhook`, {
      method: 'PUT',
      headers: {
        'Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhook: webhookUrl,
        events: ALL_WEBHOOK_EVENTS,
        Active: true,
      }),
    });
    console.log(`[Wuzapi] Webhook response: ${webhookResponse.status}`);

    // Atualizar S3 se configurado (endpoint correto: /session/s3/config)
    if (S3_ENDPOINT && S3_ACCESS_KEY && S3_SECRET_KEY) {
      const s3Response = await fetch(`${WUZAPI_BASE_URL}/session/s3/config`, {
        method: 'POST',
        headers: {
          'Token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: true,
          endpoint: S3_ENDPOINT,
          region: S3_REGION,
          bucket: S3_BUCKET,
          access_key: S3_ACCESS_KEY,
          secret_key: S3_SECRET_KEY,
          path_style: true,
          media_delivery: 'proxy',
          retention_days: 0,
        }),
      });
      console.log(`[Wuzapi] S3 response: ${s3Response.status}`);
    }

    // Atualizar HMAC se configurado (endpoint correto: /session/hmac/config)
    if (WUZAPI_HMAC_KEY) {
      const hmacResponse = await fetch(`${WUZAPI_BASE_URL}/session/hmac/config`, {
        method: 'POST',
        headers: {
          'Token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hmac_key: WUZAPI_HMAC_KEY,
        }),
      });
      console.log(`[Wuzapi] HMAC response: ${hmacResponse.status}`);
    }

    console.log(`[Wuzapi] Configurações atualizadas para ${name}`);
  } catch (error: any) {
    console.error(`[Wuzapi] Erro ao atualizar configurações: ${error.message}`);
  }
}

/**
 * Verifica se uma instancia existe no Wuzapi testando o token
 */
async function verifyWuzapiInstanceExists(token: string, baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/session/status`, {
      method: 'GET',
      headers: {
        'Token': token,
      },
    });

    // 401/403 = token invalido (instancia nao existe)
    // 404 = endpoint nao encontrado para este usuario
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      console.log(`[Wuzapi] Instancia nao existe mais (HTTP ${response.status})`);
      return false;
    }

    // Qualquer outra resposta indica que a instancia existe
    return true;
  } catch (error: any) {
    console.error(`[Wuzapi] Erro ao verificar instancia: ${error.message}`);
    // Em caso de erro de rede, assumir que existe para nao perder dados
    return true;
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

  // Se ja tem token configurado, verificar se a instancia ainda existe no Wuzapi
  // IMPORTANTE: Sempre usar WUZAPI_BASE_URL da variavel de ambiente (ignora valor do banco)
  if (settings?.wuzapiApiKey && settings.wuzapiApiKey !== WUZAPI_ADMIN_TOKEN) {
    const instanceExists = await verifyWuzapiInstanceExists(settings.wuzapiApiKey, WUZAPI_BASE_URL);

    if (instanceExists) {
      return {
        success: true,
        token: settings.wuzapiApiKey,
        baseUrl: WUZAPI_BASE_URL,
        message: 'Instancia ja configurada',
      };
    }

    // Instancia foi deletada no Wuzapi, limpar token do banco para criar nova
    console.log(`[Wuzapi] Instancia deletada externamente. Limpando token e criando nova...`);
    await db
      .update(clinicSettings)
      .set({
        wuzapiApiKey: null,
        wuzapiStatus: 'disconnected',
        wuzapiConnectedPhone: null,
        updatedAt: new Date(),
      })
      .where(eq(clinicSettings.companyId, companyId));
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
 * Inclui retry automatico quando a instância acabou de ser criada
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

  // Se a instância acabou de ser criada, aguardar um pouco
  const isNewInstance = instance.message === 'Instancia criada automaticamente';
  if (isNewInstance) {
    console.log('[Wuzapi QR] Instancia recem-criada, aguardando 2s para inicializar...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Tentar obter QR Code com retry
  const maxRetries = isNewInstance ? 3 : 1;
  let lastError = '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[Wuzapi QR] Tentativa ${attempt}/${maxRetries}...`);

    try {
      const result = await attemptGetQrCode(instance.baseUrl, instance.token);
      if (result.success && (result.qrCode || result.connected)) {
        return result;
      }
      lastError = result.message;
    } catch (error: any) {
      lastError = error.message;
    }

    // Se não é a última tentativa, aguardar antes de tentar novamente
    if (attempt < maxRetries) {
      console.log(`[Wuzapi QR] QR Code nao encontrado, aguardando 1.5s para retry...`);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  return {
    success: false,
    message: lastError || 'QR Code não disponível. Tente novamente.',
  };
}

/**
 * Tenta obter QR Code uma vez
 */
async function attemptGetQrCode(baseUrl: string, token: string): Promise<{
  success: boolean;
  connected?: boolean;
  qrCode?: string;
  message: string;
}> {
  try {
    // PASSO 1: Iniciar sessao primeiro (obrigatório no Wuzapi 3.0)
    const connectResponse = await fetch(`${baseUrl}/session/connect`, {
      method: 'POST',
      headers: {
        'Token': token,
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

    // IMPORTANTE: Diferenciar connected (websocket) de loggedIn (autenticado no WhatsApp)
    // - connected: true = conectado ao servidor Wuzapi
    // - loggedIn: true = autenticado com QR code no WhatsApp
    // - jid com valor = tem sessão autenticada (ex: "5511999999999:0@s.whatsapp.net")

    const errorMessage = connectData.error || connectData.message || '';
    const isAlreadyLoggedIn = errorMessage.toLowerCase().includes('already logged in');

    // Só considera logado se tiver JID válido (não vazio) OU LoggedIn explícito
    const hasValidJid = connectData.data?.jid && connectData.data.jid.includes('@');
    const isLoggedIn = connectData.data?.LoggedIn === true || hasValidJid || isAlreadyLoggedIn;

    if (isLoggedIn) {
      return {
        success: true,
        connected: true,
        message: 'WhatsApp ja conectado',
      };
    }

    // Se retornou erro (ex: "already connected"), verificar status para pegar QR code
    if (!connectResponse.ok || errorMessage.toLowerCase().includes('already connected')) {
      const statusCheck = await fetch(`${baseUrl}/session/status`, {
        method: 'GET',
        headers: { 'Token': token },
      });
      const statusData = await statusCheck.json().catch(() => ({}));
      console.log('[Wuzapi Status Check] Response:', JSON.stringify(statusData));

      const statusInfo = statusData.data || statusData;

      // Se está logado (autenticado no WhatsApp)
      if (statusInfo?.loggedIn === true || statusInfo?.LoggedIn === true) {
        return {
          success: true,
          connected: true,
          message: 'WhatsApp ja conectado',
        };
      }

      // Se está conectado mas não logado, retornar o QR code do status
      if (statusInfo?.connected === true && statusInfo?.qrcode) {
        return {
          success: true,
          connected: false,
          qrCode: statusInfo.qrcode,
          message: 'Escaneie o QR Code com seu WhatsApp',
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
    const qrResponse = await fetch(`${baseUrl}/session/qr`, {
      method: 'GET',
      headers: {
        'Token': token,
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
        webhook: webhookUrl,
        events: ['Message', 'ReadReceipt', 'Presence', 'ChatPresence', 'HistorySync', 'Call'],
        messagehistory: 1000,
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
 * Configura S3/MinIO para armazenamento de mídia no Wuzapi
 */
export async function configureWuzapiS3(companyId: number): Promise<{ success: boolean; message: string }> {
  const instance = await getOrCreateWuzapiInstance(companyId);

  if (!instance.success) {
    return { success: false, message: instance.message };
  }

  // Verificar se variáveis S3 estão configuradas
  if (!S3_ENDPOINT || !S3_ACCESS_KEY || !S3_SECRET_KEY || !S3_BUCKET) {
    return {
      success: false,
      message: 'Variáveis S3 não configuradas no servidor. Configure S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY e S3_BUCKET.',
    };
  }

  try {
    console.log(`[Wuzapi S3] Configurando S3: ${S3_ENDPOINT}/${S3_BUCKET}`);

    const response = await fetch(`${instance.baseUrl}/session/s3/config`, {
      method: 'POST',
      headers: {
        'Token': instance.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        enabled: true,
        endpoint: S3_ENDPOINT,
        region: S3_REGION,
        bucket: S3_BUCKET,
        access_key: S3_ACCESS_KEY,
        secret_key: S3_SECRET_KEY,
        path_style: true, // Necessário para MinIO
        public_url: `${S3_ENDPOINT}/${S3_BUCKET}`,
        media_delivery: 'proxy', // proxy = seguro, não expõe URLs diretas
        retention_days: 0, // 0 = sem expiração
      }),
    });

    const data = await response.json();
    console.log(`[Wuzapi S3] Response: ${JSON.stringify(data)}`);

    if (data.success !== false && response.ok) {
      return { success: true, message: 'S3 configurado com sucesso!' };
    }

    return { success: false, message: data.error || data.data || `HTTP ${response.status}` };
  } catch (error: any) {
    console.error('[Wuzapi S3] Error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Configura HMAC para segurança dos webhooks
 */
export async function configureWuzapiHmac(companyId: number): Promise<{ success: boolean; message: string }> {
  const instance = await getOrCreateWuzapiInstance(companyId);

  if (!instance.success) {
    return { success: false, message: instance.message };
  }

  if (!WUZAPI_HMAC_KEY || WUZAPI_HMAC_KEY.length < 32) {
    return {
      success: false,
      message: 'WUZAPI_GLOBAL_HMAC_KEY não configurado ou menor que 32 caracteres.',
    };
  }

  try {
    console.log('[Wuzapi HMAC] Configurando HMAC para webhook...');

    const response = await fetch(`${instance.baseUrl}/session/hmac/config`, {
      method: 'POST',
      headers: {
        'Token': instance.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hmac_key: WUZAPI_HMAC_KEY,
      }),
    });

    const data = await response.json();
    console.log(`[Wuzapi HMAC] Response: ${JSON.stringify(data)}`);

    if (data.success !== false && response.ok) {
      return { success: true, message: 'HMAC configurado com sucesso!' };
    }

    return { success: false, message: data.error || data.data || `HTTP ${response.status}` };
  } catch (error: any) {
    console.error('[Wuzapi HMAC] Error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Reconfigura TUDO: Webhook, S3 e HMAC
 * Útil após conectar o WhatsApp ou quando algo não está funcionando
 */
export async function reconfigureWuzapiAll(companyId: number): Promise<{
  success: boolean;
  webhook: { success: boolean; message: string };
  s3: { success: boolean; message: string };
  hmac: { success: boolean; message: string };
}> {
  console.log(`[Wuzapi Reconfigure] Reconfigurando tudo para companyId ${companyId}...`);

  // Configurar Webhook
  const webhookResult = await configureWuzapiWebhook(companyId);
  const webhookStatus = {
    success: webhookResult,
    message: webhookResult ? 'Webhook configurado!' : 'Falha ao configurar webhook',
  };

  // Configurar S3
  const s3Status = await configureWuzapiS3(companyId);

  // Configurar HMAC
  const hmacStatus = await configureWuzapiHmac(companyId);

  const allSuccess = webhookStatus.success && s3Status.success && hmacStatus.success;

  console.log(`[Wuzapi Reconfigure] Resultado: webhook=${webhookStatus.success}, s3=${s3Status.success}, hmac=${hmacStatus.success}`);

  return {
    success: allSuccess,
    webhook: webhookStatus,
    s3: s3Status,
    hmac: hmacStatus,
  };
}

/**
 * Reconecta WhatsApp sem precisar de QR Code
 * Usa a sessao existente que ja foi autenticada
 */
export async function reconnectWuzapi(companyId: number): Promise<{
  success: boolean;
  connected: boolean;
  loggedIn: boolean;
  needsQrCode: boolean;
  message: string;
}> {
  const instance = await getOrCreateWuzapiInstance(companyId);

  if (!instance.success) {
    return {
      success: false,
      connected: false,
      loggedIn: false,
      needsQrCode: false,
      message: instance.message,
    };
  }

  try {
    console.log('[Wuzapi Reconnect] Iniciando sessão...');

    // PASSO 1: Conectar/ativar a sessão
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
    console.log('[Wuzapi Reconnect] Connect response:', JSON.stringify(connectData));

    // "already connected" é OK, significa que a sessão já está ativa
    const isAlreadyConnected = connectData.error === 'already connected' ||
                               connectData.error?.includes('already connected');

    // Se houve erro (exceto "already connected"), retornar erro
    if (!connectResponse.ok && !isAlreadyConnected) {
      return {
        success: false,
        connected: false,
        loggedIn: false,
        needsQrCode: false,
        message: connectData.error || 'Falha ao iniciar sessão',
      };
    }

    // Configurar webhook
    await configureWuzapiWebhook(companyId);

    // PASSO 2: Verificar o STATUS REAL para saber se está logado no WhatsApp
    const statusResponse = await fetch(`${instance.baseUrl}/session/status`, {
      method: 'GET',
      headers: {
        'Token': instance.token,
      },
    });

    const statusData = await statusResponse.json().catch(() => ({}));
    console.log('[Wuzapi Reconnect] Status response:', JSON.stringify(statusData));

    const status = statusData.data || statusData;
    const isLoggedIn = status.LoggedIn ?? status.loggedIn ?? false;
    const isConnected = status.Connected ?? status.connected ?? false;
    const hasQrCode = !!(status.qrcode || status.QRCode);

    // CASO 1: Está LOGADO no WhatsApp (escaneou QR code antes)
    if (isLoggedIn) {
      // AUTO-CONFIGURAR S3, HMAC e Webhook quando logado
      console.log('[Wuzapi Reconnect] Logado! Configurando S3, HMAC e Webhook...');
      const configResult = await reconfigureWuzapiAll(companyId);
      console.log('[Wuzapi Reconnect] Resultado da configuração:', JSON.stringify(configResult));

      return {
        success: true,
        connected: true,
        loggedIn: true,
        needsQrCode: false,
        message: configResult.success
          ? 'WhatsApp conectado! Webhook, S3 e HMAC configurados.'
          : `WhatsApp conectado! Algumas configurações falharam: ${!configResult.webhook.success ? 'Webhook ' : ''}${!configResult.s3.success ? 'S3 ' : ''}${!configResult.hmac.success ? 'HMAC' : ''}`.trim(),
      };
    }

    // CASO 2: Sessão ativa mas NÃO logado - precisa escanear QR code
    if (isConnected && !isLoggedIn) {
      return {
        success: true, // Sessão iniciada com sucesso
        connected: true,
        loggedIn: false,
        needsQrCode: true,
        message: hasQrCode
          ? 'Sessão iniciada. Escaneie o QR Code para conectar o WhatsApp.'
          : 'Sessão iniciada. Aguarde o QR Code aparecer.',
      };
    }

    // CASO 3: Não conectado
    return {
      success: false,
      connected: false,
      loggedIn: false,
      needsQrCode: true,
      message: 'Falha ao conectar. Tente novamente.',
    };
  } catch (error: any) {
    console.error('[Wuzapi Reconnect] Error:', error);
    return {
      success: false,
      connected: false,
      loggedIn: false,
      needsQrCode: false,
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

/**
 * Reseta completamente a instancia Wuzapi de uma empresa
 * - Faz logout no Wuzapi
 * - Tenta deletar a instancia via Admin API
 * - Limpa TODOS os campos do banco de dados
 *
 * Usar quando: usuario deletou a instancia no dashboard do Wuzapi
 * ou quer comecar do zero
 */
export async function resetWuzapiInstance(companyId: number): Promise<{
  success: boolean;
  message: string;
}> {
  console.log(`[Wuzapi Reset] Resetando instancia da empresa ${companyId}...`);

  try {
    // 1. Buscar configuracoes atuais
    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    // 2. Tentar fazer logout se tiver token
    if (settings?.wuzapiApiKey) {
      try {
        console.log('[Wuzapi Reset] Tentando logout...');
        const logoutResponse = await fetch(`${WUZAPI_BASE_URL}/session/logout`, {
          method: 'POST',
          headers: {
            'Token': settings.wuzapiApiKey,
          },
        });
        console.log(`[Wuzapi Reset] Logout response: ${logoutResponse.status}`);
      } catch (e) {
        console.log('[Wuzapi Reset] Logout falhou (instancia pode nao existir mais)');
      }
    }

    // 3. Tentar deletar via Admin API (buscar pelo nome da empresa)
    if (WUZAPI_ADMIN_TOKEN) {
      try {
        console.log('[Wuzapi Reset] Buscando instancia via Admin API...');
        const listResponse = await fetch(`${WUZAPI_BASE_URL}/admin/users`, {
          method: 'GET',
          headers: {
            'Authorization': WUZAPI_ADMIN_TOKEN,
          },
        });

        if (listResponse.ok) {
          const listData = await listResponse.json();
          const users = listData.users || listData.data || [];

          // Buscar pelo nome que contem o companyId
          const user = users.find((u: any) => {
            const name = u.name || u.Name || '';
            return name.endsWith(`-${companyId}`) || name === `clinica-${companyId}`;
          });

          if (user) {
            const userId = user.id || user.Id;
            console.log(`[Wuzapi Reset] Deletando usuario ${user.name} (ID: ${userId})...`);

            // Tentar DELETE /admin/users/{id}/full primeiro (remove tudo)
            let deleteResponse = await fetch(`${WUZAPI_BASE_URL}/admin/users/${userId}/full`, {
              method: 'DELETE',
              headers: {
                'Authorization': WUZAPI_ADMIN_TOKEN,
              },
            });

            // Se nao funcionar, tentar DELETE /admin/users/{id}
            if (!deleteResponse.ok) {
              deleteResponse = await fetch(`${WUZAPI_BASE_URL}/admin/users/${userId}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': WUZAPI_ADMIN_TOKEN,
                },
              });
            }

            console.log(`[Wuzapi Reset] Delete response: ${deleteResponse.status}`);
          } else {
            console.log('[Wuzapi Reset] Instancia nao encontrada na Admin API');
          }
        }
      } catch (e: any) {
        console.log(`[Wuzapi Reset] Erro ao deletar via Admin API: ${e.message}`);
      }
    }

    // 4. SEMPRE limpar o banco de dados (mesmo se falhar no Wuzapi)
    console.log('[Wuzapi Reset] Limpando banco de dados...');
    await db
      .update(clinicSettings)
      .set({
        wuzapiApiKey: null,
        wuzapiBaseUrl: null,
        wuzapiInstanceId: null,
        wuzapiStatus: 'disconnected',
        wuzapiConnectedPhone: null,
        wuzapiWebhookUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(clinicSettings.companyId, companyId));

    console.log('[Wuzapi Reset] Concluido! Banco de dados limpo.');

    return {
      success: true,
      message: 'Instancia resetada. Clique em "Conectar" para criar uma nova instancia.',
    };
  } catch (error: any) {
    console.error('[Wuzapi Reset] Erro:', error);
    return {
      success: false,
      message: `Erro ao resetar: ${error.message}`,
    };
  }
}
