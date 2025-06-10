import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, User, FileText } from "lucide-react";

interface NovoAgendamentoProps {
  onClose: () => void;
  onSave: (agendamento: any) => void;
  selectedDate?: Date;
  selectedTime?: string;
}

export default function NovoAgendamento({ onClose, onSave, selectedDate, selectedTime }: NovoAgendamentoProps) {
  const [formData, setFormData] = useState({
    patientName: '',
    patientPhone: '',
    patientEmail: '',
    procedure: '',
    date: selectedDate ? selectedDate.toISOString().split('T')[0] : '',
    time: selectedTime || '',
    duration: '60',
    notes: '',
    status: 'agendado'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      id: Date.now(),
      createdAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Novo Agendamento
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="patientName">Nome do Paciente</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="patientName"
                  value={formData.patientName}
                  onChange={(e) => setFormData({...formData, patientName: e.target.value})}
                  placeholder="Nome completo"
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="patientPhone">Telefone</Label>
              <Input
                id="patientPhone"
                value={formData.patientPhone}
                onChange={(e) => setFormData({...formData, patientPhone: e.target.value})}
                placeholder="(11) 99999-9999"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="patientEmail">Email</Label>
            <Input
              id="patientEmail"
              type="email"
              value={formData.patientEmail}
              onChange={(e) => setFormData({...formData, patientEmail: e.target.value})}
              placeholder="email@exemplo.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="procedure">Procedimento</Label>
            <Select value={formData.procedure} onValueChange={(value) => setFormData({...formData, procedure: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o procedimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consulta">Consulta</SelectItem>
                <SelectItem value="limpeza">Limpeza</SelectItem>
                <SelectItem value="obturacao">Obturação</SelectItem>
                <SelectItem value="extracao">Extração</SelectItem>
                <SelectItem value="canal">Tratamento de Canal</SelectItem>
                <SelectItem value="ortodontia">Ortodontia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Horário</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({...formData, time: e.target.value})}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duração (min)</Label>
              <Select value={formData.duration} onValueChange={(value) => setFormData({...formData, duration: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                  <SelectItem value="90">1h 30min</SelectItem>
                  <SelectItem value="120">2 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Observações adicionais..."
                className="pl-10"
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              Agendar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}