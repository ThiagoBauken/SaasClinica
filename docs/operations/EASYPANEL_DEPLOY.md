# Deploy no EasyPanel - Dental SaaS

## Pré-requisitos
- VPS com EasyPanel instalado
- Wuzapi 3.0 já rodando no EasyPanel
- Repositório Git (GitHub/GitLab)

## Passo 1: Criar Serviços de Banco de Dados

### PostgreSQL
1. No EasyPanel, vá em **+ Create Service** > **Database** > **Postgres**
2. Configure:
   - **Service Name**: `dental-db`
   - **Password**: Gere uma senha forte
   - **Database**: `dental_clinic`
3. Clique em **Create**

### Redis
1. **+ Create Service** > **Database** > **Redis**
2. Configure:
   - **Service Name**: `dental-redis`
   - **Password**: Gere uma senha forte
3. Clique em **Create**

## Passo 2: Criar o App

1. **+ Create Service** > **App**
2. Configure:
   - **Service Name**: `dental-app`
   - **Source**: GitHub/GitLab
   - **Repository**: URL do seu repositório
   - **Branch**: `main`
   - **Build**: Dockerfile (já detecta automaticamente)

## Passo 3: Configurar Variáveis de Ambiente

Na aba **Environment** do app, adicione as variáveis do arquivo `.env.easypanel`:

```env
# Básico
NODE_ENV=production
PORT=5000

# Database (use o nome do serviço)
DATABASE_URL=postgresql://postgres:SUA_SENHA@dental-db:5432/dental_clinic

# Redis
REDIS_HOST=dental-redis
REDIS_PORT=6379
REDIS_PASSWORD=SUA_SENHA_REDIS

# Session (GERAR ÚNICO!)
SESSION_SECRET=<gerar com node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">

# URL Pública (IMPORTANTE para webhooks!)
BASE_URL=https://dental-app.seudominio.easypanel.host

# Wuzapi (mesmo VPS)
WUZAPI_BASE_URL=https://private-wuzapi.pbzgje.easypanel.host
WUZAPI_ADMIN_TOKEN=seu-token-admin
```

## Passo 4: Configurar Domínio

1. Vá em **Domains** do app
2. Adicione um domínio ou use o gerado pelo EasyPanel
3. Ative **HTTPS** (Let's Encrypt automático)

## Passo 5: Configurar Volumes

1. Vá em **Mounts** do app
2. Adicione volume para uploads:
   - **Volume Name**: `dental-uploads`
   - **Mount Path**: `/app/uploads`

## Passo 6: Deploy

1. Clique em **Deploy**
2. Aguarde o build (pode levar 3-5 minutos)
3. Verifique os logs em **Logs**

## Passo 7: Configurar Webhook no Wuzapi

Após o deploy, configure o webhook no Wuzapi para apontar para seu app:

```
https://dental-app.seudominio.easypanel.host/api/webhooks/wuzapi/{companyId}
```

**IMPORTANTE**: Agora o webhook funcionará porque ambos estão na mesma VPS!

## Comandos Úteis

### Ver logs em tempo real
No EasyPanel, vá em **Logs** do serviço.

### Rodar migrations
```bash
# Via SSH no container
npm run db:migrate
```

### Verificar saúde do app
```
https://seu-app.easypanel.host/health
https://seu-app.easypanel.host/health/ready
https://seu-app.easypanel.host/health/live
```

## Arquitetura na VPS

```
┌─────────────────────────────────────────────────┐
│                   EasyPanel                      │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐            │
│  │  dental-app  │  │   wuzapi     │            │
│  │  (Node.js)   │  │   (Go)       │            │
│  │  :5000       │  │   :8080      │            │
│  └──────┬───────┘  └──────┬───────┘            │
│         │                  │                    │
│         │    webhook       │                    │
│         │◄─────────────────┤                    │
│         │                  │                    │
│  ┌──────┴───────┐  ┌──────┴───────┐            │
│  │  dental-db   │  │  dental-redis │            │
│  │  (Postgres)  │  │   (Redis)     │            │
│  └──────────────┘  └───────────────┘            │
│                                                  │
└─────────────────────────────────────────────────┘
                      │
                      │ HTTPS
                      ▼
                 Internet
```

## Solução de Problemas

### Build falha
- Verifique se o Dockerfile está correto
- Limpe cache: **Settings** > **Clear Build Cache**

### App não inicia
- Verifique variáveis de ambiente
- Confira logs de erro
- Verifique conexão com banco de dados

### Webhook não funciona
1. Confirme que `BASE_URL` está correto
2. Verifique se o Wuzapi consegue acessar a URL
3. Teste com: `curl https://seu-app.easypanel.host/health`

### Banco de dados não conecta
- Verifique se o nome do serviço está correto (ex: `dental-db`)
- Confirme a senha no DATABASE_URL
- Verifique se o serviço PostgreSQL está rodando
