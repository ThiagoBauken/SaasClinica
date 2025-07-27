import { useState, useEffect, useMemo } from "react";
import { format, addMinutes, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import DashboardLayout from "@/layouts/DashboardLayout";
import CalendarHeader from "@/components/calendar/CalendarHeader";
import MonthAgendaView from "@/components/calendar/MonthAgendaView";
import AppointmentModal from "@/components/calendar/AppointmentModal";
import FitInModal from "@/components/calendar/FitInModal";
import UpcomingPatients from "@/components/calendar/UpcomingPatients";
import DayListView from "@/components/calendar/DayListView";
import TimelineView from "@/components/calendar/TimelineView";
import { Loader2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppointmentWithRelations } from "@/lib/types";

export default function AgendaPage() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<"month" | "week" | "day">("month");
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [isFitInModalOpen, setIsFitInModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithRelations | undefined>();
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedSlotInfo, setSelectedSlotInfo] = useState<{ professionalId: number; time: string } | null>(null);
  
  // Filtros
  const [selectedProfessionalFilter, setSelectedProfessionalFilter] = useState<string>("all");
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>("all");
  const [timeInterval, setTimeInterval] = useState<15 | 20 | 30 | 60>(30); // Intervalo padrão de 30 minutos

  // Query para buscar agendamentos
  const { data: appointments = [], isLoading: isLoadingAppointments } = useQuery<AppointmentWithRelations[]>({
    queryKey: ["/api/appointments"],
  });
  
  // Query para buscar profissionais
  const { data: professionals = [], isLoading: isLoadingProfessionals } = useQuery<any[]>({
    queryKey: ["/api/professionals"],
  });
  
  // Query para buscar pacientes
  const { data: patients = [], isLoading: isLoadingPatients } = useQuery<any[]>({
    queryKey: ["/api/patients"],
  });
  
  // Query para buscar procedimentos
  const { data: procedures = [], isLoading: isLoadingProcedures } = useQuery<any[]>({
    queryKey: ["/api/procedures"],
  });

  // Estatísticas dos profissionais
  const professionalsSummary = useMemo(() => {
    if (!professionals || !appointments) return [];
    
    return professionals.map(prof => {
      const profAppointments = appointments.filter(apt => apt.professionalId === prof.id);
      const todayAppointments = profAppointments.filter(apt => 
        format(parseISO(apt.startTime), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
      );
      
      return {
        id: prof.id,
        name: prof.fullName,
        specialty: prof.speciality || 'Dentista',
        todayCount: todayAppointments.length,
        weekCount: profAppointments.length
      };
    });
  }, [professionals, appointments]);

  // Filtra os profissionais baseado na seleção
  const filteredProfessionals = useMemo(() => {
    if (!professionals) return [];
    
    if (selectedProfessionalFilter === "all") {
      return professionals;
    } else {
      return professionals.filter(prof => prof.id.toString() === selectedProfessionalFilter);
    }
  }, [professionals, selectedProfessionalFilter]);

  // Mutations para criar e atualizar agendamentos
  const createAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: any) => {
      const res = await apiRequest("POST", "/api/appointments", appointmentData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({
        title: "Agendamento criado",
        description: "O agendamento foi criado com sucesso!"
      });
      setIsAppointmentModalOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar agendamento",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: any) => {
      const res = await apiRequest("PATCH", `/api/appointments/${appointmentData.id}`, appointmentData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({
        title: "Agendamento atualizado",
        description: "O agendamento foi atualizado com sucesso!"
      });
      setIsAppointmentModalOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar agendamento",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Handle opening appointment modal
  const handleNewAppointment = (isFitIn = false) => {
    setSelectedAppointment(undefined);
    setIsEditMode(false);
    
    if (isFitIn) {
      setIsFitInModalOpen(true);
    } else {
      setIsAppointmentModalOpen(true);
    }
  };

  // Handle opening existing appointment
  const handleOpenAppointment = (appointment: AppointmentWithRelations) => {
    setSelectedAppointment(appointment);
    setIsEditMode(true);
    setIsAppointmentModalOpen(true);
  };

  // Handle saving appointment
  const handleSaveAppointment = (appointmentData: any) => {
    if (isEditMode && selectedAppointment) {
      updateAppointmentMutation.mutate({
        id: selectedAppointment.id,
        ...appointmentData
      });
    } else {
      if (selectedSlotInfo) {
        appointmentData.professionalId = selectedSlotInfo.professionalId;
        appointmentData.startTime = `${format(selectedDate, 'yyyy-MM-dd')}T${selectedSlotInfo.time}:00Z`;
        const endTimeDate = addMinutes(new Date(`${format(selectedDate, 'yyyy-MM-dd')}T${selectedSlotInfo.time}:00Z`), 30);
        appointmentData.endTime = endTimeDate.toISOString();
      }
      createAppointmentMutation.mutate(appointmentData);
    }
  };

  // Close modal and reset selected slot info
  const handleCloseModal = () => {
    setIsAppointmentModalOpen(false);
    setSelectedSlotInfo(null);
  };

  return (
    <DashboardLayout title="" currentPath="/agenda">
      <CalendarHeader 
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onNewAppointment={handleNewAppointment}
        currentView={currentView as any}
        onViewChange={(view) => setCurrentView(view as any)}
        professionalsSummary={professionalsSummary}
        timeInterval={timeInterval}
        onTimeIntervalChange={(interval: 15 | 20 | 30 | 60) => {
          setTimeInterval(interval);
          toast({
            title: `Intervalo alterado para ${interval} minutos`,
            description: `Os horários agora estão divididos em intervalos de ${interval} minutos.`,
          });
        }}
        selectedProfessional={selectedProfessionalFilter}
        onProfessionalChange={setSelectedProfessionalFilter}
        selectedRoom={selectedRoomFilter}
        onRoomChange={setSelectedRoomFilter}
      />

      <div className="flex mt-4 gap-4">
        <div className="flex-1 bg-card rounded-md p-2 shadow-sm">
          {isLoadingProfessionals || isLoadingAppointments ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Day view with list view like agenda */}
              {currentView === 'day' && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  {/* Main day view */}
                  <div className="lg:col-span-3">
                    <DayListView
                      selectedDate={selectedDate}
                      appointments={appointments}
                      onAppointmentClick={handleOpenAppointment}
                      onEditAppointment={handleOpenAppointment}
                      onDeleteAppointment={(id) => {
                        // Handle delete appointment
                        console.log("Delete appointment:", id);
                      }}
                      onNewAppointment={(time) => {
                        if (time) {
                          setSelectedSlotInfo({ 
                            professionalId: filteredProfessionals?.[0]?.id || 1, 
                            time 
                          });
                        }
                        handleNewAppointment();
                      }}
                      timeInterval={timeInterval}
                      workingHours={{
                        start: 7,
                        end: 19
                      }}
                    />
                  </div>
                  
                  {/* Sidebar with upcoming patients */}
                  <div className="lg:col-span-1">
                    <UpcomingPatients
                      appointments={appointments}
                      limit={8}
                      onPatientClick={handleOpenAppointment}
                    />
                  </div>
                </div>
              )}

              {/* Timeline view for professionals - using the week view with professionals filter */}
              {currentView === 'week' && selectedProfessionalFilter !== 'all' && filteredProfessionals && (
                <TimelineView
                  selectedDate={selectedDate}
                  appointments={appointments}
                  professionals={filteredProfessionals}
                  onAppointmentClick={handleOpenAppointment}
                  onNewAppointment={(professionalId, time) => {
                    setSelectedSlotInfo({ professionalId, time });
                    handleNewAppointment();
                  }}
                  timeInterval={timeInterval}
                />
              )}

              {/* Week view */}
              {currentView === 'week' && selectedProfessionalFilter === 'all' && (
                <TimelineView
                  selectedDate={selectedDate}
                  appointments={appointments}
                  professionals={filteredProfessionals}
                  onAppointmentClick={handleOpenAppointment}
                  onNewAppointment={(professionalId, time) => {
                    setSelectedSlotInfo({ professionalId, time });
                    handleNewAppointment();
                  }}
                  timeInterval={timeInterval}
                  viewMode="week"
                />
              )}
              
              {/* Month view with agenda */}
              {currentView === 'month' && (
                <MonthAgendaView
                  appointments={appointments}
                  onDateSelect={(date) => setSelectedDate(date)}
                  onAppointmentClick={handleOpenAppointment}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Appointment Modal */}
      <AppointmentModal
        isOpen={isAppointmentModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveAppointment}
        appointment={selectedAppointment}
        isEdit={isEditMode}
      />

      {/* Fit-in Modal */}
      <FitInModal
        isOpen={isFitInModalOpen}
        onClose={() => setIsFitInModalOpen(false)}
        onSave={(data) => {
          handleSaveAppointment(data);
          setIsFitInModalOpen(false);
        }}
        defaultDate={selectedDate}
      />
    </DashboardLayout>
  );
}