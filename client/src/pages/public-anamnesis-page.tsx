/**
 * Página Pública de Anamnese
 *
 * Formulário público para pacientes preencherem anamnese
 * antes da consulta, acessado via link único
 */

import React, { useState } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  CheckCircle,
  AlertTriangle,
  Loader2,
  Heart,
  Pill,
  Baby,
  Stethoscope,
  ClipboardList,
} from 'lucide-react';

interface FormData {
  clinicName: string;
  clinicLogo: string | null;
  patient: {
    fullName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
  } | null;
  hasPatient: boolean;
  template: any | null;
}

export default function PublicAnamnesisPage() {
  const { token } = useParams<{ token: string }>();
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [detectedAlerts, setDetectedAlerts] = useState<string[]>([]);

  // Dados do paciente (se não existir no sistema)
  const [patientData, setPatientData] = useState({
    fullName: '',
    email: '',
    phone: '',
    cpf: '',
    dateOfBirth: '',
  });

  // Respostas da anamnese
  const [responses, setResponses] = useState<Record<string, any>>({
    // Dados pessoais adicionais
    profissao: '',
    estado_civil: '',

    // Histórico médico
    tem_alergia: false,
    qual_alergia: '',
    tem_problema_cardiaco: false,
    qual_problema_cardiaco: '',
    pressao_alta: false,
    tem_diabetes: false,
    tipo_diabetes: '',
    usa_anticoagulante: false,
    qual_anticoagulante: '',
    esta_gravida: false,
    semanas_gestacao: '',
    tem_doenca_cronica: false,
    qual_doenca_cronica: '',

    // Medicamentos
    usa_medicamentos: false,
    medicamentos: '',

    // Hábitos
    fuma: false,
    quantidade_cigarros: '',
    bebe_alcool: false,
    frequencia_alcool: '',

    // Odontológico
    ultima_consulta_dentista: '',
    motivo_consulta: '',
    tem_dor: false,
    onde_dor: '',
    sangramento_gengiva: false,
    dentes_sensiveis: false,
    range_dentes: false,
    usa_protese: false,
    tipo_protese: '',

    // Observações
    observacoes: '',
  });

  const [consent, setConsent] = useState(false);

  // Buscar dados do formulário
  const { data: formData, isLoading, error } = useQuery<FormData>({
    queryKey: ['public-anamnesis-form', token],
    queryFn: async () => {
      const res = await fetch(`/api/public-anamnesis/form/${token}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao carregar formulário');
      }
      return res.json();
    },
    retry: false,
  });

  // Submeter formulário
  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/public-anamnesis/submit/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responses,
          patientData: formData?.hasPatient ? null : patientData,
          consent,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao enviar formulário');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSubmitted(true);
      setDetectedAlerts(data.detectedAlerts || []);
    },
  });

  const handleCheckboxChange = (field: string, checked: boolean) => {
    setResponses((prev) => ({ ...prev, [field]: checked }));
  };

  const handleInputChange = (field: string, value: string) => {
    setResponses((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!consent) {
      alert('Você precisa aceitar os termos para continuar.');
      return;
    }
    submitMutation.mutate();
  };

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/30 dark:to-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando formulário...</p>
        </div>
      </div>
    );
  }

  // Erro
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white dark:from-red-950/30 dark:to-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-6 w-6" />
              Link Inválido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              {(error as Error).message || 'Este link não é válido ou já expirou.'}
            </p>
            <p className="text-sm text-muted-foreground">
              Por favor, entre em contato com a clínica para obter um novo link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Sucesso
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white dark:from-green-950/30 dark:to-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-green-600 dark:text-green-400 flex items-center gap-2">
              <CheckCircle className="h-6 w-6" />
              Formulário Enviado!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Obrigado por preencher sua ficha de saúde. Suas informações foram
              recebidas com sucesso.
            </p>

            {detectedAlerts.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Informações Importantes Detectadas</AlertTitle>
                <AlertDescription>
                  Identificamos algumas condições de saúde importantes que serão
                  comunicadas ao dentista antes do seu atendimento para garantir
                  sua segurança.
                </AlertDescription>
              </Alert>
            )}

            <p className="text-sm text-muted-foreground">
              Você pode fechar esta página. Até breve!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/30 dark:to-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          {formData?.clinicLogo && (
            <img
              src={formData.clinicLogo}
              alt="Logo"
              className="h-16 mx-auto mb-4"
            />
          )}
          <h1 className="text-2xl font-bold text-foreground">
            {formData?.clinicName}
          </h1>
          <p className="text-muted-foreground mt-2">Ficha de Anamnese Digital</p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`w-3 h-3 rounded-full ${
                s === step ? 'bg-blue-500' : s < step ? 'bg-green-500' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {step === 1 && <ClipboardList className="h-5 w-5 text-blue-500" />}
              {step === 2 && <Stethoscope className="h-5 w-5 text-blue-500" />}
              {step === 3 && <Heart className="h-5 w-5 text-blue-500" />}
              {step === 1 && 'Dados Pessoais'}
              {step === 2 && 'Histórico de Saúde'}
              {step === 3 && 'Informações Odontológicas'}
            </CardTitle>
            <CardDescription>
              {step === 1 && 'Confirme seus dados pessoais'}
              {step === 2 && 'Conte-nos sobre sua saúde geral'}
              {step === 3 && 'Informações sobre sua saúde bucal'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Dados Pessoais */}
            {step === 1 && (
              <>
                {!formData?.hasPatient && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Label>Nome Completo *</Label>
                      <Input
                        value={patientData.fullName}
                        onChange={(e) =>
                          setPatientData((prev) => ({
                            ...prev,
                            fullName: e.target.value,
                          }))
                        }
                        placeholder="Seu nome completo"
                      />
                    </div>
                    <div>
                      <Label>CPF</Label>
                      <Input
                        value={patientData.cpf}
                        onChange={(e) =>
                          setPatientData((prev) => ({ ...prev, cpf: e.target.value }))
                        }
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <Label>Data de Nascimento</Label>
                      <Input
                        type="date"
                        value={patientData.dateOfBirth}
                        onChange={(e) =>
                          setPatientData((prev) => ({
                            ...prev,
                            dateOfBirth: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>Telefone</Label>
                      <Input
                        value={patientData.phone}
                        onChange={(e) =>
                          setPatientData((prev) => ({ ...prev, phone: e.target.value }))
                        }
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    <div>
                      <Label>E-mail</Label>
                      <Input
                        type="email"
                        value={patientData.email}
                        onChange={(e) =>
                          setPatientData((prev) => ({ ...prev, email: e.target.value }))
                        }
                        placeholder="seu@email.com"
                      />
                    </div>
                  </div>
                )}

                {formData?.hasPatient && formData.patient && (
                  <div className="bg-blue-500/10 p-4 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      Olá, <strong>{formData.patient.fullName}</strong>! Confirme se
                      seus dados estão corretos ou atualize-os na clínica.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Profissão</Label>
                    <Input
                      value={responses.profissao}
                      onChange={(e) => handleInputChange('profissao', e.target.value)}
                      placeholder="Sua profissão"
                    />
                  </div>
                  <div>
                    <Label>Estado Civil</Label>
                    <Input
                      value={responses.estado_civil}
                      onChange={(e) =>
                        handleInputChange('estado_civil', e.target.value)
                      }
                      placeholder="Solteiro(a), Casado(a)..."
                    />
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Histórico de Saúde */}
            {step === 2 && (
              <div className="space-y-6">
                {/* Alergias */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="tem_alergia"
                      checked={responses.tem_alergia}
                      onCheckedChange={(checked) =>
                        handleCheckboxChange('tem_alergia', !!checked)
                      }
                    />
                    <Label htmlFor="tem_alergia" className="flex items-center gap-2">
                      <Pill className="h-4 w-4 text-red-500" />
                      Possui alergia a medicamentos ou materiais?
                    </Label>
                  </div>
                  {responses.tem_alergia && (
                    <Input
                      placeholder="Quais alergias? (Ex: Penicilina, Látex...)"
                      value={responses.qual_alergia}
                      onChange={(e) =>
                        handleInputChange('qual_alergia', e.target.value)
                      }
                      className="ml-6"
                    />
                  )}
                </div>

                {/* Problemas Cardíacos */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="tem_problema_cardiaco"
                      checked={responses.tem_problema_cardiaco}
                      onCheckedChange={(checked) =>
                        handleCheckboxChange('tem_problema_cardiaco', !!checked)
                      }
                    />
                    <Label
                      htmlFor="tem_problema_cardiaco"
                      className="flex items-center gap-2"
                    >
                      <Heart className="h-4 w-4 text-red-500" />
                      Possui problema cardíaco?
                    </Label>
                  </div>
                  {responses.tem_problema_cardiaco && (
                    <Input
                      placeholder="Qual problema?"
                      value={responses.qual_problema_cardiaco}
                      onChange={(e) =>
                        handleInputChange('qual_problema_cardiaco', e.target.value)
                      }
                      className="ml-6"
                    />
                  )}
                </div>

                {/* Pressão Alta */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="pressao_alta"
                    checked={responses.pressao_alta}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange('pressao_alta', !!checked)
                    }
                  />
                  <Label htmlFor="pressao_alta">Tem pressão alta (hipertensão)?</Label>
                </div>

                {/* Diabetes */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="tem_diabetes"
                      checked={responses.tem_diabetes}
                      onCheckedChange={(checked) =>
                        handleCheckboxChange('tem_diabetes', !!checked)
                      }
                    />
                    <Label htmlFor="tem_diabetes">Tem diabetes?</Label>
                  </div>
                  {responses.tem_diabetes && (
                    <RadioGroup
                      value={responses.tipo_diabetes}
                      onValueChange={(value) =>
                        handleInputChange('tipo_diabetes', value)
                      }
                      className="ml-6"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="tipo1" id="tipo1" />
                        <Label htmlFor="tipo1">Tipo 1</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="tipo2" id="tipo2" />
                        <Label htmlFor="tipo2">Tipo 2</Label>
                      </div>
                    </RadioGroup>
                  )}
                </div>

                {/* Anticoagulantes */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="usa_anticoagulante"
                      checked={responses.usa_anticoagulante}
                      onCheckedChange={(checked) =>
                        handleCheckboxChange('usa_anticoagulante', !!checked)
                      }
                    />
                    <Label htmlFor="usa_anticoagulante">
                      Usa anticoagulante (afina o sangue)?
                    </Label>
                  </div>
                  {responses.usa_anticoagulante && (
                    <Input
                      placeholder="Qual medicamento? (Ex: AAS, Marevan, Xarelto...)"
                      value={responses.qual_anticoagulante}
                      onChange={(e) =>
                        handleInputChange('qual_anticoagulante', e.target.value)
                      }
                      className="ml-6"
                    />
                  )}
                </div>

                {/* Gestação */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="esta_gravida"
                      checked={responses.esta_gravida}
                      onCheckedChange={(checked) =>
                        handleCheckboxChange('esta_gravida', !!checked)
                      }
                    />
                    <Label htmlFor="esta_gravida" className="flex items-center gap-2">
                      <Baby className="h-4 w-4 text-pink-500" />
                      Está grávida?
                    </Label>
                  </div>
                  {responses.esta_gravida && (
                    <Input
                      placeholder="Quantas semanas?"
                      value={responses.semanas_gestacao}
                      onChange={(e) =>
                        handleInputChange('semanas_gestacao', e.target.value)
                      }
                      className="ml-6"
                    />
                  )}
                </div>

                {/* Medicamentos */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="usa_medicamentos"
                      checked={responses.usa_medicamentos}
                      onCheckedChange={(checked) =>
                        handleCheckboxChange('usa_medicamentos', !!checked)
                      }
                    />
                    <Label htmlFor="usa_medicamentos">
                      Faz uso contínuo de algum medicamento?
                    </Label>
                  </div>
                  {responses.usa_medicamentos && (
                    <Textarea
                      placeholder="Liste os medicamentos que você usa..."
                      value={responses.medicamentos}
                      onChange={(e) =>
                        handleInputChange('medicamentos', e.target.value)
                      }
                      className="ml-6"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Informações Odontológicas */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <Label>Quando foi sua última consulta ao dentista?</Label>
                  <Input
                    placeholder="Ex: Há 6 meses, 1 ano..."
                    value={responses.ultima_consulta_dentista}
                    onChange={(e) =>
                      handleInputChange('ultima_consulta_dentista', e.target.value)
                    }
                  />
                </div>

                <div>
                  <Label>Qual o motivo principal desta consulta?</Label>
                  <Textarea
                    placeholder="Descreva o motivo..."
                    value={responses.motivo_consulta}
                    onChange={(e) =>
                      handleInputChange('motivo_consulta', e.target.value)
                    }
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="tem_dor"
                    checked={responses.tem_dor}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange('tem_dor', !!checked)
                    }
                  />
                  <Label htmlFor="tem_dor">Está sentindo dor?</Label>
                </div>
                {responses.tem_dor && (
                  <Input
                    placeholder="Em qual região?"
                    value={responses.onde_dor}
                    onChange={(e) => handleInputChange('onde_dor', e.target.value)}
                    className="ml-6"
                  />
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sangramento_gengiva"
                      checked={responses.sangramento_gengiva}
                      onCheckedChange={(checked) =>
                        handleCheckboxChange('sangramento_gengiva', !!checked)
                      }
                    />
                    <Label htmlFor="sangramento_gengiva">
                      Sangramento na gengiva?
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="dentes_sensiveis"
                      checked={responses.dentes_sensiveis}
                      onCheckedChange={(checked) =>
                        handleCheckboxChange('dentes_sensiveis', !!checked)
                      }
                    />
                    <Label htmlFor="dentes_sensiveis">Dentes sensíveis?</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="range_dentes"
                      checked={responses.range_dentes}
                      onCheckedChange={(checked) =>
                        handleCheckboxChange('range_dentes', !!checked)
                      }
                    />
                    <Label htmlFor="range_dentes">Range os dentes (bruxismo)?</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="usa_protese"
                      checked={responses.usa_protese}
                      onCheckedChange={(checked) =>
                        handleCheckboxChange('usa_protese', !!checked)
                      }
                    />
                    <Label htmlFor="usa_protese">Usa prótese dentária?</Label>
                  </div>
                </div>

                <div>
                  <Label>Observações adicionais</Label>
                  <Textarea
                    placeholder="Algo mais que gostaria de informar?"
                    value={responses.observacoes}
                    onChange={(e) =>
                      handleInputChange('observacoes', e.target.value)
                    }
                  />
                </div>

                {/* Consentimento */}
                <div className="border-t pt-6 mt-6">
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="consent"
                      checked={consent}
                      onCheckedChange={(checked) => setConsent(!!checked)}
                    />
                    <Label htmlFor="consent" className="text-sm text-muted-foreground">
                      Declaro que as informações acima são verdadeiras e autorizo
                      o uso destes dados para fins de tratamento odontológico,
                      conforme a Lei Geral de Proteção de Dados (LGPD).
                    </Label>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4 border-t">
              {step > 1 ? (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  Voltar
                </Button>
              ) : (
                <div />
              )}

              {step < 3 ? (
                <Button onClick={() => setStep(step + 1)}>Próximo</Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!consent || submitMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Enviar Formulário
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
