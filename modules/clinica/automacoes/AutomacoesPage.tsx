import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Settings, 
  Zap, 
  MessageCircle, 
  Mail, 
  Smartphone,
  Plus,
  Edit,
  Trash2,
  Play,
  BarChart3
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Automation {
  id: number;
  name: string;
  triggerType: string;
  active: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export function AutomacoesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null);

  const { data: automations = [], isLoading } = useQuery({
    queryKey: ['/api/automations'],
    select: (data: Automation[]) => data || []
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const response = await fetch(`/api/automations/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active })
      });
      if (!response.ok) throw new Error('Failed to toggle automation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automations'] });
      toast({
        title: "Automação atualizada",
        description: "Status da automação foi alterado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao alterar status da automação.",
        variant: "destructive",
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/automations/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete automation');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automations'] });
      toast({
        title: "Automação removida",
        description: "Automação foi removida com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao remover automação.",
        variant: "destructive",
      });
    }
  });

  const handleToggleActive = (automation: Automation) => {
    toggleMutation.mutate({ id: automation.id, active: !automation.active });
  };

  const handleDelete = (automationId: number) => {
    if (confirm('Tem certeza que deseja remover esta automação?')) {
      deleteMutation.mutate(automationId);
    }
  };

  const getTriggerTypeLabel = (triggerType: string) => {
    const types: Record<string, string> = {
      'appointment': 'Novo Agendamento',
      'time_before': 'Tempo Antes',
      'after_appointment': 'Após Consulta',
      'status_change': 'Mudança de Status'
    };
    return types[triggerType] || triggerType;
  };

  const getChannelIcons = (automation: Automation) => {
    const icons = [];
    if (automation.whatsappEnabled) icons.push(<MessageCircle key="whatsapp" className="h-4 w-4 text-green-600" />);
    if (automation.emailEnabled) icons.push(<Mail key="email" className="h-4 w-4 text-blue-600" />);
    if (automation.smsEnabled) icons.push(<Smartphone key="sms" className="h-4 w-4 text-orange-600" />);
    return icons;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Carregando automações...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Automações</h1>
          <p className="text-muted-foreground">
            Configure automações para WhatsApp, e-mail e SMS
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nova Automação
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{automations.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ativas</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {automations.filter(a => a.active).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">WhatsApp</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {automations.filter(a => a.whatsappEnabled).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">E-mail</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {automations.filter(a => a.emailEnabled).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Automations List */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Automações</CardTitle>
        </CardHeader>
        <CardContent>
          {automations.length === 0 ? (
            <div className="text-center py-8">
              <Zap className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Nenhuma automação configurada</h3>
              <p className="mt-2 text-muted-foreground">
                Comece criando sua primeira automação para WhatsApp, e-mail ou SMS.
              </p>
              <Button className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeira Automação
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {automations.map((automation) => (
                <div
                  key={automation.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={automation.active}
                        onCheckedChange={() => handleToggleActive(automation)}
                        disabled={toggleMutation.isPending}
                      />
                      <Badge variant={automation.active ? "default" : "secondary"}>
                        {automation.active ? "Ativa" : "Inativa"}
                      </Badge>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold">{automation.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Trigger: {getTriggerTypeLabel(automation.triggerType)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="flex space-x-1">
                      {getChannelIcons(automation)}
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button variant="ghost" size="sm">
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDelete(automation.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AutomacoesPage;