# 💳 Sistema de Billing e Assinaturas - Documentação Completa

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Schema do Banco de Dados](#schema-do-banco-de-dados)
4. [Planos e Limites](#planos-e-limites)
5. [APIs Disponíveis](#apis-disponíveis)
6. [Integração com Stripe](#integração-com-stripe)
7. [Middleware de Limites](#middleware-de-limites)
8. [Webhooks](#webhooks)
9. [Como Usar](#como-usar)
10. [Exemplos de Código](#exemplos-de-código)

---

## 🎯 Visão Geral

Sistema completo de Billing SaaS com:

- ✅ **3 Planos** (Básico, Profissional, Empresarial)
- ✅ **Enforcement de Limites** (pacientes, usuários, agendamentos, automações, storage)
- ✅ **Integração com Stripe** (pagamentos recorrentes, webhooks)
- ✅ **Gestão de Assinaturas** (criar, alterar plano, cancelar)
- ✅ **Métricas de Uso** em tempo real
- ✅ **Faturamento Automático**
- ✅ **Trial de 14-30 dias**

---

## 🏗 Arquitetura

```
server/billing/
├── subscription-service.ts     # Lógica de assinaturas
├── stripe-service.ts           # Integração Stripe
├── limits-middleware.ts        # Enforcement de limites
├── billing-apis.ts             # APIs REST
├── stripe-routes.ts            # Rotas Stripe
└── index.ts                    # Exports
```

### Fluxo de Assinatura

```
1. Empresa se cadastra
   ↓
2. Cria assinatura (trial)
   ↓
3. Stripe Checkout Session
   ↓
4. Cliente paga
   ↓
5. Webhook ativa assinatura
   ↓
6. Sistema aplica limites do plano
```

---

## 🗄 Schema do Banco de Dados

### Tabela: `plans`

```sql
CREATE TABLE plans (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,           -- basic, professional, enterprise
  display_name TEXT NOT NULL,          -- Básico, Profissional, Empresarial
  monthly_price DECIMAL(10,2) NOT NULL,
  yearly_price DECIMAL(10,2),
  trial_days INTEGER DEFAULT 14,

  -- Limites
  max_users INTEGER DEFAULT 5,
  max_patients INTEGER DEFAULT 100,
  max_appointments_per_month INTEGER DEFAULT 500,
  max_automations INTEGER DEFAULT 5,
  max_storage_gb INTEGER DEFAULT 5,

  features JSONB,                       -- Lista de features incluídas
  is_active BOOLEAN DEFAULT true,
  is_popular BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0
);
```

### Tabela: `subscriptions`

```sql
CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER UNIQUE REFERENCES companies(id),
  plan_id INTEGER REFERENCES plans(id),
  status TEXT DEFAULT 'trial',          -- trial, active, past_due, canceled, expired
  billing_cycle TEXT DEFAULT 'monthly', -- monthly, yearly

  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  trial_ends_at TIMESTAMP,
  canceled_at TIMESTAMP,

  -- Stripe Integration
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,

  -- Mercado Pago Integration
  mercado_pago_subscription_id TEXT UNIQUE,
  mercado_pago_customer_id TEXT
);
```

### Tabela: `usage_metrics`

```sql
CREATE TABLE usage_metrics (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id),
  metric_type TEXT NOT NULL,  -- users, patients, appointments, automations, storage_gb
  current_value INTEGER DEFAULT 0,
  period_start TIMESTAMP,
  period_end TIMESTAMP
);
```

---

## 📦 Planos e Limites

### Plano Básico (R$ 97/mês)

```json
{
  "name": "basic",
  "monthlyPrice": 97.00,
  "yearlyPrice": 970.00,
  "trialDays": 14,
  "limits": {
    "maxUsers": 3,
    "maxPatients": 100,
    "maxAppointmentsPerMonth": 300,
    "maxAutomations": 3,
    "maxStorageGB": 5
  },
  "features": [
    "agenda",
    "pacientes",
    "financeiro_basico",
    "relatorios_basicos"
  ]
}
```

### Plano Profissional (R$ 197/mês) 🌟 POPULAR

```json
{
  "name": "professional",
  "monthlyPrice": 197.00,
  "yearlyPrice": 1970.00,
  "trialDays": 14,
  "limits": {
    "maxUsers": 10,
    "maxPatients": 500,
    "maxAppointmentsPerMonth": 1000,
    "maxAutomations": 10,
    "maxStorageGB": 20
  },
  "features": [
    "whatsapp",
    "automacoes",
    "estoque",
    "proteses",
    "api_acesso",
    "relatorios_avancados"
  ]
}
```

### Plano Empresarial (R$ 497/mês)

```json
{
  "name": "enterprise",
  "monthlyPrice": 497.00,
  "yearlyPrice": 4970.00,
  "trialDays": 30,
  "limits": {
    "maxUsers": 999,
    "maxPatients": 999999,
    "maxAppointmentsPerMonth": 999999,
    "maxAutomations": 999,
    "maxStorageGB": 200
  },
  "features": [
    "multi_clinicas",
    "suporte_prioritario",
    "onboarding_personalizado",
    "integracao_customizada"
  ]
}
```

---

## 🔌 APIs Disponíveis

### GET /api/billing/plans
**Descrição:** Listar todos os planos disponíveis (pública)

**Response:**
```json
[
  {
    "id": 1,
    "name": "basic",
    "displayName": "Básico",
    "monthlyPrice": "97.00",
    "yearlyPrice": "970.00",
    "maxUsers": 3,
    "maxPatients": 100,
    "features": [...],
    "featuresDetailed": [...]
  }
]
```

---

### GET /api/billing/subscription
**Descrição:** Obter assinatura da empresa do usuário logado

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "id": 1,
  "companyId": 1,
  "planId": 2,
  "status": "active",
  "billingCycle": "monthly",
  "currentPeriodStart": "2025-01-01T00:00:00Z",
  "currentPeriodEnd": "2025-02-01T00:00:00Z",
  "plan": {
    "name": "professional",
    "displayName": "Profissional",
    "monthlyPrice": "197.00"
  },
  "usage": [
    {
      "metricType": "patients",
      "currentValue": 45,
      "limit": 500,
      "percentage": 9
    }
  ]
}
```

---

### POST /api/billing/subscription
**Descrição:** Criar nova assinatura

**Body:**
```json
{
  "planId": 2,
  "billingCycle": "monthly"
}
```

**Response:**
```json
{
  "id": 1,
  "companyId": 1,
  "planId": 2,
  "status": "trial",
  "trialEndsAt": "2025-01-15T00:00:00Z"
}
```

---

### PUT /api/billing/subscription/plan
**Descrição:** Alterar plano (upgrade/downgrade)

**Body:**
```json
{
  "planId": 3,
  "reason": "upgrade"
}
```

---

### DELETE /api/billing/subscription
**Descrição:** Cancelar assinatura

**Body:**
```json
{
  "reason": "user_cancellation"
}
```

---

### GET /api/billing/usage
**Descrição:** Obter métricas de uso da empresa

**Response:**
```json
{
  "usage": [
    {
      "metricType": "users",
      "currentValue": 5,
      "limit": 10,
      "percentage": 50,
      "isNearLimit": false,
      "isOverLimit": false
    },
    {
      "metricType": "patients",
      "currentValue": 420,
      "limit": 500,
      "percentage": 84,
      "isNearLimit": true,
      "isOverLimit": false
    }
  ],
  "limits": {
    "maxUsers": 10,
    "maxPatients": 500,
    ...
  }
}
```

---

### GET /api/billing/check-limit/:metricType
**Descrição:** Verificar se pode criar novo recurso

**Params:** `metricType` = `users` | `patients` | `appointments` | `automations`
**Query:** `currentValue` = número atual

**Response:**
```json
{
  "allowed": true,
  "limit": 500,
  "current": 420
}
```

---

## 💳 Integração com Stripe

### 1. Configurar Variáveis de Ambiente

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
BASE_URL=https://seusite.com
```

### 2. Criar Price IDs no Stripe

```bash
# Plano Básico Mensal
stripe prices create \
  --unit-amount 9700 \
  --currency brl \
  --recurring[interval]=month \
  --product=prod_basic

# Plano Profissional Mensal
stripe prices create \
  --unit-amount 19700 \
  --currency brl \
  --recurring[interval]=month \
  --product=prod_professional
```

### 3. Criar Checkout Session

**POST /api/stripe/create-checkout-session**

```json
{
  "priceId": "price_1234567890",
  "trialDays": 14
}
```

**Response:**
```json
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

### 4. Portal de Gerenciamento

**POST /api/stripe/create-portal-session**

```json
{
  "customerId": "cus_1234567890"
}
```

**Response:**
```json
{
  "url": "https://billing.stripe.com/..."
}
```

---

## 🛡 Middleware de Limites

### Aplicação nos Endpoints

```typescript
// Aplicar limite de pacientes
app.post("/api/patients", authCheck, checkPatientsLimit, async (req, res) => {
  // Criar paciente
});

// Aplicar limite de agendamentos
app.post("/api/appointments", authCheck, checkAppointmentsLimit, async (req, res) => {
  // Criar agendamento
});

// Aplicar limite de usuários
app.post("/api/users", authCheck, checkUsersLimit, async (req, res) => {
  // Criar usuário
});
```

### Resposta quando Limite Atingido

```json
{
  "error": "Limite de pacientes atingido",
  "message": "Seu plano permite até 100 pacientes. Você já tem 100. Faça upgrade do seu plano para cadastrar mais pacientes.",
  "limit": 100,
  "current": 100,
  "upgradeUrl": "/settings/billing"
}
```

---

## 🔔 Webhooks

### Endpoint do Webhook

**POST /api/stripe/webhook**

**Headers:**
- `stripe-signature`: Assinatura do Stripe

### Eventos Tratados

| Evento | Ação |
|--------|------|
| `customer.subscription.created` | Atualiza assinatura com IDs Stripe |
| `customer.subscription.updated` | Atualiza status e datas |
| `customer.subscription.deleted` | Marca como cancelada |
| `customer.subscription.trial_will_end` | Notifica empresa |
| `invoice.paid` | Registra fatura paga |
| `invoice.payment_failed` | Marca como `past_due` |

### Configurar Webhook no Stripe

```bash
stripe listen --forward-to localhost:5000/api/stripe/webhook
```

**Produção:**
```
URL: https://seusite.com/api/stripe/webhook
Eventos: customer.subscription.*, invoice.*
```

---

## 🚀 Como Usar

### 1. Executar Migration

```bash
npm run db:migrate
```

Isso criará:
- Tabelas de billing
- 3 planos pré-configurados
- Triggers de `updated_at`

### 2. Criar Assinatura para Empresa

```typescript
import { subscriptionService } from './server/billing';

await subscriptionService.createSubscription({
  companyId: 1,
  planId: 2, // Profissional
  billingCycle: 'monthly'
});
```

### 3. Verificar Limite Antes de Criar Recurso

```typescript
const check = await subscriptionService.checkLimit({
  companyId: 1,
  metricType: 'patients',
  currentValue: 45 // Tem 45 pacientes, quer criar o 46º
});

if (!check.allowed) {
  throw new Error(`Limite atingido: ${check.limit}`);
}
```

### 4. Processar Upgrade

```typescript
await subscriptionService.changePlan({
  companyId: 1,
  newPlanId: 3, // Enterprise
  reason: 'upgrade'
});
```

---

## 💻 Exemplos de Código

### Frontend: Listar Planos

```typescript
const { data: plans } = useQuery({
  queryKey: ['/api/billing/plans'],
});

plans.map(plan => (
  <PlanCard
    key={plan.id}
    name={plan.displayName}
    price={plan.monthlyPrice}
    features={plan.features}
    popular={plan.isPopular}
  />
));
```

### Frontend: Criar Checkout Session

```typescript
async function handleSubscribe(priceId: string) {
  const response = await fetch('/api/stripe/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priceId, trialDays: 14 })
  });

  const { url } = await response.json();
  window.location.href = url;
}
```

### Frontend: Mostrar Uso Atual

```typescript
const { data: usage } = useQuery({
  queryKey: ['/api/billing/usage'],
});

<UsageBar
  label="Pacientes"
  current={usage.usage.find(m => m.metricType === 'patients').currentValue}
  limit={usage.limits.maxPatients}
  percentage={usage.usage.find(m => m.metricType === 'patients').percentage}
  isNearLimit={usage.usage.find(m => m.metricType === 'patients').isNearLimit}
/>
```

---

## 🔐 Segurança

### Verificações Implementadas

- ✅ Autenticação obrigatória em todas as rotas (exceto listagem de planos)
- ✅ Tenant isolation (empresa só acessa seus próprios dados)
- ✅ Webhook signature verification (Stripe)
- ✅ Enforcement de limites antes de criar recursos
- ✅ Validação de status de assinatura

### Boas Práticas

1. **Sempre use HTTPS em produção**
2. **Nunca exponha o `STRIPE_SECRET_KEY`**
3. **Configure webhook secret no `.env`**
4. **Monitore tentativas de ultrapassar limites**
5. **Implemente rate limiting nas rotas públicas**

---

## 📊 Métricas e Monitoramento

### Métricas Rastreadas

- `users` - Número de usuários ativos
- `patients` - Número total de pacientes
- `appointments` - Agendamentos criados no mês
- `automations` - Número de automações ativas
- `storage_gb` - Espaço de armazenamento usado

### Atualização Automática

As métricas são atualizadas automaticamente quando:
- Usuário é criado/desativado
- Paciente é cadastrado
- Agendamento é criado
- Automação é ativada/desativada

---

## 🎉 Conclusão

Sistema completo de Billing SaaS implementado com:

- ✅ 6 tabelas no banco de dados
- ✅ 8 APIs REST
- ✅ 3 Planos pré-configurados
- ✅ Integração Stripe completa
- ✅ Webhooks funcionais
- ✅ Enforcement de limites
- ✅ Métricas em tempo real

**Pronto para produção!** 🚀

---

**Última atualização:** ${new Date().toLocaleDateString('pt-BR')}
**Versão:** 1.0.0
