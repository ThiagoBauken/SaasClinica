import { useState, useMemo } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Calendar,
  Clock,
  Plus,
  User,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  Phone,
  Mail
} from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AgendaPage() {
  const { toast } = useToast();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isAddAppointmentOpen, setIsAddAppointmentOpen] = useState(false);
  const [filterDoctor, setFilterDoctor] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch appointments
  const {
    data: appointments = [],
    isLoading: isLoadingAppointments,
  } = useQuery({
    queryKey: ["/api/appointments"],
  });

  // Fetch patients
  const { data: patients = [] } = useQuery({
    queryKey: ["/api/patients"],
  });

  // Fetch doctors (users with doctor role)
  const { data: doctors = [] } = useQuery({
    queryKey: ["/api/users"],
  });

  // Create appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: (newAppointment: any) => apiRequest("/api/appointments", "POST", newAppointment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setIsAddAppointmentOpen(false);
      toast({
        title: "Sucesso",
        description: "Consulta agendada com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao agendar consulta",
        variant: "destructive",
      });
    },
  });

  // Update appointment status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest(`/api/appointments/${id}`, "PATCH", { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({
        title: "Sucesso",
        description: "Status atualizado com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar status",
        variant: "destructive",
      });
    },
  });

  // Calculate week days
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
    const end = endOfWeek(currentWeek, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentWeek]);

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((appointment: any) => {
      const matchesDoctor = filterDoctor === "all" || appointment.doctorId?.toString() === filterDoctor;
      const matchesStatus = filterStatus === "all" || appointment.status === filterStatus;
      const matchesSearch = !searchQuery || 
        appointment.patient?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        appointment.patient?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        appointment.notes?.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesDoctor && matchesStatus && matchesSearch;
    });
  }, [appointments, filterDoctor, filterStatus, searchQuery]);

  // Group appointments by date and time
  const appointmentsByDate = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    filteredAppointments.forEach((appointment: any) => {
      const dateKey = format(parseISO(appointment.startTime), "yyyy-MM-dd");
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(appointment);
    });
    
    // Sort appointments by time within each date
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => 
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
    });
    
    return grouped;
  }, [filteredAppointments]);

  // Handle form submission
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    const appointmentData = {
      patientId: parseInt(formData.get("patientId") as string),
      doctorId: parseInt(formData.get("doctorId") as string),
      startTime: new Date(`${formData.get("date")}T${formData.get("time")}`).toISOString(),
      endTime: new Date(new Date(`${formData.get("date")}T${formData.get("time")}`).getTime() + 60 * 60 * 1000).toISOString(),
      procedure: formData.get("procedure"),
      notes: formData.get("notes"),
      status: "scheduled"
    };

    createAppointmentMutation.mutate(appointmentData);
  };

  // Get status info
  const getStatusInfo = (status: string) => {
    const statusMap = {
      scheduled: { label: "Agendado", color: "bg-blue-500", icon: Clock },
      confirmed: { label: "Confirmado", color: "bg-green-500", icon: CheckCircle },
      completed: { label: "Realizado", color: "bg-emerald-500", icon: CheckCircle },
      cancelled: { label: "Cancelado", color: "bg-red-500", icon: XCircle },
      noshow: { label: "Faltou", color: "bg-orange-500", icon: AlertCircle }
    };
    return statusMap[status as keyof typeof statusMap] || statusMap.scheduled;
  };

  // Time slots for appointment booking
  const timeSlots = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", 
    "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", 
    "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"
  ];

  return (
    <DashboardLayout title="Agenda" currentPath="/schedule">
      <div className="space-y-6">
        {/* Header with Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
            >
              ← Semana Anterior
            </Button>
            <h2 className="text-xl font-semibold">
              {format(weekDays[0], "dd 'de' MMMM", { locale: ptBR })} - {format(weekDays[6], "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </h2>
            <Button 
              variant="outline" 
              onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
            >
              Próxima Semana →
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setCurrentWeek(new Date())}
            >
              Hoje
            </Button>
          </div>

          <Dialog open={isAddAppointmentOpen} onOpenChange={setIsAddAppointmentOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Consulta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Agendar Nova Consulta</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="patientId">Paciente</Label>
                    <Select name="patientId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar paciente" />
                      </SelectTrigger>
                      <SelectContent>
                        {patients.map((patient: any) => (
                          <SelectItem key={patient.id} value={patient.id.toString()}>
                            {patient.name || patient.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="doctorId">Dentista</Label>
                    <Select name="doctorId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar dentista" />
                      </SelectTrigger>
                      <SelectContent>
                        {doctors.filter((user: any) => user.role === 'dentist').map((doctor: any) => (
                          <SelectItem key={doctor.id} value={doctor.id.toString()}>
                            Dr. {doctor.name || doctor.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date">Data</Label>
                    <Input
                      id="date"
                      name="date"
                      type="date"
                      defaultValue={format(selectedDate, "yyyy-MM-dd")}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="time">Horário</Label>
                    <Select name="time" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar horário" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="procedure">Procedimento</Label>
                  <Select name="procedure" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar procedimento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consulta">Consulta</SelectItem>
                      <SelectItem value="limpeza">Limpeza</SelectItem>
                      <SelectItem value="restauracao">Restauração</SelectItem>
                      <SelectItem value="extracao">Extração</SelectItem>
                      <SelectItem value="canal">Tratamento de Canal</SelectItem>
                      <SelectItem value="ortodontia">Ortodontia</SelectItem>
                      <SelectItem value="implante">Implante</SelectItem>
                      <SelectItem value="protese">Prótese</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    placeholder="Observações sobre a consulta"
                    rows={3}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddAppointmentOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createAppointmentMutation.isPending}>
                    {createAppointmentMutation.isPending ? "Agendando..." : "Agendar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar paciente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>

          <Select value={filterDoctor} onValueChange={setFilterDoctor}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por dentista" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os dentistas</SelectItem>
              {doctors.filter((user: any) => user.role === 'dentist').map((doctor: any) => (
                <SelectItem key={doctor.id} value={doctor.id.toString()}>
                  Dr. {doctor.name || doctor.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="scheduled">Agendado</SelectItem>
              <SelectItem value="confirmed">Confirmado</SelectItem>
              <SelectItem value="completed">Realizado</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
              <SelectItem value="noshow">Faltou</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Weekly Calendar View */}
        <Tabs defaultValue="week" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="week">Visualização Semanal</TabsTrigger>
            <TabsTrigger value="list">Lista de Consultas</TabsTrigger>
          </TabsList>

          <TabsContent value="week" className="space-y-4">
            <div className="grid grid-cols-7 gap-4">
              {weekDays.map((day) => {
                const dayKey = format(day, "yyyy-MM-dd");
                const dayAppointments = appointmentsByDate[dayKey] || [];
                const isToday = isSameDay(day, new Date());
                
                return (
                  <Card key={dayKey} className={`min-h-96 ${isToday ? 'ring-2 ring-blue-500' : ''}`}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">
                        {format(day, "EEEE", { locale: ptBR })}
                      </CardTitle>
                      <CardDescription>
                        {format(day, "dd/MM", { locale: ptBR })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {dayAppointments.map((appointment: any) => {
                        const statusInfo = getStatusInfo(appointment.status);
                        const IconComponent = statusInfo.icon;
                        
                        return (
                          <Card key={appointment.id} className="p-2 hover:shadow-md transition-shadow cursor-pointer">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium">
                                  {format(parseISO(appointment.startTime), "HH:mm")}
                                </span>
                                <Badge variant="secondary" className={`${statusInfo.color} text-white text-xs`}>
                                  <IconComponent className="h-3 w-3 mr-1" />
                                  {statusInfo.label}
                                </Badge>
                              </div>
                              <div className="text-sm font-medium">
                                {appointment.patient?.name || appointment.patient?.full_name}
                              </div>
                              <div className="text-xs text-gray-600">
                                {appointment.procedure}
                              </div>
                              {appointment.status === "scheduled" && (
                                <div className="flex space-x-1 mt-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => updateStatusMutation.mutate({
                                      id: appointment.id,
                                      status: "confirmed"
                                    })}
                                  >
                                    Confirmar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => updateStatusMutation.mutate({
                                      id: appointment.id,
                                      status: "cancelled"
                                    })}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              )}
                            </div>
                          </Card>
                        );
                      })}
                      
                      {dayAppointments.length === 0 && (
                        <div className="text-center text-gray-400 text-sm py-8">
                          Nenhuma consulta
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="list" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Lista de Consultas</CardTitle>
                <CardDescription>Todas as consultas da semana</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingAppointments ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-sm text-gray-500">Carregando consultas...</div>
                  </div>
                ) : filteredAppointments.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma consulta encontrada</h3>
                    <p className="text-gray-600 mb-4">
                      Não há consultas agendadas para os filtros selecionados
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredAppointments.map((appointment: any) => {
                      const statusInfo = getStatusInfo(appointment.status);
                      const IconComponent = statusInfo.icon;
                      
                      return (
                        <Card key={appointment.id} className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                <span className="text-sm">
                                  {format(parseISO(appointment.startTime), "dd/MM/yyyy")} às {format(parseISO(appointment.startTime), "HH:mm")}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <User className="h-4 w-4 text-gray-400" />
                                <span className="font-medium">
                                  {appointment.patient?.name || appointment.patient?.full_name}
                                </span>
                              </div>
                              <span className="text-sm text-gray-600">
                                {appointment.procedure}
                              </span>
                            </div>
                            
                            <div className="flex items-center space-x-3">
                              <Badge variant="secondary" className={`${statusInfo.color} text-white`}>
                                <IconComponent className="h-3 w-3 mr-1" />
                                {statusInfo.label}
                              </Badge>
                              
                              {appointment.status === "scheduled" && (
                                <div className="flex space-x-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateStatusMutation.mutate({
                                      id: appointment.id,
                                      status: "confirmed"
                                    })}
                                  >
                                    Confirmar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateStatusMutation.mutate({
                                      id: appointment.id,
                                      status: "cancelled"
                                    })}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {appointment.notes && (
                            <div className="mt-2 text-sm text-gray-600">
                              <strong>Observações:</strong> {appointment.notes}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}