import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Info, Calendar } from "lucide-react";

interface FitInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  defaultDate?: Date;
}

export default function FitInModal({
  isOpen,
  onClose,
  onSave,
  defaultDate = new Date()
}: FitInModalProps) {
  const [formData, setFormData] = useState({
    patientId: '',
    patientSearch: '',
    professionalId: '',
    date: defaultDate ? defaultDate.toISOString().split('T')[0] : '',
    desiredTime: '',
    plan: 'particular',
    procedureType: 'avaliacao',
    notes: '',
    urgentFitIn: false,
    anyDate: false
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Adicionar encaixe</DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          {/* Patient Search */}
          <div>
            <Label htmlFor="patient" className="text-sm font-medium flex items-center">
              Paciente
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <div className="relative mt-1.5">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="patient"
                placeholder="Buscar paciente"
                className="pl-9"
                value={formData.patientSearch}
                onChange={(e) => handleInputChange('patientSearch', e.target.value)}
              />
            </div>
            <div className="flex justify-between mt-1">
              <p className="text-xs text-red-500">Este campo é obrigatório</p>
              <button type="button" className="text-xs text-blue-500">Cadastrar novo paciente</button>
            </div>
          </div>

          {/* Any Date Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="anyDate" 
              checked={formData.anyDate} 
              onCheckedChange={(checked) => handleInputChange('anyDate', checked)}
            />
            <Label htmlFor="anyDate" className="text-sm">Qualquer data</Label>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fitInDate" className="text-sm font-medium flex items-center">
                Data do encaixe
                <span className="text-red-500 ml-1">*</span>
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="fitInDate"
                  type="date"
                  disabled={formData.anyDate}
                  className={formData.anyDate ? "opacity-50" : ""}
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                />
                <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div>
              <Label htmlFor="desiredTime" className="text-sm font-medium flex items-center">
                Turno desejado
                <span className="text-red-500 ml-1">*</span>
              </Label>
              <Select
                value={formData.desiredTime}
                onValueChange={(value) => handleInputChange('desiredTime', value)}
              >
                <SelectTrigger id="desiredTime" className="mt-1.5">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Manhã</SelectItem>
                  <SelectItem value="afternoon">Tarde</SelectItem>
                  <SelectItem value="evening">Noite</SelectItem>
                  <SelectItem value="any">Qualquer horário</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Professional Selection */}
          <div>
            <Label htmlFor="professional" className="text-sm font-medium flex items-center">
              Profissional
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Select
              value={formData.professionalId}
              onValueChange={(value) => handleInputChange('professionalId', value)}
            >
              <SelectTrigger id="professional" className="mt-1.5">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Dr. Ana Silva</SelectItem>
                <SelectItem value="2">Dr. Carlos Mendes</SelectItem>
                <SelectItem value="3">Dr. Juliana Costa</SelectItem>
                <SelectItem value="any">Qualquer profissional</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Plan Selection */}
          <div>
            <Label htmlFor="plan" className="text-sm font-medium flex items-center">
              Plano
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Select
              value={formData.plan}
              onValueChange={(value) => handleInputChange('plan', value)}
            >
              <SelectTrigger id="plan" className="mt-1.5">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="particular">Particular</SelectItem>
                <SelectItem value="amil">Amil</SelectItem>
                <SelectItem value="sulamerica">SulAmérica</SelectItem>
                <SelectItem value="unimed">Unimed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Procedure Type */}
          <div className="space-y-3">
            <div className="flex space-x-4">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                <div className="w-3 h-3 rounded-full bg-white"></div>
              </div>
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white">
                <div className="w-3 h-3 rounded-full bg-white"></div>
              </div>
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white">
                <div className="w-3 h-3 rounded-full bg-white"></div>
              </div>
              <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white">
                <div className="w-3 h-3 rounded-full bg-white"></div>
              </div>
              <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white">
                <div className="w-3 h-3 rounded-full bg-white"></div>
              </div>
            </div>
            <Select
              value={formData.procedureType}
              onValueChange={(value) => handleInputChange('procedureType', value)}
            >
              <SelectTrigger id="procedureType">
                <SelectValue placeholder="Selecione um rótulo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="avaliacao">Avaliação</SelectItem>
                <SelectItem value="dentistica">Dentística</SelectItem>
                <SelectItem value="ortodontia">Ortodontia</SelectItem>
                <SelectItem value="cirurgia">Cirurgia</SelectItem>
                <SelectItem value="protese">Prótese</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes" className="text-sm font-medium">Observação</Label>
            <Textarea 
              id="notes" 
              className="h-24 resize-none mt-1.5"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Adicione informações relevantes"
            />
            <div className="text-xs text-gray-500 mt-1 text-right">0 / 500</div>
          </div>

          {/* Urgent Fit In */}
          <div className="flex items-center space-x-3">
            <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200">
              <input 
                type="checkbox" 
                className="peer h-6 w-11 cursor-pointer appearance-none rounded-full bg-gray-200 transition-colors duration-200 focus-visible:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                id="urgentFitIn" 
                checked={formData.urgentFitIn}
                onChange={(e) => handleInputChange('urgentFitIn', e.target.checked)}
              />
              <span className={`absolute mx-1 h-4 w-4 rounded-full bg-white transition-transform duration-200 ${formData.urgentFitIn ? 'translate-x-5' : ''}`}></span>
            </div>
            <Label htmlFor="urgentFitIn" className="text-sm">Encaixe urgente</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-[200px]">Encaixes urgentes são priorizados e notificam o profissional assim que criados</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose}>
            FECHAR
          </Button>
          <Button type="button" onClick={handleSave} className="bg-green-500 hover:bg-green-600">
            SALVAR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}