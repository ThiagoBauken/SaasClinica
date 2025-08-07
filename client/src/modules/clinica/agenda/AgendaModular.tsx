import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, subDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import CalendarHeader from '@/components/calendar/CalendarHeader';
import MonthAgendaView from '@/components/calendar/MonthAgendaView';

export function AgendaModular() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<'day' | 'week' | 'month' | 'room'>('month');

  return (
    <div className="flex flex-col h-full">
      {/* Header da agenda modular */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Agenda Modular
            </h1>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(subDays(currentDate, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
              >
                Hoje
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(addDays(currentDate, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-lg font-medium">
                {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex bg-muted rounded-lg p-1">
              {(['day', 'week', 'month', 'room'] as const).map((view) => (
                <Button
                  key={view}
                  variant={viewType === view ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewType(view)}
                  className="text-xs"
                >
                  {view === 'day' && 'Dia'}
                  {view === 'week' && 'Semana'}
                  {view === 'month' && 'Mês'}
                  {view === 'room' && 'Salas'}
                </Button>
              ))}
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Consulta
            </Button>
          </div>
        </div>
      </div>

      {/* Conteúdo principal da agenda */}
      <div className="flex-1 p-4">
        {viewType === 'month' && (
          <MonthAgendaView 
            appointments={[]}
            onDateSelect={setCurrentDate}
            onAppointmentClick={() => {}}
          />
        )}
        
        {viewType === 'day' && (
          <div className="bg-white rounded-lg border">
            <div className="p-4 border-b">
              <h3 className="font-medium">
                {format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </h3>
            </div>
            <div className="p-4">
              <p className="text-muted-foreground">Vista diária em desenvolvimento...</p>
            </div>
          </div>
        )}
        
        {viewType === 'week' && (
          <div className="bg-white rounded-lg border">
            <div className="p-4 border-b">
              <h3 className="font-medium">Semana</h3>
            </div>
            <div className="p-4">
              <p className="text-muted-foreground">Vista semanal em desenvolvimento...</p>
            </div>
          </div>
        )}
        
        {viewType === 'room' && (
          <div className="bg-white rounded-lg border">
            <div className="p-4 border-b">
              <h3 className="font-medium">Salas</h3>
            </div>
            <div className="p-4">
              <p className="text-muted-foreground">Vista por salas em desenvolvimento...</p>
            </div>
          </div>
        )}
      </div>

      {/* Rodapé com informações */}
      <div className="border-t bg-muted/30 p-3">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>🚀 Agenda Modular - Conectando com sistema existente</span>
          <span>Use o toggle ⚙️ para comparar com a versão atual</span>
        </div>
      </div>
    </div>
  );
}

export default AgendaModular;