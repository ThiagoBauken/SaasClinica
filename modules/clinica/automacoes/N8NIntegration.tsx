import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../../../client/src/components/ui/card';
import { Button } from '../../../client/src/components/ui/button';
import { Badge } from '../../../client/src/components/ui/badge';
import { Input } from '../../../client/src/components/ui/input';
import { Label } from '../../../client/src/components/ui/label';
import { 
  Settings, 
  Zap, 
  MessageCircle, 
  Send,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Play,
  Pause,
  Trash2
} from 'lucide-react';
import { useToast } from '../../../client/src/hooks/use-toast';

interface N8NWorkflow {
  id: string;
  name: string;
  active: boolean;
  nodes: number;
  lastExecution?: string;
  successRate: number;
  trigger: string;
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  category: string;
  language: string;
  status: 'approved' | 'pending' | 'rejected';
  components: any[];
}

interface IntegrationSettings {
  n8nUrl: string;
  n8nApiKey: string;
  whatsappToken: string;
  whatsappBusinessId: string;
  whatsappPhoneId: string;
  webhookUrl: string;
}

export function N8NIntegration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<IntegrationSettings>({
    n8nUrl: '',
    n8nApiKey: '',
    whatsappToken: '',
    whatsappBusinessId: '',
    whatsappPhoneId: '',
    webhookUrl: ''
  });

  const { data: workflows = [], isLoading: workflowsLoading } = useQuery({
    queryKey: ['/api/integrations/n8n/workflows'],
    select: (data: N8NWorkflow[]) => data || []
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/integrations/whatsapp/templates'],
    select: (data: WhatsAppTemplate[]) => data || []
  });

  const { data: currentSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['/api/integrations/settings'],
    onSuccess: (data) => {
      if (data) setSettings(data);
    }
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (newSettings: IntegrationSettings) => {
      const response = await fetch('/api/integrations/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      if (!response.ok) throw new Error('Failed to save settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/settings'] });
      toast({
        title: "Configurações salvas",
        description: "Integrações configuradas com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao salvar configurações.",
        variant: "destructive",
      });
    }
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (type: 'n8n' | 'whatsapp') => {
      const response = await fetch(`/api/integrations/${type}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (!response.ok) throw new Error(`Failed to test ${type} connection`);
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Conexão testada",
        description: `${variables === 'n8n' ? 'N8N' : 'WhatsApp'} conectado com sucesso.`,
      });
    },
    onError: (error, variables) => {
      toast({
        title: "Erro de conexão",
        description: `Falha ao conectar com ${variables === 'n8n' ? 'N8N' : 'WhatsApp'}.`,
        variant: "destructive",
      });
    }
  });

  const toggleWorkflowMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const response = await fetch(`/api/integrations/n8n/workflows/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active })
      });
      if (!response.ok) throw new Error('Failed to toggle workflow');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/n8n/workflows'] });
      toast({
        title: "Workflow atualizado",
        description: "Status do workflow foi alterado.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao alterar workflow.",
        variant: "destructive",
      });
    }
  });

  const handleSaveSettings = () => {
    saveSettingsMutation.mutate(settings);
  };

  const getStatusBadge = (status: string) => {
    const config = {
      approved: { label: 'Aprovado', variant: 'default' as const, icon: CheckCircle },
      pending: { label: 'Pendente', variant: 'secondary' as const, icon: AlertCircle },
      rejected: { label: 'Rejeitado', variant: 'destructive' as const, icon: AlertCircle }
    };
    
    const item = config[status as keyof typeof config] || config.pending;
    const Icon = item.icon;
    
    return (
      <Badge variant={item.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {item.label}
      </Badge>
    );
  };

  const isLoading = workflowsLoading || templatesLoading || settingsLoading;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrações N8N & WhatsApp</h1>
          <p className="text-muted-foreground">
            Configure automações e mensagens WhatsApp
          </p>
        </div>
      </div>

      {/* Configuration Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Configuração N8N
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="n8nUrl">URL do N8N</Label>
              <Input
                id="n8nUrl"
                placeholder="https://n8n.yourcompany.com"
                value={settings.n8nUrl}
                onChange={(e) => setSettings(prev => ({ ...prev, n8nUrl: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="n8nApiKey">API Key do N8N</Label>
              <Input
                id="n8nApiKey"
                type="password"
                placeholder="n8n_api_key_here"
                value={settings.n8nApiKey}
                onChange={(e) => setSettings(prev => ({ ...prev, n8nApiKey: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhookUrl">URL do Webhook</Label>
              <Input
                id="webhookUrl"
                placeholder="https://yourapp.com/webhook/n8n"
                value={settings.webhookUrl}
                onChange={(e) => setSettings(prev => ({ ...prev, webhookUrl: e.target.value }))}
              />
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => testConnectionMutation.mutate('n8n')}
                disabled={testConnectionMutation.isPending || !settings.n8nUrl || !settings.n8nApiKey}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Testar Conexão
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Configuração WhatsApp Business
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="whatsappToken">Token de Acesso</Label>
              <Input
                id="whatsappToken"
                type="password"
                placeholder="WhatsApp Business API Token"
                value={settings.whatsappToken}
                onChange={(e) => setSettings(prev => ({ ...prev, whatsappToken: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="whatsappBusinessId">Business Account ID</Label>
              <Input
                id="whatsappBusinessId"
                placeholder="1234567890"
                value={settings.whatsappBusinessId}
                onChange={(e) => setSettings(prev => ({ ...prev, whatsappBusinessId: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsappPhoneId">Phone Number ID</Label>
              <Input
                id="whatsappPhoneId"
                placeholder="0987654321"
                value={settings.whatsappPhoneId}
                onChange={(e) => setSettings(prev => ({ ...prev, whatsappPhoneId: e.target.value }))}
              />
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => testConnectionMutation.mutate('whatsapp')}
                disabled={testConnectionMutation.isPending || !settings.whatsappToken}
              >
                <Send className="mr-2 h-4 w-4" />
                Testar WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button 
          onClick={handleSaveSettings}
          disabled={saveSettingsMutation.isPending}
        >
          <Settings className="mr-2 h-4 w-4" />
          Salvar Configurações
        </Button>
      </div>

      {/* N8N Workflows */}
      <Card>
        <CardHeader>
          <CardTitle>Workflows N8N</CardTitle>
        </CardHeader>
        <CardContent>
          {workflows.length === 0 ? (
            <div className="text-center py-8">
              <Zap className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Nenhum workflow configurado</h3>
              <p className="mt-2 text-muted-foreground">
                Configure o N8N para visualizar seus workflows aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <Badge variant={workflow.active ? "default" : "secondary"}>
                      {workflow.active ? "Ativo" : "Inativo"}
                    </Badge>
                    
                    <div>
                      <h3 className="font-semibold">{workflow.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {workflow.nodes} nós • Trigger: {workflow.trigger}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Taxa de sucesso: {workflow.successRate}%
                      </p>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => toggleWorkflowMutation.mutate({ 
                        id: workflow.id, 
                        active: !workflow.active 
                      })}
                      disabled={toggleWorkflowMutation.isPending}
                    >
                      {workflow.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Templates WhatsApp</CardTitle>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Nenhum template configurado</h3>
              <p className="mt-2 text-muted-foreground">
                Configure templates no WhatsApp Business Manager.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    {getStatusBadge(template.status)}
                    
                    <div>
                      <h3 className="font-semibold">{template.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {template.category} • {template.language}
                      </p>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button variant="ghost" size="sm">
                      <Send className="h-4 w-4" />
                    </Button>
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

export default N8NIntegration;