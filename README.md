# DentCare — SaaS de Gestão de Clínicas Odontológicas

![Licença](https://img.shields.io/badge/license-MIT-blue.svg)

SaaS multi-tenant para clínicas odontológicas que combina **gestão completa**
(agenda, prontuário digital, odontograma, financeiro, próteses, estoque) com uma
**camada de IA conversacional** que atende pacientes pelo WhatsApp 24/7 — agenda,
confirma, reagenda, cobra e move oportunidades pelo CRM automaticamente.

## 📚 Documentação

> 👉 **Comece por [`docs/00-index.md`](docs/00-index.md)** — índice mestre da documentação.

Pontos de entrada rápidos:
- [`docs/STATE.md`](docs/STATE.md) — o que foi feito + o que falta (validado contra o código)
- [`docs/FEATURES.md`](docs/FEATURES.md) — como o sistema funciona end-to-end
- [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md) — arquitetura de alto nível
- [`docs/operations/INSTALLATION.md`](docs/operations/INSTALLATION.md) — setup local
- [`docs/architecture/API.md`](docs/architecture/API.md) — referência REST

## ✨ Principais features

- **Agenda** com visualização dia/semana/mês, drag-drop e bloqueios; lista de espera, recall, agendamentos recorrentes.
- **Prontuário digital** com odontograma, periodontograma, anamnese versionada, planos de tratamento, evolução clínica e assinatura digital.
- **IA conversacional WhatsApp** (Claude por padrão, com fallback Groq/OpenAI/Ollama-local) com 19 tools — agenda, confirma, cancela, reagenda, cobra e progride o CRM automaticamente.
- **CRM Kanban** com auto-progression (`first_contact → scheduling → confirmation → consultation_done → payment_done`).
- **Financeiro** completo: receitas/despesas, contas a pagar/receber, caixa, parcelamentos, comissões, orçamentos com link público.
- **Billing SaaS** multi-gateway: Stripe + MercadoPago + NOWPayments + PIX, com feature gating por plano e dunning automático.
- **Multi-tenant** por `companyId` com Row-Level Security no Postgres.
- **LGPD-first**: 2FA TOTP, auditoria, soft-delete, criptografia de campos sensíveis, anonimização de PII antes de LLMs externas, endpoint de erasure.
- **Integrações**: Google Calendar (OAuth bidirecional), Google Vision (OCR), SendGrid, 3 providers de WhatsApp (Wuzapi / Evolution API / Meta Cloud API).

## 🚀 Stack

- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS + ShadcnUI + React Query + Wouter
- **Backend**: Node.js + Express + TypeScript + Passport.js
- **Banco**: PostgreSQL via Drizzle ORM (94 tabelas em `shared/schema.ts`) + RLS
- **Cache / Sessão / Pub-Sub**: Redis (express-session, BullMQ, WebSocket adapter)
- **Filas**: BullMQ (lembretes, dunning, recall, relatórios)
- **IA**: Anthropic Claude (Haiku padrão, Sonnet para reasoning) + fallback Groq/OpenAI/Ollama
- **Deploy**: Docker + EasyPanel

## 🧩 Estrutura

```
.
├── client/                # Frontend React
├── server/                # Backend Express
│   ├── routes/            # 80+ arquivos de rotas modulares
│   ├── services/          # 25+ services (ai-agent, whatsapp, billing, ...)
│   ├── billing/           # Stripe, MercadoPago, NOWPayments, feature-gate
│   └── middleware/        # auth, RLS, audit, CSRF, 2FA, rate-limit
├── shared/
│   └── schema.ts          # Drizzle schema (94 tabelas)
├── migrations/            # SQL migrations
├── tests/                 # Vitest
├── scripts/               # Utilitários
└── docs/                  # Documentação (ver docs/00-index.md)
```

## 📦 Setup rápido

```bash
npm install --legacy-peer-deps   # ⚠️ flag obrigatória (conflitos de peer deps)
cp .env.example .env             # configurar variáveis (~80 vars documentadas)
npm run db:migrate
npm run dev
```

Setup completo: [`docs/operations/INSTALLATION.md`](docs/operations/INSTALLATION.md).

Setup multi-tenant SaaS: [`docs/operations/SAAS_SETUP.md`](docs/operations/SAAS_SETUP.md).

Deploy em produção: [`docs/operations/EASYPANEL_DEPLOY.md`](docs/operations/EASYPANEL_DEPLOY.md).

## 🔐 Variáveis de ambiente

São ~80 variáveis documentadas em [`.env.example`](.env.example). As essenciais:

```
DATABASE_URL              # PostgreSQL
SESSION_SECRET            # Sessão Express
REDIS_URL                 # Redis
ENCRYPTION_KEY            # Criptografia de campos sensíveis (LGPD)
ANTHROPIC_API_KEY         # IA agent (padrão)
GOOGLE_CLIENT_ID          # OAuth + Calendar
GOOGLE_CLIENT_SECRET
STRIPE_SECRET_KEY         # Billing (opcional, conforme gateway escolhido)
MERCADOPAGO_ACCESS_TOKEN
WUZAPI_URL / EVOLUTION_URL / META_*  # WhatsApp (escolha 1+)
```

## 🤝 Contribuindo

- Convenções de código e padrões obrigatórios estão em [`CLAUDE.md`](CLAUDE.md).
- Antes de abrir PR, rode `npm run check && npm run test`.
- Docs novas: vão para subpastas em `docs/`, nunca para a raiz.

## 📄 Licença

MIT.
