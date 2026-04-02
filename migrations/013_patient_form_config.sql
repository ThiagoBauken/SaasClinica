-- Migration 013: Patient Form Configuration
-- Allows clinics to configure which patient form fields are required, optional, or hidden

BEGIN;

ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS patient_form_config JSONB DEFAULT '{
  "fullName": "required",
  "socialName": "optional",
  "cpf": "optional",
  "rg": "optional",
  "birthDate": "optional",
  "gender": "optional",
  "nationality": "hidden",
  "maritalStatus": "optional",
  "profession": "optional",
  "email": "optional",
  "phone": "required",
  "cellphone": "optional",
  "whatsappPhone": "optional",
  "emergencyContactName": "optional",
  "emergencyContactPhone": "optional",
  "emergencyContactRelation": "optional",
  "cep": "optional",
  "address": "optional",
  "neighborhood": "optional",
  "city": "optional",
  "state": "optional",
  "healthInsurance": "optional",
  "healthInsuranceNumber": "optional",
  "bloodType": "optional",
  "allergies": "optional",
  "medications": "optional",
  "chronicDiseases": "optional",
  "responsibleName": "optional",
  "responsibleCpf": "optional",
  "responsibleRelationship": "optional",
  "referralSource": "optional",
  "treatmentType": "optional",
  "preferredTimeSlot": "optional",
  "notes": "optional",
  "dataProcessingConsent": "optional",
  "whatsappConsent": "optional",
  "emailConsent": "optional",
  "smsConsent": "optional",
  "marketingConsent": "optional"
}'::jsonb;

COMMIT;
