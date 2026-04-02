import { useState, useRef, useEffect } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  Building2,
  Users,
  Calendar,
  DollarSign,
  MessageCircle,
  Settings,
  Target,
  Bot,
  Package,
  Scissors,
  Activity,
  BarChart3,
  Video,
  MessageSquare,
  CreditCard,
  FlaskConical,
  FileText,
  Shield,
  Plug,
  Rocket,
  BookOpen,
  Lightbulb,
  Clock,
  ChevronRight,
  Star,
  Zap,
  Heart,
  HelpCircle,
  Send,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/core/AuthProvider";
import { Link } from "wouter";

// Checklist de configuracao inicial
interface SetupStep {
  id: string;
  title: string;
  description: string;
  link: string;
  linkLabel: string;
  icon: React.ReactNode;
  priority: "essencial" | "recomendado" | "opcional";
}

const setupSteps: SetupStep[] = [
  {
    id: "clinic-info",
    title: "Dados da Clinica",
    description: "Configure o nome, endereco, telefone, CNPJ e logo da sua clinica. Essas informacoes aparecerao em recibos, lembretes e no site.",
    link: "/configuracoes/clinica",
    linkLabel: "Configurar Clinica",
    icon: <Building2 className="h-5 w-5" />,
    priority: "essencial",
  },
  {
    id: "working-hours",
    title: "Horarios de Funcionamento",
    description: "Defina os dias e horarios que cada profissional atende. Isso controla os slots disponiveis na agenda.",
    link: "/configuracoes/horarios",
    linkLabel: "Configurar Horarios",
    icon: <Clock className="h-5 w-5" />,
    priority: "essencial",
  },
  {
    id: "professionals",
    title: "Cadastrar Profissionais",
    description: "Adicione os dentistas e funcionarios da clinica com seus respectivos cargos e permissoes de acesso.",
    link: "/configuracoes/usuarios",
    linkLabel: "Gerenciar Usuarios",
    icon: <Users className="h-5 w-5" />,
    priority: "essencial",
  },
  {
    id: "procedures",
    title: "Cadastrar Procedimentos",
    description: "Registre os servicos que a clinica oferece (limpeza, restauracao, canal, etc.) com duracao e preco.",
    link: "/configuracoes/procedimentos",
    linkLabel: "Cadastrar Procedimentos",
    icon: <FileText className="h-5 w-5" />,
    priority: "essencial",
  },
  {
    id: "rooms",
    title: "Cadastrar Salas/Consultorios",
    description: "Defina as salas de atendimento disponiveis, tipo (geral, cirurgia, radiologia) e equipamentos.",
    link: "/configuracoes/salas",
    linkLabel: "Cadastrar Salas",
    icon: <Building2 className="h-5 w-5" />,
    priority: "essencial",
  },
  {
    id: "financial",
    title: "Configurar Financeiro",
    description: "Defina formas de pagamento aceitas (PIX, cartao, boleto), chave PIX, parcelamento e dados bancarios.",
    link: "/configuracoes/financeiro",
    linkLabel: "Configurar Financeiro",
    icon: <DollarSign className="h-5 w-5" />,
    priority: "recomendado",
  },
  {
    id: "whatsapp",
    title: "Conectar WhatsApp",
    description: "Conecte o WhatsApp da clinica para receber mensagens de pacientes, enviar lembretes e confirmacoes automaticas.",
    link: "/configuracoes/integracoes",
    linkLabel: "Conectar WhatsApp",
    icon: <MessageCircle className="h-5 w-5" />,
    priority: "recomendado",
  },
  {
    id: "notifications",
    title: "Configurar Notificacoes",
    description: "Ative lembretes automaticos de consulta (WhatsApp/email/SMS), mensagens de aniversario e alertas do sistema.",
    link: "/configuracoes/notificacoes",
    linkLabel: "Configurar Notificacoes",
    icon: <Zap className="h-5 w-5" />,
    priority: "recomendado",
  },
  {
    id: "appearance",
    title: "Personalizar Aparencia",
    description: "Escolha o tema (claro/escuro), cor principal, tamanho da fonte e estilo do menu lateral.",
    link: "/configuracoes/aparencia",
    linkLabel: "Personalizar",
    icon: <Star className="h-5 w-5" />,
    priority: "opcional",
  },
  {
    id: "ai-assistant",
    title: "Configurar Assistente IA",
    description: "Personalize o chatbot com nome, personalidade e tom de resposta para atendimento automatizado.",
    link: "/configuracoes/ia",
    linkLabel: "Configurar IA",
    icon: <Bot className="h-5 w-5" />,
    priority: "opcional",
  },
];

// Guia de funcionalidades
interface FeatureGuide {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  steps: string[];
  tips: string[];
  link: string;
}

const featureGuides: FeatureGuide[] = [
  {
    id: "patients",
    title: "Gerenciar Pacientes",
    icon: <Users className="h-6 w-6 text-blue-500" />,
    description: "Cadastre, busque e gerencie todos os pacientes da clinica com prontuario completo.",
    steps: [
      "Acesse 'Pacientes' no menu lateral",
      "Clique em 'Novo Paciente' para cadastrar",
      "Preencha os dados pessoais (nome, CPF, telefone, email)",
      "Salve o paciente - ele ja aparece na lista",
      "Clique no paciente para ver o prontuario completo",
      "No prontuario, acesse: historico clinico, financeiro, odontograma, anamnese",
    ],
    tips: [
      "Use a busca rapida para encontrar pacientes por nome, CPF ou telefone",
      "Voce pode importar pacientes em lote via CSV em 'Pacientes > Importar'",
      "Digitalize fichas de papel em 'Pacientes > Digitalizar' usando IA",
    ],
    link: "/patients",
  },
  {
    id: "schedule",
    title: "Agenda / Agendamentos",
    icon: <Calendar className="h-6 w-6 text-green-500" />,
    description: "Agende consultas, visualize a agenda por dia/semana/mes e gerencie horarios.",
    steps: [
      "Acesse 'Agenda' no menu lateral",
      "Visualize por dia, semana ou mes usando os botoes no topo",
      "Clique em 'Novo Agendamento' ou clique em um horario vazio",
      "Selecione: paciente, profissional, procedimento, sala e horario",
      "O sistema verifica conflitos automaticamente",
      "Apos salvar, o paciente pode receber lembrete automatico via WhatsApp",
    ],
    tips: [
      "Use 'Buscar Horario' para encontrar o proximo horario disponivel",
      "Arraste e solte para reagendar rapidamente",
      "Filtre por profissional ou sala para ver disponibilidade especifica",
      "Pacientes podem confirmar consulta clicando no link enviado por WhatsApp",
    ],
    link: "/agenda",
  },
  {
    id: "financial",
    title: "Financeiro",
    icon: <DollarSign className="h-6 w-6 text-emerald-500" />,
    description: "Controle receitas, despesas, pagamentos de pacientes e comissoes.",
    steps: [
      "Acesse 'Financeiro' no menu lateral",
      "Veja o resumo de receitas e despesas no dashboard",
      "Registre receitas quando pacientes pagam por procedimentos",
      "Registre despesas fixas (aluguel, materiais, etc.)",
      "Use os filtros para ver por periodo, profissional ou forma de pagamento",
      "Exporte relatorios financeiros em CSV",
    ],
    tips: [
      "Gere cobranças via PIX com QR Code em 'Pagamentos'",
      "Configure comissoes por profissional em 'Configuracoes > Horarios'",
      "Acompanhe inadimplentes nos relatorios financeiros",
    ],
    link: "/financial",
  },
  {
    id: "whatsapp-chat",
    title: "Atendimento WhatsApp",
    icon: <MessageCircle className="h-6 w-6 text-green-600" />,
    description: "Receba e responda mensagens de pacientes diretamente pelo sistema.",
    steps: [
      "Primeiro, conecte o WhatsApp em 'Configuracoes > Integracoes'",
      "Escaneie o QR Code com o celular da clinica",
      "Acesse 'Atendimento' no menu lateral para ver as conversas",
      "Clique em uma conversa para ler e responder",
      "Use respostas rapidas pre-configuradas para agilizar",
      "O bot de IA pode responder automaticamente quando configurado",
    ],
    tips: [
      "Conversas novas criam automaticamente oportunidades no CRM",
      "Configure respostas prontas em 'Configuracoes > Chat'",
      "Defina numeros de WhatsApp admin para receber notificacoes",
    ],
    link: "/atendimento",
  },
  {
    id: "crm",
    title: "CRM / Funil de Vendas",
    icon: <Target className="h-6 w-6 text-purple-500" />,
    description: "Acompanhe leads e oportunidades desde o primeiro contato ate o pagamento.",
    steps: [
      "Acesse 'CRM' no menu lateral",
      "Veja o quadro Kanban com as etapas do funil",
      "Arraste cards entre colunas conforme o paciente avanca",
      "As etapas sao: Contato > Agendamento > Confirmacao > Consulta > Pagamento > Concluido",
      "Com WhatsApp + IA, os cards avancam automaticamente",
    ],
    tips: [
      "Oportunidades sao criadas automaticamente por novas conversas WhatsApp",
      "O valor estimado ajuda a prever faturamento",
      "Use o CRM para identificar pacientes que pararam no meio do funil",
    ],
    link: "/crm",
  },
  {
    id: "odontogram",
    title: "Odontograma",
    icon: <Activity className="h-6 w-6 text-cyan-500" />,
    description: "Mapa dental visual para registrar condicoes e tratamentos em cada dente.",
    steps: [
      "Acesse 'Odontograma' no menu ou pelo prontuario do paciente",
      "Selecione o paciente",
      "Clique em um dente para registrar sua condicao",
      "Marque: saudavel, carie, restauracao, ausente, implante, etc.",
      "Adicione notas clinicas em cada dente",
      "O historico fica salvo para acompanhamento futuro",
    ],
    tips: [
      "Use cores diferentes para identificar rapidamente o estado de cada dente",
      "O odontograma tambem esta acessivel dentro do prontuario do paciente",
    ],
    link: "/odontogram",
  },
  {
    id: "automation",
    title: "Automacoes",
    icon: <Bot className="h-6 w-6 text-orange-500" />,
    description: "Configure acoes automaticas como lembretes, mensagens de aniversario e follow-ups.",
    steps: [
      "Acesse 'Automacoes' no menu lateral",
      "Crie um novo fluxo de automacao",
      "Escolha o gatilho (ex: 24h antes da consulta, aniversario, novo paciente)",
      "Defina a acao (enviar WhatsApp, email, SMS, criar tarefa)",
      "Ative a automacao e acompanhe execucoes",
    ],
    tips: [
      "Comece com o lembrete de consulta - eh o mais impactante",
      "Mensagens de aniversario aumentam fidelizacao",
      "Integre com N8N para fluxos mais complexos",
    ],
    link: "/automation",
  },
  {
    id: "inventory",
    title: "Estoque",
    icon: <Package className="h-6 w-6 text-amber-500" />,
    description: "Controle o estoque de materiais odontologicos e receba alertas de baixo estoque.",
    steps: [
      "Acesse 'Estoque' no menu lateral",
      "Cadastre todos os materiais (nome, categoria, quantidade, fornecedor)",
      "Registre entradas quando materiais chegam",
      "Registre saidas conforme materiais sao usados",
      "Configure alertas de estoque minimo",
    ],
    tips: [
      "Mantenha o estoque atualizado para evitar falta de materiais",
      "Use categorias para organizar (descartaveis, medicamentos, instrumentos)",
    ],
    link: "/inventory",
  },
  {
    id: "prosthesis",
    title: "Proteses e Laboratorio",
    icon: <Scissors className="h-6 w-6 text-rose-500" />,
    description: "Gerencie pedidos de proteses e acompanhe status com laboratorios externos.",
    steps: [
      "Acesse 'Proteses' para gerenciar casos",
      "Acesse 'Laboratorio' para gerenciar laboratorios parceiros",
      "Crie um novo caso vinculado ao paciente",
      "Acompanhe o status: pendente > em producao > pronto > entregue",
      "Registre materiais e custos de cada caso",
    ],
    tips: [
      "Cadastre laboratorios com contato completo para facilitar comunicacao",
      "Use o rastreamento de status para nunca perder um prazo",
    ],
    link: "/prosthesis",
  },
  {
    id: "reports",
    title: "Relatorios e Analytics",
    icon: <BarChart3 className="h-6 w-6 text-indigo-500" />,
    description: "Visualize metricas, gere relatorios detalhados e tome decisoes baseadas em dados.",
    steps: [
      "Acesse 'Relatorios' para relatorios detalhados por categoria",
      "Acesse 'Analytics' (admin) para metricas e graficos interativos",
      "Escolha o tipo: financeiro, pacientes, operacional ou performance",
      "Selecione o periodo e filtros desejados",
      "Exporte os dados em CSV quando necessario",
    ],
    tips: [
      "Acompanhe o relatorio de inadimplentes semanalmente",
      "Use 'Pacientes sem retorno' para identificar oportunidades de recall",
      "O relatorio de produtividade por profissional ajuda na gestao da equipe",
    ],
    link: "/relatorios",
  },
  {
    id: "teleconsulta",
    title: "Teleconsulta",
    icon: <Video className="h-6 w-6 text-sky-500" />,
    description: "Realize consultas por video diretamente pelo sistema.",
    steps: [
      "Acesse 'Teleconsulta' no menu lateral",
      "Agende uma teleconsulta como um agendamento normal",
      "No horario marcado, inicie a videochamada",
      "O paciente recebe o link para participar",
      "Registre anotacoes durante a consulta",
    ],
    tips: [
      "Ideal para retornos, orientacoes pos-operatorias e triagem",
      "O paciente nao precisa instalar nenhum aplicativo",
    ],
    link: "/teleconsulta",
  },
  {
    id: "payments",
    title: "Pagamentos de Pacientes",
    icon: <CreditCard className="h-6 w-6 text-teal-500" />,
    description: "Gere cobranças via PIX, boleto ou cartao e acompanhe pagamentos.",
    steps: [
      "Acesse 'Pagamentos' no menu lateral",
      "Crie uma nova cobranca vinculada ao paciente",
      "Escolha o metodo: PIX (QR Code), boleto ou cartao",
      "Compartilhe o QR Code ou link de pagamento com o paciente",
      "O sistema atualiza o status automaticamente quando o pagamento eh confirmado",
    ],
    tips: [
      "PIX eh o metodo mais rapido e sem taxas",
      "Configure os dados PIX em 'Configuracoes > Financeiro'",
    ],
    link: "/pagamentos-paciente",
  },
];

// FAQ
const faqItems = [
  {
    question: "Como adiciono um novo dentista na clinica?",
    answer: "Va em 'Configuracoes > Usuarios', clique em 'Adicionar Usuario'. Preencha o nome, email e defina o cargo como 'Dentista'. Depois, configure os horarios de atendimento dele em 'Configuracoes > Horarios'.",
  },
  {
    question: "Como configuro lembretes automaticos de consulta?",
    answer: "Va em 'Configuracoes > Notificacoes'. Ative 'Lembretes de Consulta', defina quantas horas antes enviar (ex: 24h) e escolha o canal (WhatsApp, email ou SMS). O sistema enviara automaticamente.",
  },
  {
    question: "Como conecto o WhatsApp da clinica?",
    answer: "Va em 'Configuracoes > Integracoes'. Na secao WhatsApp, clique em 'Conectar'. Escaneie o QR Code com o WhatsApp Business do celular da clinica. Apos conectar, as mensagens chegam no menu 'Atendimento'.",
  },
  {
    question: "Posso ter mais de um profissional usando o sistema?",
    answer: "Sim! Cada profissional pode ter seu proprio login. Va em 'Configuracoes > Usuarios' para cadastrar. Cada um vera apenas o que suas permissoes permitem. Configure permissoes em 'Permissoes' no menu de administracao.",
  },
  {
    question: "Como gero uma cobranca PIX para um paciente?",
    answer: "Va em 'Pagamentos', crie uma nova cobranca, selecione o paciente e escolha PIX como metodo. O sistema gera um QR Code que voce pode compartilhar com o paciente. Ele paga escaneando o codigo.",
  },
  {
    question: "O que sao os modulos e como ativo/desativo?",
    answer: "Modulos sao funcionalidades do sistema (Agenda, Financeiro, CRM, etc.). Administradores podem ativar/desativar modulos em 'Admin Clinica > Modulos'. Isso controla o que aparece no menu para os usuarios.",
  },
  {
    question: "Como importo pacientes de outro sistema?",
    answer: "Va em 'Pacientes' e use a opcao 'Importar'. Prepare um arquivo CSV com os dados dos pacientes (nome, telefone, email, CPF). O sistema valida os dados e alerta sobre duplicatas antes de importar.",
  },
  {
    question: "Como funciona o CRM com WhatsApp?",
    answer: "Quando um paciente novo envia mensagem via WhatsApp, o sistema cria automaticamente uma oportunidade no CRM. Conforme o atendimento avanca (agendamento, confirmacao, consulta, pagamento), o card move automaticamente entre as etapas do funil.",
  },
  {
    question: "Como configuro o bot de IA para responder pacientes?",
    answer: "Va em 'Configuracoes > IA'. Escolha a personalidade do bot (profissional, amigavel, casual), defina o nome e customize o comportamento. O bot usa IA para responder perguntas comuns e encaminha para atendimento humano quando necessario.",
  },
  {
    question: "Meus dados estao seguros?",
    answer: "Sim. O sistema usa criptografia em todas as comunicacoes, senhas sao armazenadas com hash seguro, e todos os acessos sao registrados em log de auditoria (LGPD). Voce pode configurar backups automaticos em 'Configuracoes > Backup'.",
  },
  {
    question: "Como vejo quanto cada dentista esta produzindo?",
    answer: "Va em 'Relatorios' e selecione 'Receita por Profissional' ou 'Produtividade por Profissional'. Tambem em 'Analytics' voce pode filtrar por profissional e ver graficos de desempenho.",
  },
  {
    question: "Qual a diferenca entre 'Configuracoes' e 'Admin Clinica'?",
    answer: "'Configuracoes' sao as configuracoes operacionais do dia a dia (horarios, procedimentos, salas, notificacoes). 'Admin Clinica' eh para gestao mais ampla: gerenciar usuarios e ativar/desativar modulos do sistema.",
  },
];

// Fluxo do dia a dia
const dailyWorkflow = [
  {
    time: "Inicio do dia",
    title: "Verificar a Agenda",
    description: "Abra a 'Agenda' e veja os agendamentos do dia. Confira quais pacientes confirmaram e quais estao pendentes.",
    icon: <Calendar className="h-5 w-5 text-green-500" />,
  },
  {
    time: "Ao longo do dia",
    title: "Atender Mensagens",
    description: "Verifique o 'Atendimento' para responder mensagens de WhatsApp. Agende novos pacientes que entraram em contato.",
    icon: <MessageCircle className="h-5 w-5 text-green-600" />,
  },
  {
    time: "Durante consultas",
    title: "Registrar no Prontuario",
    description: "Ao atender cada paciente, registre procedimentos realizados, notas clinicas e atualize o odontograma.",
    icon: <FileText className="h-5 w-5 text-blue-500" />,
  },
  {
    time: "Apos consultas",
    title: "Registrar Pagamentos",
    description: "Registre o pagamento do paciente no financeiro. Gere cobranca PIX se necessario.",
    icon: <DollarSign className="h-5 w-5 text-emerald-500" />,
  },
  {
    time: "Final do dia",
    title: "Conferir Financeiro",
    description: "Veja o resumo financeiro do dia. Confira se todos os pagamentos foram registrados.",
    icon: <BarChart3 className="h-5 w-5 text-indigo-500" />,
  },
  {
    time: "Semanalmente",
    title: "Analisar Relatorios",
    description: "Revise relatorios de produtividade, inadimplentes e pacientes sem retorno. Use os dados para tomar decisoes.",
    icon: <Lightbulb className="h-5 w-5 text-amber-500" />,
  },
];

// ============ ASSISTENTE VIRTUAL (Chatbot) ============

interface KnowledgeEntry {
  keywords: string[];
  answer: string;
  link?: string;
  linkLabel?: string;
}

// Base de conhecimento construida a partir de FAQ, funcionalidades e mapa do sistema
const knowledgeBase: KnowledgeEntry[] = [
  // FAQ items convertidos
  {
    keywords: ["adicionar", "novo", "dentista", "profissional", "cadastrar dentista", "equipe"],
    answer: "Para adicionar um novo dentista: va em Configuracoes > Usuarios, clique em 'Adicionar Usuario'. Preencha o nome, email e defina o cargo como 'Dentista'. Depois, configure os horarios dele em Configuracoes > Horarios.",
    link: "/configuracoes/usuarios",
    linkLabel: "Gerenciar Usuarios",
  },
  {
    keywords: ["lembrete", "notificacao", "automatico", "aviso", "consulta lembrete", "confirmar consulta"],
    answer: "Para configurar lembretes automaticos: va em Configuracoes > Notificacoes. Ative 'Lembretes de Consulta', defina quantas horas antes enviar (ex: 24h) e escolha o canal (WhatsApp, email ou SMS).",
    link: "/configuracoes/notificacoes",
    linkLabel: "Configurar Notificacoes",
  },
  {
    keywords: ["whatsapp", "conectar", "qr code", "integrar whatsapp", "mensagem"],
    answer: "Para conectar o WhatsApp: va em Configuracoes > Integracoes. Na secao WhatsApp, clique em 'Conectar' e escaneie o QR Code com o WhatsApp Business da clinica. Apos conectar, as mensagens chegam no menu 'Atendimento'.",
    link: "/configuracoes/integracoes",
    linkLabel: "Conectar WhatsApp",
  },
  {
    keywords: ["pix", "cobranca", "qr code pagamento", "cobrar", "gerar pix"],
    answer: "Para gerar uma cobranca PIX: va em Pagamentos, crie uma nova cobranca, selecione o paciente e escolha PIX. O sistema gera um QR Code que voce compartilha com o paciente.",
    link: "/pagamentos-paciente",
    linkLabel: "Ir para Pagamentos",
  },
  {
    keywords: ["modulo", "ativar", "desativar", "funcionalidade", "menu"],
    answer: "Modulos sao funcionalidades do sistema (Agenda, Financeiro, CRM, etc.). Administradores podem ativar/desativar em Admin Clinica > Modulos. Isso controla o que aparece no menu.",
    link: "/company-admin",
    linkLabel: "Admin Clinica",
  },
  {
    keywords: ["importar", "csv", "migrar", "outro sistema", "dados"],
    answer: "Para importar pacientes: va em Pacientes e use 'Importar'. Prepare um CSV com nome, telefone, email e CPF. O sistema valida e alerta sobre duplicatas antes de importar.",
    link: "/patients",
    linkLabel: "Ir para Pacientes",
  },
  {
    keywords: ["crm", "funil", "kanban", "lead", "oportunidade", "vendas"],
    answer: "O CRM funciona como um funil de vendas. Quando um paciente envia mensagem via WhatsApp, cria automaticamente uma oportunidade. Conforme o atendimento avanca, o card move automaticamente pelas etapas: Contato > Agendamento > Confirmacao > Consulta > Pagamento > Concluido.",
    link: "/crm",
    linkLabel: "Acessar CRM",
  },
  {
    keywords: ["bot", "ia", "inteligencia artificial", "chatbot", "resposta automatica"],
    answer: "Para configurar o bot de IA: va em Configuracoes > IA. Escolha a personalidade (profissional, amigavel, casual), defina o nome e customize o comportamento. O bot responde perguntas comuns e encaminha para atendimento humano quando necessario.",
    link: "/configuracoes/ia",
    linkLabel: "Configurar IA",
  },
  {
    keywords: ["seguranca", "lgpd", "dados seguros", "criptografia", "backup"],
    answer: "O sistema usa criptografia em todas as comunicacoes, senhas com hash seguro e log de auditoria (LGPD). Configure backups automaticos em Configuracoes > Backup.",
    link: "/configuracoes/backup",
    linkLabel: "Configurar Backup",
  },
  {
    keywords: ["produtividade", "desempenho", "quanto produziu", "receita dentista", "relatorio profissional"],
    answer: "Para ver a produtividade de cada dentista: va em Relatorios e selecione 'Receita por Profissional' ou 'Produtividade por Profissional'. Em Analytics voce pode filtrar por profissional e ver graficos.",
    link: "/relatorios",
    linkLabel: "Ver Relatorios",
  },
  // Funcionalidades do sistema
  {
    keywords: ["paciente", "cadastro", "prontuario", "ficha", "cpf", "buscar paciente"],
    answer: "Para gerenciar pacientes: acesse 'Pacientes' no menu lateral. Clique em 'Novo Paciente' para cadastrar. No prontuario do paciente voce encontra: historico clinico, financeiro, odontograma e anamnese. Use a busca para encontrar por nome, CPF ou telefone.",
    link: "/patients",
    linkLabel: "Ir para Pacientes",
  },
  {
    keywords: ["agenda", "agendar", "consulta", "horario", "marcar", "reagendar", "disponibilidade"],
    answer: "Para agendar consultas: acesse 'Agenda' no menu. Visualize por dia, semana ou mes. Clique em 'Novo Agendamento' ou em um horario vazio. Selecione paciente, profissional, procedimento, sala e horario. Use 'Buscar Horario' para encontrar o proximo disponivel.",
    link: "/agenda",
    linkLabel: "Ir para Agenda",
  },
  {
    keywords: ["financeiro", "receita", "despesa", "caixa", "dinheiro", "faturamento", "conta"],
    answer: "O modulo Financeiro fica em 'Financeiro' no menu lateral. Veja o resumo de receitas/despesas, registre pagamentos de pacientes e despesas fixas. Use filtros por periodo, profissional ou forma de pagamento. Exporte relatorios em CSV.",
    link: "/financial",
    linkLabel: "Ir para Financeiro",
  },
  {
    keywords: ["odontograma", "dente", "mapa dental", "condicao dental", "tratamento dental"],
    answer: "O Odontograma e o mapa dental visual. Acesse pelo menu 'Odontograma' ou dentro do prontuario do paciente. Clique em um dente para registrar: saudavel, carie, restauracao, ausente, implante, etc. O historico fica salvo.",
    link: "/odontogram",
    linkLabel: "Ir para Odontograma",
  },
  {
    keywords: ["automacao", "automatizar", "fluxo", "gatilho", "n8n", "workflow"],
    answer: "Para automacoes: acesse 'Automacoes' no menu. Crie um fluxo com gatilho (24h antes da consulta, aniversario, novo paciente) e acao (WhatsApp, email, SMS, tarefa). O lembrete de consulta e o mais impactante - reduz faltas em ate 40%!",
    link: "/automation",
    linkLabel: "Ir para Automacoes",
  },
  {
    keywords: ["estoque", "material", "insumo", "fornecedor", "quantidade"],
    answer: "Controle de estoque em 'Estoque' no menu. Cadastre materiais com nome, categoria, quantidade e fornecedor. Registre entradas/saidas e configure alertas de estoque minimo.",
    link: "/inventory",
    linkLabel: "Ir para Estoque",
  },
  {
    keywords: ["protese", "laboratorio", "lab", "caso protese", "pedido"],
    answer: "Gerencie proteses em 'Proteses' e laboratorios em 'Laboratorio'. Crie casos vinculados ao paciente, acompanhe status (pendente > em producao > pronto > entregue) e registre custos.",
    link: "/prosthesis",
    linkLabel: "Ir para Proteses",
  },
  {
    keywords: ["teleconsulta", "video", "videochamada", "consulta online", "remoto"],
    answer: "Para teleconsultas: acesse 'Teleconsulta' no menu. Agende normalmente, inicie a videochamada no horario e o paciente recebe o link. Ideal para retornos, orientacoes pos-operatorias e triagem. O paciente nao precisa instalar nada.",
    link: "/teleconsulta",
    linkLabel: "Ir para Teleconsulta",
  },
  {
    keywords: ["configuracao", "configurar", "setup", "inicio", "comecar", "primeiro uso"],
    answer: "Para configurar sua clinica do zero, siga esta ordem: 1) Dados da Clinica, 2) Horarios de Funcionamento, 3) Cadastrar Profissionais, 4) Cadastrar Procedimentos, 5) Cadastrar Salas. Depois configure: Financeiro, WhatsApp, Notificacoes. Tudo em 'Configuracoes' no menu.",
    link: "/configuracoes",
    linkLabel: "Ir para Configuracoes",
  },
  {
    keywords: ["permissao", "acesso", "restringir", "papel", "role", "staff", "admin"],
    answer: "Gerencie permissoes em 'Permissoes' no menu de Administracao (apenas admin). La voce controla o que cada cargo pode ver e fazer no sistema.",
    link: "/permissions",
    linkLabel: "Ir para Permissoes",
  },
  {
    keywords: ["assinatura", "plano", "billing", "pagar sistema", "mensalidade", "upgrade"],
    answer: "Gerencie sua assinatura em 'Assinatura' no menu lateral. La voce ve seu plano atual, pode fazer upgrade/downgrade e gerenciar pagamentos.",
    link: "/billing",
    linkLabel: "Ir para Assinatura",
  },
  {
    keywords: ["chat interno", "comunicacao", "equipe", "mensagem interna"],
    answer: "O Chat Interno permite comunicacao entre a equipe sem sair do sistema. Acesse 'Chat Interno' no menu lateral.",
    link: "/chat-interno",
    linkLabel: "Ir para Chat Interno",
  },
  {
    keywords: ["relatorio", "analytics", "metrica", "grafico", "inadimplente", "recall"],
    answer: "Relatorios detalhados em 'Relatorios' no menu (financeiro, pacientes, operacional, performance). Para graficos interativos, use 'Analytics' (admin). Acompanhe inadimplentes semanalmente e use 'Pacientes sem retorno' para recall.",
    link: "/relatorios",
    linkLabel: "Ir para Relatorios",
  },
  {
    keywords: ["horario", "funcionamento", "expediente", "dia trabalho", "turno"],
    answer: "Configure horarios de funcionamento de cada profissional em Configuracoes > Horarios. Isso controla os slots disponiveis na agenda automaticamente.",
    link: "/configuracoes/horarios",
    linkLabel: "Configurar Horarios",
  },
  {
    keywords: ["procedimento", "servico", "preco", "valor", "tabela"],
    answer: "Cadastre procedimentos (servicos) da clinica em Configuracoes > Procedimentos. Defina nome, duracao e preco de cada um (limpeza, restauracao, canal, etc.).",
    link: "/configuracoes/procedimentos",
    linkLabel: "Cadastrar Procedimentos",
  },
  {
    keywords: ["sala", "consultorio", "equipamento", "ambiente"],
    answer: "Cadastre salas/consultorios em Configuracoes > Salas. Defina tipo (geral, cirurgia, radiologia) e equipamentos disponiveis.",
    link: "/configuracoes/salas",
    linkLabel: "Cadastrar Salas",
  },
  {
    keywords: ["aparencia", "tema", "escuro", "claro", "dark", "cor", "fonte"],
    answer: "Personalize a aparencia em Configuracoes > Aparencia. Escolha tema claro/escuro, cor principal, tamanho da fonte e estilo do menu lateral.",
    link: "/configuracoes/aparencia",
    linkLabel: "Personalizar Aparencia",
  },
  {
    keywords: ["digitalizar", "papel", "ficha papel", "scanner", "ocr"],
    answer: "Para digitalizar fichas de papel: va em Pacientes > Digitalizar. O sistema usa IA para extrair dados de fichas fisicas e criar cadastros automaticamente.",
    link: "/pacientes/digitalizar",
    linkLabel: "Digitalizar Fichas",
  },
  {
    keywords: ["dashboard", "inicio", "pagina inicial", "resumo", "visao geral"],
    answer: "O Dashboard e sua pagina inicial com resumo do dia: agendamentos, financeiro, alertas e atalhos rapidos. Acesse clicando em 'Dashboard' no menu lateral.",
    link: "/dashboard",
    linkLabel: "Ir para Dashboard",
  },
  {
    keywords: ["atendimento", "inbox", "caixa entrada", "responder paciente"],
    answer: "A caixa de atendimento WhatsApp fica em 'Atendimento' no menu lateral. La voce ve todas as conversas, responde pacientes, usa respostas rapidas e o bot de IA pode responder automaticamente.",
    link: "/atendimento",
    linkLabel: "Ir para Atendimento",
  },
  {
    keywords: ["integracoes", "api", "webhook", "google", "calendario google"],
    answer: "Configure integracoes externas em Configuracoes > Integracoes ou em Integracoes no menu de administracao. Conecte WhatsApp, Google Calendar, N8N e outros servicos.",
    link: "/integracoes",
    linkLabel: "Ir para Integracoes",
  },
];

// Sugestoes rapidas para o chatbot
const quickSuggestions = [
  "Como agendar uma consulta?",
  "Onde fica o financeiro?",
  "Como conectar o WhatsApp?",
  "Como cadastrar paciente?",
  "Como gerar cobranca PIX?",
  "Como configurar o bot de IA?",
  "Onde vejo relatorios?",
  "Como adicionar um dentista?",
];

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  link?: string;
  linkLabel?: string;
  timestamp: Date;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
}

function searchKnowledgeBase(query: string): KnowledgeEntry | null {
  const normalized = normalizeText(query);
  const words = normalized.split(/\s+/).filter((w) => w.length > 2);

  let bestMatch: KnowledgeEntry | null = null;
  let bestScore = 0;

  for (const entry of knowledgeBase) {
    let score = 0;
    for (const keyword of entry.keywords) {
      const normalizedKeyword = normalizeText(keyword);
      // Keyword exata encontrada na query
      if (normalized.includes(normalizedKeyword)) {
        score += 3;
      }
      // Palavras individuais da keyword encontradas
      const keywordWords = normalizedKeyword.split(/\s+/);
      for (const kw of keywordWords) {
        if (words.some((w) => w.includes(kw) || kw.includes(w))) {
          score += 1;
        }
      }
    }
    // Bonus: palavras da query encontradas na resposta
    const normalizedAnswer = normalizeText(entry.answer);
    for (const word of words) {
      if (normalizedAnswer.includes(word)) {
        score += 0.5;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  return bestScore >= 2 ? bestMatch : null;
}

function AssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Ola! Sou o assistente virtual do DentCare. Posso te ajudar a encontrar funcionalidades, explicar como usar o sistema ou indicar onde esta cada recurso. Como posso te ajudar?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (text?: string) => {
    const query = text || input.trim();
    if (!query) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Simular tempo de resposta
    setTimeout(() => {
      const result = searchKnowledgeBase(query);
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: result
          ? result.answer
          : "Desculpe, nao encontrei uma resposta especifica para essa pergunta. Tente reformular ou explore as abas de Funcionalidades, FAQ e Mapa do Sistema para encontrar o que precisa. Voce tambem pode tentar perguntas como: 'Como agendar consulta?', 'Onde fica o financeiro?' ou 'Como conectar WhatsApp?'",
        link: result?.link,
        linkLabel: result?.linkLabel,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 600 + Math.random() * 400);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Assistente Virtual DentCare</CardTitle>
            <CardDescription className="text-xs">
              Pergunte sobre qualquer funcionalidade do sistema
            </CardDescription>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-muted-foreground">Online</span>
          </div>
        </div>
      </CardHeader>

      {/* Area de mensagens */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted text-foreground rounded-bl-md"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium text-primary">Assistente</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                {msg.link && (
                  <Link href={msg.link}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 gap-1.5 text-xs h-7 bg-background/80"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {msg.linkLabel || "Acessar"}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Sugestoes rapidas */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground mb-2">Sugestoes:</p>
          <div className="flex flex-wrap gap-1.5">
            {quickSuggestions.map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                className="text-xs h-7 rounded-full"
                onClick={() => handleSend(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua pergunta..."
            className="flex-1"
            disabled={isTyping}
          />
          <Button
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
            size="icon"
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function AjudaPage() {
  const { user } = useAuth();
  const [completedSteps, setCompletedSteps] = useState<string[]>(() => {
    const saved = localStorage.getItem("help_completed_steps");
    return saved ? JSON.parse(saved) : [];
  });

  const toggleStep = (stepId: string) => {
    setCompletedSteps((prev) => {
      const next = prev.includes(stepId)
        ? prev.filter((id) => id !== stepId)
        : [...prev, stepId];
      localStorage.setItem("help_completed_steps", JSON.stringify(next));
      return next;
    });
  };

  const completionPercent = Math.round(
    (completedSteps.length / setupSteps.length) * 100
  );

  const priorityColors = {
    essencial: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    recomendado: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    opcional: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };

  return (
    <DashboardLayout title="Central de Ajuda" currentPath="/ajuda">
      {/* Header com boas-vindas */}
      <div className="mb-6">
        <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <BookOpen className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-foreground mb-1">
                  Bem-vindo ao DentCare{user?.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}!
                </h2>
                <p className="text-muted-foreground">
                  Este guia vai te ajudar a configurar sua clinica e comecar a usar o sistema.
                  Siga o passo a passo abaixo ou explore as funcionalidades no seu ritmo.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="assistant" className="space-y-6">
        <TabsList className="grid grid-cols-3 md:grid-cols-6 gap-1 h-auto p-1">
          <TabsTrigger value="assistant" className="text-xs sm:text-sm py-2">
            <Sparkles className="h-4 w-4 mr-1.5" />
            Assistente
          </TabsTrigger>
          <TabsTrigger value="setup" className="text-xs sm:text-sm py-2">
            <Rocket className="h-4 w-4 mr-1.5" />
            Configuracao Inicial
          </TabsTrigger>
          <TabsTrigger value="daily" className="text-xs sm:text-sm py-2">
            <Clock className="h-4 w-4 mr-1.5" />
            Dia a Dia
          </TabsTrigger>
          <TabsTrigger value="features" className="text-xs sm:text-sm py-2">
            <Lightbulb className="h-4 w-4 mr-1.5" />
            Funcionalidades
          </TabsTrigger>
          <TabsTrigger value="faq" className="text-xs sm:text-sm py-2">
            <HelpCircle className="h-4 w-4 mr-1.5" />
            Perguntas Frequentes
          </TabsTrigger>
          <TabsTrigger value="map" className="text-xs sm:text-sm py-2">
            <FileText className="h-4 w-4 mr-1.5" />
            Mapa do Sistema
          </TabsTrigger>
        </TabsList>

        {/* ======= ABA 0: ASSISTENTE VIRTUAL ======= */}
        <TabsContent value="assistant">
          <AssistantChat />
        </TabsContent>

        {/* ======= ABA 1: CONFIGURACAO INICIAL ======= */}
        <TabsContent value="setup" className="space-y-6">
          {/* Barra de progresso */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">
                  Progresso da configuracao
                </span>
                <span className="text-sm font-bold text-primary">
                  {completedSteps.length}/{setupSteps.length} ({completionPercent}%)
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div
                  className="bg-primary h-3 rounded-full transition-all duration-500"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              {completionPercent === 100 && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Parabens! Sua clinica esta totalmente configurada.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Passos de configuracao */}
          <div className="space-y-3">
            {setupSteps.map((step, index) => {
              const isCompleted = completedSteps.includes(step.id);
              return (
                <Card
                  key={step.id}
                  className={`transition-all ${isCompleted ? "opacity-70 bg-muted/30" : ""}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleStep(step.id)}
                        className="mt-0.5 flex-shrink-0 transition-colors"
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-6 w-6 text-green-500" />
                        ) : (
                          <Circle className="h-6 w-6 text-muted-foreground hover:text-primary" />
                        )}
                      </button>

                      {/* Numero */}
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">{index + 1}</span>
                      </div>

                      {/* Conteudo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className={`font-semibold text-foreground ${isCompleted ? "line-through" : ""}`}>
                            {step.title}
                          </h3>
                          <Badge variant="outline" className={priorityColors[step.priority]}>
                            {step.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{step.description}</p>
                        <Link href={step.link}>
                          <Button variant="outline" size="sm" className="gap-1.5">
                            {step.icon}
                            {step.linkLabel}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ======= ABA 2: DIA A DIA ======= */}
        <TabsContent value="daily" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Rotina Diaria da Clinica
              </CardTitle>
              <CardDescription>
                Veja como seria um dia tipico usando o DentCare na sua clinica
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {/* Linha vertical conectora */}
                <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-border" />

                <div className="space-y-6">
                  {dailyWorkflow.map((item, index) => (
                    <div key={index} className="relative flex gap-4">
                      {/* Indicador */}
                      <div className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full bg-background border-2 border-primary/30 flex items-center justify-center">
                        {item.icon}
                      </div>

                      {/* Conteudo */}
                      <div className="flex-1 pb-2">
                        <Badge variant="outline" className="mb-1.5 text-xs">
                          {item.time}
                        </Badge>
                        <h4 className="font-semibold text-foreground">{item.title}</h4>
                        <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dicas rapidas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                Dicas para o Dia a Dia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { tip: "Mantenha o WhatsApp sempre conectado para nao perder mensagens de pacientes", icon: <MessageCircle className="h-4 w-4 text-green-500" /> },
                  { tip: "Registre pagamentos logo apos a consulta para manter o financeiro atualizado", icon: <DollarSign className="h-4 w-4 text-emerald-500" /> },
                  { tip: "Use o CRM para acompanhar pacientes que ainda nao fecharam tratamento", icon: <Target className="h-4 w-4 text-purple-500" /> },
                  { tip: "Configure automacoes de lembrete - reduz faltas em ate 40%", icon: <Zap className="h-4 w-4 text-orange-500" /> },
                  { tip: "Faca backup dos dados regularmente em 'Configuracoes > Backup'", icon: <Shield className="h-4 w-4 text-blue-500" /> },
                  { tip: "Use o Chat Interno para comunicacao entre a equipe sem sair do sistema", icon: <MessageSquare className="h-4 w-4 text-sky-500" /> },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/50">
                    <div className="mt-0.5">{item.icon}</div>
                    <p className="text-sm text-foreground">{item.tip}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======= ABA 3: FUNCIONALIDADES ======= */}
        <TabsContent value="features" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {featureGuides.map((feature) => (
              <Card key={feature.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">{feature.icon}</div>
                    <div>
                      <CardTitle className="text-base">{feature.title}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">{feature.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pt-0">
                  <Accordion type="single" collapsible>
                    <AccordionItem value="steps" className="border-b-0">
                      <AccordionTrigger className="text-sm py-2 hover:no-underline">
                        Como usar (passo a passo)
                      </AccordionTrigger>
                      <AccordionContent>
                        <ol className="space-y-1.5 text-sm text-muted-foreground">
                          {feature.steps.map((step, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center mt-0.5 font-medium">
                                {i + 1}
                              </span>
                              {step}
                            </li>
                          ))}
                        </ol>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="tips" className="border-b-0">
                      <AccordionTrigger className="text-sm py-2 hover:no-underline">
                        Dicas uteis
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="space-y-1.5 text-sm text-muted-foreground">
                          {feature.tips.map((tip, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  <div className="mt-3">
                    <Link href={feature.link}>
                      <Button variant="ghost" size="sm" className="gap-1.5 text-primary hover:text-primary">
                        Acessar {feature.title}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ======= ABA 4: FAQ ======= */}
        <TabsContent value="faq" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                Perguntas Frequentes
              </CardTitle>
              <CardDescription>
                Respostas rapidas para as duvidas mais comuns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {faqItems.map((item, index) => (
                  <AccordionItem key={index} value={`faq-${index}`}>
                    <AccordionTrigger className="text-left text-sm font-medium">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======= ABA 5: MAPA DO SISTEMA ======= */}
        <TabsContent value="map" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Mapa Completo do Sistema
              </CardTitle>
              <CardDescription>
                Todas as areas e funcionalidades organizadas por categoria
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Atendimento */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Heart className="h-4 w-4 text-red-500" />
                    Atendimento ao Paciente
                  </h3>
                  <nav className="space-y-1">
                    {[
                      { label: "Pacientes", path: "/patients", desc: "Cadastro e prontuarios" },
                      { label: "Agenda", path: "/agenda", desc: "Agendamentos e consultas" },
                      { label: "Odontograma", path: "/odontogram", desc: "Mapa dental visual" },
                      { label: "Teleconsulta", path: "/teleconsulta", desc: "Consulta por video" },
                      { label: "Atendimento", path: "/atendimento", desc: "Chat WhatsApp" },
                    ].map((item) => (
                      <Link key={item.path} href={item.path} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors group">
                        <div>
                          <span className="text-sm font-medium text-foreground group-hover:text-primary">{item.label}</span>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                      </Link>
                    ))}
                  </nav>
                </div>

                {/* Gestao */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <BarChart3 className="h-4 w-4 text-indigo-500" />
                    Gestao e Financeiro
                  </h3>
                  <nav className="space-y-1">
                    {[
                      { label: "Financeiro", path: "/financial", desc: "Receitas e despesas" },
                      { label: "Pagamentos", path: "/pagamentos-paciente", desc: "Cobranças PIX/Boleto" },
                      { label: "CRM", path: "/crm", desc: "Funil de vendas" },
                      { label: "Relatorios", path: "/relatorios", desc: "Relatorios detalhados" },
                      { label: "Analytics", path: "/analytics", desc: "Metricas e graficos" },
                    ].map((item) => (
                      <Link key={item.path} href={item.path} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors group">
                        <div>
                          <span className="text-sm font-medium text-foreground group-hover:text-primary">{item.label}</span>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                      </Link>
                    ))}
                  </nav>
                </div>

                {/* Operacional */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Package className="h-4 w-4 text-amber-500" />
                    Operacional
                  </h3>
                  <nav className="space-y-1">
                    {[
                      { label: "Estoque", path: "/inventory", desc: "Materiais e insumos" },
                      { label: "Proteses", path: "/prosthesis", desc: "Controle de proteses" },
                      { label: "Laboratorio", path: "/laboratorio", desc: "Labs parceiros" },
                      { label: "Automacoes", path: "/automation", desc: "Fluxos automaticos" },
                      { label: "Chat Interno", path: "/chat-interno", desc: "Comunicacao da equipe" },
                    ].map((item) => (
                      <Link key={item.path} href={item.path} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors group">
                        <div>
                          <span className="text-sm font-medium text-foreground group-hover:text-primary">{item.label}</span>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                      </Link>
                    ))}
                  </nav>
                </div>

                {/* Configuracoes */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Settings className="h-4 w-4 text-gray-500" />
                    Configuracoes
                  </h3>
                  <nav className="space-y-1">
                    {[
                      { label: "Clinica", path: "/configuracoes/clinica", desc: "Dados e informacoes" },
                      { label: "Horarios", path: "/configuracoes/horarios", desc: "Horarios profissionais" },
                      { label: "Usuarios", path: "/configuracoes/usuarios", desc: "Equipe e permissoes" },
                      { label: "Procedimentos", path: "/configuracoes/procedimentos", desc: "Servicos oferecidos" },
                      { label: "Salas", path: "/configuracoes/salas", desc: "Consultorios" },
                      { label: "Financeiro", path: "/configuracoes/financeiro", desc: "Pagamentos e taxas" },
                      { label: "Notificacoes", path: "/configuracoes/notificacoes", desc: "Lembretes e alertas" },
                      { label: "Integracoes", path: "/configuracoes/integracoes", desc: "WhatsApp, Google, N8N" },
                      { label: "Aparencia", path: "/configuracoes/aparencia", desc: "Tema e visual" },
                      { label: "Backup", path: "/configuracoes/backup", desc: "Dados e segurança" },
                      { label: "Assistente IA", path: "/configuracoes/ia", desc: "Bot e chatbot" },
                    ].map((item) => (
                      <Link key={item.path} href={item.path} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors group">
                        <div>
                          <span className="text-sm font-medium text-foreground group-hover:text-primary">{item.label}</span>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                      </Link>
                    ))}
                  </nav>
                </div>

                {/* Administracao */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Shield className="h-4 w-4 text-blue-500" />
                    Administracao
                  </h3>
                  <nav className="space-y-1">
                    {[
                      { label: "Admin Clinica", path: "/company-admin", desc: "Gestao da empresa" },
                      { label: "Permissoes", path: "/permissions", desc: "Controle de acesso" },
                      { label: "Integracoes", path: "/integracoes", desc: "APIs e webhooks" },
                      { label: "Assinatura", path: "/billing", desc: "Plano e faturamento" },
                      { label: "Perfil", path: "/perfil", desc: "Seus dados pessoais" },
                    ].map((item) => (
                      <Link key={item.path} href={item.path} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors group">
                        <div>
                          <span className="text-sm font-medium text-foreground group-hover:text-primary">{item.label}</span>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                      </Link>
                    ))}
                  </nav>
                </div>

                {/* Ferramentas */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                    <Plug className="h-4 w-4 text-teal-500" />
                    Ferramentas Extras
                  </h3>
                  <nav className="space-y-1">
                    {[
                      { label: "Digitalizar Fichas", path: "/pacientes/digitalizar", desc: "Fichas de papel para digital" },
                      { label: "Importar Pacientes", path: "/pacientes/importar", desc: "Importacao via CSV" },
                      { label: "Cadastros", path: "/cadastros", desc: "Convenios e categorias" },
                    ].map((item) => (
                      <Link key={item.path} href={item.path} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors group">
                        <div>
                          <span className="text-sm font-medium text-foreground group-hover:text-primary">{item.label}</span>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                      </Link>
                    ))}
                  </nav>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
