import { useState, useEffect } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import CalendarHeader from "@/components/calendar/CalendarHeader";
import TimelineView from "@/components/calendar/TimelineView";
import AppointmentModal from "@/components/calendar/AppointmentModal";
import { CalendarViewType, ProfessionalSummary, AppointmentWithRelations, TimeSlot } from "@/lib/types";
import { format, addMinutes, parseISO } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

export default function SchedulePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<CalendarViewType>("timeline");
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithRelations | undefined>(undefined);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedSlotInfo, setSelectedSlotInfo] = useState<{
    professionalId: number;
    time: string;
  } | null>(null);

  // Fetch professionals
  const { data: professionals, isLoading: isLoadingProfessionals } = useQuery<any[]>({
    queryKey: ["/api/professionals"],
    queryFn: async () => {
      // For demonstration purposes, we're returning mock data
      // In a real app, this would come from the API
      return [
        { id: 1, fullName: "Dr. Ana Silva", speciality: "Dentista" },
        { id: 2, fullName: "Dr. Carlos Mendes", speciality: "Ortodontista" },
        { id: 3, fullName: "Dr. Juliana Costa", speciality: "Endodontista" }
      ];
    }
  });

  // Generate professionals summary with load info
  const professionalsSummary: ProfessionalSummary[] = [
    {
      id: 1,
      fullName: "Dr. Ana Silva",
      speciality: "Dentista",
      roomName: "Sala 01",
      load: 70,
      status: "moderate"
    },
    {
      id: 2,
      fullName: "Dr. Carlos Mendes",
      speciality: "Ortodontista",
      roomName: "Sala 02",
      load: 90,
      status: "full"
    },
    {
      id: 3,
      fullName: "Dr. Juliana Costa",
      speciality: "Endodontista",
      roomName: "Sala 03",
      load: 40,
      status: "available"
    }
  ];

  // Fetch appointments for the selected date
  const formattedDate = format(selectedDate, "yyyy-MM-dd");
  const { data: appointments, isLoading: isLoadingAppointments } = useQuery<AppointmentWithRelations[]>({
    queryKey: ["/api/appointments", formattedDate],
    queryFn: async () => {
      // For demonstration purposes, we're returning mock data
      // In a real app, this would come from the API with the date parameter
      return [
        {
          id: 1,
          title: "Consulta inicial",
          patientId: 1,
          patient: { id: 1, fullName: "Ricardo Almeida", phone: "11987654321" },
          professionalId: 2,
          professional: { id: 2, fullName: "Dr. Carlos Mendes", speciality: "Ortodontista" },
          roomId: 2,
          room: { id: 2, name: "Sala 02" },
          startTime: "2023-08-10T08:00:00Z",
          endTime: "2023-08-10T08:30:00Z",
          status: "confirmed",
          type: "appointment",
          procedures: [{ id: 1, name: "Consulta inicial", duration: 30, price: 12000 }],
          color: "bg-blue-100 border-l-4 border-primary",
          recurring: false,
          automationEnabled: true,
          createdAt: "2023-08-01T10:00:00Z",
          updatedAt: "2023-08-01T10:00:00Z"
        },
        {
          id: 2,
          title: "Limpeza dental",
          patientId: 2,
          patient: { id: 2, fullName: "Mariana Santos", phone: "11976543210" },
          professionalId: 1,
          professional: { id: 1, fullName: "Dr. Ana Silva", speciality: "Dentista" },
          roomId: 1,
          room: { id: 1, name: "Sala 01" },
          startTime: "2023-08-10T08:30:00Z",
          endTime: "2023-08-10T09:30:00Z",
          status: "confirmed",
          type: "appointment",
          procedures: [{ id: 2, name: "Limpeza dental", duration: 60, price: 15000 }],
          color: "bg-green-100 border-l-4 border-secondary",
          recurring: false,
          automationEnabled: true,
          createdAt: "2023-08-01T11:00:00Z",
          updatedAt: "2023-08-01T11:00:00Z"
        },
        {
          id: 3,
          title: "Avaliação de dor",
          patientId: 3,
          patient: { id: 3, fullName: "Pedro Oliveira", phone: "11965432109" },
          professionalId: 3,
          professional: { id: 3, fullName: "Dr. Juliana Costa", speciality: "Endodontista" },
          roomId: 3,
          room: { id: 3, name: "Sala 03" },
          startTime: "2023-08-10T08:30:00Z",
          endTime: "2023-08-10T09:00:00Z",
          status: "scheduled",
          type: "appointment",
          procedures: [{ id: 3, name: "Avaliação de dor", duration: 30, price: 10000 }],
          color: "bg-orange-100 border-l-4 border-accent",
          recurring: false,
          automationEnabled: true,
          createdAt: "2023-08-02T09:00:00Z",
          updatedAt: "2023-08-02T09:00:00Z"
        },
        {
          id: 4,
          title: "Ortodontia",
          patientId: 4,
          patient: { id: 4, fullName: "Sofia Martins", phone: "11954321098" },
          professionalId: 2,
          professional: { id: 2, fullName: "Dr. Carlos Mendes", speciality: "Ortodontista" },
          roomId: 2,
          room: { id: 2, name: "Sala 02" },
          startTime: "2023-08-10T09:00:00Z",
          endTime: "2023-08-10T10:00:00Z",
          status: "confirmed",
          type: "appointment",
          procedures: [{ id: 4, name: "Ortodontia", duration: 60, price: 20000 }],
          color: "bg-purple-100 border-l-4 border-purple-600",
          recurring: false,
          automationEnabled: true,
          createdAt: "2023-08-02T10:00:00Z",
          updatedAt: "2023-08-02T10:00:00Z"
        },
        {
          id: 5,
          title: "Extração",
          patientId: 5,
          patient: { id: 5, fullName: "Lucas Ferreira", phone: "11943210987" },
          professionalId: 1,
          professional: { id: 1, fullName: "Dr. Ana Silva", speciality: "Dentista" },
          roomId: 1,
          room: { id: 1, name: "Sala 01" },
          startTime: "2023-08-10T09:30:00Z",
          endTime: "2023-08-10T10:30:00Z",
          status: "cancelled",
          type: "appointment",
          procedures: [{ id: 5, name: "Extração", duration: 60, price: 18000 }],
          color: "bg-red-100 border-l-4 border-red-600",
          recurring: false,
          automationEnabled: true,
          createdAt: "2023-08-03T09:00:00Z",
          updatedAt: "2023-08-03T14:00:00Z"
        },
        {
          id: 6,
          title: "Bloqueado",
          patientId: null,
          professionalId: 2,
          professional: { id: 2, fullName: "Dr. Carlos Mendes", speciality: "Ortodontista" },
          roomId: 2,
          room: { id: 2, name: "Sala 02" },
          startTime: "2023-08-10T10:00:00Z",
          endTime: "2023-08-10T11:00:00Z",
          status: "confirmed",
          type: "block",
          notes: "Reunião de equipe",
          color: "bg-gray-200 border-l-4 border-gray-400",
          recurring: false,
          automationEnabled: false,
          createdAt: "2023-08-03T10:00:00Z",
          updatedAt: "2023-08-03T10:00:00Z"
        },
        {
          id: 7,
          title: "Tratamento de canal",
          patientId: 6,
          patient: { id: 6, fullName: "Bianca Lima", phone: "11932109876" },
          professionalId: 3,
          professional: { id: 3, fullName: "Dr. Juliana Costa", speciality: "Endodontista" },
          roomId: 3,
          room: { id: 3, name: "Sala 03" },
          startTime: "2023-08-10T10:00:00Z",
          endTime: "2023-08-10T11:30:00Z",
          status: "confirmed",
          type: "appointment",
          procedures: [{ id: 6, name: "Tratamento de canal", duration: 90, price: 30000 }],
          color: "bg-green-100 border-l-4 border-secondary",
          recurring: false,
          automationEnabled: true,
          createdAt: "2023-08-04T09:00:00Z",
          updatedAt: "2023-08-04T09:00:00Z"
        }
      ];
    }
  });

  // Generate time slots for the timeline view
  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const startHour = 8; // 8:00 AM
    const endHour = 18; // 6:00 PM
    const intervalMinutes = 30;

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += intervalMinutes) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        // Create a map of professionalId to appointments that start at this time
        const appointmentsMap: Record<number, AppointmentWithRelations | null> = {};
        if (professionals) {
          professionals.forEach(prof => {
            appointmentsMap[prof.id] = null;
          });
        }

        // Fill in the appointments
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
          appointments: appointmentsMap
        });
      }
    }

    return slots;
  };

  const timeSlots = generateTimeSlots();

  // Appointment mutations
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
  const handleNewAppointment = () => {
    setSelectedAppointment(undefined);
    setIsEditMode(false);
    setIsAppointmentModalOpen(true);
  };

  // Handle opening existing appointment
  const handleOpenAppointment = (appointment: AppointmentWithRelations) => {
    setSelectedAppointment(appointment);
    setIsEditMode(true);
    setIsAppointmentModalOpen(true);
  };

  // Handle clicking on an empty slot
  const handleSlotClick = (professionalId: number, time: string) => {
    setSelectedSlotInfo({ professionalId, time });
    setSelectedAppointment(undefined);
    setIsEditMode(false);
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
      // Combine with selected slot info if available
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
    <DashboardLayout title="" currentPath="/schedule">
      <CalendarHeader 
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onNewAppointment={handleNewAppointment}
        currentView={currentView}
        onViewChange={setCurrentView}
        professionalsSummary={professionalsSummary}
      />

      {isLoadingProfessionals || isLoadingAppointments ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {currentView === 'timeline' && professionals && (
            <TimelineView
              date={selectedDate}
              professionals={professionals}
              timeSlots={timeSlots}
              onSlotClick={handleSlotClick}
              onAppointmentClick={handleOpenAppointment}
            />
          )}
          {/* Other view types would be implemented here */}
        </>
      )}

      <AppointmentModal 
        isOpen={isAppointmentModalOpen}
        onClose={handleCloseModal}
        appointment={selectedAppointment}
        onSave={handleSaveAppointment}
        isEdit={isEditMode}
      />
    </DashboardLayout>
  );
}
