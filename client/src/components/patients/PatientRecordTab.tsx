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
  Lock,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

  // Evolution records are immutable after 24 hours per CFO resolution
  const isEvolutionLocked = (createdAt: string): boolean => {
    const lockTime = new Date(createdAt);
    lockTime.setHours(lockTime.getHours() + 24);
    return new Date() > lockTime;
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
            chiefComplaint: "",
            medicalHistory: "",
            currentMedications: "",
            allergies: "",
            previousSurgeries: "",
            familyHistory: "",
            // Habitos
            smoking: false,
            alcohol: false,
            bruxism: false,
            // Sistemicas
            heartDisease: false,
            highBloodPressure: false,
            diabetes: false,
            hepatitis: false,
            kidneyDisease: false,
            pregnant: false,
            // Novas flags criticas
            anticoagulantUse: false,
            anticoagulantName: "",
            bisphosphonateUse: false,
            prostheticHeartValve: false,
            rheumaticFever: false,
            bleedingDisorder: false,
            hivAids: false,
            anemia: false,
            asthma: false,
            epilepsy: false,
            thyroidDisorder: false,
            cancerHistory: false,
            cancerType: "",
            radiationTherapy: false,
            drugUse: false,
            dentalAnxietyLevel: "",
            // Sinais vitais
            bloodPressureSystolic: "",
            bloodPressureDiastolic: "",
            weight: "",
            height: "",
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
      case "ai_clinical_note":
        return <Activity className="h-4 w-4 mr-2 text-purple-600" />;
      default:
        return <FileText className="h-4 w-4 mr-2" />;
    }
  };

  const getRecordTypeName = (type: string) => {
    switch (type) {
      case "anamnesis":
        return "Anamnese";
      case "evolution":
        return "Evolucao";
      case "prescription":
        return "Prescricao";
      case "exam":
        return "Exame";
      case "document":
        return "Documento";
      case "ai_clinical_note":
        return "Nota Clinica IA";
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
            {content.chiefComplaint && (
              <div><h4 className="text-sm font-medium">Queixa Principal:</h4><p className="text-sm">{content.chiefComplaint}</p></div>
            )}
            {content.allergies && (
              <div><h4 className="text-sm font-medium">Alergias:</h4><p className="text-sm">{content.allergies}</p></div>
            )}
            {content.medicalHistory && (
              <div><h4 className="text-sm font-medium">Historico Medico:</h4><p className="text-sm">{content.medicalHistory}</p></div>
            )}
            {content.currentMedications && (
              <div><h4 className="text-sm font-medium">Medicamentos em Uso:</h4><p className="text-sm">{content.currentMedications}</p></div>
            )}
            {content.previousSurgeries && (
              <div><h4 className="text-sm font-medium">Cirurgias Previas:</h4><p className="text-sm">{content.previousSurgeries}</p></div>
            )}
            {content.familyHistory && (
              <div><h4 className="text-sm font-medium">Historico Familiar:</h4><p className="text-sm">{content.familyHistory}</p></div>
            )}
            {/* Sinais Vitais */}
            {(content.bloodPressureSystolic || content.weight) && (
              <div className="flex flex-wrap gap-3 text-xs">
                {content.bloodPressureSystolic && <span className="bg-blue-50 px-2 py-1 rounded">PA: {content.bloodPressureSystolic}/{content.bloodPressureDiastolic} mmHg</span>}
                {content.weight && <span className="bg-blue-50 px-2 py-1 rounded">Peso: {content.weight} kg</span>}
                {content.height && <span className="bg-blue-50 px-2 py-1 rounded">Altura: {content.height} cm</span>}
                {content.dentalAnxietyLevel && <span className="bg-purple-50 px-2 py-1 rounded">Ansiedade: {content.dentalAnxietyLevel}/10</span>}
              </div>
            )}
            {/* Habitos */}
            {(content.smoking || content.alcohol || content.bruxism || content.drugUse) && (
              <div>
                <h4 className="text-sm font-medium">Habitos:</h4>
                <div className="flex flex-wrap gap-1 mt-1">
                  {content.smoking && <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded">Tabagismo</span>}
                  {content.alcohol && <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded">Alcool</span>}
                  {content.bruxism && <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded">Bruxismo</span>}
                  {content.drugUse && <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">Drogas</span>}
                </div>
              </div>
            )}
            {/* Condicoes Sistemicas */}
            {(content.heartDisease || content.highBloodPressure || content.diabetes || content.asthma || content.epilepsy || content.anemia || content.thyroidDisorder || content.hivAids || content.hepatitis || content.kidneyDisease || content.pregnant) && (
              <div>
                <h4 className="text-sm font-medium">Condicoes Sistemicas:</h4>
                <div className="flex flex-wrap gap-1 mt-1">
                  {content.heartDisease && <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">Cardiaca</span>}
                  {content.highBloodPressure && <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">Hipertensao</span>}
                  {content.diabetes && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Diabetes</span>}
                  {content.asthma && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Asma</span>}
                  {content.epilepsy && <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">Epilepsia</span>}
                  {content.anemia && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Anemia</span>}
                  {content.thyroidDisorder && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Tireoide</span>}
                  {content.hivAids && <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">HIV/AIDS</span>}
                  {content.hepatitis && <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded">Hepatite</span>}
                  {content.kidneyDisease && <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded">Renal</span>}
                  {content.pregnant && <span className="text-xs bg-pink-100 text-pink-800 px-2 py-0.5 rounded">Gestante</span>}
                </div>
              </div>
            )}
            {/* Alertas Criticos */}
            {(content.anticoagulantUse || content.bisphosphonateUse || content.prostheticHeartValve || content.rheumaticFever || content.bleedingDisorder || content.cancerHistory) && (
              <div className="p-2 bg-red-50 rounded border border-red-200">
                <h4 className="text-sm font-medium text-red-800">Alertas Criticos:</h4>
                <div className="flex flex-wrap gap-1 mt-1">
                  {content.anticoagulantUse && <span className="text-xs bg-red-200 text-red-900 px-2 py-0.5 rounded font-medium">Anticoagulante: {content.anticoagulantName || 'Sim'}</span>}
                  {content.bisphosphonateUse && <span className="text-xs bg-red-200 text-red-900 px-2 py-0.5 rounded font-medium">Bifosfonatos</span>}
                  {content.prostheticHeartValve && <span className="text-xs bg-red-200 text-red-900 px-2 py-0.5 rounded font-medium">Valvula Protetica</span>}
                  {content.rheumaticFever && <span className="text-xs bg-red-200 text-red-900 px-2 py-0.5 rounded font-medium">Febre Reumatica</span>}
                  {content.bleedingDisorder && <span className="text-xs bg-red-200 text-red-900 px-2 py-0.5 rounded font-medium">Dist. Coagulacao</span>}
                  {content.cancerHistory && <span className="text-xs bg-red-200 text-red-900 px-2 py-0.5 rounded font-medium">Cancer: {content.cancerType || 'Sim'}{content.radiationTherapy ? ' + Radioterapia' : ''}</span>}
                </div>
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
      case "ai_clinical_note":
        return (
          <div className="space-y-2">
            {content.analysis?.summary && (
              <p className="text-sm font-medium bg-purple-50 p-2 rounded">{content.analysis.summary}</p>
            )}
            {content.transcription && (
              <div><h4 className="text-sm font-medium">Transcricao:</h4><p className="text-sm text-muted-foreground">{content.transcription}</p></div>
            )}
            {content.analysis?.clinicalFindings?.length > 0 && (
              <div><h4 className="text-sm font-medium">Achados:</h4>
                <div className="flex flex-wrap gap-1 mt-1">{content.analysis.clinicalFindings.map((f: any, i: number) => (
                  <span key={i} className={`text-xs px-2 py-0.5 rounded ${f.severity === 'high' ? 'bg-red-100 text-red-800' : f.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{f.description}{f.toothId ? ` (${f.toothId})` : ''}</span>
                ))}</div>
              </div>
            )}
            {content.analysis?.alerts?.length > 0 && (
              <div className="p-2 bg-red-50 rounded border border-red-200">
                {content.analysis.alerts.map((a: any, i: number) => (
                  <p key={i} className="text-xs text-red-800">{a.message}</p>
                ))}
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
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div>
              <Label htmlFor="title">Titulo</Label>
              <Input id="title" value={newRecord.content.title} onChange={(e) => handleInputChange("content.title", e.target.value)} placeholder="Titulo da anamnese" />
            </div>
            <div>
              <Label htmlFor="chiefComplaint">Queixa Principal</Label>
              <Textarea id="chiefComplaint" value={newRecord.content.chiefComplaint || ""} onChange={(e) => handleInputChange("content.chiefComplaint", e.target.value)} placeholder="Motivo principal da consulta" rows={2} />
            </div>
            <div>
              <Label htmlFor="medicalHistory">Historico Medico</Label>
              <Textarea id="medicalHistory" value={newRecord.content.medicalHistory || ""} onChange={(e) => handleInputChange("content.medicalHistory", e.target.value)} placeholder="Doencas previas, internacoes, cirurgias" rows={2} />
            </div>
            <div>
              <Label htmlFor="currentMedications">Medicamentos em Uso</Label>
              <Textarea id="currentMedications" value={newRecord.content.currentMedications || ""} onChange={(e) => handleInputChange("content.currentMedications", e.target.value)} placeholder="Liste todos os medicamentos" rows={2} />
            </div>
            <div>
              <Label htmlFor="allergies">Alergias</Label>
              <Textarea id="allergies" value={newRecord.content.allergies || ""} onChange={(e) => handleInputChange("content.allergies", e.target.value)} placeholder="Medicamentos, materiais, latex, alimentos" rows={2} />
            </div>
            <div>
              <Label htmlFor="previousSurgeries">Cirurgias Previas</Label>
              <Input id="previousSurgeries" value={newRecord.content.previousSurgeries || ""} onChange={(e) => handleInputChange("content.previousSurgeries", e.target.value)} placeholder="Cirurgias realizadas anteriormente" />
            </div>
            <div>
              <Label htmlFor="familyHistory">Historico Familiar</Label>
              <Textarea id="familyHistory" value={newRecord.content.familyHistory || ""} onChange={(e) => handleInputChange("content.familyHistory", e.target.value)} placeholder="Doencas na familia (diabetes, cancer, cardiopatia, etc.)" rows={2} />
            </div>

            {/* Sinais Vitais */}
            <div className="border-t pt-3 mt-3">
              <h4 className="text-sm font-semibold mb-2">Sinais Vitais</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">PA Sistolica (mmHg)</Label>
                  <Input type="number" value={newRecord.content.bloodPressureSystolic || ""} onChange={(e) => handleInputChange("content.bloodPressureSystolic", e.target.value)} placeholder="120" />
                </div>
                <div>
                  <Label className="text-xs">PA Diastolica (mmHg)</Label>
                  <Input type="number" value={newRecord.content.bloodPressureDiastolic || ""} onChange={(e) => handleInputChange("content.bloodPressureDiastolic", e.target.value)} placeholder="80" />
                </div>
                <div>
                  <Label className="text-xs">Peso (kg)</Label>
                  <Input type="number" step="0.1" value={newRecord.content.weight || ""} onChange={(e) => handleInputChange("content.weight", e.target.value)} placeholder="70" />
                </div>
                <div>
                  <Label className="text-xs">Altura (cm)</Label>
                  <Input type="number" value={newRecord.content.height || ""} onChange={(e) => handleInputChange("content.height", e.target.value)} placeholder="170" />
                </div>
              </div>
            </div>

            {/* Ansiedade */}
            <div>
              <Label htmlFor="dentalAnxietyLevel">Nivel de Ansiedade Dental (0-10)</Label>
              <Input id="dentalAnxietyLevel" type="number" min="0" max="10" value={newRecord.content.dentalAnxietyLevel || ""} onChange={(e) => handleInputChange("content.dentalAnxietyLevel", e.target.value)} placeholder="0 = sem ansiedade, 10 = panico" />
            </div>

            {/* Habitos */}
            <div className="border-t pt-3 mt-3">
              <h4 className="text-sm font-semibold mb-2">Habitos</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { key: "smoking", label: "Tabagismo" },
                  { key: "alcohol", label: "Alcool" },
                  { key: "bruxism", label: "Bruxismo" },
                  { key: "drugUse", label: "Drogas Recreativas" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={!!newRecord.content[key]} onChange={(e) => handleInputChange(`content.${key}`, e.target.checked ? "true" : "")} className="rounded" />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Condicoes Sistemicas */}
            <div className="border-t pt-3 mt-3">
              <h4 className="text-sm font-semibold mb-2">Condicoes Sistemicas</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "heartDisease", label: "Doenca Cardiaca" },
                  { key: "highBloodPressure", label: "Hipertensao" },
                  { key: "diabetes", label: "Diabetes" },
                  { key: "hepatitis", label: "Hepatite" },
                  { key: "kidneyDisease", label: "Doenca Renal" },
                  { key: "asthma", label: "Asma" },
                  { key: "epilepsy", label: "Epilepsia" },
                  { key: "anemia", label: "Anemia" },
                  { key: "thyroidDisorder", label: "Dist. Tireoidiano" },
                  { key: "hivAids", label: "HIV/AIDS" },
                  { key: "pregnant", label: "Gestante" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={!!newRecord.content[key]} onChange={(e) => handleInputChange(`content.${key}`, e.target.checked ? "true" : "")} className="rounded" />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Flags Criticas para Odontologia */}
            <div className="border-t pt-3 mt-3">
              <h4 className="text-sm font-semibold mb-1 text-red-700">Alertas Criticos para Tratamento</h4>
              <p className="text-xs text-muted-foreground mb-2">Estas condicoes afetam diretamente a prescricao e procedimentos</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-2 rounded border border-red-200 bg-red-50 cursor-pointer">
                  <input type="checkbox" checked={!!newRecord.content.anticoagulantUse} onChange={(e) => handleInputChange("content.anticoagulantUse", e.target.checked ? "true" : "")} className="rounded" />
                  <span className="text-sm font-medium">Uso de Anticoagulante</span>
                </label>
                {newRecord.content.anticoagulantUse && (
                  <Input value={newRecord.content.anticoagulantName || ""} onChange={(e) => handleInputChange("content.anticoagulantName", e.target.value)} placeholder="Qual? (Warfarina, Rivaroxabana, AAS, etc.)" className="ml-6" />
                )}

                <label className="flex items-center gap-2 p-2 rounded border border-red-200 bg-red-50 cursor-pointer">
                  <input type="checkbox" checked={!!newRecord.content.bisphosphonateUse} onChange={(e) => handleInputChange("content.bisphosphonateUse", e.target.checked ? "true" : "")} className="rounded" />
                  <span className="text-sm font-medium">Uso de Bifosfonatos (risco de osteonecrose)</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded border border-orange-200 bg-orange-50 cursor-pointer">
                  <input type="checkbox" checked={!!newRecord.content.prostheticHeartValve} onChange={(e) => handleInputChange("content.prostheticHeartValve", e.target.checked ? "true" : "")} className="rounded" />
                  <span className="text-sm font-medium">Valvula Cardiaca Protetica (requer profilaxia)</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded border border-orange-200 bg-orange-50 cursor-pointer">
                  <input type="checkbox" checked={!!newRecord.content.rheumaticFever} onChange={(e) => handleInputChange("content.rheumaticFever", e.target.checked ? "true" : "")} className="rounded" />
                  <span className="text-sm font-medium">Febre Reumatica (requer profilaxia antibiotica)</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded border border-red-200 bg-red-50 cursor-pointer">
                  <input type="checkbox" checked={!!newRecord.content.bleedingDisorder} onChange={(e) => handleInputChange("content.bleedingDisorder", e.target.checked ? "true" : "")} className="rounded" />
                  <span className="text-sm font-medium">Disturbio de Coagulacao / Hemofilia</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded border border-orange-200 bg-orange-50 cursor-pointer">
                  <input type="checkbox" checked={!!newRecord.content.cancerHistory} onChange={(e) => handleInputChange("content.cancerHistory", e.target.checked ? "true" : "")} className="rounded" />
                  <span className="text-sm font-medium">Historico de Cancer</span>
                </label>
                {newRecord.content.cancerHistory && (
                  <div className="ml-6 space-y-2">
                    <Input value={newRecord.content.cancerType || ""} onChange={(e) => handleInputChange("content.cancerType", e.target.value)} placeholder="Tipo de cancer" />
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={!!newRecord.content.radiationTherapy} onChange={(e) => handleInputChange("content.radiationTherapy", e.target.checked ? "true" : "")} className="rounded" />
                      <span className="text-sm">Fez radioterapia em regiao de cabeca/pescoco?</span>
                    </label>
                  </div>
                )}
              </div>
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
        <TooltipProvider>
        <div className="space-y-4">
          {records
            ?.sort(
              (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
            .map((record) => {
              const locked = record.recordType === 'evolution' && isEvolutionLocked(record.createdAt);
              return (
              <Card key={record.id} className={locked ? 'opacity-90' : undefined}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span className="flex items-center">
                          {getRecordTypeIcon(record.recordType)}
                          {record.content.title}
                        </span>
                        {locked && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Lock className="h-4 w-4 text-muted-foreground shrink-0 cursor-default" />
                            </TooltipTrigger>
                            <TooltipContent>
                              Registro bloqueado (CFO — imutavel apos 24h)
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        {getRecordTypeName(record.recordType)}
                        {locked && (
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                            bloqueado
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="text-right text-sm text-neutral-500 shrink-0 ml-2">
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
              );
            })}
        </div>
        </TooltipProvider>
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
