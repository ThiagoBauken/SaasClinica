import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, DoorOpen } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Conflict {
  type: string;
  appointmentId: number;
  patientName?: string;
  professionalName?: string;
  roomName?: string;
  startTime: string;
  endTime: string;
}

interface TimeSlot {
  startTime: string;
  endTime: string;
}

interface AlternativeRoom {
  roomId: number;
  roomName: string;
}

interface ConflictSuggestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: Conflict[];
  suggestions: {
    nextAvailableSlots: TimeSlot[];
    alternativeRooms: AlternativeRoom[];
    message?: string;
  };
  onSelectTimeSlot: (slot: TimeSlot) => void;
  onSelectRoom: (room: AlternativeRoom) => void;
}

export default function ConflictSuggestionsDialog({
  open,
  onOpenChange,
  conflicts,
  suggestions,
  onSelectTimeSlot,
  onSelectRoom,
}: ConflictSuggestionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Conflito de Agendamento Detectado
          </DialogTitle>
          <DialogDescription>
            Já existe um agendamento no horário solicitado. Veja os detalhes e escolha uma alternativa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Conflitos Detectados */}
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-sm text-red-800">Conflitos Encontrados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {conflicts.map((conflict, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900">
                      {conflict.type === 'professional' ? 'Profissional' : 'Sala'} ocupado(a)
                    </p>
                    <p className="text-red-700">
                      {conflict.professionalName && `Dr(a). ${conflict.professionalName}`}
                      {conflict.roomName && ` - Sala: ${conflict.roomName}`}
                    </p>
                    <p className="text-red-600 text-xs">
                      {conflict.patientName && `Paciente: ${conflict.patientName} • `}
                      {format(new Date(conflict.startTime), "HH:mm", { locale: ptBR })} -{" "}
                      {format(new Date(conflict.endTime), "HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Sugestões de Horários Alternativos */}
          {suggestions.nextAvailableSlots.length > 0 && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-sm text-blue-800 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Próximos Horários Disponíveis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {suggestions.nextAvailableSlots.map((slot, index) => {
                  const startDate = new Date(slot.startTime);
                  const endDate = new Date(slot.endTime);
                  return (
                    <Button
                      key={index}
                      variant="outline"
                      className="w-full justify-start text-left hover:bg-blue-100 hover:border-blue-400"
                      onClick={() => onSelectTimeSlot(slot)}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          {format(startDate, "dd/MM/yyyy", { locale: ptBR })}
                        </Badge>
                        <div className="flex-1">
                          <span className="font-medium">
                            {format(startDate, "HH:mm", { locale: ptBR })} -{" "}
                            {format(endDate, "HH:mm", { locale: ptBR })}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({format(startDate, "EEEE", { locale: ptBR })})
                          </span>
                        </div>
                        <Clock className="h-4 w-4 text-blue-600" />
                      </div>
                    </Button>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Sugestões de Salas Alternativas */}
          {suggestions.alternativeRooms.length > 0 && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-sm text-green-800 flex items-center gap-2">
                  <DoorOpen className="h-4 w-4" />
                  Salas Alternativas Disponíveis (Mesmo Horário)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {suggestions.alternativeRooms.map((room, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="w-full justify-start text-left hover:bg-green-100 hover:border-green-400"
                    onClick={() => onSelectRoom(room)}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <DoorOpen className="h-4 w-4 text-green-600" />
                      <span className="font-medium">{room.roomName}</span>
                    </div>
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Mensagem de Feedback */}
          {suggestions.message && (
            <p className="text-sm text-muted-foreground text-center italic">
              {suggestions.message}
            </p>
          )}

          {/* Sem Sugestões */}
          {suggestions.nextAvailableSlots.length === 0 && suggestions.alternativeRooms.length === 0 && (
            <Card className="border-gray-200">
              <CardContent className="py-6 text-center text-muted-foreground">
                <p>Nenhuma alternativa automática disponível.</p>
                <p className="text-sm mt-2">Por favor, escolha outro horário manualmente.</p>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Escolher Outro Horário Manualmente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
