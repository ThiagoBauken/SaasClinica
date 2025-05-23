import { useState, useRef, useEffect } from "react";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

// Intervalos de tempo para exibição na grade
const timeSlots: string[] = [];
for (let hour = 7; hour < 19; hour++) {
  timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
  timeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
}

// Tipo para um compromisso/agendamento
interface Appointment {
  id: number;
  date: Date | string;
  professionalId: number;
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
  selectedDate: Date;
  appointments?: Appointment[];
  onDateSelect?: (date: Date) => void;
  onTimeSlotSelect?: (professionalId: number, date: Date, startTime: string, endTime?: string) => void;
  onAppointmentClick?: (appointment: Appointment) => void;
  professionals?: { id: number; name: string; specialty: string }[];
}

export default function CalendarDayView({
  selectedDate = new Date(),
  appointments = [],
  onDateSelect,
  onTimeSlotSelect,
  onAppointmentClick,
  professionals = []
}: CalendarDayViewProps) {
  const [currentDate, setCurrentDate] = useState(selectedDate);
  const [isDragging, setIsDragging] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ professional: number; time: string } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ professional: number; time: string } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  
  // Atualizar a data selecionada quando a prop mudar
  useEffect(() => {
    setCurrentDate(selectedDate);
  }, [selectedDate]);
  
  // Função para ir para o próximo dia
  const nextDay = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    setCurrentDate(next);
    if (onDateSelect) {
      onDateSelect(next);
    }
  };
  
  // Função para voltar para o dia anterior
  const prevDay = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 1);
    setCurrentDate(prev);
    if (onDateSelect) {
      onDateSelect(prev);
    }
  };
  
  // Iniciar a seleção de horário
  const handleMouseDown = (professionalId: number, time: string) => {
    setIsDragging(true);
    setSelectionStart({ professional: professionalId, time });
    setSelectionEnd({ professional: professionalId, time });
  };
  
  // Atualizar a seleção de horário durante o arrasto
  const handleMouseMove = (professionalId: number, time: string) => {
    if (isDragging && selectionStart && selectionStart.professional === professionalId) {
      setSelectionEnd({ professional: professionalId, time });
    }
  };
  
  // Finalizar a seleção de horário
  const handleMouseUp = () => {
    if (isDragging && selectionStart && selectionEnd) {
      // Garantir que estamos tratando uma seleção para o mesmo profissional
      if (selectionStart.professional === selectionEnd.professional) {
        const professionalId = selectionStart.professional;
        const startTimeIndex = timeSlots.indexOf(selectionStart.time);
        const endTimeIndex = timeSlots.indexOf(selectionEnd.time);
        
        const topIndex = Math.min(startTimeIndex, endTimeIndex);
        const bottomIndex = Math.max(startTimeIndex, endTimeIndex);
        
        const startTime = timeSlots[topIndex];
        const endTime = timeSlots[bottomIndex];
        
        // Verificar se há sobreposição com outros agendamentos
        const hasOverlap = checkForOverlap(professionalId, startTime, endTime);
        
        if (!hasOverlap) {
          console.log(`Seleção finalizada: Profissional ${professionalId}, ${startTime} - ${endTime}`);
          
          // Informar ao componente pai sobre a seleção
          if (onTimeSlotSelect) {
            onTimeSlotSelect(professionalId, currentDate, startTime, endTime);
          }
        } else {
          // Feedback visual para horário ocupado
          console.log("Horário selecionado está ocupado!");
        }
      }
      
      // Limpar a seleção após um breve delay para mostrar o feedback visual
      setTimeout(() => {
        setIsDragging(false);
        setSelectionStart(null);
        setSelectionEnd(null);
      }, 100);
    } else {
      setIsDragging(false);
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
  
  // Prevenir seleção de texto durante arrasto
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
  
  // Verificar se um time slot está na seleção atual
  const isInSelection = (professionalId: number, time: string) => {
    if (!selectionStart || !selectionEnd || selectionStart.professional !== professionalId || selectionEnd.professional !== professionalId) {
      return false;
    }
    
    const startTimeIndex = timeSlots.indexOf(selectionStart.time);
    const endTimeIndex = timeSlots.indexOf(selectionEnd.time);
    const timeIndex = timeSlots.indexOf(time);
    
    return timeIndex >= Math.min(startTimeIndex, endTimeIndex) && timeIndex <= Math.max(startTimeIndex, endTimeIndex);
  };
  
  // Obter agendamento para um timeslot específico
  const getAppointmentForTimeSlot = (professionalId: number, time: string) => {
    const dateStr = format(currentDate, "yyyy-MM-dd");
    
    return appointments.find(app => {
      const appDateStr = typeof app.date === 'string' 
        ? app.date 
        : format(app.date, "yyyy-MM-dd");
      
      return appDateStr === dateStr && 
             app.professionalId === professionalId &&
             app.startTime <= time && 
             app.endTime > time;
    });
  };
  
  // Verificar se há sobreposição com outros agendamentos
  const checkForOverlap = (professionalId: number, startTime: string, endTime: string) => {
    const dateStr = format(currentDate, "yyyy-MM-dd");
    
    // Filtrar os agendamentos para o dia e profissional selecionados
    const profAppointments = appointments.filter(app => {
      const appDateStr = typeof app.date === 'string' 
        ? app.date 
        : format(app.date, "yyyy-MM-dd");
      return appDateStr === dateStr && app.professionalId === professionalId;
    });
    
    // Converter horários para minutos para facilitar a comparação
    const convertToMinutes = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const startMinutes = convertToMinutes(startTime);
    const endMinutes = convertToMinutes(endTime);
    
    // Verificar se há sobreposição com algum agendamento existente
    return profAppointments.some(app => {
      const appStartMinutes = convertToMinutes(app.startTime);
      const appEndMinutes = convertToMinutes(app.endTime);
      
      // Verificar sobreposição: não (fim <= início do outro OU início >= fim do outro)
      return !(endMinutes <= appStartMinutes || startMinutes >= appEndMinutes);
    });
  };
  
  // Renderizar um agendamento
  const renderAppointment = (appointment: Appointment) => {
    const startTimeIndex = timeSlots.indexOf(appointment.startTime);
    const endTimeIndex = timeSlots.indexOf(appointment.endTime);
    const durationInSlots = endTimeIndex - startTimeIndex;
    
    // Verificar se é uma consulta passada (para exemplo)
    const isPastAppointment = [
      '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:30', '14:30', '15:30', '16:30'
    ].some(time => appointment.startTime === time);
    
    // Estilo diferente para consultas passadas vs futuras
    const bgColorClass = isPastAppointment 
      ? 'bg-gray-100 border border-gray-300' 
      : (appointment.color || 'bg-blue-100');
    
    const statusClass = (() => {
      switch(appointment.status) {
        case 'completed': return 'bg-green-100 border-green-500';
        case 'cancelled': return 'bg-red-100 border-red-500';
        case 'pending': return 'bg-yellow-100 border-yellow-500';
        default: return bgColorClass;
      }
    })();
    
    return (
      <div 
        className={`absolute z-10 left-0 right-0 mx-2 my-1 rounded p-1 overflow-hidden shadow-sm select-none ${statusClass}`}
        style={{ 
          top: `${startTimeIndex * 48}px`, 
          height: `${durationInSlots * 48 - 2}px`,
        }}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onAppointmentClick && onAppointmentClick(appointment);
        }}
      >
        <div className={`text-xs font-medium truncate ${isPastAppointment ? 'text-gray-700' : ''}`}>
          {appointment.patientName}
          {isPastAppointment && ' ✓'}
        </div>
        <div className="text-xs truncate">{appointment.procedure}</div>
        <div className="text-xs text-gray-500 truncate">
          {appointment.startTime} - {appointment.endTime}
        </div>
        {isPastAppointment && (
          <div className="text-xs mt-1 text-gray-500 bg-gray-200 rounded px-1 inline-block">
            Consulta realizada
          </div>
        )}
      </div>
    );
  };
  
  // Renderizar a seleção de horário durante o arrasto
  const renderSelection = (professionalId: number) => {
    if (!selectionStart || !selectionEnd || selectionStart.professional !== professionalId || selectionEnd.professional !== professionalId) {
      return null;
    }
    
    const startTimeIndex = timeSlots.indexOf(selectionStart.time);
    const endTimeIndex = timeSlots.indexOf(selectionEnd.time);
    
    const topIndex = Math.min(startTimeIndex, endTimeIndex);
    const bottomIndex = Math.max(startTimeIndex, endTimeIndex);
    const durationInSlots = bottomIndex - topIndex + 1;
    
    const startDisplay = timeSlots[topIndex];
    const endDisplay = timeSlots[bottomIndex];
    
    // Verificar se há sobreposição com outros agendamentos
    const hasOverlap = checkForOverlap(professionalId, startDisplay, endDisplay);
    
    // Duração em minutos
    const durationMinutes = (bottomIndex - topIndex) * 30;
    
    return (
      <div 
        className={`absolute z-5 left-0 right-0 mx-2 rounded overflow-hidden select-none transition-colors duration-200 ${
          hasOverlap 
            ? 'bg-red-50 border-l-4 border-red-500' 
            : 'bg-blue-50 border-l-4 border-blue-500'
        }`}
        style={{ 
          top: `${topIndex * 48}px`, 
          height: `${durationInSlots * 48 - 2}px`,
        }}
      >
        <div className="p-2 text-xs">
          <div className="font-medium">{hasOverlap ? 'Horário ocupado' : 'Novo Agendamento'}</div>
          <div className={hasOverlap ? 'text-red-600' : 'text-gray-600'}>
            {startDisplay} - {endDisplay}
          </div>
          <div className="text-gray-500 mt-1">
            Duração: {durationMinutes} min
          </div>
        </div>
      </div>
    );
  };
  
  // Dados de exemplo para os agendamentos
  const mockAppointments: Appointment[] = [
    {
      id: 1,
      date: currentDate,
      professionalId: professionals[0]?.id || 1,
      startTime: "07:00",
      endTime: "08:00",
      patientName: "Sem paciente",
      professionalName: professionals[0]?.name || "Dr. Exemplo",
      procedure: "Bloqueado",
      status: "blocked",
      color: "bg-gray-200"
    },
    {
      id: 2,
      date: currentDate,
      professionalId: professionals[2]?.id || 3,
      startTime: "07:00",
      endTime: "08:30",
      patientName: "Bianca Lima",
      professionalName: professionals[2]?.name || "Dra. Exemplo",
      procedure: "Tratamento de canal",
      status: "confirmed",
      color: "bg-green-100"
    }
  ];
  
  // Combinar os agendamentos de exemplo com os passados por prop
  const allAppointments = [...appointments, ...mockAppointments];
  
  return (
    <div className="calendar-day-view w-full select-none">
      {/* Controles do calendário */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" onClick={prevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className={`text-xl font-bold ${isToday(currentDate) ? 'text-blue-600' : ''}`}>
            {format(currentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </h2>
          <Button variant="outline" size="icon" onClick={nextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Tabela de horários */}
      <div className="border rounded-md">
        {/* Cabeçalho da tabela */}
        <div className="grid" style={{ 
          gridTemplateColumns: `120px repeat(${professionals.length}, 1fr)`,
        }}>
          <div className="p-3 font-medium border-r border-b bg-gray-50">
            Horário
          </div>
          
          {professionals.map(professional => (
            <div key={professional.id} className="p-3 font-medium text-center border-r border-b bg-gray-50">
              <div className="font-bold">{professional.name}</div>
              <div className="text-sm text-gray-500">{professional.specialty}</div>
            </div>
          ))}
        </div>
        
        {/* Corpo da tabela */}
        <div 
          ref={gridRef}
          className="grid select-none"
          onMouseLeave={handleMouseLeave}
          style={{ 
            gridTemplateColumns: `120px repeat(${professionals.length}, 1fr)`,
          }}
        >
          {/* Coluna de horários */}
          <div>
            {timeSlots.map((time, i) => {
              // Verificar se este é um dos horários específicos mencionados pelo usuário
              const isSpecialTime = ['09:00', '10:00', '11:00', '12:00', '13:30', '14:30', '15:30', '16:30'].includes(time);
              
              return (
                <div 
                  key={i} 
                  className={`h-12 border-b border-r p-1 font-medium text-sm ${
                    isSpecialTime ? 'text-blue-600 font-bold' : 'text-gray-500'
                  }`}
                >
                  <div className="flex items-center h-full justify-end pr-2">
                    {time}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Colunas para cada profissional */}
          {professionals.map(professional => (
            <div key={professional.id} className="relative">
              {timeSlots.map((time, timeIndex) => {
                const appointment = getAppointmentForTimeSlot(professional.id, time);
                const isSelected = isInSelection(professional.id, time);
                
                return (
                  <div 
                    key={timeIndex}
                    className={`h-12 border-b border-r p-1 select-none transition-colors duration-150 
                      ${isSelected ? 'bg-blue-100' : 'hover:bg-gray-50'}`}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevenir seleção de texto
                      handleMouseDown(professional.id, time);
                    }}
                    onMouseMove={(e) => {
                      if (isDragging) e.preventDefault(); // Prevenir seleção de texto quando arrasta
                      handleMouseMove(professional.id, time);
                    }}
                    style={{ cursor: isDragging ? 'grabbing' : 'pointer' }}
                  >
                    {!appointment && !isSelected && (
                      <div className="flex items-center justify-center h-full text-blue-500 opacity-0 hover:opacity-100">
                        <Plus className="h-4 w-4 mr-1" />
                        <span className="text-xs">Arraste para selecionar</span>
                      </div>
                    )}
                    {appointment && renderAppointment(appointment)}
                  </div>
                );
              })}
              
              {/* Renderizar a seleção de arrasto sobre as células */}
              {renderSelection(professional.id)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}