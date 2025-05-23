import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

interface WorkHoursSettings {
  startHour: number;
  endHour: number;
  weekDays: {
    [key: number]: {
      enabled: boolean;
      startHour: number;
      endHour: number;
    }
  };
  lunchBreak: {
    enabled: boolean;
    startHour: number;
    endHour: number;
  }
}

interface ScheduleSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  workHours: WorkHoursSettings;
  timeInterval: 15 | 20 | 30 | 60;
  onSave: (settings: {
    workHours: WorkHoursSettings;
    timeInterval: 15 | 20 | 30 | 60;
  }) => void;
}

const WEEKDAYS = [
  { id: 0, name: "Domingo" },
  { id: 1, name: "Segunda" },
  { id: 2, name: "Terça" },
  { id: 3, name: "Quarta" },
  { id: 4, name: "Quinta" },
  { id: 5, name: "Sexta" },
  { id: 6, name: "Sábado" },
];

const hourOptions = Array.from({ length: 24 }, (_, i) => ({ 
  value: i.toString(), 
  label: `${i}:00` 
}));

export default function ScheduleSettings({ isOpen, onClose, workHours, timeInterval, onSave }: ScheduleSettingsProps) {
  const [settings, setSettings] = useState({
    workHours: { ...workHours },
    timeInterval
  });
  
  const [activeTab, setActiveTab] = useState("general");

  const handleInputChange = (field: string, value: any) => {
    if (field.startsWith("weekDay.")) {
      // Exemplo: weekDay.0.startHour
      const [_, dayIndex, property] = field.split('.');
      
      setSettings(prev => ({
        ...prev,
        workHours: {
          ...prev.workHours,
          weekDays: {
            ...prev.workHours.weekDays,
            [dayIndex]: {
              ...prev.workHours.weekDays[parseInt(dayIndex)],
              [property]: property === 'enabled' ? value : parseInt(value)
            }
          }
        }
      }));
    } else if (field.startsWith("lunchBreak.")) {
      // Exemplo: lunchBreak.startHour
      const [_, property] = field.split('.');
      
      setSettings(prev => ({
        ...prev,
        workHours: {
          ...prev.workHours,
          lunchBreak: {
            ...prev.workHours.lunchBreak,
            [property]: property === 'enabled' ? value : parseInt(value)
          }
        }
      }));
    } else if (field === 'timeInterval') {
      setSettings(prev => ({
        ...prev,
        timeInterval: parseInt(value) as 15 | 20 | 30 | 60
      }));
    } else {
      // Campos gerais como startHour, endHour
      setSettings(prev => ({
        ...prev,
        workHours: {
          ...prev.workHours,
          [field]: parseInt(value)
        }
      }));
    }
  };

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Configurações da Agenda</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Configure os horários de funcionamento, intervalos e dias da semana para a agenda da clínica.
          </p>
        </DialogHeader>
        
        <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="weekdays">Dias da Semana</TabsTrigger>
            <TabsTrigger value="breaks">Intervalos</TabsTrigger>
          </TabsList>
          
          {/* Configurações gerais */}
          <TabsContent value="general" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startHour">Horário de Início</Label>
                <Select 
                  value={settings.workHours.startHour.toString()} 
                  onValueChange={(value) => handleInputChange('startHour', value)}
                >
                  <SelectTrigger id="startHour">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {hourOptions.slice(0, 12).map(hour => (
                      <SelectItem key={hour.value} value={hour.value}>
                        {hour.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endHour">Horário de Término</Label>
                <Select 
                  value={settings.workHours.endHour.toString()} 
                  onValueChange={(value) => handleInputChange('endHour', value)}
                >
                  <SelectTrigger id="endHour">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {hourOptions.slice(12, 24).map(hour => (
                      <SelectItem key={hour.value} value={hour.value}>
                        {hour.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="timeInterval">Intervalo de Tempo</Label>
              <Select 
                value={settings.timeInterval.toString()} 
                onValueChange={(value) => handleInputChange('timeInterval', value)}
              >
                <SelectTrigger id="timeInterval">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="20">20 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="60">60 minutos</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                Define o tamanho dos slots de tempo na agenda.
              </p>
            </div>
          </TabsContent>
          
          {/* Configurações por dia da semana */}
          <TabsContent value="weekdays" className="space-y-4">
            <div className="space-y-4">
              {WEEKDAYS.map(day => (
                <div key={day.id} className="p-3 border rounded-md">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id={`day-${day.id}`}
                        checked={settings.workHours.weekDays[day.id].enabled}
                        onCheckedChange={(checked) => 
                          handleInputChange(`weekDay.${day.id}.enabled`, checked)
                        }
                      />
                      <Label htmlFor={`day-${day.id}`} className="font-medium">
                        {day.name}
                      </Label>
                    </div>
                  </div>
                  
                  {settings.workHours.weekDays[day.id].enabled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`startHour-${day.id}`}>Início</Label>
                        <Select 
                          value={settings.workHours.weekDays[day.id].startHour.toString()} 
                          onValueChange={(value) => 
                            handleInputChange(`weekDay.${day.id}.startHour`, value)
                          }
                        >
                          <SelectTrigger id={`startHour-${day.id}`}>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {hourOptions.slice(0, 12).map(hour => (
                              <SelectItem key={hour.value} value={hour.value}>
                                {hour.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor={`endHour-${day.id}`}>Término</Label>
                        <Select 
                          value={settings.workHours.weekDays[day.id].endHour.toString()} 
                          onValueChange={(value) => 
                            handleInputChange(`weekDay.${day.id}.endHour`, value)
                          }
                        >
                          <SelectTrigger id={`endHour-${day.id}`}>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {hourOptions.slice(12, 24).map(hour => (
                              <SelectItem key={hour.value} value={hour.value}>
                                {hour.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
          
          {/* Configurações de intervalo */}
          <TabsContent value="breaks" className="space-y-4">
            {/* Legenda visual para os tipos de horários */}
            <div className="p-3 border rounded-md mb-4 bg-muted/5">
              <h3 className="font-medium mb-2">Legenda de Horários</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="flex items-center space-x-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded border">
                  <div className="w-3 h-3 bg-amber-200 dark:bg-amber-700 rounded-full"></div>
                  <span className="text-xs">Horário de almoço</span>
                </div>
                <div className="flex items-center space-x-2 p-2 bg-gray-100 dark:bg-gray-800/50 rounded border">
                  <div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                  <span className="text-xs">Fora do expediente</span>
                </div>
                <div className="flex items-center space-x-2 p-2 bg-muted/5 rounded border">
                  <div className="w-3 h-3 bg-muted/20 rounded-full"></div>
                  <span className="text-xs">Horário normal</span>
                </div>
              </div>
            </div>
            
            <div className="p-4 border rounded-md">
              <div className="flex items-center justify-between mb-4">
                <Label htmlFor="lunchBreak" className="font-medium">Horário de Almoço</Label>
                <Switch 
                  id="lunchBreak"
                  checked={settings.workHours.lunchBreak.enabled}
                  onCheckedChange={(checked) => 
                    handleInputChange('lunchBreak.enabled', checked)
                  }
                />
              </div>
              
              {settings.workHours.lunchBreak.enabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lunchStart">Início</Label>
                    <Select 
                      value={settings.workHours.lunchBreak.startHour.toString()} 
                      onValueChange={(value) => 
                        handleInputChange('lunchBreak.startHour', value)
                      }
                    >
                      <SelectTrigger id="lunchStart">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {hourOptions.slice(10, 14).map(hour => (
                          <SelectItem key={hour.value} value={hour.value}>
                            {hour.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="lunchEnd">Término</Label>
                    <Select 
                      value={settings.workHours.lunchBreak.endHour.toString()} 
                      onValueChange={(value) => 
                        handleInputChange('lunchBreak.endHour', value)
                      }
                    >
                      <SelectTrigger id="lunchEnd">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {hourOptions.slice(11, 15).map(hour => (
                          <SelectItem key={hour.value} value={hour.value}>
                            {hour.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="default" onClick={handleSave}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}