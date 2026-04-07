import { z } from 'zod';

// ─── CPF Validator ────────────────────────────────────────────────────────────
// Will be extracted to a shared validator module once one is established.
// Implements the standard two-digit Modulo-11 check defined by Receita Federal.
function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  // Reject sequences of all identical digits (e.g. 111.111.111-11)
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  return remainder === parseInt(digits[10]);
}

// ─── Allergy Sub-Schema ───────────────────────────────────────────────────────
/**
 * Structured allergy entry stored in the `allergies_structured` JSONB column.
 * severity levels match the UI severity selector and the DB enum convention.
 */
export const allergyItemSchema = z.object({
  name: z.string().min(1, 'Nome da alergia é obrigatório'),
  severity: z.enum(['leve', 'moderada', 'grave', 'desconhecida']),
  notes: z.string().optional(),
});

export type AllergyItem = z.infer<typeof allergyItemSchema>;

// ─── Shared optional string / number helpers ──────────────────────────────────
const optStr = z.string().optional().nullable();
const optNum = z.number().int().optional().nullable();

// ─── Create Patient Schema ────────────────────────────────────────────────────
/**
 * Validates the request body for POST /api/v1/patients.
 *
 * Rules applied beyond basic type checks:
 *  - fullName is required (accepts either `fullName` or `name` for API compat)
 *  - CPF, when provided, must pass Receita Federal Modulo-11 check
 *  - Patients under 18 must supply a responsible party (name + CPF)
 */
export const createPatientSchema = z
  .object({
    // ── Identity (accept both field names for back-compat) ───────────────────
    fullName: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(255).optional(),
    name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(255).optional(),

    // ── Contact ──────────────────────────────────────────────────────────────
    email: z.string().email('Email inválido').optional().nullable(),
    phone: optStr,
    cellphone: optStr,
    whatsappPhone: optStr,

    // ── Identification ───────────────────────────────────────────────────────
    cpf: z
      .string()
      .optional()
      .nullable()
      .refine((val) => !val || isValidCPF(val), { message: 'CPF inválido' }),
    rg: optStr,
    birthDate: z.union([z.string(), z.date()]).optional().nullable(),
    gender: optStr,
    nationality: optStr,
    maritalStatus: optStr,
    profession: optStr,
    socialName: optStr,

    // ── Address ──────────────────────────────────────────────────────────────
    address: z.string().max(500).optional().nullable(),
    neighborhood: optStr,
    city: z.string().max(100).optional().nullable(),
    state: optStr,
    zipCode: z.string().max(10).optional().nullable(), // maps to `cep` column alias
    cep: z.string().max(9).optional().nullable(),

    // ── Health ───────────────────────────────────────────────────────────────
    healthInsurance: z.string().max(100).optional().nullable(),
    healthInsuranceNumber: z.string().max(50).optional().nullable(),
    bloodType: optStr,
    allergies: optStr,
    allergiesStructured: z.array(allergyItemSchema).optional().nullable(),
    medications: optStr,
    chronicDiseases: optStr,

    // ── Emergency Contact ────────────────────────────────────────────────────
    emergencyContact: z.string().max(100).optional().nullable(),  // legacy field
    emergencyPhone: z.string().max(20).optional().nullable(),     // legacy field

    // ── Minor's Responsible Party ─────────────────────────────────────────────
    responsibleName: optStr,
    responsibleCpf: z
      .string()
      .optional()
      .nullable()
      .refine((val) => !val || isValidCPF(val), {
        message: 'CPF do responsável inválido',
      }),
    responsibleRelationship: optStr,

    // ── Referral / Marketing ──────────────────────────────────────────────────
    referralSource: optStr,
    referredByPatientId: optNum,

    // ── Reference Physician ───────────────────────────────────────────────────
    referenceDoctorName: optStr,
    referenceDoctorPhone: optStr,

    // ── Preferences ──────────────────────────────────────────────────────────
    preferredTimeSlot: optStr,
    treatmentType: optStr,

    // ── General ──────────────────────────────────────────────────────────────
    notes: optStr,
  })
  .transform((data) => {
    // Normalise: accept `name` when `fullName` is absent
    const fullName = data.fullName || data.name;
    if (!fullName) {
      throw new Error('Nome é obrigatório (fullName ou name)');
    }

    // Age-gating: minors require a responsible party
    if (data.birthDate) {
      const birthDate = new Date(data.birthDate as string);
      const ageYears = Math.floor(
        (Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );
      if (ageYears < 18 && (!data.responsibleName || !data.responsibleCpf)) {
        throw new Error(
          'Responsável financeiro obrigatório para menores de 18 anos'
        );
      }
    }

    return { ...data, fullName, name: undefined };
  });

// ─── Update Patient Schema ────────────────────────────────────────────────────
/**
 * Validates the request body for PUT /api/v1/patients/:id.
 * All fields are optional; CPF validation fires only when a value is provided.
 */
export const updatePatientSchema = z
  .object({
    fullName: z.string().min(3).max(255).optional(),
    name: z.string().min(3).max(255).optional(),

    email: z.string().email('Email inválido').optional().nullable(),
    phone: optStr,
    cellphone: optStr,
    whatsappPhone: optStr,

    cpf: z
      .string()
      .optional()
      .nullable()
      .refine((val) => !val || isValidCPF(val), { message: 'CPF inválido' }),
    rg: optStr,
    birthDate: z.union([z.string(), z.date()]).optional().nullable(),
    gender: optStr,
    nationality: optStr,
    maritalStatus: optStr,
    profession: optStr,
    socialName: optStr,

    address: z.string().max(500).optional().nullable(),
    neighborhood: optStr,
    city: z.string().max(100).optional().nullable(),
    state: optStr,
    zipCode: z.string().max(10).optional().nullable(),
    cep: z.string().max(9).optional().nullable(),

    healthInsurance: z.string().max(100).optional().nullable(),
    healthInsuranceNumber: z.string().max(50).optional().nullable(),
    bloodType: optStr,
    allergies: optStr,
    allergiesStructured: z.array(allergyItemSchema).optional().nullable(),
    medications: optStr,
    chronicDiseases: optStr,

    emergencyContact: z.string().max(100).optional().nullable(),
    emergencyPhone: z.string().max(20).optional().nullable(),

    responsibleName: optStr,
    responsibleCpf: z
      .string()
      .optional()
      .nullable()
      .refine((val) => !val || isValidCPF(val), {
        message: 'CPF do responsável inválido',
      }),
    responsibleRelationship: optStr,

    referralSource: optStr,
    referredByPatientId: optNum,

    referenceDoctorName: optStr,
    referenceDoctorPhone: optStr,

    preferredTimeSlot: optStr,
    treatmentType: optStr,

    notes: optStr,
  })
  .partial();

// ─── Search Patients Schema ───────────────────────────────────────────────────
/**
 * Validates query-string parameters for GET /api/v1/patients.
 */
export const searchPatientsSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['active', 'inactive', 'all']).optional().default('active'),
  hasHealthInsurance: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

// ─── Anamnesis Schemas ────────────────────────────────────────────────────────
/**
 * Validates the full anamnesis form (POST /api/v1/patients/:id/anamnesis).
 *
 * Fields map directly to the `anamnesis` table columns in shared/schema.ts.
 * All clinical fields are optional because the form may be filled in stages.
 */
export const createAnamnesisSchema = z.object({
  patientId: z.number().int().positive(),

  // ── Chief Complaint ───────────────────────────────────────────────────────
  chiefComplaint: z.string().min(1),
  currentIllnessHistory: optStr,

  // ── Medical History ───────────────────────────────────────────────────────
  medicalHistory: optStr,
  currentMedications: optStr,
  allergiesDetail: optStr,
  allergies: optStr,           // legacy alias still accepted
  medications: optStr,         // legacy alias
  previousSurgeries: optStr,
  hospitalizations: optStr,
  previousDentalTreatment: optStr, // legacy alias

  // ── Dental History ────────────────────────────────────────────────────────
  dentalHistory: optStr,
  previousDentalTreatments: optStr,
  orthodonticTreatment: z.boolean().optional(),
  oralHygieneFequency: optStr,

  // ── Habits ───────────────────────────────────────────────────────────────
  smoking: z.boolean().optional(),
  smokingFrequency: optStr,
  alcohol: z.boolean().optional(),
  alcoholFrequency: optStr,
  bruxism: z.boolean().optional(),
  nailBiting: z.boolean().optional(),
  drugUse: z.boolean().optional(),

  // ── Systemic Conditions ───────────────────────────────────────────────────
  heartDisease: z.boolean().optional(),
  highBloodPressure: z.boolean().optional(),
  diabetes: z.boolean().optional(),
  hepatitis: z.boolean().optional(),
  kidney_disease: z.boolean().optional(),
  hivAids: z.boolean().optional(),
  anemiaFlag: z.boolean().optional(),
  asthma: z.boolean().optional(),
  epilepsy: z.boolean().optional(),
  thyroidDisorder: z.boolean().optional(),
  cancerHistory: z.boolean().optional(),
  cancerType: optStr,
  radiationTherapy: z.boolean().optional(),

  // ── Pregnancy ────────────────────────────────────────────────────────────
  pregnant: z.boolean().optional(),
  pregnancyMonth: z.number().int().min(1).max(9).optional().nullable(),

  // ── Surgical-Risk Flags ───────────────────────────────────────────────────
  anticoagulantUse: z.boolean().optional(),
  anticoagulantName: optStr,
  bisphosphonateUse: z.boolean().optional(),
  prostheticHeartValve: z.boolean().optional(),
  rheumaticFever: z.boolean().optional(),
  bleedingDisorder: z.boolean().optional(),

  // ── Vital Signs ───────────────────────────────────────────────────────────
  bloodPressureSystolic: z
    .number()
    .int()
    .min(50)
    .max(300)
    .optional()
    .nullable(),
  bloodPressureDiastolic: z
    .number()
    .int()
    .min(30)
    .max(200)
    .optional()
    .nullable(),
  weight: optStr,   // stored as text in DB
  height: optStr,   // stored as text in DB

  // ── Dental Anxiety ────────────────────────────────────────────────────────
  dentalAnxietyLevel: z.number().int().min(0).max(10).optional().nullable(),

  // ── Scheduling ───────────────────────────────────────────────────────────
  lastDentalVisit: z.union([z.string(), z.date()]).optional().nullable(),

  // ── Additional ───────────────────────────────────────────────────────────
  additionalInfo: optStr,
  notes: optStr,
});

export const updateAnamnesisSchema = createAnamnesisSchema
  .partial()
  .omit({ patientId: true });
