/**
 * PatientRepository.ts
 * Handles all patient-related database operations.
 * Extracted from DatabaseStorage to improve maintainability.
 */

import { patients, type Patient } from "@shared/schema";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { notDeleted } from "../lib/soft-delete";
import {
  encryptField, decryptField, hmacIndex,
  PATIENT_ENCRYPTED_FIELDS,
} from "../lib/field-encryption";

// ---------------------------------------------------------------------------
// LGPD helpers — kept co-located with their only consumer
// ---------------------------------------------------------------------------

/**
 * Encrypt sensitive patient fields before persisting to the DB.
 * Fields: cpf, rg, bloodType, allergies, medications, chronicDiseases
 */
export function encryptPatientData(data: Record<string, any>): Record<string, any> {
  const result = { ...data };
  for (const field of PATIENT_ENCRYPTED_FIELDS) {
    if (result[field] != null && typeof result[field] === 'string') {
      result[field] = encryptField(result[field]);
    }
  }
  // Generate HMAC search index for CPF so WHERE queries do not require full table decryption
  if (result.cpf != null) {
    result.cpfHash = hmacIndex(data.cpf); // Use original plaintext for hash
  }
  return result;
}

/**
 * Decrypt sensitive patient fields after reading from the DB.
 */
export function decryptPatientData<T extends Record<string, any>>(patient: T): T {
  if (!patient) return patient;
  const result = { ...patient };
  for (const field of PATIENT_ENCRYPTED_FIELDS) {
    if ((result as any)[field] != null && typeof (result as any)[field] === 'string') {
      (result as any)[field] = decryptField((result as any)[field]);
    }
  }
  return result;
}

/**
 * Decrypt an array of patient records.
 */
export function decryptPatientList<T extends Record<string, any>>(rows: T[]): T[] {
  return rows.map(decryptPatientData);
}

// ---------------------------------------------------------------------------
// Repository functions
// ---------------------------------------------------------------------------

export async function getPatients(companyId: number): Promise<Patient[]> {
  const rows = await db
    .select()
    .from(patients)
    .where(and(eq(patients.companyId, companyId), notDeleted(patients.deletedAt)));
  return decryptPatientList(rows);
}

export async function getPatient(id: number, companyId: number): Promise<Patient | undefined> {
  const [patient] = await db.select({
    id: patients.id,
    companyId: patients.companyId,
    fullName: patients.fullName,
    email: patients.email,
    phone: patients.phone,
    whatsappPhone: patients.whatsappPhone,
    cpf: patients.cpf,
    birthDate: patients.birthDate,
    gender: patients.gender,
    address: patients.address,
    neighborhood: patients.neighborhood,
    city: patients.city,
    state: patients.state,
    cep: patients.cep,
    rg: patients.rg,
    profession: patients.profession,
    cellphone: patients.cellphone,
    emergencyContactName: patients.emergencyContactName,
    emergencyContactPhone: patients.emergencyContactPhone,
    emergencyContactRelation: patients.emergencyContactRelation,
    healthInsurance: patients.healthInsurance,
    healthInsuranceNumber: patients.healthInsuranceNumber,
    bloodType: patients.bloodType,
    allergies: patients.allergies,
    medications: patients.medications,
    chronicDiseases: patients.chronicDiseases,
    patientNumber: patients.patientNumber,
    status: patients.status,
    lastVisit: patients.lastVisit,
    active: patients.active,
    notes: patients.notes,
    insuranceInfo: patients.insuranceInfo,
    createdAt: patients.createdAt,
    updatedAt: patients.updatedAt,
    nationality: patients.nationality,
    maritalStatus: patients.maritalStatus,
    profilePhoto: patients.profilePhoto,
  })
    .from(patients)
    .where(
      and(eq(patients.id, id), eq(patients.companyId, companyId), notDeleted(patients.deletedAt))
    );
  return patient ? decryptPatientData(patient) : undefined;
}

export async function createPatient(patientData: any, companyId: number): Promise<Patient> {
  const encryptedData = encryptPatientData(patientData);

  const [patient] = await db
    .insert(patients)
    .values({
      ...encryptedData,
      companyId,
      createdAt: new Date(),
    })
    .returning();
  return decryptPatientData(patient);
}

export async function updatePatient(id: number, data: any, companyId: number): Promise<Patient> {
  const encryptedData = encryptPatientData(data);

  const [updatedPatient] = await db
    .update(patients)
    .set(encryptedData)
    .where(and(eq(patients.id, id), eq(patients.companyId, companyId)))
    .returning();

  if (!updatedPatient) {
    throw new Error("Patient not found");
  }

  return decryptPatientData(updatedPatient);
}
