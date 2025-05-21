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
import { Plus, Filter, Edit, Trash2, MoreHorizontal, Calendar as CalendarIcon, ExternalLink, AlertCircle, ChevronRight, Package, ArrowUpDown, Check, ArrowLeftRight, Settings, X } from "lucide-react";
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

// Rótulos padrão
const defaultLabels = [
  { id: "urgente", name: "Urgente", color: "red" },
  { id: "prioridade", name: "Prioridade", color: "orange" },
  { id: "premium", name: "Premium", color: "purple" },
  { id: "retrabalho", name: "Retrabalho", color: "yellow" },
  { id: "provisorio", name: "Provisório", color: "blue" },
  { id: "definitivo", name: "Definitivo", color: "green" }
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
  const [editingProsthesis, setEditingProsthesis] = useState<Prosthesis | null>(null);
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
      toast({
        title: "Sucesso",
        description: "Status atualizado com sucesso!",
      });
    },
    onError: (error: Error) => {
      console.error("Erro detalhado ao atualizar status:", error);
      toast({
        title: "Erro",
        description: `Falha ao atualizar status: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Handler para salvar prótese
  const handleSaveProsthesis = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    // Preparar datas
    let sentDateFormatted = sentDate ? format(sentDate, "yyyy-MM-dd") : null;
    let expectedReturnDateFormatted = expectedReturnDate ? format(expectedReturnDate, "yyyy-MM-dd") : null;
    
    try {
      // Validar dados básicos
      if (!formData.get("patient") || !formData.get("professional") || !formData.get("type") || !formData.get("description")) {
        throw new Error("Por favor, preencha todos os campos obrigatórios.");
      }
      
      // Preparar dados da prótese
      const prosthesisData: Partial<Prosthesis> = {
        patientId: parseInt(formData.get("patient") as string),
        patientName: mockPatients.find(p => p.id === parseInt(formData.get("patient") as string))?.fullName || "",
        professionalId: parseInt(formData.get("professional") as string),
        professionalName: mockProfessionals.find(p => p.id === parseInt(formData.get("professional") as string))?.fullName || "",
        type: formData.get("type") as string,
        description: formData.get("description") as string,
        laboratory: formData.get("laboratory") as string,
        sentDate: sentDateFormatted,
        expectedReturnDate: expectedReturnDateFormatted,
        observations: formData.get("observations") as string || null,
        status: (sentDateFormatted ? 'sent' : 'pending') as 'pending' | 'sent' | 'returned' | 'completed' | 'canceled',
      };
      
      // Se estiver editando, manter dados existentes que não foram alterados
      if (editingProsthesis) {
        prosthesisData.id = editingProsthesis.id;
        // Preservar returnDate e status se existirem
        if (editingProsthesis.returnDate) {
          prosthesisData.returnDate = editingProsthesis.returnDate;
        }
        
        // Manter status atual se não houver mudança nas datas
        if (editingProsthesis.status) {
          if (editingProsthesis.status === 'completed' || editingProsthesis.status === 'returned') {
            prosthesisData.status = editingProsthesis.status;
          }
        }
      }
      
      // Enviar dados para o servidor
      prosthesisMutation.mutate(prosthesisData);
    } catch (error) {
      // Tratar erros de validação
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao salvar a prótese.",
        variant: "destructive",
      });
    }
  };
  
  // Handler para drag and drop com melhor desempenho
  const onDragEnd = (result: any) => {
    const { source, destination, draggableId } = result;
    
    // Se não há destino ou se o destino é o mesmo que a origem na mesma posição
    if (!destination || 
        (source.droppableId === destination.droppableId && 
         source.index === destination.index)) {
      return;
    }
    
    // Encontrar o item arrastado
    const prosthesisId = parseInt(draggableId.replace('prosthesis-', ''));
    const allItems = Object.values(columns).flatMap(column => column.items);
    const draggedItem = allItems.find(item => item.id === prosthesisId);
    
    if (!draggedItem) return;
    
    // Criar uma cópia das colunas atuais
    const newColumns = { ...columns };
    
    // Remover da coluna de origem
    newColumns[source.droppableId as keyof typeof newColumns].items = 
      newColumns[source.droppableId as keyof typeof newColumns].items.filter(
        item => item.id !== prosthesisId
      );
    
    // Adicionar na coluna de destino com o status atualizado
    // e outros campos dependendo do status
    const updatedItem = { 
      ...draggedItem,
      status: destination.droppableId as 'pending' | 'sent' | 'returned' | 'completed' | 'canceled'
    };
    
    // Lógica específica por transição de status
    if (destination.droppableId === 'sent' && source.droppableId === 'pending') {
      // Quando enviamos ao laboratório
      updatedItem.sentDate = format(new Date(), "yyyy-MM-dd");
      
      // Atualizar no backend (mockado aqui)
      updateStatusMutation.mutate({ 
        id: prosthesisId, 
        status: 'sent',
        returnDate: undefined
      });
      
      toast({
        title: "Prótese enviada",
        description: `Prótese de ${updatedItem.patientName} enviada para o laboratório ${updatedItem.laboratory}`,
      });
    } 
    else if (destination.droppableId === 'returned' && source.droppableId === 'sent') {
      // Quando retorna do laboratório
      updatedItem.returnDate = format(new Date(), "yyyy-MM-dd");
      
      // Verificar se está atrasado
      if (updatedItem.expectedReturnDate && isAfter(new Date(), parseISO(updatedItem.expectedReturnDate))) {
        const daysLate = differenceInDays(new Date(), parseISO(updatedItem.expectedReturnDate));
        
        toast({
          title: "Prótese retornada com atraso",
          description: `A prótese retornou com ${daysLate} dias de atraso`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Prótese retornada",
          description: `Prótese de ${updatedItem.patientName} retornou do laboratório`,
        });
      }
      
      // Atualizar no backend (mockado aqui)
      updateStatusMutation.mutate({ 
        id: prosthesisId, 
        status: 'returned',
        returnDate: format(new Date(), "yyyy-MM-dd")
      });
    }
    else if (destination.droppableId === 'completed') {
      // Quando concluímos o caso
      toast({
        title: "Prótese concluída",
        description: `Tratamento de ${updatedItem.patientName} concluído com sucesso`,
      });
      
      // Atualizar no backend (mockado aqui)
      updateStatusMutation.mutate({ 
        id: prosthesisId, 
        status: 'completed'
      });
    }
    
    // Adicionar o item atualizado à coluna de destino
    newColumns[destination.droppableId as keyof typeof newColumns].items.splice(
      destination.index,
      0,
      updatedItem
    );
    
    // Atualizar o estado imediatamente para evitar lag na interface
    window.requestAnimationFrame(() => {
      setColumns(newColumns);
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
      return isAfter(new Date(), parseISO(item.expectedReturnDate));
    }
    return false;
  };
  
  // Função para calcular dias atrasados
  const calculateDaysLate = (item: Prosthesis) => {
    if (item.expectedReturnDate && !item.returnDate) {
      const today = new Date();
      const expected = parseISO(item.expectedReturnDate);
      if (isAfter(today, expected)) {
        return differenceInDays(today, expected);
      }
    }
    return 0;
  };
  
  // Função para calcular dias até o retorno esperado
  const calculateDaysUntil = (item: Prosthesis) => {
    if (item.expectedReturnDate && !item.returnDate) {
      const today = new Date();
      const expected = parseISO(item.expectedReturnDate);
      if (isBefore(today, expected)) {
        return differenceInDays(expected, today);
      }
    }
    return 0;
  };
  
  // Resetar dados do formulário ao abrir modal de novo item
  const handleOpenNewProsthesisModal = () => {
    setEditingProsthesis(null);
    setSentDate(undefined);
    setExpectedReturnDate(undefined);
    setIsModalOpen(true);
  };
  
  // Configurar dados ao editar item existente
  const handleEditProsthesis = (prosthesis: Prosthesis) => {
    setEditingProsthesis(prosthesis);
    
    // Converter strings para objetos Date
    if (prosthesis.sentDate && isValid(parseISO(prosthesis.sentDate))) {
      setSentDate(parseISO(prosthesis.sentDate));
    } else {
      setSentDate(undefined);
    }
    
    if (prosthesis.expectedReturnDate && isValid(parseISO(prosthesis.expectedReturnDate))) {
      setExpectedReturnDate(parseISO(prosthesis.expectedReturnDate));
    } else {
      setExpectedReturnDate(undefined);
    }
    
    setIsModalOpen(true);
  };
  
  // Calcula o total de cada coluna com filtros aplicados
  const totals = {
    sent: columns.sent.items.length,
    returned: columns.returned.items.length,
    pending: columns.pending.items.length,
    completed: columns.completed.items.length
  };
  
  // Calcula o total de itens atrasados
  const delayedSent = columns.sent.items.filter(item => isDelayed(item)).length;
  const delayedReturned = columns.returned.items.filter(item => 
    item.expectedReturnDate && isAfter(new Date(), parseISO(item.expectedReturnDate))
  ).length;
  
  // Verifica se há itens atrasados
  const hasDelayedItems = columns.sent.items.some(isDelayed);
  
  return (
    <DashboardLayout title="Controle de Próteses" currentPath="/prosthesis">
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Controle de Próteses</h1>
          
          <div className="flex gap-2">
            <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros
                  {(filters.delayedServices || filters.returnedServices || filters.professional !== "all" || filters.laboratory !== "all") && (
                    <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center rounded-full">
                      <Check className="h-3 w-3" />
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">Filtros</h4>
                    <p className="text-sm text-muted-foreground">
                      Personalize a visualização das próteses
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="delayedServices" 
                        checked={filters.delayedServices}
                        onCheckedChange={(checked) => 
                          handleFilterChange('delayedServices', !!checked)
                        }
                      />
                      <label
                        htmlFor="delayedServices"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Serviços atrasados
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="returnedServices" 
                        checked={filters.returnedServices}
                        onCheckedChange={(checked) => 
                          handleFilterChange('returnedServices', !!checked)
                        }
                      />
                      <label
                        htmlFor="returnedServices"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Serviços com retorno
                      </label>
                    </div>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="professionalFilter">Profissional</Label>
                    <Select 
                      value={filters.professional} 
                      onValueChange={(value) => handleFilterChange('professional', value)}
                    >
                      <SelectTrigger id="professionalFilter">
                        <SelectValue placeholder="Todos os profissionais" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os profissionais</SelectItem>
                        {mockProfessionals.map(prof => (
                          <SelectItem key={prof.id} value={prof.id.toString()}>
                            {prof.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="laboratoryFilter">Laboratório</Label>
                    <Select 
                      value={filters.laboratory} 
                      onValueChange={(value) => handleFilterChange('laboratory', value)}
                    >
                      <SelectTrigger id="laboratoryFilter">
                        <SelectValue placeholder="Todos os laboratórios" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os laboratórios</SelectItem>
                        {mockLaboratories.map(lab => (
                          <SelectItem key={lab.id} value={lab.name}>
                            {lab.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button 
                    onClick={() => {
                      setFilters({
                        delayedServices: false,
                        returnedServices: false,
                        custom: false,
                        professional: "all",
                        laboratory: "all",
                        label: "all"
                      });
                      setIsFilterOpen(false);
                    }}
                  >
                    Aplicar Filtros
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            
            <Button onClick={handleOpenNewProsthesisModal}>
              <Plus className="h-4 w-4 mr-2" /> Nova Prótese
            </Button>
          </div>
        </div>
        

        
        {/* Quadro Kanban */}
        {isLoading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Object.values(columns).map(column => (
                <div key={column.id} className={cn(
                  "bg-card rounded-lg border shadow-sm",
                  (column.id === 'sent' && delayedSent > 0) && "border-red-400",
                  (column.id === 'returned' && delayedReturned > 0) && "border-red-400"
                )}>
                  <div className="p-4 font-semibold border-b flex justify-between items-center">
                    <span className={cn(
                      "",
                      (column.id === 'sent' && delayedSent > 0) && "text-red-500",
                      (column.id === 'returned' && delayedReturned > 0) && "text-red-500"
                    )}>
                      {column.title}
                      {((column.id === 'sent' && delayedSent > 0) || 
                       (column.id === 'returned' && delayedReturned > 0)) && 
                       <AlertCircle className="h-4 w-4 inline ml-1" />}
                    </span>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline">{column.items.length}</Badge>
                      {column.id === 'sent' && delayedSent > 0 && (
                        <Badge variant="destructive">{delayedSent}</Badge>
                      )}
                      {column.id === 'returned' && delayedReturned > 0 && (
                        <Badge variant="destructive">{delayedReturned}</Badge>
                      )}
                    </div>
                  </div>
                  <Droppable droppableId={column.id}>
                    {(provided) => (
                      <div 
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="p-2 min-h-[300px]"
                      >
                        {column.items.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                            {column.id === "pending" && <Package className="h-10 w-10 mb-2 opacity-20" />}
                            {column.id === "sent" && <ExternalLink className="h-10 w-10 mb-2 opacity-20" />}
                            {column.id === "returned" && <ArrowLeftRight className="h-10 w-10 mb-2 opacity-20" />}
                            {column.id === "completed" && <Check className="h-10 w-10 mb-2 opacity-20" />}
                            <span>Nenhuma prótese</span>
                          </div>
                        ) : (
                          column.items.map((item, index) => (
                            <Draggable 
                              key={`prosthesis-${item.id}`} 
                              draggableId={`prosthesis-${item.id}`} 
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  onClick={() => handleEditProsthesis(item)}
                                  style={{
                                    ...provided.draggableProps.style
                                  }}
                                  className={cn(
                                    "p-3 mb-2 bg-background rounded-md border shadow-sm cursor-grab transition-all duration-200 hover:bg-muted",
                                    snapshot.isDragging && "shadow-lg border-primary scale-[1.02] border-2",
                                    isDelayed(item) && "border-red-400"
                                  )}
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="cursor-pointer" onClick={(e) => {
                                      e.stopPropagation(); // Evitar propagação do clique
                                      handleEditProsthesis(item);
                                    }}>
                                      <h3 className="font-medium">{item.patientName}</h3>
                                      <p className="text-xs text-muted-foreground">{item.type}</p>
                                    </div>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditProsthesis(item);
                                        }}>
                                          <Edit className="h-4 w-4 mr-2" /> Editar
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-destructive"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toast({
                                              title: "Ação não implementada",
                                              description: "A exclusão de próteses não está disponível no momento.",
                                              variant: "destructive",
                                            });
                                          }}
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                  
                                  {item.description && (
                                    <p className="text-xs mb-2 text-muted-foreground">{item.description}</p>
                                  )}
                                  
                                  <div className="grid grid-cols-2 gap-1 text-xs mb-2">
                                    <div>
                                      <span className="text-muted-foreground">Profissional:</span>
                                      <p className="truncate">{item.professionalName}</p>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Laboratório:</span>
                                      <p className="truncate">{item.laboratory}</p>
                                    </div>
                                  </div>
                                  
                                  {column.id === 'sent' && (
                                    <div className="mt-2">
                                      {isDelayed(item) ? (
                                        <Badge variant="destructive" className="w-full justify-between">
                                          <span>Atrasado</span>
                                          <span>{calculateDaysLate(item)} dias</span>
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="w-full justify-between">
                                          <span>Retorno em</span>
                                          <span>{calculateDaysUntil(item)} dias</span>
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                  
                                  {column.id === 'returned' && item.returnDate && (
                                    <div className="mt-2">
                                      <Badge variant="secondary" className="w-full justify-between">
                                        <span>Retornado em</span>
                                        <span>{format(parseISO(item.returnDate), "dd/MM/yyyy")}</span>
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          ))
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </DragDropContext>
        )}
                
        {/* Modal para adicionar/editar prótese */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingProsthesis ? "Editar Prótese" : "Nova Prótese"}
              </DialogTitle>
              <DialogDescription>
                {editingProsthesis 
                  ? "Edite os detalhes da prótese e clique em salvar."
                  : "Preencha os detalhes da nova prótese e clique em salvar."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveProsthesis}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="patient">Paciente</Label>
                    <Select 
                      defaultValue={editingProsthesis?.patientId.toString() || undefined}
                      name="patient"
                      required
                    >
                      <SelectTrigger id="patient">
                        <SelectValue placeholder="Selecione o paciente" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockPatients.map(patient => (
                          <SelectItem key={patient.id} value={patient.id.toString()}>
                            {patient.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="professional">Profissional</Label>
                    <Select 
                      defaultValue={editingProsthesis?.professionalId.toString() || undefined}
                      name="professional"
                      required
                    >
                      <SelectTrigger id="professional">
                        <SelectValue placeholder="Selecione o profissional" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockProfessionals.map(professional => (
                          <SelectItem key={professional.id} value={professional.id.toString()}>
                            {professional.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="type">Tipo de Prótese</Label>
                    <Select 
                      defaultValue={editingProsthesis?.type || undefined}
                      name="type"
                      required
                    >
                      <SelectTrigger id="type">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {prosthesisTypes.map(type => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="laboratory">Laboratório</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="relative">
                        <div className="flex items-center">
                          <Input
                            id="laboratory"
                            name="laboratory"
                            defaultValue={editingProsthesis?.laboratory || ""}
                            placeholder="Digite para selecionar ou cadastrar laboratório"
                            list="laboratorios-list"
                            required
                            className="w-full"
                          />
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            className="ml-2 px-2"
                            onClick={() => {
                              // Abrir dropdown para gerenciar laboratórios
                              setShowLaboratoryManager(true);
                            }}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Gerenciar
                          </Button>
                        </div>
                        <datalist id="laboratorios-list">
                          {mockLaboratories.map(lab => (
                            <option key={lab.id} value={lab.name} />
                          ))}
                        </datalist>
                      </div>
                      <Input 
                        placeholder="WhatsApp laboratório"
                        name="laboratoryContact"
                        defaultValue=""
                      />
                    </div>
                    
                    {/* Modal para gerenciar laboratórios */}
                    <Dialog open={showLaboratoryManager} onOpenChange={setShowLaboratoryManager}>
                      <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                          <DialogTitle>Gerenciar Laboratórios</DialogTitle>
                          <DialogDescription>
                            Adicione, edite ou remova laboratórios do sistema.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="my-4 max-h-[300px] overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead className="w-[100px]">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {mockLaboratories.map(lab => (
                                <TableRow key={lab.id}>
                                  <TableCell className="font-medium">{lab.name}</TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        // Simular remoção do laboratório
                                        toast({
                                          title: "Laboratório removido",
                                          description: `${lab.name} foi removido com sucesso.`
                                        });
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <div className="grid gap-4 py-2">
                          <div className="flex items-center space-x-2">
                            <Input placeholder="Nome do novo laboratório" id="newLaboratory" />
                            <Button
                              onClick={() => {
                                const input = document.getElementById("newLaboratory") as HTMLInputElement;
                                if (input?.value) {
                                  // Simular adição de novo laboratório
                                  toast({
                                    title: "Laboratório adicionado",
                                    description: `${input.value} foi adicionado com sucesso.`
                                  });
                                  input.value = "";
                                }
                              }}
                            >
                              Adicionar
                            </Button>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={() => setShowLaboratoryManager(false)}>Fechar</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="sentDate">Data de Envio</Label>
                    <div className="relative">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            id="sentDate"
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !sentDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {sentDate ? format(sentDate, "dd/MM/yyyy") : "Selecione a data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={sentDate}
                            onSelect={setSentDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="expectedReturnDate">Data de Retorno Prevista</Label>
                    <div className="relative">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            id="expectedReturnDate"
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !expectedReturnDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {expectedReturnDate ? format(expectedReturnDate, "dd/MM/yyyy") : "Selecione a data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={expectedReturnDate}
                            onSelect={setExpectedReturnDate}
                            initialFocus
                            disabled={(date) => sentDate ? isBefore(date, sentDate) : false}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Input
                    id="description"
                    name="description"
                    defaultValue={editingProsthesis?.description || ""}
                    placeholder="Detalhes da prótese"
                    required
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="observations">Observações</Label>
                  <Input
                    id="observations"
                    name="observations"
                    defaultValue={editingProsthesis?.observations || ""}
                    placeholder="Observações adicionais"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={prosthesisMutation.isPending}>
                  {prosthesisMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}