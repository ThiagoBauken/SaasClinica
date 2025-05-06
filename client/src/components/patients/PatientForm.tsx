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

const patientFormSchema = insertPatientSchema.extend({
  fullName: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido").or(z.string().length(0)),
  phone: z.string().min(8, "Telefone deve ter pelo menos 8 dígitos").or(z.string().length(0)),
  birthDate: z.string().refine(val => !val || !isNaN(Date.parse(val)), {
    message: "Data de nascimento inválida",
  }),
  gender: z.string().optional(),
  address: z.string().optional(),
  insuranceInfo: z.string().optional(),
  notes: z.string().optional(),
});

interface PatientFormProps {
  onSubmit: (data: any) => void;
  initialData?: any;
  isEditing?: boolean;
}

export default function PatientForm({ 
  onSubmit, 
  initialData, 
  isEditing = false 
}: PatientFormProps) {
  
  const defaultValues = initialData
    ? {
        ...initialData,
        birthDate: initialData.birthDate 
          ? new Date(initialData.birthDate).toISOString().split('T')[0]
          : "",
      }
    : {
        fullName: "",
        email: "",
        phone: "",
        birthDate: "",
        gender: "male",
        address: "",
        insuranceInfo: "",
        notes: "",
      };

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(patientFormSchema),
    defaultValues,
  });

  const processSubmit = (data: any) => {
    // Format birthDate as ISO string if provided
    const formattedData = {
      ...data,
      birthDate: data.birthDate ? new Date(data.birthDate).toISOString() : undefined,
    };
    
    onSubmit(formattedData);
  };

  return (
    <form onSubmit={handleSubmit(processSubmit)} className="space-y-6">
      <div className="space-y-4">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        <div>
          <Label htmlFor="address">Endereço</Label>
          <Input
            id="address"
            placeholder="Endereço completo"
            {...register("address")}
          />
        </div>

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
            placeholder="Observações adicionais sobre o paciente"
            {...register("notes")}
            rows={4}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting 
            ? "Salvando..." 
            : isEditing 
              ? "Atualizar Paciente" 
              : "Adicionar Paciente"
          }
        </Button>
      </div>
    </form>
  );
}
