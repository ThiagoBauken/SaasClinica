import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FileText,
  Plus,
  Clipboard,
  Activity,
  Pill,
  FileImage,
  Loader2,
  User,
  Calendar,
} from "lucide-react";
import { format, formatDistance } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PatientRecordTabProps {
  patientId: number;
}

interface PatientRecord {
  id: number;
  patientId: number;
  recordType: string;
  content: {
    title: string;
    description?: string;
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt?: string;
  professionalId?: number;
  createdByName?: string;
}

export default function PatientRecordTab({ patientId }: PatientRecordTabProps) {
  const { toast } = useToast();
  const [isAddRecordOpen, setIsAddRecordOpen] = useState(false);
  const [newRecord, setNewRecord] = useState<{
    recordType: string;
    content: any;
  }>({
    recordType: "evolution",
    content: {
      title: "",
      description: "",
      prescriptions: [],
    },
  });

  // Fetch patient records
  const {
    data: records,
    isLoading,
    error,
  } = useQuery<PatientRecord[]>({
    queryKey: ["/api/patients", patientId, "records"],
    queryFn: async () => {
      const res = await fetch(`/api/patients/${patientId}/records`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch patient records");
      }
      return res.json();
    },
  });

  // Create record mutation
  const createRecordMutation = useMutation({
    mutationFn: async (recordData: any) => {
      const res = await apiRequest(
        "POST",
        `/api/patients/${patientId}/records`,
        recordData
      );
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/patients", patientId, "records"],
      });
      toast({
        title: "Registro adicionado",
        description: "O registro foi adicionado com sucesso ao prontuário!",
      });
      setIsAddRecordOpen(false);
      resetNewRecordForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao adicionar registro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetNewRecordForm = () => {
    setNewRecord({
      recordType: "evolution",
      content: {
        title: "",
        description: "",
        prescriptions: [],
      },
    });
  };

  const handleInputChange = (field: string, value: string) => {
    if (field.includes(".")) {
      const [parent, child] = field.split(".");
      setNewRecord((prev) => ({
        ...prev,
        [parent]: {
          ...(typeof prev[parent as keyof typeof prev] === 'object' ? prev[parent as keyof typeof prev] : {}),
          [child]: value,
        },
      }));
    } else {
      setNewRecord((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  const handleRecordTypeChange = (value: string) => {
    setNewRecord((prev) => {
      let content = {};
      
      switch (value) {
        case "anamnesis":
          content = {
            title: "Anamnese",
            allergies: "",
            medicalHistory: "",
            currentMedications: "",
            familyHistory: "",
          };
          break;
        case "evolution":
          content = {
            title: "",
            description: "",
          };
          break;
        case "prescription":
          content = {
            title: "Prescrição",
            medication: "",
            dosage: "",
            duration: "",
          };
          break;
        case "exam":
          content = {
            title: "Resultado de Exame",
            examType: "",
            result: "",
            comments: "",
          };
          break;
        default:
          content = {
            title: "",
            description: "",
          };
      }
      
      return {
        ...prev,
        recordType: value,
        content,
      };
    });
  };

  const handleCreateRecord = () => {
    createRecordMutation.mutate(newRecord);
  };

  const getRecordTypeIcon = (type: string) => {
    switch (type) {
      case "anamnesis":
        return <Clipboard className="h-4 w-4 mr-2" />;
      case "evolution":
        return <Activity className="h-4 w-4 mr-2" />;
      case "prescription":
        return <Pill className="h-4 w-4 mr-2" />;
      case "exam":
        return <FileImage className="h-4 w-4 mr-2" />;
      default:
        return <FileText className="h-4 w-4 mr-2" />;
    }
  };

  const getRecordTypeName = (type: string) => {
    switch (type) {
      case "anamnesis":
        return "Anamnese";
      case "evolution":
        return "Evolução";
      case "prescription":
        return "Prescrição";
      case "exam":
        return "Exame";
      case "document":
        return "Documento";
      default:
        return type;
    }
  };

  const renderRecordContent = (record: any) => {
    const content = record.content;
    
    switch (record.recordType) {
      case "anamnesis":
        return (
          <div className="space-y-2">
            {content.allergies && (
              <div>
                <h4 className="text-sm font-medium">Alergias:</h4>
                <p className="text-sm">{content.allergies}</p>
              </div>
            )}
            {content.medicalHistory && (
              <div>
                <h4 className="text-sm font-medium">Histórico Médico:</h4>
                <p className="text-sm">{content.medicalHistory}</p>
              </div>
            )}
            {content.currentMedications && (
              <div>
                <h4 className="text-sm font-medium">Medicações Atuais:</h4>
                <p className="text-sm">{content.currentMedications}</p>
              </div>
            )}
            {content.familyHistory && (
              <div>
                <h4 className="text-sm font-medium">Histórico Familiar:</h4>
                <p className="text-sm">{content.familyHistory}</p>
              </div>
            )}
          </div>
        );
      case "evolution":
        return (
          <div>
            <p className="text-sm whitespace-pre-line">{content.description}</p>
          </div>
        );
      case "prescription":
        return (
          <div className="space-y-2">
            {content.medication && (
              <div>
                <h4 className="text-sm font-medium">Medicamento:</h4>
                <p className="text-sm">{content.medication}</p>
              </div>
            )}
            {content.dosage && (
              <div>
                <h4 className="text-sm font-medium">Posologia:</h4>
                <p className="text-sm">{content.dosage}</p>
              </div>
            )}
            {content.duration && (
              <div>
                <h4 className="text-sm font-medium">Duração:</h4>
                <p className="text-sm">{content.duration}</p>
              </div>
            )}
          </div>
        );
      case "exam":
        return (
          <div className="space-y-2">
            {content.examType && (
              <div>
                <h4 className="text-sm font-medium">Tipo de Exame:</h4>
                <p className="text-sm">{content.examType}</p>
              </div>
            )}
            {content.result && (
              <div>
                <h4 className="text-sm font-medium">Resultado:</h4>
                <p className="text-sm">{content.result}</p>
              </div>
            )}
            {content.comments && (
              <div>
                <h4 className="text-sm font-medium">Observações:</h4>
                <p className="text-sm">{content.comments}</p>
              </div>
            )}
          </div>
        );
      default:
        return (
          <div>
            <p className="text-sm">{JSON.stringify(content)}</p>
          </div>
        );
    }
  };

  const renderNewRecordForm = () => {
    switch (newRecord.recordType) {
      case "anamnesis":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={newRecord.content.title}
                onChange={(e) => handleInputChange("content.title", e.target.value)}
                placeholder="Título da anamnese"
              />
            </div>
            <div>
              <Label htmlFor="allergies">Alergias</Label>
              <Textarea
                id="allergies"
                value={newRecord.content.allergies || ""}
                onChange={(e) => handleInputChange("content.allergies", e.target.value)}
                placeholder="Liste as alergias do paciente"
              />
            </div>
            <div>
              <Label htmlFor="medicalHistory">Histórico Médico</Label>
              <Textarea
                id="medicalHistory"
                value={newRecord.content.medicalHistory || ""}
                onChange={(e) => handleInputChange("content.medicalHistory", e.target.value)}
                placeholder="Histórico médico do paciente"
              />
            </div>
            <div>
              <Label htmlFor="currentMedications">Medicações Atuais</Label>
              <Textarea
                id="currentMedications"
                value={newRecord.content.currentMedications || ""}
                onChange={(e) => handleInputChange("content.currentMedications", e.target.value)}
                placeholder="Medicamentos em uso"
              />
            </div>
            <div>
              <Label htmlFor="familyHistory">Histórico Familiar</Label>
              <Textarea
                id="familyHistory"
                value={newRecord.content.familyHistory || ""}
                onChange={(e) => handleInputChange("content.familyHistory", e.target.value)}
                placeholder="Histórico de doenças na família"
              />
            </div>
          </div>
        );
      case "evolution":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={newRecord.content.title}
                onChange={(e) => handleInputChange("content.title", e.target.value)}
                placeholder="Título da evolução"
              />
            </div>
            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={newRecord.content.description || ""}
                onChange={(e) => handleInputChange("content.description", e.target.value)}
                placeholder="Descreva a evolução do paciente"
                rows={6}
              />
            </div>
          </div>
        );
      case "prescription":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={newRecord.content.title}
                onChange={(e) => handleInputChange("content.title", e.target.value)}
                placeholder="Título da prescrição"
              />
            </div>
            <div>
              <Label htmlFor="medication">Medicamento</Label>
              <Input
                id="medication"
                value={newRecord.content.medication || ""}
                onChange={(e) => handleInputChange("content.medication", e.target.value)}
                placeholder="Nome do medicamento"
              />
            </div>
            <div>
              <Label htmlFor="dosage">Posologia</Label>
              <Textarea
                id="dosage"
                value={newRecord.content.dosage || ""}
                onChange={(e) => handleInputChange("content.dosage", e.target.value)}
                placeholder="Instruções de uso"
              />
            </div>
            <div>
              <Label htmlFor="duration">Duração</Label>
              <Input
                id="duration"
                value={newRecord.content.duration || ""}
                onChange={(e) => handleInputChange("content.duration", e.target.value)}
                placeholder="Duração do tratamento"
              />
            </div>
          </div>
        );
      case "exam":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={newRecord.content.title}
                onChange={(e) => handleInputChange("content.title", e.target.value)}
                placeholder="Título do exame"
              />
            </div>
            <div>
              <Label htmlFor="examType">Tipo de Exame</Label>
              <Input
                id="examType"
                value={newRecord.content.examType || ""}
                onChange={(e) => handleInputChange("content.examType", e.target.value)}
                placeholder="Tipo de exame realizado"
              />
            </div>
            <div>
              <Label htmlFor="result">Resultado</Label>
              <Textarea
                id="result"
                value={newRecord.content.result || ""}
                onChange={(e) => handleInputChange("content.result", e.target.value)}
                placeholder="Resultado do exame"
              />
            </div>
            <div>
              <Label htmlFor="comments">Observações</Label>
              <Textarea
                id="comments"
                value={newRecord.content.comments || ""}
                onChange={(e) => handleInputChange("content.comments", e.target.value)}
                placeholder="Comentários adicionais sobre o exame"
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Prontuário</h3>
        <Button
          onClick={() => setIsAddRecordOpen(true)}
          className="bg-primary text-white"
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo Registro
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center text-red-500 p-4">
          Erro ao carregar prontuário. Tente novamente.
        </div>
      ) : records && records.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <FileText className="h-16 w-16 text-neutral-300 mb-4" />
            <h3 className="text-lg font-medium text-neutral-600 mb-2">
              Nenhum registro encontrado
            </h3>
            <p className="text-neutral-500 text-center max-w-md">
              Este paciente ainda não possui registros em seu prontuário.
              Adicione o primeiro registro clicando no botão acima.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {records
            ?.sort(
              (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
            .map((record) => (
              <Card key={record.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg flex items-center">
                        {getRecordTypeIcon(record.recordType)}
                        {record.content.title}
                      </CardTitle>
                      <CardDescription>
                        {getRecordTypeName(record.recordType)}
                      </CardDescription>
                    </div>
                    <div className="text-right text-sm text-neutral-500">
                      <div className="flex items-center justify-end">
                        <Calendar className="h-3.5 w-3.5 mr-1.5" />
                        {new Date(record.createdAt).toLocaleDateString("pt-BR")}
                      </div>
                      <div className="flex items-center justify-end mt-1">
                        <User className="h-3.5 w-3.5 mr-1.5" />
                        {record.createdByName || "Desconhecido"}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>{renderRecordContent(record)}</CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Add Record Dialog */}
      <Dialog open={isAddRecordOpen} onOpenChange={setIsAddRecordOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar ao Prontuário</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <div className="mb-4">
              <Label htmlFor="recordType">Tipo de Registro</Label>
              <Select
                value={newRecord.recordType}
                onValueChange={handleRecordTypeChange}
              >
                <SelectTrigger id="recordType">
                  <SelectValue placeholder="Selecione o tipo de registro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="anamnesis">Anamnese</SelectItem>
                  <SelectItem value="evolution">Evolução</SelectItem>
                  <SelectItem value="prescription">Prescrição</SelectItem>
                  <SelectItem value="exam">Exame</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {renderNewRecordForm()}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddRecordOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateRecord}
              disabled={createRecordMutation.isPending}
            >
              {createRecordMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
