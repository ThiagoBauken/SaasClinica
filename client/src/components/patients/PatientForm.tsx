import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { insertPatientSchema } from "@shared/schema";
import { Check, ChevronLeft, ChevronRight, Loader2, User, Phone, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const patientFormSchema = insertPatientSchema.extend({
  fullName: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.union([z.string().email("Email inválido"), z.literal(""), z.null()]).optional(),
  phone: z.union([z.string().min(8, "Telefone deve ter pelo menos 8 dígitos"), z.literal(""), z.null()]).optional(),
  cpf: z.union([z.string().min(11, "CPF inválido").max(14, "CPF inválido"), z.literal(""), z.null()]).optional(),
  birthDate: z.string().refine(val => !val || !isNaN(Date.parse(val)), {
    message: "Data de nascimento inválida",
  }),
  gender: z.string().optional(),
  address: z.string().optional(),
  insuranceInfo: z.string().optional(),
  notes: z.string().optional(),
});

type PatientFormData = z.infer<typeof patientFormSchema>;

interface PatientFormProps {
  onSubmit: (data: any) => void;
  initialData?: any;
  isEditing?: boolean;
}

const steps = [
  { id: 1, name: "Dados Pessoais", icon: User },
  { id: 2, name: "Contato", icon: Phone },
  { id: 3, name: "Informações Adicionais", icon: FileText },
];

export default function PatientForm({
  onSubmit,
  initialData,
  isEditing = false
}: PatientFormProps) {
  const [currentStep, setCurrentStep] = useState(1);

  const defaultValues = initialData
    ? {
        ...initialData,
        email: initialData.email || "",
        phone: initialData.phone || "",
        cpf: initialData.cpf || "",
        address: initialData.address || "",
        insuranceInfo: initialData.insuranceInfo || "",
        notes: initialData.notes || "",
        birthDate: initialData.birthDate
          ? new Date(initialData.birthDate).toISOString().split('T')[0]
          : "",
      }
    : {
        fullName: "",
        email: "",
        phone: "",
        cpf: "",
        birthDate: "",
        gender: "male",
        address: "",
        insuranceInfo: "",
        notes: "",
      };

  const { register, handleSubmit, formState: { errors, isSubmitting }, trigger, watch } = useForm<PatientFormData>({
    resolver: zodResolver(patientFormSchema),
    defaultValues,
    mode: "onChange",
  });

  const processSubmit = (data: PatientFormData) => {
    const formattedData = {
      ...data,
      birthDate: data.birthDate ? new Date(data.birthDate).toISOString() : undefined,
    };

    onSubmit(formattedData);
  };

  // Validate current step fields before moving to next
  const validateStep = async (step: number): Promise<boolean> => {
    let fieldsToValidate: (keyof PatientFormData)[] = [];

    switch (step) {
      case 1:
        fieldsToValidate = ["fullName", "cpf", "birthDate", "gender"];
        break;
      case 2:
        fieldsToValidate = ["email", "phone", "address"];
        break;
      case 3:
        fieldsToValidate = ["insuranceInfo", "notes"];
        break;
    }

    const isValid = await trigger(fieldsToValidate);
    return isValid;
  };

  const handleNext = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid && currentStep < 3) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const goToStep = async (step: number) => {
    if (step < currentStep) {
      setCurrentStep(step);
    } else if (step > currentStep) {
      // Validate all steps before the target step
      let canProceed = true;
      for (let i = currentStep; i < step; i++) {
        const isValid = await validateStep(i);
        if (!isValid) {
          canProceed = false;
          setCurrentStep(i);
          break;
        }
      }
      if (canProceed) {
        setCurrentStep(step);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(processSubmit)} className="space-y-6">
      {/* Step Indicator */}
      <div className="mb-8">
        <nav aria-label="Progress">
          <ol className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = currentStep > step.id;
              const isCurrent = currentStep === step.id;

              return (
                <li key={step.id} className="relative flex-1">
                  <button
                    type="button"
                    onClick={() => goToStep(step.id)}
                    className={cn(
                      "group flex flex-col items-center w-full",
                      (isCompleted || isCurrent) ? "cursor-pointer" : "cursor-default"
                    )}
                  >
                    <span className="flex items-center">
                      <span
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                          isCompleted
                            ? "border-primary bg-primary text-white"
                            : isCurrent
                            ? "border-primary text-primary"
                            : "border-muted-foreground/30 text-muted-foreground"
                        )}
                      >
                        {isCompleted ? (
                          <Check className="h-5 w-5" />
                        ) : (
                          <Icon className="h-5 w-5" />
                        )}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "mt-2 text-xs font-medium text-center",
                        isCurrent ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      {step.name}
                    </span>
                  </button>
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        "absolute top-5 left-[calc(50%+20px)] w-[calc(100%-40px)] h-0.5",
                        isCompleted ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      {/* Step 1: Dados Pessoais */}
      {currentStep === 1 && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div>
            <Label htmlFor="fullName" className="required">Nome Completo</Label>
            <Input
              id="fullName"
              placeholder="Nome completo do paciente"
              {...register("fullName")}
              className={errors.fullName ? "border-red-500" : ""}
            />
            {errors.fullName && (
              <p className="text-red-500 text-sm mt-1">{errors.fullName.message as string}</p>
            )}
          </div>

          <div>
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              placeholder="000.000.000-00"
              {...register("cpf")}
              className={errors.cpf ? "border-red-500" : ""}
            />
            {errors.cpf && (
              <p className="text-red-500 text-sm mt-1">{errors.cpf.message as string}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="birthDate">Data de Nascimento</Label>
              <Input
                id="birthDate"
                type="date"
                {...register("birthDate")}
                className={errors.birthDate ? "border-red-500" : ""}
              />
              {errors.birthDate && (
                <p className="text-red-500 text-sm mt-1">{errors.birthDate.message as string}</p>
              )}
            </div>

            <div>
              <Label htmlFor="gender">Gênero</Label>
              <Select
                defaultValue={defaultValues.gender || "male"}
                onValueChange={(value) => register("gender").onChange({ target: { value } })}
              >
                <SelectTrigger id="gender">
                  <SelectValue placeholder="Selecione o gênero" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Masculino</SelectItem>
                  <SelectItem value="female">Feminino</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Contato */}
      {currentStep === 2 && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@exemplo.com"
              {...register("email")}
              className={errors.email ? "border-red-500" : ""}
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email.message as string}</p>
            )}
          </div>

          <div>
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              placeholder="(00) 00000-0000"
              {...register("phone")}
              className={errors.phone ? "border-red-500" : ""}
            />
            {errors.phone && (
              <p className="text-red-500 text-sm mt-1">{errors.phone.message as string}</p>
            )}
          </div>

          <div>
            <Label htmlFor="address">Endereço</Label>
            <Input
              id="address"
              placeholder="Endereço completo"
              {...register("address")}
            />
          </div>
        </div>
      )}

      {/* Step 3: Informações Adicionais */}
      {currentStep === 3 && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div>
            <Label htmlFor="insuranceInfo">Informações de Convênio</Label>
            <Input
              id="insuranceInfo"
              placeholder="Convênio, plano, número da carteirinha, etc."
              {...register("insuranceInfo")}
            />
          </div>

          <div>
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Observações adicionais sobre o paciente (alergias, condições especiais, etc.)"
              {...register("notes")}
              rows={4}
            />
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={handlePrev}
          disabled={currentStep === 1}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>

        {currentStep < 3 ? (
          <Button type="button" onClick={handleNext} className="gap-2">
            Próximo
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
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
        )}
      </div>
    </form>
  );
}
