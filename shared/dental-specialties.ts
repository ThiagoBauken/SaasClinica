/**
 * Especialidades Odontológicas Reconhecidas pelo CFO
 * Baseado na Resolução CFO 63/2005 e atualizações até 2024
 *
 * Fontes:
 * - https://www.cro-rj.org.br/especialidades
 * - https://cdentista.com/24-especialidades-odontologicas-reconhecidas-pelo-cfo/
 * - Resolução CFO 262/2024 (Odontologia Hospitalar)
 */

// ==========================================
// ESPECIALIDADES ODONTOLÓGICAS CFO
// ==========================================

export const DENTAL_SPECIALTIES = {
  // Especialidades Clínicas
  DENTISTICA: {
    code: 'dentistica',
    name: 'Dentística',
    description: 'Restauração e estética dos dentes, incluindo restaurações estéticas, clareamento dental e facetas',
    keywords: ['restauração', 'clareamento', 'faceta', 'resina', 'estética dental'],
    commonProcedures: ['Restauração em resina', 'Clareamento dental', 'Facetas de porcelana', 'Lentes de contato dental'],
  },
  ENDODONTIA: {
    code: 'endodontia',
    name: 'Endodontia',
    description: 'Tratamento de canais radiculares e manutenção da saúde pulpar',
    keywords: ['canal', 'tratamento de canal', 'dor de dente', 'pulpite', 'necrose'],
    commonProcedures: ['Tratamento de canal', 'Retratamento endodôntico', 'Apicectomia'],
  },
  PERIODONTIA: {
    code: 'periodontia',
    name: 'Periodontia',
    description: 'Tratamento de doenças da gengiva e estruturas de suporte dos dentes',
    keywords: ['gengiva', 'sangramento', 'periodontite', 'gengivite', 'raspagem'],
    commonProcedures: ['Raspagem', 'Cirurgia periodontal', 'Enxerto gengival', 'Tratamento de retração gengival'],
  },
  ORTODONTIA: {
    code: 'ortodontia',
    name: 'Ortodontia',
    description: 'Correção de irregularidades dentais e faciais com aparelhos',
    keywords: ['aparelho', 'ortodontia', 'dente torto', 'alinhador', 'invisalign', 'manutenção'],
    commonProcedures: ['Aparelho fixo', 'Aparelho móvel', 'Alinhadores invisíveis', 'Contenção'],
    isRecurring: true,
    defaultIntervalDays: 30,
  },
  IMPLANTODONTIA: {
    code: 'implantodontia',
    name: 'Implantodontia',
    description: 'Implantação de materiais para suportar próteses na mandíbula e maxila',
    keywords: ['implante', 'pino', 'titânio', 'enxerto ósseo'],
    commonProcedures: ['Implante unitário', 'Implante múltiplo', 'Carga imediata', 'Enxerto ósseo'],
  },
  PROTESE_DENTARIA: {
    code: 'protese_dentaria',
    name: 'Prótese Dentária',
    description: 'Reabilitação oral com próteses fixas, removíveis e totais',
    keywords: ['prótese', 'dentadura', 'ponte', 'coroa', 'pivô'],
    commonProcedures: ['Prótese total', 'Prótese parcial removível', 'Coroa', 'Ponte fixa', 'Protocolo'],
  },

  // Cirurgia
  CIRURGIA_BUCO_MAXILO: {
    code: 'cirurgia_buco_maxilo',
    name: 'Cirurgia e Traumatologia Buco-Maxilo-Faciais',
    description: 'Cirurgias na região da face, boca e maxilares',
    keywords: ['extração', 'siso', 'cirurgia', 'dente incluso', 'trauma'],
    commonProcedures: ['Extração de siso', 'Extração simples', 'Cirurgia ortognática', 'Frenectomia'],
  },

  // Estética e Harmonização
  HARMONIZACAO_OROFACIAL: {
    code: 'harmonizacao_orofacial',
    name: 'Harmonização Orofacial',
    description: 'Procedimentos estéticos faciais incluindo toxina botulínica e preenchimentos',
    keywords: ['botox', 'preenchimento', 'harmonização', 'ácido hialurônico', 'bichectomia', 'lipo de papada'],
    commonProcedures: ['Botox', 'Preenchimento labial', 'Bichectomia', 'Rinomodelação', 'Lipo de papada'],
  },

  // Especialidades Pediátricas
  ODONTOPEDIATRIA: {
    code: 'odontopediatria',
    name: 'Odontopediatria',
    description: 'Atendimento odontológico para crianças e adolescentes',
    keywords: ['criança', 'infantil', 'dente de leite', 'pediatria'],
    commonProcedures: ['Aplicação de flúor', 'Selante', 'Restauração infantil', 'Pulpotomia'],
  },

  // Dor e DTM
  DTM_DOR_OROFACIAL: {
    code: 'dtm_dor_orofacial',
    name: 'Disfunção Temporomandibular e Dor Orofacial',
    description: 'Diagnóstico e tratamento de disfunções da ATM e dores faciais',
    keywords: ['dor', 'ATM', 'bruxismo', 'mandíbula', 'estalo', 'dor de cabeça'],
    commonProcedures: ['Placa de bruxismo', 'Tratamento de DTM', 'Laserterapia'],
  },

  // Radiologia
  RADIOLOGIA_ODONTOLOGICA: {
    code: 'radiologia_odontologica',
    name: 'Radiologia Odontológica e Imaginologia',
    description: 'Exames de imagem e diagnóstico por imagem',
    keywords: ['raio-x', 'radiografia', 'tomografia', 'panorâmica'],
    commonProcedures: ['Radiografia panorâmica', 'Tomografia cone beam', 'Radiografia periapical'],
  },

  // Pacientes Especiais
  PACIENTES_ESPECIAIS: {
    code: 'pacientes_especiais',
    name: 'Odontologia para Pacientes com Necessidades Especiais',
    description: 'Atendimento a pacientes com necessidades especiais de saúde',
    keywords: ['especial', 'deficiência', 'autismo', 'síndrome de down'],
    commonProcedures: ['Atendimento adaptado', 'Sedação consciente'],
  },

  // Saúde Coletiva
  SAUDE_COLETIVA: {
    code: 'saude_coletiva',
    name: 'Saúde Coletiva e da Família',
    description: 'Promoção de saúde bucal coletiva e programas preventivos',
    keywords: ['prevenção', 'coletivo', 'PSF', 'UBS'],
    commonProcedures: ['Profilaxia', 'Educação em saúde bucal', 'Aplicação de flúor coletiva'],
  },

  // Patologia
  PATOLOGIA_BUCAL: {
    code: 'patologia_bucal',
    name: 'Patologia Bucal',
    description: 'Diagnóstico de doenças da boca através de análise clínica e laboratorial',
    keywords: ['lesão', 'biópsia', 'câncer bucal', 'ferida'],
    commonProcedures: ['Biópsia', 'Diagnóstico de lesões', 'Acompanhamento de lesões'],
  },

  // Estomatologia
  ESTOMATOLOGIA: {
    code: 'estomatologia',
    name: 'Estomatologia',
    description: 'Prevenção, diagnóstico e tratamento de doenças da boca',
    keywords: ['boca', 'mucosa', 'afta', 'herpes', 'candidíase'],
    commonProcedures: ['Tratamento de aftas', 'Diagnóstico de lesões bucais'],
  },

  // Odontologia Legal
  ODONTOLOGIA_LEGAL: {
    code: 'odontologia_legal',
    name: 'Odontologia Legal',
    description: 'Perícia odontológica para fins legais e forenses',
    keywords: ['perícia', 'laudo', 'forense', 'identificação'],
    commonProcedures: ['Perícia odontológica', 'Identificação humana'],
  },

  // Odontologia do Trabalho
  ODONTOLOGIA_TRABALHO: {
    code: 'odontologia_trabalho',
    name: 'Odontologia do Trabalho',
    description: 'Promoção da saúde bucal no ambiente de trabalho',
    keywords: ['ASO', 'admissional', 'demissional', 'periódico'],
    commonProcedures: ['Exame admissional', 'Exame demissional', 'Exame periódico'],
  },

  // Odontogeriatria
  ODONTOGERIATRIA: {
    code: 'odontogeriatria',
    name: 'Odontogeriatria',
    description: 'Atendimento odontológico especializado para idosos',
    keywords: ['idoso', 'terceira idade', 'geriátrico'],
    commonProcedures: ['Prótese para idosos', 'Tratamento de xerostomia'],
  },

  // Odontologia do Esporte
  ODONTOLOGIA_ESPORTE: {
    code: 'odontologia_esporte',
    name: 'Odontologia do Esporte',
    description: 'Prevenção e tratamento de lesões bucais em atletas',
    keywords: ['atleta', 'esporte', 'protetor bucal'],
    commonProcedures: ['Protetor bucal personalizado', 'Tratamento de trauma esportivo'],
  },

  // Acupuntura
  ACUPUNTURA: {
    code: 'acupuntura',
    name: 'Acupuntura',
    description: 'Tratamento complementar com acupuntura odontológica',
    keywords: ['acupuntura', 'agulha', 'dor'],
    commonProcedures: ['Acupuntura para dor orofacial', 'Acupuntura para DTM'],
  },

  // Homeopatia
  HOMEOPATIA: {
    code: 'homeopatia',
    name: 'Homeopatia',
    description: 'Tratamento odontológico com princípios homeopáticos',
    keywords: ['homeopatia', 'natural', 'alternativo'],
    commonProcedures: ['Tratamento homeopático'],
  },

  // Hipnose
  HIPNOSE: {
    code: 'hipnose',
    name: 'Hipnose',
    description: 'Uso de hipnose como coadjuvante no tratamento odontológico',
    keywords: ['hipnose', 'ansiedade', 'medo de dentista'],
    commonProcedures: ['Hipnose para controle de ansiedade'],
  },

  // Ortopedia Funcional
  ORTOPEDIA_FUNCIONAL: {
    code: 'ortopedia_funcional',
    name: 'Ortopedia Funcional dos Maxilares',
    description: 'Tratamento de desequilíbrios ósseos e musculares da face',
    keywords: ['ortopedia', 'maxilar', 'aparelho funcional'],
    commonProcedures: ['Aparelhos ortopédicos funcionais'],
  },

  // Odontologia Hospitalar (novo 2024)
  ODONTOLOGIA_HOSPITALAR: {
    code: 'odontologia_hospitalar',
    name: 'Odontologia Hospitalar',
    description: 'Atendimento odontológico em ambiente hospitalar',
    keywords: ['hospital', 'UTI', 'internação', 'centro cirúrgico'],
    commonProcedures: ['Atendimento hospitalar', 'Cirurgia sob anestesia geral'],
  },
} as const;

// Lista simples para selects
export const DENTAL_SPECIALTIES_LIST = Object.values(DENTAL_SPECIALTIES).map(s => ({
  code: s.code,
  name: s.name,
  description: s.description,
}));

// ==========================================
// CATEGORIAS DE SERVIÇOS
// ==========================================

export const SERVICE_CATEGORIES = {
  PREVENTIVO: {
    code: 'preventivo',
    name: 'Prevenção',
    description: 'Serviços preventivos como limpeza, flúor e orientações',
    keywords: ['limpeza', 'profilaxia', 'flúor', 'prevenção'],
  },
  RESTAURADOR: {
    code: 'restaurador',
    name: 'Restaurador',
    description: 'Restaurações e tratamentos conservadores',
    keywords: ['restauração', 'obturação', 'resina'],
  },
  CIRURGICO: {
    code: 'cirurgico',
    name: 'Cirúrgico',
    description: 'Extrações e procedimentos cirúrgicos',
    keywords: ['extração', 'cirurgia', 'siso'],
  },
  ESTETICO: {
    code: 'estetico',
    name: 'Estética',
    description: 'Procedimentos estéticos dentais e faciais',
    keywords: ['clareamento', 'faceta', 'lente', 'botox', 'harmonização'],
  },
  REABILITADOR: {
    code: 'reabilitador',
    name: 'Reabilitação',
    description: 'Próteses, implantes e reabilitação oral',
    keywords: ['prótese', 'implante', 'coroa', 'dentadura'],
  },
  ORTODONTICO: {
    code: 'ortodontico',
    name: 'Ortodontia',
    description: 'Aparelhos e alinhadores',
    keywords: ['aparelho', 'ortodontia', 'alinhador'],
  },
  EMERGENCIA: {
    code: 'emergencia',
    name: 'Emergência',
    description: 'Atendimentos de urgência',
    keywords: ['urgência', 'emergência', 'dor', 'trauma'],
  },
} as const;

// ==========================================
// TIPOS DE CLÍNICA
// ==========================================

export const CLINIC_TYPES = {
  CONSULTORIO_INDIVIDUAL: {
    code: 'consultorio_individual',
    name: 'Consultório Individual',
    description: 'Um dentista, uma sala, atendimento personalizado',
    typicalRooms: 1,
    typicalDentists: 1,
    typicalSecretaries: 1,
  },
  CONSULTORIO_DUPLO: {
    code: 'consultorio_duplo',
    name: 'Consultório Duplo',
    description: 'Dois dentistas compartilhando estrutura',
    typicalRooms: 2,
    typicalDentists: 2,
    typicalSecretaries: 1,
  },
  CLINICA_PEQUENA: {
    code: 'clinica_pequena',
    name: 'Clínica Pequena',
    description: 'Clínica com 2-4 consultórios e equipe reduzida',
    typicalRooms: 3,
    typicalDentists: 3,
    typicalSecretaries: 2,
  },
  CLINICA_MEDIA: {
    code: 'clinica_media',
    name: 'Clínica Média',
    description: 'Clínica com múltiplas especialidades e salas',
    typicalRooms: 5,
    typicalDentists: 5,
    typicalSecretaries: 3,
  },
  CLINICA_GRANDE: {
    code: 'clinica_grande',
    name: 'Clínica Grande',
    description: 'Clínica completa com todas especialidades',
    typicalRooms: 10,
    typicalDentists: 10,
    typicalSecretaries: 5,
  },
  FRANQUIA: {
    code: 'franquia',
    name: 'Franquia',
    description: 'Franquia de rede odontológica',
    typicalRooms: 6,
    typicalDentists: 8,
    typicalSecretaries: 4,
  },
} as const;

// ==========================================
// REGRAS DE NEGÓCIO
// ==========================================

export const BUSINESS_RULES = {
  // Política de preços
  PRICE_DISCLOSURE: {
    ALWAYS: 'always', // Sempre informa preço
    UPON_REQUEST: 'upon_request', // Só quando perguntam
    EVALUATION_FIRST: 'evaluation_first', // Só após avaliação
    NEVER_CHAT: 'never_chat', // Nunca por chat, só presencial
  },

  // Política de agendamento
  SCHEDULING_POLICY: {
    IMMEDIATE: 'immediate', // Agenda imediatamente pelo chat
    CONFIRMATION_REQUIRED: 'confirmation_required', // Precisa confirmar por telefone
    IN_PERSON_ONLY: 'in_person_only', // Só agendamento presencial
    CALL_BACK: 'call_back', // Retorna ligação para agendar
  },

  // Formas de pagamento
  PAYMENT_METHODS: {
    PIX: 'pix',
    CREDIT_CARD: 'credit_card',
    DEBIT_CARD: 'debit_card',
    CASH: 'cash',
    INSTALLMENTS: 'installments',
    DENTAL_PLAN: 'dental_plan',
    FINANCING: 'financing',
  },
} as const;

// ==========================================
// CONFIGURAÇÃO DE SALA/CONSULTÓRIO
// ==========================================

export interface RoomConfig {
  id: number;
  name: string;
  type: 'general' | 'surgery' | 'orthodontics' | 'implants' | 'pediatric' | 'radiology';
  specialties: string[]; // códigos de especialidades que podem ser atendidas
  equipment: string[]; // equipamentos disponíveis
  canParallel: boolean; // pode ter atendimentos simultâneos em outras salas
}

// ==========================================
// CONFIGURAÇÃO DE PROFISSIONAL
// ==========================================

export interface ProfessionalConfig {
  id: number;
  name: string;
  cro: string;
  mainSpecialty: string; // especialidade principal
  additionalSpecialties: string[]; // especialidades adicionais
  workDays: number[]; // 0-6 (domingo-sábado)
  workHours: { start: string; end: string; lunch?: { start: string; end: string } };
  roomPreference?: number; // sala preferida
  canRemote?: boolean; // pode fazer avaliação remota
}

// ==========================================
// TIPOS DE EXPORTAÇÃO
// ==========================================

export type DentalSpecialtyCode = keyof typeof DENTAL_SPECIALTIES;
export type ServiceCategoryCode = keyof typeof SERVICE_CATEGORIES;
export type ClinicTypeCode = keyof typeof CLINIC_TYPES;
export type PriceDisclosure = (typeof BUSINESS_RULES.PRICE_DISCLOSURE)[keyof typeof BUSINESS_RULES.PRICE_DISCLOSURE];
export type SchedulingPolicy = (typeof BUSINESS_RULES.SCHEDULING_POLICY)[keyof typeof BUSINESS_RULES.SCHEDULING_POLICY];
export type PaymentMethod = (typeof BUSINESS_RULES.PAYMENT_METHODS)[keyof typeof BUSINESS_RULES.PAYMENT_METHODS];
