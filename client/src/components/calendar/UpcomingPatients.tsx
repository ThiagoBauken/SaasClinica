import { useState, useEffect } from "react";
import { format, addDays, isToday, isTomorrow, differenceInMinutes, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  User, 
  Phone, 
  Calendar, 
  ChevronRight,
  Users,
  Timer
} from "lucide-react";
import { AppointmentWithRelations } from "@/lib/types";
import { cn } from "@/lib/utils";

interface UpcomingPatientsProps {
  appointments?: AppointmentWithRelations[];
  limit?: number;
  onPatientClick?: (appointment: AppointmentWithRelations) => void;
}

export default function UpcomingPatients({ 
  appointments = [], 
  limit = 5,
  onPatientClick 
}: UpcomingPatientsProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  // Filter and sort upcoming appointments
  const upcomingAppointments = appointments
    .filter(appointment => {
      const appointmentTime = parseISO(appointment.startTime);
      return appointmentTime > currentTime && appointment.status !== 'cancelled';
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, limit);

  const getTimeUntilAppointment = (appointmentTime: string): string => {
    const now = currentTime;
    const apptTime = parseISO(appointmentTime);
    const minutesUntil = differenceInMinutes(apptTime, now);
    
    if (minutesUntil < 60) {
      return `${minutesUntil} min`;
    } else if (minutesUntil < 1440) { // Less than 24 hours
      const hours = Math.floor(minutesUntil / 60);
      return `${hours}h`;
    } else {
      const days = Math.floor(minutesUntil / 1440);
      return `${days}d`;
    }
  };

  const getAppointmentDateLabel = (appointmentTime: string): string => {
    const apptTime = parseISO(appointmentTime);
    
    if (isToday(apptTime)) {
      return "Hoje";
    } else if (isTomorrow(apptTime)) {
      return "Amanhã";
    } else {
      return format(apptTime, "dd/MM", { locale: ptBR });
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-700 border-green-200';
      case 'scheduled': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'in_progress': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'confirmed': return 'Confirmado';
      case 'scheduled': return 'Agendado';
      case 'in_progress': return 'Em andamento';
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

  if (upcomingAppointments.length === 0) {
    return (
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Próximos Pacientes
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-center py-6">
            <Users className="h-8 w-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Nenhum agendamento próximo
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          Próximos Pacientes
          <Badge variant="secondary" className="ml-auto">
            {upcomingAppointments.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {upcomingAppointments.map((appointment, index) => (
          <div
            key={appointment.id}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
              "hover:bg-gray-50 dark:hover:bg-gray-800 dark:border-gray-700",
              index === 0 && "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800"
            )}
            onClick={() => onPatientClick && onPatientClick(appointment)}
          >
            {/* Avatar */}
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                {appointment.patient?.fullName ? getInitials(appointment.patient.fullName) : 'P'}
              </span>
            </div>

            {/* Patient Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium truncate">
                  {appointment.patient?.fullName || 'Paciente'}
                </p>
                <Badge 
                  variant="outline" 
                  className={cn("text-xs", getStatusColor(appointment.status))}
                >
                  {getStatusText(appointment.status)}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <Calendar className="h-3 w-3" />
                <span>{getAppointmentDateLabel(appointment.startTime)}</span>
                <Clock className="h-3 w-3 ml-1" />
                <span>{format(parseISO(appointment.startTime), "HH:mm")}</span>
                {appointment.professional && (
                  <>
                    <User className="h-3 w-3 ml-1" />
                    <span className="truncate">{appointment.professional.fullName}</span>
                  </>
                )}
              </div>
            </div>

            {/* Time Until */}
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                <Timer className="h-3 w-3" />
                <span className="font-medium">
                  {getTimeUntilAppointment(appointment.startTime)}
                </span>
              </div>
              <ChevronRight className="h-3 w-3 text-gray-400 mt-1" />
            </div>
          </div>
        ))}

        {/* Show all button if there are more appointments */}
        {appointments.filter(apt => parseISO(apt.startTime) > currentTime && apt.status !== 'cancelled').length > limit && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full mt-3 text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Ver todos os agendamentos
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}