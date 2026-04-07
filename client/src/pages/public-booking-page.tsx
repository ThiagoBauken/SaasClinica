/**
 * Public Online Booking Page
 *
 * A standalone, no-auth multi-step form that lets patients self-schedule
 * appointments. Accessed via /agendar/:companyId.
 *
 * Steps:
 *   1 — Select Procedure
 *   2 — Select Date & Time
 *   3 — Patient Info
 *   4 — Confirmation & success
 */

import React, { useState, useCallback } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  format,
  addDays,
  isSameDay,
  parseISO,
  isToday,
  isTomorrow,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  FileText,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Loader2,
  MapPin,
  Stethoscope,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Procedure {
  id: number;
  name: string;
  duration: number;
  price: number;
  description: string | null;
  color: string | null;
  category: string | null;
}

interface Professional {
  id: number;
  fullName: string;
  speciality: string | null;
  profileImageUrl: string | null;
}

interface ClinicInfo {
  clinicName: string;
  clinicPhone: string | null;
  clinicAddress: string | null;
  clinicLogo: string | null;
  procedures: Procedure[];
  professionals: Professional[];
}

interface TimeSlot {
  startTime: string;
  endTime: string;
  professionalId: number;
  professionalName: string;
}

interface PatientForm {
  name: string;
  phone: string;
  email: string;
  cpf: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

function formatDateLabel(date: Date): string {
  if (isToday(date)) return 'Hoje';
  if (isTomorrow(date)) return 'Amanha';
  return format(date, "EEE, dd/MM", { locale: ptBR });
}

function formatSlotTime(iso: string): string {
  return format(parseISO(iso), 'HH:mm');
}

function formatFullDateTime(startIso: string): string {
  const d = parseISO(startIso);
  return format(d, "EEEE, dd 'de' MMMM 'de' yyyy 'as' HH:mm", { locale: ptBR });
}

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEPS = [
  { label: 'Procedimento', icon: Stethoscope },
  { label: 'Data e Hora', icon: Calendar },
  { label: 'Seus Dados', icon: User },
  { label: 'Confirmar', icon: CheckCircle2 },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((step, idx) => {
        const Icon = step.icon;
        const isCompleted = idx < current;
        const isActive = idx === current;

        return (
          <React.Fragment key={idx}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors',
                  isCompleted
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : isActive
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-200 text-gray-400',
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <span
                className={cn(
                  'text-xs font-medium hidden sm:block',
                  isActive ? 'text-blue-600' : isCompleted ? 'text-emerald-600' : 'text-gray-400',
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-1 mb-4 transition-colors',
                  idx < current ? 'bg-emerald-400' : 'bg-gray-200',
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clinic header (shared across steps)
// ---------------------------------------------------------------------------

function ClinicHeader({ info }: { info: ClinicInfo | undefined }) {
  if (!info) return null;
  return (
    <div className="flex flex-col items-center gap-2 mb-6">
      {info.clinicLogo ? (
        <img
          src={info.clinicLogo}
          alt={info.clinicName}
          className="h-14 w-auto object-contain"
        />
      ) : (
        <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
          <Stethoscope className="w-7 h-7 text-blue-600" />
        </div>
      )}
      <h1 className="text-xl font-bold text-gray-900 text-center">{info.clinicName}</h1>
      {info.clinicAddress && (
        <p className="text-xs text-gray-500 flex items-center gap-1 text-center">
          <MapPin className="w-3 h-3" />
          {info.clinicAddress}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Select Procedure
// ---------------------------------------------------------------------------

function StepProcedure({
  procedures,
  selectedId,
  onSelect,
}: {
  procedures: Procedure[];
  selectedId: number | null;
  onSelect: (p: Procedure) => void;
}) {
  const categoryColors: Record<string, string> = {
    ortodontia: 'bg-purple-100 text-purple-700',
    prevencao: 'bg-green-100 text-green-700',
    estetica: 'bg-pink-100 text-pink-700',
    cirurgia: 'bg-red-100 text-red-700',
    emergencia: 'bg-orange-100 text-orange-700',
    geral: 'bg-blue-100 text-blue-700',
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Selecione o Procedimento</h2>
      <p className="text-sm text-gray-500 mb-4">Escolha o tipo de consulta que deseja agendar</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {procedures.map((proc) => {
          const isSelected = proc.id === selectedId;
          const catClass =
            proc.category && categoryColors[proc.category]
              ? categoryColors[proc.category]
              : 'bg-gray-100 text-gray-700';

          return (
            <button
              key={proc.id}
              onClick={() => onSelect(proc)}
              className={cn(
                'text-left p-4 rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500',
                isSelected
                  ? 'border-blue-600 bg-blue-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{proc.name}</p>
                  {proc.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{proc.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      {formatDuration(proc.duration)}
                    </span>
                    {proc.price > 0 && (
                      <span className="text-xs font-medium text-emerald-700">
                        {formatPrice(proc.price)}
                      </span>
                    )}
                    {proc.category && (
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', catClass)}>
                        {proc.category}
                      </span>
                    )}
                  </div>
                </div>
                {isSelected && (
                  <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Select Date & Time
// ---------------------------------------------------------------------------

function StepDateTime({
  companyId,
  procedure,
  selectedDate,
  setSelectedDate,
  selectedSlot,
  setSelectedSlot,
}: {
  companyId: string;
  procedure: Procedure;
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  selectedSlot: TimeSlot | null;
  setSelectedSlot: (s: TimeSlot | null) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  const dateParam = format(selectedDate, 'yyyy-MM-dd');

  const { data: slotsData, isLoading: slotsLoading, isError: slotsError } = useQuery({
    queryKey: [
      `/api/public/booking/${companyId}/slots`,
      dateParam,
      procedure.id,
    ],
    queryFn: async () => {
      const url = `/api/public/booking/${companyId}/slots?date=${dateParam}&procedureId=${procedure.id}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Erro ao buscar horarios');
      return resp.json() as Promise<{ slots: TimeSlot[] }>;
    },
    staleTime: 60 * 1000,
  });

  const slots = slotsData?.slots ?? [];

  const handleDaySelect = (day: Date) => {
    setSelectedDate(day);
    setSelectedSlot(null);
  };

  // Group slots by professional
  const slotsByPro: Record<string, TimeSlot[]> = {};
  slots.forEach((s) => {
    const key = `${s.professionalId}:${s.professionalName}`;
    if (!slotsByPro[key]) slotsByPro[key] = [];
    slotsByPro[key].push(s);
  });

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Selecione a Data e Hora</h2>
      <p className="text-sm text-gray-500 mb-4">
        Procedimento: <strong>{procedure.name}</strong> ({formatDuration(procedure.duration)})
      </p>

      {/* Day picker */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 -mx-1 px-1 snap-x">
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const dayOfWeek = day.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDaySelect(day)}
              className={cn(
                'flex flex-col items-center min-w-[56px] px-2 py-2.5 rounded-xl border-2 transition-all snap-start flex-shrink-0',
                isSelected
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : isWeekend
                  ? 'border-gray-100 bg-gray-50 text-gray-400'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300',
              )}
            >
              <span className="text-[10px] uppercase font-semibold">
                {DAY_NAMES[dayOfWeek]}
              </span>
              <span className="text-lg font-bold leading-none mt-0.5">
                {format(day, 'd')}
              </span>
              <span className="text-[10px] mt-0.5">
                {format(day, 'MMM', { locale: ptBR })}
              </span>
            </button>
          );
        })}
      </div>

      {/* Slots */}
      <div className="min-h-[120px]">
        {slotsLoading ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <span className="text-sm">Buscando horarios disponíveis...</span>
          </div>
        ) : slotsError ? (
          <div className="flex flex-col items-center justify-center py-10 text-red-400">
            <AlertCircle className="w-6 h-6 mb-2" />
            <span className="text-sm">Erro ao carregar horarios. Tente novamente.</span>
          </div>
        ) : slots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <Calendar className="w-6 h-6 mb-2" />
            <span className="text-sm">Nenhum horario disponível para este dia.</span>
            <span className="text-xs mt-1">Tente outra data.</span>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(slotsByPro).map(([proKey, proSlots]) => {
              const proName = proKey.split(':').slice(1).join(':');
              return (
                <div key={proKey}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <User className="w-3 h-3" />
                    {proName}
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {proSlots.map((slot) => {
                      const isSelected =
                        selectedSlot?.startTime === slot.startTime &&
                        selectedSlot?.professionalId === slot.professionalId;
                      return (
                        <button
                          key={slot.startTime}
                          onClick={() => setSelectedSlot(isSelected ? null : slot)}
                          className={cn(
                            'py-2 rounded-lg border-2 text-sm font-semibold transition-all',
                            isSelected
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50',
                          )}
                        >
                          {formatSlotTime(slot.startTime)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Patient Info
// ---------------------------------------------------------------------------

function StepPatientInfo({
  form,
  onChange,
  errors,
}: {
  form: PatientForm;
  onChange: (field: keyof PatientForm, value: string) => void;
  errors: Partial<Record<keyof PatientForm, string>>;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Seus Dados</h2>
      <p className="text-sm text-gray-500 mb-5">
        Preencha suas informacoes para concluir o agendamento
      </p>

      <div className="space-y-4">
        <div>
          <Label htmlFor="pb-name" className="text-sm font-medium text-gray-700">
            Nome completo <span className="text-red-500">*</span>
          </Label>
          <div className="relative mt-1">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              id="pb-name"
              value={form.name}
              onChange={(e) => onChange('name', e.target.value)}
              placeholder="Ex: Maria da Silva"
              className={cn('pl-9', errors.name && 'border-red-400')}
            />
          </div>
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
        </div>

        <div>
          <Label htmlFor="pb-phone" className="text-sm font-medium text-gray-700">
            WhatsApp / Telefone <span className="text-red-500">*</span>
          </Label>
          <div className="relative mt-1">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              id="pb-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => onChange('phone', e.target.value)}
              placeholder="Ex: 11999998888"
              className={cn('pl-9', errors.phone && 'border-red-400')}
            />
          </div>
          {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
          <p className="text-xs text-gray-400 mt-1">
            Voce recebera a confirmacao neste numero
          </p>
        </div>

        <div>
          <Label htmlFor="pb-email" className="text-sm font-medium text-gray-700">
            E-mail <span className="text-gray-400 text-xs font-normal">(opcional)</span>
          </Label>
          <div className="relative mt-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              id="pb-email"
              type="email"
              value={form.email}
              onChange={(e) => onChange('email', e.target.value)}
              placeholder="Ex: maria@email.com"
              className={cn('pl-9', errors.email && 'border-red-400')}
            />
          </div>
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
        </div>

        <div>
          <Label htmlFor="pb-cpf" className="text-sm font-medium text-gray-700">
            CPF <span className="text-gray-400 text-xs font-normal">(opcional)</span>
          </Label>
          <div className="relative mt-1">
            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              id="pb-cpf"
              value={form.cpf}
              onChange={(e) => onChange('cpf', e.target.value)}
              placeholder="Ex: 123.456.789-01"
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-5 leading-relaxed">
        Seus dados sao utilizados apenas para o agendamento e estao protegidos
        conforme a LGPD.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Summary & Confirmation
// ---------------------------------------------------------------------------

function StepConfirmation({
  procedure,
  slot,
  form,
  onConfirm,
  isLoading,
  error,
}: {
  procedure: Procedure;
  slot: TimeSlot;
  form: PatientForm;
  onConfirm: () => void;
  isLoading: boolean;
  error: string | null;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Confirme seu Agendamento</h2>
      <p className="text-sm text-gray-500 mb-5">Verifique os detalhes antes de confirmar</p>

      <Card className="mb-5 border-blue-100 bg-blue-50/40">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Stethoscope className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Procedimento</p>
              <p className="text-sm font-semibold text-gray-900">{procedure.name}</p>
              <p className="text-xs text-gray-500">{formatDuration(procedure.duration)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Data e hora</p>
              <p className="text-sm font-semibold text-gray-900 capitalize">
                {formatFullDateTime(slot.startTime)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <User className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Profissional</p>
              <p className="text-sm font-semibold text-gray-900">{slot.professionalName}</p>
            </div>
          </div>

          <div className="border-t border-blue-100 pt-3 flex items-start gap-3">
            <User className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Paciente</p>
              <p className="text-sm font-semibold text-gray-900">{form.name}</p>
              <p className="text-xs text-gray-500">{form.phone}</p>
              {form.email && <p className="text-xs text-gray-500">{form.email}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 mb-4">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <Button
        onClick={onConfirm}
        disabled={isLoading}
        className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Confirmando...
          </>
        ) : (
          'Confirmar Agendamento'
        )}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Success screen
// ---------------------------------------------------------------------------

function SuccessScreen({
  patientName,
  procedure,
  slot,
  clinicName,
  onNewBooking,
}: {
  patientName: string;
  procedure: Procedure;
  slot: TimeSlot;
  clinicName: string;
  onNewBooking: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center py-4">
      <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
        <CheckCircle2 className="w-10 h-10 text-emerald-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Agendamento Confirmado!</h2>
      <p className="text-gray-600 mb-1">
        Obrigado, <strong>{patientName.split(' ')[0]}</strong>!
      </p>
      <p className="text-sm text-gray-500 mb-6">
        Voce recebera uma confirmacao pelo WhatsApp em breve.
      </p>

      <Card className="w-full border-emerald-100 bg-emerald-50/40 mb-6">
        <CardContent className="p-4 space-y-2 text-left">
          <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
            Resumo do agendamento
          </p>
          <div className="space-y-2 mt-2">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Stethoscope className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              {procedure.name}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Calendar className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="capitalize">{formatFullDateTime(slot.startTime)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <User className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              {slot.professionalName}
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-gray-400 mb-6">
        Em caso de duvidas, entre em contato com a {clinicName}.
      </p>

      <Button
        variant="outline"
        onClick={onNewBooking}
        className="w-full border-gray-300 text-gray-700"
      >
        Fazer Novo Agendamento
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function PublicBookingPage() {
  const { companyId } = useParams<{ companyId: string }>();

  // Wizard state
  const [step, setStep] = useState(0);
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [patientForm, setPatientForm] = useState<PatientForm>({
    name: '',
    phone: '',
    email: '',
    cpf: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof PatientForm, string>>>({});
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookedPatientName, setBookedPatientName] = useState('');

  // Fetch clinic info
  const { data: clinicInfo, isLoading: infoLoading, isError: infoError } = useQuery({
    queryKey: [`/api/public/booking/${companyId}/info`],
    queryFn: async () => {
      const resp = await fetch(`/api/public/booking/${companyId}/info`);
      if (!resp.ok) throw new Error('Clinica nao encontrada');
      return resp.json() as Promise<ClinicInfo>;
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  // Booking mutation
  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProcedure || !selectedSlot) throw new Error('Dados incompletos');
      const body = {
        patientName: patientForm.name.trim(),
        patientPhone: patientForm.phone.replace(/\D/g, ''),
        patientCpf: patientForm.cpf.replace(/\D/g, '') || null,
        patientEmail: patientForm.email.trim() || null,
        procedureId: selectedProcedure.id,
        professionalId: selectedSlot.professionalId,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
      };
      const resp = await fetch(`/api/public/booking/${companyId}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error ?? 'Erro ao criar agendamento');
      }
      return data as { success: boolean; patientName: string };
    },
    onSuccess: (data) => {
      setBookedPatientName(data.patientName ?? patientForm.name);
      setBookingSuccess(true);
      setBookingError(null);
    },
    onError: (err: Error) => {
      setBookingError(err.message ?? 'Ocorreu um erro ao criar o agendamento. Tente novamente.');
    },
  });

  // Form field change handler
  const handleFormChange = useCallback(
    (field: keyof PatientForm, value: string) => {
      setPatientForm((prev) => ({ ...prev, [field]: value }));
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    [],
  );

  // Validate patient form
  function validatePatientForm(): boolean {
    const errors: Partial<Record<keyof PatientForm, string>> = {};

    if (!patientForm.name.trim() || patientForm.name.trim().length < 2) {
      errors.name = 'Nome obrigatorio (minimo 2 caracteres)';
    }

    const phoneDigits = patientForm.phone.replace(/\D/g, '');
    if (!phoneDigits || phoneDigits.length < 8) {
      errors.phone = 'Telefone invalido';
    }

    if (patientForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientForm.email)) {
      errors.email = 'Email invalido';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // Step navigation
  function handleNext() {
    if (step === 0 && !selectedProcedure) return;
    if (step === 1 && !selectedSlot) return;
    if (step === 2) {
      if (!validatePatientForm()) return;
    }
    setStep((s) => s + 1);
  }

  function handleBack() {
    setBookingError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  function handleNewBooking() {
    setStep(0);
    setSelectedProcedure(null);
    setSelectedSlot(null);
    setPatientForm({ name: '', phone: '', email: '', cpf: '' });
    setFormErrors({});
    setBookingError(null);
    setBookingSuccess(false);
    setBookedPatientName('');
  }

  // Can proceed flags
  const canProceedStep0 = !!selectedProcedure;
  const canProceedStep1 = !!selectedSlot;
  const canProceedStep2 = true; // validation happens on Next click

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (infoLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (infoError || !clinicInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-center text-gray-500">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <h2 className="font-semibold text-gray-700">Clinica nao encontrada</h2>
          <p className="text-sm">
            Verifique o link ou entre em contato com a clinica.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Clinic header */}
        <ClinicHeader info={clinicInfo} />

        {/* Main card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
          {bookingSuccess && selectedProcedure && selectedSlot ? (
            <SuccessScreen
              patientName={bookedPatientName}
              procedure={selectedProcedure}
              slot={selectedSlot}
              clinicName={clinicInfo.clinicName}
              onNewBooking={handleNewBooking}
            />
          ) : (
            <>
              {/* Step indicator */}
              <StepIndicator current={step} />

              {/* Step counter label */}
              <p className="text-xs text-gray-400 text-center -mt-4 mb-5">
                Passo {step + 1} de {STEPS.length}
              </p>

              {/* Step content */}
              <div className="min-h-[280px]">
                {step === 0 && (
                  <StepProcedure
                    procedures={clinicInfo.procedures}
                    selectedId={selectedProcedure?.id ?? null}
                    onSelect={(p) => setSelectedProcedure(p)}
                  />
                )}
                {step === 1 && selectedProcedure && (
                  <StepDateTime
                    companyId={companyId!}
                    procedure={selectedProcedure}
                    selectedDate={selectedDate}
                    setSelectedDate={setSelectedDate}
                    selectedSlot={selectedSlot}
                    setSelectedSlot={setSelectedSlot}
                  />
                )}
                {step === 2 && (
                  <StepPatientInfo
                    form={patientForm}
                    onChange={handleFormChange}
                    errors={formErrors}
                  />
                )}
                {step === 3 && selectedProcedure && selectedSlot && (
                  <StepConfirmation
                    procedure={selectedProcedure}
                    slot={selectedSlot}
                    form={patientForm}
                    onConfirm={() => bookMutation.mutate()}
                    isLoading={bookMutation.isPending}
                    error={bookingError}
                  />
                )}
              </div>

              {/* Navigation buttons */}
              <div
                className={cn(
                  'flex mt-6 gap-3',
                  step === 0 ? 'justify-end' : 'justify-between',
                )}
              >
                {step > 0 && (
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    disabled={bookMutation.isPending}
                    className="flex items-center gap-1 border-gray-300"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Voltar
                  </Button>
                )}

                {/* "Proxima" only shown on steps 0-2; step 3 has its own confirm button */}
                {step < 3 && (
                  <Button
                    onClick={handleNext}
                    disabled={
                      (step === 0 && !canProceedStep0) ||
                      (step === 1 && !canProceedStep1) ||
                      (step === 2 && !canProceedStep2)
                    }
                    className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 ml-auto"
                  >
                    Proximo
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Agendamento online powered by DentCare
        </p>
      </div>
    </div>
  );
}
