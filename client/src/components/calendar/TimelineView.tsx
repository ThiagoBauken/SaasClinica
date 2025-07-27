import { useState, useMemo } from "react";
import { format, addDays, startOfWeek, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppointmentWithRelations } from "@/lib/types";

interface TimelineViewProps {
  selectedDate: Date;
  appointments?: AppointmentWithRelations[];
  professionals: any[];
  onAppointmentClick?: (appointment: AppointmentWithRelations) => void;
  onNewAppointment?: (professionalId: number, time: string) => void;
  timeInterval?: number;
  viewMode?: "day" | "week";
}

export default function TimelineView({
  selectedDate,
  appointments = [],
  professionals,
  onAppointmentClick,
  onNewAppointment,
  timeInterval = 30,
  viewMode = "day"
}: TimelineViewProps) {
  const [hoveredSlot, setHoveredSlot] = useState<{ professionalId: number; time: string } | null>(null);

  // Generate time slots based on interval
  const generateTimeSlots = () => {
    const slots = [];
    const startHour = 7;
    const endHour = 19;
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += timeInterval) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push({ time });
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // Create appointment map for quick lookup
  const appointmentsMap = useMemo(() => {
    const map: Record<number, Record<string, AppointmentWithRelations>> = {};
    
    appointments.forEach(appointment => {
      if (!appointment.professionalId) return;
      
      const appointmentDate = parseISO(appointment.startTime);
      const appointmentTime = format(appointmentDate, "HH:mm");
      
      if (!map[appointment.professionalId]) {
        map[appointment.professionalId] = {};
      }
      
      map[appointment.professionalId][appointmentTime] = appointment;
    });
    
    return map;
  }, [appointments]);

  const getAppointmentColor = (status: string): string => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200';
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200';
      case 'in_progress': return 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200';
    }
  };

  const appointmentsForDay = (date: Date) => {
    return appointments.filter(appointment => 
      isSameDay(parseISO(appointment.startTime), date)
    );
  };

  if (viewMode === "week") {
    // Week view rendering
    return (
      <div className="p-0">
        <div className="min-w-[640px] md:min-w-0 grid grid-cols-7 border-b overflow-x-auto">
          {Array.from({length: 7}).map((_, i) => {
            const day = addDays(startOfWeek(selectedDate, {locale: ptBR}), i);
            const isToday = isSameDay(day, new Date());
            const isSelectedDay = isSameDay(day, selectedDate);
            return (
              <div 
                key={i} 
                className={cn(
                  "border-r last:border-r-0 py-2 cursor-pointer",
                  isToday && "bg-primary/5",
                  isSelectedDay && "bg-blue-100/50"
                )}
                onClick={() => {/* Handle day click */}}
              >
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">{format(day, "EEE", {locale: ptBR})}</div>
                  <div className={cn("text-base sm:text-xl font-bold", isToday && "text-primary")}>
                    {format(day, "dd")}
                  </div>
                  <div className="text-xs text-muted-foreground">{format(day, "MMM", {locale: ptBR})}</div>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="min-w-[640px] md:min-w-0 grid grid-cols-7 divide-x h-[calc(100vh-300px)] overflow-auto">
          {Array.from({length: 7}).map((_, i) => {
            const day = addDays(startOfWeek(selectedDate, {locale: ptBR}), i);
            const isToday = isSameDay(day, new Date());
            const dayAppointments = appointmentsForDay(day);
            
            return (
              <div 
                key={i} 
                className={cn("relative", isToday && "bg-primary/5")}
              >
                {/* Time slots */}
                {timeSlots.map((slot, index) => (
                  <div 
                    key={index} 
                    className="border-b h-12 sm:h-16 relative"
                  >
                    {index % 2 === 0 && (
                      <span className="absolute -left-0 top-0 text-[10px] sm:text-xs text-muted-foreground p-1">
                        {slot.time}
                      </span>
                    )}
                  </div>
                ))}
                
                {/* Appointments */}
                {dayAppointments.map(appt => {
                  const startTime = new Date(appt.startTime);
                  const endTime = new Date(appt.endTime);
                  
                  const startHour = startTime.getHours() + startTime.getMinutes() / 60;
                  const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
                  
                  // Calculate position relative to time slots
                  const baseHeight = window.innerWidth < 640 ? 48 : 64;
                  const startPosition = (startHour - 7) * baseHeight; 
                  const height = duration * baseHeight;
                  
                  return (
                    <div 
                      key={appt.id}
                      className={cn(
                        "absolute left-0 right-0 mx-1 rounded shadow-sm border-l-4 p-1 overflow-hidden z-10 cursor-pointer",
                        getAppointmentColor(appt.status)
                      )}
                      style={{
                        top: `${startPosition}px`,
                        height: `${height}px`,
                        minHeight: '24px'
                      }}
                      onClick={() => onAppointmentClick && onAppointmentClick(appt)}
                    >
                      <div className="text-xs font-medium truncate">
                        {format(startTime, "HH:mm")} - {appt.patient?.fullName || 'Sem paciente'}
                      </div>
                      {height > 30 && (
                        <div className="text-xs truncate">
                          {appt.procedures?.[0]?.name || appt.title}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Day view rendering (professionals timeline)
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        <div className="grid grid-cols-[80px_1fr] border-b">
          <div className="p-3 font-medium">Horário</div>
          <div className="grid" style={{ gridTemplateColumns: `repeat(${professionals.length}, minmax(180px, 1fr))` }}>
            {professionals.map(professional => (
              <div key={professional.id} className="p-3 text-center font-medium border-l">
                <div>{professional.fullName}</div>
                <div className="text-xs text-muted-foreground">{professional.speciality}</div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Time slots */}
        {timeSlots.map((slot, slotIndex) => (
          <div 
            key={slotIndex} 
            className={cn(
              "grid grid-cols-[80px_1fr] border-b",
              slotIndex % 2 === 0 && "bg-muted/5"
            )}
          >
            <div className="p-2 flex items-center justify-center">
              <span className="text-sm font-medium">{slot.time}</span>
            </div>
            
            <div 
              className="grid" 
              style={{ gridTemplateColumns: `repeat(${professionals.length}, minmax(180px, 1fr))` }}
            >
              {professionals.map(professional => {
                const appointment = appointmentsMap[professional.id]?.[slot.time];
                
                return (
                  <div 
                    key={professional.id} 
                    className="p-1 border-l min-h-[50px] relative"
                    onMouseEnter={() => setHoveredSlot({ professionalId: professional.id, time: slot.time })}
                    onMouseLeave={() => setHoveredSlot(null)}
                  >
                    {appointment ? (
                      <div 
                        className={cn(
                          "p-2 rounded h-full cursor-pointer",
                          getAppointmentColor(appointment.status)
                        )}
                        onClick={() => onAppointmentClick && onAppointmentClick(appointment)}
                      >
                        <div className="text-sm font-medium truncate">
                          {appointment.patient?.fullName || 'Sem paciente'}
                        </div>
                        <div className="text-xs truncate">
                          {format(parseISO(appointment.startTime), "HH:mm")} - {format(parseISO(appointment.endTime), "HH:mm")}
                        </div>
                        {appointment.title && (
                          <div className="text-xs truncate">{appointment.title}</div>
                        )}
                      </div>
                    ) : (
                      <div 
                        className={cn(
                          "h-full w-full flex items-center justify-center transition-opacity cursor-pointer",
                          hoveredSlot?.professionalId === professional.id && hoveredSlot?.time === slot.time
                            ? "opacity-100"
                            : "opacity-0 hover:opacity-100"
                        )}
                        onClick={() => onNewAppointment && onNewAppointment(professional.id, slot.time)}
                      >
                        <div className="text-xs text-primary flex items-center">
                          <Plus className="h-3 w-3 mr-1" />
                          Agendar
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}