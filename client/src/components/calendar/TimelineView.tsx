import { AppointmentWithRelations, TimeSlot } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

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
}

export default function TimelineView({
  date,
  professionals,
  timeSlots,
  onSlotClick,
  onAppointmentClick
}: TimelineViewProps) {
  // Helper function to get appointment color class
  const getAppointmentColorClass = (appointment: AppointmentWithRelations) => {
    if (appointment.color) {
      return appointment.color; // Custom color from the appointment
    }
    
    // Default colors based on status
    switch (appointment.status) {
      case 'scheduled':
        return 'bg-blue-100 border-l-4 border-primary';
      case 'confirmed':
        return 'bg-green-100 border-l-4 border-secondary';
      case 'in_progress':
        return 'bg-purple-100 border-l-4 border-purple-600';
      case 'completed':
        return 'bg-indigo-100 border-l-4 border-indigo-600';
      case 'cancelled':
        return 'bg-red-100 border-l-4 border-red-600';
      case 'no_show':
        return 'bg-gray-100 border-l-4 border-gray-600';
      default:
        return 'bg-blue-100 border-l-4 border-primary';
    }
  };

  // Helper function to get status badge class
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-status-pending bg-opacity-20 text-status-pending';
      case 'confirmed':
        return 'bg-status-confirmed bg-opacity-20 text-status-confirmed';
      case 'in_progress':
        return 'bg-purple-600 bg-opacity-20 text-purple-600';
      case 'completed':
        return 'bg-indigo-600 bg-opacity-20 text-indigo-600';
      case 'cancelled':
        return 'bg-status-cancelled bg-opacity-20 text-status-cancelled';
      case 'no_show':
        return 'bg-gray-600 bg-opacity-20 text-gray-600';
      default:
        return 'bg-status-pending bg-opacity-20 text-status-pending';
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

  return (
    <div className="bg-card rounded-lg shadow-sm border overflow-hidden">
      {/* Time header */}
      <div className="flex border-b">
        <div className="w-20 py-2 px-3 text-center text-sm font-medium text-muted-foreground border-r">
          Horário
        </div>
        
        {professionals.map((prof) => (
          <div 
            key={prof.id} 
            className="flex-1 py-2 px-3 text-center text-sm font-medium border-r last:border-r-0"
          >
            {prof.fullName}
          </div>
        ))}
      </div>
      
      {/* Timeline slots */}
      <div className="relative" style={{ height: '650px', overflowY: 'auto' }}>
        {timeSlots.map((slot, index) => (
          <div key={index} className="flex border-b h-20">
            <div className="w-20 py-2 px-3 text-center text-sm text-muted-foreground border-r flex items-center justify-center">
              {slot.time}
            </div>
            
            {professionals.map((prof) => {
              const appointment = slot.appointments[prof.id];
              return (
                <div 
                  key={prof.id} 
                  className="flex-1 border-r last:border-r-0 p-1 relative"
                >
                  <div 
                    className="absolute inset-0 hover:bg-muted opacity-0 hover:opacity-25 cursor-pointer"
                    onClick={() => onSlotClick(prof.id, slot.time)}
                  ></div>
                  
                  {appointment && (
                    <div 
                      className={cn(
                        "appointment h-full rounded px-2 py-1 shadow-sm cursor-pointer",
                        getAppointmentColorClass(appointment)
                      )}
                      onClick={() => onAppointmentClick(appointment)}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-medium text-sm">{appointment.patient?.fullName || appointment.title}</span>
                        <span className={cn(
                          "text-xs px-1 py-0.5 rounded",
                          getStatusBadgeClass(appointment.status)
                        )}>
                          {getStatusText(appointment.status)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(parseISO(appointment.startTime), 'HH:mm')} - {format(parseISO(appointment.endTime), 'HH:mm')}
                      </div>
                      <div className="text-xs mt-1">
                        {appointment.procedures && appointment.procedures.length > 0 
                          ? appointment.procedures[0].name 
                          : 'Consulta'}
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
