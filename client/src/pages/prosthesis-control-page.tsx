import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

const prosthesisTypes = [
  "Coroa", "Ponte", "Protocolo", "Prótese Parcial Removível",
  "Prótese Total", "Faceta", "Laminado", "Inlay/Onlay", "Implante", "Outro"
];

interface StatusColumn {
  id: string;
  title: string;
  items: Prosthesis[];
}

export default function ProsthesisControlPage() {
  const { toast } = useToast();

  // Query para buscar dados reais
  const { data: laboratories = [], refetch: refetchLabs } = useQuery({
    queryKey: ["/api/laboratories"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/laboratories");
      if (!res.ok) throw new Error("Falha ao carregar laboratórios");
      return res.json();
    }
  });

  const { data: patients = [] } = useQuery({
    queryKey: ["/api/patients"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/patients");
      if (!res.ok) throw new Error("Falha ao carregar pacientes");
      return res.json();
    }
  });

  const { data: professionals = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      if (!res.ok) throw new Error("Falha ao carregar profissionais");
      return res.json();
    }
  });

  const { data: prosthesis = [], isLoading } = useQuery({
    queryKey: ["/api/prosthesis"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/prosthesis");
      if (!res.ok) throw new Error("Falha ao carregar próteses");
      return res.json();
    }
  });

  // Estados
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProsthesis, setEditingProsthesis] = useState<Prosthesis | null>(null);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [sentDate, setSentDate] = useState<Date | undefined>(undefined);
  const [expectedReturnDate, setExpectedReturnDate] = useState<Date | undefined>(undefined);
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [selectedLaboratory, setSelectedLaboratory] = useState<string>("");
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const [laboratorySearchOpen, setLaboratorySearchOpen] = useState(false);
  const [showArchivedColumn, setShowArchivedColumn] = useState(false);
  const [filters, setFilters] = useState({ type: '', professional: '', label: '' });
  const [labels] = useState<ProsthesisLabel[]>(defaultLabels);

  // Colunas do Kanban
  const [columns, setColumns] = useState<Record<string, StatusColumn>>({
    pending: { id: 'pending', title: 'Pré Laboratório', items: [] },
    sent: { id: 'sent', title: 'No Laboratório', items: [] },
    returned: { id: 'returned', title: 'Retornado', items: [] },
    completed: { id: 'completed', title: 'Concluído', items: [] },
    archived: { id: 'archived', title: 'Arquivados', items: [] }
  });

  // Organizar próteses em colunas baseado nos dados
  useEffect(() => {
    if (prosthesis && prosthesis.length > 0) {
      let updatedColumns = {
        pending: { ...columns.pending, items: prosthesis.filter((p: Prosthesis) => p.status === 'pending') },
        sent: { ...columns.sent, items: prosthesis.filter((p: Prosthesis) => p.status === 'sent') },
        returned: { ...columns.returned, items: prosthesis.filter((p: Prosthesis) => p.status === 'returned') },
        completed: { ...columns.completed, items: prosthesis.filter((p: Prosthesis) => p.status === 'completed') },
        archived: { ...columns.archived, items: prosthesis.filter((p: Prosthesis) => p.status === 'archived') }
      };

      // Aplicar filtros
      if (filters.type) {
        Object.keys(updatedColumns).forEach(key => {
          updatedColumns[key as keyof typeof updatedColumns].items = 
            updatedColumns[key as keyof typeof updatedColumns].items.filter(
              (p: Prosthesis) => p.type === filters.type
            );
        });
      }

      if (filters.professional) {
        Object.keys(updatedColumns).forEach(key => {
          updatedColumns[key as keyof typeof updatedColumns].items = 
            updatedColumns[key as keyof typeof updatedColumns].items.filter(
              (p: Prosthesis) => p.professionalId.toString() === filters.professional
            );
        });
      }

      setColumns(updatedColumns);
    }
  }, [prosthesis, filters]);

  // Mutation para atualizar status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, sentDate, returnDate }: { 
      id: number; 
      status: string; 
      sentDate?: string;
      returnDate?: string;
    }) => {
      const updateData: any = { status };
      
      if (sentDate) updateData.sentDate = sentDate;
      if (returnDate) updateData.returnDate = returnDate;
      
      const response = await apiRequest('PATCH', `/api/prosthesis/${id}`, updateData);
      if (!response.ok) throw new Error(`Erro ao atualizar: ${response.status}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prosthesis"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar status da prótese",
        variant: "destructive",
      });
    }
  });

  // Mutation para salvar prótese
  const prosthesisMutation = useMutation({
    mutationFn: async (prosthesisData: Partial<Prosthesis>) => {
      const method = prosthesisData.id ? "PATCH" : "POST";
      const url = prosthesisData.id ? `/api/prosthesis/${prosthesisData.id}` : "/api/prosthesis";
      
      const res = await apiRequest(method, url, prosthesisData);
      if (!res.ok) throw new Error("Falha ao salvar prótese");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prosthesis"] });
      setIsModalOpen(false);
      clearForm();
      toast({
        title: "Sucesso",
        description: editingProsthesis ? "Prótese atualizada com sucesso!" : "Prótese criada com sucesso!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: `Falha ao salvar prótese: ${error.message}`,
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
      if (!response.ok) throw new Error(`Erro ao criar laboratório: ${response.status}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/laboratories"] });
    }
  });

  // Handler para drag and drop SIMPLIFICADO
  const onDragEnd = (result: any) => {
    const { source, destination, draggableId } = result;
    
    if (!destination || source.droppableId === destination.droppableId) {
      return;
    }
    
    const prosthesisId = parseInt(draggableId.replace('prosthesis-', ''));
    const newStatus = destination.droppableId as 'pending' | 'sent' | 'returned' | 'completed' | 'archived';
    
    let updateData: any = { status: newStatus };
    
    if (newStatus === 'sent') {
      updateData.sentDate = format(new Date(), "yyyy-MM-dd");
    } else if (newStatus === 'returned') {
      updateData.returnDate = format(new Date(), "yyyy-MM-dd");
    }
    
    updateStatusMutation.mutate({ id: prosthesisId, ...updateData });
  };

  // Handler para salvar prótese
  const handleSaveProsthesis = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    try {
      const laboratoryName = selectedLaboratory || formData.get("laboratory") as string;
      
      if (laboratoryName && laboratories) {
        const existingLab = laboratories.find((lab: any) => lab.name.toLowerCase() === laboratoryName.toLowerCase());
        if (!existingLab) {
          await createLaboratoryMutation.mutateAsync(laboratoryName);
        }
      }
      
      const prosthesisData: any = {
        patientId: parseInt(selectedPatient || formData.get("patient") as string),
        professionalId: parseInt(formData.get("professional") as string),
        type: formData.get("type") as string,
        description: formData.get("description") as string,
        laboratory: laboratoryName,
        sentDate: sentDate ? format(sentDate, "yyyy-MM-dd") : null,
        expectedReturnDate: expectedReturnDate ? format(expectedReturnDate, "yyyy-MM-dd") : null,
        observations: formData.get("observations") as string || null,
        status: editingProsthesis ? editingProsthesis.status : 'pending',
        labels: selectedLabels || [],
      };
      
      if (editingProsthesis) {
        prosthesisData.id = editingProsthesis.id;
      }
      
      prosthesisMutation.mutate(prosthesisData);
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao salvar a prótese.",
        variant: "destructive",
      });
    }
  };

  const clearForm = () => {
    setEditingProsthesis(null);
    setSentDate(undefined);
    setExpectedReturnDate(undefined);
    setSelectedLabels([]);
    setSelectedPatient("");
    setSelectedLaboratory("");
    setIsModalOpen(false);
  };

  const handleEditProsthesis = (prosthesis: Prosthesis) => {
    setEditingProsthesis(prosthesis);
    setSelectedPatient(prosthesis.patientId.toString());
    setSelectedLaboratory(prosthesis.laboratory || "");
    
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
    
    setSelectedLabels(prosthesis.labels || []);
    setIsModalOpen(true);
  };

  const isDelayed = (item: Prosthesis) => {
    if (item.status === 'sent' && item.expectedReturnDate) {
      return isAfter(new Date(), parseISO(item.expectedReturnDate));
    }
    return false;
  };

  const isLightColor = (color: string) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return brightness > 155;
  };

  const columnsToShow = showArchivedColumn 
    ? columns 
    : Object.fromEntries(Object.entries(columns).filter(([key]) => key !== 'archived'));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Controle de Próteses</h1>
          <p className="text-muted-foreground">
            Gerencie o fluxo de trabalho das próteses do laboratório
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowArchivedColumn(!showArchivedColumn)}
          >
            {showArchivedColumn ? 'Ocultar Arquivados' : 'Mostrar Arquivados'}
          </Button>
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button onClick={clearForm}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Prótese
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>
                  {editingProsthesis ? "Editar Prótese" : "Nova Prótese"}
                </DialogTitle>
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
                            className="w-full justify-between"
                          >
                            {selectedPatient
                              ? patients.find((patient: any) => patient.id.toString() === selectedPatient)?.fullName
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
                                      selectedPatient === patient.id.toString() ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {patient.fullName}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="professional">Profissional</Label>
                      <Select 
                        defaultValue={editingProsthesis?.professionalId.toString() || undefined}
                        name="professional"
                        required
                      >
                        <SelectTrigger>
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
                        <SelectTrigger>
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
                      <Popover open={laboratorySearchOpen} onOpenChange={setLaboratorySearchOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between"
                          >
                            {selectedLaboratory || "Selecione ou digite novo laboratório..."}
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
                            <CommandEmpty>Nenhum laboratório encontrado.</CommandEmpty>
                            <CommandGroup>
                              {laboratories.map((lab: any) => (
                                <CommandItem
                                  key={lab.id}
                                  value={lab.name}
                                  onSelect={(value) => {
                                    setSelectedLaboratory(value);
                                    setLaboratorySearchOpen(false);
                                  }}
                                >
                                  {lab.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Input
                      id="description"
                      name="description"
                      defaultValue={editingProsthesis?.description || ""}
                      placeholder="Descreva os detalhes da prótese..."
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="observations">Observações</Label>
                    <Textarea
                      id="observations"
                      name="observations"
                      defaultValue={editingProsthesis?.observations || ""}
                      placeholder="Observações adicionais..."
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={prosthesisMutation.isPending}>
                    {prosthesisMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className={cn(
          "grid gap-4",
          showArchivedColumn ? "grid-cols-5" : "grid-cols-4"
        )}>
          {Object.values(columnsToShow).map((column) => (
            <div key={column.id} className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold">{column.title}</span>
                <Badge variant="outline">{column.items.length}</Badge>
              </div>
              <Droppable droppableId={column.id}>
                {(provided) => (
                  <div 
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="min-h-[300px] space-y-2"
                  >
                    {column.items.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                        <Package className="h-10 w-10 mb-2 opacity-20" />
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
                              className={cn(
                                "p-3 bg-background rounded-md border shadow-sm cursor-pointer transition-all hover:bg-muted",
                                snapshot.isDragging && "shadow-lg border-primary scale-[1.02]",
                                isDelayed(item) && "border-red-400"
                              )}
                            >
                              <div className="space-y-2">
                                <h3 className="font-medium">{item.patientName}</h3>
                                <p className="text-sm text-muted-foreground">{item.type}</p>
                                <p className="text-xs text-muted-foreground">{item.laboratory}</p>
                                
                                {item.labels && item.labels.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
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
    </div>
  );
}