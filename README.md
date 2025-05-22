# DentCare - Sistema de Gerenciamento Odontológico

![Licença](https://img.shields.io/badge/license-MIT-blue.svg)
![Versão](https://img.shields.io/badge/version-1.0.0-brightgreen.svg)

DentCare é uma aplicação web completa para gerenciamento de clínicas odontológicas, desenvolvida para otimizar processos administrativos e melhorar a experiência de atendimento ao paciente.

## 📋 Características

- **Agendamento Avançado**: Visualização diária, semanal e mensal com gerenciamento de conflitos
- **Prontuário Digital**: Registro completo do histórico do paciente com documentação clínica
- **Odontograma Interativo**: Visualização e registro visual de procedimentos odontológicos
- **Gestão Financeira**: Controle de receitas, despesas e faturamento
- **Automações**: Integração com n8n para automação de lembretes e comunicações
- **Controle de Estoque**: Gerenciamento de materiais e controle de validade
- **Laboratorial**: Acompanhamento de próteses e trabalhos laboratoriais
- **Tema Escuro/Claro**: Interface adaptável para preferência do usuário
- **Autenticação**: Sistema seguro com login tradicional e Google OAuth

## 🚀 Tecnologias

- **Frontend**: React, TypeScript, TailwindCSS, ShadcnUI, React Query
- **Backend**: Node.js, Express.js, PostgreSQL, Drizzle ORM
- **Autenticação**: Passport.js, Google OAuth
- **Deploy**: Replit

## 📦 Instalação

Consulte o [INSTALLATION.md](./INSTALLATION.md) para instruções detalhadas sobre como instalar e configurar o projeto.

## 🔗 API

Todas as rotas e endpoints da API estão documentadas em [API.md](./API.md).

## 📱 Screenshots

### Dashboard
![Dashboard](https://via.placeholder.com/800x400.png?text=Dashboard)

### Agenda
![Agenda](https://via.placeholder.com/800x400.png?text=Agenda)

### Odontograma
![Odontograma](https://via.placeholder.com/800x400.png?text=Odontograma)

## 🧩 Estrutura do Projeto

```
.
├── client/                  # Código frontend React
│   ├── src/
│   │   ├── components/      # Componentes reutilizáveis
│   │   ├── hooks/           # React hooks customizados
│   │   ├── lib/             # Utilidades e helpers
│   │   ├── pages/           # Páginas da aplicação
│   │   └── layouts/         # Layouts compartilhados
│   └── public/              # Assets estáticos
├── server/                  # Código backend Node.js/Express
│   ├── auth.ts              # Configuração de autenticação
│   ├── routes.ts            # Definição de rotas da API
│   ├── storage.ts           # Interface de armazenamento
│   └── db.ts                # Configuração do banco de dados
├── shared/                  # Código compartilhado
│   └── schema.ts            # Esquema do banco de dados
├── migrations/              # Migrações do banco de dados
└── README.md                # Este arquivo
```

## 🔐 Variáveis de Ambiente

As seguintes variáveis de ambiente são necessárias:

```
DATABASE_URL=           # URL de conexão PostgreSQL
SESSION_SECRET=         # Segredo para sessões
GOOGLE_CLIENT_ID=       # ID do cliente OAuth Google
GOOGLE_CLIENT_SECRET=   # Segredo do cliente OAuth Google
GOOGLE_CALLBACK_URL=    # URL de callback OAuth
VITE_APP_NAME=          # Nome da aplicação
```

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo LICENSE para detalhes.

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor, leia as diretrizes de contribuição antes de enviar um pull request.

## 📞 Suporte

Para suporte, envie um email para [suporte@dentcare.com](mailto:suporte@dentcare.com) ou abra um issue no repositório.