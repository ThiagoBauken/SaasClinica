import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import {
  Shield,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  Calendar,
  Users,
  DollarSign,
  Bot,
  Scissors,
  Package
} from "lucide-react";

interface MenuPermission {
  id?: number;
  companyId: number;
  role: string;
  menuItem: string;
  label: string;
  path: string;
  icon: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  order: number;
}

const AVAILABLE_ICONS = {
  Calendar,
  Users,
  DollarSign,
  Bot,
  Scissors,
  Package,
};

const ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "dentist", label: "Dentista" },
  { value: "staff", label: "Recepcionista" },
];

const ICON_OPTIONS = [
  { value: "Calendar", label: "Calendário" },
  { value: "Users", label: "Usuários" },
  { value: "DollarSign", label: "Dinheiro" },
  { value: "Bot", label: "Robô" },
  { value: "Scissors", label: "Tesoura" },
  { value: "Package", label: "Pacote" },
];

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<MenuPermission[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("admin");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Carregar permissões
  const loadPermissions = async () => {
    try {
      setIsLoading(true);
      const response = await api.get("/api/v1/menu-permissions");
      setPermissions(response.data);
    } catch (error) {
      console.error("Erro ao carregar permissões:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as permissões",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPermissions();
  }, []);

  // Popular com permissões padrão
  const seedDefaultPermissions = async () => {
    try {
      setIsLoading(true);
      await api.post("/api/v1/menu-permissions/seed-defaults");
      toast({
        title: "Sucesso",
        description: "Permissões padrão criadas com sucesso",
      });
      await loadPermissions();
    } catch (error) {
      console.error("Erro ao popular permissões:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar permissões padrão",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Salvar permissões
  const savePermissions = async () => {
    try {
      setIsSaving(true);
      const rolePermissions = permissions.filter(p => p.role === selectedRole);

      await api.put("/api/v1/menu-permissions/bulk-update", {
        permissions: rolePermissions,
      });

      toast({
        title: "Sucesso",
        description: "Permissões salvas com sucesso",
      });
    } catch (error) {
      console.error("Erro ao salvar permissões:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as permissões",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Adicionar nova permissão
  const addPermission = () => {
    const newPermission: MenuPermission = {
      companyId: 0, // Será definido pelo backend
      role: selectedRole,
      menuItem: "new-item",
      label: "Novo Item",
      path: "/new-path",
      icon: "Package",
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      order: permissions.filter(p => p.role === selectedRole).length + 1,
    };
    setPermissions([...permissions, newPermission]);
  };

  // Remover permissão
  const removePermission = async (permissionId?: number, index?: number) => {
    if (permissionId) {
      try {
        await api.delete(`/api/v1/menu-permissions/${permissionId}`);
        toast({
          title: "Sucesso",
          description: "Permissão removida com sucesso",
        });
        await loadPermissions();
      } catch (error) {
        console.error("Erro ao remover permissão:", error);
        toast({
          title: "Erro",
          description: "Não foi possível remover a permissão",
          variant: "destructive",
        });
      }
    } else if (index !== undefined) {
      // Remover da lista local (permissão ainda não salva)
      setPermissions(permissions.filter((_, i) => i !== index));
    }
  };

  // Atualizar permissão
  const updatePermission = (index: number, field: keyof MenuPermission, value: any) => {
    const updatedPermissions = [...permissions];
    updatedPermissions[index] = {
      ...updatedPermissions[index],
      [field]: value,
    };
    setPermissions(updatedPermissions);
  };

  // Filtrar permissões por role
  const rolePermissions = permissions.filter(p => p.role === selectedRole);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Gerenciamento de Permissões
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure o que cada tipo de usuário pode ver e fazer no sistema
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={seedDefaultPermissions}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Restaurar Padrões
          </Button>
          <Button
            onClick={savePermissions}
            disabled={isSaving}
          >
            <Save className="h-4 w-4 mr-2" />
            Salvar Alterações
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selecione o Tipo de Usuário</CardTitle>
          <CardDescription>
            Escolha o tipo de usuário para configurar suas permissões
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {ROLES.map((role) => (
              <Button
                key={role.value}
                variant={selectedRole === role.value ? "default" : "outline"}
                onClick={() => setSelectedRole(role.value)}
              >
                {role.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Itens de Menu</CardTitle>
              <CardDescription>
                Configure quais itens de menu o {ROLES.find(r => r.value === selectedRole)?.label.toLowerCase()} pode acessar
              </CardDescription>
            </div>
            <Button onClick={addPermission} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando permissões...
              </div>
            ) : rolePermissions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma permissão configurada. Clique em "Restaurar Padrões" para criar permissões iniciais.
              </div>
            ) : (
              rolePermissions.map((permission, index) => {
                const globalIndex = permissions.indexOf(permission);
                const IconComponent = AVAILABLE_ICONS[permission.icon as keyof typeof AVAILABLE_ICONS] || Package;

                return (
                  <div key={permission.id || `new-${index}`} className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center gap-4">
                      <IconComponent className="h-6 w-6 text-primary" />

                      <div className="flex-1 grid grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label>Label</Label>
                          <Input
                            value={permission.label}
                            onChange={(e) => updatePermission(globalIndex, "label", e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Caminho</Label>
                          <Input
                            value={permission.path}
                            onChange={(e) => updatePermission(globalIndex, "path", e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Ícone</Label>
                          <Select
                            value={permission.icon}
                            onValueChange={(value) => updatePermission(globalIndex, "icon", value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ICON_OPTIONS.map((icon) => (
                                <SelectItem key={icon.value} value={icon.value}>
                                  {icon.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Ordem</Label>
                          <Input
                            type="number"
                            value={permission.order}
                            onChange={(e) => updatePermission(globalIndex, "order", parseInt(e.target.value))}
                          />
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removePermission(permission.id, globalIndex)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="flex gap-6 pl-10">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`view-${permission.id || index}`}
                          checked={permission.canView}
                          onCheckedChange={(checked) =>
                            updatePermission(globalIndex, "canView", checked)
                          }
                        />
                        <Label htmlFor={`view-${permission.id || index}`}>Visualizar</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`create-${permission.id || index}`}
                          checked={permission.canCreate}
                          onCheckedChange={(checked) =>
                            updatePermission(globalIndex, "canCreate", checked)
                          }
                        />
                        <Label htmlFor={`create-${permission.id || index}`}>Criar</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-${permission.id || index}`}
                          checked={permission.canEdit}
                          onCheckedChange={(checked) =>
                            updatePermission(globalIndex, "canEdit", checked)
                          }
                        />
                        <Label htmlFor={`edit-${permission.id || index}`}>Editar</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`delete-${permission.id || index}`}
                          checked={permission.canDelete}
                          onCheckedChange={(checked) =>
                            updatePermission(globalIndex, "canDelete", checked)
                          }
                        />
                        <Label htmlFor={`delete-${permission.id || index}`}>Deletar</Label>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
