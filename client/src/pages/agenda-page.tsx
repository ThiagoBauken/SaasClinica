import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import DashboardLayout from "@/layouts/DashboardLayout";
import CalendarMonthView from "@/components/CalendarMonthView";
import CalendarWeekView from "@/components/CalendarWeekView";
import CalendarDayView from "@/components/CalendarDayView";
import CalendarGridView from "@/components/CalendarGridView";
import FindFreeTimeDialog from "@/components/FindFreeTimeDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PlusIcon, BarChart } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Dados de exemplo para desenvolvimento - seriam substituídos por dados reais da API
const mockProfessionals = [
  { id: 1, name: "Dra. Flávia Costa", specialty: "Ortodontia" },
  { id: 2, name: "Dr. Ricardo Almeida", specialty: "Implantodontia" },
  { id: 3, name: "Dra. Carolina Santos", specialty: "Endodontia" },
  { id: 4, name: "Dr. Alexandre Ferreira", specialty: "Cirurgia" },
];

const mockPatients = [
  { id: 101, name: "Pedro Oliveira", phone: "(11) 98765-4321" },
  { id: 102, name: "Maria Silva", phone: "(11) 91234-5678" },
  { id: 103, name: "João Santos", phone: "(11) 99876-5432" },
  { id: 104, name: "Ana Souza", phone: "(11) 94321-8765" },
];

const mockProcedures = [
  { id: 201, name: "Consulta Inicial", duration: 30, price: 150 },
  { id: 202, name: "Limpeza", duration: 45, price: 200 },
  { id: 203, name: "Canal", duration: 60, price: 450 },
  { id: 204, name: "Extração", duration: 30, price: 250 },
];

// Dados de exemplo para estatísticas
const mockProcedureStats = [
  { name: "Consulta Inicial", count: 18, value: 2700 },
  { name: "Limpeza", count: 15, value: 3000 },
  { name: "Canal", count: 8, value: 3600 },
  { name: "Extração", count: 12, value: 3000 },
  { name: "Restauração", count: 22, value: 4400 },
];

export default function AgendaPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [activeView, setActiveView] = useState("month");
  
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

  // Query para buscar compromissos
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["/api/appointments"],
    queryFn: async () => {
      // Em um ambiente real, isso seria uma chamada de API
      return [
        { 
          id: 1, 
          date: new Date(), 
          patientName: "Maria Silva", 
          professionalName: "Dra. Carolina Santos",
          procedure: "Consulta Inicial",
          status: "confirmado",
          startTime: "09:00",
          endTime: "09:30",
        },
        { 
          id: 2, 
          date: new Date(new Date().setDate(new Date().getDate() + 2)), 
          patientName: "Pedro Oliveira", 
          professionalName: "Dr. Ricardo Almeida",
          procedure: "Extração",
          status: "agendado",
          startTime: "14:30",
          endTime: "15:00",
        },
      ];
    },
  });

  // Função para lidar com a seleção de uma data
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  // Função para lidar com a seleção de horário por arrasto
  const handleTimeRangeSelect = (date: Date, startTime: string, endTime?: string) => {
    setSelectedDate(date);
    
    // Preencher automaticamente o formulário de novo agendamento com os horários selecionados
    setNewAppointment({
      ...newAppointment,
      date: format(date, "yyyy-MM-dd"),
      time: startTime,
      endTime: endTime || startTime
    });
    
    // Abrir o modal de agendamento com os horários já preenchidos
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
    // Aqui faria a chamada de API para salvar o agendamento
    console.log("Novo agendamento:", newAppointment);
    setIsNewAppointmentOpen(false);
    
    // Depois adicionar o código para invalidar a query e atualizar a lista
  };

  return (
    <DashboardLayout title="Agenda" currentPath="/agenda">
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Agenda</h1>
          
          <div className="flex space-x-2">
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
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Novo Agendamento</DialogTitle>
                  <DialogDescription>
                    Agende uma nova consulta ou procedimento
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="date">Data</Label>
                      <Input 
                        id="date" 
                        type="date" 
                        value={newAppointment.date}
                        onChange={(e) => setNewAppointment({...newAppointment, date: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
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

        {/* Estatísticas de procedimentos */}
        {showStats && (
          <Card className="mb-6">
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

        {/* Tabs para mudar o tipo de visualização */}
        <Tabs value={activeView} onValueChange={setActiveView} className="mb-4">
          <TabsList>
            <TabsTrigger value="day">Dia</TabsTrigger>
            <TabsTrigger value="week">Semana</TabsTrigger>
            <TabsTrigger value="month">Mês</TabsTrigger>
            <TabsTrigger value="list">Lista</TabsTrigger>
          </TabsList>
          
          <TabsContent value="day">
            <div className="p-4 text-center">
              <p>Visualização diária em desenvolvimento.</p>
            </div>
          </TabsContent>
          
          <TabsContent value="week" className="mt-4">
            <CalendarGridView 
              selectedDate={selectedDate}
              appointments={appointments}
              onDateSelect={handleDateSelect}
              onDragSelect={(date, startTime, endTime) => {
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
          </TabsContent>
          
          <TabsContent value="month" className="mt-4">
            <CalendarMonthView 
              appointments={appointments}
              onDateSelect={handleDateSelect}
              onAddAppointment={handleAddAppointment}
            />
          </TabsContent>
          
          <TabsContent value="list">
            <div className="p-4 text-center">
              <p>Visualização em lista em desenvolvimento.</p>
            </div>
          </TabsContent>
        </Tabs>
        
        {/* Informações de data selecionada */}
        <div className="mt-6">
          <h2 className="text-lg font-medium mb-2">
            Agendamentos para {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </h2>
          
          {appointments.filter(appt => 
            format(appt.date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd")
          ).length === 0 ? (
            <p className="text-muted-foreground">Nenhum agendamento para este dia.</p>
          ) : (
            <div className="space-y-2">
              {appointments
                .filter(appt => format(appt.date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd"))
                .map(appt => (
                  <div key={appt.id} className="p-3 border rounded-md hover:bg-gray-50">
                    <div className="flex justify-between">
                      <h3 className="font-medium">{appt.patientName}</h3>
                      <span className="text-sm text-blue-600">{appt.startTime} - {appt.endTime}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{appt.procedure} com {appt.professionalName}</p>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}