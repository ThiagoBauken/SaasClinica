# N8N Multi-Agente SaaS - Clínica Dental

## Visão Geral

Sistema de automação multi-tenant para clínicas dentais via WhatsApp usando N8N e Wuzapi 3.0.

### Arquitetura Híbrida (95% Regex + 5% AI)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WEBHOOK WUZAPI (Entrada)                         │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│               IDENTIFICAR EMPRESA (por Wuzapi Token)                │
│                 GET /api/v1/saas/company-by-wuzapi-token            │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BUSCAR PACIENTE (por telefone)                   │
│                 GET /api/v1/n8n/tools/patient-by-phone              │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│              CLASSIFICADOR REGEX (0 tokens - 95% casos)             │
│    GREETING | SCHEDULE | CONFIRM | CANCEL | EMERGENCY | ORTO | ...  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
     ┌──────────┐    ┌──────────┐    ┌──────────┐
     │ Resposta │    │   API    │    │    AI    │
     │ Template │    │  Tools   │    │ Fallback │
     │ (0 tok)  │    │ (0 tok)  │    │ (tokens) │
     └──────────┘    └──────────┘    └──────────┘
```

## Endpoints N8N Tools API

Base URL: `/api/v1/n8n/tools`

### Autenticação

Todas as requisições precisam de um dos headers:
- `X-API-Key`: SAAS_MASTER_API_KEY (acesso global)
- `X-Wuzapi-Token`: Token do Wuzapi (identifica empresa automaticamente)

---

### 1. Buscar Paciente por Telefone

```http
GET /api/v1/n8n/tools/patient-by-phone?phone={phone}&companyId={id}
```

**Response:**
```json
{
  "success": true,
  "found": true,
  "patient": {
    "id": 123,
    "fullName": "João Silva",
    "phone": "11999999999",
    "isOrthodonticPatient": true,
    "tags": ["ortodontia", "vip"],
    "nextRecurringAppointment": "2024-02-15T10:00:00Z"
  }
}
```

---

### 2. Buscar Agendamentos do Paciente

```http
GET /api/v1/n8n/tools/patient-appointments?phone={phone}&status=upcoming&limit=5
```

**Parâmetros:**
- `patientId` ou `phone`: Identificador do paciente
- `status`: `upcoming`, `past`, ou `all`
- `limit`: Quantidade máxima (default: 5)

---

### 3. Horários Disponíveis

```http
GET /api/v1/n8n/tools/available-slots?companyId={id}&days=3
```

**Parâmetros:**
- `date`: Data inicial (YYYY-MM-DD, default: hoje)
- `professionalId`: Filtrar por profissional
- `days`: Quantidade de dias (default: 1)

**Response:**
```json
{
  "success": true,
  "slotDurationMinutes": 30,
  "days": [
    {
      "date": "2024-02-10",
      "dateFormatted": "sábado, 10/02",
      "slots": ["08:00", "08:30", "09:00", "10:30"],
      "count": 4
    }
  ]
}
```

---

### 4. Criar Agendamento

```http
POST /api/v1/n8n/tools/create-appointment
```

**Body:**
```json
{
  "companyId": 1,
  "patientPhone": "11999999999",
  "date": "2024-02-15",
  "time": "10:00",
  "title": "Consulta",
  "isOrthodonticMaintenance": false
}
```

---

### 5. Confirmar Agendamento

```http
POST /api/v1/n8n/tools/confirm-appointment
```

**Body:**
```json
{
  "appointmentId": 123,
  "patientResponse": "sim, confirmado",
  "confirmationMethod": "whatsapp"
}
```

---

### 6. Cancelar Agendamento

```http
POST /api/v1/n8n/tools/cancel-appointment
```

**Body:**
```json
{
  "appointmentId": 123,
  "reason": "Paciente solicitou",
  "requestReschedule": true
}
```

---

### 7. Buscar Procedimentos

```http
GET /api/v1/n8n/tools/procedures?companyId={id}&category=ortodontia
```

---

### 8. Buscar Profissionais

```http
GET /api/v1/n8n/tools/professionals?companyId={id}&speciality=ortodontia
```

---

### 9. Configuração da Clínica

```http
GET /api/v1/n8n/tools/clinic-config?companyId={id}
```

**Response:**
```json
{
  "success": true,
  "config": {
    "name": "Clínica Sorriso",
    "phone": "(11) 3456-7890",
    "address": "Rua...",
    "slotDurationMinutes": 30,
    "workingHours": "08:00 - 18:00"
  }
}
```

---

### 10. Pacientes Ortodônticos

```http
GET /api/v1/n8n/tools/orthodontic-patients?companyId={id}&daysAhead=7
```

Retorna pacientes de ortodontia que precisam de reagendamento.

---

### 11. Atualizar Tags do Paciente

```http
PATCH /api/v1/n8n/tools/patient-tags
```

**Body:**
```json
{
  "patientPhone": "11999999999",
  "addTags": ["vip"],
  "removeTags": ["promocao"],
  "isOrthodonticPatient": true
}
```

---

### 12. Human Takeover

```http
POST /api/v1/n8n/tools/human-takeover
```

**Body:**
```json
{
  "companyId": 1,
  "phone": "11999999999",
  "patientName": "João",
  "reason": "Reclamação",
  "priority": "high"
}
```

---

### 13. Reagendar Ortodontia

```http
POST /api/v1/n8n/tools/reschedule-orthodontic
```

**Body:**
```json
{
  "patientPhone": "11999999999",
  "preferredDate": "2024-02-20",
  "preferredTime": "10:00"
}
```

---

### 14. Configuração de Estilo de Conversa

```http
GET /api/v1/n8n/tools/conversation-style?companyId={id}
```

**Response:**
```json
{
  "success": true,
  "styleConfig": {
    "conversationStyle": "humanized",
    "botPersonality": "friendly",
    "botName": "Clara",
    "useEmojis": true,
    "greetingStyle": "time_based",
    "companyName": "Clínica Sorriso"
  },
  "currentGreeting": "Boa tarde! 🌤️"
}
```

---

### 15. Gerar Resposta Formatada

```http
POST /api/v1/n8n/tools/generate-response
```

**Body:**
```json
{
  "companyId": 1,
  "intent": "GREETING",
  "context": {
    "patientName": "João",
    "patientFound": true,
    "isOrthodontic": false
  }
}
```

**Intents disponíveis:**
- `GREETING` - Saudação inicial
- `SCHEDULE` - Mostrar horários (requer `data.slots`)
- `APPOINTMENT_CREATED` - Agendamento criado (requer `data.appointment`)
- `CONFIRMED` - Agendamento confirmado
- `GOODBYE` - Despedida
- `EMERGENCY` - Emergência
- `FALLBACK` - Não entendeu
- `AI_PROMPT` - Gerar prompt para AI (requer `data.message`)

---

### 16. Classificar Intent (Regex)

```http
POST /api/v1/n8n/tools/classify-intent
```

**Body:**
```json
{
  "message": "quero marcar uma consulta",
  "currentAwaitingResponse": null
}
```

**Response:**
```json
{
  "success": true,
  "intent": "SCHEDULE",
  "confidence": 0.60,
  "matchedPattern": "agend(ar|o|a|amento)|marc(ar|o|a)...",
  "originalMessage": "quero marcar uma consulta",
  "requiresAI": false
}
```

---

## Estilos de Conversa

A clínica pode escolher entre dois estilos de atendimento:

### Estilo MENU (Formal com Opções Numeradas)

Ideal para clínicas que preferem um atendimento mais estruturado.

```
Paciente: oi

Bot: Bom dia, João! 👋

Seja bem-vindo(a) à *Clínica Sorriso*!

Como posso ajudar?

1️⃣ Agendar consulta
2️⃣ Ver meus agendamentos
3️⃣ Informações
4️⃣ Falar com atendente
```

### Estilo HUMANIZADO (Conversa Natural)

Ideal para clínicas que preferem um atendimento mais pessoal.

```
Paciente: oi

Bot: Boa tarde, João! Tudo bem?
Aqui é a Clara, da Clínica Sorriso.
Em que posso te ajudar?
```

### Personalidades do Bot

| Personalidade | Exemplo de Resposta |
|---------------|---------------------|
| `professional` | "Em que posso ajudá-lo(a) hoje?" |
| `friendly` | "Em que posso te ajudar?" |
| `casual` | "Como posso te ajudar?" |

### Comparação de Respostas por Estilo

| Situação | Menu | Humanizado (Friendly) |
|----------|------|----------------------|
| Saudação | "Bom dia! 👋 Seja bem-vindo..." | "Bom dia, João! Tudo bem? Sou a Clara..." |
| Horários | "📅 Horários disponíveis: 1. 08:00..." | "Vou verificar os horários pra você! Temos na segunda às 08:00 ou 10:00..." |
| Confirmação | "✅ Agendamento realizado! 1️⃣ Sim, confirmar" | "Maravilha, João! 🎉 Agendei pra segunda às 10:00. Tá confirmado?" |
| Despedida | "Até logo! 👋 Foi um prazer atendê-lo(a)!" | "Tchau, João! 😊 Foi ótimo falar com você!" |

---

## Processamento Inteligente (Smart Process)

### Conceito

O sistema usa processamento inteligente com:

1. **Debounce de 5 segundos** - Espera 5s após receber "oi" para ver se vem mais contexto
2. **Menu só na primeira saudação** - Não fica repetindo opções a cada mensagem
3. **Entende texto livre** - Não precisa de números, entende linguagem natural

### Fluxo no N8N

```
┌──────────────────────────────────────────────────────────────┐
│                 WEBHOOK RECEBE MENSAGEM                       │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│         POST /smart-process (primeira chamada)               │
│    - Adiciona mensagem ao buffer                             │
│    - Se é EMERGÊNCIA/CONFIRMAR → processa imediatamente      │
│    - Se é "oi"/saudação → retorna { processed: false }       │
└───────────────────────────┬──────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
    processed: true               processed: false
              │                           │
              ▼                           ▼
┌─────────────────────┐     ┌─────────────────────────────────┐
│  Enviar resposta    │     │     WAIT 5 segundos (N8N)       │
│  imediatamente      │     └───────────────┬─────────────────┘
└─────────────────────┘                     │
                                            ▼
                          ┌─────────────────────────────────────┐
                          │  Enquanto espera, chegou mais msg?  │
                          │  → POST /smart-add-message          │
                          └───────────────┬─────────────────────┘
                                          │
                                          ▼
                          ┌─────────────────────────────────────┐
                          │  POST /smart-process-complete       │
                          │  - Combina todas as mensagens       │
                          │  - Classifica intent combinado      │
                          │  - Gera resposta                    │
                          └─────────────────────────────────────┘
```

### Exemplo Prático

**Cenário 1: Usuário manda só "oi"**
```
00:00 - Usuário: "oi"
00:00 - Sistema: Adiciona ao buffer, retorna processed: false
00:05 - N8N: Espera 5 segundos
00:05 - N8N: Chama /smart-process-complete
00:05 - Sistema: Menu de boas-vindas (porque é primeira mensagem)
```

**Cenário 2: Usuário manda "oi" e depois "quero marcar consulta"**
```
00:00 - Usuário: "oi"
00:00 - Sistema: Adiciona ao buffer, retorna processed: false
00:02 - Usuário: "quero marcar uma consulta"
00:02 - N8N: Chama /smart-add-message
00:05 - N8N: Chama /smart-process-complete
00:05 - Sistema: Combina "oi quero marcar uma consulta"
00:05 - Sistema: Intent = SCHEDULE (não mostra menu!)
00:05 - Sistema: "Vou verificar os horários disponíveis..."
```

**Cenário 3: Emergência (sem espera)**
```
00:00 - Usuário: "estou com muita dor"
00:00 - Sistema: Intent = EMERGENCY → processa imediatamente
00:00 - Sistema: Resposta de emergência
```

### Endpoints Smart Process

#### POST /smart-process
Primeira chamada - decide se espera ou processa imediato.

```json
{
  "companyId": 1,
  "phone": "11999999999",
  "message": "oi",
  "isFirstMessage": true,
  "patientName": "João",
  "patientFound": true
}
```

**Response (precisa esperar):**
```json
{
  "success": true,
  "processed": false,
  "waitMs": 5000,
  "hint": "Chame POST /smart-process-complete após 5000ms"
}
```

**Response (processado imediato):**
```json
{
  "success": true,
  "processed": true,
  "waited": false,
  "intent": "EMERGENCY",
  "response": "🚨 Olá, entendo que é urgente!..."
}
```

#### POST /smart-add-message
Adiciona mensagem ao buffer enquanto timer roda.

```json
{
  "companyId": 1,
  "phone": "11999999999",
  "message": "quero marcar consulta"
}
```

#### POST /smart-process-complete
Processa todas as mensagens acumuladas após o delay.

```json
{
  "companyId": 1,
  "phone": "11999999999",
  "patientName": "João",
  "patientFound": true
}
```

**Response:**
```json
{
  "success": true,
  "processed": true,
  "waited": true,
  "messageCount": 2,
  "combinedText": "oi quero marcar consulta",
  "intent": "SCHEDULE",
  "shouldShowMenu": false,
  "response": "Vou verificar os horários disponíveis para você, João!"
}
```

---

## Regras de Comportamento

### Quando Mostrar Menu

| Situação | Mostra Menu? |
|----------|--------------|
| Primeira mensagem da sessão + intent GREETING | ✅ Sim |
| Segunda mensagem em diante | ❌ Não |
| Qualquer intent específico (SCHEDULE, CANCEL...) | ❌ Não |
| FALLBACK (não entendeu) | ✅ Sim (ajuda) |

### Mensagens que NÃO esperam 5s

Processadas imediatamente:
- EMERGENCY (urgente, dor forte, sangramento...)
- HUMAN_TAKEOVER (falar com atendente)
- COMPLAINT (reclamação)
- CONFIRM (sim, ok, confirmo)
- DENY (não, cancela)
- CANCEL (cancelar, desmarcar)
- Quando há `awaitingResponse` (esperando resposta específica)

---

## Classificador Regex (Intents)

| Intent | Padrões | Ação |
|--------|---------|------|
| `GREETING` | oi, olá, bom dia... | Template de boas-vindas |
| `SCHEDULE` | agendar, marcar, horários... | Buscar slots disponíveis |
| `CONFIRM` | sim, confirmo, ok... | Confirmar agendamento |
| `CANCEL` | cancelar, desmarcar... | Cancelar agendamento |
| `RESCHEDULE` | reagendar, remarcar... | Buscar novos slots |
| `ORTHODONTIC` | orto, aparelho, manutenção... | Fluxo ortodontia |
| `INFO_HOURS` | horário funcionamento... | Template horários |
| `INFO_ADDRESS` | endereço, onde fica... | Template endereço |
| `INFO_PRICE` | preço, quanto custa... | Template preços |
| `INFO_PROCEDURES` | procedimentos, tratamentos... | Listar procedures |
| `EMERGENCY` | urgente, dor forte... | Human takeover urgente |
| `FEEDBACK_POSITIVE` | obrigado, excelente... | Pedir avaliação Google |
| `FEEDBACK_NEGATIVE` | reclamação, problema... | Human takeover |
| `HUMAN_TAKEOVER` | falar atendente... | Human takeover |
| `GOODBYE` | tchau, até mais... | Template despedida |
| `UNKNOWN` | outros | AI Fallback |

---

## Variáveis de Ambiente

```env
# API Base URL
API_BASE_URL=https://seu-dominio.com

# Master API Key para N8N
SAAS_MASTER_API_KEY=sua-chave-secreta-aqui

# OpenAI (para fallback AI)
OPENAI_API_KEY=sk-...
```

---

## Como Usar

### 1. Importar o Workflow

1. Abrir N8N
2. Importar `SAAS_WUZAPI_MULTIAGENTE_COMPLETO.json`
3. Configurar credenciais OpenAI (para fallback)
4. Configurar variáveis de ambiente

### 2. Configurar Webhook Wuzapi

No painel Wuzapi, configurar webhook:
- URL: `https://seu-n8n.com/webhook/wuzapi-webhook-saas`
- Events: `message`

### 3. Cadastrar Empresa

Cada clínica precisa ter:
- Registro na tabela `companies`
- Configuração na tabela `clinic_settings` com `wuzapi_api_key`

---

## Fluxo de Ortodontia

### Campos no Schema (patients)

```typescript
tags: string[]                    // ["ortodontia", "vip"]
isOrthodonticPatient: boolean     // Atalho para filtrar
orthodonticStartDate: timestamp   // Início do tratamento
orthodonticExpectedEndDate: timestamp  // Previsão término
nextRecurringAppointment: timestamp    // Próxima manutenção
recurringIntervalDays: integer    // 30 = mensal
preferredDayOfWeek: integer       // 0-6 (domingo-sábado)
preferredTimeSlot: string         // "morning", "afternoon"
```

### Campos no Schema (procedures)

```typescript
category: string                  // "ortodontia", "prevencao"...
isRecurring: boolean              // Procedimento recorrente?
defaultRecurrenceIntervalDays: integer  // 30 = mensal
autoScheduleNext: boolean         // Agendar próxima automaticamente?
```

---

## Custo de Tokens

| Cenário | Tokens/msg | Custo (GPT-4o-mini) |
|---------|------------|---------------------|
| Regex match | 0 | $0.00 |
| API Tool | 0 | $0.00 |
| AI Fallback | ~300-500 | ~$0.0003 |

**Estimativa mensal (10.000 mensagens):**
- 95% Regex: $0.00
- 5% AI: 500 x 400 tokens = ~$0.10

---

---

## Endpoint: Contexto Completo da Clínica (NOVO)

### GET /api/v1/n8n/tools/clinic-context

Retorna TODAS as configurações da clínica em uma única chamada, incluindo:
- Informações básicas
- Estilo de conversa
- Regras de negócio
- Procedimentos e profissionais
- Prompt pronto para IA

**Use Case:** Chamar uma vez no início do fluxo N8N e armazenar em variável.

**Response:**
```json
{
  "success": true,
  "context": {
    "basicInfo": {
      "companyId": 1,
      "name": "Clínica Sorriso",
      "phone": "11999999999",
      "address": "Rua A, 123 - Centro, São Paulo - SP"
    },
    "conversationStyle": {
      "style": "humanized",
      "personality": "friendly",
      "botName": "Clara",
      "useEmojis": true
    },
    "businessRules": {
      "priceDisclosurePolicy": "never_chat",
      "schedulingPolicy": "immediate",
      "paymentMethods": ["pix", "credit_card"]
    },
    "clinicStructure": {
      "clinicType": "clinica_media",
      "totalProfessionals": 3,
      "totalRooms": 2
    },
    "scheduling": {
      "procedures": [...],
      "professionals": [...],
      "rooms": [...]
    }
  },
  "aiContextPrompt": "Você é Clara, assistente virtual da clínica Clínica Sorriso..."
}
```

---

## Regras de Negócio do Bot

### Política de Divulgação de Preços

Configurável em **Configurações > Chat > Estilo do Bot > Regras de Negócio**

| Política | Comportamento | Exemplo de Resposta |
|----------|---------------|---------------------|
| `always` | Informa preços completos | "O clareamento custa R$ 600,00..." |
| `never_chat` | Só presencialmente | "Nossos valores são apresentados na clínica. Quer agendar uma avaliação?" |
| `only_general` | Faixas de valores | "O clareamento fica entre R$ 500-800, mas o valor exato só presencialmente." |

### Tipos de Clínica

| Tipo | Descrição | Salas | Dentistas |
|------|-----------|-------|-----------|
| `consultorio_individual` | Consultório com 1 dentista | 1 | 1 |
| `clinica_pequena` | Clínica pequena | 1-2 | 1-2 |
| `clinica_media` | Clínica média | 3-5 | 3-5 |
| `clinica_grande` | Clínica grande | 5+ | 5+ |
| `franquia` | Rede de clínicas | Múltiplas unidades | Múltiplos |

---

## Configuração do Estilo do Bot (Site)

Na página **Configurações > Chat > Aba "Estilo do Bot"**:

### Opções de Configuração

1. **Tipo de Conversa**
   - Menu com Opções (1️⃣ 2️⃣ 3️⃣) - Estruturado
   - Humanizado - Conversa natural

2. **Personalidade**
   - Profissional - Tom formal
   - Amigável - Tom simpático
   - Casual - Tom descontraído

3. **Nome do Bot**
   - Ex: "Clara", "Carol", "Atendente"

4. **Emojis**
   - Ligado/Desligado

5. **Saudações Personalizadas**
   - Por horário (manhã/tarde/noite)
   - Ou simples (só "Olá")

6. **Contexto para IA**
   - Campo livre para adicionar informações que a IA deve saber

---

## Lista de Endpoints (22 total)

| # | Endpoint | Método | Descrição | Usado no Workflow V3 |
|---|----------|--------|-----------|---------------------|
| 1 | /patient-by-phone | GET | Buscar paciente por telefone | ✅ |
| 2 | /patient-appointments | GET | Agendamentos do paciente | ✅ |
| 3 | /available-slots | GET | Horários disponíveis | ✅ |
| 4 | /create-appointment | POST | Criar agendamento | ✅ |
| 5 | /confirm-appointment | POST | Confirmar agendamento | ✅ |
| 6 | /cancel-appointment | POST | Cancelar agendamento | ✅ |
| 7 | /procedures | GET | Listar procedimentos | ✅ |
| 8 | /professionals | GET | Listar profissionais | ⚙️ (via clinic-context) |
| 9 | /clinic-config | GET | Configurações básicas | ⚙️ (substituído por 22) |
| 10 | /orthodontic-patients | GET | Pacientes ortodônticos | ✅ |
| 11 | /patient-tags | PATCH | Atualizar tags | ✅ |
| 12 | /human-takeover | POST | Registrar atendimento humano | ✅ |
| 13 | /reschedule-orthodontic | POST | Reagendar ortodontia | ⚙️ (caso específico) |
| 14 | /conversation-style | GET | Config de estilo | ✅ |
| 15 | /generate-response | POST | Gerar resposta formatada | ✅ |
| 16 | /classify-intent | POST | Classificar intent (regex) | ⚙️ (feito no 18) |
| 17 | /smart-process | POST | Processar com debounce | ⚙️ (alternativa) |
| 18 | /smart-process-complete | POST | Completar após debounce | ✅ |
| 19 | /smart-add-message | POST | Adicionar msg ao buffer | ✅ |
| 20 | /smart-buffer-status | GET | Status do buffer | ⚙️ (debug) |
| 21 | /smart-buffer-clear | DELETE | Limpar buffer | ✅ |
| 22 | /clinic-context | GET | Contexto completo da clínica | ✅ |

**Legenda:**
- ✅ = Usado diretamente no workflow V3
- ⚙️ = Disponível mas não necessário no fluxo principal (opcional/debug/alternativa)

---

## Suporte

Problemas ou dúvidas:
1. Verificar logs do N8N
2. Testar endpoints via Postman/Insomnia
3. Verificar configuração da empresa no banco
