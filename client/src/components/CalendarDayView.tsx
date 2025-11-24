import { useState, useRef, useEffect, useMemo } from "react";
import { format, addDays, subDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Tipo para um compromisso/agendamento
interface Appointment {
  id: number;
  date: Date;
  startTime: string;
  endTime: string;
  patientName: string;
  professionalName: string;
  procedure: string;
  status: string;
  color?: string;
}

// Propriedades do componente
interface CalendarDayViewProps {
  appointments?: Appointment[];
  onDateSelect?: (date: Date, startTime: string, endTime?: string) => void;
  onAppointmentClick?: (appointment: Appointment) => void;
  professionals?: { id: number; name: string }[];
  timeInterval?: 15 | 20 | 30 | 60;
  selectedDate?: Date;
}

export default function CalendarDayView({
  appointments = [],
  onDateSelect,
  onAppointmentClick,
  professionals = [],
  timeInterval = 30,
  selectedDate: externalSelectedDate,
}: CalendarDayViewProps) {
  // Estado para o dia atual sendo visualizado
  const [currentDate, setCurrentDate] = useState(externalSelectedDate || new Date());
  const [selectionStart, setSelectionStart] = useState<string | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);

  // Sincronizar com a data externa quando ela mudar
  useEffect(() => {
    if (externalSelectedDate) {
      setCurrentDate(externalSelectedDate);
    }
  }, [externalSelectedDate]);

  // Gerar intervalos de tempo baseados no timeInterval
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = 7; hour < 20; hour++) {
      const intervals = 60 / timeInterval;
      for (let i = 0; i < intervals; i++) {
        const minutes = i * timeInterval;
        slots.push(`${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
      }
    }
    return slots;
  }, [timeInterval]);

  // Função para avançar para o próximo dia
  const nextDay = () => {
    setCurrentDate(addDays(currentDate, 1));
  };

  // Função para voltar para o dia anterior
  const prevDay = () => {
    setCurrentDate(subDays(currentDate, 1));
  };

  // Iniciar a seleção de horário
  const handleMouseDown = (time: string) => {
    setIsDragging(true);
    setSelectionStart(time);
    setSelectionEnd(time);
  };

  // Atualizar a seleção de horário durante o arrasto
  const handleMouseMove = (time: string) => {
    if (isDragging && selectionStart) {
      setSelectionEnd(time);
    }
  };

  // Finalizar a seleção de horário
  const handleMouseUp = () => {
    if (isDragging && selectionStart && selectionEnd) {
      setIsDragging(false);

      const startTime = selectionStart;
      const endTime = selectionEnd;

      // Informar ao componente pai sobre a seleção
      if (onDateSelect) {
        onDateSelect(currentDate, startTime, endTime);
      }

      // Resetar seleção
      setSelectionStart(null);
      setSelectionEnd(null);
    }
  };

  // Limpar a seleção se o mouse sair da grade
  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      setSelectionStart(null);
      setSelectionEnd(null);
    }
  };

  // Verificar se um slot está selecionado
  const isSlotSelected = (time: string) => {
    if (!selectionStart || !selectionEnd) return false;
    const slots = timeSlots;
    const startIndex = slots.indexOf(selectionStart);
    const endIndex = slots.indexOf(selectionEnd);
    const timeIndex = slots.indexOf(time);

    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);

    return timeIndex >= minIndex && timeIndex <= maxIndex;
  };

  // Buscar compromissos do dia
  const dayAppointments = appointments.filter(appt =>
    isSameDay(new Date(appt.date), currentDate)
  );

  // Calcular posição e altura do compromisso na grade
  const getAppointmentStyle = (appointment: Appointment) => {
    const startIndex = timeSlots.indexOf(appointment.startTime);
    const endIndex = timeSlots.indexOf(appointment.endTime);

    if (startIndex === -1) return null;

    const top = startIndex * 50; // 50px por slot
    const height = endIndex > startIndex ? (endIndex - startIndex) * 50 : 50;

    return { top, height };
  };

  // Obter cor baseada no status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmado':
        return 'bg-green-500/20 border-green-500 text-green-700';
      case 'agendado':
        return 'bg-blue-500/20 border-blue-500 text-blue-700';
      case 'cancelado':
        return 'bg-red-500/20 border-red-500 text-red-700';
      default:
        return 'bg-gray-500/20 border-gray-500 text-gray-700';
    }
  };

  return (
    <Card className="p-4">
      {/* Header com navegação */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">
            {format(currentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </h2>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={prevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={nextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Grade de horários */}
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[80px_1fr] bg-gray-50 border-b">
          <div className="p-2 font-medium text-sm border-r">Horário</div>
          <div className="p-2 font-medium text-sm">Agendamentos</div>
        </div>

        <div
          ref={gridRef}
          className="relative"
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
        >
          {timeSlots.map((time) => (
            <div
              key={time}
              className="grid grid-cols-[80px_1fr] border-b hover:bg-gray-50 transition-colors"
              style={{ height: '50px' }}
              onMouseDown={() => handleMouseDown(time)}
              onMouseMove={() => handleMouseMove(time)}
            >
              <div className="p-2 text-sm text-gray-600 border-r flex items-center">
                {time}
              </div>
              <div
                className={`p-2 cursor-pointer transition-colors ${
                  isSlotSelected(time) ? 'bg-blue-100 border-l-4 border-blue-500' : ''
                }`}
              >
                {/* Espaço para agendamentos */}
              </div>
            </div>
          ))}

          {/* Renderizar compromissos sobre a grade */}
          <div className="absolute top-0 left-[80px] right-0 pointer-events-none">
            {dayAppointments.map((appointment) => {
              const style = getAppointmentStyle(appointment);
              if (!style) return null;

              return (
                <div
                  key={appointment.id}
                  className={`absolute left-1 right-1 border-l-4 rounded p-2 cursor-pointer pointer-events-auto ${getStatusColor(
                    appointment.status
                  )}`}
                  style={{ top: `${style.top}px`, height: `${style.height}px` }}
                  onClick={() => onAppointmentClick?.(appointment)}
                >
                  <div className="text-xs font-semibold truncate">
                    {appointment.patientName}
                  </div>
                  <div className="text-xs truncate">{appointment.procedure}</div>
                  <div className="text-xs text-gray-600 truncate">
                    {appointment.professionalName}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legenda de status */}
      <div className="flex gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500/20 border border-green-500 rounded"></div>
          <span>Confirmado</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-500/20 border border-blue-500 rounded"></div>
          <span>Agendado</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500/20 border border-red-500 rounded"></div>
          <span>Cancelado</span>
        </div>
      </div>
    </Card>
  );
}
