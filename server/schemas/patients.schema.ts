import { z } from 'zod';

/**
 * Schema para criação de paciente
 */
export const createPatientSchema = z.object({
  // Aceita tanto 'fullName' quanto 'name' para compatibilidade
  fullName: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(255).optional(),
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(255).optional(),
  email: z.string().email('Email inválido').optional().nullable(),
  phone: z.string().optional().nullable(),
  cpf: z.string().optional().nullable(),
  birthDate: z.union([z.string(), z.date()]).optional().nullable(),
  gender: z.string().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().optional().nullable(),
  zipCode: z.string().max(10).optional().nullable(),
  notes: z.string().optional().nullable(),
  healthInsurance: z.string().max(100).optional().nullable(),
  healthInsuranceNumber: z.string().max(50).optional().nullable(),
  emergencyContact: z.string().max(100).optional().nullable(),
  emergencyPhone: z.string().max(20).optional().nullable(),
}).transform((data) => {
  // Normaliza: se 'name' foi enviado mas 'fullName' não, usar 'name' como 'fullName'
  const fullName = data.fullName || data.name;
  if (!fullName) {
    throw new Error('Nome é obrigatório (fullName ou name)');
  }
  return { ...data, fullName, name: undefined };
});

/**
 * Schema para atualização de paciente
 */
export const updatePatientSchema = z.object({
  fullName: z.string().min(3).max(255).optional(),
  name: z.string().min(3).max(255).optional(),
  email: z.string().email('Email inválido').optional().nullable(),
  phone: z.string().optional().nullable(),
  cpf: z.string().optional().nullable(),
  birthDate: z.union([z.string(), z.date()]).optional().nullable(),
  gender: z.string().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().optional().nullable(),
  zipCode: z.string().max(10).optional().nullable(),
  notes: z.string().optional().nullable(),
  healthInsurance: z.string().max(100).optional().nullable(),
  healthInsuranceNumber: z.string().max(50).optional().nullable(),
  emergencyContact: z.string().max(100).optional().nullable(),
  emergencyPhone: z.string().max(20).optional().nullable(),
}).partial();

/**
 * Schema para filtros de busca de pacientes
 */
export const searchPatientsSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['active', 'inactive', 'all']).optional().default('active'),
  hasHealthInsurance: z.string().transform(val => val === 'true').optional(),
});

/**
 * Schema para anamnese
 */
export const createAnamnesisSchema = z.object({
  patientId: z.number().int().positive(),
  chiefComplaint: z.string().min(1),
  medicalHistory: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
  medications: z.string().optional().nullable(),
  previousDentalTreatment: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateAnamnesisSchema = createAnamnesisSchema.partial().omit({ patientId: true });
