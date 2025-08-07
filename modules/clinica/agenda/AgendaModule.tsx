import { useState, useEffect, useMemo, lazy } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import CalendarHeader from "@/components/calendar/CalendarHeader";
import MonthAgendaView from "@/components/calendar/MonthAgendaView";
import AppointmentModal from "@/components/calendar/AppointmentModal";
import FitInModal from "@/components/calendar/FitInModal";
import ScheduleSettings from "@/components/calendar/ScheduleSettings";
import ScheduleSidebar from "@/components/calendar/ScheduleSidebar";
import ConfirmationModal from "@/components/calendar/ConfirmationModal";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { CalendarViewType, ProfessionalSummary, AppointmentWithRelations, TimeSlot } from "@/lib/types";
import { format, addMinutes, parseISO, startOfWeek, endOfWeek, addDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/core/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";

function AgendaModule() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<CalendarViewType>("day");
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [isFitInModalOpen, setIsFitInModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithRelations | undefined>(undefined);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // State for time slot selection
  const [selectedSlotInfo, setSelectedSlotInfo] = useState<{
    professionalId: number;
    time: string;
    endTime?: string;
    duration?: number;
  } | null>(null);
  
  // State for drag selection
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartSlot, setDragStartSlot] = useState<{
    professionalId: number;
    time: string;
    index: number;
  } | null>(null);
  
  // Time interval control (15, 20, 30 or 60 minutes)
  const [timeInterval, setTimeInterval] = useState<15 | 20 | 30 | 60>(30);
  
  // Professional filter state
  const [selectedProfessionalFilter, setSelectedProfessionalFilter] = useState<string>("all");
  const [selectedProfessionalForDay, setSelectedProfessionalForDay] = useState<number>();
  
  // Room filter state
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>("all");
  
  // Work hours configuration
  const [workHours, setWorkHours] = useState({
    startHour: 7,
    endHour: 19,
    weekDays: [
      { enabled: false, startHour: 7, endHour: 19 }, // Sunday
      { enabled: true, startHour: 7, endHour: 19 },  // Monday
      { enabled: true, startHour: 7, endHour: 19 },  // Tuesday
      { enabled: true, startHour: 7, endHour: 19 },  // Wednesday
      { enabled: true, startHour: 7, endHour: 19 },  // Thursday
      { enabled: true, startHour: 7, endHour: 19 },  // Friday
      { enabled: false, startHour: 7, endHour: 19 }, // Saturday
    ],
    lunchBreak: {
      enabled: true,
      startHour: 12, 
      endHour: 13
    }
  });

  // Fetch professionals
  const { data: professionals, isLoading: isLoadingProfessionals } = useQuery<any[]>({
    queryKey: ["/api/professionals"],
    enabled: !!user
  });

  // Generate professionals summary with load info
  const professionalsSummary: ProfessionalSummary[] = useMemo(() => {
    if (!professionals) return [];
    
    return professionals.map(prof => ({
      id: prof.id,
      fullName: prof.fullName,
      speciality: prof.speciality,
      roomName: `Sala ${prof.id.toString().padStart(2, '0')}`,
      load: Math.floor(Math.random() * 100), // This would come from actual data
      status: Math.random() > 0.7 ? "full" : Math.random() > 0.4 ? "moderate" : "available"
    }));
  }, [professionals]);
  
  // Filter appointments by day
  const appointmentsForDay = (day: Date) => {
    if (!appointments) return [];
    return appointments.filter(appointment => 
      isSameDay(parseISO(appointment.startTime), day)
    );
  };
  
  // Get appointment color based on status
  const getAppointmentColor = (status: string): string => {
    switch(status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-slate-100 text-slate-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'no_show': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Fetch appointments for the selected date
  const formattedDate = format(selectedDate, "yyyy-MM-dd");
  const { data: appointments, isLoading: isLoadingAppointments } = useQuery<AppointmentWithRelations[]>({
    queryKey: ["/api/appointments", formattedDate],
    enabled: !!user
  });

  // Generate time slots for the timeline view
  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    
    const dayOfWeek = selectedDate.getDay();
    const dayConfig = workHours.weekDays[dayOfWeek];
    
    if (!dayConfig.enabled) {
      return slots;
    }
    
    const startHour = dayConfig.startHour; 
    const endHour = dayConfig.endHour;
    const intervalMinutes = timeInterval;
    
    for (let hour = startHour; hour < endHour; hour++) {
      const isLunchHour = workHours.lunchBreak.enabled && 
                          hour >= workHours.lunchBreak.startHour && 
                          hour < workHours.lunchBreak.endHour;
      
      if (isLunchHour) {
        const lunchTime = `${hour.toString().padStart(2, '0')}:00`;
        const lunchAppointmentsMap: Record<number, AppointmentWithRelations | null> = {};
        if (professionals) {
          professionals.forEach(prof => {
            lunchAppointmentsMap[prof.id] = null;
          });
        }
        
        slots.push({
          time: lunchTime,
          isLunchBreak: true,
          appointments: lunchAppointmentsMap
        });
        
        continue;
      }
      
      for (let minute = 0; minute < 60; minute += intervalMinutes) {
        if (hour === endHour - 1 && minute + intervalMinutes > 60) {
          continue;
        }
        
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        const appointmentsMap: Record<number, AppointmentWithRelations | null> = {};
        if (professionals) {
          professionals.forEach(prof => {
            appointmentsMap[prof.id] = null;
          });
        }

        if (appointments) {
          appointments.forEach(appointment => {
            const appointmentStartTime = format(parseISO(appointment.startTime), 'HH:mm');
            if (appointmentStartTime === time && appointment.professionalId) {
              appointmentsMap[appointment.professionalId] = appointment;
            }
          });
        }

        slots.push({
          time,
          isLunchBreak: false,
          appointments: appointmentsMap
        });
      }
    }
    
    return slots;
  };

  const timeSlots = useMemo(() => generateTimeSlots(), [selectedDate, timeInterval, workHours, appointments, professionals]);

  // Create appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: any) => {
      return apiRequest("/api/appointments", "POST", appointmentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setIsAppointmentModalOpen(false);
      setSelectedSlotInfo(null);
      toast({
        title: "Agendamento criado",
        description: "O agendamento foi criado com sucesso."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar agendamento",
        description: error.message || "Ocorreu um erro ao criar o agendamento.",
        variant: "destructive"
      });
    }
  });

  // Update appointment mutation
  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest(`/api/appointments/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setIsAppointmentModalOpen(false);
      setSelectedAppointment(undefined);
      setIsEditMode(false);
      toast({
        title: "Agendamento atualizado",
        description: "O agendamento foi atualizado com sucesso."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar agendamento",
        description: error.message || "Ocorreu um erro ao atualizar o agendamento.",
        variant: "destructive"
      });
    }
  });

  // Delete appointment mutation
  const deleteAppointmentMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/appointments/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setSelectedAppointment(undefined);
      setIsEditMode(false);
      toast({
        title: "Agendamento excluído",
        description: "O agendamento foi excluído com sucesso."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir agendamento",
        description: error.message || "Ocorreu um erro ao excluir o agendamento.",
        variant: "destructive"
      });
    }
  });

  const handleSlotClick = (professionalId: number, time: string) => {
    setSelectedSlotInfo({
      professionalId,
      time,
      duration: timeInterval
    });
    setIsAppointmentModalOpen(true);
  };

  const handleAppointmentClick = (appointment: AppointmentWithRelations) => {
    setSelectedAppointment(appointment);
    setIsEditMode(true);
    setIsAppointmentModalOpen(true);
  };

  const handleCreateAppointment = (appointmentData: any) => {
    if (selectedSlotInfo) {
      const fullAppointmentData = {
        ...appointmentData,
        professionalId: selectedSlotInfo.professionalId,
        startTime: `${format(selectedDate, 'yyyy-MM-dd')}T${selectedSlotInfo.time}:00`,
        endTime: `${format(selectedDate, 'yyyy-MM-dd')}T${format(addMinutes(parseISO(`2000-01-01T${selectedSlotInfo.time}:00`), selectedSlotInfo.duration || 30), 'HH:mm')}:00`
      };
      createAppointmentMutation.mutate(fullAppointmentData);
    }
  };

  const handleUpdateAppointment = (appointmentData: any) => {
    if (selectedAppointment) {
      updateAppointmentMutation.mutate({
        id: selectedAppointment.id,
        data: appointmentData
      });
    }
  };

  const handleDeleteAppointment = () => {
    if (selectedAppointment) {
      deleteAppointmentMutation.mutate(selectedAppointment.id);
    }
  };

  if (isLoadingProfessionals) {
    return (
      <DashboardLayout title="Agenda" currentPath="/agenda">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Carregando agenda...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Agenda" currentPath="/agenda">
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <CalendarHeader
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            currentView={currentView}
            onViewChange={setCurrentView}
          />
          <div className="flex items-center gap-2">
            <Select value={timeInterval.toString()} onValueChange={(value) => setTimeInterval(parseInt(value) as 15 | 20 | 30 | 60)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 min</SelectItem>
                <SelectItem value="20">20 min</SelectItem>
                <SelectItem value="30">30 min</SelectItem>
                <SelectItem value="60">60 min</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSettingsModalOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => setIsAppointmentModalOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Agendamento
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 gap-4 overflow-hidden">
          {/* Sidebar */}
          <div className="w-80 flex-shrink-0">
            <ScheduleSidebar
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              professionals={professionalsSummary}
              selectedProfessional={selectedProfessionalFilter}
              onProfessionalChange={setSelectedProfessionalFilter}
              selectedRoom={selectedRoomFilter}
              onRoomChange={setSelectedRoomFilter}
              appointments={appointments || []}
            />
          </div>

          {/* Calendar View */}
          <div className="flex-1 overflow-hidden">
            <MonthAgendaView
              selectedDate={selectedDate}
              currentView={currentView}
              appointments={appointments || []}
              professionals={professionals || []}
              timeSlots={timeSlots}
              onSlotClick={handleSlotClick}
              onAppointmentClick={handleAppointmentClick}
              selectedProfessional={selectedProfessionalForDay}
              onProfessionalChange={setSelectedProfessionalForDay}
              isLoading={isLoadingAppointments}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <AppointmentModal
        isOpen={isAppointmentModalOpen}
        onClose={() => {
          setIsAppointmentModalOpen(false);
          setSelectedSlotInfo(null);
          setSelectedAppointment(undefined);
          setIsEditMode(false);
        }}
        onSubmit={isEditMode ? handleUpdateAppointment : handleCreateAppointment}
        appointment={selectedAppointment}
        isEditMode={isEditMode}
        selectedSlot={selectedSlotInfo}
        professionals={professionals || []}
        isLoading={createAppointmentMutation.isPending || updateAppointmentMutation.isPending}
        onDelete={handleDeleteAppointment}
        deleteLoading={deleteAppointmentMutation.isPending}
      />

      <FitInModal
        isOpen={isFitInModalOpen}
        onClose={() => setIsFitInModalOpen(false)}
        selectedDate={selectedDate}
        professionals={professionals || []}
        appointments={appointments || []}
        onAppointmentCreate={handleCreateAppointment}
      />

      <ScheduleSettings
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        workHours={workHours}
        onWorkHoursChange={setWorkHours}
        timeInterval={timeInterval}
        onTimeIntervalChange={setTimeInterval}
      />
    </DashboardLayout>
  );
}

// Export the component
export { AgendaModule };

// Lazy export for dynamic loading
export const LazyAgendaModule = lazy(() => import('./index').then(module => ({ default: module.AgendaModule })));