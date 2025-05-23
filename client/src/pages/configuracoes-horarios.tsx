import { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

// Dados de exemplo para os profissionais 
const mockProfessionals = [
  { 
    id: 1, 
    name: "Dra. Flávia Costa", 
    email: "flavia.costa@example.com",
    role: "Dentista administrador(a)",
    active: true,
    workingHours: {
      mon: { enabled: true, start: "07:00", end: "22:00" },
      tue: { enabled: true, start: "07:00", end: "22:00" },
      wed: { enabled: true, start: "07:00", end: "22:00" },
      thu: { enabled: true, start: "07:00", end: "22:00" },
      fri: { enabled: true, start: "07:00", end: "22:00" },
      sat: { enabled: false, start: "07:00", end: "12:00" },
      sun: { enabled: false, start: "07:00", end: "22:00" }
    },
    lunchBreak: {
      enabled: true,
      start: "12:00",
      end: "13:30"
    },
    appointmentDuration: 30,
    permissions: ["agenda", "financial", "patients", "settings"],
    commission: {
      type: "percentage",
      value: 50,
      when: "on_payment",
      plans: ["all"]
    }
  },
  { 
    id: 2, 
    name: "Dr. Ricardo Almeida", 
    email: "ricardo.almeida@example.com",
    role: "Dentista",
    active: true,
    workingHours: {
      mon: { enabled: true, start: "08:00", end: "18:00" },
      tue: { enabled: true, start: "08:00", end: "18:00" },
      wed: { enabled: true, start: "08:00", end: "18:00" },
      thu: { enabled: true, start: "08:00", end: "18:00" },
      fri: { enabled: true, start: "08:00", end: "18:00" },
      sat: { enabled: false, start: "08:00", end: "12:00" },
      sun: { enabled: false, start: "08:00", end: "12:00" }
    },
    lunchBreak: {
      enabled: true,
      start: "12:00",
      end: "13:00"
    },
    appointmentDuration: 45,
    permissions: ["agenda", "patients"],
    commission: {
      type: "percentage",
      value: 40,
      when: "on_payment",
      plans: ["all"]
    }
  }
];

// Tipos para os horários de atendimento
type DayCode = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

interface WorkingHours {
  mon: DaySchedule;
  tue: DaySchedule;
  wed: DaySchedule;
  thu: DaySchedule;
  fri: DaySchedule;
  sat: DaySchedule;
  sun: DaySchedule;
}

interface LunchBreak {
  enabled: boolean;
  start: string;
  end: string;
}

interface Professional {
  id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
  workingHours: WorkingHours;
  lunchBreak: LunchBreak;
  appointmentDuration: number;
  permissions: string[];
  commission: {
    type: string;
    value: number;
    when: string;
    plans: string[];
  };
}

export default function HorariosProfissionaisPage() {
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [activeTab, setActiveTab] = useState("horarios");
  
  // Query para buscar profissionais
  const { data: professionals = [] } = useQuery({
    queryKey: ['/api/professionals'],
    queryFn: async () => {
      // Em um ambiente real, isso seria uma chamada de API
      return mockProfessionals;
    }
  });
  
  // Selecionar um profissional
  const handleSelectProfessional = (professionalId: string) => {
    const professional = professionals.find(p => p.id === parseInt(professionalId));
    setSelectedProfessional(professional || null);
  };
  
  // Salvar alterações
  const handleSave = () => {
    // Aqui faria a chamada de API para salvar os dados
    toast({
      title: "Configurações salvas",
      description: "As configurações de horário foram salvas com sucesso.",
    });
  };
  
  // Atualizar horário de um dia
  const updateDaySchedule = (day: DayCode, field: keyof DaySchedule, value: any) => {
    if (!selectedProfessional) return;
    
    setSelectedProfessional({
      ...selectedProfessional,
      workingHours: {
        ...selectedProfessional.workingHours,
        [day]: {
          ...selectedProfessional.workingHours[day],
          [field]: value
        }
      }
    });
  };
  
  // Atualizar horário de almoço
  const updateLunchBreak = (field: keyof LunchBreak, value: any) => {
    if (!selectedProfessional) return;
    
    setSelectedProfessional({
      ...selectedProfessional,
      lunchBreak: {
        ...selectedProfessional.lunchBreak,
        [field]: value
      }
    });
  };
  
  // Mapear dias da semana
  const daysOfWeek = [
    { code: "mon" as DayCode, label: "Seg" },
    { code: "tue" as DayCode, label: "Ter" },
    { code: "wed" as DayCode, label: "Qua" },
    { code: "thu" as DayCode, label: "Qui" },
    { code: "fri" as DayCode, label: "Sex" },
    { code: "sat" as DayCode, label: "Sáb" },
    { code: "sun" as DayCode, label: "Dom" },
  ];
  
  return (
    <DashboardLayout title="Horários de Atendimento" currentPath="/configuracoes/horarios">
      <div className="flex flex-col space-y-6 p-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Horários de Atendimento</h1>
          
          <div className="flex items-center gap-4">
            <Select value={selectedProfessional?.id.toString() || ""} onValueChange={handleSelectProfessional}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Selecione um profissional" />
              </SelectTrigger>
              <SelectContent>
                {professionals.map((professional) => (
                  <SelectItem key={professional.id} value={professional.id.toString()}>
                    {professional.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button 
              onClick={handleSave}
              className="bg-gradient-to-r from-blue-600 to-blue-500"
              disabled={!selectedProfessional}
            >
              Salvar Alterações
            </Button>
          </div>
        </div>
        
        {selectedProfessional ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>{selectedProfessional.name}</span>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="professional-active">Ativo</Label>
                  <Switch 
                    id="professional-active" 
                    checked={selectedProfessional.active} 
                    onCheckedChange={(checked) => {
                      setSelectedProfessional({
                        ...selectedProfessional,
                        active: checked
                      });
                    }}
                  />
                </div>
              </CardTitle>
            </CardHeader>
            
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-3 w-[400px]">
                  <TabsTrigger value="horarios">Horários de Atendimento</TabsTrigger>
                  <TabsTrigger value="permissoes">Permissões</TabsTrigger>
                  <TabsTrigger value="comissoes">Comissões</TabsTrigger>
                </TabsList>
                
                <TabsContent value="horarios" className="mt-6">
                  <div className="grid gap-6">
                    <div className="bg-gray-50 p-4 rounded">
                      <div className="grid grid-cols-8 gap-4 items-center font-medium bg-gray-100 p-2 rounded mb-2">
                        <div></div>
                        {daysOfWeek.map(day => (
                          <div key={day.code} className="text-center">{day.label}</div>
                        ))}
                      </div>
                      
                      <div className="grid grid-cols-8 gap-4 items-center mb-4">
                        <div className="text-right pr-2">Ativo</div>
                        {daysOfWeek.map(day => (
                          <div key={day.code} className="flex justify-center">
                            <Checkbox 
                              checked={selectedProfessional.workingHours[day.code].enabled} 
                              onCheckedChange={(checked) => updateDaySchedule(day.code, 'enabled', !!checked)}
                            />
                          </div>
                        ))}
                      </div>
                      
                      <div className="grid grid-cols-8 gap-4 items-center mb-4">
                        <div className="text-right pr-2">Hora inicial</div>
                        {daysOfWeek.map(day => (
                          <div key={day.code}>
                            <Input 
                              type="time" 
                              value={selectedProfessional.workingHours[day.code].start} 
                              onChange={(e) => updateDaySchedule(day.code, 'start', e.target.value)}
                              disabled={!selectedProfessional.workingHours[day.code].enabled}
                              className="w-full"
                            />
                          </div>
                        ))}
                      </div>
                      
                      <div className="grid grid-cols-8 gap-4 items-center">
                        <div className="text-right pr-2">Hora final</div>
                        {daysOfWeek.map(day => (
                          <div key={day.code}>
                            <Input 
                              type="time" 
                              value={selectedProfessional.workingHours[day.code].end} 
                              onChange={(e) => updateDaySchedule(day.code, 'end', e.target.value)}
                              disabled={!selectedProfessional.workingHours[day.code].enabled}
                              className="w-full"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded">
                      <h3 className="font-medium mb-4">Horário de almoço fixo</h3>
                      
                      <div className="flex items-center mb-4">
                        <Switch 
                          id="lunch-break-enabled" 
                          checked={selectedProfessional.lunchBreak.enabled} 
                          onCheckedChange={(checked) => updateLunchBreak('enabled', checked)}
                          className="mr-2"
                        />
                        <Label htmlFor="lunch-break-enabled">Habilitar horário de almoço fixo</Label>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 items-center">
                        <div>
                          <Label htmlFor="lunch-start">Horário inicial</Label>
                          <Input 
                            id="lunch-start"
                            type="time" 
                            value={selectedProfessional.lunchBreak.start} 
                            onChange={(e) => updateLunchBreak('start', e.target.value)}
                            disabled={!selectedProfessional.lunchBreak.enabled}
                            className="w-full mt-1"
                          />
                        </div>
                        
                        <div className="flex items-center justify-center mt-6">
                          até
                        </div>
                        
                        <div>
                          <Label htmlFor="lunch-end">Horário final</Label>
                          <Input 
                            id="lunch-end"
                            type="time" 
                            value={selectedProfessional.lunchBreak.end} 
                            onChange={(e) => updateLunchBreak('end', e.target.value)}
                            disabled={!selectedProfessional.lunchBreak.enabled}
                            className="w-full mt-1"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded">
                      <h3 className="font-medium mb-4">Duração padrão de consultas</h3>
                      
                      <div className="w-64">
                        <Label htmlFor="appointment-duration">Tempo padrão para consulta (minutos)</Label>
                        <Input 
                          id="appointment-duration"
                          type="number" 
                          value={selectedProfessional.appointmentDuration} 
                          onChange={(e) => {
                            setSelectedProfessional({
                              ...selectedProfessional,
                              appointmentDuration: parseInt(e.target.value) || 30
                            });
                          }}
                          className="w-full mt-1"
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="permissoes" className="mt-6">
                  <div className="space-y-4">
                    <p className="text-muted-foreground">As permissões são pré-definidas, mas podem ser alteradas abaixo:</p>
                    
                    <div className="space-y-2">
                      {[
                        { id: "agenda", label: "Agenda" },
                        { id: "config", label: "Configurações / Ajustes" },
                        { id: "prosthesis", label: "Controle de prótese" },
                        { id: "inventory", label: "Estoque" },
                        { id: "patients", label: "Ficha do Paciente" },
                        { id: "financial", label: "Financeiro" },
                        { id: "intelligence", label: "Inteligência" },
                        { id: "shop", label: "Loja" },
                        { id: "marketing", label: "Marketing" },
                        { id: "sales", label: "Vendas" }
                      ].map(permission => (
                        <div 
                          key={permission.id} 
                          className="flex items-center justify-between p-4 bg-gray-50 rounded"
                        >
                          <div className="flex items-center">
                            <span className="font-medium">{permission.label}</span>
                          </div>
                          <Checkbox 
                            checked={selectedProfessional.permissions.includes(permission.id)} 
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedProfessional({
                                  ...selectedProfessional,
                                  permissions: [...selectedProfessional.permissions, permission.id]
                                });
                              } else {
                                setSelectedProfessional({
                                  ...selectedProfessional,
                                  permissions: selectedProfessional.permissions.filter(p => p !== permission.id)
                                });
                              }
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="comissoes" className="mt-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Quando você paga o profissional?</Label>
                        <Select 
                          value={selectedProfessional.commission.when} 
                          onValueChange={(value) => {
                            setSelectedProfessional({
                              ...selectedProfessional,
                              commission: {
                                ...selectedProfessional.commission,
                                when: value
                              }
                            });
                          }}
                        >
                          <SelectTrigger className="w-full mt-1">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="on_payment">Quando o paciente paga</SelectItem>
                            <SelectItem value="on_conclusion">Quando o tratamento é concluído</SelectItem>
                            <SelectItem value="on_appointment">Quando a consulta é realizada</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-red-500 mt-1">Este campo é obrigatório</p>
                      </div>
                      
                      <div>
                        <Label>Selecione tipo de comissão</Label>
                        <Select 
                          value={selectedProfessional.commission.type} 
                          onValueChange={(value) => {
                            setSelectedProfessional({
                              ...selectedProfessional,
                              commission: {
                                ...selectedProfessional.commission,
                                type: value
                              }
                            });
                          }}
                        >
                          <SelectTrigger className="w-full mt-1">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                            <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="commission-value">Valor comissão</Label>
                        <Input 
                          id="commission-value"
                          type="number" 
                          value={selectedProfessional.commission.value} 
                          onChange={(e) => {
                            setSelectedProfessional({
                              ...selectedProfessional,
                              commission: {
                                ...selectedProfessional.commission,
                                value: parseFloat(e.target.value) || 0
                              }
                            });
                          }}
                          className="w-full mt-1"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label>Plano</Label>
                      <Select 
                        value={selectedProfessional.commission.plans[0]} 
                        onValueChange={(value) => {
                          setSelectedProfessional({
                            ...selectedProfessional,
                            commission: {
                              ...selectedProfessional.commission,
                              plans: [value]
                            }
                          });
                        }}
                      >
                        <SelectTrigger className="w-64 mt-1">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="particular">Particular</SelectItem>
                          <SelectItem value="convenio">Convênio</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="mt-4">
                      <Button>Adicionar Regra</Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Selecione um profissional para configurar os horários de atendimento.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}