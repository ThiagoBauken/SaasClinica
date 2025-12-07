# Relatório de QA - Frontend da Clínica Odontológica

**Data:** 07/12/2025, 15:30:38

**Base URL:** http://localhost:5000

## Resumo

- **Total de páginas testadas:** 14
- **Passou:** 0
- **Falhou:** 14
- **Com avisos:** 0

## Detalhes por Página

### ❌ Fluxo de Login

- **Rota:** `/auth`
- **Status:** failed

**Erros:**
- Campos de login não encontrados na página

**Screenshot:** `C:\Users\Thiago\Desktop\site clinca dentista\qa-screenshots\login_page.png`

---

### ❌ Login/Registro

- **Rota:** `/auth`
- **Status:** failed
- **Tempo de carga:** 879ms
- **Título da página:** DentCare - Sistema de Gerenciamento Odontológico

**Erros:**
- 7 erros de console, 1 erros de rede

**Erros de Console (66):**
- Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' 'unsafe-eval'". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback. The action has been blocked.
  - Local: {"url":"http://localhost:5000/auth","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user","lineNumber":0,"columnNumber":0}
- WebSocket connection to 'ws://localhost:5000/?token=EqzST9wqFIkX' failed: Error during WebSocket handshake: Unexpected response code: 400
  - Local: {"url":"http://localhost:5000/@vite/client","lineNumber":801,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- ... e mais 61 erros

**Erros de Rede (14):**
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- ... e mais 9 erros

**Screenshot:** `C:\Users\Thiago\Desktop\site clinca dentista\qa-screenshots\Login_Registro.png`

---

### ❌ Dashboard Principal

- **Rota:** `/dashboard`
- **Status:** failed
- **Tempo de carga:** 222ms
- **Título da página:** DentCare - Sistema de Gerenciamento Odontológico

**Erros:**
- 5 erros de console, 1 erros de rede

**Erros de Console (59):**
- Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' 'unsafe-eval'". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback. The action has been blocked.
  - Local: {"url":"http://localhost:5000/dashboard","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user","lineNumber":0,"columnNumber":0}
- WebSocket connection to 'ws://localhost:5000/?token=EqzST9wqFIkX' failed: Error during WebSocket handshake: Unexpected response code: 400
  - Local: {"url":"http://localhost:5000/@vite/client","lineNumber":801,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- ... e mais 54 erros

**Erros de Rede (13):**
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- ... e mais 8 erros

**Screenshot:** `C:\Users\Thiago\Desktop\site clinca dentista\qa-screenshots\Dashboard_Principal.png`

---

### ❌ Agenda de Consultas

- **Rota:** `/agenda`
- **Status:** failed
- **Tempo de carga:** 190ms
- **Título da página:** DentCare - Sistema de Gerenciamento Odontológico

**Erros:**
- 5 erros de console, 1 erros de rede

**Erros de Console (54):**
- Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' 'unsafe-eval'". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback. The action has been blocked.
  - Local: {"url":"http://localhost:5000/agenda","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user","lineNumber":0,"columnNumber":0}
- WebSocket connection to 'ws://localhost:5000/?token=EqzST9wqFIkX' failed: Error during WebSocket handshake: Unexpected response code: 400
  - Local: {"url":"http://localhost:5000/@vite/client","lineNumber":801,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- ... e mais 49 erros

**Erros de Rede (12):**
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- ... e mais 7 erros

**Screenshot:** `C:\Users\Thiago\Desktop\site clinca dentista\qa-screenshots\Agenda_de_Consultas.png`

---

### ❌ Listagem de Pacientes

- **Rota:** `/patients`
- **Status:** failed
- **Tempo de carga:** 187ms
- **Título da página:** DentCare - Sistema de Gerenciamento Odontológico

**Erros:**
- 5 erros de console, 1 erros de rede

**Erros de Console (49):**
- Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' 'unsafe-eval'". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback. The action has been blocked.
  - Local: {"url":"http://localhost:5000/patients","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user","lineNumber":0,"columnNumber":0}
- WebSocket connection to 'ws://localhost:5000/?token=EqzST9wqFIkX' failed: Error during WebSocket handshake: Unexpected response code: 400
  - Local: {"url":"http://localhost:5000/@vite/client","lineNumber":801,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- ... e mais 44 erros

**Erros de Rede (11):**
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- ... e mais 6 erros

**Screenshot:** `C:\Users\Thiago\Desktop\site clinca dentista\qa-screenshots\Listagem_de_Pacientes.png`

---

### ❌ Cadastros Gerais

- **Rota:** `/cadastros`
- **Status:** failed
- **Tempo de carga:** 213ms
- **Título da página:** DentCare - Sistema de Gerenciamento Odontológico

**Erros:**
- 5 erros de console, 1 erros de rede

**Erros de Console (44):**
- Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' 'unsafe-eval'". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback. The action has been blocked.
  - Local: {"url":"http://localhost:5000/cadastros","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user","lineNumber":0,"columnNumber":0}
- WebSocket connection to 'ws://localhost:5000/?token=EqzST9wqFIkX' failed: Error during WebSocket handshake: Unexpected response code: 400
  - Local: {"url":"http://localhost:5000/@vite/client","lineNumber":801,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- ... e mais 39 erros

**Erros de Rede (10):**
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- ... e mais 5 erros

**Screenshot:** `C:\Users\Thiago\Desktop\site clinca dentista\qa-screenshots\Cadastros_Gerais.png`

---

### ❌ Controle de Estoque

- **Rota:** `/inventory`
- **Status:** failed
- **Tempo de carga:** 186ms
- **Título da página:** DentCare - Sistema de Gerenciamento Odontológico

**Erros:**
- 5 erros de console, 1 erros de rede

**Erros de Console (39):**
- Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' 'unsafe-eval'". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback. The action has been blocked.
  - Local: {"url":"http://localhost:5000/inventory","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user","lineNumber":0,"columnNumber":0}
- WebSocket connection to 'ws://localhost:5000/?token=EqzST9wqFIkX' failed: Error during WebSocket handshake: Unexpected response code: 400
  - Local: {"url":"http://localhost:5000/@vite/client","lineNumber":801,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- ... e mais 34 erros

**Erros de Rede (9):**
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- ... e mais 4 erros

**Screenshot:** `C:\Users\Thiago\Desktop\site clinca dentista\qa-screenshots\Controle_de_Estoque.png`

---

### ❌ Módulo Financeiro

- **Rota:** `/financial`
- **Status:** failed
- **Tempo de carga:** 183ms
- **Título da página:** DentCare - Sistema de Gerenciamento Odontológico

**Erros:**
- 5 erros de console, 1 erros de rede

**Erros de Console (34):**
- Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' 'unsafe-eval'". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback. The action has been blocked.
  - Local: {"url":"http://localhost:5000/financial","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user","lineNumber":0,"columnNumber":0}
- WebSocket connection to 'ws://localhost:5000/?token=EqzST9wqFIkX' failed: Error during WebSocket handshake: Unexpected response code: 400
  - Local: {"url":"http://localhost:5000/@vite/client","lineNumber":801,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- ... e mais 29 erros

**Erros de Rede (8):**
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- ... e mais 3 erros

**Screenshot:** `C:\Users\Thiago\Desktop\site clinca dentista\qa-screenshots\M_dulo_Financeiro.png`

---

### ❌ Configurações

- **Rota:** `/configuracoes`
- **Status:** failed
- **Tempo de carga:** 210ms
- **Título da página:** DentCare - Sistema de Gerenciamento Odontológico

**Erros:**
- 5 erros de console, 1 erros de rede

**Erros de Console (29):**
- Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' 'unsafe-eval'". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback. The action has been blocked.
  - Local: {"url":"http://localhost:5000/configuracoes","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- WebSocket connection to 'ws://localhost:5000/?token=EqzST9wqFIkX' failed: Error during WebSocket handshake: Unexpected response code: 400
  - Local: {"url":"http://localhost:5000/@vite/client","lineNumber":801,"columnNumber":0}
- ... e mais 24 erros

**Erros de Rede (7):**
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- ... e mais 2 erros

**Screenshot:** `C:\Users\Thiago\Desktop\site clinca dentista\qa-screenshots\Configura__es.png`

---

### ❌ Schedule (Agenda Alternativa)

- **Rota:** `/schedule`
- **Status:** failed
- **Tempo de carga:** 177ms
- **Título da página:** DentCare - Sistema de Gerenciamento Odontológico

**Erros:**
- 4 erros de console, 1 erros de rede

**Erros de Console (24):**
- Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' 'unsafe-eval'". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback. The action has been blocked.
  - Local: {"url":"http://localhost:5000/schedule","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' 'unsafe-eval'". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback. The action has been blocked.
  - Local: {"url":"http://localhost:5000/analytics","lineNumber":0,"columnNumber":0}
- ... e mais 19 erros

**Erros de Rede (6):**
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- ... e mais 1 erros

**Screenshot:** `C:\Users\Thiago\Desktop\site clinca dentista\qa-screenshots\Schedule__Agenda_Alternativa_.png`

---

### ❌ Analytics/Relatórios

- **Rota:** `/analytics`
- **Status:** failed
- **Tempo de carga:** 193ms
- **Título da página:** DentCare - Sistema de Gerenciamento Odontológico

**Erros:**
- 4 erros de console, 1 erros de rede

**Erros de Console (20):**
- Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' 'unsafe-eval'". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback. The action has been blocked.
  - Local: {"url":"http://localhost:5000/analytics","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' 'unsafe-eval'". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback. The action has been blocked.
  - Local: {"url":"http://localhost:5000/automation","lineNumber":0,"columnNumber":0}
- ... e mais 15 erros

**Erros de Rede (5):**
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp

**Screenshot:** `C:\Users\Thiago\Desktop\site clinca dentista\qa-screenshots\Analytics_Relat_rios.png`

---

### ❌ Automação

- **Rota:** `/automation`
- **Status:** failed
- **Tempo de carga:** 201ms
- **Título da página:** DentCare - Sistema de Gerenciamento Odontológico

**Erros:**
- 4 erros de console, 1 erros de rede

**Erros de Console (16):**
- Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' 'unsafe-eval'". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback. The action has been blocked.
  - Local: {"url":"http://localhost:5000/automation","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' 'unsafe-eval'". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback. The action has been blocked.
  - Local: {"url":"http://localhost:5000/prosthesis","lineNumber":0,"columnNumber":0}
- ... e mais 11 erros

**Erros de Rede (4):**
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp

**Screenshot:** `C:\Users\Thiago\Desktop\site clinca dentista\qa-screenshots\Automa__o.png`

---

### ❌ Controle de Próteses

- **Rota:** `/prosthesis`
- **Status:** failed
- **Tempo de carga:** 188ms
- **Título da página:** DentCare - Sistema de Gerenciamento Odontológico

**Erros:**
- 4 erros de console, 1 erros de rede

**Erros de Console (12):**
- Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' 'unsafe-eval'". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback. The action has been blocked.
  - Local: {"url":"http://localhost:5000/prosthesis","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' 'unsafe-eval'". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback. The action has been blocked.
  - Local: {"url":"http://localhost:5000/crm","lineNumber":0,"columnNumber":0}
- ... e mais 7 erros

**Erros de Rede (3):**
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp

**Screenshot:** `C:\Users\Thiago\Desktop\site clinca dentista\qa-screenshots\Controle_de_Pr_teses.png`

---

### ❌ CRM

- **Rota:** `/crm`
- **Status:** failed
- **Tempo de carga:** 162ms
- **Título da página:** DentCare - Sistema de Gerenciamento Odontológico

**Erros:**
- 4 erros de console, 1 erros de rede

**Erros de Console (8):**
- Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' 'unsafe-eval'". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback. The action has been blocked.
  - Local: {"url":"http://localhost:5000/crm","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' 'unsafe-eval'". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback. The action has been blocked.
  - Local: {"url":"http://localhost:5000/atendimento","lineNumber":0,"columnNumber":0}
- ... e mais 3 erros

**Erros de Rede (2):**
- https://replit.com/public/js/replit-dev-banner.js: csp
- https://replit.com/public/js/replit-dev-banner.js: csp

**Screenshot:** `C:\Users\Thiago\Desktop\site clinca dentista\qa-screenshots\CRM.png`

---

### ❌ Chat/Atendimento

- **Rota:** `/atendimento`
- **Status:** failed
- **Tempo de carga:** 186ms
- **Título da página:** DentCare - Sistema de Gerenciamento Odontológico

**Erros:**
- 4 erros de console, 1 erros de rede

**Erros de Console (4):**
- Loading the script 'https://replit.com/public/js/replit-dev-banner.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' 'unsafe-eval'". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback. The action has been blocked.
  - Local: {"url":"http://localhost:5000/atendimento","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user","lineNumber":0,"columnNumber":0}
- Failed to load resource: the server responded with a status of 401 (Unauthorized)
  - Local: {"url":"http://localhost:5000/api/user/company","lineNumber":0,"columnNumber":0}

**Erros de Rede (1):**
- https://replit.com/public/js/replit-dev-banner.js: csp

**Screenshot:** `C:\Users\Thiago\Desktop\site clinca dentista\qa-screenshots\Chat_Atendimento.png`

---

