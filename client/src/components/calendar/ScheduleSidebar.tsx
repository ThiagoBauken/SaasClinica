import { useState } from "react";
import MiniCalendar from "@/components/calendar/MiniCalendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  User, 
  Info, 
  BarChart3,
  Users,
  CalendarCheck,
  Calendar as CalendarIcon,
  ChevronDown,
  X,
  Plus
} from "lucide-react";
import { format } from "date-fns";

interface ScheduleSidebarProps {
  onFilterChange?: (filters: any) => void;
}

// Componente de lista de próximos agendamentos
const UpcomingAppointments = () => {
  // Simulação de próximos agendamentos
  const appointments = [
    { 
      id: 1, 
      patient: "Ricardo Almeida", 
      time: "09:30 - 10:00", 
      date: "2023-08-12", 
      procedure: "Consulta inicial",
      status: "confirmed"
    },
    { 
      id: 2, 
      patient: "Mariana Santos", 
      time: "11:15 - 12:00", 
      date: "2023-08-12", 
      procedure: "Limpeza dental",
      status: "confirmed"
    },
    { 
      id: 3, 
      patient: "João Silva", 
      time: "14:00 - 15:00", 
      date: "2023-08-12", 
      procedure: "Restauração",
      status: "scheduled"
    }
  ];

  return (
    <div className="space-y-2">
      {appointments.map(appt => (
        <div key={appt.id} className="p-2 border rounded-md bg-background hover:bg-muted/30 transition-colors">
          <div className="flex justify-between items-start">
            <span className="font-medium text-sm">{appt.patient}</span>
            <Badge variant={appt.status === 'confirmed' ? 'outline' : 'secondary'} className="text-[10px] h-5">
              {appt.status === 'confirmed' ? 'Confirmado' : 'Agendado'}
            </Badge>
          </div>
          <div className="flex items-center text-xs text-muted-foreground mt-1">
            <Clock className="h-3 w-3 mr-1" />
            <span>{appt.time}</span>
          </div>
          <div className="flex items-center text-xs text-muted-foreground mt-1">
            <CalendarIcon className="h-3 w-3 mr-1" />
            <span>{format(new Date(appt.date), 'dd/MM/yyyy')}</span>
          </div>
          <div className="text-xs mt-1 truncate">{appt.procedure}</div>
        </div>
      ))}
    </div>
  );
}

// Estatísticas da agenda
const ScheduleStats = () => {
  return (
    <div className="space-y-3 p-1">
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 border rounded-md bg-background">
          <div className="text-xs text-muted-foreground">Total hoje</div>
          <div className="text-lg font-semibold">12</div>
        </div>
        <div className="p-2 border rounded-md bg-background">
          <div className="text-xs text-muted-foreground">Confirmados</div>
          <div className="text-lg font-semibold text-green-600">8</div>
        </div>
        <div className="p-2 border rounded-md bg-background">
          <div className="text-xs text-muted-foreground">Pendentes</div>
          <div className="text-lg font-semibold text-amber-600">3</div>
        </div>
        <div className="p-2 border rounded-md bg-background">
          <div className="text-xs text-muted-foreground">Cancelados</div>
          <div className="text-lg font-semibold text-red-600">1</div>
        </div>
      </div>

      <div className="p-2 border rounded-md bg-background">
        <div className="text-xs text-muted-foreground mb-1">Taxa de ocupação</div>
        <div className="w-full bg-muted rounded-full h-2">
          <div className="bg-green-500 h-2 rounded-full" style={{ width: '65%' }}></div>
        </div>
        <div className="text-xs text-muted-foreground mt-1 text-right">65%</div>
      </div>
    </div>
  );
}

export default function ScheduleSidebar({ onFilterChange }: ScheduleSidebarProps) {
  const [filters, setFilters] = useState({
    status: "all",
    professional: "all",
    patient: "",
    procedure: "all",
    room: "all",
    date: "today",
  });

  const [activeTab, setActiveTab] = useState("calendar");

  const handleFilterChange = (field: keyof typeof filters, value: string) => {
    const newFilters = {
      ...filters,
      [field]: value,
    };
    setFilters(newFilters);
    
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
  };

  const clearFilters = () => {
    const newFilters = {
      status: "all",
      professional: "all",
      patient: "",
      procedure: "all",
      room: "all",
      date: "today",
    };
    setFilters(newFilters);
    
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
  };

  // Elementos ativos de filtro
  const activeFilters = Object.entries(filters).filter(([key, value]) => {
    if (key === 'patient' && value !== '') return true;
    if (value !== 'all' && value !== '' && key !== 'patient' && key !== 'date') return true;
    return false;
  });

  return (
    <div className="border border-border bg-card w-72 h-[calc(100vh-180px)] rounded-md shadow-sm flex flex-col">
      <Tabs defaultValue="calendar" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full grid grid-cols-3 rounded-none border-b">
          <TabsTrigger value="calendar" className="rounded-none">
            <Calendar className="h-4 w-4 mr-2" />
            <span className="text-xs">Calendário</span>
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="rounded-none">
            <Clock className="h-4 w-4 mr-2" />
            <span className="text-xs">Próximos</span>
          </TabsTrigger>
          <TabsTrigger value="stats" className="rounded-none">
            <BarChart3 className="h-4 w-4 mr-2" />
            <span className="text-xs">Estatísticas</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="flex-1 flex flex-col p-3 pt-4 space-y-4 overflow-hidden">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Data</h2>
            
            {/* Mini Calendar Component */}
            <MiniCalendar />
            
            {/* Date range shortcuts */}
            <div className="flex flex-wrap gap-1 pt-2">
              <Badge 
                variant={filters.date === 'today' ? "default" : "outline"} 
                className="cursor-pointer"
                onClick={() => handleFilterChange("date", "today")}
              >
                Hoje
              </Badge>
              <Badge 
                variant={filters.date === 'tomorrow' ? "default" : "outline"} 
                className="cursor-pointer"
                onClick={() => handleFilterChange("date", "tomorrow")}
              >
                Amanhã
              </Badge>
              <Badge 
                variant={filters.date === 'week' ? "default" : "outline"} 
                className="cursor-pointer"
                onClick={() => handleFilterChange("date", "week")}
              >
                Esta semana
              </Badge>
              <Badge 
                variant={filters.date === 'month' ? "default" : "outline"} 
                className="cursor-pointer"
                onClick={() => handleFilterChange("date", "month")}
              >
                Este mês
              </Badge>
            </div>
          </div>
          
          {/* Status indicators */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Ocupação</h2>
            <div className="grid grid-cols-2 gap-2 text-xs text-foreground">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                <span>Disponível</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                <span>Moderado</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-orange-500 mr-2"></div>
                <span>Ocupado</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                <span>Lotado</span>
              </div>
            </div>
          </div>
          
          {/* Filters */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold text-foreground">Filtros</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2" 
                onClick={clearFilters}
                disabled={activeFilters.length === 0}
              >
                <X className="h-3 w-3 mr-1" />
                <span className="text-xs">Limpar</span>
              </Button>
            </div>
            
            {/* Active filters */}
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {activeFilters.map(([key, value]) => (
                  <Badge key={key} variant="secondary" className="flex items-center gap-1">
                    {key === 'status' && 'Status:'}
                    {key === 'professional' && 'Prof:'}
                    {key === 'procedure' && 'Proc:'}
                    {key === 'room' && 'Sala:'}
                    {key === 'patient' && 'Paciente:'}
                    <span className="truncate max-w-[80px]">
                      {key === 'patient' ? value : value}
                    </span>
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => handleFilterChange(key as keyof typeof filters, key === 'patient' ? '' : 'all')}
                    />
                  </Badge>
                ))}
              </div>
            )}
            
            {/* Status filter */}
            <div>
              <Label htmlFor="status" className="block text-xs font-medium text-foreground mb-1">Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => handleFilterChange("status", value)}
              >
                <SelectTrigger id="status" className="w-full h-8 text-xs">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="scheduled">Agendado</SelectItem>
                  <SelectItem value="confirmed">Confirmado</SelectItem>
                  <SelectItem value="in_progress">Em andamento</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                  <SelectItem value="no_show">Não compareceu</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Professional filter */}
            <div>
              <Label htmlFor="professional" className="block text-xs font-medium text-foreground mb-1">Profissional</Label>
              <Select
                value={filters.professional}
                onValueChange={(value) => handleFilterChange("professional", value)}
              >
                <SelectTrigger id="professional" className="w-full h-8 text-xs">
                  <SelectValue placeholder="Todos os profissionais" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os profissionais</SelectItem>
                  <SelectItem value="1">Dr. Ana Silva</SelectItem>
                  <SelectItem value="2">Dr. Carlos Mendes</SelectItem>
                  <SelectItem value="3">Dr. Juliana Costa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Patient filter */}
            <div>
              <Label htmlFor="patient" className="block text-xs font-medium text-foreground mb-1">Paciente</Label>
              <div className="relative">
                <Search className="h-3 w-3 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  id="patient"
                  placeholder="Buscar paciente"
                  className="pl-7 h-8 text-xs"
                  value={filters.patient}
                  onChange={(e) => handleFilterChange("patient", e.target.value)}
                />
              </div>
            </div>
            
            {/* Procedure filter */}
            <div>
              <Label htmlFor="procedure" className="block text-xs font-medium text-foreground mb-1">Procedimento</Label>
              <Select
                value={filters.procedure}
                onValueChange={(value) => handleFilterChange("procedure", value)}
              >
                <SelectTrigger id="procedure" className="w-full h-8 text-xs">
                  <SelectValue placeholder="Todos os procedimentos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os procedimentos</SelectItem>
                  <SelectItem value="initial">Consulta inicial</SelectItem>
                  <SelectItem value="cleaning">Limpeza</SelectItem>
                  <SelectItem value="restoration">Restauração</SelectItem>
                  <SelectItem value="rootcanal">Tratamento de canal</SelectItem>
                  <SelectItem value="extraction">Extração</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Room filter */}
            <div>
              <Label htmlFor="room" className="block text-xs font-medium text-foreground mb-1">Sala</Label>
              <Select
                value={filters.room}
                onValueChange={(value) => handleFilterChange("room", value)}
              >
                <SelectTrigger id="room" className="w-full h-8 text-xs">
                  <SelectValue placeholder="Todas as salas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as salas</SelectItem>
                  <SelectItem value="1">Sala 01</SelectItem>
                  <SelectItem value="2">Sala 02</SelectItem>
                  <SelectItem value="3">Sala 03</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Quick action buttons */}
          <div className="pb-2 mt-4">
            <Button className="w-full text-xs flex items-center h-8" size="sm">
              <Plus className="h-3 w-3 mr-1" />
              Novo agendamento
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="upcoming" className="flex-1 flex flex-col p-3 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Próximos agendamentos</h2>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 px-2">
                  <span className="text-xs">Hoje</span>
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="p-2 grid grid-cols-1 gap-1">
                  <Button variant="ghost" size="sm" className="justify-start h-7">
                    <span className="text-xs">Hoje</span>
                  </Button>
                  <Button variant="ghost" size="sm" className="justify-start h-7">
                    <span className="text-xs">Amanhã</span>
                  </Button>
                  <Button variant="ghost" size="sm" className="justify-start h-7">
                    <span className="text-xs">Esta semana</span>
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          <ScrollArea className="flex-1 pr-3">
            <UpcomingAppointments />
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="stats" className="flex-1 flex flex-col p-3 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Estatísticas</h2>
            <Badge variant="outline" className="text-xs">Hoje</Badge>
          </div>
          
          <ScrollArea className="flex-1 pr-3">
            <ScheduleStats />
            
            <div className="mt-4">
              <h3 className="text-xs font-medium mb-2">Profissionais</h3>
              <div className="space-y-2">
                <div className="p-2 border rounded-md bg-background">
                  <div className="flex justify-between">
                    <span className="text-xs font-medium">Dr. Ana Silva</span>
                    <span className="text-xs text-muted-foreground">5 agendamentos</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 mt-1.5">
                    <div className="bg-green-500 h-1.5 rounded-full" style={{ width: '50%' }}></div>
                  </div>
                </div>
                <div className="p-2 border rounded-md bg-background">
                  <div className="flex justify-between">
                    <span className="text-xs font-medium">Dr. Carlos Mendes</span>
                    <span className="text-xs text-muted-foreground">4 agendamentos</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 mt-1.5">
                    <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: '80%' }}></div>
                  </div>
                </div>
                <div className="p-2 border rounded-md bg-background">
                  <div className="flex justify-between">
                    <span className="text-xs font-medium">Dr. Juliana Costa</span>
                    <span className="text-xs text-muted-foreground">3 agendamentos</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 mt-1.5">
                    <div className="bg-yellow-500 h-1.5 rounded-full" style={{ width: '40%' }}></div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-4">
              <h3 className="text-xs font-medium mb-2">Procedimentos</h3>
              <div className="space-y-2">
                <div className="p-2 border rounded-md bg-background">
                  <div className="flex justify-between">
                    <span className="text-xs font-medium">Consulta inicial</span>
                    <span className="text-xs text-muted-foreground">3</span>
                  </div>
                </div>
                <div className="p-2 border rounded-md bg-background">
                  <div className="flex justify-between">
                    <span className="text-xs font-medium">Limpeza</span>
                    <span className="text-xs text-muted-foreground">3</span>
                  </div>
                </div>
                <div className="p-2 border rounded-md bg-background">
                  <div className="flex justify-between">
                    <span className="text-xs font-medium">Restauração</span>
                    <span className="text-xs text-muted-foreground">2</span>
                  </div>
                </div>
                <div className="p-2 border rounded-md bg-background">
                  <div className="flex justify-between">
                    <span className="text-xs font-medium">Tratamento de canal</span>
                    <span className="text-xs text-muted-foreground">2</span>
                  </div>
                </div>
                <div className="p-2 border rounded-md bg-background">
                  <div className="flex justify-between">
                    <span className="text-xs font-medium">Extração</span>
                    <span className="text-xs text-muted-foreground">2</span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}