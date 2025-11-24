# INSTALAÇÃO DE DEPENDÊNCIAS - SPRINT 1

## 📦 Dependências Necessárias

Para usar todas as funcionalidades implementadas no Sprint 1, instale as seguintes dependências:

### 1. Google Calendar (googleapis)

```bash
npm install googleapis
```

ou

```bash
npm install googleapis google-auth-library
```

**Versão recomendada:** ^128.0.0 ou superior

**Usado em:**
- Integração com Google Calendar
- OAuth 2.0 flow
- Criação/edição/deleção de eventos

---

### 2. Axios (Se não estiver instalado)

```bash
npm install axios
```

**Usado em:**
- Webhooks N8N
- Chamadas HTTP para APIs externas
- WhatsApp (Wuzapi)

---

### 3. Date-fns (Já deve estar instalado)

```bash
npm install date-fns
```

**Usado em:**
- Formatação de datas
- Manipulação de timestamps
- Locale PT-BR

---

## 🚀 Comando Único

Para instalar todas de uma vez:

```bash
npm install googleapis axios date-fns
```

---

## ✅ Verificar Instalação

```bash
npm list googleapis
npm list axios
npm list date-fns
```

---

## 📝 package.json

Após instalação, seu package.json deve ter:

```json
{
  "dependencies": {
    "googleapis": "^128.0.0",
    "google-auth-library": "^9.0.0",
    "axios": "^1.6.0",
    "date-fns": "^3.0.0"
  }
}
```

---

## 🔧 TypeScript Types

As types já vêm incluídas nos pacotes acima (TypeScript first).

Não é necessário instalar @types separados.

---

## ⚠️ Importante

**Antes de rodar o servidor:**

1. Instale as dependências
2. Configure variáveis de ambiente (`.env`)
3. Execute migrations do banco de dados
4. Inicie o servidor

```bash
# 1. Instalar
npm install

# 2. Configurar .env (copiar de .env.example)
cp .env.example .env

# 3. Migrations (se necessário)
npm run db:push

# 4. Iniciar servidor
npm run dev
```

---

## 📚 Documentação Oficial

- **googleapis:** https://github.com/googleapis/google-api-nodejs-client
- **axios:** https://axios-http.com/
- **date-fns:** https://date-fns.org/

---

**Última atualização:** 2025-11-15
