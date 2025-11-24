# 🗄️ Configuração do Banco de Dados

## Status Atual

As funcionalidades **Periodontograma** e **Assinatura Digital CFO** foram implementadas com sucesso! 🎉

Para ativá-las, você precisa executar as migrations do banco de dados. Mas primeiro, precisa ter um banco de dados PostgreSQL configurado e rodando.

## ⚠️ Problema Detectado

Tentei executar as migrations, mas o PostgreSQL não está disponível em `localhost:5432`.

**Erro:** `ECONNREFUSED` - Conexão recusada ao tentar conectar no PostgreSQL.

## 🔧 Soluções Disponíveis

Escolha UMA das opções abaixo:

---

### **OPÇÃO 1: Docker (Recomendado - Mais Fácil)**

Se você tiver o Docker Desktop instalado:

#### 1.1. Instalar Docker Desktop (se não tiver)
- **Windows:** https://docs.docker.com/desktop/install/windows-install/
- **Download:** https://www.docker.com/products/docker-desktop/

#### 1.2. Iniciar os containers
```bash
# Subir PostgreSQL + Redis + App
npm run docker:up

# OU manualmente:
docker-compose up -d
```

#### 1.3. Executar migrations
```bash
# Via npm script
npm run db:migrate

# OU via Docker:
npm run docker:migrate
```

#### 1.4. Verificar se está rodando
```bash
docker ps
```

Você deve ver containers:
- `dental-db` (PostgreSQL)
- `dental-redis` (Redis)
- `dental-app` (Aplicação)

---

### **OPÇÃO 2: PostgreSQL Local**

Se preferir instalar PostgreSQL diretamente no Windows:

#### 2.1. Baixar e instalar PostgreSQL
- **Download:** https://www.postgresql.org/download/windows/
- **Versão:** 15 ou superior
- **Instalador:** EDB (Enterprise DB) - mais fácil

#### 2.2. Durante a instalação
- Definir senha do usuário `postgres`: **postgres** (ou outra de sua escolha)
- Porta: **5432** (padrão)
- Locale: **Portuguese, Brazil** ou **C**

#### 2.3. Criar o banco de dados
Abra o **pgAdmin** ou **psql** e execute:

```sql
CREATE DATABASE dental_clinic
  WITH ENCODING 'UTF8'
  LC_COLLATE='C'
  LC_CTYPE='C';
```

#### 2.4. Atualizar .env (se necessário)
Se você usou uma senha diferente, atualize:

```env
DATABASE_URL=postgresql://postgres:SUA_SENHA_AQUI@localhost:5432/dental_clinic
```

#### 2.5. Executar migrations
```bash
npm run db:migrate
```

---

### **OPÇÃO 3: Neon (Cloud - Gratuito)**

Se não quiser instalar nada localmente, use o Neon (PostgreSQL serverless gratuito):

#### 3.1. Criar conta no Neon
- Acesse: https://neon.tech/
- Clique em "Sign Up" (pode usar GitHub)

#### 3.2. Criar um projeto
- Clique em "Create a project"
- Nome: `dental-clinic`
- Região: `US East` (mais próximo do Brasil)
- PostgreSQL: versão 15 ou 16

#### 3.3. Copiar connection string
Após criar o projeto, copie a **Connection String** que aparece.

Exemplo:
```
postgresql://user:password@ep-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

#### 3.4. Atualizar .env
Substitua a linha `DATABASE_URL`:

```env
DATABASE_URL=postgresql://user:password@ep-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

#### 3.5. Executar migrations
```bash
npm run db:migrate
```

---

### **OPÇÃO 4: Supabase (Cloud - Gratuito)**

Alternativa ao Neon, também oferece PostgreSQL gratuito:

#### 4.1. Criar conta no Supabase
- Acesse: https://supabase.com/
- Clique em "Start your project"

#### 4.2. Criar um projeto
- Nome: `dental-clinic`
- Senha do banco: escolha uma senha forte
- Região: `South America (São Paulo)` se disponível

#### 4.3. Obter connection string
- Vá em **Settings** → **Database**
- Na seção **Connection String**, selecione **URI**
- Modo: **Session** (não Transaction)
- Copie a string

#### 4.4. Atualizar .env
```env
DATABASE_URL=sua-connection-string-do-supabase
```

#### 4.5. Executar migrations
```bash
npm run db:migrate
```

---

## ✅ Após Configurar o Banco de Dados

### 1. Executar as Migrations

```bash
npm run db:migrate
```

**Você deverá ver:**
```
🔄 Starting database migrations...

▶️  Running 006_periodontal_chart.sql...
✅ Completed 006_periodontal_chart.sql

▶️  Running 007_digital_signatures.sql...
✅ Completed 007_digital_signatures.sql

✅ All migrations completed successfully!
```

### 2. Configurar CRO dos Profissionais

Para usar a **Assinatura Digital CFO**, você precisa adicionar o número do CRO de cada dentista:

#### Via SQL (pgAdmin ou psql):
```sql
-- Atualizar dados do dentista
UPDATE users
SET
  cfo_registration_number = '12345',  -- Número do CRO
  cfo_state = 'BA'                   -- Estado do CRO (BA, SP, RJ, etc)
WHERE id = 1;  -- ID do usuário dentista
```

#### Ou criar uma interface de configuração no sistema (recomendado)

### 3. Iniciar o Servidor

```bash
npm run dev
```

### 4. Testar as Funcionalidades

#### Periodontograma:
1. Acesse o prontuário de um paciente
2. Clique na aba **"Periodontograma"**
3. Clique em cada dente para inserir dados
4. O sistema calcula índices automaticamente
5. Clique em **"Salvar Periodontograma"**

#### Assinatura Digital:
1. Crie uma prescrição/receita
2. Clique em **"Assinar Digitalmente"**
3. Sistema gera PDF com QR Code
4. Baixe o PDF assinado
5. Escaneie o QR Code para validar

---

## 📊 Arquivos Criados

### Backend - Periodontograma
- ✅ `server/migrations/006_periodontal_chart.sql`
- ✅ `server/routes/periodontal.routes.ts`
- ✅ `shared/schema.ts` (periodontalChart)

### Frontend - Periodontograma
- ✅ `client/src/components/periodontal/PeriodontalChart.tsx`
- ✅ `client/src/components/periodontal/PeriodontalGrid.tsx`
- ✅ `client/src/components/periodontal/ToothPeriodontalInput.tsx`
- ✅ `client/src/components/periodontal/PeriodontalIndices.tsx`

### Backend - Assinatura Digital
- ✅ `server/migrations/007_digital_signatures.sql`
- ✅ `server/routes/digital-signature.routes.ts`
- ✅ `server/services/pdf-generator.service.ts`
- ✅ `shared/schema.ts` (digitalSignatures)

### Frontend - Assinatura Digital
- ✅ `client/src/components/digital-signature/DigitalSignature.tsx`

### Dependências Instaladas
- ✅ `dotenv` - Carregamento de variáveis de ambiente
- ✅ `pdfkit` - Geração de PDFs (já instalado)
- ✅ `qrcode` - Geração de QR Codes (já instalado)

---

## 🆘 Precisa de Ajuda?

### Erro: "docker: command not found"
- Instale o Docker Desktop
- Reinicie o terminal após instalação

### Erro: "psql: command not found"
- Você está tentando usar psql diretamente, mas ele não está no PATH
- Use pgAdmin (interface gráfica) ou
- Adicione PostgreSQL ao PATH do Windows

### Erro: "relation does not exist"
- As migrations não foram executadas
- Execute: `npm run db:migrate`

### Erro: "password authentication failed"
- Senha incorreta no .env
- Verifique a senha do PostgreSQL

### Migrations já foram executadas?
Para verificar:
```sql
SELECT * FROM schema_migrations ORDER BY executed_at;
```

Para reexecutar uma migration específica (CUIDADO):
```sql
DELETE FROM schema_migrations WHERE migration_name = '006_periodontal_chart.sql';
-- Depois execute: npm run db:migrate
```

---

## 📋 Checklist Final

Antes de marcar como concluído:

- [ ] PostgreSQL está rodando
- [ ] Banco de dados `dental_clinic` existe
- [ ] DATABASE_URL está correto no `.env`
- [ ] `npm run db:migrate` executou com sucesso
- [ ] Migrations 006 e 007 foram aplicadas
- [ ] CRO dos dentistas foi configurado
- [ ] Servidor iniciou sem erros (`npm run dev`)
- [ ] Testei criar um periodontograma
- [ ] Testei assinar uma prescrição digitalmente

---

## 🎯 Próximos Passos

Após configurar o banco de dados:

1. **Documentação completa:**
   - [README_FUNCIONALIDADES_CRITICAS.md](README_FUNCIONALIDADES_CRITICAS.md)
   - [PERIODONTOGRAMA_IMPLEMENTADO.md](PERIODONTOGRAMA_IMPLEMENTADO.md)
   - [ASSINATURA_DIGITAL_CFO_IMPLEMENTADO.md](ASSINATURA_DIGITAL_CFO_IMPLEMENTADO.md)

2. **Melhorias futuras** (opcionais):
   - Certificado A3 ICP-Brasil para assinatura
   - Integração com portal oficial CFO
   - Gráfico de evolução do periodontograma
   - Exportação de periodontograma para PDF

---

**Criado em:** 16/11/2025
**Versão:** 1.0
