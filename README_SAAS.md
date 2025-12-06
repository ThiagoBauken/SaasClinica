# 🚀 DentalSystem SaaS - Sistema Completo

## ✨ Sobre o Sistema

Sistema SaaS completo para gerenciamento de clínicas odontológicas com **3 gateways de pagamento integrados**:

- 💳 **Stripe** - Cartão de crédito internacional
- ₿ **NOWPayments** - 300+ Criptomoedas (Bitcoin, Ethereum, USDT, etc.)
- 🇧🇷 **MercadoPago** - Pix, Boleto e Cartão (Brasil)

---

## 🎯 Início Rápido (5 minutos)

### 1. Instalar Dependências
```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

Copie o arquivo de exemplo:
```bash
cp .env.example .env
```

Edite `.env` e configure pelo menos:
- `SESSION_SECRET` (gere com: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- `SMTP_*` (configure um provedor de email)
- Pelo menos 1 gateway de pagamento (Stripe, NOWPayments ou MercadoPago)

### 3. Executar Migrações
```bash
npm run db:push
```

### 4. Iniciar o Sistema
```bash
npm run dev
```

### 5. Acessar
- Dashboard: http://localhost:5000/dashboard
- Billing: http://localhost:5000/billing
- Landing Page: http://localhost:5000/landing

---

## 📚 Documentação Completa

- **[SAAS_SETUP.md](SAAS_SETUP.md)** - Setup geral do SaaS
- **[PAYMENT_GATEWAYS_SETUP.md](PAYMENT_GATEWAYS_SETUP.md)** - Configurar os 3 gateways
- **[COMPLETE_SAAS_IMPLEMENTATION.md](COMPLETE_SAAS_IMPLEMENTATION.md)** - Visão geral completa

---

## 🛠️ Tecnologias

### Backend
- Node.js + Express
- PostgreSQL + Drizzle ORM
- TypeScript
- Nodemailer (SMTP)
- Stripe SDK
- MercadoPago SDK
- Cron Jobs

### Frontend
- React 18
- TypeScript
- TailwindCSS
- Shadcn/UI
- TanStack Query
- Wouter (routing)

### Integrações
- Stripe (pagamentos)
- NOWPayments (crypto)
- MercadoPago (Brasil)
- SMTP (emails)
- N8N (automações)
- Google Calendar
- WhatsApp (Wuzapi)

---

## 📦 Estrutura do Projeto

```
.
├── client/                     # Frontend React
│   ├── src/
│   │   ├── pages/
│   │   │   └── billing-page.tsx           # Página de assinatura
│   │   ├── components/
│   │   │   └── PaymentGatewaySelector.tsx # Seletor de gateway
│   │   └── ...
│   └── ...
│
├── server/                     # Backend Node.js
│   ├── billing/
│   │   ├── stripe-service.ts              # Integração Stripe
│   │   ├── nowpayments-service.ts         # Integração crypto
│   │   ├── mercadopago-service.ts         # Integração MercadoPago
│   │   ├── subscription-service.ts        # Lógica de assinaturas
│   │   └── billing-apis.ts                # APIs de billing
│   │
│   ├── services/
│   │   ├── email-service.ts               # SMTP com templates
│   │   ├── coupon-service.ts              # Sistema de cupons
│   │   └── dunning-service.ts             # Dunning management
│   │
│   ├── jobs/
│   │   └── billing-cron.ts                # Cron jobs
│   │
│   ├── routes/
│   │   ├── payment-gateways.routes.ts     # APIs dos gateways
│   │   ├── coupons.routes.ts              # APIs de cupons
│   │   └── webhooks.routes.ts             # Webhooks centralizados
│   │
│   └── ...
│
├── shared/
│   └── schema.ts                          # Schema do banco
│
├── .env.example                           # Template de configuração
├── SAAS_SETUP.md                          # Documentação SaaS
├── PAYMENT_GATEWAYS_SETUP.md              # Documentação dos gateways
└── COMPLETE_SAAS_IMPLEMENTATION.md        # Visão geral completa
```

---

## 🎨 Funcionalidades

### Core SaaS
- [x] Landing page de vendas
- [x] Sistema de planos (Básico, Premium, Enterprise)
- [x] Trial de 7 dias
- [x] Página de billing para usuários
- [x] Upgrade/downgrade de planos
- [x] Cancelamento de assinatura
- [x] Histórico de faturas
- [x] Métricas de uso em tempo real
- [x] Enforcement de limites por plano

### Pagamentos
- [x] Stripe (cartão internacional)
- [x] NOWPayments (300+ criptomoedas)
- [x] MercadoPago (Pix, Boleto, Cartão BR)
- [x] Seletor visual de gateway
- [x] Webhooks com verificação de assinatura
- [x] Renovação automática
- [x] Trial-to-paid conversion

### Emails
- [x] SMTP com Nodemailer
- [x] Email de boas-vindas
- [x] Trial acabando (3 dias antes)
- [x] Pagamento confirmado
- [x] Falha no pagamento
- [x] Plano alterado
- [x] Templates HTML responsivos

### Cupons
- [x] Criação por admin
- [x] Desconto % ou fixo
- [x] Limite de usos
- [x] Período de validade
- [x] Restrição por plano
- [x] Validação automática
- [x] Histórico de uso

### Dunning Management
- [x] Verificação diária de trials
- [x] Sistema de retry (3 tentativas)
- [x] Cancelamento automático (dia 7)
- [x] Emails de lembrete
- [x] Cron jobs automáticos

---

## 🔐 Segurança

- ✅ Verificação de assinatura em todos webhooks
- ✅ HTTPS obrigatório em produção
- ✅ Rate limiting
- ✅ Session secrets seguros
- ✅ Proteção CSRF
- ✅ Headers de segurança (Helmet)
- ✅ Validação de dados (Zod)
- ✅ Logs de auditoria

---

## 🌐 APIs Disponíveis

### Billing
```
GET    /api/billing/plans              - Listar planos
GET    /api/billing/subscription       - Ver assinatura
POST   /api/billing/subscription       - Criar assinatura
PUT    /api/billing/subscription/plan  - Mudar plano
DELETE /api/billing/subscription       - Cancelar
GET    /api/billing/invoices           - Listar faturas
GET    /api/billing/usage              - Ver métricas
```

### Payment Gateways
```
# NOWPayments
GET    /api/v1/payment-gateways/nowpayments/currencies
POST   /api/v1/payment-gateways/nowpayments/create-payment
GET    /api/v1/payment-gateways/nowpayments/payment/:id

# MercadoPago
POST   /api/v1/payment-gateways/mercadopago/create-subscription
POST   /api/v1/payment-gateways/mercadopago/create-payment
GET    /api/v1/payment-gateways/mercadopago/payment/:id

# Stripe
POST   /api/stripe/create-checkout-session
POST   /api/stripe/create-portal-session
```

### Webhooks
```
POST   /api/webhooks/stripe          - Stripe events
POST   /api/webhooks/nowpayments     - Crypto payments
POST   /api/webhooks/mercadopago     - Pix/Boleto/Cartão
```

### Cupons
```
POST   /api/v1/coupons/validate      - Validar cupom
POST   /api/v1/coupons                - Criar (admin)
GET    /api/v1/coupons                - Listar (admin)
PUT    /api/v1/coupons/:id            - Atualizar (admin)
DELETE /api/v1/coupons/:id            - Desativar (admin)
```

---

## 🧪 Testes

### Stripe
```
✓ Sucesso: 4242 4242 4242 4242
✗ Falha: 4000 0000 0000 0002
```

### MercadoPago (Sandbox)
```
✓ Mastercard: 5031 4332 1540 6351
✓ Visa: 4509 9535 6623 3704
CVV: 123
Validade: 11/25
```

### NOWPayments
Use testnet das criptomoedas para testes.

---

## 📊 Comparação dos Gateways

| Gateway | Ideal Para | Taxas | Aprovação |
|---------|------------|-------|-----------|
| **Stripe** | Internacional | 2.9% + $0.30 | Instantânea |
| **NOWPayments** | Crypto | 0.5-1.5% | 1-30 min |
| **MercadoPago** | Brasil | 1.5-5% | Instantânea (Pix) |

---

## 🚀 Deploy

### Replit
```bash
# Já configurado, só clicar em "Run"
```

### Vercel
```bash
vercel --prod
```

### Docker
```bash
docker-compose up -d
```

### VPS Manual
```bash
npm run build
npm start
```

---

## 📝 Variáveis de Ambiente Obrigatórias

```env
# Banco de dados
DATABASE_URL=postgresql://...

# Segurança
SESSION_SECRET=... (32+ caracteres)

# Email (escolha um)
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...

# Pelo menos 1 gateway (recomendado: todos os 3)
STRIPE_SECRET_KEY=...
NOWPAYMENTS_API_KEY=...
MERCADOPAGO_ACCESS_TOKEN=...
```

---

## 🆘 Suporte

### Problemas Comuns

**Emails não enviam**
- Verifique SMTP_* no `.env`
- Use senha de aplicativo do Gmail
- Teste com: `npm run test:email`

**Webhook não funciona**
- Verifique se o domínio é público
- Use ngrok para testes locais
- Verifique logs do servidor

**Pagamento não confirma**
- Verifique WEBHOOK_SECRET correto
- Confirme que a URL do webhook está pública
- Cheque logs: `tail -f logs/app.log`

---

## 📖 Links Úteis

- **Stripe:** https://stripe.com/docs
- **NOWPayments:** https://nowpayments.io/doc
- **MercadoPago:** https://mercadopago.com.br/developers
- **Nodemailer:** https://nodemailer.com/

---

## 🎓 Como Funciona

### Fluxo de Pagamento Stripe
1. Cliente escolhe plano
2. Clica em "Assinar" → Seleciona "Cartão"
3. Redirecionado para Stripe Checkout
4. Insere dados do cartão
5. Stripe processa → Webhook confirma
6. Assinatura ativa + Email enviado

### Fluxo de Pagamento Crypto
1. Cliente escolhe plano
2. Clica em "Assinar" → Seleciona "Crypto" → BTC/ETH/USDT
3. Sistema gera endereço de pagamento
4. Cliente envia crypto
5. Blockchain confirma (1-30 min) → Webhook confirma
6. Assinatura ativa + Email enviado

### Fluxo de Pagamento Pix
1. Cliente escolhe plano
2. Clica em "Assinar" → Seleciona "Pix"
3. Sistema gera QR Code
4. Cliente escaneia e paga (instantâneo)
5. MercadoPago confirma → Webhook confirma
6. Assinatura ativa + Email enviado

---

## ✅ Checklist Antes do Launch

- [ ] Trocar chaves de teste para produção
- [ ] Configurar SMTP de produção
- [ ] Testar todos os 3 gateways
- [ ] Verificar webhooks funcionando
- [ ] Testar todos os emails
- [ ] Configurar domínio próprio
- [ ] SSL/HTTPS configurado
- [ ] Backup do banco configurado
- [ ] Monitoramento ativo
- [ ] Cron jobs funcionando

---

## 📄 Licença

MIT - Você pode usar como quiser!

---

**💙 Desenvolvido com amor para dentistas**

Sistema completo, profissional e pronto para produção!
