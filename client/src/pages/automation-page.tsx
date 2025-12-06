import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Bot,
  Building2,
  MessageSquare,
  Bell,
  Cake,
  Star,
  Send,
  Check,
  RefreshCw,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
  QrCode,
  Smartphone,
  WifiOff,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useIntegrations } from "@/hooks/use-integrations";

interface ClinicSettings {
  id?: number;
  companyId?: number;
  // Dados que vem do cadastro da empresa (somente leitura aqui)
  name?: string;
  phone?: string;
  address?: string;
  email?: string;

  // Google - PRECISA CONFIGURAR
  googleReviewLink?: string;
  googleMapsLink?: string;

  // Templates de Mensagem - PRECISA CONFIGURAR
  chatWelcomeMessage?: string;
  confirmationMessageTemplate?: string;
  reminderMessageTemplate?: string;
  birthdayMessageTemplate?: string;
  reviewRequestTemplate?: string;
  cancellationMessageTemplate?: string;

  // Flags de Automacao - PRECISA CONFIGURAR
  enableAppointmentReminders?: boolean;
  enableBirthdayMessages?: boolean;
  enableFeedbackRequests?: boolean;
  chatEnabled?: boolean;
}

const defaultTemplates = {
  chatWelcomeMessage: `Ola! Bem-vindo(a) a *{{companyName}}*!

Como posso ajudar?

1 Agendar consulta
2 Confirmar presenca
3 Remarcar consulta
4 Falar com atendente`,

  confirmationMessageTemplate: `Ola, {{patientName}}!

Lembrete: sua consulta na *{{companyName}}* esta confirmada para *amanha, {{appointmentDate}}*, as *{{appointmentTime}}*.

Responda *SIM* para confirmar ou *NAO* para reagendar.

Te aguardamos!`,

  reminderMessageTemplate: `Ola, {{patientName}}!

Identificamos sua consulta marcada para o dia *{{appointmentDate}}* as *{{appointmentTime}}*.

Posso confirmar sua presenca?`,

  birthdayMessageTemplate: `Feliz aniversario, {{patientName}}!

A equipe da *{{companyName}}* deseja a voce um dia maravilhoso cheio de alegria e saude.

Obrigado por fazer parte da nossa familia!`,

  reviewRequestTemplate: `Ola, {{patientName}}!

Esperamos que sua experiencia na *{{companyName}}* tenha sido excelente!

Sua opiniao e muito importante para nos. Poderia nos avaliar?

{{googleReviewLink}}

Obrigado!`,

  cancellationMessageTemplate: `Ola, {{patientName}}.

Sua consulta do dia *{{appointmentDate}}* as *{{appointmentTime}}* foi cancelada.

Para reagendar, entre em contato conosco:
{{companyPhone}}`,
};

const variablesHelp = [
  { var: "{{patientName}}", desc: "Nome do paciente" },
  { var: "{{appointmentDate}}", desc: "Data da consulta" },
  { var: "{{appointmentTime}}", desc: "Horario da consulta" },
  { var: "{{companyName}}", desc: "Nome da clinica" },
  { var: "{{companyPhone}}", desc: "Telefone da clinica" },
  { var: "{{googleReviewLink}}", desc: "Link de avaliacao Google" },
];

export default function AutomationPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState<string | null>(null);
  const [showQrCodeDialog, setShowQrCodeDialog] = useState(false);

  // Hook de integrações para QR Code WuzAPI
  const {
    integrationSettings,
    wuzapiStatus,
    isLoadingWuzapiStatus,
    refetchWuzapiStatus,
    getQrCode,
    qrCodeData,
    isLoadingQrCode,
    disconnectWuzapi,
    isDisconnecting,
    reconnectWuzapi,
    isReconnecting,
  } = useIntegrations();

  const { data: settings, isLoading } = useQuery<ClinicSettings>({
    queryKey: ["/api/clinic-settings"],
  });

  const handleShowQrCode = async () => {
    // Primeiro tenta reconectar silenciosamente (sem QR code)
    try {
      const result = await reconnectWuzapi();
      if (result?.success && result?.loggedIn) {
        // Reconectou com sucesso, nao precisa de QR code
        toast({
          title: "WhatsApp conectado!",
          description: "Reconectado com sucesso.",
        });
        refetchWuzapiStatus();
        return;
      }
    } catch (error) {
      // Se falhar, precisa de QR code
    }

    // Se nao conseguiu reconectar, abre popup para QR code
    setShowQrCodeDialog(true);
    await getQrCode();
  };

  const [formData, setFormData] = useState<ClinicSettings>({
    ...defaultTemplates,
    enableAppointmentReminders: true,
    enableBirthdayMessages: true,
    enableFeedbackRequests: true,
    chatEnabled: true,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        ...formData,
        ...settings,
        chatWelcomeMessage: settings.chatWelcomeMessage || defaultTemplates.chatWelcomeMessage,
        confirmationMessageTemplate: settings.confirmationMessageTemplate || defaultTemplates.confirmationMessageTemplate,
        reminderMessageTemplate: settings.reminderMessageTemplate || defaultTemplates.reminderMessageTemplate,
        birthdayMessageTemplate: settings.birthdayMessageTemplate || defaultTemplates.birthdayMessageTemplate,
        reviewRequestTemplate: settings.reviewRequestTemplate || defaultTemplates.reviewRequestTemplate,
        cancellationMessageTemplate: settings.cancellationMessageTemplate || defaultTemplates.cancellationMessageTemplate,
        enableAppointmentReminders: settings.enableAppointmentReminders ?? true,
        enableBirthdayMessages: settings.enableBirthdayMessages ?? true,
        enableFeedbackRequests: settings.enableFeedbackRequests ?? true,
        chatEnabled: settings.chatEnabled ?? true,
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: ClinicSettings) => {
      const method = settings?.id ? "PUT" : "POST";
      const res = await apiRequest(method, "/api/clinic-settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinic-settings"] });
      toast({
        title: "Configuracoes salvas!",
        description: "As variaveis de automacao foram atualizadas. O N8N usara esses dados automaticamente.",
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

  const handleInputChange = (field: keyof ClinicSettings, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const resetTemplate = (field: keyof typeof defaultTemplates) => {
    setFormData((prev) => ({ ...prev, [field]: defaultTemplates[field] }));
    toast({
      title: "Template restaurado",
      description: "O template padrao foi restaurado.",
    });
  };

  // Verificar status das configuracoes
  const isWhatsAppConnected = wuzapiStatus?.loggedIn ?? false;
  const isGoogleConfigured = !!formData.googleReviewLink;
  const hasCompanyData = !!(settings?.name && settings?.phone);

  if (isLoading) {
    return (
      <DashboardLayout title="Automacoes N8N" currentPath="/automacoes">
        <div className="flex items-center justify-center h-96">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Automacoes N8N" currentPath="/automacoes">
      <div className="space-y-6">
        {/* Header com botao salvar */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bot className="h-6 w-6 text-purple-600" />
              Variaveis de Automacao (N8N)
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure as variaveis que serao usadas pelos fluxos automaticos do N8N
            </p>
          </div>
          <Button onClick={handleSave} disabled={saveMutation.isPending} size="lg">
            {saveMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Salvar Configuracoes
          </Button>
        </div>

        {/* Status das configuracoes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className={hasCompanyData ? "border-green-500" : "border-yellow-500"}>
            <CardContent className="pt-4 flex items-center gap-3">
              {hasCompanyData ? (
                <CheckCircle className="h-8 w-8 text-green-600" />
              ) : (
                <XCircle className="h-8 w-8 text-yellow-600" />
              )}
              <div>
                <p className="font-medium">Dados da Empresa</p>
                <p className="text-sm text-muted-foreground">
                  {hasCompanyData ? `${settings?.name}` : "Cadastre sua empresa"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className={isWhatsAppConnected ? "border-green-500" : "border-yellow-500"}>
            <CardContent className="pt-4 flex items-center gap-3">
              {isWhatsAppConnected ? (
                <CheckCircle className="h-8 w-8 text-green-600" />
              ) : (
                <XCircle className="h-8 w-8 text-yellow-600" />
              )}
              <div>
                <p className="font-medium">WhatsApp</p>
                <p className="text-sm text-muted-foreground">
                  {isWhatsAppConnected ? "Conectado" : "Conecte abaixo via QR Code"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className={isGoogleConfigured ? "border-green-500" : "border-yellow-500"}>
            <CardContent className="pt-4 flex items-center gap-3">
              {isGoogleConfigured ? (
                <CheckCircle className="h-8 w-8 text-green-600" />
              ) : (
                <XCircle className="h-8 w-8 text-yellow-600" />
              )}
              <div>
                <p className="font-medium">Google Reviews</p>
                <p className="text-sm text-muted-foreground">
                  {isGoogleConfigured ? "Configurado" : "Configure abaixo"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secao: Dados da Empresa (somente leitura) */}
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Dados da Empresa (Automatico)
            </CardTitle>
            <CardDescription>
              Esses dados vem do cadastro da empresa e sao usados automaticamente nas mensagens.
              Para alterar, va em Configuracoes &gt; Dados da Empresa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nome da Clinica</Label>
                <p className="font-medium">{settings?.name || "Nao cadastrado"}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Telefone</Label>
                <p className="font-medium">{settings?.phone || "Nao cadastrado"}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Endereco</Label>
                <p className="font-medium">{settings?.address || "Nao cadastrado"}</p>
              </div>
            </div>
            {!hasCompanyData && (
              <Alert className="mt-4" variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Dados da empresa nao encontrados. Configure em Configuracoes &gt; Dados da Empresa.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Secao: WhatsApp / Wuzapi com QR Code */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <MessageSquare className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <CardTitle className="text-xl">WhatsApp (Wuzapi)</CardTitle>
                  <CardDescription>
                    Conecte seu WhatsApp para enviar mensagens automaticas
                  </CardDescription>
                </div>
              </div>
              {wuzapiStatus?.loggedIn && (
                <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Conectado
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status da Conexão WhatsApp */}
            <div className="rounded-lg border-2 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${wuzapiStatus?.loggedIn ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
                    <Smartphone className={`h-5 w-5 ${wuzapiStatus?.loggedIn ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`} />
                  </div>
                  <div>
                    <p className="font-medium">
                      {isLoadingWuzapiStatus ? 'Verificando...' :
                        wuzapiStatus?.loggedIn ? 'WhatsApp Conectado' : 'Aguardando Conexao'}
                    </p>
                    {wuzapiStatus?.phoneNumber && (
                      <p className="text-sm text-muted-foreground">
                        {wuzapiStatus.pushName} • {wuzapiStatus.phoneNumber}
                      </p>
                    )}
                    {!wuzapiStatus?.loggedIn && (
                      <p className="text-sm text-yellow-600 dark:text-yellow-400">
                        Clique em "Conectar via QR Code" para conectar
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {wuzapiStatus?.loggedIn ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/10"
                      onClick={() => disconnectWuzapi()}
                      disabled={isDisconnecting}
                    >
                      {isDisconnecting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <WifiOff className="mr-2 h-4 w-4" />
                      )}
                      Desconectar
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleShowQrCode}
                      disabled={isLoadingQrCode || isReconnecting}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isLoadingQrCode || isReconnecting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <QrCode className="mr-2 h-4 w-4" />
                      )}
                      {isReconnecting ? 'Conectando...' : 'Conectar WhatsApp'}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => refetchWuzapiStatus()}
                    title="Atualizar status"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Dialog QR Code */}
            <Dialog open={showQrCodeDialog} onOpenChange={setShowQrCodeDialog}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <QrCode className="h-5 w-5" />
                    Conectar WhatsApp
                  </DialogTitle>
                  <DialogDescription>
                    Escaneie o QR Code com seu WhatsApp para conectar
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center justify-center py-6">
                  {isLoadingQrCode ? (
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                      <p className="text-muted-foreground">Gerando QR Code...</p>
                    </div>
                  ) : qrCodeData?.connected ? (
                    <div className="flex flex-col items-center gap-4">
                      <CheckCircle className="h-16 w-16 text-green-500" />
                      <p className="text-lg font-medium text-green-700 dark:text-green-400">WhatsApp ja conectado!</p>
                    </div>
                  ) : qrCodeData?.qrCode ? (
                    <div className="flex flex-col items-center gap-4">
                      <img
                        src={qrCodeData.qrCode.startsWith('data:') ? qrCodeData.qrCode : `data:image/png;base64,${qrCodeData.qrCode}`}
                        alt="QR Code WhatsApp"
                        className="w-64 h-64 border rounded-lg"
                      />
                      <p className="text-sm text-muted-foreground text-center">
                        Abra o WhatsApp no seu celular, va em Configuracoes {'>'} Dispositivos conectados {'>'} Conectar dispositivo
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => getQrCode()}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Atualizar QR Code
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <AlertCircle className="h-12 w-12 text-yellow-500" />
                      <p className="text-muted-foreground text-center">
                        {qrCodeData?.message || 'Nao foi possivel gerar o QR Code. Verifique suas credenciais em Integracoes.'}
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => getQrCode()}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Tentar Novamente
                      </Button>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Info sobre configuracao */}
            {!wuzapiStatus?.loggedIn && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  O WhatsApp da clinica e configurado uma unica vez em <strong>Configuracoes &gt; Integracoes</strong>.
                  Apos conectar via QR Code, os dentistas podem cadastrar seus numeros no perfil para receber notificacoes individuais.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Secao: Google */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-600" />
              Google (Avaliacao e Localizacao)
            </CardTitle>
            <CardDescription>
              Links do Google para avaliacoes e localizacao da clinica
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="googleReviewLink">Link de Avaliacao Google *</Label>
              <Input
                id="googleReviewLink"
                value={formData.googleReviewLink || ""}
                onChange={(e) => handleInputChange("googleReviewLink", e.target.value)}
                placeholder="https://g.co/kgs/XXXXXXX"
              />
              <p className="text-xs text-muted-foreground">
                Link curto do Google para clientes deixarem avaliacoes (obrigatorio para automacao de avaliacoes)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="googleMapsLink">Link do Google Maps</Label>
              <Input
                id="googleMapsLink"
                value={formData.googleMapsLink || ""}
                onChange={(e) => handleInputChange("googleMapsLink", e.target.value)}
                placeholder="https://maps.google.com/?q=..."
              />
              <p className="text-xs text-muted-foreground">
                Link para a localizacao da clinica no Google Maps
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Secao: Automacoes Habilitadas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-purple-600" />
              Automacoes Habilitadas
            </CardTitle>
            <CardDescription>
              Ative ou desative cada tipo de automacao
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Bell className="h-6 w-6 text-blue-600" />
                <div>
                  <p className="font-medium">Confirmacao de Consulta (24h antes)</p>
                  <p className="text-sm text-muted-foreground">
                    Envia lembrete um dia antes da consulta pedindo confirmacao
                  </p>
                </div>
              </div>
              <Switch
                checked={formData.enableAppointmentReminders ?? true}
                onCheckedChange={(checked) => handleInputChange("enableAppointmentReminders", checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Cake className="h-6 w-6 text-pink-600" />
                <div>
                  <p className="font-medium">Mensagem de Aniversario</p>
                  <p className="text-sm text-muted-foreground">
                    Envia felicitacoes as 9h no dia do aniversario do paciente
                  </p>
                </div>
              </div>
              <Switch
                checked={formData.enableBirthdayMessages ?? true}
                onCheckedChange={(checked) => handleInputChange("enableBirthdayMessages", checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Star className="h-6 w-6 text-yellow-600" />
                <div>
                  <p className="font-medium">Solicitacao de Avaliacao</p>
                  <p className="text-sm text-muted-foreground">
                    Envia link do Google Reviews apos a consulta (requer Link Google configurado)
                  </p>
                </div>
              </div>
              <Switch
                checked={formData.enableFeedbackRequests ?? true}
                onCheckedChange={(checked) => handleInputChange("enableFeedbackRequests", checked)}
                disabled={!isGoogleConfigured}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg border-purple-200 bg-purple-50/50">
              <div className="flex items-center gap-3">
                <Bot className="h-6 w-6 text-purple-600" />
                <div>
                  <p className="font-medium">Agente IA (Atendimento Automatico)</p>
                  <p className="text-sm text-muted-foreground">
                    Responde mensagens automaticamente usando IA (agendamentos, duvidas, etc.)
                  </p>
                </div>
              </div>
              <Switch
                checked={formData.chatEnabled ?? true}
                onCheckedChange={(checked) => handleInputChange("chatEnabled", checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Secao: Templates de Mensagens */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-indigo-600" />
              Templates de Mensagens
            </CardTitle>
            <CardDescription>
              Personalize as mensagens automaticas enviadas aos pacientes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Variaveis disponiveis */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Variaveis disponiveis:</strong>
                <div className="flex flex-wrap gap-2 mt-2">
                  {variablesHelp.map((v) => (
                    <Badge
                      key={v.var}
                      variant="secondary"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                      onClick={() => copyToClipboard(v.var, v.var)}
                    >
                      {v.var}
                      {copied === v.var && <Check className="h-3 w-3 ml-1" />}
                    </Badge>
                  ))}
                </div>
              </AlertDescription>
            </Alert>

            {/* Template Boas-vindas */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="chatWelcomeMessage">Mensagem de Boas-vindas (Saudacao Inicial)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetTemplate("chatWelcomeMessage")}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Restaurar padrao
                </Button>
              </div>
              <Textarea
                id="chatWelcomeMessage"
                value={formData.chatWelcomeMessage || ""}
                onChange={(e) => handleInputChange("chatWelcomeMessage", e.target.value)}
                rows={5}
                placeholder="Mensagem de boas-vindas..."
              />
              <p className="text-xs text-muted-foreground">
                Enviada quando o paciente envia "Oi", "Ola", "Bom dia", etc.
              </p>
            </div>

            <Separator />

            {/* Template Confirmacao */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="confirmationMessageTemplate">Mensagem de Confirmacao (24h antes)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetTemplate("confirmationMessageTemplate")}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Restaurar padrao
                </Button>
              </div>
              <Textarea
                id="confirmationMessageTemplate"
                value={formData.confirmationMessageTemplate || ""}
                onChange={(e) => handleInputChange("confirmationMessageTemplate", e.target.value)}
                rows={5}
                placeholder="Mensagem de confirmacao..."
              />
            </div>

            <Separator />

            {/* Template Lembrete */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="reminderMessageTemplate">Mensagem de Lembrete</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetTemplate("reminderMessageTemplate")}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Restaurar padrao
                </Button>
              </div>
              <Textarea
                id="reminderMessageTemplate"
                value={formData.reminderMessageTemplate || ""}
                onChange={(e) => handleInputChange("reminderMessageTemplate", e.target.value)}
                rows={4}
                placeholder="Mensagem de lembrete..."
              />
            </div>

            <Separator />

            {/* Template Aniversario */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="birthdayMessageTemplate">Mensagem de Aniversario</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetTemplate("birthdayMessageTemplate")}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Restaurar padrao
                </Button>
              </div>
              <Textarea
                id="birthdayMessageTemplate"
                value={formData.birthdayMessageTemplate || ""}
                onChange={(e) => handleInputChange("birthdayMessageTemplate", e.target.value)}
                rows={4}
                placeholder="Mensagem de aniversario..."
              />
            </div>

            <Separator />

            {/* Template Avaliacao */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="reviewRequestTemplate">Solicitacao de Avaliacao</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetTemplate("reviewRequestTemplate")}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Restaurar padrao
                </Button>
              </div>
              <Textarea
                id="reviewRequestTemplate"
                value={formData.reviewRequestTemplate || ""}
                onChange={(e) => handleInputChange("reviewRequestTemplate", e.target.value)}
                rows={5}
                placeholder="Mensagem de avaliacao..."
              />
            </div>

            <Separator />

            {/* Template Cancelamento */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="cancellationMessageTemplate">Mensagem de Cancelamento</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetTemplate("cancellationMessageTemplate")}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Restaurar padrao
                </Button>
              </div>
              <Textarea
                id="cancellationMessageTemplate"
                value={formData.cancellationMessageTemplate || ""}
                onChange={(e) => handleInputChange("cancellationMessageTemplate", e.target.value)}
                rows={4}
                placeholder="Mensagem de cancelamento..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Botao Salvar Final */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saveMutation.isPending} size="lg">
            {saveMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Salvar Todas as Configuracoes
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
