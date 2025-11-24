# 🧪 GUIA DE TESTE - VALIDAÇÕES E MULTI-TENANT

## 📋 PRÉ-REQUISITOS

1. ✅ PostgreSQL rodando (porta 5432)
2. ✅ Redis rodando (porta 6379)
3. ✅ Banco de dados `dental_clinic` criado

## 🚀 PASSO 1: RODAR MIGRATIONS

### Windows (PowerShell):
```powershell
# Navegar até a pasta do projeto
cd "c:\Users\Thiago\Desktop\site clinca dentista"

# Rodar migration de integração n8n
psql -U dental -d dental_clinic -f "server\migrations\002_n8n_integration.sql"

# Rodar migration de correção multi-tenant
psql -U dental -d dental_clinic -f "server\migrations\003_fix_multitenant_isolation.sql"
```

### Linux/Mac:
```bash
cd ~/Desktop/site\ clinca\ dentista

psql -U dental -d dental_clinic -f server/migrations/002_n8n_integration.sql
psql -U dental -d dental_clinic -f server/migrations/003_fix_multitenant_isolation.sql
```

### Via Docker (se estiver usando docker-compose):
```bash
docker-compose exec db psql -U dental -d dental_clinic -f /docker-entrypoint-initdb.d/002_n8n_integration.sql
docker-compose exec db psql -U dental -d dental_clinic -f /docker-entrypoint-initdb.d/003_fix_multitenant_isolation.sql
```

### Verificar se migrations rodaram:
```sql
-- Verificar novos campos em appointments
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'appointments'
  AND column_name IN ('google_calendar_event_id', 'wuzapi_message_id', 'automation_status');

-- Verificar novos campos em users
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('google_calendar_id', 'wuzapi_phone');

-- Verificar se automation_logs existe
SELECT EXISTS (
   SELECT FROM information_schema.tables
   WHERE table_name = 'automation_logs'
);

-- Verificar companyId em rooms
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'rooms' AND column_name = 'company_id';

-- Verificar funções PostgreSQL criadas
SELECT routine_name
FROM information_schema.routines
WHERE routine_name IN ('check_room_availability', 'check_professional_availability');
```

---

## 🧪 PASSO 2: INICIAR O SERVIDOR

```bash
npm run dev
```

Aguarde a mensagem:
```
✓ Server running on http://localhost:5000
✓ Database connected
✓ Redis connected
```

---

## 🔐 PASSO 3: FAZER LOGIN

### Via Thunder Client / Postman / Insomnia:

```http
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "sua-senha"
}
```

**Resposta esperada:**
```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "companyId": 1,
    "role": "admin"
  }
}
```

**IMPORTANTE:** Salvar o cookie de sessão para próximas requests!

---

## 🧪 PASSO 4: TESTAR ENDPOINTS (Ordem Recomendada)

### 4.1. Listar Profissionais (Multi-Tenant)

```http
GET http://localhost:5000/api/v1/professionals?page=1&limit=10
Cookie: connect.sid=<seu-cookie-aqui>
```

**Resultado esperado:**
- ✅ Retorna apenas profissionais da `companyId` do usuário logado
- ✅ Status 200
- ✅ Paginação funcionando

**Erro comum:**
- ❌ Status 403 → Usuário sem companyId (verificar tabela users)

---

### 4.2. Buscar Profissional Específico (Com Google Calendar ID)

```http
GET http://localhost:5000/api/v1/professionals/2
Cookie: connect.sid=<seu-cookie-aqui>
```

**Resultado esperado:**
```json
{
  "id": 2,
  "fullName": "Dr. João Silva",
  "email": "joao@clinica.com",
  "phone": "11999999999",
  "speciality": "Ortodontia",
  "role": "dentist",
  "active": true,
  "profileImageUrl": null,
  "googleCalendarId": null,
  "wuzapiPhone": null
}
```

✅ **CRÍTICO:** Campos `googleCalendarId` e `wuzapiPhone` devem aparecer (mesmo que null)

---

### 4.3. Listar Salas (Multi-Tenant)

```http
GET http://localhost:5000/api/v1/rooms
Cookie: connect.sid=<seu-cookie-aqui>
```

**Resultado esperado:**
- ✅ Retorna apenas salas da `companyId` do usuário
- ✅ Status 200

**Teste de Isolamento:**
1. Faça login com empresa 1
2. Veja as salas retornadas
3. Faça login com empresa 2
4. ✅ Deve retornar salas DIFERENTES!

---

### 4.4. Listar Procedimentos (Multi-Tenant)

```http
GET http://localhost:5000/api/v1/procedures
Cookie: connect.sid=<seu-cookie-aqui>
```

**Resultado esperado:**
- ✅ Retorna apenas procedimentos da empresa do usuário
- ✅ Status 200

---

### 4.4.1. CRUD de Salas (NOVO!)

#### Criar Nova Sala

```http
POST http://localhost:5000/api/v1/rooms
Content-Type: application/json
Cookie: connect.sid=<seu-cookie-aqui>

{
  "name": "Sala de Cirurgia",
  "description": "Sala equipada para procedimentos cirúrgicos",
  "active": true
}
```

**Resultado esperado:**
- ✅ Status 201 Created
- ✅ Sala criada com `companyId` do usuário logado
- ✅ Campos `createdAt` e `updatedAt` preenchidos automaticamente

#### Buscar Sala Específica

```http
GET http://localhost:5000/api/v1/rooms/1
Cookie: connect.sid=<seu-cookie-aqui>
```

**Resultado esperado:**
- ✅ Status 200 se a sala pertence à empresa do usuário
- ✅ Status 404 se a sala pertence a outra empresa

#### Atualizar Sala

```http
PATCH http://localhost:5000/api/v1/rooms/1
Content-Type: application/json
Cookie: connect.sid=<seu-cookie-aqui>

{
  "name": "Sala de Cirurgia Avançada",
  "description": "Sala reformada com novos equipamentos"
}
```

**Resultado esperado:**
- ✅ Status 200 + sala atualizada
- ✅ Campo `updatedAt` atualizado automaticamente
- ✅ Status 404 se tentar atualizar sala de outra empresa

#### Deletar Sala (Soft Delete)

```http
DELETE http://localhost:5000/api/v1/rooms/1
Cookie: connect.sid=<seu-cookie-aqui>
```

**Resultado esperado:**
- ✅ Status 204 No Content
- ✅ Sala marcada como `active: false` (não é removida do banco)
- ✅ Não aparece mais em GET /api/v1/rooms
- ✅ Status 404 se tentar deletar sala de outra empresa

---

### 4.4.2. CRUD de Procedimentos (NOVO!)

#### Criar Novo Procedimento

```http
POST http://localhost:5000/api/v1/procedures
Content-Type: application/json
Cookie: connect.sid=<seu-cookie-aqui>

{
  "name": "Limpeza Dental",
  "description": "Limpeza completa com polimento",
  "duration": 30,
  "price": 15000,
  "color": "#4CAF50",
  "active": true
}
```

**Resultado esperado:**
- ✅ Status 201 Created
- ✅ Procedimento criado com `companyId` do usuário logado
- ✅ Preço em centavos (15000 = R$ 150,00)
- ✅ Duração em minutos

#### Buscar Procedimento Específico

```http
GET http://localhost:5000/api/v1/procedures/1
Cookie: connect.sid=<seu-cookie-aqui>
```

**Resultado esperado:**
- ✅ Status 200 se o procedimento pertence à empresa
- ✅ Status 404 se pertence a outra empresa

#### Atualizar Procedimento

```http
PATCH http://localhost:5000/api/v1/procedures/1
Content-Type: application/json
Cookie: connect.sid=<seu-cookie-aqui>

{
  "name": "Limpeza Dental Completa",
  "price": 18000,
  "duration": 45
}
```

**Resultado esperado:**
- ✅ Status 200 + procedimento atualizado
- ✅ Campo `updatedAt` atualizado
- ✅ Status 404 se tentar atualizar procedimento de outra empresa

#### Deletar Procedimento (Soft Delete)

```http
DELETE http://localhost:5000/api/v1/procedures/1
Cookie: connect.sid=<seu-cookie-aqui>
```

**Resultado esperado:**
- ✅ Status 204 No Content
- ✅ Procedimento marcado como `active: false`
- ✅ Não aparece mais em GET /api/v1/procedures
- ✅ Status 404 se tentar deletar procedimento de outra empresa

---

### 4.5. Verificar Disponibilidade (NOVO!)

**Cenário 1: SEM conflito**
```http
POST http://localhost:5000/api/v1/appointments/check-availability
Content-Type: application/json
Cookie: connect.sid=<seu-cookie-aqui>

{
  "professionalId": 2,
  "roomId": 1,
  "startTime": "2024-11-20T14:00:00-03:00",
  "endTime": "2024-11-20T15:00:00-03:00"
}
```

**Resposta esperada:**
```json
{
  "available": true,
  "conflicts": []
}
```

**Cenário 2: COM conflito**

Primeiro, crie um agendamento:
```http
POST http://localhost:5000/api/v1/appointments
Content-Type: application/json
Cookie: connect.sid=<seu-cookie-aqui>

{
  "title": "Consulta Teste",
  "patientId": 1,
  "professionalId": 2,
  "roomId": 1,
  "startTime": "2024-11-20T14:00:00-03:00",
  "endTime": "2024-11-20T15:00:00-03:00",
  "status": "scheduled"
}
```

Agora tente verificar disponibilidade no MESMO horário:
```http
POST http://localhost:5000/api/v1/appointments/check-availability
Content-Type: application/json
Cookie: connect.sid=<seu-cookie-aqui>

{
  "professionalId": 2,
  "roomId": 1,
  "startTime": "2024-11-20T14:00:00-03:00",
  "endTime": "2024-11-20T15:00:00-03:00"
}
```

**Resposta esperada:**
```json
{
  "available": false,
  "conflicts": [
    {
      "type": "professional",
      "appointmentId": 123,
      "patientName": "João Silva",
      "professionalName": "Dr. João Silva",
      "roomName": "Sala 1",
      "startTime": "2024-11-20T14:00:00.000Z",
      "endTime": "2024-11-20T15:00:00.000Z"
    }
  ]
}
```

✅ **SUCESSO:** Sistema detectou conflito e retornou detalhes!

---

### 4.6. Criar Agendamento (Com Validação Automática)

**Cenário 1: Criar agendamento SEM conflito**
```http
POST http://localhost:5000/api/v1/appointments
Content-Type: application/json
Cookie: connect.sid=<seu-cookie-aqui>

{
  "title": "Limpeza",
  "patientId": 1,
  "professionalId": 2,
  "roomId": 1,
  "startTime": "2024-11-21T10:00:00-03:00",
  "endTime": "2024-11-21T11:00:00-03:00",
  "status": "scheduled"
}
```

**Resposta esperada:**
- ✅ Status 201 Created
- ✅ Agendamento criado com sucesso

**Cenário 2: Tentar criar COM conflito (double booking)**
```http
POST http://localhost:5000/api/v1/appointments
Content-Type: application/json
Cookie: connect.sid=<seu-cookie-aqui>

{
  "title": "Consulta 2",
  "patientId": 2,
  "professionalId": 2,
  "roomId": 1,
  "startTime": "2024-11-21T10:00:00-03:00",
  "endTime": "2024-11-21T11:00:00-03:00",
  "status": "scheduled"
}
```

**Resposta esperada:**
- ✅ Status 409 Conflict
- ✅ Mensagem de erro clara:

```json
{
  "error": "Conflito de agendamento detectado",
  "message": "Já existe um agendamento no horário solicitado",
  "conflicts": [
    {
      "type": "professional",
      "appointmentId": 456,
      "patientName": "Maria Santos",
      "professionalName": "Dr. João Silva",
      "roomName": "Sala 1",
      "startTime": "2024-11-21T10:00:00.000Z",
      "endTime": "2024-11-21T11:00:00.000Z"
    }
  ]
}
```

✅ **SUCESSO:** Sistema PREVENIU double booking automaticamente!

---

### 4.7. Atualizar Agendamento (Com Validação)

```http
PATCH http://localhost:5000/api/v1/appointments/123
Content-Type: application/json
Cookie: connect.sid=<seu-cookie-aqui>

{
  "startTime": "2024-11-21T14:00:00-03:00",
  "endTime": "2024-11-21T15:00:00-03:00"
}
```

**Resposta esperada:**
- ✅ Se não houver conflito: Status 200 + agendamento atualizado
- ✅ Se houver conflito: Status 409 + detalhes dos conflitos

**Importante:** Sistema automaticamente exclui o próprio agendamento da verificação!

---

## ✅ CHECKLIST DE VALIDAÇÃO

### Multi-Tenant (Isolamento)
- [ ] Profissionais filtrados por companyId
- [ ] Salas filtradas por companyId
- [ ] Procedimentos filtrados por companyId
- [ ] Agendamentos filtrados por companyId
- [ ] Duas empresas NÃO veem dados uma da outra

### Validação de Conflitos
- [ ] Check-availability retorna conflitos corretamente
- [ ] POST /appointments previne double booking
- [ ] PATCH /appointments valida novo horário
- [ ] Conflitos de sala detectados
- [ ] Conflitos de profissional detectados
- [ ] excludeAppointmentId funciona no PATCH

### Novos Campos
- [ ] googleCalendarId aparece em GET /professionals/:id
- [ ] wuzapiPhone aparece em GET /professionals/:id
- [ ] Campos de automação existem em appointments

### CRUD de Salas
- [ ] POST /rooms cria sala com companyId correto
- [ ] GET /rooms/:id retorna sala apenas se pertence à empresa
- [ ] PATCH /rooms/:id atualiza sala apenas da própria empresa
- [ ] DELETE /rooms/:id faz soft delete (active: false)
- [ ] Salas deletadas não aparecem em GET /rooms
- [ ] Não é possível criar sala sem nome
- [ ] Campo updatedAt é atualizado automaticamente

### CRUD de Procedimentos
- [ ] POST /procedures cria procedimento com companyId correto
- [ ] GET /procedures/:id retorna procedimento apenas se pertence à empresa
- [ ] PATCH /procedures/:id atualiza procedimento apenas da própria empresa
- [ ] DELETE /procedures/:id faz soft delete (active: false)
- [ ] Procedimentos deletados não aparecem em GET /procedures
- [ ] Validação de preço (centavos) e duração (minutos) funciona
- [ ] Color aceita apenas hex (#RRGGBB)

### Performance
- [ ] Queries não demoram > 500ms
- [ ] Cache funcionando (segunda request mais rápida)
- [ ] Sem queries N+1

---

## 🐛 TROUBLESHOOTING

### Erro: "column does not exist"
❌ **Problema:** Migrations não rodaram
✅ **Solução:** Rodar migrations novamente conforme Passo 1

### Erro: "User not associated with any company"
❌ **Problema:** Usuário logado não tem companyId
✅ **Solução:**
```sql
UPDATE users SET company_id = 1 WHERE username = 'admin';
```

### Erro: "Professional not found"
❌ **Problema:** Profissional pertence a outra empresa
✅ **Solução:** Verificar isolamento multi-tenant está funcionando!

### Erro: Conflitos não detectados
❌ **Problema:** Timezones diferentes
✅ **Solução:** Sempre usar timezone -03:00 ou UTC

### Erro: getProfessionals/getRooms não é uma função
❌ **Problema:** Storage não foi atualizado ou servidor não reiniciou
✅ **Solução:**
1. Parar servidor (Ctrl+C)
2. Limpar cache: `npm run clean` ou deletar `dist/`
3. Reiniciar: `npm run dev`

---

## 📊 RESULTADOS ESPERADOS

Após todos os testes:

✅ **Multi-Tenant:** 100% isolado
✅ **Validações:** Previne double booking
✅ **Performance:** Queries < 500ms
✅ **Segurança:** Dados protegidos por empresa
✅ **Novos Campos:** Prontos para n8n

---

## 🎯 PRÓXIMOS PASSOS

Após validar tudo acima:

1. ✅ CRUD de Salas (POST, PUT, DELETE)
2. ✅ CRUD de Procedimentos (POST, PUT, DELETE)
3. ✅ Frontend - Página de Configurações
4. ✅ Frontend - Gestão de Profissionais
5. ✅ Integração com n8n (webhooks)

---

## 💡 DICAS

- Use Thunder Client no VS Code para testar (extensão gratuita)
- Mantenha collection de requests salva
- Sempre verificar cookie de sessão nas requests
- Logs do servidor mostram queries SQL (útil para debug)
- Use `console.log()` no backend se precisar debugar

**Boa sorte nos testes! 🚀**
