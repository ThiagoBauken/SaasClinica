# DentCare — Como o Sistema Funciona (FEATURES)

> **Última verificação**: 2026-04-29 (validado contra código atual)
> **Para IA**: este doc descreve fluxos end-to-end. Sempre confirme com o código antes de afirmar comportamento — pode haver refactors após esta data.

---

## 🎯 Visão de produto em 1 parágrafo

DentCare é um SaaS multi-tenant para clínicas odontológicas que combina **gestão completa** (agenda, prontuário digital, odontograma, financeiro, próteses, estoque) com uma **camada de IA conversacional** que atende pacientes pelo WhatsApp 24/7 — agenda, confirma, reagenda, cobra e move oportunidades pelo CRM automaticamente. Cada clínica é um `companyId` isolado por Row-Level Security; o sistema escala via Redis/BullMQ e aceita 3 provedores de WhatsApp e 4 LLMs (Claude padrão, com fallback Groq/OpenAI/Ollama-local).

---

## 🏛️ Arquitetura em 3 camadas

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (client/) — React 18 + Vite + Wouter + shadcn/ui │
│  ~70 páginas: dashboard, agenda, prontuário, CRM, billing  │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST + WebSocket
┌──────────────────────▼──────────────────────────────────────┐
│  BACKEND (server/) — Express + TypeScript                   │
│  • 80+ arquivos de rotas em server/routes/                  │
│  • 25+ services (IA, WhatsApp, pagamentos, automação)       │
│  • Middleware: auth, RLS, audit, rate-limit, CSRF, 2FA     │
│  • BullMQ workers: lembretes, dunning, recall, relatórios  │
└───┬───────┬───────┬───────┬───────┬───────┬─────────────────┘
    │       │       │       │       │       │
 Postgres Redis  S3/MinIO BullMQ  WhatsApp  LLMs
 94 tabs  cache  arquivos  filas  3 provid. 4 modelos
 Drizzle  RLS    fotos     jobs   Wuzapi/   Claude/Groq/
 +RLS     pubsub OCR              Evol/     OpenAI/Ollama
                                  Meta
```

**Multi-tenancy**: toda query filtra por `companyId`. RLS no Postgres garante isolamento mesmo em raw SQL. Cache Redis usa namespace `{companyId}:`.

---

## 🚪 Jornadas do usuário

### A) Onboarding de uma nova clínica

```
1. Landing page (/landing) → CTA "Começar grátis"
2. /signup → cria users + companies (trial_ends_at = +14 dias)
   → cria subscription "trial" automaticamente
3. /onboarding wizard:
   • Dados da clínica (nome, CNPJ, endereço, telefone)
   • Horários de funcionamento
   • Cadastro do(s) profissional(is)
   • Cadastro de salas
   • Conexão WhatsApp (escolhe provider: Wuzapi/Evolution/Meta)
4. /dashboard (vazio inicial)
5. Após 14 dias: /billing força escolha de plano e pagamento
```

**Arquivos-chave**: [server/auth.ts](../server/auth.ts), [server/routes/saas.routes.ts](../server/routes/saas.routes.ts), [client/src/pages/auth-page.tsx](../client/src/pages/auth-page.tsx)

---

### B) Paciente agenda consulta — 3 caminhos

#### B.1 — Recepção agenda manualmente
```
Recepção em /agenda → "Nova consulta"
  ↓
POST /api/v1/appointments
  ↓
INSERT em appointments + appointment_procedures
  ↓
WebSocket broadcast → todos os usuários da clínica veem
  ↓
WhatsApp confirmação automática (via provider configurado)
```

#### B.2 — Paciente usa link público
```
Paciente abre /agendar/{companyId} (link compartilhado)
  ↓
public-booking-page.tsx → preenche nome, telefone, horário
  ↓
POST /api/v1/public-booking → valida disponibilidade
  ↓
Cria appointment + chat_session + opportunity (CRM)
  ↓
WhatsApp de confirmação
```

#### B.3 — Paciente conversa com a IA no WhatsApp ⭐
```
Paciente envia "quero marcar limpeza terça"
  ↓
Webhook do provider (Wuzapi/Evolution/Meta) →
  /api/webhooks/{provider}/{companyId}
  ↓
activation-check.ts: clínica está ativa? IA habilitada?
  ↓
ai-agent/index.ts (loop principal, máx 8 rounds de tool-use):
  • loadConversationState() — histórico Redis + memória
  • loadClinicContext() — config da clínica + system prompt customizado
  • Claude chama tools conforme necessário:
      → lookup_patient (busca por telefone)
      → check_availability (horários livres)
      → schedule_appointment (agenda)
      → confirm_appointment, cancel_appointment, reschedule_appointment
      → list_procedures, list_professionals, get_clinic_info
      → move_crm_stage, transfer_to_human
      → save_patient_intake, generate_payment_link
      → consultation_completed, payment_completed
      → generate_confirmation_link, update_patient_tags
  • anonymizePII() antes de enviar a LLMs externas (LGPD)
  • saveConversationState() + trackAIUsage() para metering
  ↓
Resposta humanizada ao paciente
  ↓
crm-auto-progression.ts move opportunity:
  first_contact → scheduling → confirmation → consultation_done → payment_done
```

**Arquivos-chave**: [server/services/ai-agent/](../server/services/ai-agent/), [server/services/crm-auto-progression.ts](../server/services/crm-auto-progression.ts)

---

### C) Atendimento clínico (consulta presencial)

```
1. Dentista abre prontuário do paciente em /pacientes/:id
2. Abas disponíveis:
   • Identificação (dados pessoais, contato, LGPD)
   • Anamnese (versionada — anamnesis_versions)
   • Odontograma (odontogram_entries — visual interativo)
   • Periodontograma (periodontal_chart)
   • Plano de tratamento (treatment_plans + procedures)
   • Evolução clínica (treatment_evolution + assinatura digital)
   • Exames (raio-X, fotos antes/depois)
   • Documentos (receitas, atestados, contratos PDF)
   • Financeiro do paciente (cobranças, parcelas)
3. Procedimentos executados → appointment_procedures atualiza
4. Comissão calculada automaticamente (commission_records)
5. Próteses se aplicável → kanban em /prosthesis-control
```

---

### D) Cobrança e financeiro

#### D.1 — Cobrança ao paciente
```
Tratamento concluído → quote/treatment_plan
  ↓
Recepção gera link de pagamento → patient_payments
  ↓
Paciente paga via Stripe / MercadoPago / PIX / NOWPayments
  ↓
Webhook do gateway → /api/webhooks/{stripe,mercadopago,...}
  ↓
Atualiza payment_status + appointment.payment_done = true
  ↓
crm-auto-progression move opportunity para "payment_done"
```

#### D.2 — Cobrança SaaS (plano da clínica)
```
Trial expira (dia 14) → /billing
  ↓
Clínica escolhe plano (Starter / Pro / Enterprise)
  ↓
POST /api/v1/saas/create-checkout → gera sessão no gateway
  ↓
Pagamento confirmado → subscriptions.status = "active"
  ↓
companyModules ativados conforme tier do plano
  ↓
Feature gating em server/billing/feature-gate.ts trava/libera
  features baseado no plano (ex: IA WhatsApp = Pro+)
```

**Dunning** (cobrança de inadimplentes): [server/services/dunning-service.ts](../server/services/dunning-service.ts) roda via BullMQ.

---

### E) Automações & Lembretes

```
BullMQ Cron Jobs (server/queue/workers/):
  • Diário 08h: buscar appointments de amanhã não confirmados
                → enviar lembrete WhatsApp/SMS/email
  • Hourly: dunning (faturas em atraso)
  • Hourly: recall (pacientes 6 meses sem voltar)
  • Aniversário, NPS pós-consulta, reativação
```

**Configuração**: tabela `automations` (gatilhos + ações) + interface em `/automation`.

---

### F) Geração de relatórios

```
/relatorios → seleciona tipo + período
  ↓
reports.routes.ts → executive-report.service.ts
  ↓
Queries agregadas em Postgres (read-replica se configurado)
  ↓
PDF gerado via pdf-generator.service.ts
  ↓
Download direto OU envio por email
```

**Tipos**: receita, faturamento por dentista, taxa de no-show, taxa de aceitação, comissões, fluxo de caixa, NF-e (parcial).

---

## 🔌 Camada de integrações

### WhatsApp — 3 providers
| Provider | Oficial? | Self-host? | Service file |
|---|---|---|---|
| **Wuzapi** | Não | Sim | `whatsapp.service.ts` |
| **Evolution API** | Não | Sim | `evolution-api.service.ts` |
| **Meta Cloud API** | Sim | Não | `meta-webhook.routes.ts` |

Todos abstraídos por [server/services/whatsapp-provider.ts](../server/services/whatsapp-provider.ts).

### LLMs — 4 modelos com fallback chain
1. **Ollama** (local) — usado primeiro se disponível e LGPD-strict
2. **Groq** — fallback rápido/barato
3. **Anthropic Claude** (`claude-haiku-4-5` padrão, `claude-sonnet-4-6` para casos complexos)
4. **OpenAI** — último recurso

Configurável por clínica em `/configuracoes/ia`. Cada clínica pode trazer sua própria API key.

### Pagamentos — 4 gateways
| Gateway | Métodos | Região |
|---|---|---|
| Stripe | Cartão | Internacional |
| MercadoPago | Cartão, Pix, Boleto | Brasil |
| NOWPayments | Cripto | Global |
| PIX direto | Transferência instantânea | Brasil |

### Outros
- **Google Calendar**: OAuth bidirecional (sync → e ←)
- **Google Vision**: OCR de prontuários físicos / RG / CPF
- **SendGrid**: emails transacionais
- **Twilio / SMS provider**: SMS opcional
- **n8n** (legacy): substituído por Claude direto, mas campos `n8n_*` ainda existem em `clinic_settings` para tenants antigos

---

## 🔒 Segurança & LGPD

| Camada | Implementação |
|---|---|
| **Auth** | Passport (local + Google OAuth) + sessão Redis |
| **2FA** | TOTP (RFC 6238) em [server/middleware/enforce-2fa.ts](../server/middleware/enforce-2fa.ts) + [server/services/totp-service.ts](../server/services/totp-service.ts) |
| **Multi-tenant** | Middleware `tenantIsolation` + RLS no Postgres |
| **CSRF** | Double-submit cookie (`_csrf_token` + `x-csrf-token`) |
| **Rate-limit** | Por IP e por API key, mais agressivo em rotas públicas e WhatsApp |
| **Auditoria LGPD** | `audit_logs` (Art. 37) + endpoint de erasure ("direito ao esquecimento") |
| **Criptografia** | Campos sensíveis (CPF, dados de saúde) com `ENCRYPTION_KEY` |
| **PII em IA** | `anonymizePII` antes de chamar LLM externo + `deanonymizePII` na resposta |
| **Prompt injection** | `detectPromptInjection` + canary tokens + filtros de output |
| **Soft-delete** | `deleted_at` em tabelas críticas (não destrói dados) |

---

## 🧠 IA Agent — detalhamento

**Localização**: [server/services/ai-agent/](../server/services/ai-agent/)

**Componentes**:
- `index.ts` — loop principal (orchestrator)
- `dental-tools.ts` — declaração das 19 tools
- `tool-executor.ts` — executa tool calls com validação RLS
- `system-prompt.ts` — prompt customizado por clínica
- `conversation-memory.ts` — memória de conversa em Redis
- `faq-cache.ts` — cache de FAQs frequentes (resposta sub-segundo, sem LLM)
- `usage-limiter.ts` — limite de tokens por plano/companyId
- `prompt-snapshots.ts` — snapshots para debugging e replay

**Modelo padrão**: `claude-haiku-4-5-20251001` (rápido + barato). Sonnet 4.6 para reasoning complexo.

**Tools disponíveis** (referência rápida):

| Categoria | Tools |
|---|---|
| Pacientes | `lookup_patient`, `save_patient_intake`, `update_patient_tags` |
| Agenda | `check_availability`, `schedule_appointment`, `confirm_appointment`, `cancel_appointment`, `reschedule_appointment`, `request_cancel_confirmation`, `get_patient_appointments` |
| Catálogo | `list_procedures`, `list_professionals`, `get_clinic_info` |
| CRM | `move_crm_stage`, `transfer_to_human` |
| Pagamento | `generate_payment_link`, `payment_completed` |
| Marcos | `consultation_completed`, `generate_confirmation_link` |

---

## 📂 Onde editar o quê (cheat-sheet)

| Tarefa | Arquivos |
|---|---|
| Adicionar rota REST | `server/routes/{dominio}.routes.ts` + registrar em `server/routes.ts` |
| Adicionar página | `client/src/pages/{nome}.tsx` + rota em `client/src/App.tsx` |
| Adicionar tabela | `shared/schema.ts` + migration em `migrations/{NNN}_*.sql` |
| Adicionar tool de IA | `server/services/ai-agent/dental-tools.ts` + handler em `tool-executor.ts` |
| Adicionar gateway pgto | `server/billing/{nome}-service.ts` + registrar em `payment-gateway.service.ts` |
| Adicionar provider WhatsApp | implementar interface em `whatsapp-provider.ts` |
| Adicionar feature gate | adicionar check em `server/billing/feature-gate.ts` |
| Configurar automação BullMQ | `server/queue/workers/{nome}-worker.ts` |
| Runbook de incidente | `docs/runbooks/{nome}.md` |

---

## 🔗 Para mais profundidade

- **Arquitetura formal**: [docs/architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md)
- **Rotas REST detalhadas**: [docs/architecture/API.md](architecture/ARCHITECTURE.md)
- **Billing**: [docs/features/BILLING_SYSTEM_DOCS.md](features/BILLING_SYSTEM_DOCS.md)
- **Automações**: [docs/features/AUTOMATION_ENGINE.md](features/AUTOMATION_ENGINE.md)
- **WhatsApp/n8n histórico**: [docs/integrations/](integrations/)
- **Estado de implementação**: [STATE.md](STATE.md)
