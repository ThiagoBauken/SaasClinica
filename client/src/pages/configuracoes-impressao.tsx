import { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Printer, Eye, FileText } from "lucide-react";

interface DocumentTemplate {
  headerText: string;
  footerText: string;
  showLogo: boolean;
  showClinicInfo: boolean;
}

interface PageLayout {
  pageSize: string;
  orientation: string;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
}

interface PrintingSettings {
  recibo: DocumentTemplate;
  orcamento: DocumentTemplate;
  atestado: DocumentTemplate;
  receituario: DocumentTemplate;
  declaracao: DocumentTemplate;
  layout: PageLayout;
}

type DocumentKey = keyof Omit<PrintingSettings, "layout">;

const defaultTemplate: DocumentTemplate = {
  headerText: "",
  footerText: "",
  showLogo: true,
  showClinicInfo: true,
};

const defaultSettings: PrintingSettings = {
  recibo: { ...defaultTemplate },
  orcamento: { ...defaultTemplate },
  atestado: { ...defaultTemplate },
  receituario: { ...defaultTemplate },
  declaracao: { ...defaultTemplate },
  layout: {
    pageSize: "A4",
    orientation: "retrato",
    marginTop: 20,
    marginBottom: 20,
    marginLeft: 20,
    marginRight: 20,
  },
};

const documentLabels: Record<DocumentKey, string> = {
  recibo: "Recibo",
  orcamento: "Orçamento",
  atestado: "Atestado",
  receituario: "Receituário",
  declaracao: "Declaração",
};

export default function ConfiguracoesImpressaoPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<PrintingSettings>(defaultSettings);

  const { isLoading } = useQuery<PrintingSettings>({
    queryKey: ["/api/v1/settings/printing"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/v1/settings/printing");
        const data = await res.json();
        setSettings(data);
        return data;
      } catch {
        return defaultSettings;
      }
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: PrintingSettings) => {
      const res = await apiRequest("PUT", "/api/v1/settings/printing", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/settings/printing"] });
      toast({ title: "Configurações salvas", description: "As configurações de impressão foram salvas com sucesso." });
    },
    onError: () => {
      toast({ title: "Erro ao salvar", description: "Não foi possível salvar as configurações. Tente novamente.", variant: "destructive" });
    },
  });

  const updateTemplate = (doc: DocumentKey, key: keyof DocumentTemplate, value: string | boolean) => {
    setSettings((prev) => ({
      ...prev,
      [doc]: { ...prev[doc], [key]: value },
    }));
  };

  const updateLayout = (key: keyof PageLayout, value: string | number) => {
    setSettings((prev) => ({
      ...prev,
      layout: { ...prev.layout, [key]: value },
    }));
  };

  const handlePreview = () => {
    toast({ title: "Prévia em desenvolvimento", description: "A funcionalidade de prévia estará disponível em breve." });
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Configurações de Impressão" currentPath="/settings/printing">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Configurações de Impressão" currentPath="/settings/printing">
      <div className="max-w-4xl mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações de Impressão</h1>
          <p className="text-muted-foreground mt-1">Configure os modelos de documentos, cabeçalho, rodapé e layout de página.</p>
        </div>

        {/* Page Layout */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Layout de Página</CardTitle>
            </div>
            <CardDescription>Configurações globais de tamanho e margens aplicadas a todos os documentos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pageSize">Tamanho da Página</Label>
                <Select value={settings.layout.pageSize} onValueChange={(val) => updateLayout("pageSize", val)}>
                  <SelectTrigger id="pageSize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A4">A4 (210 × 297 mm)</SelectItem>
                    <SelectItem value="A5">A5 (148 × 210 mm)</SelectItem>
                    <SelectItem value="Carta">Carta (216 × 279 mm)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="orientation">Orientação</Label>
                <Select value={settings.layout.orientation} onValueChange={(val) => updateLayout("orientation", val)}>
                  <SelectTrigger id="orientation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retrato">Retrato (Vertical)</SelectItem>
                    <SelectItem value="paisagem">Paisagem (Horizontal)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-3">Margens (mm)</p>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { key: "marginTop" as keyof PageLayout, label: "Superior" },
                  { key: "marginBottom" as keyof PageLayout, label: "Inferior" },
                  { key: "marginLeft" as keyof PageLayout, label: "Esquerda" },
                  { key: "marginRight" as keyof PageLayout, label: "Direita" },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key} className="text-xs text-muted-foreground">{label}</Label>
                    <Input
                      id={key}
                      type="number"
                      min={0}
                      max={50}
                      value={settings.layout[key] as number}
                      onChange={(e) => updateLayout(key, parseInt(e.target.value) || 0)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Document Templates */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Modelos de Documentos</CardTitle>
            </div>
            <CardDescription>Personalize o cabeçalho e rodapé de cada tipo de documento.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="recibo">
              <TabsList className="grid w-full grid-cols-5 mb-6">
                {(Object.keys(documentLabels) as DocumentKey[]).map((doc) => (
                  <TabsTrigger key={doc} value={doc} className="text-xs">
                    {documentLabels[doc]}
                  </TabsTrigger>
                ))}
              </TabsList>

              {(Object.keys(documentLabels) as DocumentKey[]).map((doc) => (
                <TabsContent key={doc} value={doc} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`${doc}-header`}>Texto do Cabeçalho</Label>
                    <Textarea
                      id={`${doc}-header`}
                      placeholder={`Texto exibido no cabeçalho do ${documentLabels[doc].toLowerCase()}...`}
                      rows={3}
                      value={settings[doc].headerText}
                      onChange={(e) => updateTemplate(doc, "headerText", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${doc}-footer`}>Texto do Rodapé</Label>
                    <Textarea
                      id={`${doc}-footer`}
                      placeholder={`Texto exibido no rodapé do ${documentLabels[doc].toLowerCase()}...`}
                      rows={3}
                      value={settings[doc].footerText}
                      onChange={(e) => updateTemplate(doc, "footerText", e.target.value)}
                    />
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Exibir Logo da Clínica</p>
                        <p className="text-xs text-muted-foreground">Mostra o logotipo no cabeçalho do documento</p>
                      </div>
                      <Switch
                        checked={settings[doc].showLogo}
                        onCheckedChange={(checked) => updateTemplate(doc, "showLogo", checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Exibir Informações da Clínica</p>
                        <p className="text-xs text-muted-foreground">Mostra nome, endereço e contato da clínica</p>
                      </div>
                      <Switch
                        checked={settings[doc].showClinicInfo}
                        onCheckedChange={(checked) => updateTemplate(doc, "showClinicInfo", checked)}
                      />
                    </div>
                  </div>
                  <div className="pt-2">
                    <Button variant="outline" size="sm" onClick={handlePreview}>
                      <Eye className="mr-2 h-4 w-4" />
                      Visualizar Prévia
                    </Button>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
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
              "Salvar Configurações"
            )}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
