/**
 * Página do CRM - Funil de Vendas
 *
 * Visualização Kanban de oportunidades com drag & drop
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  User,
  MoreVertical,
  TrendingUp,
  Target,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  GripVertical,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';

interface Stage {
  id: number;
  name: string;
  code: string;
  color: string;
  order: number;
  isWon: boolean;
  isLost: boolean;
  opportunities: Opportunity[];
  totalValue: number;
}

interface Opportunity {
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
}

interface KanbanData {
  stages: Stage[];
  summary: {
    totalOpportunities: number;
    totalValue: number;
    wonValue: number;
  };
}

// Componente do Card de Oportunidade
function OpportunityCard({ opportunity, isDragging }: { opportunity: Opportunity; isDragging?: boolean }) {
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
    protese: 'Prótese',
    clareamento: 'Clareamento',
    limpeza: 'Limpeza',
    restauracao: 'Restauração',
    canal: 'Canal',
    extracao: 'Extração',
    harmonizacao: 'Harmonização',
    outros: 'Outros',
  };

  const sourceLabels: Record<string, string> = {
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
    google: 'Google',
    indicacao: 'Indicação',
    site: 'Site',
    telefone: 'Telefone',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-card border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium text-sm text-foreground line-clamp-1">
            {opportunity.title}
          </h4>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-2">
        {/* Nome do paciente/lead */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <User className="h-3 w-3" />
          <span className="line-clamp-1">
            {opportunity.patientName || opportunity.leadName || 'Sem nome'}
          </span>
        </div>

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
        </div>

        {/* Próximo follow-up */}
        {opportunity.nextFollowUpAt && (
          <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
            <Clock className="h-3 w-3" />
            Follow-up: {new Date(opportunity.nextFollowUpAt).toLocaleDateString('pt-BR')}
          </div>
        )}
      </div>
    </div>
  );
}

// Componente da Coluna do Kanban
function KanbanColumn({ stage }: { stage: Stage }) {
  return (
    <div className="flex flex-col min-w-[280px] max-w-[280px] bg-muted/50 rounded-lg">
      {/* Header da Coluna */}
      <div
        className="p-3 rounded-t-lg"
        style={{ backgroundColor: stage.color + '20' }}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: stage.color }}
            />
            <h3 className="font-semibold text-sm text-foreground">{stage.name}</h3>
          </div>
          <Badge variant="secondary" className="text-xs">
            {stage.opportunities.length}
          </Badge>
        </div>
        {stage.totalValue > 0 && (
          <div className="text-xs text-muted-foreground">
            {formatCurrency(stage.totalValue)}
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
        <SortableContext
          items={stage.opportunities.map(o => o.id)}
          strategy={verticalListSortingStrategy}
        >
          {stage.opportunities.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} />
          ))}
        </SortableContext>

        {stage.opportunities.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhuma oportunidade
          </div>
        )}
      </div>
    </div>
  );
}

export default function CRMPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isNewOpportunityOpen, setIsNewOpportunityOpen] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);

  // Form state
  const [newOpportunity, setNewOpportunity] = useState({
    title: '',
    leadName: '',
    leadPhone: '',
    leadEmail: '',
    leadSource: '',
    treatmentType: '',
    estimatedValue: '',
    notes: '',
  });

  // Sensors para drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Buscar dados do kanban
  const { data, isLoading } = useQuery<KanbanData>({
    queryKey: ['crm-opportunities'],
    queryFn: async () => {
      const res = await fetch('/api/v1/crm/opportunities', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erro ao carregar oportunidades');
      return res.json();
    },
  });

  // Mover oportunidade
  const moveMutation = useMutation({
    mutationFn: async ({ id, stageId }: { id: number; stageId: number }) => {
      const res = await fetch(`/api/v1/crm/opportunities/${id}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stageId }),
      });
      if (!res.ok) throw new Error('Erro ao mover oportunidade');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-opportunities'] });
    },
  });

  // Criar oportunidade
  const createMutation = useMutation({
    mutationFn: async (data: typeof newOpportunity) => {
      const res = await fetch('/api/v1/crm/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Erro ao criar oportunidade');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-opportunities'] });
      setIsNewOpportunityOpen(false);
      setNewOpportunity({
        title: '',
        leadName: '',
        leadPhone: '',
        leadEmail: '',
        leadSource: '',
        treatmentType: '',
        estimatedValue: '',
        notes: '',
      });
      toast({ title: 'Oportunidade criada com sucesso!' });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    // Encontrar a etapa de destino
    const activeOpportunity = data?.stages
      .flatMap(s => s.opportunities)
      .find(o => o.id === active.id);

    if (!activeOpportunity) return;

    // Encontrar etapa onde o card foi solto
    let targetStageId: number | null = null;

    // Verificar se soltou em uma coluna
    for (const stage of data?.stages || []) {
      if (stage.opportunities.some(o => o.id === over.id)) {
        targetStageId = stage.id;
        break;
      }
    }

    // Se soltou em uma coluna vazia, over.id será o ID do container
    if (!targetStageId) {
      const stage = data?.stages.find(s => s.id === over.id);
      if (stage) {
        targetStageId = stage.id;
      }
    }

    if (targetStageId && targetStageId !== activeOpportunity.stageId) {
      moveMutation.mutate({ id: activeOpportunity.id, stageId: targetStageId });
    }
  };

  const handleCreateOpportunity = () => {
    if (!newOpportunity.title) {
      toast({ title: 'Erro', description: 'Título é obrigatório', variant: 'destructive' });
      return;
    }
    createMutation.mutate(newOpportunity);
  };

  // Encontrar oportunidade sendo arrastada
  const activeOpportunity = data?.stages
    .flatMap(s => s.opportunities)
    .find(o => o.id === activeId);

  return (
    <DashboardLayout title="CRM - Funil de Vendas" currentPath="/crm">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">CRM - Funil de Vendas</h1>
            <p className="text-muted-foreground">Gerencie suas oportunidades de venda</p>
          </div>
          <Dialog open={isNewOpportunityOpen} onOpenChange={setIsNewOpportunityOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Oportunidade
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nova Oportunidade</DialogTitle>
                <DialogDescription>
                  Adicione um novo lead ou oportunidade de venda
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Título *</Label>
                  <Input
                    placeholder="Ex: Implante - João Silva"
                    value={newOpportunity.title}
                    onChange={(e) =>
                      setNewOpportunity((prev) => ({ ...prev, title: e.target.value }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nome do Lead</Label>
                    <Input
                      placeholder="Nome completo"
                      value={newOpportunity.leadName}
                      onChange={(e) =>
                        setNewOpportunity((prev) => ({ ...prev, leadName: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input
                      placeholder="(00) 00000-0000"
                      value={newOpportunity.leadPhone}
                      onChange={(e) =>
                        setNewOpportunity((prev) => ({ ...prev, leadPhone: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={newOpportunity.leadEmail}
                    onChange={(e) =>
                      setNewOpportunity((prev) => ({ ...prev, leadEmail: e.target.value }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Origem</Label>
                    <Select
                      value={newOpportunity.leadSource}
                      onValueChange={(value) =>
                        setNewOpportunity((prev) => ({ ...prev, leadSource: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="google">Google</SelectItem>
                        <SelectItem value="indicacao">Indicação</SelectItem>
                        <SelectItem value="site">Site</SelectItem>
                        <SelectItem value="telefone">Telefone</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tipo de Tratamento</Label>
                    <Select
                      value={newOpportunity.treatmentType}
                      onValueChange={(value) =>
                        setNewOpportunity((prev) => ({ ...prev, treatmentType: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="implante">Implante</SelectItem>
                        <SelectItem value="ortodontia">Ortodontia</SelectItem>
                        <SelectItem value="protese">Prótese</SelectItem>
                        <SelectItem value="clareamento">Clareamento</SelectItem>
                        <SelectItem value="limpeza">Limpeza</SelectItem>
                        <SelectItem value="restauracao">Restauração</SelectItem>
                        <SelectItem value="canal">Canal</SelectItem>
                        <SelectItem value="harmonizacao">Harmonização</SelectItem>
                        <SelectItem value="outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Valor Estimado (R$)</Label>
                  <Input
                    type="number"
                    placeholder="0,00"
                    value={newOpportunity.estimatedValue}
                    onChange={(e) =>
                      setNewOpportunity((prev) => ({ ...prev, estimatedValue: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea
                    placeholder="Anotações sobre o lead..."
                    value={newOpportunity.notes}
                    onChange={(e) =>
                      setNewOpportunity((prev) => ({ ...prev, notes: e.target.value }))
                    }
                  />
                </div>
                <Button
                  onClick={handleCreateOpportunity}
                  disabled={createMutation.isPending}
                  className="w-full"
                >
                  Criar Oportunidade
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Métricas */}
        {data?.summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Oportunidades</p>
                    <p className="text-2xl font-bold">{data.summary.totalOpportunities}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Valor em Pipeline</p>
                    <p className="text-2xl font-bold">{formatCurrency(data.summary.totalValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Ganho</p>
                    <p className="text-2xl font-bold">{formatCurrency(data.summary.wonValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Taxa Conversão</p>
                    <p className="text-2xl font-bold">
                      {data.summary.totalOpportunities > 0
                        ? ((data.summary.wonValue / data.summary.totalValue) * 100).toFixed(0)
                        : 0}
                      %
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Kanban Board */}
        <div className="overflow-x-auto pb-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 min-h-[500px]">
              {isLoading ? (
                <div className="flex gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="min-w-[280px] h-96 bg-muted rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                data?.stages.map((stage) => (
                  <KanbanColumn key={stage.id} stage={stage} />
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
      </div>
    </DashboardLayout>
  );
}
