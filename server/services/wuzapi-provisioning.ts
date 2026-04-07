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

import { logger } from '../logger';
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

// HMAC para segurança dos webhooks (mínimo 32 caracteres)
const WUZAPI_HMAC_KEY = process.env.WUZAPI_HMAC_KEY || process.env.WUZAPI_GLOBAL_HMAC_KEY || process.env.WUZAPI_WEBHOOK_SECRET || '';

// Todos os eventos - usar "All" para receber todos os eventos do Wuzapi
const ALL_WEBHOOK_EVENTS = 'All';

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
 * Cria com TODAS as configurações de uma vez (webhook, S3, HMAC, history)
 * usando os nomes de campos corretos em camelCase
 */
async function createWuzapiUser(name: string, token: string, webhookUrl: string): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!WUZAPI_ADMIN_TOKEN) {
    return { success: false, error: 'WUZAPI_ADMIN_TOKEN nao configurado' };
  }

  try {
    // Montar body completo com TODAS as configurações
    // IMPORTANTE: Usar camelCase conforme esperado pela API Wuzapi
    const fullBody: any = {
      name,
      token,
      webhook: webhookUrl,
      events: ALL_WEBHOOK_EVENTS,
      history: 2000, // Mensagens por chat para histórico
    };

    // Adicionar S3 se configurado (todos os campos em camelCase conforme API Wuzapi)
    if (S3_ENDPOINT && S3_ACCESS_KEY && S3_SECRET_KEY) {
      fullBody.s3Config = {
        enabled: true,
        endpoint: S3_ENDPOINT,
        bucket: S3_BUCKET,
        region: S3_REGION || 'us-east-1',
        accessKey: S3_ACCESS_KEY,
        secretKey: S3_SECRET_KEY,
        pathStyle: true,            // true para MinIO
        publicURL: '',              // URL pública (opcional)
        mediaDelivery: 'both',      // base64, s3, ou both
        retentionDays: 30,          // dias para reter arquivos
      };
      logger.info({ S3_ENDPOINT: S3_ENDPOINT, S3_BUCKET: S3_BUCKET }, '[Wuzapi] S3 configurado: {S3_ENDPOINT}/{S3_BUCKET}')
    }

    // Adicionar HMAC se configurado
    if (WUZAPI_HMAC_KEY && WUZAPI_HMAC_KEY.length >= 32) {
      fullBody.hmacKey = WUZAPI_HMAC_KEY;
      logger.info('[Wuzapi] HMAC configurado');
    }

    const apiUrl = `${WUZAPI_BASE_URL}/admin/users`;
    logger.info({ name: name }, '[Wuzapi] Criando usuario com config completa: {name}')
    logger.info({ apiUrl: apiUrl }, '[Wuzapi] Admin API URL: {apiUrl}')
    logger.info({ data: JSON.stringify({ ...fullBody, s3Config: fullBody.s3Config ? { ...fullBody.s3Config, secret_key: '***' } : undefined, hmacKey: fullBody.hmacKey ? '***' : undefined }) }, '[Wuzapi] Request body:')

    let response;
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': WUZAPI_ADMIN_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fullBody),
      });
    } catch (fetchError: any) {
      logger.error({ apiUrl: apiUrl, fetchError_message: fetchError.message }, '[Wuzapi] ERRO DE REDE ao conectar em {apiUrl}: {fetchError_message}')
      return { success: false, error: `Erro de rede: ${fetchError.message}` };
    }

    logger.info({ response_status: response.status }, '[Wuzapi] Response status: {response_status}')

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      const text = await response.text();
      logger.error({ text: text }, '[Wuzapi] Response não é JSON: {text}')
      data = { error: text };
    }
    logger.info({ data: JSON.stringify(data) }, '[Wuzapi] Response data:')

    if (!response.ok) {
      // Se ja existe, consideramos sucesso e atualizamos
      if (data.error?.includes('already exists') || response.status === 409) {
        logger.info({ name: name }, '[Wuzapi] Usuario {name} já existe, atualizando configurações...')
        await updateWuzapiUserConfig(name, token, webhookUrl);
        return { success: true };
      }
      logger.error({ error: data.error || `HTTP ${response.status}` }, '[Wuzapi] Error creating user');
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    logger.info({ name: name }, '[Wuzapi] Usuario {name} criado com todas as configurações!')
    logger.info({ webhookUrl: webhookUrl }, '[Wuzapi] - Webhook: {webhookUrl}')
    logger.info({ value: fullBody.s3Config ? 'Habilitado' : 'Não configurado' }, '[Wuzapi] - S3: {value}')
    logger.info({ value: fullBody.hmacKey ? 'Habilitado' : 'Não configurado' }, '[Wuzapi] - HMAC: {value}')
    logger.info({ fullBody_history: fullBody.history }, '[Wuzapi] - History: {fullBody_history} mensagens/chat')

    return { success: true };
  } catch (error: any) {
    logger.error({ error_message: error.message }, '[Wuzapi] EXCEPTION ao criar usuario: {error_message}')
    return { success: false, error: error.message };
  }
}

/**
 * Atualiza TODAS as configurações de um usuário existente no Wuzapi
 * Usa Session API (header Token) para S3/HMAC pois Admin PUT não aceita esses campos
 */
async function updateWuzapiUserConfig(name: string, token: string, webhookUrl: string): Promise<void> {
  try {
    logger.info({ name: name }, '[Wuzapi Config] Iniciando configuração para {name}')
    logger.info({ webhookUrl: webhookUrl }, '[Wuzapi Config] Webhook URL: {webhookUrl}')
    logger.info({ s3Endpoint: S3_ENDPOINT || 'NOT SET', s3Bucket: S3_BUCKET || 'NOT SET' }, '[Wuzapi Config] S3 config')
    logger.info({ hmacConfigured: !!WUZAPI_HMAC_KEY }, '[Wuzapi Config] HMAC status')

    // 1. Atualizar webhook/events via Admin API PUT (os únicos campos aceitos)
    logger.info('[Wuzapi Admin] Listando usuários...')
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
        logger.info({ name: name, userId: userId }, '[Wuzapi Admin] Usuário encontrado: {name} (ID: {userId})')

        // Admin PUT só aceita webhook e events (minúsculas!)
        const adminBody = {
          webhook: webhookUrl,
          events: ALL_WEBHOOK_EVENTS,
        };

        const updateResponse = await fetch(`${WUZAPI_BASE_URL}/admin/users/${userId}`, {
          method: 'PUT',
          headers: {
            'Authorization': WUZAPI_ADMIN_TOKEN,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(adminBody),
        });

        const updateData = await updateResponse.json().catch(() => ({}));
        logger.info({ updateResponse_status: updateResponse.status, data: JSON.stringify(updateData) }, '[Wuzapi Admin] PUT webhook/events: {updateResponse_status}')
      }
    }

    // 2. Configurar S3, HMAC e History via Session API (header Token)
    // Esses campos NÃO são aceitos no Admin PUT, precisam da Session API
    logger.info('[Wuzapi Session] Configurando S3/HMAC/History via Session API...')
    logger.info({ token: token.substring(0, 10) + '...' }, '[Wuzapi Session] Token')

    // Atualizar webhook - Wuzapi 3.0 usa POST /session/webhook
    const webhookBody = {
      webhookURL: webhookUrl,
      events: ALL_WEBHOOK_EVENTS,
    };
    logger.info({ data: JSON.stringify(webhookBody) }, '[Wuzapi] Webhook body:')

    const webhookResponse = await fetch(`${WUZAPI_BASE_URL}/session/webhook`, {
      method: 'POST',
      headers: {
        'Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookBody),
    });
    const webhookData = await webhookResponse.json().catch(() => ({}));
    logger.info({ webhookResponse_status: webhookResponse.status, data: JSON.stringify(webhookData) }, '[Wuzapi] Webhook response: {webhookResponse_status}')

    // Se /session/webhook falhar, tentar /webhook (formato antigo)
    if (!webhookResponse.ok) {
      logger.info('[Wuzapi] Tentando endpoint /webhook (formato antigo)...')
      const webhookResponse2 = await fetch(`${WUZAPI_BASE_URL}/webhook`, {
        method: 'POST',
        headers: {
          'Token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhook: webhookUrl,
          events: ALL_WEBHOOK_EVENTS,
        }),
      });
      const webhookData2 = await webhookResponse2.json().catch(() => ({}));
      logger.info({ webhookResponse2_status: webhookResponse2.status, data: JSON.stringify(webhookData2) }, '[Wuzapi] Webhook (antigo) response: {webhookResponse2_status}')
    }

    // Atualizar S3 se configurado - todos os campos conforme API Wuzapi
    if (S3_ENDPOINT && S3_ACCESS_KEY && S3_SECRET_KEY) {
      const s3Body = {
        enabled: true,
        endpoint: S3_ENDPOINT,
        region: S3_REGION || 'us-east-1',
        bucket: S3_BUCKET,
        access_key: S3_ACCESS_KEY,
        secret_key: S3_SECRET_KEY,
        path_style: true,           // true para MinIO
        public_url: '',             // URL pública (opcional)
        media_delivery: 'both',     // base64, s3, ou both
        retention_days: 30,         // dias para reter arquivos
      };
      logger.info('[Wuzapi S3] Configurando via /session/s3/config')
      logger.info({ data: JSON.stringify({ ...s3Body, secret_key: '***' }) }, '[Wuzapi S3] Body:')

      const s3Response = await fetch(`${WUZAPI_BASE_URL}/session/s3/config`, {
        method: 'POST',
        headers: {
          'Token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(s3Body),
      });
      const s3Data = await s3Response.json().catch(() => ({}));
      logger.info({ s3Response_status: s3Response.status, data: JSON.stringify(s3Data) }, '[Wuzapi S3] Response: {s3Response_status}')

      if (s3Response.ok && s3Data.success !== false) {
        logger.info('[Wuzapi S3] S3 configurado com sucesso!')
      } else {
        logger.error({ error: s3Data.data || s3Data.error || 'Unknown error' }, '[Wuzapi S3] Configuration failed')
      }
    } else {
      logger.info({ endpoint: !!S3_ENDPOINT, accessKey: !!S3_ACCESS_KEY, secretKey: !!S3_SECRET_KEY }, '[Wuzapi S3] S3 not configured - missing variables')
    }

    // Atualizar HMAC se configurado
    if (WUZAPI_HMAC_KEY && WUZAPI_HMAC_KEY.length >= 32) {
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
      const hmacData = await hmacResponse.json().catch(() => ({}));
      logger.info({ hmacResponse_status: hmacResponse.status, data: JSON.stringify(hmacData) }, '[Wuzapi HMAC] Response: {hmacResponse_status}')
      if (hmacResponse.ok) {
        logger.info('[Wuzapi HMAC] HMAC configurado com sucesso!')
      }
    }

    // Atualizar History (mensagens por chat)
    const historyResponse = await fetch(`${WUZAPI_BASE_URL}/session/history`, {
      method: 'POST',
      headers: {
        'Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        history: 2000,
      }),
    });
    const historyData = await historyResponse.json().catch(() => ({}));
    logger.info({ historyResponse_status: historyResponse.status, data: JSON.stringify(historyData) }, '[Wuzapi History] Response: {historyResponse_status}')
    if (historyResponse.ok) {
      logger.info('[Wuzapi History] History configurado: 2000 mensagens/chat')
    }

    logger.info({ name: name }, '[Wuzapi] Configurações atualizadas para {name}')
  } catch (error: any) {
    logger.error({ error_message: error.message }, '[Wuzapi] Erro ao atualizar configurações: {error_message}')
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
      logger.info({ response_status: response.status }, '[Wuzapi] Instancia nao existe mais (HTTP {response_status})')
      return false;
    }

    // Qualquer outra resposta indica que a instancia existe
    return true;
  } catch (error: any) {
    logger.error({ error_message: error.message }, '[Wuzapi] Erro ao verificar instancia: {error_message}')
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
      // IMPORTANTE: Sempre forçar reconfiguração de S3/HMAC/Webhook para garantir que estão corretos
      const companyName = settings.name || `Clinica ${companyId}`;
      const slug = generateSlug(companyName);
      const instanceName = slug ? `${slug}-${companyId}` : `clinica-${companyId}`;
      const webhookUrl = `${BASE_URL}/api/webhooks/wuzapi/${companyId}`;

      logger.info('[Wuzapi] Instancia existe, verificando/atualizando configuracoes...')
      await updateWuzapiUserConfig(instanceName, settings.wuzapiApiKey, webhookUrl);

      return {
        success: true,
        token: settings.wuzapiApiKey,
        baseUrl: WUZAPI_BASE_URL,
        message: 'Instancia ja configurada',
      };
    }

    // Instancia foi deletada no Wuzapi, limpar token do banco para criar nova
    logger.info('[Wuzapi] Instancia deletada externamente. Limpando token e criando nova...')
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
    logger.info({ data: JSON.stringify(data) }, '[Wuzapi Status] Response:')

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
    logger.info('[Wuzapi QR] Instancia recem-criada, aguardando 2s para inicializar...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Tentar obter QR Code com retry
  const maxRetries = isNewInstance ? 3 : 1;
  let lastError = '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    logger.info({ attempt: attempt, maxRetries: maxRetries }, '[Wuzapi QR] Tentativa {attempt}/{maxRetries}...')

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
      logger.info('[Wuzapi QR] QR Code nao encontrado, aguardando 1.5s para retry...')
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
    logger.info({ data: JSON.stringify(connectData) }, '[Wuzapi Connect] Response:')

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
      logger.info({ data: JSON.stringify(statusData) }, '[Wuzapi Status Check] Response:')

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
 * Wuzapi 3.0: POST /webhook com { webhookURL, events }
 */
export async function configureWuzapiWebhook(companyId: number): Promise<boolean> {
  const instance = await getOrCreateWuzapiInstance(companyId);

  if (!instance.success) {
    logger.error({ instance_message: instance.message }, '[Wuzapi Webhook] Falha ao obter instância: {instance_message}')
    return false;
  }

  const webhookUrl = `${BASE_URL}/api/webhooks/wuzapi/${companyId}`;

  try {
    logger.info({ webhookUrl: webhookUrl }, '[Wuzapi Webhook] Configurando webhook: {webhookUrl}')
    logger.info({ token: instance.token.substring(0, 10) + '...' }, '[Wuzapi Webhook] Token')

    // Formato Wuzapi 3.0: webhookURL (não webhook)
    const body = {
      webhookURL: webhookUrl,
      events: ALL_WEBHOOK_EVENTS,
    };

    logger.info({ data: JSON.stringify(body) }, '[Wuzapi Webhook] Body:')

    const response = await fetch(`${instance.baseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Token': instance.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    logger.info({ response_status: response.status, data: JSON.stringify(data) }, '[Wuzapi Webhook] Response: {response_status}')

    if (response.ok && data.success !== false) {
      logger.info('[Wuzapi Webhook] Webhook configurado com sucesso!')
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

    // Tentar formato alternativo (webhook ao invés de webhookURL)
    logger.info('[Wuzapi Webhook] Tentando formato alternativo...')
    const response2 = await fetch(`${instance.baseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Token': instance.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhook: webhookUrl,
        events: ALL_WEBHOOK_EVENTS,
      }),
    });

    const data2 = await response2.json().catch(() => ({}));
    logger.info({ response2_status: response2.status, data: JSON.stringify(data2) }, '[Wuzapi Webhook] Response (alt): {response2_status}')

    if (response2.ok && data2.success !== false) {
      logger.info('[Wuzapi Webhook] Webhook configurado (formato alternativo)!')
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

    logger.error('[Wuzapi Webhook] Falha ao configurar webhook')
    return false;
  } catch (error: any) {
    logger.error({ error_message: error.message }, '[Wuzapi Webhook] Erro: {error_message}')
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
    logger.info({ S3_ENDPOINT: S3_ENDPOINT, S3_BUCKET: S3_BUCKET }, '[Wuzapi S3] Configurando S3: {S3_ENDPOINT}/{S3_BUCKET}')

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
    logger.info({ data }, '[Wuzapi S3] Response')

    if (data.success !== false && response.ok) {
      return { success: true, message: 'S3 configurado com sucesso!' };
    }

    return { success: false, message: data.error || data.data || `HTTP ${response.status}` };
  } catch (error: any) {
    logger.error({ err: error }, '[Wuzapi S3] Error:');
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
    logger.info('[Wuzapi HMAC] Configurando HMAC para webhook...');

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
    logger.info({ data }, '[Wuzapi HMAC] Response')

    if (data.success !== false && response.ok) {
      return { success: true, message: 'HMAC configurado com sucesso!' };
    }

    return { success: false, message: data.error || data.data || `HTTP ${response.status}` };
  } catch (error: any) {
    logger.error({ err: error }, '[Wuzapi HMAC] Error:');
    return { success: false, message: error.message };
  }
}

/**
 * Reconfigura TUDO: Webhook, S3, HMAC e MessageHistory
 * Usa Admin API primeiro para configurar tudo de uma vez
 * Útil após conectar o WhatsApp ou quando algo não está funcionando
 */
export async function reconfigureWuzapiAll(companyId: number): Promise<{
  success: boolean;
  webhook: { success: boolean; message: string };
  s3: { success: boolean; message: string };
  hmac: { success: boolean; message: string };
  messageHistory?: { success: boolean; message: string };
}> {
  logger.info({ companyId: companyId }, '[Wuzapi Reconfigure] Reconfigurando tudo para companyId {companyId}...')

  const instance = await getOrCreateWuzapiInstance(companyId);
  if (!instance.success) {
    const errorMsg = { success: false, message: instance.message };
    return { success: false, webhook: errorMsg, s3: errorMsg, hmac: errorMsg };
  }

  // Buscar settings para webhook URL
  const [settings] = await db
    .select()
    .from(clinicSettings)
    .where(eq(clinicSettings.companyId, companyId))
    .limit(1);

  const webhookUrl = settings?.wuzapiWebhookUrl || `${BASE_URL}/api/webhooks/wuzapi/${companyId}`;

  // PASSO 1: Tentar configurar TUDO via Admin API de uma vez
  let adminApiSuccess = false;
  try {
    // Buscar ID da instância
    const listResponse = await fetch(`${WUZAPI_BASE_URL}/admin/users`, {
      method: 'GET',
      headers: { 'Authorization': WUZAPI_ADMIN_TOKEN },
    });

    if (listResponse.ok) {
      const listData = await listResponse.json();
      const users = listData.users || listData.data || [];
      const instanceName = `clinica-odontologica-demo-${companyId}`;
      const user = users.find((u: any) =>
        u.name?.includes(`-${companyId}`) || u.Name?.includes(`-${companyId}`)
      );

      if (user) {
        const userId = user.id || user.Id || user.ID;
        logger.info({ userId: userId }, '[Wuzapi Reconfigure] Encontrado usuário ID: {userId}')

        // Montar body com TODAS as configurações
        const adminBody: any = {
          webhook: webhookUrl,
          events: ALL_WEBHOOK_EVENTS,
          messagehistory: 2000,
        };

        // Adicionar S3 se configurado
        if (S3_ENDPOINT && S3_ACCESS_KEY && S3_SECRET_KEY) {
          adminBody.s3 = {
            endpoint: S3_ENDPOINT,
            access_key: S3_ACCESS_KEY,
            secret_key: S3_SECRET_KEY,
            bucket: S3_BUCKET,
            region: S3_REGION,
            force_path_style: true,
          };
          logger.info({ S3_ENDPOINT: S3_ENDPOINT, S3_BUCKET: S3_BUCKET }, '[Wuzapi Reconfigure] S3: {S3_ENDPOINT}/{S3_BUCKET}')
        }

        // Adicionar HMAC se configurado
        if (WUZAPI_HMAC_KEY) {
          adminBody.hmac = WUZAPI_HMAC_KEY;
          logger.info('[Wuzapi Reconfigure] HMAC configurado');
        }

        logger.info('[Wuzapi Reconfigure] Enviando configuração via Admin API...');
        logger.info({ data: JSON.stringify(adminBody) }, '[Wuzapi Reconfigure] Body:')

        const updateResponse = await fetch(`${WUZAPI_BASE_URL}/admin/users/${userId}`, {
          method: 'PUT',
          headers: {
            'Authorization': WUZAPI_ADMIN_TOKEN,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(adminBody),
        });

        logger.info({ updateResponse_status: updateResponse.status }, '[Wuzapi Reconfigure] Admin API response: {updateResponse_status}')

        if (updateResponse.ok) {
          const updateData = await updateResponse.json();
          logger.info({ data: JSON.stringify(updateData) }, '[Wuzapi Reconfigure] Admin API sucesso:')
          adminApiSuccess = true;
        } else {
          const errData = await updateResponse.json().catch(() => ({}));
          logger.error({ err: JSON.stringify(errData) }, '[Wuzapi Reconfigure] Admin API erro:')
        }
      }
    }
  } catch (error: any) {
    logger.error({ err: error.message }, '[Wuzapi Reconfigure] Erro Admin API:');
  }

  if (adminApiSuccess) {
    return {
      success: true,
      webhook: { success: true, message: 'Configurado via Admin API' },
      s3: { success: true, message: 'Configurado via Admin API' },
      hmac: { success: true, message: 'Configurado via Admin API' },
      messageHistory: { success: true, message: '1000 mensagens por chat' },
    };
  }

  // PASSO 2: Fallback - configurar individualmente
  logger.info('[Wuzapi Reconfigure] Fallback: configurando individualmente...');

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

  logger.info({ webhookStatus_success: webhookStatus.success, s3Status_success: s3Status.success, hmacStatus_success: hmacStatus.success }, '[Wuzapi Reconfigure] Resultado: webhook={webhookStatus_success}, s3={s3Status_success}, hmac={hmacStatus_success}')

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
    logger.info('[Wuzapi Reconnect] Iniciando sessão...');

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
    logger.info({ data: JSON.stringify(connectData) }, '[Wuzapi Reconnect] Connect response:')

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
    logger.info({ data: JSON.stringify(statusData) }, '[Wuzapi Reconnect] Status response:')

    const status = statusData.data || statusData;
    const isLoggedIn = status.LoggedIn ?? status.loggedIn ?? false;
    const isConnected = status.Connected ?? status.connected ?? false;
    const hasQrCode = !!(status.qrcode || status.QRCode);

    // CASO 1: Está LOGADO no WhatsApp (escaneou QR code antes)
    if (isLoggedIn) {
      // AUTO-CONFIGURAR S3, HMAC e Webhook quando logado
      logger.info('[Wuzapi Reconnect] Logado! Configurando S3, HMAC e Webhook...');
      const configResult = await reconfigureWuzapiAll(companyId);
      logger.info({ data: JSON.stringify(configResult) }, '[Wuzapi Reconnect] Resultado da configuração:')

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
    logger.error({ err: error }, '[Wuzapi Reconnect] Error:');
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

    logger.info({ data: JSON.stringify(data) }, '[Wuzapi SendText] Response:')

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
    logger.error({ err: error }, '[Wuzapi SendText] Error:');
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
  logger.info({ companyId: companyId }, '[Wuzapi Reset] Resetando instancia da empresa {companyId}...')

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
        logger.info('[Wuzapi Reset] Tentando logout...');
        const logoutResponse = await fetch(`${WUZAPI_BASE_URL}/session/logout`, {
          method: 'POST',
          headers: {
            'Token': settings.wuzapiApiKey,
          },
        });
        logger.info({ logoutResponse_status: logoutResponse.status }, '[Wuzapi Reset] Logout response: {logoutResponse_status}')
      } catch (e) {
        logger.info('[Wuzapi Reset] Logout falhou (instancia pode nao existir mais)');
      }
    }

    // 3. Tentar deletar via Admin API (buscar pelo nome da empresa)
    if (WUZAPI_ADMIN_TOKEN) {
      try {
        logger.info('[Wuzapi Reset] Buscando instancia via Admin API...');
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
            logger.info({ user_name: user.name, userId: userId }, '[Wuzapi Reset] Deletando usuario {user_name} (ID: {userId})...')

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

            logger.info({ deleteResponse_status: deleteResponse.status }, '[Wuzapi Reset] Delete response: {deleteResponse_status}')
          } else {
            logger.info('[Wuzapi Reset] Instancia nao encontrada na Admin API');
          }
        }
      } catch (e: any) {
        logger.info({ e_message: e.message }, '[Wuzapi Reset] Erro ao deletar via Admin API: {e_message}')
      }
    }

    // 4. SEMPRE limpar o banco de dados (mesmo se falhar no Wuzapi)
    logger.info('[Wuzapi Reset] Limpando banco de dados...');
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

    logger.info('[Wuzapi Reset] Concluido! Banco de dados limpo.');

    return {
      success: true,
      message: 'Instancia resetada. Clique em "Conectar" para criar uma nova instancia.',
    };
  } catch (error: any) {
    logger.error({ err: error }, '[Wuzapi Reset] Erro:');
    return {
      success: false,
      message: `Erro ao resetar: ${error.message}`,
    };
  }
}
