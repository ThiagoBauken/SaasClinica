# Dental Clinic SaaS - Arquitetura Completa

## Visao Geral

Sistema SaaS multi-tenant para clinicas odontologicas com atendimento automatizado por IA, CRM, agendamento, financeiro e integracoes WhatsApp.

```
                         ARQUITETURA GERAL
  ┌──────────────────────────────────────────────────────┐
  │                    FRONTEND (React)                   │
  │  Vite + React 18 + shadcn/ui + TailwindCSS + Wouter │
  │  40+ paginas, dashboard, chat inbox, CRM kanban      │
  └──────────────────────┬───────────────────────────────┘
                         │ API REST + WebSocket
  ┌──────────────────────▼───────────────────────────────┐
  │                   BACKEND (Express)                   │
  │  51 arquivos de rotas, 25 servicos, 7 modulos IA     │
  │  Multi-tenant via companyId, CSRF, LGPD audit logs   │
  └───┬────────┬────────┬────────┬────────┬──────────────┘
      │        │        │        │        │
  ┌───▼──┐ ┌──▼───┐ ┌──▼──┐ ┌──▼───┐ ┌──▼────┐
  │Postgr│ │Redis │ │S3   │ │BullMQ│ │WhatsAp│
  │SQL   │ │Cache │ │MinIO│ │Queue │ │Wuzapi/│
  │94 tab│ │Sessao│ │Files│ │Jobs  │ │Evol/  │
  │Drizzl│ │Conv. │ │     │ │      │ │Meta   │
  └──────┘ └──────┘ └─────┘ └──────┘ └───────┘
```

**Stack:** Express + React (Vite) + PostgreSQL (Drizzle ORM) + Redis + BullMQ
**Auth:** Passport.js (Local + Google OAuth), session-based com Redis store
**Multi-tenant:** Isolamento por companyId em todas as queries
**Pagamentos:** Stripe + MercadoPago + NOWPayments
**IA:** Claude (Anthropic) + OpenAI + Ollama local
**Schema:** 94 tabelas, 3.265 linhas em `shared/schema.ts`

---

## Multi-Tenancy

Cada clinica (company) tem um `companyId` isolado. TODA query no banco filtra por `companyId`.

```
Company 1 (Clinica ABC)     Company 2 (Clinica XYZ)
├── Pacientes (companyId=1)  ├── Pacientes (companyId=2)
├── Agendamentos             ├── Agendamentos
├── Configuracoes            ├── Configuracoes
├── AI Agent (config propria)├── AI Agent (config propria)
├── CRM Pipeline             ├── CRM Pipeline
├── WhatsApp (instancia)     ├── WhatsApp (instancia)
└── Financeiro               └── Financeiro
```

**Isolamento garantido em:**
- Redis keys: `ai:conv:{companyId}:{sessionId}`
- Debounce buffer: `{companyId}:{phone}`
- WebSocket: `broadcastToCompany(companyId, ...)`
- Todas as tools do AI Agent filtram por `ctx.companyId`
- Cache de contexto da clinica: per-companyId

---

## Sistema de IA - 3 Camadas

### Camada 1: AI Agent (Atendimento WhatsApp)

O AI Agent e o cerebro do atendimento automatico. Usa Claude (Anthropic) com tool-use para conversar com pacientes e executar acoes no sistema.

**Localizacao:** `server/services/ai-agent/`

```
  Paciente envia mensagem no WhatsApp
        │
        ▼
  [Wuzapi/Evolution/Meta Webhook]
  POST /api/webhooks/wuzapi/:companyId
        │
        ▼
  [activation-check.ts]
  Verifica: API key? Clinica config? WhatsApp? Profissional?
  Se falta algo → nao processa (silencioso)
        │
        ▼
  [message-handler.ts]
  Debounce 5 segundos (agrupa msgs rapidas)
        │
        ▼
  [index.ts] processMessage()
  ├── Carrega estado da conversa (Redis/DB)
  ├── Carrega contexto da clinica (DB + cache 5min)
  ├── Monta system prompt personalizado
  └── Executa loop agentico ↓

  ┌─────────────────────────────────────┐
  │        LOOP AGENTICO (Claude)       │
  │                                     │
  │  Claude recebe: prompt + tools +    │
  │  historico da conversa              │
  │         │                           │
  │         ▼                           │
  │  Claude decide:                     │
  │  ├── Chamar tool? → executar →      │
  │  │   resultado volta pro Claude →   │
  │  │   loop continua                  │
  │  └── Responder? → texto final      │
  │                                     │
  │  Max 8 rounds de tools por msg      │
  └─────────────────────────────────────┘
        │
        ▼
  [conversation-memory.ts]
  Salva estado: Redis (4h TTL) + DB (permanente)
  Se > 12 msgs: comprime com Haiku
        │
        ▼
  [whatsapp-provider.ts]
  Envia resposta via provider configurado pelo cliente
  (Wuzapi / Evolution API / Meta Cloud API oficial)
```

**18 Ferramentas disponiveis para a IA:**

| Tool | O que faz |
|------|-----------|
| `lookup_patient` | Busca paciente por telefone |
| `get_patient_appointments` | Lista consultas do paciente |
| `check_availability` | Horarios disponiveis |
| `schedule_appointment` | Agenda consulta |
| `confirm_appointment` | Confirma consulta |
| `cancel_appointment` | Cancela consulta |
| `reschedule_appointment` | Reagenda consulta |
| `get_clinic_info` | Info da clinica (endereco, horarios, precos) |
| `move_crm_stage` | Move oportunidade no CRM (silencioso) |
| `transfer_to_human` | Transfere para atendente |
| `save_patient_intake` | Cadastra paciente novo |
| `generate_payment_link` | Gera link de pagamento |
| `list_procedures` | Lista procedimentos/servicos |
| `list_professionals` | Lista dentistas |
| `update_patient_tags` | Atualiza tags do paciente |
| `consultation_completed` | Marca consulta realizada |
| `payment_completed` | Registra pagamento |
| `generate_confirmation_link` | Gera link de confirmacao |

**Memoria da IA (3 camadas):**

```
Camada 1 - Redis (4h TTL)
  Ultimas 12 mensagens verbatim + resumo comprimido
  Key: ai:conv:{companyId}:{sessionId}

Camada 2 - PostgreSQL (permanente)
  Tabela chat_messages: historico completo
  Tabela ai_tool_calls: log de ferramentas usadas

Camada 3 - Patient Record (permanente)
  Tabela patients: dados acumulados (nome, alergias, preferencias)
  Extraidos automaticamente pela IA durante conversas
```

**Modelo de IA:**
- Default: `claude-haiku-4-5` (rapido, barato - ideal para chat)
- Opcao: `claude-sonnet-4-6` (raciocinio complexo)
- Opcao: `claude-opus-4-6` (maximo de inteligencia)
- Fallback: AIProviderService (Ollama local / OpenAI / Groq)

---

### Camada 2: Automation Engine (Automacoes de Agendamento)

Automacoes disparadas por acoes no sistema (criar consulta, cancelar, etc).

**Localizacao:** `server/services/automation-engine.ts`

```
  Acao no sistema (criar/cancelar/reagendar consulta)
        │
        ▼
  [AutomationEngine]
  ├── Envia WhatsApp de confirmacao imediata
  ├── Notifica admins (telefones cadastrados)
  └── Dispara queue triggers ↓

  [Queue Triggers] (server/queue/triggers.ts)
  ├── Agendar lembrete 24h antes (BullMQ delayed job)
  ├── Agendar lembrete 1h antes (BullMQ delayed job)
  └── Enviar recibo de pagamento (email)

  [BullMQ Workers] (server/queue/workers.ts)
  ├── whatsappWorker (3 concurrent) → Envia via WhatsApp
  ├── emailsWorker (5 concurrent) → Envia via email
  ├── automationsWorker → Workflows complexos
  └── reportsWorker → Gera relatorios async
```

---

### Camada 3: Clinical Assistant (IA para Dentistas)

IA para ajudar o dentista durante consultas (transcricao + analise clinica).

**Localizacao:** `server/services/clinical-assistant.ts`

```
  Dentista grava audio da consulta
        │
        ▼
  [OpenAI Whisper] Transcricao de audio
        │
        ▼
  [Claude/OpenAI] Analise clinica
  ├── Achados clinicos
  ├── Sugestoes de tratamento
  ├── Sugestoes de medicacao
  └── Alertas de contraindicacoes
```

---

## CRM - Pipeline de Vendas

**Localizacao:** `server/services/crm-auto-progression.ts`

O CRM funciona como um funil de vendas com progressao automatica pela IA.

```
  ┌─────────────┐    ┌──────────┐    ┌────────────┐    ┌───────────┐    ┌──────────┐
  │  Primeiro    │───>│ Agenda-  │───>│ Confirma-  │───>│ Consulta  │───>│Pagamento │
  │  Contato     │    │ mento    │    │ cao        │    │ Realizada │    │Realizado │
  └─────────────┘    └──────────┘    └────────────┘    └───────────┘    └──────────┘
       ▲                  ▲               ▲                  ▲               ▲
       │                  │               │                  │               │
   WhatsApp          AI agenda       Paciente           Dentista          Sistema
   nova msg          consulta        confirma           completa          registra
```

**Progressao automatica:**
- Nova conversa WhatsApp → `first_contact`
- IA agenda consulta → `scheduling`
- Paciente confirma → `confirmation`
- Dentista marca realizada → `consultation_done`
- Pagamento registrado → `payment_done`

**Regra:** Progressao so vai pra frente, nunca retrocede.

---

## WhatsApp - 3 Providers

O cliente escolhe qual provider usar nas configuracoes.

**Localizacao:** `server/services/whatsapp-provider.ts`

| Provider | Tipo | Custo | Velocidade |
|----------|------|-------|------------|
| **Wuzapi** | Nao-oficial (self-hosted) | Gratis | Rapido |
| **Evolution API** | Nao-oficial (self-hosted) | Gratis | Rapido |
| **Meta Cloud API** | Oficial do WhatsApp | Pago | Mais estavel |

```typescript
// Uso unificado em qualquer parte do sistema:
const provider = await getWhatsAppProvider(companyId);
await provider.sendTextMessage({ phone, message });
```

**Webhook de entrada:** `POST /api/webhooks/wuzapi/:companyId`
- Recebe mensagens, status de leitura, presenca, chamadas
- Salva midia (imagens, audios, videos) no servidor
- Roteia mensagens de texto para o AI Agent

---

## Fluxo Completo: Paciente Agendando Consulta

```
1. Paciente: "Oi, quero agendar uma limpeza pra quinta"
   └── Wuzapi webhook → message-handler (debounce 5s)

2. AI Agent carrega contexto:
   ├── Redis: historico recente
   ├── DB: dados do paciente
   └── DB: config da clinica

3. Claude decide chamar tools:
   ├── lookup_patient(phone) → "Joao Silva, ultima visita 15/03"
   ├── check_availability(quinta) → "14:00, 15:30, 16:00"
   └── move_crm_stage(first_contact) → silencioso

4. Claude gera resposta:
   "Oi Joao! Pra quinta tenho esses horarios pra limpeza:
    - 14:00
    - 15:30
    - 16:00
    Qual prefere?"

5. Paciente: "14:00"

6. Claude chama tools:
   ├── schedule_appointment(quinta, 14:00, limpeza)
   └── move_crm_stage(scheduling) → silencioso

7. AutomationEngine dispara:
   ├── WhatsApp: confirmacao imediata
   ├── Queue: lembrete 24h antes
   └── Queue: lembrete 1h antes

8. Claude responde:
   "Agendado! Quinta, 03/04 as 14h - Limpeza.
    Dr. Carlos vai te atender.
    Responda SIM para confirmar."
```

---

## Estrutura de Arquivos

```
/
├── client/                          # Frontend React
│   └── src/
│       ├── components/              # Componentes reutilizaveis (shadcn/ui)
│       ├── pages/                   # 40+ paginas
│       ├── hooks/                   # Custom hooks (useModules, useAuth, etc)
│       ├── contexts/                # Contexts (Auth, Company, Notifications)
│       ├── layouts/                 # DashboardLayout
│       └── lib/                     # Utilitarios (queryClient, csrf)
│
├── server/                          # Backend Express
│   ├── routes/                      # 51 arquivos de rotas
│   │   ├── appointments.routes.ts   # CRUD agendamentos
│   │   ├── patients.routes.ts       # CRUD pacientes
│   │   ├── chat.routes.ts           # Chat/mensagens
│   │   ├── crm.routes.ts            # CRM pipeline
│   │   ├── webhooks.routes.ts       # Webhooks (Wuzapi, Stripe, etc)
│   │   ├── integrations.routes.ts   # Config integracoes + AI Agent status
│   │   ├── n8n-tools.routes.ts      # Tools N8N (legacy, mantido para compat.)
│   │   └── ...
│   │
│   ├── services/                    # Logica de negocio
│   │   ├── ai-agent/               # *** AI AGENT NATIVO ***
│   │   │   ├── index.ts            # Loop agentico principal
│   │   │   ├── dental-tools.ts     # 18 tool definitions
│   │   │   ├── tool-executor.ts    # Execucao das tools (DB queries)
│   │   │   ├── conversation-memory.ts # Memoria 3 camadas
│   │   │   ├── system-prompt.ts    # Prompt personalizado por clinica
│   │   │   ├── message-handler.ts  # Debounce + envio WhatsApp
│   │   │   └── activation-check.ts # Validacao de pre-requisitos
│   │   │
│   │   ├── automation-engine.ts    # Automacoes de agendamento
│   │   ├── crm-auto-progression.ts # Progressao automatica CRM
│   │   ├── whatsapp-provider.ts    # Abstracoes WhatsApp (3 providers)
│   │   ├── whatsapp.service.ts     # Wuzapi
│   │   ├── evolution-api.service.ts# Evolution API
│   │   ├── clinical-assistant.ts   # IA clinica (transcricao + analise)
│   │   ├── ai-provider.ts         # Multi-provider AI (Ollama/OpenAI/Groq/Claude)
│   │   └── ...
│   │
│   ├── queue/                       # Sistema de filas (BullMQ)
│   │   ├── queues.ts               # Definicao das filas
│   │   ├── workers.ts              # Workers (WhatsApp, email, etc)
│   │   └── triggers.ts             # Triggers de eventos
│   │
│   ├── middleware/                   # Middlewares
│   │   ├── auth.ts                 # authCheck, adminOnly, tenantIsolation
│   │   ├── n8n-auth.ts             # Auth por API key
│   │   └── validation.ts           # Validacao Zod
│   │
│   ├── redis.ts                    # Conexao Redis
│   ├── db.ts                       # Conexao PostgreSQL (Drizzle)
│   └── websocket-redis-adapter.ts  # WebSocket multi-instancia
│
├── shared/
│   └── schema.ts                    # 94 tabelas PostgreSQL (Drizzle ORM)
│
├── migrations/                      # Migrations SQL
│   └── 014_ai_agent_integration.sql # Tabelas do AI Agent
│
└── .env                             # Variaveis de ambiente
```

---

## Configuracao da IA (Pagina do Cliente)

**Rota:** `/configuracoes/ia`

O cliente configura a IA sem codigo, com presets prontos:

| Configuracao | Opcao 1 | Opcao 2 | Opcao 3 | Opcao 4 |
|---|---|---|---|---|
| **Personalidade** | Profissional | Amigavel (Carol) | Descontraido (Bia) | Personalizado |
| **Saudacao** | Por horario | Calorosa | Direta | Personalizada |
| **Boas-vindas** | Menu (1,2,3,4) | Natural | Detalhada | Personalizada |
| **Precos** | Sempre informar | Faixa geral | Nunca por chat | - |
| **Modelo IA** | Haiku (rapido) | Sonnet (equilibrado) | Opus (avancado) | - |

**Ativacao:** A IA so ativa quando TODOS os requisitos sao preenchidos:
1. API key configurada
2. Nome da clinica
3. Telefone
4. Horario de funcionamento
5. WhatsApp conectado
6. Pelo menos 1 dentista cadastrado
7. Chat habilitado

**API:** `GET /api/v1/integrations/ai-agent/status` → retorna checklist com % de completude

---

## Variaveis de Ambiente Necessarias

```env
# Banco de Dados
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Redis
REDIS_URL=redis://localhost:6379

# IA (pelo menos uma)
ANTHROPIC_API_KEY=sk-ant-...      # Claude (principal)
OPENAI_API_KEY=sk-...              # OpenAI (fallback/clinical assistant)

# WhatsApp (pelo menos um)
WUZAPI_BASE_URL=https://...        # Wuzapi
EVOLUTION_API_BASE_URL=https://... # Evolution API

# Pagamentos (opcionais)
STRIPE_SECRET_KEY=sk_...
MERCADOPAGO_ACCESS_TOKEN=...

# Storage
S3_ENDPOINT=https://...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...

# App
APP_URL=https://seu-dominio.com
SESSION_SECRET=...
```

---

## Diagrama de Integracao Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                        PACIENTE                                  │
│              (WhatsApp / Link publico / Site)                    │
└───────┬──────────────────┬────────────────────┬─────────────────┘
        │ WhatsApp          │ Confirmacao         │ Anamnese
        ▼                   ▼                     ▼
┌───────────────┐  ┌────────────────┐   ┌─────────────────┐
│ Wuzapi/Evol/  │  │ Public Confirm │   │ Public Anamnesis│
│ Meta Cloud API│  │ (link token)   │   │ (formulario)    │
└───────┬───────┘  └───────┬────────┘   └────────┬────────┘
        │                   │                      │
        ▼                   ▼                      ▼
┌───────────────────────────────────────────────────────────────┐
│                       BACKEND EXPRESS                          │
│                                                               │
│  ┌─────────┐ ┌──────────┐ ┌──────┐ ┌──────────┐ ┌────────┐ │
│  │AI Agent │ │Automation│ │ CRM  │ │Financial │ │Clinical│ │
│  │(Claude) │ │ Engine   │ │      │ │          │ │Assist. │ │
│  │         │ │          │ │      │ │          │ │(Whisper│ │
│  │18 tools │ │WhatsApp  │ │Kanban│ │Stripe    │ │+Claude)│ │
│  │Memoria  │ │Lembretes │ │Auto  │ │MercadoPag│ │        │ │
│  │Debounce │ │Notif.    │ │Progr.│ │PIX       │ │        │ │
│  └────┬────┘ └────┬─────┘ └──┬───┘ └────┬─────┘ └────┬───┘ │
│       │           │           │           │            │      │
│  ┌────▼───────────▼───────────▼───────────▼────────────▼───┐ │
│  │                    PostgreSQL (94 tabelas)               │ │
│  │              Redis (sessoes, cache, filas)               │ │
│  │              S3/MinIO (arquivos, midias)                 │ │
│  │              BullMQ (jobs assincronos)                   │ │
│  └─────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
        │                   │                      │
        ▼                   ▼                      ▼
┌───────────────┐  ┌────────────────┐   ┌─────────────────┐
│ Google        │  │ Stripe/        │   │ Sentry          │
│ Calendar      │  │ MercadoPago    │   │ (monitoramento) │
└───────────────┘  └────────────────┘   └─────────────────┘
```

---

## Seguranca

- **CSRF:** Double-submit cookie pattern (`_csrf_token` cookie + `x-csrf-token` header)
- **LGPD:** Audit logs automaticos em todas as rotas `/api/v1`
- **Auth:** Passport.js com sessoes Redis, bcrypt para senhas
- **Multi-tenant:** `companyId` obrigatorio em TODAS as queries
- **Rate limiting:** 100 req/min nos endpoints N8N, proteção geral
- **Consentimento:** `whatsappConsent`, `dataProcessingConsent`, `marketingConsent` por paciente

---

*Documentacao gerada em 2026-04-01. Versao 2.0 - Inclui AI Agent nativo (Claude).*
