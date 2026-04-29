# Plano de Implementação — Correções da Auditoria

**Data:** 2026-04-08 (atualizado 2026-04-10)
**Base:** `PROMPT_AUDITORIA.md` (67 achados: 4 CRITICAL, 13 HIGH, 37 MEDIUM, 13 LOW)

---

## ✅ JÁ EXECUTADO — SESSÃO 7 (2026-04-11 final, signature tests + chat split)

### Testes de webhook signature verification (HMAC timing-safe)
- [tests/server/webhook-signatures.test.ts](tests/server/webhook-signatures.test.ts) — **8 testes**: MercadoPago (accept válido, reject wrong hash, reject formato inválido, reject sem secret, reject length mismatch) e NOWPayments (accept válido, reject tampered payload, reject length mismatch).

### Chat routes split
- [server/routes/chat-media.routes.ts](server/routes/chat-media.routes.ts) — sub-router com GET `/:messageId` (inline) e GET `/download/:messageId`. ~165 linhas extraídas com path-traversal guards preservados.
- [server/routes/chat.routes.ts](server/routes/chat.routes.ts) — 1153 → 1012 linhas (-141). Montado via `router.use('/media', chatMediaRouter)`.

### Verificações
- `tsc --noEmit` = **zero erros**
- Suíte: **272 testes passando em 14 arquivos** (8 novos + mantém os 264 anteriores)

---

## ✅ JÁ EXECUTADO — SESSÃO 6 (2026-04-11 cont., split adicional + testes de repository)

### CRM routes split
- [server/routes/crm-seed.routes.ts](server/routes/crm-seed.routes.ts) — sub-router com POST `/seed-stages` e POST `/seed-test-data` (130 linhas extraídas).
- [server/routes/crm.routes.ts](server/routes/crm.routes.ts) — 1089 → 963 linhas. Mounted via `router.use('/', crmSeedRouter)`.

### Integrations AI Agent split
- [server/routes/integrations-ai.routes.ts](server/routes/integrations-ai.routes.ts) — sub-router com GET `/health`, GET `/status`, POST `/toggle` (230 linhas extraídas). Health checks em paralelo para Anthropic/OpenAI/Ollama.
- [server/routes/integrations.routes.ts](server/routes/integrations.routes.ts) — 1344 → 1114 linhas. Mounted via `router.use('/ai-agent', integrationsAiRouter)`.

### Teste de AppointmentRepository
- [tests/server/appointment-repository.test.ts](tests/server/appointment-repository.test.ts) — 5 testes: valida que `getAppointments` NÃO chama `.limit()` sem filtro; chama `.limit()`+`.offset()` quando filtros fornecidos; `countAppointments` retorna o count correto incluindo 0 rows.

### Verificações
- `tsc --noEmit` = **zero erros**
- Suíte completa: **264 testes passando em 13 arquivos** (17 novos testes totais nas sessões 5-6)

---

## ✅ JÁ EXECUTADO — SESSÃO 5 (2026-04-11, testes + split parcial)

### Testes para fixes críticos (5 novos testes, 12 assertions)
- [tests/server/webhook-idempotency.test.ts](tests/server/webhook-idempotency.test.ts) — valida que Stripe dedupa por `event.id` mesmo com signatures diferentes; MercadoPago por `x-request-id`; NOWPayments por `payment_id`; fallback por hash.
- [tests/server/feature-gate.test.ts](tests/server/feature-gate.test.ts) — superadmin bypass, 401 sem companyId, feature presente/ausente, fail-closed em erro de DB.
- [tests/server/usage-limiter.test.ts](tests/server/usage-limiter.test.ts) — plano com `inputLimit === 0` nega acesso; erro do Redis nega acesso (fail-closed).
- **12/12 assertions passando**; suíte total = 259 testes em 12 arquivos.

### Split parcial de rotas
- Análise feita de `integrations.routes.ts` (1344 linhas, 26 rotas, 7 grupos) e `crm.routes.ts` (1089 linhas, 21 rotas, 6 grupos). Split adiado para futuro sprint por não ter ganho claro versus risco de regressão — documentado no plano.

### Verificações
- `tsc --noEmit` = **zero erros**.
- `vitest run` = **259 passing**.

---

## ✅ JÁ EXECUTADO — SESSÃO 4 (2026-04-11, 7 correções)

### Frontend: code splitting + error boundaries
- [client/src/App.tsx](client/src/App.tsx) — 12 páginas pesadas (>1000 linhas cada) convertidas para `React.lazy()`: `InventoryPage` (2418), `ConfiguracoesClinicaPage` (2144), `AgendaPage` (2008), `FinancialPage` (1486), `AjudaPage` (1441), `SuperAdminPage` (1421), `ConfiguracoesChatPage` (1211), `ChatInboxPage` (1067), `CRMPage`, `RelatoriosPage`, `PatientDigitizationPage`, `AnalyticsPage`.
- [client/src/App.tsx](client/src/App.tsx) — todas as rotas protegidas envolvidas em `<PageErrorBoundary>` para isolar crashes por página.
- [client/src/lib/protected-route.tsx](client/src/lib/protected-route.tsx) — tipo `component` aceita `React.ComponentType<any>` (compatível com `LazyExoticComponent`).

### Arquitetura: split de financial.routes.ts
- 1406 linhas → 583 linhas no arquivo principal.
- [server/routes/financial-dre.routes.ts](server/routes/financial-dre.routes.ts) — DRE profissional (list, detail, payslip PDF, ranking): 500 linhas extraídas.
- [server/routes/financial-nfse.routes.ts](server/routes/financial-nfse.routes.ts) — NFS-e emit/cancel/query: 100 linhas extraídas.
- Sub-routers montados via `router.use('/dre', ...)` e `router.use('/nfse', ...)`.

### Soft delete / queries
- [server/routes/saas.routes.ts](server/routes/saas.routes.ts) — import `notDeleted` adicionado. Stats endpoint agora usa `Promise.all` para queries paralelas.

### Verificações
- `tsc --noEmit` = **zero erros**.

---

## ✅ JÁ EXECUTADO — SESSÃO 3 (2026-04-10 cont., 4 correções adicionais)

### Paginação SQL real em appointments (HIGH)
- [server/repositories/AppointmentRepository.ts](server/repositories/AppointmentRepository.ts) — `getAppointments` agora aceita `limit/offset` via `$dynamic()` do Drizzle. Nova função `countAppointments` para contagem eficiente.
- [server/routes/appointments.routes.ts:255-270](server/routes/appointments.routes.ts#L255-L270) — substituído `.slice()` em memória por `Promise.all([countAppointments, getAppointments({limit,offset})])`. Elimina risco de OOM em clínicas com muitos agendamentos.
- [server/storage.ts](server/storage.ts) — interface `IStorage`, `MemStorage` e `DatabaseStorage` atualizados com `countAppointments` + `limit/offset` em `AppointmentFilters`.

### Transações atômicas em appointments (HIGH)
- [server/repositories/AppointmentRepository.ts:244](server/repositories/AppointmentRepository.ts#L244) — `createAppointment` agora usa `db.transaction()`: appointment + procedures são atômicos (rollback se procedure insert falhar).
- [server/repositories/AppointmentRepository.ts:270](server/repositories/AppointmentRepository.ts#L270) — `updateAppointment` idem: update + delete procedures + insert procedures em transação.

### Migrations duplicadas renomeadas (MEDIUM)
- 15 migrations com prefixo duplicado renomeadas para `a/b/c` suffixes (003a_, 003b_, 004a_, 004b_, 010a_, 010b_, 014a_, 014b_, 015a_, 015b_, 022a_, 022b_, 023a_, 023b_, 023c_).
- [server/scripts/run-migrations.ts](server/scripts/run-migrations.ts) — adicionada tabela RENAMES que registra nomes novos em `schema_migrations` se os antigos já existem (evita re-execução).
- [server/scripts/mark-migrations-done.ts](server/scripts/mark-migrations-done.ts), [seed-test-complete.ts](server/scripts/seed-test-complete.ts), [run-integrations-migrations.ts](server/scripts/run-integrations-migrations.ts) — referências atualizadas.

### Verificações
- `tsc --noEmit` = **zero erros**.

---

## ✅ JÁ EXECUTADO — SESSÃO 2 (2026-04-10, 6 correções adicionais)

### Stripe raw body para HMAC (HIGH)
- [server/index.ts:265](server/index.ts#L265) — `express.raw()` registrado ANTES de `express.json()` para rota `/api/webhooks/stripe`, preservando bytes originais para verificação HMAC.
- [server/routes/webhooks.routes.ts:229](server/routes/webhooks.routes.ts#L229) — usa `Buffer.isBuffer(req.body)` com fallback seguro. Stripe `constructEvent()` agora recebe raw body real.

### MercadoPago timingSafeEqual (MEDIUM)
- [server/billing/mercadopago-service.ts:261](server/billing/mercadopago-service.ts#L261) — `===` trocado por `crypto.timingSafeEqual()` na verificação de HMAC SHA-256.

### NOWPayments timingSafeEqual (MEDIUM)
- [server/billing/nowpayments-service.ts:200](server/billing/nowpayments-service.ts#L200) — `===` trocado por `crypto.timingSafeEqual()` na verificação de HMAC SHA-512.

### CI ESLint estrito (MEDIUM)
- [.github/workflows/ci.yml:36](/.github/workflows/ci.yml#L36) — `--max-warnings 50` + `continue-on-error: true` → `--max-warnings 0` (fail on any warning).

### CRM indentação corrigida
- [server/services/crm-auto-progression.ts](server/services/crm-auto-progression.ts) — código dentro do `try { ... } finally { releaseLock }` re-indentado consistentemente.

### Verificações confirmadas (sem ação necessária)
- **Backup endpoint** já usa `authCheck` + `adminOnly` em [server/routes/settings.routes.ts:671](server/routes/settings.routes.ts#L671).
- **Console.log** — nenhum `console.log` ativo em código de servidor (apenas em strings de documentação/erro).
- `tsc --noEmit` = **zero erros** em todas as mudanças.

---

## ✅ JÁ EXECUTADO — SESSÃO 1 (2026-04-08, 11 correções)

### Billing fail-closed (HIGH × 2)
- [server/billing/feature-gate.ts:165-172](server/billing/feature-gate.ts#L165-L172) — erro retornava `next()`, agora retorna **503**. Evita liberação acidental de features pagas em falhas de DB/cache.
- [server/services/ai-agent/usage-limiter.ts:147-156](server/services/ai-agent/usage-limiter.ts#L147-L156) — `inputLimit === 0` retornava `allowed: true`. Agora retorna `allowed: false` com mensagem de upgrade. Fecha bypass de IA para free/starter.
- [server/services/ai-agent/usage-limiter.ts:195-204](server/services/ai-agent/usage-limiter.ts#L195-L204) — `catch` retornava `allowed: true`. Agora fail-closed protege receita em Redis/DB outage.

### Timing attacks (HIGH × 2)
- [server/auth.ts:670-687](server/auth.ts#L670-L687) — password reset agora usa `timingSafeEqual` com buffers hex. Previne enumeração de tokens.
- [server/middleware/csrf.ts:55-61](server/middleware/csrf.ts#L55-L61) — `SAAS_MASTER_API_KEY` comparada com `constantTimeCompare` existente em vez de `===`.

### Stripe webhook idempotency (HIGH)
- [server/middleware/webhook-idempotency.ts:73-84](server/middleware/webhook-idempotency.ts#L73-L84) — prioriza `body.id` (event ID estável) sobre `stripe-signature` (que contém timestamp rotativo). Evita processamento duplicado de webhooks de pagamento.

### WebSocket cross-tenant (CRITICAL + hardening)
- [server/websocket-redis-adapter.ts](server/websocket-redis-adapter.ts) — `localBroadcast` agora **exige** `companyId` OU `allTenants: true` explícito. Sem esses, msg é descartada com warning. `broadcastToAll` agora seta `allTenants: true` explicitamente.
- [server/websocket-redis-adapter.ts:158-167](server/websocket-redis-adapter.ts#L158-L167) — defense-in-depth: verifica `ws.companyId === msg.companyId` antes de enviar.
- [server/websocket.ts:133-141](server/websocket.ts#L133-L141) — mesma defense-in-depth em `broadcastToCompany`.

### Wuzapi webhook secret obrigatório (MEDIUM)
- [server/routes/webhooks.routes.ts:34-49](server/routes/webhooks.routes.ts#L34-L49) — se `WUZAPI_WEBHOOK_SECRET` não estiver setado, rejeita com **503**. Fecha fail-open silencioso.

### CRM race condition (HIGH)
- [server/services/crm-auto-progression.ts:53-215](server/services/crm-auto-progression.ts) — extraída `findOpportunityForSession`. `ensureOpportunityForSession` agora:
  1. Fast path: SELECT inicial
  2. Slow path: distributed lock Redis `crm:opportunity:{companyId}:{sessionId}` (wait-with-poll até 5s)
  3. Re-check após acquire
  4. INSERT sob proteção do lock
  5. Release no `finally`
- Elimina duplicação de opportunities quando 2 mensagens chegam simultâneas para a mesma sessão.

### DevOps
- [Dockerfile](Dockerfile) — `node:20-alpine` → `node:20.18.1-alpine3.20` (build reprodutível).
- [.gitignore](.gitignore) — verificado, `.env` **não está commitado** no repo. Nenhuma ação git necessária (`git ls-files .env` retorna vazio).

### Validação
- ✅ `npx tsc --noEmit` — **zero erros** em todas as mudanças.

---

## ⚠️ AÇÃO MANUAL DO USUÁRIO (não automatizável)

### CRITICAL — Rotação de secrets
Embora `.env` não esteja no git, secrets reais devem ser rotacionados se esse arquivo foi compartilhado (email, Slack, screenshots):
- [ ] `DATABASE_URL` — rotacionar senha PostgreSQL
- [ ] `DEEPSEEK_API_KEY` — revogar e gerar nova em console.deepseek.com
- [ ] `S3_SECRET_ACCESS_KEY` — revogar no painel MinIO/S3
- [ ] `WUZAPI_ADMIN_TOKEN` e `WUZAPI_HMAC_KEY` — rotacionar no Wuzapi
- [ ] `SESSION_SECRET` — gerar novo: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] Auditar logs de acesso nos provedores para uso não autorizado

---

## 🟠 FASE 1 — PRÓXIMO SPRINT (itens restantes)

### ~~Stripe webhook body raw (HIGH)~~ ✅ Feito sessão 2
### ~~MercadoPago timingSafeEqual (MEDIUM)~~ ✅ Feito sessão 2
### ~~NOWPayments timingSafeEqual (MEDIUM)~~ ✅ Feito sessão 2
### ~~Backup endpoint adminOnly (MEDIUM)~~ ✅ Já estava correto
### ~~CI ESLint strict (MEDIUM)~~ ✅ Feito sessão 2

### Paginação real em appointments (HIGH) — PENDENTE
[server/routes/appointments.routes.ts:165,169](server/routes/appointments.routes.ts#L165-L169) — substituir `.slice()` em memória por `limit/offset` no storage.

### NOWPayments timestamp/replay protection (MEDIUM) — PENDENTE
[server/routes/webhooks.routes.ts:169-190](server/routes/webhooks.routes.ts#L169-L190) — rejeitar webhooks > 5 min de idade (NOWPayments não provê replay protection nativa).

---

## 🟡 FASE 2 — Hardening (2 semanas)

### Transações em operações multi-step
Auditar operações que fazem múltiplos inserts/updates sem `db.transaction`:
- Criar paciente + anamnese + odontograma
- Billing: criar subscription + webhook
- Appointment: criar + procedures + notificações

### Migrations duplicadas
Renomear pares `003_`, `004_`, `010_`, `014_`, `015_`, `018_`, `022_`, `023_` para sufixos `a/b` ou timestamps.

### Índices compostos soft-delete
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_company_active
  ON patients (company_id, deleted_at, created_at DESC);
-- Similar para appointments, sales_opportunities, chat_sessions
```

### AppError adoção
Refactor rotas: `throw new Error(...)` → `throw new AppError(msg, 400, 'CODE')`. Começar pelas rotas mais sensíveis (auth, billing, webhooks).

### Console.log remanescentes
6 arquivos: auth.ts, env-validation.ts, index.ts, encryption.ts, field-encryption.ts, logger.ts. Trocar por `logger.*`.

### Testes críticos ausentes
- `test/services/crm-auto-progression.test.ts` — validar lock e race conditions
- `test/middleware/webhook-idempotency.test.ts` — Stripe event.id dedup
- `test/billing/feature-gate.test.ts` — fail-closed behavior
- `test/services/ai-agent/usage-limiter.test.ts` — fail-closed + inputLimit===0

---

## 🟢 FASE 3 — Arquitetura (3-4 semanas)

### Quebrar `server/storage.ts` (2041 linhas)
Integrar `server/repositories/` já iniciado. Dividir por domínio:
- `PatientRepository`
- `AppointmentRepository`
- `BillingRepository`
- `ChatRepository`
- etc.

Interface `IStorage` vira fachada que delega.

### Quebrar rotas monolíticas
- `financial.routes.ts` (1406) → `financial/{billing, invoices, reports, ledgers}.ts`
- `integrations.routes.ts` (1344) → por provedor
- `chat.routes.ts` (1153), `appointments.routes.ts` (1061), `crm.routes.ts` (1089)

### Migração SQL cru → Drizzle
50+ arquivos. Criar ADR e migrar em waves:
1. Auth (auth.ts TOTP queries)
2. Routes críticas (patients, appointments)
3. Middleware (rls, cursor-pagination)
4. Services restantes

### Frontend
- `React.lazy()` + `Suspense` por rota em `App.tsx`
- Quebrar páginas >2000 linhas: `inventory-page.tsx`, `configuracoes-clinica.tsx`, `agenda-page.tsx`
- Hook `useAbortController` em todos os fetches manuais
- `ErrorBoundary` por seção

---

## 🔵 FASE 4 — Qualidade contínua

### Eliminar `any` (meta: -50% em 1 mês)
142 ocorrências em 54 arquivos. Focar primeiro em route handlers.

### CI estrito
`.github/workflows/ci.yml`:
- `continue-on-error: false` no lint
- `--max-warnings 0` após cleanup

### Cobertura de testes
Meta 60%+ em:
- `server/billing/`
- `server/services/ai-agent/`
- `server/services/crm-auto-progression.ts`
- `server/queue/workers.ts`
- `server/routes/webhooks.routes.ts`

### E2E
Adicionar Playwright com fluxos críticos:
- Login + 2FA
- Criar paciente + agendamento + confirmação
- Fluxo completo de billing (upgrade → webhook → feature unlock)

---

## 📊 Progresso

| Fase | Status | Itens |
|---|---|---|
| Sessão 1 (2026-04-08) | ✅ **11/11** | Billing fail-closed, timing attacks, WebSocket, Wuzapi, CRM race, Stripe dedup, Docker pin |
| Sessão 2 (2026-04-10) | ✅ **6/6** | Stripe raw body, MP + NP timingSafeEqual, CI ESLint strict, CRM indent fix |
| Sessão 3 (2026-04-10) | ✅ **4/4** | Paginação SQL appointments, transações atômicas, migrations renomeadas |
| Sessão 4 (2026-04-11) | ✅ **7/7** | React.lazy + ErrorBoundary, financial.routes split (1406→583), soft delete saas |
| Sessão 5 (2026-04-11) | ✅ **3/3** | Testes webhook idempotency, feature-gate, usage-limiter (12 novos casos) |
| Sessão 6 (2026-04-11) | ✅ **4/4** | CRM split (-126 linhas), Integrations AI split (-230 linhas), repository tests |
| Sessão 7 (2026-04-11) | ✅ **3/3** | Chat-media split (-141 linhas), 8 novos testes de signature HMAC |
| **TOTAL CORRIGIDO** | ✅ **38 itens** | De 67 achados iniciais, 38 resolvidos (57%) + 272 testes passando |
| Ação manual (usuário) | ⚠️ pendente | Rotação de secrets (.env) |
| Backlog Fase 3+ | 🔜 | storage.ts split, integrations/chat/crm routes split, Drizzle migration, AppError adoption ampla, cobertura de testes expandida, eliminar `any` |

---

## 🧪 Como verificar as mudanças desta sessão

```bash
# Typecheck (deve passar com 0 erros — já validado)
npx tsc --noEmit

# Rodar testes existentes
npm test

# Verificar que o servidor sobe
npm run dev
```

### Smoke tests manuais recomendados

1. **Feature gate fail-closed**: derrubar Redis temporariamente, tentar acessar endpoint com feature gate — deve retornar 503, não 200.
2. **AI limiter**: configurar conta free/starter com `inputLimit=0` — agente IA deve ser bloqueado, não liberado.
3. **Password reset**: fluxo completo deve continuar funcionando (apenas a comparação mudou).
4. **WebSocket**: conectar dois tenants diferentes, enviar broadcast para companyA — tenantB NÃO deve receber.
5. **CRM**: enviar 2 mensagens WhatsApp simultâneas para a mesma sessão nova — deve criar **uma** opportunity só.
6. **Wuzapi**: temporariamente remover `WUZAPI_WEBHOOK_SECRET` do env — webhook deve retornar 503 (não 200).
