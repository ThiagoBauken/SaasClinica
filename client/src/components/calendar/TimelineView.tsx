import { AppointmentWithRelations, TimeSlot } from "@/lib/types";
import { format, parseISO, differenceInMinutes, isBefore, isAfter } from "date-fns";
import { cn } from "@/lib/utils";
import { 
  Calendar, 
  Clock, 
  Edit2, 
  Check, 
  X, 
  AlertTriangle, 
  MessageCircle,
  MoreHorizontal,
  ArrowRight
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useMemo, useCallback } from "react";

interface TimelineViewProps {
  date: Date;
  professionals: Array<{
    id: number;
    fullName: string;
    speciality?: string;
  }>;
  timeSlots: TimeSlot[];
  onSlotClick: (professionalId: number, time: string) => void;
  onAppointmentClick: (appointment: AppointmentWithRelations) => void;
  viewType?: 'day' | 'timeline'; // Adicionar tipo de visualização
}

export default function TimelineView({
  date,
  professionals,
  timeSlots,
  onSlotClick,
  onAppointmentClick,
  viewType = 'timeline' // Valor padrão é timeline
}: TimelineViewProps) {
  const [hoveredSlot, setHoveredSlot] = useState<{profId: number, time: string} | null>(null);
  
  // Helper function to get appointment color class
  const getAppointmentColorClass = (appointment: AppointmentWithRelations) => {
    if (appointment.type === 'block') {
      return 'bg-gray-100 border-l-4 border-gray-500 dark:bg-gray-800 dark:border-gray-600';
    }
    
    // Default colors based on status
    switch (appointment.status) {
      case 'scheduled':
        return 'bg-blue-50 border-l-4 border-blue-500 dark:bg-blue-900/20 dark:border-blue-400';
      case 'confirmed':
        return 'bg-green-50 border-l-4 border-green-500 dark:bg-green-900/20 dark:border-green-400';
      case 'in_progress':
        return 'bg-purple-50 border-l-4 border-purple-500 dark:bg-purple-900/20 dark:border-purple-400';
      case 'completed':
        return 'bg-indigo-50 border-l-4 border-indigo-500 dark:bg-indigo-900/20 dark:border-indigo-400';
      case 'cancelled':
        return 'bg-red-50 border-l-4 border-red-500 dark:bg-red-900/20 dark:border-red-400';
      case 'no_show':
        return 'bg-gray-50 border-l-4 border-gray-500 dark:bg-gray-800 dark:border-gray-600';
      default:
        return 'bg-blue-50 border-l-4 border-blue-500 dark:bg-blue-900/20 dark:border-blue-400';
    }
  };

  // Helper function to get status badge class
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
      case 'confirmed':
        return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
      case 'in_progress':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
      case 'completed':
        return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300';
      case 'cancelled':
        return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
      case 'no_show':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
      default:
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Agendado';
      case 'confirmed': return 'Confirmado';
      case 'in_progress': return 'Em andamento';
      case 'completed': return 'Concluído';
      case 'cancelled': return 'Cancelado';
      case 'no_show': return 'Não compareceu';
      default: return 'Agendado';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return <Calendar className="h-3 w-3" />;
      case 'confirmed': return <Check className="h-3 w-3" />;
      case 'in_progress': return <ArrowRight className="h-3 w-3" />;
      case 'completed': return <Check className="h-3 w-3" />;
      case 'cancelled': return <X className="h-3 w-3" />;
      case 'no_show': return <AlertTriangle className="h-3 w-3" />;
      default: return <Calendar className="h-3 w-3" />;
    }
  };

  // Detect appointment conflicts
  const hasConflict = useCallback((appointment: AppointmentWithRelations, allAppointments: AppointmentWithRelations[]): boolean => {
    const apptStart = new Date(appointment.startTime);
    const apptEnd = new Date(appointment.endTime);
    
    return allAppointments.some(other => 
      other.id !== appointment.id && 
      other.professionalId === appointment.professionalId &&
      other.status !== 'cancelled' &&
      ((isBefore(apptStart, new Date(other.endTime)) && isAfter(apptEnd, new Date(other.startTime))) ||
       (isBefore(new Date(other.startTime), apptEnd) && isAfter(new Date(other.endTime), apptStart)))
    );
  }, []);

  // Get all appointments flat array
  const allAppointments = useMemo(() => {
    return timeSlots.flatMap(slot => 
      Object.values(slot.appointments).filter(Boolean) as AppointmentWithRelations[]
    );
  }, [timeSlots]);

  // Calculate available time percentage for the time slot
  const getAvailabilityClass = useCallback((profId: number, time: string): string => {
    // Check if this slot is at the current time or in the future
    const slotTime = new Date(`${format(date, 'yyyy-MM-dd')}T${time}:00`);
    const now = new Date();
    
    if (isBefore(slotTime, now)) {
      return 'bg-gray-50 dark:bg-gray-900/20'; // Past times are gray
    }
    
    // Check if this professional has appointments at this time
    const hasAppointment = allAppointments.some(appt => 
      appt.professionalId === profId &&
      appt.status !== 'cancelled' &&
      format(parseISO(appt.startTime), 'HH:mm') <= time &&
      format(parseISO(appt.endTime), 'HH:mm') > time
    );
    
    return hasAppointment 
      ? 'bg-red-50/10 dark:bg-red-900/5' // Busy slot
      : 'bg-green-50/10 dark:bg-green-900/5 hover:bg-green-100/50 dark:hover:bg-green-800/10'; // Available slot
  }, [date, allAppointments]);

  return (
    <div className="bg-card rounded-lg shadow-sm border overflow-hidden">
      {/* Time header */}
      <div className="sticky top-0 z-10 flex border-b bg-background">
        <div className="w-16 py-2 px-2 text-center text-xs font-medium text-muted-foreground border-r">
          Horário
        </div>
        
        {professionals.map((prof) => (
          <div 
            key={prof.id} 
            className="flex-1 py-2 px-3 text-center text-sm font-medium border-r last:border-r-0 truncate"
          >
            {prof.fullName}
            {prof.speciality && (
              <div className="text-xs text-muted-foreground font-normal">{prof.speciality}</div>
            )}
          </div>
        ))}
      </div>
      
      {/* Timeline slots */}
      <div className="relative" style={{ height: '650px', overflowY: 'auto' }}>
        {timeSlots.map((slot, index) => (
          <div key={index} className="flex border-b h-16 last:border-b-0">
            <div className="w-16 py-2 px-2 text-center text-xs text-muted-foreground border-r flex flex-col items-center justify-center sticky left-0 bg-background z-10">
              <span>{slot.time}</span>
            </div>
            
            {professionals.map((prof) => {
              const appointment = slot.appointments[prof.id];
              const isHovered = hoveredSlot?.profId === prof.id && hoveredSlot?.time === slot.time;
              
              return (
                <div 
                  key={prof.id} 
                  className={cn(
                    "flex-1 border-r last:border-r-0 p-1 relative transition-colors duration-200",
                    getAvailabilityClass(prof.id, slot.time)
                  )}
                  onMouseEnter={() => setHoveredSlot({profId: prof.id, time: slot.time})}
                  onMouseLeave={() => setHoveredSlot(null)}
                >
                  {!appointment && isHovered && (
                    <div 
                      className="absolute inset-0 flex items-center justify-center cursor-pointer"
                      onClick={() => onSlotClick(prof.id, slot.time)}
                    >
                      <div className="bg-primary/10 text-primary text-xs py-1 px-2 rounded-full">
                        + Agendar
                      </div>
                    </div>
                  )}
                  
                  {appointment && (
                    <div 
                      className={cn(
                        "appointment h-full rounded px-2 py-1 shadow-sm group cursor-pointer relative overflow-hidden transition-all duration-100",
                        getAppointmentColorClass(appointment),
                        hasConflict(appointment, allAppointments) && "ring-2 ring-red-500 ring-opacity-50"
                      )}
                    >
                      {/* Quick action buttons that appear on hover */}
                      <div className="absolute right-1 top-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <TooltipProvider>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="h-5 w-5 rounded-full bg-white/80 p-0.5 flex items-center justify-center">
                              <MoreHorizontal className="h-3 w-3 text-gray-500" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                onAppointmentClick(appointment);
                              }}>
                                <Edit2 className="mr-2 h-4 w-4" />
                                <span>Editar</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Check className="mr-2 h-4 w-4" />
                                <span>Concluir</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <X className="mr-2 h-4 w-4" />
                                <span>Cancelar</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <MessageCircle className="mr-2 h-4 w-4" />
                                <span>Enviar mensagem</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TooltipProvider>
                      </div>
                      
                      {/* Conflict indicator */}
                      {hasConflict(appointment, allAppointments) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="absolute -left-1 top-1 bg-red-500 rounded-full p-0.5 shadow-md">
                              <AlertTriangle className="h-3 w-3 text-white" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Conflito de horário detectado!</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      
                      {/* Main content */}
                      <div className="flex flex-col pt-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-xs truncate max-w-[70%]">
                            {appointment.patient?.fullName || appointment.title}
                          </span>
                          <span className={cn(
                            "text-[10px] flex items-center gap-0.5 px-1 py-0.5 rounded-sm",
                            getStatusBadgeClass(appointment.status)
                          )}>
                            {getStatusIcon(appointment.status)}
                            <span>{getStatusText(appointment.status)}</span>
                          </span>
                        </div>
                        
                        <div className="flex items-center text-[10px] text-muted-foreground mt-0.5">
                          <Clock className="h-2.5 w-2.5 mr-1" />
                          <span>
                            {format(parseISO(appointment.startTime), 'HH:mm')} - {format(parseISO(appointment.endTime), 'HH:mm')}
                            {' '}
                            ({differenceInMinutes(parseISO(appointment.endTime), parseISO(appointment.startTime))}min)
                          </span>
                        </div>
                        
                        {appointment.procedures && appointment.procedures.length > 0 && (
                          <div className="text-[10px] mt-0.5 truncate">
                            {appointment.procedures[0].name}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
