import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AppointmentWithRelations } from "@/lib/types";
import { Search, Plus, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment?: AppointmentWithRelations;
  onSave: (appointmentData: any) => void;
  isEdit?: boolean;
}

export default function AppointmentModal({
  isOpen,
  onClose,
  appointment,
  onSave,
  isEdit = false
}: AppointmentModalProps) {
  const [formData, setFormData] = useState({
    appointmentType: 'appointment',
    patientId: '',
    patientSearch: '',
    professionalId: '',
    roomId: '',
    date: '',
    startTime: '',
    endTime: '',
    status: 'scheduled',
    recurrence: 'none',
    notes: '',
    automationEnabled: true,
    automationWorkflow: 'appointment_confirmation',
    automationParams: [
      { key: 'canal_notificacao', value: 'whatsapp,email' },
      { key: 'template_id', value: 'confirmacao_padrao' }
    ]
  });

  // Mock procedures for demonstration
  const [procedures, setProcedures] = useState<Array<{ id: string; name: string; duration: string; price: string; }>>([
    { id: '1', name: 'Consulta inicial', duration: '30', price: '120,00' }
  ]);

  useEffect(() => {
    if (appointment && isEdit) {
      // Populate form data with appointment data for editing
      setFormData({
        appointmentType: appointment.type,
        patientId: appointment.patientId?.toString() || '',
        patientSearch: appointment.patient?.fullName || '',
        professionalId: appointment.professionalId?.toString() || '',
        roomId: appointment.roomId?.toString() || '',
        date: format(parseISO(appointment.startTime), 'yyyy-MM-dd'),
        startTime: format(parseISO(appointment.startTime), 'HH:mm'),
        endTime: format(parseISO(appointment.endTime), 'HH:mm'),
        status: appointment.status,
        recurrence: appointment.recurring ? (appointment.recurrencePattern || 'daily') : 'none',
        notes: appointment.notes || '',
        automationEnabled: appointment.automationEnabled,
        automationWorkflow: 'appointment_confirmation',
        automationParams: appointment.automationParams || [
          { key: 'canal_notificacao', value: 'whatsapp,email' },
          { key: 'template_id', value: 'confirmacao_padrao' }
        ]
      });

      // Should also load procedures
    } else {
      // Reset form for new appointment
      const now = new Date();
      const thirtyMinutesLater = new Date(now.getTime() + 30 * 60000);

      setFormData({
        appointmentType: 'appointment',
        patientId: '',
        patientSearch: '',
        professionalId: '',
        roomId: '',
        date: format(now, 'yyyy-MM-dd'),
        startTime: format(now, 'HH:mm'),
        endTime: format(thirtyMinutesLater, 'HH:mm'),
        status: 'scheduled',
        recurrence: 'none',
        notes: '',
        automationEnabled: true,
        automationWorkflow: 'appointment_confirmation',
        automationParams: [
          { key: 'canal_notificacao', value: 'whatsapp,email' },
          { key: 'template_id', value: 'confirmacao_padrao' }
        ]
      });
      setProcedures([{ id: '1', name: 'Consulta inicial', duration: '30', price: '120,00' }]);
    }
  }, [appointment, isEdit, isOpen]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addProcedure = () => {
    // Logic to add a procedure would go here
    // For now, we'll just show a placeholder
  };

  const removeProcedure = (id: string) => {
    setProcedures(procedures.filter(proc => proc.id !== id));
  };

  const addAutomationParam = () => {
    setFormData(prev => ({
      ...prev,
      automationParams: [...prev.automationParams, { key: '', value: '' }]
    }));
  };

  const updateAutomationParam = (index: number, field: 'key' | 'value', value: string) => {
    const updatedParams = [...formData.automationParams];
    updatedParams[index][field] = value;
    setFormData(prev => ({
      ...prev,
      automationParams: updatedParams
    }));
  };

  const handleSave = () => {
    // Prepare data for saving
    const appointmentData = {
      ...formData,
      procedures: procedures
    };
    onSave(appointmentData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <form>
            {/* Type selector */}
            <div className="mb-4">
              <Label className="block text-sm font-medium text-neutral-dark mb-2">Tipo de Agendamento</Label>
              <RadioGroup 
                value={formData.appointmentType} 
                onValueChange={(value) => handleInputChange('appointmentType', value)}
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="appointment" id="appointment" />
                  <Label htmlFor="appointment">Consulta</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="block" id="block" />
                  <Label htmlFor="block">Bloqueio</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="reminder" id="reminder" />
                  <Label htmlFor="reminder">Lembrete</Label>
                </div>
              </RadioGroup>
            </div>
            
            {/* Patient selection */}
            {formData.appointmentType === 'appointment' && (
              <div className="mb-4">
                <Label htmlFor="patient" className="block text-sm font-medium text-neutral-dark mb-2">Paciente</Label>
                <div className="flex">
                  <div className="relative flex-1">
                    <Search className="h-4 w-4 absolute left-3 top-2.5 text-neutral-medium" />
                    <Input 
                      id="patient" 
                      placeholder="Buscar paciente" 
                      className="pl-9"
                      value={formData.patientSearch}
                      onChange={(e) => handleInputChange('patientSearch', e.target.value)}
                    />
                  </div>
                  <Button variant="outline" type="button" className="ml-2">
                    + Novo
                  </Button>
                </div>
              </div>
            )}
            
            {/* Professional and room */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="professional" className="block text-sm font-medium text-neutral-dark mb-2">Profissional</Label>
                <Select 
                  value={formData.professionalId}
                  onValueChange={(value) => handleInputChange('professionalId', value)}
                >
                  <SelectTrigger id="professional">
                    <SelectValue placeholder="Selecione um profissional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Dr. Ana Silva</SelectItem>
                    <SelectItem value="2">Dr. Carlos Mendes</SelectItem>
                    <SelectItem value="3">Dr. Juliana Costa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="room" className="block text-sm font-medium text-neutral-dark mb-2">Sala</Label>
                <Select 
                  value={formData.roomId}
                  onValueChange={(value) => handleInputChange('roomId', value)}
                >
                  <SelectTrigger id="room">
                    <SelectValue placeholder="Selecione uma sala" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Sala 01</SelectItem>
                    <SelectItem value="2">Sala 02</SelectItem>
                    <SelectItem value="3">Sala 03</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Date and time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="date" className="block text-sm font-medium text-neutral-dark mb-2">Data</Label>
                <Input 
                  id="date" 
                  type="date" 
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime" className="block text-sm font-medium text-neutral-dark mb-2">Início</Label>
                  <Input 
                    id="startTime" 
                    type="time" 
                    value={formData.startTime}
                    onChange={(e) => handleInputChange('startTime', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="endTime" className="block text-sm font-medium text-neutral-dark mb-2">Fim</Label>
                  <Input 
                    id="endTime" 
                    type="time" 
                    value={formData.endTime}
                    onChange={(e) => handleInputChange('endTime', e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            {/* Procedure selection */}
            {formData.appointmentType === 'appointment' && (
              <div className="mb-4">
                <Label className="block text-sm font-medium text-neutral-dark mb-2">Procedimentos</Label>
                <div className="border border-neutral-light rounded-md divide-y divide-neutral-light">
                  {procedures.map((proc) => (
                    <div key={proc.id} className="p-3 flex justify-between items-center">
                      <div>
                        <div className="font-medium">{proc.name}</div>
                        <div className="text-xs text-neutral-medium">{proc.duration} min - R$ {proc.price}</div>
                      </div>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="text-red-500 hover:text-red-700"
                        onClick={() => removeProcedure(proc.id)}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="mt-2 text-sm text-primary font-medium"
                  onClick={addProcedure}
                >
                  <Plus className="h-5 w-5 mr-1" />
                  Adicionar procedimento
                </Button>
              </div>
            )}
            
            {/* Status and recurrence */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="status" className="block text-sm font-medium text-neutral-dark mb-2">Status</Label>
                <Select 
                  value={formData.status}
                  onValueChange={(value) => handleInputChange('status', value)}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Selecione um status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Agendado</SelectItem>
                    <SelectItem value="confirmed">Confirmado</SelectItem>
                    <SelectItem value="in_progress">Em andamento</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                    <SelectItem value="no_show">Não compareceu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="recurrence" className="block text-sm font-medium text-neutral-dark mb-2">Recorrência</Label>
                <Select 
                  value={formData.recurrence}
                  onValueChange={(value) => handleInputChange('recurrence', value)}
                >
                  <SelectTrigger id="recurrence">
                    <SelectValue placeholder="Selecione a recorrência" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não recorrente</SelectItem>
                    <SelectItem value="daily">Diariamente</SelectItem>
                    <SelectItem value="weekly">Semanalmente</SelectItem>
                    <SelectItem value="monthly">Mensalmente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Notes */}
            <div className="mb-6">
              <Label htmlFor="notes" className="block text-sm font-medium text-neutral-dark mb-2">Observações</Label>
              <Textarea 
                id="notes" 
                className="h-24 resize-none"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
              />
            </div>
            
            {/* n8n Integration settings */}
            <div className="mb-6 border-t border-neutral-light pt-4">
              <h3 className="font-medium text-neutral-dark mb-3">Configurações de Automação (n8n)</h3>
              
              <div className="mb-4">
                <Label htmlFor="automation-workflow" className="block text-sm font-medium text-neutral-dark mb-2">
                  Workflow de Notificação
                </Label>
                <Select 
                  value={formData.automationWorkflow}
                  onValueChange={(value) => handleInputChange('automationWorkflow', value)}
                >
                  <SelectTrigger id="automation-workflow">
                    <SelectValue placeholder="Selecione um workflow" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="appointment_confirmation">Confirmação de Agendamento</SelectItem>
                    <SelectItem value="appointment_reminder_24h">Lembrete 24h Antes</SelectItem>
                    <SelectItem value="appointment_change_notification">Confirmação de Alteração</SelectItem>
                    <SelectItem value="appointment_cancellation_notification">Notificação de Cancelamento</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium text-neutral-dark">Parâmetros do Workflow</Label>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="text-xs text-primary"
                    onClick={addAutomationParam}
                  >
                    + Adicionar Parâmetro
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {formData.automationParams.map((param, index) => (
                    <div key={index} className="grid grid-cols-2 gap-2">
                      <Input 
                        value={param.key}
                        onChange={(e) => updateAutomationParam(index, 'key', e.target.value)}
                        placeholder="Chave"
                      />
                      <Input 
                        value={param.value}
                        onChange={(e) => updateAutomationParam(index, 'value', e.target.value)}
                        placeholder="Valor"
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="mb-4">
                <div className="flex items-center">
                  <Checkbox 
                    id="automation-enabled" 
                    checked={formData.automationEnabled}
                    onCheckedChange={(checked) => 
                      handleInputChange('automationEnabled', checked === true)
                    }
                  />
                  <Label htmlFor="automation-enabled" className="ml-2 text-sm">
                    Ativar confirmação automatizada
                  </Label>
                </div>
              </div>
              
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span className="text-xs text-neutral-medium">Integração n8n ativa</span>
              </div>
            </div>
          </form>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave}>
            {isEdit ? 'Atualizar' : 'Salvar'} Agendamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
