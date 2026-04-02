import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { Stage, Opportunity } from '@/types/crm';
import { OpportunityCard } from './OpportunityCard';
import { Bot } from 'lucide-react';

interface KanbanColumnProps {
    stage: Stage;
    onEditOpportunity?: (opportunity: Opportunity) => void;
    onDeleteOpportunity?: (opportunityId: number) => void;
    onViewTimeline?: (opportunity: Opportunity) => void;
}

export function KanbanColumn({ stage, onEditOpportunity, onDeleteOpportunity, onViewTimeline }: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: `stage-${stage.id}`,
        data: { stageId: stage.id },
    });

    const whatsappCount = stage.opportunities.filter(o => o.hasWhatsApp).length;

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col min-w-[290px] max-w-[290px] bg-muted/50 rounded-lg border border-border h-full transition-colors ${
                isOver ? 'ring-2 ring-primary/50 bg-primary/5' : ''
            }`}
        >
            {/* Header da Coluna */}
            <div
                className="p-3 rounded-t-lg border-b"
                style={{ borderTop: `4px solid ${stage.color}` }}
            >
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm text-foreground">{stage.name}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                        {whatsappCount > 0 && (
                            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                                <Bot className="h-3 w-3 mr-0.5" />
                                {whatsappCount}
                            </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                            {stage.opportunities.length}
                        </Badge>
                    </div>
                </div>
                {stage.totalValue > 0 && (
                    <div className="text-xs text-muted-foreground font-medium">
                        {formatCurrency(stage.totalValue)}
                    </div>
                )}
                {stage.automationTrigger && (
                    <div className="text-xs text-muted-foreground/60 mt-0.5 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        Auto-move ativo
                    </div>
                )}
            </div>

            {/* Cards */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-300px)] scrollbar-thin">
                <SortableContext
                    items={stage.opportunities.map(o => o.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {stage.opportunities.map((opportunity) => (
                        <OpportunityCard
                            key={opportunity.id}
                            opportunity={opportunity}
                            onEdit={onEditOpportunity}
                            onDelete={onDeleteOpportunity}
                            onViewTimeline={onViewTimeline}
                        />
                    ))}
                </SortableContext>

                {stage.opportunities.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg bg-background/50">
                        Arraste cards aqui
                    </div>
                )}
            </div>
        </div>
    );
}
