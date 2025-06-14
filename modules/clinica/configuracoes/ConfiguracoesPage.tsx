import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../../../client/src/components/ui/card';
import { Button } from '../../../client/src/components/ui/button';
import { Input } from '../../../client/src/components/ui/input';
import { Label } from '../../../client/src/components/ui/label';
import { Switch } from '../../../client/src/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../client/src/components/ui/tabs';
import { 
  Settings, 
  Building, 
  Clock, 
  Bell, 
  Shield, 
  Database,
  Mail,
  Phone,
  MapPin,
  Save
} from 'lucide-react';
import { useToast } from '../../../client/src/hooks/use-toast';

interface ClinicSettings {
  id: number;
  name: string;
  cnpj: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  workingHours: Record<string, { start: string; end: string; enabled: boolean }>;
  notifications: {
    emailReminders: boolean;
    smsReminders: boolean;
    whatsappReminders: boolean;
    reminderHours: number;
  };
  security: {
    sessionTimeout: number;
    passwordExpiry: number;
    twoFactorEnabled: boolean;
    backupFrequency: string;
  };
}

export function ConfiguracoesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('clinic');

  const { data: settings, isLoading } = useQuery({
    queryKey: ['/api/clinic/settings'],
    select: (data: ClinicSettings) => data || getDefaultSettings()
  });

  const [formData, setFormData] = useState<ClinicSettings>(settings || getDefaultSettings());

  React.useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<ClinicSettings>) => {
      const response = await fetch('/api/clinic/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      if (!response.ok) throw new Error('Failed to update settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clinic/settings'] });
      toast({
        title: "Configurações salvas",
        description: "As configurações foram atualizadas com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao salvar configurações.",
        variant: "destructive",
      });
    }
  });

  function getDefaultSettings(): ClinicSettings {
    return {
      id: 0,
      name: '',
      cnpj: '',
      address: '',
      phone: '',
      email: '',
      website: '',
      workingHours: {
        monday: { start: '08:00', end: '18:00', enabled: true },
        tuesday: { start: '08:00', end: '18:00', enabled: true },
        wednesday: { start: '08:00', end: '18:00', enabled: true },
        thursday: { start: '08:00', end: '18:00', enabled: true },
        friday: { start: '08:00', end: '18:00', enabled: true },
        saturday: { start: '08:00', end: '12:00', enabled: false },
        sunday: { start: '08:00', end: '12:00', enabled: false }
      },
      notifications: {
        emailReminders: true,
        smsReminders: false,
        whatsappReminders: true,
        reminderHours: 24
      },
      security: {
        sessionTimeout: 60,
        passwordExpiry: 90,
        twoFactorEnabled: false,
        backupFrequency: 'daily'
      }
    };
  }

  const handleSave = () => {
    updateSettingsMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Carregando configurações...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações da Clínica</h1>
          <p className="text-muted-foreground">
            Gerencie as configurações gerais da sua clínica
          </p>
        </div>
        <Button onClick={handleSave} disabled={updateSettingsMutation.isPending}>
          <Save className="mr-2 h-4 w-4" />
          Salvar Alterações
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="clinic">
            <Building className="h-4 w-4 mr-2" />
            Clínica
          </TabsTrigger>
          <TabsTrigger value="hours">
            <Clock className="h-4 w-4 mr-2" />
            Horários
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            Segurança
          </TabsTrigger>
          <TabsTrigger value="website">
            <Globe className="h-4 w-4 mr-2" />
            Site da Clínica
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clinic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Informações da Clínica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Clínica</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nome da sua clínica"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={formData.cnpj}
                    onChange={(e) => setFormData(prev => ({ ...prev, cnpj: e.target.value }))}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <div className="flex">
                  <MapPin className="mr-2 h-4 w-4 mt-3 text-muted-foreground" />
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Endereço completo da clínica"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <div className="flex">
                    <Phone className="mr-2 h-4 w-4 mt-3 text-muted-foreground" />
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <div className="flex">
                    <Mail className="mr-2 h-4 w-4 mt-3 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="contato@clinica.com"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hours" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Horários de Funcionamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(formData.workingHours).map(([day, hours]) => (
                <div key={day} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <Switch
                      checked={hours.enabled}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({
                          ...prev,
                          workingHours: {
                            ...prev.workingHours,
                            [day]: { ...hours, enabled: checked }
                          }
                        }))
                      }
                    />
                    <span className="font-medium capitalize w-24">
                      {day === 'monday' && 'Segunda'}
                      {day === 'tuesday' && 'Terça'}
                      {day === 'wednesday' && 'Quarta'}
                      {day === 'thursday' && 'Quinta'}
                      {day === 'friday' && 'Sexta'}
                      {day === 'saturday' && 'Sábado'}
                      {day === 'sunday' && 'Domingo'}
                    </span>
                  </div>
                  
                  {hours.enabled && (
                    <div className="flex items-center space-x-2">
                      <Input
                        type="time"
                        value={hours.start}
                        onChange={(e) => 
                          setFormData(prev => ({
                            ...prev,
                            workingHours: {
                              ...prev.workingHours,
                              [day]: { ...hours, start: e.target.value }
                            }
                          }))
                        }
                        className="w-32"
                      />
                      <span>às</span>
                      <Input
                        type="time"
                        value={hours.end}
                        onChange={(e) => 
                          setFormData(prev => ({
                            ...prev,
                            workingHours: {
                              ...prev.workingHours,
                              [day]: { ...hours, end: e.target.value }
                            }
                          }))
                        }
                        className="w-32"
                      />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Notificações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Lembretes por E-mail</Label>
                    <p className="text-sm text-muted-foreground">Enviar lembretes de consulta por e-mail</p>
                  </div>
                  <Switch
                    checked={formData.notifications.emailReminders}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({
                        ...prev,
                        notifications: { ...prev.notifications, emailReminders: checked }
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Lembretes por WhatsApp</Label>
                    <p className="text-sm text-muted-foreground">Enviar lembretes de consulta por WhatsApp</p>
                  </div>
                  <Switch
                    checked={formData.notifications.whatsappReminders}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({
                        ...prev,
                        notifications: { ...prev.notifications, whatsappReminders: checked }
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reminderHours">Antecedência dos Lembretes (horas)</Label>
                <Input
                  id="reminderHours"
                  type="number"
                  min="1"
                  max="168"
                  value={formData.notifications.reminderHours}
                  onChange={(e) => 
                    setFormData(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications, reminderHours: parseInt(e.target.value) || 24 }
                    }))
                  }
                  className="w-32"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Segurança</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="sessionTimeout">Timeout de Sessão (minutos)</Label>
                <Input
                  id="sessionTimeout"
                  type="number"
                  min="15"
                  max="480"
                  value={formData.security.sessionTimeout}
                  onChange={(e) => 
                    setFormData(prev => ({
                      ...prev,
                      security: { ...prev.security, sessionTimeout: parseInt(e.target.value) || 60 }
                    }))
                  }
                  className="w-32"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Autenticação de Dois Fatores</Label>
                  <p className="text-sm text-muted-foreground">Exigir 2FA para todos os usuários</p>
                </div>
                <Switch
                  checked={formData.security.twoFactorEnabled}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({
                      ...prev,
                      security: { ...prev.security, twoFactorEnabled: checked }
                    }))
                  }
                />
              </div>

              <div className="space-y-4">
                <Button variant="outline">
                  <Database className="mr-2 h-4 w-4" />
                  Fazer Backup Manual
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ConfiguracoesPage;