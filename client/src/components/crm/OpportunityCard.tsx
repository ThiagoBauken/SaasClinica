import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    MoreVertical,
    Phone,
    MessageSquare,
    Calendar,
    GripVertical,
    User,
    DollarSign,
    Clock,
    Trash2,
    Edit,
    Bot,
    Zap,
    Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatCurrency } from '@/lib/utils';
import { Opportunity, AI_STAGE_LABELS } from '@/types/crm';

interface OpportunityCardProps {
    opportunity: Opportunity;
    isDragging?: boolean;
    onEdit?: (opportunity: Opportunity) => void;
    onDelete?: (opportunityId: number) => void;
    onViewTimeline?: (opportunity: Opportunity) => void;
}

export function OpportunityCard({ opportunity, isDragging, onEdit, onDelete, onViewTimeline }: OpportunityCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: opportunity.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const treatmentLabels: Record<string, string> = {
        implante: 'Implante',
        ortodontia: 'Ortodontia',
        protese: 'Protese',
        clareamento: 'Clareamento',
        limpeza: 'Limpeza',
        restauracao: 'Restauracao',
        canal: 'Canal',
        extracao: 'Extracao',
        harmonizacao: 'Harmonizacao',
        outros: 'Outros',
    };

    const sourceLabels: Record<string, string> = {
        whatsapp: 'WhatsApp',
        instagram: 'Instagram',
        google: 'Google',
        indicacao: 'Indicacao',
        site: 'Site',
        telefone: 'Telefone',
    };

    const chatStatusLabel: Record<string, string> = {
        active: 'IA ativa',
        waiting_human: 'Aguardando humano',
        closed: 'Encerrada',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`bg-card border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow group ${
                opportunity.hasWhatsApp ? 'border-l-2 border-l-green-500' : ''
            }`}
        >
            <div className="flex items-start justify-between mb-2">
                <div
                    className="flex items-center gap-2 cursor-grab active:cursor-grabbing flex-1 min-w-0"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    <h4 className="font-medium text-sm text-foreground line-clamp-1">
                        {opportunity.title}
                    </h4>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {onViewTimeline && (
                            <DropdownMenuItem onClick={() => onViewTimeline(opportunity)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver Timeline
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => onEdit?.(opportunity)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                            <Phone className="h-4 w-4 mr-2" />
                            Ligar
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            <MessageSquare className="h-4 w-4 mr-2" />
                            WhatsApp
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            <Calendar className="h-4 w-4 mr-2" />
                            Agendar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => onDelete?.(opportunity.id)}
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="space-y-2">
                {/* Nome do paciente/lead */}
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <User className="h-3 w-3 flex-shrink-0" />
                    <span className="line-clamp-1">
                        {opportunity.patientName || opportunity.leadName || 'Sem nome'}
                    </span>
                </div>

                {/* WhatsApp AI Stage indicator */}
                {opportunity.hasWhatsApp && opportunity.aiStage && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5">
                                    <div className="flex items-center gap-1 bg-green-500/10 text-green-700 dark:text-green-400 rounded-full px-2 py-0.5 text-xs font-medium">
                                        <Bot className="h-3 w-3" />
                                        <span>{opportunity.aiStageLabel || AI_STAGE_LABELS[opportunity.aiStage] || opportunity.aiStage}</span>
                                    </div>
                                    {opportunity.chatStatus && (
                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                            opportunity.chatStatus === 'active' ? 'bg-green-500 animate-pulse' :
                                            opportunity.chatStatus === 'waiting_human' ? 'bg-orange-500 animate-pulse' :
                                            'bg-gray-400'
                                        }`} />
                                    )}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>IA: {opportunity.aiStageLabel || AI_STAGE_LABELS[opportunity.aiStage]}</p>
                                {opportunity.chatStatus && (
                                    <p className="text-xs opacity-80">Chat: {chatStatusLabel[opportunity.chatStatus] || opportunity.chatStatus}</p>
                                )}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {/* WhatsApp badge (if linked but no AI stage yet) */}
                {opportunity.hasWhatsApp && !opportunity.aiStage && (
                    <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <Zap className="h-3 w-3" />
                        <span>Via WhatsApp</span>
                    </div>
                )}

                {/* Valor */}
                {opportunity.estimatedValue && parseFloat(opportunity.estimatedValue) > 0 && (
                    <div className="flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400">
                        <DollarSign className="h-3 w-3" />
                        {formatCurrency(parseFloat(opportunity.estimatedValue))}
                    </div>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                    {opportunity.treatmentType && (
                        <Badge variant="secondary" className="text-xs">
                            {treatmentLabels[opportunity.treatmentType] || opportunity.treatmentType}
                        </Badge>
                    )}
                    {opportunity.leadSource && (
                        <Badge variant="outline" className="text-xs">
                            {sourceLabels[opportunity.leadSource] || opportunity.leadSource}
                        </Badge>
                    )}
                    {/* Probability indicator */}
                    {opportunity.probability != null && opportunity.probability > 0 && (
                        <Badge
                            variant="outline"
                            className={`text-xs ${
                                opportunity.probability >= 80 ? 'border-green-500 text-green-600' :
                                opportunity.probability >= 50 ? 'border-yellow-500 text-yellow-600' :
                                'border-gray-400 text-gray-500'
                            }`}
                        >
                            {opportunity.probability}%
                        </Badge>
                    )}
                </div>

                {/* Proximo follow-up */}
                {opportunity.nextFollowUpAt && (
                    <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                        <Clock className="h-3 w-3" />
                        Follow-up: {new Date(opportunity.nextFollowUpAt).toLocaleDateString('pt-BR')}
                    </div>
                )}
                
                {/* Proxima consulta */}
                {opportunity.nextAppointmentDate && (
                    <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                        <Calendar className="h-3 w-3" />
                        Consulta: {new Date(opportunity.nextAppointmentDate).toLocaleDateString('pt-BR')} {new Date(opportunity.nextAppointmentDate).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}
                    </div>
                )}

                {/* Indicador de movimentação: automática vs manual */}
                {opportunity.lastAction && (
                    <div className={`flex items-center gap-1 text-[10px] ${
                        opportunity.lastAction === 'auto_progressed'
                            ? 'text-green-600 dark:text-green-400'
                            : opportunity.lastAction === 'created'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-muted-foreground'
                    }`}>
                        {opportunity.lastAction === 'auto_progressed' ? (
                            <>
                                <Bot className="h-3 w-3" />
                                <span>Movido pela IA</span>
                            </>
                        ) : opportunity.lastAction === 'stage_changed' ? (
                            <>
                                <Edit className="h-3 w-3" />
                                <span>Movido manualmente</span>
                            </>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
}
