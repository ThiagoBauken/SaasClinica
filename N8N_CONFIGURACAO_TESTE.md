# Configuracao e Teste do Sistema N8N + Chat da Clinica

Este documento descreve como configurar e testar o sistema de automacao de WhatsApp com N8N.

## Arquitetura do Sistema

```
[WhatsApp] <-> [Wuzapi/Evolution API] <-> [Webhook Site] <-> [Chat Processor]
                                                |
                                                v
                                          [Banco de Dados]
                                                |
                                                v
                                     [Interface Secretaria]
```

## Componentes Principais

### 1. Chat Processor (`server/services/chat-processor.ts`)
- Arquitetura "Code First": 80% regex + 15% state machine + 5% AI
- Reducao de 90% no uso de tokens
- Human Takeover automatico quando secretaria responde

### 2. Webhook Endpoint (`server/routes/webhooks.routes.ts`)
- `POST /api/webhooks/n8n/chat-process` - Processa mensagens recebidas
- `GET /api/webhooks/n8n/doctors-for-urgency/:companyId` - Lista medicos para urgencias
- `GET /api/webhooks/n8n/admin-phones/:companyId` - Lista telefones admin

### 3. Chat API (`server/routes/chat.routes.ts`)
- `GET /api/v1/chat/sessions` - Lista conversas
- `GET /api/v1/chat/sessions/:id` - Detalhes da conversa
- `POST /api/v1/chat/sessions/:id/send` - Envia mensagem via WhatsApp
- `POST /api/v1/chat/sessions/:id/takeover` - Assume atendimento
- `POST /api/v1/chat/sessions/:id/release` - Devolve para IA

### 4. Interface da Secretaria (`client/src/pages/chat-inbox-page.tsx`)
- Acessivel em `/atendimento`
- Lista todas as conversas ativas
- Permite enviar mensagens via WhatsApp
- Controle de Human Takeover

---

## Configuracao

### 1. Variaveis de Ambiente

Adicione no `.env`:

```env
# Wuzapi / Evolution API
EVOLUTION_API_BASE_URL=http://localhost:8080
EVOLUTION_INSTANCE_NAME=clinica
EVOLUTION_API_KEY=sua-api-key

# AI (Local ou OpenAI)
LOCAL_AI_URL=http://localhost:11434  # LM Studio ou Ollama
OPENAI_API_KEY=sk-...                # Fallback
```

### 2. Configuracao no Banco (clinicSettings)

No painel de integracoes (`/integracoes`), configure:

- **Evolution API Base URL**: URL do Wuzapi/Evolution
- **Instance Name**: Nome da instancia WhatsApp
- **API Key**: Chave de API
- **Chat Enabled**: Ativar chat automatico
- **Welcome Message**: Mensagem de boas-vindas

### 3. Configurar Webhook no Wuzapi/Evolution

Configure o webhook para enviar mensagens para:

```
POST https://sua-url.com/api/webhooks/n8n/chat-process
```

Payload esperado:
```json
{
  "companyId": 1,
  "phone": "5511999999999",
  "message": "Ola, quero agendar uma consulta",
  "wuzapiMessageId": "msg-id-123",
  "fromMe": false
}
```

**IMPORTANTE**: O campo `fromMe` indica se a mensagem foi enviada pela clinica (secretaria) ou pelo paciente.

---

## Fluxo de Mensagens

### Mensagem do Paciente (fromMe: false)
1. Wuzapi envia webhook com `fromMe: false`
2. Chat Processor detecta intent (regex)
3. Busca resposta na base de canned responses
4. Se nao encontrar, usa state machine
5. Se necessario, chama AI local/OpenAI
6. Retorna resposta para enviar via Wuzapi

### Mensagem da Secretaria (fromMe: true)
1. Wuzapi envia webhook com `fromMe: true`
2. Sistema detecta Human Takeover
3. Marca sessao como `waiting_human`
4. IA para de responder por 30 minutos
5. Salva mensagem da secretaria no historico

### Urgencia Detectada
1. Mensagem contem palavras de urgencia (dor, sangue, etc.)
2. Sistema classifica nivel: `low`, `medium`, `high`, `critical`
3. Envia notificacao para medicos (via `doctors-for-urgency`)
4. Responde com mensagem humanizada de emergencia

---

## Teste Manual

### 1. Testar Processamento de Mensagem

```bash
curl -X POST http://localhost:5000/api/webhooks/n8n/chat-process \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": 1,
    "phone": "5511999999999",
    "message": "Ola, quero agendar uma consulta",
    "fromMe": false
  }'
```

Resposta esperada:
```json
{
  "success": true,
  "data": {
    "intent": "schedule",
    "confidence": 0.95,
    "response": "Ola! Que bom que deseja agendar...",
    "processedBy": "regex",
    "tokensUsed": 0
  }
}
```

### 2. Testar Human Takeover (fromMe: true)

```bash
curl -X POST http://localhost:5000/api/webhooks/n8n/chat-process \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": 1,
    "phone": "5511999999999",
    "message": "Ola, aqui e a secretaria",
    "fromMe": true
  }'
```

Resposta esperada:
```json
{
  "success": true,
  "data": {
    "intent": "human_response",
    "processedBy": "human_takeover",
    "skipResponse": true
  }
}
```

### 3. Testar Urgencia

```bash
curl -X POST http://localhost:5000/api/webhooks/n8n/chat-process \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": 1,
    "phone": "5511999999999",
    "message": "Estou com muita dor de dente, nao aguento mais!",
    "fromMe": false
  }'
```

Resposta esperada:
```json
{
  "success": true,
  "data": {
    "intent": "emergency",
    "isUrgency": true,
    "urgencyLevel": "high",
    "requiresHumanTransfer": true,
    "actions": [
      {"type": "notify_doctor_urgency", "data": {...}},
      {"type": "transfer_to_human"}
    ]
  }
}
```

### 4. Testar Lista de Medicos para Urgencia

```bash
curl http://localhost:5000/api/webhooks/n8n/doctors-for-urgency/1?urgencyLevel=high
```

### 5. Testar Interface da Secretaria

1. Acesse `/atendimento` no navegador
2. Vera lista de conversas ativas
3. Clique em uma conversa para ver o historico
4. Envie uma mensagem (automaticamente ativa Human Takeover)
5. Use "Devolver a IA" para liberar a conversa

---

## Configuracao N8N

### Fluxo Basico de Recebimento

1. **Webhook Trigger**: Recebe mensagem do Wuzapi
2. **HTTP Request**: Chama `/api/webhooks/n8n/chat-process`
3. **If**: Verifica se `skipResponse` e false
4. **HTTP Request**: Envia resposta via Wuzapi

### Exemplo de Nodes

```json
{
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "whatsapp-messages",
        "httpMethod": "POST"
      }
    },
    {
      "name": "Process Message",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "={{$env.API_URL}}/api/webhooks/n8n/chat-process",
        "method": "POST",
        "bodyParametersJson": {
          "companyId": "={{$json.companyId}}",
          "phone": "={{$json.phone}}",
          "message": "={{$json.message}}",
          "fromMe": "={{$json.fromMe}}"
        }
      }
    },
    {
      "name": "Check Skip Response",
      "type": "n8n-nodes-base.if",
      "parameters": {
        "conditions": {
          "boolean": [
            {
              "value1": "={{$json.data.skipResponse}}",
              "value2": false
            }
          ]
        }
      }
    },
    {
      "name": "Send via Wuzapi",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "={{$env.WUZAPI_URL}}/message/sendText/{{$env.INSTANCE}}",
        "method": "POST",
        "body": {
          "number": "={{$node['Webhook'].json.phone}}",
          "textMessage": {
            "text": "={{$json.data.response}}"
          }
        }
      }
    }
  ]
}
```

---

## Solucao de Problemas

### IA nao responde
1. Verifique se `chatEnabled` esta ativo nas configuracoes
2. Verifique se a sessao nao esta em `waiting_human`
3. Verifique logs do servidor

### Secretaria envia mensagem mas IA continua respondendo
1. Verifique se o Wuzapi esta enviando `fromMe: true`
2. Confirme que o webhook esta chegando corretamente
3. Verifique se a sessao foi marcada como `waiting_human`

### Urgencias nao notificam medicos
1. Verifique se ha telefones cadastrados em Admin Phones
2. Verifique se `receiveUrgencies` esta ativo
3. Confirme que o nivel de urgencia esta correto

### Mensagens duplicadas
1. Verifique se o `wuzapiMessageId` esta sendo passado
2. O sistema usa este ID para detectar duplicatas

---

## Monitoramento

### Estatisticas de Chat
Acesse `/api/v1/chat/stats` para ver:
- Total de sessoes
- Total de mensagens
- Tokens usados
- Distribuicao por processador (regex/ai/human)
- Intents mais comuns
- Custo estimado

### Logs do Servidor
Os logs incluem:
- `[ChatProcessor]` - Processamento de mensagens
- `[HumanTakeover]` - Ativacao/desativacao de atendimento humano
- `[Urgency]` - Deteccao de urgencias
- `[EvolutionAPI]` - Envio de mensagens

---

## Checklist de Teste

- [ ] Wuzapi/Evolution API conectado
- [ ] Webhook configurado no Wuzapi
- [ ] Chat habilitado nas configuracoes
- [ ] Respostas automaticas configuradas
- [ ] Telefones admin cadastrados
- [ ] Mensagem de teste respondida pela IA
- [ ] Human Takeover funcionando (fromMe: true)
- [ ] Interface /atendimento acessivel
- [ ] Envio de mensagem pela interface funcionando
- [ ] Devolver a IA funcionando
- [ ] Urgencias sendo detectadas
- [ ] Notificacoes para medicos sendo enviadas
