import { useState, useEffect } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  getDay,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameDay
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, ChevronRight, Plus, HelpCircle } from "lucide-react";

// Tipo para um compromisso/agendamento
interface Appointment {
  id: number;
  date: Date;
  patientName: string;
  professionalName: string;
  procedure: string;
  status: string;
  startTime?: string;
  endTime?: string;
  color?: string;
}

// Propriedades do componente
interface CalendarMonthViewProps {
  appointments?: Appointment[];
  onDateSelect?: (date: Date) => void;
  onAddAppointment?: () => void;
  selectedDate?: Date;
}

export default function CalendarMonthView({
  appointments = [],
  onDateSelect,
  onAddAppointment,
  selectedDate: externalSelectedDate,
}: CalendarMonthViewProps) {
  // Estado para a data atual sendo visualizada
  const [currentMonth, setCurrentMonth] = useState(externalSelectedDate || new Date());
  const [viewMode, setViewMode] = useState<"dia" | "semana" | "mes" | "dentistas">("mes");
  const [selectedDate, setSelectedDate] = useState(externalSelectedDate || new Date());

  // Sincronizar com a data externa quando ela mudar
  useEffect(() => {
    if (externalSelectedDate) {
      setCurrentMonth(externalSelectedDate);
      setSelectedDate(externalSelectedDate);
    }
  }, [externalSelectedDate]);
  
  // Estado para controlar as opções de visualização
  const [showBirthdays, setShowBirthdays] = useState(true);
  const [showHolidays, setShowHolidays] = useState(true);
  const [showWeekends, setShowWeekends] = useState(true);
  
  // Horário de trabalho
  const [workStartTime, setWorkStartTime] = useState("08:00");
  const [workEndTime, setWorkEndTime] = useState("18:00");

  // Função para avançar para o próximo mês
  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  // Função para voltar para o mês anterior
  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  // Obter dias do mês atual
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Obter dias da semana
  const weekDays = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  
  // Determinar o início e fim da grade do calendário
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Calcular o número de semanas no mês para mostrar o layout correto
  const weekRows = Math.ceil(calendarDays.length / 7);
  
  // Selecionar todos os profissionais
  const handleSelectAll = () => {
    console.log("Selecionar todos os profissionais");
  };

  // Verificar se um dia tem agendamentos
  const getDayAppointments = (day: Date) => {
    return appointments.filter(appt => 
      isSameDay(new Date(appt.date), day)
    );
  };

  // Quando uma data é selecionada
  const handleDateClick = (day: Date) => {
    setSelectedDate(day);
    if (onDateSelect) {
      onDateSelect(day);
    }
  };

  // Criar o pequeno calendário do mês para a barra lateral
  const renderMiniCalendar = () => {
    // Obter os dias da semana e os dias do mês atual
    const miniMonthStart = startOfMonth(currentMonth);
    const miniMonthEnd = endOfMonth(currentMonth);
    const miniMonthDays = eachDayOfInterval({ start: miniMonthStart, end: miniMonthEnd });
    
    // Obter as semanas para o mini calendário
    const miniCalendarStart = startOfWeek(miniMonthStart, { locale: ptBR });
    const miniCalendarEnd = endOfWeek(miniMonthEnd, { locale: ptBR });
    const miniCalendarDays = eachDayOfInterval({ start: miniCalendarStart, end: miniCalendarEnd });

    const weeks: Date[][] = [];
    let week: Date[] = [];

    miniCalendarDays.forEach((day, i) => {
      if (i % 7 === 0 && i !== 0) {
        weeks.push(week);
        week = [];
      }

      week.push(day);

      if (i === miniCalendarDays.length - 1) {
        weeks.push(week);
      }
    });
    
    return (
      <div className="mini-calendar mb-4">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center">
            <ChevronLeft 
              className="h-4 w-4 cursor-pointer hover:text-blue-600" 
              onClick={prevMonth}
            />
            <span className="text-sm font-medium mx-2">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </span>
            <ChevronRight 
              className="h-4 w-4 cursor-pointer hover:text-blue-600" 
              onClick={nextMonth}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-7 text-center mb-1">
          {weekDays.map((day, index) => (
            <div key={index} className="text-xs text-muted-foreground capitalize">
              {day}
            </div>
          ))}
        </div>
        
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 mb-1">
            {week.map((day, dayIndex) => {
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isCurrentDay = isToday(day);
              const isSelected = isSameDay(day, selectedDate);
              
              return (
                <div
                  key={dayIndex}
                  className={`
                    text-xs text-center py-1 cursor-pointer
                    ${!isCurrentMonth ? "text-muted-foreground/40" : ""}
                    ${isCurrentDay ? "bg-blue-500/20 rounded" : ""}
                    ${isSelected ? "bg-blue-500 text-white rounded" : ""}
                  `}
                  onClick={() => handleDateClick(day)}
                >
                  {format(day, "d")}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="calendar-container">
      {/* Layout principal com barra lateral e calendário */}
      <div className="flex gap-4">
        {/* Barra lateral */}
        <div className="w-64 hidden md:block">
          {/* Mini calendário */}
          {renderMiniCalendar()}
          
          {/* Opções de visualização */}
          <div className="space-y-4 p-4 border rounded-md">
            <RadioGroup defaultValue="mes" onValueChange={(val) => setViewMode(val as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dia" id="dia" />
                <Label htmlFor="dia">Dia</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="semana" id="semana" />
                <Label htmlFor="semana">Semana</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mes" id="mes" />
                <Label htmlFor="mes">Mês</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dentistas" id="dentistas" />
                <Label htmlFor="dentistas">Dentistas</Label>
              </div>
            </RadioGroup>
            
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Horário de trabalho</h4>
              <div className="flex items-center space-x-2">
                <Input 
                  type="time" 
                  value={workStartTime} 
                  onChange={(e) => setWorkStartTime(e.target.value)} 
                  className="w-24" 
                />
                <span>até</span>
                <Input 
                  type="time" 
                  value={workEndTime} 
                  onChange={(e) => setWorkEndTime(e.target.value)} 
                  className="w-24" 
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-birthdays">Aniversários</Label>
                <Switch 
                  id="show-birthdays" 
                  checked={showBirthdays} 
                  onCheckedChange={setShowBirthdays} 
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="show-holidays">Feriados</Label>
                <Switch 
                  id="show-holidays" 
                  checked={showHolidays} 
                  onCheckedChange={setShowHolidays} 
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="show-weekends">Finais de semana</Label>
                <Switch 
                  id="show-weekends" 
                  checked={showWeekends} 
                  onCheckedChange={setShowWeekends} 
                />
              </div>
            </div>
            
            <div className="mt-4">
              <Button variant="outline" className="w-full" onClick={handleSelectAll}>
                Selecionar todos
              </Button>
            </div>
          </div>
        </div>
        
        {/* Calendário principal */}
        <div className="flex-grow">
          {/* Cabeçalho do calendário */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={prevMonth}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-xl font-bold">
                {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </h2>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={nextMonth}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            

          </div>
          
          {/* Dias da semana */}
          <div className="grid grid-cols-7 text-sm font-medium border-b border-l">
            {weekDays.map((day, i) => {
              const isWeekend = i === 0 || i === 6;
              return (
                <div
                  key={i}
                  className={`py-2 px-3 text-center border-r uppercase ${
                    isWeekend ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'
                  }`}
                >
                  {day}
                </div>
              );
            })}
          </div>
          
          {/* Grade do calendário */}
          <div className="grid grid-cols-7 bg-card">
            {Array.from({ length: weekRows * 7 }).map((_, index) => {
              const dayIndex = index % 7;
              const weekIndex = Math.floor(index / 7);
              const day = addDays(calendarStart, index);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isCurrentDay = isToday(day);
              const isWeekend = dayIndex === 0 || dayIndex === 6;
              const dayAppointments = getDayAppointments(day);
              const hasAppointments = dayAppointments.length > 0;

              return (
                <div
                  key={index}
                  className={`
                    min-h-[120px] p-2 border-r border-b relative
                    ${!isCurrentMonth ? 'bg-muted/50 text-muted-foreground' : ''}
                    ${isCurrentDay ? 'bg-blue-500/10' : ''}
                    ${isWeekend && !showWeekends ? 'bg-muted' : ''}
                  `}
                  onClick={() => handleDateClick(day)}
                >
                  {/* Dia do mês */}
                  <div className="text-right">
                    <span className={`
                      inline-block rounded-full w-6 h-6 text-center leading-6 text-sm
                      ${isCurrentDay ? 'bg-blue-500 text-white' : ''}
                    `}>
                      {format(day, "d")}
                    </span>
                  </div>
                  
                  {/* Feriados e dias especiais */}
                  {isCurrentMonth && dayIndex === 4 && weekIndex === 0 && showHolidays && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Dia do Trabalho
                    </div>
                  )}
                  
                  {/* Agendamentos */}
                  <div className="mt-1 space-y-1">
                    {hasAppointments && dayAppointments.slice(0, 2).map((appt, i) => (
                      <div
                        key={i}
                        className="text-xs p-1 bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded truncate"
                        title={`${appt.patientName} - ${appt.procedure}`}
                      >
                        {appt.startTime && `${appt.startTime} `}
                        {appt.patientName}
                      </div>
                    ))}
                    
                    {dayAppointments.length > 2 && (
                      <div className="text-xs text-blue-600">
                        + {dayAppointments.length - 2} mais
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Botão de ajuda flutuante */}
      <div className="fixed bottom-4 left-4 flex flex-col items-start space-y-2">
        <Button
          className="rounded-full bg-blue-600 text-white p-2 h-10 w-10"
          onClick={() => console.log("Ajuda")}
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
        <div className="text-xs text-blue-700 dark:text-blue-400 w-24">
          Precisa de ajuda?
        </div>
      </div>
    </div>
  );
}