import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Shield, Settings } from "lucide-react";
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

export default function CompanyAdminPage() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar usuários da empresa
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: () => apiRequest("/api/admin/users")
  });

  // Buscar permissões do usuário selecionado
  const { data: userPermissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ["/api/admin/users", selectedUser?.id, "permissions"],
    queryFn: () => apiRequest(`/api/admin/users/${selectedUser?.id}/permissions`),
    enabled: !!selectedUser
  });

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

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Administração da Clínica
        </h1>
        <p className="text-muted-foreground mt-2">
          Gerencie usuários e suas permissões de acesso aos módulos
        </p>
      </div>

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
    </div>
  );
}