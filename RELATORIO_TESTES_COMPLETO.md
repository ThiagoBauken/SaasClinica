# RELATÓRIO DE TESTES - SISTEMA CLÍNICA ODONTOLÓGICA
**Data/Hora:** 07/12/2025, 15:41:36
**URL Base:** http://localhost:5000
---

## RESUMO EXECUTIVO
| Usuário | Login | Páginas Acessíveis | Erros Console ||---------|-------|-------------------|---------------|| Admin | ❌ Falhou | 0/0 | 8 || Dentista | ✅ Sucesso | 6/6 | 5 || Recepcionista | ✅ Sucesso | 6/6 | 5 |
---

## ADMIN (admin)
### Status de Login
❌ **Login falhou**
- Erro: Permaneceu na página de login sem mudanças

### Erros de Console

1. WebSocket connection to 'ws://localhost:5000/?token=EqzST9wqFIkX' failed: Error during WebSocket handshake: Unexpected response code: 400
2. Failed to load resource: the server responded with a status of 401 (Unauthorized)
3. WebSocket connection to 'ws://localhost:5173/?token=EqzST9wqFIkX' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED
4. [vite] failed to connect to websocket.
your current setup:
  (browser) localhost:5000/ <--[HTTP]--> localhost:5173/ (server)
  (browser) localhost:5000/ <--[WebSocket (failing)]--> localhost:5173/ (server)
Check out your Vite / network configuration and https://vite.dev/config/server-options.html#server-hmr .
5. Erro no login: Error: Login failed
    at Object.login (http://localhost:5000/@fs/C:/Users/Thiago/Desktop/site%20clinca%20dentista/client/src/core/AuthProvider.tsx:73:15)

... e mais 2 erros

---

## DENTISTA (dra.ana)
### Status de Login
✅ **Login bem-sucedido**
- Redirecionado para: `http://localhost:5000/dashboard`

### Páginas Testadas

#### ✅ Dashboard
- **Status:** Acessível
- **Carregou:** Sim
- **Tem Conteúdo:** Sim
- **Tamanho do conteúdo:** 2458 caracteres
- **Elementos:**
  - cards: 8
  - metrics: 0
  - hasCharts: true
- **Erros:**
  - Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Conten
  - WebSocket connection to 'ws://localhost:5000/?token=EqzST9wqFIkX' failed: Error during WebSocket han
  - WebSocket connection to 'ws://localhost:5173/?token=EqzST9wqFIkX' failed: Error in connection establ

#### ✅ Pacientes
- **Status:** Acessível
- **Carregou:** Sim
- **Tem Conteúdo:** Sim
- **Tamanho do conteúdo:** 2458 caracteres
- **Elementos:**
  - hasTable: false
  - rows: 0
  - hasAddButton: true
  - modalOpens: false
- **Erros:**
  - Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Conten
  - WebSocket connection to 'ws://localhost:5000/?token=EqzST9wqFIkX' failed: Error during WebSocket han
  - WebSocket connection to 'ws://localhost:5173/?token=EqzST9wqFIkX' failed: Error in connection establ

#### ✅ Agenda
- **Status:** Acessível
- **Carregou:** Sim
- **Tem Conteúdo:** Sim
- **Tamanho do conteúdo:** 1542 caracteres
- **Elementos:**
  - hasCalendar: true
  - events: 8
- **Erros:**
  - Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Conten
  - WebSocket connection to 'ws://localhost:5000/?token=EqzST9wqFIkX' failed: Error during WebSocket han
  - WebSocket connection to 'ws://localhost:5173/?token=EqzST9wqFIkX' failed: Error in connection establ

#### ✅ Estoque
- **Status:** Acessível
- **Carregou:** Sim
- **Tem Conteúdo:** Sim
- **Tamanho do conteúdo:** 2414 caracteres
- **Elementos:**
  - hasTable: false
  - items: 0
  - isEmpty: true
- **Erros:**
  - Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Conten
  - WebSocket connection to 'ws://localhost:5000/?token=EqzST9wqFIkX' failed: Error during WebSocket han
  - WebSocket connection to 'ws://localhost:5173/?token=EqzST9wqFIkX' failed: Error in connection establ

#### ✅ Financeiro
- **Status:** Acessível
- **Carregou:** Sim
- **Tem Conteúdo:** Sim
- **Tamanho do conteúdo:** 2439 caracteres
- **Elementos:**
  - hasTable: false
  - transactions: 0
  - hasCharts: true
- **Erros:**
  - Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Conten
  - WebSocket connection to 'ws://localhost:5000/?token=EqzST9wqFIkX' failed: Error during WebSocket han
  - WebSocket connection to 'ws://localhost:5173/?token=EqzST9wqFIkX' failed: Error in connection establ

#### ✅ Configurações
- **Status:** Acessível
- **Carregou:** Sim
- **Tem Conteúdo:** Sim
- **Tamanho do conteúdo:** 2414 caracteres
- **Elementos:**
  - sections: 0
  - tabs: 0
  - inputs: 0
- **Erros:**
  - Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Conten
  - WebSocket connection to 'ws://localhost:5000/?token=EqzST9wqFIkX' failed: Error during WebSocket han
  - WebSocket connection to 'ws://localhost:5173/?token=EqzST9wqFIkX' failed: Error in connection establ

### Erros de Console

1. WebSocket connection to 'ws://localhost:5000/?token=EqzST9wqFIkX' failed: Error during WebSocket handshake: Unexpected response code: 400
2. Failed to load resource: the server responded with a status of 401 (Unauthorized)
3. WebSocket connection to 'ws://localhost:5173/?token=EqzST9wqFIkX' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED
4. [vite] failed to connect to websocket.
your current setup:
  (browser) localhost:5000/ <--[HTTP]--> localhost:5173/ (server)
  (browser) localhost:5000/ <--[WebSocket (failing)]--> localhost:5173/ (server)
Check out your Vite / network configuration and https://vite.dev/config/server-options.html#server-hmr .

---

## RECEPCIONISTA (maria)
### Status de Login
✅ **Login bem-sucedido**
- Redirecionado para: `http://localhost:5000/dashboard`

### Páginas Testadas

#### ✅ Dashboard
- **Status:** Acessível
- **Carregou:** Sim
- **Tem Conteúdo:** Sim
- **Tamanho do conteúdo:** 2425 caracteres
- **Elementos:**
  - cards: 8
  - metrics: 0
  - hasCharts: true
- **Erros:**
  - Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Conten
  - WebSocket connection to 'ws://localhost:5000/?token=EqzST9wqFIkX' failed: Error during WebSocket han
  - WebSocket connection to 'ws://localhost:5173/?token=EqzST9wqFIkX' failed: Error in connection establ

#### ✅ Pacientes
- **Status:** Acessível
- **Carregou:** Sim
- **Tem Conteúdo:** Sim
- **Tamanho do conteúdo:** 2425 caracteres
- **Elementos:**
  - hasTable: false
  - rows: 0
  - hasAddButton: true
  - modalOpens: false
- **Erros:**
  - Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Conten
  - WebSocket connection to 'ws://localhost:5000/?token=EqzST9wqFIkX' failed: Error during WebSocket han
  - WebSocket connection to 'ws://localhost:5173/?token=EqzST9wqFIkX' failed: Error in connection establ

#### ✅ Agenda
- **Status:** Acessível
- **Carregou:** Sim
- **Tem Conteúdo:** Sim
- **Tamanho do conteúdo:** 1534 caracteres
- **Elementos:**
  - hasCalendar: true
  - events: 8
- **Erros:**
  - Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Conten
  - WebSocket connection to 'ws://localhost:5000/?token=EqzST9wqFIkX' failed: Error during WebSocket han
  - WebSocket connection to 'ws://localhost:5173/?token=EqzST9wqFIkX' failed: Error in connection establ

#### ✅ Estoque
- **Status:** Acessível
- **Carregou:** Sim
- **Tem Conteúdo:** Sim
- **Tamanho do conteúdo:** 2406 caracteres
- **Elementos:**
  - hasTable: false
  - items: 0
  - isEmpty: true
- **Erros:**
  - Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Conten
  - WebSocket connection to 'ws://localhost:5000/?token=EqzST9wqFIkX' failed: Error during WebSocket han
  - WebSocket connection to 'ws://localhost:5173/?token=EqzST9wqFIkX' failed: Error in connection establ

#### ✅ Financeiro
- **Status:** Acessível
- **Carregou:** Sim
- **Tem Conteúdo:** Sim
- **Tamanho do conteúdo:** 2406 caracteres
- **Elementos:**
  - hasTable: false
  - transactions: 0
  - hasCharts: true
- **Erros:**
  - Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Conten
  - WebSocket connection to 'ws://localhost:5000/?token=EqzST9wqFIkX' failed: Error during WebSocket han
  - WebSocket connection to 'ws://localhost:5173/?token=EqzST9wqFIkX' failed: Error in connection establ

#### ✅ Configurações
- **Status:** Acessível
- **Carregou:** Sim
- **Tem Conteúdo:** Sim
- **Tamanho do conteúdo:** 2431 caracteres
- **Elementos:**
  - sections: 0
  - tabs: 0
  - inputs: 0
- **Erros:**
  - Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Conten
  - WebSocket connection to 'ws://localhost:5000/?token=EqzST9wqFIkX' failed: Error during WebSocket han
  - WebSocket connection to 'ws://localhost:5173/?token=EqzST9wqFIkX' failed: Error in connection establ

### Erros de Console

1. WebSocket connection to 'ws://localhost:5000/?token=EqzST9wqFIkX' failed: Error during WebSocket handshake: Unexpected response code: 400
2. Failed to load resource: the server responded with a status of 401 (Unauthorized)
3. WebSocket connection to 'ws://localhost:5173/?token=EqzST9wqFIkX' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED
4. [vite] failed to connect to websocket.
your current setup:
  (browser) localhost:5000/ <--[HTTP]--> localhost:5173/ (server)
  (browser) localhost:5000/ <--[WebSocket (failing)]--> localhost:5173/ (server)
Check out your Vite / network configuration and https://vite.dev/config/server-options.html#server-hmr .

---

## COMPARAÇÃO DE PERMISSÕES

| Página | Admin | Dentista | Recepcionista ||--------|-------|----------|---------------|| Dashboard | ❌ | ✅ | ✅ || Pacientes | ❌ | ✅ | ✅ || Agenda | ❌ | ✅ | ✅ || Estoque | ❌ | ✅ | ✅ || Financeiro | ❌ | ✅ | ✅ || Configurações | ❌ | ✅ | ✅ |

---

## SCREENSHOTS

Todas as screenshots salvas em: `c:\Users\Thiago\Desktop\site clinca dentista\test-screenshots`
