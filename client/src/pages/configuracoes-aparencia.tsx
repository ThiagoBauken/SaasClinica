import { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Sun, Moon, Monitor, PanelLeft, Type, ImageIcon, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppearanceSettings {
  theme: "light" | "dark" | "system";
  primaryColor: string;
  sidebarStyle: "compact" | "expanded";
  fontSize: "small" | "medium" | "large";
  showClinicName: boolean;
}

const defaultSettings: AppearanceSettings = {
  theme: "system",
  primaryColor: "blue",
  sidebarStyle: "expanded",
  fontSize: "medium",
  showClinicName: true,
};

const colorOptions = [
  { value: "blue", label: "Azul", bg: "bg-blue-500", ring: "ring-blue-500" },
  { value: "green", label: "Verde", bg: "bg-green-500", ring: "ring-green-500" },
  { value: "purple", label: "Roxo", bg: "bg-purple-500", ring: "ring-purple-500" },
  { value: "red", label: "Vermelho", bg: "bg-red-500", ring: "ring-red-500" },
  { value: "orange", label: "Laranja", bg: "bg-orange-500", ring: "ring-orange-500" },
  { value: "teal", label: "Teal", bg: "bg-teal-500", ring: "ring-teal-500" },
];

const themeOptions = [
  { value: "light" as const, label: "Claro", icon: Sun },
  { value: "dark" as const, label: "Escuro", icon: Moon },
  { value: "system" as const, label: "Sistema", icon: Monitor },
];

const sidebarOptions = [
  { value: "compact" as const, label: "Compacto", description: "Apenas ícones na barra lateral" },
  { value: "expanded" as const, label: "Expandido", description: "Ícones e texto na barra lateral" },
];

const fontSizeOptions = [
  { value: "small" as const, label: "Pequeno", sample: "text-sm" },
  { value: "medium" as const, label: "Médio", sample: "text-base" },
  { value: "large" as const, label: "Grande", sample: "text-lg" },
];

export default function ConfiguracoesAparenciaPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AppearanceSettings>(defaultSettings);

  useQuery<AppearanceSettings>({
    queryKey: ["/api/v1/settings/appearance"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/v1/settings/appearance");
        const data = await res.json();
        setSettings(data);
        return data;
      } catch {
        return defaultSettings;
      }
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: AppearanceSettings) => {
      const res = await apiRequest("PUT", "/api/v1/settings/appearance", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/settings/appearance"] });
      toast({ title: "Aparência salva", description: "As configurações de aparência foram aplicadas." });
    },
    onError: () => {
      toast({ title: "Erro ao salvar", description: "Não foi possível salvar as configurações. Tente novamente.", variant: "destructive" });
    },
  });

  return (
    <DashboardLayout title="Configurações de Aparência" currentPath="/settings/appearance">
      <div className="max-w-3xl mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Aparência e Tema</h1>
          <p className="text-muted-foreground mt-1">Personalize a aparência visual do sistema para sua clínica.</p>
        </div>

        {/* Theme Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sun className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Tema</CardTitle>
            </div>
            <CardDescription>Escolha entre modo claro, escuro ou automático conforme o sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {themeOptions.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSettings((prev) => ({ ...prev, theme: value }))}
                  className={cn(
                    "flex flex-col items-center gap-3 rounded-lg border-2 p-4 transition-all hover:bg-muted/50 cursor-pointer",
                    settings.theme === value
                      ? "border-primary bg-primary/5"
                      : "border-muted"
                  )}
                >
                  <div className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full",
                    settings.theme === value ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium">{label}</span>
                  {settings.theme === value && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Primary Color */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
              <CardTitle className="text-base">Cor Principal</CardTitle>
            </div>
            <CardDescription>Selecione a cor de destaque usada nos botões, links e elementos ativos.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {colorOptions.map(({ value, label, bg, ring }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSettings((prev) => ({ ...prev, primaryColor: value }))}
                  className={cn(
                    "flex flex-col items-center gap-2 cursor-pointer group"
                  )}
                  aria-label={`Cor ${label}`}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-full transition-all",
                    bg,
                    settings.primaryColor === value
                      ? `ring-2 ring-offset-2 ${ring} scale-110`
                      : "opacity-70 hover:opacity-100 hover:scale-105"
                  )}>
                    {settings.primaryColor === value && (
                      <div className="flex items-center justify-center w-full h-full">
                        <CheckCircle2 className="h-5 w-5 text-white" />
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar Style */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <PanelLeft className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Estilo da Barra Lateral</CardTitle>
            </div>
            <CardDescription>Escolha como a barra de navegação lateral é exibida.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {sidebarOptions.map(({ value, label, description }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSettings((prev) => ({ ...prev, sidebarStyle: value }))}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-all hover:bg-muted/50 cursor-pointer",
                    settings.sidebarStyle === value
                      ? "border-primary bg-primary/5"
                      : "border-muted"
                  )}
                >
                  <div className={cn(
                    "mt-0.5 flex items-center justify-center w-5 h-5 rounded-full border-2 flex-shrink-0",
                    settings.sidebarStyle === value
                      ? "border-primary bg-primary"
                      : "border-muted-foreground"
                  )}>
                    {settings.sidebarStyle === value && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Font Size */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Type className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Tamanho da Fonte</CardTitle>
            </div>
            <CardDescription>Ajuste o tamanho do texto exibido em toda a interface.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {fontSizeOptions.map(({ value, label, sample }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSettings((prev) => ({ ...prev, fontSize: value }))}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all hover:bg-muted/50 cursor-pointer",
                    settings.fontSize === value
                      ? "border-primary bg-primary/5"
                      : "border-muted"
                  )}
                >
                  <span className={cn("font-medium", sample)}>Aa</span>
                  <span className="text-xs text-muted-foreground">{label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Logo Upload */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Logo da Clínica</CardTitle>
            </div>
            <CardDescription>Faça upload do logotipo para exibição no sistema e nos documentos impressos.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 flex flex-col items-center justify-center gap-3 hover:border-muted-foreground/50 transition-colors cursor-pointer bg-muted/20">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Arraste ou clique para enviar o logo</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG ou SVG. Máximo 2MB. Recomendado: 200 × 60px</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clinic Name Toggle */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Exibir Nome da Clínica</p>
                <p className="text-xs text-muted-foreground mt-0.5">Mostra o nome da clínica na barra lateral e no cabeçalho</p>
              </div>
              <Switch
                checked={settings.showClinicName}
                onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, showClinicName: checked }))}
              />
            </div>
          </CardContent>
        </Card>

        <Separator />

        <div className="flex justify-end">
          <Button
            onClick={() => saveMutation.mutate(settings)}
            disabled={saveMutation.isPending}
            className="min-w-[140px]"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Aparência"
            )}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
