# Prompt de Auditoria Completa — Dental Clinic SaaS

## Como usar
1. Abra uma **nova sessão** do Claude Code no diretório do projeto
2. Copie e cole o bloco abaixo (entre as linhas de ```)
3. Opcional: rode com `/fast` para mais velocidade, ou peça para dividir o relatório por categoria se o output ficar muito grande

---

```
Você é um Staff Engineer sênior fazendo uma auditoria técnica completa deste projeto SaaS de clínica odontológica. O stack é:

- Backend: Node.js + Express + TypeScript
- Frontend: React + Vite + TypeScript
- Banco: PostgreSQL com Drizzle ORM (schema em shared/schema.ts)
- Cache/Sessão: Redis
- Auth: Passport.js (Local + Google OAuth), sessão + Redis store
- Multi-tenant: isolamento por companyId com tenant middleware
- Billing: Stripe + MercadoPago + NOWPayments (planos com feature gating)
- Filas: BullMQ (WhatsApp, email, relatórios, automações)
- CRM WhatsApp com IA (auto-progressão de estágios, N8N tools)
- Deploy: Docker + docker-compose

Sua missão é varrer o repositório inteiro e produzir um RELATÓRIO DE AUDITORIA estruturado. Seja implacável, específico e acionável — cite sempre arquivo:linha.

## Áreas obrigatórias de inspeção

### 1. Segurança
- SQL Injection (especialmente em `db.$client.query()` cru — há muitos)
- Vazamento de multi-tenancy: procure `companyId || 1`, `companyId = 1`, queries sem filtro de tenant, uso indevido de `req.user.companyId` vs params
- Autenticação/Autorização: rotas sem `authCheck`, `adminOnly`, ou `tenantAwareAuth`
- CSRF: endpoints mutáveis sem proteção double-submit cookie
- Prompt injection no agente IA do WhatsApp (já existe hardening de 6 camadas — validar cobertura)
- Secrets hardcoded, chaves em .env.example com valores reais, logs expondo PII/LGPD
- Upload de arquivos sem validação de mime/tamanho
- Rate limiting ausente em endpoints sensíveis (login, webhooks, IA)
- Webhooks de pagamento sem verificação de assinatura
- XSS no frontend (dangerouslySetInnerHTML, renderização de conteúdo de usuário)
- Senhas: hash, política, reset token expiry

### 2. Arquitetura e Qualidade de Código
- `server/routes.ts` monolítico (~1500+ linhas) — o que deveria virar módulo?
- Duplicação entre rotas monolíticas e `server/routes/*.routes.ts`
- Migrations duplicadas (003_*, 004_*, 010_*) — identificar e propor consolidação
- Consistência: uso misto de Drizzle ORM vs SQL cru (`db.$client.query`)
- Camadas: controller vs service vs repository — onde a lógica vaza?
- Erros: uso consistente de `AppError`, `asyncHandler`, ErrorBoundary
- Logs: `console.log` remanescente onde deveria ser Pino estruturado
- Dead code, imports não usados, exports órfãos
- Tipos `any`, `@ts-ignore`, `@ts-expect-error` sem justificativa
- Circular dependencies

### 3. Banco de Dados e Performance
- Índices faltando em colunas filtradas/joined (especialmente `companyId`, FKs, colunas de busca)
- N+1 queries (loops com `await db.select`)
- Queries sem LIMIT em listagens
- Transações ausentes em operações multi-step
- Falta de soft delete onde histórico importa
- Migrations não-idempotentes
- Drift entre `shared/schema.ts` e SQL de migrations
- Connection pool mal configurado

### 4. Multi-tenant e Billing
- Feature gating: endpoints que deveriam checar plano e não checam
- Limites de plano (usuários, storage, mensagens WhatsApp, chamadas IA) — enforcement real?
- Isolamento em queries raw
- Uploads e storage por tenant
- Billing: reconciliação de webhooks, idempotência, estados inconsistentes (assinatura ativa sem pagamento, etc.)
- Token metering da IA: precisão do contador, possibilidade de bypass

### 5. Filas e Jobs (BullMQ)
- Jobs sem retry policy ou com retry infinito
- DLQ: existe e é monitorada?
- Jobs idempotentes? O que acontece se rodar 2x?
- Jobs órfãos em falha silenciosa
- Concorrência mal dimensionada
- Jobs que não limpam estado ao falhar

### 6. WhatsApp / CRM / IA
- `crm-auto-progression.ts`: race conditions em progressão simultânea
- `chat-processor.ts`: criação de oportunidade duplicada
- Loop infinito no agente (já há anti-loop — verificar robustez)
- Cache de FAQ: invalidação correta?
- Ferramenta 23 N8N: validação de input, rate limit, auth
- WebSocket events: vazamento entre tenants, adapter Redis configurado?

### 7. Frontend (React + Vite)
- Componentes gigantes (>300 linhas) que pedem split
- Estado global mal gerenciado (props drilling, context excessivo)
- Requests sem cancelamento (AbortController) causando race/memory leaks
- Falta de loading/error states
- Acessibilidade (a11y): labels, aria, contraste, navegação por teclado
- Bundle size: dependências pesadas, imports não tree-shakeable
- Re-renders desnecessários (memo, useMemo, useCallback onde faz sentido)
- ErrorBoundary cobrindo só a raiz?
- CSRF token sendo enviado corretamente em todos requests mutáveis

### 8. Testes
- Cobertura real do Vitest — o que está sem teste?
- Testes de integração do fluxo multi-tenant
- Testes de billing e webhooks
- Mocks frágeis vs testes reais contra DB de teste
- E2E ausente?

### 9. DevOps / Observabilidade
- Dockerfile: multi-stage, imagem final enxuta, usuário não-root, healthcheck
- docker-compose: secrets, volumes, restart policies
- CI/CD: etapas faltando (lint, typecheck, test, build, security scan)
- Sentry: configurado mas todos os erros chegam? Breadcrumbs, contexto de tenant?
- Métricas: Prometheus/OpenTelemetry?
- Logs estruturados com correlation ID por request
- Preflight scripts: cobrem o que precisa?

### 10. Código Incompleto / TODOs
- Comentários `TODO`, `FIXME`, `XXX`, `HACK`
- Funções declaradas mas nunca chamadas
- Features iniciadas e abandonadas (branches mortas no código)
- Endpoints que retornam mock/stub
- Configurações com valor default "temporário"

## Formato do Relatório

Para cada achado, produza:

[SEVERIDADE] Título curto
Arquivo: caminho/arquivo.ts:linha
Categoria: <uma das 10 áreas acima>
Descrição: o que está errado e por quê
Impacto: o que pode dar errado em produção
Correção sugerida: passos concretos ou trecho de código
Esforço: S / M / L

Severidades: CRITICAL (risco imediato a dados/segurança/receita), HIGH (bug ou vulnerabilidade séria), MEDIUM (qualidade/performance), LOW (polimento).

Ao final, entregue:
1. **Sumário executivo** — top 10 problemas por prioridade
2. **Matriz de risco** — contagem por severidade × categoria
3. **Quick wins** — até 15 correções de baixo esforço e alto impacto
4. **Dívida técnica estrutural** — o que precisa de refactor maior
5. **Roadmap sugerido** — ordem recomendada de ataque

## Regras de execução

- NÃO altere código — apenas leia e relate
- Use Grep e Glob agressivamente; use Explore subagents em paralelo para áreas independentes
- Priorize profundidade sobre amplitude: melhor 30 achados certeiros com arquivo:linha do que 200 genéricos
- Sempre que citar um problema, verifique se não foi já corrigido em commits recentes (`git log`)
- Ignore node_modules, dist, build, coverage
- Se encontrar padrão repetido, cite 2-3 ocorrências e diga "e mais N similares"
- Comece listando os arquivos/diretórios que vai inspecionar antes de mergulhar
```
