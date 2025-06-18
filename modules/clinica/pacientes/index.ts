// Módulo de Pacientes
import { ModuleDefinition } from '../../index';

export const pacientesModule: ModuleDefinition = {
  id: 'pacientes',
  name: 'pacientes',
  displayName: 'Gestão de Pacientes',
  version: '1.0.0',
  description: 'Cadastro e gerenciamento de pacientes e prontuários',
  icon: 'Users',
  dependencies: ['clinica'],
  permissions: ['pacientes:read', 'pacientes:write', 'pacientes:delete', 'pacientes:admin'],
  routes: [
    '/api/pacientes/patients',
    '/api/pacientes/medical-records',
    '/api/pacientes/treatments'
  ],
  components: [
    'PatientList',
    'PatientForm',
    'MedicalRecord',
    'TreatmentHistory'
  ]
};

export interface Patient {
  id: number;
  name: string;
  cpf: string;
  email: string;
  phone: string;
  birthDate: Date;
  address: string;
  emergencyContact: string;
  allergies?: string;
  medicalHistory?: string;
  status: 'active' | 'inactive';
}