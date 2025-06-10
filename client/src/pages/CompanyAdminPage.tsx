import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { 
  Users, 
  Shield, 
  Settings, 
  Building2,
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

interface UserPermissions {
  moduleName: string;
  displayName: string;
  description: string;
  permissions: string[];
  moduleEnabled: boolean;
}

const PERMISSION_LABELS = {
  read: "Visualizar",
  write: "Editar",
  delete: "Excluir",
  admin: "Administrar"
};

const moduleIcons = {
  clinica: Building2,
  agenda: Calendar,
  pacientes: Users,
  financeiro: DollarSign,
  estoque: Package,
  proteses: Scissors,
  odontograma: Activity,
  automacoes: Bot
};

export default function CompanyAdminPage() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar usuários da empresa
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/users");
      return response.json();
    }
  });

  // Buscar permissões do usuário selecionado
  const { data: userPermissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ["/api/admin/users", selectedUser?.id, "permissions"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/admin/users/${selectedUser?.id}/permissions`);
      return response.json();
    },
    enabled: !!selectedUser
  });

  // Buscar módulos usando a mesma API do SaaS (empresa 3 - Dental Care Plus)
  const { data: modulesData = [], isLoading: modulesLoading } = useQuery({
    queryKey: ["/api/test/saas/companies/3/modules"],
    queryFn: async () => {
      const response = await fetch("/api/test/saas/companies/3/modules");
      return response.json();
    },
    staleTime: 30000
  });

  // Processar e categorizar módulos
  const processedModules = modulesData.map((module: any) => ({
    definition: {
      id: module.definition?.id || module.id,
      displayName: module.definition?.displayName || module.name,
      description: module.definition?.description || module.description
    },
    isActive: module.is_enabled || false
  }));

  const byCategory = {
    clinico: processedModules.filter((module: any) => 
      ['agenda', 'pacientes', 'odontograma', 'proteses'].includes(module.definition?.id)
    ),
    administrativo: processedModules.filter((module: any) => 
      ['financeiro', 'estoque'].includes(module.definition?.id)
    ),
    integracao: processedModules.filter((module: any) => 
      ['automacoes'].includes(module.definition?.id)
    )
  };

  const loaded = modulesData.length;

  // Mutation para atualizar permissões
  const updatePermissionsMutation = useMutation({
    mutationFn: ({ userId, moduleName, permissions }: { userId: number; moduleName: string; permissions: string[] }) =>
      apiRequest(`/api/admin/users/${userId}/permissions`, "POST", { moduleName, permissions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", selectedUser?.id, "permissions"] });
      toast({
        title: "Permissões atualizadas",
        description: "As permissões do usuário foram atualizadas com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar as permissões.",
        variant: "destructive",
      });
    }
  });

  // Mutations para módulos
  const activateModuleMutation = useMutation({
    mutationFn: (moduleId: string) => 
      apiRequest(`/api/clinic/modules/${moduleId}/activate`, "POST"),
    onSuccess: (_, moduleId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinic/modules"] });
      toast({
        title: "Módulo Ativado",
        description: `O módulo ${moduleId} foi ativado com sucesso.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao ativar módulo",
        variant: "destructive",
      });
    }
  });

  const deactivateModuleMutation = useMutation({
    mutationFn: (moduleId: string) => 
      apiRequest(`/api/clinic/modules/${moduleId}/deactivate`, "POST"),
    onSuccess: (_, moduleId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinic/modules"] });
      toast({
        title: "Módulo Desativado",
        description: `O módulo ${moduleId} foi desativado com sucesso.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao desativar módulo",
        variant: "destructive",
      });
    }
  });

  const handlePermissionChange = (moduleName: string, permission: string, checked: boolean) => {
    if (!selectedUser) return;

    const currentModule = userPermissions.find((p: UserPermissions) => p.moduleName === moduleName);
    if (!currentModule) return;

    let newPermissions = [...currentModule.permissions];
    
    if (checked) {
      if (!newPermissions.includes(permission)) {
        newPermissions.push(permission);
      }
    } else {
      newPermissions = newPermissions.filter(p => p !== permission);
    }

    updatePermissionsMutation.mutate({
      userId: selectedUser.id,
      moduleName,
      permissions: newPermissions
    });
  };

  const handleToggleModule = (moduleId: string, isActive: boolean) => {
    if (isActive) {
      deactivateModuleMutation.mutate(moduleId);
    } else {
      activateModuleMutation.mutate(moduleId);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'dentist': return 'secondary';
      case 'staff': return 'outline';
      case 'superadmin': return 'destructive';
      default: return 'outline';
    }
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

  // Adaptar dados dos módulos para o formato esperado
  const adaptedModulesData = {
    byCategory: {
      clinica: modulesData.map((module: any) => ({
        definition: {
          id: module.name,
          displayName: module.display_name,
          description: module.description
        },
        isActive: module.is_enabled || false
      }))
    },
    loaded: modulesData.length
  };

  const { byCategory = {}, loaded = 0 } = adaptedModulesData;

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

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usuários e Permissões
          </TabsTrigger>
          <TabsTrigger value="modules" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Módulos da Clínica
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista de Usuários */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuários
            </CardTitle>
            <CardDescription>
              Selecione um usuário para gerenciar suas permissões
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {users.map((user: User) => (
                <div
                  key={user.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedUser?.id === user.id
                      ? "bg-primary/10 border-primary"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => setSelectedUser(user)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{user.full_name}</h3>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      {user.speciality && (
                        <p className="text-xs text-muted-foreground">{user.speciality}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={getRoleColor(user.role)}>
                        {user.role}
                      </Badge>
                      <Badge variant={user.active ? "default" : "secondary"} className="text-xs">
                        {user.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Permissões do Usuário Selecionado */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Permissões
              {selectedUser && (
                <span className="text-sm font-normal text-muted-foreground">
                  - {selectedUser.full_name}
                </span>
              )}
            </CardTitle>
            <CardDescription>
              Configure as permissões de acesso aos módulos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedUser ? (
              <div className="text-center py-8 text-muted-foreground">
                Selecione um usuário para ver suas permissões
              </div>
            ) : permissionsLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando permissões...
              </div>
            ) : (
              <div className="space-y-4">
                {userPermissions.map((modulePermission: UserPermissions) => (
                  <div key={modulePermission.moduleName} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-medium">{modulePermission.displayName}</h3>
                        <p className="text-sm text-muted-foreground">
                          {modulePermission.description}
                        </p>
                      </div>
                      <Badge variant={modulePermission.moduleEnabled ? "default" : "secondary"}>
                        {modulePermission.moduleEnabled ? "Módulo Ativo" : "Módulo Inativo"}
                      </Badge>
                    </div>
                    
                    {modulePermission.moduleEnabled && (
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(PERMISSION_LABELS).map(([permission, label]) => (
                          <div key={permission} className="flex items-center space-x-2">
                            <Checkbox
                              id={`${modulePermission.moduleName}-${permission}`}
                              checked={modulePermission.permissions.includes(permission)}
                              onCheckedChange={(checked) => 
                                handlePermissionChange(modulePermission.moduleName, permission, checked as boolean)
                              }
                              disabled={updatePermissionsMutation.isPending}
                            />
                            <label
                              htmlFor={`${modulePermission.moduleName}-${permission}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {label}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {!modulePermission.moduleEnabled && (
                      <p className="text-sm text-muted-foreground italic">
                        Módulo não está ativo para esta empresa
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          </div>
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
                {loaded} módulos carregados
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
                    {byCategory.clinico?.map((module: any) => {
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
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-gray-400" />
                                )}
                                <Switch
                                  checked={module.isActive}
                                  onCheckedChange={() => handleToggleModule(module.definition.id, module.isActive)}
                                  disabled={activateModuleMutation.isPending || deactivateModuleMutation.isPending}
                                />
                              </div>
                            </div>
                            <CardDescription className="text-sm">
                              {module.definition.description}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Versão: {module.definition.version}</span>
                                <Badge variant={module.isActive ? "default" : "secondary"} className="text-xs">
                                  {module.isActive ? "Ativo" : "Inativo"}
                                </Badge>
                              </div>
                            </div>
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
                    {byCategory.administrativo?.map((module: any) => {
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
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-gray-400" />
                                )}
                                <Switch
                                  checked={module.isActive}
                                  onCheckedChange={() => handleToggleModule(module.definition.id, module.isActive)}
                                  disabled={activateModuleMutation.isPending || deactivateModuleMutation.isPending}
                                />
                              </div>
                            </div>
                            <CardDescription className="text-sm">
                              {module.definition.description}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Versão: {module.definition.version}</span>
                                <Badge variant={module.isActive ? "default" : "secondary"} className="text-xs">
                                  {module.isActive ? "Ativo" : "Inativo"}
                                </Badge>
                              </div>
                            </div>
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
                    {byCategory.integracao?.map((module: any) => {
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
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-gray-400" />
                                )}
                                <Switch
                                  checked={module.isActive}
                                  onCheckedChange={() => handleToggleModule(module.definition.id, module.isActive)}
                                  disabled={activateModuleMutation.isPending || deactivateModuleMutation.isPending}
                                />
                              </div>
                            </div>
                            <CardDescription className="text-sm">
                              {module.definition.description}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Versão: {module.definition.version}</span>
                                <Badge variant={module.isActive ? "default" : "secondary"} className="text-xs">
                                  {module.isActive ? "Ativo" : "Inativo"}
                                </Badge>
                              </div>
                            </div>
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