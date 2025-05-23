import { useState, useEffect } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isToday,
  isSameDay,
  addMonths,
  subMonths,
  getDay,
  addDays,
  parseISO
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Calendar, X } from "lucide-react";
import { AppointmentWithRelations } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

interface MonthAgendaViewProps {
  appointments?: AppointmentWithRelations[];
  onDateSelect?: (date: Date) => void;
  onAppointmentClick?: (appointment: AppointmentWithRelations) => void;
}

export default function MonthAgendaView({
  appointments = [],
  onDateSelect,
  onAppointmentClick
}: MonthAgendaViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "agenda">("month");

  // Get days for the month calendar
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  // Full calendar grid including days from previous and next months
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  
  // Calculate the number of weeks to display
  const weeksToDisplay = Math.ceil(calendarDays.length / 7);
  
  // Navigation functions
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  // Handle date selection
  const handleDateClick = (day: Date) => {
    setSelectedDate(day);
    if (onDateSelect) {
      onDateSelect(day);
    }
  };

  // Get appointments for a specific day
  const getDayAppointments = (day: Date) => {
    return appointments.filter(appointment => {
      const appointmentDate = parseISO(appointment.startTime);
      return isSameDay(appointmentDate, day);
    });
  };

  // Get appointment status color
  const getAppointmentStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-slate-100 text-slate-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'no_show': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get days of the week
  const weekDays = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map(day => 
    day.charAt(0).toUpperCase() + day.slice(1)
  );

  return (
    <div className="calendar-month-view">
      {/* Calendar header with title and controls */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-medium">
            {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
          </h2>
        </div>
        
        <div className="flex items-center gap-2">
          <Select 
            value={viewMode} 
            onValueChange={(value) => setViewMode(value as "month" | "agenda")}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Visualização" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mês</SelectItem>
              <SelectItem value="agenda">Agenda</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            onClick={prevMonth}
            size="icon"
            className="h-9 w-9"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="outline" 
            onClick={nextMonth}
            size="icon"
            className="h-9 w-9"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          <Button variant="default" className="bg-indigo-600 hover:bg-indigo-700">
            Agenda
          </Button>
          
          <Button variant="outline">
            Retornos
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="border rounded-lg overflow-hidden shadow-sm">
        {/* Days of week header */}
        <div className="grid grid-cols-7 bg-gray-50 border-b">
          {weekDays.map((day, index) => (
            <div 
              key={index} 
              className={cn(
                "py-2 px-4 text-center text-sm font-medium",
                index === 0 || index === 6 ? "text-red-500" : "text-gray-700"
              )}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 bg-white">
          {calendarDays.map((day, index) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isCurrentDay = isToday(day);
            const isSelected = isSameDay(day, selectedDate);
            const dayAppointments = getDayAppointments(day);
            const hasAppointments = dayAppointments.length > 0;
            const dayStyles = cn(
              "min-h-[100px] border-b border-r p-1 relative",
              !isCurrentMonth && "bg-gray-50 text-gray-400",
              isCurrentDay && "bg-blue-50",
              isSelected && "ring-2 ring-inset ring-indigo-600"
            );

            return (
              <div 
                key={index} 
                className={dayStyles}
                onClick={() => handleDateClick(day)}
              >
                {/* Date number */}
                <div className="flex items-center justify-between">
                  <div className={cn(
                    "text-sm font-medium w-7 h-7 flex items-center justify-center",
                    isCurrentDay && "bg-indigo-600 text-white rounded-full"
                  )}>
                    {format(day, "d")}
                  </div>
                  
                  {/* Day number from week */}
                  <div className="text-xs text-gray-400">
                    {index < 7 && (
                      <span>{index + 1}</span>
                    )}
                  </div>
                </div>

                {/* Special events like holidays */}
                {isCurrentMonth && format(day, "dd/MM") === "01/05" && (
                  <div className="mt-1 px-1 py-0.5 text-xs bg-gray-100 rounded text-gray-700">
                    Dia do Trabalho
                  </div>
                )}

                {/* Appointments */}
                <div className="mt-1 space-y-1 max-h-[70px] overflow-hidden">
                  {hasAppointments && dayAppointments.slice(0, 2).map((appointment, idx) => (
                    <div 
                      key={idx} 
                      className="text-xs p-1 rounded cursor-pointer flex items-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onAppointmentClick) onAppointmentClick(appointment);
                      }}
                    >
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full mr-1",
                        appointment.status === 'confirmed' ? "bg-green-500" : 
                        appointment.status === 'cancelled' ? "bg-red-500" : "bg-blue-500"
                      )} />
                      <span className="truncate">
                        {format(parseISO(appointment.startTime), "HH:mm")} {appointment.patient?.fullName}
                      </span>
                    </div>
                  ))}
                  
                  {dayAppointments.length > 2 && (
                    <div className="text-xs text-indigo-600 font-medium pl-1">
                      + {dayAppointments.length - 2} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Appointment details for selected day */}
      {selectedDate && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-3">
            Agendamentos para {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
          </h3>
          
          {getDayAppointments(selectedDate).length === 0 ? (
            <p className="text-gray-500">Não há agendamentos para este dia.</p>
          ) : (
            <div className="space-y-2">
              {getDayAppointments(selectedDate).map((appointment, idx) => (
                <div 
                  key={idx} 
                  className="p-3 border rounded-md hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    if (onAppointmentClick) onAppointmentClick(appointment);
                  }}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        appointment.status === 'confirmed' ? "bg-green-500" : 
                        appointment.status === 'cancelled' ? "bg-red-500" : "bg-blue-500"
                      )} />
                      <h4 className="font-medium">{appointment.patient?.fullName}</h4>
                    </div>
                    <span className="text-sm text-indigo-600">
                      {format(parseISO(appointment.startTime), "HH:mm")} - {format(parseISO(appointment.endTime), "HH:mm")}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {appointment.procedures && appointment.procedures.length > 0 ? 
                      appointment.procedures[0].name : appointment.title}
                    {appointment.professional && <span> com {appointment.professional.fullName}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}