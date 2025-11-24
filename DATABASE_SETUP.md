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
