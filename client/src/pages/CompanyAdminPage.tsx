import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { 
  Users, 
  Shield, 
  Settings, 
  Calendar,
  DollarSign,
  Package,
  Scissors,
  Activity,
  Bot,
  CheckCircle,
  XCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
  phone?: string;
  role: string;
  speciality?: string;
  active: boolean;
  created_at: string;
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

export default function CompanyAdminPageFixed() {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Buscar usuários
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const response = await apiRequest("/api/admin/users", "GET");
      return response;
    }
  });

  // Buscar módulos
  const { data: modulesData = [], isLoading: modulesLoading } = useQuery({
    queryKey: ["/api/test/saas/companies/3/modules"],
    queryFn: async () => {
      const response = await fetch("/api/test/saas/companies/3/modules");
      return response.json();
    },
    staleTime: 30000
  });

  // Processar dados dos módulos
  const processedModules = modulesData.map((module: any) => ({
    definition: {
      id: module.name || module.id,
      displayName: module.display_name || module.name,
      description: module.description || "Sem descrição"
    },
    isActive: module.is_enabled || false
  }));

  const modulesByCategory = {
    clinico: processedModules.filter((module: any) => 
      ['agenda', 'pacientes', 'odontograma', 'proteses'].includes(module.definition.id)
    ),
    administrativo: processedModules.filter((module: any) => 
      ['financeiro', 'estoque'].includes(module.definition.id)
    ),
    integracao: processedModules.filter((module: any) => 
      ['automacoes'].includes(module.definition.id)
    )
  };

  const totalModules = modulesData.length;

  // Mutation para toggle de módulos
  const toggleModuleMutation = useMutation({
    mutationFn: async ({ moduleId, enabled }: { moduleId: string; enabled: boolean }) => {
      const response = await fetch(`/api/test/saas/companies/3/modules/${moduleId}/toggle`, {
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
        description: "O módulo foi atualizado com sucesso."
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar módulo.",
        variant: "destructive"
      });
    }
  });

  const handleModuleToggle = (moduleId: string, currentState: boolean) => {
    toggleModuleMutation.mutate({
      moduleId,
      enabled: !currentState
    });
  };

  if (usersLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Carregando usuários...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Administração da Clínica
        </h1>
        <p className="text-muted-foreground mt-2">
          Gerencie usuários, permissões e módulos da clínica
        </p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="modules">Módulos</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Usuários da Clínica</CardTitle>
              <CardDescription>
                Gerencie os usuários e suas permissões
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum usuário encontrado
                  </p>
                ) : (
                  users.map((user: User) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div>
                          <h3 className="font-medium">{user.full_name}</h3>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                        <Badge variant="secondary">{user.role}</Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        {user.active ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedUser(user)}
                        >
                          Gerenciar
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modules" className="mt-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Módulos da Clínica</h2>
                <p className="text-muted-foreground">
                  Gerencie os módulos e funcionalidades da sua clínica
                </p>
              </div>
              <Badge variant="secondary" className="text-sm">
                {totalModules} módulos carregados
              </Badge>
            </div>

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
              <>
                {/* Módulos Clínicos */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-blue-600">Módulos Clínicos</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {modulesByCategory.clinico.map((module: any) => {
                      const IconComponent = moduleIcons[module.definition.id as keyof typeof moduleIcons] || Settings;
                      return (
                        <Card key={module.definition.id} className="transition-all hover:shadow-lg">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <IconComponent className="h-5 w-5 text-blue-600" />
                                <CardTitle className="text-lg">{module.definition.displayName}</CardTitle>
                              </div>
                              <div className="flex items-center space-x-2">
                                {module.isActive ? (
                                  <CheckCircle className="h-5 w-5 text-green-600" />
                                ) : (
                                  <XCircle className="h-5 w-5 text-red-600" />
                                )}
                                <Switch
                                  checked={module.isActive}
                                  onCheckedChange={() => handleModuleToggle(module.definition.id, module.isActive)}
                                  disabled={toggleModuleMutation.isPending}
                                />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">
                              {module.definition.description}
                            </p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Módulos Administrativos */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-green-600">Módulos Administrativos</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {modulesByCategory.administrativo.map((module: any) => {
                      const IconComponent = moduleIcons[module.definition.id as keyof typeof moduleIcons] || Settings;
                      return (
                        <Card key={module.definition.id} className="transition-all hover:shadow-lg">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <IconComponent className="h-5 w-5 text-green-600" />
                                <CardTitle className="text-lg">{module.definition.displayName}</CardTitle>
                              </div>
                              <div className="flex items-center space-x-2">
                                {module.isActive ? (
                                  <CheckCircle className="h-5 w-5 text-green-600" />
                                ) : (
                                  <XCircle className="h-5 w-5 text-red-600" />
                                )}
                                <Switch
                                  checked={module.isActive}
                                  onCheckedChange={() => handleModuleToggle(module.definition.id, module.isActive)}
                                  disabled={toggleModuleMutation.isPending}
                                />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">
                              {module.definition.description}
                            </p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Módulos de Integração */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-purple-600">Módulos de Integração</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {modulesByCategory.integracao.map((module: any) => {
                      const IconComponent = moduleIcons[module.definition.id as keyof typeof moduleIcons] || Settings;
                      return (
                        <Card key={module.definition.id} className="transition-all hover:shadow-lg">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <IconComponent className="h-5 w-5 text-purple-600" />
                                <CardTitle className="text-lg">{module.definition.displayName}</CardTitle>
                              </div>
                              <div className="flex items-center space-x-2">
                                {module.isActive ? (
                                  <CheckCircle className="h-5 w-5 text-green-600" />
                                ) : (
                                  <XCircle className="h-5 w-5 text-red-600" />
                                )}
                                <Switch
                                  checked={module.isActive}
                                  onCheckedChange={() => handleModuleToggle(module.definition.id, module.isActive)}
                                  disabled={toggleModuleMutation.isPending}
                                />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">
                              {module.definition.description}
                            </p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}