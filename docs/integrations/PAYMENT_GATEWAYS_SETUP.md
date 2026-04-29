# Guia Completo de Configuração - Gateways de Pagamento

Este guia detalha como configurar **3 gateways de pagamento** para o sistema SaaS:

1. **Stripe** - Cartão de crédito internacional
2. **NOWPayments** - Criptomoedas (Bitcoin, Ethereum, USDT, etc.)
3. **MercadoPago** - Pix, Boleto e Cartão (Brasil)

---

## 📧 1. Configuração de Email SMTP

### Variáveis de Ambiente

```env
# SMTP Configuration (obrigatório para enviar emails)
SMTP_HOST=smtp.gmail.com          # Ex: smtp.gmail.com, smtp.office365.com
SMTP_PORT=587                       # 587 (TLS) ou 465 (SSL)
SMTP_SECURE=false                   # true para porta 465, false para 587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-app            # Senha de aplicativo do Gmail
EMAIL_FROM=DentalSystem <noreply@dentalsystem.com>
```

### Gmail - Como Obter Senha de Aplicativo

1. Acesse [myaccount.google.com](https://myaccount.google.com)
2. Vá em **Segurança**
3. Ative **Verificação em duas etapas** (obrigatório)
4. Procure por **Senhas de app**
5. Crie uma nova senha de app para "Email"
6. Use essa senha no `SMTP_PASS`

### Outros Provedores SMTP

**Office 365:**
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
```

**Amazon SES:**
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
```

**SendGrid:**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxx
```

---

## 💳 2. Stripe - Cartão de Crédito Internacional

### O que é?
Stripe é o gateway líder mundial para pagamentos com cartão. Ideal para clientes internacionais.

### Criar Conta

1. Acesse [stripe.com](https://stripe.com)
2. Clique em **Sign up**
3. Preencha os dados da empresa
4. Verifique seu email

### Obter Chaves da API

1. Faça login no dashboard
2. Vá em **Developers** → **API Keys**
3. Copie:
   - **Publishable key** (começa com `pk_test_` ou `pk_live_`)
   - **Secret key** (começa com `sk_test_` ou `sk_live_`)

### Configurar Webhooks

1. Vá em **Developers** → **Webhooks**
2. Clique em **Add endpoint**
3. URL do endpoint: `https://seu-dominio.com/api/webhooks/stripe`
4. Selecione os eventos:
   ```
   ✓ customer.subscription.created
   ✓ customer.subscription.updated
   ✓ customer.subscription.deleted
   ✓ customer.subscription.trial_will_end
   ✓ invoice.paid
   ✓ invoice.payment_failed
   ```
5. Copie o **Signing secret** (começa com `whsec_`)

### Variáveis de Ambiente

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxx
```

### Testar Localmente

```bash
# Instalar Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Redirecionar webhooks para localhost
stripe listen --forward-to localhost:5000/api/webhooks/stripe
```

### Cartões de Teste

```
✓ Sucesso: 4242 4242 4242 4242
✗ Falha: 4000 0000 0000 0002
⏳ 3D Secure: 4000 0027 6000 3184
```

---

## ₿ 3. NOWPayments - Criptomoedas

### O que é?
NOWPayments permite aceitar Bitcoin, Ethereum, USDT e mais de 300 criptomoedas.

### Criar Conta

1. Acesse [nowpayments.io](https://nowpayments.io)
2. Clique em **Sign up**
3. Verifique seu email
4. Complete o KYC (se necessário)

### Obter Chaves da API

1. Faça login no dashboard
2. Vá em **Settings** → **API Keys**
3. Clique em **Generate API Key**
4. Copie a chave (começará com algo único)

### Configurar IPN (Webhook)

1. Vá em **Settings** → **IPN**
2. URL do IPN: `https://seu-dominio.com/api/webhooks/nowpayments`
3. Gere um **IPN Secret** (senha aleatória)
4. Salve o secret

### Variáveis de Ambiente

```env
# NOWPayments
NOWPAYMENTS_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxx
NOWPAYMENTS_IPN_SECRET=sua_senha_secreta_123
```

### Moedas Suportadas

```
Bitcoin (BTC)
Ethereum (ETH)
Tether USDT (TRC20, ERC20)
Binance Coin (BNB)
Litecoin (LTC)
Dogecoin (DOGE)
+ 300 outras
```

### Taxas

- **Taxa de processamento:** 0.5% - 1.5%
- **Taxa de rede:** Variável (paga pelo cliente)
- **Conversão automática:** USD, BRL, EUR disponível

### Fluxo de Pagamento

1. Cliente escolhe criptomoeda (ex: BTC)
2. Sistema gera endereço de pagamento
3. Cliente envia crypto para o endereço
4. Blockchain confirma (1-30 min dependendo da moeda)
5. Webhook notifica o sistema
6. Assinatura é ativada

---

## 🇧🇷 4. MercadoPago - Pix, Boleto e Cartão (Brasil)

### O que é?
MercadoPago é o gateway de pagamento do Mercado Livre, líder na América Latina.

### Criar Conta

1. Acesse [mercadopago.com.br](https://mercadopago.com.br)
2. Clique em **Criar conta**
3. Escolha **Conta de Vendedor**
4. Complete o cadastro e KYC

### Obter Credenciais

1. Faça login
2. Vá em **Seu negócio** → **Configurações** → **Credenciais**
3. Copie:
   - **Public key** (começa com `APP_USR-`)
   - **Access token** (começa com `APP_USR-`)

### Configurar Webhooks

1. Vá em **Seu negócio** → **Webhooks**
2. Crie novo webhook
3. URL: `https://seu-dominio.com/api/webhooks/mercadopago`
4. Eventos:
   ```
   ✓ payment
   ✓ subscription_preapproval
   ✓ subscription_authorized_payment
   ```
5. Gere um **Secret** para validação

### Variáveis de Ambiente

```env
# MercadoPago
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxxxxxxxxxxxxxxxxxxxxxx
MERCADOPAGO_WEBHOOK_SECRET=sua_senha_webhook_123
```

### Métodos de Pagamento Suportados

**Pix:**
- ✓ Aprovação instantânea (segundos)
- ✓ Disponível 24/7
- ✓ QR Code gerado automaticamente
- Taxa: ~1.5%

**Boleto:**
- ✓ Aprovação em 1-3 dias úteis
- ✓ PDF gerado automaticamente
- Taxa: ~3-4%

**Cartão de Crédito:**
- ✓ Aprovação instantânea
- ✓ Parcelamento até 12x
- Taxa: ~4-5% + R$0.40

### Testar com Sandbox

```env
# Sandbox (testes)
MERCADOPAGO_ACCESS_TOKEN=TEST-xxxxxxxxxxxxxxx
```

**Cartões de Teste:**
```
✓ Mastercard: 5031 4332 1540 6351
✓ Visa: 4509 9535 6623 3704
CVV: 123
Validade: 11/25
```

---

## 🚀 Resumo de Variáveis de Ambiente

Adicione todas essas variáveis no arquivo `.env`:

```env
# ========================================
# BASE URL
# ========================================
BASE_URL=https://seu-dominio.com

# ========================================
# EMAIL (SMTP)
# ========================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-app-gmail
EMAIL_FROM=DentalSystem <noreply@dentalsystem.com>

# ========================================
# STRIPE (Cartão Internacional)
# ========================================
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxx

# ========================================
# NOWPAYMENTS (Criptomoedas)
# ========================================
NOWPAYMENTS_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxx
NOWPAYMENTS_IPN_SECRET=sua_senha_secreta_123

# ========================================
# MERCADOPAGO (Pix, Boleto, Cartão BR)
# ========================================
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxxxxxxxxxxxxxxxxxxxxxx
MERCADOPAGO_WEBHOOK_SECRET=sua_senha_webhook_123

# ========================================
# SESSION (já configurado)
# ========================================
SESSION_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 🔐 Segurança dos Webhooks

Todos os webhooks implementados incluem **verificação de assinatura**:

### Stripe
```typescript
stripe.webhooks.constructEvent(payload, signature, webhookSecret)
```

### NOWPayments
```typescript
const hmac = crypto.createHmac('sha512', IPN_SECRET);
const calculatedSig = hmac.update(payload).digest('hex');
```

### MercadoPago
```typescript
const manifest = `id:${id};request-id:${requestId};ts:${timestamp};`;
const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
```

---

## 📊 Comparação dos Gateways

| Gateway | Melhor Para | Taxas | Aprovação | Moedas |
|---------|-------------|-------|-----------|--------|
| **Stripe** | Internacional | 2.9% + $0.30 | Instantânea | Cartão |
| **NOWPayments** | Crypto entusiastas | 0.5-1.5% | 1-30 min | 300+ crypto |
| **MercadoPago** | Brasil | 1.5-5% | Instantânea (Pix) | Pix, Boleto, Cartão |

---

## 🎯 Recomendações

### Para Clínicas Brasileiras
1. **Primário:** MercadoPago (Pix)
2. **Secundário:** Stripe (cartão)
3. **Opcional:** NOWPayments (crypto)

### Para Clínicas Internacionais
1. **Primário:** Stripe (cartão)
2. **Opcional:** NOWPayments (crypto)

### Para Máxima Conversão
- ✓ Ative todos os 3 gateways
- ✓ Deixe o cliente escolher
- ✓ Pix tem maior taxa de conversão no Brasil

---

## 🐛 Troubleshooting

### Emails não enviam
```bash
# Testar SMTP
npm install -g smtp-tester
smtp-tester --host smtp.gmail.com --port 587 --user seu-email@gmail.com --pass sua-senha
```

### Webhooks não chegam
```bash
# Verificar logs do servidor
tail -f /var/log/app.log | grep webhook

# Testar localmente (Stripe)
stripe listen --forward-to localhost:5000/api/webhooks/stripe

# Testar com ngrok (MercadoPago/NOWPayments)
ngrok http 5000
```

### Pagamento não confirma
- Verifique os logs do webhook
- Confirme que o `WEBHOOK_SECRET` está correto
- Verifique se a URL do webhook está acessível publicamente

---

## 📚 Documentação Oficial

- **Stripe:** [stripe.com/docs](https://stripe.com/docs)
- **NOWPayments:** [nowpayments.io/doc](https://nowpayments.io/doc)
- **MercadoPago:** [mercadopago.com.br/developers](https://mercadopago.com.br/developers)

---

## ✅ Checklist de Implementação

- [ ] Configurar SMTP para envio de emails
- [ ] Criar conta no Stripe
- [ ] Obter chaves da API do Stripe
- [ ] Configurar webhooks do Stripe
- [ ] Criar conta no NOWPayments
- [ ] Obter API key do NOWPayments
- [ ] Configurar IPN do NOWPayments
- [ ] Criar conta no MercadoPago
- [ ] Obter access token do MercadoPago
- [ ] Configurar webhooks do MercadoPago
- [ ] Adicionar todas as variáveis de ambiente no `.env`
- [ ] Testar cada gateway em modo sandbox
- [ ] Ativar modo produção quando pronto

---

**Dica:** Comece testando com o **MercadoPago** (Pix) pois é o mais fácil de configurar e tem alta taxa de conversão no Brasil!
