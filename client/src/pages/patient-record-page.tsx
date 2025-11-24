import { useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  User,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Heart,
  FileText,
  Stethoscope,
  Clipboard,
  Activity,
  Pill,
  Layers
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PeriodontalChart } from "@/components/periodontal";

interface Patient {
  id: number;
  fullName: string;
  birthDate?: string;
  cpf?: string;
  rg?: string;
  gender?: string;
  maritalStatus?: string;
  nationality?: string;
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
  createdAt?: string;
}

export default function PatientRecordPage() {
  const params = useParams();
  const patientId = params.id;
  const [activeTab, setActiveTab] = useState("identification");

  if (!patientId) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">ID do paciente não encontrado.</p>
        </div>
      </div>
    );
  }

  // Get patient data
  const { data: patient, isLoading: patientLoading, error: patientError } = useQuery<any>({
    queryKey: ["/api/patients", patientId],
    enabled: !!patientId,
  });

  // Get patient anamnesis
  const { data: anamnesis = {} } = useQuery<any>({
    queryKey: ["/api/patients", patientId, "anamnesis"],
    enabled: !!patientId,
  });

  // Get patient exams
  const { data: exams = [] } = useQuery<any[]>({
    queryKey: ["/api/patients", patientId, "exams"],
    enabled: !!patientId,
  });

  // Get treatment plans
  const { data: treatmentPlans = [] } = useQuery<any[]>({
    queryKey: ["/api/patients", patientId, "treatment-plans"],
    enabled: !!patientId,
  });

  // Get treatment evolution
  const { data: evolution = [] } = useQuery<any[]>({
    queryKey: ["/api/patients", patientId, "evolution"],
    enabled: !!patientId,
  });

  // Get prescriptions
  const { data: prescriptions = [] } = useQuery<any[]>({
    queryKey: ["/api/patients", patientId, "prescriptions"],
    enabled: !!patientId,
  });

  if (patientLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando dados do paciente...</p>
        </div>
      </div>
    );
  }

  if (patientError || !patient) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">O paciente solicitado não foi encontrado no sistema.</p>
        </div>
      </div>
    );
  }

  const calculateAge = (birthDate: string | undefined | null) => {
    if (!birthDate) return "Não informada";
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return `${age} anos`;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/patients">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{patient?.fullName || "Paciente"}</h1>
            <p className="text-muted-foreground">
              Ficha Digital - {patient?.patientNumber || `ID: ${patientId}`}
            </p>
          </div>
        </div>
        <Badge variant={patient?.status === "active" ? "default" : "secondary"}>
          {patient?.status === "active" ? "Ativo" : "Inativo"}
        </Badge>
      </div>

      {/* Patient Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle>{patient?.fullName || "Nome não informado"}</CardTitle>
              <CardDescription>
                {calculateAge(patient?.birthDate)} • {patient?.gender || "Gênero não informado"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="identification">
            <User className="h-4 w-4 mr-2" />
            Identificação
          </TabsTrigger>
          <TabsTrigger value="anamnesis">
            <Stethoscope className="h-4 w-4 mr-2" />
            Anamnese
          </TabsTrigger>
          <TabsTrigger value="periodontal">
            <Layers className="h-4 w-4 mr-2" />
            Periodontograma
          </TabsTrigger>
          <TabsTrigger value="exams">
            <FileText className="h-4 w-4 mr-2" />
            Exames
          </TabsTrigger>
          <TabsTrigger value="treatment">
            <Clipboard className="h-4 w-4 mr-2" />
            Tratamento
          </TabsTrigger>
          <TabsTrigger value="evolution">
            <Activity className="h-4 w-4 mr-2" />
            Evolução
          </TabsTrigger>
          <TabsTrigger value="prescriptions">
            <Pill className="h-4 w-4 mr-2" />
            Receitas
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="h-4 w-4 mr-2" />
            Documentos
          </TabsTrigger>
        </TabsList>

        {/* Identification Tab */}
        <TabsContent value="identification" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Dados Pessoais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Nome Completo</label>
                  <p className="text-sm">{patient?.fullName || "Não informado"}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Data de Nascimento</label>
                    <p className="text-sm">
                      {patient?.birthDate 
                        ? format(new Date(patient.birthDate), "dd/MM/yyyy", { locale: ptBR })
                        : "Não informada"
                      }
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Idade</label>
                    <p className="text-sm">{calculateAge(patient?.birthDate)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">CPF</label>
                    <p className="text-sm">{patient?.cpf || "Não informado"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">RG</label>
                    <p className="text-sm">{patient?.rg || "Não informado"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Gênero</label>
                    <p className="text-sm">{patient?.gender || "Não informado"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Estado Civil</label>
                    <p className="text-sm">{patient?.maritalStatus || "Não informado"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Nacionalidade</label>
                    <p className="text-sm">{patient?.nationality || "Não informada"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Profissão</label>
                    <p className="text-sm">{patient?.profession || "Não informada"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Phone className="h-5 w-5 mr-2" />
                  Contato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Telefone</label>
                  <p className="text-sm">{patient?.phone || "Não informado"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Celular</label>
                  <p className="text-sm">{patient?.cellphone || "Não informado"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">E-mail</label>
                  <p className="text-sm">{patient?.email || "Não informado"}</p>
                </div>
                <Separator />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Endereço</label>
                  <p className="text-sm">{patient?.address || "Não informado"}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Bairro</label>
                    <p className="text-sm">{patient?.neighborhood || "Não informado"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Cidade</label>
                    <p className="text-sm">{patient?.city || "Não informado"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Estado</label>
                    <p className="text-sm">{patient?.state || "Não informado"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">CEP</label>
                    <p className="text-sm">{patient?.cep || "Não informado"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Emergency Contact */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Phone className="h-5 w-5 mr-2" />
                  Contato de Emergência
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Nome</label>
                  <p className="text-sm">{patient?.emergencyContactName || "Não informado"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Telefone</label>
                  <p className="text-sm">{patient?.emergencyContactPhone || "Não informado"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Parentesco</label>
                  <p className="text-sm">{patient?.emergencyContactRelation || "Não informado"}</p>
                </div>
              </CardContent>
            </Card>

            {/* Health Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Heart className="h-5 w-5 mr-2" />
                  Informações de Saúde
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Plano de Saúde</label>
                  <p className="text-sm">{patient?.healthInsurance || "Não informado"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Número da Carteirinha</label>
                  <p className="text-sm">{patient?.healthInsuranceNumber || "Não informado"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Tipo Sanguíneo</label>
                  <p className="text-sm">{patient?.bloodType || "Não informado"}</p>
                </div>
                <Separator />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Alergias</label>
                  <p className="text-sm">{patient?.allergies || "Nenhuma alergia conhecida"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Medicamentos em Uso</label>
                  <p className="text-sm">{patient?.medications || "Nenhum medicamento"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Doenças Crônicas</label>
                  <p className="text-sm">{patient?.chronicDiseases || "Nenhuma doença crônica"}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Anamnesis Tab */}
        <TabsContent value="anamnesis">
          <Card>
            <CardHeader>
              <CardTitle>Anamnese</CardTitle>
              <CardDescription>
                Histórico médico e odontológico detalhado do paciente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Queixa Principal</h3>
                  <p className="text-sm bg-muted p-4 rounded-lg">
                    {anamnesis?.chiefComplaint || "Nenhuma queixa registrada"}
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-4">História da Doença Atual</h3>
                  <p className="text-sm bg-muted p-4 rounded-lg">
                    {anamnesis?.currentIllnessHistory || "Não informado"}
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Histórico Médico</h3>
                  <p className="text-sm bg-muted p-4 rounded-lg">
                    {anamnesis?.medicalHistory || "Não informado"}
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Medicamentos Atuais</h3>
                  <p className="text-sm bg-muted p-4 rounded-lg">
                    {anamnesis?.currentMedications || "Nenhum medicamento"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Periodontal Tab */}
        <TabsContent value="periodontal">
          <PeriodontalChart
            patientId={parseInt(patientId)}
            readOnly={false}
          />
        </TabsContent>

        {/* Exams Tab */}
        <TabsContent value="exams">
          <Card>
            <CardHeader>
              <CardTitle>Exames</CardTitle>
              <CardDescription>
                Exames realizados pelo paciente
              </CardDescription>
            </CardHeader>
            <CardContent>
              {exams.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum exame registrado para este paciente.
                </p>
              ) : (
                <div className="space-y-4">
                  {exams.map((exam: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{exam.examType}</h4>
                        <Badge variant="outline">{exam.examDate}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{exam.description}</p>
                      {exam.results && (
                        <div className="mt-2">
                          <p className="text-sm font-medium">Resultados:</p>
                          <p className="text-sm">{exam.results}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Treatment Tab */}
        <TabsContent value="treatment">
          <Card>
            <CardHeader>
              <CardTitle>Planos de Tratamento</CardTitle>
              <CardDescription>
                Planos de tratamento propostos e em andamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              {treatmentPlans.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum plano de tratamento registrado para este paciente.
                </p>
              ) : (
                <div className="space-y-4">
                  {treatmentPlans.map((plan: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{plan.planName}</h4>
                        <Badge variant={plan.status === "pending" ? "outline" : "default"}>
                          {plan.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{plan.description}</p>
                      {plan.estimatedCost && (
                        <p className="text-sm mt-2">
                          <span className="font-medium">Custo estimado:</span> R$ {plan.estimatedCost}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Evolution Tab */}
        <TabsContent value="evolution">
          <Card>
            <CardHeader>
              <CardTitle>Evolução do Tratamento</CardTitle>
              <CardDescription>
                Registro da evolução e progressos do tratamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              {evolution.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhuma evolução registrada para este paciente.
                </p>
              ) : (
                <div className="space-y-4">
                  {evolution.map((item: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{item.procedurePerformed}</h4>
                        <Badge variant="outline">{item.evolutionDate}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                      {item.observations && (
                        <div className="mt-2">
                          <p className="text-sm font-medium">Observações:</p>
                          <p className="text-sm">{item.observations}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Prescriptions Tab */}
        <TabsContent value="prescriptions">
          <Card>
            <CardHeader>
              <CardTitle>Receitas e Atestados</CardTitle>
              <CardDescription>
                Receitas médicas e atestados emitidos
              </CardDescription>
            </CardHeader>
            <CardContent>
              {prescriptions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhuma receita ou atestado registrado para este paciente.
                </p>
              ) : (
                <div className="space-y-4">
                  {prescriptions.map((prescription: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{prescription.title}</h4>
                        <Badge variant={prescription.documentType === "prescription" ? "default" : "secondary"}>
                          {prescription.documentType === "prescription" ? "Receita" : "Atestado"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{prescription.content}</p>
                      <p className="text-sm mt-2">
                        <span className="font-medium">Data de emissão:</span> {prescription.issueDate}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documentos</CardTitle>
              <CardDescription>
                Documentos anexados à ficha do paciente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Funcionalidade de documentos em desenvolvimento.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}