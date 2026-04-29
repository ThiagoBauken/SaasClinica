# Automation Engine - Substituicao do N8N

## Visao Geral

O Automation Engine e um sistema nativo que substitui todos os fluxos do N8N, oferecendo:

- **Menor latencia**: Execucao direta sem chamadas HTTP externas
- **Melhor controle de erros**: Tratamento unificado com logs no banco
- **Sem dependencia externa**: Nao precisa do N8N rodando
- **Transacoes atomicas**: Operacoes consistentes no banco
- **WebSocket integrado**: Notificacoes em tempo real

---

## Arquitetura

```
Evento (ex: criar agendamento)
        |
        v
+-------------------+
| appointments.routes.ts |
| (trigger automatico)   |
+-------------------+
        |
        v
+-------------------+
| automation-engine.ts |
| - Processa evento    |
| - Envia WhatsApp     |
| - Atualiza banco     |
| - Grava logs         |
+-------------------+
        |
        v
+-------------------+
| websocket.ts         |
| - Notifica frontend  |
| - Atualiza UI real-time |
+-------------------+
```

---

## Fluxos N8N Substituidos

### 1. Agendamento (appointment_created)

**N8N Original**: `OTIMIZADO_Agendamento.json`

**Codigo Nativo**: `AutomationEngine.onAppointmentCreated()`

| Funcionalidade | N8N | Nativo |
|----------------|-----|--------|
| Enviar WhatsApp para paciente | Webhook + Wuzapi | `sendWhatsApp()` |
| Notificar admins | HTTP Request | `notifyAdmins()` |
| Atualizar status automacao | HTTP Request | Query Drizzle |
| Log de execucao | - | `automationLogs` table |

**Trigger automatico em**: `POST /api/v1/appointments`

---

### 2. Cancelamento (appointment_cancelled)

**N8N Original**: `Cancelamento.json`

**Codigo Nativo**: `AutomationEngine.onAppointmentCancelled()`

| Funcionalidade | N8N | Nativo |
|----------------|-----|--------|
| Avisar paciente | Webhook + Wuzapi | `sendWhatsApp()` |
| Notificar admins | HTTP Request | `notifyAdmins()` |
| Atualizar UI | - | WebSocket broadcast |

**Trigger automatico em**: `POST /api/v1/appointments/:id/cancel`

---

### 3. Reagendamento (appointment_rescheduled)

**N8N Original**: `Reagendamento.json`

**Codigo Nativo**: `AutomationEngine.onAppointmentRescheduled()`

| Funcionalidade | N8N | Nativo |
|----------------|-----|--------|
| Avisar nova data | Webhook + Wuzapi | `sendWhatsApp()` |
| Mostrar horario anterior | Template | `interpolateTemplate()` |
| Notificar dentista | - | WebSocket + `notifyUser()` |

**Trigger automatico em**: `PATCH /api/v1/appointments/:id` (quando startTime muda)

---

### 4. Confirmacao Diaria (daily_confirmations)

**N8N Original**: `Confirmacao.json`

**Codigo Nativo**: `AutomationEngine.sendDailyConfirmations()`

| Funcionalidade | N8N | Nativo |
|----------------|-----|--------|
| Buscar agendamentos amanha | HTTP Request | Query Drizzle |
| Enviar lembrete | Loop + Wuzapi | `sendWhatsApp()` em loop |
| Marcar como enviado | HTTP Request | Update Drizzle |

**Execucao**: Cron job as 18:00 ou manual via API

---

### 5. Resumo Diario ADM (daily_summary)

**N8N Original**: `CODE_FIRST_Disparo_Diario_ADM.json`

**Codigo Nativo**: `AutomationEngine.sendDailySummary()`

| Funcionalidade | N8N | Nativo |
|----------------|-----|--------|
| Buscar agendamentos do dia | HTTP Request | Query Drizzle |
| Gerar resumo formatado | Code Node | `interpolateTemplate()` |
| Enviar para admins | Loop + Wuzapi | `notifyAdmins()` |

**Execucao**: Cron job as 07:30 ou manual via API

---

### 6. Relatorio do Dentista

**N8N Original**: Parte do Agente IA

**Codigo Nativo**: `POST /api/v1/automation/report/professional-daily`

| Funcionalidade | N8N | Nativo |
|----------------|-----|--------|
| Buscar agenda do dentista | Variavel dinamica | Query por professionalId |
| Enviar WhatsApp | Wuzapi | `sendWhatsApp()` |
| Enviar para todos | - | `report/all-professionals` |

---

### 7. Finalizacao Automatica

**N8N Original**: `Finalizar.json`

**Codigo Nativo**: `AutomationEngine.finalizeCompletedAppointments()`

| Funcionalidade | N8N | Nativo |
|----------------|-----|--------|
| Buscar consultas passadas | HTTP Request | Query Drizzle |
| Marcar como completed | HTTP Request | Update Drizzle |

**Execucao**: Cron job as 23:00

---

### 8. Aniversarios

**N8N Original**: `Aniversario.json`

**Codigo Nativo**: `AutomationEngine.sendBirthdayMessages()`

| Funcionalidade | N8N | Nativo |
|----------------|-----|--------|
| Buscar aniversariantes | SQL com EXTRACT | Query Drizzle com sql`` |
| Enviar mensagem | Wuzapi | `sendWhatsApp()` |

**Execucao**: Cron job as 09:00

---

## Jobs Agendados (Cron)

| Job | Horario | Funcao |
|-----|---------|--------|
| Confirmacoes | 18:00 | `sendDailyConfirmations()` |
| Resumo ADM | 07:30 | `sendDailySummary()` |
| Finalizar | 23:00 | `finalizeCompletedAppointments()` |
| Aniversarios | 09:00 | `sendBirthdayMessages()` |

### Iniciar Jobs

```typescript
// Para uma empresa
await startScheduledJobs(companyId);

// Para todas as empresas ativas
await startAllScheduledJobs();
```

---

## Endpoints da API

### Triggers de Eventos

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | `/api/v1/automation/appointment/created` | Trigger criacao |
| POST | `/api/v1/automation/appointment/cancelled` | Trigger cancelamento |
| POST | `/api/v1/automation/appointment/rescheduled` | Trigger reagendamento |
| POST | `/api/v1/automation/appointment/confirmed` | Paciente confirmou |

### Jobs Manuais

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | `/api/v1/automation/jobs/daily-confirmations` | Executar confirmacoes |
| POST | `/api/v1/automation/jobs/daily-summary` | Executar resumo ADM |
| POST | `/api/v1/automation/jobs/finalize-appointments` | Finalizar consultas |
| POST | `/api/v1/automation/jobs/birthday-messages` | Enviar aniversarios |

### Relatorios

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | `/api/v1/automation/report/professional-daily` | Relatorio dentista |
| POST | `/api/v1/automation/report/all-professionals` | Relatorio todos |

### Scheduler

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | `/api/v1/automation/scheduler/start` | Iniciar jobs |
| POST | `/api/v1/automation/scheduler/stop` | Parar jobs |
| GET | `/api/v1/automation/status` | Status das automacoes |

---

## Notificacoes WebSocket

O frontend recebe atualizacoes em tempo real via WebSocket:

```typescript
// Tipos de mensagens
type: 'APPOINTMENT_CREATED'
type: 'APPOINTMENT_CANCELLED'
type: 'APPOINTMENT_RESCHEDULED'
type: 'APPOINTMENT_CONFIRMATION'
```

### Exemplo no Frontend

```typescript
const ws = new WebSocket('ws://localhost:5000/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'auth', companyId: 1 }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'APPOINTMENT_CANCELLED') {
    // Atualizar UI, remover da lista, mostrar toast
    toast.warning('Consulta cancelada: ' + data.data.reason);
  }
};
```

---

## Configuracao Necessaria

### Tabela clinicSettings

```sql
wuzapiBaseUrl       -- URL da API Wuzapi
wuzapiApiKey        -- Chave de API
wuzapiInstanceId    -- ID da instancia WhatsApp
confirmationHoursBefore -- Horas antes para confirmar (default: 24)
reminderHoursBefore     -- Horas antes para lembrete (default: 2)
```

### Tabela adminPhones

```sql
phone               -- Numero do telefone
isActive            -- Se esta ativo
canReceiveNotifications -- Se recebe notificacoes
notificationTypes   -- Array: ['daily_summary', 'new_appointment', 'cancelled_appointment']
```

---

## Comparacao: N8N vs Nativo

| Aspecto | N8N | Nativo |
|---------|-----|--------|
| Latencia | ~500-1000ms | ~50-100ms |
| Dependencia externa | Sim | Nao |
| Custo | Self-hosted ou pago | Zero |
| Debug | Interface visual | Logs no banco |
| Escalabilidade | Limitada | Node.js cluster |
| Manutenibilidade | Fluxos JSON | Codigo TypeScript |
| Testes | Manual | Jest/Vitest |
| Versionamento | Export/Import | Git |

---

## Migracao do N8N

### Passo 1: Manter N8N em paralelo

Os dois sistemas podem rodar simultaneamente. O codigo em `appointments.routes.ts` chama ambos:

```typescript
// Automacao nativa (novo)
const engine = createAutomationEngine(companyId);
engine.onAppointmentCreated(appointment.id);

// N8N (legado - mantido para testes)
N8NService.triggerAutomation(appointment.id, companyId, 'appointment_created');
```

### Passo 2: Testar automacao nativa

Verificar logs em `automationLogs` table:

```sql
SELECT * FROM automation_logs
WHERE company_id = 1
ORDER BY created_at DESC;
```

### Passo 3: Desativar N8N

Quando estiver confiante, remover chamadas ao N8NService:

```typescript
// Remover estas linhas:
// N8NService.triggerAutomation(...);
```

---

## Arquivos Relacionados

- `server/services/automation-engine.ts` - Engine principal
- `server/routes/automation.routes.ts` - Endpoints da API
- `server/routes/appointments.routes.ts` - Triggers automaticos
- `server/websocket.ts` - Notificacoes tempo real

---

## Proximos Passos

1. Testar cada fluxo individualmente
2. Verificar logs de automacao no banco
3. Monitorar WebSocket no frontend
4. Quando estavel, remover chamadas N8N
5. Deletar fluxos JSON do N8N
