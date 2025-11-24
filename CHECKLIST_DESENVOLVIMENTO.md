# CHECKLIST DE DESENVOLVIMENTO
## Sistema de Clínica Odontológica - Tarefas Pendentes

---

## 🔴 SPRINT 1 - FUNCIONALIDADES CRÍTICAS (Prioridade Máxima)

### 1. Completar CRUD de Agendamentos
- [ ] **Backend - Editar Agendamento**
  - [ ] Criar endpoint `PATCH /api/v1/appointments/:id`
  - [ ] Validar horários (não conflitar com outros agendamentos)
  - [ ] Atualizar no Google Calendar (se integrado)
  - [ ] Enviar notificação ao paciente sobre mudança
  - [ ] Testar edição completa

- [ ] **Backend - Deletar Agendamento**
  - [ ] Criar endpoint `DELETE /api/v1/appointments/:id`
  - [ ] Remover do Google Calendar (se integrado)
  - [ ] Registrar motivo do cancelamento
  - [ ] Notificar paciente
  - [ ] Soft delete (manter histórico)

- [ ] **Frontend - Conectar modais**
  - [ ] Conectar modal de edição ao endpoint
  - [ ] Conectar modal de exclusão ao endpoint
  - [ ] Atualizar cache do React Query após mudanças
  - [ ] Feedback visual de sucesso/erro

- [ ] **Funcionalidades Adicionais**
  - [ ] Reagendar agendamento
  - [ ] Bloquear horários (férias, almoço)
  - [ ] Marcar como "não compareceu" (no-show)
  - [ ] Status: agendado → confirmado → em andamento → concluído

**Arquivos:**
- `server/routes/appointments.routes.ts`
- `client/src/components/calendar/AppointmentModal.tsx`

---

### 2. Integração N8N (Automações)

- [ ] **Backend - Webhook Trigger**
  - [ ] Criar endpoint `POST /api/webhooks/n8n/trigger`
  - [ ] Enviar dados ao N8N quando agendamento for criado
  - [ ] Payload: paciente, data/hora, profissional, tipo
  - [ ] Headers customizados (autenticação)
  - [ ] Retry em caso de falha

- [ ] **Backend - Webhook Confirmação**
  - [ ] Criar endpoint `POST /api/webhooks/n8n/confirmation`
  - [ ] Receber resposta do paciente (sim/não/talvez)
  - [ ] Atualizar `appointments.confirmedByPatient`
  - [ ] Registrar em `automation_logs`

- [ ] **Service N8N**
  - [ ] Criar `server/services/n8n.service.ts`
  - [ ] Função: `triggerAutomation(appointment)`
  - [ ] Função: `processConfirmation(appointmentId, response)`
  - [ ] Tratamento de erros e logging

- [ ] **Frontend - Dashboard de Automações**
  - [ ] Página de histórico de automações
  - [ ] Listar mensagens enviadas
  - [ ] Status: enviado, entregue, confirmado, erro
  - [ ] Taxa de confirmação (%)
  - [ ] Filtros por período/profissional

- [ ] **Configuração**
  - [ ] Permitir múltiplos webhooks N8N
  - [ ] Templates de mensagem configuráveis
  - [ ] Escolher quando disparar (1h antes, 1 dia antes, etc)

**Arquivos:**
- `server/services/n8n.service.ts` (criar)
- `server/routes/webhooks.routes.ts` (expandir)
- `client/src/pages/automation-dashboard.tsx` (criar)

---

### 3. Integração WhatsApp (Wuzapi)

- [ ] **Backend - Envio de Mensagens**
  - [ ] Criar endpoint `POST /api/whatsapp/send`
  - [ ] Integrar com API Wuzapi
  - [ ] Suportar templates
  - [ ] Suportar botões interativos
  - [ ] Armazenar em tabela `whatsapp_messages`

- [ ] **Backend - Receber Mensagens**
  - [ ] Criar endpoint `POST /api/webhooks/wuzapi/message`
  - [ ] Processar resposta do paciente
  - [ ] Detectar confirmação ("sim", "confirmo", etc)
  - [ ] Atualizar agendamento automaticamente

- [ ] **Backend - Status de Entrega**
  - [ ] Endpoint `POST /api/webhooks/wuzapi/status`
  - [ ] Atualizar status: enviado → entregue → lido
  - [ ] Registrar timestamp de cada etapa

- [ ] **Database - Tabela WhatsApp**
  ```sql
  CREATE TABLE whatsapp_messages (
    id SERIAL PRIMARY KEY,
    company_id INT,
    patient_id INT,
    appointment_id INT,
    phone VARCHAR,
    message TEXT,
    template_name VARCHAR,
    direction VARCHAR, -- outbound, inbound
    status VARCHAR, -- sent, delivered, read, replied
    wuzapi_message_id VARCHAR,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    replied_at TIMESTAMP,
    reply_content TEXT,
    error TEXT,
    created_at TIMESTAMP
  );
  ```

- [ ] **Frontend - Histórico WhatsApp**
  - [ ] Componente de histórico de conversas
  - [ ] Visualizar no prontuário do paciente
  - [ ] Timeline de mensagens
  - [ ] Indicadores de status

**Arquivos:**
- `shared/schema.ts` (adicionar tabela)
- `server/services/wuzapi.service.ts` (expandir)
- `server/routes/whatsapp.routes.ts` (criar)
- `client/src/components/patients/WhatsAppHistory.tsx` (criar)

---

### 4. Sincronização Google Calendar

- [ ] **Backend - OAuth 2.0**
  - [ ] Fluxo de autorização completo
  - [ ] Endpoint `GET /api/integrations/google/auth`
  - [ ] Endpoint `GET /api/integrations/google/callback`
  - [ ] Armazenar tokens por profissional
  - [ ] Refresh automático de tokens

- [ ] **Backend - Sincronização de Ida**
  - [ ] Ao criar agendamento → criar evento no Google
  - [ ] Ao editar agendamento → atualizar evento
  - [ ] Ao deletar agendamento → deletar evento
  - [ ] Salvar `googleCalendarEventId` no appointment

- [ ] **Backend - Sincronização de Volta**
  - [ ] Endpoint `POST /api/webhooks/google-calendar`
  - [ ] Registrar webhook no Google Calendar
  - [ ] Detectar mudanças externas
  - [ ] Atualizar sistema quando evento mudar
  - [ ] Resolução de conflitos (última mudança vence)

- [ ] **Frontend - Configuração**
  - [ ] Botão "Conectar Google Calendar"
  - [ ] Mostrar status da conexão
  - [ ] Escolher quais tipos de agendamento sincronizar
  - [ ] Desconectar

**Arquivos:**
- `server/services/google-calendar.service.ts` (criar)
- `server/routes/integrations.routes.ts` (expandir)
- `client/src/components/calendar/GoogleCalendarSync.tsx` (expandir)

---

### 5. Endpoints Financeiros

- [ ] **Transações Financeiras**
  - [ ] `GET /api/v1/financial/transactions` - Listar com filtros
  - [ ] `POST /api/v1/financial/transactions` - Criar receita/despesa
  - [ ] `PATCH /api/v1/financial/transactions/:id` - Editar
  - [ ] `DELETE /api/v1/financial/transactions/:id` - Deletar

- [ ] **Pagamentos de Pacientes**
  - [ ] `GET /api/v1/patients/:id/payments` - Histórico
  - [ ] `POST /api/v1/patients/:id/payments` - Registrar pagamento
  - [ ] `GET /api/v1/payments/pending` - Pagamentos pendentes
  - [ ] `POST /api/v1/payments/:id/mark-paid` - Marcar como pago

- [ ] **Planos de Pagamento**
  - [ ] `GET /api/v1/payment-plans` - Listar
  - [ ] `POST /api/v1/payment-plans` - Criar plano
  - [ ] `GET /api/v1/payment-plans/:id` - Detalhes
  - [ ] `POST /api/v1/payment-plans/:id/pay-installment` - Pagar parcela

- [ ] **Caixa**
  - [ ] `POST /api/v1/box/open` - Abrir caixa
  - [ ] `POST /api/v1/box/close` - Fechar caixa
  - [ ] `GET /api/v1/box/current` - Caixa atual
  - [ ] `GET /api/v1/box/transactions` - Movimentações do caixa

- [ ] **Relatórios**
  - [ ] `GET /api/v1/financial/reports/daily` - Relatório diário
  - [ ] `GET /api/v1/financial/reports/monthly` - Relatório mensal
  - [ ] `GET /api/v1/financial/reports/by-professional` - Por profissional
  - [ ] `GET /api/v1/financial/reports/by-procedure` - Por procedimento

**Arquivos:**
- `server/routes/financial.routes.ts` (criar)
- `server/services/financial.service.ts` (criar)
- `server/services/payment-plans.service.ts` (criar)

---

## 🟠 SPRINT 2 - FUNCIONALIDADES IMPORTANTES

### 6. Completar Prontuário Digital

- [ ] **Aba Anamnese**
  - [ ] Formulário completo
  - [ ] Endpoint `POST /api/v1/patients/:id/anamnesis`
  - [ ] Endpoint `GET /api/v1/patients/:id/anamnesis`
  - [ ] Templates de anamnese
  - [ ] Salvar rascunhos

- [ ] **Aba Exames**
  - [ ] Upload de arquivos (raio-X, fotos)
  - [ ] Endpoint `POST /api/v1/patients/:id/exams`
  - [ ] Visualizador de imagens
  - [ ] Comparação lado a lado
  - [ ] Download de exames
  - [ ] Integração com armazenamento (S3/Cloudinary)

- [ ] **Aba Plano de Tratamento**
  - [ ] CRUD de planos
  - [ ] Adicionar/remover procedimentos
  - [ ] Calcular orçamento total
  - [ ] Status: proposto → aceito → em andamento → concluído
  - [ ] Endpoint `POST /api/v1/patients/:id/treatment-plans`

- [ ] **Aba Evolução/Prontuário**
  - [ ] Registrar cada consulta
  - [ ] Procedimentos realizados
  - [ ] Materiais utilizados
  - [ ] Observações e notas
  - [ ] Assinatura digital
  - [ ] Timeline visual
  - [ ] Endpoint `POST /api/v1/patients/:id/evolution`

- [ ] **Aba Documentos**
  - [ ] Receitas
  - [ ] Atestados
  - [ ] Contratos
  - [ ] Termos de consentimento
  - [ ] Geração de PDF
  - [ ] Assinatura digital
  - [ ] Endpoint `POST /api/v1/patients/:id/documents`

- [ ] **Aba Financeiro do Paciente**
  - [ ] Histórico de pagamentos
  - [ ] Débitos pendentes
  - [ ] Planos de pagamento ativos
  - [ ] Total gasto
  - [ ] Endpoint `GET /api/v1/patients/:id/financial-summary`

**Arquivos:**
- `client/src/pages/patient-record-page.tsx` (expandir)
- `client/src/components/patients/` (criar vários componentes)
- `server/routes/patients.routes.ts` (adicionar endpoints)

---

### 7. Sistema de Relatórios

- [ ] **Dashboard com Dados Reais**
  - [ ] Substituir dados mockados por queries reais
  - [ ] Faturamento do dia/mês
  - [ ] Agendamentos de hoje
  - [ ] Taxa de comparecimento
  - [ ] Pacientes novos vs recorrentes
  - [ ] Procedimentos mais realizados

- [ ] **Relatórios de Agendamentos**
  - [ ] Taxa de ocupação por profissional
  - [ ] Horários mais agendados
  - [ ] Taxa de confirmação
  - [ ] Taxa de no-show
  - [ ] Tempo médio de consulta
  - [ ] Exportar para Excel/PDF

- [ ] **Relatórios Financeiros**
  - [ ] Faturamento por período
  - [ ] Receitas vs Despesas
  - [ ] Formas de pagamento
  - [ ] Inadimplência
  - [ ] Comissões pagas
  - [ ] DRE (Demonstrativo de Resultado)

- [ ] **Relatórios de Produtividade**
  - [ ] Procedimentos por profissional
  - [ ] Tempo médio por procedimento
  - [ ] Faturamento por profissional
  - [ ] Pacientes atendidos

**Arquivos:**
- `server/routes/reports.routes.ts` (criar)
- `server/services/analytics.service.ts` (criar)
- `client/src/pages/reports-page.tsx` (criar)

---

### 8. Sistema de Notificações

- [ ] **Notificações In-App**
  - [ ] Centro de notificações
  - [ ] Toast/Alert em tempo real
  - [ ] Marcar como lido
  - [ ] Listar não lidas

- [ ] **Notificações por Email**
  - [ ] Integrar SendGrid
  - [ ] Templates HTML
  - [ ] Agendamento confirmado
  - [ ] Lembrete de consulta
  - [ ] Pagamento vencendo

- [ ] **Notificações por SMS**
  - [ ] Integrar Twilio
  - [ ] Templates de SMS
  - [ ] Confirmação de agendamento

- [ ] **Preferências**
  - [ ] Paciente escolhe como receber
  - [ ] Profissional escolhe o que quer saber
  - [ ] Frequência de notificações

- [ ] **Sistema de Fila**
  - [ ] BullMQ para processar envios
  - [ ] Retry automático
  - [ ] Dead letter queue

**Arquivos:**
- `server/services/notification.service.ts` (criar)
- `server/queue/workers/notification-worker.ts` (criar)
- `client/src/components/layout/NotificationCenter.tsx` (criar)

---

### 9. Backend de Próteses

- [ ] **CRUD Completo**
  - [ ] `GET /api/v1/prosthesis` - Listar
  - [ ] `POST /api/v1/prosthesis` - Criar
  - [ ] `PATCH /api/v1/prosthesis/:id` - Editar
  - [ ] `DELETE /api/v1/prosthesis/:id` - Deletar
  - [ ] `PATCH /api/v1/prosthesis/:id/stage` - Mover etapa

- [ ] **Etapas do Kanban**
  - [ ] Aguardando envio
  - [ ] Em laboratório
  - [ ] Retornado
  - [ ] Instalado
  - [ ] Finalizado

- [ ] **Laboratórios**
  - [ ] Expandir CRUD existente
  - [ ] Listar próteses por laboratório
  - [ ] Prazo médio de entrega

- [ ] **Controle Financeiro**
  - [ ] Custo do laboratório
  - [ ] Valor cobrado do paciente
  - [ ] Cálculo de margem

- [ ] **Notificações**
  - [ ] Aviso quando retorna
  - [ ] Alerta de prazo vencendo

**Arquivos:**
- `server/routes/prosthesis.routes.ts` (criar)
- `server/services/prosthesis.service.ts` (criar)

---

## 🟡 SPRINT 3 - FUNCIONALIDADES AVANÇADAS

### 10. Receitas e Atestados (PDF)

- [ ] **Editor de Receitas**
  - [ ] Formulário de receita
  - [ ] Auto-complete de medicamentos
  - [ ] Posologia customizável
  - [ ] Salvar templates

- [ ] **Editor de Atestados**
  - [ ] Formulário de atestado
  - [ ] CID (opcional)
  - [ ] Dias de afastamento

- [ ] **Geração de PDF**
  - [ ] Logo da clínica
  - [ ] Cabeçalho com dados
  - [ ] Assinatura digital
  - [ ] Download
  - [ ] Envio por email/WhatsApp

- [ ] **Histórico**
  - [ ] Listar documentos emitidos
  - [ ] Reimpressão
  - [ ] Vínculo com consulta

**Arquivos:**
- `server/services/pdf-generator.service.ts` (criar)
- `client/src/components/documents/PrescriptionEditor.tsx` (criar)
- `client/src/components/documents/CertificateEditor.tsx` (criar)

---

### 11. Agendamento Online (Link Público)

- [ ] **Página Pública**
  - [ ] URL: `/agendar/[clinic-slug]`
  - [ ] Sem autenticação necessária
  - [ ] Responsiva (mobile-first)

- [ ] **Fluxo de Agendamento**
  - [ ] Escolher profissional
  - [ ] Escolher data
  - [ ] Ver horários disponíveis em tempo real
  - [ ] Preencher dados do paciente
  - [ ] Confirmar agendamento

- [ ] **Configurações**
  - [ ] Ativar/desativar agendamento online
  - [ ] Quais profissionais aceitar
  - [ ] Antecedência mínima (ex: 2 horas)
  - [ ] Horários bloqueados
  - [ ] Confirmação manual ou automática

- [ ] **Backend**
  - [ ] Endpoint `POST /api/public/book`
  - [ ] Validar disponibilidade
  - [ ] Criar paciente se não existir
  - [ ] Criar agendamento
  - [ ] Enviar confirmação

**Arquivos:**
- `client/src/pages/public-booking-page.tsx` (criar)
- `server/routes/public-booking.routes.ts` (criar)

---

### 12. Agenda em Tempo Real (WebSockets)

- [ ] **Socket.io**
  - [ ] Configurar servidor Socket.io
  - [ ] Autenticação de conexão
  - [ ] Salas por clínica

- [ ] **Eventos**
  - [ ] `appointment:created` - Novo agendamento
  - [ ] `appointment:updated` - Agendamento editado
  - [ ] `appointment:deleted` - Agendamento cancelado
  - [ ] `appointment:viewing` - Alguém está visualizando

- [ ] **Frontend**
  - [ ] Conectar ao socket
  - [ ] Ouvir eventos
  - [ ] Atualizar UI em tempo real
  - [ ] Notificação de novo agendamento

- [ ] **Lock Otimista**
  - [ ] Prevenir edição simultânea
  - [ ] Mostrar quem está editando
  - [ ] Resolver conflitos

**Arquivos:**
- `server/websocket.ts` (criar)
- `client/src/lib/socket.ts` (criar)

---

### 13. Marketing e CRM

- [ ] **Campanhas**
  - [ ] Criar campanhas
  - [ ] Segmentação de pacientes
  - [ ] Templates de mensagem
  - [ ] Agendar envio

- [ ] **Tipos de Campanha**
  - [ ] Aniversariantes do mês
  - [ ] Pacientes inativos (>6 meses)
  - [ ] Limpeza semestral
  - [ ] Promoções

- [ ] **Automação**
  - [ ] Após consulta: pesquisa de satisfação
  - [ ] Paciente novo: boas-vindas
  - [ ] Tratamento em andamento: lembretes

- [ ] **Tags de Pacientes**
  - [ ] Sistema de tags customizáveis
  - [ ] Filtrar pacientes por tag
  - [ ] Relatórios por segmento

**Arquivos:**
- `server/routes/campaigns.routes.ts` (criar)
- `server/services/crm.service.ts` (criar)
- `client/src/pages/campaigns-page.tsx` (criar)

---

## 🔵 BACKLOG - Futuro

### 14. Melhorias de Performance
- [ ] Lazy loading de módulos
- [ ] Code splitting
- [ ] Otimização de queries (índices)
- [ ] CDN para assets
- [ ] Service Worker (PWA)
- [ ] Compressão de imagens

---

### 15. Segurança e Compliance
- [ ] LGPD compliance completo
- [ ] Termos de uso
- [ ] Política de privacidade
- [ ] Direito ao esquecimento
- [ ] Exportar dados do paciente
- [ ] Audit log completo
- [ ] 2FA
- [ ] Criptografia de dados sensíveis

---

### 16. Testes
- [ ] Testes unitários (Frontend)
- [ ] Testes unitários (Backend)
- [ ] Testes de integração
- [ ] Testes E2E (Playwright)
- [ ] CI/CD pipeline
- [ ] Cobertura de código >70%

---

### 17. Monitoramento
- [ ] APM (New Relic/Datadog)
- [ ] Logs centralizados
- [ ] Alertas automáticos
- [ ] Health checks detalhados
- [ ] Métricas de negócio

---

### 18. Features Futuras
- [ ] App mobile (React Native)
- [ ] Multi-unidade (rede de clínicas)
- [ ] NFS-e
- [ ] Telemedicina
- [ ] Gamificação
- [ ] Integração com laboratórios

---

## 📊 PROGRESSO GERAL

**Total de Tarefas:** ~150+
**Concluídas:** ~45
**Progresso:** ██████░░░░ ~30%

### Por Sprint
- Sprint 1 (Crítico): ░░░░░░░░░░ 0%
- Sprint 2 (Importante): ░░░░░░░░░░ 0%
- Sprint 3 (Avançado): ░░░░░░░░░░ 0%

---

## 🎯 META

**MVP Completo em:** 8-10 semanas
- Sprint 1: 3 semanas
- Sprint 2: 3 semanas
- Sprint 3: 2-4 semanas

---

**Última atualização:** 2025-11-15
**Projeto:** Sistema de Gestão de Clínica Odontológica

---

## 📝 NOTAS

- Marque com [x] conforme for completando as tarefas
- Priorize sempre os itens de 🔴 SPRINT 1
- Teste cada funcionalidade antes de marcar como concluída
- Documente mudanças importantes
- Commit frequente com mensagens descritivas
