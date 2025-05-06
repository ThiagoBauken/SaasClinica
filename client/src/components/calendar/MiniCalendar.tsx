import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addMonths, subMonths, format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";

type DayInfo = {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  occupationStatus?: 'available' | 'moderate' | 'busy' | 'full';
};

// Mock data for demonstration - in real app, this would come from an API
const mockOccupationData: Record<string, { status: 'available' | 'moderate' | 'busy' | 'full' }> = {
  '2023-08-08': { status: 'moderate' },
  '2023-08-09': { status: 'busy' },
  '2023-08-11': { status: 'full' },
  '2023-08-15': { status: 'moderate' },
  '2023-08-22': { status: 'busy' },
  '2023-08-24': { status: 'full' },
};

export default function MiniCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Calculate days from previous month to fill first week
  const startDay = getDay(monthStart);
  const prevMonthDays: DayInfo[] = [];
  for (let i = startDay - 1; i >= 0; i--) {
    const date = new Date(monthStart);
    date.setDate(monthStart.getDate() - i - 1);
    prevMonthDays.push({
      date,
      isCurrentMonth: false,
      isToday: isToday(date),
    });
  }
  
  // Calculate days from next month to fill last week
  const endDay = getDay(monthEnd);
  const nextMonthDays: DayInfo[] = [];
  if (endDay < 6) {
    for (let i = 1; i <= 6 - endDay; i++) {
      const date = new Date(monthEnd);
      date.setDate(monthEnd.getDate() + i);
      nextMonthDays.push({
        date,
        isCurrentMonth: false,
        isToday: isToday(date),
      });
    }
  }
  
  // Prepare current month days with occupation status
  const currentMonthDays: DayInfo[] = daysInMonth.map(date => {
    const dateString = format(date, 'yyyy-MM-dd');
    return {
      date,
      isCurrentMonth: true,
      isToday: isToday(date),
      occupationStatus: mockOccupationData[dateString]?.status,
    };
  });
  
  // Combine all days
  const allDays = [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];

  const prevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const nextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const selectDate = (date: Date) => {
    setSelectedDate(date);
    // Here you would typically trigger data loading for the selected date
  };

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium">{format(currentDate, 'MMMM yyyy', { locale: ptBR })}</span>
        <div className="flex">
          <Button 
            variant="ghost" 
            size="icon" 
            className="p-1 text-neutral-medium hover:text-primary"
            onClick={prevMonth}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="p-1 text-neutral-medium hover:text-primary"
            onClick={nextMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Days of week */}
      <div className="grid grid-cols-7 text-center text-xs text-neutral-medium mb-1">
        <div>D</div>
        <div>S</div>
        <div>T</div>
        <div>Q</div>
        <div>Q</div>
        <div>S</div>
        <div>S</div>
      </div>
      
      {/* Calendar days */}
      <div className="grid grid-cols-7 gap-1 text-sm">
        {allDays.map((day, idx) => (
          <div 
            key={idx}
            className={cn(
              "mini-calendar-day text-center", 
              day.isCurrentMonth ? "text-neutral-dark" : "text-neutral-medium",
              day.isToday && "font-bold",
              format(day.date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd') && "active bg-primary text-white"
            )}
            onClick={() => day.isCurrentMonth && selectDate(day.date)}
          >
            {format(day.date, 'd')}
            {day.occupationStatus && (
              <span 
                className={cn(
                  "absolute bottom-0 right-0 w-2 h-2 rounded-full",
                  day.occupationStatus === 'moderate' && "bg-status-moderate",
                  day.occupationStatus === 'busy' && "bg-status-busy",
                  day.occupationStatus === 'full' && "bg-status-full"
                )}
              ></span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
