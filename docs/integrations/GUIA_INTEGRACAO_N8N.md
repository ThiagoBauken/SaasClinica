# 🔗 GUIA DE INTEGRAÇÃO N8N

**Data:** 15/11/2024
**Versão:** 1.0

---

## 📋 ÍNDICE

1. [Visão Geral](#visão-geral)
2. [Pré-requisitos](#pré-requisitos)
3. [Configuração Inicial](#configuração-inicial)
4. [Fluxos de Integração](#fluxos-de-integração)
5. [Webhooks](#webhooks)
6. [Migração Baserow → PostgreSQL](#migração-baserow--postgresql)
7. [Migração Evolution API → Wuzapi](#migração-evolution-api--wuzapi)
8. [Teste e Troubleshooting](#teste-e-troubleshooting)

---

## 📌 VISÃO GERAL

### Arquitetura de Integração

```
┌─────────────┐         ┌──────────┐         ┌──────────┐
│   SITE      │◄───────►│   N8N    │◄───────►│  WUZAPI  │
│ (Express)   │         │          │         │(WhatsApp)│
└──────┬──────┘         └────┬─────┘         └──────────┘
       │                     │
       │                     │
       ▼                     ▼
┌─────────────┐         ┌──────────┐
│ PostgreSQL  │         │  Google  │
│             │         │ Calendar │
└─────────────┘         └──────────┘
```

### Fluxo de Dados

1. **Site → N8N:**
   - POST /api/webhooks/n8n/appointment-created (dispara n8n)
   - POST /api/webhooks/n8n/appointment-updated
   - POST /api/webhooks/n8n/appointment-cancelled

2. **N8N → Site:**
   - POST /api/webhooks/n8n/appointment-created (callback)
   - POST /api/webhooks/n8n/confirmation-response

3. **Wuzapi → Site:**
   - POST /api/webhooks/wuzapi/incoming (mensagens recebidas)

---

## 🔧 PRÉ-REQUISITOS

### 1. Banco de Dados Atualizado

Execute as migrations na ordem:

```bash
# 1. Adiciona campos para n8n (google_calendar_event_id, wuzapi_message_id, etc)
psql -U dental -d dental_clinic -f server/migrations/002_n8n_integration.sql

# 2. Corrige isolamento multi-tenant (rooms, procedures com companyId)
psql -U dental -d dental_clinic -f server/migrations/003_fix_multitenant_isolation.sql

# 3. Adiciona clinic_settings e automation_logs
psql -U dental -d dental_clinic -f server/migrations/004_clinic_settings_and_automation_logs.sql
```

### 2. Variáveis de Ambiente

Atualizar `.env`:

```bash
# N8N
N8N_WEBHOOK_BASE_URL=http://localhost:5678
N8N_WEBHOOK_SECRET=change-this-to-random-secret

# WUZAPI
WUZAPI_INSTANCE_ID=sua-instance-id
WUZAPI_API_KEY=sua-api-key
WUZAPI_BASE_URL=https://wuzapi.cloud/api/v2
WUZAPI_WEBHOOK_SECRET=seu-webhook-secret

# GOOGLE CALENDAR
GOOGLE_CALENDAR_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=xxx
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:5000/api/integrations/google/callback
```

### 3. Conta Wuzapi

1. Criar conta em https://wuzapi.cloud
2. Criar instância WhatsApp
3. Conectar número via QR Code
4. Obter `instance_id` e `api_key`

### 4. Google Calendar API

1. Criar projeto no Google Cloud Console
2. Ativar Google Calendar API
3. Criar credenciais OAuth 2.0
4. Obter Client ID e Client Secret

---

## ⚙️ CONFIGURAÇÃO INICIAL

### 1. Salvar Configurações da Clínica

```http
POST /api/v1/settings/integrations
Content-Type: application/json
Cookie: connect.sid=xxx

{
  "wuzapiInstanceId": "sua-instance-id",
  "wuzapiApiKey": "sua-api-key",
  "wuzapiBaseUrl": "https://wuzapi.cloud/api/v2",
  "defaultGoogleCalendarId": "primary",
  "n8nWebhookBaseUrl": "http://localhost:5678",
  "adminWhatsappPhone": "+5577998698925",
  "enableAppointmentReminders": true,
  "reminderHoursBefore": 24
}
```

### 2. Configurar Webhooks no Wuzapi

No painel do Wuzapi, configurar webhook URL:
```
https://seu-site.com/api/webhooks/wuzapi/incoming
```

---

## 🔄 FLUXOS DE INTEGRAÇÃO

### FLUXO 1: Agendamento (Criação)

**Quando:** Paciente marca consulta no site

**Caminho:**
```
1. Site: POST /api/v1/appointments
   ↓
2. Site valida conflitos
   ↓
3. Site cria appointment no PostgreSQL
   ↓
4. Site dispara: POST http://n8n:5678/webhook/appointment-created
   Payload: { appointmentId, patientPhone, datetime, professionalName }
   ↓
5. N8N processa:
   - Cria evento Google Calendar
   - Envia WhatsApp via Wuzapi
   - Retorna: POST /api/webhooks/n8n/appointment-created
     { appointmentId, googleCalendarEventId, wuzapiMessageId }
   ↓
6. Site atualiza appointment com IDs retornados
```

**Mudanças no N8N:**

**ANTES (Baserow):**
```json
{
  "nodes": [
    {
      "name": "Baserow - Get Appointment",
      "type": "n8n-nodes-baserow.baserow",
      "parameters": {
        "operation": "get",
        "tableId": "532",
        "id": "{{ $json.appointmentId }}"
      }
    }
  ]
}
```

**DEPOIS (PostgreSQL API):**
```json
{
  "nodes": [
    {
      "name": "Get Appointment",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "http://site:5000/api/v1/appointments/{{ $json.appointmentId }}",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "httpHeaderAuth",
        "method": "GET"
      }
    }
  ]
}
```

---

### FLUXO 2: Confirmação (Follow-up)

**Quando:** 24h antes do agendamento

**Caminho:**
```
1. N8N cron job diário busca agendamentos:
   GET /api/v1/appointments?startDate=tomorrow&confirmed=false
   ↓
2. Para cada agendamento:
   - Envia mensagem Wuzapi: "Confirme sua presença: SIM ou NÃO"
   - Salva confirmation_message_id
   ↓
3. Paciente responde WhatsApp
   ↓
4. Wuzapi envia para: POST /api/webhooks/wuzapi/incoming
   { from, message, messageId }
   ↓
5. Site identifica appointment pelo número
   ↓
6. Site processa resposta:
   - "SIM" → confirmed_by_patient = true, status = 'confirmed'
   - "NÃO" → trigger reagendamento flow
   ↓
7. Site dispara: POST /api/webhooks/n8n/confirmation-response
   { appointmentId, patientResponse, confirmedByPatient }
```

**Mudanças no N8N:**

**ANTES (Evolution API):**
```json
{
  "nodes": [
    {
      "name": "Evolution - Send Confirmation",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://evolution.brasiltypebot.com/message/sendText",
        "method": "POST",
        "bodyParameters": {
          "parameters": [
            {
              "name": "number",
              "value": "={{ $json.patientPhone }}"
            },
            {
              "name": "textMessage",
              "value": "={{ { text: $json.message } }}"
            }
          ]
        }
      }
    }
  ]
}
```

**DEPOIS (Wuzapi):**
```json
{
  "nodes": [
    {
      "name": "Wuzapi - Send Confirmation",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://wuzapi.cloud/api/v2/send-message",
        "method": "POST",
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "Bearer {{ $credentials.wuzapiApiKey }}"
            }
          ]
        },
        "bodyParameters": {
          "parameters": [
            {
              "name": "instance_id",
              "value": "={{ $credentials.wuzapiInstanceId }}"
            },
            {
              "name": "phone",
              "value": "={{ $json.patientPhone }}"
            },
            {
              "name": "message",
              "value": "={{ $json.message }}"
            }
          ]
        }
      }
    }
  ]
}
```

---

### FLUXO 3: Cancelamento

**Quando:** Clínica cancela agendamento

**Caminho:**
```
1. Site: POST /api/v1/appointments/:id/cancel
   { reason, notifyPatient: true }
   ↓
2. Site atualiza status = 'cancelled'
   ↓
3. Site dispara: POST http://n8n:5678/webhook/appointment-cancelled
   { appointmentId, reason, googleCalendarEventId }
   ↓
4. N8N:
   - Deleta evento do Google Calendar
   - Envia WhatsApp de cancelamento via Wuzapi
   - Retorna: POST /api/webhooks/n8n/appointment-cancelled
     { appointmentId, wuzapiMessageId, googleCalendarDeleted: true }
   ↓
5. Site atualiza appointment
```

---

### FLUXO 4: Reagendamento

**Quando:** Clínica altera horário

**Caminho:**
```
1. Site: PATCH /api/v1/appointments/:id
   { startTime: new Date, endTime: new Date }
   ↓
2. Site valida conflitos
   ↓
3. Site atualiza appointment
   ↓
4. Site dispara: POST http://n8n:5678/webhook/appointment-updated
   {
     appointmentId,
     oldStartTime,
     newStartTime,
     googleCalendarEventId
   }
   ↓
5. N8N:
   - Atualiza evento Google Calendar
   - Envia WhatsApp de reagendamento
   - Retorna: POST /api/webhooks/n8n/appointment-updated
     { appointmentId, wuzapiMessageId }
```

---

## 📡 WEBHOOKS

### Site → N8N (Disparar automações)

#### 1. Appointment Created
```http
POST http://n8n:5678/webhook/appointment-created
Content-Type: application/json

{
  "appointmentId": 123,
  "companyId": 1,
  "patientId": 45,
  "patientName": "João Silva",
  "patientPhone": "+5577998698925",
  "professionalId": 2,
  "professionalName": "Dr. Maria",
  "roomId": 1,
  "roomName": "Sala 1",
  "startTime": "2024-11-20T14:00:00-03:00",
  "endTime": "2024-11-20T15:00:00-03:00",
  "procedure": "Limpeza Dental"
}
```

#### 2. Appointment Updated
```http
POST http://n8n:5678/webhook/appointment-updated
Content-Type: application/json

{
  "appointmentId": 123,
  "oldStartTime": "2024-11-20T14:00:00-03:00",
  "newStartTime": "2024-11-21T10:00:00-03:00",
  "googleCalendarEventId": "abc123",
  "patientPhone": "+5577998698925"
}
```

#### 3. Appointment Cancelled
```http
POST http://n8n:5678/webhook/appointment-cancelled
Content-Type: application/json

{
  "appointmentId": 123,
  "reason": "Paciente solicitou",
  "googleCalendarEventId": "abc123",
  "patientPhone": "+5577998698925"
}
```

### N8N → Site (Callbacks)

#### 1. Appointment Created Callback
```http
POST http://site:5000/api/webhooks/n8n/appointment-created
Content-Type: application/json

{
  "appointmentId": 123,
  "googleCalendarEventId": "abc123xyz",
  "wuzapiMessageId": "msg_789",
  "automationStatus": "sent"
}
```

#### 2. Confirmation Response
```http
POST http://site:5000/api/webhooks/n8n/confirmation-response
Content-Type: application/json

{
  "appointmentId": 123,
  "patientResponse": "SIM",
  "confirmedByPatient": true,
  "wuzapiMessageId": "msg_790"
}
```

### Wuzapi → Site (Mensagens recebidas)

```http
POST http://site:5000/api/webhooks/wuzapi/incoming
Content-Type: application/json

{
  "type": "message",
  "data": {
    "from": "+5577998698925",
    "message": "SIM",
    "messageId": "msg_abc123",
    "timestamp": "2024-11-20T10:00:00Z"
  }
}
```

---

## 🔄 MIGRAÇÃO BASEROW → POSTGRESQL

### Passo 1: Identificar Tabelas Baserow

**Tabelas usadas nos fluxos:**
- Table 531: Patients
- Table 532: Appointments
- Table 533: Professionals (?)

### Passo 2: Mapear para Endpoints PostgreSQL

| Baserow Operation | Novo Endpoint |
|-------------------|---------------|
| GET table/531/{id} | GET /api/v1/patients/{id} |
| GET table/532 | GET /api/v1/appointments |
| POST table/532 | POST /api/v1/appointments |
| PATCH table/532/{id} | PATCH /api/v1/appointments/{id} |
| DELETE table/532/{id} | DELETE /api/v1/appointments/{id} |

### Passo 3: Substituir Nodes no N8N

**Exemplo: Buscar Appointment**

**ANTES:**
```
Node: Baserow
Operation: Get Row
Table: 532
Row ID: {{ $json.appointmentId }}
```

**DEPOIS:**
```
Node: HTTP Request
Method: GET
URL: http://site:5000/api/v1/appointments/{{ $json.appointmentId }}
Authentication: Header Auth
Header Name: Cookie
Header Value: connect.sid={{ $credentials.sessionCookie }}
```

### Passo 4: Ajustar Mapeamento de Campos

**Baserow → PostgreSQL:**

| Campo Baserow | Campo PostgreSQL |
|---------------|------------------|
| `id` | `id` |
| `patient_name` | `patient.fullName` |
| `patient_phone` | `patient.whatsappPhone \|\| patient.cellphone` |
| `start_datetime` | `startTime` |
| `professional_name` | `professional.fullName` |
| `room_name` | `room.name` |

---

## 📱 MIGRAÇÃO EVOLUTION API → WUZAPI

### Diferenças de API

| Feature | Evolution API | Wuzapi |
|---------|---------------|--------|
| **Send Text** | `/message/sendText` | `/send-message` |
| **Auth** | No auth / API Key header | Bearer Token |
| **Phone Format** | `number: "5577998698925"` | `phone: "+5577998698925"` |
| **Message Body** | `textMessage: { text: "..." }` | `message: "..."` |
| **Instance** | URL param | Body param `instance_id` |

### Substituir Envio de Mensagem

**ANTES (Evolution):**
```json
{
  "method": "POST",
  "url": "https://evolution.brasiltypebot.com/message/sendText/INSTANCE_NAME",
  "body": {
    "number": "5577998698925",
    "textMessage": {
      "text": "Olá!"
    }
  }
}
```

**DEPOIS (Wuzapi):**
```json
{
  "method": "POST",
  "url": "https://wuzapi.cloud/api/v2/send-message",
  "headers": {
    "Authorization": "Bearer YOUR_API_KEY"
  },
  "body": {
    "instance_id": "YOUR_INSTANCE_ID",
    "phone": "+5577998698925",
    "message": "Olá!"
  }
}
```

### Checklist de Migração

- [ ] Substituir URL base
- [ ] Adicionar header Authorization
- [ ] Mudar formato do body
- [ ] Adicionar `instance_id` no body
- [ ] Remover `instance_name` da URL
- [ ] Garantir formato +55 no phone
- [ ] Testar envio
- [ ] Implementar tratamento de erro

---

## 🧪 TESTE E TROUBLESHOOTING

### Testar Fluxo Completo

```bash
# 1. Criar agendamento via API
curl -X POST http://localhost:5000/api/v1/appointments \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=xxx" \
  -d '{
    "title": "Limpeza",
    "patientId": 1,
    "professionalId": 2,
    "roomId": 1,
    "startTime": "2024-11-21T14:00:00-03:00",
    "endTime": "2024-11-21T15:00:00-03:00"
  }'

# 2. Verificar se n8n foi chamado (logs do n8n)

# 3. Verificar se WhatsApp foi enviado (painel Wuzapi)

# 4. Verificar Google Calendar (verificar evento criado)
```

### Logs Úteis

```bash
# Logs do site (Express)
npm run dev

# Logs do n8n
docker logs -f n8n

# Verificar automation_logs
psql -U dental -d dental_clinic -c "
  SELECT * FROM automation_logs
  ORDER BY created_at DESC
  LIMIT 10;
"
```

### Problemas Comuns

#### 1. Webhook não chega no n8n
**Causa:** URL incorreta ou n8n não rodando
**Solução:**
```bash
# Verificar se n8n está rodando
curl http://localhost:5678/healthz

# Testar webhook manualmente
curl -X POST http://localhost:5678/webhook/appointment-created \
  -H "Content-Type: application/json" \
  -d '{"appointmentId": 123}'
```

#### 2. WhatsApp não é enviado
**Causa:** Credenciais Wuzapi incorretas
**Solução:**
```bash
# Testar conexão Wuzapi
curl https://wuzapi.cloud/api/v2/instance/status \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### 3. Google Calendar falha
**Causa:** Token OAuth expirado
**Solução:** Renovar token OAuth via fluxo de autenticação

#### 4. Mensagens duplicadas
**Causa:** Webhook disparado múltiplas vezes
**Solução:** Implementar idempotência com `wuzapi_message_id`

---

## 📚 PRÓXIMOS PASSOS

1. ✅ Rodar migrations
2. ✅ Configurar credenciais Wuzapi
3. ✅ Atualizar 3 fluxos principais (Agendamento, Confirmação, Cancelamento)
4. ⏳ Testar end-to-end
5. ⏳ Deploy em produção
6. ⏳ Migrar fluxos restantes (Aniversário, Avaliação, etc.)

---

**Última atualização:** 15/11/2024
**Versão do Site:** 1.0
**Versão do N8N:** Compatible with v1.x
