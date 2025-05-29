import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Building2, Settings, Users, Shield, LayoutDashboard, ArrowLeft, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface Company {
  id: number;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
}

interface Module {
  id: number;
  name: string;
  display_name: string;
  description: string;
  is_enabled: boolean;
  enabled_at?: string;
}

export default function SaasAdminPage() {
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [activeTab, setActiveTab] = useState<'companies' | 'analytics' | 'settings'>('companies');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar todas as empresas (usando rota de teste)
  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ["/api/test/saas/companies"],
    queryFn: async () => {
      const response = await fetch("/api/test/saas/companies");
      return response.json();
    }
  });

  // Buscar módulos da empresa selecionada (usando rota de teste)
  const { data: modules = [], isLoading: modulesLoading } = useQuery({
    queryKey: ["/api/test/saas/companies", selectedCompany?.id, "modules"],
    queryFn: async () => {
      const response = await fetch(`/api/test/saas/companies/${selectedCompany?.id}/modules`);
      return response.json();
    },
    enabled: !!selectedCompany
  });

  // Mutation para ativar/desativar módulos
  const toggleModuleMutation = useMutation({
    mutationFn: async ({ companyId, moduleId, enabled }: { companyId: number; moduleId: number; enabled: boolean }) => {
      const response = await fetch(`/api/test/saas/companies/${companyId}/modules/${moduleId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao alterar módulo');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/test/saas/companies", selectedCompany?.id, "modules"] });
      toast({
        title: "Sucesso",
        description: "Módulo atualizado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar módulo",
        variant: "destructive",
      });
    }
  });

  const handleToggleModule = (moduleId: number, enabled: boolean) => {
    if (!selectedCompany) return;
    
    toggleModuleMutation.mutate({
      companyId: selectedCompany.id,
      moduleId,
      enabled
    });
  };

  const renderCompaniesTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Lista de Empresas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Empresas
          </CardTitle>
          <CardDescription>
            Selecione uma empresa para gerenciar seus módulos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {companies.map((company: Company) => (
              <div
                key={company.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedCompany?.id === company.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
                onClick={() => setSelectedCompany(company)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{company.name}</h3>
                    <p className="text-sm text-muted-foreground">{company.email}</p>
                  </div>
                  <Badge variant={company.active ? "default" : "secondary"}>
                    {company.active ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Módulos da Empresa Selecionada */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Módulos {selectedCompany && `- ${selectedCompany.name}`}
          </CardTitle>
          <CardDescription>
            {selectedCompany
              ? "Ative ou desative módulos para esta empresa"
              : "Selecione uma empresa para ver seus módulos"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedCompany ? (
            <div className="text-center py-8 text-muted-foreground">
              Selecione uma empresa para gerenciar seus módulos
            </div>
          ) : modulesLoading ? (
            <div className="text-center py-8">Carregando módulos...</div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {modules.map((module: Module, index: number) => (
                <div key={`module-${module.id}-${index}`} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium">{module.display_name}</h4>
                    <p className="text-sm text-muted-foreground">{module.description}</p>
                    {module.enabled_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Ativado em: {new Date(module.enabled_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Switch
                    checked={module.is_enabled}
                    onCheckedChange={(checked) => handleToggleModule(module.id, checked)}
                    disabled={toggleModuleMutation.isPending}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderAnalyticsTab = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Total de Empresas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{companies.length}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Empresas Ativas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {companies.filter((c: Company) => c.active).length}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Empresas Inativas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">
            {companies.filter((c: Company) => !c.active).length}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSettingsTab = () => (
    <Card>
      <CardHeader>
        <CardTitle>Configurações da Plataforma</CardTitle>
        <CardDescription>
          Configurações globais do sistema SaaS
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Configurações avançadas em desenvolvimento...
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (companiesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg">Carregando empresas...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <div className="w-64 bg-card border-r flex flex-col">
        <div className="p-6 border-b">
          <div className="flex items-center space-x-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Admin SaaS</h1>
              <p className="text-sm text-muted-foreground">Painel Global</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/dashboard" className="flex items-center px-3 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:bg-muted">
            <ArrowLeft className="mr-3 h-4 w-4" />
            Voltar ao Dashboard
          </Link>
          
          <div className="pt-4 space-y-1">
            <button
              onClick={() => setActiveTab('companies')}
              className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
                activeTab === 'companies' ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
              }`}
            >
              <Building2 className="mr-3 h-4 w-4" />
              Empresas & Módulos
            </button>
            
            <button
              onClick={() => setActiveTab('analytics')}
              className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
                activeTab === 'analytics' ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
              }`}
            >
              <BarChart3 className="mr-3 h-4 w-4" />
              Analytics
            </button>
            
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
                activeTab === 'settings' ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
              }`}
            >
              <Settings className="mr-3 h-4 w-4" />
              Configurações
            </button>
          </div>
        </nav>
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1">
        <div className="border-b bg-card">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  {activeTab === 'companies' && 'Gerenciamento de Empresas'}
                  {activeTab === 'analytics' && 'Analytics da Plataforma'}
                  {activeTab === 'settings' && 'Configurações Globais'}
                </h2>
                <p className="text-muted-foreground">
                  {activeTab === 'companies' && 'Controle de empresas e seus módulos ativos'}
                  {activeTab === 'analytics' && 'Métricas e estatísticas da plataforma'}
                  {activeTab === 'settings' && 'Configurações gerais do sistema SaaS'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'companies' && renderCompaniesTab()}
          {activeTab === 'analytics' && renderAnalyticsTab()}
          {activeTab === 'settings' && renderSettingsTab()}
        </div>
      </div>
    </div>
  );
}