import { useState } from "react";
import { format, parseISO, addMinutes, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Clock, 
  User, 
  Phone, 
  MoreHorizontal,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { AppointmentWithRelations } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DayListViewProps {
  selectedDate: Date;
  appointments?: AppointmentWithRelations[];
  onAppointmentClick?: (appointment: AppointmentWithRelations) => void;
  onEditAppointment?: (appointment: AppointmentWithRelations) => void;
  onDeleteAppointment?: (appointmentId: number) => void;
  onNewAppointment?: (time?: string) => void;
  timeInterval?: number;
  workingHours?: {
    start: number;
    end: number;
  };
}

export default function DayListView({
  selectedDate,
  appointments = [],
  onAppointmentClick,
  onEditAppointment,
  onDeleteAppointment,
  onNewAppointment,
  timeInterval = 30,
  workingHours = { start: 7, end: 19 }
}: DayListViewProps) {
  
  // Filter appointments for the selected date
  const dayAppointments = appointments.filter(appointment =>
    isSameDay(parseISO(appointment.startTime), selectedDate)
  ).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  // Generate time slots for the day
  const generateTimeSlots = () => {
    const slots = [];
    const startHour = workingHours.start;
    const endHour = workingHours.end;
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += timeInterval) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(time);
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const getAppointmentForTime = (time: string) => {
    return dayAppointments.find(appointment => {
      const appointmentTime = format(parseISO(appointment.startTime), "HH:mm");
      return appointmentTime === time;
    });
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'confirmed': return 'border-l-green-500 bg-green-50 dark:bg-green-900/20';
      case 'scheduled': return 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/20';
      case 'in_progress': return 'border-l-purple-500 bg-purple-50 dark:bg-purple-900/20';
      case 'completed': return 'border-l-gray-500 bg-gray-50 dark:bg-gray-900/20';
      case 'cancelled': return 'border-l-red-500 bg-red-50 dark:bg-red-900/20';
      case 'no_show': return 'border-l-orange-500 bg-orange-50 dark:bg-orange-900/20';
      default: return 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/20';
    }
  };

  const getStatusBadgeColor = (status: string): string => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-700 border-green-200';
      case 'scheduled': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'in_progress': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'completed': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      case 'no_show': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'confirmed': return 'Confirmado';
      case 'scheduled': return 'Agendado';
      case 'in_progress': return 'Em andamento';
      case 'completed': return 'Concluído';
      case 'cancelled': return 'Cancelado';
      case 'no_show': return 'Não compareceu';
      default: return 'Agendado';
    }
  };

  const getInitials = (fullName: string): string => {
    return fullName
      .split(' ')
      .map(name => name.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const isLunchTime = (time: string): boolean => {
    const hour = parseInt(time.split(':')[0]);
    return hour >= 12 && hour < 13;
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>
            {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </span>
          <Badge variant="secondary">
            {dayAppointments.length} agendamento{dayAppointments.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-1 max-h-[600px] overflow-y-auto">
        {timeSlots.map((time, index) => {
          const appointment = getAppointmentForTime(time);
          const isLunch = isLunchTime(time);
          
          if (appointment) {
            return (
              <div
                key={time}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border-l-4 transition-colors cursor-pointer",
                  getStatusColor(appointment.status),
                  "hover:shadow-sm"
                )}
                onClick={() => onAppointmentClick && onAppointmentClick(appointment)}
              >
                {/* Time */}
                <div className="flex flex-col items-center text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[50px]">
                  <span>{time}</span>
                  <span className="text-xs">
                    {format(parseISO(appointment.endTime), "HH:mm")}
                  </span>
                </div>

                {/* Patient Avatar */}
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    {appointment.patient?.fullName ? getInitials(appointment.patient.fullName) : 'P'}
                  </span>
                </div>

                {/* Appointment Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium truncate">
                      {appointment.patient?.fullName || 'Paciente'}
                    </h4>
                    <Badge 
                      variant="outline" 
                      className={cn("text-xs", getStatusBadgeColor(appointment.status))}
                    >
                      {getStatusText(appointment.status)}
                    </Badge>
                  </div>
                  
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    {appointment.procedures && appointment.procedures.length > 0 && (
                      <p className="truncate">
                        {appointment.procedures[0].name}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-3 text-xs">
                      {appointment.professional && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span className="truncate">{appointment.professional.fullName}</span>
                        </div>
                      )}
                      {appointment.patient?.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          <span>{appointment.patient.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEditAppointment && onEditAppointment(appointment)}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onAppointmentClick && onAppointmentClick(appointment)}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Ver detalhes
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => onDeleteAppointment && onDeleteAppointment(appointment.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          }

          // Empty time slot
          return (
            <div
              key={time}
              className={cn(
                "flex items-center gap-3 p-2 rounded-lg transition-colors",
                isLunch 
                  ? "bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/10 dark:border-yellow-800" 
                  : "hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer",
                "border border-transparent"
              )}
              onClick={() => !isLunch && onNewAppointment && onNewAppointment(time)}
            >
              {/* Time */}
              <div className="text-sm text-gray-500 dark:text-gray-400 min-w-[50px] text-center">
                {time}
              </div>

              {/* Empty slot content */}
              <div className="flex-1 flex items-center justify-center">
                {isLunch ? (
                  <span className="text-sm text-yellow-700 dark:text-yellow-300">
                    🍽️ Intervalo para almoço
                  </span>
                ) : (
                  <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
                    <Plus className="h-4 w-4" />
                    <span className="text-sm">Horário disponível</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {dayAppointments.length === 0 && (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              Nenhum agendamento para hoje
            </p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onNewAppointment && onNewAppointment()}
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar agendamento
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}