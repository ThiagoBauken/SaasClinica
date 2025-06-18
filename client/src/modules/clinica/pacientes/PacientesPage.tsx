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

export default function PacientesPage() {
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
    error: patientsError,
  } = useQuery({
    queryKey: ["/api/patients"],
  });

  // Create patient mutation
  const createPatientMutation = useMutation({
    mutationFn: (newPatient: any) => apiRequest("/api/patients", "POST", newPatient),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      setIsAddPatientOpen(false);
      toast({
        title: "Sucesso",
        description: "Paciente adicionado com sucesso!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao adicionar paciente",
        variant: "destructive",
      });
    },
  });

  // Export patients to CSV
  const exportPatients = () => {
    if (!patients || patients.length === 0) {
      toast({
        title: "Aviso",
        description: "Não há pacientes para exportar",
        variant: "destructive",
      });
      return;
    }

    const csvData = patients.map((patient: any) => ({
      Nome: patient.name,
      Email: patient.email,
      Telefone: patient.phone,
      CPF: patient.cpf,
      "Data de Nascimento": patient.dateOfBirth,
      Endereço: patient.address,
      "Data de Cadastro": format(new Date(patient.createdAt), "dd/MM/yyyy"),
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `pacientes_${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Sucesso",
      description: "Lista de pacientes exportada com sucesso!",
    });
  };

  // Import patients from CSV
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        try {
          const patients = results.data;
          
          for (const patient of patients as any[]) {
            if (patient.Nome && patient.Email) {
              await createPatientMutation.mutateAsync({
                name: patient.Nome,
                email: patient.Email,
                phone: patient.Telefone || "",
                cpf: patient.CPF || "",
                dateOfBirth: patient["Data de Nascimento"] || "",
                address: patient.Endereço || "",
              });
            }
          }

          toast({
            title: "Sucesso",
            description: `${patients.length} pacientes importados com sucesso!`,
          });
        } catch (error) {
          toast({
            title: "Erro",
            description: "Erro ao importar pacientes",
            variant: "destructive",
          });
        } finally {
          setIsImporting(false);
          event.target.value = "";
        }
      },
      error: () => {
        setIsImporting(false);
        toast({
          title: "Erro",
          description: "Erro ao processar arquivo CSV",
          variant: "destructive",
        });
      },
    });
  };

  // Filter patients based on search and last visit
  const filteredPatients = patients?.filter((patient: any) => {
    const matchesSearch = patient.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         patient.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         patient.phone?.includes(searchQuery);

    if (lastVisitFilter === "all") return matchesSearch;

    const lastVisit = patient.lastVisit ? parseISO(patient.lastVisit) : null;
    const now = new Date();

    switch (lastVisitFilter) {
      case "recent":
        return matchesSearch && lastVisit && differenceInMonths(now, lastVisit) <= 3;
      case "old":
        return matchesSearch && lastVisit && differenceInMonths(now, lastVisit) > 6;
      case "never":
        return matchesSearch && !lastVisit;
      default:
        return matchesSearch;
    }
  }) || [];

  if (patientsError) {
    return (
      <DashboardLayout title="Pacientes" currentPath="/patients">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Erro ao carregar pacientes</h3>
            <p className="text-gray-600">Não foi possível carregar a lista de pacientes. Tente novamente.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Pacientes" currentPath="/patients">
      <div className="space-y-6">
        {/* Header with actions */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar pacientes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <select
              value={lastVisitFilter}
              onChange={(e) => setLastVisitFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">Todos os pacientes</option>
              <option value="recent">Última visita: até 3 meses</option>
              <option value="old">Última visita: mais de 6 meses</option>
              <option value="never">Nunca visitaram</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={exportPatients} disabled={!patients?.length}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            
            <div className="relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileImport}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                id="csv-import"
                disabled={isImporting}
              />
              <Button variant="outline" asChild disabled={isImporting}>
                <label htmlFor="csv-import" className="cursor-pointer">
                  {isImporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Importar CSV
                </label>
              </Button>
            </div>

            <Dialog open={isAddPatientOpen} onOpenChange={setIsAddPatientOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Paciente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Adicionar Novo Paciente</DialogTitle>
                </DialogHeader>
                <PatientForm 
                  onSubmit={(data) => createPatientMutation.mutate(data)}
                  isLoading={createPatientMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Patients list */}
        {isLoadingPatients ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <PatientsList 
            patients={filteredPatients}
            onPatientSelect={setSelectedPatient}
          />
        )}

        {/* Patient details dialog */}
        <Dialog open={!!selectedPatient} onOpenChange={() => setSelectedPatient(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <span>{selectedPatient?.name}</span>
                <Button variant="ghost" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>
            
            {selectedPatient && (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="info">Informações</TabsTrigger>
                  <TabsTrigger value="history">Histórico</TabsTrigger>
                  <TabsTrigger value="odontogram">Odontograma</TabsTrigger>
                  <TabsTrigger value="documents">Documentos</TabsTrigger>
                </TabsList>
                
                <TabsContent value="info" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Email</label>
                      <div className="flex items-center space-x-2 mt-1">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span>{selectedPatient.email}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Telefone</label>
                      <div className="flex items-center space-x-2 mt-1">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span>{selectedPatient.phone}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Data de Nascimento</label>
                      <div className="flex items-center space-x-2 mt-1">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span>{selectedPatient.dateOfBirth}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">CPF</label>
                      <span className="block mt-1">{selectedPatient.cpf}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Endereço</label>
                    <span className="block mt-1">{selectedPatient.address}</span>
                  </div>
                </TabsContent>
                
                <TabsContent value="history">
                  <PatientRecordTab patientId={selectedPatient.id} />
                </TabsContent>
                
                <TabsContent value="odontogram">
                  <OdontogramChart patientId={selectedPatient.id} />
                </TabsContent>
                
                <TabsContent value="documents">
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Funcionalidade de documentos em desenvolvimento</p>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}