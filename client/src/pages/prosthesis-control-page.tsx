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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { format, addDays, isAfter, isBefore, parseISO, isValid, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Filter, Edit, Trash2, MoreHorizontal, Calendar as CalendarIcon, ExternalLink, AlertCircle, ChevronRight, Package, ArrowUpDown, Check, ArrowLeftRight, Settings, X, Loader2, RotateCcw, Archive, ArchiveRestore } from "lucide-react";
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
  status: 'pending' | 'sent' | 'returned' | 'completed' | 'canceled' | 'archived';
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

// Dados de pacientes e profissionais agora vêm do banco de dados via queries

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
  
  // Query para buscar laboratórios do banco
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

  // Estados para laboratórios
  const [newLabName, setNewLabName] = useState("");
  const [newLabWhatsapp, setNewLabWhatsapp] = useState("");
  const [editingLab, setEditingLab] = useState<any>(null);
  const [editLabName, setEditLabName] = useState("");
  const [editLabPhone, setEditLabPhone] = useState("");

  // Mutations para laboratórios
  const createLabMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; phone?: string }) => {
      const res = await apiRequest("POST", "/api/laboratories", data);
      if (!res.ok) throw new Error("Falha ao criar laboratório");
      return res.json();
    },
    onSuccess: () => {
      refetchLabs();
      setNewLabName("");
      setNewLabWhatsapp("");
      toast({ title: "Laboratório criado com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar laboratório", description: error.message, variant: "destructive" });
    }
  });

  const updateLabMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/laboratories/${id}`, data);
      if (!res.ok) throw new Error("Falha ao atualizar laboratório");
      return res.json();
    },
    onSuccess: () => {
      refetchLabs();
      setEditingLab(null);
      setEditingLaboratory(null);
      setEditLabName("");
      setEditLabPhone("");
      toast({ title: "Laboratório atualizado com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar laboratório", description: error.message, variant: "destructive" });
    }
  });

  const deleteLabMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/laboratories/${id}`);
      if (!res.ok) throw new Error("Falha ao deletar laboratório");
      // 204 No Content responses don't have a body, so don't try to parse JSON
      if (res.status === 204) {
        return { success: true };
      }
      return res.json();
    },
    onSuccess: () => {
      refetchLabs();
      toast({ title: "Laboratório removido com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao remover laboratório", description: error.message, variant: "destructive" });
    }
  });
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
    },
    archived: {
      id: "archived",
      title: "Arquivado",
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
  const [showArchivedColumn, setShowArchivedColumn] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [selectedLaboratory, setSelectedLaboratory] = useState<string>("");
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const [laboratorySearchOpen, setLaboratorySearchOpen] = useState(false);

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

  // Função para restaurar etiquetas padrão
  const restoreDefaultLabels = () => {
    setLabels(defaultLabels);
    toast({
      title: "Etiquetas restauradas",
      description: "As etiquetas padrão foram restauradas com sucesso."
    });
  };
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
  
  // Query otimizada para dados de próteses
  const { data: prosthesis, isLoading, isError, error } = useQuery<Prosthesis[]>({
    queryKey: ["/api/prosthesis"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/prosthesis");
      if (!res.ok) {
        throw new Error(`Falha ao carregar: ${res.status}`);
      }
      const data = await res.json();
      
      // Validar estrutura dos dados
      if (!Array.isArray(data)) {
        throw new Error("Dados inválidos do servidor");
      }
      
      return data;
    },
    retry: 1,
    retryDelay: 2000,
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
          },
          archived: {
            ...columns.archived,
            items: prosthesis.filter(p => p.status === 'archived')
          }
        };
        
        // Manter coluna arquivado oculta por padrão (alternativa antes de excluir)

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
      const method = prosthesisData.id ? "PATCH" : "POST";
      const url = prosthesisData.id ? `/api/prosthesis/${prosthesisData.id}` : "/api/prosthesis";
      
      console.log('Enviando requisição:', { method, url, data: prosthesisData });
      
      try {
        const res = await apiRequest(method, url, prosthesisData);
        
        console.log('Resposta da requisição:', { status: res.status, ok: res.ok });
        
        // apiRequest já verifica se res.ok, então aqui só precisamos fazer o parse do JSON
        const result = await res.json();
        console.log('Dados retornados:', result);
        return result;
      } catch (error) {
        console.error('Erro completo na requisição:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('Sucesso na mutation:', data);
      queryClient.invalidateQueries({ queryKey: ["/api/prosthesis"] });
      setIsModalOpen(false);
      setEditingProsthesis(null);
      setSelectedLabels([]);
      setSentDate(undefined);
      setExpectedReturnDate(undefined);
      toast({
        title: "Prótese salva",
        description: "Dados salvos com sucesso!",
      });
    },
    onError: (error: Error) => {
      console.error('Erro na mutation:', error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Erro desconhecido ao salvar prótese",
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
        // 204 No Content responses don't have a body, so don't try to parse JSON
        if (res.status === 204) {
          return { success: true };
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
  
  // Estado para controle de debouncing
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Mutation simplificada para atualizar status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, returnDate, sentDate }: { 
      id: number; 
      status: string; 
      returnDate?: string;
      sentDate?: string;
    }) => {
      const updateData: any = { status };
      
      if (status === 'sent' && sentDate) {
        updateData.sentDate = sentDate;
      }
      if (status === 'returned' && returnDate) {
        updateData.returnDate = returnDate;
      }
      
      const response = await apiRequest('PATCH', `/api/prosthesis/${id}`, updateData);
      
      if (!response.ok) {
        throw new Error(`Erro ao atualizar: ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Recarregar dados após sucesso
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

  // Mutation para arquivar prótese
  const archiveProsthesisMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('PATCH', `/api/prosthesis/${id}`, { status: 'archived' });
      if (!response.ok) {
        throw new Error(`Erro ao arquivar: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prosthesis"] });
      toast({
        title: "Prótese arquivada",
        description: "A prótese foi arquivada com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: "Falha ao arquivar prótese",
        variant: "destructive",
      });
    }
  });

  // Mutation para desarquivar prótese
  const unarchiveProsthesisMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('PATCH', `/api/prosthesis/${id}`, { status: 'completed' });
      if (!response.ok) {
        throw new Error(`Erro ao desarquivar: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prosthesis"] });
      toast({
        title: "Prótese desarquivada",
        description: "A prótese foi retornada para concluído",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: "Falha ao desarquivar prótese",
        variant: "destructive",
      });
    }
  });

  // Mutation para criar laboratório automaticamente
  const createLaboratoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest('POST', '/api/laboratories', {
        name: name,
        phone: '',
        email: ''
      });
      if (!response.ok) {
        throw new Error(`Erro ao criar laboratório: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/laboratories"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao criar laboratório:", error);
    }
  });
  
  // Handler para salvar prótese
  const handleSaveProsthesis = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    // Preparar datas
    let sentDateFormatted = sentDate ? format(sentDate, "yyyy-MM-dd") : null;
    let expectedReturnDateFormatted = expectedReturnDate ? format(expectedReturnDate, "yyyy-MM-dd") : null;
    
    try {
      console.log('Form data raw:', Object.fromEntries(formData.entries()));
      console.log('Selected labels:', selectedLabels);
      console.log('Sent date:', sentDateFormatted);
      console.log('Expected return date:', expectedReturnDateFormatted);
      console.log('Editing prosthesis:', editingProsthesis);
      console.log('Original status:', editingProsthesis?.status);
      
      // Validar dados básicos
      if (!selectedPatient && !formData.get("patient") || !formData.get("professional") || !formData.get("type") || !formData.get("description")) {
        throw new Error("Por favor, preencha todos os campos obrigatórios.");
      }
      
      const laboratoryName = selectedLaboratory || formData.get("laboratory") as string;
      
      // Verificar se o laboratório existe, se não, criar automaticamente
      if (laboratoryName && laboratories) {
        const existingLab = laboratories.find((lab: any) => lab.name.toLowerCase() === laboratoryName.toLowerCase());
        if (!existingLab) {
          console.log("Creating new laboratory:", laboratoryName);
          try {
            await createLaboratoryMutation.mutateAsync(laboratoryName);
          } catch (error) {
            console.error("Error creating laboratory:", error);
          }
        }
      }
      
      // Preparar dados da prótese
      const prosthesisData: any = {
        patientId: parseInt(selectedPatient || formData.get("patient") as string),
        professionalId: parseInt(formData.get("professional") as string),
        type: formData.get("type") as string,
        description: formData.get("description") as string,
        laboratory: laboratoryName,
        sentDate: sentDateFormatted,
        expectedReturnDate: expectedReturnDateFormatted,
        observations: formData.get("observations") as string || null,
        // Se estiver editando, manter status atual; se criando nova, sempre 'pending'
        status: editingProsthesis ? editingProsthesis.status : 'pending',
        labels: selectedLabels || [],
      };
      
      console.log('Prosthesis data to send:', prosthesisData);
      
      // Se estiver editando, manter dados existentes que não foram alterados
      if (editingProsthesis) {
        prosthesisData.id = editingProsthesis.id;
        console.log('Editing existing prosthesis with ID:', editingProsthesis.id);
      } else {
        console.log('Creating new prosthesis');
      }
      
      // Enviar dados para o servidor
      prosthesisMutation.mutate(prosthesisData);
    } catch (error) {
      console.error('Error in handleSaveProsthesis:', error);
      // Tratar erros de validação
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao salvar a prótese.",
        variant: "destructive",
      });
    }
  };
  
  // Handler para drag and drop - permite reorganização livre
  const onDragEnd = (result: any) => {
    const { source, destination, draggableId } = result;
    
    // Se não há destino
    if (!destination) {
      return;
    }
    
    // Se movimento é dentro da mesma coluna (reordenação)
    if (source.droppableId === destination.droppableId) {
      // Permitir reordenação livre dentro da mesma coluna
      const newColumns = { ...columns };
      const column = newColumns[source.droppableId as keyof typeof newColumns];
      const [movedItem] = column.items.splice(source.index, 1);
      column.items.splice(destination.index, 0, movedItem);
      setColumns(newColumns);
      return;
    }
    
    // Para mudanças de coluna (status), validar transições permitidas
    const validTransitions: Record<string, string[]> = {
      'pending': ['sent', 'canceled'],
      'sent': ['returned', 'pending'], 
      'returned': ['completed', 'sent'],
      'completed': ['archived'],
      'canceled': ['pending'],
      'archived': ['completed']
    };
    
    if (!validTransitions[source.droppableId]?.includes(destination.droppableId)) {
      toast({
        title: "Mudança de status inválida",
        description: "Esta transição de status não é permitida",
        variant: "destructive"
      });
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
      const sentDateFormatted = format(new Date(), "yyyy-MM-dd");
      updatedItem.sentDate = sentDateFormatted;
      
      // Atualizar no backend
      updateStatusMutation.mutate({ 
        id: prosthesisId, 
        status: 'sent',
        sentDate: sentDateFormatted
      });
      
      toast({
        title: "Prótese enviada",
        description: `Prótese de ${updatedItem.patientName} enviada para o laboratório ${updatedItem.laboratory}`,
      });
    } 
    else if (destination.droppableId === 'returned' && source.droppableId === 'sent') {
      // Quando retorna do laboratório
      const returnDateFormatted = format(new Date(), "yyyy-MM-dd");
      updatedItem.returnDate = returnDateFormatted;
      
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
      
      // Atualizar no backend
      updateStatusMutation.mutate({ 
        id: prosthesisId, 
        status: 'returned',
        returnDate: returnDateFormatted
      });
    }
    else if (destination.droppableId === 'completed') {
      // Quando concluímos o caso
      toast({
        title: "Prótese concluída",
        description: `Tratamento de ${updatedItem.patientName} concluído com sucesso`,
      });
      
      // Atualizar no backend
      updateStatusMutation.mutate({ 
        id: prosthesisId, 
        status: 'completed'
      });
    }
    else if (destination.droppableId === 'pending') {
      // Quando voltamos para pendente (cancelar envio)
      updatedItem.sentDate = null;
      updatedItem.returnDate = null;
      
      updateStatusMutation.mutate({ 
        id: prosthesisId, 
        status: 'pending'
      });
      
      toast({
        title: "Status atualizado",
        description: `Prótese de ${updatedItem.patientName} retornou para pendente`,
      });
    }
    
    // Adicionar o item atualizado à coluna de destino
    newColumns[destination.droppableId as keyof typeof newColumns].items.splice(
      destination.index,
      0,
      updatedItem
    );
    
    // Não atualizar estado local - deixar o refetch do backend organizar as colunas corretamente
    // Isso evita inconsistências e movimentos automáticos incorretos
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
  
  // Função para verificar se uma cor é clara (para texto preto) ou escura (para texto branco)
  const isLightColor = (color: string): boolean => {
    // Remove o # se existir
    const hex = color.replace('#', '');
    
    // Converte para RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Calcula a luminosidade
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Retorna true se for clara (> 0.5)
    return luminance > 0.5;
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
    setSelectedLabels([]);
    setIsModalOpen(true);
  };
  
  // Função para alternar a seleção de etiquetas
  const toggleLabelSelection = (labelId: string) => {
    setSelectedLabels(prevLabels => {
      if (prevLabels.includes(labelId)) {
        return prevLabels.filter(id => id !== labelId);
      } else {
        return [...prevLabels, labelId];
      }
    });
  };
  
  // Configurar dados ao editar item existente
  const handleEditProsthesis = (prosthesis: Prosthesis) => {
    setEditingProsthesis(prosthesis);
    
    // Inicializar estados dos Comboboxes
    setSelectedPatient(prosthesis.patientId.toString());
    setSelectedLaboratory(prosthesis.laboratory || "");
    
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
    
    // Carregar etiquetas da prótese para edição
    if (prosthesis.labels && prosthesis.labels.length > 0) {
      setSelectedLabels(prosthesis.labels);
    } else {
      setSelectedLabels([]);
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowLabelManager(true)} className="gap-2">
              <Settings className="h-4 w-4" />
              Etiquetas
            </Button>
            <Button 
              variant={showArchivedColumn ? "default" : "outline"} 
              onClick={() => setShowArchivedColumn(!showArchivedColumn)} 
              className="gap-2"
            >
              <Archive className="h-4 w-4" />
              Arquivados
              {columns.archived.items.length > 0 && (
                <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center rounded-full ml-1">
                  {columns.archived.items.length}
                </Badge>
              )}
            </Button>
            <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros
                  {(filters.delayedServices || filters.returnedServices || filters.professional !== "all" || filters.laboratory !== "all" || filters.label !== "all") && (
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
                        {professionals.map((prof: any) => (
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
                        {laboratories?.map(lab => (
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
            <div className={cn(
              "grid grid-cols-1 gap-4",
              showArchivedColumn ? "md:grid-cols-5" : "md:grid-cols-4"
            )}>
              {Object.values(columns)
                .filter(column => column.id !== 'archived' || showArchivedColumn)
                .map(column => (
                <div key={column.id} className={cn(
                  "bg-card rounded-lg border shadow-sm",
                  (column.id === 'sent' && delayedSent > 0) && "border-red-400",
                  (column.id === 'returned' && delayedReturned > 0) && "border-red-400"
                )}>
                  <div className="p-4 font-semibold border-b flex justify-between items-center select-none">
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
                            {column.id === "archived" && <Archive className="h-10 w-10 mb-2 opacity-20" />}
                            <span className="select-none">Nenhuma prótese</span>
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
                                    "p-3 mb-2 bg-background rounded-md border shadow-sm cursor-grab transition-all duration-200 hover:bg-muted select-none",
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
                                      
                                      {/* Mostrar etiquetas */}
                                      {item.labels && item.labels.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                          {item.labels.map(labelId => {
                                            const labelObj = labels.find(l => l.id === labelId);
                                            if (!labelObj) return null;
                                            return (
                                              <Badge 
                                                key={labelId} 
                                                className="text-xs px-1.5 py-0"
                                                style={{ 
                                                  backgroundColor: labelObj.color,
                                                  color: isLightColor(labelObj.color) ? '#000' : '#fff'
                                                }}
                                              >
                                                {labelObj.name}
                                              </Badge>
                                            );
                                          })}
                                        </div>
                                      )}
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
                                        {item.status !== 'archived' ? (
                                          <DropdownMenuItem onClick={(e) => {
                                            e.stopPropagation();
                                            archiveProsthesisMutation.mutate(item.id);
                                          }}>
                                            <Archive className="h-4 w-4 mr-2" /> Arquivar
                                          </DropdownMenuItem>
                                        ) : (
                                          <DropdownMenuItem onClick={(e) => {
                                            e.stopPropagation();
                                            unarchiveProsthesisMutation.mutate(item.id);
                                          }}>
                                            <ArchiveRestore className="h-4 w-4 mr-2" /> Desarquivar
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-destructive"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setProsthesisToDelete(item);
                                            setIsDeleteModalOpen(true);
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
                    <Popover open={patientSearchOpen} onOpenChange={setPatientSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={patientSearchOpen}
                          className="w-full justify-between"
                        >
                          {selectedPatient
                            ? patients.find((patient: any) => patient.id.toString() === selectedPatient)?.fullName
                            : editingProsthesis
                            ? patients.find((patient: any) => patient.id === editingProsthesis.patientId)?.fullName
                            : "Selecione o paciente..."}
                          <ChevronRight className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Buscar paciente..." />
                          <CommandEmpty>Nenhum paciente encontrado.</CommandEmpty>
                          <CommandGroup>
                            {patients.map((patient: any) => (
                              <CommandItem
                                key={patient.id}
                                value={patient.fullName}
                                onSelect={() => {
                                  setSelectedPatient(patient.id.toString());
                                  setPatientSearchOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedPatient === patient.id.toString() ||
                                    (editingProsthesis && editingProsthesis.patientId === patient.id)
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {patient.fullName}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <input type="hidden" name="patient" value={selectedPatient || editingProsthesis?.patientId?.toString() || ""} required />
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
                        {professionals.map((professional: any) => (
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
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Label htmlFor="laboratory" className="mr-2">Laboratório</Label>
                        </div>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => setShowLaboratoryManager(true)}
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Gerenciar Laboratórios
                        </Button>
                      </div>
                      
                      <Popover open={laboratorySearchOpen} onOpenChange={setLaboratorySearchOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={laboratorySearchOpen}
                            className="w-full justify-between"
                          >
                            {selectedLaboratory
                              ? selectedLaboratory
                              : editingProsthesis?.laboratory
                              ? editingProsthesis.laboratory
                              : "Selecione ou digite novo laboratório..."}
                            <ChevronRight className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                          <Command>
                            <CommandInput 
                              placeholder="Buscar ou criar laboratório..." 
                              value={selectedLaboratory}
                              onValueChange={setSelectedLaboratory}
                            />
                            <CommandEmpty>
                              <div className="p-2 text-sm text-muted-foreground">
                                Nenhum laboratório encontrado.
                                {selectedLaboratory && (
                                  <div className="mt-1">
                                    Pressione Enter para criar "{selectedLaboratory}"
                                  </div>
                                )}
                              </div>
                            </CommandEmpty>
                            <CommandGroup>
                              {laboratories.map((lab: any) => (
                                <CommandItem
                                  key={lab.id}
                                  value={lab.name}
                                  onSelect={() => {
                                    setSelectedLaboratory(lab.name);
                                    setLaboratorySearchOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedLaboratory === lab.name ||
                                      (editingProsthesis && editingProsthesis.laboratory === lab.name)
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  {lab.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <input 
                        type="hidden" 
                        name="laboratory" 
                        value={selectedLaboratory || editingProsthesis?.laboratory || ""} 
                        required 
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
                        
                        {editingLaboratory ? (
                          // Modo de edição de laboratório
                          <div className="grid gap-4 py-2 my-4">
                            <h3 className="text-sm font-medium">Editar Laboratório</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="md:col-span-2">
                                <Input 
                                  placeholder="Nome do laboratório" 
                                  className="w-full"
                                  value={editLabName || ""}
                                  onChange={(e) => setEditLabName(e.target.value)}
                                />
                              </div>
                              <div>
                                <Input 
                                  placeholder="WhatsApp" 
                                  className="w-full"
                                  value={editLabPhone || ""}
                                  onChange={(e) => setEditLabPhone(e.target.value)}
                                />
                              </div>
                            </div>
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setEditingLaboratory(null);
                                  setEditLabName("");
                                  setEditLabPhone("");
                                }}
                              >
                                Cancelar
                              </Button>
                              <Button
                                onClick={() => {
                                  if (editLabName.trim() && editingLaboratory) {
                                    updateLabMutation.mutate({
                                      id: editingLaboratory.id,
                                      data: {
                                        name: editLabName.trim(),
                                        email: editLabPhone.trim() || "",
                                        phone: editLabPhone.trim() || ""
                                      }
                                    });
                                  } else {
                                    toast({
                                      title: "Erro",
                                      description: "Nome do laboratório é obrigatório",
                                      variant: "destructive"
                                    });
                                  }
                                }}
                                disabled={updateLabMutation.isPending}
                                className="px-4"
                              >
                                Salvar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          // Modo de adição de laboratório
                          <div className="grid gap-4 py-2 my-4">
                            <h3 className="text-sm font-medium">Adicionar Laboratório</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="md:col-span-2">
                                <Input 
                                  placeholder="Nome do laboratório" 
                                  id="newLaboratoryName" 
                                  className="w-full"
                                />
                              </div>
                              <div>
                                <Input 
                                  placeholder="WhatsApp" 
                                  id="newLaboratoryPhone" 
                                  className="w-full"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end">
                              <Button
                                onClick={() => {
                                  const nameInput = document.getElementById("newLaboratoryName") as HTMLInputElement;
                                  const phoneInput = document.getElementById("newLaboratoryPhone") as HTMLInputElement;
                                  
                                  if (nameInput?.value.trim()) {
                                    createLabMutation.mutate({
                                      name: nameInput.value.trim(),
                                      email: phoneInput?.value.trim() || "",
                                      phone: phoneInput?.value.trim() || ""
                                    });
                                    nameInput.value = "";
                                    if (phoneInput) phoneInput.value = "";
                                  } else {
                                    toast({
                                      title: "Erro",
                                      description: "Nome do laboratório é obrigatório",
                                      variant: "destructive"
                                    });
                                  }
                                }}
                                disabled={createLabMutation.isPending}
                                className="px-4"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Adicionar
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        <div className="border-t my-2"></div>
                        
                        {/* Lista de laboratórios */}
                        <div className="my-4">
                          <h3 className="text-sm font-medium mb-4">Laboratórios Cadastrados</h3>
                          <div className="max-h-[300px] overflow-y-auto rounded-md border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Nome</TableHead>
                                  <TableHead>WhatsApp</TableHead>
                                  <TableHead className="w-[120px] text-right">Ações</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {laboratories.map((lab: any) => (
                                  <TableRow key={lab.id}>
                                    <TableCell className="font-medium">{lab.name}</TableCell>
                                    <TableCell>{lab.email || lab.phone || "-"}</TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex justify-end space-x-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setEditingLaboratory({
                                              id: lab.id,
                                              name: lab.name,
                                              contact: lab.phone || lab.email || ""
                                            });
                                            setEditLabName(lab.name);
                                            setEditLabPhone(lab.phone || lab.email || "");
                                          }}
                                        >
                                          <Edit className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            deleteLabMutation.mutate(lab.id);
                                          }}
                                          disabled={deleteLabMutation.isPending}
                                        >
                                          <X className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {laboratories.length === 0 && (
                                  <TableRow>
                                    <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                                      Nenhum laboratório cadastrado
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                        
                        <DialogFooter>
                          <Button 
                            variant="outline" 
                            onClick={() => setShowLaboratoryManager(false)}
                          >
                            Fechar
                          </Button>
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

                <div className="grid gap-2 mt-4">
                  <Label>Etiquetas</Label>
                  <div className="flex flex-wrap gap-2 p-3 border rounded-md min-h-[80px]">
                    {labels.map(label => (
                      <div 
                        key={label.id}
                        onClick={() => toggleLabelSelection(label.id)}
                        className={cn(
                          "flex items-center px-2 py-1 rounded-md cursor-pointer transition-all",
                          selectedLabels.includes(label.id) ? "ring-2 ring-offset-1" : "opacity-70 hover:opacity-100"
                        )}
                        style={{ 
                          backgroundColor: label.color,
                          color: isLightColor(label.color) ? '#000' : '#fff'
                        }}
                      >
                        {label.name}
                        {selectedLabels.includes(label.id) && (
                          <Check className="h-3 w-3 ml-1" />
                        )}
                      </div>
                    ))}
                    {labels.length === 0 && (
                      <div className="text-sm text-muted-foreground flex-1 flex items-center justify-center">
                        Nenhuma etiqueta disponível. Use o botão "Etiquetas" para criar.
                      </div>
                    )}
                  </div>
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
        
        {/* Modal de confirmação para excluir prótese */}
        <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta prótese? Esta ação não pode ser desfeita.
                {prosthesisToDelete && (
                  <div className="mt-2 p-3 border rounded-md">
                    <p><strong>Paciente:</strong> {prosthesisToDelete.patientName}</p>
                    <p><strong>Tipo:</strong> {prosthesisToDelete.type}</p>
                    <p><strong>Laboratório:</strong> {prosthesisToDelete.laboratory}</p>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setProsthesisToDelete(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (prosthesisToDelete) {
                    deleteProsthesisMutation.mutate(prosthesisToDelete.id);
                    setProsthesisToDelete(null);
                  }
                }}
              >
                {deleteProsthesisMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      
        {/* Modal de gerenciamento de etiquetas */}
        <Dialog open={showLabelManager} onOpenChange={setShowLabelManager}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Gerenciamento de Etiquetas</DialogTitle>
              <DialogDescription>
                Crie e gerencie etiquetas para organizar suas próteses
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="flex items-center space-x-2">
                <div className="grid flex-1 gap-2">
                  <Input
                    placeholder="Nome da etiqueta"
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <Input
                    type="color"
                    className="w-[80px] h-10 cursor-pointer"
                    value={newLabelColor}
                    onChange={(e) => setNewLabelColor(e.target.value)}
                  />
                </div>
                <Button size="sm" onClick={() => {
                  if (newLabelName.trim()) {
                    const labelId = newLabelName.trim().toLowerCase().replace(/\s+/g, "-");
                    
                    // Verificar se já existe
                    if (labels.some(l => l.id === labelId)) {
                      toast({
                        title: "Erro",
                        description: "Já existe uma etiqueta com este nome",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    setLabels([...labels, {
                      id: labelId,
                      name: newLabelName.trim(),
                      color: newLabelColor
                    }]);
                    setNewLabelName("");
                    
                    toast({
                      title: "Sucesso",
                      description: "Etiqueta criada com sucesso"
                    });
                  }
                }}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="border rounded-md">
                <div className="py-2 px-3 border-b bg-muted/50">
                  <h3 className="text-sm font-medium">Etiquetas disponíveis</h3>
                </div>
                <div className="p-2 max-h-[220px] overflow-auto">
                  {labels.length === 0 ? (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      Nenhuma etiqueta criada
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {labels.map((label) => (
                        <div key={label.id} className="flex items-center justify-between p-2 rounded hover:bg-muted">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: label.color }}></div>
                            <span>{label.name}</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7"
                            onClick={() => {
                              setLabels(labels.filter(l => l.id !== label.id));
                              toast({
                                title: "Etiqueta removida",
                                description: "A etiqueta foi removida com sucesso"
                              });
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <DialogFooter className="sm:justify-between">
              <Button 
                type="button" 
                variant="outline" 
                onClick={restoreDefaultLabels}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Restaurar Padrão
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowLabelManager(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}