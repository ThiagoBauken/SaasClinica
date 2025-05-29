import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, Shield, Users, Settings, Edit, Trash2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const permissionFormSchema = z.object({
  userId: z.number().min(1, "Usuário é obrigatório"),
  moduleId: z.number().min(1, "Módulo é obrigatório"),
  permissions: z.array(z.string()).min(1, "Pelo menos uma permissão deve ser selecionada"),
});

type PermissionFormData = z.infer<typeof permissionFormSchema>;

export default function PermissionsAdminPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState<any>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<PermissionFormData>({
    resolver: zodResolver(permissionFormSchema),
    defaultValues: {
      userId: 0,
      moduleId: 0,
      permissions: [],
    },
  });

  // Buscar usuários
  const { data: users = [] } = useQuery({
    queryKey: ["/api/admin/users"],
  });

  // Buscar módulos
  const { data: modules = [] } = useQuery({
    queryKey: ["/api/clinic/modules"],
  });

  // Buscar permissões de usuários
  const { data: userPermissions = [], isLoading } = useQuery({
    queryKey: ["/api/admin/permissions"],
  });

  // Criar/atualizar permissão
  const permissionMutation = useMutation({
    mutationFn: async (data: PermissionFormData) => {
      const url = editingPermission 
        ? `/api/admin/users/${data.userId}/permissions/${editingPermission.moduleId}` 
        : `/api/admin/users/${data.userId}/permissions`;
      const method = editingPermission ? "PATCH" : "POST";
      return apiRequest(url, { method, body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/permissions"] });
      setIsDialogOpen(false);
      setEditingPermission(null);
      form.reset();
      toast({
        title: "Sucesso!",
        description: editingPermission ? "Permissões atualizadas!" : "Permissões concedidas!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao gerenciar permissões. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Remover permissão
  const removeMutation = useMutation({
    mutationFn: async ({ userId, moduleId }: { userId: number; moduleId: number }) => {
      return apiRequest(`/api/admin/users/${userId}/permissions/${moduleId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/permissions"] });
      toast({
        title: "Sucesso!",
        description: "Permissões removidas com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao remover permissões. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (permission: any) => {
    setEditingPermission(permission);
    form.reset({
      userId: permission.userId,
      moduleId: permission.moduleId,
      permissions: permission.permissions || [],
    });
    setIsDialogOpen(true);
  };

  const handleRemove = (userId: number, moduleId: number) => {
    if (confirm("Tem certeza que deseja remover essas permissões?")) {
      removeMutation.mutate({ userId, moduleId });
    }
  };

  const onSubmit = (data: PermissionFormData) => {
    permissionMutation.mutate(data);
  };

  const getUserName = (userId: number) => {
    const user = users.find((u: any) => u.id === userId);
    return user?.fullName || user?.username || 'Usuário não encontrado';
  };

  const getModuleName = (moduleId: number) => {
    const module = modules.find((m: any) => m.id === moduleId);
    return module?.displayName || module?.name || 'Módulo não encontrado';
  };

  const getPermissionBadge = (permission: string) => {
    const permissionConfig = {
      read: { label: "Leitura", color: "secondary" },
      write: { label: "Escrita", color: "default" },
      admin: { label: "Admin", color: "destructive" },
    };
    
    const config = permissionConfig[permission as keyof typeof permissionConfig];
    return config || { label: permission, color: "outline" };
  };

  // Filtrar permissões
  const filteredPermissions = userPermissions.filter((permission: any) => {
    const userName = getUserName(permission.userId).toLowerCase();
    const moduleName = getModuleName(permission.moduleId).toLowerCase();
    return userName.includes(searchTerm.toLowerCase()) || 
           moduleName.includes(searchTerm.toLowerCase());
  });

  // Agrupar permissões por usuário
  const permissionsByUser = filteredPermissions.reduce((acc: any, permission: any) => {
    const userId = permission.userId;
    if (!acc[userId]) {
      acc[userId] = {
        user: getUserName(userId),
        permissions: []
      };
    }
    acc[userId].permissions.push(permission);
    return acc;
  }, {});

  return (
    <DashboardLayout title="Gerenciar Permissões" currentPath="/admin/permissions">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Gerenciar Permissões</h1>
            <p className="text-neutral-medium">Controle granular de acesso aos módulos do sistema</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingPermission(null); form.reset(); }}>
                <Shield className="h-4 w-4 mr-2" />
                Conceder Permissão
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingPermission ? "Editar Permissões" : "Conceder Permissões"}
                </DialogTitle>
                <DialogDescription>
                  {editingPermission 
                    ? "Atualize as permissões do usuário para este módulo"
                    : "Conceda permissões de acesso a módulos para um usuário"}
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="userId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Usuário</FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          defaultValue={field.value?.toString()}
                          disabled={!!editingPermission}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o usuário" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {users.map((user: any) => (
                              <SelectItem key={user.id} value={user.id.toString()}>
                                {user.fullName} ({user.username})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="moduleId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Módulo</FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          defaultValue={field.value?.toString()}
                          disabled={!!editingPermission}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o módulo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {modules.map((module: any) => (
                              <SelectItem key={module.id} value={module.id.toString()}>
                                {module.displayName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="permissions"
                    render={() => (
                      <FormItem>
                        <div className="mb-4">
                          <FormLabel className="text-base">Permissões</FormLabel>
                          <FormDescription>
                            Selecione as permissões que o usuário terá
                          </FormDescription>
                        </div>
                        {["read", "write", "admin"].map((permission) => (
                          <FormField
                            key={permission}
                            control={form.control}
                            name="permissions"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={permission}
                                  className="flex flex-row items-start space-x-3 space-y-0"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(permission)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...field.value, permission])
                                          : field.onChange(
                                              field.value?.filter(
                                                (value) => value !== permission
                                              )
                                            )
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal">
                                    {permission === "read" && "Leitura - Visualizar dados"}
                                    {permission === "write" && "Escrita - Criar e editar"}
                                    {permission === "admin" && "Admin - Controle total"}
                                  </FormLabel>
                                </FormItem>
                              )
                            }}
                          />
                        ))}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={permissionMutation.isPending}>
                      {permissionMutation.isPending ? "Salvando..." : 
                       editingPermission ? "Atualizar" : "Conceder"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-medium">Total Usuários</p>
                  <p className="text-2xl font-bold">{users.length}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-medium">Módulos Ativos</p>
                  <p className="text-2xl font-bold">{modules.length}</p>
                </div>
                <Settings className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-medium">Permissões Ativas</p>
                  <p className="text-2xl font-bold">{userPermissions.length}</p>
                </div>
                <Shield className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-medium">Usuários com Acesso</p>
                  <p className="text-2xl font-bold">{Object.keys(permissionsByUser).length}</p>
                </div>
                <Check className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-medium h-4 w-4" />
          <Input
            placeholder="Buscar por usuário ou módulo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Permissions by User */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-300 rounded mb-4"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : Object.keys(permissionsByUser).length === 0 ? (
          <div className="text-center py-12">
            <Shield className="h-12 w-12 text-neutral-medium mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma permissão encontrada</h3>
            <p className="text-neutral-medium mb-4">
              {searchTerm 
                ? "Tente ajustar sua busca" 
                : "Comece concedendo permissões aos usuários"}
            </p>
            {!searchTerm && (
              <Button onClick={() => setIsDialogOpen(true)}>
                <Shield className="h-4 w-4 mr-2" />
                Conceder Primeira Permissão
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(permissionsByUser).map(([userId, userData]: [string, any]) => (
              <Card key={userId}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-lg">{userData.user}</CardTitle>
                      <CardDescription>
                        {userData.permissions.length} módulo(s) com permissão
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {userData.permissions.map((permission: any) => (
                      <div key={`${permission.userId}-${permission.moduleId}`} 
                           className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <h4 className="font-medium">{getModuleName(permission.moduleId)}</h4>
                          <div className="flex space-x-2 mt-1">
                            {permission.permissions?.map((perm: string) => {
                              const badge = getPermissionBadge(perm);
                              return (
                                <Badge key={perm} variant={badge.color as any}>
                                  {badge.label}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleEdit(permission)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleRemove(permission.userId, permission.moduleId)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}