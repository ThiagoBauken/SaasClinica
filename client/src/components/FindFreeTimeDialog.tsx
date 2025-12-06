import { useState, useMemo } from "react";
import { format, addDays, setHours, setMinutes, isBefore, isAfter, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Clock, Search, Loader2, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
}

interface Professional {
  id: number;
  name: string;
  specialty?: string;
}

interface Appointment {
  id: number;
  startTime: string;
  endTime: string;
  professionalId: number;
}

interface FindFreeTimeDialogProps {
  selectedDate?: Date;
  professionals?: Professional[];
  duration?: number; // duração em minutos
  onSelectTimeSlot?: (date: Date, startTime: string, endTime: string) => void;
}

// Horários de funcionamento padrão da clínica
const CLINIC_HOURS = {
  start: 7, // 07:00
  end: 22, // 22:00
  lunchStart: 12, // 12:00
  lunchEnd: 13, // 13:00
};

export default function FindFreeTimeDialog({
  selectedDate = new Date(),
  professionals = [],
  duration = 30,
  onSelectTimeSlot
}: FindFreeTimeDialogProps) {
  const [open, setOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(selectedDate);
  const [selectedProfessional, setSelectedProfessional] = useState<string>("all");
  const [selectedDuration, setSelectedDuration] = useState<number>(duration);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);

  // Buscar profissionais se não foram passados
  const { data: professionalsData } = useQuery<{ data: Professional[] }>({
    queryKey: ["/api/v1/professionals"],
    enabled: professionals.length === 0,
  });

  const availableProfessionals = professionals.length > 0
    ? professionals
    : (professionalsData?.data || []);

  // Buscar agendamentos do dia
  const { data: appointmentsData, isLoading } = useQuery<{ data: Appointment[] }>({
    queryKey: ["/api/v1/appointments", {
      date: format(currentDate, "yyyy-MM-dd"),
      professionalId: selectedProfessional !== "all" ? selectedProfessional : undefined
    }],
    enabled: open,
  });

  // Gerar slots de tempo baseado na duração selecionada
  const generateTimeSlots = useMemo(() => {
    const slots: TimeSlot[] = [];
    const appointments = appointmentsData?.data || [];

    // Filtrar agendamentos por profissional se selecionado
    const filteredAppointments = selectedProfessional === "all"
      ? appointments
      : appointments.filter(a => a.professionalId.toString() === selectedProfessional);

    // Gerar todos os slots do dia
    for (let hour = CLINIC_HOURS.start; hour < CLINIC_HOURS.end; hour++) {
      // Pular horário de almoço
      if (hour >= CLINIC_HOURS.lunchStart && hour < CLINIC_HOURS.lunchEnd) {
        continue;
      }

      for (let minute = 0; minute < 60; minute += selectedDuration) {
        const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const endMinute = minute + selectedDuration;
        const endHour = hour + Math.floor(endMinute / 60);
        const endMin = endMinute % 60;

        // Verificar se o slot ultrapassa o horário de funcionamento
        if (endHour >= CLINIC_HOURS.end || (endHour === CLINIC_HOURS.lunchStart && endMin > 0)) {
          continue;
        }

        // Pular se o slot termina no horário de almoço
        if (endHour >= CLINIC_HOURS.lunchStart && endHour < CLINIC_HOURS.lunchEnd) {
          continue;
        }

        const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;

        // Verificar se o slot está ocupado
        const slotStart = setMinutes(setHours(currentDate, hour), minute);
        const slotEnd = setMinutes(setHours(currentDate, endHour), endMin);

        const isOccupied = filteredAppointments.some(appt => {
          const apptStart = new Date(appt.startTime);
          const apptEnd = new Date(appt.endTime);

          // Verificar sobreposição
          return (
            (slotStart >= apptStart && slotStart < apptEnd) ||
            (slotEnd > apptStart && slotEnd <= apptEnd) ||
            (slotStart <= apptStart && slotEnd >= apptEnd)
          );
        });

        // Verificar se o slot já passou (para o dia atual)
        const now = new Date();
        const isPast = format(currentDate, "yyyy-MM-dd") === format(now, "yyyy-MM-dd") &&
                       slotStart < now;

        slots.push({
          start: startTime,
          end: endTime,
          available: !isOccupied && !isPast
        });
      }
    }

    return slots;
  }, [currentDate, appointmentsData, selectedProfessional, selectedDuration]);

  // Separar slots por período
  const morningSlots = generateTimeSlots.filter(s => parseInt(s.start.split(':')[0]) < 12);
  const afternoonSlots = generateTimeSlots.filter(s => {
    const hour = parseInt(s.start.split(':')[0]);
    return hour >= 13 && hour < 18;
  });
  const eveningSlots = generateTimeSlots.filter(s => parseInt(s.start.split(':')[0]) >= 18);

  // Contar slots disponíveis
  const availableCount = generateTimeSlots.filter(s => s.available).length;

  // Navegar para o próximo dia
  const nextDay = () => {
    setCurrentDate(addDays(currentDate, 1));
    setSelectedTimeSlot(null);
  };

  // Navegar para o dia anterior
  const prevDay = () => {
    const prev = addDays(currentDate, -1);
    // Não permitir voltar para dias anteriores a hoje
    if (prev >= new Date(new Date().setHours(0, 0, 0, 0))) {
      setCurrentDate(prev);
      setSelectedTimeSlot(null);
    }
  };

  // Selecionar um horário
  const handleSelectTimeSlot = (slot: TimeSlot) => {
    if (slot.available) {
      setSelectedTimeSlot(slot);
    }
  };

  // Confirmar seleção de horário
  const handleConfirmSelection = () => {
    if (selectedTimeSlot && onSelectTimeSlot) {
      onSelectTimeSlot(currentDate, selectedTimeSlot.start, selectedTimeSlot.end);
      setOpen(false);
      setSelectedTimeSlot(null);
    }
  };

  // Buscar próximo horário disponível automaticamente
  const findNextAvailable = () => {
    const nextSlot = generateTimeSlots.find(s => s.available);
    if (nextSlot) {
      setSelectedTimeSlot(nextSlot);
    } else {
      // Se não houver horário hoje, ir para o próximo dia
      nextDay();
    }
  };

  const TimeSlotButton = ({ slot }: { slot: TimeSlot }) => (
    <button
      onClick={() => handleSelectTimeSlot(slot)}
      disabled={!slot.available}
      className={cn(
        "px-3 py-2 text-sm rounded-md border transition-all",
        slot.available
          ? selectedTimeSlot?.start === slot.start
            ? "bg-blue-500 text-white border-blue-500"
            : "bg-card hover:bg-blue-500/10 border-border hover:border-blue-500/50"
          : "bg-muted text-muted-foreground border-border cursor-not-allowed line-through"
      )}
    >
      {slot.start}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-blue-500 text-blue-500 hover:bg-blue-500/10">
          <Search className="h-4 w-4 mr-2" />
          Encontrar horário
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Encontrar Horário Disponível
          </DialogTitle>
          <DialogDescription>
            Selecione o profissional e a duração para ver os horários livres
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-sm mb-2 block">Profissional</Label>
              <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os profissionais" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os profissionais</SelectItem>
                  {availableProfessionals.map((prof) => (
                    <SelectItem key={prof.id} value={prof.id.toString()}>
                      {prof.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[150px]">
              <Label className="text-sm mb-2 block">Duração</Label>
              <Select
                value={selectedDuration.toString()}
                onValueChange={(v) => setSelectedDuration(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="20">20 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="45">45 minutos</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                  <SelectItem value="90">1h 30min</SelectItem>
                  <SelectItem value="120">2 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button variant="secondary" onClick={findNextAvailable}>
                <Clock className="h-4 w-4 mr-2" />
                Próximo disponível
              </Button>
            </div>
          </div>

          {/* Navegação de data */}
          <div className="flex items-center justify-between border-b pb-4">
            <Button variant="ghost" size="icon" onClick={prevDay}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="text-center">
              <span className="text-lg font-medium">
                {format(currentDate, "EEEE", { locale: ptBR })}
              </span>
              <span className="text-lg text-muted-foreground ml-2">
                {format(currentDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            </div>
            <Button variant="ghost" size="icon" onClick={nextDay}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Resumo */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando horários...
                </span>
              ) : (
                <>
                  <span className="font-medium text-green-600">{availableCount}</span> horários disponíveis
                </>
              )}
            </span>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-card border border-border" />
                Disponível
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-muted" />
                Ocupado
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-blue-500" />
                Selecionado
              </span>
            </div>
          </div>

          {/* Grid de horários */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Manhã */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <span className="text-yellow-500">☀️</span> Manhã
                  <span className="text-xs text-muted-foreground">
                    ({morningSlots.filter(s => s.available).length} livres)
                  </span>
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {morningSlots.map((slot, i) => (
                    <TimeSlotButton key={i} slot={slot} />
                  ))}
                </div>
                {morningSlots.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Sem horários neste período
                  </p>
                )}
              </div>

              {/* Tarde */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <span className="text-orange-500">🌤️</span> Tarde
                  <span className="text-xs text-muted-foreground">
                    ({afternoonSlots.filter(s => s.available).length} livres)
                  </span>
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {afternoonSlots.map((slot, i) => (
                    <TimeSlotButton key={i} slot={slot} />
                  ))}
                </div>
                {afternoonSlots.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Sem horários neste período
                  </p>
                )}
              </div>

              {/* Noite */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <span className="text-indigo-500">🌙</span> Noite
                  <span className="text-xs text-muted-foreground">
                    ({eveningSlots.filter(s => s.available).length} livres)
                  </span>
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {eveningSlots.map((slot, i) => (
                    <TimeSlotButton key={i} slot={slot} />
                  ))}
                </div>
                {eveningSlots.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Sem horários neste período
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Horário selecionado */}
          {selectedTimeSlot && (
            <div className="mt-4 p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Horário selecionado: {selectedTimeSlot.start} às {selectedTimeSlot.end}
                <span className="text-blue-600 dark:text-blue-400 ml-2">
                  ({format(currentDate, "dd/MM/yyyy")})
                </span>
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmSelection}
            disabled={!selectedTimeSlot}
            className="bg-green-500 hover:bg-green-600"
          >
            Confirmar Horário
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
