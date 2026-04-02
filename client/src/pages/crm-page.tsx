/**
 * CRM Page - WhatsApp Pipeline with AI Auto-Progression
 *
 * Kanban board that shows opportunities linked to WhatsApp chat sessions.
 * Cards move automatically through stages based on AI agent actions:
 *   Primeiro Contato -> Agendamento -> Confirmacao -> Consulta Realizada -> Pagamento -> Concluido
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragEndEvent } from '@dnd-kit/core';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { getCsrfHeaders } from '@/lib/csrf';
import { formatCurrency } from '@/lib/utils';
import { KanbanBoard } from '@/components/crm/KanbanBoard';
import { OpportunityDialog } from '@/components/crm/OpportunityDialog';
import { OpportunityTimelinePanel } from '@/components/crm/OpportunityTimeline';
import { KanbanData, Opportunity } from '@/types/crm';
import {
    Plus,
    DollarSign,
    Target,
    CheckCircle,
    TrendingUp,
    Bot,
    MessageSquare,
    RefreshCw,
    Zap,
    Settings2,
    Database,
} from 'lucide-react';

export default function CRMPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isNewOpportunityOpen, setIsNewOpportunityOpen] = useState(false);
    const [editingOpportunity, setEditingOpportunity] = useState<Opportunity | null>(null);
    const [timelineOpportunity, setTimelineOpportunity] = useState<Opportunity | null>(null);

    // Fetch pipeline data (try enriched first, fallback to basic)
    const { data, isLoading, refetch } = useQuery<KanbanData>({
        queryKey: ['crm-pipeline'],
        queryFn: async () => {
            // Try enriched pipeline first
            const res = await fetch('/api/v1/crm/pipeline', { credentials: 'include' });
            if (res.ok) return res.json();

            // Fallback to basic opportunities endpoint
            const fallback = await fetch('/api/v1/crm/opportunities', { credentials: 'include' });
            if (!fallback.ok) throw new Error('Erro ao carregar pipeline');
            return fallback.json();
        },
        refetchInterval: 10000,
    });

    // Move opportunity mutation with optimistic update
    const moveMutation = useMutation({
        mutationFn: async ({ id, stageId }: { id: number; stageId: number }) => {
            const res = await fetch(`/api/v1/crm/opportunities/${id}/move`, {
                method: 'PUT',
                headers: getCsrfHeaders({ 'Content-Type': 'application/json' }),
                credentials: 'include',
                body: JSON.stringify({ stageId }),
            });
            if (!res.ok) throw new Error('Erro ao mover oportunidade');
            return res.json();
        },
        onMutate: async ({ id, stageId }) => {
            // Cancel outgoing refetches so they don't overwrite our optimistic update
            await queryClient.cancelQueries({ queryKey: ['crm-pipeline'] });
            const previous = queryClient.getQueryData<KanbanData>(['crm-pipeline']);

            if (previous) {
                // Move the opportunity locally
                const allOpps = previous.stages.flatMap(s => s.opportunities);
                const opp = allOpps.find(o => o.id === id);
                if (opp) {
                    const updated: KanbanData = {
                        ...previous,
                        stages: previous.stages.map(stage => ({
                            ...stage,
                            opportunities: stage.id === stageId
                                ? [...stage.opportunities.filter(o => o.id !== id), { ...opp, stageId }]
                                : stage.opportunities.filter(o => o.id !== id),
                            totalValue: stage.id === stageId
                                ? stage.totalValue + parseFloat(opp.estimatedValue || '0')
                                : stage.totalValue - (stage.opportunities.some(o => o.id === id) ? parseFloat(opp.estimatedValue || '0') : 0),
                        })),
                    };
                    queryClient.setQueryData(['crm-pipeline'], updated);
                }
            }
            return { previous };
        },
        onError: (_err, _vars, context) => {
            // Rollback on error
            if (context?.previous) {
                queryClient.setQueryData(['crm-pipeline'], context.previous);
            }
            toast({ title: 'Erro ao mover', variant: 'destructive' });
        },
        onSettled: () => {
            // Sync with server after a short delay
            setTimeout(() => queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] }), 1000);
        },
    });

    // Create opportunity mutation
    const createMutation = useMutation({
        mutationFn: async (opportunityData: any) => {
            const res = await fetch('/api/v1/crm/opportunities', {
                method: 'POST',
                headers: getCsrfHeaders({ 'Content-Type': 'application/json' }),
                credentials: 'include',
                body: JSON.stringify(opportunityData),
            });
            if (!res.ok) throw new Error('Erro ao criar oportunidade');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] });
            setIsNewOpportunityOpen(false);
            toast({ title: 'Oportunidade criada com sucesso!' });
        },
        onError: (error: Error) => {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        },
    });

    // Update opportunity mutation
    const updateMutation = useMutation({
        mutationFn: async ({ id, ...data }: any) => {
            const res = await fetch(`/api/v1/crm/opportunities/${id}`, {
                method: 'PUT',
                headers: getCsrfHeaders({ 'Content-Type': 'application/json' }),
                credentials: 'include',
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Erro ao atualizar oportunidade');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] });
            setEditingOpportunity(null);
            toast({ title: 'Oportunidade atualizada!' });
        },
    });

    // Delete opportunity mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`/api/v1/crm/opportunities/${id}`, {
                method: 'DELETE',
                headers: getCsrfHeaders(),
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Erro ao excluir oportunidade');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] });
            toast({ title: 'Oportunidade excluida' });
        },
    });

    // Seed default stages mutation
    const seedMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/v1/crm/seed-stages', {
                method: 'POST',
                headers: getCsrfHeaders({ 'Content-Type': 'application/json' }),
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Erro ao criar etapas');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] });
            toast({ title: 'Etapas do funil criadas!' });
        },
    });

    // Seed test data mutation
    const seedTestDataMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/v1/crm/seed-test-data', {
                method: 'POST',
                headers: getCsrfHeaders({ 'Content-Type': 'application/json' }),
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Erro ao criar dados de teste');
            return res.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] });
            toast({ title: data.skipped ? 'Dados já existem' : 'Dados de teste criados!' });
        },
        onError: (error: Error) => {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        },
    });

    // Handle drag end
    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || !data) return;

        const activeOpportunity = data.stages
            .flatMap(s => s.opportunities)
            .find(o => o.id === active.id);

        if (!activeOpportunity) return;

        // Find target stage
        let targetStageId: number | null = null;

        // Check if dropped on a stage's droppable zone
        const overIdStr = String(over.id);
        if (overIdStr.startsWith('stage-')) {
            targetStageId = parseInt(overIdStr.replace('stage-', ''));
        } else {
            // Dropped on another card - find its stage
            for (const stage of data.stages) {
                if (stage.opportunities.some(o => o.id === over.id)) {
                    targetStageId = stage.id;
                    break;
                }
            }
        }

        if (targetStageId && targetStageId !== activeOpportunity.stageId) {
            moveMutation.mutate({ id: activeOpportunity.id, stageId: targetStageId });
        }
    }, [data, moveMutation]);

    // Handle create/edit
    const handleSubmit = (formData: any) => {
        if (editingOpportunity) {
            updateMutation.mutate({ id: editingOpportunity.id, ...formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    // Handle delete
    const handleDelete = (id: number) => {
        if (confirm('Tem certeza que deseja excluir esta oportunidade?')) {
            deleteMutation.mutate(id);
        }
    };

    // Listen for WebSocket CRM events
    useEffect(() => {
        const handleWsMessage = (event: MessageEvent) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'crm:opportunity_created' || msg.type === 'crm:opportunity_moved') {
                    queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] });
                }
            } catch {
                // ignore
            }
        };

        // Try to connect to existing WebSocket
        const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
        let ws: WebSocket | null = null;

        try {
            ws = new WebSocket(wsUrl);
            ws.addEventListener('message', handleWsMessage);
        } catch {
            // WebSocket not available
        }

        return () => {
            ws?.removeEventListener('message', handleWsMessage);
            ws?.close();
        };
    }, [queryClient]);

    const noStages = !isLoading && (!data?.stages || data.stages.length === 0);
    const hasStagesButEmpty = !isLoading && data?.stages && data.stages.length > 0 && data.summary?.totalOpportunities === 0;

    return (
        <DashboardLayout title="CRM - Pipeline WhatsApp" currentPath="/crm">
            <div className="flex flex-col h-[calc(100vh-4rem)]">
                {/* Header */}
                <div className="p-4 border-b">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                                <Zap className="h-6 w-6 text-green-500" />
                                CRM - Pipeline WhatsApp
                            </h1>
                            <p className="text-muted-foreground text-sm">
                                Funil de vendas com progresso automatico via IA
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {hasStagesButEmpty && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => seedTestDataMutation.mutate()}
                                    disabled={seedTestDataMutation.isPending}
                                >
                                    <Database className="h-4 w-4 mr-1" />
                                    Dados de Teste
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => refetch()}
                                disabled={isLoading}
                            >
                                <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                                Atualizar
                            </Button>
                            <Button onClick={() => setIsNewOpportunityOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Nova Oportunidade
                            </Button>
                        </div>
                    </div>

                    {/* Metrics */}
                    {data?.summary && (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <Card>
                                <CardContent className="p-3 flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/20 rounded-lg">
                                        <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Oportunidades</p>
                                        <p className="text-lg font-bold">{data.summary.totalOpportunities}</p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-3 flex items-center gap-3">
                                    <div className="p-2 bg-green-500/20 rounded-lg">
                                        <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Pipeline</p>
                                        <p className="text-lg font-bold">{formatCurrency(data.summary.totalValue)}</p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-3 flex items-center gap-3">
                                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                                        <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Ganho</p>
                                        <p className="text-lg font-bold">{formatCurrency(data.summary.wonValue)}</p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-3 flex items-center gap-3">
                                    <div className="p-2 bg-purple-500/20 rounded-lg">
                                        <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Conversao</p>
                                        <p className="text-lg font-bold">
                                            {data.summary.totalOpportunities > 0 && data.summary.totalValue > 0
                                                ? ((data.summary.wonValue / data.summary.totalValue) * 100).toFixed(0)
                                                : 0}%
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-3 flex items-center gap-3">
                                    <div className="p-2 bg-green-500/20 rounded-lg">
                                        <Bot className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">WhatsApp</p>
                                        <p className="text-lg font-bold">{data.summary.whatsappActive || 0}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>

                {/* Kanban + Timeline panel */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Main Kanban area */}
                    <div className="flex-1 p-4 overflow-hidden">
                        {noStages ? (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <Settings2 className="h-16 w-16 text-muted-foreground/50 mb-4" />
                                <h2 className="text-xl font-medium mb-2">Configure seu Pipeline</h2>
                                <p className="text-muted-foreground mb-4 max-w-md">
                                    Crie as etapas do funil de vendas com progresso automatico via IA.
                                    As etapas padrao incluem: Primeiro Contato, Agendamento, Confirmacao,
                                    Consulta Realizada, Pagamento e Concluido.
                                </p>
                                <div className="flex gap-3">
                                    <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                                        <Zap className="h-4 w-4 mr-2" />
                                        Criar Etapas Padrao
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => seedTestDataMutation.mutate()}
                                        disabled={seedTestDataMutation.isPending}
                                    >
                                        <Database className="h-4 w-4 mr-2" />
                                        Criar com Dados de Teste
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <KanbanBoard
                                data={data}
                                isLoading={isLoading}
                                onDragEnd={handleDragEnd}
                                onEditOpportunity={(opp) => setEditingOpportunity(opp)}
                                onDeleteOpportunity={handleDelete}
                                onViewTimeline={(opp) => setTimelineOpportunity(opp)}
                            />
                        )}
                    </div>

                    {/* Timeline side panel */}
                    {timelineOpportunity && (
                        <OpportunityTimelinePanel
                            opportunity={timelineOpportunity}
                            onClose={() => setTimelineOpportunity(null)}
                        />
                    )}
                </div>

                {/* AI Pipeline Legend + Probability Legend */}
                <div className="border-t px-4 py-2 bg-muted/30 space-y-1">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="font-medium flex items-center gap-1">
                            <Bot className="h-3 w-3" />
                            Pipeline IA:
                        </span>
                        <span className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-indigo-500" />
                            Contato
                        </span>
                        <span className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            Agendamento
                        </span>
                        <span className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-yellow-500" />
                            Confirmacao
                        </span>
                        <span className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            Consulta
                        </span>
                        <span className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-purple-500" />
                            Pagamento
                        </span>
                        <span className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            Concluido
                        </span>
                        <span className="ml-auto flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            Atualiza automaticamente
                        </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="font-medium">Probabilidade:</span>
                        <span className="flex items-center gap-1">
                            <span className="inline-block w-3 h-3 rounded border border-green-500 text-green-600 text-[8px] text-center font-bold leading-3">%</span>
                            <span className="text-green-600">80-100% Alta</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="inline-block w-3 h-3 rounded border border-yellow-500 text-yellow-600 text-[8px] text-center font-bold leading-3">%</span>
                            <span className="text-yellow-600">50-79% Media</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="inline-block w-3 h-3 rounded border border-gray-400 text-gray-500 text-[8px] text-center font-bold leading-3">%</span>
                            <span className="text-gray-500">&lt;50% Baixa</span>
                        </span>
                        <span className="text-muted-foreground/60 ml-2">|</span>
                        <span className="flex items-center gap-1">
                            <Bot className="h-3 w-3 text-green-600" />
                            Movido pela IA
                        </span>
                        <span className="flex items-center gap-1">
                            <Settings2 className="h-3 w-3 text-muted-foreground" />
                            Movido manualmente
                        </span>
                    </div>
                </div>
            </div>

            {/* Create/Edit Dialog */}
            <OpportunityDialog
                open={isNewOpportunityOpen || !!editingOpportunity}
                onOpenChange={(open) => {
                    if (!open) {
                        setIsNewOpportunityOpen(false);
                        setEditingOpportunity(null);
                    }
                }}
                opportunity={editingOpportunity}
                onSubmit={handleSubmit}
                isLoading={createMutation.isPending || updateMutation.isPending}
            />
        </DashboardLayout>
    );
}
