import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { 
  Building2, 
  Users, 
  Package, 
  CheckCircle, 
  XCircle, 
  Settings,
  Plus
} from "lucide-react";
import DashboardLayout from "@/layouts/DashboardLayout";

interface Company {
  id: number;
  name: string;
  email: string;
  phone: string;
  cnpj: string;
  active: boolean;
  createdAt: string;
}

interface Module {
  id: number;
  name: string;
  displayName: string;
  description: string;
  version: string;
  isActive: boolean;
  isLoaded: boolean;
  hasBackend: boolean;
  hasFrontend: boolean;
  requiredPermissions: string[];
}

interface CompanyModule {
  id: number;
  name: string;
  displayName: string;
  description: string;
  version: string;
  isEnabled: boolean;
  settings: Record<string, any>;
}

export default function AdminPage() {
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch companies
  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/admin/companies'],
  });

  // Fetch all modules
  const { data: modules = [] } = useQuery<Module[]>({
    queryKey: ['/api/admin/modules'],
  });

  // Fetch company modules when a company is selected
  const { data: companyModules = [] } = useQuery<CompanyModule[]>({
    queryKey: ['/api/admin/companies', selectedCompany, 'modules'],
    enabled: !!selectedCompany,
  });

  // Enable/Disable module mutation
  const toggleModuleMutation = useMutation({
    mutationFn: async ({ companyId, moduleId, enable }: { companyId: number; moduleId: number; enable: boolean }) => {
      const endpoint = enable ? 'enable' : 'disable';
      const response = await fetch(`/api/admin/companies/${companyId}/modules/${moduleId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to toggle module');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/companies', selectedCompany, 'modules'] });
      toast({
        title: "Sucesso",
        description: "Módulo atualizado com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar módulo",
        variant: "destructive",
      });
    },
  });

  const handleToggleModule = (moduleId: number, enable: boolean) => {
    if (!selectedCompany) return;
    toggleModuleMutation.mutate({ companyId: selectedCompany, moduleId, enable });
  };

  return (
    <DashboardLayout title="Administração do Sistema" currentPath="/admin">
      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Empresas</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{companies.length}</div>
              <p className="text-xs text-muted-foreground">
                {companies.filter(c => c.active).length} ativas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Módulos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{modules.length}</div>
              <p className="text-xs text-muted-foreground">
                {modules.filter(m => m.isLoaded).length} carregados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status Sistema</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Online</div>
              <p className="text-xs text-muted-foreground">
                Todos os serviços operacionais
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="companies" className="space-y-4">
          <TabsList>
            <TabsTrigger value="companies">Empresas</TabsTrigger>
            <TabsTrigger value="modules">Módulos</TabsTrigger>
            <TabsTrigger value="management">Gerenciamento</TabsTrigger>
          </TabsList>

          {/* Companies Tab */}
          <TabsContent value="companies" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Empresas Cadastradas</CardTitle>
                <CardDescription>
                  Gerencie as empresas e seus acessos ao sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {companies.map((company) => (
                    <div
                      key={company.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedCompany === company.id 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedCompany(company.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{company.name}</h3>
                          <p className="text-sm text-muted-foreground">{company.email}</p>
                          {company.cnpj && (
                            <p className="text-xs text-muted-foreground">CNPJ: {company.cnpj}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={company.active ? "default" : "secondary"}>
                            {company.active ? "Ativa" : "Inativa"}
                          </Badge>
                          <Users className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Modules Tab */}
          <TabsContent value="modules" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Módulos Disponíveis</CardTitle>
                <CardDescription>
                  Status e informações dos módulos do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {modules.map((module) => (
                    <div key={module.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{module.displayName}</h3>
                            <Badge variant="outline">v{module.version}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{module.description}</p>
                          <div className="flex items-center gap-2">
                            {module.isLoaded ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="text-xs">
                              {module.isLoaded ? 'Carregado' : 'Não carregado'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {module.hasBackend && (
                            <Badge variant="secondary">Backend</Badge>
                          )}
                          {module.hasFrontend && (
                            <Badge variant="secondary">Frontend</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Management Tab */}
          <TabsContent value="management" className="space-y-4">
            {selectedCompany ? (
              <Card>
                <CardHeader>
                  <CardTitle>Gerenciar Módulos</CardTitle>
                  <CardDescription>
                    Ative ou desative módulos para {companies.find(c => c.id === selectedCompany)?.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {modules.map((module) => {
                      const companyModule = companyModules.find(cm => cm.name === module.name);
                      const isEnabled = companyModule?.isEnabled || false;

                      return (
                        <div key={module.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <h3 className="font-medium">{module.displayName}</h3>
                            <p className="text-sm text-muted-foreground">{module.description}</p>
                          </div>
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(checked) => handleToggleModule(module.id, checked)}
                            disabled={toggleModuleMutation.isPending}
                          />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium mb-2">Selecione uma Empresa</h3>
                  <p className="text-sm text-muted-foreground">
                    Escolha uma empresa na aba "Empresas" para gerenciar seus módulos
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}