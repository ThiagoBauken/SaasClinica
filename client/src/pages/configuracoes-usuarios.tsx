import { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit, Trash2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "dentist" | "staff";
  active: boolean;
}

type UserFormData = {
  name: string;
  email: string;
  password: string;
  role: "admin" | "dentist" | "staff";
};

const ROLE_LABELS: Record<User["role"], string> = {
  admin: "Administrador",
  dentist: "Dentista",
  staff: "Equipe",
};

const ROLE_VARIANTS: Record<User["role"], "default" | "secondary" | "outline"> = {
  admin: "default",
  dentist: "secondary",
  staff: "outline",
};

const EMPTY_FORM: UserFormData = {
  name: "",
  email: "",
  password: "",
  role: "staff",
};

export default function ConfiguracoesUsuariosPage() {
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>(EMPTY_FORM);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: UserFormData & { id?: number }) => {
      if (data.id) {
        const { id, ...body } = data;
        const res = await apiRequest("PATCH", `/api/users/${id}`, body);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsDialogOpen(false);
      setEditingUser(null);
      setFormData(EMPTY_FORM);
      toast({
        title: "Usuário salvo",
        description: "As informações foram atualizadas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const res = await apiRequest("PATCH", `/api/users/${id}`, { active });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Status atualizado com sucesso." });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Usuário removido com sucesso." });
    },
    onError: () => {
      toast({ title: "Erro ao remover usuário", variant: "destructive" });
    },
  });

  const openCreateDialog = () => {
    setEditingUser(null);
    setFormData(EMPTY_FORM);
    setIsDialogOpen(true);
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      saveMutation.mutate({ ...formData, id: editingUser.id });
    } else {
      saveMutation.mutate(formData);
    }
  };

  const handleDelete = (user: User) => {
    if (confirm(`Tem certeza que deseja remover o usuário "${user.name}"?`)) {
      deleteMutation.mutate(user.id);
    }
  };

  return (
    <DashboardLayout title="Usuários e Permissões" currentPath="/configuracoes/usuarios">
      <div className="container mx-auto py-6 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Usuários e Permissões</CardTitle>
                <CardDescription>
                  Gerencie os usuários da clínica e seus níveis de acesso.
                </CardDescription>
              </div>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length > 0 ? (
                      users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell className="text-muted-foreground">{user.email}</TableCell>
                          <TableCell>
                            <Badge variant={ROLE_VARIANTS[user.role]}>
                              {ROLE_LABELS[user.role]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={user.active}
                              onCheckedChange={(checked) =>
                                toggleActiveMutation.mutate({ id: user.id, active: checked })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(user)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(user)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                          Nenhum usuário cadastrado. Clique em "Novo Usuário" para começar.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Editar Usuário" : "Novo Usuário"}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Atualize as informações do usuário abaixo."
                : "Preencha os dados para criar um novo usuário."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="user-name">Nome completo</Label>
                <Input
                  id="user-name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Dr. Ana Silva"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="user-email">Email</Label>
                <Input
                  id="user-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="usuario@clinica.com"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="user-password">
                  Senha {editingUser && <span className="text-muted-foreground text-xs">(deixe em branco para manter)</span>}
                </Label>
                <Input
                  id="user-password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  required={!editingUser}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="user-role">Cargo</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, role: value as User["role"] }))
                  }
                >
                  <SelectTrigger id="user-role">
                    <SelectValue placeholder="Selecione o cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="dentist">Dentista</SelectItem>
                    <SelectItem value="staff">Equipe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
