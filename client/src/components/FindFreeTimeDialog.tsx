import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface TimeSlot {
  start: string;
  end: string;
}

// Dados de exemplo para os horários disponíveis
const morningSlots: TimeSlot[] = [
  { start: "07:00", end: "07:30" },
  { start: "07:30", end: "08:00" },
  { start: "08:00", end: "08:30" },
  { start: "08:30", end: "09:00" },
  { start: "09:00", end: "09:30" },
  { start: "09:30", end: "10:00" },
  { start: "10:00", end: "10:30" },
  { start: "10:30", end: "11:00" },
  { start: "11:00", end: "11:30" },
  { start: "11:30", end: "12:00" },
];

const afternoonSlots: TimeSlot[] = [
  { start: "13:30", end: "14:00" },
  { start: "14:00", end: "14:30" },
  { start: "14:30", end: "15:00" },
  { start: "15:00", end: "15:30" },
  { start: "15:30", end: "16:00" },
  { start: "16:00", end: "16:30" },
  { start: "16:30", end: "17:00" },
  { start: "17:00", end: "17:30" },
  { start: "17:30", end: "18:00" },
  { start: "18:30", end: "19:00" },
  { start: "19:00", end: "19:30" },
  { start: "19:30", end: "20:00" },
  { start: "20:00", end: "20:30" },
  { start: "20:30", end: "21:00" },
  { start: "21:00", end: "21:30" },
  { start: "21:30", end: "22:00" },
];

interface FindFreeTimeDialogProps {
  selectedDate?: Date;
  onSelectTimeSlot?: (date: Date, startTime: string, endTime: string) => void;
}

export default function FindFreeTimeDialog({ selectedDate = new Date(), onSelectTimeSlot }: FindFreeTimeDialogProps) {
  const [open, setOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(selectedDate);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  
  // Navegar para o próximo dia
  const nextDay = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    setCurrentDate(next);
  };
  
  // Navegar para o dia anterior
  const prevDay = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 1);
    setCurrentDate(prev);
  };
  
  // Selecionar um horário
  const handleSelectTimeSlot = (slot: TimeSlot) => {
    setSelectedTimeSlot(slot);
  };
  
  // Confirmar seleção de horário
  const handleConfirmSelection = () => {
    if (selectedTimeSlot && onSelectTimeSlot) {
      onSelectTimeSlot(currentDate, selectedTimeSlot.start, selectedTimeSlot.end);
      setOpen(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="bg-white border-blue-500 text-blue-500 hover:bg-blue-50">
          Encontrar horário livre
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Sugestão de horários</DialogTitle>
          <DialogDescription>
            "Alexa, qual próximo horário livre na minha agenda?" <a href="#" className="text-blue-500">Veja como configurar</a>
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="flex items-center justify-center space-x-4 mb-6">
            <Button variant="ghost" size="icon" onClick={prevDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-md font-medium">
              {format(currentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </span>
            <Button variant="ghost" size="icon" onClick={nextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            {/* Manhã */}
            <div className="border rounded-md p-4">
              <h3 className="font-medium mb-4">Manhã</h3>
              <div className="grid grid-cols-2 gap-4">
                {morningSlots.map((slot, i) => (
                  <div key={i} className="flex items-center space-x-2">
                    <RadioGroup
                      value={selectedTimeSlot === slot ? "selected" : ""}
                      onValueChange={() => handleSelectTimeSlot(slot)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="selected" id={`morning-${i}`} />
                        <Label htmlFor={`morning-${i}`} className="cursor-pointer">
                          {slot.start} às {slot.end}
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Tarde */}
            <div className="border rounded-md p-4">
              <h3 className="font-medium mb-4">Tarde</h3>
              <div className="grid grid-cols-2 gap-4">
                {afternoonSlots.map((slot, i) => (
                  <div key={i} className="flex items-center space-x-2">
                    <RadioGroup
                      value={selectedTimeSlot === slot ? "selected" : ""}
                      onValueChange={() => handleSelectTimeSlot(slot)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="selected" id={`afternoon-${i}`} />
                        <Label htmlFor={`afternoon-${i}`} className="cursor-pointer">
                          {slot.start} às {slot.end}
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Fechar
          </Button>
          <Button 
            onClick={handleConfirmSelection}
            disabled={!selectedTimeSlot}
            className="bg-green-500 hover:bg-green-600"
          >
            Escolher Data
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}