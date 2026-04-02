import { useState, useEffect } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Bell, MessageCircle, Mail, Smartphone, Save, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ChannelSettings {
  whatsapp: boolean;
  email: boolean;
  sms: boolean;
}

interface NotificationSection {
  enabled: boolean;
  channels: ChannelSettings;
  template: string;
}

interface AppointmentReminder extends NotificationSection {
  hoursBeforeAppointment: number;
}

interface NotificationSettings {
  appointmentReminder: AppointmentReminder;
  birthday: NotificationSection;
  marketing: NotificationSection;
  system: NotificationSection;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  appointmentReminder: {
    enabled: true,
    channels: { whatsapp: true, email: true, sms: false },
    hoursBeforeAppointment: 24,
    template:
      "Olá {nome}, lembramos que você tem uma consulta agendada amanhã às {horario} com {dentista}. Confirme sua presença respondendo SIM.",
  },
  birthday: {
    enabled: true,
    channels: { whatsapp: true, email: false, sms: false },
    template:
      "Parabéns, {nome}! A equipe da {clinica} deseja um feliz aniversário. Aproveite e agende sua consulta de rotina com desconto especial.",
  },
  marketing: {
    enabled: false,
    channels: { whatsapp: false, email: true, sms: false },
    template:
      "Olá {nome}! Temos novidades na {clinica}. Confira nossas promoções e novos tratamentos disponíveis.",
  },
  system: {
    enabled: true,
    channels: { whatsapp: false, email: true, sms: false },
    template:
      "Notificação do sistema: {mensagem}. Acesse o painel para mais detalhes.",
  },
};

interface SectionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;
  enabled: boolean;
  onEnabledChange: (val: boolean) => void;
  channels: ChannelSettings;
  onChannelChange: (channel: keyof ChannelSettings, val: boolean) => void;
  template: string;
  onTemplateChange: (val: string) => void;
  children?: React.ReactNode;
}

function SectionCard({
  title,
  description,
  icon,
  accentColor,
  enabled,
  onEnabledChange,
  channels,
  onChannelChange,
  template,
  onTemplateChange,
  children,
}: SectionCardProps) {
  return (
    <Card className={`transition-opacity ${!enabled ? "opacity-70" : ""}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${accentColor}`}>{icon}</div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="mt-0.5">{description}</CardDescription>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={onEnabledChange} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {children}
        <div>
          <p className="text-sm font-medium mb-3">Canais de envio</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">WhatsApp</span>
              </div>
              <Switch
                checked={channels.whatsapp}
                onCheckedChange={(val) => onChannelChange("whatsapp", val)}
                disabled={!enabled}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Email</span>
              </div>
              <Switch
                checked={channels.email}
                onCheckedChange={(val) => onChannelChange("email", val)}
                disabled={!enabled}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium">SMS</span>
              </div>
              <Switch
                checked={channels.sms}
                onCheckedChange={(val) => onChannelChange("sms", val)}
                disabled={!enabled}
              />
            </div>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label htmlFor={`template-${title}`} className="text-sm font-medium">
              Modelo da mensagem
            </Label>
            <p className="text-xs text-muted-foreground">
              Use: {"{nome}"}, {"{horario}"}, {"{dentista}"}, {"{clinica}"}
            </p>
          </div>
          <Textarea
            id={`template-${title}`}
            value={template}
            onChange={(e) => onTemplateChange(e.target.value)}
            rows={3}
            disabled={!enabled}
            className="resize-none text-sm"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function ConfiguracoesNotificacoesPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);

  const { data: remoteSettings, isLoading } = useQuery<NotificationSettings>({
    queryKey: ["/api/v1/settings/notifications"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/v1/settings/notifications");
        return res.json();
      } catch {
        return DEFAULT_SETTINGS;
      }
    },
  });

  useEffect(() => {
    if (remoteSettings) {
      setSettings(remoteSettings);
    }
  }, [remoteSettings]);

  const saveMutation = useMutation({
    mutationFn: async (data: NotificationSettings) => {
      const res = await apiRequest("PUT", "/api/v1/settings/notifications", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/settings/notifications"] });
      toast({
        title: "Configurações salvas",
        description: "As configurações de notificação foram atualizadas.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateSection = <K extends keyof NotificationSettings>(
    section: K,
    patch: Partial<NotificationSettings[K]>
  ) => {
    setSettings((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...patch },
    }));
  };

  const updateChannel = (
    section: keyof NotificationSettings,
    channel: keyof ChannelSettings,
    value: boolean
  ) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        channels: { ...prev[section].channels, [channel]: value },
      },
    }));
  };

  const handleReset = () => {
    if (remoteSettings) {
      setSettings(remoteSettings);
    } else {
      setSettings(DEFAULT_SETTINGS);
    }
    toast({ title: "Configurações restauradas." });
  };

  return (
    <DashboardLayout title="Configurações de Notificações" currentPath="/configuracoes/notificacoes">
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Configurações de Notificações</h1>
              <p className="text-sm text-muted-foreground">
                Configure como e quando os pacientes e a equipe recebem notificações.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Restaurar
            </Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate(settings)}
              disabled={saveMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-24">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <SectionCard
              title="Lembretes de Consulta"
              description="Envie lembretes automáticos antes das consultas agendadas."
              icon={<Bell className="h-4 w-4 text-blue-600" />}
              accentColor="bg-blue-100"
              enabled={settings.appointmentReminder.enabled}
              onEnabledChange={(val) =>
                updateSection("appointmentReminder", { enabled: val })
              }
              channels={settings.appointmentReminder.channels}
              onChannelChange={(ch, val) => updateChannel("appointmentReminder", ch, val)}
              template={settings.appointmentReminder.template}
              onTemplateChange={(val) =>
                updateSection("appointmentReminder", { template: val })
              }
            >
              <div className="grid gap-2">
                <Label htmlFor="hours-before">Antecedência do lembrete (horas antes)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="hours-before"
                    type="number"
                    min="1"
                    max="168"
                    value={settings.appointmentReminder.hoursBeforeAppointment}
                    onChange={(e) =>
                      updateSection("appointmentReminder", {
                        hoursBeforeAppointment: Number(e.target.value),
                      })
                    }
                    className="w-28"
                    disabled={!settings.appointmentReminder.enabled}
                  />
                  <span className="text-sm text-muted-foreground">
                    horas antes da consulta
                  </span>
                </div>
              </div>
              <Separator />
            </SectionCard>

            <SectionCard
              title="Aniversários"
              description="Parabenize os pacientes no dia do aniversário com uma mensagem especial."
              icon={<Bell className="h-4 w-4 text-pink-600" />}
              accentColor="bg-pink-100"
              enabled={settings.birthday.enabled}
              onEnabledChange={(val) => updateSection("birthday", { enabled: val })}
              channels={settings.birthday.channels}
              onChannelChange={(ch, val) => updateChannel("birthday", ch, val)}
              template={settings.birthday.template}
              onTemplateChange={(val) => updateSection("birthday", { template: val })}
            />

            <SectionCard
              title="Marketing"
              description="Envie comunicados promocionais e novidades da clínica."
              icon={<Bell className="h-4 w-4 text-purple-600" />}
              accentColor="bg-purple-100"
              enabled={settings.marketing.enabled}
              onEnabledChange={(val) => updateSection("marketing", { enabled: val })}
              channels={settings.marketing.channels}
              onChannelChange={(ch, val) => updateChannel("marketing", ch, val)}
              template={settings.marketing.template}
              onTemplateChange={(val) => updateSection("marketing", { template: val })}
            />

            <SectionCard
              title="Sistema"
              description="Notificações internas sobre eventos do sistema, erros e alertas operacionais."
              icon={<Bell className="h-4 w-4 text-gray-600" />}
              accentColor="bg-gray-100"
              enabled={settings.system.enabled}
              onEnabledChange={(val) => updateSection("system", { enabled: val })}
              channels={settings.system.channels}
              onChannelChange={(ch, val) => updateChannel("system", ch, val)}
              template={settings.system.template}
              onTemplateChange={(val) => updateSection("system", { template: val })}
            />
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button
            onClick={() => saveMutation.mutate(settings)}
            disabled={saveMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
