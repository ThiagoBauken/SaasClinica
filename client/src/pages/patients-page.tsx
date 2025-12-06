import { useState } from "react";
import { addMonths, isBefore, parseISO, differenceInMonths, format } from "date-fns";
import { Link } from "wouter";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Plus, Phone, Mail, Calendar, Edit, FileText, Download, Upload, AlertCircle, ChevronDown, X, Scan, CheckSquare, Trash2, MessageSquare, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import PatientForm from "@/components/patients/PatientForm";
import PatientsList from "@/components/patients/PatientsList";
import PatientRecordTab from "@/components/patients/PatientRecordTab";
import OdontogramChart from "@/components/odontogram/OdontogramChart";
import Papa from "papaparse";

interface Patient {
  id: number;
  fullName: string;
  email?: string;
  phone?: string;
  lastVisit?: string;
  dateOfBirth?: string;
  birthDate?: string;
  cpf?: string;
  address?: string;
  healthInsurance?: string;
  healthInsuranceNumber?: string;
  insuranceInfo?: string;
  gender?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function PatientsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState("info");
  const [isImporting, setIsImporting] = useState(false);
  const [lastVisitFilter, setLastVisitFilter] = useState<string>("all");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  // Bulk actions state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPatientIds, setSelectedPatientIds] = useState<number[]>([]);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showBulkMessageDialog, setShowBulkMessageDialog] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");

  // Fetch patients
  const {
    data: patients,
    isLoading: isLoadingPatients,
    error,
  } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
    queryFn: async () => {
      const res = await fetch("/api/patients", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch patients");
      }
      return res.json();
    },
  });

  // Create patient mutation
  const createPatientMutation = useMutation({
    mutationFn: async (patientData: any) => {
      const res = await apiRequest("POST", "/api/patients", patientData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      toast({
        title: "Paciente adicionado",
        description: "O paciente foi adicionado com sucesso!",
      });
      setIsAddPatientOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao adicionar paciente",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update patient mutation
  const updatePatientMutation = useMutation({
    mutationFn: async (patientData: any) => {
      const res = await apiRequest(
        "PATCH",
        `/api/patients/${patientData.id}`,
        patientData
      );
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      toast({
        title: "Paciente atualizado",
        description: "O paciente foi atualizado com sucesso!",
      });
      setSelectedPatient(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar paciente",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (patientIds: number[]) => {
      // Delete patients one by one
      const results = await Promise.allSettled(
        patientIds.map(id => apiRequest("DELETE", `/api/patients/${id}`))
      );
      const successCount = results.filter(r => r.status === "fulfilled").length;
      return { successCount, total: patientIds.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      toast({
        title: "Pacientes excluídos",
        description: `${data.successCount} de ${data.total} pacientes foram excluídos.`,
      });
      setSelectedPatientIds([]);
      setSelectionMode(false);
      setShowBulkDeleteDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir pacientes",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle selection mode
  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectedPatientIds([]);
    }
    setSelectionMode(!selectionMode);
  };

  // Export selected patients
  const handleExportSelected = () => {
    if (selectedPatientIds.length === 0) return;

    const selectedData = patients?.filter(p => selectedPatientIds.includes(p.id)) || [];
    const dataToExport = selectedData.map(patient => ({
      Nome: patient.fullName,
      Email: patient.email || '',
      Telefone: patient.phone || '',
      CPF: (patient as any).cpf || '',
      DataNascimento: patient.birthDate ? new Date(patient.birthDate).toLocaleDateString('pt-BR') : '',
      Gênero: patient.gender === 'male' ? 'Masculino' : patient.gender === 'female' ? 'Feminino' : 'Outro',
      Endereço: patient.address || '',
      Convênio: patient.insuranceInfo || '',
      Observações: (patient as any).notes || ''
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `pacientes_selecionados_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Exportação concluída",
      description: `${selectedData.length} pacientes exportados.`,
    });
  };

  // Handle bulk message (simulated - integrate with your messaging system)
  const handleBulkMessage = () => {
    if (!bulkMessage.trim() || selectedPatientIds.length === 0) return;

    // Here you would integrate with WhatsApp/SMS API
    toast({
      title: "Mensagens enviadas",
      description: `Mensagem enviada para ${selectedPatientIds.length} pacientes.`,
    });
    setBulkMessage("");
    setShowBulkMessageDialog(false);
    setSelectedPatientIds([]);
    setSelectionMode(false);
  };

  // Função para verificar se um paciente não consulta há X meses
  const hasntVisitedForMonths = (patient: any, months: number) => {
    if (!patient.lastVisit) return false;
    
    const today = new Date();
    const lastVisitDate = new Date(patient.lastVisit);
    const limitDate = addMonths(today, -months);
    
    // Retorna true se a última visita foi antes da data limite
    return isBefore(lastVisitDate, limitDate);
  };

  // Aplica filtros: busca e tempo desde a última consulta
  const filteredPatients = patients
    ? patients.filter((patient) => {
        // Aplicar filtro de busca de texto
        const query = searchQuery.toLowerCase();
        const matchesSearchQuery = 
          patient.fullName.toLowerCase().includes(query) ||
          (patient.email && patient.email.toLowerCase().includes(query)) ||
          (patient.phone && patient.phone.includes(searchQuery));
        
        // Aplicar filtro de última consulta
        let matchesLastVisitFilter = true;
        if (lastVisitFilter !== "all") {
          if (lastVisitFilter === "month-1") matchesLastVisitFilter = hasntVisitedForMonths(patient, 1);
          else if (lastVisitFilter === "month-3") matchesLastVisitFilter = hasntVisitedForMonths(patient, 3);
          else if (lastVisitFilter === "month-6") matchesLastVisitFilter = hasntVisitedForMonths(patient, 6);
          else if (lastVisitFilter === "year-1") matchesLastVisitFilter = hasntVisitedForMonths(patient, 12);
        }
        
        return matchesSearchQuery && matchesLastVisitFilter;
      })
    : [];

  const handleAddPatient = (patientData: any) => {
    createPatientMutation.mutate(patientData);
  };

  const handleUpdatePatient = (patientData: any) => {
    updatePatientMutation.mutate({
      id: selectedPatient?.id,
      ...patientData,
    });
  };

  const handlePatientClick = (patient: any) => {
    setSelectedPatient(patient);
  };

  const closePatientDialog = () => {
    setSelectedPatient(null);
    setActiveTab("info");
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setShowSuggestions(e.target.value.length > 0);
    setSelectedSuggestionIndex(-1);
  };

  // Gerar sugestões filtradas
  const suggestions = patients?.filter(patient => {
    const query = searchQuery.toLowerCase();
    return searchQuery.length > 0 && (
      patient.fullName.toLowerCase().includes(query) ||
      (patient.email && patient.email.toLowerCase().includes(query)) ||
      (patient.phone && patient.phone.includes(searchQuery))
    );
  }).slice(0, 8) || [];

  // Função para selecionar sugestão
  const selectSuggestion = (patient: any) => {
    setSearchQuery(patient.fullName);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  };

  // Função para lidar com teclas de navegação
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0) {
          selectSuggestion(suggestions[selectedSuggestionIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

  // Função para obter label do filtro
  const getFilterLabel = (filter: string) => {
    switch (filter) {
      case "all": return "Todos";
      case "month-1": return "+1 mês";
      case "month-3": return "+3 meses";
      case "month-6": return "+6 meses";
      case "year-1": return "+1 ano";
      default: return "Todos";
    }
  };
  
  // Exportar pacientes para arquivo CSV
  const handleExportPatients = () => {
    if (!patients || patients.length === 0) {
      toast({
        title: "Nenhum paciente para exportar",
        description: "Não há pacientes cadastrados no sistema.",
        variant: "destructive",
      });
      return;
    }

    // Preparar dados para exportação
    const dataToExport = patients.map(patient => ({
      Nome: patient.fullName,
      Email: patient.email || '',
      Telefone: patient.phone || '',
      CPF: (patient as any).cpf || '',
      DataNascimento: patient.birthDate ? new Date(patient.birthDate).toLocaleDateString('pt-BR') : '',
      Gênero: patient.gender === 'male' ? 'Masculino' : patient.gender === 'female' ? 'Feminino' : 'Outro',
      Endereço: patient.address || '',
      Convênio: patient.insuranceInfo || '',
      Observações: (patient as any).notes || ''
    }));

    // Converter para CSV
    const csv = Papa.unparse(dataToExport);
    
    // Criar blob e link para download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `pacientes_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Exportação concluída",
      description: `${patients.length} pacientes exportados com sucesso.`,
    });
  };

  // Importar pacientes de arquivo CSV
  const handleImportPatients = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          if (results.errors.length > 0) {
            throw new Error(`Erro ao processar arquivo: ${results.errors[0].message}`);
          }

          // Mapeamento entre nomes de colunas esperados e propriedades do objeto
          const fieldMap: Record<string, string> = {
            'Nome': 'fullName',
            'Email': 'email',
            'Telefone': 'phone',
            'CPF': 'cpf',
            'DataNascimento': 'birthDate',
            'Gênero': 'gender',
            'Endereço': 'address',
            'Convênio': 'insuranceInfo',
            'Observações': 'notes'
          };

          // Array para receber os pacientes importados
          const importedPatients = [];
          let successCount = 0;
          
          // Processar cada linha e criar objeto paciente
          for (const row of results.data as Record<string, string>[]) {
            const patient: Record<string, any> = {};
            
            // Mapear campos do CSV para as propriedades do paciente
            for (const [csvField, dbField] of Object.entries(fieldMap)) {
              if (row[csvField] !== undefined) {
                patient[dbField] = row[csvField];
              }
            }
            
            // Validar campos obrigatórios
            if (!patient.fullName) {
              continue; // Pula pacientes sem nome
            }
            
            // Converter gênero
            if (patient.gender) {
              if (patient.gender.toLowerCase() === 'masculino') {
                patient.gender = 'male';
              } else if (patient.gender.toLowerCase() === 'feminino') {
                patient.gender = 'female';
              } else {
                patient.gender = 'other';
              }
            }
            
            // Converter data de nascimento se necessário
            if (patient.birthDate) {
              try {
                // Verificar se está no formato brasileiro
                if (patient.birthDate.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                  const [day, month, year] = patient.birthDate.split('/');
                  patient.birthDate = new Date(`${year}-${month}-${day}`).toISOString();
                } else {
                  // Tentar converter diretamente
                  patient.birthDate = new Date(patient.birthDate).toISOString();
                }
              } catch (error) {
                delete patient.birthDate; // Remove data inválida
              }
            }
            
            importedPatients.push(patient);
          }
          
          // Importar pacientes sequencialmente
          for (const patient of importedPatients) {
            try {
              await apiRequest('POST', '/api/patients', patient);
              successCount++;
            } catch (error) {
              console.error('Erro ao importar paciente:', patient, error);
            }
          }
          
          // Atualizar lista de pacientes
          queryClient.invalidateQueries({queryKey: ['/api/patients']});
          
          toast({
            title: "Importação concluída",
            description: `${successCount} de ${importedPatients.length} pacientes importados com sucesso.`,
          });
        } catch (error) {
          toast({
            title: "Erro na importação",
            description: error instanceof Error ? error.message : "Erro desconhecido ao importar pacientes",
            variant: "destructive",
          });
        } finally {
          setIsImporting(false);
          e.target.value = ''; // Limpar input para permitir importar o mesmo arquivo novamente
        }
      },
      error: (error) => {
        setIsImporting(false);
        toast({
          title: "Erro na importação",
          description: `Não foi possível processar o arquivo: ${error.message}`,
          variant: "destructive",
        });
        e.target.value = '';
      }
    });
  };

  return (
    <DashboardLayout title="Pacientes" currentPath="/patients">
      <div className="mb-4 sm:mb-6 flex flex-col gap-4">
        <div className="relative w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-medium" />
          <Input
            placeholder="Buscar paciente por nome, email ou telefone"
            className="pl-9"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(searchQuery.length > 0)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          />
          
          {/* Search Suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-card border border-border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
              {suggestions.map((patient, index) => (
                <div
                  key={patient.id}
                  className={`px-4 py-2 cursor-pointer hover:bg-muted border-b border-border last:border-b-0 ${
                    index === selectedSuggestionIndex ? 'bg-primary/10' : ''
                  }`}
                  onClick={() => selectSuggestion(patient)}
                >
                  <div className="font-medium text-sm">{patient.fullName}</div>
                  <div className="text-xs text-muted-foreground">
                    {patient.email && <span>{patient.email}</span>}
                    {patient.email && patient.phone && <span> • </span>}
                    {patient.phone && <span>{patient.phone}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 flex-1 sm:flex-none">
                <span className="text-xs sm:text-sm font-medium mr-2">Última consulta:</span>
                <span className="text-xs sm:text-sm">{getFilterLabel(lastVisitFilter)}</span>
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem 
                onClick={() => setLastVisitFilter("all")}
                className={lastVisitFilter === "all" ? "bg-accent" : ""}
              >
                <span className="flex-1">Todos</span>
                {lastVisitFilter === "all" && (
                  <div className="w-2 h-2 bg-primary rounded-full ml-2" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setLastVisitFilter("month-1")}
                className={lastVisitFilter === "month-1" ? "bg-accent" : ""}
              >
                <span className="flex-1">+1 mês sem consulta</span>
                {lastVisitFilter === "month-1" && (
                  <div className="w-2 h-2 bg-primary rounded-full ml-2" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setLastVisitFilter("month-3")}
                className={lastVisitFilter === "month-3" ? "bg-accent" : ""}
              >
                <span className="flex-1">+3 meses sem consulta</span>
                {lastVisitFilter === "month-3" && (
                  <div className="w-2 h-2 bg-primary rounded-full ml-2" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setLastVisitFilter("month-6")}
                className={lastVisitFilter === "month-6" ? "bg-accent" : ""}
              >
                <span className="flex-1">+6 meses sem consulta</span>
                {lastVisitFilter === "month-6" && (
                  <div className="w-2 h-2 bg-primary rounded-full ml-2" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setLastVisitFilter("year-1")}
                className={lastVisitFilter === "year-1" ? "bg-accent" : ""}
              >
                <span className="flex-1">+1 ano sem consulta</span>
                {lastVisitFilter === "year-1" && (
                  <div className="w-2 h-2 bg-primary rounded-full ml-2" />
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectionMode ? "default" : "outline"}
            onClick={toggleSelectionMode}
            size="sm"
            className="flex-1 sm:flex-none"
          >
            <CheckSquare className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">{selectionMode ? "Cancelar Seleção" : "Selecionar"}</span>
            <span className="sm:hidden">{selectionMode ? "Cancelar" : "Selecionar"}</span>
          </Button>
          <Button variant="outline" onClick={handleExportPatients} size="sm" className="flex-1 sm:flex-none">
            <span className="hidden sm:inline">Exportar Pacientes</span>
            <span className="sm:hidden">Exportar</span>
          </Button>
          <label htmlFor="import-patients" className="cursor-pointer flex-1 sm:flex-none">
            <Button variant="outline" asChild size="sm" className="w-full">
              <span>
                <span className="hidden sm:inline">Importar Pacientes</span>
                <span className="sm:hidden">Importar</span>
              </span>
            </Button>
            <input
              type="file"
              id="import-patients"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleImportPatients}
            />
          </label>
          <Link href="/pacientes/digitalizar">
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none w-full">
              <Scan className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Digitalizar Prontuários</span>
              <span className="sm:hidden">Digitalizar</span>
            </Button>
          </Link>
          <Button className="bg-primary text-white flex-1 sm:flex-none" onClick={() => setIsAddPatientOpen(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Novo Paciente</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>

        {/* Bulk Actions Bar */}
        {selectionMode && selectedPatientIds.length > 0 && (
          <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="font-medium text-sm">
                  {selectedPatientIds.length} paciente{selectedPatientIds.length !== 1 ? "s" : ""} selecionado{selectedPatientIds.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportSelected}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Exportar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkMessageDialog(true)}
                  className="gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  Enviar Mensagem
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {isLoadingPatients ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center text-red-500 p-4">
          Erro ao carregar pacientes. Tente novamente.
        </div>
      ) : (
        <PatientsList
          patients={filteredPatients}
          onPatientClick={handlePatientClick}
          selectedPatients={selectedPatientIds}
          onSelectionChange={setSelectedPatientIds}
          selectionMode={selectionMode}
        />
      )}

      {/* Add Patient Dialog */}
      <Dialog open={isAddPatientOpen} onOpenChange={setIsAddPatientOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Novo Paciente</DialogTitle>
          </DialogHeader>
          <PatientForm onSubmit={handleAddPatient} />
        </DialogContent>
      </Dialog>

      {/* Patient Details Dialog */}
      <Dialog open={!!selectedPatient} onOpenChange={closePatientDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Detalhes do Paciente</DialogTitle>
          </DialogHeader>

          {selectedPatient && (
            <Tabs defaultValue="info" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-2 sm:grid-cols-4 mb-6">
                <TabsTrigger value="info">Informações</TabsTrigger>
                <TabsTrigger value="records">Prontuário</TabsTrigger>
                <TabsTrigger value="odontogram">Odontograma</TabsTrigger>
                <TabsTrigger value="appointments">Consultas</TabsTrigger>
              </TabsList>
              
              <TabsContent value="info">
                <div className="mb-6">
                  <h3 className="text-xl font-semibold mb-4">{selectedPatient.fullName}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center">
                      <Phone className="h-5 w-5 text-neutral-medium mr-2" />
                      <span>{selectedPatient.phone}</span>
                    </div>
                    <div className="flex items-center">
                      <Mail className="h-5 w-5 text-neutral-medium mr-2" />
                      <span>{selectedPatient.email}</span>
                    </div>
                    <div className="flex items-center">
                      <Calendar className="h-5 w-5 text-neutral-medium mr-2" />
                      <span>
                        {new Date(selectedPatient.birthDate).toLocaleDateString('pt-BR')}
                        {" "}
                        ({new Date().getFullYear() - new Date(selectedPatient.birthDate).getFullYear()} anos)
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Endereço</h4>
                    <p className="text-neutral-dark">{selectedPatient.address}</p>
                  </div>
                  
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Convênio</h4>
                    <p className="text-neutral-dark">{selectedPatient.insuranceInfo || "Não possui"}</p>
                  </div>
                  
                  <div className="mt-6 flex justify-end">
                    <Button variant="outline" onClick={() => setActiveTab("edit")}>
                      <Edit className="mr-2 h-4 w-4" />
                      Editar Informações
                    </Button>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="records">
                <PatientRecordTab patientId={selectedPatient.id} />
              </TabsContent>
              
              <TabsContent value="odontogram">
                <OdontogramChart patientId={selectedPatient.id} />
              </TabsContent>
              
              <TabsContent value="appointments">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium mb-2">Histórico de Consultas</h3>
                  
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Profissional</TableHead>
                          <TableHead>Procedimento</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>10/08/2023 - 08:00</TableCell>
                          <TableCell>Dr. Carlos Mendes</TableCell>
                          <TableCell>Consulta inicial</TableCell>
                          <TableCell>
                            <span className="px-2 py-1 bg-status-confirmed bg-opacity-20 text-status-confirmed rounded text-xs">
                              Confirmado
                            </span>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>20/07/2023 - 14:30</TableCell>
                          <TableCell>Dr. Ana Silva</TableCell>
                          <TableCell>Limpeza</TableCell>
                          <TableCell>
                            <span className="px-2 py-1 bg-indigo-600 bg-opacity-20 text-indigo-600 rounded text-xs">
                              Concluído
                            </span>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>05/06/2023 - 09:15</TableCell>
                          <TableCell>Dr. Juliana Costa</TableCell>
                          <TableCell>Avaliação de dor</TableCell>
                          <TableCell>
                            <span className="px-2 py-1 bg-indigo-600 bg-opacity-20 text-indigo-600 rounded text-xs">
                              Concluído
                            </span>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Nova Consulta
                    </Button>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="edit">
                <PatientForm
                  initialData={selectedPatient}
                  onSubmit={handleUpdatePatient}
                  isEditing={true}
                />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão em lote</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedPatientIds.length} paciente{selectedPatientIds.length !== 1 ? "s" : ""}?
              Esta ação não pode ser desfeita e todos os dados relacionados serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(selectedPatientIds)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir Pacientes"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Message Dialog */}
      <Dialog open={showBulkMessageDialog} onOpenChange={setShowBulkMessageDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar mensagem em lote</DialogTitle>
            <DialogDescription>
              Enviar mensagem para {selectedPatientIds.length} paciente{selectedPatientIds.length !== 1 ? "s" : ""} selecionado{selectedPatientIds.length !== 1 ? "s" : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="bulk-message" className="text-sm font-medium">
                Mensagem
              </label>
              <textarea
                id="bulk-message"
                className="w-full min-h-[120px] p-3 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Digite a mensagem que será enviada..."
                value={bulkMessage}
                onChange={(e) => setBulkMessage(e.target.value)}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              A mensagem será enviada via WhatsApp para todos os pacientes selecionados que possuem telefone cadastrado.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkMessageDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleBulkMessage} disabled={!bulkMessage.trim()}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Enviar para {selectedPatientIds.length} paciente{selectedPatientIds.length !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
