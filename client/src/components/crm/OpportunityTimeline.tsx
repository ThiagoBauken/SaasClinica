/**
 * OpportunityTimeline - Side panel showing opportunity history and chat messages
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    X,
    Bot,
    User,
    ArrowRight,
    MessageSquare,
    Clock,
    Phone,
    DollarSign,
    Calendar,
    Loader2,
    Zap,
    History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Opportunity, OpportunityTimeline as TimelineData, AI_STAGE_LABELS } from '@/types/crm';

interface OpportunityTimelinePanelProps {
    opportunity: Opportunity;
    onClose: () => void;
}

export function OpportunityTimelinePanel({ opportunity, onClose }: OpportunityTimelinePanelProps) {
    const { data, isLoading } = useQuery<TimelineData>({
        queryKey: ['crm-timeline', opportunity.id],
        queryFn: async () => {
            const res = await fetch(`/api/v1/crm/opportunities/${opportunity.id}/timeline`, {
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Erro ao carregar timeline');
            return res.json();
        },
    });

    return (
        <div className="w-[400px] border-l bg-background flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between">
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{opportunity.title}</h3>
                    <p className="text-xs text-muted-foreground">
                        {opportunity.patientName || opportunity.leadName || opportunity.leadPhone}
                    </p>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0">
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* AI Stage Progress */}
            {opportunity.aiStage && (
                <div className="p-4 border-b bg-muted/30">
                    <div className="text-xs font-medium text-muted-foreground mb-2">Progresso da IA</div>
                    <AIStageProgress currentStage={opportunity.aiStage} />
                </div>
            )}

            {/* Content */}
            <ScrollArea className="flex-1">
                {isLoading ? (
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : (
                    <div className="p-4 space-y-4">
                        {/* Quick Info */}
                        <div className="grid grid-cols-2 gap-2">
                            {opportunity.leadPhone && (
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <Phone className="h-3.5 w-3.5" />
                                    <span className="truncate">{opportunity.leadPhone}</span>
                                </div>
                            )}
                            {opportunity.estimatedValue && parseFloat(opportunity.estimatedValue) > 0 && (
                                <div className="flex items-center gap-1.5 text-sm text-green-600">
                                    <DollarSign className="h-3.5 w-3.5" />
                                    <span>R$ {parseFloat(opportunity.estimatedValue).toFixed(2)}</span>
                                </div>
                            )}
                        </div>

                        <Separator />

                        {/* History Timeline */}
                        <div>
                            <h4 className="text-sm font-medium flex items-center gap-1.5 mb-3">
                                <History className="h-4 w-4" />
                                Historico
                            </h4>
                            <div className="space-y-3">
                                {data?.history?.map((entry) => (
                                    <div key={entry.id} className="flex gap-3">
                                        <div className="flex flex-col items-center">
                                            <div className={`w-2 h-2 rounded-full mt-1.5 ${
                                                entry.action === 'auto_progressed' ? 'bg-green-500' :
                                                entry.action === 'created' ? 'bg-blue-500' :
                                                entry.action === 'stage_changed' ? 'bg-yellow-500' :
                                                'bg-gray-400'
                                            }`} />
                                            <div className="w-px flex-1 bg-border" />
                                        </div>
                                        <div className="pb-3 flex-1 min-w-0">
                                            <p className="text-sm">{entry.description}</p>
                                            {entry.fromStageName && entry.toStageName && (
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                                    <span>{entry.fromStageName}</span>
                                                    <ArrowRight className="h-3 w-3" />
                                                    <span>{entry.toStageName}</span>
                                                </div>
                                            )}
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {entry.createdAt && formatDistanceToNow(new Date(entry.createdAt), {
                                                    addSuffix: true,
                                                    locale: ptBR,
                                                })}
                                            </p>
                                            {entry.action === 'auto_progressed' && (
                                                <Badge variant="outline" className="text-xs mt-1 bg-green-500/10 text-green-600 border-green-500/30">
                                                    <Bot className="h-3 w-3 mr-1" />
                                                    Automatico
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {(!data?.history || data.history.length === 0) && (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        Nenhum historico ainda
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Recent Chat Messages */}
                        {data?.recentMessages && data.recentMessages.length > 0 && (
                            <>
                                <Separator />
                                <div>
                                    <h4 className="text-sm font-medium flex items-center gap-1.5 mb-3">
                                        <MessageSquare className="h-4 w-4" />
                                        Mensagens Recentes
                                    </h4>
                                    <div className="space-y-2">
                                        {data.recentMessages.slice(-10).map((msg) => (
                                            <div
                                                key={msg.id}
                                                className={`text-sm rounded-lg p-2 ${
                                                    msg.role === 'user'
                                                        ? 'bg-muted text-foreground'
                                                        : 'bg-primary/10 text-foreground'
                                                }`}
                                            >
                                                <div className="flex items-center gap-1 mb-0.5">
                                                    {msg.role === 'user' ? (
                                                        <User className="h-3 w-3 text-muted-foreground" />
                                                    ) : (
                                                        <Bot className="h-3 w-3 text-green-600" />
                                                    )}
                                                    <span className="text-xs text-muted-foreground">
                                                        {msg.role === 'user' ? 'Paciente' : msg.processedBy === 'human' ? 'Secretaria' : 'IA'}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground ml-auto">
                                                        {format(new Date(msg.createdAt), 'HH:mm', { locale: ptBR })}
                                                    </span>
                                                </div>
                                                <p className="text-xs line-clamp-3">{msg.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}

/** Visual progress bar for AI stages */
function AIStageProgress({ currentStage }: { currentStage: string }) {
    const stages = [
        { key: 'first_contact', label: 'Contato' },
        { key: 'scheduling', label: 'Agendamento' },
        { key: 'confirmation', label: 'Confirmacao' },
        { key: 'consultation_done', label: 'Consulta' },
        { key: 'payment_done', label: 'Pagamento' },
    ];

    const currentIndex = stages.findIndex(s => s.key === currentStage);

    return (
        <div className="flex items-center gap-1">
            {stages.map((stage, index) => {
                const isPast = index < currentIndex;
                const isCurrent = index === currentIndex;
                const isFuture = index > currentIndex;

                return (
                    <React.Fragment key={stage.key}>
                        <div className="flex flex-col items-center flex-1">
                            <div className={`w-full h-1.5 rounded-full transition-colors ${
                                isPast ? 'bg-green-500' :
                                isCurrent ? 'bg-green-500 animate-pulse' :
                                'bg-muted-foreground/20'
                            }`} />
                            <span className={`text-[10px] mt-1 ${
                                isCurrent ? 'text-green-600 font-medium' :
                                isPast ? 'text-muted-foreground' :
                                'text-muted-foreground/50'
                            }`}>
                                {stage.label}
                            </span>
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
    );
}
