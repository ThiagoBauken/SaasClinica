# Guia de Instalação - DentCare

Este documento fornece instruções detalhadas para instalar e configurar o sistema DentCare.

## Requisitos de Sistema

- Node.js 18.x ou superior
- PostgreSQL 14.x ou superior
- NPM 8.x ou superior
- Conta Google Cloud Platform (para autenticação OAuth)

## Instalação

### 1. Clone o Repositório

```bash
git clone https://github.com/seu-usuario/dentcare.git
cd dentcare
```

### 2. Instale as Dependências

```bash
npm install
```

### 3. Configure o Banco de Dados

```bash
# Criação do banco de dados PostgreSQL
createdb dentcare

# Aplique as migrações para criar as tabelas
npm run db:push
```

### 4. Configure as Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# Banco de Dados
DATABASE_URL=postgresql://usuario:senha@localhost:5432/dentcare
PGUSER=usuario
PGPASSWORD=senha
PGDATABASE=dentcare
PGHOST=localhost
PGPORT=5432

# Autenticação e Sessão
SESSION_SECRET=sua_chave_secreta_aleatoria_aqui

# Google OAuth (necessário para login com Google)
GOOGLE_CLIENT_ID=seu_client_id_do_google
GOOGLE_CLIENT_SECRET=seu_client_secret_do_google
GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback

# Configurações da Aplicação
VITE_APP_NAME=DentCare
```

### 5. Configure o Google OAuth (opcional, mas recomendado)

1. Acesse o [Google Cloud Console](https://console.cloud.google.com)
2. Crie um novo projeto
3. No menu lateral, vá para "APIs e Serviços" > "Credenciais"
4. Clique em "Criar Credenciais" > "ID do Cliente OAuth"
5. Selecione o tipo "Aplicativo da Web"
6. Adicione URIs de redirecionamento autorizados:
   - `http://localhost:5000/auth/google/callback` (para desenvolvimento)
   - `https://sua-url-de-producao.com/auth/google/callback` (para produção)
7. Copie o ID do Cliente e o Segredo do Cliente para suas variáveis de ambiente

### 6. Inicie a Aplicação

```bash
# Modo de desenvolvimento
npm run dev

# Ou para produção
npm run build
npm start
```

A aplicação estará disponível em `http://localhost:5000`.

## Dependências Principais

### Frontend
- React 18
- React Query (TanStack Query)
- TailwindCSS
- ShadcnUI (componentes)
- Wouter (roteamento)
- React Hook Form + Zod (formulários e validação)
- Next-themes (tema claro/escuro)
- Lucide React (ícones)
- date-fns (manipulação de datas)

### Backend
- Express.js
- Drizzle ORM
- PostgreSQL (via `@neondatabase/serverless`)
- Passport.js (autenticação)
- express-session
- connect-pg-simple (armazenamento de sessão)
- helmet (segurança)
- zod (validação)

## Solução de Problemas

### Erro de Conexão com o Banco de Dados
- Verifique se o PostgreSQL está em execução
- Confirme se as credenciais de banco de dados estão corretas no `.env`
- Certifique-se de que o banco de dados foi criado corretamente

### Erros de Autenticação com Google
- Verifique se as credenciais do Google OAuth estão corretas
- Certifique-se de que as URIs de redirecionamento estão configuradas corretamente
- Verifique se a API OAuth está habilitada no Google Cloud Console

### Erros de Compilação
- Limpe o cache: `rm -rf node_modules/.vite`
- Reinstale as dependências: `npm install`

## Configurações Avançadas

### Configuração de Proxy Reverso (Nginx)

```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### PM2 para Gerenciamento de Processos

```bash
# Instalar PM2
npm install -g pm2

# Iniciar a aplicação com PM2
pm2 start dist/index.js --name dentcare

# Configurar para iniciar na inicialização do sistema
pm2 startup
pm2 save
```