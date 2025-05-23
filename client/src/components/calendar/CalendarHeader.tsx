import { ProfessionalSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight, ChevronsDown, Calendar as CalendarIcon, Settings } from "lucide-react";
import { format, addDays, subDays, addWeeks, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import LoadIndicator from "./LoadIndicator";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarViewType } from "@/lib/types";

interface CalendarHeaderProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onNewAppointment: (isFitIn?: boolean) => void;
  currentView: CalendarViewType;
  onViewChange: (view: CalendarViewType) => void;
  professionalsSummary: ProfessionalSummary[];
  timeInterval?: 15 | 20 | 30 | 60;
  onTimeIntervalChange?: (interval: 15 | 20 | 30 | 60) => void;
  selectedProfessional?: string;
  onProfessionalChange?: (professionalId: string) => void;
  selectedRoom?: string;
  onRoomChange?: (roomId: string) => void;
}

export default function CalendarHeader({
  selectedDate,
  onDateChange,
  onNewAppointment,
  currentView,
  onViewChange,
  professionalsSummary,
  timeInterval = 30,
  onTimeIntervalChange,
  selectedProfessional = "all",
  onProfessionalChange
}: CalendarHeaderProps) {
  const [selectedRoom, setSelectedRoom] = useState<string>("all");

  const handleProfessionalChange = (value: string) => {
    if (onProfessionalChange) {
      onProfessionalChange(value);
    }
  };

  const handlePreviousDay = () => {
    if (currentView === 'week') {
      onDateChange(subWeeks(selectedDate, 1));
    } else {
      onDateChange(subDays(selectedDate, 1));
    }
  };

  const handleNextDay = () => {
    if (currentView === 'week') {
      onDateChange(addWeeks(selectedDate, 1));
    } else {
      onDateChange(addDays(selectedDate, 1));
    }
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  const handleFitIn = () => {
    onNewAppointment(true); // Passamos true para indicar que é um encaixe
  };

  const getViewDisplayName = (view: CalendarViewType): string => {
    switch (view) {
      case 'day': return 'Dia';
      case 'week': return 'Semana';
      case 'month': return 'Mês';
      case 'room': return 'Cadeira/Sala';
      case 'timeline': return 'Timeline';
      default: return 'Timeline';
    }
  };

  return (
    <div className="mb-6">
      <div className="flex flex-wrap md:flex-nowrap items-center gap-3 mb-4">
        {/* Primeira linha - Seletores */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Select value={selectedProfessional} onValueChange={handleProfessionalChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos os profissionais" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os profissionais</SelectItem>
              {professionalsSummary.map(prof => (
                <SelectItem key={prof.id} value={prof.id.toString()}>
                  {prof.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedRoom} onValueChange={setSelectedRoom}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas as cadeiras" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as cadeiras</SelectItem>
              <SelectItem value="1">Cadeira 01</SelectItem>
              <SelectItem value="2">Cadeira 02</SelectItem>
              <SelectItem value="3">Cadeira 03</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            className="ml-auto md:ml-0"
            onClick={handleToday}
          >
            HOJE
          </Button>
        </div>

        {/* Segunda linha - Navegação e Ações */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Navegação */}
          <div className="flex">
            <Button
              variant="ghost"
              className="px-3 py-2"
              onClick={handlePreviousDay}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              className="px-3 py-2"
              onClick={handleNextDay}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Data selecionada */}
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">
              {currentView === 'week' 
                ? `Semana de ${format(selectedDate, "d MMM", { locale: ptBR })}`
                : format(selectedDate, "EEE dd/MM/yyyy", { locale: ptBR })}
            </p>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </div>

          {/* Visualização */}
          <div className="flex gap-2">
            <Select 
              value={currentView} 
              onValueChange={(value) => onViewChange(value as CalendarViewType)}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Visualização" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Dia</SelectItem>
                <SelectItem value="week">Semana</SelectItem>
                <SelectItem value="month">Mês</SelectItem>
                <SelectItem value="room">Cadeira/Sala</SelectItem>
                <SelectItem value="timeline">Timeline</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Seletor de intervalo de tempo */}
            <Select 
              value={timeInterval.toString()} 
              onValueChange={(value) => onTimeIntervalChange && onTimeIntervalChange(parseInt(value) as 15 | 20 | 30 | 60)}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Intervalo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutos</SelectItem>
                <SelectItem value="20">20 minutos</SelectItem>
                <SelectItem value="30">30 minutos</SelectItem>
                <SelectItem value="60">60 minutos</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Botão de Configurações Gerais */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => window.location.href = '/settings/schedule'}
              title="Configurações da Agenda"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>

          {/* Ações */}
          <Button 
            variant="default" 
            className="shadow-sm"
            onClick={() => onNewAppointment(false)}
          >
            <Plus className="h-5 w-5 mr-1" />
            Novo
          </Button>
          
          <Button
            variant="outline"
            className="shadow-sm"
            onClick={handleFitIn}
          >
            Encaixe
          </Button>
        </div>
      </div>
      {/* Removido o display de estatísticas dos dentistas conforme solicitado */}
    </div>
  );
}
