/**
 * WhatsApp Provider Selector
 * Permite ao admin escolher entre Wuzapi, Evolution API ou Meta Cloud API (oficial)
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { getCsrfHeaders } from '@/lib/csrf';
import {
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  Radio,
  Shield,
  Zap,
  Globe,
  Loader2,
  TestTube2,
  Send,
} from 'lucide-react';

type ProviderType = 'wuzapi' | 'evolution' | 'meta_cloud_api';

interface ProviderInfo {
  activeProvider: ProviderType | null;
  configured: {
    wuzapi: boolean;
    evolution: boolean;
    meta_cloud_api: boolean;
  };
}

const PROVIDER_CONFIG: Record<ProviderType, {
  label: string;
  description: string;
  icon: typeof MessageCircle;
  color: string;
  badge: string;
}> = {
  wuzapi: {
    label: 'Wuzapi (Não Oficial)',
    description: 'API não oficial, auto-hospedada. Gratuito, sem limitações de template.',
    icon: Zap,
    color: 'text-yellow-600 dark:text-yellow-400',
    badge: 'Não Oficial',
  },
  evolution: {
    label: 'Evolution API (Não Oficial)',
    description: 'API não oficial popular. Fácil configuração, suporte a listas interativas.',
    icon: Radio,
    color: 'text-blue-600 dark:text-blue-400',
    badge: 'Não Oficial',
  },
  meta_cloud_api: {
    label: 'Meta Cloud API (Oficial)',
    description: 'API oficial do WhatsApp Business. Requer aprovação Meta, suporte a templates.',
    icon: Shield,
    color: 'text-green-600 dark:text-green-400',
    badge: 'Oficial',
  },
};

export function WhatsAppProviderSelector() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current provider info
  const { data: providerInfo, isLoading } = useQuery<ProviderInfo>({
    queryKey: ['whatsapp-provider'],
    queryFn: async () => {
      const res = await fetch('/api/v1/integrations/whatsapp-provider', { credentials: 'include' });
      if (!res.ok) throw new Error('Erro ao carregar provider');
      return res.json();
    },
  });

  // Select provider mutation
  const selectMutation = useMutation({
    mutationFn: async (provider: ProviderType) => {
      const res = await fetch('/api/v1/integrations/whatsapp-provider', {
        method: 'PUT',
        headers: getCsrfHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) throw new Error('Erro ao selecionar provider');
      return res.json();
    },
    onSuccess: (_, provider) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-provider'] });
      toast({ title: `Provider alterado para ${PROVIDER_CONFIG[provider].label}` });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/integrations/whatsapp-provider/test', {
        method: 'POST',
        headers: getCsrfHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha no teste');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Conexão OK', description: `Provider ${data.provider} está conectado` });
    },
    onError: (err: Error) => {
      toast({ title: 'Falha na conexão', description: err.message, variant: 'destructive' });
    },
  });

  // Meta Cloud API config
  const [metaForm, setMetaForm] = useState({
    metaPhoneNumberId: '',
    metaAccessToken: '',
    metaBusinessAccountId: '',
    metaWebhookVerifyToken: '',
  });

  const saveMetaMutation = useMutation({
    mutationFn: async (data: typeof metaForm) => {
      const res = await fetch('/api/v1/integrations/meta-cloud-api', {
        method: 'PUT',
        headers: getCsrfHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Erro ao salvar configuração');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-provider'] });
      toast({ title: 'Meta Cloud API configurada com sucesso!' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });

  // Evolution API config
  const [evolutionForm, setEvolutionForm] = useState({
    evolutionApiBaseUrl: '',
    evolutionInstanceName: '',
    evolutionApiKey: '',
  });

  const saveEvolutionMutation = useMutation({
    mutationFn: async (data: typeof evolutionForm) => {
      const res = await fetch('/api/v1/integrations/evolution-api', {
        method: 'PUT',
        headers: getCsrfHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Erro ao salvar configuração');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-provider'] });
      toast({ title: 'Evolution API configurada com sucesso!' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });

  const activeProvider = providerInfo?.activeProvider;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Globe className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle className="text-xl">Provider WhatsApp</CardTitle>
              <CardDescription>
                Escolha entre API oficial (Meta) ou não oficial (Wuzapi/Evolution)
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending || !activeProvider}
          >
            {testMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <TestTube2 className="h-4 w-4 mr-1" />
            )}
            Testar Conexão
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider selection cards */}
        <div className="grid gap-3">
          {(Object.keys(PROVIDER_CONFIG) as ProviderType[]).map((type) => {
            const config = PROVIDER_CONFIG[type];
            const isActive = activeProvider === type;
            const isConfigured = providerInfo?.configured[type] || false;
            const Icon = config.icon;

            return (
              <div
                key={type}
                className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  isActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => {
                  if (isConfigured && !selectMutation.isPending) {
                    selectMutation.mutate(type);
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isActive ? 'bg-primary/20' : 'bg-muted'}`}>
                    <Icon className={`h-5 w-5 ${isActive ? 'text-primary' : config.color}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{config.label}</span>
                      <Badge variant={type === 'meta_cloud_api' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                        {config.badge}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isConfigured ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30 text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Configurado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Não configurado
                    </Badge>
                  )}
                  {isActive && (
                    <Badge className="bg-primary text-primary-foreground text-xs">
                      Ativo
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!activeProvider && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Nenhum provider selecionado. O sistema tentará detectar automaticamente (Wuzapi primeiro, depois Evolution).
          </p>
        )}

        <Separator />

        {/* Meta Cloud API Configuration */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-green-600" />
            Configuração Meta Cloud API (Oficial)
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Phone Number ID</Label>
              <Input
                placeholder="Ex: 123456789012345"
                value={metaForm.metaPhoneNumberId}
                onChange={(e) => setMetaForm(prev => ({ ...prev, metaPhoneNumberId: e.target.value }))}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Access Token</Label>
              <Input
                type="password"
                placeholder="Token permanente do Meta Business"
                value={metaForm.metaAccessToken}
                onChange={(e) => setMetaForm(prev => ({ ...prev, metaAccessToken: e.target.value }))}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Business Account ID (opcional)</Label>
              <Input
                placeholder="Ex: 987654321098765"
                value={metaForm.metaBusinessAccountId}
                onChange={(e) => setMetaForm(prev => ({ ...prev, metaBusinessAccountId: e.target.value }))}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Webhook Verify Token (opcional)</Label>
              <Input
                placeholder="Token de verificação do webhook"
                value={metaForm.metaWebhookVerifyToken}
                onChange={(e) => setMetaForm(prev => ({ ...prev, metaWebhookVerifyToken: e.target.value }))}
                className="text-sm"
              />
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => saveMetaMutation.mutate(metaForm)}
            disabled={saveMetaMutation.isPending || !metaForm.metaPhoneNumberId || !metaForm.metaAccessToken}
          >
            {saveMetaMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            Salvar Meta Cloud API
          </Button>
        </div>

        <Separator />

        {/* Evolution API Configuration */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Radio className="h-4 w-4 text-blue-600" />
            Configuração Evolution API
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">URL Base</Label>
              <Input
                placeholder="https://evolution.exemplo.com"
                value={evolutionForm.evolutionApiBaseUrl}
                onChange={(e) => setEvolutionForm(prev => ({ ...prev, evolutionApiBaseUrl: e.target.value }))}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Instance Name</Label>
              <Input
                placeholder="minha-instancia"
                value={evolutionForm.evolutionInstanceName}
                onChange={(e) => setEvolutionForm(prev => ({ ...prev, evolutionInstanceName: e.target.value }))}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">API Key</Label>
              <Input
                type="password"
                placeholder="API Key da Evolution"
                value={evolutionForm.evolutionApiKey}
                onChange={(e) => setEvolutionForm(prev => ({ ...prev, evolutionApiKey: e.target.value }))}
                className="text-sm"
              />
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => saveEvolutionMutation.mutate(evolutionForm)}
            disabled={saveEvolutionMutation.isPending || !evolutionForm.evolutionApiBaseUrl || !evolutionForm.evolutionInstanceName || !evolutionForm.evolutionApiKey}
          >
            {saveEvolutionMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            Salvar Evolution API
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground">
          A configuração do Wuzapi continua sendo feita na seção abaixo via QR Code.
        </p>
      </CardContent>
    </Card>
  );
}
