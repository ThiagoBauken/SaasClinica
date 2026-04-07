import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Camera,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// CPF validation — modulo-11 algorithm
// ============================================================

function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let rem = (sum * 10) % 11;
  if (rem === 10) rem = 0;
  if (rem !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rem = (sum * 10) % 11;
  if (rem === 10) rem = 0;
  return rem === parseInt(digits[10]);
}

// ============================================================
// Input masks
// ============================================================

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function maskCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function maskCEP(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function createMaskedHandler(
  maskFn: (value: string) => string,
  setValue: (field: any, value: any, options?: any) => void,
  field: string
) {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskFn(e.target.value);
    setValue(field as any, masked, { shouldValidate: false });
  };
}

// ============================================================
// Schema - Minimal required + optional extras
// ============================================================

const optionalString = z.union([z.string(), z.literal(""), z.null()]).optional();
const optionalEmail = z.union([z.string().email("Email invalido"), z.literal(""), z.null()]).optional();
const optionalPhone = z.union([z.string().min(8, "Telefone deve ter pelo menos 8 digitos"), z.literal(""), z.null()]).optional();

const patientFormSchema = z.object({
  // Essential fields
  fullName: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  phone: z.string().min(8, "Telefone deve ter pelo menos 8 digitos"),
  // Quick optional
  email: optionalEmail,
  cpf: z.union([
    z.string().refine(val => val === '' || isValidCPF(val), { message: "CPF invalido (digito verificador incorreto)" }),
    z.literal(""), z.null()
  ]).optional(),
  birthDate: z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), { message: "Data invalida" }),
  gender: z.string().optional(),
  // Extended fields (shown when expanded)
  socialName: optionalString,
  rg: optionalString,
  nationality: optionalString,
  maritalStatus: optionalString,
  profession: optionalString,
  cellphone: optionalPhone,
  whatsappPhone: optionalPhone,
  emergencyContactName: optionalString,
  emergencyContactPhone: optionalPhone,
  emergencyContactRelation: optionalString,
  address: optionalString,
  neighborhood: optionalString,
  city: optionalString,
  state: optionalString,
  cep: optionalString,
  healthInsurance: optionalString,
  healthInsuranceNumber: optionalString,
  bloodType: optionalString,
  allergies: optionalString,
  medications: optionalString,
  chronicDiseases: optionalString,
  responsibleName: optionalString,
  responsibleCpf: optionalString,
  responsibleRelationship: optionalString,
  referralSource: optionalString,
  treatmentType: optionalString,
  preferredTimeSlot: optionalString,
  notes: optionalString,
  dataProcessingConsent: z.boolean().optional(),
  marketingConsent: z.boolean().optional(),
  whatsappConsent: z.boolean().optional(),
  emailConsent: z.boolean().optional(),
  smsConsent: z.boolean().optional(),
  referredByPatientId: z.number().optional().nullable(),
  referenceDoctorName: optionalString,
  referenceDoctorPhone: optionalPhone,
  profilePhoto: optionalString,
}).superRefine((data, ctx) => {
  if (data.birthDate) {
    const age = Math.floor((Date.now() - new Date(data.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (age < 18) {
      if (!data.responsibleName || data.responsibleName.trim() === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Nome do responsavel obrigatorio para menores de 18 anos", path: ["responsibleName"] });
      }
      if (!data.responsibleCpf || data.responsibleCpf.trim() === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "CPF do responsavel obrigatorio para menores de 18 anos", path: ["responsibleCpf"] });
      }
    }
  }
});

type PatientFormData = z.infer<typeof patientFormSchema>;

interface PatientFormProps {
  onSubmit: (data: any) => void;
  initialData?: any;
  isEditing?: boolean;
}

// ============================================================
// Component
// ============================================================

export default function PatientForm({
  onSubmit,
  initialData,
  isEditing = false,
}: PatientFormProps) {
  const [showExtended, setShowExtended] = useState(!!isEditing);
  const [photoPreview, setPhotoPreview] = useState<string | null>(initialData?.profilePhoto || null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const defaultValues: any = initialData
    ? {
        ...initialData,
        fullName: initialData.fullName || initialData.name || "",
        email: initialData.email || "",
        phone: initialData.phone || "",
        cellphone: initialData.cellphone || "",
        whatsappPhone: initialData.whatsappPhone || "",
        cpf: initialData.cpf || "",
        rg: initialData.rg || "",
        address: initialData.address || "",
        neighborhood: initialData.neighborhood || "",
        city: initialData.city || "",
        state: initialData.state || "",
        cep: initialData.cep || "",
        notes: initialData.notes || "",
        socialName: initialData.socialName || "",
        nationality: initialData.nationality || "",
        maritalStatus: initialData.maritalStatus || "",
        profession: initialData.profession || "",
        healthInsurance: initialData.healthInsurance || "",
        healthInsuranceNumber: initialData.healthInsuranceNumber || "",
        bloodType: initialData.bloodType || "",
        allergies: initialData.allergies || "",
        medications: initialData.medications || "",
        chronicDiseases: initialData.chronicDiseases || "",
        emergencyContactName: initialData.emergencyContactName || "",
        emergencyContactPhone: initialData.emergencyContactPhone || "",
        emergencyContactRelation: initialData.emergencyContactRelation || "",
        responsibleName: initialData.responsibleName || "",
        responsibleCpf: initialData.responsibleCpf || "",
        responsibleRelationship: initialData.responsibleRelationship || "",
        referralSource: initialData.referralSource || "",
        treatmentType: initialData.treatmentType || "",
        preferredTimeSlot: initialData.preferredTimeSlot || "",
        dataProcessingConsent: initialData.dataProcessingConsent || false,
        marketingConsent: initialData.marketingConsent || false,
        whatsappConsent: initialData.whatsappConsent || false,
        emailConsent: initialData.emailConsent || false,
        smsConsent: initialData.smsConsent || false,
        referenceDoctorName: initialData.referenceDoctorName || "",
        referenceDoctorPhone: initialData.referenceDoctorPhone || "",
        profilePhoto: initialData.profilePhoto || "",
        birthDate: initialData.birthDate
          ? new Date(initialData.birthDate).toISOString().split("T")[0]
          : "",
      }
    : {
        fullName: "",
        email: "",
        phone: "",
        cpf: "",
        birthDate: "",
        gender: "",
        socialName: "",
        rg: "",
        nationality: "",
        maritalStatus: "",
        profession: "",
        cellphone: "",
        whatsappPhone: "",
        emergencyContactName: "",
        emergencyContactPhone: "",
        emergencyContactRelation: "",
        address: "",
        neighborhood: "",
        city: "",
        state: "",
        cep: "",
        healthInsurance: "",
        healthInsuranceNumber: "",
        bloodType: "",
        allergies: "",
        medications: "",
        chronicDiseases: "",
        responsibleName: "",
        responsibleCpf: "",
        responsibleRelationship: "",
        referralSource: "",
        treatmentType: "",
        preferredTimeSlot: "",
        notes: "",
        dataProcessingConsent: false,
        marketingConsent: false,
        whatsappConsent: false,
        emailConsent: false,
        smsConsent: false,
        referenceDoctorName: "",
        referenceDoctorPhone: "",
        profilePhoto: "",
      };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientFormSchema),
    defaultValues,
    mode: "onSubmit",
  });

  const [cepLoading, setCepLoading] = useState(false);

  const cepValue = watch("cep");
  const birthDateValue = watch("birthDate");

  const isMinor = birthDateValue
    ? Math.floor((Date.now() - new Date(birthDateValue).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) < 18
    : false;

  useEffect(() => {
    const cep = cepValue?.replace(/\D/g, '');
    if (cep && cep.length === 8) {
      setCepLoading(true);
      fetch(`https://viacep.com.br/ws/${cep}/json/`)
        .then(res => res.json())
        .then(data => {
          if (!data.erro) {
            setValue("address", data.logradouro || "", { shouldValidate: false });
            setValue("neighborhood", data.bairro || "", { shouldValidate: false });
            setValue("city", data.localidade || "", { shouldValidate: false });
            setValue("state", data.uf || "", { shouldValidate: false });
          }
        })
        .catch(() => {})
        .finally(() => setCepLoading(false));
    }
  }, [cepValue, setValue]);

  const processSubmit = (data: PatientFormData) => {
    const formattedData = {
      ...data,
      profilePhoto: data.profilePhoto || undefined,
      birthDate: data.birthDate ? new Date(data.birthDate).toISOString() : undefined,
      consentDate: data.dataProcessingConsent ? new Date().toISOString() : undefined,
      consentMethod: "online",
    };
    onSubmit(formattedData);
  };

  const handleSelectChange = (field: keyof PatientFormData, value: string) => {
    setValue(field, value, { shouldValidate: true });
  };

  const renderError = (field: keyof PatientFormData) => {
    const error = errors[field];
    if (!error) return null;
    return <p className="text-red-500 text-sm mt-1">{error.message as string}</p>;
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Arquivo muito grande. Maximo: 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/storage/upload/avatars", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setValue("profilePhoto", data.url || data.key || data.path || "", { shouldValidate: false });
      }
    } catch (err) {
      console.error("Photo upload failed:", err);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handlePhoneChange = createMaskedHandler(maskPhone, setValue, 'phone');
  const handleCellphoneChange = createMaskedHandler(maskPhone, setValue, 'cellphone');
  const handleWhatsappChange = createMaskedHandler(maskPhone, setValue, 'whatsappPhone');
  const handleEmergencyPhoneChange = createMaskedHandler(maskPhone, setValue, 'emergencyContactPhone');
  const handleRefDoctorPhoneChange = createMaskedHandler(maskPhone, setValue, 'referenceDoctorPhone');
  const handleCpfChange = createMaskedHandler(maskCPF, setValue, 'cpf');
  const handleResponsibleCpfChange = createMaskedHandler(maskCPF, setValue, 'responsibleCpf');
  const handleCepChange = createMaskedHandler(maskCEP, setValue, 'cep');

  return (
    <form onSubmit={handleSubmit(processSubmit)} className="space-y-4">
      {/* ============================== */}
      {/* Profile Photo Upload           */}
      {/* ============================== */}
      <div className="flex flex-col items-center gap-3 pb-4 border-b">
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-muted border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
            {photoPreview ? (
              <img src={photoPreview} alt="Foto do paciente" className="w-full h-full object-cover" />
            ) : (
              <Camera className="h-8 w-8 text-muted-foreground/50" />
            )}
          </div>
          {photoPreview && (
            <button
              type="button"
              onClick={() => { setPhotoPreview(null); setValue("profilePhoto", ""); }}
              className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
              aria-label="Remover foto"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <label className="cursor-pointer">
          <span className="text-sm text-primary hover:underline">
            {photoUploading ? "Enviando..." : "Adicionar foto"}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handlePhotoUpload}
            disabled={photoUploading}
          />
        </label>
      </div>

      {/* ============================== */}
      {/* Essential fields - always shown */}
      {/* ============================== */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="fullName" className="required">Nome Completo</Label>
          <Input id="fullName" placeholder="Nome completo do paciente" {...register("fullName")} className={errors.fullName ? "border-red-500" : ""} autoFocus />
          {renderError("fullName")}
        </div>

        <div>
          <Label htmlFor="phone" className="required">Telefone / Celular</Label>
          <Input id="phone" placeholder="(00) 00000-0000" value={watch("phone") || ""} onChange={handlePhoneChange} className={errors.phone ? "border-red-500" : ""} />
          {renderError("phone")}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="email@exemplo.com" {...register("email")} className={errors.email ? "border-red-500" : ""} />
            {renderError("email")}
          </div>
          <div>
            <Label htmlFor="cpf">CPF</Label>
            <Input id="cpf" placeholder="000.000.000-00" value={watch("cpf") || ""} onChange={handleCpfChange} className={errors.cpf ? "border-red-500" : ""} />
            {renderError("cpf")}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="birthDate">Data de Nascimento</Label>
            <Input id="birthDate" type="date" {...register("birthDate")} />
          </div>
          <div>
            <Label htmlFor="gender">Genero</Label>
            <Select defaultValue={defaultValues.gender || ""} onValueChange={(v) => handleSelectChange("gender", v)}>
              <SelectTrigger id="gender"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Masculino</SelectItem>
                <SelectItem value="female">Feminino</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ============================== */}
      {/* Expand toggle for extra fields */}
      {/* ============================== */}
      <button
        type="button"
        onClick={() => setShowExtended(!showExtended)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-2 border rounded-md"
      >
        {showExtended ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        {showExtended ? "Ocultar campos complementares" : "Mais dados (endereco, saude, convenio...)"}
      </button>

      {/* ============================== */}
      {/* Extended fields - collapsible */}
      {/* ============================== */}
      {showExtended && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Dados Pessoais extras */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground border-b pb-1">Dados Pessoais</h4>
            <div>
              <Label htmlFor="socialName">Nome Social</Label>
              <Input id="socialName" placeholder="Nome social (se diferente)" {...register("socialName")} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="rg">RG</Label>
                <Input id="rg" placeholder="Numero do RG" {...register("rg")} />
              </div>
              <div>
                <Label htmlFor="maritalStatus">Estado Civil</Label>
                <Select defaultValue={defaultValues.maritalStatus || ""} onValueChange={(v) => handleSelectChange("maritalStatus", v)}>
                  <SelectTrigger id="maritalStatus"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                    <SelectItem value="casado">Casado(a)</SelectItem>
                    <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                    <SelectItem value="viuvo">Viuvo(a)</SelectItem>
                    <SelectItem value="uniao_estavel">Uniao Estavel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="profession">Profissao</Label>
                <Input id="profession" placeholder="Ex: Engenheiro" {...register("profession")} />
              </div>
            </div>
          </div>

          {/* Contato extra */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground border-b pb-1">Contato Adicional</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cellphone">Celular (se diferente)</Label>
                <Input id="cellphone" placeholder="(00) 00000-0000" value={watch("cellphone") || ""} onChange={handleCellphoneChange} />
              </div>
              <div>
                <Label htmlFor="whatsappPhone">WhatsApp (se diferente)</Label>
                <Input id="whatsappPhone" placeholder="(00) 00000-0000" value={watch("whatsappPhone") || ""} onChange={handleWhatsappChange} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="emergencyContactName">Contato Emergencia</Label>
                <Input id="emergencyContactName" placeholder="Nome" {...register("emergencyContactName")} />
              </div>
              <div>
                <Label htmlFor="emergencyContactPhone">Tel. Emergencia</Label>
                <Input id="emergencyContactPhone" placeholder="(00) 00000-0000" value={watch("emergencyContactPhone") || ""} onChange={handleEmergencyPhoneChange} />
              </div>
              <div>
                <Label htmlFor="emergencyContactRelation">Parentesco</Label>
                <Select defaultValue="" onValueChange={(v) => handleSelectChange("emergencyContactRelation", v)}>
                  <SelectTrigger id="emergencyContactRelation"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conjuge">Conjuge</SelectItem>
                    <SelectItem value="pai">Pai</SelectItem>
                    <SelectItem value="mae">Mae</SelectItem>
                    <SelectItem value="filho">Filho(a)</SelectItem>
                    <SelectItem value="irmao">Irmao(a)</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Endereco */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground border-b pb-1">Endereco</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Label htmlFor="cep">CEP</Label>
                <Input id="cep" placeholder="00000-000" value={watch("cep") || ""} onChange={handleCepChange} />
                {cepLoading && <Loader2 className="absolute right-2 top-8 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="address">Endereco</Label>
                <Input id="address" placeholder="Rua, Numero, Complemento" {...register("address")} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input id="neighborhood" placeholder="Bairro" {...register("neighborhood")} />
              </div>
              <div>
                <Label htmlFor="city">Cidade</Label>
                <Input id="city" placeholder="Cidade" {...register("city")} />
              </div>
              <div>
                <Label htmlFor="state">Estado</Label>
                <Select defaultValue={defaultValues.state || ""} onValueChange={(v) => handleSelectChange("state", v)}>
                  <SelectTrigger id="state"><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Saude */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground border-b pb-1">Saude</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="healthInsurance">Convenio</Label>
                <Input id="healthInsurance" placeholder="Nome do convenio" {...register("healthInsurance")} />
              </div>
              <div>
                <Label htmlFor="healthInsuranceNumber">N. Carteirinha</Label>
                <Input id="healthInsuranceNumber" placeholder="Numero" {...register("healthInsuranceNumber")} />
              </div>
              <div>
                <Label htmlFor="bloodType">Tipo Sanguineo</Label>
                <Select defaultValue={defaultValues.bloodType || ""} onValueChange={(v) => handleSelectChange("bloodType", v)}>
                  <SelectTrigger id="bloodType"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(bt => (
                      <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="allergies">Alergias</Label>
              <Textarea id="allergies" placeholder="Alergias conhecidas (medicamentos, materiais, latex...)" {...register("allergies")} rows={2} />
            </div>
            <div>
              <Label htmlFor="medications">Medicamentos em Uso</Label>
              <Textarea id="medications" placeholder="Medicamentos atuais" {...register("medications")} rows={2} />
            </div>
            <div>
              <Label htmlFor="chronicDiseases">Doencas Cronicas</Label>
              <Textarea id="chronicDiseases" placeholder="Diabetes, hipertensao, etc." {...register("chronicDiseases")} rows={2} />
            </div>
          </div>

          {/* Medico de Referencia */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground border-b pb-1">Medico de Referencia</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="referenceDoctorName">Nome do Medico</Label>
                <Input id="referenceDoctorName" placeholder="Dr. Nome" {...register("referenceDoctorName")} />
              </div>
              <div>
                <Label htmlFor="referenceDoctorPhone">Telefone do Medico</Label>
                <Input id="referenceDoctorPhone" placeholder="(00) 0000-0000" value={watch("referenceDoctorPhone") || ""} onChange={handleRefDoctorPhoneChange} />
              </div>
            </div>
          </div>

          {/* Como conheceu a clinica */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground border-b pb-1">Origem do Paciente</h4>
            <div>
              <Label htmlFor="referralSource">Como conheceu a clinica?</Label>
              <Select value={watch("referralSource") || ""} onValueChange={(val) => handleSelectChange("referralSource", val)}>
                <SelectTrigger id="referralSource">
                  <SelectValue placeholder="Selecione a origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="google">Google / Busca Online</SelectItem>
                  <SelectItem value="indicacao">Indicacao de Paciente</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="placa">Placa / Fachada</SelectItem>
                  <SelectItem value="convenio">Convenio</SelectItem>
                  <SelectItem value="panfleto">Panfleto / Folder</SelectItem>
                  <SelectItem value="tv_radio">TV / Radio</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {watch("referralSource") === "indicacao" && (
              <div>
                <Label htmlFor="referredBySearch">Indicado por qual paciente?</Label>
                <Input
                  id="referredBySearch"
                  placeholder="Digite o nome do paciente que indicou..."
                  value={watch("referredByPatientId") ? String(watch("referredByPatientId")) : ""}
                  onChange={(e) => setValue("referredByPatientId", null, { shouldValidate: false })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  O vinculo de indicacao sera registrado no cadastro
                </p>
              </div>
            )}
          </div>

          {/* Observacoes */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground border-b pb-1">Observacoes</h4>
            <div>
              <Label htmlFor="notes">Observacoes Gerais</Label>
              <Textarea id="notes" placeholder="Observacoes adicionais sobre o paciente" {...register("notes")} rows={2} />
            </div>
          </div>

          {/* Responsavel Legal */}
          <div className="space-y-3">
            <h4 className={cn("text-sm font-semibold border-b pb-1", isMinor ? "text-orange-600" : "text-muted-foreground")}>
              Responsavel Legal {isMinor && "(Obrigatorio - paciente menor de 18 anos)"}
            </h4>
            {isMinor && (
              <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
                Paciente menor de idade. O preenchimento do responsavel financeiro e obrigatorio.
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="responsibleName" className={isMinor ? "required" : ""}>Nome do Responsavel</Label>
                <Input id="responsibleName" placeholder="Nome completo" {...register("responsibleName")}
                  className={isMinor && !watch("responsibleName") ? "border-orange-400" : ""} />
                {renderError("responsibleName")}
              </div>
              <div>
                <Label htmlFor="responsibleCpf" className={isMinor ? "required" : ""}>CPF do Responsavel</Label>
                <Input id="responsibleCpf" placeholder="000.000.000-00" value={watch("responsibleCpf") || ""} onChange={handleResponsibleCpfChange}
                  className={isMinor && !watch("responsibleCpf") ? "border-orange-400" : ""} />
                {renderError("responsibleCpf")}
              </div>
              <div>
                <Label htmlFor="responsibleRelationship">Parentesco</Label>
                <Select defaultValue={defaultValues.responsibleRelationship || ""} onValueChange={(v) => handleSelectChange("responsibleRelationship", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mae">Mae</SelectItem>
                    <SelectItem value="pai">Pai</SelectItem>
                    <SelectItem value="tutor">Tutor Legal</SelectItem>
                    <SelectItem value="avo">Avo(a)</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Consentimentos LGPD */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground border-b pb-1">Consentimentos (LGPD)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { id: "dataProcessingConsent" as const, label: "Processamento de Dados" },
                { id: "whatsappConsent" as const, label: "WhatsApp" },
                { id: "emailConsent" as const, label: "Email" },
                { id: "smsConsent" as const, label: "SMS" },
                { id: "marketingConsent" as const, label: "Marketing" },
              ].map(({ id, label }) => (
                <div key={id} className="flex items-center gap-2 p-2 rounded border">
                  <Checkbox
                    id={id}
                    checked={watch(id) || false}
                    onCheckedChange={(checked) => setValue(id, !!checked)}
                  />
                  <Label htmlFor={id} className="text-sm cursor-pointer">{label}</Label>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end pt-4 border-t">
        <Button type="submit" disabled={isSubmitting} className="gap-2">
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : isEditing ? (
            "Atualizar Paciente"
          ) : (
            "Adicionar Paciente"
          )}
        </Button>
      </div>
    </form>
  );
}
