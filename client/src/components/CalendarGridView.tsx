import { useState, useRef, useEffect } from "react";
import { format, startOfWeek, addDays, isToday, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Appointment {
  id: number;
  date: Date | string;
  startTime: string;
  endTime: string;
  patientName: string;
  professionalName: string;
  procedure: string;
  status: string;
  color?: string;
}

interface CalendarGridViewProps {
  selectedDate?: Date;
  appointments?: Appointment[];
  onDateSelect?: (date: Date) => void;
  onTimeSlotSelect?: (date: Date, slot: string) => void;
  onDragSelect?: (date: Date, startTime: string, endTime: string) => void;
}

// Gerar os horários para exibição
const timeSlots: string[] = [];
for (let hour = 7; hour < 23; hour++) {
  timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
  timeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
}

export default function CalendarGridView({
  selectedDate = new Date(),
  appointments = [],
  onDateSelect,
  onTimeSlotSelect,
  onDragSelect
}: CalendarGridViewProps) {
  const [currentDate, setCurrentDate] = useState(selectedDate);
  const [weekStart, setWeekStart] = useState(startOfWeek(currentDate, { weekStartsOn: 0 })); // Domingo
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ day: Date; time: string } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ day: Date; time: string } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  
  // Recalcular o início da semana quando a data atual mudar
  useEffect(() => {
    setWeekStart(startOfWeek(currentDate, { weekStartsOn: 0 }));
  }, [currentDate]);
  
  // Calcular os dias da semana
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  
  // Navegar para a semana anterior
  const prevWeek = () => {
    const newDate = addDays(currentDate, -7);
    setCurrentDate(newDate);
    if (onDateSelect) {
      onDateSelect(newDate);
    }
  };
  
  // Navegar para a próxima semana
  const nextWeek = () => {
    const newDate = addDays(currentDate, 7);
    setCurrentDate(newDate);
    if (onDateSelect) {
      onDateSelect(newDate);
    }
  };
  
  // Iniciar a seleção por arrasto
  const handleMouseDown = (day: Date, time: string) => {
    setIsDragging(true);
    setDragStart({ day, time });
    setDragEnd({ day, time });
  };
  
  // Atualizar a seleção durante o arrasto
  const handleMouseMove = (day: Date, time: string) => {
    if (isDragging && dragStart) {
      // Somente permitir arrasto no mesmo dia
      if (isSameDay(dragStart.day, day)) {
        setDragEnd({ day, time });
      }
    }
  };
  
  // Finalizar a seleção por arrasto
  const handleMouseUp = () => {
    if (isDragging && dragStart && dragEnd) {
      if (isSameDay(dragStart.day, dragEnd.day)) {
        console.log(`Seleção: ${format(dragStart.day, 'dd/MM/yyyy')} de ${dragStart.time} até ${dragEnd.time}`);
        
        // Ordenar os horários de início e fim
        const startTimeIndex = timeSlots.indexOf(dragStart.time);
        const endTimeIndex = timeSlots.indexOf(dragEnd.time);
        
        const startTime = timeSlots[Math.min(startTimeIndex, endTimeIndex)];
        const endTime = timeSlots[Math.max(startTimeIndex, endTimeIndex)];
        
        // Notificar o componente pai
        if (onDragSelect) {
          onDragSelect(dragStart.day, startTime, endTime);
        }
      }
    }
    
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };
  
  // Verificar se uma célula está na seleção atual
  const isInSelection = (day: Date, time: string): boolean => {
    if (!dragStart || !dragEnd) return false;
    
    if (!isSameDay(dragStart.day, day)) return false;
    if (!isSameDay(dragEnd.day, day)) return false;
    
    const timeIndex = timeSlots.indexOf(time);
    const startTimeIndex = timeSlots.indexOf(dragStart.time);
    const endTimeIndex = timeSlots.indexOf(dragEnd.time);
    
    const minIndex = Math.min(startTimeIndex, endTimeIndex);
    const maxIndex = Math.max(startTimeIndex, endTimeIndex);
    
    return timeIndex >= minIndex && timeIndex <= maxIndex;
  };
  
  // Verificar se há um agendamento para um determinado dia e horário
  const getAppointmentAt = (day: Date, time: string): Appointment | undefined => {
    const dayStr = format(day, 'yyyy-MM-dd');
    
    return appointments.find(appointment => {
      const appointmentDate = typeof appointment.date === 'string' 
        ? appointment.date 
        : format(appointment.date, 'yyyy-MM-dd');
        
      if (appointmentDate !== dayStr) return false;
      
      const appointmentTimeStart = appointment.startTime;
      const appointmentTimeEnd = appointment.endTime;
      
      return time >= appointmentTimeStart && time < appointmentTimeEnd;
    });
  };
  
  // Renderizar um agendamento
  const renderAppointment = (appointment: Appointment, day: Date, time: string) => {
    // Verificar se é a primeira célula do agendamento
    const isFirstCell = appointment.startTime === time;
    
    if (!isFirstCell) return null;
    
    // Calcular a altura do agendamento em células
    const startIndex = timeSlots.indexOf(appointment.startTime);
    const endIndex = timeSlots.indexOf(appointment.endTime);
    const cellSpan = endIndex - startIndex;
    
    // Verificar se é uma consulta passada (exemplo)
    const isPastAppointment = ['09:00', '10:00', '11:00', '12:00', '13:30', '14:30', '15:30', '16:30'].includes(appointment.startTime);
    
    return (
      <div 
        className={`absolute top-0 left-0 right-0 m-1 p-2 rounded z-10 ${
          isPastAppointment 
            ? 'bg-gray-100 border-l-4 border-gray-400' 
            : (appointment.color || 'bg-blue-100 border-l-4 border-blue-500')
        }`}
        style={{ 
          height: `calc(${cellSpan * 100}% - 2px)`,
        }}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        <div className="text-xs font-semibold overflow-hidden text-ellipsis">
          {appointment.patientName} {isPastAppointment && '✓'}
        </div>
        {cellSpan > 1 && (
          <>
            <div className="text-xs overflow-hidden text-ellipsis">{appointment.procedure}</div>
            <div className="text-xs text-gray-500">
              {appointment.startTime} - {appointment.endTime}
            </div>
          </>
        )}
      </div>
    );
  };
  
  return (
    <div className="calendar-grid-view">
      {/* Controles de navegação */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={prevWeek}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <span className="font-medium">
            Semana de {format(weekStart, "dd MMM", { locale: ptBR })} até {format(addDays(weekStart, 6), "dd MMM", { locale: ptBR })}
          </span>
          
          <Button 
            variant="outline" 
            size="icon"
            onClick={nextWeek}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <Button 
          variant="outline" 
          onClick={() => {
            setCurrentDate(new Date());
            if (onDateSelect) {
              onDateSelect(new Date());
            }
          }}
        >
          Hoje
        </Button>
      </div>
      
      {/* Cabeçalho do calendário com dias da semana */}
      <div className="grid grid-cols-8 border-t border-l">
        {/* Célula vazia no canto superior esquerdo */}
        <div className="p-2 border-r border-b bg-gray-50"></div>
        
        {/* Dias da semana */}
        {weekDays.map((day, index) => (
          <div 
            key={index} 
            className={`p-2 text-center border-r border-b ${
              isToday(day) ? 'bg-blue-50 text-blue-700 font-bold' : 'bg-gray-50'
            }`}
            onClick={() => onDateSelect && onDateSelect(day)}
          >
            <div className="text-sm font-medium">{format(day, "EEE", { locale: ptBR })}</div>
            <div className={`text-lg ${isSameDay(day, selectedDate) ? 'text-blue-600 font-bold' : ''}`}>
              {format(day, "dd", { locale: ptBR })}
            </div>
            <div className="text-xs text-gray-500">{format(day, "MMM", { locale: ptBR })}</div>
          </div>
        ))}
      </div>
      
      {/* Grade de horários */}
      <div 
        ref={gridRef}
        className="grid grid-cols-8 border-l select-none"
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Coluna de horários */}
        <div>
          {timeSlots.map((time, index) => {
            // Verificar se este é um dos horários específicos mencionados
            const isSpecialTime = ['09:00', '10:00', '11:00', '12:00', '13:30', '14:30', '15:30', '16:30'].includes(time);
            
            return (
              <div 
                key={index} 
                className={`h-12 p-2 border-r border-b 
                  ${isSpecialTime ? 'text-blue-700 font-semibold' : 'text-gray-500'}`}
              >
                <div className="flex h-full items-center justify-center">
                  {time}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Células para cada dia */}
        {weekDays.map((day, dayIndex) => (
          <div key={dayIndex} className="relative">
            {timeSlots.map((time, timeIndex) => {
              const appointment = getAppointmentAt(day, time);
              const isSelected = isInSelection(day, time);
              
              return (
                <div 
                  key={timeIndex}
                  className={`h-12 border-r border-b relative
                    ${isSelected ? 'bg-blue-100' : 'hover:bg-gray-50'}`}
                  onMouseDown={() => handleMouseDown(day, time)}
                  onMouseMove={() => handleMouseMove(day, time)}
                  style={{
                    cursor: isDragging ? 'grabbing' : 'pointer'
                  }}
                >
                  {!isDragging && !appointment && (
                    <div className="h-full w-full flex items-center justify-center opacity-0 hover:opacity-100 text-blue-500">
                      <span className="text-xs">Arraste para selecionar</span>
                    </div>
                  )}
                  
                  {appointment && renderAppointment(appointment, day, time)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}