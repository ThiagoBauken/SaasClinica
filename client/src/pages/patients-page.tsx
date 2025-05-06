import { useState } from "react";
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
import { Search, Plus, Phone, Mail, Calendar, Edit, FileText } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import PatientForm from "@/components/patients/PatientForm";
import PatientsList from "@/components/patients/PatientsList";
import PatientRecordTab from "@/components/patients/PatientRecordTab";
import OdontogramChart from "@/components/odontogram/OdontogramChart";

export default function PatientsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState("info");

  // Fetch patients
  const {
    data: patients,
    isLoading: isLoadingPatients,
    error,
  } = useQuery({
    queryKey: ["/api/patients"],
    queryFn: async () => {
      // For demonstration, we're returning mock data
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
        },
        {
          id: 2,
          fullName: "Mariana Santos",
          email: "mariana@example.com",
          phone: "11976543210",
          birthDate: "1990-08-22T00:00:00Z",
          gender: "female",
          address: "Av. Paulista, 1000 - São Paulo/SP",
          insuranceInfo: "Odonto Empresas - Plano Básico",
          createdAt: "2023-02-15T14:30:00Z",
        },
        {
          id: 3,
          fullName: "Pedro Oliveira",
          email: "pedro@example.com",
          phone: "11965432109",
          birthDate: "1978-11-07T00:00:00Z",
          gender: "male",
          address: "Rua Augusta, 500 - São Paulo/SP",
          insuranceInfo: "Bradesco Dental - Plano Premium",
          createdAt: "2023-03-05T09:15:00Z",
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

  // Filter patients based on search query
  const filteredPatients = patients
    ? patients.filter((patient) =>
        patient.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.phone.includes(searchQuery)
      )
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
        <Button className="bg-primary text-white" onClick={() => setIsAddPatientOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Paciente
        </Button>
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
