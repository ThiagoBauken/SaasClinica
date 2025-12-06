import { useState, useEffect } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger, 
} from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/core/AuthProvider";

interface Laboratory {
  id: number;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  companyId?: number;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
  // Campos antigos para compatibilidade
  contact?: string;
}

export default function LaboratoryManagementPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingLaboratory, setEditingLaboratory] = useState<Laboratory | null>(null);
  const [laboratoryToDelete, setLaboratoryToDelete] = useState<Laboratory | null>(null);
  
  // Query para buscar laboratórios
  const { data: laboratories, isLoading, error } = useQuery<Laboratory[]>({
    queryKey: ["/api/laboratories"],
    queryFn: async () => {
      console.log("Buscando laboratórios...");
      const res = await apiRequest("GET", "/api/laboratories");
      if (!res.ok) {
        throw new Error(`Erro ao carregar laboratórios: ${res.status}`);
      }
      const data = await res.json();
      console.log("Laboratórios carregados:", data);
      return data;
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0 // Sempre buscar dados frescos
  });
  
  // Mutation para criar/atualizar laboratório
  const laboratoryMutation = useMutation({
    mutationFn: async (laboratoryData: Partial<Laboratory>) => {
      console.log("🚀 Iniciando mutation com dados:", laboratoryData);
      
      try {
        if (laboratoryData.id) {
          // Atualização
          console.log("📝 Atualizando laboratório ID:", laboratoryData.id);
          const res = await apiRequest("PATCH", `/api/laboratories/${laboratoryData.id}`, laboratoryData);
          console.log("📊 Resposta PATCH:", res.status, res.statusText);
          if (!res.ok) {
            const errorText = await res.text();
            console.error("❌ Erro PATCH:", errorText);
            throw new Error(`Erro HTTP: ${res.status} ${res.statusText} - ${errorText}`);
          }
          const result = await res.json();
          console.log("✅ Sucesso PATCH:", result);
          return result;
        } else {
          // Criação
          console.log("🆕 Criando novo laboratório");
          const res = await apiRequest("POST", "/api/laboratories", laboratoryData);
          console.log("📊 Resposta POST:", res.status, res.statusText);
          if (!res.ok) {
            const errorText = await res.text();
            console.error("❌ Erro POST:", errorText);
            throw new Error(`Erro HTTP: ${res.status} ${res.statusText} - ${errorText}`);
          }
          const result = await res.json();
          console.log("✅ Sucesso POST:", result);
          return result;
        }
      } catch (error) {
        console.error("💥 Erro na mutação:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("Mutation success, data received:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/laboratories"] });
      queryClient.refetchQueries({ queryKey: ["/api/laboratories"] });
      setIsDialogOpen(false);
      setEditingLaboratory(null);
      toast({
        title: "Sucesso",
        description: "Laboratório salvo com sucesso!",
      });
      console.log("Cache invalidated and dialog closed");
    },
    onError: (error: Error) => {
      console.error("Erro ao salvar laboratório:", error);
      toast({
        title: "Erro",
        description: `Falha ao salvar laboratório: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Mutation para deletar laboratório
  const deleteLaboratoryMutation = useMutation({
    mutationFn: async (id: number) => {
      try {
        const res = await apiRequest("DELETE", `/api/laboratories/${id}`);
        if (!res.ok) {
          throw new Error(`Erro HTTP: ${res.status} ${res.statusText}`);
        }
        return await res.json();
      } catch (error) {
        console.error("Erro ao deletar laboratório:", error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log("Delete mutation success");
      queryClient.invalidateQueries({ queryKey: ["/api/laboratories"] });
      queryClient.refetchQueries({ queryKey: ["/api/laboratories"] });
      setIsDeleteDialogOpen(false);
      setLaboratoryToDelete(null);
      toast({
        title: "Sucesso",
        description: "Laboratório removido com sucesso!",
      });
      console.log("Cache invalidated after delete");
    },
    onError: (error: Error) => {
      console.error("Erro detalhado ao deletar laboratório:", error);
      toast({
        title: "Erro",
        description: `Falha ao remover laboratório: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Handler para salvar laboratório
  const handleSaveLaboratory = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    console.log("Form submitted, processing data...");
    
    try {
      // Validação básica
      const name = formData.get("name") as string;
      console.log("Nome extraído do form:", name);
      
      if (!name || name.trim() === "") {
        console.error("Nome do laboratório está vazio!");
        throw new Error("O nome do laboratório é obrigatório");
      }
      
      // Preparar dados
      const laboratoryData: Partial<Laboratory> = {
        name: name.trim(),
        contactName: (formData.get("contactName") as string || "").trim(),
        address: (formData.get("address") as string || "").trim(),
        email: (formData.get("email") as string || "").trim(),
        phone: (formData.get("phone") as string || "").trim(),
      };
      
      console.log("Dados preparados para envio:", laboratoryData);
      
      // Se estiver editando, incluir o ID
      if (editingLaboratory) {
        laboratoryData.id = editingLaboratory.id;
        console.log("Editando laboratório com ID:", editingLaboratory.id);
      } else {
        console.log("Criando novo laboratório");
      }
      
      // Enviar mutação
      console.log("Enviando mutação...");
      laboratoryMutation.mutate(laboratoryData);
    } catch (error) {
      // Tratar erros de validação
      toast({
        title: "Erro de validação",
        description: error instanceof Error ? error.message : "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
    }
  };
  
  // Handler para confirmar exclusão
  const handleDeleteLaboratory = () => {
    if (laboratoryToDelete) {
      deleteLaboratoryMutation.mutate(laboratoryToDelete.id);
    }
  };
  
  // Resetar formulário ao abrir para novo laboratório
  const handleOpenNewLaboratory = () => {
    setEditingLaboratory(null);
    setIsDialogOpen(true);
  };
  
  // Configurar dados ao editar laboratório existente
  const handleEditLaboratory = (lab: Laboratory) => {
    setEditingLaboratory(lab);
    setIsDialogOpen(true);
  };
  
  // Configurar laboratório para exclusão
  const handleConfirmDelete = (lab: Laboratory) => {
    setLaboratoryToDelete(lab);
    setIsDeleteDialogOpen(true);
  };
  
  return (
    <DashboardLayout title="Gerenciamento de Laboratórios" currentPath="/laboratories">
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Gerenciamento de Laboratórios</h1>
          <Button onClick={handleOpenNewLaboratory}>
            <Plus className="h-4 w-4 mr-2" /> Novo Laboratório
          </Button>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Laboratórios Cadastrados</CardTitle>
            <CardDescription>
              Gerencie os laboratórios parceiros para o controle de próteses
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-4">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : laboratories && laboratories.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Endereço</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {laboratories.map((lab) => (
                      <TableRow key={lab.id}>
                        <TableCell className="font-medium">{lab.name}</TableCell>
                        <TableCell>{lab.contactName || lab.contact || "-"}</TableCell>
                        <TableCell>{lab.email || "-"}</TableCell>
                        <TableCell>{lab.phone || "-"}</TableCell>
                        <TableCell>{lab.address || "-"}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditLaboratory(lab)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleConfirmDelete(lab)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <p className="text-muted-foreground mb-4">Nenhum laboratório cadastrado</p>
                <Button onClick={handleOpenNewLaboratory}>
                  <Plus className="h-4 w-4 mr-2" /> Adicionar Laboratório
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Modal para adicionar/editar laboratório */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingLaboratory ? "Editar Laboratório" : "Novo Laboratório"}
              </DialogTitle>
              <DialogDescription>
                {editingLaboratory 
                  ? "Edite as informações do laboratório abaixo."
                  : "Preencha as informações do novo laboratório."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveLaboratory}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome*</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={editingLaboratory?.name || ""}
                    placeholder="Nome do laboratório"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contactName">Contato</Label>
                  <Input
                    id="contactName"
                    name="contactName"
                    defaultValue={editingLaboratory?.contactName || editingLaboratory?.contact || ""}
                    placeholder="Nome do contato"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={editingLaboratory?.email || ""}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    defaultValue={editingLaboratory?.phone || ""}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    name="address"
                    defaultValue={editingLaboratory?.address || ""}
                    placeholder="Rua, número, bairro, cidade - UF"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={laboratoryMutation.isPending}>
                  {laboratoryMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        
        {/* Dialog de confirmação para excluir */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o laboratório "{laboratoryToDelete?.name}"?
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteLaboratory}
                disabled={deleteLaboratoryMutation.isPending}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                {deleteLaboratoryMutation.isPending ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}