import { useState } from "react";
import { addMonths, isBefore, parseISO, differenceInMonths, format } from "date-fns";
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
import { Search, Plus, Phone, Mail, Calendar, Edit, FileText, Download, Upload, AlertCircle } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import PatientForm from "@/components/patients/PatientForm";
import PatientsList from "@/components/patients/PatientsList";
import PatientRecordTab from "@/components/patients/PatientRecordTab";
import OdontogramChart from "@/components/odontogram/OdontogramChart";
import Papa from "papaparse";

export default function PatientsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState("info");
  const [isImporting, setIsImporting] = useState(false);
  const [lastVisitFilter, setLastVisitFilter] = useState<string>("all");

  // Fetch patients
  const {
    data: patients,
    isLoading: isLoadingPatients,
    error,
  } = useQuery({
    queryKey: ["/api/patients"],
    queryFn: async () => {
      // Dados de pacientes com informações de última consulta
      const today = new Date();
      return [
        {
          id: 1,
          fullName: "Ricardo Almeida",
          email: "ricardo@example.com",
          phone: "11987654321",
          birthDate: "1985-05-15T00:00:00Z",
          gender: "male",
          address: "Rua das Flores, 123 - São Paulo/SP",
          insuranceInfo: "Amil Dental - Plano Premium",
          createdAt: "2023-01-10T10:00:00Z",
          lastVisit: format(addMonths(today, -2), "yyyy-MM-dd'T'HH:mm:ss'Z'"), // 2 meses atrás
        },
        {
          id: 2,
          fullName: "Mariana Santos",
          email: "mariana@example.com",
          phone: "11976543210",
          birthDate: "1990-02-20T00:00:00Z",
          gender: "female",
          address: "Av. Paulista, 1000 - São Paulo/SP",
          insuranceInfo: "",
          createdAt: "2023-01-15T14:30:00Z",
          lastVisit: format(addMonths(today, -13), "yyyy-MM-dd'T'HH:mm:ss'Z'"), // 13 meses atrás (mais de 1 ano)
        },
        {
          id: 3,
          fullName: "Pedro Oliveira",
          email: "pedro@example.com",
          phone: "11965432109",
          birthDate: "1978-11-08T00:00:00Z",
          gender: "male",
          address: "Rua Augusta, 500 - São Paulo/SP",
          insuranceInfo: "Bradesco Saúde - Plano Standard",
          createdAt: "2023-02-05T09:15:00Z",
          lastVisit: format(addMonths(today, -8), "yyyy-MM-dd'T'HH:mm:ss'Z'"), // 8 meses atrás
        },
        {
          id: 4,
          fullName: "Sofia Martins",
          email: "sofia@example.com",
          phone: "11954321098",
          birthDate: "2001-07-30T00:00:00Z",
          gender: "female",
          address: "Alameda Santos, 200 - São Paulo/SP",
          insuranceInfo: "SulAmérica Odonto - Plano Básico",
          createdAt: "2023-02-20T16:45:00Z",
          lastVisit: format(addMonths(today, -4), "yyyy-MM-dd'T'HH:mm:ss'Z'"), // 4 meses atrás
        },
        {
          id: 5,
          fullName: "Lucas Ferreira",
          email: "lucas@example.com",
          phone: "11943210987",
          birthDate: "1995-09-12T00:00:00Z",
          gender: "male",
          address: "Rua Oscar Freire, 300 - São Paulo/SP",
          insuranceInfo: "",
          createdAt: "2023-03-08T11:30:00Z",
          lastVisit: format(addMonths(today, -0.5), "yyyy-MM-dd'T'HH:mm:ss'Z'"), // 15 dias atrás
        },
        {
          id: 6,
          fullName: "Ana Costa",
          email: "ana.costa@example.com",
          phone: "11987123456",
          birthDate: "1982-04-12T00:00:00Z",
          gender: "female",
          address: "Rua Augusta, 500 - São Paulo/SP",
          insuranceInfo: "Bradesco Dental - Plano Premium",
          createdAt: "2023-03-05T09:15:00Z",
          lastVisit: format(addMonths(today, -5), "yyyy-MM-dd'T'HH:mm:ss'Z'"), // 5 meses atrás
        },
        {
          id: 4,
          fullName: "Sofia Martins",
          email: "sofia@example.com",
          phone: "11954321098",
          birthDate: "1995-04-18T00:00:00Z",
          gender: "female",
          address: "Rua Oscar Freire, 200 - São Paulo/SP",
          insuranceInfo: "Não possui",
          createdAt: "2023-03-20T16:45:00Z",
        },
        {
          id: 5,
          fullName: "Lucas Ferreira",
          email: "lucas@example.com",
          phone: "11943210987",
          birthDate: "1982-09-30T00:00:00Z",
          gender: "male",
          address: "Av. Brigadeiro Faria Lima, 3000 - São Paulo/SP",
          insuranceInfo: "Porto Seguro Odonto - Plano Master",
          createdAt: "2023-04-12T11:20:00Z",
        },
      ];
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
      CPF: patient.cpf || '',
      DataNascimento: patient.birthDate ? new Date(patient.birthDate).toLocaleDateString('pt-BR') : '',
      Gênero: patient.gender === 'male' ? 'Masculino' : patient.gender === 'female' ? 'Feminino' : 'Outro',
      Endereço: patient.address || '',
      Convênio: patient.insuranceInfo || '',
      Observações: patient.notes || ''
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
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-medium" />
          <Input
            placeholder="Buscar paciente por nome, email ou telefone"
            className="pl-9"
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center bg-muted/40 rounded-md">
            <div className="px-3 py-1.5 text-sm font-medium">Última consulta:</div>
            <Button 
              variant={lastVisitFilter === "all" ? "default" : "ghost"} 
              size="sm" 
              onClick={() => setLastVisitFilter("all")} 
              className="rounded-none h-8"
            >
              Todos
            </Button>
            <Button 
              variant={lastVisitFilter === "month-1" ? "default" : "ghost"} 
              size="sm" 
              onClick={() => setLastVisitFilter("month-1")} 
              className="rounded-none h-8"
            >
              +1 mês
            </Button>
            <Button 
              variant={lastVisitFilter === "month-3" ? "default" : "ghost"} 
              size="sm" 
              onClick={() => setLastVisitFilter("month-3")} 
              className="rounded-none h-8"
            >
              +3 meses
            </Button>
            <Button 
              variant={lastVisitFilter === "month-6" ? "default" : "ghost"} 
              size="sm" 
              onClick={() => setLastVisitFilter("month-6")} 
              className="rounded-none h-8"
            >
              +6 meses
            </Button>
            <Button 
              variant={lastVisitFilter === "year-1" ? "default" : "ghost"} 
              size="sm" 
              onClick={() => setLastVisitFilter("year-1")} 
              className="rounded-none h-8"
            >
              +1 ano
            </Button>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportPatients}>
            Exportar Pacientes
          </Button>
          <label htmlFor="import-patients" className="cursor-pointer">
            <Button variant="outline" asChild>
              <span>Importar Pacientes</span>
            </Button>
            <input
              type="file"
              id="import-patients"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleImportPatients}
            />
          </label>
          <Button className="bg-primary text-white" onClick={() => setIsAddPatientOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Paciente
          </Button>
        </div>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Paciente</DialogTitle>
          </DialogHeader>
          
          {selectedPatient && (
            <Tabs defaultValue="info" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-4 mb-6">
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
    </DashboardLayout>
  );
}
