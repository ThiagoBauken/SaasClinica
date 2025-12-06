/**
 * AI Provider Service
 * Suporta múltiplos backends: Ollama Local (ROCm), OpenAI, Groq
 * Com load balancing para múltiplas GPUs AMD RX 7900 XTX
 */

import { db } from '../db';
import { eq } from 'drizzle-orm';
import { clinicSettings, companies } from '@shared/schema';

// Tipos
export interface AIProvider {
  id: string;
  name: string;
  type: 'ollama' | 'openai' | 'groq' | 'lmstudio';
  baseUrl: string;
  apiKey?: string;
  model: string;
  maxTokens: number;
  temperature: number;
  isHealthy: boolean;
  lastHealthCheck: Date;
  gpuId?: number;
  priority: number; // Menor = maior prioridade
}

export interface AICompletionRequest {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface AICompletionResponse {
  content: string;
  provider: string;
  model: string;
  tokensUsed: number;
  latencyMs: number;
  fromCache?: boolean;
}

// Configuração padrão de providers
const DEFAULT_PROVIDERS: AIProvider[] = [
  {
    id: 'ollama-gpu-0',
    name: 'Ollama Local (GPU 0)',
    type: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'llama3.1:8b', // Roda bem em 24GB VRAM
    maxTokens: 2048,
    temperature: 0.7,
    isHealthy: false,
    lastHealthCheck: new Date(0),
    gpuId: 0,
    priority: 1,
  },
  {
    id: 'openai-fallback',
    name: 'OpenAI (Fallback)',
    type: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',
    maxTokens: 1024,
    temperature: 0.7,
    isHealthy: true,
    lastHealthCheck: new Date(),
    priority: 100, // Fallback
  },
];

// Cache de respostas para reduzir chamadas
const responseCache = new Map<string, { response: string; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

// Estado dos providers
let providers: AIProvider[] = [...DEFAULT_PROVIDERS];
let currentProviderIndex = 0;

// Prompts otimizados para modelos menores
export const DENTAL_SYSTEM_PROMPT = `Você é um assistente virtual de uma clínica odontológica brasileira.

REGRAS IMPORTANTES:
1. Responda APENAS em português brasileiro
2. Seja conciso e direto (máximo 3-4 frases)
3. Use emojis com moderação (1-2 por mensagem)
4. Para agendamentos, pergunte: procedimento → data → horário
5. Para emergências, forneça o telefone imediatamente
6. Se não souber algo, transfira para um humano

VARIÁVEIS DISPONÍVEIS:
- {{company.name}}: Nome da clínica
- {{company.phone}}: Telefone principal
- {{settings.emergencyPhone}}: Telefone de emergência
- {{settings.googleMapsLink}}: Link do Google Maps

CONTEXTO DA CLÍNICA:
{{context}}`;

export const INTENT_CLASSIFICATION_PROMPT = `Classifique a intenção do usuário em UMA das categorias:
- greeting: saudação
- confirm: confirmar consulta
- cancel: cancelar consulta
- reschedule: reagendar
- schedule: agendar nova consulta
- price: perguntar valores
- location: perguntar endereço
- hours: perguntar horário de funcionamento
- emergency: emergência/dor
- thanks: agradecimento
- goodbye: despedida
- talk_to_human: falar com atendente
- unknown: não classificado

Mensagem: "{{message}}"

Responda APENAS com o nome da categoria, nada mais.`;

/**
 * Classe principal do serviço de AI
 */
export class AIProviderService {
  private companyId: number;
  private context: string = '';

  constructor(companyId: number) {
    this.companyId = companyId;
  }

  /**
   * Inicializa o serviço carregando contexto da empresa
   */
  async initialize(): Promise<void> {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, this.companyId))
      .limit(1);

    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, this.companyId))
      .limit(1);

    this.context = `
Clínica: ${company?.name || 'Clínica Dental'}
Telefone: ${company?.phone || ''}
Endereço: ${company?.address || ''}
Emergência: ${settings?.emergencyPhone || company?.phone || ''}
Google Maps: ${settings?.googleMapsLink || ''}
Avaliação: ${settings?.googleReviewLink || ''}
    `.trim();

    // Carregar providers customizados do banco se existirem
    await this.loadProvidersFromSettings(settings);
  }

  /**
   * Carrega configurações de providers do banco
   */
  private async loadProvidersFromSettings(settings: any): Promise<void> {
    if (!settings) return;

    // Adicionar GPUs extras configuradas
    const extraGpus = settings.localAiGpuCount || 1;
    const ollamaBaseUrl = settings.ollamaBaseUrl || 'http://localhost:11434';
    const localModel = settings.localAiModel || 'llama3.1:8b';

    // Limpar providers existentes e recriar
    providers = [];

    // Adicionar providers locais para cada GPU
    for (let i = 0; i < extraGpus; i++) {
      providers.push({
        id: `ollama-gpu-${i}`,
        name: `Ollama Local (GPU ${i})`,
        type: 'ollama',
        baseUrl: ollamaBaseUrl,
        model: localModel,
        maxTokens: 2048,
        temperature: 0.7,
        isHealthy: false,
        lastHealthCheck: new Date(0),
        gpuId: i,
        priority: i + 1,
      });
    }

    // Adicionar Groq se configurado (muito rápido, bom fallback antes do OpenAI)
    if (settings.groqApiKey) {
      providers.push({
        id: 'groq-fallback',
        name: 'Groq (Fast Fallback)',
        type: 'groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey: settings.groqApiKey,
        model: 'llama-3.1-8b-instant',
        maxTokens: 1024,
        temperature: 0.7,
        isHealthy: true,
        lastHealthCheck: new Date(),
        priority: 50,
      });
    }

    // OpenAI como fallback final
    const openaiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;
    if (openaiKey) {
      providers.push({
        id: 'openai-fallback',
        name: 'OpenAI (Fallback)',
        type: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: openaiKey,
        model: settings.openaiModel || 'gpt-4o-mini',
        maxTokens: 1024,
        temperature: 0.7,
        isHealthy: true,
        lastHealthCheck: new Date(),
        priority: 100,
      });
    }

    // Ordenar por prioridade
    providers.sort((a, b) => a.priority - b.priority);

    // Fazer health check dos providers locais
    await this.healthCheckAll();
  }

  /**
   * Verifica saúde de todos os providers
   */
  async healthCheckAll(): Promise<void> {
    const checks = providers.map(async (provider) => {
      try {
        const healthy = await this.healthCheck(provider);
        provider.isHealthy = healthy;
        provider.lastHealthCheck = new Date();
      } catch (error) {
        provider.isHealthy = false;
        provider.lastHealthCheck = new Date();
      }
    });

    await Promise.allSettled(checks);
  }

  /**
   * Health check de um provider específico
   */
  private async healthCheck(provider: AIProvider): Promise<boolean> {
    const timeout = 5000;

    try {
      switch (provider.type) {
        case 'ollama':
          const ollamaResponse = await fetch(`${provider.baseUrl}/api/tags`, {
            signal: AbortSignal.timeout(timeout),
          });
          return ollamaResponse.ok;

        case 'openai':
        case 'groq':
          // Para OpenAI/Groq, assumimos que está saudável se tiver API key
          return !!provider.apiKey;

        case 'lmstudio':
          const lmResponse = await fetch(`${provider.baseUrl}/v1/models`, {
            signal: AbortSignal.timeout(timeout),
          });
          return lmResponse.ok;

        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Seleciona o melhor provider disponível (round-robin com health check)
   */
  private selectProvider(): AIProvider | null {
    const healthyProviders = providers.filter((p) => p.isHealthy);

    if (healthyProviders.length === 0) {
      // Se nenhum está saudável, tentar o OpenAI mesmo assim
      return providers.find((p) => p.type === 'openai') || null;
    }

    // Round-robin entre providers locais saudáveis
    const localProviders = healthyProviders.filter((p) => p.type === 'ollama');

    if (localProviders.length > 0) {
      currentProviderIndex = (currentProviderIndex + 1) % localProviders.length;
      return localProviders[currentProviderIndex];
    }

    // Fallback para primeiro provider saudável (Groq ou OpenAI)
    return healthyProviders[0];
  }

  /**
   * Gera hash para cache
   */
  private getCacheKey(messages: any[]): string {
    const content = messages.map((m) => `${m.role}:${m.content}`).join('|');
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `${this.companyId}-${hash}`;
  }

  /**
   * Verifica cache
   */
  private checkCache(key: string): string | null {
    const cached = responseCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.response;
    }
    responseCache.delete(key);
    return null;
  }

  /**
   * Salva no cache
   */
  private saveCache(key: string, response: string): void {
    responseCache.set(key, { response, timestamp: Date.now() });

    // Limpar cache antigo
    if (responseCache.size > 1000) {
      const now = Date.now();
      for (const [k, v] of responseCache.entries()) {
        if (now - v.timestamp > CACHE_TTL_MS) {
          responseCache.delete(k);
        }
      }
    }
  }

  /**
   * Faz uma completion com fallback automático
   */
  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const startTime = Date.now();

    // Verificar cache
    const cacheKey = this.getCacheKey(request.messages);
    const cached = this.checkCache(cacheKey);
    if (cached) {
      return {
        content: cached,
        provider: 'cache',
        model: 'cache',
        tokensUsed: 0,
        latencyMs: Date.now() - startTime,
        fromCache: true,
      };
    }

    // Tentar cada provider em ordem de prioridade
    const sortedProviders = [...providers].sort((a, b) => a.priority - b.priority);

    for (const provider of sortedProviders) {
      if (!provider.isHealthy && provider.type === 'ollama') {
        continue;
      }

      try {
        const response = await this.callProvider(provider, request);

        // Salvar no cache
        this.saveCache(cacheKey, response.content);

        return {
          ...response,
          latencyMs: Date.now() - startTime,
        };
      } catch (error) {
        console.error(`Provider ${provider.id} falhou:`, error);
        provider.isHealthy = false;
        continue;
      }
    }

    throw new Error('Todos os providers de AI falharam');
  }

  /**
   * Chama um provider específico
   */
  private async callProvider(
    provider: AIProvider,
    request: AICompletionRequest
  ): Promise<AICompletionResponse> {
    switch (provider.type) {
      case 'ollama':
        return this.callOllama(provider, request);

      case 'openai':
      case 'groq':
        return this.callOpenAICompatible(provider, request);

      case 'lmstudio':
        return this.callOpenAICompatible(provider, request);

      default:
        throw new Error(`Provider type ${provider.type} não suportado`);
    }
  }

  /**
   * Chama Ollama (local)
   */
  private async callOllama(
    provider: AIProvider,
    request: AICompletionRequest
  ): Promise<AICompletionResponse> {
    // Injetar contexto no system prompt
    const messages = request.messages.map((m) => {
      if (m.role === 'system') {
        return { ...m, content: m.content.replace('{{context}}', this.context) };
      }
      return m;
    });

    const response = await fetch(`${provider.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: provider.model,
        messages,
        stream: false,
        options: {
          temperature: request.temperature || provider.temperature,
          num_predict: request.maxTokens || provider.maxTokens,
          // Configurações para AMD GPU
          num_gpu: 99, // Usar todas as camadas na GPU
          main_gpu: provider.gpuId || 0,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();

    return {
      content: data.message?.content || '',
      provider: provider.id,
      model: provider.model,
      tokensUsed: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      latencyMs: 0,
    };
  }

  /**
   * Chama APIs compatíveis com OpenAI (OpenAI, Groq, LM Studio)
   */
  private async callOpenAICompatible(
    provider: AIProvider,
    request: AICompletionRequest
  ): Promise<AICompletionResponse> {
    // Injetar contexto no system prompt
    const messages = request.messages.map((m) => {
      if (m.role === 'system') {
        return { ...m, content: m.content.replace('{{context}}', this.context) };
      }
      return m;
    });

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        max_tokens: request.maxTokens || provider.maxTokens,
        temperature: request.temperature || provider.temperature,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      content: data.choices?.[0]?.message?.content || '',
      provider: provider.id,
      model: provider.model,
      tokensUsed: data.usage?.total_tokens || 0,
      latencyMs: 0,
    };
  }

  /**
   * Classifica intent usando AI (para casos que regex não pegou)
   */
  async classifyIntent(message: string): Promise<string> {
    const prompt = INTENT_CLASSIFICATION_PROMPT.replace('{{message}}', message);

    try {
      const response = await this.complete({
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 20,
        temperature: 0.1,
      });

      const intent = response.content.trim().toLowerCase();

      // Validar se é um intent conhecido
      const validIntents = [
        'greeting', 'confirm', 'cancel', 'reschedule', 'schedule',
        'price', 'location', 'hours', 'emergency', 'thanks',
        'goodbye', 'talk_to_human', 'unknown'
      ];

      return validIntents.includes(intent) ? intent : 'unknown';
    } catch (error) {
      console.error('Erro ao classificar intent:', error);
      return 'unknown';
    }
  }

  /**
   * Gera resposta contextualizada
   */
  async generateResponse(
    userMessage: string,
    conversationHistory: { role: 'user' | 'assistant'; content: string }[],
    intent?: string
  ): Promise<AICompletionResponse> {
    const systemPrompt = DENTAL_SYSTEM_PROMPT;

    const messages: AICompletionRequest['messages'] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-6), // Últimas 6 mensagens para contexto
      { role: 'user', content: userMessage },
    ];

    return this.complete({
      messages,
      maxTokens: 256,
      temperature: 0.7,
    });
  }

  /**
   * Retorna status de todos os providers
   */
  getProvidersStatus(): AIProvider[] {
    return providers.map((p) => ({
      ...p,
      apiKey: p.apiKey ? '***' : undefined, // Ocultar chaves
    }));
  }

  /**
   * Adiciona um novo provider (GPU)
   */
  addProvider(provider: Omit<AIProvider, 'isHealthy' | 'lastHealthCheck'>): void {
    providers.push({
      ...provider,
      isHealthy: false,
      lastHealthCheck: new Date(0),
    });
    providers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Remove um provider
   */
  removeProvider(id: string): boolean {
    const index = providers.findIndex((p) => p.id === id);
    if (index !== -1) {
      providers.splice(index, 1);
      return true;
    }
    return false;
  }
}

// Factory
export function createAIProvider(companyId: number): AIProviderService {
  return new AIProviderService(companyId);
}

// Singleton para health checks periódicos
let healthCheckInterval: NodeJS.Timeout | null = null;

export function startHealthCheckLoop(intervalMs: number = 30000): void {
  if (healthCheckInterval) return;

  healthCheckInterval = setInterval(async () => {
    for (const provider of providers) {
      if (provider.type === 'ollama') {
        try {
          const response = await fetch(`${provider.baseUrl}/api/tags`, {
            signal: AbortSignal.timeout(5000),
          });
          provider.isHealthy = response.ok;
        } catch {
          provider.isHealthy = false;
        }
        provider.lastHealthCheck = new Date();
      }
    }
  }, intervalMs);
}

export function stopHealthCheckLoop(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}
