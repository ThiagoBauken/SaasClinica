import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Building2, Settings, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar todas as empresas
  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ["/api/saas/companies"],
    queryFn: async () => {
      const response = await apiRequest("/api/saas/companies", "GET");
      return response.json();
    }
  });

  // Buscar módulos da empresa selecionada
  const { data: modules = [], isLoading: modulesLoading } = useQuery({
    queryKey: ["/api/saas/companies", selectedCompany?.id, "modules"],
    queryFn: async () => {
      const response = await apiRequest(`/api/saas/companies/${selectedCompany?.id}/modules`, "GET");
      return response.json();
    },
    enabled: !!selectedCompany
  });

  // Mutation para toggle de módulo
  const toggleModuleMutation = useMutation({
    mutationFn: ({ companyId, moduleId, enabled }: { companyId: number; moduleId: number; enabled: boolean }) =>
      apiRequest(`/api/saas/companies/${companyId}/modules/${moduleId}/toggle`, "POST", { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saas/companies", selectedCompany?.id, "modules"] });
      toast({
        title: "Módulo atualizado",
        description: "O status do módulo foi atualizado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar o módulo.",
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
          <Settings className="h-8 w-8" />
          Administração SaaS
        </h1>
        <p className="text-muted-foreground mt-2">
          Gerencie empresas e seus módulos habilitados
        </p>
      </div>

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
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedCompany?.id === company.id
                      ? "bg-primary/10 border-primary"
                      : "hover:bg-muted"
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
              <Users className="h-5 w-5" />
              Módulos
              {selectedCompany && (
                <span className="text-sm font-normal text-muted-foreground">
                  - {selectedCompany.name}
                </span>
              )}
            </CardTitle>
            <CardDescription>
              Ative ou desative módulos para a empresa selecionada
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedCompany ? (
              <div className="text-center py-8 text-muted-foreground">
                Selecione uma empresa para ver seus módulos
              </div>
            ) : modulesLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando módulos...
              </div>
            ) : (
              <div className="space-y-4">
                {modules.map((module: Module) => (
                  <div
                    key={module.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium">{module.display_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {module.description}
                      </p>
                      {module.enabled_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Ativado em: {new Date(module.enabled_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={module.is_enabled ? "default" : "secondary"}>
                        {module.is_enabled ? "Ativo" : "Inativo"}
                      </Badge>
                      <Switch
                        checked={module.is_enabled}
                        onCheckedChange={(checked) => handleToggleModule(module.id, checked)}
                        disabled={toggleModuleMutation.isPending}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}