import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { 
  Shield, 
  Building2, 
  Settings, 
  Users,
  Calendar,
  DollarSign,
  Package,
  Scissors,
  Activity,
  Bot,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Search
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Company {
  id: number;
  name: string;
  cnpj?: string;
  email: string;
  phone?: string;
  address?: string;
  active: boolean;
  createdAt: string;
  moduleCount: number;
}

interface ModuleStatus {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  loadStatus: 'ok' | 'error' | 'loading';
  errorMessage?: string;
}

const moduleIcons = {
  agenda: Calendar,
  pacientes: Users,
  financeiro: DollarSign,
  estoque: Package,
  proteses: Scissors,
  odontograma: Activity,
  automacoes: Bot,
  clinica: Settings
};

export default function SuperAdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Buscar empresas
  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ["/api/saas/companies"],
    queryFn: async () => {
      const response = await fetch("/api/saas/companies");
      return response.json();
    }
  });

  // Buscar módulos da empresa selecionada
  const { data: companyModules = [], isLoading: modulesLoading, refetch: refetchModules } = useQuery({
    queryKey: ["/api/saas/companies", selectedCompany?.id, "modules"],
    queryFn: async () => {
      if (!selectedCompany) return [];
      const response = await fetch(`/api/saas/companies/${selectedCompany.id}/modules`);
      return response.json();
    },
    enabled: !!selectedCompany
  });

  // Mutation para toggle de módulos
  const toggleModuleMutation = useMutation({
    mutationFn: async ({ companyId, moduleId, enabled }: { companyId: number; moduleId: string; enabled: boolean }) => {
      const response = await fetch(`/api/saas/companies/${companyId}/modules/${moduleId}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled })
      });
      if (!response.ok) {
        throw new Error('Falha ao alterar módulo');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Módulo atualizado",
        description: "O módulo foi atualizado com sucesso para a empresa."
      });
      refetchModules();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar módulo.",
        variant: "destructive"
      });
    }
  });

  // Mutation para criar nova empresa
  const createCompanyMutation = useMutation({
    mutationFn: async (companyData: Partial<Company>) => {
      const response = await apiRequest('/api/saas/companies', 'POST', companyData);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Empresa criada",
        description: "Nova empresa criada com sucesso."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/saas/companies"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar empresa.",
        variant: "destructive"
      });
    }
  });

  const handleModuleToggle = (moduleId: string, currentState: boolean) => {
    if (!selectedCompany) return;
    
    toggleModuleMutation.mutate({
      companyId: selectedCompany.id,
      moduleId,
      enabled: !currentState
    });
  };

  const getModuleStatusIcon = (status: string) => {
    switch (status) {
      case 'ok':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'loading':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const filteredCompanies = companies.filter((company: Company) =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (companiesLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Carregando empresas...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8 text-purple-600" />
          SuperAdmin - Gerenciamento SaaS
        </h1>
        <p className="text-muted-foreground mt-2">
          Gerencie empresas, módulos e configurações globais do sistema
        </p>
      </div>

      <Tabs defaultValue="companies" className="space-y-6">
        <TabsList>
          <TabsTrigger value="companies">Empresas</TabsTrigger>
          <TabsTrigger value="modules">Módulos por Empresa</TabsTrigger>
          <TabsTrigger value="system">Sistema Global</TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Empresas Cadastradas</CardTitle>
                  <CardDescription>
                    Gerencie as empresas do sistema SaaS
                  </CardDescription>
                </div>
                <Button
                  onClick={() => {/* TODO: Implementar modal de criação */}}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Nova Empresa
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar empresas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCompanies.map((company: Company) => (
                    <Card 
                      key={company.id} 
                      className={`cursor-pointer transition-all hover:shadow-lg ${
                        selectedCompany?.id === company.id ? 'ring-2 ring-purple-500' : ''
                      }`}
                      onClick={() => setSelectedCompany(company)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Building2 className="h-5 w-5 text-purple-600" />
                            <CardTitle className="text-lg">{company.name}</CardTitle>
                          </div>
                          {company.active ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">{company.email}</p>
                          {company.phone && (
                            <p className="text-sm text-muted-foreground">{company.phone}</p>
                          )}
                          <div className="flex items-center justify-between pt-2">
                            <Badge variant="secondary">
                              {company.moduleCount || 0} módulos
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(company.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {filteredCompanies.length === 0 && (
                  <div className="text-center py-8">
                    <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium">Nenhuma empresa encontrada</p>
                    <p className="text-muted-foreground">
                      {searchTerm ? 'Tente ajustar os filtros de busca' : 'Comece criando uma nova empresa'}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modules" className="mt-6">
          {!selectedCompany ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium">Selecione uma empresa</p>
                  <p className="text-muted-foreground">
                    Escolha uma empresa na aba anterior para gerenciar seus módulos
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Módulos - {selectedCompany.name}</CardTitle>
                  <CardDescription>
                    Gerencie os módulos habilitados para esta empresa
                  </CardDescription>
                </CardHeader>
              </Card>

              {modulesLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(8)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardHeader className="pb-3">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2 mt-2"></div>
                      </CardHeader>
                      <CardContent>
                        <div className="h-20 bg-gray-200 rounded"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {companyModules.map((module: any) => {
                    const IconComponent = moduleIcons[module.name as keyof typeof moduleIcons] || Settings;
                    const isEnabled = module.is_enabled || false;
                    
                    return (
                      <Card key={module.name} className="transition-all hover:shadow-lg">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <IconComponent className="h-5 w-5 text-purple-600" />
                              <CardTitle className="text-lg">{module.display_name}</CardTitle>
                            </div>
                            <div className="flex items-center space-x-2">
                              {getModuleStatusIcon('ok')}
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={() => handleModuleToggle(module.name, isEnabled)}
                                disabled={toggleModuleMutation.isPending}
                              />
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3">
                            {module.description}
                          </p>
                          <div className="flex items-center justify-between">
                            <Badge 
                              variant={isEnabled ? "default" : "secondary"}
                            >
                              {isEnabled ? "Ativo" : "Inativo"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              v{module.version || "1.0.0"}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="system" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Status do Sistema</CardTitle>
                <CardDescription>
                  Monitoramento global do sistema SaaS
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Total de Empresas</span>
                    <Badge variant="secondary">{companies.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Empresas Ativas</span>
                    <Badge variant="default">
                      {companies.filter((c: Company) => c.active).length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Módulos Disponíveis</span>
                    <Badge variant="secondary">8</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ações Administrativas</CardTitle>
                <CardDescription>
                  Ferramentas de administração do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button variant="outline" className="w-full justify-start">
                    <Settings className="h-4 w-4 mr-2" />
                    Configurações Globais
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Users className="h-4 w-4 mr-2" />
                    Gerenciar Usuários
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Activity className="h-4 w-4 mr-2" />
                    Logs do Sistema
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}