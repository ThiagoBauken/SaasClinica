# Platform Engineering — Correction Plan & Applied Fixes

Data: 2026-04-07
Contexto: auditoria SRE/Platform do SaaS odontológico multi-tenant
(Express + React + PostgreSQL/Drizzle + Redis + BullMQ).

Este documento lista as correções aplicadas nesta rodada e o que
ainda precisa ser feito fora do código.

---

## 1. Fail-closed do cache em produção ✅

**Problema:** `server/cache.ts` tinha um `Map` in-memory como fallback
para o Redis. Em cluster/horizontal scaling isso gera cache
divergente entre instâncias e dados incoerentes para o usuário.

**Fix aplicado:** [server/cache.ts](server/cache.ts)
- `memoryCache` só é criado quando `NODE_ENV !== 'production'`.
- Todas as operações (`getCache`, `setCache`, `removeCache`,
  `invalidateCacheByPrefix`) tratam o ponteiro como nullable.
- Em produção sem Redis, as escritas viram no-op e um log `error`
  é emitido na inicialização avisando que o cache está desligado.
- Inicialização passou a aceitar também `REDIS_HOST/REDIS_PORT/REDIS_PASSWORD`
  (antes só `REDIS_URL`, o que na prática fazia o Redis nunca subir no
  docker-compose atual).

---

## 2. Sessions — fatal se Redis não disponível em produção ✅

**Problema:** [server/index.ts:217](server/index.ts#L217) caía para
`MemoryStore` silenciosamente em produção. Isso (a) perde todas as
sessões a cada restart, (b) quebra login ao balancear entre instâncias.

**Fix aplicado:** [server/index.ts:210-235](server/index.ts#L210-L235)
- Em `NODE_ENV=production`, se o Redis não estiver disponível,
  loga `fatal` e `process.exit(1)`.
- Escape hatch: `ALLOW_INSECURE_SESSIONS=true` para emergências.
- Em dev continua caindo para in-memory normalmente.

---

## 3. Rate limiting distribuído ✅

**Problema:** [server/index.ts:228](server/index.ts#L228) usava
`express-rate-limit` sem store externo. Com múltiplas instâncias,
cada nó tinha seu próprio contador — o limite real era
`500 × nInstâncias`, bypassável via round-robin.

**Fix aplicado:** [server/middleware/distributed-rate-limit.ts](server/middleware/distributed-rate-limit.ts)
(novo arquivo)
- Store customizado backed por `ioredis` (já instalado — zero deps novas).
- Usa pipeline `INCR` + `EXPIRE NX` + `PTTL` atomicamente.
- Se o Redis cair, faz fallback para contador local (best-effort,
  não-bloqueante) e loga erro.
- Exporta `createDistributedRateLimiter({ windowMs, max, prefix })`.
- `server/index.ts` passa a usar esse middleware via
  `createDistributedRateLimiter()` com `RATE_LIMIT_MAX` configurável.

---

## 4. Backup automatizado, criptografado e com retenção ✅

**Problema:** [server/backup.ts](server/backup.ts) exportava JSON
manualmente (export por usuário, não backup). [server/jobs/backup-cron.ts](server/jobs/backup-cron.ts)
existia mas só gravava **estatísticas** em S3 — não havia backup real do
banco, nem criptografia, nem retenção, nem teste de restore. Risco
existencial para o negócio (compliance LGPD + disaster recovery zero).

**Fix aplicado:** reescrita completa de
[server/jobs/backup-cron.ts](server/jobs/backup-cron.ts)
- Pipeline real: `pg_dump → gzip → AES-256-GCM → S3 PutObject (SSE=AES256)`.
- IV aleatório por backup armazenado no início do arquivo.
- GCM auth tag anexado no fim do arquivo.
- SHA-256 do arquivo gerado e guardado em metadata do S3
  (verificação de integridade).
- Manifesto JSON gravado junto (`.manifest.json`) com timestamp,
  tamanho, hash e stats do banco.
- Job de retenção semanal (domingo 4h) apaga objetos `backups/` com
  `LastModified` mais antigo que `BACKUP_RETENTION_DAYS` (default 30).
- Lock distribuído Redis (`cron:automated-backup`) com TTL de 1h
  para pg_dumps longos.

**Env vars novas (obrigatórias se `BACKUP_ENABLED=true`):**
```
BACKUP_ENABLED=true
BACKUP_S3_BUCKET=dental-prod-backups
BACKUP_ENCRYPTION_KEY=<64 hex chars = 32 bytes>
BACKUP_RETENTION_DAYS=30            # opcional
BACKUP_SCHEDULE="0 2 * * *"         # opcional (cron)
```

**Gerar chave:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Pré-requisito no container:** `pg_dump` disponível
(instalar `postgresql-client` no Dockerfile se ainda não estiver).

---

## 5. Dead Letter Queue para BullMQ ✅

**Problema:** [server/queue/config.ts:69](server/queue/config.ts#L69)
mantém jobs falhos por 7 dias, mas não havia DLQ. Após esgotar
`attempts: 3`, o job ficava jogado na fila original até o GC —
sem alerta, sem replay tooling, sem visibilidade.

**Fix aplicado:** [server/queue/dead-letter.ts](server/queue/dead-letter.ts)
(novo arquivo)
- `getDeadLetterQueue()` — fila dedicada `dead-letter`, retenção 90 dias.
- `attachDeadLetterHandlers()` — escuta `QueueEvents.failed` em
  todas as filas (`AUTOMATIONS`, `NOTIFICATIONS`, `EMAILS`, `WHATSAPP`,
  `REPORTS`). Quando `attemptsMade >= opts.attempts`, empurra o job
  para a DLQ com payload completo (source queue, job name, data,
  stacktrace, failedReason, timestamp).
- `replayDeadLetterJob(dlqJobId)` — re-enfileira na fila original
  para uso em runbook/admin tooling.
- Métrica Prometheus `dental_dlq_jobs_total{queue}` adicionada em
  [server/lib/metrics.ts](server/lib/metrics.ts).
- Wire-up em [server/queue/index.ts](server/queue/index.ts):
  `initializeQueueSystem()` agora chama `attachDeadLetterHandlers()`.

**Alerta recomendado (Grafana/Prometheus):**
```promql
rate(dental_dlq_jobs_total[5m]) > 0
```
dispara se *qualquer* job cair em DLQ.

---

## 6. PgBouncer no docker-compose ✅

**Problema:** [server/db.ts:26-31](server/db.ts#L26-L31) configurava
`max=100` por instância. Com 2 instâncias × 4 workers cluster
= **800 conexões reais** ao Postgres (default max_connections = 100).
Bateria no gargalo antes mesmo de qualquer carga real.

**Fix aplicado:** [docker-compose.yml](docker-compose.yml)
- Service `pgbouncer` (imagem `edoburu/pgbouncer`) adicionado:
  - `POOL_MODE=transaction` (mais agressivo, seguro com Drizzle)
  - `MAX_CLIENT_CONN=1000` (configurável via `PGBOUNCER_MAX_CLIENT_CONN`)
  - `DEFAULT_POOL_SIZE=25` (configurável via `PGBOUNCER_POOL_SIZE`)
  - `RESERVE_POOL_SIZE=5`
  - `SERVER_IDLE_TIMEOUT=60`, `SERVER_LIFETIME=3600`
  - Healthcheck via `pg_isready -p 6432`
- Service `app` agora aponta `DATABASE_URL` para
  `postgresql://...@pgbouncer:6432/...` e `DB_POOL_MAX=20`
  (reduzido porque o pool real fica no PgBouncer).
- `depends_on` adicionado para pgbouncer.

**Atenção:** `POOL_MODE=transaction` **não suporta**:
- Prepared statements com nome
- `LISTEN/NOTIFY`
- Session-level features (`SET`, temp tables, advisory locks com sessão)

Caso o código use algum destes, alternar para `POOL_MODE=session`
ou deixar rotas específicas batendo direto no `db:5432`.

---

## 🟡 PENDENTE (fora do escopo de código)

Itens que não dá pra corrigir só editando código — precisam de
ação operacional.

### P0 — Dados / DR
- [ ] **Provisionar bucket S3/R2** com versionamento e object-lock
      para backups.
- [ ] **Criar `BACKUP_ENCRYPTION_KEY`** com `crypto.randomBytes(32)`,
      armazenar em secret manager (1Password/Vault/EasyPanel secrets).
- [ ] **Adicionar `postgresql-client`** ao Dockerfile runner stage:
      ```dockerfile
      RUN apk add --no-cache postgresql15-client
      ```
- [ ] **Teste de restore documentado** — rodar mensalmente,
      validar com `pg_restore --list` num ambiente isolado.

### P1 — Observabilidade
- [ ] **Logs centralizados** — Grafana Loki / Better Stack / Datadog.
      Apontar Pino via transport.
- [ ] **Alerta Prometheus** para `dental_dlq_jobs_total > 0`.
- [ ] **Alerta Prometheus** para `dental_http_requests_total{status_code=~"5.."} / dental_http_requests_total > 0.01`
      (error rate > 1%).
- [ ] **OpenTelemetry** — instrumentar Express + pg + ioredis +
      BullMQ com `@opentelemetry/auto-instrumentations-node`.
- [ ] **Eliminar 361 `console.log`** restantes, migrando para `logger`.

### P2 — Operacional
- [ ] **Runbook** para incidentes comuns: Redis down, Postgres
      sem conexões, DLQ com backlog, backup falhou.
- [ ] **SLOs formalizados** (uptime 99.5%, p95 latency < 500ms,
      error budget mensal).
- [ ] **On-call rotation** (PagerDuty/OpsGenie/Grafana OnCall).
- [ ] **Staging environment** com schema anonimizado.
- [ ] **Feature flags** (Unleash/Flagsmith/LaunchDarkly) para
      rollout gradual.
- [ ] **Blue-green ou canary** no EasyPanel (hoje é rolling simples).

---

## Arquivos tocados nesta rodada

| Arquivo | Tipo |
|---|---|
| [server/cache.ts](server/cache.ts) | modificado |
| [server/index.ts](server/index.ts) | modificado |
| [server/jobs/backup-cron.ts](server/jobs/backup-cron.ts) | reescrito |
| [server/lib/metrics.ts](server/lib/metrics.ts) | +1 contador DLQ |
| [server/middleware/distributed-rate-limit.ts](server/middleware/distributed-rate-limit.ts) | **novo** |
| [server/queue/dead-letter.ts](server/queue/dead-letter.ts) | **novo** |
| [server/queue/index.ts](server/queue/index.ts) | wire-up DLQ |
| [docker-compose.yml](docker-compose.yml) | +service pgbouncer |
| [PLATFORM_FIXES.md](PLATFORM_FIXES.md) | **novo** (este arquivo) |

`npx tsc --noEmit` passa sem erros.
