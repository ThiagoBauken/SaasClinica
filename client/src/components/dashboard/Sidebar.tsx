import { useState } from "react";
import { Link } from "wouter";
import MiniCalendar from "@/components/calendar/MiniCalendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, LayoutDashboard, Calendar, Users, DollarSign, Bot } from "lucide-react";

interface SidebarProps {
  currentPath: string;
}

export default function Sidebar({ currentPath }: SidebarProps) {
  const [filters, setFilters] = useState({
    status: "all",
    professional: "all",
    patient: "",
    procedure: "all",
    room: "all",
  });

  const handleFilterChange = (field: keyof typeof filters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      status: "all",
      professional: "all",
      patient: "",
      procedure: "all",
      room: "all",
    });
  };

  // Menu de navegação com links
  const navigationMenu = (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-neutral-dark mb-4 px-4">Menu</h2>
      <nav className="space-y-1">
        <Link href="/dashboard" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/dashboard" ? "bg-primary-light text-primary" : "text-neutral-dark hover:bg-neutral-lightest"}`}>
          <LayoutDashboard className="mr-3 h-5 w-5" />
          Dashboard
        </Link>
        <Link href="/schedule" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/schedule" ? "bg-primary-light text-primary" : "text-neutral-dark hover:bg-neutral-lightest"}`}>
          <Calendar className="mr-3 h-5 w-5" />
          Agenda
        </Link>
        <Link href="/patients" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/patients" ? "bg-primary-light text-primary" : "text-neutral-dark hover:bg-neutral-lightest"}`}>
          <Users className="mr-3 h-5 w-5" />
          Pacientes
        </Link>
        <Link href="/financial" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/financial" ? "bg-primary-light text-primary" : "text-neutral-dark hover:bg-neutral-lightest"}`}>
          <DollarSign className="mr-3 h-5 w-5" />
          Financeiro
        </Link>
        <Link href="/automation" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/automation" ? "bg-primary-light text-primary" : "text-neutral-dark hover:bg-neutral-lightest"}`}>
          <Bot className="mr-3 h-5 w-5" />
          Automações
        </Link>
      </nav>
    </div>
  );

  // Conteúdo do calendário (mostrado apenas na página de agenda)
  const calendarContent = currentPath === "/schedule" && (
    <>
      <div className="mb-6 px-4">
        <h2 className="text-lg font-semibold text-neutral-dark mb-2">Calendário</h2>
        
        {/* Mini Calendar Component */}
        <MiniCalendar />
        
        {/* Status indicators */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-neutral-dark mb-2">Indicadores de Ocupação</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-status-available mr-2"></div>
              <span>Disponível</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-status-moderate mr-2"></div>
              <span>Moderado</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-status-busy mr-2"></div>
              <span>Ocupado</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-status-full mr-2"></div>
              <span>Lotado</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Filters - apenas na página de agenda */}
      <div className="px-4">
        <h2 className="text-lg font-semibold text-neutral-dark mb-2">Filtros</h2>
        
        <div className="space-y-4">
          {/* Status filter */}
          <div>
            <Label htmlFor="status" className="block text-sm font-medium text-neutral-dark mb-1">Status</Label>
            <Select
              value={filters.status}
              onValueChange={(value) => handleFilterChange("status", value)}
            >
              <SelectTrigger id="status" className="w-full">
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
            <Label htmlFor="professional" className="block text-sm font-medium text-neutral-dark mb-1">Profissional</Label>
            <Select
              value={filters.professional}
              onValueChange={(value) => handleFilterChange("professional", value)}
            >
              <SelectTrigger id="professional" className="w-full">
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
            <Label htmlFor="patient" className="block text-sm font-medium text-neutral-dark mb-1">Paciente</Label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-neutral-medium" />
              <Input
                id="patient"
                placeholder="Buscar paciente"
                className="pl-9"
                value={filters.patient}
                onChange={(e) => handleFilterChange("patient", e.target.value)}
              />
            </div>
          </div>
          
          {/* Procedure filter */}
          <div>
            <Label htmlFor="procedure" className="block text-sm font-medium text-neutral-dark mb-1">Procedimento</Label>
            <Select
              value={filters.procedure}
              onValueChange={(value) => handleFilterChange("procedure", value)}
            >
              <SelectTrigger id="procedure" className="w-full">
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
            <Label htmlFor="room" className="block text-sm font-medium text-neutral-dark mb-1">Sala</Label>
            <Select
              value={filters.room}
              onValueChange={(value) => handleFilterChange("room", value)}
            >
              <SelectTrigger id="room" className="w-full">
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
          
          {/* Clear filters button */}
          <Button
            variant="outline"
            className="w-full"
            onClick={clearFilters}
          >
            Limpar filtros
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <aside className="w-64 bg-white border-r border-neutral-light h-full overflow-y-auto hidden md:block">
      <div className="py-6">
        {navigationMenu}
        {calendarContent}
      </div>
    </aside>
  );
}
