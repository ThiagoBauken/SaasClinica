import { z } from 'zod';

/**
 * Schema para criação de paciente
 */
export const createPatientSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(255),
  email: z.string().email('Email inválido').optional().nullable(),
  phone: z.string().min(10, 'Telefone deve ter no mínimo 10 dígitos').max(20).optional().nullable(),
  cpf: z.string().length(11, 'CPF deve ter 11 dígitos').optional().nullable(),
  birthDate: z.string().datetime().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().length(2).optional().nullable(),
  zipCode: z.string().max(10).optional().nullable(),
  notes: z.string().optional().nullable(),
  healthInsurance: z.string().max(100).optional().nullable(),
  healthInsuranceNumber: z.string().max(50).optional().nullable(),
  emergencyContact: z.string().max(100).optional().nullable(),
  emergencyPhone: z.string().max(20).optional().nullable(),
});

/**
 * Schema para atualização de paciente
 */
export const updatePatientSchema = createPatientSchema.partial();

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
