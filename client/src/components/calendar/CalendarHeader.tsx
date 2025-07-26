import { ProfessionalSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight, ChevronsDown, Calendar as CalendarIcon, Settings } from "lucide-react";
import { format, addDays, subDays, addWeeks, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import LoadIndicator from "./LoadIndicator";
import { useState } from "react";
import GoogleCalendarSync from "./GoogleCalendarSync";
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
  onProfessionalChange,
  selectedRoom = "all",
  onRoomChange
}: CalendarHeaderProps) {

  const handleProfessionalChange = (value: string) => {
    if (onProfessionalChange) {
      onProfessionalChange(value);
    }
  };

  const handleRoomChange = (value: string) => {
    if (onRoomChange) {
      onRoomChange(value);
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
      default: return 'Dia';
    }
  };

  return (
    <div className="mb-6">
      <div className="flex flex-col gap-4 mb-4">
        {/* Primeira linha - Seletores */}
        <div className="flex flex-wrap items-center gap-2 w-full">
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Select value={selectedProfessional} onValueChange={handleProfessionalChange}>
              <SelectTrigger className="w-full sm:w-[200px]">
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

            <Select value={selectedRoom} onValueChange={handleRoomChange}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Todas as cadeiras" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as cadeiras</SelectItem>
                <SelectItem value="1">Sala 01</SelectItem>
                <SelectItem value="2">Sala 02</SelectItem>
                <SelectItem value="3">Sala 03</SelectItem>
                <SelectItem value="4">Consultório A</SelectItem>
                <SelectItem value="5">Consultório B</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            className="ml-auto bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200"
            onClick={handleToday}
          >
            Hoje
          </Button>
        </div>

        {/* Segunda linha - Navegação e Ações */}
        <div className="flex flex-col sm:flex-row items-center gap-y-3 gap-x-2 w-full">
          {/* Navegação e Data selecionada */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
            <div className="flex">
              <Button
                variant="ghost"
                className="px-2 sm:px-3 py-2"
                onClick={handlePreviousDay}
              >
                <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              
              <p className="flex items-center text-xs sm:text-sm font-medium px-1">
                {currentView === 'week' 
                  ? `Semana de ${format(selectedDate, "d MMM", { locale: ptBR })}`
                  : format(selectedDate, "EEE dd/MM/yy", { locale: ptBR })}
              </p>
              
              <Button
                variant="ghost"
                className="px-2 sm:px-3 py-2"
                onClick={handleNextDay}
              >
                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </div>
          </div>
          
          {/* Visualização e controles */}
          <div className="flex flex-wrap gap-2 justify-center sm:justify-start w-full sm:w-auto">
            <Select 
              value={currentView} 
              onValueChange={(value) => onViewChange(value as CalendarViewType)}
            >
              <SelectTrigger className="w-[110px] text-xs sm:text-sm">
                <SelectValue placeholder="Visualização" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Dia</SelectItem>
                <SelectItem value="week">Semana</SelectItem>
                <SelectItem value="month">Mês</SelectItem>
                <SelectItem value="room">Cadeira/Sala</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Seletor de intervalo de tempo */}
            <Select 
              value={timeInterval.toString()} 
              onValueChange={(value) => onTimeIntervalChange && onTimeIntervalChange(parseInt(value) as 15 | 20 | 30 | 60)}
            >
              <SelectTrigger className="w-[110px] text-xs sm:text-sm">
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
              className="h-8 w-8 sm:h-10 sm:w-10"
            >
              <Settings className="h-4 w-4" />
            </Button>
            
            {/* Google Calendar Sync - Mostrado apenas quando um profissional específico está selecionado */}
            {selectedProfessional !== "all" && (
              <GoogleCalendarSync 
                professionalId={parseInt(selectedProfessional)} 
                professionalName={professionalsSummary.find(p => p.id.toString() === selectedProfessional)?.fullName || "Profissional"} 
                isConnected={false} 
                onSyncComplete={() => {}} 
              />
            )}
          </div>

          {/* Ações */}
          <div className="flex gap-2 w-full sm:w-auto justify-center sm:justify-start mt-3 sm:mt-0 sm:ml-auto">
            <Button 
              variant="default" 
              className="shadow-sm"
              onClick={() => onNewAppointment(false)}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Novo
            </Button>
            
            <Button
              variant="outline"
              className="shadow-sm bg-orange-50 text-orange-600 hover:bg-orange-100 border-orange-200"
              onClick={handleFitIn}
              size="sm"
            >
              Encaixe
            </Button>
          </div>
        </div>
      </div>
      {/* Removido o display de estatísticas dos dentistas conforme solicitado */}
    </div>
  );
}
