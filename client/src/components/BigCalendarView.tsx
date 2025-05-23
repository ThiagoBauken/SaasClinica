import React, { useState, useCallback } from 'react';
import { Calendar, momentLocalizer, SlotInfo } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/pt-br';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from 'date-fns';

// Configurar localização para português
moment.locale('pt-br');
const localizer = momentLocalizer(moment);

// Tipo para os eventos do calendário
interface Event {
  id: number;
  title: string;
  start: Date;
  end: Date;
  resource?: any;
  patientName?: string;
  professionalName?: string;
  procedure?: string;
  status?: string;
  color?: string;
}

// Interface para as propriedades do componente
interface BigCalendarViewProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  onTimeRangeSelect?: (date: Date, startTime: string, endTime: string) => void;
  onAppointmentClick?: (appointment: Event) => void;
  professionals?: { id: number; name: string; specialty: string }[];
  appointments?: any[];
}

// Removemos o modal de confirmação para acelerar o processo de agendamento

const BigCalendarView: React.FC<BigCalendarViewProps> = ({
  selectedDate = new Date(),
  onDateSelect,
  onTimeRangeSelect,
  onAppointmentClick,
  professionals = [],
  appointments = []
}) => {
  // Removidos os estados para o modal de confirmação, agora a seleção é direta
  // Estado para a data atual
  const [currentDate, setCurrentDate] = useState(selectedDate);

  // Converter agendamentos para o formato de evento do calendário
  const events: Event[] = appointments.map((appointment: any) => {
    const start = new Date(
      typeof appointment.date === 'string' ? appointment.date : appointment.date
    );
    const end = new Date(
      typeof appointment.date === 'string' ? appointment.date : appointment.date
    );
    
    // Configurar hora de início
    const [startHour, startMinute] = appointment.startTime.split(':').map(Number);
    start.setHours(startHour, startMinute, 0);
    
    // Configurar hora de fim
    const [endHour, endMinute] = appointment.endTime.split(':').map(Number);
    end.setHours(endHour, endMinute, 0);
    
    // Verificar se é uma consulta passada (só para exemplo)
    const isPastAppointment = ['09:00', '10:00', '11:00', '12:00', '13:30', '14:30', '15:30', '16:30'].includes(appointment.startTime);

    // Estilo para eventos
    const style = isPastAppointment 
      ? { backgroundColor: '#f3f4f6', borderLeft: '4px solid #9ca3af' }
      : { backgroundColor: '#dbeafe', borderLeft: '4px solid #3b82f6' };
    
    return {
      id: appointment.id,
      title: appointment.patientName || 'Sem título',
      start,
      end,
      patientName: appointment.patientName,
      professionalName: appointment.professionalName,
      procedure: appointment.procedure,
      status: appointment.status,
      resource: appointment.professionalId,
      style
    };
  });

  // Função para lidar com a seleção de slot - agora cria diretamente sem confirmação
  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    // Cria diretamente o agendamento sem mostrar o modal de confirmação
    const date = new Date(slotInfo.start);
    const startTime = format(slotInfo.start, 'HH:mm');
    const endTime = format(slotInfo.end, 'HH:mm');
    
    if (onTimeRangeSelect) {
      onTimeRangeSelect(date, startTime, endTime);
    }
  }, [onTimeRangeSelect]);

  // Função para lidar com a seleção de evento
  const handleSelectEvent = useCallback((event: Event) => {
    if (onAppointmentClick) {
      onAppointmentClick(event);
    }
  }, [onAppointmentClick]);

  // Função de criação de evento foi removida pois agora é tratada diretamente no handleSelectSlot

  // Função para navegar entre datas
  const handleNavigate = useCallback((newDate: Date) => {
    setCurrentDate(newDate);
    if (onDateSelect) {
      onDateSelect(newDate);
    }
  }, [onDateSelect]);

  // Mensagens personalizadas para o calendário
  const messages = {
    allDay: 'Dia inteiro',
    previous: 'Anterior',
    next: 'Próximo',
    today: 'Hoje',
    month: 'Mês',
    week: 'Semana',
    day: 'Dia',
    agenda: 'Agenda',
    date: 'Data',
    time: 'Hora',
    event: 'Evento',
    noEventsInRange: 'Não há eventos neste período.',
    showMore: (total: number) => `+${total} mais`,
    createEvent: 'Clique e arraste para criar um novo agendamento'
  };

  // Estilos adicionais para o componente (opcional)
  const calendarStyle = `
    /* Impedir seleção de texto durante o drag */
    .rbc-calendar {
      user-select: none !important;
      -webkit-user-select: none !important;
      -moz-user-select: none !important;
      -ms-user-select: none !important;
    }
    
    /* Melhorar visualização durante a seleção */
    .rbc-slot-selecting {
      background-color: rgba(0, 115, 230, 0.2) !important;
    }
    
    /* Destaque mais forte para a área selecionada */
    .rbc-slot-selection {
      background-color: rgba(0, 115, 230, 0.5) !important;
      border: 3px solid #0073e6 !important;
      border-radius: 4px;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.5);
    }
    
    /* Garantir que events na seleção sejam bem visíveis */
    .rbc-event.rbc-selected {
      background-color: #3b82f6 !important;
      border: 2px solid #1e40af !important;
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5);
    }
    
    .rbc-time-slot {
      border-top: 1px solid #f0f0f0;
    }
    .rbc-timeslot-group {
      border-bottom: 1px solid #e0e0e0;
    }
    .rbc-time-header-content {
      border-left: 1px solid #e0e0e0;
    }
    
    /* Garantir que o cursor seja correto durante o drag */
    .rbc-day-slot .rbc-background-event,
    .rbc-day-slot .rbc-event,
    .rbc-day-slot {
      cursor: pointer;
    }
  `;

  // Para visualização com recursos (profissionais)
  const resources = professionals.length > 0 
    ? [{
        fieldName: 'resource',
        title: 'Profissional',
        resources: professionals.map(p => ({
          id: p.id,
          title: p.name,
          specialty: p.specialty
        }))
      }]
    : undefined;

  return (
    <div className="big-calendar-view">
      <style>{calendarStyle}</style>
      
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 700 }}
        defaultView="week"
        views={['day', 'week', 'month']}
        step={30} // Intervalos de 30 minutos
        timeslots={1} // 1 slot por passo
        selectable={true} // Habilita a seleção de slots
        date={currentDate}
        onNavigate={handleNavigate}
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        longPressThreshold={50} // Tempo para considerar um toque longo (para dispositivos touch)
        messages={messages}
        min={new Date(0, 0, 0, 7, 0, 0)} // Horário mínimo: 7h da manhã
        max={new Date(0, 0, 0, 23, 0, 0)} // Horário máximo: 23h
        eventPropGetter={(event: any) => ({
          style: event.style || {}
        })}
      />
    </div>
  );
};

export default BigCalendarView;