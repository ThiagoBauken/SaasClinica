import React from 'react';
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
} from '@dnd-kit/core';
import { KanbanData, Opportunity } from '@/types/crm';
import { KanbanColumn } from './KanbanColumn';
import { OpportunityCard } from './OpportunityCard';

interface KanbanBoardProps {
    data: KanbanData | undefined;
    isLoading: boolean;
    onDragEnd: (event: DragEndEvent) => void;
    onEditOpportunity?: (opportunity: Opportunity) => void;
    onDeleteOpportunity?: (opportunityId: number) => void;
    onViewTimeline?: (opportunity: Opportunity) => void;
}

export function KanbanBoard({
    data,
    isLoading,
    onDragEnd,
    onEditOpportunity,
    onDeleteOpportunity,
    onViewTimeline,
}: KanbanBoardProps) {
    const [activeId, setActiveId] = React.useState<number | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor)
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as number);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveId(null);
        onDragEnd(event);
    };

    const activeOpportunity = data?.stages
        .flatMap(s => s.opportunities)
        .find(o => o.id === activeId);

    return (
        <div className="overflow-x-auto pb-4 h-full">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="flex gap-4 h-full items-start">
                    {isLoading ? (
                        <div className="flex gap-4 w-full">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div
                                    key={i}
                                    className="min-w-[290px] h-96 bg-muted rounded-lg animate-pulse"
                                />
                            ))}
                        </div>
                    ) : (
                        data?.stages.map((stage) => (
                            <KanbanColumn
                                key={stage.id}
                                stage={stage}
                                onEditOpportunity={onEditOpportunity}
                                onDeleteOpportunity={onDeleteOpportunity}
                                onViewTimeline={onViewTimeline}
                            />
                        ))
                    )}
                </div>

                <DragOverlay>
                    {activeOpportunity ? (
                        <OpportunityCard opportunity={activeOpportunity} isDragging />
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
}
