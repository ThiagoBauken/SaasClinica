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
import { Plus, Edit, Trash2, Stethoscope, Clock, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Procedure {
  id: number;
  name: string;
  category: string;
  duration: number;
  price: number;
}

type ProcedureFormData = {
  name: string;
  category: string;
  duration: string;
  price: string;
};

const CATEGORIES = [
  "Geral",
  "Preventiva",
  "Restauradora",
  "Endodontia",
  "Ortodontia",
  "Cirurgia",
  "Estética",
  "Prótese",
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  Geral: "bg-gray-100 text-gray-700",
  Preventiva: "bg-green-100 text-green-700",
  Restauradora: "bg-blue-100 text-blue-700",
  Endodontia: "bg-red-100 text-red-700",
  Ortodontia: "bg-purple-100 text-purple-700",
  Cirurgia: "bg-orange-100 text-orange-700",
  Estética: "bg-pink-100 text-pink-700",
  Prótese: "bg-yellow-100 text-yellow-700",
};

const EMPTY_FORM: ProcedureFormData = {
  name: "",
  category: "Geral",
  duration: "",
  price: "",
};

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function ConfiguracoesProcedimentosPage() {
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState<Procedure | null>(null);
  const [formData, setFormData] = useState<ProcedureFormData>(EMPTY_FORM);

  const { data: procedures = [], isLoading } = useQuery<Procedure[]>({
    queryKey: ["/api/v1/procedures"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/v1/procedures");
      if (!res.ok) throw new Error("Falha ao carregar procedimentos");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Procedure> & { id?: number }) => {
      if (data.id) {
        const { id, ...body } = data;
        const res = await apiRequest("PATCH", `/api/v1/procedures/${id}`, body);
        if (!res.ok) throw new Error("Falha ao atualizar procedimento");
        return res.json();
      }
      const res = await apiRequest("POST", "/api/v1/procedures", data);
      if (!res.ok) throw new Error("Falha ao criar procedimento");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/procedures"] });
      setIsDialogOpen(false);
      setEditingProcedure(null);
      setFormData(EMPTY_FORM);
      toast({
        title: "Procedimento salvo",
        description: "O procedimento foi salvo com sucesso.",
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

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/v1/procedures/${id}`);
      if (!res.ok) throw new Error("Falha ao remover procedimento");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/procedures"] });
      toast({ title: "Procedimento removido com sucesso." });
    },
    onError: () => {
      toast({ title: "Erro ao remover procedimento", variant: "destructive" });
    },
  });

  const openCreateDialog = () => {
    setEditingProcedure(null);
    setFormData(EMPTY_FORM);
    setIsDialogOpen(true);
  };

  const openEditDialog = (procedure: Procedure) => {
    setEditingProcedure(procedure);
    setFormData({
      name: procedure.name,
      category: procedure.category,
      duration: String(procedure.duration),
      price: String(procedure.price),
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      category: formData.category,
      duration: Number(formData.duration),
      price: Number(formData.price),
    };
    if (editingProcedure) {
      saveMutation.mutate({ ...payload, id: editingProcedure.id });
    } else {
      saveMutation.mutate(payload);
    }
  };

  const handleDelete = (procedure: Procedure) => {
    if (confirm(`Tem certeza que deseja remover o procedimento "${procedure.name}"?`)) {
      deleteMutation.mutate(procedure.id);
    }
  };

  return (
    <DashboardLayout title="Catálogo de Procedimentos" currentPath="/configuracoes/procedimentos">
      <div className="container mx-auto py-6 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Stethoscope className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Catálogo de Procedimentos</CardTitle>
                <CardDescription>
                  Gerencie os procedimentos oferecidos pela clínica, incluindo preços e duração.
                </CardDescription>
              </div>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Procedimento
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
                      <TableHead>Categoria</TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          Duração
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5" />
                          Preço
                        </div>
                      </TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {procedures.length > 0 ? (
                      procedures.map((procedure) => (
                        <TableRow key={procedure.id}>
                          <TableCell className="font-medium">{procedure.name}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                CATEGORY_COLORS[procedure.category] ?? "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {procedure.category}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {procedure.duration} min
                          </TableCell>
                          <TableCell className="font-medium text-green-700">
                            {formatBRL(procedure.price)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(procedure)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(procedure)}
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
                          Nenhum procedimento cadastrado. Clique em "Novo Procedimento" para começar.
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
              {editingProcedure ? "Editar Procedimento" : "Novo Procedimento"}
            </DialogTitle>
            <DialogDescription>
              {editingProcedure
                ? "Atualize as informações do procedimento abaixo."
                : "Preencha os dados para criar um novo procedimento."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="proc-name">Nome do procedimento</Label>
                <Input
                  id="proc-name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Limpeza dental"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="proc-category">Categoria</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, category: value }))
                  }
                >
                  <SelectTrigger id="proc-category">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="proc-duration">Duração (minutos)</Label>
                  <Input
                    id="proc-duration"
                    type="number"
                    min="1"
                    value={formData.duration}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, duration: e.target.value }))
                    }
                    placeholder="30"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="proc-price">Preço (R$)</Label>
                  <Input
                    id="proc-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, price: e.target.value }))
                    }
                    placeholder="150.00"
                    required
                  />
                </div>
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
