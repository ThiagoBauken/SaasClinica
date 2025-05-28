import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building, Users, Puzzle, Activity, Settings, Plus } from "lucide-react";

interface Company {
  id: number;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  subscription: 'trial' | 'premium' | 'enterprise';
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Module {
  name: string;
  displayName: string;
  description: string;
  version: string;
  isLoaded: boolean;
  hasBackend: boolean;
  hasFrontend: boolean;
  requiredPermissions: string[];
}

interface DashboardStats {
  companies: {
    total: number;
    active: number;
    trial: number;
    premium: number;
  };
  users: {
    total: number;
    active: number;
    admins: number;
    dentists: number;
    secretaries: number;
  };
  modules: {
    available: number;
    loaded: number;
  };
}

export default function AdminDashboard() {
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // Buscar estatísticas do dashboard
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/dashboard"],
  });

  // Buscar empresas
  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/admin/companies"],
  });

  // Buscar módulos disponíveis
  const { data: modules } = useQuery<Module[]>({
    queryKey: ["/api/admin/modules"],
  });

  // Buscar módulos da empresa selecionada
  const { data: companyModules } = useQuery({
    queryKey: ["/api/admin/companies", selectedCompany?.id, "modules"],
    enabled: !!selectedCompany,
  });

  // Mutação para ativar/desativar módulos
  const enableModuleMutation = useMutation({
    mutationFn: ({ companyId, moduleName }: { companyId: number; moduleName: string }) =>
      fetch(`/api/admin/companies/${companyId}/modules/${moduleName}/enable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies", selectedCompany?.id, "modules"] });
    },
  });

  const disableModuleMutation = useMutation({
    mutationFn: ({ companyId, moduleName }: { companyId: number; moduleName: string }) =>
      fetch(`/api/admin/companies/${companyId}/modules/${moduleName}/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies", selectedCompany?.id, "modules"] });
    },
  });

  const getSubscriptionColor = (subscription: string) => {
    switch (subscription) {
      case 'trial':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'premium':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'enterprise':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Painel Administrativo</h1>
          <p className="text-muted-foreground">
            Gerencie empresas, módulos e usuários do sistema
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nova Empresa
        </Button>
      </div>

      {/* Estatísticas Gerais */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Empresas</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.companies.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.companies.active} ativas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.users.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.users.active} ativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Módulos</CardTitle>
              <Puzzle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.modules.available}</div>
              <p className="text-xs text-muted-foreground">
                {stats.modules.loaded} carregados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sistema</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Online</div>
              <p className="text-xs text-muted-foreground">
                Arquitetura modular ativa
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="companies" className="space-y-4">
        <TabsList>
          <TabsTrigger value="companies">Empresas</TabsTrigger>
          <TabsTrigger value="modules">Módulos</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Lista de Empresas */}
            <Card>
              <CardHeader>
                <CardTitle>Empresas Cadastradas</CardTitle>
                <CardDescription>
                  Gerencie todas as empresas do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {companies?.map((company) => (
                    <div
                      key={company.id}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedCompany?.id === company.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedCompany(company)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{company.name}</span>
                          <Badge
                            variant="secondary"
                            className={getSubscriptionColor(company.subscription)}
                          >
                            {company.subscription}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{company.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            company.active ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        />
                        <Settings className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Módulos da Empresa Selecionada */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedCompany ? `Módulos - ${selectedCompany.name}` : 'Módulos da Empresa'}
                </CardTitle>
                <CardDescription>
                  {selectedCompany
                    ? 'Ative ou desative módulos para esta empresa'
                    : 'Selecione uma empresa para gerenciar módulos'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedCompany ? (
                  <div className="space-y-3">
                    {modules?.map((module) => {
                      const isEnabled = companyModules && Array.isArray(companyModules) ? companyModules.some(
                        (cm: any) => cm.moduleName === module.name && cm.enabled
                      ) : false;

                      return (
                        <div
                          key={module.name}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{module.displayName}</span>
                              <Badge variant={isEnabled ? "default" : "secondary"}>
                                {isEnabled ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {module.description}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant={isEnabled ? "destructive" : "default"}
                            onClick={() => {
                              if (isEnabled) {
                                disableModuleMutation.mutate({
                                  companyId: selectedCompany.id,
                                  moduleName: module.name,
                                });
                              } else {
                                enableModuleMutation.mutate({
                                  companyId: selectedCompany.id,
                                  moduleName: module.name,
                                });
                              }
                            }}
                            disabled={enableModuleMutation.isPending || disableModuleMutation.isPending}
                          >
                            {isEnabled ? 'Desativar' : 'Ativar'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Selecione uma empresa para gerenciar seus módulos
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="modules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Módulos Disponíveis</CardTitle>
              <CardDescription>
                Todos os módulos instalados no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {modules?.map((module) => (
                  <Card key={module.name}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{module.displayName}</CardTitle>
                        <Badge variant={module.isLoaded ? "default" : "secondary"}>
                          {module.isLoaded ? 'Carregado' : 'Não carregado'}
                        </Badge>
                      </div>
                      <CardDescription>{module.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Versão:</span>
                          <span className="font-mono">{module.version}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Backend:</span>
                          <span>{module.hasBackend ? '✅' : '❌'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Frontend:</span>
                          <span>{module.hasFrontend ? '✅' : '❌'}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciamento de Usuários</CardTitle>
              <CardDescription>
                Visualize e gerencie todos os usuários do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Funcionalidade de gerenciamento de usuários será implementada em breve
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}