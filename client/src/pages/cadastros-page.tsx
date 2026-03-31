import { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Trash2,
  PencilIcon,
  Plus,
  Loader2,
  BoxSelect,
  Layout,
  Bed,
  Package
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface CrudItem {
  id: number;
  name: string;
  description?: string;
  type?: string;
}

function CrudSection({
  title,
  description,
  queryKey,
  apiPath,
  itemLabel,
}: {
  title: string;
  description: string;
  queryKey: string;
  apiPath: string;
  itemLabel: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CrudItem | null>(null);
  const [formName, setFormName] = useState("");

  const { data: items = [], isLoading } = useQuery<CrudItem[]>({
    queryKey: [queryKey],
    queryFn: async () => {
      const res = await fetch(apiPath, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", apiPath, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast({ title: `${itemLabel} criado(a)`, description: `${itemLabel} adicionado(a) com sucesso.` });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Erro", description: `Falha ao criar ${itemLabel.toLowerCase()}.`, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await apiRequest("PATCH", `${apiPath}/${id}`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast({ title: `${itemLabel} atualizado(a)`, description: `${itemLabel} atualizado(a) com sucesso.` });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Erro", description: `Falha ao atualizar ${itemLabel.toLowerCase()}.`, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `${apiPath}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast({ title: `${itemLabel} removido(a)`, description: `${itemLabel} removido(a) com sucesso.` });
    },
    onError: () => {
      toast({ title: "Erro", description: `Falha ao remover ${itemLabel.toLowerCase()}.`, variant: "destructive" });
    },
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
    setFormName("");
  };

  const openCreate = () => {
    setEditingItem(null);
    setFormName("");
    setIsDialogOpen(true);
  };

  const openEdit = (item: CrudItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formName.trim()) return;
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, name: formName.trim() });
    } else {
      createMutation.mutate(formName.trim());
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Novo(a) {itemLabel}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nenhum(a) {itemLabel.toLowerCase()} cadastrado(a). Clique em "Novo(a) {itemLabel}" para adicionar.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(item)}
                    >
                      <PencilIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteMutation.mutate(item.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? `Editar ${itemLabel}` : `Novo(a) ${itemLabel}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="item-name">Nome</Label>
              <Input
                id="item-name"
                placeholder={`Nome do(a) ${itemLabel.toLowerCase()}`}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!formName.trim() || isPending}>
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {editingItem ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function CadastrosPage() {
  const [activeTab, setActiveTab] = useState("categorias");

  return (
    <DashboardLayout title="Cadastros" currentPath="/cadastros">
      <div className="flex flex-col space-y-6 p-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Cadastros</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="categorias" className="flex items-center justify-center">
              <BoxSelect className="h-4 w-4 mr-2" />
              <span>Categorias</span>
            </TabsTrigger>
            <TabsTrigger value="caixas" className="flex items-center justify-center">
              <Package className="h-4 w-4 mr-2" />
              <span>Caixas</span>
            </TabsTrigger>
            <TabsTrigger value="cadeiras" className="flex items-center justify-center">
              <Bed className="h-4 w-4 mr-2" />
              <span>Cadeiras</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="categorias">
            <CrudSection
              title="Categorias"
              description="Gerencie as categorias de despesas e receitas do seu consultório"
              queryKey="/api/cadastros/categories"
              apiPath="/api/cadastros/categories"
              itemLabel="Categoria"
            />
          </TabsContent>

          <TabsContent value="caixas">
            <CrudSection
              title="Caixas"
              description="Gerencie os caixas e contas do seu consultório"
              queryKey="/api/cadastros/boxes"
              apiPath="/api/cadastros/boxes"
              itemLabel="Caixa"
            />
          </TabsContent>

          <TabsContent value="cadeiras">
            <CrudSection
              title="Cadeiras"
              description="Gerencie as cadeiras e salas do seu consultório"
              queryKey="/api/cadastros/chairs"
              apiPath="/api/cadastros/chairs"
              itemLabel="Cadeira"
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
