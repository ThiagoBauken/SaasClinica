import { useState, useEffect, useRef } from "react";
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
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  MoreHorizontal, 
  Filter,
  Search,
  Calendar as CalendarIcon,
  Package,
  ExternalLink,
  ArrowLeftRight,
  Check,
  Archive,
  ChevronDown,
  Settings,
  Palette,
  Eye,
  EyeOff,
  Archive as ArchiveIcon,
  ArchiveRestore
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// Interfaces
interface Prosthesis {
  id: number;
  patientId: number;
  professionalId: number;
  type: string;
  description: string;
  laboratory: string;
  status: "pending" | "sent" | "returned" | "completed" | "canceled" | "archived";
  sentDate?: string;
  expectedReturnDate?: string;
  returnDate?: string;
  observations?: string;
  labels?: number[];
  cost?: number;
  price?: number;
  createdAt: string;
  updatedAt: string;
  patient?: {
    id: number;
    name: string;
    cpf: string;
    phone: string;
  };
  professional?: {
    id: number;
    fullName: string;
    speciality: string;
  };
}

interface Column {
  id: string;
  title: string;
  items: Prosthesis[];
}

interface ProsthesisLabel {
  id: string;
  name: string;
  color: string;
}

// Cores disponíveis para etiquetas
const LABEL_COLORS = [
  { name: "Vermelho", value: "#dc2626" },
  { name: "Laranja", value: "#ea580c" },
  { name: "Amarelo", value: "#eab308" },
  { name: "Verde", value: "#16a34a" },
  { name: "Azul", value: "#2563eb" },
  { name: "Roxo", value: "#9333ea" },
  { name: "Rosa", value: "#ec4899" },
  { name: "Cinza", value: "#6b7280" }
];

export default function ProsthesisControlPage() {
  const { toast } = useToast();

  // Query para buscar próteses
  const { data: prosthesis = [], isLoading: isLoadingProsthesis, refetch: refetchProsthesis } = useQuery({
    queryKey: ["/api/prosthesis"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/prosthesis");
      if (!res.ok) throw new Error("Falha ao carregar próteses");
      return res.json();
    }
  });

  // Query para buscar laboratórios reais do banco de dados
  const { data: laboratories = [], isLoading: isLoadingLabs, refetch: refetchLabs } = useQuery({
    queryKey: ["/api/laboratories"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/laboratories");
      if (!res.ok) throw new Error("Falha ao carregar laboratórios");
      return res.json();
    }
  });

  // Query para buscar pacientes reais do banco de dados
  const { data: patients = [], isLoading: isLoadingPatients } = useQuery({
    queryKey: ["/api/patients"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/patients");
      if (!res.ok) throw new Error("Falha ao carregar pacientes");
      return res.json();
    }
  });

  // Query para buscar profissionais reais do banco de dados
  const { data: professionals = [], isLoading: isLoadingProfessionals } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      if (!res.ok) throw new Error("Falha ao carregar profissionais");
      return res.json();
    }
  });

  // Query para buscar etiquetas do banco de dados
  const { data: prosthesisLabels = [], isLoading: isLoadingLabels, refetch: refetchLabels } = useQuery({
    queryKey: ["/api/prosthesis/labels"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/prosthesis/labels");
      if (!res.ok) throw new Error("Falha ao carregar etiquetas");
      return res.json();
    }
  });

  // Estados
  const [sentDate, setSentDate] = useState<Date | undefined>();
  const [expectedReturnDate, setExpectedReturnDate] = useState<Date | undefined>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProsthesis, setEditingProsthesis] = useState<Prosthesis | null>(null);
  const [selectedLabels, setSelectedLabels] = useState<number[]>([]);
  const [showArchivedColumn, setShowArchivedColumn] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [selectedLaboratory, setSelectedLaboratory] = useState<string>("");
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const [laboratorySearchOpen, setLaboratorySearchOpen] = useState(false);

  // Estados para laboratórios
  const [newLabName, setNewLabName] = useState("");
  const [newLabWhatsapp, setNewLabWhatsapp] = useState("");
  const [editingLab, setEditingLab] = useState<any>(null);
  const [editLabName, setEditLabName] = useState("");
  const [editLabPhone, setEditLabPhone] = useState("");

  // Estados para gerenciamento de etiquetas
  const [isManagingLabels, setIsManagingLabels] = useState(false);
  const [editingLabel, setEditingLabel] = useState<any>(null);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#2563eb");
  const [newLabelDescription, setNewLabelDescription] = useState("");

  // Estados de filtros
  const [filters, setFilters] = useState({
    delayedServices: false,
    returnedServices: false,
    custom: false,
    professional: "all",
    laboratory: "all",
    label: "all"
  });

  // Estados para colunas do kanban
  const [columns, setColumns] = useState<{ [key: string]: Column }>({
    pending: { id: "pending", title: "Pré Laboratório", items: [] },
    sent: { id: "sent", title: "Enviado", items: [] },
    returned: { id: "returned", title: "Retornado", items: [] },
    completed: { id: "completed", title: "Finalizado", items: [] },
    archived: { id: "archived", title: "Arquivados", items: [] }
  });

  // Função para limpar os estados após salvar
  const clearFormStates = () => {
    setSelectedPatient("");
    setSelectedLaboratory("");
    setSelectedLabels([]);
    setSentDate(undefined);
    setExpectedReturnDate(undefined);
    setPatientSearchOpen(false);
    setLaboratorySearchOpen(false);
    setIsModalOpen(false);
    setEditingProsthesis(null);
  };

  // Label management mutations
  const createLabelMutation = useMutation({
    mutationFn: async (labelData: any) => {
      const res = await apiRequest("POST", "/api/prosthesis/labels", labelData);
      if (!res.ok) throw new Error("Falha ao criar etiqueta");
      return res.json();
    },
    onSuccess: () => {
      refetchLabels();
      setNewLabelName("");
      setNewLabelColor("#2563eb");
      setNewLabelDescription("");
      toast({ title: "Etiqueta criada com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar etiqueta", description: error.message, variant: "destructive" });
    }
  });

  const updateLabelMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/prosthesis/labels/${id}`, data);
      if (!res.ok) throw new Error("Falha ao atualizar etiqueta");
      return res.json();
    },
    onSuccess: () => {
      refetchLabels();
      setEditingLabel(null);
      toast({ title: "Etiqueta atualizada com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar etiqueta", description: error.message, variant: "destructive" });
    }
  });

  const deleteLabelMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/prosthesis/labels/${id}`);
      if (!res.ok) throw new Error("Falha ao deletar etiqueta");
    },
    onSuccess: () => {
      refetchLabels();
      toast({ title: "Etiqueta excluída com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir etiqueta", description: error.message, variant: "destructive" });
    }
  });

  // Handlers for label management
  const handleCreateLabel = () => {
    if (!newLabelName.trim()) {
      toast({ title: "Nome da etiqueta é obrigatório", variant: "destructive" });
      return;
    }

    createLabelMutation.mutate({
      name: newLabelName,
      color: newLabelColor,
      description: newLabelDescription
    });
  };

  const handleUpdateLabel = () => {
    if (!editingLabel || !editingLabel.name?.trim()) {
      toast({ title: "Nome da etiqueta é obrigatório", variant: "destructive" });
      return;
    }

    updateLabelMutation.mutate({
      id: editingLabel.id,
      data: {
        name: editingLabel.name,
        color: editingLabel.color,
        description: editingLabel.description
      }
    });
  };

  // Organizar próteses em colunas baseado no status
  useEffect(() => {
    if (prosthesis && prosthesis.length > 0) {
      try {
        const updatedColumns = {
          pending: { id: "pending", title: "Pré Laboratório", items: [] as Prosthesis[] },
          sent: { id: "sent", title: "Enviado", items: [] as Prosthesis[] },
          returned: { id: "returned", title: "Retornado", items: [] as Prosthesis[] },
          completed: { id: "completed", title: "Finalizado", items: [] as Prosthesis[] },
          archived: { id: "archived", title: "Arquivados", items: [] as Prosthesis[] }
        };

        prosthesis.forEach((p: Prosthesis) => {
          if (updatedColumns[p.status as keyof typeof updatedColumns]) {
            updatedColumns[p.status as keyof typeof updatedColumns].items.push(p);
          }
        });

        // Aplicar filtros
        if (filters.professional !== "all") {
          Object.keys(updatedColumns).forEach(key => {
            updatedColumns[key as keyof typeof updatedColumns].items = 
              updatedColumns[key as keyof typeof updatedColumns].items.filter(
                p => p.professionalId === parseInt(filters.professional)
              );
          });
        }

        if (filters.laboratory !== "all") {
          Object.keys(updatedColumns).forEach(key => {
            updatedColumns[key as keyof typeof updatedColumns].items = 
              updatedColumns[key as keyof typeof updatedColumns].items.filter(
                p => p.laboratory === filters.laboratory
              );
          });
        }

        if (filters.label !== "all") {
          Object.keys(updatedColumns).forEach(key => {
            updatedColumns[key as keyof typeof updatedColumns].items = 
              updatedColumns[key as keyof typeof updatedColumns].items.filter(
                p => p.labels && p.labels.includes(parseInt(filters.label))
              );
          });
        }
        
        setColumns(updatedColumns);
      } catch (error) {
        console.error("Erro ao organizar próteses em colunas:", error);
        toast({
          title: "Erro",
          description: "Ocorreu um erro ao processar as próteses.",
          variant: "destructive",
        });
      }
    }
  }, [prosthesis, filters]);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Controle de Próteses</h1>
            <p className="text-muted-foreground">
              Gerencie o fluxo de trabalho das próteses laboratoriais
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsManagingLabels(true)}
            >
              <Palette className="h-4 w-4 mr-2" />
              Gerenciar Etiquetas
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowArchivedColumn(!showArchivedColumn)}
            >
              {showArchivedColumn ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {showArchivedColumn ? "Ocultar" : "Mostrar"} Arquivados
            </Button>
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Prótese
            </Button>
          </div>
        </div>

        {/* Kanban Board */}
        <div className={`grid gap-4 ${showArchivedColumn ? 'grid-cols-5' : 'grid-cols-4'}`}>
          {Object.values(columns).map(column => {
            if (column.id === "archived" && !showArchivedColumn) return null;
            
            return (
              <Card key={column.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      {column.title}
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {column.items.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-2">
                  <div className="space-y-2 min-h-[300px]">
                    {column.items.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                        {column.id === "pending" && <Package className="h-10 w-10 mb-2 opacity-20" />}
                        {column.id === "sent" && <ExternalLink className="h-10 w-10 mb-2 opacity-20" />}
                        {column.id === "returned" && <ArrowLeftRight className="h-10 w-10 mb-2 opacity-20" />}
                        {column.id === "completed" && <Check className="h-10 w-10 mb-2 opacity-20" />}
                        {column.id === "archived" && <Archive className="h-10 w-10 mb-2 opacity-20" />}
                        <span className="select-none">Nenhuma prótese</span>
                      </div>
                    ) : (
                      column.items.map((item) => (
                        <Card key={item.id} className="p-3 cursor-pointer hover:shadow-md transition-shadow">
                          <div className="space-y-2">
                            <div className="flex justify-between items-start">
                              <div className="font-medium text-sm">
                                {item.patient?.name || `Paciente ${item.patientId}`}
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <MoreHorizontal className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => {
                                    setEditingProsthesis(item);
                                    setSelectedPatient(item.patientId.toString());
                                    setSelectedLaboratory(item.laboratory);
                                    setSelectedLabels(item.labels || []);
                                    if (item.sentDate) setSentDate(new Date(item.sentDate));
                                    if (item.expectedReturnDate) setExpectedReturnDate(new Date(item.expectedReturnDate));
                                    setIsModalOpen(true);
                                  }}>
                                    <Edit2 className="h-4 w-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  {item.status !== "archived" ? (
                                    <DropdownMenuItem>
                                      <ArchiveIcon className="h-4 w-4 mr-2" />
                                      Arquivar
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem>
                                      <ArchiveRestore className="h-4 w-4 mr-2" />
                                      Desarquivar
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            
                            <div className="text-xs text-muted-foreground">
                              {item.type} - {item.description}
                            </div>
                            
                            <div className="text-xs">
                              <span className="font-medium">Lab:</span> {item.laboratory}
                            </div>
                            
                            {item.labels && item.labels.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {item.labels.map((labelId) => {
                                  const label = prosthesisLabels.find((l: any) => l.id === labelId);
                                  return label ? (
                                    <span
                                      key={label.id}
                                      className="px-2 py-1 text-xs rounded-full text-white font-medium"
                                      style={{ backgroundColor: label.color }}
                                    >
                                      {label.name}
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            )}
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Label Management Dialog */}
        <Dialog open={isManagingLabels} onOpenChange={setIsManagingLabels}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Gerenciar Etiquetas</DialogTitle>
              <DialogDescription>
                Crie e gerencie etiquetas personalizadas para organizar suas próteses
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Create new label */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-4">Nova Etiqueta</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="label-name">Nome</Label>
                    <Input
                      id="label-name"
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      placeholder="Nome da etiqueta"
                    />
                  </div>
                  <div>
                    <Label htmlFor="label-color">Cor</Label>
                    <Select value={newLabelColor} onValueChange={setNewLabelColor}>
                      <SelectTrigger>
                        <SelectValue>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-4 h-4 rounded-full" 
                              style={{ backgroundColor: newLabelColor }}
                            />
                            {LABEL_COLORS.find(c => c.value === newLabelColor)?.name}
                          </div>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {LABEL_COLORS.map((color) => (
                          <SelectItem key={color.value} value={color.value}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-4 h-4 rounded-full" 
                                style={{ backgroundColor: color.value }}
                              />
                              {color.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="label-description">Descrição</Label>
                    <Input
                      id="label-description"
                      value={newLabelDescription}
                      onChange={(e) => setNewLabelDescription(e.target.value)}
                      placeholder="Descrição (opcional)"
                    />
                  </div>
                </div>
                <Button 
                  onClick={handleCreateLabel} 
                  className="mt-4"
                  disabled={createLabelMutation.isPending}
                >
                  {createLabelMutation.isPending ? "Criando..." : "Criar Etiqueta"}
                </Button>
              </div>

              {/* Existing labels */}
              <div>
                <h3 className="font-medium mb-4">Etiquetas Existentes</h3>
                <div className="space-y-2">
                  {prosthesisLabels.map((label: any) => (
                    <div key={label.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-6 h-6 rounded-full" 
                          style={{ backgroundColor: label.color }}
                        />
                        <div>
                          <div className="font-medium">{label.name}</div>
                          {label.description && (
                            <div className="text-sm text-muted-foreground">{label.description}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingLabel(label)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir etiqueta</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir esta etiqueta? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteLabelMutation.mutate(label.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Label Dialog */}
        <Dialog open={!!editingLabel} onOpenChange={() => setEditingLabel(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Etiqueta</DialogTitle>
            </DialogHeader>
            {editingLabel && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-label-name">Nome</Label>
                  <Input
                    id="edit-label-name"
                    value={editingLabel.name || ""}
                    onChange={(e) => setEditingLabel({...editingLabel, name: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-label-color">Cor</Label>
                  <Select 
                    value={editingLabel.color} 
                    onValueChange={(value) => setEditingLabel({...editingLabel, color: value})}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: editingLabel.color }}
                          />
                          {LABEL_COLORS.find(c => c.value === editingLabel.color)?.name}
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {LABEL_COLORS.map((color) => (
                        <SelectItem key={color.value} value={color.value}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-4 h-4 rounded-full" 
                              style={{ backgroundColor: color.value }}
                            />
                            {color.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-label-description">Descrição</Label>
                  <Input
                    id="edit-label-description"
                    value={editingLabel.description || ""}
                    onChange={(e) => setEditingLabel({...editingLabel, description: e.target.value})}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingLabel(null)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateLabel} disabled={updateLabelMutation.isPending}>
                {updateLabelMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}