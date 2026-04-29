# Configuração Completa do Sistema SaaS - DentalSystem

Este guia contém todas as instruções necessárias para configurar e utilizar o sistema SaaS completo.

## 📋 Funcionalidades Implementadas

### ✅ Página de Billing Completa
- Visualização do status da assinatura (Trial, Ativo, Cancelado, etc.)
- Detalhes do plano atual com valor e próxima cobrança
- Métricas de uso em tempo real (usuários, pacientes, agendamentos, storage)
- Botão para alterar plano com diálogo de seleção
- Botão para acessar portal de pagamento do Stripe
- Histórico completo de faturas com download de PDF
- Indicador visual de trial expirando

### ✅ Sistema de Emails Completo
- Email de boas-vindas ao criar conta
- Email 3 dias antes do trial expirar
- Email de pagamento confirmado com fatura
- Email de falha no pagamento
- Email de mudança de plano confirmada
- Templates HTML responsivos e profissionais

### ✅ Dunning Management Automatizado
- Verificação diária de trials expirando (9h e 18h)
- Sistema de retry de pagamentos falhados:
  - Dia 1: Primeiro email de lembrete
  - Dia 3: Segundo email de lembrete
  - Dia 5: Terceiro email (último aviso)
  - Dia 7: Cancelamento automático da assinatura
- Conversão automática de trials expirados
- Logs completos de todas as operações

### ✅ Sistema de Cupons de Desconto
- Criação de cupons com código único
- Desconto por porcentagem ou valor fixo
- Limite de usos por cupom
- Período de validade configurável
- Restrição por plano específico
- Validação automática antes de aplicar
- Histórico de uso de cupons
- APIs para gerenciamento (criar, listar, atualizar, desativar)

### ✅ Integração Stripe Completa
- Checkout sessions para novos clientes
- Customer portal para gerenciar pagamento
- Webhooks configurados:
  - Assinatura criada
  - Assinatura atualizada
  - Assinatura cancelada
  - Trial vai acabar (3 dias antes)
  - Fatura paga
  - Falha no pagamento

## 🔧 Configuração Obrigatória

### 1. Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# Stripe (Obrigatório para pagamentos)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Resend (Obrigatório para emails)
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@seudomain.com

# Base URL (para links nos emails)
BASE_URL=http://localhost:5000

# Session Secret (já configurado)
SESSION_SECRET=...
```

### 2. Obter Chaves do Stripe

1. Acesse [stripe.com](https://stripe.com) e crie uma conta
2. Vá em **Developers** → **API Keys**
3. Copie a **Secret Key** (começa com `sk_test_` para teste)
4. Configure o webhook:
   - Vá em **Developers** → **Webhooks**
   - Clique em **Add endpoint**
   - URL: `https://seudomain.com/api/stripe/webhook`
   - Selecione os eventos:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `customer.subscription.trial_will_end`
     - `invoice.paid`
     - `invoice.payment_failed`
   - Copie o **Signing secret** (começa com `whsec_`)

### 3. Obter Chave do Resend

1. Acesse [resend.com](https://resend.com) e crie uma conta
2. Vá em **API Keys**
3. Clique em **Create API Key**
4. Copie a chave (começa com `re_`)
5. Configure o domínio de envio:
   - Vá em **Domains**
   - Adicione seu domínio
   - Configure os registros DNS conforme instruções

### 4. Criar Produtos e Preços no Stripe

1. No dashboard do Stripe, vá em **Products**
2. Crie 3 produtos (Básico, Premium, Enterprise)
3. Para cada produto:
   - Adicione um preço mensal recorrente
   - Copie o **Price ID** (começa com `price_`)
4. Atualize a tabela `plans` no banco de dados com os Price IDs

## 🗄️ Migrações de Banco de Dados

Execute as migrações para criar as novas tabelas:

```bash
npm run db:push
```

Tabelas criadas:
- `coupons` - Cupons de desconto
- `coupon_usages` - Histórico de uso de cupons

## 🚀 Executar o Sistema

```bash
# Instalar dependências
npm install

# Executar em desenvolvimento
npm run dev

# Executar em produção
npm run build
npm start
```

## 📧 Testar Emails em Desenvolvimento

Durante o desenvolvimento, os emails serão enviados via Resend. Para testar:

1. Configure um email de teste no Resend
2. Ou use um serviço como [Mailtrap](https://mailtrap.io) para interceptar emails

## 🔔 Cron Jobs

Os cron jobs de dunning são executados automaticamente:

- **9:00 AM** - Verificação de trials expirando e assinaturas past_due
- **6:00 PM** - Segunda verificação diária (backup)

Em desenvolvimento, o cron job é executado uma vez ao iniciar (após 5 segundos).

## 🎯 Fluxo Completo do Sistema

### 1. Novo Cliente
1. Cliente se cadastra no sistema
2. Email de boas-vindas é enviado
3. Trial de 7 dias é iniciado
4. Cliente usa o sistema normalmente

### 2. Trial Expirando
1. 3 dias antes do fim, webhook do Stripe dispara
2. Email de lembrete é enviado
3. Cliente pode cancelar ou continuar

### 3. Trial Termina
1. Se cliente tem cartão cadastrado:
   - Stripe cobra automaticamente
   - Email de confirmação é enviado
   - Status muda para "active"
2. Se cliente NÃO tem cartão:
   - Assinatura é cancelada
   - Acesso é bloqueado

### 4. Falha no Pagamento
1. Webhook do Stripe notifica falha
2. Email de falha é enviado
3. Sistema de dunning inicia:
   - Dia 1, 3, 5: Emails de lembrete
   - Dia 7: Cancelamento automático

### 5. Cliente Troca de Plano
1. Cliente seleciona novo plano no dashboard
2. Stripe atualiza assinatura (com proration)
3. Email de confirmação é enviado
4. Acesso aos novos limites é liberado

### 6. Cliente Usa Cupom
1. Cliente insere código do cupom
2. Sistema valida:
   - Cupom existe e está ativo
   - Não expirou
   - Não atingiu limite de usos
   - Válido para o plano escolhido
   - Cliente ainda não usou
3. Desconto é aplicado
4. Uso é registrado

## 🔐 Segurança

### Webhooks do Stripe
- Todas as requisições do Stripe são verificadas usando a assinatura
- Apenas eventos autênticos são processados

### Emails
- Resend valida domínios via DKIM/SPF/DMARC
- Não incluir dados sensíveis nos emails

### Cupons
- Códigos são únicos e convertidos para maiúsculas
- Limite de usos é verificado atomicamente
- Histórico completo é mantido

## 📊 APIs Disponíveis

### Billing
```
GET  /api/billing/plans                    # Listar planos
GET  /api/billing/subscription             # Ver assinatura
POST /api/billing/subscription             # Criar assinatura
PUT  /api/billing/subscription/plan        # Mudar plano
DELETE /api/billing/subscription           # Cancelar
GET  /api/billing/invoices                 # Listar faturas
GET  /api/billing/usage                    # Ver uso
```

### Stripe
```
POST /api/stripe/create-checkout-session   # Criar checkout
POST /api/stripe/create-portal-session     # Portal do cliente
POST /api/stripe/webhook                   # Webhook (não chamar manualmente)
```

### Cupons
```
POST /api/v1/coupons/validate              # Validar cupom
POST /api/v1/coupons                       # Criar cupom (admin)
GET  /api/v1/coupons                       # Listar cupons (admin)
PUT  /api/v1/coupons/:id                   # Atualizar cupom (admin)
DELETE /api/v1/coupons/:id                 # Desativar cupom (admin)
GET  /api/v1/coupons/:id/usage             # Ver histórico (admin)
```

## 🐛 Troubleshooting

### Emails não estão sendo enviados
- Verifique se `RESEND_API_KEY` está configurada
- Verifique se o domínio está verificado no Resend
- Cheque os logs do servidor para erros

### Webhooks não estão funcionando
- Verifique se `STRIPE_WEBHOOK_SECRET` está configurada corretamente
- Use o Stripe CLI para testar localmente: `stripe listen --forward-to localhost:5000/api/stripe/webhook`
- Verifique os logs no dashboard do Stripe

### Cron jobs não executam
- Verifique os logs do servidor
- Confirme que o servidor está rodando
- Em produção, apenas o worker 1 executa os cron jobs

### Cupons não aplicam desconto
- Verifique se o cupom está ativo
- Confirme que não expirou
- Verifique se o cliente já usou o cupom
- Confirme que o plano é permitido

## 📈 Próximos Passos

Para melhorar ainda mais o sistema SaaS:

1. **MercadoPago** - Implementar integração para mercado brasileiro
2. **Multi-moeda** - Suporte a múltiplas moedas
3. **Impostos** - Integração com Stripe Tax para cálculo automático
4. **Metered Billing** - Cobrança por uso para recursos específicos
5. **Dunning avançado** - Estratégias mais sofisticadas de recuperação
6. **Analytics** - Dashboard de analytics de billing
7. **A/B Testing** - Testar diferentes preços e cupons

## 🎓 Recursos Adicionais

- [Documentação do Stripe](https://stripe.com/docs)
- [Documentação do Resend](https://resend.com/docs)
- [Melhores práticas SaaS](https://stripe.com/guides/saas-billing-best-practices)
- [Dunning Management](https://www.chargebee.com/blog/dunning-management/)

## 🤝 Suporte

Para dúvidas ou problemas, verifique:
1. Os logs do servidor
2. O dashboard do Stripe para eventos
3. O console do Resend para emails enviados
4. Este arquivo de documentação

---

**Importante:** Lembre-se de usar chaves de teste (`sk_test_`) durante desenvolvimento e trocar para chaves de produção (`sk_live_`) ao lançar.
