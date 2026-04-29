# 🐳 Guia de Deploy com Docker

Este guia explica como executar o sistema de gestão odontológica usando Docker e Docker Compose.

---

## 📋 Pré-requisitos

- Docker 20.10+ instalado
- Docker Compose 2.0+ instalado
- Mínimo 4GB RAM disponível
- Mínimo 10GB de espaço em disco

### Verificar Instalação

```bash
docker --version
docker-compose --version
```

---

## 🚀 Início Rápido

### 1. Preparar Ambiente

```bash
# Copiar arquivo de configuração
cp .env.docker .env

# Editar variáveis (IMPORTANTE!)
nano .env  # ou seu editor preferido
```

**⚠️ IMPORTANTE:** Altere pelo menos estas variáveis:
- `SESSION_SECRET` - Gere com: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `POSTGRES_PASSWORD` - Senha do banco de dados
- `REDIS_PASSWORD` - Senha do Redis

### 2. Iniciar Serviços

```bash
# Modo produção (apenas app, db e redis)
docker-compose up -d

# Com ferramentas de desenvolvimento (pgAdmin, Redis Commander)
docker-compose --profile dev up -d
```

### 3. Verificar Status

```bash
# Ver logs
docker-compose logs -f app

# Ver todos os containers
docker-compose ps

# Health check
curl http://localhost:5000/health
```

### 4. Executar Migrations

```bash
# Executar migrations no container
docker-compose exec app npx tsx server/scripts/run-migrations.ts
```

---

## 🔧 Comandos Úteis

### Gerenciamento de Containers

```bash
# Parar todos os serviços
docker-compose down

# Parar e remover volumes (⚠️ DELETA DADOS!)
docker-compose down -v

# Reiniciar apenas a aplicação
docker-compose restart app

# Ver logs em tempo real
docker-compose logs -f

# Logs de serviço específico
docker-compose logs -f app
docker-compose logs -f db
docker-compose logs -f redis
```

### Acesso aos Containers

```bash
# Shell no container da aplicação
docker-compose exec app sh

# Shell no PostgreSQL
docker-compose exec db psql -U dental -d dental_clinic

# Shell no Redis
docker-compose exec redis redis-cli -a redis123_change_me
```

### Banco de Dados

```bash
# Backup do banco de dados
docker-compose exec db pg_dump -U dental dental_clinic > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar backup
docker-compose exec -T db psql -U dental dental_clinic < backup.sql

# Resetar banco de dados (⚠️ DELETA TODOS OS DADOS!)
docker-compose down
docker volume rm site-clinca-dentista_postgres_data
docker-compose up -d
```

---

## 🌐 Serviços Disponíveis

### Produção

| Serviço | URL | Descrição |
|---------|-----|-----------|
| Aplicação | http://localhost:5000 | Sistema principal |
| Health Check | http://localhost:5000/health | Monitoramento |
| API v1 | http://localhost:5000/api/v1 | Nova API REST |
| PostgreSQL | localhost:5432 | Banco de dados |
| Redis | localhost:6379 | Cache/Sessões |

### Desenvolvimento (--profile dev)

| Serviço | URL | Credenciais |
|---------|-----|-------------|
| pgAdmin | http://localhost:5050 | admin@dental.local / admin123 |
| Redis Commander | http://localhost:8081 | - |

---

## 📊 Monitoramento

### Health Checks

```bash
# Health check completo
curl http://localhost:5000/health | jq

# Readiness (pronto para tráfego)
curl http://localhost:5000/health/ready

# Liveness (processo vivo)
curl http://localhost:5000/health/live
```

### Métricas de Container

```bash
# Uso de recursos em tempo real
docker stats

# Uso de disco dos volumes
docker system df -v

# Inspecionar container
docker inspect dental-app
```

---

## 🔒 Segurança

### Checklist de Produção

- [ ] `SESSION_SECRET` único e aleatório (não usar padrão)
- [ ] `POSTGRES_PASSWORD` forte
- [ ] `REDIS_PASSWORD` forte
- [ ] Firewall configurado (apenas portas necessárias expostas)
- [ ] SSL/TLS configurado no reverse proxy
- [ ] Volumes com backup automático
- [ ] Logs sendo coletados
- [ ] Alertas de health check configurados

### Configurar SSL (Nginx)

1. Habilitar perfil nginx:
```bash
docker-compose --profile with-nginx up -d
```

2. Colocar certificados em `./ssl/`:
```
./ssl/fullchain.pem
./ssl/privkey.pem
```

3. Configurar `nginx.conf` (exemplo incluído)

---

## 🐛 Troubleshooting

### Container não inicia

```bash
# Ver logs de erro
docker-compose logs app

# Ver eventos do Docker
docker events

# Verificar recursos disponíveis
docker system df
free -h
```

### Banco de dados não conecta

```bash
# Verificar se DB está rodando
docker-compose ps db

# Ver logs do PostgreSQL
docker-compose logs db

# Testar conexão manualmente
docker-compose exec db pg_isready -U dental
```

### Redis não conecta

```bash
# Verificar Redis
docker-compose ps redis

# Logs do Redis
docker-compose logs redis

# Testar conexão
docker-compose exec redis redis-cli -a ${REDIS_PASSWORD} ping
```

### Performance ruim

```bash
# Aumentar recursos do Docker Desktop
# Settings -> Resources -> Increase RAM/CPU

# Verificar uso de recursos
docker stats

# Limpar cache do Docker
docker system prune -a
```

### Migrations falhando

```bash
# Executar manualmente
docker-compose exec db psql -U dental dental_clinic < server/migrations/001_add_performance_indexes.sql

# Verificar migrations executadas
docker-compose exec db psql -U dental dental_clinic -c "SELECT * FROM schema_migrations;"
```

---

## 🔄 Atualizações

### Atualizar Sistema

```bash
# 1. Fazer backup
docker-compose exec db pg_dump -U dental dental_clinic > backup.sql

# 2. Parar containers
docker-compose down

# 3. Atualizar código (git pull, etc)
git pull origin main

# 4. Rebuild imagens
docker-compose build --no-cache

# 5. Subir novamente
docker-compose up -d

# 6. Executar migrations
docker-compose exec app npx tsx server/scripts/run-migrations.ts

# 7. Verificar
docker-compose logs -f app
curl http://localhost:5000/health
```

---

## 📈 Escalabilidade

### Scaling Horizontal

```bash
# Escalar aplicação para 3 instâncias
docker-compose up -d --scale app=3

# Adicionar load balancer (nginx)
docker-compose --profile with-nginx up -d
```

### Kubernetes (K8s)

Para ambientes muito grandes (1000+ usuários), considere Kubernetes:

```bash
# Gerar manifests do Kompose
kompose convert -f docker-compose.yml

# Ou usar Helm chart (recomendado)
# Ver: /k8s/helm/ (se disponível)
```

---

## 💾 Backup e Restore

### Backup Automático

Criar script de backup diário:

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR=/backups
DATE=$(date +%Y%m%d_%H%M%S)

# Backup PostgreSQL
docker-compose exec -T db pg_dump -U dental dental_clinic > $BACKUP_DIR/db_$DATE.sql

# Backup uploads
docker cp dental-app:/app/uploads $BACKUP_DIR/uploads_$DATE

# Manter apenas últimos 7 dias
find $BACKUP_DIR -name "db_*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "uploads_*" -mtime +7 -delete
```

Adicionar ao cron:
```bash
# Executar todo dia às 2h
0 2 * * * /path/to/backup.sh
```

### Restore

```bash
# Restaurar banco de dados
docker-compose exec -T db psql -U dental dental_clinic < backup.sql

# Restaurar uploads
docker cp backup/uploads dental-app:/app/uploads
```

---

## 🌍 Variáveis de Ambiente

### Principais Variáveis

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `NODE_ENV` | production | Ambiente de execução |
| `PORT` | 5000 | Porta da aplicação |
| `DATABASE_URL` | - | URL de conexão PostgreSQL |
| `REDIS_HOST` | redis | Host do Redis |
| `REDIS_PASSWORD` | - | Senha do Redis |
| `SESSION_SECRET` | - | Secret para sessões (OBRIGATÓRIO) |

### Variáveis Opcionais

| Variável | Descrição |
|----------|-----------|
| `GOOGLE_CLIENT_ID` | OAuth Google Client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth Google Secret |
| `SMTP_HOST` | Servidor SMTP para emails |
| `SENTRY_DSN` | Sentry para tracking de erros |
| `LOG_LEVEL` | Nível de log (debug, info, warn, error) |

---

## 📞 Suporte

- **Documentação Completa:** [REFATORACAO_ESCALABILIDADE.md](REFATORACAO_ESCALABILIDADE.md)
- **Issues:** GitHub Issues
- **Health Check:** http://localhost:5000/health

---

## 📝 Notas

- Todos os dados são persistidos em volumes Docker
- Volumes nomeados: `postgres_data`, `redis_data`, `uploads`
- Para deletar dados permanentemente: `docker-compose down -v`
- Sempre faça backup antes de atualizações
- Monitore os health checks em produção

---

**Desenvolvido com ❤️ para escalar até 5.000+ usuários simultâneos**
