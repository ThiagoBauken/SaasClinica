// Application specific types beyond schema types

export type CalendarViewType = 'day' | 'week' | 'month' | 'room';

// Odontograma types
export type ToothType = 'permanente' | 'deciduo';
export type ToothGroup = 'incisivo' | 'canino' | 'premolar' | 'molar';
export type ToothPosition = 'superior' | 'inferior';
export type ToothSide = 'vestibular' | 'lingual' | 'mesial' | 'distal' | 'oclusal' | 'incisal' | 'cervical' | 'raiz';
export type ToothStatus = 'saudavel' | 'cariado' | 'restaurado' | 'ausente' | 'implante' | 'tratamento-canal' | 'coroa' | 'extrair' | 'protese';

export interface Tooth {
  id: number;
  number: string;
  type: ToothType;
  group: ToothGroup;
  position: ToothPosition;
  status?: ToothStatus;
  procedures?: Array<OdontogramProcedure>;
}

export interface OdontogramProcedure {
  id: number;
  toothId: number;
  procedureId: number;
  side?: ToothSide;
  status: 'aberto' | 'finalizado';
  date: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type AppointmentStatusType = 
  | 'scheduled' 
  | 'confirmed' 
  | 'in_progress' 
  | 'completed' 
  | 'cancelled' 
  | 'no_show';

export interface AppointmentWithRelations {
  id: number;
  title: string;
  patientId: number | null;
  professionalId: number | null;
  roomId: number | null;
  startTime: string;
  endTime: string;
  status: AppointmentStatusType;
  type: 'appointment' | 'block' | 'reminder';
  notes?: string;
  color?: string;
  recurring: boolean;
  recurrencePattern?: string;
  automationEnabled: boolean;
  automationParams?: any;
  createdAt: string;
  updatedAt: string;
  
  // Relations
  patient?: {
    id: number;
    fullName: string;
    phone?: string;
  };
  professional?: {
    id: number;
    fullName: string;
    speciality?: string;
  };
  room?: {
    id: number;
    name: string;
  };
  procedures?: Array<{
    id: number;
    name: string;
    duration: number;
    price: number;
  }>;
}

export interface TimeSlot {
  time: string; // "HH:MM" format
  label?: string;
  isLunchBreak?: boolean;
  isSelected?: boolean;
  appointments: Record<number, AppointmentWithRelations | null>; // Map of professionalId to appointment
}

export interface DayLoad {
  date: string;
  load: 'available' | 'moderate' | 'busy' | 'full';
  percentage: number;
  appointments: number;
  capacity: number;
}

export interface ProfessionalSummary {
  id: number;
  fullName: string;
  speciality?: string;
  profileImageUrl?: string;
  roomName?: string;
  load: number; // 0-100 percentage
  status: 'available' | 'moderate' | 'busy' | 'full';
}

export interface AutomationFormData {
  id?: number;
  name: string;
  triggerType: string;
  timeBeforeValue?: number;
  timeBeforeUnit?: string;
  appointmentStatus?: string;
  whatsappEnabled: boolean;
  whatsappTemplateId?: string;
  whatsappTemplateVariables?: string;
  emailEnabled: boolean;
  emailSender?: string;
  emailSubject?: string;
  emailBody?: string;
  smsEnabled: boolean;
  smsText?: string;
  webhookUrl?: string;
  customHeaders?: {name: string; value: string}[];
  responseActions?: {
    confirmIfPositive?: boolean;
    notifyIfNegative?: boolean;
    [key: string]: any;
  };
  logLevel: string;
  active: boolean;
}
