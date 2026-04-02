import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { Plus, Filter, Edit, Trash2, MoreHorizontal, Calendar as CalendarIcon, ExternalLink, AlertCircle, ChevronRight, Package, ArrowUpDown, Check, ArrowLeftRight, Settings, X, Loader2, RotateCcw, Archive, ArchiveRestore, BarChart3, AlertTriangle, TrendingUp, FileText, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
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
  price: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
}

interface Laboratory {
  id: number;
  name: string;
  contact: string;
  address: string;
}

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

interface ProsthesisLabel {
  id: string;
  name: string;
  color: string;
}

const defaultLabels: ProsthesisLabel[] = [
  { id: "urgente", name: "Urgente", color: "#dc2626" },
  { id: "prioridade", name: "Prioridade", color: "#ea580c" },
  { id: "premium", name: "Premium", color: "#9333ea" },
  { id: "retrabalho", name: "Retrabalho", color: "#eab308" },
  { id: "provisorio", name: "Provisório", color: "#2563eb" },
  { id: "definitivo", name: "Definitivo", color: "#16a34a" }
];

interface StatusColumn {
  id: string;
  title: string;
  items: Prosthesis[];
}

type StatusKey = 'pending' | 'sent' | 'returned' | 'completed' | 'archived';

type ColumnsMap = {
  [K in StatusKey]: StatusColumn;
};

const BASE_COLUMNS: ColumnsMap = {
  pending: { id: "pending", title: "Aguardando Envio", items: [] },
  sent: { id: "sent", title: "No Laboratório", items: [] },
  returned: { id: "returned", title: "Retornado", items: [] },
  completed: { id: "completed", title: "Realizado", items: [] },
  archived: { id: "archived", title: "Arquivado", items: [] }
};

export default function ProsthesisControlPage() {
  const { toast } = useToast();

  // Queries
  const { data: laboratories = [], isLoading: isLoadingLabs, refetch: refetchLabs } = useQuery({
    queryKey: ["/api/laboratories"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/laboratories");
      if (!res.ok) throw new Error("Falha ao carregar laboratórios");
      return res.json();
    }
  });

  const { data: patients = [], isLoading: isLoadingPatients } = useQuery({
    queryKey: ["/api/patients"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/patients");
      if (!res.ok) throw new Error("Falha ao carregar pacientes");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: professionals = [], isLoading: isLoadingProfessionals } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      if (!res.ok) throw new Error("Falha ao carregar profissionais");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: labelsFromDB = [], isLoading: isLoadingLabels, refetch: refetchLabels } = useQuery({
    queryKey: ["/api/prosthesis-labels"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/prosthesis-labels");
      if (!res.ok) throw new Error("Falha ao carregar etiquetas");
      const data = await res.json();
      return data.length > 0 ? data : defaultLabels;
    },
    staleTime: 5 * 60 * 1000,
  });

  // State
  const [columns, setColumns] = useState<ColumnsMap>(BASE_COLUMNS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showLaboratoryManager, setShowLaboratoryManager] = useState(false);
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [editingLaboratory, setEditingLaboratory] = useState<{ id: number, name: string, contact: string } | null>(null);
  const [editingProsthesis, setEditingProsthesis] = useState<Prosthesis | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [prosthesisToDelete, setProsthesisToDelete] = useState<Prosthesis | null>(null);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#16a34a");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [showReports, setShowReports] = useState(false);
  const [showArchivedColumn, setShowArchivedColumn] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [selectedLaboratory, setSelectedLaboratory] = useState<string>("");
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const [laboratorySearchOpen, setLaboratorySearchOpen] = useState(false);
  const [priceValue, setPriceValue] = useState("");
  const [showPositionOptions, setShowPositionOptions] = useState(false);
  const [defaultDropPosition, setDefaultDropPosition] = useState<'start' | 'exact' | 'end'>('exact');
  const [sentDate, setSentDate] = useState<Date | undefined>(undefined);
  const [expectedReturnDate, setExpectedReturnDate] = useState<Date | undefined>(undefined);

  const [filters, setFilters] = useState({
    delayedServices: false,
    returnedServices: false,
    custom: false,
    professional: "all",
    laboratory: "all",
    label: "all"
  });

  const labels = labelsFromDB.length > 0 ? labelsFromDB : defaultLabels;

  // Query prostheses
  const { data: prosthesisData = [], isLoading: isLoadingProsthesis, refetch: refetchProsthesis } = useQuery({
    queryKey: ["/api/v1/prosthesis"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/v1/prosthesis");
      if (!res.ok) throw new Error(`Falha ao carregar: ${res.status}`);
      const response = await res.json();
      const data = response.data || response;
      if (!Array.isArray(data)) throw new Error("Dados inválidos do servidor");
      return data as Prosthesis[];
    },
    staleTime: 2000,
  });

  // Sync state with server data
  useEffect(() => {
    if (!prosthesisData) return;

    // Filter and sort items locally
    const filterAndSort = (items: Prosthesis[]) => {
      let filtered = items;

      if (filters.delayedServices) {
        const now = new Date();
        filtered = filtered.filter(p =>
          p.expectedReturnDate && isAfter(now, parseISO(p.expectedReturnDate)) && !p.returnDate
        );
      }

      if (filters.returnedServices) {
        // Special case from original code
        // Logic would be: if returnedServices is true, maybe show items that HAVE a return date?
        // Or items that are expected to return? 
        // For now, keeping as pass-through or implementing 'items with expected return date'
        filtered = filtered.filter(p => !!p.expectedReturnDate);
      }

      if (filters.professional !== "all") {
        const professionalId = parseInt(filters.professional);
        filtered = filtered.filter(p => p.professionalId === professionalId);
      }

      if (filters.laboratory !== "all") {
        filtered = filtered.filter(p => p.laboratory === filters.laboratory);
      }

      if (filters.label !== "all") {
        filtered = filtered.filter(p => p.labels && p.labels.includes(filters.label));
      }

      // Sort by sortOrder
      return filtered.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    };

    const newColumns: ColumnsMap = {
      pending: { ...BASE_COLUMNS.pending, items: filterAndSort(prosthesisData.filter(p => p.status === 'pending')) },
      sent: { ...BASE_COLUMNS.sent, items: filterAndSort(prosthesisData.filter(p => p.status === 'sent')) },
      returned: { ...BASE_COLUMNS.returned, items: filterAndSort(prosthesisData.filter(p => p.status === 'returned')) },
      completed: { ...BASE_COLUMNS.completed, items: filterAndSort(prosthesisData.filter(p => p.status === 'completed')) },
      archived: { ...BASE_COLUMNS.archived, items: filterAndSort(prosthesisData.filter(p => p.status === 'archived')) }
    };

    setColumns(newColumns);
  }, [prosthesisData, filters]);

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, returnDate, sentDate, sortOrder }: any) => {
      const updateData: any = { status };
      if (status === 'sent' && sentDate) updateData.sentDate = sentDate;
      if (status === 'returned' && returnDate) updateData.returnDate = returnDate;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

      const response = await apiRequest('PATCH', `/api/v1/prosthesis/${id}`, updateData);
      if (!response.ok) throw new Error("Falha ao atualizar");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/prosthesis"] });
    },
    onError: () => {
      toast({
        title: "Erro de sincronização",
        description: "A lista será recarregada.",
        variant: "destructive"
      });
      refetchProsthesis();
    }
  });

  const prosthesisMutation = useMutation({
    mutationFn: async (prosthesisData: Partial<Prosthesis>) => {
      const method = prosthesisData.id ? "PATCH" : "POST";
      const url = prosthesisData.id ? `/api/v1/prosthesis/${prosthesisData.id}` : "/api/v1/prosthesis";
      const res = await apiRequest(method, url, prosthesisData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/prosthesis"] });
      setIsModalOpen(false);
      setEditingProsthesis(null);
      setSelectedLabels([]);
      setSentDate(undefined);
      setExpectedReturnDate(undefined);
      toast({ title: "Sucesso", description: "Dados salvos com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  });

  const deleteProsthesisMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/v1/prosthesis/${id}`);
      if (!res.ok) throw new Error("Erro ao deletar");
      return res.status === 204 ? { success: true } : res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/prosthesis"] });
      toast({ title: "Sucesso", description: "Prótese excluída!" });
    },
    onError: () => toast({ title: "Erro", description: "Falha ao excluir.", variant: "destructive" })
  });

  // Drag and Drop Logic
  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceColumnId = source.droppableId as StatusKey;
    const destColumnId = destination.droppableId as StatusKey;
    const itemId = parseInt(draggableId.replace('prosthesis-', ''));

    // 1. Optimistic Update
    const sourceItems = [...columns[sourceColumnId].items];
    const destItems = sourceColumnId === destColumnId ? sourceItems : [...columns[destColumnId].items];

    const [removed] = sourceItems.splice(source.index, 1);
    const updatedItem = { ...removed, status: destColumnId as any };

    // Update dates if needed
    if (destColumnId === 'sent' && sourceColumnId !== 'sent') {
      updatedItem.sentDate = format(new Date(), "yyyy-MM-dd");
    }
    if (destColumnId === 'returned' && sourceColumnId !== 'returned') {
      updatedItem.returnDate = format(new Date(), "yyyy-MM-dd");
    }

    // Determine insert position based on defaultDropPosition preference
    let insertIndex = destination.index;

    // Adjust index if moving in same column and item was removed from earlier position
    if (sourceColumnId === destColumnId && source.index < destination.index) {
      insertIndex = destination.index; // No need to subtract 1 here with splice/splice logic usually, but depends on exact behavior. 
      // With standard dnd logic: removing first shifts subsequent indices down.
      // If I drag from 0 to 2. Remove at 0. Items [1, 2] become [0, 1]. Destination 2 is now after item 1.
    }

    if (defaultDropPosition === 'start') {
      insertIndex = 0;
    } else if (defaultDropPosition === 'end') {
      insertIndex = destItems.length; // Post-removal length
    }

    destItems.splice(insertIndex, 0, updatedItem);

    // Update local state
    const newColumns = { ...columns };
    newColumns[sourceColumnId] = { ...newColumns[sourceColumnId], items: sourceItems };
    newColumns[destColumnId] = { ...newColumns[destColumnId], items: destItems };
    setColumns(newColumns);

    // 2. Call API
    // If moving within same list, calculate new sort order based on neighbors
    const prevItem = destItems[insertIndex - 1];
    const nextItem = destItems[insertIndex + 1];

    let newSortOrder = 0;
    if (insertIndex === 0) {
      newSortOrder = (destItems[1]?.sortOrder || 0) - 1000;
    } else if (insertIndex === destItems.length - 1) {
      newSortOrder = (destItems[destItems.length - 2]?.sortOrder || 0) + 1000;
    } else {
      newSortOrder = ((prevItem?.sortOrder || 0) + (nextItem?.sortOrder || 0)) / 2;
    }

    updateStatusMutation.mutate({
      id: itemId,
      status: destColumnId,
      sortOrder: Math.round(newSortOrder),
      sentDate: updatedItem.sentDate,
      returnDate: updatedItem.returnDate
    });
  };

  // Helper functions
  const handleOpenNewProsthesisModal = () => {
    setEditingProsthesis(null);
    setSentDate(undefined);
    setExpectedReturnDate(undefined);
    setSelectedLabels([]);
    setIsModalOpen(true);
  };

  const handleEditProsthesis = (prosthesis: Prosthesis) => {
    setEditingProsthesis(prosthesis);
    setSelectedPatient(prosthesis.patientId.toString());
    setSelectedLaboratory(prosthesis.laboratory || "");
    setSentDate(prosthesis.sentDate ? parseISO(prosthesis.sentDate) : undefined);
    setExpectedReturnDate(prosthesis.expectedReturnDate ? parseISO(prosthesis.expectedReturnDate) : undefined);
    setSelectedLabels(prosthesis.labels || []);
    setPriceValue(prosthesis.price ? (prosthesis.price / 100).toFixed(2) : "");
    setIsModalOpen(true);
  };

  const handleSaveProsthesis = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    if (!selectedPatient && !formData.get("patient")) {
      toast({ title: "Erro", description: "Selecione um paciente", variant: "destructive" });
      return;
    }

    try {
      const prosthesisData: any = {
        patientId: parseInt(selectedPatient || formData.get("patient") as string),
        professionalId: parseInt(formData.get("professional") as string),
        type: formData.get("type") as string,
        description: formData.get("description") as string,
        laboratory: selectedLaboratory || formData.get("laboratory") as string,
        sentDate: sentDate ? format(sentDate, "yyyy-MM-dd") : null,
        expectedReturnDate: expectedReturnDate ? format(expectedReturnDate, "yyyy-MM-dd") : null,
        observations: formData.get("observations") as string || null,
        price: priceValue ? Math.round(parseFloat(priceValue) * 100) : 0,
        status: editingProsthesis ? editingProsthesis.status : 'pending',
        labels: selectedLabels || [],
      };

      if (editingProsthesis) {
        prosthesisData.id = editingProsthesis.id;
      }

      prosthesisMutation.mutate(prosthesisData);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <DashboardLayout title="Controle de Próteses" currentPath="/prosthesis">
      <div className="container mx-auto py-6">
        {/* Header Controls */}
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
                          setFilters(prev => ({ ...prev, delayedServices: !!checked }))
                        }
                      />
                      <label htmlFor="delayedServices" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Serviços atrasados
                      </label>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="professionalFilter">Profissional</Label>
                    <Select
                      value={filters.professional}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, professional: value }))}
                    >
                      <SelectTrigger id="professionalFilter">
                        <SelectValue placeholder="Todos os profissionais" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os profissionais</SelectItem>
                        {professionals.map((prof: any) => (
                          <SelectItem key={prof.id} value={prof.id.toString()}>
                            {prof.fullName || prof.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="laboratoryFilter">Laboratório</Label>
                    <Select
                      value={filters.laboratory}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, laboratory: value }))}
                    >
                      <SelectTrigger id="laboratoryFilter">
                        <SelectValue placeholder="Todos os laboratórios" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os laboratórios</SelectItem>
                        {laboratories?.map((lab: any) => (
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
                    Limpar Filtros
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <Button onClick={handleOpenNewProsthesisModal}>
              <Plus className="h-4 w-4 mr-2" /> Nova Prótese
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Posição ao soltar</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDefaultDropPosition('start')}>
                  {defaultDropPosition === 'start' && <Check className="mr-2 h-4 w-4" />}
                  Início da lista
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDefaultDropPosition('exact')}>
                  {defaultDropPosition === 'exact' && <Check className="mr-2 h-4 w-4" />}
                  Posição exata
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDefaultDropPosition('end')}>
                  {defaultDropPosition === 'end' && <Check className="mr-2 h-4 w-4" />}
                  Fim da lista
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Kanban Board */}
        {isLoadingProsthesis ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className={`grid grid-cols-1 gap-4 min-h-[600px] ${showArchivedColumn ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
              {Object.values(columns)
                .filter(col => col.id !== 'archived' || showArchivedColumn)
                .map(column => (
                  <div key={column.id} className="bg-card rounded-lg border shadow-sm flex flex-col h-full">
                    <div className="p-4 font-semibold border-b flex justify-between items-center bg-muted/40">
                      <span>{column.title}</span>
                      <Badge variant="outline">{column.items.length}</Badge>
                    </div>

                    <Droppable droppableId={column.id}>
                      {(provided, snapshot) => (
                        <div
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className={cn(
                            "p-2 flex-1 transition-colors min-h-[200px] max-h-[calc(100vh-250px)] overflow-y-auto",
                            snapshot.isDraggingOver ? "bg-primary/5" : ""
                          )}
                        >
                          {column.items.map((item, index) => (
                            <Draggable key={`prosthesis-${item.id}`} draggableId={`prosthesis-${item.id}`} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  onClick={() => handleEditProsthesis(item)}
                                  className={cn(
                                    "bg-background p-3 mb-2 rounded border shadow-sm cursor-pointer hover:border-primary/50 transition-all",
                                    snapshot.isDragging ? "shadow-lg rotate-2 scale-105" : ""
                                  )}
                                  style={provided.draggableProps.style}
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <span className="font-medium text-sm truncate">{item.patientName || `Paciente #${item.patientId}`}</span>
                                    {item.labels && item.labels.length > 0 && (
                                      <div className="flex gap-1">
                                        {item.labels.slice(0, 2).map((labelId, i) => {
                                          const labelInfo = labels.find((l: ProsthesisLabel) => l.id === labelId);
                                          return labelInfo ? (
                                            <div key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: labelInfo.color }} />
                                          ) : null;
                                        })}
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-1 line-clamp-2">{item.description}</p>
                                  <div className="flex justify-between items-center text-xs text-muted-foreground mt-2">
                                    <span>{item.professionalName || `Dr. #${item.professionalId}`}</span>
                                    <span>{item.updatedAt ? format(parseISO(item.updatedAt), 'dd/MM') : '-'}</span>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                ))}
            </div>
          </DragDropContext>
        )}

        {/* Modal Dialogs - Keeping structure similar to original for functionality */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProsthesis ? 'Editar Prótese' : 'Nova Prótese'}</DialogTitle>
              <DialogDescription>Preencha os dados do serviço de prótese.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveProsthesis} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Paciente</Label>
                  <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map((p: any) => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Profissional</Label>
                  <Select name="professional" defaultValue={editingProsthesis?.professionalId.toString()}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {professionals.map((p: any) => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.fullName || p.username}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Prótese</Label>
                <Select name="type" defaultValue={editingProsthesis?.type}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {prosthesisTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input name="description" defaultValue={editingProsthesis?.description} placeholder="Ex: Coroa no dente 12" required />
              </div>

              <div className="space-y-2">
                <Label>Laboratório</Label>
                <Select value={selectedLaboratory} onValueChange={setSelectedLaboratory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione ou digite..." />
                  </SelectTrigger>
                  <SelectContent>
                    {laboratories.map((l: any) => (
                      <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Envio</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full text-left font-normal">
                        {sentDate ? format(sentDate, 'dd/MM/yyyy') : <span>Selecione...</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={sentDate} onSelect={setSentDate} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Previsão de Retorno</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full text-left font-normal">
                        {expectedReturnDate ? format(expectedReturnDate, 'dd/MM/yyyy') : <span>Selecione...</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={expectedReturnDate} onSelect={setExpectedReturnDate} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Optional: Add Labels multiselect here */}

              <DialogFooter>
                {editingProsthesis && (
                  <Button type="button" variant="destructive" onClick={() => {
                    if (confirm("Tem certeza que deseja excluir?")) {
                      deleteProsthesisMutation.mutate(editingProsthesis.id);
                    }
                  }}>Excluir</Button>
                )}
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Label Manager Dialog */}
        <Dialog open={showLabelManager} onOpenChange={setShowLabelManager}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gerenciar Etiquetas</DialogTitle>
              <DialogDescription>
                Visualize as etiquetas disponíveis.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {labels.map((label: ProsthesisLabel) => (
                <div key={label.id} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: label.color }} />
                    <span className="font-medium">{label.name}</span>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={() => setShowLabelManager(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}