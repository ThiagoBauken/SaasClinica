import { ProfessionalSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight, ChevronsDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import LoadIndicator from "./LoadIndicator";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalendarViewType } from "@/lib/types";

interface CalendarHeaderProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onNewAppointment: () => void;
  currentView: CalendarViewType;
  onViewChange: (view: CalendarViewType) => void;
  professionalsSummary: ProfessionalSummary[];
}

export default function CalendarHeader({
  selectedDate,
  onDateChange,
  onNewAppointment,
  currentView,
  onViewChange,
  professionalsSummary
}: CalendarHeaderProps) {
  const handlePreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() - 1);
    onDateChange(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + 1);
    onDateChange(newDate);
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  const getViewDisplayName = (view: CalendarViewType): string => {
    switch (view) {
      case 'day': return 'Dia';
      case 'week': return 'Semana';
      case 'month': return 'Mês';
      case 'timeline': return 'Timeline';
      default: return 'Timeline';
    }
  };

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold">Agenda</h1>
          <p className="text-muted-foreground">{format(selectedDate, "d 'de' MMMM, yyyy", { locale: ptBR })}</p>
        </div>
        
        <div className="flex space-x-2">
          <Button 
            variant="default" 
            className="shadow-sm"
            onClick={onNewAppointment}
          >
            <Plus className="h-5 w-5 mr-1" />
            Novo Agendamento
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="shadow-sm">
                {getViewDisplayName(currentView)}
                <ChevronsDown className="h-5 w-5 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onViewChange('day')}>
                Dia
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewChange('week')}>
                Semana
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewChange('month')}>
                Mês
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewChange('timeline')}>
                Timeline
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <div className="flex border rounded-md overflow-hidden shadow-sm">
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
          
          <Button
            variant="outline"
            className="shadow-sm"
            onClick={handleToday}
          >
            Hoje
          </Button>
        </div>
      </div>
      
      {/* Load indicators summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {professionalsSummary.map((prof) => (
          <div key={prof.id} className="bg-card p-4 rounded-lg shadow-sm border">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-full overflow-hidden mr-3">
                  {prof.profileImageUrl ? (
                    <img 
                      src={prof.profileImageUrl} 
                      alt={prof.fullName} 
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-primary text-primary-foreground flex items-center justify-center">
                      {prof.fullName.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{prof.fullName}</h3>
                  <p className="text-xs text-muted-foreground">
                    {prof.speciality || "Dentista"} 
                    {prof.roomName && ` - ${prof.roomName}`}
                  </p>
                </div>
              </div>
              <div 
                className={`text-sm font-semibold px-2 py-1 rounded
                  ${prof.status === 'available' ? 'bg-status-available bg-opacity-20 text-status-available' : ''}
                  ${prof.status === 'moderate' ? 'bg-status-moderate bg-opacity-20 text-status-moderate' : ''}
                  ${prof.status === 'busy' ? 'bg-status-busy bg-opacity-20 text-status-busy' : ''}
                  ${prof.status === 'full' ? 'bg-status-full bg-opacity-20 text-status-full' : ''}
                `}
              >
                {prof.load}%
              </div>
            </div>
            <LoadIndicator status={prof.status} percentage={prof.load} />
          </div>
        ))}
      </div>
    </div>
  );
}
