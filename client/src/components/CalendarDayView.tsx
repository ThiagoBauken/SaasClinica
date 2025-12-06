import { useState, useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import { format, addDays, subDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PaymentStatusBadge, { PaymentStatus } from "@/components/PaymentStatusBadge";

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
  paymentStatus?: PaymentStatus;
  paymentAmount?: number;
  paidAmount?: number;
}

// Propriedades do componente
interface CalendarDayViewProps {
  appointments?: Appointment[];
  onDateSelect?: (date: Date, startTime: string, endTime?: string) => void;
  onAppointmentClick?: (appointment: Appointment) => void;
  onAppointmentDrop?: (appointmentId: number, newDate: Date, newStartTime: string, newEndTime: string) => void;
  professionals?: { id: number; name: string }[];
  timeInterval?: 15 | 20 | 30 | 60;
  selectedDate?: Date;
}

// Interface para métodos expostos via ref
export interface CalendarDayViewRef {
  clearSelection: () => void;
}

const CalendarDayView = forwardRef<CalendarDayViewRef, CalendarDayViewProps>(({
  appointments = [],
  onDateSelect,
  onAppointmentClick,
  onAppointmentDrop,
  professionals = [],
  timeInterval = 30,
  selectedDate: externalSelectedDate,
}, ref) => {
  // Estado para o dia atual sendo visualizado
  const [currentDate, setCurrentDate] = useState(externalSelectedDate || new Date());
  const [selectionStart, setSelectionStart] = useState<string | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Estados para Drag & Drop de agendamentos
  const [draggingAppointment, setDraggingAppointment] = useState<Appointment | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  // Estados para swipe gestures
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);

  const gridRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Expor método clearSelection para o componente pai
  useImperativeHandle(ref, () => ({
    clearSelection: () => {
      setSelectionStart(null);
      setSelectionEnd(null);
      setIsDragging(false);
    },
  }));

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

  // ===== Drag & Drop Handlers =====

  const handleDragStart = (e: React.DragEvent, appointment: Appointment) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("appointmentId", appointment.id.toString());
    setDraggingAppointment(appointment);

    // Feedback visual durante o drag
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggingAppointment(null);
    setDragOverSlot(null);

    // Restaurar opacidade
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
  };

  const handleDragOver = (e: React.DragEvent, time: string) => {
    e.preventDefault(); // Necessário para permitir drop
    e.dataTransfer.dropEffect = "move";
    setDragOverSlot(time);
  };

  const handleDragLeave = () => {
    setDragOverSlot(null);
  };

  const handleDrop = (e: React.DragEvent, dropTime: string) => {
    e.preventDefault();

    if (!draggingAppointment || !onAppointmentDrop) return;

    // Calcular duração original do agendamento
    const startIndex = timeSlots.indexOf(draggingAppointment.startTime);
    const endIndex = timeSlots.indexOf(draggingAppointment.endTime);
    const duration = endIndex - startIndex;

    // Calcular novo endTime baseado na duração
    const newStartIndex = timeSlots.indexOf(dropTime);
    const newEndIndex = newStartIndex + duration;
    const newEndTime = timeSlots[newEndIndex] || timeSlots[timeSlots.length - 1];

    // Chamar callback com novo horário
    onAppointmentDrop(
      draggingAppointment.id,
      currentDate,
      dropTime,
      newEndTime
    );

    setDraggingAppointment(null);
    setDragOverSlot(null);
  };

  // ===== Swipe Gesture Handlers =====

  const minSwipeDistance = 50; // Distância mínima para detectar swipe (em pixels)

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setSwipeOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;

    const currentTouch = e.targetTouches[0].clientX;
    const diff = currentTouch - touchStart;

    // Aplicar efeito de resistência nos limites
    const resistance = 0.5;
    setSwipeOffset(diff * resistance);
    setTouchEnd(currentTouch);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      // Swipe para esquerda = próximo dia
      nextDay();
    } else if (isRightSwipe) {
      // Swipe para direita = dia anterior
      prevDay();
    }

    // Reset
    setTouchStart(null);
    setTouchEnd(null);
    setSwipeOffset(0);
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
        return 'bg-green-500/20 border-green-500 text-green-700 dark:text-green-300';
      case 'agendado':
        return 'bg-blue-500/20 border-blue-500 text-blue-700 dark:text-blue-300';
      case 'cancelado':
        return 'bg-red-500/20 border-red-500 text-red-700 dark:text-red-300';
      default:
        return 'bg-muted border-muted-foreground text-muted-foreground';
    }
  };

  return (
    <Card
      ref={containerRef}
      className="p-4 touch-pan-y select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateX(${swipeOffset}px)`,
        transition: swipeOffset === 0 ? 'transform 0.3s ease-out' : 'none',
      }}
    >
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
        <div className="grid grid-cols-[80px_1fr] bg-muted/50 border-b">
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
              className="grid grid-cols-[80px_1fr] border-b hover:bg-muted/50 transition-colors"
              style={{ height: '50px' }}
              onMouseDown={() => handleMouseDown(time)}
              onMouseMove={() => handleMouseMove(time)}
            >
              <div className="p-2 text-sm text-muted-foreground border-r flex items-center">
                {time}
              </div>
              <div
                className={`p-2 cursor-pointer transition-colors ${
                  isSlotSelected(time) ? 'bg-blue-500/20 border-l-4 border-blue-500' : ''
                } ${
                  dragOverSlot === time ? 'bg-green-500/20 border-l-4 border-green-500' : ''
                }`}
                onDragOver={(e) => handleDragOver(e, time)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, time)}
              >
                {/* Espaço para agendamentos */}
                {dragOverSlot === time && (
                  <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                    Soltar aqui
                  </div>
                )}
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
                  draggable={!!onAppointmentDrop}
                  className={`absolute left-1 right-1 border-l-4 rounded p-2 cursor-move pointer-events-auto transition-opacity ${getStatusColor(
                    appointment.status
                  )} ${draggingAppointment?.id === appointment.id ? 'opacity-50 cursor-grabbing' : 'cursor-grab'}`}
                  style={{ top: `${style.top}px`, height: `${style.height}px` }}
                  onClick={() => onAppointmentClick?.(appointment)}
                  onDragStart={(e) => handleDragStart(e, appointment)}
                  onDragEnd={handleDragEnd}
                  title="Arraste para reagendar"
                >
                  <div className="text-xs font-semibold truncate">
                    {appointment.patientName}
                  </div>
                  <div className="text-xs truncate">{appointment.procedure}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {appointment.professionalName}
                  </div>
                  {appointment.paymentStatus && appointment.paymentStatus !== 'not_required' && (
                    <div className="mt-1">
                      <PaymentStatusBadge
                        status={appointment.paymentStatus}
                        amount={appointment.paymentAmount}
                        paidAmount={appointment.paidAmount}
                        compact={true}
                      />
                    </div>
                  )}
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
});

CalendarDayView.displayName = 'CalendarDayView';

export default CalendarDayView;
