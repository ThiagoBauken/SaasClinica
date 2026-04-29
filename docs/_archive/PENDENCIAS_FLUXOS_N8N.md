# ⚠️ PENDÊNCIAS - FLUXOS N8N

## Status Atual

✅ **Implementado:**
- Backend API completo (PostgreSQL)
- Endpoints de agendamentos, pacientes, profissionais
- Sistema de configuração de chave OpenAI por clínica
- Webhooks básicos
- Estrutura de integração N8N documentada

❌ **Falta Fazer:**
- Migrar fluxos N8N de Baserow → PostgreSQL API
- Migrar Evolution API → Wuzapi
- Integrar chave OpenAI nos fluxos de IA
- Testar fluxos end-to-end
- Ajustar templates de mensagens

---

## 📋 FLUXOS EXISTENTES E STATUS

### 1. **Finalizar_Atendimentos.json** ❌
**Status:** Usando Baserow
**O que faz:** Finaliza atendimentos automaticamente às 23h

**O que precisa mudar:**
```diff
- Baserow: GET table 531 (buscar atendimentos)
+ HTTP Request: GET /api/v1/appointments?status=in_progress&endTime<now

- Baserow: UPDATE table 531 (atualizar status)
+ HTTP Request: PATCH /api/v1/appointments/:id { status: "completed" }

- Evolution API credentials
+ Wuzapi credentials (já configurado no backend)
```

**Prioridade:** 🔴 ALTA

---

### 2. **Agente_de_IA_studio.json** ⚠️
**Status:** Usando Flowise + Evolution API + SEM OPENAI KEY POR CLÍNICA
**O que faz:** Chatbot inteligente que responde mensagens via WhatsApp

**O que precisa mudar:**

#### 2.1 Buscar chave OpenAI da empresa
```json
{
  "name": "Buscar OpenAI Key",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "POST",
    "url": "http://seu-site.com/api/v1/company/openai-key",
    "body": {
      "companyId": "{{ $json.companyId }}"
    }
  }
}
```

#### 2.2 Substituir Flowise por OpenAI direto
```diff
- URL: https://outros-flowise.rmci11.easypanel.host/api/v1/prediction/...
+ URL: https://api.openai.com/v1/chat/completions
+ Headers: { "Authorization": "Bearer {{ $node['Buscar OpenAI Key'].json.openaiApiKey }}" }
```

#### 2.3 Migrar Evolution → Wuzapi
```diff
- URL: https://evolution.brasiltypebot.com/message/sendText
- Body: { number, textMessage: { text } }

+ URL: https://wuzapi.cloud/api/v2/send-message
+ Headers: { "Authorization": "Bearer {{ $credentials.wuzapiApiKey }}" }
+ Body: { instance_id, phone: "+55...", message }
```

#### 2.4 Integrar com PostgreSQL
Adicionar node para:
- Buscar informações do paciente: `GET /api/v1/patients?phone={{ $json.from }}`
- Buscar agendamentos do paciente: `GET /api/v1/appointments?patientId={{ $json.patientId }}`
- Passar contexto para a IA

**Prioridade:** 🔴 CRÍTICA (usa IA mas sem chave por clínica)

---

### 3. **Agendamento_studio.json** ❌
**Status:** Usando Baserow + Evolution
**O que faz:** Envia confirmação de agendamento criado

**O que precisa mudar:**

#### 3.1 Webhook de entrada
```diff
Webhook N8N recebe do site:
POST http://n8n:5678/webhook/appointment-created

Payload:
{
  "appointmentId": 123,
  "companyId": 1,
  "patientPhone": "+5577998698925",
  "patientName": "João",
  "professionalName": "Dra. Maria",
  "startTime": "2024-11-21T14:00:00",
  "procedure": "Limpeza"
}
```

#### 3.2 Buscar dados completos
```diff
- Baserow: GET table 532/{{ appointmentId }}
+ HTTP Request: GET /api/v1/appointments/{{ $json.appointmentId }}
```

#### 3.3 Enviar WhatsApp
```diff
- Evolution API
+ Wuzapi (com template de mensagem)
```

#### 3.4 Callback para o site
```json
{
  "name": "Callback Site",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "POST",
    "url": "http://site:5000/api/webhooks/n8n/appointment-created",
    "body": {
      "appointmentId": "{{ $json.appointmentId }}",
      "wuzapiMessageId": "{{ $node['Wuzapi Send'].json.messageId }}",
      "googleCalendarEventId": "{{ $node['Google Calendar'].json.id }}",
      "automationStatus": "sent"
    }
  }
}
```

**Prioridade:** 🔴 ALTA

---

### 4. **Confirmação_Follow_UP_Studio.json** ❌
**Status:** Usando Baserow + Evolution
**O que faz:** Envia lembrete 24h antes da consulta

**O que precisa mudar:**

#### 4.1 Cron diário busca agendamentos
```json
{
  "name": "Buscar Agendamentos Amanhã",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "url": "http://site:5000/api/v1/appointments",
    "qs": {
      "startDate": "{{ $now.plus({days: 1}).toFormat('yyyy-MM-dd') }}",
      "status": "scheduled",
      "confirmedByPatient": "false"
    }
  }
}
```

#### 4.2 Enviar confirmação via Wuzapi
```json
{
  "message": "Olá {{ $json.patientName }}! Você tem consulta amanhã às {{ $json.startTime }} com {{ $json.professionalName }}. Confirme sua presença respondendo SIM ou NÃO."
}
```

#### 4.3 Salvar message_id
```json
{
  "name": "Salvar Message ID",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "PATCH",
    "url": "http://site:5000/api/v1/appointments/{{ $json.id }}",
    "body": {
      "confirmationMessageId": "{{ $node['Wuzapi'].json.messageId }}"
    }
  }
}
```

**Prioridade:** 🟡 MÉDIA

---

### 5. **Cancelamento_Studio.json** ❌
**Status:** Usando Baserow + Evolution
**O que faz:** Notifica paciente sobre cancelamento

**O que precisa mudar:**

#### 5.1 Webhook de entrada
```
POST http://n8n:5678/webhook/appointment-cancelled

{
  "appointmentId": 123,
  "reason": "Médico precisou remarcar",
  "patientPhone": "+5577998698925",
  "googleCalendarEventId": "abc123"
}
```

#### 5.2 Deletar do Google Calendar
```json
{
  "name": "Delete Google Event",
  "type": "n8n-nodes-googlecalendar.GoogleCalendar",
  "operation": "delete",
  "eventId": "{{ $json.googleCalendarEventId }}"
}
```

#### 5.3 Enviar notificação Wuzapi
Template: "Sua consulta foi cancelada. Motivo: {{ reason }}. Entre em contato para reagendar."

**Prioridade:** 🟡 MÉDIA

---

### 6. **Reagendamento_studio.json** ❌
**Status:** Usando Baserow + Evolution
**O que faz:** Notifica sobre mudança de horário

**Similar ao Cancelamento, mas:**
- Atualiza Google Calendar em vez de deletar
- Mensagem diferente: "Sua consulta foi reagendada de {{ oldTime }} para {{ newTime }}"

**Prioridade:** 🟡 MÉDIA

---

### 7. **Aniversario_Follow_Up_Studio.json** ⚪
**O que faz:** Envia mensagem de parabéns
**Status:** Pode manter depois das principais

**Prioridade:** 🟢 BAIXA

---

### 8. **Avaliação_Follow_UP_Studio.json** ⚪
**O que faz:** Solicita avaliação pós-atendimento
**Prioridade:** 🟢 BAIXA

---

### 9. **Disparo diário ADM_studio.json** ⚪
**O que faz:** Relatório diário para admin
**Prioridade:** 🟢 BAIXA

---

## 🎯 PLANO DE IMPLEMENTAÇÃO

### FASE 1: Fluxos Críticos (1-2 dias) 🔴

1. **Agendamento** (appointment-created)
   - [ ] Criar webhook no N8N
   - [ ] Substituir Baserow por API
   - [ ] Migrar Evolution → Wuzapi
   - [ ] Testar envio de mensagem
   - [ ] Implementar callback para site

2. **Agente de IA** (chatbot)
   - [ ] Adicionar node "Buscar OpenAI Key"
   - [ ] Substituir Flowise por OpenAI API
   - [ ] Integrar com API PostgreSQL (buscar paciente)
   - [ ] Buscar agendamentos do paciente
   - [ ] Testar fluxo completo

3. **Confirmação Follow-up** (24h antes)
   - [ ] Cron job diário
   - [ ] Buscar agendamentos via API
   - [ ] Enviar via Wuzapi
   - [ ] Salvar message_id

### FASE 2: Fluxos Importantes (2-3 dias) 🟡

4. **Cancelamento**
   - [ ] Webhook de cancelamento
   - [ ] Deletar Google Calendar
   - [ ] Notificar via Wuzapi

5. **Reagendamento**
   - [ ] Webhook de update
   - [ ] Atualizar Google Calendar
   - [ ] Notificar via Wuzapi

6. **Finalizar Atendimentos**
   - [ ] Substituir Baserow
   - [ ] Automatizar fechamento

### FASE 3: Fluxos Nice-to-Have (1-2 dias) 🟢

7. Aniversário
8. Avaliação
9. Relatório ADM

---

## 📝 TEMPLATES DE MENSAGENS

### Agendamento Criado
```
🦷 *Agendamento Confirmado!*

Olá {{ patientName }}! 👋

Sua consulta foi agendada com sucesso:

📅 *Data:* {{ date }}
⏰ *Horário:* {{ time }}
👨‍⚕️ *Profissional:* {{ professionalName }}
📍 *Procedimento:* {{ procedure }}

Enviaremos um lembrete 24h antes.

Até breve! 😊
```

### Confirmação (24h antes)
```
🔔 *Lembrete de Consulta*

Olá {{ patientName }}!

Você tem consulta amanhã:
📅 {{ date }} às {{ time }}
👨‍⚕️ Com {{ professionalName }}

*Por favor, confirme sua presença:*
Digite *SIM* para confirmar
Digite *NÃO* para cancelar/reagendar
```

### Cancelamento
```
❌ *Consulta Cancelada*

Olá {{ patientName }},

Sua consulta do dia {{ date }} às {{ time }} foi cancelada.

*Motivo:* {{ reason }}

Entre em contato para reagendar:
📞 {{ clinicPhone }}
```

### Reagendamento
```
🔄 *Horário Alterado*

Olá {{ patientName }},

Sua consulta foi reagendada:

❌ *Horário anterior:* {{ oldDate }} às {{ oldTime }}
✅ *Novo horário:* {{ newDate }} às {{ newTime }}

👨‍⚕️ *Profissional:* {{ professionalName }}

Nos vemos no novo horário! 😊
```

---

## 🔧 CREDENCIAIS N8N

### 1. Wuzapi
```
Nome: Wuzapi Clínica
Tipo: Header Auth
Header: Authorization
Value: Bearer {api_key_da_clinica}
```

### 2. Site API
```
Nome: Site Backend
Tipo: Header Auth
Header: Cookie
Value: connect.sid={session}
```

### 3. Google Calendar
```
Nome: Google Calendar Clínica
Tipo: OAuth2
Client ID: {from .env}
Client Secret: {from .env}
```

---

## ⚠️ PONTOS DE ATENÇÃO

### 1. Multi-tenancy
- Cada clínica tem sua própria chave OpenAI
- Fluxo deve buscar `companyId` e usar a chave correta
- Não misturar dados de clínicas diferentes

### 2. Segurança
- Webhook do N8N → Site deve ter autenticação
- Site → N8N pode ser interno (sem auth se mesma rede)
- Nunca expor chaves OpenAI em logs

### 3. Idempotência
- Usar `wuzapiMessageId` para evitar duplicatas
- Verificar se appointment já tem `confirmationMessageId`

### 4. Tratamento de Erros
```javascript
// No N8N, adicionar node "Error Handler"
if ($node['Wuzapi'].json.error) {
  // Salvar erro no automation_logs
  fetch('http://site:5000/api/automation-logs', {
    method: 'POST',
    body: JSON.stringify({
      appointmentId: $json.appointmentId,
      action: 'send_confirmation',
      status: 'failed',
      errorMessage: $node['Wuzapi'].json.error
    })
  });
}
```

---

## 🧪 TESTES

### Checklist por Fluxo

#### Agendamento
- [ ] Criar appointment via API
- [ ] Verificar webhook chegou no N8N
- [ ] Verificar mensagem WhatsApp enviada
- [ ] Verificar callback retornou ao site
- [ ] Verificar `wuzapiMessageId` salvo

#### Confirmação
- [ ] Cron executa diariamente
- [ ] Busca agendamentos corretos (amanhã)
- [ ] Envia mensagem
- [ ] Paciente responde "SIM" → confirma
- [ ] Paciente responde "NÃO" → dispara reagendamento

#### Chatbot IA
- [ ] Paciente envia mensagem
- [ ] N8N busca chave OpenAI da clínica
- [ ] N8N busca dados do paciente
- [ ] OpenAI recebe contexto completo
- [ ] Resposta é enviada via Wuzapi
- [ ] IA consegue agendar (tool call)

---

## 📊 ESTIMATIVA DE TEMPO

| Fase | Tempo | Complexidade |
|------|-------|--------------|
| Fase 1 - Críticos | 2-3 dias | 🔴 Alta |
| Fase 2 - Importantes | 2-3 dias | 🟡 Média |
| Fase 3 - Nice-to-have | 1-2 dias | 🟢 Baixa |
| **TOTAL** | **5-8 dias** | |

---

## 🚀 PRÓXIMOS PASSOS IMEDIATOS

1. **Migrar Agente de IA** (mais crítico)
   - Implementar busca de chave OpenAI
   - Substituir Flowise por OpenAI API
   - Testar com chave da clínica

2. **Migrar Agendamento**
   - Criar webhook appointment-created
   - Implementar envio via Wuzapi
   - Testar callback

3. **Testar End-to-End**
   - Criar appointment real
   - Verificar WhatsApp
   - Verificar Google Calendar

---

**Última atualização:** 15/11/2025
**Responsável:** A definir
**Status Geral:** 🟡 Em andamento (30% completo - apenas backend pronto)
