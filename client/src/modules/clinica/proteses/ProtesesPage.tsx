import { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Search, 
  Plus, 
  Scissors, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  User
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ProtesesPage() {
  const { toast } = useToast();
  const [isAddProsthesisOpen, setIsAddProsthesisOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Fetch prosthesis
  const {
    data: prostheses = [],
    isLoading: isLoadingProstheses,
  } = useQuery({
    queryKey: ["/api/prosthesis"],
  });

  // Fetch patients for select
  const { data: patients = [] } = useQuery({
    queryKey: ["/api/patients"],
  });

  // Create prosthesis mutation
  const createProsthesisMutation = useMutation({
    mutationFn: (newProsthesis: any) => apiRequest("/api/prosthesis", "POST", newProsthesis),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prosthesis"] });
      setIsAddProsthesisOpen(false);
      toast({
        title: "Sucesso",
        description: "Prótese adicionada com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao adicionar prótese",
        variant: "destructive",
      });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest(`/api/prosthesis/${id}`, "PATCH", { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prosthesis"] });
      toast({
        title: "Sucesso",
        description: "Status atualizado com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar status",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    const prosthesisData = {
      patientId: parseInt(formData.get("patientId") as string),
      type: formData.get("type"),
      description: formData.get("description"),
      laboratory: formData.get("laboratory"),
      cost: parseFloat(formData.get("cost") as string) || 0,
      price: parseFloat(formData.get("price") as string) || 0,
      dueDate: formData.get("dueDate"),
      notes: formData.get("notes"),
      status: "moldagem"
    };

    createProsthesisMutation.mutate(prosthesisData);
  };

  // Filter prostheses
  const filteredProstheses = prostheses.filter((prosthesis: any) => {
    const matchesSearch = prosthesis.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         prosthesis.patient?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || prosthesis.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Get status info
  const getStatusInfo = (status: string) => {
    const statusMap = {
      moldagem: { label: "Moldagem", color: "bg-blue-500", icon: Clock },
      laboratorio: { label: "Laboratório", color: "bg-yellow-500", icon: AlertCircle },
      prova: { label: "Prova", color: "bg-orange-500", icon: CheckCircle },
      entregue: { label: "Entregue", color: "bg-green-500", icon: CheckCircle },
      cancelado: { label: "Cancelado", color: "bg-red-500", icon: XCircle }
    };
    return statusMap[status as keyof typeof statusMap] || statusMap.moldagem;
  };

  // Calculate stats
  const stats = {
    total: prostheses.length,
    inProgress: prostheses.filter((p: any) => ["moldagem", "laboratorio", "prova"].includes(p.status)).length,
    delivered: prostheses.filter((p: any) => p.status === "entregue").length,
    overdue: prostheses.filter((p: any) => 
      p.dueDate && new Date(p.dueDate) < new Date() && p.status !== "entregue"
    ).length
  };

  return (
    <DashboardLayout title="Controle de Próteses" currentPath="/prosthesis">
      <div className="space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Scissors className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Próteses totais</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.inProgress}</div>
              <p className="text-xs text-muted-foreground">Em produção</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Entregues</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.delivered}</div>
              <p className="text-xs text-muted-foreground">Concluídas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Atrasadas</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
              <p className="text-xs text-muted-foreground">Vencidas</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar próteses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="moldagem">Moldagem</SelectItem>
                <SelectItem value="laboratorio">Laboratório</SelectItem>
                <SelectItem value="prova">Prova</SelectItem>
                <SelectItem value="entregue">Entregue</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Dialog open={isAddProsthesisOpen} onOpenChange={setIsAddProsthesisOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Prótese
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Adicionar Nova Prótese</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="patientId">Paciente</Label>
                    <Select name="patientId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar paciente" />
                      </SelectTrigger>
                      <SelectContent>
                        {patients.map((patient: any) => (
                          <SelectItem key={patient.id} value={patient.id.toString()}>
                            {patient.name || patient.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="type">Tipo de Prótese</Label>
                    <Select name="type" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Tipo de prótese" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="total">Prótese Total</SelectItem>
                        <SelectItem value="parcial">Prótese Parcial</SelectItem>
                        <SelectItem value="coroa">Coroa</SelectItem>
                        <SelectItem value="ponte">Ponte</SelectItem>
                        <SelectItem value="implante">Prótese sobre Implante</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Descrição detalhada da prótese"
                    rows={3}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="laboratory">Laboratório</Label>
                    <Input
                      id="laboratory"
                      name="laboratory"
                      placeholder="Nome do laboratório"
                    />
                  </div>

                  <div>
                    <Label htmlFor="dueDate">Data de Entrega</Label>
                    <Input
                      id="dueDate"
                      name="dueDate"
                      type="date"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cost">Custo (R$)</Label>
                    <Input
                      id="cost"
                      name="cost"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                    />
                  </div>

                  <div>
                    <Label htmlFor="price">Preço (R$)</Label>
                    <Input
                      id="price"
                      name="price"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    placeholder="Observações adicionais"
                    rows={2}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddProsthesisOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createProsthesisMutation.isPending}>
                    {createProsthesisMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Prostheses Table */}
        <Card>
          <CardHeader>
            <CardTitle>Próteses</CardTitle>
            <CardDescription>Controle de próteses e trabalhos protéticos</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingProstheses ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-sm text-gray-500">Carregando próteses...</div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Laboratório</TableHead>
                    <TableHead>Entrega</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProstheses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                        Nenhuma prótese encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProstheses.map((prosthesis: any) => {
                      const statusInfo = getStatusInfo(prosthesis.status);
                      const IconComponent = statusInfo.icon;
                      const isOverdue = prosthesis.dueDate && 
                        new Date(prosthesis.dueDate) < new Date() && 
                        prosthesis.status !== "entregue";

                      return (
                        <TableRow key={prosthesis.id}>
                          <TableCell>
                            <div className="flex items-center">
                              <User className="h-4 w-4 mr-2 text-gray-400" />
                              {prosthesis.patient?.name || prosthesis.patient?.full_name || "Paciente não encontrado"}
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">{prosthesis.type}</TableCell>
                          <TableCell>
                            <div className="max-w-xs truncate">{prosthesis.description}</div>
                          </TableCell>
                          <TableCell>{prosthesis.laboratory || "-"}</TableCell>
                          <TableCell>
                            <div className={`flex items-center ${isOverdue ? 'text-red-600' : ''}`}>
                              <Calendar className="h-4 w-4 mr-1" />
                              {prosthesis.dueDate ? 
                                format(new Date(prosthesis.dueDate), "dd/MM/yyyy", { locale: ptBR }) : 
                                "-"
                              }
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`${statusInfo.color} text-white`}>
                              <IconComponent className="h-3 w-3 mr-1" />
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            R$ {prosthesis.price?.toFixed(2) || "0,00"}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={prosthesis.status}
                              onValueChange={(newStatus) =>
                                updateStatusMutation.mutate({
                                  id: prosthesis.id,
                                  status: newStatus
                                })
                              }
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="moldagem">Moldagem</SelectItem>
                                <SelectItem value="laboratorio">Laboratório</SelectItem>
                                <SelectItem value="prova">Prova</SelectItem>
                                <SelectItem value="entregue">Entregue</SelectItem>
                                <SelectItem value="cancelado">Cancelado</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}