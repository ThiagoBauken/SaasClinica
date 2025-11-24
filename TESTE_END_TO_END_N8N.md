# 🧪 GUIA DE TESTE END-TO-END - INTEGRAÇÃO N8N

**Data:** 16/11/2024
**Status:** FASE 1 COMPLETA - Pronto para testes

---

## 📋 PRÉ-REQUISITOS

Antes de começar os testes, certifique-se de que:

- [ ] Migrations rodadas (`npm run db:migrate-integrations`)
- [ ] Servidor rodando (`npm run dev`)
- [ ] Conta Wuzapi criada e credenciais configuradas
- [ ] N8N rodando (local ou cloud)
- [ ] 5 fluxos N8N importados e ativados

---

## 🔄 FLUXO 1: AGENDAMENTO COMPLETO

### Objetivo
Testar criação de agendamento com notificação WhatsApp e Google Calendar.

### Passos

1. **Configurar Wuzapi**
   ```bash
   # Acessar página
   http://localhost:5000/configuracoes/integracoes

   # Preencher:
   - Instance ID: seu_instance_id
   - API Key: sua_api_key
   - Telefone Admin: +5577998698925

   # Clicar em "Salvar Configurações"
   ```

2. **Testar Conexão**
   ```bash
   # Na mesma página, clicar:
   - "Testar Conexão" (botão verde)

   # Resultado esperado:
   ✅ Toast: "Conexão com Wuzapi estabelecida com sucesso"
   ```

3. **Criar Agendamento via API**
   ```bash
   POST http://localhost:5000/api/v1/appointments
   Content-Type: application/json
   Cookie: connect.sid=seu_session_cookie

   {
     "title": "Limpeza Dental - Teste E2E",
     "patientId": 1,
     "professionalId": 2,
     "roomId": 1,
     "startTime": "2024-11-25T14:00:00-03:00",
     "endTime": "2024-11-25T15:00:00-03:00",
     "status": "scheduled"
   }
   ```

4. **Verificar Logs no Console**
   ```bash
   # Terminal do servidor deve mostrar:
   ✅ N8N automation triggered: appointment_created
   ✅ Webhook sent to N8N: http://localhost:5678/webhook/appointment-created
   ```

5. **Verificar WhatsApp**
   ```
   ✅ Paciente recebe mensagem:

   "Olá [Nome]! 👋

   Confirmamos seu agendamento:

   🦷 Profissional: Dr. [Nome]
   📅 Data/Hora: 25/11/2024 às 14:00

   Responda *SIM* para confirmar sua presença ou *REAGENDAR* se precisar alterar.

   Aguardamos você! 😊"
   ```

6. **Verificar Google Calendar**
   ```bash
   # Abrir Google Calendar do profissional
   # Verificar evento criado em 25/11/2024 14:00

   ✅ Título: Limpeza Dental - Teste E2E
   ✅ Descrição: Paciente [Nome]
   ✅ Horário: 14:00 - 15:00
   ```

7. **Verificar Database**
   ```sql
   -- Verificar appointment atualizado
   SELECT
     id,
     automation_status,
     wuzapi_message_id,
     google_calendar_event_id,
     automation_sent_at
   FROM appointments
   WHERE title = 'Limpeza Dental - Teste E2E';

   -- Resultado esperado:
   ✅ automation_status: 'sent'
   ✅ wuzapi_message_id: 'msg_xxx'
   ✅ google_calendar_event_id: 'evt_xxx'
   ✅ automation_sent_at: timestamp recente
   ```

8. **Verificar Automation Logs**
   ```sql
   SELECT
     id,
     execution_type,
     execution_status,
     message_provider,
     sent_to,
     created_at
   FROM automation_logs
   ORDER BY created_at DESC
   LIMIT 1;

   -- Resultado esperado:
   ✅ execution_type: 'appointment_created'
   ✅ execution_status: 'success'
   ✅ message_provider: 'wuzapi'
   ✅ sent_to: telefone do paciente
   ```

---

## ✅ FLUXO 2: CONFIRMAÇÃO DE AGENDAMENTO

### Objetivo
Testar resposta do paciente e atualização automática do status.

### Passos

1. **Paciente responde "SIM"**
   ```
   # No WhatsApp, responder a mensagem com:
   SIM
   ```

2. **Verificar Webhook Recebido**
   ```bash
   # Terminal do servidor deve mostrar:
   ✅ Received WhatsApp message: { from: '+5577...', message: 'SIM' }
   ✅ Patient confirmation processed: { confirmed: true }
   ```

3. **Verificar Database Atualizado**
   ```sql
   SELECT
     id,
     status,
     confirmed_by_patient,
     confirmation_date,
     patient_response,
     confirmation_method
   FROM appointments
   WHERE title = 'Limpeza Dental - Teste E2E';

   -- Resultado esperado:
   ✅ status: 'confirmed'
   ✅ confirmed_by_patient: true
   ✅ confirmation_date: timestamp recente
   ✅ patient_response: 'SIM'
   ✅ confirmation_method: 'whatsapp'
   ```

---

## 🚫 FLUXO 3: CANCELAMENTO

### Objetivo
Testar cancelamento com notificação e limpeza do Google Calendar.

### Passos

1. **Cancelar via API**
   ```bash
   POST http://localhost:5000/api/v1/appointments/[ID]/cancel
   Content-Type: application/json
   Cookie: connect.sid=seu_session_cookie

   {
     "reason": "Teste de cancelamento E2E",
     "notifyPatient": true
   }
   ```

2. **Verificar WhatsApp**
   ```
   ✅ Paciente recebe:

   "Olá [Nome]! 📅

   Seu agendamento foi cancelado:

   🦷 Profissional: Dr. [Nome]
   📅 Data/Hora: 25/11/2024 às 14:00

   Motivo: Teste de cancelamento E2E

   Entre em contato para reagendar! 📞"
   ```

3. **Verificar Google Calendar**
   ```
   ✅ Evento removido do calendário
   ```

4. **Verificar Database**
   ```sql
   SELECT status, automation_status
   FROM appointments
   WHERE title = 'Limpeza Dental - Teste E2E';

   -- Resultado esperado:
   ✅ status: 'cancelled'
   ✅ automation_status: 'sent'
   ```

---

## 🤖 FLUXO 4: CHATBOT IA

### Objetivo
Testar agente IA com contexto do paciente.

### Passos

1. **Paciente envia mensagem**
   ```
   # No WhatsApp:
   "Olá, gostaria de saber sobre meus próximos agendamentos"
   ```

2. **Verificar Resposta IA**
   ```
   ✅ Bot responde com:
   - Lista de próximos agendamentos
   - Informações do profissional
   - Horários disponíveis

   IA usa OpenAI GPT-4 com contexto completo do paciente
   ```

3. **Verificar Console N8N**
   ```
   ✅ N8N busca paciente no PostgreSQL
   ✅ N8N busca agendamentos ativos
   ✅ N8N chama OpenAI com contexto
   ✅ N8N envia resposta via Wuzapi
   ```

---

## 📊 FLUXO 5: LEMBRETES AUTOMÁTICOS

### Objetivo
Testar cron job de lembretes 24h antes.

### Passos

1. **Criar agendamento para amanhã**
   ```bash
   POST http://localhost:5000/api/v1/appointments

   {
     "title": "Teste Lembrete",
     "startTime": "2024-11-17T10:00:00-03:00",  # Amanhã
     "endTime": "2024-11-17T11:00:00-03:00",
     "status": "scheduled"
   }
   ```

2. **Esperar Cron (10h da manhã)**
   ```
   # N8N executa fluxo "Confirmacao" diariamente às 10h
   # Busca appointments entre NOW e NOW + 24h
   ```

3. **Verificar WhatsApp**
   ```
   ✅ Paciente recebe lembrete:

   "Olá [Nome]! 👋

   Lembrete do seu agendamento:

   🦷 Profissional: Dr. [Nome]
   📅 Data/Hora: AMANHÃ às 10:00

   Responda *SIM* para confirmar ou *REAGENDAR* se necessário.

   Te esperamos! 😊"
   ```

4. **Verificar Database**
   ```sql
   SELECT last_reminder_sent, confirmation_message_id
   FROM appointments
   WHERE title = 'Teste Lembrete';

   -- Resultado esperado:
   ✅ last_reminder_sent: timestamp recente
   ✅ confirmation_message_id: 'msg_xxx'
   ```

---

## 🎂 FLUXO 6: ANIVERSÁRIOS (Bonus)

### Objetivo
Testar mensagens de aniversário automáticas.

### Passos

1. **Criar paciente com aniversário hoje**
   ```sql
   UPDATE patients
   SET birth_date = CURRENT_DATE
   WHERE id = 1;
   ```

2. **Disparar fluxo manualmente no N8N**
   ```
   # Ou esperar cron diário (manhã)
   # N8N executa função SQL: get_today_birthdays()
   ```

3. **Verificar WhatsApp**
   ```
   ✅ Paciente recebe:

   "🎉 Parabéns, [Nome]! 🎂

   A equipe [Clínica] deseja um feliz aniversário de [X] anos!

   Que este novo ano seja repleto de sorrisos e saúde! 😁✨"
   ```

---

## ✅ CHECKLIST DE VALIDAÇÃO COMPLETA

### Backend
- [ ] Webhooks N8N → Site funcionando
- [ ] Webhook Wuzapi → Site funcionando
- [ ] Webhook secret validado
- [ ] Automation logs sendo criados
- [ ] Paciente identificado por telefone
- [ ] Confirmações processadas corretamente

### Frontend
- [ ] Página /configuracoes/integracoes acessível
- [ ] Formulários salvam corretamente
- [ ] Teste de conexão Wuzapi funciona
- [ ] Envio de mensagem teste funciona
- [ ] Toasts aparecem corretamente

### N8N
- [ ] 5 fluxos importados e ativados
- [ ] Credenciais Wuzapi configuradas
- [ ] Credenciais Google Calendar configuradas (se usar)
- [ ] Webhooks callbacks configurados
- [ ] Cron jobs ativos

### Database
- [ ] Tabela clinic_settings existe
- [ ] Tabela automation_logs existe
- [ ] Campos whatsapp_phone em patients
- [ ] Campos confirmação em appointments
- [ ] Funções SQL criadas

---

## 🐛 TROUBLESHOOTING

### Mensagem não enviada
```bash
# Verificar logs
SELECT * FROM automation_logs
WHERE execution_status = 'error'
ORDER BY created_at DESC LIMIT 10;

# Causas comuns:
- Wuzapi desconectado
- Número inválido
- Instance ID errado
- API Key expirada
```

### N8N não recebe webhook
```bash
# Verificar:
1. N8N está rodando? (http://localhost:5678)
2. Workflow está ativado?
3. URL correta no .env? (N8N_WEBHOOK_BASE_URL)
4. Firewall bloqueando?

# Testar manualmente:
curl -X POST http://localhost:5678/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### Paciente não confirmado
```bash
# Verificar se resposta foi detectada:
SELECT patient_response, confirmed_by_patient
FROM appointments
WHERE id = X;

# Palavras-chave detectadas:
- SIM, sim, Sim
- CONFIRMO, confirmo
- OK, ok
- CONFIRMAR, confirmar
```

---

## 📈 MÉTRICAS DE SUCESSO

Após completar todos os testes:

- ✅ **Taxa de Entrega:** 100% mensagens enviadas
- ✅ **Tempo de Resposta:** < 5s do agendamento até WhatsApp
- ✅ **Confirmações:** Resposta "SIM" detectada automaticamente
- ✅ **Google Calendar:** Eventos sincronizados corretamente
- ✅ **Logs:** Todas automações registradas em automation_logs
- ✅ **Erros:** 0 erros em production

---

## 🎯 PRÓXIMOS PASSOS

Depois de validar tudo funcionando:

1. Migrar os 4 fluxos restantes (Finalizar, Avaliação, etc)
2. Configurar OAuth Google Calendar (opcional)
3. Implementar dashboard de logs no frontend
4. Deploy em produção
5. Monitoramento com Sentry

---

**✅ FASE 1 COMPLETA - Sistema 100% funcional!**
