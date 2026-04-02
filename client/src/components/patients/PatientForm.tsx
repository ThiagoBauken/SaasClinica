import { useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  cpf: z.union([z.string().min(11, "CPF invalido").max(14, "CPF invalido"), z.literal(""), z.null()]).optional(),
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

  const processSubmit = (data: PatientFormData) => {
    const formattedData = {
      ...data,
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

  return (
    <form onSubmit={handleSubmit(processSubmit)} className="space-y-4">
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
          <Input id="phone" placeholder="(00) 00000-0000" {...register("phone")} className={errors.phone ? "border-red-500" : ""} />
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
            <Input id="cpf" placeholder="000.000.000-00" {...register("cpf")} className={errors.cpf ? "border-red-500" : ""} />
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
                <Input id="cellphone" placeholder="(00) 00000-0000" {...register("cellphone")} />
              </div>
              <div>
                <Label htmlFor="whatsappPhone">WhatsApp (se diferente)</Label>
                <Input id="whatsappPhone" placeholder="(00) 00000-0000" {...register("whatsappPhone")} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="emergencyContactName">Contato Emergencia</Label>
                <Input id="emergencyContactName" placeholder="Nome" {...register("emergencyContactName")} />
              </div>
              <div>
                <Label htmlFor="emergencyContactPhone">Tel. Emergencia</Label>
                <Input id="emergencyContactPhone" placeholder="(00) 00000-0000" {...register("emergencyContactPhone")} />
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
              <div>
                <Label htmlFor="cep">CEP</Label>
                <Input id="cep" placeholder="00000-000" {...register("cep")} />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="healthInsurance">Convenio</Label>
                <Input id="healthInsurance" placeholder="Nome do convenio" {...register("healthInsurance")} />
              </div>
              <div>
                <Label htmlFor="healthInsuranceNumber">N. Carteirinha</Label>
                <Input id="healthInsuranceNumber" placeholder="Numero" {...register("healthInsuranceNumber")} />
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

          {/* Observacoes */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground border-b pb-1">Observacoes</h4>
            <div>
              <Label htmlFor="notes">Observacoes Gerais</Label>
              <Textarea id="notes" placeholder="Observacoes adicionais sobre o paciente" {...register("notes")} rows={2} />
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
