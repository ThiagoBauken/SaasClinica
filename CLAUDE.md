# DentCare — Contexto do projeto para Claude Code

> Este arquivo é carregado automaticamente em toda sessão do Claude Code.
> Ele estabelece o contexto mínimo para qualquer tarefa neste repositório.

## Projeto

**DentCare** — SaaS multi-tenant de gestão de clínicas odontológicas
(agenda, prontuário digital, odontograma, financeiro, CRM WhatsApp com IA,
billing por planos, automações).

## Repositório (monorepo)

- Raiz: `c:\Users\Thiago\Desktop\site clinca dentista`
- Frontend (React 18 + Vite + TS): [client/](client/)
- Backend (Node.js + Express + TS): [server/](server/)
- Schema compartilhado (Drizzle ORM): [shared/schema.ts](shared/schema.ts) — 94 tabelas
- Migrations SQL: [migrations/](migrations/)
- Testes (Vitest): [tests/](tests/)
- Scripts utilitários: [scripts/](scripts/)
- Documentação: [docs/](docs/)

## 📚 Documentação — sempre comece aqui

| Doc | Quando ler |
|---|---|
| [docs/00-index.md](docs/00-index.md) | **Índice mestre** — primeira parada sempre |
| [docs/STATE.md](docs/STATE.md) | **O que foi feito + o que falta** (validado contra código) |
| [docs/FEATURES.md](docs/FEATURES.md) | **Como o sistema funciona** end-to-end por feature |
| `MEMORY.md` (auto-loaded) | Resumo vivo de padrões e gotchas |

Subpastas em `docs/`:
- `docs/architecture/` — ARCHITECTURE.md, API.md, REDIS_E_ESCALABILIDADE.md
- `docs/features/` — BILLING, AUTOMATION_ENGINE, DIGITALIZACAO, PATIENT_IMPORT
- `docs/integrations/` — N8N, Google Calendar, gateways de pagamento, financeiro
- `docs/operations/` — INSTALLATION, DATABASE_SETUP, DOCKER, EASYPANEL, SAAS_SETUP
- `docs/audits/` — SECURITY_AUDIT, LGPD_SECURITY_AUDIT
- `docs/runbooks/` — runbooks de incidente
- `docs/_archive/` — snapshots históricos (~70 arquivos) — **não usar como referência viva**

## Stack travado

- **Backend**: Node.js + Express + TypeScript + Passport.js (Local + Google OAuth) + 2FA TOTP
- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS + ShadcnUI + React Query + Wouter
- **Dados**: PostgreSQL via Drizzle ORM (94 tabelas em `shared/schema.ts`) + RLS
- **Cache / Sessão / Pub-Sub**: Redis (express-session, BullMQ, WebSocket adapter)
- **Filas**: BullMQ (lembretes, dunning, recall, relatórios)
- **Billing**: Stripe + MercadoPago + NOWPayments + PIX (gating em `server/billing/feature-gate.ts`)
- **IA / WhatsApp**: Claude (Anthropic) padrão + fallback Groq/OpenAI/Ollama; agente em [server/services/ai-agent/](server/services/ai-agent/) com 19 tools; providers WhatsApp = Wuzapi / Evolution / Meta Cloud
- **Multi-tenant**: isolamento por `companyId` (middleware `tenantIsolation` + RLS)
- **Deploy**: Docker + EasyPanel ([Dockerfile](Dockerfile))

## Como agir

1. **Mapa mental rápido**: comece por `MEMORY.md` (auto-loaded) +
   [docs/00-index.md](docs/00-index.md) + [docs/STATE.md](docs/STATE.md) +
   [docs/FEATURES.md](docs/FEATURES.md). Só leia docs específicas em
   `docs/architecture/`, `docs/features/`, etc. quando forem relevantes
   à tarefa — **não carregue tudo de uma vez**.

2. **STATE.md é a fonte da verdade sobre o que existe**, mas tem data de
   última verificação. Para perguntas sobre o **código atual**, sempre
   prefira ler o código (`server/`, `client/`, `shared/schema.ts`) em
   vez de confiar só no STATE.md. Se descobrir divergência, **atualize
   o STATE.md** ao terminar.

3. **`docs/_archive/` é histórico**: snapshots de progresso, sprints,
   correções pontuais (~70 arquivos). Boa parte do que afirmavam como
   "pendente" já foi implementado. Use só para arqueologia, nunca como
   referência viva.

4. **Migrations duplicadas conhecidas**: existem variantes `a`/`b` em
   `migrations/` para 003, 004, 010, 014, 015, 022, 023. Confira `git
   status` antes de assumir qual é a fonte da verdade.

5. **Ambiente Windows**: shell padrão é bash (use sintaxe Unix —
   `/dev/null`, barras `/`). PowerShell está disponível via a tool
   `PowerShell` quando necessário. `npm install` requer
   `--legacy-peer-deps`.

6. **Convenções obrigatórias do projeto**:
   - Auth: middlewares `authCheck`, `adminOnly`, `tenantAwareAuth`
     (`= [authCheck, tenantIsolation, resourceAccess]`)
   - Erros: `asyncHandler` + classes (`AppError`, `NotFoundError`, ...)
   - CSRF: double-submit cookie (`_csrf_token` cookie + `x-csrf-token` header)
   - Logs: **Pino estruturado** — não usar `console.log`
   - Feature gating: `server/billing/feature-gate.ts` (checks por plano)
   - **NUNCA** usar fallback `companyId || 1` — é vulnerabilidade de tenant
   - PII em LLM externa: sempre `anonymizePII()` antes + `deanonymizePII()` depois
   - n8n é **legacy** — substituído por Claude direto no AI Agent

7. **Manutenção dos docs**:
   - Doc nova → vai para subpasta apropriada em `docs/`, **nunca raiz**
   - Doc desatualizada → mover para `docs/_archive/` (não deletar)
   - Ao terminar feature ou descobrir pendência → **atualizar
     [docs/STATE.md](docs/STATE.md)** e a data de "Última verificação"

8. **Idioma**: responda sempre em **português (pt-BR)**. Seja conciso.

9. **Aguarde a tarefa do usuário** antes de explorar mais a fundo.
