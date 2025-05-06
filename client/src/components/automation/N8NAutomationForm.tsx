import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AutomationFormData } from "@/lib/types";

interface N8NAutomationFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: AutomationFormData;
  onSave: (data: AutomationFormData) => void;
  onDelete?: (id: number) => void;
}

export default function N8NAutomationForm({
  isOpen,
  onClose,
  initialData,
  onSave,
  onDelete
}: N8NAutomationFormProps) {
  const [formData, setFormData] = useState<AutomationFormData>({
    name: '',
    triggerType: 'time_before',
    timeBeforeValue: 24,
    timeBeforeUnit: 'hours',
    appointmentStatus: 'confirmed',
    whatsappEnabled: true,
    whatsappTemplateId: 'lembrete_consulta',
    whatsappTemplateVariables: '',
    emailEnabled: true,
    emailSender: '',
    emailSubject: '',
    emailBody: '',
    smsEnabled: false,
    smsText: '',
    webhookUrl: '',
    customHeaders: [],
    responseActions: {
      confirmIfPositive: true,
      notifyIfNegative: true
    },
    logLevel: 'complete',
    active: true
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      // Reset to defaults for a new automation
      setFormData({
        name: 'Confirmação 24h Antes',
        triggerType: 'time_before',
        timeBeforeValue: 24,
        timeBeforeUnit: 'hours',
        appointmentStatus: 'confirmed',
        whatsappEnabled: true,
        whatsappTemplateId: 'lembrete_consulta',
        whatsappTemplateVariables: 'Olá {{nome_paciente}},\n\nLembramos que sua consulta está agendada para amanhã ({{data_consulta}}) às {{hora_consulta}} com {{nome_profissional}}.\n\nPara confirmar, responda SIM. Para reagendar, responda NÃO.',
        emailEnabled: true,
        emailSender: 'contato@clinicadental.com.br',
        emailSubject: 'Lembrete: Sua consulta amanhã',
        emailBody: 'Olá {{nome_paciente}},\n\nEste é um lembrete que você tem uma consulta agendada para amanhã, dia {{data_consulta}}, às {{hora_consulta}} com {{nome_profissional}}.\n\nEndereço: Av. Brasil, 1500 - Centro\nTelefone: (11) 3000-5000\n\nAtenciosamente,\nEquipe DentCare',
        smsEnabled: false,
        smsText: '',
        webhookUrl: 'https://n8n.clinicadental.com.br/webhook/confirmacao',
        customHeaders: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Authorization', value: 'Bearer ********' }
        ],
        responseActions: {
          confirmIfPositive: true,
          notifyIfNegative: true
        },
        logLevel: 'complete',
        active: true
      });
    }
  }, [initialData, isOpen]);

  const handleInputChange = (field: keyof AutomationFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleHeaderChange = (index: number, field: 'name' | 'value', value: string) => {
    const updatedHeaders = [...formData.customHeaders!];
    updatedHeaders[index] = {
      ...updatedHeaders[index],
      [field]: value
    };
    setFormData(prev => ({
      ...prev,
      customHeaders: updatedHeaders
    }));
  };

  const addCustomHeader = () => {
    setFormData(prev => ({
      ...prev,
      customHeaders: [...(prev.customHeaders || []), { name: '', value: '' }]
    }));
  };

  const handleSave = () => {
    onSave(formData);
  };

  const handleDelete = () => {
    if (initialData?.id && onDelete) {
      onDelete(initialData.id);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuração de Automação N8N</DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <form>
            {/* Automation Info */}
            <div className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label htmlFor="name" className="block text-sm font-medium text-neutral-dark mb-2">
                    Nome da Automação
                  </Label>
                  <Input 
                    id="name" 
                    placeholder="Ex: Confirmação de Consulta" 
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="triggerType" className="block text-sm font-medium text-neutral-dark mb-2">
                    Tipo de Gatilho
                  </Label>
                  <Select 
                    value={formData.triggerType}
                    onValueChange={(value) => handleInputChange('triggerType', value)}
                  >
                    <SelectTrigger id="triggerType">
                      <SelectValue placeholder="Selecione o tipo de gatilho" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="appointment">Agendamento</SelectItem>
                      <SelectItem value="time_before">Tempo Antes da Consulta</SelectItem>
                      <SelectItem value="after_appointment">Após Consulta</SelectItem>
                      <SelectItem value="status_change">Alteração de Status</SelectItem>
                      <SelectItem value="custom">Evento Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {formData.triggerType === 'time_before' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label htmlFor="timeBeforeValue" className="block text-sm font-medium text-neutral-dark mb-2">
                      Tempo de Antecedência
                    </Label>
                    <div className="flex">
                      <Input 
                        id="timeBeforeValue" 
                        type="number" 
                        className="w-20 rounded-r-none"
                        value={formData.timeBeforeValue}
                        onChange={(e) => handleInputChange('timeBeforeValue', parseInt(e.target.value))}
                      />
                      <Select 
                        value={formData.timeBeforeUnit}
                        onValueChange={(value) => handleInputChange('timeBeforeUnit', value)}
                      >
                        <SelectTrigger className="rounded-l-none border-l-0 w-32">
                          <SelectValue placeholder="Unidade" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minutes">minutos</SelectItem>
                          <SelectItem value="hours">horas</SelectItem>
                          <SelectItem value="days">dias</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="appointmentStatus" className="block text-sm font-medium text-neutral-dark mb-2">
                      Status do Agendamento
                    </Label>
                    <Select 
                      value={formData.appointmentStatus}
                      onValueChange={(value) => handleInputChange('appointmentStatus', value)}
                    >
                      <SelectTrigger id="appointmentStatus">
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Qualquer</SelectItem>
                        <SelectItem value="scheduled">Agendado</SelectItem>
                        <SelectItem value="confirmed">Confirmado</SelectItem>
                        <SelectItem value="not_confirmed">Não confirmado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
            
            {/* Communication channels */}
            <div className="mb-6">
              <h3 className="font-medium text-neutral-dark mb-3">Canais de Comunicação</h3>
              
              <div className="space-y-3">
                <div className="flex items-center">
                  <Checkbox 
                    id="whatsapp" 
                    checked={formData.whatsappEnabled}
                    onCheckedChange={(checked) => 
                      handleInputChange('whatsappEnabled', checked === true)
                    }
                  />
                  <Label htmlFor="whatsapp" className="ml-2 text-sm font-medium">WhatsApp</Label>
                </div>
                
                {formData.whatsappEnabled && (
                  <div className="ml-6 p-3 bg-neutral-lightest rounded-md">
                    <div className="mb-3">
                      <Label htmlFor="whatsappTemplateId" className="block text-sm font-medium text-neutral-dark mb-2">
                        Template de Mensagem
                      </Label>
                      <Select 
                        value={formData.whatsappTemplateId}
                        onValueChange={(value) => handleInputChange('whatsappTemplateId', value)}
                      >
                        <SelectTrigger id="whatsappTemplateId">
                          <SelectValue placeholder="Selecione um template" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="confirmacao_padrao">Template Padrão de Confirmação</SelectItem>
                          <SelectItem value="lembrete_consulta">Lembrete de Consulta</SelectItem>
                          <SelectItem value="confirmacao_com_mapa">Confirmação com Mapa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="whatsappTemplateVariables" className="block text-sm font-medium text-neutral-dark mb-2">
                        Variáveis do Template
                      </Label>
                      <Textarea 
                        id="whatsappTemplateVariables" 
                        className="h-20 resize-none"
                        value={formData.whatsappTemplateVariables}
                        onChange={(e) => handleInputChange('whatsappTemplateVariables', e.target.value)}
                      />
                    </div>
                  </div>
                )}
                
                <div className="flex items-center">
                  <Checkbox 
                    id="email" 
                    checked={formData.emailEnabled}
                    onCheckedChange={(checked) => 
                      handleInputChange('emailEnabled', checked === true)
                    }
                  />
                  <Label htmlFor="email" className="ml-2 text-sm font-medium">E-mail</Label>
                </div>
                
                {formData.emailEnabled && (
                  <div className="ml-6 p-3 bg-neutral-lightest rounded-md">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div>
                        <Label htmlFor="emailSender" className="block text-sm font-medium text-neutral-dark mb-2">
                          Remetente
                        </Label>
                        <Input 
                          id="emailSender" 
                          type="email" 
                          value={formData.emailSender}
                          onChange={(e) => handleInputChange('emailSender', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="emailSubject" className="block text-sm font-medium text-neutral-dark mb-2">
                          Assunto
                        </Label>
                        <Input 
                          id="emailSubject" 
                          value={formData.emailSubject}
                          onChange={(e) => handleInputChange('emailSubject', e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="emailBody" className="block text-sm font-medium text-neutral-dark mb-2">
                        Corpo do E-mail
                      </Label>
                      <Textarea 
                        id="emailBody" 
                        className="h-20 resize-none"
                        value={formData.emailBody}
                        onChange={(e) => handleInputChange('emailBody', e.target.value)}
                      />
                    </div>
                  </div>
                )}
                
                <div className="flex items-center">
                  <Checkbox 
                    id="sms" 
                    checked={formData.smsEnabled}
                    onCheckedChange={(checked) => 
                      handleInputChange('smsEnabled', checked === true)
                    }
                  />
                  <Label htmlFor="sms" className="ml-2 text-sm font-medium">SMS</Label>
                </div>
                
                {formData.smsEnabled && (
                  <div className="ml-6 p-3 bg-neutral-lightest rounded-md">
                    <div>
                      <Label htmlFor="smsText" className="block text-sm font-medium text-neutral-dark mb-2">
                        Texto da Mensagem
                      </Label>
                      <Textarea 
                        id="smsText" 
                        className="h-20 resize-none"
                        value={formData.smsText}
                        onChange={(e) => handleInputChange('smsText', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Advanced Settings */}
            <div className="mb-6">
              <h3 className="font-medium text-neutral-dark mb-3">Configurações Avançadas</h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="webhookUrl" className="block text-sm font-medium text-neutral-dark mb-2">
                    URL do Webhook N8N
                  </Label>
                  <Input 
                    id="webhookUrl" 
                    value={formData.webhookUrl}
                    onChange={(e) => handleInputChange('webhookUrl', e.target.value)}
                  />
                </div>
                
                <div>
                  <Label className="block text-sm font-medium text-neutral-dark mb-2">
                    Headers Personalizados
                  </Label>
                  <div className="space-y-2">
                    {formData.customHeaders?.map((header, index) => (
                      <div key={index} className="grid grid-cols-2 gap-2">
                        <Input 
                          value={header.name}
                          onChange={(e) => handleHeaderChange(index, 'name', e.target.value)}
                          placeholder="Nome"
                        />
                        <Input 
                          value={header.value}
                          onChange={(e) => handleHeaderChange(index, 'value', e.target.value)}
                          placeholder="Valor"
                        />
                      </div>
                    ))}
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="mt-2 text-xs text-primary"
                    onClick={addCustomHeader}
                  >
                    + Adicionar Header
                  </Button>
                </div>
                
                <div>
                  <Label className="block text-sm font-medium text-neutral-dark mb-2">
                    Ações de Resposta
                  </Label>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <Checkbox 
                        id="confirm_action" 
                        checked={formData.responseActions?.confirmIfPositive}
                        onCheckedChange={(checked) => {
                          const newActions = { ...formData.responseActions, confirmIfPositive: checked === true };
                          handleInputChange('responseActions', newActions);
                        }}
                      />
                      <Label htmlFor="confirm_action" className="ml-2 text-sm">
                        Atualizar status para "Confirmado" se resposta for positiva
                      </Label>
                    </div>
                    <div className="flex items-center">
                      <Checkbox 
                        id="cancel_action" 
                        checked={formData.responseActions?.notifyIfNegative}
                        onCheckedChange={(checked) => {
                          const newActions = { ...formData.responseActions, notifyIfNegative: checked === true };
                          handleInputChange('responseActions', newActions);
                        }}
                      />
                      <Label htmlFor="cancel_action" className="ml-2 text-sm">
                        Notificar recepção se resposta for negativa
                      </Label>
                    </div>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="logLevel" className="block text-sm font-medium text-neutral-dark mb-2">
                    Log de Execução
                  </Label>
                  <Select 
                    value={formData.logLevel}
                    onValueChange={(value) => handleInputChange('logLevel', value)}
                  >
                    <SelectTrigger id="logLevel">
                      <SelectValue placeholder="Selecione o nível de log" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="disabled">Desativado</SelectItem>
                      <SelectItem value="errors_only">Apenas erros</SelectItem>
                      <SelectItem value="complete">Completo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </form>
        </div>
        
        <DialogFooter className="flex justify-between items-center">
          {initialData?.id && (
            <Button 
              variant="outline" 
              className="border-red-300 text-red-600 hover:bg-red-50"
              onClick={handleDelete}
            >
              Excluir Automação
            </Button>
          )}
          
          <div className="flex space-x-3">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave}>
              Salvar Automação
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
