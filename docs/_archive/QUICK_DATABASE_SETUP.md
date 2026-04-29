# ⚡ Setup Rápido do Banco de Dados

**3 formas de criar o banco de dados com todas as 67 tabelas**

---

## 🎯 Método 1: Script Automático (Mais Fácil)

### Windows (PowerShell):
```powershell
.\setup-database.ps1
```

### Linux/Mac (Bash):
```bash
chmod +x setup-database.sh
./setup-database.sh
```

**O script vai:**
1. ✅ Verificar se `.env` está configurado
2. ✅ Perguntar qual tipo de setup você quer
3. ✅ Criar todas as tabelas automaticamente
4. ✅ Mostrar relatório de verificação

---

## 🎯 Método 2: Drizzle Push (Recomendado)

```bash
npm run db:push
```

**Vantagens:**
- ✅ Detecta mudanças automaticamente
- ✅ Cria apenas o que falta
- ✅ Funciona com qualquer provider (Neon, Supabase, local)

---

## 🎯 Método 3: SQL Direto (Manual)

### Para banco NOVO (todas as tabelas):
```bash
psql "$DATABASE_URL" -f migrations/0000_dark_jean_grey.sql
```

### Para banco EXISTENTE (só Google Calendar):
```bash
psql "$DATABASE_URL" -f server/migrations/add_google_calendar_tokens.sql
```

---

## 📋 Checklist Pré-Setup

- [ ] PostgreSQL instalado (ou Neon/Supabase configurado)
- [ ] Arquivo `.env` criado (copie de `.env.example`)
- [ ] `DATABASE_URL` configurado no `.env`
- [ ] Banco de dados criado (se local)

---

## 🔗 Exemplo de DATABASE_URL

### PostgreSQL Local:
```env
DATABASE_URL=postgresql://postgres:senha@localhost:5432/dental_clinic
```

### Neon (Cloud):
```env
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### Supabase:
```env
DATABASE_URL=postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres
```

---

## ✅ Verificação Rápida

Depois do setup, verifique se funcionou:

```sql
-- Contar tabelas (deve retornar 67)
SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';

-- Ver campos do Google Calendar
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users' AND column_name LIKE 'google%';
```

---

## 🆘 Troubleshooting

### ❌ "psql: command not found"
**Solução:** Instale o PostgreSQL client
- Windows: https://www.postgresql.org/download/windows/
- Mac: `brew install postgresql`
- Linux: `sudo apt install postgresql-client`

### ❌ "connection refused"
**Solução:** Verifique se PostgreSQL está rodando
```bash
# Windows
Get-Service postgresql*

# Linux/Mac
sudo systemctl status postgresql
```

### ❌ "permission denied"
**Solução:** Use o usuário correto no DATABASE_URL

---

## 📊 O que será criado?

### 67 Tabelas Completas:

**👤 Usuários (7)**
- users, companies, roles, permissions, etc.

**🏥 Pacientes (8)**
- patients, anamnesis, patient_records, etc.

**📅 Agendamentos (5)**
- appointments, appointment_procedures, rooms, etc.

**💰 Financeiro (12)**
- financial_transactions, payments, subscriptions, etc.

**🦷 Tratamentos (7)**
- procedures, treatment_plans, prescriptions, etc.

**🤖 Automações (3)**
- automations, automation_logs, tasks

**📦 Estoque (4)**
- inventory_items, inventory_transactions, etc.

**🔧 Próteses (6)**
- prosthesis, prosthesis_types, laboratories, etc.

**⚙️ Configurações (8)**
- clinic_settings, communication_settings, etc.

**📊 Cobrança (7)**
- digitalization_invoices, usage_metrics, etc.

---

## ⏱️ Tempo Estimado

- Script Automático: ~2 minutos
- Drizzle Push: ~1 minuto
- SQL Manual: ~30 segundos

---

## 📝 Próximo Passo

Depois do setup:

```bash
# 1. Popular dados iniciais (opcional)
npm run db:seed

# 2. Iniciar o servidor
npm run dev

# 3. Acessar
http://localhost:5000
```

---

**Precisa de mais detalhes?** Veja [DATABASE_SETUP.md](DATABASE_SETUP.md)
