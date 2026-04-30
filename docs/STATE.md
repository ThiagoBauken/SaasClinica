# DentCare — Estado de Implementação (STATE)

> **Última verificação**: 2026-04-29 (validado contra código + git log)
> **Como manter este doc**: ao terminar uma feature, mova de "Em progresso" → "Implementado". Ao descobrir uma pendência real, adicione em "Pendente". Atualize a data acima ao revisar.

---

## ✅ Implementado e estável (validado pelo código)

### Núcleo SaaS multi-tenant
- [x] Cadastro/login com Passport (local + Google OAuth)
- [x] **2FA TOTP** ([server/middleware/enforce-2fa.ts](../server/middleware/enforce-2fa.ts) + [server/services/totp-service.ts](../server/services/totp-service.ts), migration `017b_mfa_totp.sql`)
- [x] Multi-tenant por `companyId` com middleware `tenantIsolation`
- [x] **Row-Level Security** no Postgres (migrations `018_row_level_security.sql`, `023b_phase1_complete_rls.sql`)
- [x] Sessão em Redis com `connect-redis`
- [x] CSRF double-submit cookie
- [x] Rate-limiting por IP e por API key
- [x] **API Keys** para integrações externas
- [x] Onboarding wizard + trial de 14 dias
- [x] Auditoria LGPD (`audit_logs`) + endpoint de erasure
- [x] Criptografia de campos sensíveis (`ENCRYPTION_KEY`)
- [x] Soft-delete em tabelas críticas (migration `019_add_deleted_at_columns.sql`)
- [x] Email verification (migration `031_email_verification_and_lgpd.sql`)

### Pacientes & prontuário
- [x] CRUD completo de pacientes ([patients.routes.ts](../server/routes/patients.routes.ts))
- [x] **Importação em massa** XLSX/CSV ([patient-import.routes.ts](../server/routes/patient-import.routes.ts))
- [x] **Digitalização/OCR** de prontuários físicos via Google Vision ([patient-digitization.routes.ts](../server/routes/patient-digitization.routes.ts))
- [x] **Anamnese versionada** (migration `028_anamnesis_versioning.sql`)
- [x] **Anamnese pública** (link enviado ao paciente)
- [x] **Odontograma digital** ([odontogram-page.tsx](../client/src/pages/odontogram-page.tsx))
- [x] **Periodontograma**
- [x] Plano de tratamento + plano detalhado
- [x] Evolução clínica + assinatura digital
- [x] Exames (raio-X, fotos)
- [x] Documentos (receitas, atestados, contratos PDF)
- [x] Antes/depois (`before_after_photos`)
- [x] **Portal do paciente** ([patient-portal-page.tsx](../client/src/pages/patient-portal-page.tsx))

### Agenda
- [x] CRUD completo de agendamentos
- [x] Visualização dia/semana/mês com drag-drop
- [x] Bloqueios de horário
- [x] **Lista de espera** (`waitlist`, migration `022b_waitlist.sql`)
- [x] **Recall** (retorno periódico de pacientes)
- [x] **Agendamentos recorrentes**
- [x] **Booking público** ([public-booking.routes.ts](../server/routes/public-booking.routes.ts))
- [x] WebSocket broadcast em tempo real (multi-instância via Redis adapter)

### Tratamento & procedimentos
- [x] Catálogo de procedimentos
- [x] Planos de tratamento (múltiplas fases)
- [x] **Próteses** com kanban (laboratório)
- [x] Etiquetas/rótulos de próteses
- [x] **Comissões** por profissional/procedimento

### Financeiro
- [x] Fluxo de caixa, receitas, despesas ([financial.routes.ts](../server/routes/financial.routes.ts))
- [x] Contas a pagar/receber
- [x] **Caixa** (open/close, transactions)
- [x] **Parcelamentos** (`installments.routes.ts`)
- [x] **Cobranças por paciente** (`patient-payments.routes.ts`)
- [x] Conciliação bancária básica (`financial-integration.routes.ts`)
- [x] **Orçamentos** com link público (`quotes.routes.ts`)

### Billing SaaS
- [x] **Stripe** ([server/billing/stripe-service.ts](../server/billing/stripe-service.ts))
- [x] **MercadoPago** ([server/billing/mercadopago-service.ts](../server/billing/mercadopago-service.ts))
- [x] **NOWPayments** (cripto)
- [x] **PIX direto**
- [x] Planos com tiers + feature gating ([feature-gate.ts](../server/billing/feature-gate.ts))
- [x] **Cupons de desconto**
- [x] Trial automático
- [x] **Dunning** (cobrança de inadimplentes via BullMQ)
- [x] **Metering de tokens IA** (migration `029_ai_token_metering.sql`)
- [x] Webhook idempotency

### CRM & Vendas
- [x] **Pipeline Kanban** com drag-and-drop
- [x] **Auto-progression** (`crm-auto-progression.ts`) — IA move oportunidades
- [x] Vinculação `salesOpportunities.chatSessionId` ↔ WhatsApp
- [x] Estágios: first_contact → scheduling → confirmation → consultation_done → payment_done
- [x] Tarefas de vendedor
- [x] Logs de reativação
- [x] **Campanhas** (aniversário, reativação, promoções)

### IA Agent (WhatsApp)
- [x] **Claude direto** ([server/services/ai-agent/](../server/services/ai-agent/)) — substituiu n8n
- [x] **19 tools** (lookup, schedule, confirm, cancel, reschedule, payment, etc)
- [x] System prompt customizado por clínica
- [x] **Memória de conversa** em Redis
- [x] **FAQ cache** (resposta sub-segundo sem LLM)
- [x] **Usage limiter** por plano
- [x] **Prompt snapshots** para debugging
- [x] **Anti-prompt-injection** (6 camadas) + canary tokens
- [x] **PII anonymization** antes de LLM externa (LGPD)
- [x] **Filtros médicos** (não dar diagnóstico)
- [x] **Fallback chain de LLMs**: Ollama → Groq → Claude → OpenAI

### Comunicação
- [x] **WhatsApp via 3 providers**: Wuzapi, Evolution API, Meta Cloud API
- [x] Inbox unificado com IA ([chat-inbox-page.tsx](../client/src/pages/chat-inbox-page.tsx))
- [x] Chat interno entre equipe (office-chat)
- [x] Upload de mídia em chat
- [x] Notificações em tempo real (WebSocket)

### Integrações
- [x] **Google Calendar** OAuth bidirecional ([google-calendar.routes.ts](../server/routes/google-calendar.routes.ts))
- [x] **Google Vision** OCR
- [x] Webhooks de gateways (Stripe, MP, NOWPayments)
- [x] Webhooks WhatsApp (3 providers)
- [x] Email transacional (SendGrid)

### Automações
- [x] Engine de automações ([AUTOMATION_ENGINE.md](features/AUTOMATION_ENGINE.md))
- [x] BullMQ workers (lembretes, dunning, recall, relatórios)
- [x] Templates de mensagem com variáveis
- [x] Logs de execução (`automation_logs`)

### Relatórios & Analytics
- [x] Relatório executivo (DRE) — migration `023a_executive_reports.sql`
- [x] Relatórios de receita, comissão, no-show
- [x] Dashboards de KPIs
- [x] Geração de PDF
- [x] Risk alerts (churn, inadimplência)

### Infraestrutura
- [x] Logs estruturados com **Pino**
- [x] Tracing distribuído (OpenTelemetry)
- [x] **Sentry** (opcional via `SENTRY_DSN`)
- [x] Slow query monitor
- [x] Distributed locks
- [x] **Read replica** support no DB layer
- [x] Cache protection (stampede)
- [x] Health checks (`/health`)
- [x] Runbooks ([docs/runbooks/](runbooks/))
- [x] CI/CD (GitHub Actions) ([.github/workflows/ci.yml](../.github/workflows/ci.yml))
- [x] Docker + EasyPanel deploy
- [x] **39 testes** Vitest

---

## 🟡 Em progresso / parcial

| Item | Status | Evidência |
|---|---|---|
| **Migrations duplicadas** (003a/b, 010a/b, 014a/b/b, 015b/b, etc) | Precisa unificação | git status mostra deletions+new files pendentes |
| **NF-e (Nota Fiscal Eletrônica)** | Schema pronto (`fiscal_settings`), integração com prefeitura ausente | tabelas existem, faltam services |
| **Multi-unidade centralizada** | Multi-tenant existe, mas dashboard consolidado entre múltiplas clínicas de um mesmo grupo não está pronto | — |
| **HTML→PDF avançado** | TODO em [pdf-generator.service.ts:243](../server/services/pdf-generator.service.ts#L243) |
| **Refactor de `server/routes.ts` monolítico** | Várias rotas modulares já extraídas, mas o `routes.ts` ainda tem 1500+ linhas | MEMORY.md menciona |
| **Limpeza de `companyId \|\| 1`** | Várias correções já feitas (notavelmente em integrations.routes.ts), validar exhaustivamente | git log: "Fixed companyId \|\| 1 security fallback" |

---

## ❌ Pendente / roadmap

### Curto prazo (próximos meses, sem urgência)
- [ ] **Telemedicina/teleconsulta** — schema existe mas não há video integrado
- [ ] **NF-e completa** (integração com prefeitura, geração XML, envio por email)
- [ ] **App mobile React Native** (apenas web hoje)
- [ ] **PWA / Service Worker** para offline parcial
- [ ] **Estoque avançado**: alertas de validade, FIFO, ordem de compra automática, consumo por procedimento com baixa automática
- [ ] **Termo de consentimento digital** com canvas + assinatura jurídica validada
- [ ] **Ranking/gamificação** de pacientes assíduos / programa de indicação

### Melhorias técnicas pendentes
- [ ] Cobertura de testes >70% (hoje em ~39 testes — escala ainda pequena)
- [ ] Testes E2E (Playwright) para jornadas críticas
- [ ] APM (New Relic ou Datadog) — Sentry só captura erros
- [ ] Logs centralizados (ELK/Loki) — hoje só Pino local
- [ ] Otimização de bundle frontend (lazy-load mais agressivo)
- [ ] CDN para assets estáticos
- [ ] Compressão automática de imagens no upload (WebP)

### Limpeza / dívida técnica conhecida
- [ ] **Unificar migrations duplicadas** (003a/b, 004a/b, 010a/b, 014a/b/b, 015b/b, 017/17b, 018/18b, 022a/b, 023a/b/c)
- [ ] **Quebrar `server/routes.ts`** em arquivos menores (já está parcialmente modular)
- [ ] **Remover campos legacy n8n** de `clinic_settings` (`n8n_api_key`, `n8n_instance_url`) após confirmar que ninguém usa
- [ ] Auditar últimas ocorrências de `console.log` (substituir por Pino)
- [ ] Remover OpenAI key legacy de `companies` (migrations 005, 014a) se não mais usado

---

## 📌 Como saber se algo está implementado

A regra padrão: **se está nesta lista como `[x]`, foi validado por leitura de código em 2026-04-29**. Se você está prestes a recomendar alguma dessas features ao usuário e a janela é > 30 dias, valide com:

```bash
# Existe arquivo?
ls server/routes/{nome}.routes.ts

# Existe rota registrada?
grep -r "router\.\(get\|post\|patch\|delete\)" server/routes/{nome}.routes.ts

# Existe migration aplicada?
ls migrations/ | grep {assunto}
```

Quando em dúvida, **prefira ler o código a confiar neste doc**. Esta é a fonte da verdade só *naquele momento*.

---

## 📚 Histórico (anterior a esta consolidação)

Os docs antigos `MELHORIAS_PENDENTES.md`, `PENDENCIAS_FLUXOS_N8N.md`, `STATUS_*`, `PROGRESSO_*`, `ENTREGA_*`, `IMPLEMENTACAO_*` foram movidos para [_archive/](_archive/). Não os use como referência atual — boa parte do que listavam como pendente já foi entregue (notavelmente: financeiro, WhatsApp, IA agent, n8n→Claude, LGPD, 2FA).
