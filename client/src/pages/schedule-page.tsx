import { useState, useEffect, useMemo } from "react";
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
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";

export default function SchedulePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<CalendarViewType>("day");
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [isFitInModalOpen, setIsFitInModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithRelations | undefined>(undefined);
  const [isEditMode, setIsEditMode] = useState(false);
  // Estado para seleção de slots de horário
  const [selectedSlotInfo, setSelectedSlotInfo] = useState<{
    professionalId: number;
    time: string;
    endTime?: string;  // Para seleção múltipla (arrastar)
    duration?: number; // Duração em minutos
  } | null>(null);
  
  // Estado para controlar a seleção múltipla (arrastar)
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartSlot, setDragStartSlot] = useState<{
    professionalId: number;
    time: string;
    index: number;
  } | null>(null);
  
  // Estado para controlar o intervalo de tempo (15, 20, 30 ou 60 minutos)
  const [timeInterval, setTimeInterval] = useState<15 | 20 | 30 | 60>(30);
  
  // Estado para controlar qual profissional está selecionado no filtro
  const [selectedProfessionalFilter, setSelectedProfessionalFilter] = useState<string>("all");
  
  // Estado para armazenar o profissional selecionado na visualização diária
  const [selectedProfessionalForDay, setSelectedProfessionalForDay] = useState<number>();

  // Estado para controlar qual sala está selecionada no filtro
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>("all");
  
  // Estado para horários de início e fim da agenda
  const [workHours, setWorkHours] = useState({
    startHour: 7, // Padrão: 7:00
    endHour: 19,  // Padrão: 19:00
    // Configurações por dia da semana (0 = domingo, 1 = segunda, etc.)
    weekDays: {
      0: { enabled: false, startHour: 7, endHour: 19 }, // Domingo
      1: { enabled: true, startHour: 7, endHour: 19 },  // Segunda
      2: { enabled: true, startHour: 7, endHour: 19 },  // Terça
      3: { enabled: true, startHour: 7, endHour: 19 },  // Quarta
      4: { enabled: true, startHour: 7, endHour: 19 },  // Quinta
      5: { enabled: true, startHour: 7, endHour: 19 },  // Sexta
      6: { enabled: false, startHour: 7, endHour: 19 }, // Sábado
    },
    lunchBreak: {
      enabled: true,
      startHour: 12, 
      endHour: 13
    }
  });

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
  
  // Função para filtrar agendamentos por dia
  const appointmentsForDay = (day: Date) => {
    if (!appointments) return [];
    return appointments.filter(appointment => 
      isSameDay(parseISO(appointment.startTime), day)
    );
  };
  
  // Função para obter o código de cor com base no status do agendamento
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
    
    // Obter dia da semana (0 = domingo, 1 = segunda, etc.)
    const dayOfWeek = selectedDate.getDay();
    
    // Usar configurações específicas para o dia da semana
    const dayConfig = workHours.weekDays[dayOfWeek];
    
    // Se o dia estiver desabilitado, retornar slots vazios
    if (!dayConfig.enabled) {
      return slots;
    }
    
    const startHour = dayConfig.startHour; 
    const endHour = dayConfig.endHour;
    const intervalMinutes = timeInterval;
    
    // Gerar slots para cada hora dentro do intervalo de trabalho
    for (let hour = startHour; hour < endHour; hour++) {
      // Verificar se está no horário de almoço
      const isLunchHour = workHours.lunchBreak.enabled && 
                          hour >= workHours.lunchBreak.startHour && 
                          hour < workHours.lunchBreak.endHour;
      
      if (isLunchHour) {
        // Adicionar slot de almoço
        const lunchTime = `${hour.toString().padStart(2, '0')}:00`;
        
        // Criar mapa vazio de agendamentos
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
        
        continue; // Pular geração de slots normais durante o almoço
      }
      
      // Gerar slots baseados no intervalo selecionado
      for (let minute = 0; minute < 60; minute += intervalMinutes) {
        // Verificar se ultrapassou o horário de trabalho
        if (hour === endHour - 1 && minute + intervalMinutes > 60) {
          continue; // Evitar slots que ultrapassem o horário de fim
        }
        
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        // Criar mapa de agendamentos para este horário
        const appointmentsMap: Record<number, AppointmentWithRelations | null> = {};
        if (professionals) {
          professionals.forEach(prof => {
            appointmentsMap[prof.id] = null;
          });
        }

        // Preencher os agendamentos para este horário
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

  const timeSlots = generateTimeSlots();

  // Filtra os profissionais baseado na seleção do dropdown
  const filteredProfessionals = useMemo(() => {
    if (!professionals) return [];
    
    if (selectedProfessionalFilter === "all") {
      return professionals;
    } else {
      return professionals.filter(prof => prof.id.toString() === selectedProfessionalFilter);
    }
  }, [professionals, selectedProfessionalFilter]);

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
  const handleNewAppointment = (isFitIn = false) => {
    setSelectedAppointment(undefined);
    setIsEditMode(false);
    
    if (isFitIn) {
      // Abrir modal de encaixe
      setIsFitInModalOpen(true);
    } else {
      // Abrir modal normal de agendamento
      setIsAppointmentModalOpen(true);
    }
  };

  // Handle opening existing appointment
  const handleOpenAppointment = (appointment: AppointmentWithRelations) => {
    setSelectedAppointment(appointment);
    setIsEditMode(true);
    setIsAppointmentModalOpen(true);
  };

  // Estado para o modal de confirmação
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [confirmationData, setConfirmationData] = useState<{
    professionalId: number;
    time: string;
    slotIndex?: number;
    message?: string;
  } | null>(null);

  // Handle clicking on an empty slot - abre diretamente o modal de agendamento
  const handleSlotClick = (professionalId: number, time: string, slotIndex?: number) => {
    if (!isDragging) {
      // Abrir diretamente o modal de agendamento sem confirmação
      setSelectedSlotInfo({ 
        professionalId, 
        time 
      });
      setSelectedAppointment(undefined);
      setIsEditMode(false);
      setIsAppointmentModalOpen(true);
    }
  };
  
  // Função mantida por compatibilidade, mas sem uso de confirmação
  const handleConfirmSlotSelection = () => {
    if (confirmationData) {
      setSelectedSlotInfo({ 
        professionalId: confirmationData.professionalId, 
        time: confirmationData.time 
      });
      setSelectedAppointment(undefined);
      setIsEditMode(false);
      setIsAppointmentModalOpen(true);
      setIsConfirmationModalOpen(false);
    }
  };
  
  // Funções para seleção múltipla (arrastar)
  const handleMouseDown = (professionalId: number, time: string, slotIndex: number) => {
    // Inicia o processo de arrastar
    setIsDragging(true);
    setDragStartSlot({ professionalId, time, index: slotIndex });
  };
  
  const handleMouseMove = (professionalId: number, time: string, slotIndex: number) => {
    // Se estiver arrastando e tiver um slot inicial
    if (isDragging && dragStartSlot && dragStartSlot.professionalId === professionalId) {
      // Destacar visualmente a seleção (poderia ser implementado com classes CSS)
      // Por enquanto apenas mostramos um feedback temporário
      if (Math.abs(slotIndex - dragStartSlot.index) > 0) {
        // Feedback visual temporário
        toast({
          title: "Selecionando múltiplos horários",
          description: `De ${dragStartSlot.time} até ${time}`,
          duration: 1000
        });
      }
    }
  };
  
  const handleMouseUp = (professionalId: number, time: string, slotIndex: number) => {
    // Finaliza o processo de arrastar
    if (isDragging && dragStartSlot && dragStartSlot.professionalId === professionalId) {
      // Calcula a duração baseada nos slots selecionados
      const startIndex = Math.min(dragStartSlot.index, slotIndex);
      const endIndex = Math.max(dragStartSlot.index, slotIndex);
      const duration = (endIndex - startIndex + 1) * timeInterval;
      
      // Hora de início (sempre usar o menor horário)
      const startTime = slotIndex < dragStartSlot.index ? time : dragStartSlot.time;
      
      // Calcular a hora de término baseada na duração
      const startDate = new Date(`${format(selectedDate, 'yyyy-MM-dd')}T${startTime}:00`);
      const endDate = new Date(startDate.getTime() + duration * 60000);
      const endTime = format(endDate, 'HH:mm');
      
      // Configura os dados da seleção para o modal
      setSelectedSlotInfo({
        professionalId,
        time: startTime,
        endTime: endTime,
        duration: duration
      });
      
      // Abre o modal com os dados calculados
      setSelectedAppointment(undefined);
      setIsEditMode(false);
      setIsAppointmentModalOpen(true);
      
      // Reseta o estado de arrastar
      setIsDragging(false);
      setDragStartSlot(null);
    }
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

  // Controla o filtro de agendamentos
  const handleFilterChange = (filters: any) => {
    console.log("Filtros aplicados:", filters);
    
    // Atualiza a data se vier do mini calendário
    if (filters.updateMainCalendar && filters.selectedDate) {
      setSelectedDate(new Date(filters.selectedDate));
      toast({
        title: "Data atualizada",
        description: `Visualizando agenda para ${format(new Date(filters.selectedDate), "dd/MM/yyyy")}`,
      });
    }
    
    // Implementa lógica de filtragem por profissional
    if (filters.professional && filters.professional !== 'all') {
      // Filtrar por profissional específico
      setSelectedProfessionalForDay(parseInt(filters.professional));
    }
    
    // Aplicar outros filtros conforme necessário
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
        timeInterval={timeInterval}
        onTimeIntervalChange={(interval) => {
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

              {/* Day view (dia específico) - Similar à visualização timeline mas só para o dia selecionado */}
              {currentView === 'day' && filteredProfessionals && (
                <div className="overflow-x-auto">
                  <div className="min-w-[800px]">
                    <div className="grid grid-cols-[80px_1fr] border-b">
                      <div className="p-3 font-medium">Horário</div>
                      <div className="grid" style={{ gridTemplateColumns: `repeat(${filteredProfessionals.length}, minmax(180px, 1fr))` }}>
                        {filteredProfessionals.map(professional => (
                          <div key={professional.id} className="p-3 text-center font-medium border-l">
                            <div>{professional.fullName}</div>
                            <div className="text-xs text-muted-foreground">{professional.speciality}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Slots de tempo */}
                    {timeSlots.map((slot, slotIndex) => (
                      <div 
                        key={slotIndex} 
                        className={`grid grid-cols-[80px_1fr] border-b ${slotIndex % 2 === 0 ? 'bg-muted/5' : ''} ${slot.isLunchBreak ? 'bg-muted/20' : ''}`}
                      >
                        <div className="p-2 flex items-center justify-center">
                          <span className="text-sm font-medium">{slot.time}</span>
                        </div>
                        
                        <div 
                          className="grid" 
                          style={{ gridTemplateColumns: `repeat(${filteredProfessionals.length}, minmax(180px, 1fr))` }}
                        >
                          {filteredProfessionals.map(professional => {
                            const appointment = slot.appointments?.[professional.id];
                            
                            return (
                              <div 
                                key={professional.id} 
                                className="p-1 border-l min-h-[50px] relative"
                              >
                                {appointment ? (
                                  <div 
                                    className={`p-2 rounded h-full ${getAppointmentColor(appointment.status)}`}
                                    onClick={() => handleOpenAppointment(appointment)}
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
                                    className={`h-full w-full flex items-center justify-center ${isDragging ? 'bg-primary/10' : 'opacity-0 hover:opacity-100'} transition-opacity cursor-pointer`}
                                    onClick={() => handleSlotClick(professional.id, slot.time)}
                                    onMouseDown={() => handleMouseDown(professional.id, slot.time, slotIndex)}
                                    onMouseMove={() => handleMouseMove(professional.id, slot.time, slotIndex)}
                                    onMouseUp={() => handleMouseUp(professional.id, slot.time, slotIndex)}
                                  >
                                    <div className="text-xs text-primary flex items-center">
                                      <Plus className="h-3 w-3 mr-1" /> {isDragging ? 'Arraste para selecionar' : 'Agendar'}
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
              )}
              
              {/* Week view (semana) - estilo Bauken */}
              {currentView === 'week' && professionals && (
                <div className="p-0">
                  <div className="grid grid-cols-7 border-b">
                    {Array.from({length: 7}).map((_, i) => {
                      const day = addDays(startOfWeek(selectedDate, {locale: ptBR}), i);
                      const isToday = isSameDay(day, new Date());
                      const isSelectedDay = isSameDay(day, selectedDate);
                      return (
                        <div 
                          key={i} 
                          className={`border-r last:border-r-0 py-2 ${isToday ? 'bg-primary/5' : ''} ${isSelectedDay ? 'bg-blue-100/50' : ''}`}
                          onClick={() => setSelectedDate(day)}
                          style={{cursor: 'pointer'}}
                        >
                          <div className="text-center">
                            <div className="text-xs text-muted-foreground">{format(day, "EEE", {locale: ptBR})}</div>
                            <div className={`text-xl font-bold ${isToday ? 'text-primary' : ''}`}>
                              {format(day, "dd")}
                            </div>
                            <div className="text-xs text-muted-foreground">{format(day, "MMM", {locale: ptBR})}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="grid grid-cols-7 divide-x h-[calc(100vh-300px)] overflow-auto">
                    {Array.from({length: 7}).map((_, i) => {
                      const day = addDays(startOfWeek(selectedDate, {locale: ptBR}), i);
                      const isToday = isSameDay(day, new Date());
                      const dayAppointments = appointmentsForDay(day);
                      
                      return (
                        <div 
                          key={i} 
                          className={`relative ${isToday ? 'bg-primary/5' : ''}`}
                        >
                          {/* Linhas de hora */}
                          {timeSlots.map((slot, index) => (
                            <div 
                              key={index} 
                              className="border-b h-16 relative"
                            >
                              {index % 2 === 0 && (
                                <span className="absolute -left-0 top-0 text-xs text-muted-foreground p-1">
                                  {slot.time}
                                </span>
                              )}
                              
                              {/* Área para mostrar agendamentos */}
                              <div 
                                className="absolute inset-0 hover:bg-primary/5 cursor-pointer"
                                onClick={() => {
                                  const dateWithTime = new Date(day);
                                  const [hours, minutes] = slot.time.split(':').map(Number);
                                  dateWithTime.setHours(hours, minutes);
                                  setSelectedDate(dateWithTime);
                                  handleSlotClick(1, slot.time); // Assumindo que o profissional padrão é 1
                                }}
                              ></div>
                            </div>
                          ))}
                          
                          {/* Agendamentos do dia */}
                          {dayAppointments.map(appt => {
                            const startTime = new Date(appt.startTime);
                            const endTime = new Date(appt.endTime);
                            
                            const startHour = startTime.getHours() + startTime.getMinutes() / 60;
                            const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
                            
                            // Calcular posição relativa baseada na hora de início
                            const startPosition = (startHour - 7) * 64; // 7h sendo o início, 64px altura de cada hora
                            const height = duration * 64;
                            
                            return (
                              <div 
                                key={appt.id}
                                className={`absolute left-0 right-0 mx-1 rounded shadow-sm border-l-4 p-1 overflow-hidden ${getAppointmentColor(appt.status)} z-10`}
                                style={{
                                  top: `${startPosition}px`,
                                  height: `${height}px`,
                                  minHeight: '24px'
                                }}
                                onClick={() => handleOpenAppointment(appt)}
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
              )}
              
              {/* Room view (visão por sala/cadeira) */}
              {/* Month view with agenda (estilo calendário mensal) */}
              {currentView === 'month' && (
                <MonthAgendaView
                  appointments={appointments}
                  onDateSelect={(date) => setSelectedDate(date)}
                  onAppointmentClick={handleOpenAppointment}
                />
              )}
              
              {currentView === 'room' && (
                <div className="overflow-x-auto">
                  <div className="min-w-[800px]">
                    <div className="grid grid-cols-[80px_1fr] border-b">
                      <div className="p-3 font-medium">Horário</div>
                      <div className={`grid ${selectedRoomFilter === "all" ? "grid-cols-3" : "grid-cols-1"}`}>
                        {(selectedRoomFilter === "all" || selectedRoomFilter === "1") && (
                          <div className="p-3 text-center font-medium border-l">
                            <div>Cadeira 01</div>
                            <div className="text-xs text-muted-foreground">Sala de Atendimento</div>
                          </div>
                        )}
                        {(selectedRoomFilter === "all" || selectedRoomFilter === "2") && (
                          <div className="p-3 text-center font-medium border-l">
                            <div>Cadeira 02</div>
                            <div className="text-xs text-muted-foreground">Sala de Atendimento</div>
                          </div>
                        )}
                        {(selectedRoomFilter === "all" || selectedRoomFilter === "3") && (
                          <div className="p-3 text-center font-medium border-l">
                            <div>Cadeira 03</div>
                            <div className="text-xs text-muted-foreground">Sala de Atendimento</div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Slots de tempo */}
                    {timeSlots.map((slot, slotIndex) => (
                      <div 
                        key={slotIndex} 
                        className={`grid grid-cols-[80px_1fr] border-b ${slotIndex % 2 === 0 ? 'bg-muted/5' : ''} ${slot.isLunchBreak ? 'bg-muted/20' : ''}`}
                      >
                        <div className="p-2 flex items-center justify-center">
                          <span className="text-sm font-medium">{slot.time}</span>
                          {slot.isLunchBreak && <span className="ml-1 text-xs text-muted-foreground">(Almoço)</span>}
                        </div>
                        
                        <div className={`grid ${selectedRoomFilter === "all" ? "grid-cols-3" : "grid-cols-1"}`}>
                          {[1, 2, 3]
                            .filter(roomId => selectedRoomFilter === "all" || selectedRoomFilter === roomId.toString())
                            .map(roomId => {
                              // Encontrar agendamento para esta sala no horário atual
                              const appointment = appointments?.find(
                                a => a.roomId === roomId && 
                                    isSameDay(parseISO(a.startTime), selectedDate) && 
                                    format(parseISO(a.startTime), 'HH:mm') <= slot.time && 
                                    format(parseISO(a.endTime), 'HH:mm') > slot.time
                              );
                            
                            return (
                              <div 
                                key={roomId} 
                                className="p-1 border-l min-h-[50px] relative"
                              >
                                {appointment ? (
                                  <div 
                                    className={`p-2 rounded h-full ${getAppointmentColor(appointment.status)}`}
                                    onClick={() => handleOpenAppointment(appointment)}
                                  >
                                    <div className="text-sm font-medium truncate">
                                      {appointment.patient?.fullName || 'Sem paciente'}
                                    </div>
                                    <div className="text-xs truncate">
                                      {appointment.professional?.fullName || 'Sem profissional'}
                                    </div>
                                    {appointment.title && (
                                      <div className="text-xs truncate">{appointment.title}</div>
                                    )}
                                  </div>
                                ) : slot.isLunchBreak ? (
                                  <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                                    Horário de almoço
                                  </div>
                                ) : (
                                  <div 
                                    className="h-full w-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                                    onClick={() => {
                                      setSelectedSlotInfo({
                                        professionalId: professionals?.[0]?.id || 1,
                                        time: slot.time
                                      });
                                      setIsAppointmentModalOpen(true);
                                    }}
                                  >
                                    <div className="text-xs text-primary flex items-center">
                                      <Plus className="h-3 w-3 mr-1" /> Agendar
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
              )}
            </>
          )}
        </div>
        
        {/* Calendário e filtros à direita - ocultos na visualização de cadeira/sala */}
        {currentView !== 'room' && (
          <ScheduleSidebar onFilterChange={handleFilterChange} />
        )}
      </div>

      <AppointmentModal 
        isOpen={isAppointmentModalOpen}
        onClose={handleCloseModal}
        appointment={selectedAppointment}
        onSave={handleSaveAppointment}
        isEdit={isEditMode}
      />
      
      {/* Modal de Encaixe */}
      <FitInModal
        isOpen={isFitInModalOpen}
        onClose={() => setIsFitInModalOpen(false)}
        onSave={(fitInData) => {
          // Processar dados do encaixe
          console.log("Dados do encaixe:", fitInData);
          toast({
            title: "Encaixe registrado",
            description: "O sistema tentará encontrar um horário adequado automaticamente.",
          });
          setIsFitInModalOpen(false);
        }}
        defaultDate={selectedDate}
      />
      
      {/* Modal de confirmação para agendar horário */}
      <ConfirmationModal
        isOpen={isConfirmationModalOpen}
        onClose={() => setIsConfirmationModalOpen(false)}
        onConfirm={handleConfirmSlotSelection}
        title="Confirmar horário"
        description={confirmationData?.message || "Este vaga é um horário de atendimento da clínica, deseja confirmar?"}
        confirmText="Sim"
        cancelText="Não"
      />
    </DashboardLayout>
  );
}
