# ✅ CHECKLIST DE DEPLOY - INTEGRAÇÃO N8N PRODUÇÃO

**Data:** 16/11/2024
**Versão:** 1.0
**Status:** FASE 1 COMPLETA

---

## 📋 PRÉ-DEPLOY

### 1. Validação Local

- [ ] Todos os testes E2E passaram
- [ ] Migrations rodadas sem erros
- [ ] TypeScript compila sem erros (`npm run check`)
- [ ] Build funciona (`npm run build`)
- [ ] Webhook secrets configurados
- [ ] Automation logs funcionando

### 2. Preparação do Ambiente

- [ ] Servidor de produção provisionado
- [ ] PostgreSQL instalado e configurado
- [ ] Redis instalado e configurado
- [ ] N8N instalado (ou conta cloud)
- [ ] Domínio configurado com SSL
- [ ] Firewall configurado (portas 5000, 5678, 5432, 6379)

---

## 🔐 SEGURANÇA

### 1. Variáveis de Ambiente

Criar arquivo `.env` em produção com:

```bash
# ===========================================
# PRODUÇÃO - SEGURANÇA CRÍTICA
# ===========================================

# Gerar secrets aleatórios:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

SESSION_SECRET=<GERAR_SECRET_64_CARACTERES>
N8N_WEBHOOK_SECRET=<GERAR_SECRET_64_CARACTERES>
WUZAPI_WEBHOOK_SECRET=<GERAR_SECRET_64_CARACTERES>

# Database (produção)
DATABASE_URL=postgresql://user:pass@prod-db:5432/dental_clinic

# Redis (produção)
REDIS_HOST=prod-redis
REDIS_PORT=6379
REDIS_PASSWORD=<SENHA_REDIS>

# N8N (produção)
N8N_WEBHOOK_BASE_URL=https://n8n.suaempresa.com

# Wuzapi (produção)
WUZAPI_API_KEY=<API_KEY_WUZAPI>
WUZAPI_INSTANCE_ID=<INSTANCE_ID>
WUZAPI_BASE_URL=https://wuzapi.cloud/api/v2

# Ambiente
NODE_ENV=production
PORT=5000
LOG_LEVEL=warn
```

**CRÍTICO:**
- [ ] Todos os secrets são únicos e nunca usados antes
- [ ] Arquivo `.env` NÃO está no Git
- [ ] Backup do `.env` em local seguro (1Password, Vault, etc)

### 2. Banco de Dados

- [ ] SSL habilitado na conexão PostgreSQL
- [ ] Usuário com privilégios mínimos (não usar superuser)
- [ ] Backup automático configurado (diário)
- [ ] Retenção de backups (30 dias)
- [ ] Teste de restore de backup realizado

### 3. N8N

- [ ] N8N rodando com SSL (https://n8n.suaempresa.com)
- [ ] Autenticação habilitada (usuário/senha)
- [ ] Webhooks públicos desabilitados (apenas com auth)
- [ ] Logs de execução ativos
- [ ] Notificações de erro configuradas

### 4. Wuzapi

- [ ] Conta premium ativada (não trial)
- [ ] Webhook URL configurada (https://api.suaempresa.com/api/webhooks/wuzapi/incoming)
- [ ] Webhook secret definido
- [ ] Número verificado e conectado
- [ ] Taxa de mensagens configurada (evitar bloqueio)

---

## 🚀 DEPLOYMENT

### 1. Preparar Código

```bash
# No repositório local:
git checkout main
git pull origin main

# Verificar build
npm run build

# Verificar testes
npm run check

# Criar tag de versão
git tag v1.0.0-integrations
git push origin v1.0.0-integrations
```

### 2. Deploy no Servidor

```bash
# SSH no servidor
ssh user@prod-server

# Clonar repositório (primeira vez)
git clone https://github.com/sua-empresa/dental-clinic.git
cd dental-clinic

# Ou atualizar (deploys subsequentes)
git pull origin main

# Instalar dependências
npm ci --production

# Build
npm run build

# Copiar .env (NÃO commitado no git)
cp /caminho/seguro/.env .env

# Verificar configuração
cat .env | grep -v PASSWORD  # Ver sem mostrar senhas
```

### 3. Migrations

```bash
# Rodar migrations de integração
npm run db:migrate-integrations

# Verificar sucesso
psql -U dental -d dental_clinic -c "\dt" | grep clinic_settings
psql -U dental -d dental_clinic -c "\dt" | grep automation_logs

# Verificar funções SQL
psql -U dental -d dental_clinic -c "\df get_appointments_needing_confirmation"
psql -U dental -d dental_clinic -c "\df get_today_birthdays"
```

### 4. Importar Fluxos N8N

No navegador, acessar `https://n8n.suaempresa.com`:

- [ ] Importar `ATUALIZADO_Agendamento.json`
- [ ] Importar `ATUALIZADO_Agente_IA.json`
- [ ] Importar `ATUALIZADO_Confirmacao.json`
- [ ] Importar `ATUALIZADO_Cancelamento.json`
- [ ] Importar `ATUALIZADO_Reagendamento.json`

Para cada fluxo:
- [ ] Configurar credenciais Wuzapi
- [ ] Configurar credenciais Google Calendar (se usar)
- [ ] Configurar webhook callback URL (https://api.suaempresa.com)
- [ ] Ativar workflow
- [ ] Testar manualmente (Execute Workflow)

### 5. Iniciar Serviços

```bash
# PM2 (recomendado)
npm install -g pm2

pm2 start dist/index.js --name dental-api
pm2 save
pm2 startup  # Configurar auto-start

# Ou Docker
docker-compose -f docker-compose.prod.yml up -d

# Verificar logs
pm2 logs dental-api
# ou
docker logs -f dental-api
```

### 6. Configurar Nginx (Reverse Proxy)

```nginx
# /etc/nginx/sites-available/dental-api
server {
    listen 443 ssl http2;
    server_name api.suaempresa.com;

    ssl_certificate /etc/letsencrypt/live/api.suaempresa.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.suaempresa.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeout para webhooks
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:5000/health;
        access_log off;
    }
}
```

```bash
# Ativar site
sudo ln -s /etc/nginx/sites-available/dental-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## ✅ VALIDAÇÃO PÓS-DEPLOY

### 1. Health Checks

```bash
# API rodando?
curl https://api.suaempresa.com/health
# Esperado: {"status":"ok","timestamp":"..."}

# Database conectado?
curl https://api.suaempresa.com/health/ready
# Esperado: {"status":"ready","db":"connected"}

# Logs sem erros?
pm2 logs dental-api --lines 100 | grep ERROR
# Esperado: sem erros críticos
```

### 2. Teste de Integração

**A. Configurar Wuzapi**
```bash
# Acessar frontend
https://app.suaempresa.com/configuracoes/integracoes

# Preencher:
- Instance ID
- API Key
- Admin Phone

# Testar conexão
Clicar: "Testar Conexão"
Resultado: ✅ "Conexão bem-sucedida"
```

**B. Enviar Mensagem Teste**
```bash
# Na mesma página:
Clicar: "Enviar Mensagem Teste"
Número: +5577998698925
Mensagem: "Teste de produção - Sistema funcionando!"

# Verificar WhatsApp
Resultado: ✅ Mensagem recebida
```

**C. Criar Agendamento Real**
```bash
# Via frontend ou API
POST https://api.suaempresa.com/api/v1/appointments

# Verificar:
✅ WhatsApp enviado para paciente
✅ Google Calendar criado
✅ Automation log registrado
✅ Callback N8N funcionou
```

### 3. Monitoramento

- [ ] Configurar alertas de erro (email/Slack)
- [ ] Configurar monitoramento de uptime (UptimeRobot)
- [ ] Configurar Sentry para tracking de erros
- [ ] Criar dashboard Grafana (opcional)

**Exemplo de alerta**:
```javascript
// PM2 Ecosystem (ecosystem.config.js)
module.exports = {
  apps: [{
    name: 'dental-api',
    script: 'dist/index.js',
    instances: 2,
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    // Restart on crash
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
  }]
}
```

---

## 📊 MÉTRICAS DE SUCESSO

Após 24h em produção:

- [ ] **Uptime:** > 99.9%
- [ ] **Mensagens WhatsApp:** 100% entregues
- [ ] **Tempo de resposta API:** < 200ms (p95)
- [ ] **Erros:** < 0.1% das requisições
- [ ] **Webhooks N8N:** 100% recebidos
- [ ] **Confirmações:** Detectadas corretamente
- [ ] **Logs:** Sem erros críticos

---

## 🔄 ROLLBACK PLAN

Se algo der errado:

```bash
# 1. Parar nova versão
pm2 stop dental-api

# 2. Reverter para versão anterior
git checkout v0.9.0  # Tag anterior
npm ci --production
npm run build

# 3. Reverter migrations (se necessário)
psql -U dental -d dental_clinic < backup_pre_migration.sql

# 4. Reiniciar versão antiga
pm2 restart dental-api

# 5. Verificar funcionamento
curl https://api.suaempresa.com/health
```

---

## 📝 PÓS-DEPLOY

### 1. Documentação

- [ ] Atualizar changelog com versão nova
- [ ] Documentar configurações de produção
- [ ] Criar runbook para operações comuns
- [ ] Treinar equipe sobre novo sistema

### 2. Comunicação

- [ ] Notificar equipe do deploy bem-sucedido
- [ ] Enviar email para clientes sobre novas features
- [ ] Atualizar status page (se houver)

### 3. Backups

- [ ] Verificar backup automático funcionando
- [ ] Fazer backup manual pós-deploy
- [ ] Testar restore em ambiente de staging
- [ ] Documentar procedimento de restore

---

## 🎯 CHECKLIST FINAL

Antes de marcar como concluído:

- [ ] Todos os health checks passando
- [ ] Mensagem teste enviada e recebida
- [ ] Agendamento real testado end-to-end
- [ ] Confirmação de paciente funciona
- [ ] Cancelamento notifica corretamente
- [ ] Logs sendo registrados
- [ ] Monitoramento ativo
- [ ] Rollback plan testado
- [ ] Equipe treinada
- [ ] Documentação atualizada

---

## 🚨 SUPORTE

Em caso de problemas:

1. **Logs do servidor:**
   ```bash
   pm2 logs dental-api --lines 500
   tail -f /var/log/nginx/error.log
   ```

2. **Logs do banco:**
   ```bash
   tail -f /var/log/postgresql/postgresql-14-main.log
   ```

3. **Logs do N8N:**
   ```bash
   # No painel N8N: Executions > View logs
   ```

4. **Contatos de emergência:**
   - DevOps: +55 77 99869-8925
   - Database Admin: suporte@empresa.com
   - Wuzapi Support: https://wuzapi.cloud/support

---

**✅ DEPLOY COMPLETO - Sistema em produção!**

**Data do Deploy:** __/__/____
**Responsável:** _______________
**Validado por:** _______________
