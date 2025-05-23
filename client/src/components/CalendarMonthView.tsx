import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Tipo para um compromisso/agendamento
interface Appointment {
  id: number;
  date: Date;
  patientName: string;
  professionalName: string;
  procedure: string;
  status: string;
}

// Propriedades do componente
interface CalendarMonthViewProps {
  appointments?: Appointment[];
  onDateSelect?: (date: Date) => void;
  onAddAppointment?: () => void;
}

export default function CalendarMonthView({
  appointments = [],
  onDateSelect,
  onAddAppointment,
}: CalendarMonthViewProps) {
  // Estado para a data atual sendo visualizada
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<"dia" | "semana" | "mes" | "dentistas">("mes");
  
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
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  
  // Selecionar todos os profissionais
  const handleSelectAll = () => {
    // Lógica para selecionar todos os profissionais
    console.log("Selecionar todos os profissionais");
  };

  return (
    <div className="calendar-container">
      {/* Controles do calendário */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-xl font-bold">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </h2>
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm">
              Mês
            </Button>
            <Button variant="outline" size="sm">
              Retornos
            </Button>
          </div>
        </div>
        
        {/* Vista do mês */}
        <div className="grid grid-cols-7 gap-1">
          {/* Cabeçalho com dias da semana */}
          {weekDays.map((day, i) => (
            <div key={i} className="text-center py-2 font-medium text-sm text-muted-foreground">
              {day}
            </div>
          ))}
          
          {/* Células de dias do mês */}
          {Array(monthStart.getDay())
            .fill(null)
            .map((_, i) => (
              <div key={`empty-${i}`} className="h-24 border border-muted p-1"></div>
            ))}
          
          {monthDays.map((day, i) => {
            const isCurrentDay = isToday(day);
            const hasAppointments = appointments.some(
              (appt) => format(appt.date, "yyyy-MM-dd") === format(day, "yyyy-MM-dd")
            );
            
            return (
              <div
                key={i}
                className={`h-24 border border-muted p-1 relative hover:bg-gray-50 transition-colors cursor-pointer ${
                  isCurrentDay ? "bg-blue-50 border-blue-200" : ""
                }`}
                onClick={() => onDateSelect && onDateSelect(day)}
              >
                <div className="flex justify-between items-start">
                  <span className={`text-sm font-medium ${isCurrentDay ? "text-blue-600" : ""}`}>
                    {format(day, "d")}
                  </span>
                  
                  {hasAppointments && (
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  )}
                </div>
                
                {/* Aqui poderia mostrar miniaturas de agendamentos */}
                {appointments
                  .filter((appt) => format(appt.date, "yyyy-MM-dd") === format(day, "yyyy-MM-dd"))
                  .slice(0, 2)
                  .map((appt) => (
                    <div key={appt.id} className="text-xs p-1 mt-1 bg-blue-100 rounded truncate">
                      {appt.patientName}
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Painel lateral de configurações */}
      <Card className="w-64 p-4 fixed right-4 top-24 shadow-md">
        <div className="space-y-4">
          <h3 className="font-medium">Visualização</h3>
          
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
      </Card>
    </div>
  );
}