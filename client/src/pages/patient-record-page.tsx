import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  User, 
  FileText, 
  Calendar, 
  Phone, 
  Mail, 
  MapPin, 
  Heart, 
  Activity, 
  Stethoscope,
  FileImage,
  Pill,
  ClipboardList,
  Camera,
  Save,
  Edit,
  Plus,
  Download,
  Upload,
  AlertCircle,
  CheckCircle,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Patient {
  id: number;
  fullName: string;
  birthDate?: string;
  cpf?: string;
  rg?: string;
  gender?: string;
  nationality?: string;
  maritalStatus?: string;
  profession?: string;
  email?: string;
  phone?: string;
  cellphone?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  healthInsurance?: string;
  healthInsuranceNumber?: string;
  bloodType?: string;
  allergies?: string;
  medications?: string;
  chronicDiseases?: string;
  patientNumber?: string;
  status?: string;
  notes?: string;
  profilePhoto?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Anamnesis {
  id?: number;
  patientId: number;
  chiefComplaint?: string;
  currentIllnessHistory?: string;
  medicalHistory?: string;
  currentMedications?: string;
  allergiesDetail?: string;
  previousSurgeries?: string;
  hospitalizations?: string;
  dentalHistory?: string;
  previousDentalTreatments?: string;
  orthodonticTreatment?: boolean;
  oralHygieneFequency?: string;
  smoking?: boolean;
  smokingFrequency?: string;
  alcohol?: boolean;
  alcoholFrequency?: string;
  bruxism?: boolean;
  nailBiting?: boolean;
  heartDisease?: boolean;
  highBloodPressure?: boolean;
  diabetes?: boolean;
  hepatitis?: boolean;
  kidney_disease?: boolean;
  pregnant?: boolean;
  pregnancyMonth?: number;
  additionalInfo?: string;
  createdBy?: number;
  createdAt?: string;
  updatedAt?: string;
}

export default function PatientRecordPage() {
  const params = useParams();
  const id = params.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("identification");
  const [isEditing, setIsEditing] = useState(false);
  const [editingAnamnesis, setEditingAnamnesis] = useState(false);

  if (!id) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">ID do paciente não encontrado.</p>
      </div>
    );
  }

  // Get patient data
  const { data: patient, isLoading: patientLoading, error: patientError } = useQuery({
    queryKey: ["/api/patients", id],
    enabled: !!id,
  });

  // Get patient anamnesis
  const { data: anamnesis = {}, isLoading: anamnesisLoading } = useQuery({
    queryKey: ["/api/patients", id, "anamnesis"],
    enabled: !!id,
  });

  // Get patient exams
  const { data: exams = [], isLoading: examsLoading } = useQuery({
    queryKey: ["/api/patients", id, "exams"],
    enabled: !!id,
  });

  // Get treatment plans
  const { data: treatmentPlans = [], isLoading: treatmentPlansLoading } = useQuery({
    queryKey: ["/api/patients", id, "treatment-plans"],
    enabled: !!id,
  });

  // Get treatment evolution
  const { data: evolution = [], isLoading: evolutionLoading } = useQuery({
    queryKey: ["/api/patients", id, "evolution"],
    enabled: !!id,
  });

  // Get prescriptions
  const { data: prescriptions = [], isLoading: prescriptionsLoading } = useQuery({
    queryKey: ["/api/patients", id, "prescriptions"],
    enabled: !!id,
  });

  if (patientLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Carregando dados do paciente...</p>
      </div>
    );
  }

  if (patientError || !patient) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">O paciente solicitado não foi encontrado no sistema.</p>
      </div>
    );
  }

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  if (patientLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p>Carregando ficha do paciente...</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Paciente não encontrado</h3>
          <p className="text-gray-600">O paciente solicitado não foi encontrado no sistema.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header com informações do paciente */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={patient.profilePhoto} alt={patient.fullName} />
                <AvatarFallback className="text-lg">
                  {patient.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-2xl">{patient.fullName}</CardTitle>
                <CardDescription className="flex items-center space-x-4 mt-1">
                  <span>Prontuário: {patient.patientNumber || 'N/A'}</span>
                  {patient.birthDate && (
                    <span>{calculateAge(patient.birthDate)} anos</span>
                  )}
                  <Badge variant={patient.status === 'active' ? 'default' : 'secondary'}>
                    {patient.status === 'active' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </CardDescription>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar Ficha
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)}>
                <Edit className="h-4 w-4 mr-2" />
                {isEditing ? 'Cancelar' : 'Editar'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs da ficha digital */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="identification" className="flex items-center space-x-1">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Identificação</span>
          </TabsTrigger>
          <TabsTrigger value="anamnesis" className="flex items-center space-x-1">
            <Stethoscope className="h-4 w-4" />
            <span className="hidden sm:inline">Anamnese</span>
          </TabsTrigger>
          <TabsTrigger value="exams" className="flex items-center space-x-1">
            <FileImage className="h-4 w-4" />
            <span className="hidden sm:inline">Exames</span>
          </TabsTrigger>
          <TabsTrigger value="treatment" className="flex items-center space-x-1">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Tratamento</span>
          </TabsTrigger>
          <TabsTrigger value="evolution" className="flex items-center space-x-1">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Evolução</span>
          </TabsTrigger>
          <TabsTrigger value="prescriptions" className="flex items-center space-x-1">
            <Pill className="h-4 w-4" />
            <span className="hidden sm:inline">Receitas</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center space-x-1">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Documentos</span>
          </TabsTrigger>
        </TabsList>

        {/* Aba Identificação */}
        <TabsContent value="identification">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Dados Pessoais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nome Completo</Label>
                    <Input value={patient.fullName} disabled={!isEditing} />
                  </div>
                  <div>
                    <Label>Data de Nascimento</Label>
                    <Input 
                      type="date" 
                      value={patient.birthDate ? format(new Date(patient.birthDate), 'yyyy-MM-dd') : ''} 
                      disabled={!isEditing} 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>CPF</Label>
                    <Input value={patient.cpf || ''} disabled={!isEditing} />
                  </div>
                  <div>
                    <Label>RG</Label>
                    <Input value={patient.rg || ''} disabled={!isEditing} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Gênero</Label>
                    <Select value={patient.gender || ''} disabled={!isEditing}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="feminino">Feminino</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Estado Civil</Label>
                    <Select value={patient.maritalStatus || ''} disabled={!isEditing}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                        <SelectItem value="casado">Casado(a)</SelectItem>
                        <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                        <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Nacionalidade</Label>
                    <Input value={patient.nationality || ''} disabled={!isEditing} />
                  </div>
                </div>
                <div>
                  <Label>Profissão</Label>
                  <Input value={patient.profession || ''} disabled={!isEditing} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Phone className="h-5 w-5 mr-2" />
                  Contato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Telefone</Label>
                    <Input value={patient.phone || ''} disabled={!isEditing} />
                  </div>
                  <div>
                    <Label>Celular</Label>
                    <Input value={patient.cellphone || ''} disabled={!isEditing} />
                  </div>
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input value={patient.email || ''} disabled={!isEditing} />
                </div>
                <Separator />
                <div>
                  <Label>Endereço</Label>
                  <Input value={patient.address || ''} disabled={!isEditing} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Bairro</Label>
                    <Input value={patient.neighborhood || ''} disabled={!isEditing} />
                  </div>
                  <div>
                    <Label>Cidade</Label>
                    <Input value={patient.city || ''} disabled={!isEditing} />
                  </div>
                  <div>
                    <Label>Estado</Label>
                    <Input value={patient.state || ''} disabled={!isEditing} />
                  </div>
                </div>
                <div>
                  <Label>CEP</Label>
                  <Input value={patient.cep || ''} disabled={!isEditing} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  Contato de Emergência
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nome</Label>
                  <Input value={patient.emergencyContactName || ''} disabled={!isEditing} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Telefone</Label>
                    <Input value={patient.emergencyContactPhone || ''} disabled={!isEditing} />
                  </div>
                  <div>
                    <Label>Parentesco</Label>
                    <Input value={patient.emergencyContactRelation || ''} disabled={!isEditing} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Heart className="h-5 w-5 mr-2" />
                  Informações de Saúde
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Plano de Saúde</Label>
                    <Input value={patient.healthInsurance || ''} disabled={!isEditing} />
                  </div>
                  <div>
                    <Label>Número do Cartão</Label>
                    <Input value={patient.healthInsuranceNumber || ''} disabled={!isEditing} />
                  </div>
                </div>
                <div>
                  <Label>Tipo Sanguíneo</Label>
                  <Select value={patient.bloodType || ''} disabled={!isEditing}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A+">A+</SelectItem>
                      <SelectItem value="A-">A-</SelectItem>
                      <SelectItem value="B+">B+</SelectItem>
                      <SelectItem value="B-">B-</SelectItem>
                      <SelectItem value="AB+">AB+</SelectItem>
                      <SelectItem value="AB-">AB-</SelectItem>
                      <SelectItem value="O+">O+</SelectItem>
                      <SelectItem value="O-">O-</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Alergias</Label>
                  <Textarea value={patient.allergies || ''} disabled={!isEditing} />
                </div>
                <div>
                  <Label>Medicações em Uso</Label>
                  <Textarea value={patient.medications || ''} disabled={!isEditing} />
                </div>
                <div>
                  <Label>Doenças Crônicas</Label>
                  <Textarea value={patient.chronicDiseases || ''} disabled={!isEditing} />
                </div>
              </CardContent>
            </Card>
          </div>

          {isEditing && (
            <div className="flex justify-end space-x-2 mt-4">
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancelar
              </Button>
              <Button>
                <Save className="h-4 w-4 mr-2" />
                Salvar Alterações
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Aba Anamnese */}
        <TabsContent value="anamnesis">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Stethoscope className="h-5 w-5 mr-2" />
                  Anamnese Digital
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setEditingAnamnesis(!editingAnamnesis)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {editingAnamnesis ? 'Cancelar' : 'Editar'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {anamnesisLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Clock className="h-6 w-6 animate-spin mr-2" />
                  <span>Carregando anamnese...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Queixa Principal */}
                  <div>
                    <Label className="text-base font-semibold">Queixa Principal</Label>
                    <Textarea 
                      value={anamnesis?.chiefComplaint || ''} 
                      disabled={!editingAnamnesis}
                      placeholder="Descreva a queixa principal do paciente..."
                    />
                  </div>

                  {/* Histórico da Doença Atual */}
                  <div>
                    <Label className="text-base font-semibold">Histórico da Doença Atual</Label>
                    <Textarea 
                      value={anamnesis?.currentIllnessHistory || ''} 
                      disabled={!editingAnamnesis}
                      placeholder="Descreva o histórico da doença atual..."
                    />
                  </div>

                  <Separator />

                  {/* Histórico Médico */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label className="text-base font-semibold">Histórico Médico</Label>
                      <Textarea 
                        value={anamnesis?.medicalHistory || ''} 
                        disabled={!editingAnamnesis}
                        placeholder="Histórico médico do paciente..."
                      />
                    </div>
                    <div>
                      <Label className="text-base font-semibold">Medicações Atuais</Label>
                      <Textarea 
                        value={anamnesis?.currentMedications || ''} 
                        disabled={!editingAnamnesis}
                        placeholder="Medicações em uso..."
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Histórico Odontológico */}
                  <div className="space-y-4">
                    <Label className="text-lg font-semibold">Histórico Odontológico</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Histórico Dental</Label>
                        <Textarea 
                          value={anamnesis?.dentalHistory || ''} 
                          disabled={!editingAnamnesis}
                          placeholder="Histórico de tratamentos dentários..."
                        />
                      </div>
                      <div>
                        <Label>Tratamentos Anteriores</Label>
                        <Textarea 
                          value={anamnesis?.previousDentalTreatments || ''} 
                          disabled={!editingAnamnesis}
                          placeholder="Tratamentos odontológicos anteriores..."
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch 
                          checked={anamnesis?.orthodonticTreatment || false}
                          disabled={!editingAnamnesis}
                        />
                        <Label>Tratamento Ortodôntico</Label>
                      </div>
                      <div>
                        <Label>Frequência de Higiene Oral</Label>
                        <Input 
                          value={anamnesis?.oralHygieneFequency || ''} 
                          disabled={!editingAnamnesis}
                          placeholder="Ex: 3x ao dia"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Hábitos */}
                  <div className="space-y-4">
                    <Label className="text-lg font-semibold">Hábitos</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch 
                          checked={anamnesis?.smoking || false}
                          disabled={!editingAnamnesis}
                        />
                        <Label>Fumante</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch 
                          checked={anamnesis?.alcohol || false}
                          disabled={!editingAnamnesis}
                        />
                        <Label>Consome Álcool</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch 
                          checked={anamnesis?.bruxism || false}
                          disabled={!editingAnamnesis}
                        />
                        <Label>Bruxismo</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch 
                          checked={anamnesis?.nailBiting || false}
                          disabled={!editingAnamnesis}
                        />
                        <Label>Roer Unhas</Label>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Condições Sistêmicas */}
                  <div className="space-y-4">
                    <Label className="text-lg font-semibold">Condições Sistêmicas</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch 
                          checked={anamnesis?.heartDisease || false}
                          disabled={!editingAnamnesis}
                        />
                        <Label>Doença Cardíaca</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch 
                          checked={anamnesis?.highBloodPressure || false}
                          disabled={!editingAnamnesis}
                        />
                        <Label>Hipertensão</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch 
                          checked={anamnesis?.diabetes || false}
                          disabled={!editingAnamnesis}
                        />
                        <Label>Diabetes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch 
                          checked={anamnesis?.hepatitis || false}
                          disabled={!editingAnamnesis}
                        />
                        <Label>Hepatite</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch 
                          checked={anamnesis?.kidney_disease || false}
                          disabled={!editingAnamnesis}
                        />
                        <Label>Doença Renal</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch 
                          checked={anamnesis?.pregnant || false}
                          disabled={!editingAnamnesis}
                        />
                        <Label>Gestante</Label>
                      </div>
                    </div>
                  </div>

                  {editingAnamnesis && (
                    <div className="flex justify-end space-x-2 pt-4">
                      <Button variant="outline" onClick={() => setEditingAnamnesis(false)}>
                        Cancelar
                      </Button>
                      <Button>
                        <Save className="h-4 w-4 mr-2" />
                        Salvar Anamnese
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Demais abas serão implementadas */}
        <TabsContent value="exams">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileImage className="h-5 w-5 mr-2" />
                Exames
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Funcionalidade de exames em desenvolvimento...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="treatment">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ClipboardList className="h-5 w-5 mr-2" />
                Planos de Tratamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Funcionalidade de planos de tratamento em desenvolvimento...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evolution">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Evolução do Tratamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Funcionalidade de evolução em desenvolvimento...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prescriptions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Pill className="h-5 w-5 mr-2" />
                Receitas e Atestados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Funcionalidade de receitas em desenvolvimento...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Documentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Funcionalidade de documentos em desenvolvimento...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}