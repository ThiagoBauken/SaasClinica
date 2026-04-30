# 🗄️ Setup do Banco de Dados PostgreSQL

Guia completo para criar e configurar o banco de dados do sistema.

---

## 📋 Pré-requisitos

- PostgreSQL 14+ instalado
- Acesso ao banco de dados (usuário com permissão de CREATE)
- URL de conexão configurada no `.env`

---

## 🚀 Opção 1: Setup Completo (Banco Novo)

Use este método se você está criando o banco de dados pela primeira vez.

### Passo 1: Criar o banco de dados

```bash
# Conectar ao PostgreSQL
psql -U postgres

# Criar o banco
CREATE DATABASE dental_clinic;

# Sair
\q
```

### Passo 2: Executar o script de deployment

```bash
# Método A: Usando psql (Recomendado)
psql "$DATABASE_URL" -f server/scripts/deploy-database.sql

# Método B: Usando conexão direta
psql -U seu_usuario -d dental_clinic -f server/scripts/deploy-database.sql
```

**O que esse script faz:**
- ✅ Cria todas as 67 tabelas do sistema
- ✅ Configura todos os índices e foreign keys
- ✅ Inclui os campos do Google Calendar
- ✅ Mostra relatório de verificação ao final

### Passo 3: Popular dados iniciais (Opcional)

```bash
npm run db:seed
```

---

## 🔄 Opção 2: Migração (Banco Existente)

Use este método se você já tem um banco de dados e quer adicionar apenas os novos campos.

### Para adicionar campos do Google Calendar:

```bash
psql "$DATABASE_URL" -f server/migrations/add_google_calendar_tokens.sql
```

---

## 🔁 Runner de Migrations e Mapa `RENAMES`

O projeto usa um runner próprio em [server/scripts/run-migrations.ts](../../server/scripts/run-migrations.ts) (e **não** o `drizzle-kit migrate`) para aplicar SQL files sequencialmente. O runner:

1. Cria a tabela `schema_migrations(migration_name UNIQUE)` se não existir.
2. Lê todos os `.sql` em `migrations/` em **ordem alfabética**.
3. Para cada arquivo: se já está em `schema_migrations`, pula. Se não, executa em transação (`BEGIN/COMMIT`) e registra.

Comando:

```bash
npx tsx server/scripts/run-migrations.ts
```

### Por que existe um mapa `RENAMES`

Migrations já aplicadas em produção foram **renomeadas no repositório** ao longo do tempo (para resolver colisões de prefixo numérico). O runner precisa saber: "se o banco em produção já tem o nome ANTIGO em `schema_migrations`, o nome NOVO **não deve ser re-executado**".

O mapa fica em [server/scripts/run-migrations.ts:64-84](../../server/scripts/run-migrations.ts#L64) como uma lista de pares `[oldName, newName]`. Para cada par, se `oldName` está em `schema_migrations`, o runner insere `newName` também — marcando-o como "já aplicado".

Renames atuais cobertos:

| Original | Novo nome | Razão |
|----------|-----------|-------|
| `003_add_integration_fields.sql` | `003a_*` | Dois arquivos com prefixo 003 |
| `003_fix_multitenant_isolation.sql` | `003b_*` | (idem) |
| `004_billing_system.sql` | `004a_*` | Dois arquivos com prefixo 004 |
| `004_clinic_settings_and_automation_logs.sql` | `004b_*` | (idem) |
| `010_add_missing_columns.sql` | `010a_*` | Dois arquivos com prefixo 010 |
| `010_add_recurring_appointment_columns.sql` | `010b_*` | (idem) |
| `014_ai_agent_integration.sql` | `014a_*` | Dois arquivos com prefixo 014 |
| `014_missing_tables.sql` | `014b_*` | (idem) |
| `015_add_missing_patient_columns.sql` | `015a_*` | Dois arquivos com prefixo 015 |
| `015_insurance_management.sql` | `015b_*` | (idem) |
| `022_phase0_critical_security.sql` | `022a_*` | Dois arquivos com prefixo 022 |
| `022_waitlist.sql` | `022b_*` | (idem) |
| `023_executive_reports.sql` | `023a_*` | Três arquivos com prefixo 023 |
| `023_phase1_complete_rls.sql` | `023b_*` | (idem) |
| `023_quotes_and_invites.sql` | `023c_*` | (idem) |
| `014b_recall_waitlist_reviews_contracts_campaigns.sql` | `014c_*` | Colidia com `014b_missing_tables.sql` |
| `015b_whatsapp_provider_meta_cloud.sql` | `015c_*` | Colidia com `015b_insurance_management.sql` |
| `021_professional_cro_fields.sql` | `021b_*` | Colidia com `021_database_hardening.sql` |

### Como adicionar uma nova migration

1. Crie o arquivo em `migrations/` com prefixo numérico **único** (próximo livre).
2. Use **DDL idempotente sempre que possível**: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`.
3. Envolva em `BEGIN; ... COMMIT;` se houver múltiplos statements relacionados.
4. **Não renomeie** arquivos já em produção sem adicionar entrada ao mapa `RENAMES` — caso contrário, o runner re-executa em bancos que já tinham aplicado a versão antiga.

### Como resolver uma colisão de prefixo

Se você descobrir dois arquivos com o mesmo prefixo (ex: dois `041_*`):

1. Confira o conteúdo de cada um (`grep CREATE migrations/041_*.sql`) — se DDL é disjoint, basta renomear; se há conflito (ex: ambos criam a mesma tabela), una num único arquivo.
2. Renomeie o segundo para `041b_*` (ou `041c_*`, etc.) usando `git mv`.
3. **Adicione ao mapa `RENAMES`** em `run-migrations.ts`: `['041_<old>.sql', '041b_<new>.sql']`.
4. Verifique localmente: `npx tsx server/scripts/run-migrations.ts` deve pular o arquivo (já aplicado) ou executar em ordem.

### Arquivo `add_google_calendar_tokens.sql` (sem prefixo numérico)

Esse arquivo (legacy) **roda por último** porque na ordem alfabética, `'a'` (97) > `'0'` (48). Como é totalmente idempotente (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`), não causa problema. Não precisa ser renomeado.

---

## 📁 Arquivos Disponíveis

### 1. **migrations/0000_dark_jean_grey.sql**
- **O QUE É:** Migração completa gerada pelo Drizzle Kit
- **TAMANHO:** 1.169 linhas
- **CONTEÚDO:** Todas as 67 tabelas do sistema
- **QUANDO USAR:** Setup inicial de banco novo

### 2. **server/scripts/deploy-database.sql**
- **O QUE É:** Script wrapper que executa a migração e mostra relatório
- **CONTEÚDO:** Executa `0000_dark_jean_grey.sql` + verificações
- **QUANDO USAR:** Setup inicial com verificações

### 3. **server/migrations/add_google_calendar_tokens.sql**
- **O QUE É:** Migração incremental apenas para Google Calendar
- **CONTEÚDO:** Adiciona 3 campos à tabela `users`
- **QUANDO USAR:** Adicionar tokens em banco existente

---

## 🔍 Verificação Pós-Deployment

### Verificar se tabelas foram criadas:

```sql
-- Contar tabelas
SELECT COUNT(*) as total_tabelas
FROM pg_tables
WHERE schemaname = 'public';
-- Esperado: 67 tabelas
```

### Verificar campos do Google Calendar:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name LIKE 'google%';
```

**Esperado:**
```
column_name            | data_type
-----------------------+-----------
google_id              | text
google_calendar_id     | text
google_access_token    | text
google_refresh_token   | text
google_token_expiry    | timestamp
```

---

## 🛠️ Comandos Úteis

### Conectar ao banco:
```bash
psql "$DATABASE_URL"
```

### Listar todas as tabelas:
```sql
\dt
```

### Ver estrutura de uma tabela:
```sql
\d users
\d appointments
\d patients
```

### Verificar tamanho do banco:
```sql
SELECT pg_size_pretty(pg_database_size('dental_clinic'));
```

### Backup do banco:
```bash
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d).sql
```

### Restaurar backup:
```bash
psql "$DATABASE_URL" < backup_20251116.sql
```

---

## 🌐 Configuração para Neon/Supabase

Se você está usando Neon, Supabase ou outro PostgreSQL gerenciado:

### Neon (Recomendado)

1. Criar projeto em [neon.tech](https://neon.tech)
2. Copiar a connection string
3. Adicionar ao `.env`:

```env
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

4. Executar migração:
```bash
npm run db:push
```

### Supabase

1. Criar projeto em [supabase.com](https://supabase.com)
2. Database Settings → Connection String → URI
3. Adicionar ao `.env`
4. Executar migração via Supabase SQL Editor ou psql

---

## 📊 Estrutura do Banco (67 Tabelas)

### 👤 Usuários e Permissões (7 tabelas)
- users
- companies
- modules
- company_modules
- roles
- permissions
- role_permissions
- user_permissions

### 🏥 Pacientes e Prontuário (8 tabelas)
- patients
- anamnesis
- anamnesis_templates
- patient_records
- patient_documents
- patient_exams
- odontogram_entries
- periodontal_chart

### 📅 Agendamentos (5 tabelas)
- appointments
- appointment_procedures
- rooms
- working_hours
- holidays

### 💰 Financeiro (12 tabelas)
- financial_transactions
- financial_categories
- payments
- payment_plans
- boxes
- box_transactions
- subscriptions
- subscription_invoices
- subscription_history
- plans
- plan_features
- mercado_pago_subscriptions

### 🦷 Tratamentos (7 tabelas)
- procedures
- treatment_plans
- treatment_plan_procedures
- detailed_treatment_plans
- treatment_evolution
- prescriptions
- procedure_commissions

### 🤖 Automações (3 tabelas)
- automations
- automation_logs
- tasks

### 📦 Estoque (4 tabelas)
- inventory_items
- inventory_categories
- inventory_transactions
- standard_dental_products

### 🔧 Próteses (6 tabelas)
- prosthesis
- prosthesis_types
- prosthesis_stages
- prosthesis_labels
- prosthesis_services
- laboratories

### ⚙️ Configurações (8 tabelas)
- clinic_settings
- communication_settings
- fiscal_settings
- booking_link_settings
- commission_settings
- commission_records
- sales_goals
- shop_items

### 📊 Cobrança/Importação (7 tabelas)
- digitalization_invoices
- digitalization_logs
- digitalization_usage
- usage_metrics
- machine_taxes
- chairs

---

## ⚠️ Troubleshooting

### Erro: "permission denied for schema public"

```sql
-- Dar permissões ao usuário
GRANT ALL ON SCHEMA public TO seu_usuario;
GRANT ALL ON ALL TABLES IN SCHEMA public TO seu_usuario;
```

### Erro: "relation already exists"

O banco já tem algumas tabelas. Opções:
1. Dropar o banco e recriar
2. Usar migração incremental
3. Usar `CREATE TABLE IF NOT EXISTS`

### Erro: "could not connect to server"

Verificar:
1. PostgreSQL está rodando?
2. DATABASE_URL está correto no .env?
3. Firewall permite conexão?

### Ver logs de erro:

```bash
# No Windows
Get-Content "C:\Program Files\PostgreSQL\14\data\log\*.log" -Tail 50

# No Linux
tail -f /var/log/postgresql/postgresql-14-main.log
```

---

## 📝 Checklist de Setup

- [ ] PostgreSQL instalado e rodando
- [ ] Banco de dados criado
- [ ] `.env` configurado com DATABASE_URL
- [ ] Migração executada com sucesso
- [ ] 67 tabelas criadas
- [ ] Campos do Google Calendar verificados
- [ ] Dados iniciais populados (seed)
- [ ] Conexão testada com `npm run dev`

---

## 🆘 Ajuda

**Documentação oficial:**
- PostgreSQL: https://www.postgresql.org/docs/
- Drizzle ORM: https://orm.drizzle.team/docs/overview
- Neon: https://neon.tech/docs/

**Comandos rápidos:**
```bash
# Ver status do PostgreSQL
sudo systemctl status postgresql  # Linux
pg_ctl status                     # Windows

# Reiniciar PostgreSQL
sudo systemctl restart postgresql # Linux
pg_ctl restart                    # Windows
```

---

**Última atualização:** 2025-11-16
**Versão do schema:** 1.0.0
