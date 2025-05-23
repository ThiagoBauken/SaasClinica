import { useState, useRef, useEffect } from "react";
import { format, addDays, startOfWeek, parseISO, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Intervalos de tempo para exibição na grade
const timeSlots: string[] = [];
for (let hour = 7; hour < 20; hour++) {
  timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
  timeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
}

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
interface CalendarWeekViewProps {
  appointments?: Appointment[];
  onDateSelect?: (date: Date, startTime: string, endTime?: string) => void;
  onAppointmentClick?: (appointment: Appointment) => void;
  professionals?: { id: number; name: string }[];
}

export default function CalendarWeekView({
  appointments = [],
  onDateSelect,
  onAppointmentClick,
  professionals = [],
}: CalendarWeekViewProps) {
  // Estado para a semana atual sendo visualizada
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectionStart, setSelectionStart] = useState<{ day: number; time: string } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ day: number; time: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const gridRef = useRef<HTMLDivElement>(null);

  // Calcular o início da semana (começando no domingo)
  const weekStart = startOfWeek(currentDate, { locale: ptBR });
  
  // Gerar os dias da semana
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Função para avançar para a próxima semana
  const nextWeek = () => {
    setCurrentDate(addDays(currentDate, 7));
  };

  // Função para voltar para a semana anterior
  const prevWeek = () => {
    setCurrentDate(addDays(currentDate, -7));
  };

  // Iniciar a seleção de horário
  const handleMouseDown = (dayIndex: number, time: string) => {
    setIsDragging(true);
    setSelectionStart({ day: dayIndex, time });
    setSelectionEnd({ day: dayIndex, time });
  };

  // Atualizar a seleção de horário durante o arrasto
  const handleMouseMove = (dayIndex: number, time: string) => {
    if (isDragging && selectionStart) {
      setSelectionEnd({ day: dayIndex, time });
    }
  };

  // Finalizar a seleção de horário
  const handleMouseUp = () => {
    if (isDragging && selectionStart && selectionEnd) {
      setIsDragging(false);
      
      // Garantir que estamos tratando uma seleção no mesmo dia
      if (selectionStart.day === selectionEnd.day) {
        const day = weekDays[selectionStart.day];
        const startTime = selectionStart.time;
        const endTime = selectionEnd.time;
        
        // Informar ao componente pai sobre a seleção
        if (onDateSelect) {
          onDateSelect(day, startTime, endTime);
        }
      }
    }
  };

  // Limpar a seleção se o mouse sair da grade
  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
    }
  };

  // Adicionar e remover event listeners para capturar mouse up mesmo fora da grade
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp();
      }
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, selectionStart, selectionEnd]);

  // Verificar se uma célula está dentro da seleção atual
  const isInSelection = (dayIndex: number, time: string) => {
    if (!selectionStart || !selectionEnd || !isDragging) return false;
    
    // Só permitir seleção no mesmo dia
    if (selectionStart.day !== dayIndex || selectionEnd.day !== dayIndex) return false;
    
    const currentTimeIndex = timeSlots.indexOf(time);
    const startTimeIndex = timeSlots.indexOf(selectionStart.time);
    const endTimeIndex = timeSlots.indexOf(selectionEnd.time);
    
    return currentTimeIndex >= Math.min(startTimeIndex, endTimeIndex) && 
           currentTimeIndex <= Math.max(startTimeIndex, endTimeIndex);
  };

  // Verificar se há um agendamento em determinado horário
  const getAppointmentForTimeSlot = (day: Date, time: string) => {
    return appointments.find(appointment => {
      const appointmentDate = new Date(appointment.date);
      const sameDay = appointmentDate.toDateString() === day.toDateString();
      
      // Verifique se o horário de início do agendamento corresponde a este intervalo de tempo
      const isStartTime = appointment.startTime === time;
      
      return sameDay && isStartTime;
    });
  };

  // Renderizar um agendamento
  const renderAppointment = (appointment: Appointment) => {
    const startTimeIndex = timeSlots.indexOf(appointment.startTime);
    const endTimeIndex = timeSlots.indexOf(appointment.endTime);
    const durationInSlots = endTimeIndex - startTimeIndex + 1;
    
    return (
      <div 
        className={`absolute z-10 left-0 right-0 mx-1 rounded p-1 overflow-hidden shadow-sm select-none ${appointment.color || 'bg-blue-100'}`}
        style={{ 
          top: `${startTimeIndex * 40}px`, 
          height: `${durationInSlots * 40 - 4}px`,
        }}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onAppointmentClick && onAppointmentClick(appointment);
        }}
      >
        <div className="text-xs font-medium truncate">{appointment.patientName}</div>
        <div className="text-xs truncate">{appointment.procedure}</div>
        <div className="text-xs text-gray-500 truncate">
          {appointment.startTime} - {appointment.endTime}
        </div>
      </div>
    );
  };
  
  // Renderizar a seleção de horário durante o arrasto
  const renderSelection = (dayIndex: number) => {
    if (!selectionStart || !selectionEnd || selectionStart.day !== dayIndex || selectionEnd.day !== dayIndex) {
      return null;
    }
    
    const startTimeIndex = timeSlots.indexOf(selectionStart.time);
    const endTimeIndex = timeSlots.indexOf(selectionEnd.time);
    
    const topIndex = Math.min(startTimeIndex, endTimeIndex);
    const bottomIndex = Math.max(startTimeIndex, endTimeIndex);
    const durationInSlots = bottomIndex - topIndex + 1;
    
    const startDisplay = timeSlots[topIndex];
    const endDisplay = timeSlots[bottomIndex];
    
    return (
      <div 
        className="absolute z-5 left-0 right-0 mx-1 rounded bg-blue-50 border-l-4 border-blue-500 overflow-hidden select-none"
        style={{ 
          top: `${topIndex * 40}px`, 
          height: `${durationInSlots * 40 - 2}px`,
        }}
      >
        <div className="p-2 text-xs">
          <div className="font-medium">Novo Agendamento</div>
          <div className="text-gray-600">
            {startDisplay} - {endDisplay}
          </div>
        </div>
      </div>
    );
  };

  // Prevenir seleção de texto durante arrasto
  const preventTextSelection = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
    }
  };
  
  useEffect(() => {
    // Adicionar estilos globais para prevenir seleção de texto durante arrasto
    const handleGlobalSelectStart = (e: any) => {
      if (isDragging) {
        e.preventDefault();
      }
    };
    
    document.addEventListener('selectstart', handleGlobalSelectStart);
    
    return () => {
      document.removeEventListener('selectstart', handleGlobalSelectStart);
    };
  }, [isDragging]);
  
  return (
    <div 
      className="calendar-week-view w-full select-none" 
      onMouseDown={() => document.body.classList.add('select-none')}
      onMouseUp={() => document.body.classList.remove('select-none')}
    >
      {/* Controles do calendário */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" onClick={prevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-bold">
            {format(weekStart, "dd/MM/yyyy", { locale: ptBR })} - {format(weekDays[6], "dd/MM/yyyy", { locale: ptBR })}
          </h2>
          <Button variant="outline" size="icon" onClick={nextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Grade de horários */}
      <div className="relative">
        {/* Cabeçalho com dias da semana */}
        <div className="grid grid-cols-8 border-b">
          <div className="p-2 font-medium text-sm text-muted-foreground">Horário</div>
          {weekDays.map((day, i) => (
            <div 
              key={i} 
              className={`p-2 text-center font-medium ${isToday(day) ? 'bg-blue-50 text-blue-600' : ''}`}
            >
              <div>{format(day, "EEE", { locale: ptBR })}</div>
              <div>{format(day, "dd/MM")}</div>
            </div>
          ))}
        </div>
        
        {/* Grade de horários */}
        <div 
          ref={gridRef}
          className="grid grid-cols-8 select-none" 
          onMouseLeave={handleMouseLeave}
        >
          {/* Coluna de horários */}
          <div>
            {timeSlots.map((time, i) => (
              <div key={i} className="h-10 border-b border-r p-1 font-medium text-sm text-gray-500">
                {time}
              </div>
            ))}
          </div>
          
          {/* Colunas para cada dia da semana */}
          {weekDays.map((day, dayIndex) => (
            <div key={dayIndex} className="relative">
              {timeSlots.map((time, timeIndex) => {
                const appointment = getAppointmentForTimeSlot(day, time);
                const isSelected = isInSelection(dayIndex, time);
                
                return (
                  <div 
                    key={timeIndex}
                    className={`h-10 border-b border-r p-1 select-none ${isSelected ? 'bg-blue-100' : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevenir seleção de texto
                      handleMouseDown(dayIndex, time);
                    }}
                    onMouseMove={(e) => {
                      if (isDragging) e.preventDefault(); // Prevenir seleção de texto quando arrasta
                      handleMouseMove(dayIndex, time);
                    }}
                    style={{ cursor: isDragging ? 'grabbing' : 'pointer' }}
                  >
                    {appointment && renderAppointment(appointment)}
                  </div>
                );
              })}
              {/* Renderizar a seleção de arrasto sobre as células */}
              {renderSelection(dayIndex)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}