import { useState, useMemo } from "react";
import { format, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import DashboardLayout from "@/layouts/DashboardLayout";
import CalendarMonthView from "@/components/CalendarMonthView";
import CalendarWeekView from "@/components/CalendarWeekView";
import CalendarDayView from "@/components/CalendarDayView";
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
import { PlusIcon, BarChart, Calendar, Clock, Settings } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import AppointmentQuickActions from "@/components/AppointmentQuickActions";

const mockProcedureStats = [
  { name: "Consulta Inicial", count: 18, value: 2700 },
  { name: "Limpeza", count: 15, value: 3000 },
  { name: "Canal", count: 8, value: 3600 },
  { name: "Extração", count: 12, value: 3000 },
  { name: "Restauração", count: 22, value: 4400 },
];

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
  const { data: appointmentsData, isLoading } = useQuery({
    queryKey: ["/api/v1/appointments", {
      limit: 1000, // Buscar muitos para ter dados suficientes
    }],
  });

  // Query para buscar profissionais reais
  const { data: professionalsData } = useQuery({
    queryKey: ["/api/v1/professionals"],
  });

  // Query para buscar salas reais
  const { data: roomsData } = useQuery({
    queryKey: ["/api/v1/rooms"],
  });

  const appointments = useMemo(() => {
    if (!appointmentsData?.data) return [];

    // Transformar dados da API para o formato esperado pelo componente
    return appointmentsData.data.map((appt: any) => ({
      id: appt.id,
      date: new Date(appt.startTime), // startTime já é um ISO timestamp
      patientId: appt.patientId,
      patientName: appt.patientName,
      patientPhone: appt.patientPhone || appt.patientWhatsapp,
      professionalName: appt.professionalName,
      professionalId: appt.professionalId,
      procedure: appt.procedureName || appt.notes || "Consulta",
      status: appt.status,
      startTime: format(new Date(appt.startTime), "HH:mm"),
      endTime: format(new Date(appt.endTime), "HH:mm"),
    }));
  }, [appointmentsData]);

  // Transformar profissionais da API
  const mockProfessionals = useMemo(() => {
    if (!professionalsData?.data) return [];
    return professionalsData.data.map((prof: any) => ({
      id: prof.id,
      name: prof.fullName,
      specialty: prof.speciality || "Dentista",
    }));
  }, [professionalsData]);

  // Transformar salas da API
  const mockRooms = useMemo(() => {
    if (!roomsData?.data) return [];
    return roomsData.data.map((room: any) => ({
      id: room.id,
      name: room.name,
    }));
  }, [roomsData]);

  // Query para buscar pacientes reais
  const { data: patientsData } = useQuery({
    queryKey: ["/api/v1/patients"],
  });

  const mockPatients = useMemo(() => {
    if (!patientsData?.data) return [];
    return patientsData.data.map((patient: any) => ({
      id: patient.id,
      name: patient.name,
      phone: patient.phone || patient.whatsapp || "",
    }));
  }, [patientsData]);

  // Query para buscar procedimentos reais
  const { data: proceduresData } = useQuery({
    queryKey: ["/api/v1/procedures"],
  });

  const mockProcedures = useMemo(() => {
    if (!proceduresData?.data) return [];
    return proceduresData.data.map((proc: any) => ({
      id: proc.id,
      name: proc.name,
      duration: proc.duration || 30,
      price: proc.price || 0,
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
    onError: (error: Error) => {
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
    onError: (error: Error) => {
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

  // Função para lidar com a seleção de uma data (ao clicar no dia, muda para visualização diária)
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
    console.log("Novo agendamento:", newAppointment);
    setIsNewAppointmentOpen(false);
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
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'confirmed': // confirmado
        return 'bg-green-100 text-green-800 border-green-300';
      case 'in_progress': // em andamento
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'completed': // concluído
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'cancelled': // cancelado
        return 'bg-red-100 text-red-800 border-red-300';
      case 'no_show': // faltou
        return 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
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
        {/* Header com controles */}
        <div className="flex justify-between items-center mb-4 p-4 bg-card rounded-lg shadow-sm">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold">Agenda</h1>

            {/* Botão Hoje */}
            <Button
              variant="outline"
              onClick={handleGoToToday}
              className="flex items-center gap-2"
            >
              <Calendar className="h-4 w-4" />
              Hoje
            </Button>

            {/* Seletor de intervalo de tempo */}
            <Select
              value={timeInterval.toString()}
              onValueChange={(value) => {
                const interval = parseInt(value) as 15 | 20 | 30 | 60;
                setTimeInterval(interval);
                toast({
                  title: `Intervalo alterado para ${interval} minutos`,
                  description: `Os horários agora estão divididos em intervalos de ${interval} minutos.`,
                });
              }}
            >
              <SelectTrigger className="w-[140px]">
                <Clock className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutos</SelectItem>
                <SelectItem value="20">20 minutos</SelectItem>
                <SelectItem value="30">30 minutos</SelectItem>
                <SelectItem value="60">60 minutos</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro de profissional */}
            <Select
              value={selectedProfessionalFilter}
              onValueChange={setSelectedProfessionalFilter}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por profissional" />
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

            {/* Filtro de sala */}
            <Select
              value={selectedRoomFilter}
              onValueChange={setSelectedRoomFilter}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por sala" />
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

            {/* Filtro de status */}
            <Select
              value={selectedStatusFilter}
              onValueChange={setSelectedStatusFilter}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por status" />
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

            {/* Filtro de procedimento */}
            <Select
              value={selectedProcedureFilter}
              onValueChange={setSelectedProcedureFilter}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por procedimento" />
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

          <div className="flex space-x-2">
            {/* Botão de configurações */}
            <Link href="/settings/schedule">
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>

            <Button
              variant="outline"
              onClick={toggleStats}
              className={showStats ? "bg-blue-50" : ""}
            >
              <BarChart className="h-4 w-4 mr-2" />
              Estatísticas
            </Button>

            <FindFreeTimeDialog
              selectedDate={selectedDate}
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

            <Dialog open={isNewAppointmentOpen} onOpenChange={setIsNewAppointmentOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={handleAddAppointment}
                  className="bg-gradient-to-r from-blue-600 to-blue-500 text-white"
                >
                  <PlusIcon className="mr-2 h-4 w-4" /> Criar
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
                  <Button variant="outline" onClick={() => setIsNewAppointmentOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveAppointment}>
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Contador de status dos agendamentos */}
        <div className="mx-4 mb-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-3 items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-100">
                    Agendado: {statusCounts.scheduled}
                  </Badge>
                  <Badge className="bg-green-100 text-green-800 border-green-300 hover:bg-green-100">
                    Confirmado: {statusCounts.confirmed}
                  </Badge>
                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-100">
                    Em Andamento: {statusCounts.in_progress}
                  </Badge>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100">
                    Concluído: {statusCounts.completed}
                  </Badge>
                  <Badge className="bg-red-100 text-red-800 border-red-300 hover:bg-red-100">
                    Cancelado: {statusCounts.cancelled}
                  </Badge>
                  <Badge className="bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-100">
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
                {mockProcedureStats.map((stat, index) => (
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
                  appointments={filteredAppointments}
                  onAppointmentClick={(appointment) => console.log("Clicked:", appointment)}
                  onDateSelect={handleTimeRangeSelect}
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
      </div>
    </DashboardLayout>
  );
}
