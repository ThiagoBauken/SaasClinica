# Prompt de Auditoria UX/Funcional Completa — Dental Clinic SaaS

## Como usar
1. Abra uma **nova sessao** do Claude Code no diretorio do projeto
2. Copie e cole o bloco abaixo (entre as linhas de ```)
3. Opcional: rode com `/fast` para mais velocidade, ou peca para dividir o relatorio por categoria se o output ficar muito grande

> **IMPORTANTE**: Este prompt e COMPLEMENTAR ao `PROMPT_AUDITORIA.md` (tecnico). Nao repete achados de seguranca, arquitetura de codigo, ou performance de banco. Foco EXCLUSIVO em experiencia do usuario, funcionalidade e completude.

---

```
Voce e um UX Auditor senior e QA Lead fazendo uma auditoria funcional e de experiencia do usuario completa deste projeto SaaS de clinica odontologica. O stack frontend e:

- Frontend: React + Vite + TypeScript + TailwindCSS + shadcn/ui
- Roteamento: Wouter (client-side)
- Estado: TanStack Query (React Query) + Context API
- Formularios: React Hook Form + Zod
- Layout: DashboardLayout com Sidebar + Sheet mobile
- Idioma: Portugues (pt-BR), sem framework de i18n
- Auth: Local + Google OAuth, 2FA, roles (superadmin, admin, dentist, staff)
- Multi-tenant: isolamento por companyId

O app tem 63+ rotas (44+ paginas internas + publicas), 79 modulos de API, e 109 tabelas no banco. Sua missao e navegar CADA pagina, testar CADA fluxo de usuario e produzir um RELATORIO DE AUDITORIA UX/FUNCIONAL estruturado. Seja implacavel, especifico e acionavel — cite sempre arquivo:linha.

IMPORTANTE: Esta auditoria e COMPLEMENTAR a auditoria tecnica ja realizada (PROMPT_AUDITORIA.md / PLANO_IMPLEMENTACAO.md). NAO repita achados de seguranca, arquitetura de codigo, ou performance de banco. Foque EXCLUSIVAMENTE na experiencia do usuario, funcionalidade e completude.

## Inventario de Paginas (verificar TODAS)

### Paginas Publicas (sem autenticacao)
1. `/landing` — Landing page (landing-page.tsx)
2. `/auth` — Login/Cadastro (auth-page.tsx)
3. `/confirmar/:token` — Confirmacao de agendamento (public-confirmation-page.tsx)
4. `/orcamento/:token` — Visualizacao de orcamento (public-quote-page.tsx)
5. `/agendar/:companyId` — Agendamento online (public-booking-page.tsx)
6. `/portal/:token` — Portal do paciente (patient-portal-page.tsx)
7. `/checkout-success` — Sucesso do checkout (checkout-success-page.tsx)
8. `/checkout-canceled` — Checkout cancelado (checkout-canceled-page.tsx)
9. `/termos-de-uso` — Termos de uso (termos-de-uso.tsx)
10. `/politica-de-privacidade` — Politica de privacidade (politica-de-privacidade.tsx)
11. `/lgpd` — LGPD (lgpd-page.tsx)

### Paginas Internas (autenticadas — ProtectedRoute)
12. `/dashboard` — Dashboard principal (dashboard-page.tsx)
13. `/agenda` — Agenda/Calendario (agenda-page.tsx, 2008 linhas)
14. `/agenda/novo` — Novo agendamento (novo-agendamento.tsx)
15. `/agenda/:id/editar` — Editar agendamento (editar-agendamento.tsx)
16. `/patients` — Lista de pacientes (patients-page.tsx)
17. `/patients/:id/record` — Prontuario do paciente (patient-record-page.tsx)
18. `/pacientes/digitalizar` — Digitalizacao de prontuarios (patient-digitization-page.tsx)
19. `/pacientes/importar` — Importacao de pacientes (patient-import-page.tsx)
20. `/financial` — Financeiro (financial-page.tsx)
21. `/pagamentos-paciente` — Pagamentos do paciente (patient-payments-page.tsx)
22. `/atendimento` — Chat/WhatsApp inbox (chat-inbox-page.tsx)
23. `/crm` — CRM Kanban (crm-page.tsx)
24. `/automation` — Automacoes (automation-page.tsx)
25. `/prosthesis` — Controle de proteses (prosthesis-control-page.tsx)
26. `/inventory` — Estoque (inventory-page.tsx, 2419 linhas)
27. `/odontogram` — Odontograma (odontogram-page.tsx)
28. `/pacotes-esteticos` — Pacotes esteticos (pacotes-esteticos-page.tsx)
29. `/teleconsulta` — Teleconsulta (teleconsulta-page.tsx)
30. `/chat-interno` — Chat interno da equipe (office-chat-page.tsx)
31. `/laboratorio` — Gestao de laboratorio (laboratory-management.tsx)
32. `/relatorios` — Relatorios (relatorios-page.tsx)
33. `/analytics` — Analytics avancado (analytics-page.tsx)
34. `/cadastros` — Cadastros gerais (cadastros-page.tsx)
35. `/perfil` — Perfil do usuario (perfil-page.tsx)
36. `/ajuda` — Central de ajuda (ajuda-page.tsx, 1441 linhas)
37. `/billing` — Assinatura/Planos (billing-page.tsx)
38. `/coupons-admin` — Admin de cupons (coupons-admin-page.tsx)

### Configuracoes (sub-paginas)
39. `/configuracoes` — Hub de configuracoes (configuracoes-page.tsx)
40. `/configuracoes/clinica` — Dados da clinica (configuracoes-clinica.tsx, 2145 linhas)
41. `/configuracoes/integracoes` — Integracoes (configuracoes-integracoes.tsx)
42. `/configuracoes/horarios` — Horarios de funcionamento (configuracoes-horarios.tsx)
43. `/configuracoes/chat` — Config. de chat/WhatsApp (configuracoes-chat.tsx, 1211 linhas)
44. `/configuracoes/usuarios` — Gestao de usuarios (configuracoes-usuarios.tsx)
45. `/configuracoes/procedimentos` — Procedimentos (configuracoes-procedimentos.tsx)
46. `/configuracoes/salas` — Salas/Consultorios (configuracoes-salas.tsx)
47. `/configuracoes/notificacoes` — Notificacoes (configuracoes-notificacoes.tsx)
48. `/configuracoes/financeiro` — Config. financeiro (configuracoes-financeiro.tsx)
49. `/configuracoes/impressao` — Config. de impressao (configuracoes-impressao.tsx)
50. `/configuracoes/aparencia` — Aparencia/Tema (configuracoes-aparencia.tsx)
51. `/configuracoes/backup` — Backup (configuracoes-backup.tsx)
52. `/configuracoes/ia` — Assistente IA (configuracoes-ia.tsx)
53. `/settings/schedule` — Config. de agenda (settings/schedule-page.tsx)

### Administracao
54. `/saas-admin` — Admin SaaS (SaasAdminPage.tsx)
55. `/superadmin` — SuperAdmin (SuperAdminPage.tsx, 1421 linhas)
56. `/company-admin` — Admin da clinica (CompanyAdminPage.tsx)
57. `/clinic-modules` — Modulos da clinica (ClinicModulesPage.tsx)
58. `/permissions` — Permissoes (permissions-page.tsx)
59. `/integracoes` — Config. integracoes (integrations-config-page.tsx)

### PAGINAS EXISTENTES MAS SEM ROTA (verificar se estao abandonadas ou pendentes)
60. `public-anamnesis-page.tsx` — Anamnese publica (sem rota em App.tsx)
61. `schedule-blocks-page.tsx` — Bloqueios de agenda (sem rota em App.tsx)
62. `waitlist-page.tsx` — Lista de espera (sem rota em App.tsx)
63. `setup-page.tsx` — Setup/onboarding (sem rota em App.tsx)
64. `accounts-payable-page.tsx` — Contas a pagar (sem rota em App.tsx)
65. `accounts-receivable-page.tsx` — Contas a receber (sem rota em App.tsx)
66. `anamnesis-builder-page.tsx` — Construtor de anamnese (sem rota em App.tsx)

---

## Areas Obrigatorias de Inspecao

### 1. Fluxos de Usuario Completos (End-to-End)

Teste cada fluxo do inicio ao fim. Para cada um, verifique: o fluxo completa sem erro? Ha dead ends? A navegacao de volta funciona? O estado se mantem?

**Fluxos criticos a testar:**
- **Primeiro acesso**: Landing -> Cadastro -> Setup inicial -> Dashboard (existe onboarding guiado?)
- **Login completo**: Login local -> 2FA (se ativado) -> Dashboard; Login Google OAuth -> Dashboard
- **Ciclo do paciente**: Criar paciente -> Preencher dados completos -> Anamnese -> Odontograma -> Plano de tratamento -> Documentos
- **Ciclo do agendamento**: Dashboard -> Novo agendamento -> Selecionar paciente -> Selecionar dentista -> Selecionar horario -> Confirmar -> Visualizar na agenda -> Editar -> Cancelar
- **Confirmacao externa**: Agendamento criado -> Paciente recebe link -> `/confirmar/:token` -> Confirma/Recusa -> Reflete na agenda
- **Agendamento online**: Paciente acessa `/agendar/:companyId` -> Escolhe servico -> Escolhe horario -> Confirma -> Aparece na agenda da clinica
- **Portal do paciente**: Paciente acessa `/portal/:token` -> Ve agendamentos -> Ve orcamentos -> Ve documentos
- **Ciclo financeiro**: Atendimento -> Gerar cobranca -> Pagamento (dinheiro/cartao/pix) -> Recibo -> Relatorio financeiro
- **Orcamento**: Criar orcamento para paciente -> Enviar link -> Paciente visualiza em `/orcamento/:token` -> Aprova/Recusa -> Reflete no sistema
- **CRM/WhatsApp**: Mensagem chega -> Aparece no inbox -> Responder -> Criar oportunidade CRM -> Mover no Kanban -> Converter em paciente/agendamento
- **Protese**: Criar pedido -> Vincular a paciente -> Rastrear etapas -> Marcar entrega
- **Estoque**: Cadastrar produto -> Entrada de estoque -> Saida/uso em procedimento -> Alerta de estoque baixo
- **Teleconsulta**: Agendar teleconsulta -> Iniciar chamada -> Ambos os lados conectam -> Encerrar -> Registrar no prontuario
- **Billing/Assinatura**: Ver plano atual -> Upgrade -> Checkout Stripe/MercadoPago -> Success -> Features desbloqueadas
- **Relatorios**: Acessar relatorios -> Filtrar por periodo -> Exportar PDF/Excel
- **Configuracoes**: Alterar dados da clinica -> Salvar -> Verificar que reflete em todo o sistema

### 2. Qualidade de UX

Para CADA pagina do inventario acima, avalie:

- **Hierarquia de informacao**: O mais importante esta visualmente destacado? Titulos claros? Breadcrumbs onde necessario?
- **Navegacao**: Consegue voltar facilmente? Links da sidebar destacam a pagina atual corretamente? Sub-navegacao dentro de configuracoes e clara?
- **Formularios**: Labels claros? Placeholders uteis? Validacao inline (nao apenas no submit)? Campos obrigatorios marcados? Mascaras de input (CPF, telefone, CEP)? Feedback de erro junto ao campo?
- **Feedback visual**: Loading states em TODA operacao assincrona? Spinners/skeletons? Mensagens de sucesso (toast) ao salvar? Mensagens de erro claras e em portugues?
- **Consistencia**: Botoes de acao no mesmo lugar em todas as paginas? Mesmo padrao de tabela/lista? Mesmo padrao de modal/dialog? Icones consistentes?
- **Microinteracoes**: Confirmacao antes de deletar? Undo disponivel? Hover states? Transicoes suaves?
- **Densidade de informacao**: Tabelas com muitas colunas estao legiveis? Tem paginacao? Tem busca/filtro?
- **Empty states**: O que aparece quando nao ha dados? Tem mensagem util? Tem CTA para criar o primeiro item?
- **Cores e contraste**: Texto legivel? Status badges com cores significativas? Dark mode funciona?
- **Scroll**: Paginas muito longas tem scroll-to-top? Headers fixos onde necessario? Tabelas com scroll horizontal em mobile?

### 3. Responsividade (Mobile/Tablet)

- **Sidebar**: Sheet mobile abre e fecha corretamente? Overlay escurece fundo? Fecha ao clicar fora?
- **Tabelas**: Comportamento em telas < 768px? Scroll horizontal? Cards em vez de tabelas?
- **Formularios**: Inputs nao ultrapassam tela? Select/Dropdown funciona em touch? DatePicker funciona em mobile?
- **Modais/Dialogs**: Nao ficam cortados em mobile? Scroll interno funciona?
- **Touch targets**: Botoes >= 44px? Links nao ficam muito proximos?
- **Agenda**: Calendario funciona em mobile? Arrastar agendamento em touch?
- **CRM Kanban**: Kanban e usavel em mobile? Drag-and-drop funciona em touch?
- **Texto**: Nao ha overflow/truncamento problematico?

### 4. Acessibilidade (a11y)

- **Semantica HTML**: Uso correto de `<main>`, `<nav>`, `<section>`, `<article>`, `<header>`, `<footer>`?
- **ARIA**: Labels em todos os inputs? `aria-label` em botoes de icone? `aria-live` para atualizacoes dinamicas? `role` em elementos interativos custom?
- **Teclado**: TODAS as acoes acessiveis via teclado? Tab order logico? Focus visible? Focus trap em modais? Esc fecha modais?
- **Contraste**: Texto sobre fundos coloridos tem ratio >= 4.5:1? Texto pequeno >= 3:1?
- **Imagens**: Alt text em imagens significativas? Icones decorativos com `aria-hidden`?
- **Screen reader**: Anuncios de loading? Erros de formulario anunciados? Mudancas de pagina anunciadas?
- **Zoom**: Funciona com zoom 200% sem quebrar layout?

### 5. Completude de Features

Para cada pagina, verificar se todos os CRUDs estao completos:

- **Criar**: Formulario funciona? Todos os campos necessarios estao presentes? Validacao funciona?
- **Ler/Listar**: Lista carrega? Paginacao funciona? Busca/filtro funciona? Ordenacao funciona?
- **Editar**: Botao de editar leva ao formulario preenchido? Campos sao editaveis? Salvar funciona?
- **Deletar**: Botao de excluir existe? Pede confirmacao? Funciona? Soft delete onde necessario?
- **Botoes fantasma**: Existe algum botao ou link que NAO faz nada ao clicar? Procure `onClick` vazio, `href="#"`, `console.log` como handler, `// TODO` em handlers
- **Placeholders**: Paginas com texto "Em construcao", "Coming soon", "Lorem ipsum", dados mockados?
- **Abas/Tabs**: Se a pagina tem tabs, TODAS as tabs tem conteudo real?
- **Exports**: Botoes de "Exportar PDF", "Exportar Excel" realmente funcionam?
- **Impressao**: Botoes de imprimir funcionam? Layout de impressao esta configurado?

### 6. Performance Percebida pelo Usuario

- **Carregamento inicial**: Quanto tempo ate o app ficar interativo? Ha flash de conteudo sem estilo (FOUC)?
- **Navegacao entre paginas**: Instantanea ou tem loading perceptivel?
- **Operacoes de dados**: Criar/editar/deletar da feedback imediato? Optimistic updates onde faz sentido?
- **Layout shift (CLS)**: Elementos "pulam" ao carregar dados? Imagens sem dimensoes definidas? Skeletons com tamanho correto?
- **Flicker**: Troca de tema causa flash? Redirecionamentos causam flash de pagina errada?
- **Listas grandes**: Pacientes/agendamentos com muitos registros — tem virtualizacao ou paginacao adequada?
- **Busca**: Debounce no input de busca? Nao faz request a cada keystroke?
- **Imagens**: Lazy loading? Formatos otimizados? Placeholders durante carregamento?

### 7. Onboarding e Primeira Experiencia

- **Primeiro login**: O que o novo usuario ve? Dashboard vazio e util ou confuso?
- **Setup wizard**: `setup-page.tsx` existe mas NAO tem rota — esta implementado? Deveria ser o primeiro passo apos cadastro?
- **Guided tour**: Existe algum tour guiado? (Procure por `data-tour`, libs como react-joyride/shepherd)
- **Empty states**: Dashboard sem dados mostra o que? Agenda vazia? Pacientes vazio? Cada modulo sem dados?
- **Documentacao inline**: Tooltips explicativos? Links para ajuda? Pagina /ajuda e completa?
- **Configuracao minima**: O que a clinica PRECISA configurar antes de usar? Horarios? Procedimentos? Salas? O sistema guia para isso?

### 8. Tratamento de Erros e Recuperacao

- **Erros de rede**: Desconectar internet -> tentar salvar -> mensagem clara? Retry automatico?
- **Erros de validacao**: Mensagens em portugues? Especificas por campo? Nao somem rapido demais?
- **Erro 404**: Acessar rota inexistente -> tem pagina 404? Ou tela branca?
- **Erro 403**: Usuario staff acessar rota de admin -> mensagem clara? (UnauthorizedPage.tsx existe — esta sendo usada?)
- **Erro 500**: Backend retorna erro -> frontend mostra mensagem util ou mensagem generica?
- **Sessao expirada**: Token expira -> o que acontece? Redireciona para login? Perde dados nao salvos?
- **Formularios longos**: Perda de dados se navegar acidentalmente? Tem "unsaved changes" warning?
- **Upload falha**: Upload de imagem/documento falha -> mensagem clara? Pode tentar de novo?
- **ErrorBoundary**: Apenas no root (App.tsx) ou tem por secao? Crash de um widget derruba a pagina toda?
- **Toasts**: Sao descritivos? Ficam tempo suficiente? Tem acao de undo onde relevante?

### 9. Consistencia de Dados Entre Modulos

- **Paciente editado**: Alterar nome/telefone do paciente -> reflete na agenda? No CRM? No chat?
- **Agendamento cancelado**: Cancelar agendamento -> reflete no dashboard? No financeiro?
- **Procedimento editado**: Alterar preco de procedimento -> afeta orcamentos existentes? Novos?
- **Dentista inativado**: Desativar profissional -> agendamentos futuros? Aparece no dropdown de novo agendamento?
- **Estoque zerado**: Produto com estoque zero -> alerta no dashboard? Bloqueia uso em procedimento?
- **Plano alterado**: Upgrade/downgrade de plano -> features mudam imediatamente? Limites atualizados?
- **Notificacoes**: Acoes em um modulo geram notificacoes? Badge no sino atualiza em real-time?
- **Tempo real**: WebSocket — mudancas de outro usuario refletem sem refresh? (agenda, chat, notificacoes)

### 10. Features Ausentes para uma Clinica Odontologica Completa

Avalie se existem as seguintes features essenciais e recomendadas. Se existem, testar. Se nao, recomendar implementacao:

**Essenciais (P0):**
- [ ] Prontuario digital completo (evolucoes clinicas, fotos, exames, prescricoes, atestados)
- [ ] Odontograma interativo com registro de procedimentos por dente/face
- [ ] Plano de tratamento com orcamento vinculado
- [ ] Contas a pagar (accounts-payable-page.tsx existe sem rota!)
- [ ] Contas a receber (accounts-receivable-page.tsx existe sem rota!)
- [ ] Bloqueios de horario na agenda (schedule-blocks-page.tsx existe sem rota!)
- [ ] Lista de espera (waitlist-page.tsx existe sem rota!)
- [ ] Anamnese personalizavel (anamnesis-builder-page.tsx existe sem rota!)
- [ ] Anamnese publica para paciente preencher antes da consulta (public-anamnesis-page.tsx existe sem rota!)
- [ ] Receituario digital com assinatura
- [ ] Atestados e declaracoes
- [ ] Controle de convenios/seguros
- [ ] Comissao de dentistas (calculo automatico)

**Importantes (P1):**
- [ ] Recall automatico (lembrete de retorno periodico)
- [ ] Pesquisa de satisfacao pos-atendimento
- [ ] Controle de indicacoes (quem indicou quem)
- [ ] Relatorio de produtividade por profissional
- [ ] Fluxo de caixa (entradas vs saidas por periodo)
- [ ] DRE simplificado (demonstrativo de resultados)
- [ ] Integracao com certificado digital (assinatura de documentos)
- [ ] Backup de fotos clinicas com organizacao por paciente/data
- [ ] Multi-unidade (clinica com filiais)
- [ ] Ficha de ortodontia (manutencao mensal, troca de arcos)

**Diferenciais (P2):**
- [ ] IA para triagem na anamnese
- [ ] IA para sugestao de plano de tratamento baseado no odontograma
- [ ] Integracao com radiografia digital (DICOM viewer)
- [ ] App mobile nativo ou PWA instalavel
- [ ] Integracao com softwares de imagem (camera intraoral)
- [ ] Relatorios TISS/XML para convenios

### 11. Paginas Sem Rota — Investigacao Detalhada

Para cada pagina do item "PAGINAS EXISTENTES MAS SEM ROTA":
1. Abrir o arquivo e ler completamente
2. Determinar: esta completa? Parcialmente implementada? Apenas scaffold?
3. Verificar se o backend correspondente existe (route file em server/routes/)
4. Recomendar: rotear e lancar? Completar antes de rotear? Remover se abandonada?

Arquivos e backends relacionados a verificar:
- `client/src/pages/public-anamnesis-page.tsx` <-> `server/routes/public-anamnesis.routes.ts`
- `client/src/pages/schedule-blocks-page.tsx` <-> `server/routes/schedule-blocks.routes.ts`
- `client/src/pages/waitlist-page.tsx` <-> `server/routes/waitlist.routes.ts`
- `client/src/pages/setup-page.tsx` <-> (verificar se existe backend de onboarding)
- `client/src/pages/accounts-payable-page.tsx` <-> `server/routes/accounts-payable.routes.ts`
- `client/src/pages/accounts-receivable-page.tsx` <-> `server/routes/accounts-receivable.routes.ts`
- `client/src/pages/anamnesis-builder-page.tsx` <-> (verificar backend)

### 12. Consistencia de Idioma e Textos

- **Portugues completo**: Procure por textos em ingles no UI visivel ao usuario (botoes, labels, mensagens, placeholders, toasts). Deveria ser 100% pt-BR.
- **Ortografia**: Erros de digitacao em labels, mensagens, titulos?
- **Tom de voz**: Consistente? (formal vs informal, "voce" vs "tu", mensagens de erro tecnicas vs amigaveis)
- **Pluralizacao**: "1 pacientes" vs "1 paciente"? "Nenhum resultado encontrado" vs tela vazia?
- **Datas**: Formato BR (dd/mm/yyyy)? Dia da semana em portugues? Horario em 24h?
- **Moeda**: R$ com formato brasileiro (R$ 1.234,56)?
- **Termos tecnicos odontologicos**: Estao corretos? (periodontograma, profilaxia, endodontia, etc.)

---

## Navegacao da Sidebar — Verificacao Cruzada

O Sidebar (`client/src/components/dashboard/Sidebar.tsx`) mostra os seguintes itens. Para cada um, verificar:
- O link leva a pagina correta?
- A pagina atual e destacada corretamente (bg-primary/10)?
- O icone e apropriado para a funcao?
- A ordem faz sentido para o fluxo de trabalho diario de uma clinica?

**Menu principal:** Dashboard, Agenda, Atendimento (badge de unread), Pacientes, Financeiro, CRM, Automacoes, Estetica, Proteses, Estoque, Assistente IA, Teleconsulta, Chat Interno, Pagamentos, Laboratorio, Relatorios, Cadastros, Configuracoes, Assinatura, Ajuda

**Admin (role admin+):** Admin Clinica, Permissoes, Integracoes, Analytics
**SuperAdmin (role superadmin):** SuperAdmin, Admin SaaS

**Itens com rota mas SEM entrada na sidebar** (verificar se deveriam estar no menu):
- `/pacotes-esteticos` — esta no menu como "Estetica" (sem acento — corrigir?)
- `/pacientes/digitalizar` — acessivel apenas por dentro de pacientes?
- `/pacientes/importar` — acessivel apenas por dentro de pacientes?
- `/odontogram` — nao esta na sidebar! Como o usuario acessa?
- `/coupons-admin` — nao esta na sidebar (proposital? so para superadmin?)
- `/perfil` — nao esta na sidebar (acessivel pelo avatar/header?)

---

## Formato do Relatorio

Para cada achado, produza:

```
[SEVERIDADE] Titulo curto
Arquivo: caminho/arquivo.tsx:linha
Categoria: <uma das 12 areas acima>
Descricao: o que esta errado ou faltando, do ponto de vista do USUARIO
Impacto: como isso afeta a experiencia ou a operacao da clinica
Correcao sugerida: passos concretos (com referencia a componentes/paginas existentes)
Esforco: S / M / L
```

Severidades:
- **CRITICAL**: Fluxo quebrado que impede uso do sistema (dead end, tela branca, dados perdidos)
- **HIGH**: Feature incompleta que prejudica operacao diaria (botao nao funciona, CRUD faltando, pagina sem rota)
- **MEDIUM**: Problema de UX que dificulta uso mas tem workaround (responsividade, empty states, feedback faltando)
- **LOW**: Polimento (ortografia, consistencia visual, microinteracao)

---

## Entregaveis Finais

Ao final, entregue:

1. **Sumario Executivo** — Top 15 problemas por impacto no usuario final
2. **Mapa de Calor de Completude** — Tabela mostrando cada modulo e seu % de completude funcional:

| Modulo | Pagina | CRUD | Fluxos | UX | Mobile | a11y | Score |
|--------|--------|------|--------|----|--------|------|-------|

3. **Paginas Sem Rota** — Diagnostico de cada uma com recomendacao (rotear/completar/remover)
4. **Dead Ends e Fluxos Quebrados** — Lista de pontos onde o usuario fica "preso"
5. **Quick Wins UX** — Ate 20 melhorias de baixo esforco e alto impacto visual/funcional
6. **Features Faltantes Priorizadas** — Ordenadas por impacto para operacao real de clinica odontologica
7. **Roadmap de UX** — Ordem recomendada de ataque em sprints de 1 semana

---

## Regras de Execucao

- NAO altere codigo — apenas leia e relate
- Use Grep e Glob agressivamente para encontrar padroes
- Leia o conteudo real dos componentes grandes (>500 linhas) — nao assuma que funcionam pelo nome
- Para cada modulo: leia a pagina principal, identifique os componentes que ela usa, verifique o backend correspondente
- Se encontrar padrao repetido (ex: "nenhuma pagina tem empty state"), cite 2-3 exemplos e diga "e mais N similares"
- Verifique `git log` para nao citar como "faltante" algo que foi implementado recentemente
- Ignore node_modules, dist, build, coverage
- Comece listando os modulos/arquivos que vai inspecionar antes de mergulhar
- Priorize os fluxos mais usados no dia-a-dia de uma clinica: agenda -> pacientes -> financeiro -> atendimento

## Buscas Recomendadas para Iniciar

```bash
# Paginas gigantes que provavelmente tem problemas
find client/src/pages -name "*.tsx" | xargs wc -l | sort -rn | head -20

# Botoes sem acao
grep -rn 'onClick={() => {}}' client/src/
grep -rn 'onClick={() => console.log' client/src/
grep -rn "href=\"#\"" client/src/

# Placeholders e TODOs no frontend
grep -rn 'TODO\|FIXME\|HACK\|XXX' client/src/
grep -rn 'placeholder\|lorem\|coming soon\|em construcao' client/src/ -i

# Empty states ausentes
grep -rn 'Nenhum.*encontrado\|Sem.*cadastrado\|empty.state\|EmptyState' client/src/

# Loading states
grep -rn 'isLoading\|isPending\|isFetching\|Skeleton\|Spinner' client/src/pages/

# Textos em ingles no UI
grep -rn '"[A-Z][a-z].*"' client/src/pages/ | grep -v import | grep -v className | head -50

# Acessibilidade
grep -rn 'aria-label\|aria-describedby\|aria-live\|role=' client/src/ | wc -l

# data-tour (onboarding guiado)
grep -rn 'data-tour' client/src/

# ErrorBoundary usage
grep -rn 'ErrorBoundary' client/src/

# Paginas sem rota — verificar se sao importadas em algum lugar
grep -rn 'public-anamnesis\|schedule-blocks\|waitlist\|setup-page\|accounts-payable\|accounts-receivable\|anamnesis-builder' client/src/
```
```
