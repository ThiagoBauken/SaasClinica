/**
 * Fonte da verdade dos planos para a landing/precos.
 *
 * Espelha o seed em `migrations/004a_billing_system.sql:143-200` e a
 * matriz de features em `server/billing/feature-gate.ts:15-49`.
 *
 * Mantemos aqui (e não fetchamos da API) porque a página é pública,
 * de marketing, e os 3 tiers são estáveis. Se o seed mudar, atualizar
 * este arquivo manualmente.
 */

export type PlanId = "basic" | "professional" | "enterprise";

export interface PlanData {
  id: PlanId;
  name: string;
  tagline: string;
  monthlyPrice: number;
  yearlyPrice: number;
  trialDays: number;
  popular: boolean;
  limits: {
    users: string;
    patients: string;
    appointments: string;
    automations: string;
    storageGB: string;
  };
  highlights: string[];
  ctaLabel: string;
}

export const PLANS: PlanData[] = [
  {
    id: "basic",
    name: "Básico",
    tagline: "Para clínicas pequenas que estão começando",
    monthlyPrice: 97,
    yearlyPrice: 970,
    trialDays: 14,
    popular: false,
    limits: {
      users: "3 usuários",
      patients: "Até 100 pacientes",
      appointments: "300 agendamentos/mês",
      automations: "3 automações",
      storageGB: "5 GB de armazenamento",
    },
    highlights: [
      "Agenda online completa",
      "Cadastro de pacientes",
      "Odontograma digital",
      "Financeiro básico",
      "Relatórios essenciais",
      "Suporte por e-mail",
    ],
    ctaLabel: "Começar grátis",
  },
  {
    id: "professional",
    name: "Profissional",
    tagline: "Para clínicas em crescimento — o mais escolhido",
    monthlyPrice: 197,
    yearlyPrice: 1970,
    trialDays: 14,
    popular: true,
    limits: {
      users: "10 usuários",
      patients: "Até 500 pacientes",
      appointments: "1.000 agendamentos/mês",
      automations: "10 automações",
      storageGB: "20 GB de armazenamento",
    },
    highlights: [
      "Tudo do Básico",
      "WhatsApp com IA Claude (chatbot)",
      "Lembretes automáticos",
      "CRM Kanban com auto-progressão",
      "Financeiro completo + cobranças",
      "Próteses, comissões, relatórios PDF",
      "Importação e digitalização de prontuários",
      "Google Calendar + assinatura digital",
      "Suporte prioritário",
    ],
    ctaLabel: "Começar trial de 14 dias",
  },
  {
    id: "enterprise",
    name: "Empresarial",
    tagline: "Para redes e franquias — solução sob medida",
    monthlyPrice: 497,
    yearlyPrice: 4970,
    trialDays: 30,
    popular: false,
    limits: {
      users: "Usuários ilimitados",
      patients: "Pacientes ilimitados",
      appointments: "Agendamentos ilimitados",
      automations: "Automações ilimitadas",
      storageGB: "200 GB de armazenamento",
    },
    highlights: [
      "Tudo do Profissional",
      "Multi-clínicas / multi-franquia",
      "API REST + Webhooks customizados",
      "White-label / branding próprio",
      "Audit log completo",
      "Export de dados estruturado",
      "SLA dedicado",
      "Onboarding personalizado",
    ],
    ctaLabel: "Falar com vendas",
  },
];

export interface FeatureRow {
  group: string;
  feature: string;
  basic: boolean | string;
  professional: boolean | string;
  enterprise: boolean | string;
}

/**
 * Tabela de comparativo expandida — usada na página /precos.
 * Espelha PLAN_FEATURES em server/billing/feature-gate.ts.
 */
export const FEATURE_MATRIX: FeatureRow[] = [
  // Núcleo
  { group: "Núcleo", feature: "Cadastro de pacientes", basic: true, professional: true, enterprise: true },
  { group: "Núcleo", feature: "Agendamentos + calendário", basic: true, professional: true, enterprise: true },
  { group: "Núcleo", feature: "Odontograma digital", basic: true, professional: true, enterprise: true },
  { group: "Núcleo", feature: "Limite de usuários", basic: "3", professional: "10", enterprise: "Ilimitado" },
  { group: "Núcleo", feature: "Limite de pacientes", basic: "100", professional: "500", enterprise: "Ilimitado" },
  { group: "Núcleo", feature: "Armazenamento", basic: "5 GB", professional: "20 GB", enterprise: "200 GB" },

  // Financeiro
  { group: "Financeiro", feature: "Fluxo de caixa básico", basic: true, professional: true, enterprise: true },
  { group: "Financeiro", feature: "Contas a pagar/receber", basic: true, professional: true, enterprise: true },
  { group: "Financeiro", feature: "Parcelamentos + cobranças", basic: false, professional: true, enterprise: true },
  { group: "Financeiro", feature: "Comissões por profissional", basic: false, professional: true, enterprise: true },
  { group: "Financeiro", feature: "Conciliação bancária", basic: false, professional: true, enterprise: true },

  // WhatsApp & IA
  { group: "WhatsApp & IA", feature: "Lembretes automáticos via WhatsApp", basic: false, professional: true, enterprise: true },
  { group: "WhatsApp & IA", feature: "Chatbot com IA Claude (24/7)", basic: false, professional: true, enterprise: true },
  { group: "WhatsApp & IA", feature: "Auto-progressão de CRM via IA", basic: false, professional: true, enterprise: true },
  { group: "WhatsApp & IA", feature: "Confirmação automática de consultas", basic: false, professional: true, enterprise: true },
  { group: "WhatsApp & IA", feature: "Cobrança automatizada de inadimplentes", basic: false, professional: true, enterprise: true },

  // Produtividade
  { group: "Produtividade", feature: "Importação em massa de pacientes", basic: false, professional: true, enterprise: true },
  { group: "Produtividade", feature: "Digitalização/OCR de prontuários", basic: false, professional: true, enterprise: true },
  { group: "Produtividade", feature: "Anamnese digital + portal do paciente", basic: false, professional: true, enterprise: true },
  { group: "Produtividade", feature: "Assinatura digital de documentos", basic: false, professional: true, enterprise: true },
  { group: "Produtividade", feature: "Integração Google Calendar", basic: false, professional: true, enterprise: true },
  { group: "Produtividade", feature: "Controle de próteses (kanban)", basic: false, professional: true, enterprise: true },

  // Relatórios
  { group: "Relatórios", feature: "Relatórios básicos", basic: true, professional: true, enterprise: true },
  { group: "Relatórios", feature: "Relatórios avançados + PDF", basic: false, professional: true, enterprise: true },
  { group: "Relatórios", feature: "Analytics avançado", basic: false, professional: true, enterprise: true },

  // Empresa
  { group: "Empresa", feature: "Multi-clínicas / multi-franquia", basic: false, professional: false, enterprise: true },
  { group: "Empresa", feature: "API REST + Webhooks", basic: false, professional: false, enterprise: true },
  { group: "Empresa", feature: "White-label (branding próprio)", basic: false, professional: false, enterprise: true },
  { group: "Empresa", feature: "Audit log completo", basic: false, professional: false, enterprise: true },
  { group: "Empresa", feature: "Export estruturado de dados", basic: false, professional: false, enterprise: true },
  { group: "Empresa", feature: "SLA dedicado + onboarding personalizado", basic: false, professional: false, enterprise: true },

  // Segurança (em todos)
  { group: "Segurança", feature: "Multi-tenant com RLS", basic: true, professional: true, enterprise: true },
  { group: "Segurança", feature: "Criptografia de dados sensíveis", basic: true, professional: true, enterprise: true },
  { group: "Segurança", feature: "LGPD compliant", basic: true, professional: true, enterprise: true },
  { group: "Segurança", feature: "2FA TOTP", basic: true, professional: true, enterprise: true },
  { group: "Segurança", feature: "Backup automático diário", basic: true, professional: true, enterprise: true },
];

export const FAQ_GENERAL: { q: string; a: string }[] = [
  {
    q: "Quanto tempo dura o trial gratuito?",
    a: "São 14 dias de teste no plano Básico ou Profissional, e 30 dias no Empresarial. Sem cartão de crédito durante o trial — você só insere os dados de pagamento se decidir continuar.",
  },
  {
    q: "Posso cancelar a qualquer momento?",
    a: "Sim. Você cancela direto no painel, sem multas e sem ligação para suporte. O acesso continua até o fim do ciclo já pago.",
  },
  {
    q: "Os dados dos meus pacientes ficam seguros?",
    a: "Sim. Criptografamos campos sensíveis em repouso, isolamos os dados de cada clínica em nível de banco (Row-Level Security) e mantemos auditoria LGPD completa. Backups diários automáticos.",
  },
  {
    q: "Como funciona a IA do WhatsApp?",
    a: "Usamos o Claude da Anthropic, que conversa com seus pacientes 24/7 com contexto da sua clínica. O agente tem 19 ferramentas: agenda consultas, confirma, reagenda, responde dúvidas e move oportunidades no CRM automaticamente.",
  },
  {
    q: "Vocês ajudam a migrar minha base atual?",
    a: "Sim. Você pode importar pacientes via planilha XLSX/CSV, e usamos OCR para digitalizar prontuários físicos. No plano Empresarial, fazemos a migração completa com nosso time.",
  },
  {
    q: "Quais formas de pagamento são aceitas?",
    a: "Cartão de crédito (Stripe), Pix, boleto via Mercado Pago e até criptomoedas via NOWPayments. Você escolhe na hora de assinar.",
  },
  {
    q: "Funciona com várias clínicas / franquia?",
    a: "Sim, no plano Empresarial. Você gerencia múltiplas unidades em um único painel, com permissões granulares por usuário.",
  },
  {
    q: "Preciso instalar alguma coisa?",
    a: "Não. DentCare roda 100% no navegador (e tem PWA — funciona como app no celular). Compatível com computador, tablet e smartphone.",
  },
  {
    q: "Tem integração com Google Calendar?",
    a: "Sim, a partir do plano Profissional. Sincronização bidirecional automática.",
  },
  {
    q: "E se eu superar o limite do meu plano?",
    a: "Te avisamos por e-mail antes de bater o limite. Você pode fazer upgrade direto no painel — a diferença é cobrada proporcionalmente.",
  },
];

export const FAQ_PRICING: { q: string; a: string }[] = [
  {
    q: "Os preços já incluem impostos?",
    a: "Sim. Os valores exibidos são finais para clínicas no Brasil. Emitimos nota fiscal eletrônica todo mês.",
  },
  {
    q: "Como funciona o desconto anual?",
    a: "No plano anual você paga 10 mensalidades em vez de 12 — economia de aproximadamente 17%. O ciclo começa após o trial.",
  },
  {
    q: "Posso trocar de plano depois?",
    a: "Sim, a qualquer momento. Upgrade é imediato; downgrade vale a partir do próximo ciclo.",
  },
  {
    q: "O que acontece se eu não pagar?",
    a: "Mandamos lembretes amigáveis (sistema de dunning) por 7 dias. Após isso, o acesso fica em modo somente-leitura por mais 7 dias antes de ser suspenso. Seus dados nunca são apagados sem aviso.",
  },
  {
    q: "Existe taxa de setup ou cancelamento?",
    a: "Não. Sem fidelidade, sem multa, sem taxas escondidas.",
  },
  {
    q: "Posso testar antes de pagar?",
    a: "Sim — 14 dias gratuitos sem precisar de cartão de crédito.",
  },
];
