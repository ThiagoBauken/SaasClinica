# DentCare — Índice Mestre da Documentação

> **Última verificação**: 2026-04-29
> **Para IA**: comece sempre por este índice. Só leia docs específicas quando relevantes à tarefa.

---

## 🚀 Para começar

| Doc | Quando ler |
|---|---|
| [README.md](../README.md) | Visão geral e stack — primeira leitura |
| [CLAUDE.md](../CLAUDE.md) | Contexto operacional para IA — sempre carregado |
| [STATE.md](STATE.md) | **O que foi feito + o que falta** (single source of truth) |
| [FEATURES.md](FEATURES.md) | **Como o sistema funciona** end-to-end por feature |

---

## 🏛️ Arquitetura — `docs/architecture/`

| Doc | Conteúdo |
|---|---|
| [ARCHITECTURE.md](architecture/ARCHITECTURE.md) | Diagrama geral, multi-tenancy, IA em 3 camadas, fluxos principais |
| [API.md](architecture/API.md) | Referência das rotas REST |
| [REDIS_E_ESCALABILIDADE.md](architecture/REDIS_E_ESCALABILIDADE.md) | Adapter WebSocket, BullMQ, multi-instância |

---

## ⚙️ Features — `docs/features/`

| Doc | Conteúdo |
|---|---|
| [AUTOMATION_ENGINE.md](features/AUTOMATION_ENGINE.md) | Motor de automações (gatilhos, regras, execução) |
| [BILLING_SYSTEM_DOCS.md](features/BILLING_SYSTEM_DOCS.md) | Planos, gating, ciclos, webhooks de pagamento |
| [DIGITALIZACAO_PRONTUARIOS.md](features/DIGITALIZACAO_PRONTUARIOS.md) | OCR + import de prontuários físicos |
| [PATIENT_IMPORT_GUIDE.md](features/PATIENT_IMPORT_GUIDE.md) | Importação em lote (CSV/Excel) |

---

## 🔌 Integrações — `docs/integrations/`

| Doc | Conteúdo |
|---|---|
| [GUIA_INTEGRACAO_N8N.md](integrations/GUIA_INTEGRACAO_N8N.md) | n8n: setup geral, webhooks, ferramentas |
| [N8N_INTEGRATION.md](integrations/N8N_INTEGRATION.md) | Endpoints `/api/v1/n8n/*` |
| [N8N_MULTIAGENTE_SAAS.md](integrations/N8N_MULTIAGENTE_SAAS.md) | Roteamento multi-tenant n8n |
| [GOOGLE_CALENDAR_INTEGRATION_COMPLETE.md](integrations/GOOGLE_CALENDAR_INTEGRATION_COMPLETE.md) | OAuth + sync bidirecional |
| [FINANCIAL_INTEGRATION_GUIDE.md](integrations/FINANCIAL_INTEGRATION_GUIDE.md) | Conexão com gateways financeiros |
| [PAYMENT_GATEWAYS_SETUP.md](integrations/PAYMENT_GATEWAYS_SETUP.md) | Stripe + MercadoPago + NOWPayments |

> **WhatsApp** (Wuzapi/Evolution/Meta): documentado em `FEATURES.md` e `ARCHITECTURE.md`.

---

## 🛠️ Operações — `docs/operations/`

| Doc | Conteúdo |
|---|---|
| [INSTALLATION.md](operations/INSTALLATION.md) | Setup local completo |
| [QUICK_START.md](operations/QUICK_START.md) | Onboarding rápido |
| [SAAS_SETUP.md](operations/SAAS_SETUP.md) | Setup multi-tenant SaaS |
| [DATABASE_SETUP.md](operations/DATABASE_SETUP.md) | Postgres, Drizzle, migrations |
| [DOCKER_README.md](operations/DOCKER_README.md) | Build e run via Docker |
| [EASYPANEL_DEPLOY.md](operations/EASYPANEL_DEPLOY.md) | Deploy em produção (EasyPanel) |
| [runbooks/README.md](runbooks/README.md) | Runbooks de incidente |

---

## 🔒 Auditorias — `docs/audits/`

| Doc | Conteúdo |
|---|---|
| [SECURITY_AUDIT_REPORT.md](audits/SECURITY_AUDIT_REPORT.md) | Auditoria de segurança |
| [LGPD_SECURITY_AUDIT_REPORT.md](audits/LGPD_SECURITY_AUDIT_REPORT.md) | Conformidade LGPD |

---

## 📦 Arquivo histórico — `docs/_archive/`

Snapshots de progresso, sprints, correções e relatórios pontuais (~70 arquivos).
**Não use como referência viva** — informação pode estar desatualizada.
Mantido apenas para rastreabilidade histórica.

---

## 📝 Convenções para manter este índice

- Toda doc nova vai para uma das pastas acima — **nunca a raiz** (exceto README/CLAUDE).
- Atualize a data de "Última verificação" no topo deste arquivo ao revisar.
- Se uma doc fica desatualizada, **mova para `_archive/`** em vez de manter mentindo.
- `STATE.md` é viva: atualize ao terminar features ou descobrir pendências.
