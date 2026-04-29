# Documentação da API - DentCare

Esta documentação detalha todas as rotas e endpoints disponíveis na API do DentCare, além de exemplos de requisição e resposta.

## Índice

- [Autenticação](#autenticação)
- [Usuários](#usuários)
- [Pacientes](#pacientes)
- [Consultas](#consultas)
- [Procedimentos](#procedimentos)
- [Odontograma](#odontograma)
- [Prontuário](#prontuário)
- [Financeiro](#financeiro)
- [Estoque](#estoque)
- [Próteses](#próteses)
- [Automações](#automações)

## Base URL

Todas as URLs são relativas à base:

```
https://sua-aplicacao.com/api
```

Em ambiente de desenvolvimento:

```
http://localhost:5000/api
```

## Autenticação

### Login com Credenciais

```
POST /login
```

**Corpo da Requisição:**
```json
{
  "username": "usuario",
  "password": "senha"
}
```

**Resposta de Sucesso:**
```json
{
  "id": 1,
  "username": "usuario",
  "fullName": "Nome Completo",
  "role": "admin",
  "email": "email@exemplo.com"
}
```

### Login com Google

```
GET /auth/google
```

Redireciona para a tela de autenticação do Google.

### Callback do Google

```
GET /auth/google/callback
```

Endpoint para o callback após autenticação com Google.

### Obter Usuário Atual

```
GET /user
```

**Resposta de Sucesso:**
```json
{
  "id": 1,
  "username": "usuario",
  "fullName": "Nome Completo",
  "role": "admin",
  "email": "email@exemplo.com"
}
```

### Logout

```
POST /logout
```

**Resposta de Sucesso:**
```
Status 200 OK
```

## Usuários

### Listar Usuários

```
GET /users
```

**Resposta de Sucesso:**
```json
[
  {
    "id": 1,
    "username": "usuario1",
    "fullName": "Nome Completo 1",
    "role": "admin",
    "email": "email1@exemplo.com"
  },
  {
    "id": 2,
    "username": "usuario2",
    "fullName": "Nome Completo 2",
    "role": "dentist",
    "email": "email2@exemplo.com"
  }
]
```

### Obter Usuário por ID

```
GET /users/:id
```

**Resposta de Sucesso:**
```json
{
  "id": 1,
  "username": "usuario1",
  "fullName": "Nome Completo 1",
  "role": "admin",
  "email": "email1@exemplo.com",
  "phone": "11999999999",
  "profileImageUrl": "https://exemplo.com/imagem.jpg",
  "speciality": "Ortodontia"
}
```

### Criar Usuário

```
POST /register
```

**Corpo da Requisição:**
```json
{
  "username": "novousuario",
  "password": "senha123",
  "fullName": "Novo Usuário",
  "role": "staff",
  "email": "novo@exemplo.com",
  "phone": "11999999999",
  "speciality": "Endodontia"
}
```

**Resposta de Sucesso:**
```json
{
  "id": 3,
  "username": "novousuario",
  "fullName": "Novo Usuário",
  "role": "staff",
  "email": "novo@exemplo.com"
}
```

### Atualizar Usuário

```
PATCH /users/:id
```

**Corpo da Requisição:**
```json
{
  "fullName": "Nome Atualizado",
  "phone": "11988888888"
}
```

**Resposta de Sucesso:**
```json
{
  "id": 1,
  "username": "usuario1",
  "fullName": "Nome Atualizado",
  "role": "admin",
  "email": "email1@exemplo.com",
  "phone": "11988888888"
}
```

## Pacientes

### Listar Pacientes

```
GET /patients
```

**Parâmetros de Consulta (opcionais):**
- `search`: Termo de busca
- `page`: Número da página
- `limit`: Limite de itens por página

**Resposta de Sucesso:**
```json
{
  "total": 100,
  "page": 1,
  "limit": 20,
  "patients": [
    {
      "id": 1,
      "fullName": "Paciente Um",
      "email": "paciente1@exemplo.com",
      "phone": "11977777777",
      "birthDate": "1990-01-01T00:00:00.000Z"
    },
    {
      "id": 2,
      "fullName": "Paciente Dois",
      "email": "paciente2@exemplo.com",
      "phone": "11966666666",
      "birthDate": "1985-05-15T00:00:00.000Z"
    }
  ]
}
```

### Obter Paciente por ID

```
GET /patients/:id
```

**Resposta de Sucesso:**
```json
{
  "id": 1,
  "fullName": "Paciente Um",
  "email": "paciente1@exemplo.com",
  "phone": "11977777777",
  "cpf": "12345678901",
  "birthDate": "1990-01-01T00:00:00.000Z",
  "gender": "masculino",
  "address": "Rua Exemplo, 123",
  "insuranceInfo": "Plano Dental Premium",
  "notes": "Paciente com histórico de bruxismo"
}
```

### Criar Paciente

```
POST /patients
```

**Corpo da Requisição:**
```json
{
  "fullName": "Novo Paciente",
  "email": "novopaciente@exemplo.com",
  "phone": "11955555555",
  "cpf": "98765432109",
  "birthDate": "1995-10-20",
  "gender": "feminino",
  "address": "Av. Exemplo, 456",
  "insuranceInfo": "Plano Dental Básico",
  "notes": "Primeira consulta em 10/06/2025"
}
```

**Resposta de Sucesso:**
```json
{
  "id": 3,
  "fullName": "Novo Paciente",
  "email": "novopaciente@exemplo.com",
  "phone": "11955555555",
  "cpf": "98765432109",
  "birthDate": "1995-10-20T00:00:00.000Z",
  "gender": "feminino",
  "address": "Av. Exemplo, 456",
  "insuranceInfo": "Plano Dental Básico",
  "notes": "Primeira consulta em 10/06/2025"
}
```

### Atualizar Paciente

```
PATCH /patients/:id
```

**Corpo da Requisição:**
```json
{
  "phone": "11944444444",
  "address": "Av. Nova, 789",
  "notes": "Atualização das informações do paciente"
}
```

**Resposta de Sucesso:**
```json
{
  "id": 1,
  "fullName": "Paciente Um",
  "email": "paciente1@exemplo.com",
  "phone": "11944444444",
  "address": "Av. Nova, 789",
  "notes": "Atualização das informações do paciente"
}
```

## Consultas

### Listar Consultas

```
GET /appointments
```

**Parâmetros de Consulta (opcionais):**
- `startDate`: Data inicial (YYYY-MM-DD)
- `endDate`: Data final (YYYY-MM-DD)
- `professionalId`: ID do profissional
- `patientId`: ID do paciente
- `status`: Status da consulta (scheduled, confirmed, completed, cancelled)

**Resposta de Sucesso:**
```json
[
  {
    "id": 1,
    "title": "Consulta de Avaliação",
    "patientId": 1,
    "patient": {
      "id": 1,
      "fullName": "Paciente Um"
    },
    "professionalId": 1,
    "professional": {
      "id": 1,
      "fullName": "Dr. Nome"
    },
    "roomId": 2,
    "room": {
      "id": 2,
      "name": "Consultório 2"
    },
    "startTime": "2025-05-20T14:00:00.000Z",
    "endTime": "2025-05-20T15:00:00.000Z",
    "status": "scheduled",
    "procedures": [
      {
        "id": 1,
        "name": "Avaliação Clínica",
        "price": 15000
      }
    ]
  }
]
```

### Obter Consulta por ID

```
GET /appointments/:id
```

**Resposta de Sucesso:**
```json
{
  "id": 1,
  "title": "Consulta de Avaliação",
  "patientId": 1,
  "patient": {
    "id": 1,
    "fullName": "Paciente Um",
    "phone": "11977777777"
  },
  "professionalId": 1,
  "professional": {
    "id": 1,
    "fullName": "Dr. Nome",
    "speciality": "Ortodontia"
  },
  "roomId": 2,
  "room": {
    "id": 2,
    "name": "Consultório 2"
  },
  "startTime": "2025-05-20T14:00:00.000Z",
  "endTime": "2025-05-20T15:00:00.000Z",
  "status": "scheduled",
  "type": "appointment",
  "notes": "Primeira consulta do paciente",
  "procedures": [
    {
      "id": 1,
      "name": "Avaliação Clínica",
      "price": 15000,
      "quantity": 1
    }
  ]
}
```

### Criar Consulta

```
POST /appointments
```

**Corpo da Requisição:**
```json
{
  "title": "Tratamento de Canal",
  "patientId": 2,
  "professionalId": 1,
  "roomId": 3,
  "startTime": "2025-06-15T10:00:00.000Z",
  "endTime": "2025-06-15T11:30:00.000Z",
  "status": "scheduled",
  "type": "appointment",
  "notes": "Tratamento no dente 26",
  "procedures": [
    {
      "procedureId": 5,
      "quantity": 1,
      "price": 50000
    }
  ]
}
```

**Resposta de Sucesso:**
```json
{
  "id": 2,
  "title": "Tratamento de Canal",
  "patientId": 2,
  "professionalId": 1,
  "roomId": 3,
  "startTime": "2025-06-15T10:00:00.000Z",
  "endTime": "2025-06-15T11:30:00.000Z",
  "status": "scheduled",
  "type": "appointment",
  "notes": "Tratamento no dente 26"
}
```

### Atualizar Consulta

```
PATCH /appointments/:id
```

**Corpo da Requisição:**
```json
{
  "status": "confirmed",
  "notes": "Paciente confirmou presença por telefone"
}
```

**Resposta de Sucesso:**
```json
{
  "id": 1,
  "title": "Consulta de Avaliação",
  "status": "confirmed",
  "notes": "Paciente confirmou presença por telefone"
}
```

## Procedimentos

### Listar Procedimentos

```
GET /procedures
```

**Resposta de Sucesso:**
```json
[
  {
    "id": 1,
    "name": "Avaliação Clínica",
    "duration": 30,
    "price": 15000,
    "description": "Consulta inicial de avaliação"
  },
  {
    "id": 2,
    "name": "Profilaxia",
    "duration": 45,
    "price": 20000,
    "description": "Limpeza profissional"
  }
]
```

### Obter Procedimento por ID

```
GET /procedures/:id
```

**Resposta de Sucesso:**
```json
{
  "id": 1,
  "name": "Avaliação Clínica",
  "duration": 30,
  "price": 15000,
  "description": "Consulta inicial de avaliação",
  "color": "#4299e1"
}
```

### Criar Procedimento

```
POST /procedures
```

**Corpo da Requisição:**
```json
{
  "name": "Restauração de Resina",
  "duration": 60,
  "price": 25000,
  "description": "Restauração de uma face com resina fotopolimerizável",
  "color": "#38a169"
}
```

**Resposta de Sucesso:**
```json
{
  "id": 3,
  "name": "Restauração de Resina",
  "duration": 60,
  "price": 25000,
  "description": "Restauração de uma face com resina fotopolimerizável",
  "color": "#38a169"
}
```

### Atualizar Procedimento

```
PATCH /procedures/:id
```

**Corpo da Requisição:**
```json
{
  "price": 27500,
  "description": "Restauração de uma face com resina fotopolimerizável de alta durabilidade"
}
```

**Resposta de Sucesso:**
```json
{
  "id": 3,
  "name": "Restauração de Resina",
  "price": 27500,
  "description": "Restauração de uma face com resina fotopolimerizável de alta durabilidade"
}
```

## Odontograma

### Listar Entradas do Odontograma de um Paciente

```
GET /odontogram/:patientId
```

**Resposta de Sucesso:**
```json
[
  {
    "id": 1,
    "patientId": 1,
    "toothId": "11",
    "faceId": "vestibular",
    "status": "caries",
    "color": "#e53e3e",
    "notes": "Cárie na vestibular do incisivo central superior direito",
    "createdBy": 1,
    "createdAt": "2025-05-01T14:30:00.000Z"
  },
  {
    "id": 2,
    "patientId": 1,
    "toothId": "36",
    "faceId": "occlusal",
    "status": "filled",
    "color": "#3182ce",
    "notes": "Restauração na oclusal do primeiro molar inferior esquerdo",
    "createdBy": 1,
    "createdAt": "2025-05-01T14:35:00.000Z"
  }
]
```

### Criar Entrada no Odontograma

```
POST /odontogram
```

**Corpo da Requisição:**
```json
{
  "patientId": 1,
  "toothId": "21",
  "faceId": "mesial",
  "status": "caries",
  "color": "#e53e3e",
  "notes": "Cárie na mesial do incisivo central superior esquerdo",
  "procedureId": 3,
  "createdBy": 1
}
```

**Resposta de Sucesso:**
```json
{
  "id": 3,
  "patientId": 1,
  "toothId": "21",
  "faceId": "mesial",
  "status": "caries",
  "color": "#e53e3e",
  "notes": "Cárie na mesial do incisivo central superior esquerdo",
  "procedureId": 3,
  "createdBy": 1,
  "createdAt": "2025-05-22T10:00:00.000Z"
}
```

## Prontuário

### Listar Registros do Prontuário de um Paciente

```
GET /records/:patientId
```

**Resposta de Sucesso:**
```json
[
  {
    "id": 1,
    "patientId": 1,
    "recordType": "anamnesis",
    "content": {
      "allergies": "Penicilina",
      "medicalConditions": "Hipertensão",
      "medications": "Losartana 50mg"
    },
    "createdBy": 1,
    "createdAt": "2025-05-01T14:00:00.000Z"
  },
  {
    "id": 2,
    "patientId": 1,
    "recordType": "evolution",
    "content": {
      "description": "Paciente compareceu para avaliação inicial. Apresenta cáries nos dentes 11 e 21.",
      "diagnosis": "Cárie dentária",
      "treatment": "Restauração de resina nos dentes 11 e 21"
    },
    "createdBy": 1,
    "createdAt": "2025-05-01T15:00:00.000Z"
  }
]
```

### Criar Registro no Prontuário

```
POST /records
```

**Corpo da Requisição:**
```json
{
  "patientId": 1,
  "recordType": "prescription",
  "content": {
    "medications": [
      {
        "name": "Ibuprofeno 600mg",
        "dosage": "1 comprimido a cada 8 horas por 3 dias"
      },
      {
        "name": "Amoxicilina 500mg",
        "dosage": "1 comprimido a cada 8 horas por 7 dias"
      }
    ],
    "recommendations": "Evitar alimentos duros por 24 horas. Fazer bochechos com água morna e sal."
  },
  "createdBy": 1
}
```

**Resposta de Sucesso:**
```json
{
  "id": 3,
  "patientId": 1,
  "recordType": "prescription",
  "content": {
    "medications": [
      {
        "name": "Ibuprofeno 600mg",
        "dosage": "1 comprimido a cada 8 horas por 3 dias"
      },
      {
        "name": "Amoxicilina 500mg",
        "dosage": "1 comprimido a cada 8 horas por 7 dias"
      }
    ],
    "recommendations": "Evitar alimentos duros por 24 horas. Fazer bochechos com água morna e sal."
  },
  "createdBy": 1,
  "createdAt": "2025-05-22T10:15:00.000Z"
}
```

## Financeiro

### Listar Transações

```
GET /transactions
```

**Parâmetros de Consulta (opcionais):**
- `startDate`: Data inicial (YYYY-MM-DD)
- `endDate`: Data final (YYYY-MM-DD)
- `type`: Tipo de transação (revenue, expense)

**Resposta de Sucesso:**
```json
[
  {
    "id": 1,
    "type": "revenue",
    "date": "2025-05-15",
    "category": "Consultas",
    "description": "Pagamento Paciente Um - Avaliação",
    "amount": 15000,
    "paymentMethod": "credit_card",
    "status": "paid",
    "createdAt": "2025-05-15T16:30:00.000Z"
  },
  {
    "id": 2,
    "type": "expense",
    "date": "2025-05-16",
    "category": "Materiais",
    "description": "Compra de materiais odontológicos",
    "amount": 50000,
    "paymentMethod": "bank_transfer",
    "status": "paid",
    "createdAt": "2025-05-16T10:00:00.000Z"
  }
]
```

### Criar Transação

```
POST /transactions
```

**Corpo da Requisição:**
```json
{
  "type": "revenue",
  "date": "2025-05-22",
  "category": "Procedimentos",
  "description": "Pagamento Paciente Dois - Tratamento de Canal",
  "amount": 50000,
  "paymentMethod": "pix",
  "status": "paid"
}
```

**Resposta de Sucesso:**
```json
{
  "id": 3,
  "type": "revenue",
  "date": "2025-05-22",
  "category": "Procedimentos",
  "description": "Pagamento Paciente Dois - Tratamento de Canal",
  "amount": 50000,
  "paymentMethod": "pix",
  "status": "paid",
  "createdAt": "2025-05-22T10:30:00.000Z"
}
```

## Estoque

### Listar Categorias de Estoque

```
GET /inventory/categories
```

**Resposta de Sucesso:**
```json
[
  {
    "id": 1,
    "name": "Materiais Restauradores",
    "description": "Resinas, cimentos e materiais para restauração",
    "color": "#3182ce"
  },
  {
    "id": 2,
    "name": "Instrumentais",
    "description": "Instrumentos cirúrgicos e de manipulação",
    "color": "#805ad5"
  }
]
```

### Listar Itens de Estoque

```
GET /inventory/items
```

**Parâmetros de Consulta (opcionais):**
- `categoryId`: ID da categoria
- `search`: Termo de busca
- `minStock`: Filtrar por estoque mínimo

**Resposta de Sucesso:**
```json
[
  {
    "id": 1,
    "name": "Resina Z350 A2",
    "description": "Resina fotopolimerizável para restaurações diretas",
    "categoryId": 1,
    "category": {
      "id": 1,
      "name": "Materiais Restauradores"
    },
    "sku": "RES-Z350-A2",
    "minimumStock": 2,
    "currentStock": 5,
    "price": 12000,
    "unitOfMeasure": "unidade",
    "expirationDate": "2026-05-22"
  }
]
```

### Criar Item de Estoque

```
POST /inventory/items
```

**Corpo da Requisição:**
```json
{
  "name": "Anestésico Lidocaína 2%",
  "description": "Anestésico local com vasoconstritor",
  "categoryId": 3,
  "sku": "ANES-LID-2",
  "minimumStock": 10,
  "currentStock": 20,
  "price": 5000,
  "unitOfMeasure": "caixa",
  "expirationDate": "2026-12-31",
  "location": "Armário 3, Prateleira 2"
}
```

**Resposta de Sucesso:**
```json
{
  "id": 2,
  "name": "Anestésico Lidocaína 2%",
  "description": "Anestésico local com vasoconstritor",
  "categoryId": 3,
  "sku": "ANES-LID-2",
  "minimumStock": 10,
  "currentStock": 20,
  "price": 5000,
  "unitOfMeasure": "caixa",
  "expirationDate": "2026-12-31",
  "location": "Armário 3, Prateleira 2",
  "active": true,
  "createdAt": "2025-05-22T11:00:00.000Z"
}
```

### Registrar Movimentação de Estoque

```
POST /inventory/transactions
```

**Corpo da Requisição:**
```json
{
  "itemId": 1,
  "userId": 1,
  "type": "outbound",
  "quantity": 1,
  "reason": "Uso em procedimento",
  "notes": "Utilizado na consulta do paciente ID 2",
  "appointmentId": 2
}
```

**Resposta de Sucesso:**
```json
{
  "id": 1,
  "itemId": 1,
  "userId": 1,
  "type": "outbound",
  "quantity": 1,
  "previousStock": 5,
  "newStock": 4,
  "reason": "Uso em procedimento",
  "notes": "Utilizado na consulta do paciente ID 2",
  "appointmentId": 2,
  "createdAt": "2025-05-22T11:15:00.000Z"
}
```

## Próteses

### Listar Próteses

```
GET /prosthesis
```

**Parâmetros de Consulta (opcionais):**
- `status`: Status da prótese (ordered, in_progress, ready, delivered)
- `patientId`: ID do paciente

**Resposta de Sucesso:**
```json
[
  {
    "id": 1,
    "type": "coroa",
    "description": "Coroa em zircônia no dente 16",
    "patientId": 1,
    "patient": {
      "fullName": "Paciente Um"
    },
    "professionalId": 1,
    "professional": {
      "fullName": "Dr. Nome"
    },
    "laboratory": "Lab Dental",
    "status": "in_progress",
    "sentDate": "2025-05-15",
    "expectedReturnDate": "2025-05-30",
    "returnedDate": null,
    "cost": 35000,
    "price": 75000,
    "notes": "Cor A2"
  }
]
```

### Criar Prótese

```
POST /prosthesis
```

**Corpo da Requisição:**
```json
{
  "type": "ponte",
  "description": "Ponte fixa 3 elementos (14, 15, 16)",
  "patientId": 2,
  "professionalId": 1,
  "laboratory": "Lab Dental",
  "status": "ordered",
  "sentDate": "2025-05-22",
  "expectedReturnDate": "2025-06-10",
  "cost": 60000,
  "price": 120000,
  "notes": "Cor A3.5, com caracterização"
}
```

**Resposta de Sucesso:**
```json
{
  "id": 2,
  "type": "ponte",
  "description": "Ponte fixa 3 elementos (14, 15, 16)",
  "patientId": 2,
  "professionalId": 1,
  "laboratory": "Lab Dental",
  "status": "ordered",
  "sentDate": "2025-05-22",
  "expectedReturnDate": "2025-06-10",
  "returnedDate": null,
  "cost": 60000,
  "price": 120000,
  "notes": "Cor A3.5, com caracterização"
}
```

### Atualizar Status da Prótese

```
PATCH /prosthesis/:id
```

**Corpo da Requisição:**
```json
{
  "status": "ready",
  "returnedDate": "2025-06-05"
}
```

**Resposta de Sucesso:**
```json
{
  "id": 1,
  "status": "ready",
  "returnedDate": "2025-06-05"
}
```

## Automações

### Listar Automações

```
GET /automations
```

**Resposta de Sucesso:**
```json
[
  {
    "id": 1,
    "name": "Confirmação de Consulta",
    "triggerType": "time_before",
    "timeBeforeValue": 24,
    "timeBeforeUnit": "hours",
    "whatsappEnabled": true,
    "whatsappTemplateId": "confirmation_template",
    "emailEnabled": true,
    "emailSubject": "Confirmação de Consulta",
    "active": true
  }
]
```

### Criar Automação

```
POST /automations
```

**Corpo da Requisição:**
```json
{
  "name": "Lembrete Pós-Consulta",
  "triggerType": "after_appointment",
  "timeBeforeValue": 2,
  "timeBeforeUnit": "days",
  "whatsappEnabled": true,
  "whatsappTemplateId": "followup_template",
  "whatsappTemplateVariables": "Nome do paciente, Data da consulta, Recomendações",
  "emailEnabled": true,
  "emailSender": "clinica@exemplo.com",
  "emailSubject": "Recomendações Pós-Consulta",
  "emailBody": "Olá {{paciente}}, esperamos que esteja bem após sua consulta do dia {{data}}. Lembre-se das recomendações: {{recomendacoes}}",
  "active": true
}
```

**Resposta de Sucesso:**
```json
{
  "id": 2,
  "name": "Lembrete Pós-Consulta",
  "triggerType": "after_appointment",
  "timeBeforeValue": 2,
  "timeBeforeUnit": "days",
  "whatsappEnabled": true,
  "whatsappTemplateId": "followup_template",
  "whatsappTemplateVariables": "Nome do paciente, Data da consulta, Recomendações",
  "emailEnabled": true,
  "emailSender": "clinica@exemplo.com",
  "emailSubject": "Recomendações Pós-Consulta",
  "emailBody": "Olá {{paciente}}, esperamos que esteja bem após sua consulta do dia {{data}}. Lembre-se das recomendações: {{recomendacoes}}",
  "active": true
}
```

### Atualizar Automação

```
PATCH /automations/:id
```

**Corpo da Requisição:**
```json
{
  "active": false
}
```

**Resposta de Sucesso:**
```json
{
  "id": 1,
  "name": "Confirmação de Consulta",
  "active": false
}
```

### Excluir Automação

```
DELETE /automations/:id
```

**Resposta de Sucesso:**
```
Status 204 No Content
```

## Códigos de Erro

| Código | Descrição                                 |
|--------|--------------------------------------------|
| 400    | Requisição inválida ou malformada          |
| 401    | Não autenticado                            |
| 403    | Permissão negada                           |
| 404    | Recurso não encontrado                     |
| 409    | Conflito (recurso já existe)               |
| 422    | Entidade não processável (validação falhou)|
| 500    | Erro interno do servidor                   |