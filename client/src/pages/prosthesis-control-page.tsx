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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays, isAfter, isBefore, parseISO, isValid, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Filter, Edit, Trash2, MoreHorizontal, Calendar as CalendarIcon, ExternalLink, AlertCircle, ChevronRight, Package, ArrowUpDown, Check, ArrowLeftRight, Settings, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";

interface Prosthesis {
  id: number;
  patientId: number;
  patientName: string;
  professionalId: number;
  professionalName: string;
  type: string;
  description: string;
  laboratory: string;
  sentDate: string | null;
  expectedReturnDate: string | null;
  returnDate: string | null;
  status: 'pending' | 'sent' | 'returned' | 'completed' | 'canceled';
  observations: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string | null;
}

interface Laboratory {
  id: number;
  name: string;
  contact: string;
  address: string;
}

// Mock data
const mockLaboratories: Laboratory[] = [
  { id: 1, name: "Lab Dental", contact: "contato@labdental.com.br", address: "Rua das Flores, 123" },
  { id: 2, name: "Odonto Tech", contact: "contato@odontotech.com.br", address: "Av. Paulista, 1000" },
  { id: 3, name: "Prótese Premium", contact: "contato@protesepremium.com.br", address: "Rua Augusta, 500" }
];

const mockPatients = [
  { id: 1, fullName: "Maria Silva", email: "maria@exemplo.com", phone: "(11) 98765-4321" },
  { id: 2, fullName: "João Pereira", email: "joao@exemplo.com", phone: "(11) 91234-5678" },
  { id: 3, fullName: "Ana Oliveira", email: "ana@exemplo.com", phone: "(11) 99876-5432" }
];

const mockProfessionals = [
  { id: 1, fullName: "Dr. Ana Silva", speciality: "Dentista", email: "ana@exemplo.com" },
  { id: 2, fullName: "Dr. Carlos Mendes", speciality: "Ortodontista", email: "carlos@exemplo.com" },
  { id: 3, fullName: "Dr. Juliana Costa", speciality: "Endodontista", email: "juliana@exemplo.com" }
];

const prosthesisTypes = [
  "Coroa",
  "Ponte",
  "Protocolo",
  "Prótese Parcial Removível",
  "Prótese Total",
  "Faceta",
  "Laminado",
  "Inlay/Onlay",
  "Implante",
  "Outro"
];

// Interface para os rótulos
interface ProsthesisLabel {
  id: string;
  name: string;
  color: string;
}

// Rótulos padrão
const defaultLabels: ProsthesisLabel[] = [
  { id: "urgente", name: "Urgente", color: "#dc2626" },
  { id: "prioridade", name: "Prioridade", color: "#ea580c" },
  { id: "premium", name: "Premium", color: "#9333ea" },
  { id: "retrabalho", name: "Retrabalho", color: "#eab308" },
  { id: "provisorio", name: "Provisório", color: "#2563eb" },
  { id: "definitivo", name: "Definitivo", color: "#16a34a" }
];

// Mock data for prosthesis
const generateMockProsthesis = (): Prosthesis[] => {
  const now = new Date();
  
  return [
    {
      id: 1,
      patientId: 1,
      patientName: "Maria Silva",
      professionalId: 1,
      professionalName: "Dr. Ana Silva",
      type: "Coroa",
      description: "Coroa de cerâmica no dente 36",
      laboratory: "Lab Dental",
      sentDate: format(addDays(now, -10), "yyyy-MM-dd"),
      expectedReturnDate: format(addDays(now, -3), "yyyy-MM-dd"),
      returnDate: null,
      status: 'sent',
      observations: "Paciente com sensibilidade",
      labels: ["urgente", "premium"],
      createdAt: format(addDays(now, -12), "yyyy-MM-dd"),
      updatedAt: format(addDays(now, -10), "yyyy-MM-dd")
    },
    {
      id: 2,
      patientId: 2,
      patientName: "João Pereira",
      professionalId: 2,
      professionalName: "Dr. Carlos Mendes",
      type: "Ponte",
      description: "Ponte fixa nos dentes 11, 12 e 13",
      laboratory: "Odonto Tech",
      sentDate: format(addDays(now, -5), "yyyy-MM-dd"),
      expectedReturnDate: format(addDays(now, 5), "yyyy-MM-dd"),
      returnDate: null,
      status: 'sent',
      observations: "Usar material resistente",
      labels: ["prioridade"],
      createdAt: format(addDays(now, -7), "yyyy-MM-dd"),
      updatedAt: format(addDays(now, -5), "yyyy-MM-dd")
    },
    {
      id: 3,
      patientId: 3,
      patientName: "Ana Oliveira",
      professionalId: 3,
      professionalName: "Dr. Juliana Costa",
      type: "Prótese Total",
      description: "Prótese total superior",
      laboratory: "Prótese Premium",
      sentDate: null,
      expectedReturnDate: null,
      returnDate: null,
      status: 'pending',
      observations: "Paciente alérgico a metal",
      labels: ["provisorio"],
      createdAt: format(addDays(now, -2), "yyyy-MM-dd"),
      updatedAt: null
    },
    {
      id: 4,
      patientId: 1,
      patientName: "Maria Silva",
      professionalId: 1,
      professionalName: "Dr. Ana Silva",
      type: "Faceta",
      description: "Facetas nos dentes 21 e 22",
      laboratory: "Lab Dental",
      sentDate: format(addDays(now, -20), "yyyy-MM-dd"),
      expectedReturnDate: format(addDays(now, -10), "yyyy-MM-dd"),
      returnDate: format(addDays(now, -8), "yyyy-MM-dd"),
      status: 'returned',
      observations: "Cor A2",
      labels: ["premium", "definitivo"],
      createdAt: format(addDays(now, -22), "yyyy-MM-dd"),
      updatedAt: format(addDays(now, -8), "yyyy-MM-dd")
    },
    {
      id: 5,
      patientId: 2,
      patientName: "João Pereira",
      professionalId: 3,
      professionalName: "Dr. Juliana Costa",
      type: "Inlay",
      description: "Inlay no dente 46",
      laboratory: "Odonto Tech",
      sentDate: format(addDays(now, -15), "yyyy-MM-dd"),
      expectedReturnDate: format(addDays(now, -5), "yyyy-MM-dd"),
      returnDate: format(addDays(now, -2), "yyyy-MM-dd"),
      status: 'completed',
      observations: "Prioridade alta",
      labels: ["retrabalho", "urgente"],
      createdAt: format(addDays(now, -17), "yyyy-MM-dd"),
      updatedAt: format(addDays(now, -1), "yyyy-MM-dd")
    }
  ];
};

interface StatusColumn {
  id: string;
  title: string;
  items: Prosthesis[];
}

export default function ProsthesisControlPage() {
  const { toast } = useToast();
  const [columns, setColumns] = useState<Record<string, StatusColumn>>({
    pending: {
      id: "pending",
      title: "Pré-laboratório",
      items: []
    },
    sent: {
      id: "sent",
      title: "Envio",
      items: []
    },
    returned: {
      id: "returned",
      title: "Laboratório",
      items: []
    },
    completed: {
      id: "completed",
      title: "Realizado",
      items: []
    }
  });
  
  // Estados para modal e filtros
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showLaboratoryManager, setShowLaboratoryManager] = useState(false);
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [editingLaboratory, setEditingLaboratory] = useState<{ id: number, name: string, contact: string } | null>(null);
  const [editingProsthesis, setEditingProsthesis] = useState<Prosthesis | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [prosthesisToDelete, setProsthesisToDelete] = useState<Prosthesis | null>(null);
  const [labels, setLabels] = useState<ProsthesisLabel[]>(defaultLabels);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#16a34a");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    delayedServices: false,
    returnedServices: false,
    custom: false,
    professional: "all",
    laboratory: "all",
    label: "all"
  });
  
  // Estado para controle de prazos
  const [sentDate, setSentDate] = useState<Date | undefined>(undefined);
  const [expectedReturnDate, setExpectedReturnDate] = useState<Date | undefined>(undefined);
  
  // Mock query para dados de próteses
  const { data: prosthesis, isLoading, isError, error } = useQuery<Prosthesis[]>({
    queryKey: ["/api/prosthesis"],
    queryFn: async () => {
      try {
        // Tenta buscar do backend
        const res = await apiRequest("GET", "/api/prosthesis");
        if (!res.ok) {
          console.warn("Usando dados mockados para próteses");
          return generateMockProsthesis();
        }
        return await res.json();
      } catch (error) {
        console.error("Erro ao carregar próteses:", error);
        return generateMockProsthesis();
      }
    },
    retry: 2,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
    staleTime: 30000
  });
  
  // Organizar próteses em colunas quando os dados estiverem disponíveis
  useEffect(() => {
    if (prosthesis) {
      try {
        const updatedColumns = {
          pending: {
            ...columns.pending,
            items: prosthesis.filter(p => p.status === 'pending')
          },
          sent: {
            ...columns.sent,
            items: prosthesis.filter(p => p.status === 'sent')
          },
          returned: {
            ...columns.returned,
            items: prosthesis.filter(p => p.status === 'returned')
          },
          completed: {
            ...columns.completed,
            items: prosthesis.filter(p => p.status === 'completed')
          }
        };
        
        // Aplicar filtros
        if (filters.delayedServices) {
          // Filtrar apenas serviços atrasados (data de retorno esperada já passou)
          const now = new Date();
          updatedColumns.sent.items = updatedColumns.sent.items.filter(p => 
            p.expectedReturnDate && isAfter(now, parseISO(p.expectedReturnDate)) && !p.returnDate
          );
        }
        
        if (filters.returnedServices) {
          // Manter apenas serviços que já retornaram
          updatedColumns.sent.items = [];
          updatedColumns.pending.items = [];
        }
        
        if (filters.professional !== "all") {
          // Filtrar por profissional
          const professionalId = parseInt(filters.professional);
          Object.keys(updatedColumns).forEach(key => {
            updatedColumns[key as keyof typeof updatedColumns].items = 
              updatedColumns[key as keyof typeof updatedColumns].items.filter(
                p => p.professionalId === professionalId
              );
          });
        }
        
        if (filters.laboratory !== "all") {
          // Filtrar por laboratório
          Object.keys(updatedColumns).forEach(key => {
            updatedColumns[key as keyof typeof updatedColumns].items = 
              updatedColumns[key as keyof typeof updatedColumns].items.filter(
                p => p.laboratory === filters.laboratory
              );
          });
        }
        
        if (filters.label !== "all") {
          // Filtrar por etiqueta
          Object.keys(updatedColumns).forEach(key => {
            updatedColumns[key as keyof typeof updatedColumns].items = 
              updatedColumns[key as keyof typeof updatedColumns].items.filter(
                p => p.labels && p.labels.includes(filters.label)
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
  
  // Mutation para salvar prótese
  const prosthesisMutation = useMutation({
    mutationFn: async (prosthesisData: Partial<Prosthesis>) => {
      try {
        if (prosthesisData.id) {
          // Atualização
          const res = await apiRequest("PATCH", `/api/prosthesis/${prosthesisData.id}`, prosthesisData);
          if (!res.ok) {
            throw new Error(`Erro HTTP: ${res.status} ${res.statusText}`);
          }
          return await res.json();
        } else {
          // Criação
          const res = await apiRequest("POST", "/api/prosthesis", prosthesisData);
          if (!res.ok) {
            throw new Error(`Erro HTTP: ${res.status} ${res.statusText}`);
          }
          return await res.json();
        }
      } catch (error) {
        console.error("Erro na mutação:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prosthesis"] });
      setIsModalOpen(false);
      setEditingProsthesis(null);
      toast({
        title: "Sucesso",
        description: "Prótese salva com sucesso!",
      });
    },
    onError: (error: Error) => {
      console.error("Erro ao salvar prótese:", error);
      toast({
        title: "Erro",
        description: `Falha ao salvar prótese: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Mutation para excluir prótese
  const deleteProsthesisMutation = useMutation({
    mutationFn: async (id: number) => {
      try {
        const res = await apiRequest("DELETE", `/api/prosthesis/${id}`);
        if (!res.ok) {
          throw new Error(`Erro HTTP: ${res.status} ${res.statusText}`);
        }
        return await res.json();
      } catch (error) {
        console.error("Erro ao excluir prótese:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prosthesis"] });
      toast({
        title: "Sucesso",
        description: "Prótese excluída com sucesso!",
      });
    },
    onError: (error: Error) => {
      console.error("Erro detalhado ao excluir prótese:", error);
      toast({
        title: "Erro",
        description: `Falha ao excluir prótese: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Mutation para atualizar status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, returnDate }: { id: number; status: string; returnDate?: string }) => {
      try {
        const data: any = { status };
        if (returnDate) {
          data.returnDate = returnDate;
        }
        const res = await apiRequest("PATCH", `/api/prosthesis/${id}`, data);
        if (!res.ok) {
          throw new Error(`Erro HTTP: ${res.status} ${res.statusText}`);
        }
        return await res.json();
      } catch (error) {
        console.error("Erro ao atualizar status:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prosthesis"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao atualizar status:", error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar status da prótese",
        variant: "destructive",
      });
    }
  });

  // Handler para drag and drop
  const onDragEnd = (result: any) => {
    const { source, destination, draggableId } = result;
    
    if (!destination) {
      return;
    }
    
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }
    
    const prosthesisId = parseInt(draggableId.replace('prosthesis-', ''));
    const newStatus = destination.droppableId;
    
    // Atualizar status no backend
    let returnDate: string | undefined;
    if (newStatus === 'returned') {
      returnDate = format(new Date(), 'yyyy-MM-dd');
    }
    
    updateStatusMutation.mutate({
      id: prosthesisId,
      status: newStatus,
      returnDate
    });
  };
  
  // Handlers para os filtros
  const handleFilterChange = (filterKey: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [filterKey]: value
    }));
  };
  
  // Função auxiliar para verificar status atrasado
  const isDelayed = (item: Prosthesis) => {
    if (item.expectedReturnDate && !item.returnDate) {
      const expectedDate = parseISO(item.expectedReturnDate);
      const now = new Date();
      return isAfter(now, expectedDate);
    }
    return false;
  };
  
  // Função para calcular dias de atraso
  const calculateDaysLate = (item: Prosthesis) => {
    if (item.expectedReturnDate && !item.returnDate) {
      const expectedDate = parseISO(item.expectedReturnDate);
      const now = new Date();
      if (isAfter(now, expectedDate)) {
        return differenceInDays(now, expectedDate);
      }
    }
    return 0;
  };
  
  // Função para calcular dias até o vencimento
  const calculateDaysUntil = (item: Prosthesis) => {
    if (item.expectedReturnDate && !item.returnDate) {
      const expectedDate = parseISO(item.expectedReturnDate);
      const now = new Date();
      if (isBefore(now, expectedDate)) {
        return differenceInDays(expectedDate, now);
      }
    }
    return 0;
  };
  
  const handleEditProsthesis = (prosthesis: Prosthesis) => {
    setEditingProsthesis(prosthesis);
    
    // Configurar datas se disponíveis
    if (prosthesis.sentDate) {
      const sentDateParsed = parseISO(prosthesis.sentDate);
      if (isValid(sentDateParsed)) {
        setSentDate(sentDateParsed);
      }
    }
    
    if (prosthesis.expectedReturnDate) {
      const expectedDateParsed = parseISO(prosthesis.expectedReturnDate);
      if (isValid(expectedDateParsed)) {
        setExpectedReturnDate(expectedDateParsed);
      }
    }
    
    // Configurar labels selecionadas
    setSelectedLabels(prosthesis.labels || []);
    
    setIsModalOpen(true);
  };
  
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center p-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </DashboardLayout>
    );
  }
  
  if (isError) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="text-center text-red-500">
            Erro ao carregar próteses: {error?.message}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Controle de Próteses</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFilterOpen(true)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Prótese
            </Button>
          </div>
        </div>

        {/* Kanban Board */}
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.values(columns).map((column) => (
              <div key={column.id} className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">
                      {column.title}
                      <Badge variant="secondary" className="ml-2">
                        {column.items.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Droppable droppableId={column.id}>
                      {(provided) => (
                        <div
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className="space-y-2 min-h-[200px]"
                        >
                          {column.items.map((item, index) => (
                            <Draggable
                              key={item.id}
                              draggableId={`prosthesis-${item.id}`}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={cn(
                                    "p-3 bg-white border rounded-lg shadow-sm cursor-move",
                                    snapshot.isDragging && "shadow-lg rotate-2",
                                    isDelayed(item) && "border-red-500 bg-red-50"
                                  )}
                                >
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-start">
                                      <h4 className="font-medium text-sm">{item.type}</h4>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                            <MoreHorizontal className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem onClick={() => handleEditProsthesis(item)}>
                                            <Edit className="h-4 w-4 mr-2" />
                                            Editar
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => {
                                              setProsthesisToDelete(item);
                                              setIsDeleteModalOpen(true);
                                            }}
                                            className="text-red-600"
                                          >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Excluir
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                    <p className="text-xs text-gray-600 line-clamp-2">
                                      {item.description}
                                    </p>
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs font-medium text-blue-600">
                                        {item.patientName}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {item.laboratory}
                                      </span>
                                    </div>
                                    
                                    {/* Labels */}
                                    {item.labels && item.labels.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {item.labels.slice(0, 2).map((labelId) => {
                                          const label = labels.find(l => l.id === labelId);
                                          return label ? (
                                            <Badge
                                              key={labelId}
                                              variant="secondary"
                                              className="text-xs"
                                              style={{ backgroundColor: label.color + '20', color: label.color }}
                                            >
                                              {label.name}
                                            </Badge>
                                          ) : null;
                                        })}
                                        {item.labels.length > 2 && (
                                          <Badge variant="secondary" className="text-xs">
                                            +{item.labels.length - 2}
                                          </Badge>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* Status indicator */}
                                    {item.expectedReturnDate && !item.returnDate && (
                                      <div className="flex items-center gap-1">
                                        {isDelayed(item) ? (
                                          <>
                                            <AlertCircle className="h-3 w-3 text-red-500" />
                                            <span className="text-xs text-red-600">
                                              {calculateDaysLate(item)} dias atrasado
                                            </span>
                                          </>
                                        ) : (
                                          <>
                                            <CalendarIcon className="h-3 w-3 text-orange-500" />
                                            <span className="text-xs text-orange-600">
                                              {calculateDaysUntil(item)} dias restantes
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>
    </DashboardLayout>
  );
}