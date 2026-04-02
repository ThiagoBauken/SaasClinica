export interface Stage {
    id: number;
    name: string;
    code: string;
    color: string;
    order: number;
    isWon: boolean;
    isLost: boolean;
    automationTrigger?: string | null;
    opportunities: Opportunity[];
    totalValue: number;
    count: number;
}

export interface Opportunity {
    id: number;
    title: string;
    patientId?: number;
    patientName?: string;
    patientPhone?: string;
    leadName?: string;
    leadPhone?: string;
    leadEmail?: string;
    leadSource?: string;
    treatmentType?: string;
    estimatedValue?: string;
    probability?: number;
    assignedUserName?: string;
    stageId: number;
    lastContactAt?: string;
    nextFollowUpAt?: string;
    notes?: string;
    createdAt: string;
    // WhatsApp / AI fields
    chatSessionId?: number | null;
    aiStage?: string | null;
    aiStageLabel?: string | null;
    aiStageUpdatedAt?: string | null;
    hasWhatsApp?: boolean;
    chatStatus?: string | null;
    chatLastMessage?: string | null;
    // Last movement reason
    lastAction?: string | null;
    lastActionDescription?: string | null;
    // Appointment info
    nextAppointmentDate?: string | null;
}

export interface KanbanData {
    stages: Stage[];
    summary: {
        totalOpportunities: number;
        totalValue: number;
        wonValue: number;
        whatsappActive?: number;
    };
}

export interface OpportunityTimeline {
    opportunity: Opportunity;
    history: TimelineEntry[];
    recentMessages: ChatMessage[];
}

export interface TimelineEntry {
    id: number;
    action: string;
    description: string;
    metadata?: Record<string, any>;
    createdAt: string;
    fromStageName?: string;
    toStageName?: string;
}

export interface ChatMessage {
    id: number;
    sessionId: number;
    role: string;
    content: string;
    messageType: string;
    processedBy?: string;
    createdAt: string;
}

export const AI_STAGE_LABELS: Record<string, string> = {
    first_contact: 'Primeiro Contato',
    scheduling: 'Agendamento',
    confirmation: 'Confirmação',
    consultation_done: 'Consulta Realizada',
    payment_done: 'Pagamento Realizado',
};

export const AI_STAGE_COLORS: Record<string, string> = {
    first_contact: 'bg-indigo-500',
    scheduling: 'bg-blue-500',
    confirmation: 'bg-yellow-500',
    consultation_done: 'bg-emerald-500',
    payment_done: 'bg-purple-500',
};
