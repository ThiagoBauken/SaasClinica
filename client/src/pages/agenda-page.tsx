import { useState, useMemo, useRef } from "react";
import { format, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import DashboardLayout from "@/layouts/DashboardLayout";
import CalendarMonthView from "@/components/CalendarMonthView";
import CalendarWeekView from "@/components/CalendarWeekView";
import CalendarDayView, { type CalendarDayViewRef } from "@/components/CalendarDayView";
import FindFreeTimeDialog from "@/components/FindFreeTimeDialog";
import ScheduleSidebar from "@/components/calendar/ScheduleSidebar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PlusIcon, BarChart, Calendar, Clock, Settings, Filter, ChevronDown, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import AppointmentQuickActions from "@/components/AppointmentQuickActions";
import ConflictSuggestionsDialog from "@/components/ConflictSuggestionsDialog";
import PaymentStatusBadge, { PaymentStatus } from "@/components/PaymentStatusBadge";
import AppointmentDetailsDrawer from "@/components/AppointmentDetailsDrawer";
import FloatingActionButton from "@/components/FloatingActionButton";
import { useLocation } from "wouter";

// REMOVED: mockProcedureStats - now fetched from backend via useQuery

// Types for API responses
interface ApiAppointment {
  id: number;
  patientId: number;
  patientName: string;
  patientPhone?: string;
  patientWhatsapp?: string;
  professionalId: number;
  professionalName: string;
  procedureName?: string;
  notes?: string;
  status: string;
  startTime: string;
  endTime: string;
}

interface ApiProfessional {
  id: number;
  fullName: string;
  speciality?: string;
}

interface ApiRoom {
  id: number;
  name: string;
}

interface ApiPatient {
  id: number;
  fullName: string;
  phone?: string;
}

interface ApiProcedure {
  id: number;
  name: string;
  duration?: number;
}

interface ApiResponse<T> {
  data: T[];
  total?: number;
}

interface LocalAppointment {
  id: number;
  date: Date;
  patientId: number;
  patientName: string;
  patientPhone?: string;
  professionalName: string;
  professionalId: number;
  procedure: string;
  status: string;
  startTime: string;
  endTime: string;
  paymentStatus?: PaymentStatus;
  paymentAmount: number;
  paidAmount: number;
}

export default function AgendaPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [isEditAppointmentOpen, setIsEditAppointmentOpen] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState<number | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<number | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [activeView, setActiveView] = useState("month");

  // Novos estados para as funcionalidades adicionadas
  const [timeInterval, setTimeInterval] = useState<15 | 20 | 30 | 60>(30);
  const [selectedProfessionalFilter, setSelectedProfessionalFilter] = useState<string>("all");
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");
  const [selectedProcedureFilter, setSelectedProcedureFilter] = useState<string>("all");
  const [dateRangeStart, setDateRangeStart] = useState<string>("");
  const [dateRangeEnd, setDateRangeEnd] = useState<string>("");
  const [showDailyAppointments, setShowDailyAppointments] = useState(true);

  // Estado para diálogo de conflitos
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictData, setConflictData] = useState<any>(null);

  // Estado para Bottom Sheet de detalhes
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Estado para controlar área de filtros
  const [showFilters, setShowFilters] = useState(false);

  // Ref para controlar o CalendarDayView
  const calendarDayViewRef = useRef<CalendarDayViewRef>(null);

  // Fetch procedure statistics from backend
  const { data: procedureStats = [] } = useQuery({
    queryKey: ["/api/appointments/stats/procedures"],
    queryFn: async () => {
      const res = await fetch("/api/appointments/stats/procedures", {
        credentials: "include",
      });
      if (!res.ok) {
        return []; // Return empty array if fails
      }
      return res.json();
    },
  });

  const [, navigate] = useLocation();

  // Form state for new appointment
  const [newAppointment, setNewAppointment] = useState({
    patientId: "",
    professionalId: "",
    procedureId: "",
    date: format(selectedDate, "yyyy-MM-dd"),
    time: "09:00",
    endTime: "09:30",
    notes: "",
  });

  // Query para buscar compromissos reais da API
  const { data: appointmentsData, isLoading } = useQuery<ApiResponse<ApiAppointment>>({
    queryKey: ["/api/v1/appointments", {
      limit: 1000, // Buscar muitos para ter dados suficientes
    }],
  });

  // Query para buscar profissionais reais
  const { data: professionalsData } = useQuery<ApiResponse<ApiProfessional>>({
    queryKey: ["/api/v1/professionals"],
  });

  // Query para buscar salas reais
  const { data: roomsData } = useQuery<ApiResponse<ApiRoom>>({
    queryKey: ["/api/v1/rooms"],
  });

  const appointments: LocalAppointment[] = useMemo(() => {
    if (!appointmentsData?.data) return [];

    // Transformar dados da API para o formato esperado pelo componente
    return appointmentsData.data.map((appt: ApiAppointment, index: number) => {
      // Gerar status de pagamento mock baseado no índice
      const paymentStatuses: PaymentStatus[] = ['paid', 'pending', 'partial', 'overdue', 'not_required'];
      const paymentStatus: PaymentStatus = paymentStatuses[index % paymentStatuses.length];

      // Gerar valores mock
      const paymentAmount = paymentStatus === 'not_required' ? 0 : 150 + (index * 50);
      const paidAmount = paymentStatus === 'partial' ? paymentAmount * 0.5 :
                         paymentStatus === 'paid' ? paymentAmount : 0;

      return {
        id: appt.id,
        date: new Date(appt.startTime),
        patientId: appt.patientId,
        patientName: appt.patientName,
        patientPhone: appt.patientPhone || appt.patientWhatsapp,
        professionalName: appt.professionalName,
        professionalId: appt.professionalId,
        procedure: appt.procedureName || appt.notes || "Consulta",
        status: appt.status,
        startTime: format(new Date(appt.startTime), "HH:mm"),
        endTime: format(new Date(appt.endTime), "HH:mm"),
        paymentStatus,
        paymentAmount,
        paidAmount,
      };
    });
  }, [appointmentsData]);

  // Transformar profissionais da API
  const mockProfessionals = useMemo(() => {
    if (!professionalsData?.data) return [];
    return professionalsData.data.map((prof: ApiProfessional) => ({
      id: prof.id,
      name: prof.fullName,
      specialty: prof.speciality || "Dentista",
    }));
  }, [professionalsData]);

  // Transformar salas da API
  const mockRooms = useMemo(() => {
    if (!roomsData?.data) return [];
    return roomsData.data.map((room: ApiRoom) => ({
      id: room.id,
      name: room.name,
    }));
  }, [roomsData]);

  // Query para buscar pacientes reais
  const { data: patientsData } = useQuery<ApiResponse<ApiPatient>>({
    queryKey: ["/api/v1/patients"],
  });

  const mockPatients = useMemo(() => {
    if (!patientsData?.data) return [];
    return patientsData.data.map((patient: ApiPatient) => ({
      id: patient.id,
      name: patient.fullName,
      phone: patient.phone || "",
    }));
  }, [patientsData]);

  // Query para buscar procedimentos reais
  const { data: proceduresData } = useQuery<ApiResponse<ApiProcedure>>({
    queryKey: ["/api/v1/procedures"],
  });

  const mockProcedures = useMemo(() => {
    if (!proceduresData?.data) return [];
    return proceduresData.data.map((proc: ApiProcedure) => ({
      id: proc.id,
      name: proc.name,
      duration: proc.duration || 30,
      price: 0,
    }));
  }, [proceduresData]);

  // Mutation para criar agendamento
  const createAppointmentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/v1/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patientId: parseInt(data.patientId),
          professionalId: parseInt(data.professionalId),
          procedureId: data.procedureId ? parseInt(data.procedureId) : undefined,
          startTime: new Date(`${data.date}T${data.time}`).toISOString(),
          endTime: new Date(`${data.date}T${data.endTime}`).toISOString(),
          notes: data.notes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();

        // Se for conflito (409), armazenar dados para exibir sugestões
        if (response.status === 409) {
          const conflictError: any = new Error(error.message || 'Conflito de agendamento');
          conflictError.isConflict = true;
          conflictError.conflictData = error;
          throw conflictError;
        }

        throw new Error(error.message || 'Erro ao criar agendamento');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/appointments'] });
      toast({
        title: 'Agendamento criado',
        description: 'O agendamento foi criado com sucesso',
      });
      setIsNewAppointmentOpen(false);
      setNewAppointment({
        patientId: "",
        professionalId: "",
        procedureId: "",
        date: format(selectedDate, "yyyy-MM-dd"),
        time: "09:00",
        endTime: "09:30",
        notes: "",
      });
    },
    onError: (error: any) => {
      // Se for conflito, mostrar diálogo com sugestões
      if (error.isConflict) {
        setConflictData(error.conflictData);
        setShowConflictDialog(true);
        setIsNewAppointmentOpen(false); // Fechar diálogo de criação
        return;
      }

      // Para outros erros, mostrar toast normal
      toast({
        title: 'Erro ao criar agendamento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mutation para atualizar agendamento
  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/v1/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patientId: data.patientId ? parseInt(data.patientId) : undefined,
          professionalId: data.professionalId ? parseInt(data.professionalId) : undefined,
          procedureId: data.procedureId ? parseInt(data.procedureId) : undefined,
          startTime: data.date && data.time ? new Date(`${data.date}T${data.time}`).toISOString() : undefined,
          endTime: data.date && data.endTime ? new Date(`${data.date}T${data.endTime}`).toISOString() : undefined,
          notes: data.notes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();

        // Se for conflito (409), armazenar dados para exibir sugestões
        if (response.status === 409) {
          const conflictError: any = new Error(error.message || 'Conflito de agendamento');
          conflictError.isConflict = true;
          conflictError.conflictData = error;
          throw conflictError;
        }

        throw new Error(error.message || 'Erro ao atualizar agendamento');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/appointments'] });
      toast({
        title: 'Agendamento atualizado',
        description: 'O agendamento foi atualizado com sucesso',
      });
      setIsEditAppointmentOpen(false);
      setEditingAppointmentId(null);
      setNewAppointment({
        patientId: "",
        professionalId: "",
        procedureId: "",
        date: format(selectedDate, "yyyy-MM-dd"),
        time: "09:00",
        endTime: "09:30",
        notes: "",
      });
    },
    onError: (error: any) => {
      // Se for conflito, mostrar diálogo com sugestões
      if (error.isConflict) {
        setConflictData(error.conflictData);
        setShowConflictDialog(true);
        setIsEditAppointmentOpen(false); // Fechar diálogo de edição
        return;
      }

      // Para outros erros, mostrar toast normal
      toast({
        title: 'Erro ao atualizar agendamento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mutation para deletar agendamento
  const deleteAppointmentMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/v1/appointments/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao deletar agendamento');
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/appointments'] });
      toast({
        title: 'Agendamento deletado',
        description: 'O agendamento foi removido com sucesso',
      });
      setDeleteConfirmOpen(false);
      setAppointmentToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao deletar agendamento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Filtrar agendamentos do dia selecionado
  const dailyAppointments = useMemo(() => {
    return appointments.filter(appt =>
      format(appt.date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd")
    );
  }, [appointments, selectedDate]);

  // Filtrar agendamentos com múltiplos filtros
  const filteredAppointments = useMemo(() => {
    let filtered = appointments;

    // Filtro por profissional
    if (selectedProfessionalFilter !== "all") {
      filtered = filtered.filter(appt =>
        appt.professionalId?.toString() === selectedProfessionalFilter
      );
    }

    // Filtro por status
    if (selectedStatusFilter !== "all") {
      filtered = filtered.filter(appt => appt.status === selectedStatusFilter);
    }

    // Filtro por procedimento
    if (selectedProcedureFilter !== "all") {
      filtered = filtered.filter(appt => appt.procedure === selectedProcedureFilter);
    }

    // Filtro por período
    if (dateRangeStart) {
      filtered = filtered.filter(appt => {
        const apptDate = format(appt.date, "yyyy-MM-dd");
        return apptDate >= dateRangeStart;
      });
    }
    if (dateRangeEnd) {
      filtered = filtered.filter(appt => {
        const apptDate = format(appt.date, "yyyy-MM-dd");
        return apptDate <= dateRangeEnd;
      });
    }

    return filtered;
  }, [appointments, selectedProfessionalFilter, selectedStatusFilter, selectedProcedureFilter, dateRangeStart, dateRangeEnd]);

  // Filtrar agendamentos do dia com todos os filtros aplicados
  const filteredDailyAppointments = useMemo(() => {
    return filteredAppointments.filter(appt =>
      format(appt.date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd")
    );
  }, [filteredAppointments, selectedDate]);

  // Contador de agendamentos por status
  const statusCounts = useMemo(() => {
    const counts = {
      scheduled: 0,
      confirmed: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
    };

    filteredAppointments.forEach(appt => {
      if (counts.hasOwnProperty(appt.status)) {
        counts[appt.status as keyof typeof counts]++;
      }
    });

    return counts;
  }, [filteredAppointments]);

  // Filtrar próximos pacientes (próximos 7 dias após a data selecionada)
  const upcomingAppointments = useMemo(() => {
    const today = new Date(selectedDate);
    today.setHours(0, 0, 0, 0);

    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const upcoming = appointments
      .filter(appt => {
        const apptDate = new Date(appt.date);
        apptDate.setHours(0, 0, 0, 0);
        return apptDate > today && apptDate <= nextWeek;
      })
      .sort((a, b) => {
        const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateCompare !== 0) return dateCompare;
        return a.startTime.localeCompare(b.startTime);
      });

    // Aplica o filtro de profissional se selecionado
    if (selectedProfessionalFilter === "all") {
      return upcoming;
    }
    return upcoming.filter(appt =>
      appt.professionalId?.toString() === selectedProfessionalFilter
    );
  }, [appointments, selectedDate, selectedProfessionalFilter]);

  // Função para voltar para hoje
  const handleGoToToday = () => {
    setSelectedDate(new Date());
    toast({
      title: "Voltou para hoje",
      description: format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
    });
  };

  // Contar filtros ativos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedProfessionalFilter !== "all") count++;
    if (selectedRoomFilter !== "all") count++;
    if (selectedStatusFilter !== "all") count++;
    if (selectedProcedureFilter !== "all") count++;
    if (dateRangeStart) count++;
    if (dateRangeEnd) count++;
    return count;
  }, [selectedProfessionalFilter, selectedRoomFilter, selectedStatusFilter, selectedProcedureFilter, dateRangeStart, dateRangeEnd]);

  // Limpar todos os filtros
  const clearAllFilters = () => {
    setSelectedProfessionalFilter("all");
    setSelectedRoomFilter("all");
    setSelectedStatusFilter("all");
    setSelectedProcedureFilter("all");
    setDateRangeStart("");
    setDateRangeEnd("");
    toast({
      title: "Filtros limpos",
      description: "Todos os filtros foram removidos",
    });
  };

  // Função para lidar com a seleção de uma data (ao clicar no dia, muda para visualização diária)
  // Handlers para sugestões de conflito
  const handleSelectTimeSlot = (slot: { startTime: string; endTime: string }) => {
    const startDate = new Date(slot.startTime);
    const endDate = new Date(slot.endTime);

    // Atualizar formulário com o novo horário sugerido
    setNewAppointment({
      ...newAppointment,
      date: format(startDate, "yyyy-MM-dd"),
      time: format(startDate, "HH:mm"),
      endTime: format(endDate, "HH:mm"),
    });

    // Fechar diálogo de conflito e reabrir formulário
    setShowConflictDialog(false);
    setConflictData(null);
    setIsNewAppointmentOpen(true);

    toast({
      title: "Horário atualizado",
      description: `Horário alterado para ${format(startDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    });
  };

  const handleSelectRoom = (room: { roomId: number; roomName: string }) => {
    // Atualizar formulário com a nova sala sugerida
    setNewAppointment({
      ...newAppointment,
      // Aqui você pode adicionar roomId quando adicionar campo de sala no formulário
    });

    // Fechar diálogo de conflito e reabrir formulário
    setShowConflictDialog(false);
    setConflictData(null);
    setIsNewAppointmentOpen(true);

    toast({
      title: "Sala atualizada",
      description: `Sala alterada para ${room.roomName}`,
    });
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setActiveView("day"); // Muda automaticamente para visualização diária
    toast({
      title: "Visualização alterada",
      description: `Mostrando agenda do dia ${format(date, "dd/MM/yyyy")}`,
    });
  };

  // Função para lidar com a seleção de horário por arrasto
  const handleTimeRangeSelect = (date: Date, startTime: string, endTime?: string) => {
    setSelectedDate(date);

    setNewAppointment({
      ...newAppointment,
      date: format(date, "yyyy-MM-dd"),
      time: startTime,
      endTime: endTime || startTime
    });

    setIsNewAppointmentOpen(true);
  };

  // Função para abrir modal de novo agendamento
  const handleAddAppointment = () => {
    setNewAppointment({
      ...newAppointment,
      date: format(selectedDate, "yyyy-MM-dd"),
    });
    setIsNewAppointmentOpen(true);
  };

  // Função para alternar a exibição das estatísticas
  const toggleStats = () => {
    setShowStats(!showStats);
  };

  // Função para salvar novo agendamento
  const handleSaveAppointment = () => {
    if (!newAppointment.patientId || !newAppointment.professionalId) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha o paciente e o profissional',
        variant: 'destructive',
      });
      return;
    }

    createAppointmentMutation.mutate(newAppointment);
  };

  // Função para abrir dialog de edição
  const handleEditAppointment = (appointmentId: number) => {
    // Buscar dados do agendamento para preencher o form
    const appointment = appointments.find(a => a.id === appointmentId);
    if (appointment) {
      const dateStr = format(appointment.date, 'yyyy-MM-dd');
      setNewAppointment({
        patientId: appointment.patientId.toString(),
        professionalId: appointment.professionalId?.toString() || "",
        procedureId: "",
        date: dateStr,
        time: appointment.startTime,
        endTime: appointment.endTime,
        notes: "",
      });
      setEditingAppointmentId(appointmentId);
      setIsEditAppointmentOpen(true);
    }
  };

  // Função para salvar edição do agendamento
  const handleSaveEdit = () => {
    if (!editingAppointmentId) return;

    updateAppointmentMutation.mutate({
      id: editingAppointmentId,
      data: newAppointment,
    });
  };

  // Função para abrir confirmação de delete
  const handleOpenDeleteConfirm = (appointmentId: number) => {
    setAppointmentToDelete(appointmentId);
    setDeleteConfirmOpen(true);
  };

  // Função para confirmar delete
  const handleConfirmDelete = () => {
    if (appointmentToDelete) {
      deleteAppointmentMutation.mutate(appointmentToDelete);
    }
  };

  // Handlers para Bottom Sheet
  const handleAppointmentClick = (appointment: any) => {
    setSelectedAppointment(appointment);
    setIsDrawerOpen(true);
  };

  const handleWhatsApp = (phone: string) => {
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
  };

  const handleViewRecord = (appointmentId: number) => {
    const appointment = appointments.find((a: any) => a.id === appointmentId);
    if (appointment) {
      navigate(`/prontuario/${appointment.patientId}`);
    }
  };

  const handleConfirmAppointment = async (appointmentId: number) => {
    try {
      await updateAppointmentMutation.mutateAsync({
        id: appointmentId,
        data: { status: 'confirmed' },
      });
      toast({
        title: "Agendamento confirmado",
        description: "O status foi atualizado para confirmado.",
      });
    } catch (error) {
      console.error("Erro ao confirmar:", error);
    }
  };

  // Handler para Drag & Drop de reagendamento
  const handleAppointmentDrop = async (
    appointmentId: number,
    newDate: Date,
    newStartTime: string,
    newEndTime: string
  ) => {
    try {
      // Atualizar otimisticamente
      const newDateStr = format(newDate, "yyyy-MM-dd");

      // Chamar mutation de atualização
      await updateAppointmentMutation.mutateAsync({
        id: appointmentId,
        data: {
          date: newDateStr,
          time: newStartTime,
          endTime: newEndTime,
        },
      });

      toast({
        title: "Agendamento reagendado",
        description: `Novo horário: ${format(newDate, "dd/MM/yyyy")} às ${newStartTime}`,
      });
    } catch (error: any) {
      // Se houver erro de conflito (409), o toast de erro já será mostrado pela mutation
      console.error("Erro ao reagendar:", error);
    }
  };

  // Handler para filtros da sidebar
  const handleFilterChange = (filters: any) => {
    console.log("Filtros aplicados:", filters);

    if (filters.updateMainCalendar && filters.selectedDate) {
      setSelectedDate(new Date(filters.selectedDate));
      toast({
        title: "Data atualizada",
        description: `Visualizando agenda para ${format(new Date(filters.selectedDate), "dd/MM/yyyy")}`,
      });
    }

    if (filters.professional && filters.professional !== 'all') {
      setSelectedProfessionalFilter(filters.professional);
    }
  };

  // Função para obter a cor baseada no status (alinhado com schema do banco)
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'scheduled': // agendado
        return 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30';
      case 'confirmed': // confirmado
        return 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30';
      case 'in_progress': // em andamento
        return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30';
      case 'completed': // concluído
        return 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
      case 'cancelled': // cancelado
        return 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30';
      case 'no_show': // faltou
        return 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  // Função para obter o label em português do status
  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'scheduled': return 'Agendado';
      case 'confirmed': return 'Confirmado';
      case 'in_progress': return 'Em Andamento';
      case 'completed': return 'Concluído';
      case 'cancelled': return 'Cancelado';
      case 'no_show': return 'Faltou';
      default: return status;
    }
  };

  return (
    <DashboardLayout title="Agenda" currentPath="/agenda">
      <div className="flex flex-col h-full">
        {/* Header Principal - Linha 1: Título e Ações */}
        <div className="mb-4 p-4 bg-card rounded-lg shadow-sm space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-3">
            {/* Título e botão Hoje */}
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Agenda</h1>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGoToToday}
                className="flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                Hoje
              </Button>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
              </span>
            </div>

            {/* Botões de ação principais */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Intervalo de tempo */}
              <Select
                value={timeInterval.toString()}
                onValueChange={(value) => {
                  const interval = parseInt(value) as 15 | 20 | 30 | 60;
                  setTimeInterval(interval);
                }}
              >
                <SelectTrigger className="w-[110px] h-9">
                  <Clock className="h-3.5 w-3.5 mr-1.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="20">20 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                </SelectContent>
              </Select>

              {/* Botão de filtros */}
              <Button
                variant={showFilters || activeFiltersCount > 0 ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filtros
                {activeFiltersCount > 0 && (
                  <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                    {activeFiltersCount}
                  </Badge>
                )}
                <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </Button>

              {/* Estatísticas */}
              <Button
                variant={showStats ? "secondary" : "outline"}
                size="sm"
                onClick={toggleStats}
              >
                <BarChart className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Estatísticas</span>
              </Button>

              {/* Encontrar horário */}
              <FindFreeTimeDialog
                selectedDate={selectedDate}
                professionals={mockProfessionals}
                onSelectTimeSlot={(date, startTime, endTime) => {
                  setSelectedDate(date);
                  setNewAppointment({
                    ...newAppointment,
                    date: format(date, "yyyy-MM-dd"),
                    time: startTime,
                    endTime: endTime
                  });
                  setIsNewAppointmentOpen(true);
                }}
              />

              {/* Configurações */}
              <Link href="/settings/schedule">
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>

              {/* Criar agendamento */}
              <Dialog open={isNewAppointmentOpen} onOpenChange={(open) => {
                setIsNewAppointmentOpen(open);
                if (!open) {
                  setNewAppointment({
                    patientId: "",
                    professionalId: "",
                    procedureId: "",
                    date: format(selectedDate, "yyyy-MM-dd"),
                    time: "09:00",
                    endTime: "09:30",
                    notes: "",
                  });
                  calendarDayViewRef.current?.clearSelection();
                }
              }}>
                <DialogTrigger asChild>
                  <Button
                    onClick={handleAddAppointment}
                    size="sm"
                    className="bg-gradient-to-r from-blue-600 to-blue-500 text-white"
                  >
                    <PlusIcon className="h-4 w-4 mr-1.5" />
                    <span className="hidden sm:inline">Novo</span>
                    <span className="sm:hidden">+</span>
                  </Button>
                </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Novo Agendamento</DialogTitle>
                  <DialogDescription>
                    Agende uma nova consulta ou procedimento
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="date">Data</Label>
                      <Input
                        id="date"
                        type="date"
                        value={newAppointment.date}
                        onChange={(e) => setNewAppointment({...newAppointment, date: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:col-span-1">
                      <div className="space-y-2">
                        <Label htmlFor="time">Início</Label>
                        <Input
                          id="time"
                          type="time"
                          value={newAppointment.time}
                          onChange={(e) => setNewAppointment({...newAppointment, time: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="endTime">Fim</Label>
                        <Input
                          id="endTime"
                          type="time"
                          value={newAppointment.endTime}
                          onChange={(e) => setNewAppointment({...newAppointment, endTime: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="patient">Paciente</Label>
                    <Select
                      value={newAppointment.patientId}
                      onValueChange={(value) => setNewAppointment({...newAppointment, patientId: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o paciente" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockPatients.map((patient) => (
                          <SelectItem key={patient.id} value={patient.id.toString()}>
                            {patient.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="professional">Profissional</Label>
                    <Select
                      value={newAppointment.professionalId}
                      onValueChange={(value) => setNewAppointment({...newAppointment, professionalId: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o profissional" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockProfessionals.map((professional) => (
                          <SelectItem key={professional.id} value={professional.id.toString()}>
                            {professional.name} ({professional.specialty})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="procedure">Procedimento</Label>
                    <Select
                      value={newAppointment.procedureId}
                      onValueChange={(value) => setNewAppointment({...newAppointment, procedureId: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o procedimento" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockProcedures.map((procedure) => (
                          <SelectItem key={procedure.id} value={procedure.id.toString()}>
                            {procedure.name} ({procedure.duration} min)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Observações</Label>
                    <Input
                      id="notes"
                      value={newAppointment.notes}
                      onChange={(e) => setNewAppointment({...newAppointment, notes: e.target.value})}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setIsNewAppointmentOpen(false);
                    setNewAppointment({
                      patientId: "",
                      professionalId: "",
                      procedureId: "",
                      date: format(selectedDate, "yyyy-MM-dd"),
                      time: "09:00",
                      endTime: "09:30",
                      notes: "",
                    });
                    // Limpar a seleção visual no CalendarDayView
                    calendarDayViewRef.current?.clearSelection();
                  }}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveAppointment}>
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* AlertDialog para confirmação de exclusão */}
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja deletar este agendamento? Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">
                    Confirmar Exclusão
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Diálogo de Sugestões de Conflito */}
            {conflictData && (
              <ConflictSuggestionsDialog
                open={showConflictDialog}
                onOpenChange={setShowConflictDialog}
                conflicts={conflictData.conflicts || []}
                suggestions={conflictData.suggestions || { nextAvailableSlots: [], alternativeRooms: [] }}
                onSelectTimeSlot={handleSelectTimeSlot}
                onSelectRoom={handleSelectRoom}
              />
            )}
            </div>
          </div>

          {/* Área de Filtros Colapsável */}
          {showFilters && (
            <div className="mt-3 pt-3 border-t animate-in slide-in-from-top-2 duration-200">
              <div className="flex flex-wrap gap-3 items-end">
                {/* Filtro de profissional */}
                <div className="flex-1 min-w-[150px] max-w-[200px]">
                  <Label className="text-xs text-muted-foreground mb-1 block">Profissional</Label>
                  <Select
                    value={selectedProfessionalFilter}
                    onValueChange={setSelectedProfessionalFilter}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os profissionais</SelectItem>
                      {mockProfessionals.map((prof) => (
                        <SelectItem key={prof.id} value={prof.id.toString()}>
                          {prof.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro de sala */}
                <div className="flex-1 min-w-[120px] max-w-[160px]">
                  <Label className="text-xs text-muted-foreground mb-1 block">Sala</Label>
                  <Select
                    value={selectedRoomFilter}
                    onValueChange={setSelectedRoomFilter}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as salas</SelectItem>
                      {mockRooms.map((room) => (
                        <SelectItem key={room.id} value={room.id.toString()}>
                          {room.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro de status */}
                <div className="flex-1 min-w-[130px] max-w-[170px]">
                  <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
                  <Select
                    value={selectedStatusFilter}
                    onValueChange={setSelectedStatusFilter}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="scheduled">Agendado</SelectItem>
                      <SelectItem value="confirmed">Confirmado</SelectItem>
                      <SelectItem value="in_progress">Em Andamento</SelectItem>
                      <SelectItem value="completed">Concluído</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                      <SelectItem value="no_show">Faltou</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro de procedimento */}
                <div className="flex-1 min-w-[150px] max-w-[200px]">
                  <Label className="text-xs text-muted-foreground mb-1 block">Procedimento</Label>
                  <Select
                    value={selectedProcedureFilter}
                    onValueChange={setSelectedProcedureFilter}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os procedimentos</SelectItem>
                      {mockProcedures.map((proc) => (
                        <SelectItem key={proc.id} value={proc.name}>
                          {proc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro de período */}
                <div className="flex-1 min-w-[130px] max-w-[150px]">
                  <Label className="text-xs text-muted-foreground mb-1 block">Data Início</Label>
                  <Input
                    type="date"
                    value={dateRangeStart}
                    onChange={(e) => setDateRangeStart(e.target.value)}
                    className="h-9"
                  />
                </div>

                <div className="flex-1 min-w-[130px] max-w-[150px]">
                  <Label className="text-xs text-muted-foreground mb-1 block">Data Fim</Label>
                  <Input
                    type="date"
                    value={dateRangeEnd}
                    onChange={(e) => setDateRangeEnd(e.target.value)}
                    className="h-9"
                  />
                </div>

                {/* Botão limpar filtros */}
                {activeFiltersCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="h-9 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Limpar ({activeFiltersCount})
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Contador de status dos agendamentos */}
        <div className="mx-4 mb-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-3 items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30 hover:bg-blue-500/30">
                    Agendado: {statusCounts.scheduled}
                  </Badge>
                  <Badge className="bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30 hover:bg-green-500/30">
                    Confirmado: {statusCounts.confirmed}
                  </Badge>
                  <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30 hover:bg-yellow-500/30">
                    Em Andamento: {statusCounts.in_progress}
                  </Badge>
                  <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30">
                    Concluído: {statusCounts.completed}
                  </Badge>
                  <Badge className="bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30 hover:bg-red-500/30">
                    Cancelado: {statusCounts.cancelled}
                  </Badge>
                  <Badge className="bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30 hover:bg-orange-500/30">
                    Faltou: {statusCounts.no_show}
                  </Badge>
                </div>
                <div className="text-sm font-medium text-muted-foreground">
                  Total: {Object.values(statusCounts).reduce((a, b) => a + b, 0)} agendamentos
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Estatísticas de procedimentos */}
        {showStats && (
          <Card className="mb-4 mx-4">
            <CardHeader>
              <CardTitle>Estatísticas de Procedimentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {procedureStats.map((stat: any, index: number) => (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{stat.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {stat.count} agendamentos - R$ {stat.value.toFixed(2)}
                      </span>
                    </div>
                    <Progress value={(stat.count / 25) * 100} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Layout principal com calendário e sidebar */}
        <div className="flex flex-col lg:flex-row gap-4 flex-1 px-2 sm:px-4">
          <div className="flex-1 min-w-0">
            {/* Tabs para mudar o tipo de visualização */}
            <Tabs value={activeView} onValueChange={setActiveView} className="mb-4">
              <TabsList>
                <TabsTrigger value="day">Dia</TabsTrigger>
                <TabsTrigger value="week">Semana</TabsTrigger>
                <TabsTrigger value="month">Mês</TabsTrigger>
                <TabsTrigger value="list">Lista</TabsTrigger>
              </TabsList>

              <TabsContent value="day" className="mt-4">
                <CalendarDayView
                  ref={calendarDayViewRef}
                  appointments={filteredAppointments}
                  onAppointmentClick={handleAppointmentClick}
                  onDateSelect={handleTimeRangeSelect}
                  onAppointmentDrop={handleAppointmentDrop}
                  professionals={mockProfessionals}
                  timeInterval={timeInterval}
                  selectedDate={selectedDate}
                />
              </TabsContent>

              <TabsContent value="week" className="mt-4">
                <CalendarWeekView
                  appointments={filteredAppointments}
                  onAppointmentClick={(appointment) => console.log("Clicked:", appointment)}
                  onDateSelect={handleTimeRangeSelect}
                  professionals={mockProfessionals}
                  timeInterval={timeInterval}
                  selectedDate={selectedDate}
                />
              </TabsContent>

              <TabsContent value="month" className="mt-4">
                <CalendarMonthView
                  appointments={filteredAppointments}
                  onDateSelect={handleDateSelect}
                  onAddAppointment={handleAddAppointment}
                  selectedDate={selectedDate}
                />
              </TabsContent>

              <TabsContent value="list">
                <div className="p-4 text-center bg-card rounded-lg">
                  <p>Visualização em lista em desenvolvimento.</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar com mini calendário e consultas diárias */}
          <div className="w-full lg:w-80 space-y-4">
            <div className="hidden lg:block">
              <ScheduleSidebar onFilterChange={handleFilterChange} />
            </div>

            {/* Menu de consultas diárias */}
            <Card className="lg:block">
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">
                  Consultas do Dia
                  <span className="ml-2 text-xs sm:text-sm font-normal text-muted-foreground">
                    {format(selectedDate, "dd/MM/yyyy")}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredDailyAppointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma consulta para este dia
                  </p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredDailyAppointments.map(appt => (
                      <div
                        key={appt.id}
                        className="p-3 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-medium text-sm">{appt.patientName}</h4>
                          <Badge variant="outline" className={`text-xs ${getStatusColor(appt.status)}`}>
                            {getStatusLabel(appt.status)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">
                          {appt.professionalName}
                        </p>
                        <p className="text-xs font-medium text-primary">
                          {appt.procedure}
                        </p>
                        {(appt as any).paymentStatus && (appt as any).paymentStatus !== 'not_required' && (
                          <div className="mt-2">
                            <PaymentStatusBadge
                              status={(appt as any).paymentStatus}
                              amount={(appt as any).paymentAmount}
                              paidAmount={(appt as any).paidAmount}
                              compact={true}
                            />
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{appt.startTime} - {appt.endTime}</span>
                          </div>
                          <AppointmentQuickActions
                            appointmentId={appt.id}
                            patientPhone={appt.patientPhone}
                            patientId={appt.patientId}
                            currentStatus={appt.status}
                            onEdit={handleEditAppointment}
                            onDelete={handleOpenDeleteConfirm}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Menu de próximos pacientes */}
            <Card className="lg:block">
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">
                  Próximos Pacientes
                  <span className="ml-2 text-xs sm:text-sm font-normal text-muted-foreground">
                    Próximos 7 dias
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingAppointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma consulta agendada para os próximos dias
                  </p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {upcomingAppointments.map(appt => (
                      <div
                        key={appt.id}
                        className="p-3 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedDate(new Date(appt.date));
                          toast({
                            title: "Data atualizada",
                            description: `Visualizando agenda para ${format(new Date(appt.date), "dd/MM/yyyy")}`,
                          });
                        }}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-medium text-sm">{appt.patientName}</h4>
                          <Badge variant="outline" className={`text-xs ${getStatusColor(appt.status)}`}>
                            {getStatusLabel(appt.status)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">
                          {appt.professionalName}
                        </p>
                        <p className="text-xs font-medium text-primary">
                          {appt.procedure}
                        </p>
                        <div className="space-y-2 mt-2">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span className="font-medium">
                              {format(new Date(appt.date), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                            <span className="mx-1">•</span>
                            <Clock className="h-3 w-3" />
                            <span>{appt.startTime} - {appt.endTime}</span>
                          </div>
                          <div className="flex justify-end">
                            <AppointmentQuickActions
                              appointmentId={appt.id}
                              patientPhone={appt.patientPhone}
                              patientId={appt.patientId}
                              currentStatus={appt.status}
                              onEdit={handleEditAppointment}
                              onDelete={handleOpenDeleteConfirm}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Edit Appointment Dialog */}
        <Dialog open={isEditAppointmentOpen} onOpenChange={setIsEditAppointmentOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Agendamento</DialogTitle>
              <DialogDescription>
                Atualize os dados do agendamento
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-date">Data</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={newAppointment.date}
                    onChange={(e) => setNewAppointment({...newAppointment, date: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:col-span-1">
                  <div className="space-y-2">
                    <Label htmlFor="edit-time">Início</Label>
                    <Input
                      id="edit-time"
                      type="time"
                      value={newAppointment.time}
                      onChange={(e) => setNewAppointment({...newAppointment, time: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-endTime">Fim</Label>
                    <Input
                      id="edit-endTime"
                      type="time"
                      value={newAppointment.endTime}
                      onChange={(e) => setNewAppointment({...newAppointment, endTime: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-patient">Paciente</Label>
                <Select
                  value={newAppointment.patientId}
                  onValueChange={(value) => setNewAppointment({...newAppointment, patientId: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o paciente" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockPatients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id.toString()}>
                        {patient.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-professional">Profissional</Label>
                <Select
                  value={newAppointment.professionalId}
                  onValueChange={(value) => setNewAppointment({...newAppointment, professionalId: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o profissional" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockProfessionals.map((professional) => (
                      <SelectItem key={professional.id} value={professional.id.toString()}>
                        {professional.name} ({professional.specialty})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-procedure">Procedimento</Label>
                <Select
                  value={newAppointment.procedureId}
                  onValueChange={(value) => setNewAppointment({...newAppointment, procedureId: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o procedimento" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockProcedures.map((procedure) => (
                      <SelectItem key={procedure.id} value={procedure.id.toString()}>
                        {procedure.name} ({procedure.duration} min)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-notes">Observações</Label>
                <Input
                  id="edit-notes"
                  value={newAppointment.notes}
                  onChange={(e) => setNewAppointment({...newAppointment, notes: e.target.value})}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditAppointmentOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit} disabled={updateAppointmentMutation.isPending}>
                {updateAppointmentMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-red-600 hover:bg-red-700"
                disabled={deleteAppointmentMutation.isPending}
              >
                {deleteAppointmentMutation.isPending ? 'Excluindo...' : 'Excluir'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bottom Sheet para detalhes do agendamento */}
        <AppointmentDetailsDrawer
          appointment={selectedAppointment}
          open={isDrawerOpen}
          onOpenChange={setIsDrawerOpen}
          onEdit={(appt) => handleEditAppointment(appt.id)}
          onDelete={handleOpenDeleteConfirm}
          onConfirm={handleConfirmAppointment}
          onWhatsApp={handleWhatsApp}
          onViewRecord={handleViewRecord}
        />

        {/* FAB para criar novo agendamento - usa o mesmo dialog */}
        <FloatingActionButton
          onClick={handleAddAppointment}
          label="Novo Agendamento"
          variant="primary"
          size="lg"
          showOnMobile={true}
        />
      </div>
    </DashboardLayout>
  );
}
