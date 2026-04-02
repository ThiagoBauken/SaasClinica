# Runbooks - DentalSaaS

Operational runbooks for common incidents. Follow these step-by-step
when responding to alerts or outages.

## Index

1. [Database Connection Exhaustion](#1-database-connection-exhaustion)
2. [High Memory Usage / OOM](#2-high-memory-usage--oom)
3. [Redis Unavailable](#3-redis-unavailable)
4. [Queue Backlog Growing](#4-queue-backlog-growing)
5. [High Error Rate (5xx)](#5-high-error-rate-5xx)
6. [SSL Certificate Expiry](#6-ssl-certificate-expiry)
7. [Deployment Failure / Rollback](#7-deployment-failure--rollback)

---

## 1. Database Connection Exhaustion

**Symptoms:** `connection pool timeout`, `too many connections`, 503 on `/health`

**Diagnosis:**
```bash
# Check current connections
psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'odontobase';"

# Check who is using connections
psql -c "SELECT usename, application_name, state, count(*)
         FROM pg_stat_activity
         WHERE datname = 'odontobase'
         GROUP BY usename, application_name, state
         ORDER BY count DESC;"

# Check pool metrics
curl -s https://YOUR_APP/health | jq .
```

**Resolution:**
1. If connections are mostly `idle`: reduce `DB_POOL_MAX` or `idleTimeoutMillis`
2. If connections are mostly `active`: check for long-running queries
   ```sql
   SELECT pid, now() - pg_stat_activity.query_start AS duration, query
   FROM pg_stat_activity
   WHERE state = 'active' AND (now() - query_start) > interval '30 seconds'
   ORDER BY duration DESC;
   ```
3. Kill long-running queries if needed:
   ```sql
   SELECT pg_terminate_backend(pid);
   ```
4. If issue persists, consider adding PgBouncer

**Prevention:** Set `DB_POOL_MAX=50` in production, enable slow query monitor

---

## 2. High Memory Usage / OOM

**Symptoms:** Container restart, `SIGKILL`, `OOMKilled` in container logs

**Diagnosis:**
```bash
# Check memory from health endpoint
curl -s https://YOUR_APP/health | jq '.memory'

# Check container stats
docker stats --no-stream

# Check for memory leaks in heap
curl -s https://YOUR_APP/health/metrics | grep dental_nodejs_heap
```

**Resolution:**
1. Restart the container (immediate relief)
2. Check if `memoryCache` in `cache.ts` is growing unbounded
3. Reduce `MAX_WORKERS` to lower total memory
4. Increase container memory limit if legitimate workload growth
5. Check for large file uploads held in memory

**Prevention:**
- Set `--max-old-space-size=512` in NODE_OPTIONS
- Monitor `dental_nodejs_heap_size_used_bytes` metric
- Set alerts at 80% of container memory limit

---

## 3. Redis Unavailable

**Symptoms:** Sessions fall back to memory, queues stop processing, cache misses increase

**Diagnosis:**
```bash
# Check Redis health
redis-cli -h REDIS_HOST -a REDIS_PASSWORD ping

# Check Redis memory
redis-cli -h REDIS_HOST -a REDIS_PASSWORD info memory

# Check app health endpoint
curl -s https://YOUR_APP/health | jq '.services.redis'
```

**Resolution:**
1. The app degrades gracefully (memory sessions, no queues)
2. Check if Redis is out of memory (`maxmemory` hit)
3. Check if Redis is overloaded: `redis-cli info clients`
4. Restart Redis if unresponsive:
   ```bash
   docker restart redis
   ```
5. If data loss is acceptable, flush: `redis-cli FLUSHDB`

**Prevention:**
- Set `maxmemory 256mb` with `allkeys-lru` eviction
- Monitor Redis memory via Prometheus

---

## 4. Queue Backlog Growing

**Symptoms:** WhatsApp messages delayed, emails not sent, automation stuck

**Diagnosis:**
```bash
# Check queue depths
curl -s https://YOUR_APP/api/queue/health | jq .

# Check BullMQ dashboard (if Redis Commander is running)
# Or via API:
curl -s https://YOUR_APP/api/queue/stats | jq .
```

**Resolution:**
1. Check if workers are running (look at logs for `Workers started`)
2. Check Redis connectivity (workers need Redis)
3. Check for failed jobs (retry them):
   ```bash
   curl -X POST https://YOUR_APP/api/queue/retry-all
   ```
4. If a specific provider is down (WhatsApp/email), jobs will retry 3x then fail
5. Scale workers: increase concurrency in env vars

**Prevention:**
- Set alerts on `dental_queue_jobs_processed_total{status="failed"}`
- Monitor queue depths via Prometheus

---

## 5. High Error Rate (5xx)

**Symptoms:** Users seeing errors, Sentry alerts, error rate > 1%

**Diagnosis:**
```bash
# Check error rate from metrics
curl -s https://YOUR_APP/health/metrics | grep 'dental_http_requests_total{.*status_code="5'

# Check recent errors in logs
docker logs APP_CONTAINER --since 10m 2>&1 | grep '"level":"error"'

# Check Sentry for error details
```

**Resolution:**
1. Check if database is healthy: `curl https://YOUR_APP/health`
2. Check if a specific route is failing (look at `route` label in metrics)
3. Check recent deployments — if just deployed, consider rollback
4. Check external service failures (Stripe, WhatsApp, AI provider)
5. If DDoS-like traffic, check rate limiting is active

**Prevention:**
- Set alerts on error rate > 1% over 5 minutes
- Enable Sentry with `SENTRY_DSN`

---

## 6. SSL Certificate Expiry

**Symptoms:** Browser security warnings, HTTPS errors

**Diagnosis:**
```bash
# Check certificate expiry
echo | openssl s_client -connect YOUR_DOMAIN:443 2>/dev/null | openssl x509 -noout -dates
```

**Resolution:**
1. EasyPanel auto-renews Let's Encrypt certificates
2. If auto-renewal failed, check EasyPanel logs
3. Force renewal in EasyPanel SSL settings
4. Verify DNS is pointing correctly

**Prevention:**
- Set alert for certificate expiring within 14 days
- EasyPanel handles renewal automatically

---

## 7. Deployment Failure / Rollback

**Symptoms:** Build failure in GitHub Actions, health check fails after deploy

**Diagnosis:**
```bash
# Check GitHub Actions logs
gh run list --workflow=cd.yml --limit=5

# Check container logs
docker logs APP_CONTAINER --since 5m

# Check health
curl -s https://YOUR_APP/health/ready
```

**Resolution:**
1. EasyPanel keeps the old container running if build fails
2. For code issues, revert the commit and push:
   ```bash
   git revert HEAD
   git push origin main
   ```
3. For Docker build issues, check Dockerfile and dependencies
4. For startup crashes, check env vars are set correctly

**Prevention:**
- CI pipeline runs tests before CD pipeline
- Health check verification after deploy
- Keep deployments small and incremental

---

## Post-Mortem Template

After resolving any P1/P2 incident, create a post-mortem:

```
## Incident: [Title]
**Date:** YYYY-MM-DD
**Duration:** X minutes
**Severity:** P1/P2/P3
**Impact:** [What users experienced]

### Timeline
- HH:MM - [Event]
- HH:MM - [Action taken]
- HH:MM - [Resolution]

### Root Cause
[What caused it]

### Resolution
[What fixed it]

### Action Items
- [ ] [Preventive measure 1]
- [ ] [Preventive measure 2]

### Lessons Learned
[What we learned]
```
